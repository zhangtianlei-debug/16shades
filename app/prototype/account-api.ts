import type { CandidateResult } from './scoring';
import type { Recommendation } from './recommendation';
export type AccountUser = { id: string; username: string };
export type SavedResult = {
  revision: string;
  result: CandidateResult;
  presentation: Recommendation;
  savedAt: string;
};
export type AccountResponse = {
  user: AccountUser | null;
  saved: SavedResult | null;
  csrfToken: string;
  config: { analyticsEnabled: boolean; baiduSiteId: string; version: string };
};
export class AccountError extends Error {
  code: string;
  captchaRequired?: boolean;
  saved?: SavedResult;
  constructor(data: {
    message: string;
    code: string;
    captchaRequired?: boolean;
    saved?: SavedResult;
  }) {
    super(data.message);
    this.code = data.code;
    this.captchaRequired = data.captchaRequired;
    this.saved = data.saved;
  }
}
let csrf = '';
let config: AccountResponse['config'] | null = null;
let identityGeneration = 0;
let sessionReadGeneration = 0;
let pendingSession: Promise<AccountResponse> | null = null;
const authSignal = 'shadow16-auth-change';
function invalidateSessionRead() {
  sessionReadGeneration++;
  pendingSession = null;
}
function invalidateSession() {
  identityGeneration++;
  invalidateSessionRead();
}
export async function accountRequest<T>(
  path: string,
  body?: unknown,
  method = 'POST',
): Promise<T> {
  const changesIdentity =
    body !== undefined &&
    (path.startsWith('/api/auth/') || path === '/api/account');
  if (changesIdentity) invalidateSession();
  const generation = identityGeneration;
  const readGeneration = sessionReadGeneration;
  const readsSession = body === undefined && path === '/api/session';
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers:
      body === undefined
        ? {}
        : {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf,
            ...(analyticsPreference() ? { 'X-Analytics-Consent': '1' } : {}),
          },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  }).catch(() => {
    throw new Error(
      '暂时连接不上账号服务，请稍后重试。当前画像仍保留在页面中。',
    );
  });
  const data = (await response.json().catch(() => {
    throw new Error('账号服务暂未就绪，请稍后再试。');
  })) as T &
    Partial<AccountResponse> & {
      message?: string;
      code?: string;
      captchaRequired?: boolean;
      saved?: SavedResult;
    };
  if (!response.ok)
    throw new AccountError({
      message: data.message ?? '暂时无法完成操作，请重试。',
      code: data.code ?? 'SERVER_ERROR',
      captchaRequired: data.captchaRequired,
      saved: data.saved,
    });
  if (
    generation !== identityGeneration ||
    (readsSession && readGeneration !== sessionReadGeneration)
  )
    throw new AccountError({
      code: 'SESSION_STALE',
      message: '账号状态已更新，请重试。',
    });
  if (changesIdentity) {
    // A session read made while this operation was in flight may have used
    // the previous cookie. It must not overwrite this successful identity.
    invalidateSessionRead();
  }
  if (data.csrfToken) csrf = data.csrfToken;
  if (data.config) config = data.config;
  if (changesIdentity) {
    try {
      localStorage.setItem(authSignal, crypto.randomUUID());
    } catch {
      /* Visibility rechecks cover browsers that disable storage. */
    }
  }
  return data;
}
export function readAccount() {
  if (pendingSession) return pendingSession;
  const request = accountRequest<AccountResponse>('/api/session');
  pendingSession = request;
  void request
    .finally(() => {
      if (pendingSession === request) pendingSession = null;
    })
    .catch(() => undefined);
  return request;
}
export type AccountChangeReason = 'storage' | 'visible';
export function watchAccountChanges(
  callback: (reason: AccountChangeReason) => void,
) {
  const storage = (event: StorageEvent) => {
    if (event.key !== authSignal) return;
    invalidateSession();
    callback('storage');
  };
  const visible = () => {
    if (document.visibilityState !== 'visible') return;
    // A different tab may have switched accounts while storage events were
    // unavailable. Never reuse a session request started before returning.
    invalidateSessionRead();
    callback('visible');
  };
  window.addEventListener('storage', storage);
  document.addEventListener('visibilitychange', visible);
  return () => {
    window.removeEventListener('storage', storage);
    document.removeEventListener('visibilitychange', visible);
  };
}
export type MetricEvent =
  | 'page_quiz'
  | 'page_types'
  | 'page_type'
  | 'page_principles'
  | 'test_start'
  | 'complete_basic'
  | 'start_extended'
  | 'complete_full'
  | 'save_intent'
  | 'share_link_copied';
export function analyticsPreference() {
  try {
    return localStorage.getItem('shadow16-analytics-choice') === 'allow';
  } catch {
    return false;
  }
}
let baiduLoaded = false;
export function setAnalyticsPreference(allowed: boolean) {
  try {
    localStorage.setItem(
      'shadow16-analytics-choice',
      allowed ? 'allow' : 'decline',
    );
  } catch {
    /* Device preferences are optional. */
  }
  if (!allowed) {
    window._hmt?.push(['_setAutoTracking', false]);
    return;
  }
  loadBaidu();
}
function loadBaidu() {
  if (
    !config?.analyticsEnabled ||
    !config.baiduSiteId ||
    !analyticsPreference()
  )
    return;
  window._hmt ??= [];
  if (baiduLoaded) {
    window._hmt.push(['_setAutoTracking', true]);
    return;
  }
  baiduLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://hm.baidu.com/hm.js?${config.baiduSiteId}`;
  document.head.appendChild(script);
}
export function trackEvent(event: MetricEvent) {
  if (!config?.analyticsEnabled || !csrf || !analyticsPreference()) return;
  void accountRequest('/api/events', { event, id: crypto.randomUUID() }).catch(
    () => undefined,
  );
  loadBaidu();
  window._hmt?.push(['_trackEvent', '16shadows', event]);
}
declare global {
  interface Window {
    _hmt?: unknown[][];
  }
}
