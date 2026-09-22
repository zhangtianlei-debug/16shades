// Shared by metadata and the existing interactive page; no content bundle is
// imported into the client just to keep the browser title in sync.
export const characterSearchTitle = (name, locale) => locale === 'en'
  ? `${name}: traits & everyday situations | SIXTEEN SHADES`
  : `${name}：特点与日常情境｜16暗影人物`;
export const homeSearchTitle = (locale) => locale === 'en'
  ? '16 Shades | 16 character perspectives for everyday choices'
  : '16暗影｜16种策略画像，读懂选择里的另一面';
export const aboutSearchTitle = (locale) => locale === 'en'
  ? 'About 16 Shades | 16 character perspectives and open materials'
  : '关于16暗影｜16种策略画像与开放资料';
