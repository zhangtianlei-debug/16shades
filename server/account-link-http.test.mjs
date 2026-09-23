import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDatabase } from './db.mjs';
import { createApi } from './app.mjs';
import { createMiniappAuth } from './miniapp-auth.mjs';
import { digest, keyed, token, passwordService } from './security.mjs';
import { normalizeResult, presentation } from './result.mjs';
import { exampleResult } from '../app/prototype/scoring.ts';

const secret = 'account-link-http-test-secret-that-is-long-enough';
let clock = 1760000000000;
const json = async response => ({ status: response.status, data: await response.json() });

function seedSaved(db, userId, type, savedAt = clock) {
  const result = normalizeResult(exampleResult(type)), match = presentation(result);
  db.prepare('INSERT INTO saved_results VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(userId, `seed-${userId}-${type}`, result.schema, result.versions.framework_version, result.versions.scoring_version, result.versions.item_bank_version, result.versions.reference_test_version, result.formId, result.bankDigest, match.version, result.stage, JSON.stringify(result), JSON.stringify(match), savedAt);
  return result;
}
async function seedPassword(db, userId, username, password = 'A private password for deletion 2026') {
  const identityId = `identity-${userId}`;
  db.prepare("INSERT INTO identities VALUES (?,?,?,'',?,?,NULL,?,?)").run(identityId, userId, 'username', username, username, clock, clock);
  db.prepare('INSERT INTO password_credentials VALUES (?,?,?)').run(identityId, await passwordService().hash(password), clock);
  return password;
}

async function fixture(t) {
  const db = openDatabase(':memory:'); let api;
  const server = createServer((req, res) => void api(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const auth = createMiniappAuth({ sessionSecret: 'account-link-mini-session-secret', exchangeCode: async code => `openid-${code}` });
  api = createApi({ db, secret, origins: [origin], secure: false, miniappAuth: auth, now: () => clock });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const request = async (path, { method = 'GET', body, headers = {} } = {}) => json(await fetch(origin + path, { method, headers: { Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }));
  function web(id, username) {
    const value = token();
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(id, username, clock, clock);
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(digest(value), id, clock, clock + 86400000);
    const call = (path, body = {}, method = 'POST', csrf = true) => request(path, { method, body, headers: { Cookie: `shadow16_dev=${value}`, ...(csrf ? { 'X-CSRF-Token': keyed(secret, `csrf:${value}`) } : {}) } });
    const get = path => request(path, { headers: { Cookie: `shadow16_dev=${value}` } });
    return { id, call, get };
  }
  async function mini(code) {
    const logged = await request('/api/miniapp/auth/session', { method: 'POST', body: { code } }); assert.equal(logged.status, 201);
    const call = (path, body = {}, method = 'POST') => request(path, { method, body, headers: { Authorization: `Bearer ${logged.data.token}` } });
    const get = path => request(path, { headers: { Authorization: `Bearer ${logged.data.token}` } });
    return { id: logged.data.identity, token: logged.data.token, call, get };
  }
  return { db, request, web, mini };
}

test('HTTP account linking enforces browser auth, CSRF and per-account code limit', async t => {
  const f = await fixture(t), a = f.web('web-a', '网站甲');
  assert.equal((await f.request('/api/account/link')).status, 401);
  assert.equal((await a.call('/api/account/link/code', {}, 'POST', false)).status, 403);
  let last;
  for (let i = 0; i < 6; i++) { last = await a.call('/api/account/link/code'); assert.equal(last.status, 201); assert.match(last.data.code, /^[A-HJ-NP-Z2-9]{12}$/); }
  const blocked = await a.call('/api/account/link/code');
  assert.equal(blocked.status, 429); assert.equal(blocked.data.code, 'RATE_LIMITED');
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM account_link_codes').get().n, 1);
  assert.notEqual(f.db.prepare('SELECT code_hash FROM account_link_codes').get().code_hash, last.data.code);
});

test('HTTP preview and explicit commit synchronize both write/delete directions without old mini revival', async t => {
  const f = await fixture(t), web = f.web('web-a', '网站甲'), websiteResult = seedSaved(f.db, 'web-a', 'T03', clock - 20), mini = await f.mini('mini-a');
  const code = await web.call('/api/account/link/code');
  assert.equal((await f.request('/api/miniapp/account/link/preview', { method: 'POST', body: { code: code.data.code } })).status, 401);
  const preview = await mini.call('/api/miniapp/account/link/preview', { code: code.data.code });
  assert.equal(preview.status, 200); assert.equal(preview.data.website.username, '网站甲'); assert.deepEqual(preview.data.website.saved.result, websiteResult);
  assert.equal((await mini.call('/api/miniapp/account/link/commit', { code: code.data.code, choice: 'website' })).status, 400);
  const committed = await mini.call('/api/miniapp/account/link/commit', { code: code.data.code, choice: 'website', expectedFingerprint: preview.data.fingerprint });
  assert.equal(committed.status, 200); assert.deepEqual(committed.data.result.result, websiteResult);
  assert.deepEqual((await mini.get('/api/miniapp/account/link')).data.link, { websiteUsername: '网站甲', linkedAt: new Date(clock).toISOString() });
  assert.deepEqual((await web.get('/api/account/link')).data.link, { websiteUsername: '网站甲', linkedAt: new Date(clock).toISOString() });

  const stale = await mini.call('/api/miniapp/result', { result: exampleResult('T05'), completedAt: clock - 100 }, 'PUT');
  assert.equal(stale.status, 200); assert.deepEqual(stale.data.result.result, websiteResult);
  const miniNew = normalizeResult(exampleResult('T06'));
  const newer = await mini.call('/api/miniapp/result', { result: miniNew, completedAt: clock + 10 }, 'PUT');
  assert.equal(newer.status, 200); assert.deepEqual(newer.data.result.result, miniNew);
  assert.deepEqual(JSON.parse(f.db.prepare('SELECT summary_json FROM saved_results WHERE user_id=?').get('web-a').summary_json), miniNew);

  const currentWeb = await web.get('/api/session');
  const webNew = normalizeResult(exampleResult('T07'));
  const saved = await web.call('/api/results/latest', { result: webNew, expectedRevision: currentWeb.data.saved.revision }, 'PUT');
  assert.equal(saved.status, 200);
  assert.deepEqual((await mini.get('/api/miniapp/result')).data.result.result, webNew);
  const deletedWeb = await web.call('/api/results/latest', { expectedRevision: saved.data.saved.revision }, 'DELETE');
  assert.equal(deletedWeb.status, 200); assert.equal((await mini.get('/api/miniapp/result')).data.result, null);

  const finalMini = normalizeResult(exampleResult('T08'));
  assert.equal((await mini.call('/api/miniapp/result', { result: finalMini, completedAt: clock + 30 }, 'PUT')).status, 200);
  assert.ok((await web.get('/api/session')).data.saved);
  assert.equal((await mini.call('/api/miniapp/result', {}, 'DELETE')).status, 200);
  assert.equal((await web.get('/api/session')).data.saved, null);
});

test('a linked mini account rejects a different website code, and account deletion cascades only its own link', async t => {
  const f = await fixture(t), webA = f.web('web-a', '网站甲'), webB = f.web('web-b', '网站乙'), miniA = await f.mini('mini-a');
  seedSaved(f.db, 'web-a', 'T01'); seedSaved(f.db, 'web-b', 'T02');
  const aCode = await webA.call('/api/account/link/code'), aPreview = await miniA.call('/api/miniapp/account/link/preview', { code: aCode.data.code });
  assert.equal((await miniA.call('/api/miniapp/account/link/commit', { code: aCode.data.code, choice: 'website', expectedFingerprint: aPreview.data.fingerprint })).status, 200);
  const bCode = await webB.call('/api/account/link/code');
  const cross = await miniA.call('/api/miniapp/account/link/preview', { code: bCode.data.code });
  assert.equal(cross.status, 409); assert.equal(cross.data.code, 'ACCOUNT_LINK_CONFLICT');

  const miniB = await f.mini('mini-b'), bPreview = await miniB.call('/api/miniapp/account/link/preview', { code: bCode.data.code });
  assert.equal((await miniB.call('/api/miniapp/account/link/commit', { code: bCode.data.code, choice: 'website', expectedFingerprint: bPreview.data.fingerprint })).status, 200);
  assert.equal((await miniB.call('/api/miniapp/account', {}, 'DELETE')).status, 200);
  assert.equal(f.db.prepare('SELECT id FROM users WHERE id=?').get('web-b').id, 'web-b');
  assert.ok(f.db.prepare('SELECT 1 FROM saved_results WHERE user_id=?').get('web-b'));
  assert.equal(f.db.prepare('SELECT 1 FROM account_links WHERE web_user_id=?').get('web-b'), undefined);

  const password = await seedPassword(f.db, 'web-a', '网站甲');
  assert.equal((await webA.call('/api/account', { currentPassword: password })).status, 200);
  assert.equal(f.db.prepare('SELECT 1 FROM users WHERE id=?').get(miniA.id)['1'], 1);
  assert.ok(f.db.prepare('SELECT 1 FROM miniapp_results WHERE user_id=?').get(miniA.id));
  assert.equal(f.db.prepare('SELECT 1 FROM account_links WHERE miniapp_user_id=?').get(miniA.id), undefined);
});
