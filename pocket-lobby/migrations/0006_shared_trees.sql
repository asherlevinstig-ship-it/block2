CREATE TABLE IF NOT EXISTS tower_trees (
 tree_key TEXT PRIMARY KEY,
 room TEXT NOT NULL,
 cuts INTEGER NOT NULL DEFAULT 0,
 regrows_at INTEGER NOT NULL DEFAULT 0,
 generation INTEGER NOT NULL DEFAULT 0,
 version INTEGER NOT NULL DEFAULT 0,
 hit_at INTEGER NOT NULL DEFAULT 0,
 fall_direction INTEGER NOT NULL DEFAULT 1,
 last_cut_id TEXT,
 last_player_id TEXT
);
CREATE INDEX IF NOT EXISTS tower_trees_room ON tower_trees(room);
