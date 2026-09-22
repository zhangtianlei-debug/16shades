import type { Metadata } from 'next';
import AboutPage from './about-page';
import { BrandStructuredData } from '@/components/brand-structured-data';
import { entryMetadata } from '@/app/search/metadata';

export const metadata: Metadata = entryMetadata('about', 'about');

export default function Page() {
  return <><BrandStructuredData locale="zh" page="about" /><AboutPage /></>;
}
