PRAGMA foreign_keys = ON;

-- Hard-cut migration: retire the old gameplay/builder persistence.
DROP TABLE IF EXISTS ai_builder_drafts;
DROP TABLE IF EXISTS ironvale_world_flags;
DROP TABLE IF EXISTS ironvale_quest_progress;
DROP TABLE IF EXISTS ironvale_equipment;
DROP TABLE IF EXISTS ironvale_inventory;
DROP TABLE IF EXISTS ironvale_character_profiles;
DROP TABLE IF EXISTS ironvale_characters;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS system_logs;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  is_banned INTEGER NOT NULL DEFAULT 0,
  ban_reason TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS rift_characters (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  position_x REAL NOT NULL DEFAULT 160,
  position_y REAL NOT NULL DEFAULT 10,
  position_z REAL NOT NULL DEFAULT 160,
  yaw REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
