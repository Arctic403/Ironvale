import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`[cloudflare-efficiency] ${label}: expected block not found`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`[cloudflare-efficiency] ${label}: expected block is not unique`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}
function replaceRegex(source, regex, replacement, label) {
  const matches = source.match(regex);
  if (!matches) throw new Error(`[cloudflare-efficiency] ${label}: expected pattern not found`);
  return source.replace(regex, replacement);
}
let index = read('src/index.js');
index = replaceOnce(index,
  "import { getLawState, getLawChancePenalty, applyCrimeHeat, recordActivity } from './services/living-city.js';\n",
  "import { getLawState, getLawChancePenalty, applyCrimeHeat, recordActivity } from './services/living-city.js';\nimport { buildRiftSyncSnapshot, RIFT_SYNC_VERSION } from './services/sync.js';\n",
  'index sync import');
index = replaceOnce(index,
  "const PASSWORD_ITERATIONS = 100_000;\n",
  "const PASSWORD_ITERATIONS = 100_000;\nconst SESSION_ACTIVITY_WRITE_INTERVAL_MS = 5 * 60_000;\nlet playerStateSchemaEnsured = false;\nlet playerLocationSchemaEnsured = false;\nlet inventorySchemaEnsured = false;\nlet crimeSchemaEnsured = false;\nlet logSchemaEnsured = false;\n",
  'index efficiency constants');
index = replaceOnce(index,
  "  if (method === 'GET' && url.pathname === '/api/player/state') return getPlayerState(request, env);\n",
  "  if (method === 'GET' && url.pathname === '/api/player/state') return getPlayerState(request, env);\n  if (method === 'GET' && url.pathname === '/api/sync') return getPlayerSync(request, env);\n",
  'index sync route');
index = replaceOnce(index,
`async function getPlayerState(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const playerState = await ensureActivePlayerState(env, auth.user.id);
  return json({ ok: true, player: toPublicPlayerState(playerState) });
}
`,
`async function getPlayerState(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const playerState = await ensureActivePlayerState(env, auth.user.id);
  return json({ ok: true, player: toPublicPlayerState(playerState) });
}

async function getPlayerSync(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const snapshot = await buildRiftSyncSnapshot(auth.user.id, env, {
    ensureActivePlayerState,
    ensurePlayerLocation,
    toPublicPlayerState,
    toPublicPlayerLocation
  });
  return json(snapshot, 200, {
    'Cache-Control': 'private, no-store',
    'X-RiftCity-Sync-Version': RIFT_SYNC_VERSION
  });
}
`, 'index sync handler');

index = replaceOnce(index,
`async function authenticate(request, env) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const now = Date.now();

  const row = await env.DB.prepare(\`
    SELECT s.id AS session_id, s.expires_at, u.id, u.username, u.role, u.created_at,
      u.last_active_at, u.is_banned, u.ban_reason
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?
  \`).bind(tokenHash).first();

  if (!row) return null;
  if (row.expires_at <= now || row.is_banned) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(now, row.session_id),
    env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(now, row.id)
  ]);
  row.last_active_at = now;
  return { user: row, sessionId: row.session_id };
}
`,
`async function authenticate(request, env) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const now = Date.now();

  const row = await env.DB.prepare(\`
    SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.id, u.username, u.role, u.created_at,
      u.last_active_at, u.is_banned, u.ban_reason
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?
  \`).bind(tokenHash).first();

  if (!row) return null;
  if (row.expires_at <= now || row.is_banned) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }

  const lastActivityWrite = Math.max(Number(row.last_seen_at) || 0, Number(row.last_active_at) || 0);
  if (now - lastActivityWrite >= SESSION_ACTIVITY_WRITE_INTERVAL_MS) {
    await env.DB.batch([
      env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(now, row.session_id),
      env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(now, row.id)
    ]);
  }
  // The request is active now even when the persistence write is intentionally
  // throttled. Keep response semantics current without spending two D1 writes
  // on every API invocation.
  row.last_active_at = now;
  return { user: row, sessionId: row.session_id };
}
`, 'throttle session activity writes');

