ALTER TABLE tower_factions ADD COLUMN founding_fee INTEGER NOT NULL DEFAULT 0 CHECK (founding_fee >= 0);

CREATE TRIGGER tower_faction_charge AFTER INSERT ON tower_factions
WHEN NEW.founding_fee > 0
BEGIN
  UPDATE tower_players
  SET state_json=json_set(state_json,'$.credits',json_extract(state_json,'$.credits')-NEW.founding_fee),
      revision=revision+1,
      last_request='faction:'||NEW.faction_id,
      updated_at=NEW.created_at
  WHERE player_id=NEW.leader_id;
END;
