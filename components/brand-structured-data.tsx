'use client';

import { useEffect } from 'react';
import { siteContact } from '@/app/site-contact';
import { siteOrigin } from '@/app/site-origin';
import { useI18n } from '@/app/i18n/provider';
import { brandPageDescription } from '@/app/search/brand-copy.mjs';

type Locale = 'zh' | 'en';
type Page = 'home' | 'about';

const copy = {
  zh: {
    brand: '16暗影',
    homeName: '16暗影｜16种策略画像',
    aboutName: '关于16暗影',
  },
  en: {
    brand: '16 Shades',
    homeName: '16 Shades | 16 character perspectives',
    aboutName: 'About 16 Shades',
  },
} as const;

export function BrandStructuredData({ locale: initialLocale, page }: { locale: Locale; page: Page }) {
  const { locale: currentLocale } = useI18n();
  // LanguageProvider starts from the route locale, so this preserves the server
  // page's schema through hydration and follows later in-place language switches.
  const locale = typeof window === 'undefined' ? initialLocale : currentLocale;
  const text = copy[locale];
  const pagePath = page === 'home' ? '/prototype' : '/about';
  const localizedPath = locale === 'en' ? `/en${pagePath}` : pagePath;
  const pageName = page === 'home' ? text.homeName : text.aboutName;
  const pageDescription = brandPageDescription(page, locale);
  const origin = siteOrigin;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: `${origin}/`,
        name: text.brand,
        alternateName: locale === 'zh' ? '16 Shades' : '16暗影',
        description: brandPageDescription('home', locale),
        inLanguage: ['zh-CN', 'en'],
        publisher: { '@id': `${origin}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: siteContact.operator,
        url: `${origin}/`,
        email: siteContact.email,
        brand: {
          '@type': 'Brand',
          name: '16暗影',
          alternateName: '16 Shades',
        },
      },
      {
        '@type': page === 'about' ? 'AboutPage' : 'WebPage',
        '@id': `${origin}${localizedPath}#webpage`,
        url: `${origin}${localizedPath}`,
        name: pageName,
        description: pageDescription,
        inLanguage: locale === 'zh' ? 'zh-CN' : 'en',
        isPartOf: { '@id': `${origin}/#website` },
        about: { '@id': `${origin}/#organization` },
      },
    ],
  };
  const schema = JSON.stringify(data).replace(/</g, '\\u003c');
  const scriptId = `shadow16-brand-schema-${page}`;

  useEffect(() => {
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = `${origin}${localizedPath}`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = pageDescription;
    const script = document.getElementById(scriptId);
    if (script) script.textContent = schema;
  }, [localizedPath, origin, pageDescription, schema, scriptId]);

  return <script id={scriptId} type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />;
}
