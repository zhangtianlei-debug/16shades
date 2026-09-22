import { notFound } from 'next/navigation';
import { pairs } from '@/app/search/catalog.mjs';
import { RelationshipPage } from '@/app/search/reading';
import { entryMetadata } from '@/app/search/metadata';
type Props = { params: Promise<{ pair: string }> };
export function generateStaticParams() { return pairs.map((item) => ({ pair: item.id.toLowerCase() })); }
export async function generateMetadata({ params }: Props) {
  const { pair: value } = await params;
  const item = pairs.find((item) => item.id.toLowerCase() === value);
  return entryMetadata('relationship', item?.id ?? '', 'en');
}
export default async function Page({ params }: Props) {
  const { pair: value } = await params;
  const item = pairs.find((item) => item.id.toLowerCase() === value);
  if (!item) notFound();
  return <RelationshipPage id={item.id} locale="en" />;
}
