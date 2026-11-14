CREATE TABLE tower_silverfin_suppers (
  id TEXT PRIMARY KEY,
  first_id TEXT NOT NULL REFERENCES tower_players(player_id),
  second_id TEXT NOT NULL REFERENCES tower_players(player_id),
  created_at INTEGER NOT NULL,
  CHECK(first_id<>second_id)
);
CREATE INDEX tower_supper_first ON tower_silverfin_suppers(first_id,created_at);
CREATE INDEX tower_supper_second ON tower_silverfin_suppers(second_id,created_at);
CREATE TABLE tower_supper_fish (
  supper_id TEXT NOT NULL REFERENCES tower_silverfin_suppers(id),
  player_id TEXT NOT NULL REFERENCES tower_players(player_id),
  fish_path TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY(supper_id,player_id)
);
CREATE TRIGGER tower_cook_silverfin AFTER INSERT ON tower_supper_fish BEGIN
  UPDATE tower_players
  SET state_json=json_set(state_json,NEW.fish_path,json_extract(state_json,NEW.fish_path)-1),
      revision=revision+1,last_request='supper:'||NEW.supper_id,updated_at=NEW.at
  WHERE player_id=NEW.player_id;
  UPDATE tower_players
  SET state_json=json_set(state_json,'$.meals.silverfinSupper',COALESCE(json_extract(state_json,'$.meals.silverfinSupper'),0)+1),
      revision=revision+1,last_request='supper:'||NEW.supper_id,updated_at=NEW.at
  WHERE player_id IN (SELECT player_id FROM tower_supper_fish WHERE supper_id=NEW.supper_id)
    AND (SELECT COUNT(*) FROM tower_supper_fish WHERE supper_id=NEW.supper_id)=2;
END;
CREATE TABLE tower_supper_gifts (
  supper_id TEXT NOT NULL REFERENCES tower_silverfin_suppers(id),
  sender_id TEXT NOT NULL REFERENCES tower_players(player_id),
  recipient_id TEXT NOT NULL REFERENCES tower_players(player_id),
  at INTEGER NOT NULL,
  PRIMARY KEY(supper_id,sender_id)
);
CREATE TRIGGER tower_share_supper AFTER INSERT ON tower_supper_gifts BEGIN
  UPDATE tower_players
  SET state_json=json_set(state_json,'$.meals.silverfinSupper',COALESCE(json_extract(state_json,'$.meals.silverfinSupper'),0)
        + CASE WHEN player_id=NEW.sender_id THEN -1 ELSE 1 END),
      revision=revision+1,last_request='supper:'||NEW.supper_id,updated_at=NEW.at
  WHERE player_id IN (NEW.sender_id,NEW.recipient_id);
END;
