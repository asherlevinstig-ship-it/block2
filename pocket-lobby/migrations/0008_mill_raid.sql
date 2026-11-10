CREATE TABLE tower_mill_raids (
 raid_id INTEGER PRIMARY KEY,
 version INTEGER NOT NULL DEFAULT 0,
 state_json TEXT NOT NULL,
 last_operation TEXT NOT NULL DEFAULT ''
);
