import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Only project inputs; never include the local database, secrets or tool state.
export function sourceFingerprint(root = process.cwd()) {
  const inputs = [
    'app',
    'components',
    'lib',
    'public',
    'server',
    'release.json',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'vite.config.ts',
    'next.config.ts',
    'tsconfig.json',
    'scripts/build-site.mjs',
    'scripts/prepare-static.mjs',
    'scripts/prepare-search.mjs',
    'scripts/release-files.mjs',
  ];
  const files = [];
  function collect(path) {
    for (const entry of readdirSync(join(root, path), {
      withFileTypes: true,
    })) {
      if (
        entry.name.startsWith('.') ||
        /\.test\.[cm]?[jt]sx?$/.test(entry.name)
      )
        continue;
      const file = join(path, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  for (const input of inputs) {
    if (!existsSync(join(root, input))) continue;
    if (['app', 'components', 'lib', 'public', 'server'].includes(input))
      collect(input);
    else files.push(input);
  }
  const hash = createHash('sha256');
  for (const file of files.sort())
    hash
      .update(file)
      .update('\0')
      .update(readFileSync(join(root, file)))
      .update('\0');
  return hash.digest('hex');
}
