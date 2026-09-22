import OriginalPage from '@/app/prototype/types/[type]/page';
export { generateStaticParams } from '@/app/prototype/types/[type]/page';
import { generateMetadata as originalMetadata } from '@/app/prototype/types/[type]/page';
import { englishMetadata } from '@/app/i18n/metadata';
import { entryMetadata } from '@/app/search/metadata';
export async function generateMetadata(props: Parameters<typeof originalMetadata>[0]) {
  const { type } = await props.params;
  const { openGraph, twitter } = await originalMetadata(props);
  return { ...englishMetadata({ openGraph, twitter }), ...entryMetadata('character', type.toUpperCase(), 'en') };
}
export default OriginalPage;
