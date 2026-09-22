import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { characters } from '@/app/data';
import { siteOrigin } from '@/app/site-origin';
import { Prototype } from '../../../prototype-flow';
import { combinationPath } from '../../../navigation';
import { MBTI_TYPES, getShareCardCopy, getCommunicationRole, readMbti } from '../../../social-content';
import '../../../prototype.css';
import '../../../next-version.css';

export function generateStaticParams() {
  return MBTI_TYPES.flatMap((mbti) => characters.map(({ slug }) => ({ mbti: mbti.toLowerCase(), type: slug })));
}
type Params = Promise<{ mbti: string; type: string }>;
function resolveCombination(params: { mbti: string; type: string }) {
  const mbti = readMbti(params.mbti);
  const character = characters.find(({ slug }) => slug === params.type);
  return mbti && character ? { mbti, character } : null;
}
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const combination = resolveCombination(await params);
  if (!combination) return { title: '16暗影｜组合未找到', robots: { index: false, follow: false } };
  const { mbti, character } = combination;
  const role = getCommunicationRole(character.id);
  const copy = getShareCardCopy(character.id, mbti);
  const title = `${mbti} × ${role.name}｜16暗影组合卡`;
  const description = copy.line;
  const url = new URL(combinationPath(character.id, mbti), siteOrigin).href;
  const image = new URL(`/downloads/portraits/${character.slug}.png`, siteOrigin).href;
  return {
    title, description, alternates: { canonical: url }, robots: { index: false, follow: false },
    openGraph: { title, description, url, type: 'website', siteName: '16暗影', locale: 'zh_CN', images: [{ url: image, width: 1024, height: 1024, alt: `${role.name}人物形象` }] },
    twitter: { card: 'summary', title, description, images: [image] },
  };
}
export default async function CombinationPage({ params }: { params: Params }) {
  const combination = resolveCombination(await params);
  if (!combination) notFound();
  return <Prototype initialCombination={{ roleId: combination.character.id, mbti: combination.mbti }} />;
}
