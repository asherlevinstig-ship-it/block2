CREATE TABLE IF NOT EXISTS tower_external_accounts (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  school_id INTEGER NOT NULL,
  account_id TEXT NOT NULL UNIQUE REFERENCES tower_accounts(account_id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE TABLE IF NOT EXISTS tower_login_flows (
  state_hash TEXT PRIMARY KEY,
  player_id TEXT,
  account_id TEXT,
  expires_at INTEGER NOT NULL
);
