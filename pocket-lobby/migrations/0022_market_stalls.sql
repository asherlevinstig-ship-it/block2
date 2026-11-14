CREATE TABLE tower_market_stalls (
  listing_id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  item TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity>=0),
  price INTEGER NOT NULL CHECK(price>0),
  expires_at INTEGER NOT NULL,
  mutation TEXT NOT NULL
);
CREATE INDEX tower_market_stall_seller ON tower_market_stalls(seller_id);
CREATE INDEX tower_market_stall_offers ON tower_market_stalls(item,price,expires_at);
CREATE TABLE tower_market_proceeds (
  seller_id TEXT PRIMARY KEY,
  gold INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);
