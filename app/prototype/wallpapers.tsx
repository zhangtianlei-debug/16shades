'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Download, Expand, Monitor, Smartphone, X } from 'lucide-react';
import { characters, type Character } from '@/app/data';
import { useI18n } from '@/app/i18n/provider';
import { characterArtworkSrc, familyClass } from './character-artwork';
import { featuredWallpapers, type WallpaperAsset, type WallpaperEntry } from './wallpaper-catalog';
import './wallpapers.css';

type WallpaperTab = 'featured' | 'portraits';
type StandardFormat = 'phone' | 'desktop';

const copy = {
  featured: { zh: '精选壁纸', en: 'Featured wallpapers' },
  portraits: { zh: '标准照', en: 'Standard portraits' },
  new: { zh: '新作', en: 'New release' },
  phone: { zh: '手机', en: 'Phone' },
  desktop: { zh: '电脑', en: 'Desktop' },
  preview: { zh: '查看大图', en: 'View full size' },
  download: { zh: '下载原图', en: 'Download original' },
  close: { zh: '关闭', en: 'Close' },
  format: { zh: '选择尺寸', en: 'Choose a size' },
  create: { zh: '生成并下载', en: 'Create and download' },
  creating: { zh: '正在生成…', en: 'Creating…' },
  featuredLead: { zh: '从人物的一个瞬间开始，慢慢收藏。', en: 'Keep a moment with a character.' },
  portraitLead: { zh: '十六位人物的清爽标准照，随时生成适合设备的尺寸。', en: 'Clean standard portraits for every device.' },
  portraitDownload: { zh: '下载标准照', en: 'Download standard portrait' },
};

function label(key: keyof typeof copy, locale: 'zh' | 'en') {
  return copy[key][locale];
}

