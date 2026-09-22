import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backup } from 'node:sqlite';
import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { openDatabase } from './db.mjs';
import { createApi } from './app.mjs';
import { normalizeResult, presentation } from './result.mjs';
import { scoreCandidate, exampleResult } from '../app/prototype/scoring.ts';

const pass = 'A quiet river beneath the moon 2026';
const nextPass = 'Another bright river beneath trees 2026';
const secret = 'test-only-secret-not-for-production-16048';
async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'shadow16-accounts-'));
  let db = openDatabase(join(directory, 'accounts.sqlite')),
    api;
  const server = createServer((req, res) => void api(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const mount = () => {
    api = createApi({
      db,
      secret,
      origins: [origin],
      secure: true,
      trustProxy: true,
      analyticsEnabled: true,
      captchaCounter: 1,
    });
  };
  mount();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  let clientNumber = 0;
  function client() {
    const jar = new Map();
    let csrf = '';
    const ip = `192.0.2.${++clientNumber}`;
    return {
      jar,
      async call(path, body, method = 'POST', headers = {}) {
        const response = await fetch(origin + path, {
          method: body === undefined ? 'GET' : method,
          headers: {
            Origin: origin,
            'X-Real-IP': ip,
            Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf,
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(';')[0],
            index = pair.indexOf('=');
          if (pair.slice(index + 1))
            jar.set(pair.slice(0, index), pair.slice(index + 1));
          else jar.delete(pair.slice(0, index));
        }
        const data = await response.json();
        if (data.csrfToken) csrf = data.csrfToken;
        return { status: response.status, data, headers: response.headers };
      },
      async captcha(action) {
        const { data: challenge, status } = await this.call(
          `/api/captcha?action=${action}`,
        );
        assert.equal(status, 200);
        const solution = await solveChallenge({ challenge, deriveKey });
        return Buffer.from(JSON.stringify({ challenge, solution })).toString(
          'base64',
        );
      },
      async register(name = 'tester_01') {
        await this.call('/api/session');
        return this.call('/api/auth/register', {
          username: name,
          password: pass,
          passwordConfirm: pass,
          remember: false,
          acceptPrivacy: true,
          captcha: await this.captcha('register'),
        });
      },
      async login(name = 'tester_01', pw = pass) {
        await this.call('/api/session');
        return this.call('/api/auth/login', {
          username: name,
          password: pw,
          remember: true,
        });
      },
    };
  }
  return {
    client,
    origin,
    directory,
    get db() {
      return db;
    },
    restart: () => {
      db.close();
      db = openDatabase(join(directory, 'accounts.sqlite'));
      mount();
    },
    resetLimits: () => db.exec('DELETE FROM rate_limits'),
  };
}

test('registration, credential hashing, multi-identity schema, cookie/session and restart persistence', async (t) => {
  const f = await fixture(t),
    a = f.client();
  const registered = await a.register();
  assert.equal(registered.status, 201);
  assert.match(registered.data.recoveryCode, /^[A-F0-9-]{47}$/);
  const cookie = registered.headers
    .getSetCookie()
    .find((v) => v.startsWith('__Host-shadow16='));
  assert.match(cookie, /HttpOnly; SameSite=Lax; Secure/);
  assert.ok(!cookie.includes('Max-Age'));
  const row = f.db
    .prepare('SELECT password_hash FROM password_credentials')
    .get();
  assert.match(row.password_hash, /^scrypt\$131072\$8\$1\$/);
  assert.ok(!row.password_hash.includes(pass));
  const id = registered.data.user.id;
  f.db
    .prepare(
      "INSERT INTO identities VALUES ('future',?,'email','','future@example.test','future@example.test',NULL,1,NULL)",
    )
    .run(id);
  assert.equal(
    f.db.prepare('SELECT count(*) AS n FROM identities WHERE user_id=?').get(id)
      .n,
    2,
  );
  const result = scoreCandidate(Array(16).fill(3), 'basic');
  const saved = await a.call(
    '/api/results/latest',
    { result, expectedRevision: null },
    'PUT',
  );
  assert.equal(saved.status, 200);
  f.restart();
  const restored = await a.call('/api/session');
  assert.equal(restored.data.user.id, id);
  assert.deepEqual(restored.data.saved.result, result);
  const b = f.client();
  assert.equal((await b.login()).status, 200);
  assert.deepEqual((await b.call('/api/session')).data.saved, saved.data.saved);
  const summary = f.db
    .prepare('SELECT summary_json FROM saved_results')
    .get().summary_json;
  assert.ok(!summary.includes('answers'));
  assert.ok(!summary.includes(pass));
  const tables = f.db
    .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
    .all();
  assert.ok(!tables.some((x) => /answers/.test(x.name)));
});

test('captcha is required, action-bound, browser-bound, signed, expiring and single-use', async (t) => {
  const f = await fixture(t),
    a = f.client(),
    b = f.client();
  await a.call('/api/session');
  await b.call('/api/session');
  const body = {
    username: 'tester_01',
    password: pass,
    passwordConfirm: pass,
    remember: false,
    acceptPrivacy: true,
    captcha: '',
  };
  assert.equal(
    (await a.call('/api/auth/register', body)).data.code,
    'CAPTCHA_REQUIRED',
  );
  const wrongAction = await a.captcha('login');
  assert.equal(
    (await a.call('/api/auth/register', { ...body, captcha: wrongAction })).data
      .code,
    'CAPTCHA_REQUIRED',
  );
  const proof = await a.captcha('register');
  assert.equal(
    (await b.call('/api/auth/register', { ...body, captcha: proof })).data.code,
    'CAPTCHA_REQUIRED',
  );
  const tampered = JSON.parse(Buffer.from(proof, 'base64').toString());
  tampered.challenge.parameters.expiresAt = 1;
  assert.equal(
    (
      await a.call('/api/auth/register', {
        ...body,
        captcha: Buffer.from(JSON.stringify(tampered)).toString('base64'),
      })
    ).data.code,
    'CAPTCHA_REQUIRED',
  );
  const mismatch = await a.call('/api/auth/register', {
    ...body,
    passwordConfirm: 'different',
    captcha: proof,
  });
  assert.equal(mismatch.data.code, 'PASSWORD_MISMATCH');
  const good = await a.call('/api/auth/register', { ...body, captcha: proof });
  assert.equal(good.status, 201);
  // Replay in the original guest context: remove only the newly issued auth cookie.
  a.jar.delete('__Host-shadow16');
  await a.call('/api/session');
  f.resetLimits();
  assert.equal(
    (
      await a.call('/api/auth/register', {
        ...body,
        username: 'tester_02',
        captcha: proof,
      })
    ).data.code,
    'CAPTCHA_REQUIRED',
  );
});

test('result ownership, safe deletion, snapshot CAS and rejection of forged fields/versions', async (t) => {
  const f = await fixture(t),
    a = f.client(),
    b = f.client();
  await a.register('owner_a');
  await b.register('owner_b');
  const result = exampleResult('T16');
  let r = await a.call(
    '/api/results/latest',
    { result, expectedRevision: null },
    'PUT',
  );
  assert.equal(r.status, 200);
  const first = r.data.saved;
  assert.equal((await b.call('/api/session')).data.saved, null);
  assert.equal(
    (
      await b.call(
        '/api/results/latest',
        { result, expectedRevision: null, user_id: 'another-users-id' },
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await a.call(
        '/api/results/latest',
        { result, expectedRevision: null },
        'PUT',
      )
    ).data.code,
    'RESULT_CONFLICT',
  );
  assert.equal(
    (
      await a.call(
        '/api/results/latest',
        {
          result: { ...result, formId: 'wrong' },
          expectedRevision: first.revision,
        },
        'PUT',
      )
    ).data.code,
    'RESULT_VERSION_UNSUPPORTED',
  );
  assert.equal(
    (
      await a.call(
        '/api/results/latest',
        {
          result: { ...result, answers: [] },
          expectedRevision: first.revision,
        },
        'PUT',
      )
    ).status,
    400,
  );
  r = await a.call(
    '/api/results/latest',
    { result: exampleResult('T01'), expectedRevision: first.revision },
    'PUT',
  );
  assert.equal(r.status, 200);
  assert.equal(
    f.db.prepare('SELECT count(*) AS n FROM saved_results').get().n,
    1,
  );
  assert.equal(
    (
      await b.call(
        '/api/results/latest',
        { expectedRevision: r.data.saved.revision },
        'DELETE',
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await a.call(
        '/api/results/latest',
        { expectedRevision: r.data.saved.revision },
        'DELETE',
      )
    ).status,
    200,
  );
});

test('wrong credentials, throttling, CSRF and cross-origin requests', async (t) => {
  const f = await fixture(t),
    a = f.client();
  await a.register();
  await a.call('/api/auth/logout', {});
  for (let i = 0; i < 3; i++) {
    const r = await a.login('tester_01', 'incorrect');
    assert.equal(r.data.code, 'INVALID_CREDENTIALS');
    if (i === 2) assert.equal(r.data.captchaRequired, true);
  }
  assert.equal((await a.login()).data.code, 'CAPTCHA_REQUIRED');
  const good = await a.call('/api/auth/login', {
    username: 'tester_01',
    password: pass,
    remember: true,
    captcha: await a.captcha('login'),
  });
  assert.equal(good.status, 200);
  assert.ok(
    good.headers.getSetCookie().some((v) => v.includes('Max-Age=2592000')),
  );
  assert.equal(
    (await a.call('/api/auth/logout', {}, 'POST', { 'X-CSRF-Token': 'wrong' }))
      .status,
    403,
  );
  assert.equal(
    (
      await a.call('/api/auth/logout', {}, 'POST', {
        Origin: 'https://elsewhere.invalid',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await a.call('/api/auth/logout', {}, 'POST', {
        'X-CSRF-Token': 'é'.repeat(64),
      })
    ).status,
    403,
  );
  const many = f.client();
  await many.call('/api/session');
  let last;
  for (let i = 0; i < 31; i++)
    last = await many.call('/api/captcha?action=register');
  assert.equal(last.status, 429);
  assert.ok(last.headers.get('Retry-After'));
});

test('password change, one-time recovery, session revocation and account cascade deletion', async (t) => {
  const f = await fixture(t),
    a = f.client(),
    b = f.client();
  const registered = await a.register();
  await b.login();
  const oldCode = registered.data.recoveryCode;
  const changed = await a.call('/api/auth/password', {
    currentPassword: pass,
    password: nextPass,
    passwordConfirm: nextPass,
  });
  assert.equal(changed.status, 200);
  assert.equal((await b.call('/api/session')).data.user, null);
  assert.equal(
    (
      await b.call('/api/auth/recover', {
        username: 'tester_01',
        recoveryCode: oldCode,
        password: pass,
        passwordConfirm: pass,
        captcha: await b.captcha('recover'),
      })
    ).data.code,
    'RECOVERY_INVALID',
  );
  const recovered = await b.call('/api/auth/recover', {
    username: 'tester_01',
    recoveryCode: changed.data.recoveryCode,
    password: pass,
    passwordConfirm: pass,
    captcha: await b.captcha('recover'),
  });
  assert.equal(recovered.status, 200);
  assert.equal((await a.call('/api/session')).data.user, null);
  assert.equal(
    (
      await a.call('/api/auth/recover', {
        username: 'tester_01',
        recoveryCode: changed.data.recoveryCode,
        password: pass,
        passwordConfirm: pass,
        captcha: await a.captcha('recover'),
      })
    ).data.code,
    'RECOVERY_INVALID',
  );
  f.resetLimits();
  assert.equal((await a.login()).status, 200);
  assert.equal(
    (await a.call('/api/account', { currentPassword: pass })).status,
    200,
  );
  for (const table of [
    'users',
    'identities',
    'password_credentials',
    'sessions',
    'saved_results',
    'recovery_codes',
  ])
    assert.equal(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
});

test('database online backup restores accounts and result; event counts are deduped and do not store identities', async (t) => {
  const f = await fixture(t),
    a = f.client();
  await a.register();
  await a.call(
    '/api/results/latest',
    { result: exampleResult('T02'), expectedRevision: null },
    'PUT',
  );
  const id = '01234567-0123-4123-8123-012345678901';
  await a.call('/api/events', { event: 'complete_basic', id });
  assert.equal(
    f.db
      .prepare("SELECT count FROM metric_totals WHERE event='complete_basic'")
      .get(),
    undefined,
  );
  const consent = { 'X-Analytics-Consent': '1' };
  await a.call('/api/events', { event: 'complete_basic', id }, 'POST', consent);
  await a.call('/api/events', { event: 'complete_basic', id });
  await a.call('/api/events', { event: 'complete_basic', id }, 'POST', consent);
  assert.equal(
    f.db
      .prepare("SELECT count FROM metric_totals WHERE event='complete_basic'")
      .get().count,
    1,
  );
  assert.equal(
    (await a.call('/api/events', { event: 'register_success', id })).status,
    400,
  );
  const backupPath = join(f.directory, 'backup.sqlite');
  await backup(f.db, backupPath);
  const restored = openDatabase(backupPath);
  assert.equal(restored.prepare('SELECT count(*) AS n FROM users').get().n, 1);
  assert.equal(
    restored.prepare('SELECT count(*) AS n FROM saved_results').get().n,
    1,
  );
  restored.close();
  const binary = readFileSync(backupPath);
  assert.ok(!binary.includes(Buffer.from(pass)));
});

test('all scoring edge snapshots and stored presentation remain compatible with locked results', () => {
  for (const stage of ['basic', 'full'])
    for (const answer of [null, 1, 2, 3, 4, 5]) {
      const result = scoreCandidate(
        Array(stage === 'basic' ? 16 : 48).fill(answer),
        stage,
      );
      assert.deepEqual(normalizeResult(result), result);
      assert.equal(presentation(result).shares.length, 16);
    }
  for (let i = 1; i <= 16; i++)
    assert.deepEqual(
      normalizeResult(exampleResult(`T${String(i).padStart(2, '0')}`)),
      exampleResult(`T${String(i).padStart(2, '0')}`),
    );
});

test('simple account forms accept one eight-character password and retain recovery and legacy confirmation checks', async (t) => {
  const f = await fixture(t),
    a = f.client();
  await a.call('/api/session');
  const draft = { username: 'simple_08', remember: true, acceptPrivacy: true };
  const short = await a.call('/api/auth/register', {
    ...draft,
    password: 'Ab3!cde',
    captcha: 'unused',
  });
  assert.equal(short.data.code, 'PASSWORD_FORMAT');
  const common = await a.call('/api/auth/register', {
    ...draft,
    password: '12345678',
    captcha: 'unused',
  });
  assert.equal(common.data.code, 'PASSWORD_WEAK');
  const registered = await a.call('/api/auth/register', {
    ...draft,
    password: 'River8!x',
    captcha: await a.captcha('register'),
  });
  assert.equal(registered.status, 201);
  const changed = await a.call('/api/auth/password', {
    currentPassword: 'River8!x',
    password: 'Stone9!y',
  });
  assert.equal(changed.status, 200);
  assert.ok(changed.data.recoveryCode);
  const b = f.client();
  await b.call('/api/session');
  const recovered = await b.call('/api/auth/recover', {
    username: draft.username,
    recoveryCode: changed.data.recoveryCode,
    password: 'Cloud7!z',
    captcha: await b.captcha('recover'),
  });
  assert.equal(recovered.status, 200);
  assert.equal((await b.login(draft.username, 'Cloud7!z')).status, 200);
  const mismatch = await b.call('/api/auth/password', {
    currentPassword: 'Cloud7!z',
    password: 'Stone9!y',
    passwordConfirm: 'different-password',
  });
  assert.equal(mismatch.data.code, 'PASSWORD_MISMATCH');
  assert.equal(
    (await f.client().login(draft.username, 'Cloud7!z')).status,
    200,
  );
});
