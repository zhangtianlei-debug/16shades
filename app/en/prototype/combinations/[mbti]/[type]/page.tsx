import OriginalPage from '@/app/prototype/combinations/[mbti]/[type]/page';
export { generateStaticParams } from '@/app/prototype/combinations/[mbti]/[type]/page';
import { generateMetadata as originalMetadata } from '@/app/prototype/combinations/[mbti]/[type]/page';
import { englishMetadata } from '@/app/i18n/metadata';
export async function generateMetadata(props: Parameters<typeof originalMetadata>[0]) { return englishMetadata(await originalMetadata(props)); }
export default OriginalPage;
