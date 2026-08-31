const SESSION_COOKIE = 'ironvale_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 100_000;
const WORLD_MIN_X = 0;
const WORLD_MAX_X = 640;
const WORLD_MIN_Z = 0;
const WORLD_MAX_Z = 640;
const DEFAULT_SPAWN = Object.freeze({ x: 320, y: 0.9, z: 320, yaw: 0 });

let schemaReady = false;

const CORE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'player',
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    is_banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    user_agent TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS rift_characters (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    position_x REAL NOT NULL DEFAULT 320,
    position_y REAL NOT NULL DEFAULT 0.9,
    position_z REAL NOT NULL DEFAULT 320,
    yaw REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        await ensureCoreTables(env);
        return await handleApi(request, env, url);
      } catch (error) {
        console.error('Ironvale core API error', error);
        return json({ ok: false, error: 'Internal server error' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

async function ensureCoreTables(env) {
  if (schemaReady) return;
  await env.DB.batch(CORE_SCHEMA.map(sql => env.DB.prepare(sql)));
  schemaReady = true;
}

async function handleApi(request, env, url) {
  const method = request.method.toUpperCase();
  if (method === 'POST' && url.pathname === '/api/auth/register') return register(request, env);
  if (method === 'POST' && url.pathname === '/api/auth/login') return login(request, env);
  if (method === 'POST' && url.pathname === '/api/auth/logout') return logout(request, env);
  if (method === 'GET' && url.pathname === '/api/auth/me') return me(request, env);
  if (method === 'GET' && url.pathname === '/api/bootstrap') return bootstrap(request, env);
  if (method === 'GET' && url.pathname === '/api/character') return getCharacter(request, env);
  if (method === 'PATCH' && url.pathname === '/api/character') return updateCharacter(request, env);
  if (method === 'PUT' && url.pathname === '/api/character/position') return updatePosition(request, env);
  if (method === 'GET' && url.pathname === '/api/health') return health(env);
  return json({ ok: false, error: 'Not found' }, 404);
}

async function register(request, env) {
  const body = await readJson(request);
  const username = normalizeUsername(body?.username);
  const password = typeof body?.password === 'string' ? body.password : '';
  const validationError = validateCredentials(username, password);
  if (validationError) return json({ ok: false, error: validationError }, 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return json({ ok: false, error: 'Username is already taken' }, 409);

  const userId = crypto.randomUUID();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToBase64(saltBytes);
  const passwordHash = await hashPassword(password, saltBytes);
  const timestamp = Date.now();

  await env.DB.prepare(`
    INSERT INTO users (id, username, password_hash, password_salt, role, created_at, last_active_at, is_banned)
    VALUES (?, ?, ?, ?, 'player', ?, ?, 0)
  `).bind(userId, username, passwordHash, salt, timestamp, timestamp).run();

  await ensureCharacter({ id: userId, username }, env);
  const session = await createSession(env, request, userId);
  return json({
    ok: true,
    user: { id: userId, username, role: 'player', createdAt: timestamp, lastActiveAt: timestamp }
  }, 201, { 'Set-Cookie': session.cookie });
}

async function login(request, env) {
  const body = await readJson(request);
  const username = normalizeUsername(body?.username);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!username || !password) return json({ ok: false, error: 'Username and password are required' }, 400);

  const user = await env.DB.prepare(`
    SELECT id, username, password_hash, password_salt, role, created_at, last_active_at, is_banned, ban_reason
    FROM users WHERE username = ?
  `).bind(username).first();

  if (!user) return json({ ok: false, error: 'Invalid username or password' }, 401);

  const suppliedHash = await hashPassword(password, base64ToBytes(user.password_salt));
  if (!constantTimeEqual(suppliedHash, user.password_hash)) {
    return json({ ok: false, error: 'Invalid username or password' }, 401);
  }
  if (Number(user.is_banned)) return json({ ok: false, error: user.ban_reason || 'This account is banned' }, 403);

  const timestamp = Date.now();
  await env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(timestamp, user.id).run();
  await ensureCharacter(user, env);
  const session = await createSession(env, request, user.id);

  return json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
      lastActiveAt: timestamp
    }
  }, 200, { 'Set-Cookie': session.cookie });
}

async function logout(request, env) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (rawToken) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(rawToken)).run();
  }
  return json({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  });
}

async function me(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, authenticated: false }, 401);
  return json({ ok: true, authenticated: true, user: publicUser(auth.user) });
}

