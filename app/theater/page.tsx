import type { Metadata } from 'next';
import Theater from './theater';

export const metadata: Metadata = {
  title: '小剧场｜16暗影',
  description: '16个人物，把日常过成一出好戏。从《封面争夺战》开始，关灯，开场。',
  robots: { index: false, follow: false },
};

export default function TheaterPage() { return <Theater />; }
