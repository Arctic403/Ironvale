import {
  CRIME_REGISTRY,
  WORLD_CATEGORIES,
  WORLD_LOCATIONS,
  ITEM_REGISTRY,
  getCrimeDefinition,
  getWorldCategory,
  getWorldLocation,
  getItemDefinition,
  toPublicItemDefinition,
  RESOURCE_REGEN
} from './plugins/index.js';
import { handleGameplayApi, ensureGameplayTables, incrementProgress, setProgressAtLeast, getGameplayModifiers } from './services/gameplay.js';
import { getLawState, getLawChancePenalty, applyCrimeHeat, recordActivity } from './services/living-city.js';

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
    health_regen_at INTEGER NOT NULL DEFAULT 0,
    energy_regen_at INTEGER NOT NULL DEFAULT 0,
    nerve_regen_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const PLAYER_LOCATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS player_location (
    user_id TEXT PRIMARY KEY,
    district_id TEXT NOT NULL DEFAULT 'services',
    location_id TEXT NOT NULL DEFAULT 'rift-civic-hall',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;


const PLAYER_INVENTORY_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS player_inventory (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    equipped_slot TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const PLAYER_CRIME_PROGRESS_TABLE_SQL = `
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
  )
`;

const CRIME_HISTORY_TABLE_SQL = `
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
  )
`;

// Gameplay definitions are plugin/config modules under src/plugins/.
// This Worker owns the generic engines, validation, persistence and API behavior.

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

    if (url.pathname === '/dev/block-editor' || url.pathname === '/dev/block-editor/') {
      return serveDeveloperBlockEditor(request, env);
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
  if (method === 'GET' && url.pathname === '/api/items') return getItemCatalog(request, env);
  if (method === 'GET' && url.pathname.startsWith('/api/items/')) return getItem(request, env, url);
  if (method === 'GET' && url.pathname === '/api/inventory') return getInventory(request, env);
  if (method === 'POST' && url.pathname === '/api/inventory/use') return useInventoryItem(request, env, requestId);
  if (method === 'POST' && url.pathname === '/api/inventory/equip') return equipInventoryItem(request, env, requestId);
  if (method === 'POST' && url.pathname === '/api/inventory/unequip') return unequipInventoryItem(request, env, requestId);
  if (method === 'GET' && url.pathname === '/api/crimes') return getCrimes(request, env);
  if (method === 'POST' && url.pathname === '/api/crimes/execute') return executeCrime(request, env, requestId);
  if (method === 'GET' && url.pathname === '/api/world') return getWorld(request, env);
  if (method === 'GET' && url.pathname.startsWith('/api/world/blocks/')) return getPublishedBlockLayout(request, env, url);
  if (method === 'GET' && url.pathname.startsWith('/api/world/districts/')) return getDistrict(request, env, url);
  if (method === 'GET' && url.pathname.startsWith('/api/world/locations/')) return getLocation(request, env, url);
  if (method === 'POST' && url.pathname === '/api/world/travel') return travelToLocation(request, env, requestId);
  if (url.pathname.startsWith('/api/services')) {
    const response = await handleGameplayApi(request, env, url, requestId, {
      authenticate, json, readJson, ensureActivePlayerState, toPublicPlayerState,
      writeAudit, addItemToInventory, removeItemFromInventory, applyXpAndLevels
    });
    if (response) return response;
  }
  if (method === 'GET' && url.pathname === '/api/health') return health(env);
  if (method === 'GET' && url.pathname === '/api/admin/logs') return getSystemLogs(request, env, url);

  if (url.pathname.startsWith('/api/admin/blocks/')) {
    if (method === 'GET' && url.pathname.endsWith('/editor')) return getBlockEditorState(request, env, url);
    if (method === 'GET' && url.pathname.endsWith('/history')) return getBlockLayoutHistory(request, env, url);
    if (method === 'PUT' && url.pathname.endsWith('/draft')) return saveBlockDraft(request, env, url, requestId);
    if (method === 'POST' && url.pathname.endsWith('/publish')) return publishBlockDraft(request, env, url, requestId);
    if (method === 'POST' && url.pathname.endsWith('/revert-draft')) return revertBlockDraft(request, env, url, requestId);
  }

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
      VALUES (?, 'services', 'rift-civic-hall', ?)
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
  const playerState = await ensureActivePlayerState(env, auth.user.id);
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
  const playerState = await ensureActivePlayerState(env, auth.user.id);
  return json({ ok: true, player: toPublicPlayerState(playerState) });
}


async function getCrimes(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);

  await ensureCrimeTables(env);
  await ensureGameplayTables(env);
  const player = await ensureActivePlayerState(env, auth.user.id);
  const location = await ensurePlayerLocation(env, auth.user.id);
  const progressRows = await env.DB.prepare(`
    SELECT crime_id, mastery, attempts, successes, failures, last_attempt_at, updated_at
    FROM player_crime_progress WHERE user_id = ?
  `).bind(auth.user.id).all();
  const progressById = new Map((progressRows.results || []).map(row => [row.crime_id, row]));
  const ownedRows = await env.DB.prepare(`
    SELECT item_id, quantity FROM player_inventory WHERE user_id = ? AND quantity > 0
  `).bind(auth.user.id).all();
  const owned = new Map((ownedRows.results || []).map(row => [row.item_id, Number(row.quantity) || 0]));
  const historyRows = await env.DB.prepare(`
    SELECT id, crime_id, success, cash_delta, xp_delta, mastery_delta, item_reward_id,
      item_reward_quantity, consequence_status, consequence_until, result_text, created_at
    FROM crime_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 8
  `).bind(auth.user.id).all();

  const gameplayModifiers = await getGameplayModifiers(auth.user.id, env);
  const law = await getLawState(auth.user.id, env);
  gameplayModifiers.heatPenalty = await getLawChancePenalty(auth.user.id, env);
  const crimes = CRIME_REGISTRY.map(crime => {
    const progress = normalizeCrimeProgress(progressById.get(crime.id), crime.id);
    return toPublicCrime(crime, progress, player, location, owned, gameplayModifiers);
  });

  return json({
    ok: true,
    crimes,
    player: toPublicPlayerState(player),
    history: (historyRows.results || []).map(toPublicCrimeHistory),
    law
  });
}

async function executeCrime(request, env, requestId) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);

  const body = await readJson(request);
  const crimeId = typeof body?.crimeId === 'string' ? body.crimeId.trim() : '';
  const approach = ['quiet','balanced','bold'].includes(String(body?.approach||'')) ? String(body.approach) : 'balanced';
  const crime = getCrimeDefinition(crimeId);
  if (!crime) return json({ ok: false, error: 'Unknown crime' }, 404);

  await ensureCrimeTables(env);
  await ensureGameplayTables(env);
  await ensureInventoryTable(env);
  const player = await ensureActivePlayerState(env, auth.user.id);
  const location = await ensurePlayerLocation(env, auth.user.id);
  const progressRow = await env.DB.prepare(`
    SELECT crime_id, mastery, attempts, successes, failures, last_attempt_at, updated_at
    FROM player_crime_progress WHERE user_id = ? AND crime_id = ?
  `).bind(auth.user.id, crime.id).first();
  const progress = normalizeCrimeProgress(progressRow, crime.id);
  const now = Date.now();

  if (player.status !== 'active') {
    const untilText = player.status_until ? ` until ${new Date(player.status_until).toISOString()}` : '';
    return json({ ok: false, error: `You cannot commit crimes while ${player.status}${untilText}.`, player: toPublicPlayerState(player) }, 409);
  }
  if (Number(player.nerve) < crime.nerveCost) {
    return json({ ok: false, error: `You need ${crime.nerveCost} nerve for ${crime.name}.`, player: toPublicPlayerState(player) }, 409);
  }
  if (progress.lastAttemptAt && now - progress.lastAttemptAt < 1200) {
    return json({ ok: false, error: 'Crime request received too quickly. Try again in a moment.' }, 429);
  }
  if (crime.requiredLocationId && location.location_id !== crime.requiredLocationId) {
    const required = getWorldLocation(crime.requiredLocationId);
    return json({ ok: false, error: `You must be at ${required?.name || crime.requiredLocationId} for this crime.` }, 409);
  }

  let requiredItem = null;
  if (crime.requiredItemId) {
    requiredItem = await getOwnedItemRow(env, auth.user.id, crime.requiredItemId);
    if (!requiredItem || Number(requiredItem.quantity) < 1) {
      const definition = getItemDefinition(crime.requiredItemId);
      return json({ ok: false, error: `${definition?.name || crime.requiredItemId} is required for ${crime.name}.` }, 409);
    }
  }

  const gameplayModifiers = await getGameplayModifiers(auth.user.id, env);
  gameplayModifiers.heatPenalty = await getLawChancePenalty(auth.user.id, env);
  const approachChance = approach==='quiet'?.04:approach==='bold'?-.06:0;
  const approachReward = approach==='quiet'?.80:approach==='bold'?1.35:1;
  const approachHeat = approach==='quiet'?.70:approach==='bold'?1.40:1;
  const chance = Math.max(.05,Math.min(.97,calculateCrimeChance(crime, progress, player, gameplayModifiers)+approachChance));
  const success = randomFloat() < chance;
  const masteryDelta = success ? 2 : 1;
  const nextMastery = Math.min(100, progress.mastery + masteryDelta);
  const nerveAfter = Math.max(0, Number(player.nerve) - crime.nerveCost);
  let cashDelta = 0;
  let xpDelta = 0;
  let itemReward = null;
  let consequenceStatus = null;
  let consequenceUntil = null;
  let resultText = '';

  if (success) {
    cashDelta = Math.max(0,Math.round(randomInt(crime.cashMin, crime.cashMax)*approachReward));
    xpDelta = Math.max(1,Math.round(randomInt(crime.xpMin, crime.xpMax)*(.9+approachReward*.1)));
    if (crime.itemPool.length && randomFloat() < crime.itemChance) {
      const rewardChoice = weightedPick(crime.itemPool);
      if (rewardChoice) {
        const definition = getItemDefinition(rewardChoice.itemId);
        if (definition) itemReward = { definition, quantity: Math.max(1, Number(rewardChoice.quantity) || 1) };
      }
    }
    resultText = itemReward
      ? `Success. You made $${cashDelta} and found ${itemReward.definition.name}.`
      : `Success. You made $${cashDelta}.`;
  } else {
    const failRoll = randomFloat();
    const jailCutoff = Number(crime.failure?.jailChance) || 0;
    const hospitalCutoff = jailCutoff + (Number(crime.failure?.hospitalChance) || 0);
    if (failRoll < jailCutoff) consequenceStatus = 'jailed';
    else if (failRoll < hospitalCutoff) consequenceStatus = 'hospitalized';

    if (consequenceStatus) {
      const seconds = randomInt(crime.failure.minSeconds, crime.failure.maxSeconds);
      consequenceUntil = now + seconds * 1000;
      resultText = consequenceStatus === 'jailed'
        ? `Failed. You were caught and sent to Blackridge for ${seconds} seconds.`
        : `Failed. You were injured and hospitalized for ${seconds} seconds.`;
    } else {
      resultText = 'Failed. You got away, but came back empty-handed.';
    }
  }

  const levelResult = applyXpAndLevels(Number(player.level), Number(player.xp), xpDelta);
  const historyId = crypto.randomUUID();
  const statements = [
    env.DB.prepare(`
      UPDATE player_state
      SET nerve = ?, cash = cash + ?, level = ?, xp = ?, status = ?, status_until = ?, status_reason = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(
      nerveAfter,
      cashDelta,
      levelResult.level,
      levelResult.xp,
      consequenceStatus || 'active',
      consequenceUntil,
      consequenceStatus ? `${crime.name} consequence` : null,
      now,
      auth.user.id
    ),
    env.DB.prepare(`
      INSERT INTO player_crime_progress
        (user_id, crime_id, mastery, attempts, successes, failures, last_attempt_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(user_id, crime_id) DO UPDATE SET
        mastery = excluded.mastery,
        attempts = player_crime_progress.attempts + 1,
        successes = player_crime_progress.successes + excluded.successes,
        failures = player_crime_progress.failures + excluded.failures,
        last_attempt_at = excluded.last_attempt_at,
        updated_at = excluded.updated_at
    `).bind(auth.user.id, crime.id, nextMastery, success ? 1 : 0, success ? 0 : 1, now, now),
    env.DB.prepare(`
      INSERT INTO crime_history
        (id, user_id, crime_id, success, chance, nerve_spent, cash_delta, xp_delta, mastery_delta,
         item_reward_id, item_reward_quantity, consequence_status, consequence_until, result_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      historyId, auth.user.id, crime.id, success ? 1 : 0, chance, crime.nerveCost, cashDelta, xpDelta,
      masteryDelta, itemReward?.definition.id || null, itemReward?.quantity || 0,
      consequenceStatus, consequenceUntil, resultText, now
    )
  ];

  if (itemReward) {
    const maxStack = itemReward.definition.stackable ? itemReward.definition.maxStack : 1;
    statements.push(env.DB.prepare(`
      INSERT INTO player_inventory (user_id, item_id, quantity, equipped_slot, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?)
      ON CONFLICT(user_id, item_id) DO UPDATE SET
        quantity = MIN(?, player_inventory.quantity + excluded.quantity),
        updated_at = excluded.updated_at
    `).bind(auth.user.id, itemReward.definition.id, itemReward.quantity, now, now, maxStack));
  }

  await env.DB.batch(statements);
  await ensureGameplayTables(env);
  if (success) await incrementProgress(auth.user.id, 'crime', 1, env);
  const heatCrime={...crime,heatSuccess:Math.round((Number(crime.heatSuccess)||0)*approachHeat),heatFailure:Math.round((Number(crime.heatFailure)||0)*approachHeat)};
  const law = await applyCrimeHeat(auth.user.id, heatCrime, success, env);
  await recordActivity(auth.user.id,'crime',`${crime.name}: ${success?'success':'failed'}`,resultText,'crimes',env);
  if (cashDelta > 0) {
    const cashRow = await env.DB.prepare('SELECT cash FROM player_state WHERE user_id = ?').bind(auth.user.id).first();
    await setProgressAtLeast(auth.user.id, 'cash', Number(cashRow?.cash) || 0, env);
  }
  const updatedPlayer = await ensureActivePlayerState(env, auth.user.id);
  const updatedProgressRow = await env.DB.prepare(`
    SELECT crime_id, mastery, attempts, successes, failures, last_attempt_at, updated_at
    FROM player_crime_progress WHERE user_id = ? AND crime_id = ?
  `).bind(auth.user.id, crime.id).first();
  const updatedProgress = normalizeCrimeProgress(updatedProgressRow, crime.id);

  await writeAudit(env, auth.user.id, 'crime.executed', auth.user.id, {
    crimeId: crime.id, success, cashDelta, xpDelta, masteryDelta,
    itemRewardId: itemReward?.definition.id || null, consequenceStatus
  });
  await safeWriteSystemLog(env, {
    severity: 'INFO', eventType: 'CRIME_EXECUTED', message: `${auth.user.username}: ${crime.name} — ${success ? 'success' : 'failure'}`,
    route: '/api/crimes/execute', method: 'POST', requestId, userId: auth.user.id,
    context: { crimeId: crime.id, success, cashDelta, xpDelta, masteryDelta, consequenceStatus }
  });

  return json({
    ok: true,
    result: {
      id: historyId,
      crimeId: crime.id,
      crimeName: crime.name,
      success,
      chance,
      nerveSpent: crime.nerveCost,
      cashDelta,
      xpDelta,
      masteryDelta,
      levelUps: levelResult.levelUps,
      itemReward: itemReward ? { ...toPublicItemDefinition(itemReward.definition), quantity: itemReward.quantity } : null,
      consequence: consequenceStatus ? { status: consequenceStatus, until: consequenceUntil } : null,
      text: resultText,
      createdAt: now
    },
    progress: updatedProgress,
    player: toPublicPlayerState(updatedPlayer)
  });
}

async function getItemCatalog(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  return json({
    ok: true,
    items: ITEM_REGISTRY.map(toPublicItemDefinition),
    count: ITEM_REGISTRY.length
  });
}

async function getItem(request, env, url) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const id = decodeURIComponent(url.pathname.slice('/api/items/'.length));
  const item = getItemDefinition(id);
  if (!item) return json({ ok: false, error: 'Item not found' }, 404);
  return json({ ok: true, item: toPublicItemDefinition(item) });
}

