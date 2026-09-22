import content from './social-content.json';

export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;
export type MbtiType = (typeof MBTI_TYPES)[number];
export function readMbti(value: string | null | undefined): MbtiType | null {
  const normalized = value?.toUpperCase();
  return MBTI_TYPES.find((type) => type === normalized) ?? null;
}
export const communicationRoles = content.roles;
export const combinationSamples = content.combos.map((combo) => ({ ...combo, mbti: readMbti(combo.mbti)! }));
export const officialSeeds = content.seeds;
export const combinationKicker = content.shareCards.cardKicker;
const nicknameByMbti = new Map(content.shareCards.mbtiProfiles.map((profile) => [profile.mbti, profile.nickname]));
const shareCopyByPair = new Map(content.shareCards.cards.map((card) => [`${card.mbti}:${card.roleId}`, card]));
export function getMbtiNickname(mbti: MbtiType) {
  const nickname = nicknameByMbti.get(mbti);
  if (!nickname) throw new Error('Unknown MBTI nickname');
  return nickname;
}
export function getShareCardCopy(roleId: string, mbti: MbtiType) {
  const copy = shareCopyByPair.get(`${mbti}:${roleId.toUpperCase()}`);
  if (!copy) throw new Error('Unknown share card combination');
  return copy;
}
export function getCommunicationRole(id: string) {
  const role = communicationRoles.find((entry) => entry.id === id.toUpperCase());
  if (!role) throw new Error('Unknown character');
  return role;
}
export function getCombination(id: string, mbti: string | null | undefined) {
  return combinationSamples.find((entry) => entry.roleId === id.toUpperCase() && entry.mbti === readMbti(mbti));
}
const wikiSlugs = ['mbti-connection', 'mbti-same-type', 'mbti-same-role', 'mbti-functions'];
const sources = '\n\n## 延伸阅读\n\n[MBTI官方类型动力学](https://www.myersbriggs.org/unique-features-of-myers-briggs/type-dynamics-overview/) · [16Personalities模型说明](https://www.16personalities.com/articles/our-theory) · [John Beebe对八功能模型的说明](https://www.aptinternational.org/psychological-type/evolving-the-eight-function-model/)';
export const mbtiWikiArticles = content.wiki.map((article, index) => ({
  slug: wikiSlugs[index],
  title: article.title,
  summary: article.lead,
  kind: '创作联想与理论参照',
  sections: article.sections,
  sources,
  body: article.sections.map((section) => `## ${section.title}\n\n${section.body}`).join('\n\n') + sources,
  related: wikiSlugs.filter((_, other) => other !== index),
}));
