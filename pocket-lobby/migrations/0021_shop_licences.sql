CREATE TABLE tower_shop_licences (
  shop TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  PRIMARY KEY (shop, starts_at)
);
CREATE INDEX tower_shop_owner ON tower_shop_licences(owner_id);
CREATE TABLE tower_shop_earnings (
  owner_id TEXT PRIMARY KEY,
  tenths INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE tower_shop_sales (
  shop TEXT NOT NULL,
  day INTEGER NOT NULL,
  gold INTEGER NOT NULL,
  PRIMARY KEY (shop, day)
);
