import knowledge from '../prototype/knowledge-content.json' with { type: 'json' };
import social from '../prototype/social-content.json' with { type: 'json' };
import relationships from '../prototype/relationship-data.json' with { type: 'json' };
import english from '../i18n/en.json' with { type: 'json' };
import { config } from './policy.mjs';
import { brandPageDescription } from './brand-copy.mjs';
import { aboutSearchTitle, characterSearchTitle, homeSearchTitle } from './titles.mjs';
import summaries from './summaries.json' with { type: 'json' };

// Read existing publication projections; the upstream content remains its source.
export function text(value, locale) {
  if (locale === 'zh' || !/\p{Script=Han}/u.test(value)) return value;
  if (!Object.hasOwn(english, value)) throw new Error(`Missing search translation: ${value.slice(0,100)}`);
  return english[value];
}
export const roles = social.roles;
export const sources = knowledge.sources;
const wikiSlugs = ['mbti-connection', 'mbti-same-type', 'mbti-same-role', 'mbti-functions'];
export const articles = [...knowledge.articles, ...social.wiki.map((article, index) => ({
  ...article, slug: wikiSlugs[index], summary: article.lead, kind: 'MBTI', body: '',
  related: wikiSlugs.filter((_, other) => other !== index),
}))];
export const pairs = config.relationshipCandidates.map((id) => {
  const pair = relationships.relationships.find((item) => item.id === id);
  if (!pair) throw new Error(`Missing relationship: ${id}`);
  return pair;
});
export const articleBody = (article, locale) => article.sections
  ? article.sections.map((section) => `## ${text(section.title, locale)}\n\n${text(section.body, locale)}`).join('\n\n')
  : text(article.body, locale);
export const articleSummary = (article, locale) => summaries[article.slug]?.[locale] ?? text(article.summary, locale);
export const articleVersion = (article) => article.sections ? social.version : knowledge.version;
export const relationshipVersion = relationships.version;
export const entries = [
  { kind: 'home', id: 'home', path: '/prototype', candidate: true },
  { kind: 'about', id: 'about', path: '/about', candidate: true },
  { kind: 'hub', id: 'hub', path: '/explore', candidate: true },
  ...roles.map((role) => ({ kind: 'character', id: role.id, path: `/prototype/types/${role.id.toLowerCase()}`, candidate: true })),
  ...articles.map((article) => ({ kind: 'knowledge', id: article.slug, path: `/knowledge/${article.slug}`, candidate: config.knowledgeCandidates.includes(article.slug) })),
  ...pairs.map((pair) => ({ kind: 'relationship', id: pair.id, path: `/relationships/${pair.id.toLowerCase()}`, candidate: true })),
];
for (const id of config.knowledgeCandidates) if (!articles.some((article) => article.slug === id)) throw new Error(`Missing knowledge: ${id}`);
export const candidates = entries.filter((entry) => entry.candidate);
export function entryCopy(entry, locale) {
  const en = locale === 'en';
  const t = (value) => text(value, locale);
  if (entry.kind === 'home') return {
    title: homeSearchTitle(locale),
    description: brandPageDescription('home', locale),
  };
  if (entry.kind === 'about') return {
    title: aboutSearchTitle(locale),
    description: brandPageDescription('about', locale),
  };
  if (entry.kind === 'hub') return {
    title: en ? 'Characters, knowledge & relationships | SIXTEEN SHADES' : '人物、知识与关系｜16暗影内容目录',
    description: en ? 'Browse 16 characters, read the four-axis framework and relationship research, and explore how two characters might respond to each other.' : '浏览16个人物，读懂四轴框架与关系研究，从两个人的视角探索合作、冲突和转折。',
  };
  if (entry.kind === 'character') {
    const role = roles.find((role) => role.id === entry.id);
    return { title: characterSearchTitle(t(role.name), locale), description: en ? `${t(role.tagline)}. Explore ${t(role.name)} through everyday situations, strengths and shadow patterns.` : `${role.tagline}。了解${role.name}的日常表现、优势、越界转折，以及与相近人物的区别。` };
  }
  if (entry.kind === 'knowledge') {
    const article = articles.find((article) => article.slug === entry.id);
    return { title: `${t(article.title)}${en ? ' | SIXTEEN SHADES Wiki' : '｜16暗影知识库'}`, description: articleSummary(article, locale) };
  }
  const pair = pairs.find((pair) => pair.id === entry.id);
  const names = [pair.type_a, pair.type_b].map((id) => t(roles.find((role) => role.id === id).name)).join(' × ');
  return { title: en ? `${names}: ${t(pair.name)} | SIXTEEN SHADES relationships` : `${names}：${pair.name}｜16暗影人物关系`, description: en ? `${t(pair.hook)} Explore both perspectives, possible alliances, rivalries and turning points.` : `${pair.hook} 从双方视角阅读盟友、对手与亲密情境，了解关系的转折和边界。` };
}
