CREATE TABLE tower_trail_camp (
  id INTEGER PRIMARY KEY CHECK (id=1),
  lit_until INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0,
  mutation TEXT NOT NULL DEFAULT ''
);
INSERT INTO tower_trail_camp (id) VALUES (1);
