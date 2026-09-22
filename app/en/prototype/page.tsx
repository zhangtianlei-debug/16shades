import { BrandStructuredData } from '@/components/brand-structured-data';
import { Prototype } from '@/app/prototype/prototype-flow';
import { entryMetadata } from '@/app/search/metadata';
import '@/app/prototype/prototype.css';
import '@/app/prototype/next-version.css';
export const metadata = entryMetadata('home', 'home', 'en');
export default function Page() {
  return <><BrandStructuredData locale="en" page="home" /><Prototype /></>;
}
