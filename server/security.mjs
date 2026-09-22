import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(nodeScrypt);
export const token = () => randomBytes(32).toString('base64url');
export const digest = (value) =>
  createHash('sha256').update(value).digest('hex');
export const keyed = (secret, value) =>
  createHmac('sha256', secret).update(value).digest('hex');
export const safeEqual = (a, b) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    Object.assign(this, { status, code, extra });
  }
}
export function requireFields(body, allowed, required = allowed) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !allowed.includes(key)) ||
    required.some((key) => !(key in body))
  ) {
    throw new ApiError(400, 'INVALID_INPUT', '请检查填写内容后再试。');
  }
}
export function username(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{4,24}$/.test(value))
    throw new ApiError(
      400,
      'USERNAME_FORMAT',
      '用户名使用4—24位英文字母、数字或下划线。',
    );
  return value.toLowerCase();
}
export function password(value, confirmation, user = '') {
  if (
    typeof value !== 'string' ||
    Array.from(value).length < 8 ||
    Array.from(value).length > 128 ||
    Array.from(value).some(
      (char) => char.codePointAt(0) < 32 || char.codePointAt(0) === 127,
    )
  ) {
    throw new ApiError(400, 'PASSWORD_FORMAT', '密码至少8位，最多128位。');
  }
  if (confirmation !== undefined && value !== confirmation)
    throw new ApiError(400, 'PASSWORD_MISMATCH', '两次输入的密码不一致。');
  const simple = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const common = [
    'password',
    'qwerty',
    '123456',
    'letmein',
    'iloveyou',
    'admin',
  ];
  if (
    new Set(value).size < 4 ||
    [
      '12345678',
      '123456789',
      '1234567890',
      '87654321',
      '987654321',
      'qwertyuiop',
      'abcdefgh',
    ].includes(simple) ||
    common.some((word) => simple.replace(/[0-9]/g, '') === word) ||
    (user && value.toLowerCase() === user)
  ) {
    throw new ApiError(400, 'PASSWORD_WEAK', '这个密码太容易猜到，请换一个。');
  }
  return value;
}

// Two concurrent 128 MiB jobs and at most four waiting jobs. Per-IP and
// per-account limits precede this bounded gate; there is no unbounded queue.
export function passwordService() {
  let active = 0;
  const waiting = [];
  const options = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
  async function derive(value, salt) {
    if (active >= 2) {
      if (waiting.length >= 4)
        throw new ApiError(503, 'BUSY', '当前请求较多，请稍后重试。');
      await new Promise((resolve) => waiting.push(resolve));
    }
    active++;
    try {
      return await scrypt(value, salt, 64, options);
    } finally {
      active--;
      waiting.shift()?.();
    }
  }
  return {
    async hash(value) {
      const salt = randomBytes(16).toString('hex');
      return `scrypt$131072$8$1$${salt}$${(await derive(value, salt)).toString('hex')}`;
    },
    async verify(value, stored) {
      if (typeof value !== 'string' || value.length > 1024) return false;
      const parts = stored?.split('$');
      const valid =
        parts?.length === 6 &&
        parts.slice(0, 4).join('$') === 'scrypt$131072$8$1';
      const salt = valid ? parts[4] : '00000000000000000000000000000000';
      const actual = (await derive(value, salt)).toString('hex');
      return !!valid && safeEqual(actual, parts[5]);
    },
  };
}

export function rateLimit(
  db,
  secret,
  dimension,
  limit,
  windowMs,
  now = Date.now(),
) {
  const bucket = keyed(secret, dimension);
  const existing = db
    .prepare('SELECT count,expires_at FROM rate_limits WHERE bucket=?')
    .get(bucket);
  if (existing && existing.expires_at > now && existing.count >= limit) {
    throw new ApiError(429, 'RATE_LIMITED', '尝试较频繁，请稍后再试。', {
      retryAfter: Math.ceil((existing.expires_at - now) / 1000),
    });
  }
  if (!existing || existing.expires_at <= now)
    db.prepare(
      'INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=1,expires_at=excluded.expires_at',
    ).run(bucket, now + windowMs);
  else
    db.prepare('UPDATE rate_limits SET count=count+1 WHERE bucket=?').run(
      bucket,
    );
}
