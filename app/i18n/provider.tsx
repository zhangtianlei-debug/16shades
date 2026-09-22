'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { currentLocale, localizedAsset, localizedHref, localeStorageKey, resolveLocale, translateText, type Locale } from './core';

const LanguageContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({ locale: 'zh', setLocale: () => {} });

export function normalizeLanguagePath(locale: Locale = currentLocale()) {
  const url = new URL(window.location.href);
  url.pathname = localizedHref(url.pathname, locale);
  const explicit = url.searchParams.get('lang');
  if ((explicit === 'en' || explicit === 'zh') && explicit !== locale) url.searchParams.delete('lang');
  const path = url.pathname + url.search + url.hash;
  if (path !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', path);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const routeLocale: Locale = /^\/en(?:\/|$)/.test(pathname ?? '') ? 'en' : 'zh';
  const [locale, updateLocale] = useState<Locale>(routeLocale);
  const setLocale = useCallback((next: Locale) => {
    document.documentElement.dataset.locale = next;
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
    try { localStorage.setItem(localeStorageKey, next); } catch { /* This tab can still switch without storage. */ }
    const url = new URL(window.location.href);
    url.pathname = localizedHref(url.pathname, next);
    url.searchParams.delete('lang');
    if (/^\/(?:en\/)?(?:explore|knowledge|relationships)(?:\/|$)/.test(url.pathname)) {
      window.location.assign(url.pathname + url.search + url.hash);
      return;
    }
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    updateLocale(next);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    let saved: string | null = null;
    try { saved = localStorage.getItem(localeStorageKey); } catch { /* Use browser preference. */ }
    const explicit = url.searchParams.get('lang') ?? (/^\/en(?:\/|$)/.test(url.pathname) ? 'en' : null);
    const next = /^\/(?:en\/)?(?:explore|knowledge|relationships)(?:\/|$)/.test(url.pathname)
      ? (/^\/en(?:\/|$)/.test(url.pathname) ? 'en' : 'zh')
      : resolveLocale(explicit, saved, navigator.languages?.length ? navigator.languages : [navigator.language]);
    document.documentElement.dataset.locale = next;
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
    // oxlint-disable-next-line react/react-compiler -- Browser preference becomes available after server hydration.
    updateLocale(next);
    normalizeLanguagePath(next);

    const sync = (event: StorageEvent) => {
      if (event.key === localeStorageKey && (event.newValue === 'en' || event.newValue === 'zh')) setLocale(event.newValue);
    };
    window.addEventListener('storage', sync);
    // Older history entries may have been created before a manual switch.
    // Keep their destination and state while using the current language URL.
    const syncHistoryLanguage = () => normalizeLanguagePath(currentLocale());
    window.addEventListener('popstate', syncHistoryLanguage);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('popstate', syncHistoryLanguage);
    };
  }, [setLocale]);
  useEffect(() => {
    if (locale === currentLocale()) document.documentElement.removeAttribute('data-language-pending');
  }, [locale]);
  const context = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LanguageContext.Provider value={context}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const { locale, setLocale } = useContext(LanguageContext);
  const t = useCallback((text: string) => translateText(text, locale), [locale]);
  const tn = useCallback((node: ReactNode): ReactNode => {
    if (typeof node === 'string') return translateText(node, locale);
    if (Array.isArray(node)) return node.map((part) => typeof part === 'string' ? translateText(part, locale) : part);
    return node;
  }, [locale]);
  const asset = useCallback((src: string) => localizedAsset(src, locale), [locale]);
  const href = useCallback((url: string) => localizedHref(localizedAsset(url, locale), locale), [locale]);
  return { locale, setLocale, t, tn, asset, href };
}

// Helpers used by render callbacks outside a component. Component-owned text
// uses the context-bound functions above so switching does not reset state.
export const t = translateText;
export function tn(node: ReactNode): ReactNode {
  if (typeof node === 'string') return translateText(node, currentLocale());
  if (Array.isArray(node)) return node.map(tn);
  return node;
}
export const asset = localizedAsset;
export const href = localizedHref;

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return <div className="language-switcher" role="group" aria-label={locale === 'en' ? 'Language' : '语言'}>
    <button className="language-trigger" type="button" onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')} aria-label={locale === 'en' ? '切换为中文' : 'Switch to English'}>
      <span className="language-code" aria-current={locale === 'zh' ? 'true' : undefined}>CH</span><span className="language-divider" aria-hidden="true">/</span><span className="language-code" aria-current={locale === 'en' ? 'true' : undefined}>EN</span>
    </button>
  </div>;
}