function filename(value: string) {
  return value.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function download(url: string, name: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function loadImage(source: string) {
  const image = new window.Image();
  image.src = source;
  await image.decode();
  return image;
}

function portraitPalette(character: Character) {
  const colors = ['#e8d8ca', '#d9e4e9', '#ece1c9', '#dfe5d4'];
  return colors[Math.floor((Number(character.id.slice(1)) - 1) / 4)];
}

async function createStandardWallpaper(character: Character, format: StandardFormat, locale: 'zh' | 'en', source: string, displayName: string) {
  const dimensions = format === 'phone' ? [1440, 3120] : [3840, 2160];
  const [width, height] = dimensions;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  const image = await loadImage(source);
  const horizontal = format === 'desktop';
  const background = portraitPalette(character);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = 'rgba(255,255,255,.56)';
  context.beginPath();
  context.arc(horizontal ? width * .75 : width * .25, horizontal ? height * .12 : height * .18, Math.max(width, height) * .27, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(43,35,50,.12)';
  context.lineWidth = Math.max(3, width / 440);
  context.beginPath();
  context.moveTo(width * .08, height * .1);
  context.lineTo(width * .92, height * .1);
  context.stroke();
  const scale = horizontal ? Math.min(width * .42 / image.naturalWidth, height * .82 / image.naturalHeight) : Math.min(width * .86 / image.naturalWidth, height * .56 / image.naturalHeight);
  const artWidth = image.naturalWidth * scale;
  const artHeight = image.naturalHeight * scale;
  const artLeft = horizontal ? width * .53 : (width - artWidth) / 2;
  const artTop = horizontal ? height - artHeight : height * .29;
  context.drawImage(image, artLeft, artTop, artWidth, artHeight);
  const margin = horizontal ? width * .09 : width * .1;
  context.fillStyle = '#2b2332';
  context.font = `600 ${horizontal ? 72 : 56}px system-ui, sans-serif`;
  context.fillText(locale === 'zh' ? '16暗影' : '16 SHADES', margin, horizontal ? height * .2 : height * .16);
  context.font = `500 ${horizontal ? 144 : 104}px system-ui, sans-serif`;
  context.fillText(character.id, margin, horizontal ? height * .34 : height * .235);
  context.font = `600 ${horizontal ? 92 : 70}px system-ui, sans-serif`;
  context.fillText(displayName, margin, horizontal ? height * .46 : height * .3);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Wallpaper export failed');
  return URL.createObjectURL(blob);
}

function FeaturedCard({ entry, onPreview }: { entry: WallpaperEntry; onPreview: (entry: WallpaperEntry, asset: WallpaperAsset, format: StandardFormat) => void }) {
  const { locale, tn } = useI18n();
  const role = characters.find((character) => character.id === entry.characterId)!;
  return (
    <article className="wallpaper-feature-card">
      <div className="wallpaper-feature-meta">
        <span>{label('new', locale)}</span><time dateTime={entry.date}>{entry.date}</time>
      </div>
      <h3>{entry.title[locale]}</h3>
      <p>{tn(role.id)} · {tn(role.name)}</p>
      <div className="wallpaper-feature-assets">
        {(['phone', 'desktop'] as const).map((format) => {
          const asset = entry[format];
          return <button key={format} type="button" className={`wallpaper-art wallpaper-art--${format}`} onClick={() => onPreview(entry, asset, format)}>
            <Image src={asset.src} alt={`${entry.title[locale]} · ${label(format, locale)}`} width={asset.width} height={asset.height} loading="lazy" unoptimized />
            <span><Expand size={15} /> {label(format, locale)}</span>
          </button>;
        })}
      </div>
    </article>
  );
}

function FeaturedPreview({ item, onClose }: { item: { entry: WallpaperEntry; asset: WallpaperAsset; format: StandardFormat }; onClose: () => void }) {
  const { locale } = useI18n();
  return <dialog open className="wallpaper-lightbox" aria-label={label('preview', locale)}>
    <button type="button" className="wallpaper-lightbox-backdrop" onClick={onClose} aria-label={label('close', locale)} />
    <div className="wallpaper-lightbox-content">
      <button type="button" className="wallpaper-lightbox-close" onClick={onClose} aria-label={label('close', locale)}><X size={20} /></button>
      <Image src={item.asset.src} alt={`${item.entry.title[locale]} · ${label(item.format, locale)}`} width={item.asset.width} height={item.asset.height} unoptimized />
      <div><span>{item.entry.title[locale]} · {label(item.format, locale)} · {item.asset.width} × {item.asset.height}</span><button type="button" onClick={() => download(item.asset.src, `${item.entry.id}-${item.format}.png`)}><Download size={17} /> {label('download', locale)}</button></div>
    </div>
  </dialog>;
}

function StandardPortraits() {
  const { locale, t, tn, asset } = useI18n();
  const [selected, setSelected] = useState<Character | null>(null);
  const [format, setFormat] = useState<StandardFormat>('phone');
  const [saving, setSaving] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const url = await createStandardWallpaper(selected, format, locale, asset(characterArtworkSrc(selected.id)), t(selected.name));
      download(url, `16-shades-${filename(selected.id)}-standard-${format}.png`);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally { setSaving(false); }
  };
  return <>
    <div className="wallpaper-portrait-grid">
      {characters.map((character) => <button key={character.id} type="button" className={`wallpaper-portrait-card ${familyClass(character.id)}`} onClick={(event) => { trigger.current = event.currentTarget; setSelected(character); }}>
        <span>{tn(character.id)}</span><Image src={asset(characterArtworkSrc(character.id))} alt={t(character.name)} width={1024} height={1024} loading="lazy" unoptimized /><strong>{tn(character.name)}</strong>
      </button>)}
    </div>
    {selected && <dialog open className="wallpaper-lightbox" aria-label={label('portraitDownload', locale)}>
      <button type="button" className="wallpaper-lightbox-backdrop" onClick={() => setSelected(null)} aria-label={label('close', locale)} />
      <div className="wallpaper-standard-dialog">
        <button type="button" className="wallpaper-lightbox-close" onClick={() => { setSelected(null); trigger.current?.focus(); }} aria-label={label('close', locale)}><X size={20} /></button>
        <div className="wallpaper-standard-preview" style={{ background: portraitPalette(selected) }}><Image src={asset(characterArtworkSrc(selected.id))} alt={t(selected.name)} width={1024} height={1024} unoptimized /></div>
        <div className="wallpaper-standard-copy"><p>{tn(selected.id)}</p><h3>{tn(selected.name)}</h3><fieldset><legend>{label('format', locale)}</legend><button type="button" aria-pressed={format === 'phone'} onClick={() => setFormat('phone')}><Smartphone size={16} /> {label('phone', locale)}<small>1440 × 3120</small></button><button type="button" aria-pressed={format === 'desktop'} onClick={() => setFormat('desktop')}><Monitor size={16} /> {label('desktop', locale)}<small>3840 × 2160</small></button></fieldset><button type="button" className="wallpaper-create" onClick={save} disabled={saving}><Download size={17} /> {saving ? label('creating', locale) : label('create', locale)}</button></div>
      </div>
    </dialog>}
  </>;
}

export function Wallpapers() {
  const { locale } = useI18n();
  const [tab, setTab] = useState<WallpaperTab>('featured');
  const [preview, setPreview] = useState<{ entry: WallpaperEntry; asset: WallpaperAsset; format: StandardFormat } | null>(null);
  return <section className="wallpaper-gallery">
    <div className="wallpaper-tabs" role="tablist" aria-label={locale === 'zh' ? '人物壁纸分类' : 'Character wallpaper collections'}>
      {(['featured', 'portraits'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{label(item, locale)}</button>)}
    </div>
    <p className="wallpaper-lead">{tab === 'featured' ? label('featuredLead', locale) : label('portraitLead', locale)}</p>
    {tab === 'featured' ? <div className="wallpaper-feature-grid">{featuredWallpapers.map((entry) => <FeaturedCard key={entry.id} entry={entry} onPreview={(entry, asset, format) => setPreview({ entry, asset, format })} />)}</div> : <StandardPortraits />}
    {preview && <FeaturedPreview item={preview} onClose={() => setPreview(null)} />}
  </section>;
}