async function getInventory(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  await ensureInventoryTable(env);

  const result = await env.DB.prepare(`
    SELECT item_id, quantity, equipped_slot, created_at, updated_at
    FROM player_inventory
    WHERE user_id = ? AND quantity > 0
    ORDER BY updated_at DESC, item_id ASC
  `).bind(auth.user.id).all();

  const inventory = (result.results || [])
    .map(row => {
      const definition = getItemDefinition(row.item_id);
      if (!definition) return null;
      return {
        ...toPublicItemDefinition(definition),
        quantity: Number(row.quantity) || 0,
        equipped: Boolean(row.equipped_slot),
        equippedSlot: row.equipped_slot || null,
        acquiredAt: row.created_at,
        updatedAt: row.updated_at
      };
    })
    .filter(Boolean);

  return json({
    ok: true,
    inventory,
    catalog: ITEM_REGISTRY.map(toPublicItemDefinition),
    summary: {
      uniqueItems: inventory.length,
      totalQuantity: inventory.reduce((sum, item) => sum + item.quantity, 0),
      registryItems: ITEM_REGISTRY.length
    }
  });
}

async function useInventoryItem(request, env, requestId) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const body = await readJson(request);
  const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
  const item = getItemDefinition(itemId);
  if (!item) return json({ ok: false, error: 'Unknown item' }, 404);
  if (!item.usable) return json({ ok: false, error: `${item.name} cannot be used directly` }, 400);

  const owned = await getOwnedItemRow(env, auth.user.id, itemId);
  if (!owned || owned.quantity < 1) return json({ ok: false, error: `You do not own ${item.name}` }, 400);

  const player = await ensurePlayerState(env, auth.user.id);
  const effectResult = calculateResourceEffects(player, item.effects || {});
  if (!effectResult.changed) return json({ ok: false, error: effectResult.reason || 'That item would have no effect right now' }, 409);

  const now = Date.now();
  const statements = [
    env.DB.prepare(`
      UPDATE player_state SET health = ?, nerve = ?, energy = ?, updated_at = ? WHERE user_id = ?
    `).bind(effectResult.health, effectResult.nerve, effectResult.energy, now, auth.user.id)
  ];

  if (item.consumable) {
    if (owned.quantity <= 1) {
      statements.push(env.DB.prepare('DELETE FROM player_inventory WHERE user_id = ? AND item_id = ?').bind(auth.user.id, itemId));
    } else {
      statements.push(env.DB.prepare(`
        UPDATE player_inventory SET quantity = quantity - 1, updated_at = ? WHERE user_id = ? AND item_id = ?
      `).bind(now, auth.user.id, itemId));
    }
  }

  await env.DB.batch(statements);
  await writeAudit(env, auth.user.id, 'inventory.item_used', auth.user.id, { itemId, effects: effectResult.applied });
  await safeWriteSystemLog(env, {
    severity: 'INFO', eventType: 'ITEM_USED', message: `${auth.user.username} used ${item.name}`,
    route: '/api/inventory/use', method: 'POST', requestId, userId: auth.user.id,
    context: { itemId, effects: effectResult.applied }
  });

  const updatedPlayer = await getPlayerStateRow(env, auth.user.id);
  return json({
    ok: true,
    message: `${item.name} used`,
    player: toPublicPlayerState(updatedPlayer),
    itemId,
    consumed: item.consumable
  });
}

