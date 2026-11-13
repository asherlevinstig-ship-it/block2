CREATE TABLE IF NOT EXISTS tower_vault_parties (
 party_id TEXT PRIMARY KEY,
 version INTEGER NOT NULL DEFAULT 0,
 state_json TEXT NOT NULL,
 last_operation TEXT NOT NULL DEFAULT '',
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tower_vault_parties_expiry ON tower_vault_parties(expires_at);