index = replaceOnce(index,
`async function ensurePlayerStateTable(env) {
  await env.DB.prepare(PLAYER_STATE_TABLE_SQL).run();`,
`async function ensurePlayerStateTable(env) {
  if (playerStateSchemaEnsured) return;
  await env.DB.prepare(PLAYER_STATE_TABLE_SQL).run();`, 'player state schema guard start');
index = replaceOnce(index,
`  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_state_level ON player_state(level)').run();
}

async function ensurePlayerState(env, userId) {
  await ensurePlayerStateTable(env);
  const now = Date.now();
  await env.DB.prepare(\`
    INSERT OR IGNORE INTO player_state
      (user_id, health_regen_at, energy_regen_at, nerve_regen_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  \`).bind(userId, now, now, now, now, now).run();
  return getPlayerStateRow(env, userId);
}

async function getPlayerStateRow(env, userId) {`,
`  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_state_level ON player_state(level)').run();
  playerStateSchemaEnsured = true;
}

async function ensurePlayerState(env, userId) {
  await ensurePlayerStateTable(env);
  const existing = await getPlayerStateRow(env, userId, false);
  if (existing) return existing;
  const now = Date.now();
  await env.DB.prepare(\`
    INSERT INTO player_state
      (user_id, health_regen_at, energy_regen_at, nerve_regen_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  \`).bind(userId, now, now, now, now, now).run();
  return getPlayerStateRow(env, userId);
}

async function getPlayerStateRow(env, userId, required = true) {`, 'player state read before insert');
index = replaceOnce(index,
`  if (!row) throw new Error('Could not create or load player state');
  return row;
}`,
`  if (!row && required) throw new Error('Could not create or load player state');
  return row || null;
}`, 'optional player state row');

index = replaceOnce(index,
`async function ensurePlayerLocationTable(env) {
  await env.DB.prepare(PLAYER_LOCATION_TABLE_SQL).run();`,
`async function ensurePlayerLocationTable(env) {
  if (playerLocationSchemaEnsured) return;
  await env.DB.prepare(PLAYER_LOCATION_TABLE_SQL).run();`, 'location schema guard start');
index = replaceOnce(index,
`  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_location_location ON player_location(location_id)').run();
}

async function ensurePlayerLocation(env, userId) {
  await ensurePlayerLocationTable(env);
  const now = Date.now();
  await env.DB.prepare(\`
    INSERT OR IGNORE INTO player_location (user_id, district_id, location_id, updated_at)
    VALUES (?, 'services', 'rift-civic-hall', ?)
  \`).bind(userId, now).run();

  let row = await env.DB.prepare(\`
    SELECT user_id, district_id, location_id, updated_at
    FROM player_location WHERE user_id = ?
  \`).bind(userId).first();
  if (!row) throw new Error('Could not create or load player location');`,
`  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_location_location ON player_location(location_id)').run();
  playerLocationSchemaEnsured = true;
}

async function ensurePlayerLocation(env, userId) {
  await ensurePlayerLocationTable(env);
  const now = Date.now();
  let row = await env.DB.prepare(\`
    SELECT user_id, district_id, location_id, updated_at
    FROM player_location WHERE user_id = ?
  \`).bind(userId).first();
  if (!row) {
    await env.DB.prepare(\`
      INSERT INTO player_location (user_id, district_id, location_id, updated_at)
      VALUES (?, 'services', 'rift-civic-hall', ?)
    \`).bind(userId, now).run();
    row = { user_id: userId, district_id: 'services', location_id: 'rift-civic-hall', updated_at: now };
  }`, 'location read before insert');

