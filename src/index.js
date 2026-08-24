const SESSION_COOKIE = 'riftcity_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
// Cloudflare Workers currently supports PBKDF2 iteration counts up to 100,000.
const PASSWORD_ITERATIONS = 100_000;
const LOG_TABLE_SQL = `
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
  )
`;

const PLAYER_STATE_TABLE_SQL = `
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
  )
`;

const PLAYER_LOCATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS player_location (
    user_id TEXT PRIMARY KEY,
    district_id TEXT NOT NULL DEFAULT 'downtown',
    location_id TEXT NOT NULL DEFAULT 'central-plaza',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const WORLD_DISTRICTS = [
  {
    id: 'downtown', code: 'DT-01', name: 'Downtown',
    description: 'The commercial core of RiftCity. Crowded streets, transit links, offices and back alleys all meet here.',
    risk: 'LOW', policeActivity: 'NORMAL'
  },
  {
    id: 'harbour', code: 'HB-02', name: 'Harbour',
    description: 'Cargo traffic, warehouses and waterfront businesses keep the district moving long after dark.',
    risk: 'MEDIUM', policeActivity: 'LOW'
  },
  {
    id: 'industrial', code: 'IN-03', name: 'Industrial',
    description: 'Factories, service yards and scrap operations dominate the eastern industrial belt.',
    risk: 'MEDIUM', policeActivity: 'NORMAL'
  },
  {
    id: 'residential', code: 'RS-04', name: 'Residential',
    description: 'Dense apartment blocks give way to quieter streets and high-value private estates.',
    risk: 'LOW', policeActivity: 'ELEVATED'
  },
  {
    id: 'casino', code: 'CS-05', name: 'Casino District',
    description: 'Hotels, nightlife and high-stakes venues make this the brightest part of RiftCity after sundown.',
    risk: 'MEDIUM', policeActivity: 'HIGH'
  }
];

const WORLD_LOCATIONS = [
  {
    id: 'central-plaza', districtId: 'downtown', code: 'DT-A', name: 'Central Plaza', status: 'OPEN',
    shortDescription: 'Main downtown concourse and public meeting point.',
    description: 'A wide public concourse surrounded by offices, storefronts and transit access. This is the default arrival point for new players.',
    tags: ['PUBLIC', 'TRANSIT'], requirements: [],
    actions: [
      { id: 'look-around', label: 'Look around', type: 'inspect', enabled: true },
      { id: 'crimes', label: 'Local crimes', type: 'crime', enabled: false, note: 'Crime framework arrives in a later phase.' }
    ]
  },
  {
    id: 'metro-exchange', districtId: 'downtown', code: 'DT-B', name: 'Metro Exchange', status: 'OPEN',
    shortDescription: 'Busy transit platforms connecting the city core.',
    description: 'Platforms, service corridors and a constant flow of commuters make the exchange one of Downtown\'s busiest locations.',
    tags: ['TRANSIT', 'CROWDED'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'back-streets', districtId: 'downtown', code: 'DT-C', name: 'Back Streets', status: 'OPEN',
    shortDescription: 'Narrow service lanes behind the commercial blocks.',
    description: 'Loading bays, service alleys and older buildings create a quieter route behind Downtown\'s main streets.',
    tags: ['ALLEY', 'LOW-TRAFFIC'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'cargo-docks', districtId: 'harbour', code: 'HB-A', name: 'Cargo Docks', status: 'OPEN',
    shortDescription: 'Container yards and active freight piers.',
    description: 'Freight moves through the docks day and night. Containers, crews and service vehicles constantly rotate through the waterfront.',
    tags: ['FREIGHT', 'WATERFRONT'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'warehouse-row', districtId: 'harbour', code: 'HB-B', name: 'Warehouse Row', status: 'OPEN',
    shortDescription: 'A strip of storage buildings behind the docks.',
    description: 'Rows of loading doors and fenced storage lots sit between the working harbour and the industrial belt.',
    tags: ['WAREHOUSE', 'FREIGHT'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'fish-market', districtId: 'harbour', code: 'HB-C', name: 'Harbour Market', status: 'OPEN',
    shortDescription: 'A public market beside the older marina.',
    description: 'Small vendors, delivery vans and dock workers fill the market during its busiest hours.',
    tags: ['MARKET', 'PUBLIC'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'foundry-yard', districtId: 'industrial', code: 'IN-A', name: 'Foundry Yard', status: 'OPEN',
    shortDescription: 'Heavy industrial yard surrounded by old plants.',
    description: 'A rough network of fenced compounds, old machinery and active service roads in the middle of the industrial district.',
    tags: ['INDUSTRIAL', 'HEAVY'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'scrap-depot', districtId: 'industrial', code: 'IN-B', name: 'Scrap Depot', status: 'OPEN',
    shortDescription: 'Metal, machinery and salvage move through this yard.',
    description: 'Stacks of reusable material and stripped machinery make the depot a natural future home for scavenging and material systems.',
    tags: ['SCRAP', 'SALVAGE'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'service-tunnels', districtId: 'industrial', code: 'IN-C', name: 'Service Tunnels', status: 'RESTRICTED',
    shortDescription: 'Utility access beneath the industrial blocks.',
    description: 'Old maintenance passages connect several industrial sites. Access systems will be added when item requirements exist.',
    tags: ['UTILITY', 'RESTRICTED'], requirements: ['Future access item'],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'east-blocks', districtId: 'residential', code: 'RS-A', name: 'East Blocks', status: 'OPEN',
    shortDescription: 'Dense apartment blocks and local storefronts.',
    description: 'A busy residential zone with apartment towers, parking courts and small neighborhood businesses.',
    tags: ['RESIDENTIAL', 'PUBLIC'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'luxury-estate', districtId: 'residential', code: 'RS-B', name: 'Luxury Estate', status: 'OPEN',
    shortDescription: 'Private homes along quieter guarded streets.',
    description: 'Large properties and lower foot traffic make the estate feel completely different from the crowded East Blocks.',
    tags: ['RESIDENTIAL', 'HIGH-VALUE'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'corner-row', districtId: 'residential', code: 'RS-C', name: 'Corner Row', status: 'OPEN',
    shortDescription: 'Small shops and services at the edge of the neighborhood.',
    description: 'Convenience stores, laundromats and low-rise apartments sit along a well-traveled neighborhood strip.',
    tags: ['SHOPS', 'PUBLIC'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'grand-strip', districtId: 'casino', code: 'CS-A', name: 'Grand Strip', status: 'OPEN',
    shortDescription: 'The main nightlife corridor through the casino district.',
    description: 'Large signs, hotels and crowds dominate the strip. The casino systems themselves will plug into this location engine later.',
    tags: ['NIGHTLIFE', 'CROWDED'], requirements: [],
    actions: [{ id: 'look-around', label: 'Look around', type: 'inspect', enabled: true }]
  },
  {
    id: 'casino-lobby', districtId: 'casino', code: 'CS-B', name: 'Rift Casino', status: 'COMING SOON',
    shortDescription: 'Future home of RiftCity casino games.',
    description: 'The location is registered in the world now so the casino feature can be added later without rebuilding city navigation.',
    tags: ['CASINO', 'ENTERTAINMENT'], requirements: [],
    actions: [{ id: 'casino', label: 'Casino floor', type: 'casino', enabled: false, note: 'Casino gameplay is not installed yet.' }]
  },
  {
    id: 'nightclub-row', districtId: 'casino', code: 'CS-C', name: 'Nightclub Row', status: 'COMING SOON',
    shortDescription: 'Late-night venues behind the main strip.',
    description: 'A dense cluster of clubs and late-night businesses reserved for future nightlife systems and events.',
    tags: ['NIGHTLIFE', 'EVENTS'], requirements: [],
    actions: [{ id: 'nightlife', label: 'Nightlife', type: 'nightlife', enabled: false, note: 'Nightlife gameplay is not installed yet.' }]
  }
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestId = request.headers.get('cf-ray') || crypto.randomUUID();

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url, requestId);
      } catch (error) {
        const errorId = makeErrorId();
        console.error(`[${errorId}] [${requestId}]`, error);
        await safeWriteSystemLog(env, {
          errorId,
          severity: 'ERROR',
          eventType: 'API_ERROR',
          message: safeErrorMessage(error),
          stack: safeStack(error),
          route: url.pathname,
          method: request.method,
          requestId,
          userId: null,
          context: { search: url.search || null }
        });
        return json({ ok: false, error: 'Internal server error', errorId }, 500, { 'X-RiftCity-Request-ID': requestId });
      }
    }

    if (url.pathname === '/admin/logs' || url.pathname === '/admin/logs/') {
      const adminUrl = new URL('/admin-logs.html', request.url);
      return env.ASSETS.fetch(new Request(adminUrl, request));
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env, url, requestId) {
  const method = request.method.toUpperCase();

  if (method === 'POST' && url.pathname === '/api/auth/register') return register(request, env, requestId);
  if (method === 'POST' && url.pathname === '/api/auth/login') return login(request, env, requestId);
  if (method === 'POST' && url.pathname === '/api/auth/logout') return logout(request, env, requestId);
  if (method === 'GET' && url.pathname === '/api/auth/me') return me(request, env);
  if (method === 'GET' && url.pathname === '/api/player/state') return getPlayerState(request, env);
  if (method === 'GET' && url.pathname === '/api/world') return getWorld(request, env);
  if (method === 'GET' && url.pathname.startsWith('/api/world/districts/')) return getDistrict(request, env, url);
  if (method === 'GET' && url.pathname.startsWith('/api/world/locations/')) return getLocation(request, env, url);
  if (method === 'POST' && url.pathname === '/api/world/travel') return travelToLocation(request, env, requestId);
  if (method === 'GET' && url.pathname === '/api/health') return health(env);
  if (method === 'GET' && url.pathname === '/api/admin/logs') return getSystemLogs(request, env, url);
  if (method === 'POST' && url.pathname.startsWith('/api/admin/logs/') && url.pathname.endsWith('/resolve')) {
    return resolveSystemLog(request, env, url);
  }

  return json({ ok: false, error: 'Not found' }, 404);
}

async function register(request, env, requestId) {
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

  await ensurePlayerStateTable(env);
  await ensurePlayerLocationTable(env);
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (id, username, password_hash, password_salt, role, created_at, last_active_at)
      VALUES (?, ?, ?, ?, 'player', ?, ?)
    `).bind(userId, username, passwordHash, salt, now, now),
    env.DB.prepare(`
      INSERT INTO player_state (user_id, created_at, updated_at)
      VALUES (?, ?, ?)
    `).bind(userId, now, now),
    env.DB.prepare(`
      INSERT INTO player_location (user_id, district_id, location_id, updated_at)
      VALUES (?, 'downtown', 'central-plaza', ?)
    `).bind(userId, now)
  ]);

  const playerState = await getPlayerStateRow(env, userId);
  await writeAudit(env, userId, 'user.registered', userId, { username });
  await safeWriteSystemLog(env, {
    severity: 'INFO', eventType: 'ACCOUNT_CREATED', message: `Account created: ${username}`,
    route: '/api/auth/register', method: 'POST', requestId, userId, context: { username }
  });

  const session = await createSession(env, request, userId);
  return json({
    ok: true,
    user: { id: userId, username, role: 'player', createdAt: now, lastActiveAt: now },
    player: toPublicPlayerState(playerState)
  }, 201, { 'Set-Cookie': session.cookie });
}

async function login(request, env, requestId) {
  const body = await readJson(request);
  const username = normalizeUsername(body?.username);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !password) return json({ ok: false, error: 'Username and password are required' }, 400);

  const user = await env.DB.prepare(`
    SELECT id, username, password_hash, password_salt, role, created_at, last_active_at, is_banned, ban_reason
    FROM users WHERE username = ?
  `).bind(username).first();

  if (!user) {
    await safeWriteSystemLog(env, {
      severity: 'WARNING', eventType: 'LOGIN_FAILED', message: `Login failed for username: ${username}`,
      route: '/api/auth/login', method: 'POST', requestId, context: { username, reason: 'unknown_user' }
    });
    return json({ ok: false, error: 'Invalid username or password' }, 401);
  }

  const saltBytes = base64ToBytes(user.password_salt);
  const suppliedHash = await hashPassword(password, saltBytes);
  if (!constantTimeEqual(suppliedHash, user.password_hash)) {
    await safeWriteSystemLog(env, {
      severity: 'WARNING', eventType: 'LOGIN_FAILED', message: `Login failed for username: ${username}`,
      route: '/api/auth/login', method: 'POST', requestId, userId: user.id,
      context: { username, reason: 'invalid_password' }
    });
    return json({ ok: false, error: 'Invalid username or password' }, 401);
  }

  if (user.is_banned) return json({ ok: false, error: user.ban_reason || 'This account is banned' }, 403);

  const now = Date.now();
  await env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(now, user.id).run();
  await writeAudit(env, user.id, 'user.login', user.id, {});
  await safeWriteSystemLog(env, {
    severity: 'INFO', eventType: 'LOGIN_SUCCESS', message: `Login successful: ${user.username}`,
    route: '/api/auth/login', method: 'POST', requestId, userId: user.id, context: { username: user.username }
  });

  const playerState = await ensurePlayerState(env, user.id);
  const session = await createSession(env, request, user.id);
  return json({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role, createdAt: user.created_at, lastActiveAt: now },
    player: toPublicPlayerState(playerState)
  }, 200, { 'Set-Cookie': session.cookie });
}

async function logout(request, env, requestId) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (rawToken) {
    const tokenHash = await sha256(rawToken);
    const session = await env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').bind(tokenHash).first();
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    if (session?.user_id) {
      await writeAudit(env, session.user_id, 'user.logout', session.user_id, {});
      await safeWriteSystemLog(env, {
        severity: 'INFO', eventType: 'LOGOUT', message: 'Player logged out', route: '/api/auth/logout',
        method: 'POST', requestId, userId: session.user_id
      });
    }
  }

  return json({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  });
}

async function me(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, authenticated: false }, 401);
  const playerState = await ensurePlayerState(env, auth.user.id);
  const playerLocation = await ensurePlayerLocation(env, auth.user.id);
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
    },
    player: toPublicPlayerState(playerState),
    location: toPublicPlayerLocation(playerLocation)
  });
}

async function getPlayerState(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const playerState = await ensurePlayerState(env, auth.user.id);
  return json({ ok: true, player: toPublicPlayerState(playerState) });
}

async function getWorld(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const current = await ensurePlayerLocation(env, auth.user.id);
  return json({
    ok: true,
    world: {
      districts: WORLD_DISTRICTS.map(district => ({
        ...district,
        locationCount: WORLD_LOCATIONS.filter(location => location.districtId === district.id).length
      })),
      current: toPublicPlayerLocation(current)
    }
  });
}

async function getDistrict(request, env, url) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const id = decodeURIComponent(url.pathname.slice('/api/world/districts/'.length));
  const district = WORLD_DISTRICTS.find(item => item.id === id);
  if (!district) return json({ ok: false, error: 'District not found' }, 404);
  const current = await ensurePlayerLocation(env, auth.user.id);
  return json({
    ok: true,
    district: {
      ...district,
      locations: WORLD_LOCATIONS.filter(location => location.districtId === district.id)
    },
    current: toPublicPlayerLocation(current)
  });
}

async function getLocation(request, env, url) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const id = decodeURIComponent(url.pathname.slice('/api/world/locations/'.length));
  const location = WORLD_LOCATIONS.find(item => item.id === id);
  if (!location) return json({ ok: false, error: 'Location not found' }, 404);
  const district = WORLD_DISTRICTS.find(item => item.id === location.districtId);
  const current = await ensurePlayerLocation(env, auth.user.id);
  return json({ ok: true, location, district, current: toPublicPlayerLocation(current) });
}

async function travelToLocation(request, env, requestId) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const body = await readJson(request);
  const locationId = typeof body?.locationId === 'string' ? body.locationId.trim() : '';
  const location = WORLD_LOCATIONS.find(item => item.id === locationId);
  if (!location) return json({ ok: false, error: 'Unknown location' }, 400);

  await ensurePlayerLocationTable(env);
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO player_location (user_id, district_id, location_id, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      district_id = excluded.district_id,
      location_id = excluded.location_id,
      updated_at = excluded.updated_at
  `).bind(auth.user.id, location.districtId, location.id, now).run();

  await writeAudit(env, auth.user.id, 'world.travel', auth.user.id, {
    districtId: location.districtId,
    locationId: location.id
  });

  return json({
    ok: true,
    current: {
      districtId: location.districtId,
      districtName: WORLD_DISTRICTS.find(item => item.id === location.districtId)?.name || location.districtId,
      locationId: location.id,
      locationName: location.name,
      updatedAt: now
    }
  });
}

async function health(env) {
  const result = { ok: true, service: 'riftcity-v2-phase3', database: 'unknown' };
  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
    result.database = 'connected';
  } catch {
    result.ok = false;
    result.database = 'error';
  }
  return json(result, result.ok ? 200 : 503);
}

async function getSystemLogs(request, env, url) {
  // TEMPORARY: public dev-log access during early RiftCity V2 development.
  // Restore requireAdmin() before opening the game to other users.
  await ensureLogTable(env);

  const severity = (url.searchParams.get('severity') || '').toUpperCase();
  const resolved = url.searchParams.get('resolved');
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 100, 250));
  const clauses = [];
  const values = [];

  if (['INFO', 'WARNING', 'ERROR'].includes(severity)) {
    clauses.push('severity = ?');
    values.push(severity);
  }
  if (resolved === '0' || resolved === '1') {
    clauses.push('resolved = ?');
    values.push(Number(resolved));
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const query = `SELECT * FROM system_logs ${where} ORDER BY created_at DESC LIMIT ?`;
  values.push(limit);
  const result = await env.DB.prepare(query).bind(...values).all();
  return json({ ok: true, logs: result.results || [] });
}

async function resolveSystemLog(request, env, url) {
  // TEMPORARY: public dev-log access during early RiftCity V2 development.
  // Restore requireAdmin() before opening the game to other users.
  await ensureLogTable(env);
  const match = url.pathname.match(/^\/api\/admin\/logs\/([^/]+)\/resolve$/);
  if (!match) return json({ ok: false, error: 'Invalid log ID' }, 400);
  const id = decodeURIComponent(match[1]);
  await env.DB.prepare('UPDATE system_logs SET resolved = 1 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function requireAdmin(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return { response: json({ ok: false, error: 'Authentication required' }, 401) };
  if (!['admin', 'developer'].includes(auth.user.role)) {
    return { response: json({ ok: false, error: 'Admin or developer access required' }, 403) };
  }
  return { auth };
}

async function authenticate(request, env) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const now = Date.now();

  const row = await env.DB.prepare(`
    SELECT s.id AS session_id, s.expires_at, u.id, u.username, u.role, u.created_at,
      u.last_active_at, u.is_banned, u.ban_reason
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?
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

  return { cookie: `${SESSION_COOKIE}=${rawToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}` };
}

function validateCredentials(username, password) {
  if (!username) return 'Username is required';
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return 'Username must be 3-20 characters using letters, numbers, or underscores';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password is too long';
  return null;
}

function normalizeUsername(value) { return typeof value === 'string' ? value.trim() : ''; }

async function hashPassword(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PASSWORD_ITERATIONS }, keyMaterial, 256
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
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

async function writeAudit(env, actorUserId, action, targetUserId, details) {
  await env.DB.prepare(`
    INSERT INTO audit_log (id, actor_user_id, action, target_user_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), actorUserId || null, action, targetUserId || null, JSON.stringify(details || {}), Date.now()).run();
}

async function ensurePlayerStateTable(env) {
  await env.DB.prepare(PLAYER_STATE_TABLE_SQL).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_state_status ON player_state(status)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_state_level ON player_state(level)').run();
}

async function ensurePlayerState(env, userId) {
  await ensurePlayerStateTable(env);
  const now = Date.now();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO player_state (user_id, created_at, updated_at)
    VALUES (?, ?, ?)
  `).bind(userId, now, now).run();
  return getPlayerStateRow(env, userId);
}

async function getPlayerStateRow(env, userId) {
  const row = await env.DB.prepare(`
    SELECT user_id, health, max_health, nerve, max_nerve, energy, max_energy, cash,
      level, xp, strength, defense, speed, dexterity, status, status_until, status_reason,
      created_at, updated_at
    FROM player_state WHERE user_id = ?
  `).bind(userId).first();

  if (!row) throw new Error('Could not create or load player state');
  return row;
}

function toPublicPlayerState(row) {
  return {
    userId: row.user_id,
    resources: {
      health: row.health, maxHealth: row.max_health,
      nerve: row.nerve, maxNerve: row.max_nerve,
      energy: row.energy, maxEnergy: row.max_energy,
      cash: row.cash
    },
    progression: { level: row.level, xp: row.xp, xpToNextLevel: xpNeededForLevel(row.level) },
    stats: { strength: row.strength, defense: row.defense, speed: row.speed, dexterity: row.dexterity },
    status: { type: row.status, until: row.status_until, reason: row.status_reason },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function xpNeededForLevel(level) {
  return Math.max(100, Math.floor(100 * Math.pow(Math.max(1, Number(level) || 1), 1.35)));
}

async function ensurePlayerLocationTable(env) {
  await env.DB.prepare(PLAYER_LOCATION_TABLE_SQL).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_location_district ON player_location(district_id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_location_location ON player_location(location_id)').run();
}

async function ensurePlayerLocation(env, userId) {
  await ensurePlayerLocationTable(env);
  const now = Date.now();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO player_location (user_id, district_id, location_id, updated_at)
    VALUES (?, 'downtown', 'central-plaza', ?)
  `).bind(userId, now).run();
  const row = await env.DB.prepare(`
    SELECT user_id, district_id, location_id, updated_at
    FROM player_location WHERE user_id = ?
  `).bind(userId).first();
  if (!row) throw new Error('Could not create or load player location');
  return row;
}

function toPublicPlayerLocation(row) {
  const district = WORLD_DISTRICTS.find(item => item.id === row.district_id);
  const location = WORLD_LOCATIONS.find(item => item.id === row.location_id);
  return {
    districtId: row.district_id,
    districtName: district?.name || row.district_id,
    locationId: row.location_id,
    locationName: location?.name || row.location_id,
    updatedAt: row.updated_at
  };
}

async function ensureLogTable(env) {
  await env.DB.prepare(LOG_TABLE_SQL).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_system_logs_error_id ON system_logs(error_id)').run();
}

async function safeWriteSystemLog(env, entry) {
  try {
    await ensureLogTable(env);
    await env.DB.prepare(`
      INSERT INTO system_logs
        (id, error_id, severity, event_type, message, stack, route, method, request_id, user_id, context_json, resolved, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).bind(
      crypto.randomUUID(), entry.errorId || null, entry.severity || 'INFO', entry.eventType || 'SYSTEM',
      String(entry.message || '').slice(0, 2000), entry.stack ? String(entry.stack).slice(0, 8000) : null,
      entry.route || null, entry.method || null, entry.requestId || null, entry.userId || null,
      JSON.stringify(entry.context || {}), Date.now()
    ).run();
  } catch (logError) {
    console.error('RiftCity logger failed:', logError);
  }
}

function makeErrorId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `RC-${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
function safeErrorMessage(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
function safeStack(error) { return error instanceof Error && error.stack ? error.stack : null; }

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function bytesToBase64Url(bytes) { return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function bytesToHex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