async function equipInventoryItem(request, env, requestId) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const body = await readJson(request);
  const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
  const item = getItemDefinition(itemId);
  if (!item) return json({ ok: false, error: 'Unknown item' }, 404);
  if (!item.equipable || !item.equipmentSlot) return json({ ok: false, error: `${item.name} cannot be equipped` }, 400);

  const owned = await getOwnedItemRow(env, auth.user.id, itemId);
  if (!owned || owned.quantity < 1) return json({ ok: false, error: `You do not own ${item.name}` }, 400);

  await ensureInventoryTable(env);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE player_inventory SET equipped_slot = NULL, updated_at = ? WHERE user_id = ? AND equipped_slot = ?')
      .bind(now, auth.user.id, item.equipmentSlot),
    env.DB.prepare('UPDATE player_inventory SET equipped_slot = ?, updated_at = ? WHERE user_id = ? AND item_id = ?')
      .bind(item.equipmentSlot, now, auth.user.id, itemId)
  ]);

  await writeAudit(env, auth.user.id, 'inventory.item_equipped', auth.user.id, { itemId, slot: item.equipmentSlot });
  await safeWriteSystemLog(env, {
    severity: 'INFO', eventType: 'ITEM_EQUIPPED', message: `${auth.user.username} equipped ${item.name}`,
    route: '/api/inventory/equip', method: 'POST', requestId, userId: auth.user.id,
    context: { itemId, slot: item.equipmentSlot }
  });
  return json({ ok: true, message: `${item.name} equipped`, itemId, slot: item.equipmentSlot });
}

