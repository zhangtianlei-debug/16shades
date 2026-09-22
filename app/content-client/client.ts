import type {
  ContentIndex,
  SearchIndex,
  TheaterStory,
  WikiArticle,
} from './types';

const key = (url: string) => `shadow16-content-cache:${url}`;
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const localized = (value: unknown): value is { zh: string; en: string } =>
  record(value) && typeof value.zh === 'string' && typeof value.en === 'string';
const list = (value: unknown): value is unknown[] => Array.isArray(value);
const stringList = (value: unknown): value is string[] => list(value) && value.every((item) => typeof item === 'string');
const releasedUrl = (url: string, revision: string, collection: 'wiki' | 'theater') => new RegExp(`^/content/v1/releases/${revision.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${collection}/[^/?#]+\\.json$`).test(url);
const searchUrl = (url: string, revision: string, locale: 'zh' | 'en') => new RegExp(`^/content/v1/releases/${revision.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/search/${locale}\\.json$`).test(url);
const isSource = (source: unknown) => record(source) && typeof source.id === 'string' && typeof source.authors === 'string' && typeof source.year === 'number' && localized(source.title) && typeof source.url === 'string' && (source.open_access_url === undefined || source.open_access_url === null || typeof source.open_access_url === 'string') && localized(source.kind) && record(source.findings) && stringList(source.findings.zh) && stringList(source.findings.en) && record(source.limits) && stringList(source.limits.zh) && stringList(source.limits.en);
const isIndex = (v: unknown): v is ContentIndex =>
  record(v) &&
  v.schemaVersion === 1 &&
  typeof v.revision === 'string' &&
  typeof v.generatedAt === 'string' &&
  record(v.wiki) &&
  record(v.theater) &&
  list(v.wiki.articles) &&
  v.wiki.articles.every(
    (a) =>
      record(a) &&
      typeof a.slug === 'string' &&
      typeof a.category === 'string' &&
      localized(a.title) &&
      localized(a.summary) &&
      localized(a.kind) &&
      list(a.related) &&
      typeof a.updatedAt === 'string' &&
      typeof a.url === 'string' && releasedUrl(a.url, v.revision as string, 'wiki'),
  ) &&
  list(v.wiki.categories) &&
  v.wiki.categories.every(
    (c) =>
      record(c) &&
      typeof c.id === 'string' &&
      localized(c.label) &&
      typeof c.order === 'number',
  ) &&
  list(v.wiki.featured) &&
  list(v.wiki.directory) &&
  record(v.wiki.search) &&
  typeof v.wiki.search.zh === 'string' &&
  typeof v.wiki.search.en === 'string' &&
  list(v.theater.episodes) &&
  v.theater.episodes.every(
    (e) =>
      record(e) &&
      typeof e.id === 'string' &&
      typeof e.number === 'number' &&
      localized(e.title) &&
      localized(e.summary) &&
      list(e.cast) &&
      localized(e.cover) &&
      typeof e.pageCount === 'number' &&
      typeof e.updatedAt === 'string' &&
      typeof e.url === 'string' && releasedUrl(e.url, v.revision as string, 'theater'),
  );
const isWiki = (v: unknown): v is WikiArticle =>
  record(v) &&
  v.schemaVersion === 1 &&
  typeof v.slug === 'string' &&
  typeof v.category === 'string' &&
  localized(v.title) &&
  localized(v.summary) &&
  localized(v.kind) &&
  localized(v.body) &&
  list(v.related) &&
  typeof v.updatedAt === 'string' &&
  (v.sources === undefined || (list(v.sources) && v.sources.every(isSource)));
const isStory = (v: unknown): v is TheaterStory =>
  record(v) &&
  v.schemaVersion === 1 &&
  typeof v.id === 'string' &&
  typeof v.number === 'number' &&
  localized(v.title) &&
  localized(v.summary) &&
  list(v.cast) &&
  list(v.panels) &&
  v.panels.every(
    (p) =>
      record(p) &&
      typeof p.id === 'string' &&
      localized(p.title) &&
      localized(p.alt) &&
      localized(p.src) &&
      typeof p.width === 'number' &&
      typeof p.height === 'number' &&
      record(p.lines) &&
      list(p.lines.zh) &&
      list(p.lines.en),
  );
const isSearch = (v: unknown): v is SearchIndex =>
  record(v) &&
  v.schemaVersion === 1 &&
  typeof v.revision === 'string' &&
  (v.locale === 'zh' || v.locale === 'en') &&
  list(v.entries) &&
  v.entries.every(
    (x) =>
      record(x) && typeof x.slug === 'string' && typeof x.text === 'string',
  );

export class ContentError extends Error {
  constructor(
    message: string,
    public readonly cached = false,
  ) {
    super(message);
  }
}
function cached<T>(
  url: string,
  validate: (value: unknown) => value is T,
): T | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(url)) ?? 'null');
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
async function load<T>(
  url: string,
  validate: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<{ value: T; cached: boolean }> {
  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value: unknown = await response.json();
    if (!validate(value)) throw new Error('schema invalid');
    try {
      localStorage.setItem(key(url), JSON.stringify(value));
    } catch {
      /* Reading remains available without storage. */
    }
    return { value, cached: false };
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    const fallback = cached(url, validate);
    if (fallback) return { value: fallback, cached: true };
    throw new ContentError(
      '内容暂时无法加载，请重试。 Content could not be loaded. Please retry.',
    );
  }
}
export const contentApi = {
  index: (signal?: AbortSignal) =>
    load('/content/v1/index.json', isIndex, signal),
  wiki: (url: string, revision: string, signal?: AbortSignal) => {
    if (!releasedUrl(url, revision, 'wiki')) return Promise.reject(new ContentError('Invalid article address.'));
    const slug = url.slice(url.lastIndexOf('/') + 1, -'.json'.length);
    return load(url, (value): value is WikiArticle => isWiki(value) && value.slug === slug, signal);
  },
  theater: (url: string, revision: string, signal?: AbortSignal) => {
    if (!releasedUrl(url, revision, 'theater')) return Promise.reject(new ContentError('Invalid episode address.'));
    const id = url.slice(url.lastIndexOf('/') + 1, -'.json'.length);
    return load(url, (value): value is TheaterStory => isStory(value) && value.id === id, signal);
  },
  search: (url: string, revision: string, locale: 'zh' | 'en', signal?: AbortSignal) => searchUrl(url, revision, locale) ? load(url, (value): value is SearchIndex => isSearch(value) && value.revision === revision && value.locale === locale, signal) : Promise.reject(new ContentError('Invalid search address.')),
};
