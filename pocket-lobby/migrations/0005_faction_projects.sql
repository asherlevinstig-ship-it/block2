CREATE TABLE tower_faction_donations (
  faction_id TEXT NOT NULL REFERENCES tower_factions(faction_id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES tower_players(player_id),
  operation TEXT NOT NULL,
  resource TEXT NOT NULL CHECK (resource IN ('gold','timber','meal')),
  inventory_path TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  donated_at INTEGER NOT NULL,
  PRIMARY KEY (player_id,operation)
);
CREATE INDEX tower_faction_donations_project ON tower_faction_donations (faction_id,resource);
CREATE TRIGGER tower_faction_donation_debit AFTER INSERT ON tower_faction_donations
BEGIN
  UPDATE tower_players
  SET state_json=json_set(state_json,NEW.inventory_path,json_extract(state_json,NEW.inventory_path)-NEW.quantity),
      revision=revision+1,
      last_request=NEW.operation,
      updated_at=NEW.donated_at
  WHERE player_id=NEW.player_id;
END;