async function unequipInventoryItem(request, env, requestId) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const body = await readJson(request);
  const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
  const item = getItemDefinition(itemId);
  if (!item) return json({ ok: false, error: 'Unknown item' }, 404);

  const owned = await getOwnedItemRow(env, auth.user.id, itemId);
  if (!owned || !owned.equipped_slot) return json({ ok: false, error: `${item.name} is not equipped` }, 400);
  const now = Date.now();
  await env.DB.prepare('UPDATE player_inventory SET equipped_slot = NULL, updated_at = ? WHERE user_id = ? AND item_id = ?')
    .bind(now, auth.user.id, itemId).run();

  await writeAudit(env, auth.user.id, 'inventory.item_unequipped', auth.user.id, { itemId });
  await safeWriteSystemLog(env, {
    severity: 'INFO', eventType: 'ITEM_UNEQUIPPED', message: `${auth.user.username} unequipped ${item.name}`,
    route: '/api/inventory/unequip', method: 'POST', requestId, userId: auth.user.id,
    context: { itemId }
  });
  return json({ ok: true, message: `${item.name} unequipped`, itemId });
}

function calculateResourceEffects(player, effects) {
  const start = {
    health: Number(player.health) || 0,
    nerve: Number(player.nerve) || 0,
    energy: Number(player.energy) || 0
  };
  const max = {
    health: Number(player.max_health) || 100,
    nerve: Number(player.max_nerve) || 10,
    energy: Number(player.max_energy) || 100
  };
  const next = { ...start };
  const applied = {};

  for (const resource of ['health', 'nerve', 'energy']) {
    const amount = Number(effects?.[resource]) || 0;
    if (!amount) continue;
    const target = Math.max(0, Math.min(max[resource], start[resource] + amount));
    const delta = target - start[resource];
    next[resource] = target;
    if (delta !== 0) applied[resource] = delta;
  }

  const changed = Object.keys(applied).length > 0;
  return {
    changed,
    health: next.health,
    nerve: next.nerve,
    energy: next.energy,
    applied,
    reason: changed ? null : 'Your affected resources are already full'
  };
}

async function ensureInventoryTable(env) {
  try {
    await env.DB.prepare(PLAYER_INVENTORY_TABLE_SQL).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_inventory_user ON player_inventory(user_id)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_inventory_equipped ON player_inventory(user_id, equipped_slot)').run();
  } catch (error) {
    throw new Error(`Could not initialize player inventory: ${safeErrorMessage(error)}`);
  }
}

async function getOwnedItemRow(env, userId, itemId) {
  await ensureInventoryTable(env);
  return env.DB.prepare(`
    SELECT item_id, quantity, equipped_slot, created_at, updated_at
    FROM player_inventory WHERE user_id = ? AND item_id = ?
  `).bind(userId, itemId).first();
}

