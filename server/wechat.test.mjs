import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  WechatError,
  createWechatShare,
  shareSignature,
  signableUrl,
} from './wechat.mjs';

const appId = 'wx87dbd8ab5c8f476a';
const appSecret = 's'.repeat(32);
const origins = ['https://shades16.com'];

function credentials(overrides = {}) {
  let tokenCalls = 0;
  let ticketCalls = 0;
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    const body =
      path === '/cgi-bin/token'
        ? { access_token: `token-${++tokenCalls}`, expires_in: 7200 }
        : { errcode: 0, errmsg: 'ok', ticket: `ticket-${++ticketCalls}`, expires_in: 7200 };
    return { ok: true, json: async () => (overrides[path] ?? body) };
  };
  return {
    share: createWechatShare({ appId, appSecret, origins, fetchImpl, ...overrides.options }),
    calls: () => ({ token: tokenCalls, ticket: ticketCalls }),
  };
}

test('signableUrl keeps query, drops fragment, and stays on allowed origins', () => {
  assert.equal(
    signableUrl('https://shades16.com/prototype?view=types&type=t03#section', origins),
    'https://shades16.com/prototype?view=types&type=t03',
  );
  assert.equal(
    signableUrl('https://shades16.com/friends?invite=abc#top', origins),
    'https://shades16.com/friends?invite=abc',
  );
  // A friend-invite token is a query string, so it must survive untouched.
  assert.equal(
    signableUrl('https://shades16.com/friends?invite=a-b_c', origins),
    'https://shades16.com/friends?invite=a-b_c',
  );
  assert.equal(signableUrl('https://shades16.com:8443/prototype', origins), null);
  assert.equal(signableUrl('http://shades16.com/prototype', origins), null);
  assert.equal(signableUrl('https://evil.example/prototype', origins), null);
  assert.equal(signableUrl('https://user:pass@shades16.com/prototype', origins), null);
  assert.equal(signableUrl('javascript:alert(1)', origins), null);
  assert.equal(signableUrl('', origins), null);
  assert.equal(signableUrl(null, origins), null);
  assert.equal(signableUrl('https://shades16.com/prototype', []), null);
});

test('shareSignature matches the algorithm published by WeChat', () => {
  // Reference values from the official JS-SDK signature appendix.
  assert.equal(
    shareSignature(
      'sM4AOVdWfPE4DxkXGEs8VMCPGGVi4C3VM0P37wVUCFvkVAy_90u5h9nbSlYy3-Sl-HhTdfl2fzFy1AOcHKP7qg',
      'Wm3WZYTPz0wzccnW',
      1414587457,
      'http://mp.weixin.qq.com?params=value',
    ),
    '0f9de62fce790f9a083d5c99e95740ceb90c27ed',
  );
});

test('signing caches credentials and reuses them across pages', async () => {
  const { share, calls } = credentials();
  const first = await share.sign('https://shades16.com/prototype');
  const second = await share.sign('https://shades16.com/prototype/types/t03');
  const third = await share.sign('https://shades16.com/en/friends?invite=xyz');
  assert.equal(calls().token, 1);
  assert.equal(calls().ticket, 1);
  // Each page gets its own nonce and timestamp but the same ticket.
  assert.notEqual(first.nonceStr, second.nonceStr);
  assert.equal(first.appId, appId);
  assert.match(first.signature, /^[a-f0-9]{40}$/);
  assert.notEqual(first.signature, second.signature);
  assert.ok(third.signature);
});

test('concurrent first requests share one upstream refresh', async () => {
  const { share, calls } = credentials();
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      share.sign(`https://shades16.com/prototype?type=t0${(index % 9) + 1}`),
    ),
  );
  assert.equal(results.filter(Boolean).length, 12);
  assert.equal(calls().token, 1);
  assert.equal(calls().ticket, 1);
});

test('expired credentials are refreshed instead of reused', async () => {
  let clock = 1_700_000_000_000;
  const { share, calls } = credentials({ options: { now: () => clock } });
  await share.sign('https://shades16.com/prototype');
  clock += 7200 * 1000;
  await share.sign('https://shades16.com/prototype');
  assert.equal(calls().token, 2);
  assert.equal(calls().ticket, 2);
  // Inside the safety margin the cached value is still considered usable.
  await share.sign('https://shades16.com/prototype');
  assert.equal(calls().ticket, 2);
});

test('a rejected URL is refused without calling WeChat', async () => {
  const { share, calls } = credentials();
  assert.equal(await share.sign('https://other.example/prototype'), null);
  assert.deepEqual(calls(), { token: 0, ticket: 0 });
});

test('an IP whitelist rejection is reported as its own error', async () => {
  const options = {
    options: {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ errcode: 40164, errmsg: 'invalid ip 1.2.3.4, not in whitelist' }),
      }),
    },
  };
  const { share } = credentials(options);
  await assert.rejects(
    () => share.sign('https://shades16.com/prototype'),
    (error) => error instanceof WechatError && error.code === 'IP_NOT_ALLOWED',
  );
});

test('a failed refresh is not cached, so the next page retries', async () => {
  let attempts = 0;
  const share = createWechatShare({
    appId,
    appSecret,
    origins,
    fetchImpl: async (url) => {
      if (new URL(url).pathname === '/cgi-bin/token') {
        attempts += 1;
        if (attempts === 1) return { ok: false, status: 502 };
        return { ok: true, json: async () => ({ access_token: 'token', expires_in: 7200 }) };
      }
      return { ok: true, json: async () => ({ errcode: 0, ticket: 'ticket', expires_in: 7200 }) };
    },
  });
  await assert.rejects(() => share.sign('https://shades16.com/prototype'));
  assert.ok(await share.sign('https://shades16.com/prototype'));
  assert.equal(attempts, 2);
});

test('missing configuration disables sharing and rejects partial setup', async () => {
  const disabled = createWechatShare({ origins });
  assert.equal(disabled.enabled, false);
  await assert.rejects(
    () => disabled.sign('https://shades16.com/prototype'),
    (error) => error.code === 'NOT_CONFIGURED',
  );
  assert.throws(() => createWechatShare({ appId, origins }), /together/);
  assert.throws(() => createWechatShare({ appSecret, origins }), /together/);
  assert.throws(
    () => createWechatShare({ appId: 'wx-not-an-appid', appSecret, origins }),
    /AppID/,
  );
});
