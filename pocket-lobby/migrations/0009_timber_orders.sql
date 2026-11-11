CREATE TABLE tower_timber_orders (
  order_id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES tower_players(player_id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price BETWEEN 1 AND 1000),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 200),
  remaining INTEGER NOT NULL CHECK (remaining BETWEEN 0 AND quantity),
  ready INTEGER NOT NULL CHECK (ready BETWEEN 0 AND quantity - remaining),
  created_at INTEGER NOT NULL,
  mutation TEXT NOT NULL
);
CREATE INDEX tower_timber_orders_buyer ON tower_timber_orders(buyer_id, created_at);
CREATE INDEX tower_timber_orders_open ON tower_timber_orders(price DESC, created_at, order_id) WHERE remaining > 0;
