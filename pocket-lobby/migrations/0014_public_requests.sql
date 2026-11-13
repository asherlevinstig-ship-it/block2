CREATE TABLE IF NOT EXISTS tower_public_projects (
  id TEXT PRIMARY KEY,
  delivered INTEGER NOT NULL DEFAULT 0 CHECK (delivered BETWEEN 0 AND 120)
);
INSERT OR IGNORE INTO tower_public_projects (id, delivered) VALUES ('pond-bridge', 0);
