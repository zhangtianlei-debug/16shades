import config from './config.json' with { type: 'json' };
import release from '../../release.json' with { type: 'json' };

export { config };
// A clone is non-indexable until its maintainer supplies one HTTPS origin in
// both configuration files. The local fallback only keeps static builds valid.
export const searchOrigin = config.canonicalOrigin || release.publicOrigin || 'http://localhost:3106';
export function validateSearchConfig(value = config, publicOrigin = release.publicOrigin) {
  if (typeof value.indexingEnabled !== 'boolean') throw new Error('Search indexing requires an explicit boolean.');
  if (!value.indexingEnabled) return;
  const origin = new URL(value.canonicalOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== value.canonicalOrigin)
    throw new Error('Search indexing requires one exact HTTPS canonical origin.');
  if (publicOrigin !== value.canonicalOrigin)
    throw new Error('Search indexing requires release.publicOrigin to match the canonical origin.');
}
validateSearchConfig();
export const localizedPath = (path, locale) => locale === 'en' ? `/en${path}` : path;
export const absoluteUrl = (path) => new URL(path, searchOrigin).href;
export function languageAlternates(path) {
  return { 'zh-CN': absoluteUrl(path), en: absoluteUrl(localizedPath(path, 'en')), 'x-default': absoluteUrl(path) };
}
export function searchRobots(candidate = true) {
  return { index: config.indexingEnabled && candidate, follow: true };
}
export function robotsText(enabled = config.indexingEnabled) {
  // Google must be able to crawl staging HTML to see noindex. AI search bots
  // have a separate crawl gate; this does not change model-training preferences.
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\n${enabled ? 'Allow: /\nDisallow: /api/' : 'Disallow: /'}\n${enabled ? `\nSitemap: ${absoluteUrl('/sitemap.xml')}\n` : ''}`;
}
const xml = (value) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export function sitemapXml(entries) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.flatMap((entry) => ['zh', 'en'].map((locale) => `  <url><loc>${xml(absoluteUrl(localizedPath(entry.path, locale)))}</loc></url>`)).join('\n') + '\n</urlset>\n';
}
