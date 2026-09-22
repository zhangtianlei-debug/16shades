import type { Metadata } from 'next';
import { localizedAsset, localizedHref, translateRecord } from './core';
import { siteOrigin } from '@/app/site-origin';

export function englishMetadata(metadata: Metadata): Metadata {
  const translated = translateRecord(metadata, 'en');
  function urls(value: unknown, key = ''): unknown {
    if (typeof value === 'string') {
      if (value === 'zh_CN') return 'en_US';
      if (value.startsWith(siteOrigin)) {
        const url = new URL(value);
        url.pathname = localizedHref(localizedAsset(url.pathname, 'en'), 'en');
        return url.href;
      }
      if (value.startsWith('/') && ['url', 'canonical', 'images'].includes(key)) return localizedHref(localizedAsset(value, 'en'), 'en');
      return value;
    }
    if (Array.isArray(value)) return value.map((part) => urls(part, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, urls(v, k)]));
    return value;
  }
  return urls(translated) as Metadata;
}
