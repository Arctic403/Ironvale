PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('player','moderator','admin','developer')),
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

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_user_id TEXT,
  details_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  error_id TEXT UNIQUE,
  severity TEXT NOT NULL CHECK(severity IN ('INFO','WARNING','ERROR')),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  route TEXT,
  method TEXT,
  request_id TEXT,
  user_id TEXT,
  context_json TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_logs_error_id ON system_logs(error_id);

CREATE TABLE IF NOT EXISTS ironvale_characters (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  health INTEGER NOT NULL DEFAULT 100,
  max_health INTEGER NOT NULL DEFAULT 100,
  stamina INTEGER NOT NULL DEFAULT 100,
  max_stamina INTEGER NOT NULL DEFAULT 100,
  coin INTEGER NOT NULL DEFAULT 0,
  strength INTEGER NOT NULL DEFAULT 5,
  agility INTEGER NOT NULL DEFAULT 5,
  vitality INTEGER NOT NULL DEFAULT 5,
  willpower INTEGER NOT NULL DEFAULT 5,
  zone_id TEXT NOT NULL DEFAULT 'brackenford-lowlands',
  spawn_id TEXT NOT NULL DEFAULT 'brackenford',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ironvale_character_zone ON ironvale_characters(zone_id);

CREATE TABLE IF NOT EXISTS ironvale_inventory (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 0),
  durability INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,item_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ironvale_inventory_user ON ironvale_inventory(user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS ironvale_equipment (
  user_id TEXT PRIMARY KEY,
  head TEXT, chest TEXT, hands TEXT, legs TEXT, feet TEXT,
  main_hand TEXT, off_hand TEXT, neck TEXT, ring TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ironvale_quest_progress (
  user_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  progress_json TEXT NOT NULL DEFAULT '{}',
  started_at INTEGER,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,quest_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ironvale_quests_user_status ON ironvale_quest_progress(user_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS ironvale_world_flags (
  user_id TEXT NOT NULL,
  flag_id TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT 'null',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,flag_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rift Engine AI Builder review inbox retained as authoring infrastructure.
CREATE TABLE IF NOT EXISTS ai_builder_drafts (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  name TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'public-ai-builder',
  tool_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  loaded_at INTEGER,
  loaded_by TEXT,
  FOREIGN KEY(loaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_builder_drafts_created ON ai_builder_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_builder_drafts_loaded ON ai_builder_drafts(loaded_at,created_at DESC);

