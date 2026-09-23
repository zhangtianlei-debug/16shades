import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './db.mjs';
import { createApi } from './app.mjs';
import { createWechatShare } from './wechat.mjs';
import { createMiniappAuth } from './miniapp-auth.mjs';
import { createMiniappContentSecurity } from './miniapp-content-security.mjs';
import { token } from './security.mjs';

export function accountRuntime({ development = false } = {}) {
  const publicOrigin = process.env.SHADOW16_ORIGIN;
  if (
    !development &&
    (!publicOrigin || new URL(publicOrigin).protocol !== 'https:')
  )
    throw new Error('SHADOW16_ORIGIN must be the exact public HTTPS origin.');
  let secret = process.env.SHADOW16_SECRET;
  if (!secret && development) {
    const file = resolve('var/development-secret');
    mkdirSync(resolve('var'), { recursive: true, mode: 0o700 });
    if (!existsSync(file))
      writeFileSync(file, token(), { flag: 'wx', mode: 0o600 });
    secret = readFileSync(file, 'utf8').trim();
  }
  if (!secret || secret.length < 32)
    throw new Error(
      'Set a persistent SHADOW16_SECRET with at least 32 random characters.',
    );
  const baiduSiteId = process.env.SHADOW16_BAIDU_SITE_ID ?? '';
  if (baiduSiteId && !/^[a-f0-9]{32}$/.test(baiduSiteId))
    throw new Error('Invalid Baidu site ID.');
  const previewPort = Number(process.env.PORT ?? 3106);
  if (!Number.isInteger(previewPort) || previewPort <= 0)
    throw new Error('PORT must be a positive port number.');
  const db = openDatabase(
    process.env.SHADOW16_DATABASE ?? resolve('var/accounts.sqlite'),
  );
  const origins = development
    ? // Follow PORT so a second local acceptance server can run beside the
      // default preview instead of competing for port 3106.
      [`http://localhost:${previewPort}`, `http://127.0.0.1:${previewPort}`]
    : [new URL(publicOrigin).origin];
  // The official-account AppID/AppSecret live only in the server environment
  // file. A typo disables the share card rather than taking the site down.
  let wechat;
  try {
    wechat = createWechatShare({
      appId: process.env.SHADOW16_WECHAT_APPID ?? '',
      appSecret: process.env.SHADOW16_WECHAT_SECRET ?? '',
      origins,
    });
  } catch (error) {
    console.error(
      'WeChat web share stays disabled:',
      error instanceof Error ? error.message : 'invalid configuration',
    );
    wechat = createWechatShare({ origins });
  }
  const api = createApi({
    db,
    secret,
    secure: !development,
    trustProxy: !development,
    origins,
    wechat,
    analyticsEnabled: !development && process.env.SHADOW16_ANALYTICS === 'true',
    baiduSiteId,
    miniappAuth: createMiniappAuth({ appId: process.env.MINIAPP_WECHAT_APP_ID ?? '', appSecret: process.env.MINIAPP_WECHAT_APP_SECRET ?? '', sessionSecret: process.env.MINIAPP_SESSION_SECRET ?? secret }),
    miniappContentSecurity: createMiniappContentSecurity({ appId: process.env.MINIAPP_WECHAT_APP_ID ?? '', appSecret: process.env.MINIAPP_WECHAT_APP_SECRET ?? '' }),
  });
  return { db, api, wechat };
}
