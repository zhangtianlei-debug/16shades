import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { entries, candidates, articles, articleBody, pairs, roles, text, entryCopy } from '../app/search/catalog.mjs';
import { absoluteUrl, localizedPath, languageAlternates, config, validateSearchConfig, sitemapXml, robotsText } from '../app/search/policy.mjs';
import { sourceFingerprint } from './release-files.mjs';
import { siteContact } from '../app/site-contact.ts';

const root = 'dist/client';
const decode = (value) => value.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, dec) => String.fromCodePoint(parseInt(hex ?? dec, hex ? 16 : 10))).replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const plain = (html) => decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1].toLowerCase(), decode(m[2])]));
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map((m) => attrs(m[0]));
const out = (path) => join(root, path.replace(/^\//, '') + '.html');

const build = JSON.parse(readFileSync(join(root, '.shadow16-build.json'), 'utf8'));
assert.equal(build.sourceFingerprint, sourceFingerprint(), 'Rebuild changed sources before search acceptance.');
assert.equal(new Set(entries.map((entry) => entry.path)).size, entries.length);
assert.equal(new Set(config.knowledgeCandidates).size, config.knowledgeCandidates.length);
assert.equal(new Set(config.relationshipCandidates).size, config.relationshipCandidates.length);
assert.doesNotThrow(() => validateSearchConfig(config, ''));
assert.throws(() => validateSearchConfig({ ...config, indexingEnabled: true }, ''));
assert.throws(() => validateSearchConfig({ ...config, indexingEnabled: true, canonicalOrigin: 'http://example.invalid' }, 'http://example.invalid'));
assert.doesNotThrow(() => validateSearchConfig({ ...config, indexingEnabled: true, canonicalOrigin: 'https://example.invalid' }, 'https://example.invalid'));
assert.equal((sitemapXml(candidates).match(/<loc>/g) ?? []).length, candidates.length * 2);
assert.ok(!robotsText(true).includes('Disallow: /\n'));
assert.ok(robotsText(true).includes(`Sitemap: ${absoluteUrl('/sitemap.xml')}`));
assert.ok(!robotsText(false).includes('Sitemap:'));

let pages = 0, localLinks = 0, sourceLinks = 0;
for (const locale of ['zh', 'en']) {
  const seenTitles = new Set();
  for (const entry of entries) {
    const path = localizedPath(entry.path, locale);
    const html = readFileSync(out(path), 'utf8');
    assert.equal(html, readFileSync(join(root, path.slice(1), 'index.html'), 'utf8'), `Directory alias: ${path}`);
    const head = html.split('</head>')[0], body = html.slice(html.indexOf('<body'));
    const copy = entryCopy(entry, locale);
    const title = plain(head.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    assert.equal(title, copy.title, `Title: ${path}`);
    assert.ok(!seenTitles.has(title), `Duplicate title: ${path}`); seenTitles.add(title);
    const meta = tags(head, 'meta');
    if (entry.kind === 'home') for (const [name, value] of Object.entries(config.siteVerification ?? {}))
      assert.deepEqual(meta.filter((tag) => tag.name === name).map((tag) => tag.content), [value], `Site verification: ${path} ${name}`);
    const descriptions = meta.filter((tag) => tag.name === 'description');
    assert.deepEqual(descriptions.map((tag) => tag.content), [copy.description], `Description: ${path}`);
    const robots = meta.filter((tag) => tag.name === 'robots');
    assert.deepEqual(robots.map((tag) => tag.content), [config.indexingEnabled && entry.candidate ? 'index, follow' : 'noindex, follow'], `Index gate: ${path}`);
    const links = tags(head, 'link');
    assert.deepEqual(links.filter((tag) => tag.rel === 'canonical').map((tag) => tag.href), [absoluteUrl(path)], `Canonical: ${path}`);
    const alternates = links.filter((tag) => tag.rel === 'alternate' && tag.hreflang);
    assert.equal(alternates.length, 3, `hreflang count: ${path}`);
    assert.deepEqual(Object.fromEntries(alternates.map((tag) => [tag.hreflang, tag.href])), languageAlternates(entry.path), `hreflang: ${path}`);
    assert.equal(tags(html, 'html')[0].lang, locale === 'en' ? 'en' : 'zh-CN', `HTML language: ${path}`);
    const h1 = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => plain(m[1]));
    assert.equal(h1.length, 1, `One visible H1: ${path}`);
    const readable = plain(body);
    assert.ok(readable.length > 250, `SSR body: ${path}`);
    assert.ok(!readable.includes('This text could not be loaded'), `No translation fallback: ${path}`);
    // Registered entity name and ICP identifier stay exact in both languages.
    if (locale === 'en') assert.ok(!/\p{Script=Han}/u.test(readable.replaceAll('中文', '').replaceAll(siteContact.icp.label, '').replaceAll(siteContact.operator, '')), `English body: ${path}`);
    if (entry.kind === 'character') {
      // Role introductions may insert the localized expand/collapse control between
      // sentences; verify the same reader-facing copy without assuming one DOM text run.
      const explanation = text(roles.find((role) => role.id === entry.id).explanation, locale);
      const searchable = readable.replaceAll(locale === 'en' ? 'Expand' : '展开', '').replaceAll(locale === 'en' ? 'Collapse' : '收起', '');
      for (const sentence of explanation.split(/(?<=[。.!?])/).map((value) => value.trim()).filter(Boolean))
        assert.ok(searchable.includes(sentence), `Character body: ${path}`);
    }
    if (entry.kind === 'relationship') {
      const pair = pairs.find((pair) => pair.id === entry.id);
      assert.ok(readable.includes(text(pair.hook, locale)), `Relationship summary: ${path}`);
      assert.ok(tags(body, 'a').some((a) => a.href === localizedPath('/knowledge/relationships-method', locale)));
    }
    if (entry.kind === 'knowledge') {
      const article = articles.find((article) => article.slug === entry.id);
      for (const source of articleBody(article, locale).matchAll(/\]\((https?:\/\/(?:[^()]|\([^()]*\))*)\)/g)) {
        assert.ok(tags(body, 'a').some((link) => link.href === source[1]), `Research source link: ${path} ${source[1]}`); sourceLinks++;
      }
    }
    if (['hub', 'knowledge', 'relationship'].includes(entry.kind)) {
      const ids = new Set(tags(body, '[a-z][a-z0-9]*').map((tag) => tag.id).filter(Boolean));
      for (const link of tags(body, 'a')) {
        if (!link.href?.startsWith('/') && !link.href?.startsWith('#')) continue;
        const target = new URL(link.href, `http://local${path}`);
        assert.ok(existsSync(out(target.pathname)) || existsSync(join(root, target.pathname.slice(1))), `Internal link: ${path} -> ${link.href}`);
        if (target.pathname === path && target.hash) assert.ok(ids.has(decodeURIComponent(target.hash.slice(1))), `Anchor: ${path} -> ${target.hash}`);
        localLinks++;
      }
    }
    pages++;
  }
}
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
assert.equal(sitemap, sitemapXml(config.indexingEnabled ? candidates : []));
assert.equal(readFileSync(join(root, '.shadow16-search-candidate.xml'), 'utf8'), sitemapXml(candidates));
assert.equal(readFileSync(join(root, 'robots.txt'), 'utf8'), robotsText());
let excludedHtml = 0;
const candidatePaths = new Set(candidates.flatMap((entry) => ['zh', 'en'].map((locale) => localizedPath(entry.path, locale))));
function checkExport(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) checkExport(file);
    else if (entry.name.endsWith('.html')) {
      const route = '/' + relative(root, file).replace(/(?:\/index)?\.html$/, '').replace(/^index$/, '');
      const expected = config.indexingEnabled && candidatePaths.has(route) ? 'index, follow' : 'noindex, follow';
      assert.deepEqual(tags(readFileSync(file, 'utf8').split('</head>')[0], 'meta').filter((tag) => tag.name === 'robots').map((tag) => tag.content), [expected], `Export index boundary: ${file}`);
      if (expected.startsWith('noindex')) excludedHtml++;
    }
  }
}
checkExport(root);
console.log(JSON.stringify({ result: 'passed', pages, candidateUrls: candidates.length * 2, localLinks, sourceLinks, excludedHtmlChecked: excludedHtml, indexingEnabled: config.indexingEnabled, sourceFingerprint: build.sourceFingerprint }, null, 2));
