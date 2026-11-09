CREATE TABLE tower_factions (
  faction_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  leader_id TEXT NOT NULL REFERENCES tower_players(player_id),
  created_at INTEGER NOT NULL
);

CREATE TABLE tower_faction_members (
  player_id TEXT PRIMARY KEY REFERENCES tower_players(player_id),
  member_id TEXT NOT NULL UNIQUE,
  faction_id TEXT NOT NULL REFERENCES tower_factions(faction_id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL
);

CREATE INDEX tower_faction_roster ON tower_faction_members(faction_id, joined_at);

CREATE TRIGGER tower_faction_founder AFTER INSERT ON tower_factions
BEGIN
  INSERT INTO tower_faction_members (player_id, member_id, faction_id, joined_at)
  VALUES (NEW.leader_id, NEW.faction_id, NEW.faction_id, NEW.created_at);
END;
