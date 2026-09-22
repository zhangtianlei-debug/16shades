import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { characters } from '@/app/data';
import { ResultView } from './result-view';

export function generateStaticParams() {
  return characters.map((character) => ({ type: character.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params;
  const character = characters.find((item) => item.slug === type);
  return {
    title: character ? `${character.name}｜16暗面` : '16暗面测试结果',
    description: character ? `16暗面测试结果：${character.name}。${character.quote}` : '16暗面测试结果',
  };
}

export default async function ResultPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const character = characters.find((item) => item.slug === type);
  if (!character) notFound();
  return <ResultView character={character} />;
}
