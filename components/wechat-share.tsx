'use client';

import { useEffect } from 'react';
import { characters } from '@/app/data';
import { currentLocale, translateText, type Locale } from '@/app/i18n/core';
import { shareMetaFor } from '@/app/share/share-meta.mjs';
import { contentApi } from '@/app/content-client/client';

// WeChat's built-in browser is the only place the official menu reads these
// settings. Anywhere else the existing copy / system-share actions stay in use.
export function isWechatBrowser() {
  return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent);
}

type ShareMeta = {
  kind: string;
  title: string;
  description: string;
  image: string;
  link: string;
};

export type WechatShareCard = ShareMeta;
const selectionEvent = 'shadow16:wechat-share-selection';
const statusEvent = 'shadow16:wechat-share-status';
export type WechatShareStatus = 'off' | 'pending' | 'ready' | 'unavailable';

/** Sets the temporary card chosen in the share hub; null restores the page. */
export function setWechatShareSelection(card: WechatShareCard | null) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent<WechatShareCard | null>(selectionEvent, { detail: card }));
}

type WxSdk = {
  config(options: Record<string, unknown>): void;
  ready(handler: () => void): void;
  error(handler: (result: { errMsg?: string }) => void): void;
  updateAppMessageShareData(options: Record<string, unknown>): void;
  updateTimelineShareData(options: Record<string, unknown>): void;
  onMenuShareAppMessage?(options: Record<string, unknown>): void;
  onMenuShareTimeline?(options: Record<string, unknown>): void;
};

declare global {
  interface Window {
    wx?: WxSdk;
    jWeixin?: WxSdk;
    shadow16WechatEntryUrl?: string;
  }
}

const defaultSdkUrl = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
const locationEvent = 'shadow16:locationchange';
const rolesCache = new Map<Locale, Array<{ id: string; name: string; description: string }>>();

function localizedRoles(locale: Locale) {
  const cached = rolesCache.get(locale);
  if (cached) return cached;
  const roles = characters.map((item) => ({
    id: item.id,
    name: translateText(item.name, locale),
    description: translateText(item.description, locale),
  }));
  rolesCache.set(locale, roles);
  return roles;
}

function loadSdk(src: string, fresh = false) {
  return new Promise<WxSdk>((resolve, reject) => {
    if (!fresh && window.wx) {
      resolve(window.wx);
      return;
    }
    const previous = { wx: window.wx, jWeixin: window.jWeixin };
    if (fresh) {
      // The official script deliberately reuses jWeixin if it already exists.
      delete window.wx;
      delete window.jWeixin;
    }
    const failed = () => {
      if (fresh) {
        window.wx = previous.wx;
        window.jWeixin = previous.jWeixin;
      }
      reject(new Error('wx blocked'));
    };
    const settle = () => (window.wx ? resolve(window.wx) : reject(new Error('wx unavailable')));
    const existing = fresh ? null : document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', settle, { once: true });
      existing.addEventListener('error', () => reject(new Error('wx blocked')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => { settle(); if (fresh) script.remove(); }, { once: true });
    script.addEventListener('error', failed, { once: true });
    document.head.appendChild(script);
  });
}

/**
 * Notifies on in-page address changes. The app moves between views with
 * history.pushState rather than full navigation, so observing the two history
 * methods is what keeps the card in step with the visible page.
 */
function watchLocation(handler: () => void) {
  const originals = { pushState: history.pushState.bind(history), replaceState: history.replaceState.bind(history) };
  const notify = () => window.dispatchEvent(new Event(locationEvent));
  history.pushState = (...args) => {
    originals.pushState(...args);
    notify();
  };
  history.replaceState = (...args) => {
    originals.replaceState(...args);
    notify();
  };
  window.addEventListener(locationEvent, handler);
  window.addEventListener('popstate', handler);
  window.addEventListener('hashchange', handler);
  return () => {
    history.pushState = originals.pushState;
    history.replaceState = originals.replaceState;
    window.removeEventListener(locationEvent, handler);
    window.removeEventListener('popstate', handler);
    window.removeEventListener('hashchange', handler);
  };
}

export function wechatShareStatus(): WechatShareStatus {
  const value = typeof document === 'undefined' ? 'off' : document.documentElement.dataset.wechatShare;
  return value === 'pending' || value === 'ready' || value === 'unavailable' ? value : 'off';
}

export function subscribeWechatShareStatus(handler: () => void) {
  window.addEventListener(statusEvent, handler);
  return () => window.removeEventListener(statusEvent, handler);
}

function mark(value: WechatShareStatus) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.wechatShare = value;
  window.dispatchEvent(new Event(statusEvent));
}