// Server-side core helpers for future shops, crimes, rewards and admin tools.
async function addItemToInventory(env, userId, itemId, quantity = 1) {
  const item = getItemDefinition(itemId);
  if (!item) throw new Error(`Unknown item: ${itemId}`);
  const amount = Math.max(1, Math.floor(Number(quantity) || 1));
  await ensureInventoryTable(env);
  const existing = await getOwnedItemRow(env, userId, itemId);
  const currentQuantity = Number(existing?.quantity) || 0;
  const maximum = item.stackable ? item.maxStack : 1;
  const nextQuantity = Math.min(maximum, currentQuantity + amount);
  if (nextQuantity <= currentQuantity) return { added: 0, quantity: currentQuantity };
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO player_inventory (user_id, item_id, quantity, equipped_slot, created_at, updated_at)
    VALUES (?, ?, ?, NULL, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at
  `).bind(userId, itemId, nextQuantity, existing?.created_at || now, now).run();
  return { added: nextQuantity - currentQuantity, quantity: nextQuantity };
}

async function removeItemFromInventory(env, userId, itemId, quantity = 1) {
  const owned = await getOwnedItemRow(env, userId, itemId);
  if (!owned) return { removed: 0, quantity: 0 };
  const amount = Math.max(1, Math.floor(Number(quantity) || 1));
  const current = Number(owned.quantity) || 0;
  const removed = Math.min(current, amount);
  const remaining = current - removed;
  if (remaining <= 0) {
    await env.DB.prepare('DELETE FROM player_inventory WHERE user_id = ? AND item_id = ?').bind(userId, itemId).run();
  } else {
    await env.DB.prepare('UPDATE player_inventory SET quantity = ?, updated_at = ? WHERE user_id = ? AND item_id = ?')
      .bind(remaining, Date.now(), userId, itemId).run();
  }
  return { removed, quantity: remaining };
}

async function ensureCrimeTables(env) {
  await ensureInventoryTable(env);
  await env.DB.prepare(PLAYER_CRIME_PROGRESS_TABLE_SQL).run();
  await env.DB.prepare(CRIME_HISTORY_TABLE_SQL).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_crime_progress_user ON player_crime_progress(user_id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_crime_progress_mastery ON player_crime_progress(user_id, mastery)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_crime_history_user_created ON crime_history(user_id, created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_crime_history_crime ON crime_history(user_id, crime_id, created_at DESC)').run();
}

function normalizeCrimeProgress(row, crimeId) {
  return {
    crimeId,
    mastery: Math.max(0, Math.min(100, Number(row?.mastery) || 0)),
    attempts: Number(row?.attempts) || 0,
    successes: Number(row?.successes) || 0,
    failures: Number(row?.failures) || 0,
    lastAttemptAt: row?.last_attempt_at || null,
    updatedAt: row?.updated_at || null
  };
}

function calculateCrimeChance(crime, progress, player, modifiers = {}) {
  const masteryBonus = (progress.mastery / 100) * 0.12;
  const dexterityBonus = Math.min(0.04, Math.max(0, (Number(player.dexterity) - 1) * 0.002));
  const externalBonus = Number(modifiers.crimeChanceBonus) || 0;
  const heatPenalty = Number(modifiers.heatPenalty) || 0;
  return Math.max(0.05, Math.min(0.97, crime.baseChance + masteryBonus + dexterityBonus + externalBonus - heatPenalty));
}

function toPublicCrime(crime, progress, player, location, owned, modifiers = {}) {
  const requiredItem = crime.requiredItemId ? getItemDefinition(crime.requiredItemId) : null;
  const requiredLocation = crime.requiredLocationId ? getWorldLocation(crime.requiredLocationId) : null;
  const lockedReasons = [];
  if (Number(player.nerve) < crime.nerveCost) lockedReasons.push(`Needs ${crime.nerveCost} nerve`);
  if (player.status !== 'active') lockedReasons.push(`Unavailable while ${player.status}`);
  if (requiredItem && (owned.get(requiredItem.id) || 0) < 1) lockedReasons.push(`Requires ${requiredItem.name}`);
  if (requiredLocation && location.location_id !== requiredLocation.id) lockedReasons.push(`Requires ${requiredLocation.name}`);

  return {
    id: crime.id,
    name: crime.name,
    category: crime.category,
    career: crime.career || crime.category,
    uiType: crime.uiType || 'target',
    description: crime.description,
    nerveCost: crime.nerveCost,
    successChance: calculateCrimeChance(crime, progress, player, modifiers),
    mastery: progress.mastery,
    attempts: progress.attempts,
    successes: progress.successes,
    failures: progress.failures,
    requiredItem: requiredItem ? { id: requiredItem.id, name: requiredItem.name, owned: owned.get(requiredItem.id) || 0 } : null,
    requiredLocation: requiredLocation ? { id: requiredLocation.id, name: requiredLocation.name, current: location.location_id === requiredLocation.id } : null,
    available: lockedReasons.length === 0,
    lockedReasons,
    heat: { success: Number(crime.heatSuccess)||0, failure: Number(crime.heatFailure)||0 },
    modifiers: { crimeChanceBonus: Number(modifiers.crimeChanceBonus) || 0, heatPenalty:Number(modifiers.heatPenalty)||0, event: modifiers.event || null }
  };
}

function toPublicCrimeHistory(row) {
  const crime = getCrimeDefinition(row.crime_id);
  const item = row.item_reward_id ? getItemDefinition(row.item_reward_id) : null;
  return {
    id: row.id,
    crimeId: row.crime_id,
    crimeName: crime?.name || row.crime_id,
    success: Boolean(row.success),
    cashDelta: Number(row.cash_delta) || 0,
    xpDelta: Number(row.xp_delta) || 0,
    masteryDelta: Number(row.mastery_delta) || 0,
    itemReward: item ? { id: item.id, name: item.name, quantity: Number(row.item_reward_quantity) || 0 } : null,
    consequence: row.consequence_status ? { status: row.consequence_status, until: row.consequence_until } : null,
    text: row.result_text,
    createdAt: row.created_at
  };
}

function applyXpAndLevels(level, xp, xpGain) {
  let currentLevel = Math.max(1, Number(level) || 1);
  let currentXp = Math.max(0, Number(xp) || 0) + Math.max(0, Number(xpGain) || 0);
  let levelUps = 0;
  while (currentXp >= xpNeededForLevel(currentLevel) && levelUps < 50) {
    currentXp -= xpNeededForLevel(currentLevel);
    currentLevel += 1;
    levelUps += 1;
  }
  return { level: currentLevel, xp: currentXp, levelUps };
}

function randomFloat() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 0x100000000;
}

function randomInt(minimum, maximum) {
  const min = Math.ceil(Number(minimum) || 0);
  const max = Math.floor(Number(maximum) || min);
  if (max <= min) return min;
  return min + Math.floor(randomFloat() * (max - min + 1));
}

function weightedPick(entries) {
  const valid = (entries || []).filter(entry => Number(entry.weight) > 0);
  const total = valid.reduce((sum, entry) => sum + Number(entry.weight), 0);
  if (!total) return null;
  let roll = randomFloat() * total;
  for (const entry of valid) {
    roll -= Number(entry.weight);
    if (roll <= 0) return entry;
  }
  return valid[valid.length - 1] || null;
}

async function getWorld(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const current = await ensurePlayerLocation(env, auth.user.id);
  return json({
    ok: true,
    world: {
      categories: WORLD_CATEGORIES.map(category => ({
        ...category,
        locationCount: WORLD_LOCATIONS.filter(location => location.categoryId === category.id).length
      })),
      locations: WORLD_LOCATIONS.map(location => ({
        id: location.id,
        categoryId: location.categoryId,
        code: location.code,
        name: location.name,
        type: location.type,
        status: location.status,
        shortDescription: location.shortDescription
      })),
      current: toPublicPlayerLocation(current)
    }
  });
}

async function getDistrict(request, env, url) {
  // Backward-compatible category endpoint retained while the V2 API settles.
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const id = decodeURIComponent(url.pathname.slice('/api/world/districts/'.length));
  const category = getWorldCategory(id);
  if (!category) return json({ ok: false, error: 'Category not found' }, 404);
  const current = await ensurePlayerLocation(env, auth.user.id);
  return json({
    ok: true,
    district: {
      ...category,
      locations: WORLD_LOCATIONS.filter(location => location.categoryId === category.id)
    },
    current: toPublicPlayerLocation(current)
  });
}

async function getLocation(request, env, url) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const id = decodeURIComponent(url.pathname.slice('/api/world/locations/'.length));
  const location = getWorldLocation(id);
  if (!location) return json({ ok: false, error: 'Location not found' }, 404);
  const category = getWorldCategory(location.categoryId);
  const current = await ensurePlayerLocation(env, auth.user.id);
  return json({ ok: true, location, category, current: toPublicPlayerLocation(current) });
}

async function travelToLocation(request, env, requestId) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const body = await readJson(request);
  const locationId = typeof body?.locationId === 'string' ? body.locationId.trim() : '';
  const location = getWorldLocation(locationId);
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
  `).bind(auth.user.id, location.categoryId, location.id, now).run();

  await ensureGameplayTables(env);
  await incrementProgress(auth.user.id, 'travel', 1, env);

  await writeAudit(env, auth.user.id, 'world.travel', auth.user.id, {
    categoryId: location.categoryId,
    locationId: location.id
  });

  const category = getWorldCategory(location.categoryId);
  return json({
    ok: true,
    current: {
      categoryId: location.categoryId,
      categoryName: category?.name || location.categoryId,
      districtId: location.categoryId,
      districtName: category?.name || location.categoryId,
      locationId: location.id,
      locationName: location.name,
      updatedAt: now
    }
  });
}

