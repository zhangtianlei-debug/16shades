'use client';
import { useI18n } from '@/app/i18n/provider';


import { useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight, Download, X } from 'lucide-react';
import { characters, type Character } from '@/app/data';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { familyClass, T06_ARTWORK_REVISION } from './character-artwork';

type ImageKind = 'portraits' | 'cards';
const imagePath = (character: Character, kind: ImageKind) =>
  `/downloads/${kind}/${character.slug}.png${character.id === 'T06' ? `?v=${T06_ARTWORK_REVISION}` : ''}`;

export function Resources() {
  const { t, tn, asset, href } = useI18n();

  const [kind, setKind] = useState<ImageKind>('portraits');
  const [selected, setSelected] = useState<Character | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const label = kind === 'portraits' ? '角色图' : '信息卡';

  return (
    <section className="proto-reading-page proto-resources-page">
      <h1>{t("收藏你喜欢的角色")}</h1>
      <p className="proto-reading-lead">{t("角色图或人物信息卡，点开就能保存。")}</p>
      <div className="proto-resource-toolbar">
        <fieldset className="proto-resource-switch">
          <legend className="sr-only">{t("图片类型")}</legend>
          <button
            type="button"
            aria-pressed={kind === 'portraits'}
            onClick={() => setKind('portraits')}
          >
            {t("角色图 ")}</button>
          <button
            type="button"
            aria-pressed={kind === 'cards'}
            onClick={() => setKind('cards')}
          >
            {t("信息卡 ")}</button>
        </fieldset>
        <a
          className="proto-resource-bundle"
          href={href(asset(`/downloads/shadow16-all-characters.zip?v=${T06_ARTWORK_REVISION}`))}
          download={t("16暗影-全人物素材包.zip")}
        >
          <Download size={17} /> {t(" 下载完整素材包 ")}<span>{t("32 张 PNG")}</span>
        </a>
      </div>
      <p className="proto-resource-hint">
        {tn(kind === 'portraits'
          ? '透明底角色图 · 1024 × 1024'
          : '人物介绍卡 · 1080 × 1440')}
      </p>
      <div className="proto-resource-grid">
        {(characters.map((character) => (
          <button
            key={character.id}
            type="button"
            className={`proto-resource-tile ${familyClass(character.id)}`}
            aria-label={t(`保存${character.name}${label}`)}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setSelected(character);
            }}
          >
            <div
              className={`proto-resource-image proto-resource-image--${kind}`}
            >
              <Image
                src={asset(imagePath(character, kind))}
                alt={t(`${character.name}${label}预览`)}
                width={kind === 'portraits' ? 1024 : 1080}
                height={kind === 'portraits' ? 1024 : 1440}
                loading="lazy"
                decoding="async"
                unoptimized
              />
            </div>
            <div className="proto-resource-caption">
              <span>
                <small>{tn(character.id)}</small>
                <strong>{tn(character.name)}</strong>
              </span>
              <Download size={18} aria-hidden="true" />
            </div>
          </button>
        )))}
      </div>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="proto-resource-dialog"
          finalFocus={trigger}
          showCloseButton={false}
        >
          <DialogClose className="proto-resource-close" aria-label={t("关闭图片")}>
            <X size={18} />
          </DialogClose>
          <DialogHeader>
            <DialogTitle>
              {tn(selected?.name)} · {tn(label)}
            </DialogTitle>
            <DialogDescription>
              {t("长按图片保存到相册，也可以下载原图。 ")}</DialogDescription>
          </DialogHeader>
          {(selected && (
            <>
              <div
                className={`proto-resource-preview ${familyClass(selected.id)}`}
              >
                <Image
                  src={asset(imagePath(selected, kind))}
                  alt={t(`${selected.name}${label}，长按保存`)}
                  width={kind === 'portraits' ? 1024 : 1080}
                  height={kind === 'portraits' ? 1024 : 1440}
                  unoptimized
                />
              </div>
              <div className="proto-resource-actions">
                <a
                  className="proto-resource-download"
                  href={href(asset(imagePath(selected, kind)))}
                  download={t(`16暗影-${selected.name}-${label}.png`)}
                >
                  <Download size={17} /> {t(" 下载图片 ")}</a>
                <a
                  href={href(asset(imagePath(selected, kind)))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("打开原图 ")}<ArrowUpRight size={16} />
                </a>
              </div>
            </>
          ))}
        </DialogContent>
      </Dialog>
    </section>
  );
}
