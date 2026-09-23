import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, transaction } from './db.mjs';
import { normalizeResult, presentation } from './result.mjs';
import {
  createCode, previewLink, commitLink, readLink, unlink,
  syncWebSave, syncMiniSave, syncWebDelete, syncMiniDelete, syncWebSaveInTransaction,
} from './account-link.mjs';
import { exampleResult } from '../app/prototype/scoring.ts';

const now = 1760000000000;
function fixture() {
  const db = openDatabase(':memory:');
  for (const [id, name] of [['web-a', '网站甲'], ['web-b', '网站乙'], ['mini-a', '微信甲'], ['mini-b', '微信乙']])
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(id, name, now, now);
  return db;
}
function putWeb(db, id, type, savedAt = now) {
  const result = normalizeResult(exampleResult(type)), match = presentation(result);
  db.prepare(`INSERT INTO saved_results VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,summary_json=excluded.summary_json,presentation_json=excluded.presentation_json,saved_at=excluded.saved_at`).run(id, `web-${id}-${type}-${savedAt}`, result.schema, result.versions.framework_version, result.versions.scoring_version, result.versions.item_bank_version, result.versions.reference_test_version, result.formId, result.bankDigest, match.version, result.stage, JSON.stringify(result), JSON.stringify(match), savedAt);
  return result;
}
function putMini(db, id, type, completedAt = now, savedAt = now) {
  const result = normalizeResult(exampleResult(type)), match = presentation(result);
  db.prepare('INSERT INTO miniapp_results VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET result_json=excluded.result_json,presentation_json=excluded.presentation_json,completed_at=excluded.completed_at,saved_at=excluded.saved_at').run(id, JSON.stringify(result), JSON.stringify(match), completedAt, savedAt);
  return result;
}
function link(db, web = 'web-a', mini = 'mini-a', choice = 'website', at = now) {
  const made = createCode(db, web, at), preview = previewLink(db, mini, made.code, at + 1);
  return commitLink(db, mini, { code: made.code, choice, expectedFingerprint: preview.fingerprint }, at + 2);
}
function count(db, table) { return db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n; }

test('one-time codes are twelve characters, hash-only, expire, replay and invalidate when reissued', () => {
  const db = fixture();
  const first = createCode(db, 'web-a', now);
  assert.match(first.code, /^[A-HJ-NP-Z2-9]{12}$/);
  const stored = db.prepare('SELECT code_hash,expires_at FROM account_link_codes').get();
  assert.equal(stored.code_hash.length, 64); assert.notEqual(stored.code_hash, first.code); assert.equal(stored.expires_at, now + 600000);
  const second = createCode(db, 'web-a', now + 1);
  assert.equal(count(db, 'account_link_codes'), 1);
  assert.throws(() => previewLink(db, 'mini-a', first.code, now + 2), { code: 'ACCOUNT_LINK_CODE_INVALID' });
  const preview = previewLink(db, 'mini-a', second.code, now + 2);
  commitLink(db, 'mini-a', { code: second.code, choice: 'empty', expectedFingerprint: preview.fingerprint }, now + 3);
  assert.throws(() => previewLink(db, 'mini-b', second.code, now + 4), { code: 'ACCOUNT_LINK_CODE_INVALID' });
  const expiring = createCode(db, 'web-b', now + 4);
  assert.throws(() => previewLink(db, 'mini-b', expiring.code, now + 600004), { code: 'ACCOUNT_LINK_CODE_INVALID' });
  db.close();
});

test('preview has the UI contract and commit copies website or mini result explicitly', () => {
  const db = fixture(), web = putWeb(db, 'web-a', 'T03', now - 9), mini = putMini(db, 'mini-a', 'T05', now - 5, now - 4);
  const made = createCode(db, 'web-a', now), preview = previewLink(db, 'mini-a', made.code, now + 1);
  assert.deepEqual(Object.keys(preview).sort(), ['expiresAt', 'fingerprint', 'miniapp', 'website']);
  assert.equal(preview.website.username, '网站甲'); assert.equal(preview.website.saved.revision, 'web-web-a-T03-1759999999991');
  assert.deepEqual(preview.website.saved.result, web); assert.deepEqual(preview.miniapp.saved.result, mini); assert.equal(preview.miniapp.saved.completedAt, new Date(now - 5).toISOString());
  const committed = commitLink(db, 'mini-a', { code: made.code, choice: 'website', expectedFingerprint: preview.fingerprint }, now + 2);
  assert.deepEqual(committed.link, { websiteUsername: '网站甲', linkedAt: new Date(now + 2).toISOString() });
  assert.deepEqual(committed.result, { result: web, completedAt: new Date(now - 9).toISOString() });
  assert.deepEqual(JSON.parse(db.prepare('SELECT result_json FROM miniapp_results WHERE user_id=?').get('mini-a').result_json), web);
  assert.equal(db.prepare('SELECT completed_at FROM miniapp_results WHERE user_id=?').get('mini-a').completed_at, now - 9);
  assert.equal(db.prepare('SELECT deleted_before FROM miniapp_result_deletions WHERE user_id=?').get('mini-a').deleted_before, now + 2);
  assert.deepEqual(readLink(db, { miniappUserId: 'mini-a' }), committed.link);
  assert.equal(readLink(db, { miniappUserId: 'mini-a' }).miniappUserId, undefined);

  const miniTwo = putMini(db, 'mini-b', 'T07', now - 7, now - 6), codeTwo = createCode(db, 'web-b', now + 10), lookTwo = previewLink(db, 'mini-b', codeTwo.code, now + 11);
  const selected = commitLink(db, 'mini-b', { code: codeTwo.code, choice: 'miniapp', expectedFingerprint: lookTwo.fingerprint }, now + 12);
  assert.deepEqual(selected.result, { result: miniTwo, completedAt: new Date(now - 7).toISOString() });
  assert.deepEqual(JSON.parse(db.prepare('SELECT summary_json FROM saved_results WHERE user_id=?').get('web-b').summary_json), miniTwo);
  db.close();
});

