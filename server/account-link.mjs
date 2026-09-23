import { randomBytes, randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { ApiError, digest, requireFields } from './security.mjs';
import { normalizeResult, presentation } from './result.mjs';

const CODE_TTL = 10 * 60 * 1000;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codePattern = /^[A-HJ-NP-Z2-9]{12}$/;
const linkMissing = () => { throw new ApiError(404, 'ACCOUNT_LINK_NOT_FOUND', '未找到账号关联。'); };
const codeInvalid = () => { throw new ApiError(404, 'ACCOUNT_LINK_CODE_INVALID', '关联码无效、已使用或已失效。'); };
const conflict = () => { throw new ApiError(409, 'ACCOUNT_LINK_CONFLICT', '其中一个账号已经关联，无法自动更换关联。'); };
const changed = () => { throw new ApiError(409, 'ACCOUNT_LINK_CHANGED', '两端画像已发生变化，请重新确认后再关联。'); };
const resultMissing = () => { throw new ApiError(409, 'ACCOUNT_LINK_RESULT_MISSING', '所选一端没有可同步的画像。'); };
const emptyNotAllowed = () => { throw new ApiError(409, 'ACCOUNT_LINK_EMPTY_NOT_ALLOWED', '两端都有画像时，请明确选择保留哪一份。'); };
const iso = value => value == null ? null : new Date(value).toISOString();

function assertUser(db, id) {
  if (typeof id !== 'string' || !db.prepare('SELECT 1 FROM users WHERE id=?').get(id))
    throw new ApiError(404, 'ACCOUNT_NOT_FOUND', '账号不存在或已删除。');
}
function normalizedCode(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!codePattern.test(code)) throw codeInvalid();
  return code;
}
function rawCode() {
  const bytes = randomBytes(12), characters = [];
  for (const byte of bytes) characters.push(alphabet[byte % alphabet.length]);
  return characters.join('');
}
function webSaved(db, userId) {
  const row = db.prepare('SELECT revision,summary_json,presentation_json,saved_at FROM saved_results WHERE user_id=?').get(userId);
  if (!row) return null;
  const result = normalizeResult(JSON.parse(row.summary_json));
  return { result, presentation: presentation(result), savedAt: row.saved_at, revision: row.revision };
}
function miniSaved(db, userId) {
  const row = db.prepare('SELECT result_json,presentation_json,completed_at,saved_at FROM miniapp_results WHERE user_id=?').get(userId);
  if (!row) return null;
  const result = normalizeResult(JSON.parse(row.result_json));
  return { result, presentation: presentation(result), completedAt: row.completed_at, savedAt: row.saved_at };
}
function publicWebSaved(saved) {
  return saved && { result: saved.result, presentation: saved.presentation, savedAt: iso(saved.savedAt), revision: saved.revision };
}
function publicMiniSaved(saved) {
  return saved && { result: saved.result, completedAt: iso(saved.completedAt) };
}
function fingerprint(codeHash, web, mini) {
  return digest(JSON.stringify({
    codeHash,
    web: web && { revision: web.revision, savedAt: web.savedAt, result: digest(JSON.stringify(web.result)) },
    miniapp: mini && { completedAt: mini.completedAt, savedAt: mini.savedAt, result: digest(JSON.stringify(mini.result)) },
  }));
}
function codeRow(db, code, now) {
  const row = db.prepare('SELECT code_hash,web_user_id,expires_at FROM account_link_codes WHERE code_hash=?').get(digest(normalizedCode(code)));
  if (!row || row.expires_at <= now) throw codeInvalid();
  return row;
}
function insertWeb(db, userId, result, savedAt) {
  const clean = normalizeResult(result), match = presentation(clean);
  db.prepare(`INSERT INTO saved_results VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,result_schema=excluded.result_schema,framework_version=excluded.framework_version,scoring_version=excluded.scoring_version,item_bank_version=excluded.item_bank_version,reference_test_version=excluded.reference_test_version,form_id=excluded.form_id,bank_digest=excluded.bank_digest,role_match_version=excluded.role_match_version,stage=excluded.stage,summary_json=excluded.summary_json,presentation_json=excluded.presentation_json,saved_at=excluded.saved_at`).run(userId,randomUUID(),clean.schema,clean.versions.framework_version,clean.versions.scoring_version,clean.versions.item_bank_version,clean.versions.reference_test_version,clean.formId,clean.bankDigest,match.version,clean.stage,JSON.stringify(clean),JSON.stringify(match),savedAt);
  return { result: clean, presentation: match, savedAt };
}
function insertMini(db, userId, result, completedAt, savedAt) {
  const clean = normalizeResult(result), match = presentation(clean);
  db.prepare('INSERT INTO miniapp_results VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET result_json=excluded.result_json,presentation_json=excluded.presentation_json,completed_at=excluded.completed_at,saved_at=excluded.saved_at').run(userId,JSON.stringify(clean),JSON.stringify(match),completedAt,savedAt);
  return { result: clean, presentation: match, completedAt, savedAt };
}
function tombstoneMini(db, userId, now) {
  db.prepare('INSERT INTO miniapp_result_deletions VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET deleted_before=MAX(deleted_before,excluded.deleted_before)').run(userId, now);
}
function linkFor(db, { webUserId, miniappUserId }) {
  if (webUserId) return db.prepare('SELECT web_user_id,miniapp_user_id,linked_at,chosen_completed_at FROM account_links WHERE web_user_id=?').get(webUserId) || null;
  if (miniappUserId) return db.prepare('SELECT web_user_id,miniapp_user_id,linked_at,chosen_completed_at FROM account_links WHERE miniapp_user_id=?').get(miniappUserId) || null;
  throw new ApiError(400, 'INVALID_INPUT', '请检查填写内容后再试。');
}
function publicLink(db, row) {
  if (!row) return null;
  const user = db.prepare('SELECT display_name FROM users WHERE id=?').get(row.web_user_id);
  return { websiteUsername: user?.display_name || '', linkedAt: iso(row.linked_at) };
}

