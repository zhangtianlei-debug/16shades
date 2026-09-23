import { randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { ApiError, digest, token } from './security.mjs';

const DAY = 86400000;
export function createMiniappAuth({ appId = '', appSecret = '', sessionSecret = '', exchangeCode } = {}) {
  const configured = Boolean(appId && appSecret && sessionSecret);
  async function officialExchange(code) {
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({ appid: appId, secret: appSecret, js_code: code, grant_type: 'authorization_code' });
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new ApiError(503, 'WECHAT_UNAVAILABLE', '微信登录暂时不可用，请稍后重试。');
    const data = await response.json();
    if (!data || typeof data.openid !== 'string' || data.openid.length > 128) throw new ApiError(401, 'WECHAT_LOGIN_FAILED', '微信登录未完成，请重新进入。');
    return data.openid;
  }
  async function openidForCode(db, code, now = Date.now()) {
    if (!configured && !exchangeCode) throw new ApiError(503, 'WECHAT_LOGIN_UNAVAILABLE', '微信登录暂未配置。');
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{6,2048}$/.test(code)) throw new ApiError(400, 'WECHAT_CODE_INVALID', '微信登录信息无效，请重新进入。');
    const codeHash = digest(code);
    if (!db.prepare('INSERT OR IGNORE INTO miniapp_login_codes VALUES (?,?)').run(codeHash, now + 5 * 60000).changes)
      throw new ApiError(409, 'WECHAT_CODE_REPLAYED', '登录信息已使用，请重新进入。');
    let openid;
    try { openid = await (exchangeCode ? exchangeCode(code) : officialExchange(code)); }
    catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(503, 'WECHAT_UNAVAILABLE', '微信登录暂时不可用，请稍后重试。'); }
    if (typeof openid !== 'string' || !openid || openid.length > 128) throw new ApiError(401, 'WECHAT_LOGIN_FAILED', '微信登录未完成，请重新进入。');
    return openid;
  }
  async function login(db, code, now = Date.now()) {
    const openid = await openidForCode(db, code, now);
    const identity = digest(`miniapp-openid:${sessionSecret}:${openid}`);
    const row = transaction(db, () => {
      let existing = db.prepare('SELECT user_id FROM miniapp_identities WHERE openid_hash=?').get(identity);
      if (!existing) {
        const userId = randomUUID();
        db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(userId, '微信用户', now, now);
        db.prepare('INSERT INTO miniapp_identities VALUES (?,?,?,?)').run(identity, userId, now, now);
        existing = { user_id: userId };
      }
      db.prepare('UPDATE miniapp_identities SET last_used_at=? WHERE openid_hash=?').run(now, identity);
      return existing;
    });
    const value = token();
    db.prepare('INSERT INTO miniapp_sessions VALUES (?,?,?,?)').run(digest(value), row.user_id, now, now + 30 * DAY);
    return { token: value, userId: row.user_id, expiresAt: new Date(now + 30 * DAY).toISOString() };
  }
  function session(db, authorization, now = Date.now()) {
    const value = typeof authorization === 'string' && authorization.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!value) return null;
    const row = db.prepare('SELECT s.user_id,u.display_name FROM miniapp_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(value), now);
    return row ? { id: row.user_id, username: row.display_name, token: value } : null;
  }
  async function contentAuthor(db, code, now = Date.now()) { return openidForCode(db, code, now); }
  async function ownerContentAuthor(db, userId, code, now = Date.now()) {
    const openid = await openidForCode(db, code, now);
    const identity = digest(`miniapp-openid:${sessionSecret}:${openid}`);
    if (!db.prepare('SELECT 1 FROM miniapp_identities WHERE user_id=? AND openid_hash=?').get(userId, identity))
      throw new ApiError(403, 'WECHAT_AUTHOR_MISMATCH', '请使用当前小程序账号完成内容安全检查。');
    return openid;
  }
  return { login, session, contentAuthor, ownerContentAuthor, configured: () => configured || Boolean(exchangeCode) };
}
