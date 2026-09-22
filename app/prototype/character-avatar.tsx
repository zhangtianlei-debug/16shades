'use client';
import { useI18n } from '@/app/i18n/provider';

import Image from 'next/image';
import { characterArtworkSrc, familyClass } from './character-artwork';

export function CharacterAvatar({
  id,
  alt,
  size,
}: {
  id: string;
  alt: string;
  size: number;
}) {
  const { t, asset } = useI18n();

  return (
    <Image
      className={`proto-avatar ${familyClass(id)}`}
      src={asset(characterArtworkSrc(id))}
      alt={t(alt)}
      width={size}
      height={size}
      unoptimized
    />
  );
}
