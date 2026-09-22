import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import release from '../release.json' with { type: 'json' };
import { sourceFingerprint } from './release-files.mjs';
import assert from 'node:assert/strict';
import { prepareSearch } from './prepare-search.mjs';
import { entries as searchEntries } from '../app/search/catalog.mjs';

const fingerprint = process.env.SHADOW16_BUILD_FINGERPRINT;
assert.equal(
  fingerprint,
  sourceFingerprint(),
  'Run pnpm build to compile and prepare the same sources.',
);

const output = join(process.cwd(), 'dist', 'client');

// Review prototypes stay available locally, outside the production bundle.
await rm(join(output, 'report-prototype'), { recursive: true, force: true });

// The shared root layout is used by both locale trees. English documents must
// advertise their own language even before client-side language detection.
async function markEnglishHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await markEnglishHtml(file);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      await writeFile(file, html.replace(/<html\b([^>]*?)\blang="zh-CN"/, '<html$1lang="en"'));
    }
  }
}
await markEnglishHtml(join(output, 'en'));
await writeFile(join(output, 'en.html'), (await readFile(join(output, 'en.html'), 'utf8')).replace(/<html\b([^>]*?)\blang="zh-CN"/, '<html$1lang="en"'));

await prepareSearch(output);

for (const entry of searchEntries.filter((entry) => ['hub', 'knowledge', 'relationship'].includes(entry.kind))) {
  for (const prefix of ['', '/en']) {
    const route = `${prefix}${entry.path}`.slice(1);
    await mkdir(join(output, route), { recursive: true });
    await cp(join(output, `${route}.html`), join(output, route, 'index.html'));
  }
}

for (const route of ['quiz', 'prototype', 'prototype/illustrations', 'privacy', 'openness', 'about', 'theater', 'en', 'en/quiz', 'en/prototype', 'en/prototype/illustrations', 'en/privacy', 'en/openness', 'en/about', 'en/theater']) {
  await mkdir(join(output, route), { recursive: true });
  await cp(join(output, `${route}.html`), join(output, route, 'index.html'));
}

const characterDirectories = ['result', 'prototype/types', 'en/result', 'en/prototype/types'];
for (const entry of await readdir(join(output, 'prototype/combinations'), { withFileTypes: true })) {
  if (entry.isDirectory() && /^[ie][ns][tf][jp]$/.test(entry.name))
    characterDirectories.push(`prototype/combinations/${entry.name}`, `en/prototype/combinations/${entry.name}`);
}
for (const route of characterDirectories) {
  const resultDirectory = join(output, route);
  const files = await readdir(resultDirectory);

  for (const file of files) {
    if (!/^t\d{2}\.html$/.test(file)) continue;
    const slug = file.slice(0, -5);
    const directory = join(resultDirectory, slug);
    await mkdir(directory, { recursive: true });
    await cp(join(resultDirectory, file), join(directory, 'index.html'));
  }
}

// Only immutable build output is compressed; account API responses are separate.
let compressedCount = 0;
async function compressDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  // Remove representations from any previous preparation before deciding which
  // current files benefit from compression, including deleted/tiny originals.
  for (const entry of entries) {
    if (
      entry.isFile() &&
      /\.(?:html|js|css|svg|json)\.(?:br|gz)$/.test(entry.name)
    )
      await rm(join(directory, entry.name));
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await compressDirectory(file);
    else if (
      ['.html', '.js', '.css', '.svg', '.json'].includes(extname(file))
    ) {
      const source = await readFile(file);
      if (source.length < 1024) continue;
      const br = brotliCompressSync(source, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 9 },
      });
      const gz = gzipSync(source, { level: 9 });
      for (const [extension, buffer] of [
        ['br', br],
        ['gz', gz],
      ]) {
        if (buffer.length < source.length * 0.95) {
          await writeFile(`${file}.${extension}`, buffer);
          compressedCount++;
        }
      }
    }
  }
}
await compressDirectory(output);
console.log(`Prepared ${compressedCount} compressed static representations.`);

// A package must describe the build that was actually reviewed. This file is
// internal: the HTTP server rejects dot-file requests.
await writeFile(
  join(output, '.shadow16-build.json'),
  JSON.stringify(
    {
      ...release,
      builtAt: new Date().toISOString(),
      sourceFingerprint: fingerprint,
    },
    null,
    2,
  ) + '\n',
);
