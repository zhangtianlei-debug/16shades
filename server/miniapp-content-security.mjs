import { ApiError } from './security.mjs';

const CODE = /^[A-Za-z0-9_-]{6,2048}$/;
const OPENID = /^[A-Za-z0-9_-]{1,128}$/;
const TEXT_LIMIT = 500;

// This module deliberately keeps WeChat credentials, access tokens and author
// OpenIDs in process memory only.  Callers never receive those values.
export function createMiniappContentSecurity({ appId = '', appSecret = '', fetchImpl = fetch, now = Date.now } = {}) {
  const configured = Boolean(appId && appSecret);
  let cached = null;
  let tokenFlight = null;

  const unavailable = () => new ApiError(503, 'CONTENT_SECURITY_UNAVAILABLE', '内容安全检查暂时不可用，请稍后再试。');
  const invalid = () => new ApiError(400, 'CONTENT_TEXT_INVALID', '请检查填写内容后再试。');
  const rejected = () => new ApiError(422, 'CONTENT_REJECTED', '这段文字暂时无法提交，请修改后再试。');

  async function json(url, init) {
    let response;
    try { response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(8000) }); }
    catch (_) { throw unavailable(); }
    if (!response.ok) throw unavailable();
    try { return await response.json(); } catch (_) { throw unavailable(); }
  }
  async function accessToken() {
    if (!configured) throw unavailable();
    if (cached && cached.expiresAt > now()) return cached.value;
    if (tokenFlight) return tokenFlight;
    const flight = (async () => {
      const value = await json('https://api.weixin.qq.com/cgi-bin/stable_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // false lets WeChat reuse a valid token held by another process.
        body: JSON.stringify({ grant_type: 'client_credential', appid: appId, secret: appSecret, force_refresh: false }),
      });
      if (!value || typeof value.access_token !== 'string' || !Number.isFinite(value.expires_in)) throw unavailable();
      // Refresh early so a token cannot expire during the following check.
      cached = { value: value.access_token, expiresAt: now() + Math.max(0, value.expires_in * 1000 - 300000) };
      return cached.value;
    })();
    tokenFlight = flight;
    try { return await flight; } finally { if (tokenFlight === flight) tokenFlight = null; }
  }
  async function call(content, openid, scene, retried = false) {
    const access = await accessToken();
    const url = new URL('https://api.weixin.qq.com/wxa/msg_sec_check');
    url.searchParams.set('access_token', access);
    const result = await json(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 2, scene, content, openid }) });
    if (result && result.errcode === 0 && result.result && result.result.suggest === 'pass') return;
    // Invalid/expired access tokens are safe to refresh once. Never expose a
    // provider error because it can contain provider implementation detail.
    if (!retried && result && [40001, 40014, 42001].includes(result.errcode)) { cached = null; return call(content, openid, scene, true); }
    if (result && (result.errcode === 0 || [87014, 87017].includes(result.errcode))) throw rejected();
    throw unavailable();
  }
  async function checkText({ content, openid, scene = 2 }) {
    if (typeof content !== 'string' || !content.trim() || Array.from(content).length > TEXT_LIMIT) throw invalid();
    if (!Number.isInteger(scene) || scene < 1 || scene > 4) throw invalid();
    if (typeof openid !== 'string' || !OPENID.test(openid)) throw new ApiError(401, 'CONTENT_AUTHOR_REQUIRED', '请使用微信完成本次内容安全检查。');
    await call(content, openid, scene);
  }
  return { configured: () => configured, checkText };
}

export const contentCode = (code) => typeof code === 'string' && CODE.test(code);
