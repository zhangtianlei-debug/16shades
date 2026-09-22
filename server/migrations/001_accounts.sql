-- A person owns results. Identities are ways to authenticate that person.
-- Adding email/phone/WeChat never changes result ownership or user IDs.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  issuer TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  identifier_display TEXT,
  verified_at INTEGER,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  UNIQUE(provider, issuer, subject)
) STRICT;
CREATE INDEX idx_identities_user ON identities(user_id);

-- Password credentials exist only for a local identity; OAuth identities do
-- not receive an empty password. Future links require an authenticated flow.
CREATE TABLE password_credentials (
  identity_id TEXT PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  changed_at INTEGER NOT NULL
) STRICT;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE recovery_codes (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE saved_results (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision TEXT NOT NULL,
  result_schema TEXT NOT NULL,
  framework_version TEXT NOT NULL,
  scoring_version TEXT NOT NULL,
  item_bank_version TEXT NOT NULL,
  reference_test_version TEXT NOT NULL,
  form_id TEXT NOT NULL,
  bank_digest TEXT NOT NULL,
  role_match_version TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('basic', 'full')),
  summary_json TEXT NOT NULL CHECK(json_valid(summary_json)),
  presentation_json TEXT NOT NULL CHECK(json_valid(presentation_json)),
  saved_at INTEGER NOT NULL
) STRICT;

-- Expiring, HMAC-keyed counters: no raw username/IP and no request bodies.
CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);

CREATE TABLE captcha_uses (
  challenge_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_captcha_uses_expires ON captcha_uses(expires_at);

-- Anonymous counts only. Client event IDs are retained briefly for deduping.
CREATE TABLE metric_totals (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY(day, event)
) STRICT;
CREATE TABLE metric_receipts (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_metric_receipts_expires ON metric_receipts(expires_at);