async function bootstrap(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, authenticated: false }, 401);
  const character = await ensureCharacter(auth.user, env);
  return json({
    ok: true,
    authenticated: true,
    user: publicUser(auth.user),
    character: publicCharacter(character),
    world: {
      id: 'ironvale-terrain',
      url: '/world/ironvale-terrain.json',
      foundation: 'rift-landscape-v2',
      terrainFormat: 'rift-terrain-v1',
      size: [640, 640],
      negativeWorldY: true
    }
  });
}

async function getCharacter(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  return json({ ok: true, character: publicCharacter(await ensureCharacter(auth.user, env)) });
}

async function updateCharacter(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const body = await readJson(request);
  const displayName = String(body?.displayName || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 '\-]{1,23}$/.test(displayName)) {
    return json({ ok: false, error: 'Character name must be 2-24 characters.' }, 400);
  }

  const timestamp = Date.now();
  await ensureCharacter(auth.user, env);
  await env.DB.prepare('UPDATE rift_characters SET display_name = ?, updated_at = ? WHERE user_id = ?')
    .bind(displayName, timestamp, auth.user.id).run();
  const row = await env.DB.prepare('SELECT * FROM rift_characters WHERE user_id = ?').bind(auth.user.id).first();
  return json({ ok: true, character: publicCharacter(row) });
}

async function updatePosition(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);

  const body = await readJson(request);
  const x = finite(body?.x);
  const y = finite(body?.y);
  const z = finite(body?.z);
  const yaw = finite(body?.yaw);
  if ([x, y, z, yaw].some(value => value === null)) {
    return json({ ok: false, error: 'Invalid position' }, 400);
  }

  // X/Z are constrained to the editable terrain. Y is intentionally unbounded:
  // negative world space is valid for water, trenches, caves and future underground areas.
  if (x < WORLD_MIN_X || x > WORLD_MAX_X || z < WORLD_MIN_Z || z > WORLD_MAX_Z) {
    return json({ ok: false, error: 'Position outside active terrain bounds' }, 400);
  }

  await ensureCharacter(auth.user, env);
  const timestamp = Date.now();
  await env.DB.prepare(`
    UPDATE rift_characters
    SET position_x = ?, position_y = ?, position_z = ?, yaw = ?, updated_at = ?
    WHERE user_id = ?
  `).bind(x, y, z, yaw, timestamp, auth.user.id).run();
  return json({ ok: true, savedAt: timestamp });
}

async function health(env) {
  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
    return json({ ok: true, service: 'ironvale-core', database: 'connected' });
  } catch {
    return json({ ok: false, service: 'ironvale-core', database: 'error' }, 503);
  }
}

async function ensureCharacter(user, env) {
  const timestamp = Date.now();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO rift_characters
      (user_id, display_name, position_x, position_y, position_z, yaw, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user.id,
    user.username,
    DEFAULT_SPAWN.x,
    DEFAULT_SPAWN.y,
    DEFAULT_SPAWN.z,
    DEFAULT_SPAWN.yaw,
    timestamp,
    timestamp
  ).run();
  return env.DB.prepare('SELECT * FROM rift_characters WHERE user_id = ?').bind(user.id).first();
}

function publicCharacter(row) {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    position: {
      x: Number(row.position_x),
      y: Number(row.position_y),
      z: Number(row.position_z),
      yaw: Number(row.yaw)
    },
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: Number(row.created_at),
    lastActiveAt: Number(row.last_active_at)
  };
}

async function authenticate(request, env) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const now = Date.now();
  const row = await env.DB.prepare(`
    SELECT s.id AS session_id, s.expires_at,
           u.id, u.username, u.role, u.created_at, u.last_active_at, u.is_banned, u.ban_reason
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).bind(tokenHash).first();

  if (!row) return null;
  if (Number(row.expires_at) <= now || Number(row.is_banned)) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(row.session_id).run();
    return null;
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(now, row.session_id),
    env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(now, row.id)
  ]);
  row.last_active_at = now;
  return { user: row, sessionId: row.session_id };
}

async function createSession(env, request, userId) {
  const rawToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(rawToken);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    userId,
    tokenHash,
    now,
    expiresAt,
    now,
    String(request.headers.get('user-agent') || '').slice(0, 500)
  ).run();
  return {
    cookie: `${SESSION_COOKIE}=${rawToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
  };
}

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateCredentials(username, password) {
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return 'Username must be 3-24 letters, numbers, or underscores.';
  if (password.length < 8 || password.length > 128) return 'Password must be 8-128 characters.';
  return null;
}

async function hashPassword(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PASSWORD_ITERATIONS },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

function constantTimeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

async function readJson(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 64 * 1024) throw new Error('Request body too large');
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}
