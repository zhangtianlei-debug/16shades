const descriptions = {
  zh: {
    home: '以16种策略画像和日常情境，观察自己在分歧、利益与规则面前的选择。免费体验，无广告。',
    about: '了解16暗影（16 Shades）：一个从日常选择出发的16种策略画像项目。双语分类框架、题库与网站代码现已开放：代码MIT，核心内容CC BY 4.0；人物与品牌单独管理。',
  },
  en: {
    home: 'A free, ad-free experience built around 16 character perspectives and everyday situations. Explore how you respond to conflict, interests and rules.',
    about: 'Learn about 16 Shades: a project built around 16 character perspectives and everyday choices. Its bilingual framework, item bank and website code are open: MIT for code and CC BY 4.0 for core content, with artwork and branding managed separately.',
  },
};

export const brandPageDescription = (page, locale) => descriptions[locale][page];