async function health(env) {
  const result = { ok: true, service: 'riftcity-v2-phase6-foundation', database: 'unknown' };
  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
    result.database = 'connected';
  } catch {
    result.ok = false;
    result.database = 'error';
  }
  return json(result, result.ok ? 200 : 503);
}


const BLOCK_LAYOUT_MAX_BYTES = 350_000;

async function ensureBlockEditorTables(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS block_layouts (
        block_id TEXT PRIMARY KEY,
        draft_json TEXT,
        draft_revision INTEGER NOT NULL DEFAULT 0,
        published_json TEXT,
        published_revision INTEGER NOT NULL DEFAULT 0,
        updated_by TEXT,
        updated_at INTEGER,
        published_at INTEGER,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS block_layout_history (
        id TEXT PRIMARY KEY,
        block_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        layout_json TEXT NOT NULL,
        published_by TEXT,
        published_at INTEGER NOT NULL,
        FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_block_layout_history_block ON block_layout_history(block_id, published_at DESC)`)
  ]);
}

function blockIdFromPath(pathname, suffix='') {
  const stripped = suffix && pathname.endsWith(suffix) ? pathname.slice(0, -suffix.length) : pathname;
  const raw = stripped.split('/').filter(Boolean).pop() || '';
  const id = decodeURIComponent(raw);
  return /^[a-z0-9][a-z0-9-]{1,80}$/i.test(id) ? id : '';
}

function validateBlockLayout(block, expectedId) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return 'Block layout must be an object';
  if (String(block.id || '') !== expectedId) return 'Block id does not match the route';
  const width = Number(block.width), height = Number(block.height);
  if (!Number.isFinite(width) || width < 320 || width > 20000) return 'Invalid block width';
  if (!Number.isFinite(height) || height < 240 || height > 12000) return 'Invalid block height';
  if (!Array.isArray(block.buildings) || block.buildings.length > 250) return 'Invalid buildings array';
  if (!Array.isArray(block.props) || block.props.length > 1000) return 'Invalid props array';
  if (!block.spawn || !Number.isFinite(Number(block.spawn.x)) || !Number.isFinite(Number(block.spawn.y))) return 'Invalid spawn';
  if (!block.walkable || !Number.isFinite(Number(block.walkable.x)) || !Number.isFinite(Number(block.walkable.y))) return 'Invalid walkable area';

  const jsonText = JSON.stringify(block);
  if (new TextEncoder().encode(jsonText).byteLength > BLOCK_LAYOUT_MAX_BYTES) {
    return 'Block layout is too large. Keep image/assets outside the layout JSON.';
  }
  return '';
}

async function getPublishedBlockLayout(request, env, url) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const blockId = blockIdFromPath(url.pathname);
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);
  const row = await env.DB.prepare(`
    SELECT published_json, published_revision, published_at
    FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  if (!row?.published_json) {
    return json({ ok: true, blockId, published: false, revision: 0, block: null });
  }

  try {
    return json({
      ok: true,
      blockId,
      published: true,
      revision: Number(row.published_revision || 0),
      publishedAt: row.published_at,
      block: JSON.parse(row.published_json)
    });
  } catch {
    return json({ ok: false, error: 'Published block layout is corrupted' }, 500);
  }
}

async function getBlockEditorState(request, env, url) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/editor');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);

  const row = await env.DB.prepare(`
    SELECT draft_json, draft_revision, published_json, published_revision, updated_at, published_at
    FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  let draft = null, published = null;
  try { if (row?.draft_json) draft = JSON.parse(row.draft_json); } catch {}
  try { if (row?.published_json) published = JSON.parse(row.published_json); } catch {}

  return json({
    ok: true,
    blockId,
    draft,
    draftRevision: Number(row?.draft_revision || 0),
    published,
    publishedRevision: Number(row?.published_revision || 0),
    updatedAt: row?.updated_at || null,
    publishedAt: row?.published_at || null
  });
}

async function saveBlockDraft(request, env, url, requestId) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/draft');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);

  const body = await readJson(request);
  const error = validateBlockLayout(body?.block, blockId);
  if (error) return json({ ok: false, error }, 400);

  await ensureBlockEditorTables(env);
  const now = Date.now();
  const layoutJson = JSON.stringify(body.block);

  await env.DB.prepare(`
    INSERT INTO block_layouts (
      block_id, draft_json, draft_revision, published_json, published_revision,
      updated_by, updated_at, published_at
    ) VALUES (?, ?, 1, NULL, 0, ?, ?, NULL)
    ON CONFLICT(block_id) DO UPDATE SET
      draft_json = excluded.draft_json,
      draft_revision = block_layouts.draft_revision + 1,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).bind(blockId, layoutJson, gate.auth.user.id, now).run();

  const row = await env.DB.prepare(`
    SELECT draft_revision FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  await writeAudit(env, gate.auth.user.id, 'block.draft_saved', gate.auth.user.id, {
    blockId, revision: Number(row?.draft_revision || 0)
  });

  return json({
    ok: true,
    blockId,
    draftRevision: Number(row?.draft_revision || 0),
    savedAt: now,
    requestId
  });
}

async function publishBlockDraft(request, env, url, requestId) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/publish');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);

  const row = await env.DB.prepare(`
    SELECT draft_json, draft_revision, published_revision
    FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  if (!row?.draft_json) return json({ ok: false, error: 'No saved draft to publish' }, 409);
  let parsed;
  try { parsed = JSON.parse(row.draft_json); } catch { return json({ ok: false, error: 'Draft JSON is corrupted' }, 500); }
  const validationError = validateBlockLayout(parsed, blockId);
  if (validationError) return json({ ok: false, error: validationError }, 400);

  const nextRevision = Number(row.published_revision || 0) + 1;
  const now = Date.now();
  const historyId = crypto.randomUUID();

  // D1 batch is transactional: the published row and history snapshot succeed or roll back together.
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE block_layouts
      SET published_json = draft_json,
          published_revision = ?,
          published_at = ?,
          updated_by = ?,
          updated_at = ?
      WHERE block_id = ?
    `).bind(nextRevision, now, gate.auth.user.id, now, blockId),
    env.DB.prepare(`
      INSERT INTO block_layout_history (id, block_id, revision, layout_json, published_by, published_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(historyId, blockId, nextRevision, row.draft_json, gate.auth.user.id, now)
  ]);

  await writeAudit(env, gate.auth.user.id, 'block.published', gate.auth.user.id, {
    blockId, revision: nextRevision
  });

  return json({
    ok: true,
    blockId,
    publishedRevision: nextRevision,
    publishedAt: now,
    block: parsed,
    requestId
  });
}

async function revertBlockDraft(request, env, url, requestId) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/revert-draft');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);

  const row = await env.DB.prepare(`
    SELECT published_json FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  if (!row?.published_json) {
    await env.DB.prepare(`DELETE FROM block_layouts WHERE block_id = ?`).bind(blockId).run();
    return json({ ok: true, blockId, revertedTo: 'authored', block: null, requestId });
  }

  const now = Date.now();
  await env.DB.prepare(`
    UPDATE block_layouts
    SET draft_json = published_json,
        draft_revision = draft_revision + 1,
        updated_by = ?,
        updated_at = ?
    WHERE block_id = ?
  `).bind(gate.auth.user.id, now, blockId).run();

  return json({
    ok: true,
    blockId,
    revertedTo: 'published',
    block: JSON.parse(row.published_json),
    requestId
  });
}

async function getBlockLayoutHistory(request, env, url) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/history');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);

  const result = await env.DB.prepare(`
    SELECT revision, published_by, published_at
    FROM block_layout_history
    WHERE block_id = ?
    ORDER BY revision DESC
    LIMIT 25
  `).bind(blockId).all();

  return json({ ok: true, blockId, history: result.results || [] });
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


async function serveDeveloperBlockEditor(request, env) {
  const gate = await requireAdmin(request, env);
  if (gate.response) {
    const status = gate.response.status === 401 ? 401 : 403;
    return new Response(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>RiftCity Developer Access</title>
<style>
html,body{height:100%;margin:0;background:#05090c;color:#eef8fa;font:700 16px system-ui}
main{height:100%;display:grid;place-items:center;padding:24px;box-sizing:border-box;text-align:center}
a{color:#63e6b1}
</style></head><body><main><div><h1>Developer access required</h1>
<p>This RiftCity authoring surface is restricted to developer/admin accounts.</p>
<a href="/">Return to RiftCity</a></div></main></body></html>`, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'same-origin'
      }
    });
  }

  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no">
  <meta name="theme-color" content="#061014">
  <meta name="robots" content="noindex,nofollow">
  <title>RiftCity — Block Editor</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="dev-block-editor-page">
  <main id="dev-block-editor-root" aria-label="RiftCity Block Editor">
    <div class="dev-editor-loading"><strong>BLOCK EDITOR</strong><span>Loading Commerce Street…</span></div>
  </main>
  <script type="module">
