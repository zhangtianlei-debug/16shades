import { createHash, randomBytes } from 'node:crypto';

// The official JS-SDK file. 1.6.0 is the newest published build and is the one
// the current subscription-account documentation links to.
export const wechatSdkUrl = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
// Current share-data interfaces plus the still-documented native menu
// handlers for clients that acknowledge updates but ignore their cached card.
export const shareJsApiList = [
  'updateAppMessageShareData',
  'updateTimelineShareData',
  'onMenuShareAppMessage',
  'onMenuShareTimeline',
];
const endpoint = 'https://api.weixin.qq.com/cgi-bin';
// WeChat issues both values for 7200s. Refresh five minutes early so a request
// never spends a cached value that expires while WeChat is handling it.
const refreshMarginMs = 300000;
const maxUrlLength = 2048;
const appIdPattern = /^wx[0-9a-f]{16}$/i;

/**
 * The URL WeChat signs is the exact page address without its fragment.
 * Query parameters are part of the signature, so friend-invite tokens and
 * `?type=` / `?view=` state must be preserved verbatim.
 * Only origins listed in the running configuration can be signed, so this can
 * never become an open signing service for other sites.
 */
export function signableUrl(raw, origins) {
  if (typeof raw !== 'string') return null;
  const value = raw.split('#')[0];
  if (!value || value.length > maxUrlLength || !origins.length) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) return null;
  // Compare on origin, so scheme, host and port must all match the allow list.
  return origins.includes(parsed.origin) ? value : null;
}

export function shareSignature(ticket, nonceStr, timestamp, url) {
  return createHash('sha1')
    .update(
      `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`,
    )
    .digest('hex');
}

export class WechatError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    Object.assign(this, { code, detail });
  }
}

function nonce() {
  return randomBytes(8).toString('hex');
}

/**
 * Caches access_token and jsapi_ticket for the whole process.
 *
 * - One in-flight refresh at a time: concurrent page loads share a single
 *   upstream call instead of racing WeChat's daily quota.
 * - A failed refresh is not cached, so the next request retries.
 * - Nothing is persisted: the values are short-lived and the AppSecret stays in
 *   the server environment file.
 */
export function createWechatShare({
  appId = '',
  appSecret = '',
  origins = [],
  fetchImpl = fetch,
  now = Date.now,
  logError = console.error,
} = {}) {
  // A half-configured account is a deployment mistake; say so instead of
  // loading the SDK with a signature that can never validate.
  if (Boolean(appId) !== Boolean(appSecret))
    throw new Error(
      'SHADOW16_WECHAT_APPID and SHADOW16_WECHAT_SECRET must be set together.',
    );
  if (appId && !appIdPattern.test(appId))
    throw new Error('SHADOW16_WECHAT_APPID is not a valid official-account AppID.');
  const enabled = Boolean(appId && appSecret);
  let ticket = null;
  let pending = null;

  async function call(path, params) {
    const url = new URL(`${endpoint}${path}`);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new WechatError('UPSTREAM_UNREACHABLE', '无法连接微信接口。');
    }
    if (!response.ok)
      throw new WechatError(
        'UPSTREAM_STATUS',
        `微信接口返回 HTTP ${response.status}。`,
      );
    let data;
    try {
      data = await response.json();
    } catch {
      throw new WechatError('UPSTREAM_BODY', '微信接口返回了无法解析的内容。');
    }
    return data;
  }

  // Never log the request URL: it carries the AppSecret and the live token.
  function fail(stage, data) {
    const detail = {
      stage,
      errcode: Number(data?.errcode ?? 0),
      errmsg: typeof data?.errmsg === 'string' ? data.errmsg.slice(0, 120) : '',
    };
    logError('WeChat share credential failed:', JSON.stringify(detail));
    if (detail.errcode === 40164)
      return new WechatError(
        'IP_NOT_ALLOWED',
        '当前服务器出口 IP 不在公众号白名单内。',
        detail,
      );
    if ([40001, 40013, 40125].includes(detail.errcode))
      return new WechatError('CREDENTIAL_REJECTED', '公众号凭据被拒绝。', detail);
    return new WechatError('WECHAT_REJECTED', '微信接口暂时不可用。', detail);
  }

  function refresh() {
    if (pending) return pending;
    pending = (async () => {
      const tokenData = await call('/token', {
        grant_type: 'client_credential',
        appid: appId,
        secret: appSecret,
      });
      if (!tokenData.access_token || !Number(tokenData.expires_in))
        throw fail('token', tokenData);
      // The token is only used to fetch the ticket, so it is not cached on its
      // own: the two always expire and refresh together.
      const issued = tokenData.access_token;
      const ticketData = await call('/ticket/getticket', {
        access_token: issued,
        type: 'jsapi',
      });
      if (!ticketData.ticket || Number(ticketData.errcode) !== 0)
        throw fail('ticket', ticketData);
      ticket = {
        value: ticketData.ticket,
        expiresAt:
          now() +
          Math.max(Number(ticketData.expires_in) * 1000 - refreshMarginMs, 60000),
      };
      return ticket.value;
    })().finally(() => {
      pending = null;
    });
    return pending;
  }

  async function jsapiTicket() {
    if (ticket && ticket.expiresAt > now()) return ticket.value;
    return refresh();
  }

  return {
    enabled,
    appId: enabled ? appId : '',
    /** Drop cached values; used by tests and by a controlled manual refresh. */
    invalidate() {
      ticket = null;
    },
    /**
     * @returns {Promise<{appId: string, timestamp: number, nonceStr: string, signature: string} | null>}
     *   `null` when the requested URL is outside the allowed origins.
     */
    async sign(rawUrl) {
      const url = signableUrl(rawUrl, origins);
      if (!url) return null;
      if (!enabled)
        throw new WechatError('NOT_CONFIGURED', '尚未配置公众号网页分享。');
      const value = await jsapiTicket();
      const issuedAt = Math.floor(now() / 1000);
      const nonceStr = nonce();
      return {
        appId,
        timestamp: issuedAt,
        nonceStr,
        signature: shareSignature(value, nonceStr, issuedAt, url),
      };
    },
  };
}
