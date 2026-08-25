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

CREATE TABLE IF NOT EXISTS player_state (
  user_id TEXT PRIMARY KEY,
  health INTEGER NOT NULL DEFAULT 100 CHECK (health >= 0),
  max_health INTEGER NOT NULL DEFAULT 100 CHECK (max_health > 0),
  nerve INTEGER NOT NULL DEFAULT 10 CHECK (nerve >= 0),
  max_nerve INTEGER NOT NULL DEFAULT 10 CHECK (max_nerve > 0),
  energy INTEGER NOT NULL DEFAULT 100 CHECK (energy >= 0),
  max_energy INTEGER NOT NULL DEFAULT 100 CHECK (max_energy > 0),
  cash INTEGER NOT NULL DEFAULT 0 CHECK (cash >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  strength INTEGER NOT NULL DEFAULT 1 CHECK (strength >= 0),
  defense INTEGER NOT NULL DEFAULT 1 CHECK (defense >= 0),
  speed INTEGER NOT NULL DEFAULT 1 CHECK (speed >= 0),
  dexterity INTEGER NOT NULL DEFAULT 1 CHECK (dexterity >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  status_until INTEGER,
  status_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_state_status ON player_state(status);
CREATE INDEX IF NOT EXISTS idx_player_state_level ON player_state(level);


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

CREATE TABLE IF NOT EXISTS player_location (
  user_id TEXT PRIMARY KEY,
  district_id TEXT NOT NULL DEFAULT 'services',
  location_id TEXT NOT NULL DEFAULT 'rift-civic-hall',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_location_district ON player_location(district_id);
CREATE INDEX IF NOT EXISTS idx_player_location_location ON player_location(location_id);


CREATE TABLE IF NOT EXISTS player_inventory (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  equipped_slot TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_inventory_user ON player_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_equipped ON player_inventory(user_id, equipped_slot);

CREATE TABLE IF NOT EXISTS player_crime_progress (
  user_id TEXT NOT NULL,
  crime_id TEXT NOT NULL,
  mastery INTEGER NOT NULL DEFAULT 0 CHECK (mastery >= 0 AND mastery <= 100),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  successes INTEGER NOT NULL DEFAULT 0 CHECK (successes >= 0),
  failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  last_attempt_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, crime_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_crime_progress_user ON player_crime_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_player_crime_progress_mastery ON player_crime_progress(user_id, mastery);

CREATE TABLE IF NOT EXISTS crime_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  crime_id TEXT NOT NULL,
  success INTEGER NOT NULL CHECK (success IN (0,1)),
  chance REAL NOT NULL,
  nerve_spent INTEGER NOT NULL CHECK (nerve_spent >= 0),
  cash_delta INTEGER NOT NULL DEFAULT 0,
  xp_delta INTEGER NOT NULL DEFAULT 0,
  mastery_delta INTEGER NOT NULL DEFAULT 0,
  item_reward_id TEXT,
  item_reward_quantity INTEGER NOT NULL DEFAULT 0,
  consequence_status TEXT,
  consequence_until INTEGER,
  result_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crime_history_user_created ON crime_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crime_history_crime ON crime_history(user_id, crime_id, created_at DESC);



-- Massive backend expansion: server-authoritative gameplay services.
CREATE TABLE IF NOT EXISTS player_bank_accounts (
  user_id TEXT PRIMARY KEY,
  checking INTEGER NOT NULL DEFAULT 0 CHECK(checking>=0),
  savings INTEGER NOT NULL DEFAULT 0 CHECK(savings>=0),
  lifetime_deposits INTEGER NOT NULL DEFAULT 0 CHECK(lifetime_deposits>=0),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS bank_ledger (
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,
  fee INTEGER NOT NULL DEFAULT 0,balance_after INTEGER NOT NULL,created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bank_ledger_user ON bank_ledger(user_id,created_at);
CREATE TABLE IF NOT EXISTS player_investments (
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL,tier_id TEXT NOT NULL,principal INTEGER NOT NULL,
  rate REAL NOT NULL,matures_at INTEGER NOT NULL,claimed INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_investments_user ON player_investments(user_id,matures_at);

CREATE TABLE IF NOT EXISTS player_jobs (
  user_id TEXT PRIMARY KEY,job_id TEXT,skill_level INTEGER NOT NULL DEFAULT 0,
  skill_xp INTEGER NOT NULL DEFAULT 0,shifts INTEGER NOT NULL DEFAULT 0,last_work_at INTEGER,updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS player_education (
  user_id TEXT NOT NULL,course_id TEXT NOT NULL,status TEXT NOT NULL,
  started_at INTEGER,completes_at INTEGER,completed_at INTEGER,
  PRIMARY KEY(user_id,course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS player_gym (
  user_id TEXT PRIMARY KEY,gym_exp INTEGER NOT NULL DEFAULT 0,streak INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,last_train_at INTEGER,updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS player_properties (
  user_id TEXT NOT NULL,property_id TEXT NOT NULL,is_home INTEGER NOT NULL DEFAULT 0,
  purchased_at INTEGER NOT NULL,PRIMARY KEY(user_id,property_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS player_factions (
  user_id TEXT PRIMARY KEY,faction_id TEXT,reputation INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,jobs_done INTEGER NOT NULL DEFAULT 0,last_work_at INTEGER,updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS player_progress_counters (
  user_id TEXT NOT NULL,metric TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,metric),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS player_missions (
  user_id TEXT NOT NULL,mission_id TEXT NOT NULL,claimed INTEGER NOT NULL DEFAULT 0,claimed_at INTEGER,
  PRIMARY KEY(user_id,mission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS player_market_positions (
  user_id TEXT NOT NULL,asset_id TEXT NOT NULL,quantity INTEGER NOT NULL DEFAULT 0,
  average_cost INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,asset_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS auction_listings (
  id TEXT PRIMARY KEY,seller_user_id TEXT NOT NULL,item_id TEXT NOT NULL,quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'active',buyer_user_id TEXT,
  created_at INTEGER NOT NULL,completed_at INTEGER,
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_auction_active ON auction_listings(status,created_at);
CREATE TABLE IF NOT EXISTS player_casino (
  user_id TEXT PRIMARY KEY,chips INTEGER NOT NULL DEFAULT 0,last_daily_grant INTEGER,updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
