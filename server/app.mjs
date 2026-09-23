import { randomUUID, randomBytes, randomInt } from 'node:crypto';
import { createChallenge } from 'altcha-lib';
import { verify as verifyAltcha } from 'altcha-lib/frameworks/shared';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { cleanExpired, recordMetric, transaction } from './db.mjs';
import {
  ApiError,
  digest,
  keyed,
  password,
  passwordService,
  rateLimit,
  requireFields,
  safeEqual,
  token,
  username,
} from './security.mjs';
import { normalizeResult, presentation } from './result.mjs';
import { readLink, createCode, previewLink, commitLink, unlink, syncWebSaveInTransaction, syncWebDeleteInTransaction, syncMiniSaveInTransaction, syncMiniDeleteInTransaction } from './account-link.mjs';
import {
  createInvite,
  deleteInvite,
  ownerInvites,
  publicInviteByToken,
  submitResponse,
} from './friend-invites.mjs';
import {
  WechatError,
  createWechatShare,
  shareJsApiList,
  wechatSdkUrl,
} from './wechat.mjs';
import release from '../release.json' with { type: 'json' };

const DAY = 86400000;
const metrics = new Set([
  'page_quiz',
  'page_types',
  'page_type',
  'page_principles',
  'test_start',
  'complete_basic',
  'start_extended',
  'complete_full',
  'save_intent',
  'share_link_copied',
]);
const localIdentitySql = `SELECT u.id,u.display_name,c.password_hash,i.id AS identity_id FROM users u JOIN identities i ON i.user_id=u.id JOIN password_credentials c ON c.identity_id=i.id WHERE i.provider='username' AND i.issuer='' AND i.subject=?`;

