import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './db.mjs';
import { createApi } from './app.mjs';
import { createWechatShare, shareSignature } from './wechat.mjs';

const secret = 'wechat-share-test-secret-at-least-32-characters';
const appId = 'wx87dbd8ab5c8f476a';
const appSecret = 's'.repeat(32);
const jsapiTicket = 'ticket-under-test';

function wechatFor(origin) {
  return createWechatShare({
    appId,
    appSecret,
    origins: [origin],
    fetchImpl: async (url) =>
      new URL(url).pathname === '/cgi-bin/token'
        ? { ok: true, json: async () => ({ access_token: 'token', expires_in: 7200 }) }
        : { ok: true, json: async () => ({ errcode: 0, ticket: jsapiTicket, expires_in: 7200 }) },
  });
}

async function requestApi(t, { options = {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'shadow16-wechat-'));
  const db = openDatabase(join(directory, 'accounts.sqlite'));
  let origin;
  let instance = null;
  // The origin is only known after listen(), so the share instance is built on
  // first use rather than up front.
  const lazy = {
    get enabled() {
      instance ??= options.wechat ? options.wechat(origin) : createWechatShare();
      return instance.enabled;
    },
    sign(url) {
      instance ??= options.wechat ? options.wechat(origin) : createWechatShare();
      return instance.sign(url);
    },
  };
  const server = createServer((req, res) =>
    void createApi({ db, secret, origins: [origin], wechat: lazy })(req, res),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const entry = `${origin}/prototype`;
  const response = await fetch(
    `${origin}/api/wechat/jssdk?url=${encodeURIComponent(entry)}`,
  );
  return { response, origin };
}

test('an unconfigured deployment reports sharing as unavailable', async (t) => {
  const { response } = await requestApi(t);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: false });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('a configured deployment returns a signature for the exact page URL', async (t) => {
  const { response, origin } = await requestApi(t, { options: { wechat: wechatFor } });
  const page = `${origin}/prototype/types/t03`;
  const signed = await fetch(`${origin}/api/wechat/jssdk?url=${encodeURIComponent(page)}`);
  const data = await signed.json();
  assert.equal(signed.status, 200, JSON.stringify(data));
  assert.equal(data.enabled, true);
  assert.equal(data.appId, appId);
  assert.deepEqual(data.jsApiList, ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareAppMessage', 'onMenuShareTimeline']);
  assert.match(data.sdkUrl, /^https:\/\/res\.wx\.qq\.com\/open\/js\/jweixin-1\.6\.0\.js$/);
  assert.match(data.signature, /^[a-f0-9]{40}$/);
  // The signature must cover the requested page, hashed exactly as WeChat does.
  assert.equal(
    data.signature,
    shareSignature(jsapiTicket, data.nonceStr, data.timestamp, page),
  );
  assert.equal(response.status, 200);
});

test('the fragment is dropped and the page query is preserved for signing', async (t) => {
  const { origin } = await requestApi(t, { options: { wechat: wechatFor } });
  const token = 'A'.repeat(43);
  const page = `${origin}/friends?invite=${token}`;
  const signed = await fetch(
    `${origin}/api/wechat/jssdk?url=${encodeURIComponent(`${page}#counter`)}`,
  );
  const data = await signed.json();
  assert.equal(signed.status, 200);
  assert.equal(
    data.signature,
    shareSignature(jsapiTicket, data.nonceStr, data.timestamp, page),
  );
});

test('only the site origin can be signed', async (t) => {
  const { origin } = await requestApi(t, { options: { wechat: wechatFor } });
  for (const rejected of [
    'https://evil.example/prototype',
    'https://shades16.com/prototype',
    '',
  ]) {
    const signed = await fetch(
      `${origin}/api/wechat/jssdk?url=${encodeURIComponent(rejected)}`,
    );
    assert.equal(signed.status, 400, rejected);
    assert.equal((await signed.json()).code, 'SHARE_URL_REJECTED');
  }
});

test('an upstream WeChat failure is reported as temporarily unavailable', async (t) => {
  const { origin } = await requestApi(t, {
    options: {
      wechat: (target) =>
        createWechatShare({
          appId,
          appSecret,
          origins: [target],
          fetchImpl: async () => ({
            ok: true,
            json: async () => ({ errcode: 40164, errmsg: 'invalid ip, not in whitelist' }),
          }),
        }),
    },
  });
  const signed = await fetch(
    `${origin}/api/wechat/jssdk?url=${encodeURIComponent(`${origin}/prototype`)}`,
  );
  assert.equal(signed.status, 503);
  const data = await signed.json();
  assert.equal(data.code, 'WECHAT_UNAVAILABLE');
  // The rejected IP is a server-side problem; the public message stays generic.
  assert.equal(JSON.stringify(data).includes('whitelist'), false);
});
