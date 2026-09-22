'use client';
import { useI18n } from '@/app/i18n/provider';


import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  questionIllustrationStyle,
  sharedIllustrationSrc,
} from './question-illustrations';

export function QuestionIllustration({
  src,
  upcoming,
}: {
  src: string;
  upcoming: string[];
}) {
  const { t, asset } = useI18n();

  const [loadedSource, setLoadedSource] = useState('');

  useEffect(() => {
    // Warm only the next two illustrations, never the entire bank.
    for (const source of new Set(upcoming)) {
      const image = new window.Image();
      image.src = source;
    }
  }, [upcoming]);

  return (
    <figure
      className="proto-question-illustration"
      data-variant={src === sharedIllustrationSrc ? 'brand' : 'scene'}
      aria-hidden="true"
    >
      <Image
        unoptimized
        key={src}
        src={asset(src)}
        style={questionIllustrationStyle(src)}
        alt={t("")}
        width={900}
        height={900}
        draggable={false}
        decoding="async"
        className={loadedSource === src ? 'is-loaded' : ''}
        onLoad={() => setLoadedSource(src)}
        onError={() => setLoadedSource('')}
      />
    </figure>
  );
}