import { renderBlockWorld, destroyBlockWorld } from '/views/block-world.js';
const root=document.querySelector('#dev-block-editor-root');
async function boot(){
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!['admin','developer'].includes(data&&data.user&&data.user.role)){
    root.innerHTML='<section class="dev-editor-denied"><strong>Developer access required</strong><a href="/">Return to RiftCity</a></section>';
    return;
  }
  document.documentElement.classList.add('dev-block-editor-document');
  await renderBlockWorld(root,{editorWorkspace:true});
}
window.addEventListener('pagehide',()=>destroyBlockWorld(),{once:true});
boot().catch(error=>{
  console.error(error);
  root.innerHTML='<section class="dev-editor-denied"><strong>Block Editor failed to start</strong><a href="/">Return to RiftCity</a></section>';
});
</script>
</body>
</html>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'same-origin'
    }
  });
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
  const columns = await env.DB.prepare('PRAGMA table_info(player_state)').all();
  const names = new Set((columns.results || []).map(row => row.name));
  for (const column of ['health_regen_at','energy_regen_at','nerve_regen_at']) {
    if (!names.has(column)) {
      await env.DB.prepare(`ALTER TABLE player_state ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`).run();
    }
  }
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_state_status ON player_state(status)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_player_state_level ON player_state(level)').run();
}

