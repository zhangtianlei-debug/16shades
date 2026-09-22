import { notFound } from 'next/navigation';
import { articles } from '@/app/search/catalog.mjs';
import { KnowledgePage } from '@/app/search/reading';
import { entryMetadata } from '@/app/search/metadata';
type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return articles.map((item) => ({ slug: item.slug })); }
export async function generateMetadata({ params }: Props) {
  const { slug: value } = await params;
  const item = articles.find((item) => item.slug === value);
  return entryMetadata('knowledge', item?.slug ?? '', 'zh');
}
export default async function Page({ params }: Props) {
  const { slug: value } = await params;
  const item = articles.find((item) => item.slug === value);
  if (!item) notFound();
  return <KnowledgePage slug={item.slug} locale="zh" />;
}
