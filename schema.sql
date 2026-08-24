PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','moderator','admin','developer')),
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  error_id TEXT UNIQUE,
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR')),
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

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_logs_error_id ON system_logs(error_id);
