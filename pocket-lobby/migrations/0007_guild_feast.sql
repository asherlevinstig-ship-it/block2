CREATE TABLE tower_feast_supplies (
 faction_id TEXT NOT NULL REFERENCES tower_factions(faction_id) ON DELETE CASCADE,
 day INTEGER NOT NULL, player_id TEXT NOT NULL REFERENCES tower_players(player_id),
 operation TEXT NOT NULL, resource TEXT NOT NULL, inventory_path TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0), donated_at INTEGER NOT NULL,
 PRIMARY KEY(player_id,operation)
);
CREATE INDEX tower_feast_progress ON tower_feast_supplies(faction_id,day,resource);
CREATE TRIGGER tower_feast_debit AFTER INSERT ON tower_feast_supplies BEGIN
 UPDATE tower_players SET state_json=json_set(state_json,NEW.inventory_path,json_extract(state_json,NEW.inventory_path)-NEW.quantity),revision=revision+1,last_request=NEW.operation,updated_at=NEW.donated_at WHERE player_id=NEW.player_id;
END;
CREATE TABLE tower_feast_claims (
 player_id TEXT NOT NULL REFERENCES tower_players(player_id),day INTEGER NOT NULL,
 faction_id TEXT NOT NULL REFERENCES tower_factions(faction_id) ON DELETE CASCADE,
 operation TEXT NOT NULL,claimed_at INTEGER NOT NULL,PRIMARY KEY(player_id,day)
);
CREATE TRIGGER tower_feast_feed AFTER INSERT ON tower_feast_claims BEGIN
 UPDATE tower_players SET state_json=json_set(state_json,'$.vitals.hunger',MIN(100,COALESCE(json_extract(state_json,'$.vitals.hunger'),100)+50)),revision=revision+1,last_request=NEW.operation,updated_at=NEW.claimed_at WHERE player_id=NEW.player_id;
END;
