import type { Metadata } from 'next';
import { entries, entryCopy } from './catalog.mjs';
import { absoluteUrl, languageAlternates, localizedPath, searchRobots, config } from './policy.mjs';

export function entryMetadata(kind: string, id: string, locale: 'zh' | 'en' = 'zh'): Metadata {
  const entry = entries.find((entry) => entry.kind === kind && entry.id === id);
  if (!entry) return { robots: { index: false, follow: false } };
  return {
    ...entryCopy(entry, locale),
    alternates: { canonical: absoluteUrl(localizedPath(entry.path, locale)), languages: languageAlternates(entry.path) },
    robots: searchRobots(entry.candidate),
    ...(kind === 'home' ? { other: config.siteVerification } : {}),
  };
}
