/** @returns {'zh' | 'en'} */
export function currentLocale() {
  return typeof document !== 'undefined' && document.documentElement.dataset.locale === 'en' ? 'en' : 'zh';
}

/** @param {string} value @param {'zh' | 'en'} [locale] */
export function localizedHref(value, locale = currentLocale()) {
  if (!value.startsWith('/') || value.startsWith('//') || /^\/(?:api|assets|_next|en-assets|downloads|characters|brand|question-illustrations|character-abilities)(?:\/|$)/.test(value)) return value;
  const path = value.replace(/^\/en(?=\/|\?|#|$)/, '') || '/';
  return locale === 'en' ? `/en${path === '/' ? '' : path}` : path;
}
