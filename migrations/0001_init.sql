-- ESL Master Vocab — Cloudflare D1 schema
-- Apply with: wrangler d1 execute esl-master-vocab-db --file=./migrations/0001_init.sql --remote

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  username          TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  password_salt     TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'user',      -- 'admin' | 'user'
  full_name         TEXT,
  country           TEXT,
  avatar            TEXT,
  cefr_level        TEXT NOT NULL DEFAULT 'A2',
  daily_goal        INTEGER NOT NULL DEFAULT 10,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  last_study_date   TEXT,
  join_date         TEXT NOT NULL,
  last_login        TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  pretest_done      INTEGER NOT NULL DEFAULT 0,
  pretest_score     INTEGER,
  pretest_level     TEXT,
  pretest_date      TEXT
);

-- Login sessions. One row per signed-in device/browser, so the same
-- account can be logged in on a phone and a laptop at once.
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Everything a learner accumulates in the app (their own added words,
-- per-word progress overlay, study sessions, profile stats, settings,
-- practice submissions, spelling streak, roleplay progress, etc.) is
-- stored as a single JSON blob per user. The client already shapes this
-- as a flat key→JSON-string map (mirrors how it used to use
-- localStorage), so the server just stores/returns that map verbatim —
-- no schema migration needed when the app adds new local keys later.
CREATE TABLE IF NOT EXISTS user_data (
  user_id     TEXT PRIMARY KEY,
  data        TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT
);

-- Single global row: the AI provider keys an admin configures in
-- Admin → AI Keys, shared by every learner's account (writable by admins
-- only, readable by any signed-in user since the browser calls the AI
-- providers directly).
CREATE TABLE IF NOT EXISTS app_config (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  google_key        TEXT NOT NULL DEFAULT '',
  elevenlabs_key    TEXT NOT NULL DEFAULT '',
  elevenlabs_voice  TEXT NOT NULL DEFAULT 'JBFqnCBsd6RMkjVDRZzb'
);
INSERT OR IGNORE INTO app_config (id, google_key, elevenlabs_key, elevenlabs_voice)
VALUES (1, '', '', 'JBFqnCBsd6RMkjVDRZzb');
