export type Locale = 'zh' | 'en';
export type Localized = Record<Locale, string>;
export type WikiSummary = {
  slug: string;
  category: string;
  title: Localized;
  summary: Localized;
  kind: Localized;
  related: string[];
  updatedAt: string;
  url: string;
};
export type WikiArticle = WikiSummary & {
  schemaVersion: 1;
  body: Localized;
  sources?: TheorySource[];
};
export type TheorySource = {
  id: string;
  authors: string;
  year: number;
  title: Localized;
  url: string;
  open_access_url?: string | null;
  kind: Localized;
  findings: Record<Locale, string[]>;
  limits: Record<Locale, string[]>;
};
export type TheaterEpisode = {
  id: string;
  number: number;
  title: Localized;
  summary: Localized;
  cast: string[];
  cover: Localized;
  pageCount: number;
  updatedAt: string;
  url: string;
};
export type TheaterPanel = {
  id: string;
  title: Localized;
  alt: Localized;
  src: Localized;
  width: number;
  height: number;
  lines: Record<Locale, string[]>;
};
export type TheaterStory = TheaterEpisode & {
  schemaVersion: 1;
  panels: TheaterPanel[];
};
export type ContentIndex = {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  wiki: {
    categories: { id: string; label: Localized; order: number }[];
    featured: string[];
    directory: string[];
    articles: WikiSummary[];
    search: Record<Locale, string>;
  };
  theater: { episodes: TheaterEpisode[] };
};
export type SearchIndex = {
  schemaVersion: 1;
  revision: string;
  locale: Locale;
  entries: { slug: string; text: string }[];
};
