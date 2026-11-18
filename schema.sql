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
-- Saved search conditions (a query string of src/filter.mjs): new exhibitions that match are sent like followed artists.
CREATE TABLE IF NOT EXISTS searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, query)
);
-- Venues people asked us to add (from /request/). The build workflow files them as a GitHub issue, then marks them reported.
CREATE TABLE IF NOT EXISTS venue_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  sender TEXT NOT NULL DEFAULT '',  -- hashed IP + day, only to limit how many one person can send
  reported INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- How often the LINE buttons are pressed, per day, button and page. No user data: just counts.
CREATE TABLE IF NOT EXISTS clicks (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  page TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, page)
);
