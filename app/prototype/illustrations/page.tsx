import type { Metadata } from 'next';
import PageContent from './localized-page';
export const metadata: Metadata = {
  title: '16暗影｜答题插图总览',
  robots: { index: false, follow: false },
};
export default function Page() { return <PageContent />; }
