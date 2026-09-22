import english from './en.json';
import { currentLocale } from './routing.mjs';
export { currentLocale, localizedHref } from './routing.mjs';

export type Locale = 'zh' | 'en';
export const localeStorageKey = 'shadow16-language';
export const supportedLocales = ['zh', 'en'] as const;
const catalog: Record<string, string> = english;
const han = /\p{Script=Han}/u;
export const missingTranslations = new Set<string>();
const punctuation: Record<string,string> = { '，': ', ', '。': '. ', '；': '; ', '：': ': ', '！': '!', '？': '?', '（': '(', '）': ')', '「': '“', '」': '”', '『': '“', '』': '”', '【': '[', '】': ']', '《': '“', '》': '”', '／': '/', '｜': ' | ', '、': ', ' };
const englishPunctuation = (text: string) => text.replace(/[，。；：！？（）「」『』【】《》／｜、]/g, (character) => punctuation[character]);
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizedCatalog = new Map(Object.entries(catalog).map(([key, value]) => [normalize(key), value]));
const patterns = Object.entries(catalog).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => ({
  expression: new RegExp('^' + key.split(/\{\d+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*?)') + '$', 's'), value, specificity: key.replace(/\{\d+\}/g, '').length,
})).sort((a, b) => b.specificity - a.specificity);
// Compound display strings may concatenate a name, punctuation and a label.
// Translate complete catalog phrases first; never change stored model keys.
const phrases = Object.keys(catalog).filter((key) => !/\{\d+\}/.test(key) && han.test(key)).sort((a, b) => b.length - a.length);

export function translateText(value: string, locale: Locale = currentLocale()): string {
  if (locale === 'zh') return value;
  if (!han.test(value)) return englishPunctuation(value);
  const exact = catalog[value];
  if (exact !== undefined) return englishPunctuation(exact);
  const folded = normalizedCatalog.get(normalize(value));
  if (folded !== undefined) return (value.startsWith(' ') ? ' ' : '') + englishPunctuation(folded) + (value.endsWith(' ') ? ' ' : '');
  for (const { expression, value: replacement } of patterns) {
    const match = value.match(expression);
    if (match) return englishPunctuation(replacement).replace(/\{(\d+)\}/g, (_, index) => translateText(match[Number(index) + 1] ?? '', locale));
  }
  let result = value;
  for (const phrase of phrases) {
    if (result.includes(phrase)) result = result.split(phrase).join(catalog[phrase]);
    if (!han.test(result)) return englishPunctuation(result);
  }
  missingTranslations.add(value);
  if (typeof window !== 'undefined') {
    const target = window as Window & { __shadow16MissingTranslations?: string[] };
    target.__shadow16MissingTranslations = [...missingTranslations];
  }
  console.error('[i18n] Missing English translation:', value);
  // A last-resort English error is observable by QA, never a Chinese fallback.
  return 'This text could not be loaded. Please try again.';
}

export function resolveLocale(explicit: string | null, saved: string | null, languages: readonly string[]): Locale {
  if (explicit === 'en' || explicit === 'zh') return explicit;
  if (saved === 'en' || saved === 'zh') return saved;
  // First supported preference wins; unsupported languages fall back to English.
  for (const language of languages) {
    if (/^zh(?:-|$)/i.test(language)) return 'zh';
    if (/^en(?:-|$)/i.test(language)) return 'en';
  }
  return 'en';
}

export function localizedAsset(value: string, locale: Locale = currentLocale()): string {
  if (locale !== 'en') return value.replace(/^\/en-assets\//, '/');
  if (/^\/downloads\/(?:cards\/|portraits\/|shadow16-all-characters\.zip|使用说明\.md|manifest\.json)/.test(value)) return '/en-assets' + value.replace('使用说明.md', 'README.md');
  if (value.startsWith('/characters-transparent/')) return '/en-assets' + value;
  if (value.startsWith('/brand/') || value === '/question-illustrations/brand-frosted-v1.webp') return '/en-assets' + value.replace(/\.(?:webp|png)$/, '.svg');
  return value;
}

export function translateRecord<T>(value: T, locale: Locale): T {
  if (typeof value === 'string') return translateText(value, locale) as T;
  if (Array.isArray(value)) return value.map((item) => translateRecord(item, locale)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateRecord(item, locale)])) as T;
  return value;
}
