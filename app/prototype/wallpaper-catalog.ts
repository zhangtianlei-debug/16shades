export type WallpaperAsset = {
  src: string;
  width: number;
  height: number;
};

export type WallpaperEntry = {
  id: string;
  characterId: string;
  title: { zh: string; en: string };
  date: string;
  phone: WallpaperAsset;
  desktop: WallpaperAsset;
};

/** Curated releases only. Add a complete phone + desktop pair for each new work. */
export const featuredWallpapers: WallpaperEntry[] = [
  {
    id: 't03-quiet-orbit',
    characterId: 'T03',
    title: { zh: '月光加一滴', en: 'One Drop of Moonlight' },
    date: '2026-09-22',
    phone: { src: '/wallpapers/t03-quiet-orbit-phone.png', width: 853, height: 1844 },
    desktop: { src: '/wallpapers/t03-quiet-orbit-desktop.png', width: 1672, height: 941 },
  },
  {
    id: 't07-midnight-archive',
    characterId: 'T07',
    title: { zh: '午夜档案', en: 'Midnight Archive' },
    date: '2026-09-22',
    phone: { src: '/wallpapers/t07-midnight-archive-phone.png', width: 853, height: 1844 },
    desktop: { src: '/wallpapers/t07-midnight-archive-desktop.png', width: 1672, height: 941 },
  },
];
