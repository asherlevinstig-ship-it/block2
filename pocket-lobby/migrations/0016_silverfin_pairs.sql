CREATE TABLE tower_silverfin_pairs (
  day INTEGER NOT NULL,
  player_id TEXT NOT NULL REFERENCES tower_players(player_id),
  faction_id TEXT NOT NULL REFERENCES tower_factions(faction_id) ON DELETE CASCADE,
  PRIMARY KEY(day,player_id)
);
CREATE INDEX tower_silverfin_pairs_faction ON tower_silverfin_pairs(faction_id,day);
