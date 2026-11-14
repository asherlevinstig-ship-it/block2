CREATE TABLE tower_gifts (
  sender_id TEXT NOT NULL REFERENCES tower_players(player_id),
  operation TEXT NOT NULL,
  receipt TEXT NOT NULL,
  PRIMARY KEY(sender_id,operation)
);
