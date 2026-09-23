-- Mini-program identities deliberately have their own sessions.  An OpenID is
-- never stored in clear text and is never usable as a website login.
CREATE TABLE miniapp_identities (
  openid_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
) STRICT;
CREATE TABLE miniapp_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_miniapp_sessions_user ON miniapp_sessions(user_id);
CREATE INDEX idx_miniapp_sessions_expires ON miniapp_sessions(expires_at);
CREATE TABLE miniapp_login_codes (
  code_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_miniapp_login_codes_expires ON miniapp_login_codes(expires_at);
CREATE TABLE miniapp_results (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  presentation_json TEXT NOT NULL CHECK(json_valid(presentation_json)),
  completed_at INTEGER NOT NULL,
  saved_at INTEGER NOT NULL
) STRICT;
CREATE TABLE miniapp_result_deletions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  deleted_before INTEGER NOT NULL
) STRICT;
