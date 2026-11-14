CREATE TABLE tower_waystation_donations (
  player_id TEXT NOT NULL REFERENCES tower_players(player_id),
  operation TEXT NOT NULL,
  site TEXT NOT NULL CHECK(site IN ('fire','supplies')),
  name TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY(player_id,operation)
);
CREATE INDEX tower_waystation_site ON tower_waystation_donations(site,at);
CREATE TRIGGER tower_waystation_take_timber AFTER INSERT ON tower_waystation_donations BEGIN
  UPDATE tower_players
  SET state_json=json_set(state_json,'$.woodcutting.timber',json_extract(state_json,'$.woodcutting.timber')-1),
      revision=revision+1,last_request=NEW.operation,updated_at=NEW.at
  WHERE player_id=NEW.player_id;
END;
