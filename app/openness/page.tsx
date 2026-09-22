import type { Metadata } from 'next';
import PageContent from './localized-page';
export const metadata: Metadata = {
  title: '开放与使用说明｜16暗影',
  description:
    '关于16暗影的开放态度，以及题库、算法、人物形象与品牌的使用边界。',
};
export default function Page() { return <PageContent />; }
