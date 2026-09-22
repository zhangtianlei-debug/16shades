import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { characters } from '@/app/data';
import { entryMetadata } from '@/app/search/metadata';
import { siteOrigin } from '@/app/site-origin';
import { Prototype } from '../../prototype-flow';
import { characterPath } from '../../navigation';
import '../../prototype.css';
import '../../next-version.css';

const siteUrl = new URL(siteOrigin);

export function generateStaticParams() {
  return characters.map(({ slug }) => ({ type: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  const character = characters.find(({ slug }) => slug === type);
  if (!character)
    return {
      title: '16暗影｜人物图鉴',
      robots: { index: false, follow: false },
    };
  const title = `${character.name}｜16暗影人物卡`;
  const description = `“${character.quote}” ${character.description}`;
  const url = new URL(characterPath(character.id), siteUrl).href;
  const image = new URL(character.image, siteUrl).href;
  return {
    title,
    description,
    ...entryMetadata('character', character.id),
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: '16暗影',
      locale: 'zh_CN',
      url,
      images: [{ url: image, alt: `${character.name}人物形象` }],
    },
    twitter: { card: 'summary', title, description, images: [image] },
  };
}

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const character = characters.find(({ slug }) => slug === type);
  if (!character) notFound();
  return <Prototype initialType={character.id} />;
}
