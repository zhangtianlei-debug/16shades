-- Website and mini-program accounts remain separate owners.  A link only
-- permits an explicit, reversible result copy; it never merges identities or
-- invitation ownership.
CREATE TABLE account_links (
  web_user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  miniapp_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  linked_at INTEGER NOT NULL,
  chosen_completed_at INTEGER
) STRICT;
CREATE INDEX idx_account_links_miniapp ON account_links(miniapp_user_id);

-- The raw twelve-character code is intentionally never persisted.
CREATE TABLE account_link_codes (
  code_hash TEXT PRIMARY KEY,
  web_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_account_link_codes_web ON account_link_codes(web_user_id);
CREATE INDEX idx_account_link_codes_expires ON account_link_codes(expires_at);
