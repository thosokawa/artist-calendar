-- LINE friends who follow artists, and which exhibitions each has already been told about.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                -- LINE user id
  active INTEGER NOT NULL DEFAULT 1,  -- 0 after they block the account
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS follows (
  user_id TEXT NOT NULL,
  artist TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, artist)
);
CREATE INDEX IF NOT EXISTS follows_by_artist ON follows (artist);
CREATE TABLE IF NOT EXISTS notified (
  user_id TEXT NOT NULL,
  exhibition_id TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, exhibition_id)
);
