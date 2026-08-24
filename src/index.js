const SESSION_COOKIE = 'riftcity_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 210_000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        console.error(error);
        return json({ ok: false, error: 'Internal server error' }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env, url) {
  const method = request.method.toUpperCase();

  if (method === 'POST' && url.pathname === '/api/auth/register') {
    return register(request, env);
  }
  if (method === 'POST' && url.pathname === '/api/auth/login') {
    return login(request, env);
  }
  if (method === 'POST' && url.pathname === '/api/auth/logout') {
    return logout(request, env);
  }
  if (method === 'GET' && url.pathname === '/api/auth/me') {
    return me(request, env);
  }
  if (method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, service: 'riftcity-v2-phase1' });
  }

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
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO users (id, username, password_hash, password_salt, role, created_at, last_active_at)
    VALUES (?, ?, ?, ?, 'player', ?, ?)
  `).bind(userId, username, passwordHash, salt, now, now).run();

  await writeAudit(env, userId, 'user.registered', userId, { username });

  const session = await createSession(env, request, userId);
  return json({
    ok: true,
    user: { id: userId, username, role: 'player', createdAt: now, lastActiveAt: now }
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

  const saltBytes = base64ToBytes(user.password_salt);
  const suppliedHash = await hashPassword(password, saltBytes);
  if (!constantTimeEqual(suppliedHash, user.password_hash)) {
    return json({ ok: false, error: 'Invalid username or password' }, 401);
  }

  if (user.is_banned) {
    return json({ ok: false, error: user.ban_reason || 'This account is banned' }, 403);
  }

  const now = Date.now();
  await env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(now, user.id).run();
  await writeAudit(env, user.id, 'user.login', user.id, {});

  const session = await createSession(env, request, user.id);
  return json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
      lastActiveAt: now
    }
  }, 200, { 'Set-Cookie': session.cookie });
}

async function logout(request, env) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (rawToken) {
    const tokenHash = await sha256(rawToken);
    const session = await env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').bind(tokenHash).first();
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    if (session?.user_id) await writeAudit(env, session.user_id, 'user.logout', session.user_id, {});
  }

  return json({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  });
}

async function me(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, authenticated: false }, 401);

  return json({
    ok: true,
    authenticated: true,
    user: {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
      createdAt: auth.user.created_at,
      lastActiveAt: auth.user.last_active_at,
      online: true
    }
  });
}

async function authenticate(request, env) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return null;

  const tokenHash = await sha256(rawToken);
  const now = Date.now();

  const row = await env.DB.prepare(`
    SELECT
      s.id AS session_id,
      s.expires_at,
      u.id,
      u.username,
      u.role,
      u.created_at,
      u.last_active_at,
      u.is_banned,
      u.ban_reason
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).bind(tokenHash).first();

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

async function createSession(env, request, userId) {
  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const rawToken = bytesToBase64Url(rawBytes);
  const tokenHash = await sha256(rawToken);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const sessionId = crypto.randomUUID();
  const userAgent = request.headers.get('User-Agent') || null;

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(sessionId, userId, tokenHash, now, expiresAt, now, userAgent).run();

  return {
    cookie: `${SESSION_COOKIE}=${rawToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
  };
}

function validateCredentials(username, password) {
  if (!username) return 'Username is required';
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return 'Username must be 3-20 characters using letters, numbers, or underscores';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password is too long';
  return null;
}

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim() : '';
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
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

async function readJson(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) return null;
  try { return await request.json(); } catch { return null; }
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

async function writeAudit(env, actorUserId, action, targetUserId, details) {
  await env.DB.prepare(`
    INSERT INTO audit_log (id, actor_user_id, action, target_user_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    actorUserId || null,
    action,
    targetUserId || null,
    JSON.stringify(details || {}),
    Date.now()
  ).run();
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
