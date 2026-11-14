CREATE TABLE tower_hearth_invites (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  meal TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX tower_hearth_recipient ON tower_hearth_invites(recipient, expires_at);
CREATE INDEX tower_hearth_sender ON tower_hearth_invites(sender, expires_at);
