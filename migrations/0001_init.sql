CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  phone      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  sender_id  TEXT NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL DEFAULT 'text',
  content    TEXT,
  media_key  TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO users (id, phone, name) VALUES ('u1', '111', 'Root');
INSERT INTO users (id, phone, name) VALUES ('u2', '222', 'Friend');
