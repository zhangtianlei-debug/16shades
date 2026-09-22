import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './db.mjs';
import { createApi } from './app.mjs';
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
  const db = openDatabase(
    process.env.SHADOW16_DATABASE ?? resolve('var/accounts.sqlite'),
  );
  const api = createApi({
    db,
    secret,
    secure: !development,
    trustProxy: !development,
    origins: development
      ? ['http://localhost:3106', 'http://127.0.0.1:3106']
      : [new URL(publicOrigin).origin],
    analyticsEnabled: !development && process.env.SHADOW16_ANALYTICS === 'true',
    baiduSiteId,
  });
  return { db, api };
}