/**
 * Keeps the WeChat share card matched to the page on screen.
 *
 * Renders nothing: it only configures the official JS-SDK, which owns the
 * top-right menu. The card is therefore never sent by the page itself, and no
 * promise is made that a web page can post a message on the visitor's behalf.
 */
export function WechatShare() {
  useEffect(() => {
    if (!isWechatBrowser()) {
      mark('off');
      return;
    }
    mark('pending');
    const entryUrl = window.shadow16WechatEntryUrl ?? window.location.href.split('#')[0];
    const isIos = /iP(?:hone|ad|od)/i.test(navigator.userAgent);
    let disposed = false;
    let timer = 0;
    let queue = Promise.resolve();
    let sdk: WxSdk | null = null;
    let bound = false;
    let sdkReady = false;
    let configFailed = false;
    let finishConfig: ((error?: Error) => void) | null = null;
    let signatureUrl = '';
    let meta: ShareMeta | null = null;
    let triedEntryUrl = false;
    let applyGeneration = 0;
    let selectedMeta: ShareMeta | null = null;
    let theaterEpisodes: Array<{ id: string; title: Record<string, string>; summary: Record<string, string>; cover: Record<string, string> }> = [];

    const apply = () => {
      if (!sdk || !meta || !sdkReady || configFailed) return;
      const generation = ++applyGeneration;
      let remaining = 2;
      let hasFailed = false;
      mark('pending');
      const done = () => {
        if (disposed || generation !== applyGeneration || hasFailed) return;
        remaining -= 1;
        if (remaining === 0) mark('ready');
      };
      const onFail = () => {
        if (disposed || generation !== applyGeneration || hasFailed) return;
        hasFailed = true;
        mark('unavailable');
      };
      // Some native menu paths do not use the newer update* cache even when
      // they acknowledge it. Keep the SDK's documented menu handlers in sync
      // as a compatibility layer. They explicitly send a link card; their
      // success callbacks fire only after a user shares, not on registration.
      const menuCard = { title: meta.title, desc: meta.description, link: meta.link, imgUrl: meta.image, type: 'link' };
      try {
        sdk.onMenuShareAppMessage?.(menuCard);
        sdk.onMenuShareTimeline?.(menuCard);
      } catch { /* The current update APIs below remain the primary path. */ }
      // The friend/group card carries a description; the timeline card has no
      // description field, so only the fields it accepts are passed there.
      try {
        sdk.updateAppMessageShareData({
          title: meta.title,
          desc: meta.description,
          link: meta.link,
          imgUrl: meta.image,
          success: done,
          fail: onFail,
        });
      } catch { onFail(); }
      try {
        sdk.updateTimelineShareData({
          title: meta.title,
          link: meta.link,
          imgUrl: meta.image,
          success: done,
          fail: onFail,
        });
      } catch { onFail(); }
    };

    const bind = (active: WxSdk) => {
      if (bound) return;
      bound = true;
      active.error((result) => {
        if (disposed || sdk !== active) return;
        configFailed = true;
        sdkReady = false;
        finishConfig?.(new Error('WeChat configuration rejected'));
        const message = String(result?.errMsg ?? '');
        applyGeneration += 1;
        // Older iOS builds validate against the address the page was entered
        // with. Retry once with it before giving up on the card.
        if (/signature/i.test(message) && !triedEntryUrl && signatureUrl !== entryUrl) {
          triedEntryUrl = true;
          mark('pending');
          void configure(entryUrl).catch(() => mark('unavailable'));
          return;
        }
        mark('unavailable');
      });
    };

    const configure = (target: string) => {
      queue = queue
        .catch(() => undefined)
        .then(async () => {
          if (disposed) return;
          if (signatureUrl === target && sdkReady && !configFailed) {
            apply();
            return;
          }
          mark('pending');
          sdkReady = false;
          applyGeneration += 1;
          const response = await fetch(
            `/api/wechat/jssdk?url=${encodeURIComponent(target)}`,
            { credentials: 'same-origin', cache: 'no-store' },
          );
          if (!response.ok) throw new Error(`JSSDK request failed: ${response.status}`);
          const data = (await response.json()) as {
            enabled?: boolean;
            sdkUrl?: string;
            appId?: string;
            timestamp?: number;
            nonceStr?: string;
            signature?: string;
            jsApiList?: string[];
          };
          if (disposed) return;
          // Sharing is not configured on this deployment: keep the page's
          // existing copy / system-share actions and leave the menu untouched.
          if (!data.enabled || !data.appId || !data.signature) {
            mark('off');
            return;
          }
          // The official SDK keeps its first ready flag across config calls.
          // A fresh cached script instance gives each new signed URL its own
          // verification lifecycle instead of reusing that stale flag.
          const active = await loadSdk(data.sdkUrl ?? defaultSdkUrl, Boolean(sdk));
          if (disposed) return;
          sdk = active;
          signatureUrl = target;
          sdkReady = false;
          configFailed = false;
          bound = false;
          bind(active);
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
              configFailed = true;
              sdkReady = false;
              finishConfig?.(new Error('WeChat configuration timed out'));
            }, 10000);
            finishConfig = (error) => {
              window.clearTimeout(timeout);
              finishConfig = null;
              if (error) reject(error); else resolve();
            };
            active.config({
            debug: false,
            appId: data.appId,
            timestamp: data.timestamp,
            nonceStr: data.nonceStr,
            signature: data.signature,
            jsApiList: [...new Set([...(data.jsApiList ?? [
              'updateAppMessageShareData',
              'updateTimelineShareData',
            ]), 'onMenuShareAppMessage', 'onMenuShareTimeline'])],
            });
            active.ready(() => {
              if (disposed || configFailed || signatureUrl !== target) return;
              sdkReady = true;
              finishConfig?.();
              apply();
            });
          });
        });
      return queue;
    };

    const sync = async () => {
      const url = window.location.href.split('#')[0];
      const locale = currentLocale();
      meta = shareMetaFor({
        href: url,
        origin: window.location.origin,
        locale,
        roles: localizedRoles(locale),
        episodes: theaterEpisodes,
      });
      meta = selectedMeta ?? meta;
      // A new address needs its own signature; the same address only needs the
      // card refreshed, which is what a language or view-state change does.
      const signingUrl = isIos ? entryUrl : url;
      if (signingUrl === signatureUrl) {
        apply();
        return;
      }
      await configure(signingUrl);
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void sync().catch(() => mark('unavailable')), 120);
    };

    const stop = watchLocation(schedule);
    const selection = (event: Event) => {
      selectedMeta = (event as CustomEvent<ShareMeta | null>).detail ?? null;
      mark('pending');
      schedule();
    };
    window.addEventListener(selectionEvent, selection);
    void contentApi.index()
      .then(({ value }) => {
        if (disposed) return;
        theaterEpisodes = value.theater.episodes;
        schedule();
      })
      .catch(() => undefined);
    void sync().catch(() => mark('unavailable'));
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      stop();
      window.removeEventListener(selectionEvent, selection);
    };
  }, []);

  return null;
}
