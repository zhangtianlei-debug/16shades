import { randomUUID } from 'node:crypto';
import { ApiError, digest, requireFields, token } from './security.mjs';
import { normalizeResult, presentation } from './result.mjs';

const name = (value, max, code) => {
  if (typeof value !== 'string') throw new ApiError(400, code, '请检查填写内容后再试。');
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean || Array.from(clean).length > max)
    throw new ApiError(400, code, '请检查填写内容后再试。');
  return clean;
};
const submission = (value) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value))
    throw new ApiError(400, 'SUBMISSION_ID_INVALID', '请重新提交。');
  return value.toLowerCase();
};
const publicInvite = (row, rawToken) => ({ token: rawToken, subjectName: row.subject_name, createdAt: new Date(row.created_at).toISOString() });
const response = (row) => ({ id: row.id, nickname: row.nickname, result: JSON.parse(row.result_json), presentation: JSON.parse(row.presentation_json), createdAt: new Date(row.created_at).toISOString() });
const nickname = (value) => {
  if (typeof value !== 'string') throw new ApiError(400, 'NICKNAME_INVALID', '请检查填写内容后再试。');
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  if (Array.from(clean).length > 36) throw new ApiError(400, 'NICKNAME_INVALID', '请检查填写内容后再试。');
  return clean;
};

export function createInvite(db, ownerId, body, now = Date.now()) {
  requireFields(body, ['subjectName']);
  const subjectName = name(body.subjectName, 48, 'SUBJECT_NAME_INVALID');
  const rawToken = token();
  if (db.prepare('SELECT count(*) AS n FROM friend_invites WHERE owner_id=?').get(ownerId).n >= 20)
    throw new ApiError(409, 'INVITE_LIMIT_REACHED', '当前邀请数量已达上限。');
  db.prepare('INSERT INTO friend_invites VALUES (?,?,?,?,?)').run(digest(rawToken), rawToken, ownerId, subjectName, now);
  return { token: rawToken, subjectName, createdAt: new Date(now).toISOString() };
}
export function ownerInvites(db, ownerId) {
  const invites = db.prepare('SELECT token_hash,token,subject_name,created_at FROM friend_invites WHERE owner_id=? ORDER BY created_at DESC').all(ownerId);
  const responses = db.prepare('SELECT id,nickname,result_json,presentation_json,created_at FROM friend_invite_responses WHERE invite_token_hash=? ORDER BY created_at ASC');
  return invites.map((row) => ({ id: row.token, token: row.token, subjectName: row.subject_name, createdAt: new Date(row.created_at).toISOString(), responses: responses.all(row.token_hash).map(response) }));
}
export function publicInviteByToken(db, rawToken) {
  if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return null;
  const row = db.prepare('SELECT subject_name,created_at FROM friend_invites WHERE token_hash=?').get(digest(rawToken));
  return row ? publicInvite(row, rawToken) : null;
}
export function deleteInvite(db, ownerId, rawToken) {
  if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) throw new ApiError(404, 'INVITE_NOT_FOUND', '邀请已失效或不存在。');
  const deleted = db.prepare('DELETE FROM friend_invites WHERE token_hash=? AND owner_id=?').run(digest(rawToken), ownerId);
  if (deleted.changes !== 1) throw new ApiError(404, 'INVITE_NOT_FOUND', '邀请已失效或不存在。');
}
export function submitResponse(db, rawToken, body, now = Date.now()) {
  if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) throw new ApiError(404, 'INVITE_NOT_FOUND', '邀请已失效或不存在。');
  requireFields(body, ['nickname', 'result', 'submissionId']);
  const tokenHash = digest(rawToken);
  if (!db.prepare('SELECT 1 FROM friend_invites WHERE token_hash=?').get(tokenHash)) throw new ApiError(404, 'INVITE_NOT_FOUND', '邀请已失效或不存在。');
  const submissionHash = digest(submission(body.submissionId));
  const existing = db.prepare('SELECT id,nickname,result_json,presentation_json,created_at FROM friend_invite_responses WHERE invite_token_hash=? AND submission_hash=?').get(tokenHash, submissionHash);
  if (existing) return response(existing);
  if (db.prepare('SELECT count(*) AS n FROM friend_invite_responses WHERE invite_token_hash=?').get(tokenHash).n >= 200)
    throw new ApiError(409, 'RESPONSE_LIMIT_REACHED', '当前邀请已收到较多回应。');
  const result = normalizeResult(body.result);
  if (result.stage !== 'full') throw new ApiError(400, 'FULL_RESULT_REQUIRED', '请完成全部题目后再提交。');
  const match = presentation(result);
  const row = { id: randomUUID(), nickname: nickname(body.nickname), result: JSON.stringify(result), presentation: JSON.stringify(match), createdAt: now };
  try {
    db.prepare('INSERT INTO friend_invite_responses VALUES (?,?,?,?,?,?,?)').run(row.id, tokenHash, submissionHash, row.nickname, row.result, row.presentation, row.createdAt);
  } catch (error) {
    const raced = db.prepare('SELECT id,nickname,result_json,presentation_json,created_at FROM friend_invite_responses WHERE invite_token_hash=? AND submission_hash=?').get(tokenHash, submissionHash);
    if (raced) return response(raced);
    throw error;
  }
  return { id: row.id, nickname: row.nickname, result, presentation: match, createdAt: new Date(now).toISOString() };
}