test('empty choice is rejected while either account has a result', () => {
  const db = fixture(); putWeb(db, 'web-a', 'T01'); putMini(db, 'mini-a', 'T02', now - 1);
  const made = createCode(db, 'web-a', now), preview = previewLink(db, 'mini-a', made.code, now + 1);
  assert.throws(() => commitLink(db, 'mini-a', { code: made.code, choice: 'empty', expectedFingerprint: preview.fingerprint }, now + 2), { code: 'ACCOUNT_LINK_EMPTY_NOT_ALLOWED' });
  assert.ok(db.prepare('SELECT 1 FROM saved_results WHERE user_id=?').get('web-a'));
  assert.ok(db.prepare('SELECT 1 FROM miniapp_results WHERE user_id=?').get('mini-a'));
  assert.equal(db.prepare('SELECT 1 FROM miniapp_result_deletions WHERE user_id=?').get('mini-a'), undefined);
  db.close();
});

test('fingerprint, link uniqueness and account deletion prevent accidental merge or stale commit', () => {
  const db = fixture(); putWeb(db, 'web-a', 'T01'); putMini(db, 'mini-a', 'T02');
  const made = createCode(db, 'web-a', now), look = previewLink(db, 'mini-a', made.code, now + 1);
  putMini(db, 'mini-a', 'T03', now + 2, now + 2);
  assert.throws(() => commitLink(db, 'mini-a', { code: made.code, choice: 'website', expectedFingerprint: look.fingerprint }, now + 3), { code: 'ACCOUNT_LINK_CHANGED' });
  const good = previewLink(db, 'mini-a', made.code, now + 3); commitLink(db, 'mini-a', { code: made.code, choice: 'miniapp', expectedFingerprint: good.fingerprint }, now + 4);
  assert.throws(() => createCode(db, 'web-a', now + 5), { code: 'ACCOUNT_LINK_CONFLICT' });
  const secondCode = createCode(db, 'web-b', now + 5);
  assert.throws(() => previewLink(db, 'mini-a', secondCode.code, now + 6), { code: 'ACCOUNT_LINK_CONFLICT' });
  // FK cascade unlinks only this pair.  It does not merge or delete the other identity.
  db.prepare('DELETE FROM users WHERE id=?').run('web-a');
  assert.equal(readLink(db, { miniappUserId: 'mini-a' }), null); assert.equal(count(db, 'users'), 3);
  db.close();
});

test('linked saves and deletes copy in both directions and tombstone blocks an older mini local write', () => {
  const db = fixture(); putWeb(db, 'web-a', 'T01', now - 20); putMini(db, 'mini-a', 'T02', now - 19, now - 18); link(db);
  const webNew = putWeb(db, 'web-a', 'T04', now + 10); syncWebSave(db, 'web-a', now + 11);
  const miniAfterWeb = db.prepare('SELECT result_json,completed_at FROM miniapp_results WHERE user_id=?').get('mini-a');
  assert.deepEqual(JSON.parse(miniAfterWeb.result_json), webNew); assert.equal(miniAfterWeb.completed_at, now + 11);
  const deletion = db.prepare('SELECT deleted_before FROM miniapp_result_deletions WHERE user_id=?').get('mini-a').deleted_before;
  const staleCompleted = now - 19;
  assert.ok(staleCompleted <= deletion, 'the existing mini PUT guard must reject this local result');
  const miniNew = putMini(db, 'mini-a', 'T06', now + 20, now + 20); syncMiniSave(db, 'mini-a', now + 21);
  assert.deepEqual(JSON.parse(db.prepare('SELECT summary_json FROM saved_results WHERE user_id=?').get('web-a').summary_json), miniNew);
  syncWebDelete(db, 'web-a', now + 30); assert.equal(db.prepare('SELECT 1 FROM miniapp_results WHERE user_id=?').get('mini-a'), undefined);
  putMini(db, 'mini-a', 'T08', now + 40, now + 40); syncMiniDelete(db, 'mini-a', now + 41); assert.equal(db.prepare('SELECT 1 FROM saved_results WHERE user_id=?').get('web-a'), undefined);
  unlink(db, { webUserId: 'web-a' }); assert.equal(readLink(db, { webUserId: 'web-a' }), null);
  db.close();
});

test('transactional helper forms are available without nesting a transaction', () => {
  const db = fixture(); putWeb(db, 'web-a', 'T01'); link(db);
  assert.doesNotThrow(() => transaction(db, () => {
    // Main app can import the *InTransaction hooks without issuing BEGIN
    // inside its existing result transaction.
    syncWebSaveInTransaction(db, 'web-a', now + 1);
  }));
  db.close();
});