async function ensurePlayerState(env, userId) {
  await ensurePlayerStateTable(env);
  const now = Date.now();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO player_state
      (user_id, health_regen_at, energy_regen_at, nerve_regen_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(userId, now, now, now, now, now).run();
  return getPlayerStateRow(env, userId);
}

async function getPlayerStateRow(env, userId) {
  const row = await env.DB.prepare(`
    SELECT user_id, health, max_health, nerve, max_nerve, energy, max_energy, cash,
      level, xp, strength, defense, speed, dexterity, status, status_until, status_reason,
      health_regen_at, energy_regen_at, nerve_regen_at, created_at, updated_at
    FROM player_state WHERE user_id = ?
  `).bind(userId).first();

  if (!row) throw new Error('Could not create or load player state');
  return row;
}

function settleResourceValue(current, maximum, lastAt, config, timestamp) {
  const value = Math.max(0, Number(current) || 0);
  const max = Math.max(1, Number(maximum) || 1);
  const amount = Math.max(1, Number(config?.amount) || 1);
  const intervalMs = Math.max(1000, Number(config?.intervalSeconds) * 1000 || 300000);
  let anchor = Number(lastAt) || timestamp;

  if (value >= max) return { value: max, anchor: timestamp, nextAt: null, amount, intervalMs };

  const elapsed = Math.max(0, timestamp - anchor);
  const ticks = Math.floor(elapsed / intervalMs);
  if (!ticks) return { value, anchor, nextAt: anchor + intervalMs, amount, intervalMs };

  const gained = ticks * amount;
  const nextValue = Math.min(max, value + gained);
  anchor += ticks * intervalMs;
  if (nextValue >= max) anchor = timestamp;
  return { value: nextValue, anchor, nextAt: nextValue >= max ? null : anchor + intervalMs, amount, intervalMs };
}

async function settlePlayerResources(env, player) {
  const timestamp = Date.now();
  const health = settleResourceValue(player.health, player.max_health, player.health_regen_at, RESOURCE_REGEN.health, timestamp);
  const energy = settleResourceValue(player.energy, player.max_energy, player.energy_regen_at, RESOURCE_REGEN.energy, timestamp);
  const nerve = settleResourceValue(player.nerve, player.max_nerve, player.nerve_regen_at, RESOURCE_REGEN.nerve, timestamp);

  const changed =
    health.value !== Number(player.health) || energy.value !== Number(player.energy) || nerve.value !== Number(player.nerve) ||
    health.anchor !== Number(player.health_regen_at) || energy.anchor !== Number(player.energy_regen_at) || nerve.anchor !== Number(player.nerve_regen_at);

  if (changed) {
    await env.DB.prepare(`
      UPDATE player_state
      SET health=?, energy=?, nerve=?, health_regen_at=?, energy_regen_at=?, nerve_regen_at=?, updated_at=?
      WHERE user_id=?
    `).bind(health.value, energy.value, nerve.value, health.anchor, energy.anchor, nerve.anchor, timestamp, player.user_id).run();
    player = await getPlayerStateRow(env, player.user_id);
  }

  player._regen = {
    health: { amount: health.amount, intervalSeconds: health.intervalMs / 1000, nextAt: health.nextAt },
    energy: { amount: energy.amount, intervalSeconds: energy.intervalMs / 1000, nextAt: energy.nextAt },
    nerve: { amount: nerve.amount, intervalSeconds: nerve.intervalMs / 1000, nextAt: nerve.nextAt }
  };
  return player;
}

async function ensureActivePlayerState(env, userId) {
  let player = await ensurePlayerState(env, userId);
  if (player.status !== 'active' && player.status_until && Number(player.status_until) <= Date.now()) {
    const now = Date.now();
    await env.DB.prepare(`
      UPDATE player_state SET status = 'active', status_until = NULL, status_reason = NULL,
        health = CASE WHEN health <= 0 THEN MAX(1, CAST(max_health * 0.25 AS INTEGER)) ELSE health END,
        health_regen_at = ?, updated_at = ? WHERE user_id = ?
    `).bind(now, now, userId).run();
    player = await getPlayerStateRow(env, userId);
  }
  return settlePlayerResources(env, player);
}

function toPublicPlayerState(row) {
  const timestamp = Date.now();
  const regen = row._regen || {
    health: { ...RESOURCE_REGEN.health, nextAt: Number(row.health) >= Number(row.max_health) ? null : (Number(row.health_regen_at) || timestamp) + RESOURCE_REGEN.health.intervalSeconds * 1000 },
    energy: { ...RESOURCE_REGEN.energy, nextAt: Number(row.energy) >= Number(row.max_energy) ? null : (Number(row.energy_regen_at) || timestamp) + RESOURCE_REGEN.energy.intervalSeconds * 1000 },
    nerve: { ...RESOURCE_REGEN.nerve, nextAt: Number(row.nerve) >= Number(row.max_nerve) ? null : (Number(row.nerve_regen_at) || timestamp) + RESOURCE_REGEN.nerve.intervalSeconds * 1000 }
  };
  return {
    userId: row.user_id,
    resources: {
      health: row.health, maxHealth: row.max_health,
      nerve: row.nerve, maxNerve: row.max_nerve,
      energy: row.energy, maxEnergy: row.max_energy,
      cash: row.cash,
      regen
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
    VALUES (?, 'services', 'rift-civic-hall', ?)
  `).bind(userId, now).run();

  let row = await env.DB.prepare(`
    SELECT user_id, district_id, location_id, updated_at
    FROM player_location WHERE user_id = ?
  `).bind(userId).first();
  if (!row) throw new Error('Could not create or load player location');

  // Phase 3.1 migration: old district-based locations are automatically moved
  // to City Hall, so existing players do not need a manual D1 migration.
  if (!WORLD_LOCATIONS.some(item => item.id === row.location_id)) {
    await env.DB.prepare(`
      UPDATE player_location
      SET district_id = 'services', location_id = 'rift-civic-hall', updated_at = ?
      WHERE user_id = ?
    `).bind(now, userId).run();
    row = { ...row, district_id: 'services', location_id: 'rift-civic-hall', updated_at: now };
  }
  return row;
}

function toPublicPlayerLocation(row) {
  const location = getWorldLocation(row.location_id);
  const categoryId = location?.categoryId || row.district_id || 'services';
  const category = getWorldCategory(categoryId);
  return {
    categoryId,
    categoryName: category?.name || categoryId,
    // Backward-compatible fields for older clients.
    districtId: categoryId,
    districtName: category?.name || categoryId,
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