index = replaceOnce(index,
`async function ensureInventoryTable(env) {
  try {
    await env.DB.prepare(PLAYER_INVENTORY_TABLE_SQL).run();`,
`async function ensureInventoryTable(env) {
  if (inventorySchemaEnsured) return;
  try {
    await env.DB.prepare(PLAYER_INVENTORY_TABLE_SQL).run();`, 'inventory schema guard start');
index = replaceOnce(index,
`    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_inventory_equipped ON player_inventory(user_id, equipped_slot)').run();
  } catch (error) {`,
`    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_inventory_equipped ON player_inventory(user_id, equipped_slot)').run();
    inventorySchemaEnsured = true;
  } catch (error) {`, 'inventory schema guard end');
index = replaceOnce(index,
`async function ensureCrimeTables(env) {
  await ensureInventoryTable(env);`,
`async function ensureCrimeTables(env) {
  if (crimeSchemaEnsured) return;
  await ensureInventoryTable(env);`, 'crime schema guard start');
index = replaceOnce(index,
`  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_crime_history_crime ON crime_history(user_id, crime_id, created_at DESC)').run();
}`,
`  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_crime_history_crime ON crime_history(user_id, crime_id, created_at DESC)').run();
  crimeSchemaEnsured = true;
}`, 'crime schema guard end');
index = replaceOnce(index,
`async function ensureLogTable(env) {
  await env.DB.prepare(LOG_TABLE_SQL).run();`,
`async function ensureLogTable(env) {
  if (logSchemaEnsured) return;
  await env.DB.prepare(LOG_TABLE_SQL).run();`, 'log schema guard start');
index = replaceOnce(index,
`  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_system_logs_error_id ON system_logs(error_id)').run();
}`,
`  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_system_logs_error_id ON system_logs(error_id)').run();
  logSchemaEnsured = true;
}`, 'log schema guard end');
write('src/index.js', index);

let gameplay = read('src/services/gameplay.js');
gameplay = replaceOnce(gameplay,
  "  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auction_active ON auction_listings(status,created_at)').run();\n",
  "  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auction_active ON auction_listings(status,created_at)').run();\n  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_education_active ON player_education(user_id,status,completes_at)').run();\n",
  'education sync index');
write('src/services/gameplay.js', gameplay);

let advanced = read('src/services/advanced.js');
advanced = replaceOnce(advanced,
  "  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_production_user ON production_batches(user_id,completes_at)').run();\n",
  "  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_production_user ON production_batches(user_id,completes_at)').run();\n  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_production_unclaimed ON production_batches(user_id,claimed,completes_at)').run();\n",
  'production sync index');
write('src/services/advanced.js', advanced);

let living = read('src/services/living-city.js');
living = replaceOnce(living,
  " await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id,created_at DESC)').run();\n",
  " await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id,created_at DESC)').run();\n await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_activity_feed_unread ON activity_feed(user_id,read,created_at DESC)').run();\n",
  'activity unread sync index');
write('src/services/living-city.js', living);

let schema = read('schema.sql');
schema = replaceOnce(schema,
  `CREATE TABLE IF NOT EXISTS player_gym (`,
  `CREATE INDEX IF NOT EXISTS idx_player_education_active ON player_education(user_id,status,completes_at);\nCREATE TABLE IF NOT EXISTS player_gym (`,
  'schema education index');
schema = replaceOnce(schema,
  `CREATE INDEX IF NOT EXISTS idx_production_user ON production_batches(user_id,completes_at);`,
  `CREATE INDEX IF NOT EXISTS idx_production_user ON production_batches(user_id,completes_at);\nCREATE INDEX IF NOT EXISTS idx_production_unclaimed ON production_batches(user_id,claimed,completes_at);`,
  'schema production index');
schema = replaceOnce(schema,
  `CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id,created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id,created_at DESC);\nCREATE INDEX IF NOT EXISTS idx_activity_feed_unread ON activity_feed(user_id,read,created_at DESC);`,
  'schema activity index');
write('schema.sql', schema);
