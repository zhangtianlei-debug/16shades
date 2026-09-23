CREATE TABLE friend_invites (
  token_hash TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL CHECK(length(subject_name) BETWEEN 1 AND 48),
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_friend_invites_owner ON friend_invites(owner_id, created_at DESC);

CREATE TABLE friend_invite_responses (
  id TEXT PRIMARY KEY,
  invite_token_hash TEXT NOT NULL REFERENCES friend_invites(token_hash) ON DELETE CASCADE,
  submission_hash TEXT NOT NULL,
  nickname TEXT CHECK(nickname IS NULL OR length(nickname) BETWEEN 1 AND 36),
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  presentation_json TEXT NOT NULL CHECK(json_valid(presentation_json)),
  created_at INTEGER NOT NULL,
  UNIQUE(invite_token_hash, submission_hash)
) STRICT;
CREATE INDEX idx_friend_invite_responses_invite ON friend_invite_responses(invite_token_hash, created_at ASC);
