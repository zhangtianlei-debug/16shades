import type { Metadata } from 'next';
import PageContent from './localized-page';
export const metadata: Metadata = {
  title: '隐私政策与设置｜16暗影',
  description:
    '了解16暗影的本地结果保留、账号保存、可选访问统计及信息管理方式。',
  robots: { index: false, follow: false },
};
export default function Page() { return <PageContent />; }