export function readLink(db, identity) { return publicLink(db, linkFor(db, identity)); }

export function createCode(db, webUserId, now = Date.now()) {
  return transaction(db, () => {
    assertUser(db, webUserId);
    if (linkFor(db, { webUserId })) conflict();
    db.prepare('DELETE FROM account_link_codes WHERE web_user_id=?').run(webUserId);
    let code, hash;
    do { code = rawCode(); hash = digest(code); } while (db.prepare('SELECT 1 FROM account_link_codes WHERE code_hash=?').get(hash));
    db.prepare('INSERT INTO account_link_codes VALUES (?,?,?,?)').run(hash, webUserId, now, now + CODE_TTL);
    return { code, expiresAt: iso(now + CODE_TTL) };
  });
}

export function previewLink(db, miniappUserId, code, now = Date.now()) {
  assertUser(db, miniappUserId);
  const row = codeRow(db, code, now);
  if (linkFor(db, { miniappUserId }) || linkFor(db, { webUserId: row.web_user_id })) conflict();
  const user = db.prepare('SELECT display_name FROM users WHERE id=?').get(row.web_user_id);
  const web = webSaved(db, row.web_user_id), mini = miniSaved(db, miniappUserId);
  return { website: { username: user.display_name, saved: publicWebSaved(web) }, miniapp: { saved: publicMiniSaved(mini) }, fingerprint: fingerprint(row.code_hash, web, mini), expiresAt: iso(row.expires_at) };
}

