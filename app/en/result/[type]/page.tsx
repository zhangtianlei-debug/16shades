import OriginalPage from '@/app/result/[type]/page';
export { generateStaticParams } from '@/app/result/[type]/page';
import { generateMetadata as originalMetadata } from '@/app/result/[type]/page';
import { englishMetadata } from '@/app/i18n/metadata';
export async function generateMetadata(props: Parameters<typeof originalMetadata>[0]) { return englishMetadata(await originalMetadata(props)); }
export default OriginalPage;
