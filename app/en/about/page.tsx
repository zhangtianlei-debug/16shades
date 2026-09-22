import AboutPage from '@/app/about/about-page';
import { BrandStructuredData } from '@/components/brand-structured-data';
import { entryMetadata } from '@/app/search/metadata';

export const metadata = entryMetadata('about', 'about', 'en');

export default function Page() {
  return <><BrandStructuredData locale="en" page="about" /><AboutPage /></>;
}
