import { ExplorePage } from '@/app/search/reading';
import { entryMetadata } from '@/app/search/metadata';
export const metadata = entryMetadata('hub', 'hub', 'zh');
export default function Page() { return <ExplorePage locale="zh" />; }
