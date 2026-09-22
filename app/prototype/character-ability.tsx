'use client';
import { useI18n } from '@/app/i18n/provider';


import Image from 'next/image';
import { Download, Maximize2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character } from '@/app/data';
import {
  abilityImagePath,
  characterAbilities,
} from './character-abilities';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import './character-ability.css';

type ImageMotion = {
  animation: Animation;
  image: HTMLImageElement;
  imageAnimation: Animation;
  element: HTMLDivElement;
};

const IMAGE_MOTION_DURATION = 240;

function hasUsableRect(rect: DOMRect) {
  return rect.width > 1 && rect.height > 1;
}

function createMotionImage(source: HTMLImageElement, rect: DOMRect) {
  const shell = document.createElement('div');
  const image = document.createElement('img');
  shell.className = 'character-ability__motion-shell';
  shell.setAttribute('aria-hidden', 'true');
  image.className = 'character-ability__motion-image';
  image.src = source.currentSrc || source.src;
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  shell.style.left = `${rect.left}px`;
  shell.style.top = `${rect.top}px`;
  shell.style.width = `${rect.width}px`;
  shell.style.height = `${rect.height}px`;
  shell.appendChild(image);
  document.body.appendChild(shell);
  return { image, shell };
}

export function CharacterAbility({ character }: { character: Character }) {
  const { t, tn, asset, href } = useI18n();

  const [open, setOpen] = useState(false);
  const [motionPhase, setMotionPhase] = useState<'opening' | 'closing' | null>(null);
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fullImageViewportRef = useRef<HTMLElement | null>(null);
  const fullImageFallbackRef = useRef<HTMLImageElement | null>(null);
  const fullImageRef = useRef<HTMLImageElement | null>(null);
  const motionRef = useRef<ImageMotion | null>(null);
  const openingFrameRef = useRef<number | null>(null);
  const ability = characterAbilities[character.id];

  const clearMotion = useCallback(() => {
    const motion = motionRef.current;
    if (!motion) return;
    motion.animation.cancel();
    motion.imageAnimation.cancel();
    motion.element.remove();
    motionRef.current = null;
  }, []);

  const reduceMotion = useCallback(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const animateImage = useCallback((
    source: HTMLImageElement,
    from: DOMRect,
    sourceImage: DOMRect,
    to: DOMRect,
    targetImage: DOMRect,
  ) => {
    const { image, shell } = createMotionImage(source, from);
    const animation = shell.animate(
      [
        {
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          borderRadius: '12px',
          opacity: 1,
        },
        {
          left: `${to.left}px`,
          top: `${to.top}px`,
          width: `${to.width}px`,
          height: `${to.height}px`,
          borderRadius: '10px',
          opacity: 1,
        },
      ],
      {
        duration: IMAGE_MOTION_DURATION,
        easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)',
        fill: 'forwards',
      },
    );
    const imageAnimation = image.animate(
      [
        {
          left: `${sourceImage.left - from.left}px`,
          top: `${sourceImage.top - from.top}px`,
          width: `${sourceImage.width}px`,
          height: `${sourceImage.height}px`,
        },
        {
          left: `${targetImage.left - to.left}px`,
          top: `${targetImage.top - to.top}px`,
          width: `${targetImage.width}px`,
          height: `${targetImage.height}px`,
        },
      ],
      {
        duration: IMAGE_MOTION_DURATION,
        easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)',
        fill: 'forwards',
      },
    );
    const motion = { animation, image, imageAnimation, element: shell };
    motionRef.current = motion;
    void animation.finished.catch(() => undefined).then(() => {
      if (motionRef.current !== motion) return;
      shell.remove();
      motionRef.current = null;
      setMotionPhase(null);
    });
  }, []);

  const closeWithMotion = useCallback(() => {
    const sourceImage = imageRef.current;
    const fullImage = fullImageLoaded ? fullImageRef.current : fullImageFallbackRef.current;
    const viewport = fullImageViewportRef.current;
    const destination = sourceImage?.getBoundingClientRect();
    const existingMotion = motionRef.current;

    if (
      !reduceMotion()
      && sourceImage
      && fullImage
      && viewport
      && destination
      && hasUsableRect(destination)
      && ((fullImage.complete && fullImage.naturalWidth > 0) || existingMotion)
    ) {
      const source = existingMotion?.image ?? fullImage;
      const origin = existingMotion?.element.getBoundingClientRect() ?? viewport.getBoundingClientRect();
      const sourceImageRect = source.getBoundingClientRect();
      clearMotion();
      if (hasUsableRect(origin) && hasUsableRect(sourceImageRect)) {
        setMotionPhase('closing');
        animateImage(source, origin, sourceImageRect, destination, destination);
      }
    } else {
      clearMotion();
      setMotionPhase(null);
    }

    setOpen(false);
  }, [animateImage, clearMotion, fullImageLoaded, reduceMotion]);

  useEffect(() => {
    if (!open || motionPhase !== 'opening') return;

    openingFrameRef.current = window.requestAnimationFrame(() => {
      const sourceImage = imageRef.current;
      const fullImage = fullImageFallbackRef.current;
      const viewport = fullImageViewportRef.current;
      const source = sourceImage?.getBoundingClientRect();
      const destination = viewport?.getBoundingClientRect();
      const targetImage = fullImage?.getBoundingClientRect();

      if (
        !reduceMotion()
        && sourceImage
        && sourceImage.complete
        && sourceImage.naturalWidth > 0
        && source
        && destination
        && targetImage
        && hasUsableRect(source)
        && hasUsableRect(destination)
        && hasUsableRect(targetImage)
      ) {
        animateImage(sourceImage, source, source, destination, targetImage);
        return;
      }

      setMotionPhase(null);
    });

    return () => {
      if (openingFrameRef.current !== null) {
        window.cancelAnimationFrame(openingFrameRef.current);
        openingFrameRef.current = null;
      }
    };
  }, [animateImage, motionPhase, open, reduceMotion]);

  useEffect(() => {
    if (!motionPhase) return;

    const stopForLayoutChange = () => {
      clearMotion();
      setMotionPhase(null);
    };
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stopForReducedMotion = () => {
      if (motionPreference.matches) stopForLayoutChange();
    };

    window.addEventListener('resize', stopForLayoutChange);
    window.addEventListener('scroll', stopForLayoutChange, true);
    motionPreference.addEventListener('change', stopForReducedMotion);
    return () => {
      window.removeEventListener('resize', stopForLayoutChange);
      window.removeEventListener('scroll', stopForLayoutChange, true);
      motionPreference.removeEventListener('change', stopForReducedMotion);
    };
  }, [clearMotion, motionPhase]);

  useEffect(() => () => clearMotion(), [clearMotion]);

  if (!ability) return null;

  const webp = abilityImagePath(character.id, 'webp');
  const png = abilityImagePath(character.id, 'png');
  const title = `${character.name} · ${ability.title}`;

  return (
    <section
      id="character-ability"
      className="character-ability"
      aria-labelledby={`ability-${character.id}`}
      data-image-motion={motionPhase ?? undefined}
    >
      <div className="character-ability__heading">
        <div>
          <p className="proto-kicker">{t("番外 / 人物本领")}</p>
          <h2 id={`ability-${character.id}`}>{tn(ability.title)}</h2>
        </div>
      </div>
      <div className="character-ability__image-frame">
        <Image
          ref={imageRef}
          className="character-ability__image"
          src={asset(webp)}
          alt={t(`${title}人物演绎图`)}
          width={1536}
          height={1024}
          loading="lazy"
          decoding="async"
          unoptimized
        />
        <button
          ref={triggerRef}
          className="character-ability__expand"
          type="button"
          onClick={() => {
            clearMotion();
            setFullImageLoaded(false);
            setMotionPhase(reduceMotion() ? null : 'opening');
            setOpen(true);
          }}
          aria-label={t(`放大${character.name}的本领图`)}
          title={t("放大")}
        >
          <Maximize2 size={20} aria-hidden="true" />
        </button>
      </div>
      <p className="character-ability__narrative">{tn(ability.narrative)}</p>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            setOpen(true);
            return;
          }
          closeWithMotion();
        }}
      >
        <DialogContent
          className="character-ability__dialog"
          data-image-motion={motionPhase ?? undefined}
          finalFocus={triggerRef}
          showCloseButton={false}
        >
          <DialogHeader className="character-ability__dialog-heading">
            <DialogTitle>{tn(title)}</DialogTitle>
            <DialogDescription className="sr-only">
              {tn(ability.narrative)}
            </DialogDescription>
            <div className="character-ability__tools">
              <a
                href={href(png)}
                download={t(`16暗影-${character.name}-${ability.title}.png`)}
                aria-label={t("保存图片")}
                title={t("保存图片")}
              >
                <Download size={20} aria-hidden="true" />
              </a>
              <DialogClose aria-label={t("关闭本领图片")} title={t("关闭")}>
                <X size={20} aria-hidden="true" />
              </DialogClose>
            </div>
          </DialogHeader>
          {(open && (
            // Keyboard users can focus this scroll region to pan the enlarged image.
            <section
              ref={fullImageViewportRef}
              className="character-ability__full-image"
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              aria-label={t("本领图片")}
              data-high-resolution-ready={fullImageLoaded || undefined}
            >
              <Image
                ref={fullImageFallbackRef}
                className="character-ability__full-image-fallback"
                src={asset(webp)}
                alt=""
                aria-hidden="true"
                width={1536}
                height={1024}
                unoptimized
              />
              <Image
                ref={fullImageRef}
                className="character-ability__full-image-primary"
                src={asset(png)}
                alt={t(`${title}人物演绎完整图，长按可保存`)}
                width={1536}
                height={1024}
                unoptimized
                onLoad={() => setFullImageLoaded(true)}
              />
            </section>
          ))}
        </DialogContent>
      </Dialog>
    </section>
  );
}
