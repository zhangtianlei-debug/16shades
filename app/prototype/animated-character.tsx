'use client';
import { useI18n } from '@/app/i18n/provider';


import Image from 'next/image';
import descriptions from '../i18n/character-descriptions.json';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { characterArtworkSrc } from './character-artwork';
import { inlineCharacterSvg } from './svg-instance';
import broker from './assets/t01-motion.svg?raw';
import guru from './assets/t12-motion.svg?raw';
import './assets/character-motion.css';
import './assets/hunters-raiders-motion.css';
import './assets/controllers-rulers-motion.css';
import './assets/action-rigs-motion.css';
import './assets/eye-blink.css';

// Result characters load independently, so answering never waits for the
// complete cast. The static poster stays visible while its motion is prepared.
const motionLoaders: Record<string, () => Promise<{ default: string }>> = {
  T02: () => import('./assets/t02-motion.svg?raw'),
  T03: () => import('./assets/t03-motion.svg?raw'),
  T04: () => import('./assets/t04-motion.svg?raw'),
  T05: () => import('./assets/t05-motion.svg?raw'),
  T06: () => import('./assets/t06-motion.svg?raw'),
  T07: () => import('./assets/t07-motion.svg?raw'),
  T08: () => import('./assets/t08-motion.svg?raw'),
  T09: () => import('./assets/t09-motion.svg?raw'),
  T10: () => import('./assets/t10-motion.svg?raw'),
  T11: () => import('./assets/t11-motion.svg?raw'),
  T13: () => import('./assets/t13-motion.svg?raw'),
  T14: () => import('./assets/t14-motion.svg?raw'),
  T15: () => import('./assets/t15-motion.svg?raw'),
  T16: () => import('./assets/t16-motion.svg?raw'),
};

export function AnimatedCharacter({
  id,
  mode,
  name,
}: {
  id: string;
  mode: 'welcome' | 'result';
  name: string;
}) {
  const { t, locale, asset } = useI18n();

  const ref = useRef<HTMLDivElement>(null);
  const instance = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [loaded, setLoaded] = useState<{ id: string; source: string } | null>(
    null,
  );
  useEffect(() => {
    const load = motionLoaders[id];
    if (!load) return;
    let live = true;
    void load()
      .then((asset) => {
        if (live) setLoaded({ id, source: asset.default });
      })
      .catch(() => {
        // A failed motion chunk leaves the complete poster usable.
      });
    return () => {
      live = false;
    };
  }, [id]);
  const svg = useMemo(() => {
    const source =
      id === 'T01'
        ? broker
        : id === 'T12'
          ? guru
          : loaded?.id === id
            ? loaded.source
            : null;
    if (!source) return null;
    const localized = locale === 'en' ? source
      .replace(/(<title\b[^>]*>)[\s\S]*?(<\/title>)/g, (_, open, close) => `${open}${descriptions[id.toLowerCase() as keyof typeof descriptions]?.name ?? id}${close}`)
      .replace(/(<desc\b[^>]*>)[\s\S]*?(<\/desc>)/g, (_, open, close) => `${open}${descriptions[id.toLowerCase() as keyof typeof descriptions]?.description ?? ''}${close}`)
      .replace(/<metadata\b[^>]*\/>/g, '').replace(/zh-CN/g, 'en') : source;
    return inlineCharacterSvg(localized, instance);
  }, [id, instance, loaded, locale]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const updatePause = () => {
      node.dataset.paused = String(!visible || document.hidden);
    };
    const restart = () => {
      // Activity never rewinds an active gesture. Irreversible actions hold
      // their outcome, then cut to the starting pose at a cycle boundary.
      if (
        node.dataset.motionState !== 'idle' ||
        document.hidden ||
        reducedMotion.matches
      )
        return;
      // Offscreen/covered characters stay paused in CSS and resume when revealed.
      node.dataset.motionState = 'playing';
    };
    const updatePreference = () => {
      node.dataset.motionState = reducedMotion.matches ? 'idle' : 'playing';
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        updatePause();
      },
      { threshold: 0.1 },
    );
    updatePreference();
    updatePause();
    observer.observe(node);
    const events = ['click', 'wheel', 'touchmove', 'scroll'] as const;
    events.forEach((event) =>
      document.addEventListener(event, restart, {
        passive: true,
        capture: true,
      }),
    );
    document.addEventListener('visibilitychange', updatePause);
    reducedMotion.addEventListener('change', updatePreference);
    return () => {
      observer.disconnect();
      events.forEach((event) =>
        document.removeEventListener(event, restart, true),
      );
      document.removeEventListener('visibilitychange', updatePause);
      reducedMotion.removeEventListener('change', updatePreference);
    };
  }, [id, mode, svg]);
  return svg ? (
    <div
      ref={ref}
      onAnimationEnd={(event) => {
        if (event.animationName === `${id.toLowerCase()}-body-${mode}`) {
          event.currentTarget.dataset.motionState = 'idle';
        }
      }}
      className={`proto-character proto-character--${mode}`}
      data-character={id}
      data-motion-phase={mode}
      data-motion-state="playing"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : (
    <div className="proto-character proto-character--static">
      <Image
        src={asset(characterArtworkSrc(id))}
        alt={t(`${name}人物形象`)}
        width={512}
        height={512}
        unoptimized
      />
    </div>
  );
}
