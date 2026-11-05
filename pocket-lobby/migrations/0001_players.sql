CREATE TABLE IF NOT EXISTS tower_players (
  player_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  last_request TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);