export function createApi({
  db,
  secret,
  origins,
  secure = true,
  trustProxy = false,
  analyticsEnabled = false,
  baiduSiteId = '',
  miniappAuth = null,
  miniappContentSecurity = null,
  wechat = createWechatShare(),
  now = Date.now,
  captchaCounter,
}) {
  if (secret.length < 32 || !origins.length)
    throw new Error(
      'A persistent secret and explicit public origin are required.',
    );
  const passwords = passwordService();
  const cookieName = secure ? '__Host-shadow16' : 'shadow16_dev';
  const guestName = secure ? '__Host-shadow16_guest' : 'shadow16_guest_dev';
  let lastCleanup = 0;
  function cookie(res, name, value, seconds) {
    const existing = res.getHeader('Set-Cookie') ?? [];
    res.setHeader('Set-Cookie', [
      ...existing,
      `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${seconds === null ? '' : `; Max-Age=${seconds}`}${secure ? '; Secure' : ''}`,
    ]);
  }
  function getCookies(req) {
    return Object.fromEntries(
      (req.headers.cookie ?? '')
        .split(';')
        .map((entry) => entry.trim().split('='))
        .filter(([key, value]) => key && typeof value === 'string'),
    );
  }
  function publicUser(user) {
    return user ? { id: user.id, username: user.display_name } : null;
  }
  function saved(userId) {
    const row = db
      .prepare(
        'SELECT revision,summary_json,presentation_json,saved_at FROM saved_results WHERE user_id=?',
      )
      .get(userId);
    return row
      ? {
          revision: row.revision,
          result: JSON.parse(row.summary_json),
          presentation: JSON.parse(row.presentation_json),
          savedAt: new Date(row.saved_at).toISOString(),
        }
      : null;
  }
  function miniSaved(userId) {
    const row=db.prepare('SELECT result_json,completed_at FROM miniapp_results WHERE user_id=?').get(userId);
    return row ? { result:JSON.parse(row.result_json), completedAt:row.completed_at } : null;
  }
  function newSession(res, userId, remember, priorToken) {
    if (priorToken)
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(
        digest(priorToken),
      );
    const value = token();
    const age = remember ? 30 * DAY : DAY;
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(
      digest(value),
      userId,
      now(),
      now() + age,
    );
    cookie(res, cookieName, value, remember ? age / 1000 : null);
    return keyed(secret, `csrf:${value}`);
  }
  function newRecovery(userId) {
    const code = randomBytes(20)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,5}/g)
      .join('-');
    db.prepare(
      'INSERT INTO recovery_codes VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,created_at=excluded.created_at',
    ).run(userId, digest(code.replaceAll('-', '')), now());
    return code;
  }
  function assertUser(user) {
    if (!user)
      throw new ApiError(
        401,
        'SIGN_IN_REQUIRED',
        '请重新登录，再保存当前画像。',
      );
  }
  function assertVersion(body, userId) {
    const row = db
      .prepare('SELECT revision FROM saved_results WHERE user_id=?')
      .get(userId);
    if ((row?.revision ?? null) !== body.expectedRevision)
      throw new ApiError(
        409,
        'RESULT_CONFLICT',
        '已保存的画像发生了变化，请查看后再决定是否替换。',
        { saved: saved(userId) },
      );
  }
  async function bodyOf(req) {
    if (!req.headers['content-type']?.startsWith('application/json'))
      throw new ApiError(415, 'JSON_REQUIRED', '请求格式不正确。');
    if (Number(req.headers['content-length'] ?? 0) > 16384)
      throw new ApiError(413, 'TOO_LARGE', '提交内容过长。');
    const buffers = [];
    let length = 0;
    for await (const part of req) {
      length += part.length;
      if (length > 16384)
        throw new ApiError(413, 'TOO_LARGE', '提交内容过长。');
      buffers.push(part);
    }
    try {
      return JSON.parse(Buffer.concat(buffers).toString('utf8'));
    } catch {
      throw new ApiError(400, 'INVALID_JSON', '请求格式不正确。');
    }
  }

  return async function api(req, res) {
    const url = new URL(req.url, 'http://internal');
    const path = url.pathname;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );
    function json(status, value) {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(JSON.stringify(value));
    }
    try {
      if (now() - lastCleanup > 60000) {
        cleanExpired(db, now());
        lastCleanup = now();
      }
      const origin = req.headers.origin;
      const hostAllowed = origins.some(
        (value) => new URL(value).host === req.headers.host,
      );
      if (!hostAllowed || (origin && !origins.includes(origin)))
        throw new ApiError(403, 'ORIGIN_REJECTED', '请从网站页面重新打开。');
      const analyticsConsent =
        analyticsEnabled && req.headers['x-analytics-consent'] === '1';
      const peer = req.socket.remoteAddress;
      const localPeer = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer);
      const ip =
        trustProxy && localPeer && typeof req.headers['x-real-ip'] === 'string'
          ? req.headers['x-real-ip']
          : peer;
      rateLimit(db, secret, `all:${ip}`, 240, 60000, now());
      if (path === '/api/analytics-config' && req.method === 'GET') {
        const site = /^[a-f0-9]{32}$/i.test(baiduSiteId) ? baiduSiteId : '';
        json(200, {
          analyticsEnabled,
          baiduSiteId: analyticsEnabled ? site : '',
        });
        return;
      }
      if (path === '/api/health' && req.method === 'GET') {
        json(200, {
          service: 'shadow16-accounts',
          status: 'ok',
          version: release.version,
        });
        return;
      }
      // Mini-program callers use a bearer session only.  They deliberately
      // bypass website cookies, CSRF and CAPTCHA routes, but share the invite
      // domain model after authentication.
      if (path.startsWith('/api/miniapp/')) {
        if (!miniappAuth) throw new ApiError(503, 'MINIAPP_UNAVAILABLE', '小程序服务暂未配置。');
        if (path === '/api/miniapp/auth/session' && req.method === 'POST') {
          rateLimit(db, secret, `miniapp-login:${ip}`, 20, 60000, now());
          const body = await bodyOf(req); requireFields(body, ['code']);
          const logged = await miniappAuth.login(db, body.code, now());
          json(201, { token: logged.token, identity: logged.userId, expiresAt: logged.expiresAt }); return;
        }
        const publicMiniInvite = path.match(/^\/api\/miniapp\/friend-invites\/([A-Za-z0-9_-]{43})$/);
        if (publicMiniInvite && req.method === 'GET') {
          const invite=publicInviteByToken(db,publicMiniInvite[1]);
          if (!invite) throw new ApiError(404,'INVITE_NOT_FOUND','邀请已失效或不存在。');
          json(200,{invite}); return;
        }
        const publicMiniResponse = path.match(/^\/api\/miniapp\/friend-invites\/([A-Za-z0-9_-]{43})\/responses$/);
        if (publicMiniResponse && req.method === 'POST') {
          rateLimit(db,secret,`miniapp-friend-response:${ip}`,12,60000,now());
          const body=await bodyOf(req); const {reviewCode,...responseBody}=body; const nickname=typeof responseBody.nickname==='string'?responseBody.nickname.trim():''; if(nickname){ if(!miniappContentSecurity) throw new ApiError(503,'CONTENT_SECURITY_UNAVAILABLE','内容安全检查暂时不可用，请稍后再试。'); const openid=await miniappAuth.contentAuthor(db,reviewCode,now()); await miniappContentSecurity.checkText({content:nickname,openid,scene:1}); } json(201,{response:submitResponse(db,publicMiniResponse[1],responseBody,now())}); return;
        }
        const miniUser = miniappAuth.session(db, req.headers.authorization, now());
        if (!miniUser) throw new ApiError(401, 'MINIAPP_SIGN_IN_REQUIRED', '请重新登录微信后再试。');
        rateLimit(db, secret, `miniapp:${miniUser.id}`, 90, 60000, now());
        if (path === '/api/miniapp/auth/logout' && req.method === 'POST') { const body=await bodyOf(req); requireFields(body,[]); db.prepare('DELETE FROM miniapp_sessions WHERE token_hash=?').run(digest(miniUser.token)); json(200,{ok:true}); return; }
        if (path === '/api/miniapp/account' && req.method === 'DELETE') {
          const body=await bodyOf(req); requireFields(body,[]);
          transaction(db,()=>{
            // Linked accounts retain independent user rows. Guard against any
            // legacy mixed-identity row; normal deletion cascades the link
            // without deleting the separate website user or its result.
            if(db.prepare('SELECT 1 FROM identities WHERE user_id=?').get(miniUser.id)) throw new ApiError(409,'ACCOUNT_LINKED','已关联的网站账号需要在网站内删除。');
            const deleted=db.prepare('DELETE FROM users WHERE id=? AND EXISTS (SELECT 1 FROM miniapp_identities WHERE user_id=users.id)').run(miniUser.id);
            if(deleted.changes!==1) throw new ApiError(404,'MINIAPP_ACCOUNT_NOT_FOUND','该小程序账号已删除。');
          });
          json(200,{ok:true}); return;
        }
        if (path === '/api/miniapp/account/link' && req.method === 'GET') { json(200,{link:readLink(db,{miniappUserId:miniUser.id})}); return; }
        if (path === '/api/miniapp/account/link' && req.method === 'DELETE') { const body=await bodyOf(req); requireFields(body,[]); json(200,unlink(db,{miniappUserId:miniUser.id})); return; }
        if (path === '/api/miniapp/account/link/preview' && req.method === 'POST') {
          rateLimit(db,secret,`miniapp-link-preview:${miniUser.id}`,10,60000,now());
          const body=await bodyOf(req); requireFields(body,['code']); json(200,previewLink(db,miniUser.id,body.code,now())); return;
        }
        if (path === '/api/miniapp/account/link/commit' && req.method === 'POST') {
          rateLimit(db,secret,`miniapp-link-commit:${miniUser.id}`,10,60000,now());
          const body=await bodyOf(req); json(200,commitLink(db,miniUser.id,body,now())); return;
        }
        if (path === '/api/miniapp/result' && req.method === 'GET') { json(200, { result: miniSaved(miniUser.id) }); return; }
        if (path === '/api/miniapp/result' && req.method === 'DELETE') {
          const body = await bodyOf(req); requireFields(body, []);
          transaction(db,()=>{db.prepare('DELETE FROM miniapp_results WHERE user_id=?').run(miniUser.id);db.prepare('INSERT INTO miniapp_result_deletions VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET deleted_before=excluded.deleted_before').run(miniUser.id,now());syncMiniDeleteInTransaction(db,miniUser.id,now());}); json(200, { ok:true }); return;
        }
        if (path === '/api/miniapp/result' && req.method === 'PUT') {
          const body = await bodyOf(req); requireFields(body, ['result','completedAt']);
          if (!Number.isInteger(body.completedAt) || body.completedAt < 0 || body.completedAt > now() + 5 * 60000) throw new ApiError(400,'COMPLETED_AT_INVALID','请检查完成时间后再试。');
          const result = normalizeResult(body.result), match = presentation(result);
          transaction(db, () => { const deleted=db.prepare('SELECT deleted_before FROM miniapp_result_deletions WHERE user_id=?').get(miniUser.id); if (deleted && body.completedAt<=deleted.deleted_before) return; const old=miniSaved(miniUser.id); if (!old || body.completedAt > old.completedAt) { db.prepare('INSERT INTO miniapp_results VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET result_json=excluded.result_json,presentation_json=excluded.presentation_json,completed_at=excluded.completed_at,saved_at=excluded.saved_at').run(miniUser.id,JSON.stringify(result),JSON.stringify(match),body.completedAt,now()); syncMiniSaveInTransaction(db,miniUser.id,now()); } });
          json(200, { result: miniSaved(miniUser.id) }); return;
        }
        if (path === '/api/miniapp/friend-invites' && req.method === 'GET') { json(200, { invites: ownerInvites(db, miniUser.id) }); return; }
        if (path === '/api/miniapp/friend-invites' && req.method === 'POST') { rateLimit(db, secret, `miniapp-friend-create:${miniUser.id}`, 20, 60000, now()); const body=await bodyOf(req); const {reviewCode,...inviteBody}=body; if(!miniappContentSecurity) throw new ApiError(503,'CONTENT_SECURITY_UNAVAILABLE','内容安全检查暂时不可用，请稍后再试。'); const openid=await miniappAuth.ownerContentAuthor(db,miniUser.id,reviewCode,now()); await miniappContentSecurity.checkText({content:inviteBody.subjectName,openid,scene:1}); json(201, { invite:createInvite(db,miniUser.id,inviteBody,now()) }); return; }
        if (publicMiniInvite && req.method === 'DELETE') { const body=await bodyOf(req); requireFields(body,[]); deleteInvite(db,miniUser.id,publicMiniInvite[1]); json(200,{ok:true}); return; }
        throw new ApiError(404, 'NOT_FOUND', '未找到此内容。');
      }
      // WeChat share signature for the exact page the visitor is on. Signing is
      // limited to configured origins inside the share module, so this endpoint
      // cannot be used to sign links for other sites.
      if (path === '/api/wechat/jssdk' && req.method === 'GET') {
        if (!wechat.enabled) {
          json(200, { enabled: false });
          return;
        }
        rateLimit(db, secret, `wechat-sign:${ip}`, 180, 60000, now());
        let signed;
        try {
          signed = await wechat.sign(url.searchParams.get('url') ?? '');
        } catch (error) {
          if (error instanceof WechatError)
            throw new ApiError(
              503,
              'WECHAT_UNAVAILABLE',
              '微信分享暂时不可用，稍后重试即可。',
            );
          throw error;
        }
        if (!signed)
          throw new ApiError(
            400,
            'SHARE_URL_REJECTED',
            '请从网站页面重新打开。',
          );
        json(200, {
          enabled: true,
          sdkUrl: wechatSdkUrl,
          jsApiList: shareJsApiList,
          ...signed,
        });
        return;
      }
      const cookies = getCookies(req);
      const rawSession = cookies[cookieName];
      const session =
        rawSession && /^[A-Za-z0-9_-]{43}$/.test(rawSession)
          ? db
              .prepare(
                'SELECT u.id,u.display_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
              )
              .get(digest(rawSession), now())
          : null;
      let guest = cookies[guestName];
      if (!guest || !/^[A-Za-z0-9_-]{43}$/.test(guest)) {
        guest = token();
        cookie(res, guestName, guest, DAY / 1000);
      }
      const binding = session ? rawSession : guest;
      const csrfToken = keyed(secret, `csrf:${binding}`);
      if (path === '/api/session' && req.method === 'GET') {
        json(200, {
          user: publicUser(session),
          saved: session ? saved(session.id) : null,
          csrfToken,
          config: {
            analyticsEnabled: analyticsEnabled && Boolean(baiduSiteId),
            baiduSiteId: analyticsEnabled ? baiduSiteId : '',
            version: release.version,
          },
        });
        return;
      }
      async function captcha(payload, action) {
        if (typeof payload !== 'string' || payload.length > 6000)
          throw new ApiError(400, 'CAPTCHA_REQUIRED', '请先完成安全验证。');
        const hmac = keyed(secret, `captcha:${action}:${binding}`);
        const checked = await verifyAltcha(
          payload,
          deriveKey,
          hmac,
          keyed(hmac, 'key'),
        );
        if (
          !checked.verification?.verified ||
          !checked.payload?.challenge ||
          !checked.payload.challenge.parameters.expiresAt
        )
          throw new ApiError(
            400,
            'CAPTCHA_REQUIRED',
            '安全验证已失效，请重新验证。',
          );
        const challenge = checked.payload.challenge;
        const inserted = db
          .prepare('INSERT OR IGNORE INTO captcha_uses VALUES (?,?)')
          .run(
            digest(challenge.signature),
            challenge.parameters.expiresAt * 1000,
          );
        if (inserted.changes !== 1)
          throw new ApiError(400, 'CAPTCHA_REQUIRED', '请重新完成安全验证。');
      }
      if (path === '/api/captcha' && req.method === 'GET') {
        const action = url.searchParams.get('action');
        if (!['register', 'login', 'recover'].includes(action))
          throw new ApiError(400, 'INVALID_ACTION', '请重新打开验证。');
        rateLimit(db, secret, `challenge:${ip}`, 30, 60000, now());
        const hmac = keyed(secret, `captcha:${action}:${binding}`);
        const challenge = await createChallenge({
          algorithm: 'PBKDF2/SHA-256',
          cost: 1000,
          counter: captchaCounter ?? randomInt(600, 1400),
          deriveKey,
          hmacSignatureSecret: hmac,
          hmacKeySignatureSecret: keyed(hmac, 'key'),
          expiresAt: new Date(now() + 300000),
        });
        json(200, challenge);
        return;
      }
      if (path === '/api/account/link' && req.method === 'GET') { assertUser(session); json(200,{link:readLink(db,{webUserId:session.id})}); return; }
      if (path === '/api/friend-invites' && req.method === 'GET') {
        assertUser(session);
        rateLimit(db, secret, `friend-owner:${session.id}`, 60, 60000, now());
        json(200, { invites: ownerInvites(db, session.id) });
        return;
      }
      const publicInviteMatch = path.match(/^\/api\/friend-invites\/([A-Za-z0-9_-]{43})$/);
      if (publicInviteMatch && req.method === 'GET') {
        const invite = publicInviteByToken(db, publicInviteMatch[1]);
        if (!invite) throw new ApiError(404, 'INVITE_NOT_FOUND', '邀请已失效或不存在。');
        json(200, { invite });
        return;
      }
      if (req.method === 'GET')
        throw new ApiError(404, 'NOT_FOUND', '未找到此内容。');
      if (
        !origin ||
        !origins.includes(origin) ||
        !safeEqual(req.headers['x-csrf-token'], csrfToken)
      )
        throw new ApiError(403, 'CSRF_EXPIRED', '页面状态已更新，请重试。');
      const body = await bodyOf(req);
      if (
        (path.startsWith('/api/auth/') && path !== '/api/auth/logout') ||
        path === '/api/account'
      )
        rateLimit(db, secret, `password-work:${ip}`, 12, 60000, now());
      const identity = (name) => db.prepare(localIdentitySql).get(name);
      const failLogin = () => {
        throw new ApiError(401, 'INVALID_CREDENTIALS', '用户名或密码不正确。');
      };

      if (path === '/api/auth/register' && req.method === 'POST') {
        requireFields(
          body,
          [
            'username',
            'password',
            'passwordConfirm',
            'captcha',
            'remember',
            'acceptPrivacy',
          ],
          ['username', 'password', 'captcha', 'remember', 'acceptPrivacy'],
        );
        const name = username(body.username);
        password(body.password, body.passwordConfirm, name);
        if (typeof body.remember !== 'boolean' || body.acceptPrivacy !== true)
          throw new ApiError(
            400,
            'PRIVACY_REQUIRED',
            '请阅读并同意账号与数据说明。',
          );
        rateLimit(db, secret, `register:${ip}`, 5, 15 * 60000, now());
        rateLimit(db, secret, `register-name:${name}`, 5, 15 * 60000, now());
        await captcha(body.captcha, 'register');
        const hashed = await passwords.hash(body.password);
        if (identity(name))
          throw new ApiError(
            409,
            'USERNAME_UNAVAILABLE',
            '这个用户名暂不可用，请换一个。',
          );
        const userId = randomUUID(),
          identityId = randomUUID();
        const recoveryCode = transaction(db, () => {
          db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
            userId,
            name,
            now(),
            now(),
          );
          db.prepare(
            "INSERT INTO identities VALUES (?,?,?,'',?,?,NULL,?,?)",
          ).run(identityId, userId, 'username', name, name, now(), now());
          db.prepare('INSERT INTO password_credentials VALUES (?,?,?)').run(
            identityId,
            hashed,
            now(),
          );
          const code = newRecovery(userId);
          if (analyticsConsent) recordMetric(db, 'register_success', now());
          return code;
        });
        const csrf = newSession(res, userId, body.remember, rawSession);
        json(201, {
          user: { id: userId, username: name },
          saved: null,
          csrfToken: csrf,
          recoveryCode,
        });
        return;
      }
      if (path === '/api/auth/login' && req.method === 'POST') {
        requireFields(
          body,
          ['username', 'password', 'remember', 'captcha'],
          ['username', 'password', 'remember'],
        );
        const name = username(body.username);
        if (
          typeof body.password !== 'string' ||
          typeof body.remember !== 'boolean'
        )
          failLogin();
        rateLimit(db, secret, `login-ip:${ip}`, 30, 15 * 60000, now());
        rateLimit(db, secret, `login-account:${name}`, 10, 15 * 60000, now());
        const failures = db
          .prepare('SELECT count,expires_at FROM rate_limits WHERE bucket=?')
          .get(keyed(secret, `login-failed:${name}`));
        if (failures && failures.expires_at > now() && failures.count >= 3)
          await captcha(body.captcha, 'login');
        const user = identity(name);
        if (!(await passwords.verify(body.password, user?.password_hash))) {
          rateLimit(db, secret, `login-failed:${name}`, 100, 15 * 60000, now());
          throw new ApiError(
            401,
            'INVALID_CREDENTIALS',
            '用户名或密码不正确。',
            { captchaRequired: (failures?.count ?? 0) + 1 >= 3 },
          );
        }
        // Recheck after async hashing: a concurrent reset/delete must win.
        if (identity(name)?.password_hash !== user.password_hash) failLogin();
        db.prepare('DELETE FROM rate_limits WHERE bucket=?').run(
          keyed(secret, `login-failed:${name}`),
        );
        db.prepare('UPDATE identities SET last_used_at=? WHERE id=?').run(
          now(),
          user.identity_id,
        );
        const csrf = newSession(res, user.id, body.remember, rawSession);
        if (analyticsConsent) recordMetric(db, 'login_success', now());
        json(200, {
          user: publicUser(user),
          saved: saved(user.id),
          csrfToken: csrf,
        });
        return;
      }
      if (path === '/api/auth/recover' && req.method === 'POST') {
        requireFields(
          body,
          [
            'username',
            'recoveryCode',
            'password',
            'passwordConfirm',
            'captcha',
          ],
          ['username', 'recoveryCode', 'password', 'captcha'],
        );
        const name = username(body.username);
        password(body.password, body.passwordConfirm, name);
        rateLimit(db, secret, `recover-ip:${ip}`, 10, 15 * 60000, now());
        rateLimit(db, secret, `recover-name:${name}`, 5, 15 * 60000, now());
        await captcha(body.captcha, 'recover');
        const user = identity(name);
        const normalized =
          typeof body.recoveryCode === 'string'
            ? body.recoveryCode
                .replaceAll('-', '')
                .replaceAll(' ', '')
                .toUpperCase()
            : '';
        const recovery = user
          ? db
              .prepare('SELECT code_hash FROM recovery_codes WHERE user_id=?')
              .get(user.id)
          : null;
        // Hash before the generic credential response to avoid a cheap user probe.
        const hashed = await passwords.hash(body.password);
        if (!recovery || !safeEqual(digest(normalized), recovery.code_hash))
          throw new ApiError(401, 'RECOVERY_INVALID', '用户名或恢复码不正确。');
        const recoveryCode = transaction(db, () => {
          const consumed = db
            .prepare(
              'DELETE FROM recovery_codes WHERE user_id=? AND code_hash=?',
            )
            .run(user.id, recovery.code_hash);
          if (consumed.changes !== 1)
            throw new ApiError(
              401,
              'RECOVERY_INVALID',
              '用户名或恢复码不正确。',
            );
          db.prepare(
            'UPDATE password_credentials SET password_hash=?,changed_at=? WHERE identity_id=?',
          ).run(hashed, now(), user.identity_id);
          db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
          db.prepare('DELETE FROM rate_limits WHERE bucket=? OR bucket=?').run(
            keyed(secret, `login-failed:${name}`),
            keyed(secret, `login-account:${name}`),
          );
          return newRecovery(user.id);
        });
        cookie(res, cookieName, '', 0);
        json(200, { recoveryCode, csrfToken: keyed(secret, `csrf:${guest}`) });
        return;
      }
      if (path === '/api/events' && req.method === 'POST') {
        requireFields(body, ['event', 'id']);
        if (
          !metrics.has(body.event) ||
          typeof body.id !== 'string' ||
          !/^[a-f0-9-]{36}$/i.test(body.id)
        )
          throw new ApiError(400, 'INVALID_EVENT', '事件格式不正确。');
        if (analyticsConsent) {
          rateLimit(db, secret, `event:${ip}`, 90, 60000, now());
          transaction(db, () => {
            if (
              db
                .prepare('INSERT OR IGNORE INTO metric_receipts VALUES (?,?)')
                .run(body.id, now() + DAY).changes
            )
              recordMetric(db, body.event, now());
          });
        }
        json(200, { ok: true });
        return;
      }
      const responseMatch = path.match(/^\/api\/friend-invites\/([A-Za-z0-9_-]{43})\/responses$/);
      if (responseMatch && req.method === 'POST') {
        rateLimit(db, secret, `friend-response:${ip}`, 12, 60000, now());
        json(201, { response: submitResponse(db, responseMatch[1], body, now()) });
        return;
      }
      assertUser(session);
      if (
        !db
          .prepare(
            'SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>?',
          )
          .get(digest(rawSession), now())
      )
        throw new ApiError(
          401,
          'SIGN_IN_REQUIRED',
          '账号状态已更新，请重新登录。',
        );
      rateLimit(db, secret, `account:${session.id}`, 60, 60000, now());
      if (path === '/api/account/link/code' && req.method === 'POST') { requireFields(body,[]); rateLimit(db,secret,`web-link-code:${session.id}`,6,60000,now()); json(201,createCode(db,session.id,now())); return; }
      if (path === '/api/account/link' && req.method === 'DELETE') { requireFields(body,[]); json(200,unlink(db,{webUserId:session.id})); return; }
      if (path === '/api/friend-invites' && req.method === 'POST') {
        rateLimit(db, secret, `friend-create:${session.id}`, 20, 60000, now());
        json(201, { invite: createInvite(db, session.id, body, now()) });
        return;
      }
      const ownerInviteMatch = path.match(/^\/api\/friend-invites\/([A-Za-z0-9_-]{43})$/);
      if (ownerInviteMatch && req.method === 'DELETE') {
        requireFields(body, []);
        deleteInvite(db, session.id, ownerInviteMatch[1]);
        json(200, { ok: true });
        return;
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        requireFields(body, []);
        db.prepare('DELETE FROM sessions WHERE token_hash=?').run(
          digest(rawSession),
        );
        cookie(res, cookieName, '', 0);
        json(200, { ok: true, csrfToken: keyed(secret, `csrf:${guest}`) });
        return;
      }
      if (path === '/api/results/latest' && req.method === 'PUT') {
        requireFields(body, ['result', 'expectedRevision']);
        const result = normalizeResult(body.result),
          match = presentation(result);
        transaction(db, () => {
          assertVersion(body, session.id);
          db.prepare(
            `INSERT INTO saved_results VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,result_schema=excluded.result_schema,framework_version=excluded.framework_version,scoring_version=excluded.scoring_version,item_bank_version=excluded.item_bank_version,reference_test_version=excluded.reference_test_version,form_id=excluded.form_id,bank_digest=excluded.bank_digest,role_match_version=excluded.role_match_version,stage=excluded.stage,summary_json=excluded.summary_json,presentation_json=excluded.presentation_json,saved_at=excluded.saved_at`,
          ).run(
            session.id,
            randomUUID(),
            result.schema,
            result.versions.framework_version,
            result.versions.scoring_version,
            result.versions.item_bank_version,
            result.versions.reference_test_version,
            result.formId,
            result.bankDigest,
            match.version,
            result.stage,
            JSON.stringify(result),
            JSON.stringify(match),
            now(),
          );
          syncWebSaveInTransaction(db,session.id,now());
          if (analyticsConsent) recordMetric(db, 'save_success', now());
        });
        json(200, { saved: saved(session.id) });
        return;
      }
      if (path === '/api/results/latest' && req.method === 'DELETE') {
        requireFields(body, ['expectedRevision']);
        transaction(db, () => {
          assertVersion(body, session.id);
          db.prepare('DELETE FROM saved_results WHERE user_id=?').run(
            session.id,
          );
          syncWebDeleteInTransaction(db,session.id,now());
        });
        json(200, { ok: true });
        return;
      }
      if (
        [
          '/api/auth/password',
          '/api/auth/recovery-code',
          '/api/account',
        ].includes(path) &&
        req.method === 'POST'
      ) {
        const changing = path === '/api/auth/password';
        requireFields(
          body,
          changing
            ? ['currentPassword', 'password', 'passwordConfirm']
            : ['currentPassword'],
          changing ? ['currentPassword', 'password'] : ['currentPassword'],
        );
        rateLimit(db, secret, `sensitive:${session.id}`, 5, 15 * 60000, now());
        const user = identity(session.display_name);
        if (
          !(await passwords.verify(body.currentPassword, user?.password_hash))
        )
          throw new ApiError(401, 'PASSWORD_INCORRECT', '当前密码不正确。');
        let hashed;
        if (changing) {
          password(body.password, body.passwordConfirm, session.display_name);
          hashed = await passwords.hash(body.password);
        }
        // The authenticated session and old credential must still exist after awaits.
        const stillValid = db
          .prepare(
            'SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>?',
          )
          .get(digest(rawSession), now());
        if (
          !stillValid ||
          identity(session.display_name)?.password_hash !== user.password_hash
        )
          throw new ApiError(
            401,
            'SIGN_IN_REQUIRED',
            '账号状态已更新，请重新登录。',
          );
        if (path === '/api/account') {
          transaction(db, () =>
            db.prepare('DELETE FROM users WHERE id=?').run(session.id),
          );
          cookie(res, cookieName, '', 0);
          json(200, { ok: true, csrfToken: keyed(secret, `csrf:${guest}`) });
          return;
        }
        const recoveryCode = transaction(db, () => {
          if (changing)
            db.prepare(
              'UPDATE password_credentials SET password_hash=?,changed_at=? WHERE identity_id=?',
            ).run(hashed, now(), user.identity_id);
          db.prepare('DELETE FROM sessions WHERE user_id=?').run(session.id);
          return newRecovery(session.id);
        });
        const csrf = newSession(res, session.id, false, rawSession);
        json(200, { ok: true, recoveryCode, csrfToken: csrf });
        return;
      }
      throw new ApiError(404, 'NOT_FOUND', '未找到此内容。');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.extra.retryAfter)
          res.setHeader('Retry-After', String(error.extra.retryAfter));
        json(error.status, {
          code: error.code,
          message: error.message,
          ...error.extra,
        });
      } else {
        // Never log request bodies, cookies, credentials, answer data or SQL values.
        console.error(
          'Account request failed:',
          error?.code ?? error?.name ?? 'unknown',
        );
        json(500, {
          code: 'SERVER_ERROR',
          message: '暂时无法完成操作，请稍后重试。',
        });
      }
    }
  };
}
