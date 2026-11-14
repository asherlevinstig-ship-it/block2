CREATE TABLE tower_silverfin_watch (
  day INTEGER NOT NULL,
  player_id TEXT NOT NULL REFERENCES tower_players(player_id),
  faction_id TEXT REFERENCES tower_factions(faction_id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (day, player_id)
);
CREATE INDEX tower_silverfin_faction ON tower_silverfin_watch(faction_id, day);
