import type { Metadata } from 'next';
import Theater from '@/app/theater/theater';

export const metadata: Metadata = {
  title: 'Theater | 16 Shades',
  description: 'Sixteen characters. Everyday life, with a twist. Start with The Cover Battle and settle in for a comic.',
  robots: { index: false, follow: false },
};

export default function TheaterPage() { return <Theater />; }
