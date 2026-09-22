import { ExplorePage } from '@/app/search/reading';
import { entryMetadata } from '@/app/search/metadata';
export const metadata = entryMetadata('hub', 'hub', 'en');
export default function Page() { return <ExplorePage locale="en" />; }
