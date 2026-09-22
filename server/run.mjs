import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { accountRuntime } from './local.mjs';
import { contentEncodings } from './encoding.mjs';
import { createContentHandler } from './content.mjs';

process.umask(0o077);
// Local acceptance can use the actual exported build and the same HTTP server.
// Production startup remains the default used by shadow16.service.
const preview = process.argv.includes('--preview');
const { db, api } = accountRuntime({ development: preview });
const root = resolve(process.env.SHADOW16_STATIC ?? 'dist/client');
const contentHandler = createContentHandler({ root: process.env.SHADOW16_CONTENT_ROOT ?? 'var/content', staticRoot: root });
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
};
const server = createServer((req, res) => {
  if (contentHandler(req, res)) return;
  if (req.url?.startsWith('/api/')) {
    void api(req, res);
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://internal').pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (path === '/') {
    res.writeHead(302, { Location: '/prototype', 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  // Existing openness URLs now lead directly to the section on the About page.
  if (/^\/(?:en\/)?openness(?:\/index\.html|\.html|\/)?$/.test(path)) {
    res.writeHead(308, {
      Location: `${path.startsWith('/en/') ? '/en' : ''}/about#openness`,
      'Cache-Control': 'no-cache',
    });
    res.end();
    return;
  }
  let file = resolve(root, `.${path}`);
  if (
    !file.startsWith(root + sep) ||
    path.split('/').some((part) => part.startsWith('.'))
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    let stat;
    try {
      stat = statSync(file);
    } catch {
      file += '.html';
      stat = statSync(file);
    }
    if (stat.isDirectory()) {
      file = resolve(file, 'index.html');
      stat = statSync(file);
    }
    if (!stat.isFile()) throw new Error('not a file');
    const extension = extname(file);
    if (extension === '.html' && [...new URL(req.url, 'http://internal').searchParams.keys()].some((key) => ['view', 'type', 'pair', 'mbti', 'lang'].includes(key)))
      res.setHeader('X-Robots-Tag', 'noindex, follow');
    let servedFile = file;
    if (['.html', '.js', '.css', '.svg', '.json'].includes(extension)) {
      res.setHeader('Vary', 'Accept-Encoding');
      let found = false;
      for (const encoding of contentEncodings(req.headers['accept-encoding'])) {
        if (encoding === 'identity') {
          found = true;
          break;
        }
        const candidate = `${file}.${encoding === 'gzip' ? 'gz' : 'br'}`;
        try {
          const compressed = statSync(candidate);
          if (!compressed.isFile()) continue;
          servedFile = candidate;
          stat = compressed;
          res.setHeader('Content-Encoding', encoding);
          found = true;
          break;
        } catch {
          /* A build without precompression still serves the original. */
        }
      }
      if (!found) {
        res.writeHead(406);
        res.end();
        return;
      }
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Type',
      mime[extension] ?? 'application/octet-stream',
    );
    res.setHeader(
      'Cache-Control',
      extension === '.html'
        ? 'no-cache'
        : /[-.][a-zA-Z0-9_-]{8,}\.(js|css)$/.test(file)
          ? 'public,max-age=31536000,immutable'
          : 'public,max-age=3600',
    );
    res.setHeader('Content-Length', stat.size);
    if (req.method === 'HEAD') res.end();
    else createReadStream(servedFile).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : /^\/en(?:\/|$)/.test(path) ? 'Page not found' : '页面暂未找到');
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.maxHeadersCount = 40;
server.listen(
  Number(process.env.PORT ?? (preview ? 3106 : 3107)),
  '127.0.0.1',
  () =>
    console.log(
      preview
        ? '16暗影构建验收预览：http://localhost:3106/prototype（开发账号库）'
        : '16暗影账号与网站服务已在本机回环地址就绪。',
    ),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
