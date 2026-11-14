CREATE TABLE tower_market_sales (
  operation TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL,
  sold_at INTEGER NOT NULL
);
CREATE INDEX tower_market_sales_item_time ON tower_market_sales(item,sold_at);

CREATE TABLE tower_market_appraisals (
 player_id TEXT PRIMARY KEY,
 operation TEXT NOT NULL,
 receipt TEXT NOT NULL
);
