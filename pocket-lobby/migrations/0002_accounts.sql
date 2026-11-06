CREATE TABLE IF NOT EXISTS tower_accounts (
  account_id TEXT PRIMARY KEY,
  username_key TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  player_id TEXT NOT NULL UNIQUE REFERENCES tower_players(player_id),
  password_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tower_sessions (
  session_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES tower_accounts(account_id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tower_sessions_account ON tower_sessions(account_id);
CREATE TABLE IF NOT EXISTS tower_auth_limits (
  limit_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL
);
