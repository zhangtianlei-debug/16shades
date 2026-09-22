import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { candidates, entries, entryCopy } from '../app/search/catalog.mjs';
import { config, robotsText, sitemapXml, localizedPath, languageAlternates, absoluteUrl } from '../app/search/policy.mjs';

export async function prepareSearch(output) {
  const paths = new Set(candidates.flatMap((entry) => ['zh', 'en'].map((locale) => localizedPath(entry.path, locale))));
  // Restrict the whole export, including legacy pages and local-only examples.
  // robots.txt must not hide these HTML rules from search crawlers.
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.name.endsWith('.html')) {
        const route = '/' + relative(output, file).replace(/(?:\/index)?\.html$/, '').replace(/^index$/, '');
        let html = await readFile(file, 'utf8');
        html = html.replace(/<meta\s+[^>]*name=["']robots["'][^>]*>/gi, '');
        const directive = config.indexingEnabled && paths.has(route) ? 'index, follow' : 'noindex, follow';
        await writeFile(file, html.replace('</head>', `<meta name="robots" content="${directive}"/></head>`));
      }
    }
  }
  await visit(output);
  await writeFile(join(output, 'robots.txt'), robotsText());
  await writeFile(join(output, 'sitemap.xml'), sitemapXml(config.indexingEnabled ? candidates : []));
  // Dot-files are rejected by the production HTTP server. These are review
  // artifacts, never another publicly advertised staging sitemap.
  await writeFile(join(output, '.shadow16-search-candidate.xml'), sitemapXml(candidates));
  await writeFile(join(output, '.shadow16-search.json'), JSON.stringify({
    indexingEnabled: config.indexingEnabled, canonicalOrigin: config.canonicalOrigin,
    entries: entries.flatMap((entry) => ['zh', 'en'].map((locale) => ({
      ...entry, locale, ...entryCopy(entry, locale),
      path: localizedPath(entry.path, locale), canonical: absoluteUrl(localizedPath(entry.path, locale)),
      alternates: languageAlternates(entry.path),
    }))),
  }, null, 2) + '\n');
}