export function commitLink(db, miniappUserId, body, now = Date.now()) {
  requireFields(body, ['code', 'choice', 'expectedFingerprint']);
  if (!['website', 'miniapp', 'empty'].includes(body.choice) || typeof body.expectedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(body.expectedFingerprint))
    throw new ApiError(400, 'INVALID_INPUT', '请检查填写内容后再试。');
  return transaction(db, () => {
    assertUser(db, miniappUserId);
    const row = codeRow(db, body.code, now);
    if (linkFor(db, { miniappUserId }) || linkFor(db, { webUserId: row.web_user_id })) conflict();
    const web = webSaved(db, row.web_user_id), mini = miniSaved(db, miniappUserId);
    if (fingerprint(row.code_hash, web, mini) !== body.expectedFingerprint) throw changed();
    let selected = null, completedAt = null;
    if (body.choice === 'website') {
      if (!web) throw resultMissing();
      completedAt = web.savedAt;
      selected = insertMini(db, miniappUserId, web.result, completedAt, now);
    } else if (body.choice === 'miniapp') {
      if (!mini) throw resultMissing();
      completedAt = mini.completedAt;
      insertWeb(db, row.web_user_id, mini.result, now);
      selected = mini;
    } else {
      if (web || mini) emptyNotAllowed();
      db.prepare('DELETE FROM saved_results WHERE user_id=?').run(row.web_user_id);
      db.prepare('DELETE FROM miniapp_results WHERE user_id=?').run(miniappUserId);
    }
    // A just-linked device can hold an older local result.  Preserve the
    // selected result's own completed_at while refusing that stale local push.
    tombstoneMini(db, miniappUserId, now);
    db.prepare('INSERT INTO account_links VALUES (?,?,?,?)').run(row.web_user_id, miniappUserId, now, completedAt);
    db.prepare('DELETE FROM account_link_codes WHERE code_hash=?').run(row.code_hash);
    return { link: publicLink(db, { web_user_id: row.web_user_id, linked_at: now }), result: selected ? { result: selected.result, completedAt: iso(completedAt) } : null };
  });
}

export function unlink(db, identity) {
  return transaction(db, () => {
    const row = linkFor(db, identity);
    if (!row) throw linkMissing();
    db.prepare('DELETE FROM account_links WHERE web_user_id=?').run(row.web_user_id);
    return { ok: true };
  });
}

// These `InTransaction` forms are for app.mjs's existing result transaction.
// Their public counterparts open one transaction for callers without one.
export function syncWebSaveInTransaction(db, webUserId, now = Date.now()) {
  const row = linkFor(db, { webUserId }); if (!row) return null;
  const saved = webSaved(db, webUserId); if (!saved) return syncWebDeleteInTransaction(db, webUserId, now);
  const copied = insertMini(db, row.miniapp_user_id, saved.result, now, now);
  tombstoneMini(db, row.miniapp_user_id, now);
  return { result: copied.result, completedAt: iso(copied.completedAt) };
}
export function syncWebSave(db, webUserId, now = Date.now()) { return transaction(db, () => syncWebSaveInTransaction(db, webUserId, now)); }
export function syncMiniSaveInTransaction(db, miniappUserId, now = Date.now()) {
  const row = linkFor(db, { miniappUserId }); if (!row) return null;
  const saved = miniSaved(db, miniappUserId); if (!saved) return syncMiniDeleteInTransaction(db, miniappUserId, now);
  insertWeb(db, row.web_user_id, saved.result, now);
  return { result: saved.result, completedAt: iso(saved.completedAt) };
}
export function syncMiniSave(db, miniappUserId, now = Date.now()) { return transaction(db, () => syncMiniSaveInTransaction(db, miniappUserId, now)); }
export function syncWebDeleteInTransaction(db, webUserId, now = Date.now()) {
  const row = linkFor(db, { webUserId }); if (!row) return null;
  db.prepare('DELETE FROM miniapp_results WHERE user_id=?').run(row.miniapp_user_id); tombstoneMini(db, row.miniapp_user_id, now); return { ok: true };
}
export function syncWebDelete(db, webUserId, now = Date.now()) { return transaction(db, () => syncWebDeleteInTransaction(db, webUserId, now)); }
export function syncMiniDeleteInTransaction(db, miniappUserId, now = Date.now()) {
  const row = linkFor(db, { miniappUserId }); if (!row) return null;
  db.prepare('DELETE FROM saved_results WHERE user_id=?').run(row.web_user_id); tombstoneMini(db, miniappUserId, now); return { ok: true };
}
export function syncMiniDelete(db, miniappUserId, now = Date.now()) { return transaction(db, () => syncMiniDeleteInTransaction(db, miniappUserId, now)); }
