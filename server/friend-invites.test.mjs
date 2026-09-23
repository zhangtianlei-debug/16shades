import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDatabase } from './db.mjs';
import { createApi } from './app.mjs';
import { digest, keyed, token } from './security.mjs';
import {
  createInvite,
  deleteInvite,
  ownerInvites,
  publicInviteByToken,
  submitResponse,
} from './friend-invites.mjs';
import { exampleResult, scoreCandidate } from '../app/prototype/scoring.ts';

const at = 1760000000000;
const responseBody = (id = '6d2e3384-4d1d-4d2e-a5e3-d21651bac381') => ({
  nickname: '阿云',
  result: exampleResult('T03'),
  submissionId: id,
});
function dbWithUsers() {
  const db = openDatabase(':memory:');
  db.prepare('INSERT INTO users VALUES (?,?,?,?)').run('owner', 'owner', at, at);
  db.prepare('INSERT INTO users VALUES (?,?,?,?)').run('other', 'other', at, at);
  return db;
}

test('friend invite stores only a full normalized result, hides responses publicly, and deduplicates submission id', () => {
  const db = dbWithUsers();
  try {
    const invite = createInvite(db, 'owner', { subjectName: '小林' }, at);
    assert.match(invite.token, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(publicInviteByToken(db, invite.token), invite);
    const first = submitResponse(db, invite.token, responseBody(), at + 1);
    const retry = submitResponse(db, invite.token, responseBody(), at + 2);
    assert.deepEqual(retry, first);
    assert.equal(first.result.stage, 'full');
    assert.equal(first.presentation.version, 'site-role-match-0.2');
    const listed = ownerInvites(db, 'owner');
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0].responses, [first]);
    assert.equal(publicInviteByToken(db, invite.token).responses, undefined);
    assert.throws(() => submitResponse(db, invite.token, { ...responseBody('7d2e3384-4d1d-4d2e-a5e3-d21651bac381'), result: scoreCandidate(Array(16).fill(3), 'basic') }, at + 3), { code: 'FULL_RESULT_REQUIRED' });
    assert.throws(() => submitResponse(db, invite.token, { ...responseBody('9d2e3384-4d1d-4d2e-a5e3-d21651bac381'), nickname: 'a'.repeat(37) }, at + 4), { code: 'NICKNAME_INVALID' });
  } finally { db.close(); }
});

test('invite ownership and user deletion cascade protect other accounts and responses', () => {
  const db = dbWithUsers();
  try {
    const invite = createInvite(db, 'owner', { subjectName: '小林' }, at);
    submitResponse(db, invite.token, responseBody(), at + 1);
    assert.throws(() => deleteInvite(db, 'other', invite.token), { code: 'INVITE_NOT_FOUND' });
    db.prepare('DELETE FROM users WHERE id=?').run('owner');
    assert.equal(publicInviteByToken(db, invite.token), null);
    assert.equal(db.prepare('SELECT count(*) AS n FROM friend_invite_responses').get().n, 0);
  } finally { db.close(); }
});

test('API flow creates, refreshes owner token, accepts guest response, and deletes with refreshed token', async (t) => {
  const db = dbWithUsers(), secret = 'friend-invite-integration-test-secret-16048';
  const session = token();
  db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(digest(session), 'owner', at, at + 86400000);
  let api;
  const server = createServer((req, res) => void api(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  api = createApi({ db, secret, origins: [origin], secure: false, now: () => at });
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); db.close(); });
  const request = async (path, { method = 'GET', body, cookie, csrf } = {}) => {
    const res = await fetch(origin + path, { method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json(), cookies: res.headers.getSetCookie() };
  };
  const ownerCookie = `shadow16_dev=${session}`;
  const ownerCsrf = keyed(secret, `csrf:${session}`);
  const created = await request('/api/friend-invites', { method: 'POST', cookie: ownerCookie, csrf: ownerCsrf, body: { subjectName: '小林' } });
  assert.equal(created.status, 201);
  const inviteToken = created.data.invite.token;
  const listed = await request('/api/friend-invites', { cookie: ownerCookie });
  assert.equal(listed.status, 200);
  assert.equal(listed.data.invites[0].token, inviteToken);
  const shared = await request(`/api/friend-invites/${inviteToken}`);
  assert.deepEqual(shared.data.invite, created.data.invite);
  assert.equal(shared.data.invite.responses, undefined);
  const guestSession = await request('/api/session');
  const guestCookie = guestSession.cookies.find((v) => v.startsWith('shadow16_guest_dev=')).split(';')[0];
  const submitted = await request(`/api/friend-invites/${inviteToken}/responses`, { method: 'POST', cookie: guestCookie, csrf: guestSession.data.csrfToken, body: { nickname: '', result: exampleResult('T03'), submissionId: '8d2e3384-4d1d-4d2e-a5e3-d21651bac381' } });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.data.response.nickname, null);
  const relisted = await request('/api/friend-invites', { cookie: ownerCookie });
  assert.equal(relisted.data.invites[0].responses.length, 1);
  assert.equal((await request(`/api/friend-invites/${inviteToken}`, { cookie: ownerCookie })).data.invite.responses, undefined);
  const denied = await request(`/api/friend-invites/${inviteToken}`, { method: 'DELETE', cookie: guestCookie, csrf: guestSession.data.csrfToken, body: {} });
  assert.equal(denied.status, 401);
  const deleted = await request(`/api/friend-invites/${relisted.data.invites[0].token}`, { method: 'DELETE', cookie: ownerCookie, csrf: ownerCsrf, body: {} });
  assert.equal(deleted.status, 200);
});
