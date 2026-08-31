import {
  IRONVALE_FOUNDATION_VERSION, IRONVALE_SYNC_POLL_MS, IRONVALE_REGION, IRONVALE_ZONES,
  IRONVALE_SETTLEMENTS, IRONVALE_POINTS_OF_INTEREST, IRONVALE_FACTIONS, IRONVALE_NPCS,
  IRONVALE_CREATURES, IRONVALE_DUNGEONS, IRONVALE_ITEMS, IRONVALE_EQUIPMENT_SLOTS,
  IRONVALE_QUESTS, IRONVALE_STARTER_ITEMS, getIronvaleItem, getIronvaleQuest, getIronvaleZone
} from './content.js';

let schemaReady = false;
const now = () => Date.now();
const num = value => Number(value) || 0;
const first = result => result?.results?.[0] || null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ironvale_characters (
    user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0, health INTEGER NOT NULL DEFAULT 100, max_health INTEGER NOT NULL DEFAULT 100,
    stamina INTEGER NOT NULL DEFAULT 100, max_stamina INTEGER NOT NULL DEFAULT 100, coin INTEGER NOT NULL DEFAULT 0,
    strength INTEGER NOT NULL DEFAULT 5, agility INTEGER NOT NULL DEFAULT 5, vitality INTEGER NOT NULL DEFAULT 5,
    willpower INTEGER NOT NULL DEFAULT 5, zone_id TEXT NOT NULL DEFAULT 'brackenford-lowlands',
    spawn_id TEXT NOT NULL DEFAULT 'brackenford', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ironvale_inventory (
    user_id TEXT NOT NULL, item_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 0),
    durability INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,item_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ironvale_equipment (
    user_id TEXT PRIMARY KEY, head TEXT, chest TEXT, hands TEXT, legs TEXT, feet TEXT,
    main_hand TEXT, off_hand TEXT, neck TEXT, ring TEXT, updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ironvale_quest_progress (
    user_id TEXT NOT NULL, quest_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
    progress_json TEXT NOT NULL DEFAULT '{}', started_at INTEGER, completed_at INTEGER, updated_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,quest_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ironvale_world_flags (
    user_id TEXT NOT NULL, flag_id TEXT NOT NULL, value_json TEXT NOT NULL DEFAULT 'null', updated_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,flag_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ironvale_inventory_user ON ironvale_inventory(user_id,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ironvale_quests_user_status ON ironvale_quest_progress(user_id,status,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ironvale_character_zone ON ironvale_characters(zone_id)`
];

export async function ensureIronvaleTables(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map(statement => env.DB.prepare(statement)));
  schemaReady = true;
}

function xpNeeded(level) {
  const n = Math.max(1, Math.floor(num(level) || 1));
  return Math.max(100, Math.floor(100 * Math.pow(n, 1.32)));
}

function publicCharacter(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    name: row.display_name,
    level: num(row.level) || 1,
    xp: num(row.xp),
    xpToNextLevel: xpNeeded(row.level),
    resources: {
      health: num(row.health), maxHealth: num(row.max_health),
      stamina: num(row.stamina), maxStamina: num(row.max_stamina), coin: num(row.coin)
    },
    attributes: {
      strength: num(row.strength), agility: num(row.agility), vitality: num(row.vitality), willpower: num(row.willpower)
    },
    zoneId: row.zone_id,
    spawnId: row.spawn_id,
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at)
  };
}

function publicItem(row) {
  const definition = getIronvaleItem(row.item_id);
  if (!definition) return null;
  return {
    ...definition,
    quantity: num(row.quantity),
    durability: row.durability == null ? null : num(row.durability),
    acquiredAt: num(row.created_at),
    updatedAt: num(row.updated_at)
  };
}

function publicEquipment(row) {
  const map = {
    head: row?.head || null, chest: row?.chest || null, hands: row?.hands || null, legs: row?.legs || null,
    feet: row?.feet || null, mainHand: row?.main_hand || null, offHand: row?.off_hand || null,
    neck: row?.neck || null, ring: row?.ring || null
  };
  return Object.fromEntries(IRONVALE_EQUIPMENT_SLOTS.map(slot => [slot, map[slot] ? getIronvaleItem(map[slot]) || { id: map[slot], name: map[slot] } : null]));
}

async function ensureCharacter(user, env) {
  await ensureIronvaleTables(env);
  const timestamp = now();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO ironvale_characters(user_id,display_name,created_at,updated_at)
    VALUES(?,?,?,?)
  `).bind(user.id, user.username, timestamp, timestamp).run();

  const character = await env.DB.prepare('SELECT * FROM ironvale_characters WHERE user_id=?').bind(user.id).first();
  if (!character) throw new Error('Could not create or load Ironvale character');

  const inventoryCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM ironvale_inventory WHERE user_id=?').bind(user.id).first();
  if (!num(inventoryCount?.count)) {
    await env.DB.batch(IRONVALE_STARTER_ITEMS.map(([itemId, quantity]) => env.DB.prepare(`
      INSERT OR IGNORE INTO ironvale_inventory(user_id,item_id,quantity,durability,created_at,updated_at)
      VALUES(?,?,?,?,?,?)
    `).bind(user.id, itemId, quantity, 100, timestamp, timestamp)));
  }
  await env.DB.prepare(`
    INSERT OR IGNORE INTO ironvale_equipment(user_id,chest,feet,main_hand,updated_at)
    VALUES(?,?,?,?,?)
  `).bind(user.id, 'wool-cloak', 'leather-boots', 'militia-sword', timestamp).run();
  return character;
}

function journalFromRows(rows) {
  const rowById = new Map((rows || []).map(row => [row.quest_id, row]));
  const completed = new Set((rows || []).filter(row => row.status === 'completed').map(row => row.quest_id));
  const quests = IRONVALE_QUESTS.map(quest => {
    const stored = rowById.get(quest.id);
    const available = quest.prerequisites.every(id => completed.has(id));
    const status = stored?.status || (available ? 'available' : 'locked');
    let progress = {};
    try { progress = stored?.progress_json ? JSON.parse(stored.progress_json) : {}; } catch (_) {}
    return {
      ...quest,
      status,
      progress,
      startedAt: stored?.started_at || null,
      completedAt: stored?.completed_at || null,
      updatedAt: stored?.updated_at || null
    };
  });
  return {
    quests,
    activeCount: quests.filter(quest => quest.status === 'active').length,
    completedCount: quests.filter(quest => quest.status === 'completed').length,
    availableCount: quests.filter(quest => quest.status === 'available').length
  };
}

async function getJournal(userId, env) {
  const result = await env.DB.prepare(`
    SELECT quest_id,status,progress_json,started_at,completed_at,updated_at
    FROM ironvale_quest_progress WHERE user_id=? ORDER BY updated_at DESC
  `).bind(userId).all();
  return journalFromRows(result.results || []);
}

async function getInventory(userId, env) {
  const [inventoryResult, equipmentResult] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM ironvale_inventory WHERE user_id=? AND quantity>0 ORDER BY updated_at DESC,item_id ASC').bind(userId),
    env.DB.prepare('SELECT * FROM ironvale_equipment WHERE user_id=?').bind(userId)
  ]);
  const items = (inventoryResult.results || []).map(publicItem).filter(Boolean);
  return {
    items,
    equipment: publicEquipment(first(equipmentResult)),
    summary: { uniqueItems: items.length, totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0) }
  };
}

function worldPayload(character) {
  const currentZone = getIronvaleZone(character?.zone_id || 'brackenford-lowlands') || IRONVALE_ZONES[0];
  return {
    foundationVersion: IRONVALE_FOUNDATION_VERSION,
    region: IRONVALE_REGION,
    currentZone,
    zones: IRONVALE_ZONES,
    settlements: IRONVALE_SETTLEMENTS,
    pointsOfInterest: IRONVALE_POINTS_OF_INTEREST,
    factions: IRONVALE_FACTIONS,
    npcs: IRONVALE_NPCS,
    creatures: IRONVALE_CREATURES,
    dungeons: IRONVALE_DUNGEONS
  };
}

function usage(results) {
  return (results || []).reduce((out, result) => {
    out.batchRowsRead += num(result?.meta?.rows_read);
    out.batchRowsWritten += num(result?.meta?.rows_written);
    return out;
  }, { batchQueries: (results || []).length, batchRowsRead: 0, batchRowsWritten: 0 });
}

async function buildSync(user, env) {
  await ensureCharacter(user, env);
  const results = await env.DB.batch([
    env.DB.prepare('SELECT * FROM ironvale_characters WHERE user_id=?').bind(user.id),
    env.DB.prepare(`SELECT quest_id,status,progress_json,started_at,completed_at,updated_at
      FROM ironvale_quest_progress WHERE user_id=? ORDER BY updated_at DESC`).bind(user.id),
    env.DB.prepare('SELECT * FROM ironvale_equipment WHERE user_id=?').bind(user.id)
  ]);
  const character = publicCharacter(first(results[0]));
  return {
    ok: true,
    ironvaleVersion: IRONVALE_FOUNDATION_VERSION,
    generatedAt: now(),
    pollAfterMs: IRONVALE_SYNC_POLL_MS,
    character,
    journal: journalFromRows(results[1]?.results || []),
    equipment: publicEquipment(first(results[2])),
    usage: usage(results)
  };
}

async function buildBootstrap(user, env) {
  const characterRow = await ensureCharacter(user, env);
  const character = publicCharacter(characterRow);
  const [journal, inventory] = await Promise.all([getJournal(user.id, env), getInventory(user.id, env)]);
  return {
    ok: true,
    authenticated: true,
    ironvaleVersion: IRONVALE_FOUNDATION_VERSION,
    generatedAt: now(),
    pollAfterMs: IRONVALE_SYNC_POLL_MS,
    user: { id: user.id, username: user.username, role: user.role, createdAt: user.created_at, lastActiveAt: user.last_active_at },
    character,
    world: worldPayload(characterRow),
    journal,
    inventory,
    equipment: inventory.equipment
  };
}

async function acceptQuest(user, body, env, deps) {
  const quest = getIronvaleQuest(body?.questId);
  if (!quest) return deps.json({ ok: false, error: 'Unknown quest' }, 404);
  await ensureCharacter(user, env);
  const rows = await env.DB.prepare('SELECT quest_id,status FROM ironvale_quest_progress WHERE user_id=?').bind(user.id).all();
  const progress = new Map((rows.results || []).map(row => [row.quest_id, row.status]));
  if (progress.get(quest.id) === 'active') return deps.json({ ok: false, error: 'Quest is already active.' }, 409);
  if (progress.get(quest.id) === 'completed') return deps.json({ ok: false, error: 'Quest is already completed.' }, 409);
  if (!quest.prerequisites.every(id => progress.get(id) === 'completed')) return deps.json({ ok: false, error: 'Quest prerequisites are not complete.' }, 409);
  const timestamp = now();
  await env.DB.prepare(`
    INSERT INTO ironvale_quest_progress(user_id,quest_id,status,progress_json,started_at,updated_at)
    VALUES(?,?,'active','{}',?,?)
    ON CONFLICT(user_id,quest_id) DO UPDATE SET status='active',started_at=COALESCE(started_at,excluded.started_at),updated_at=excluded.updated_at
  `).bind(user.id, quest.id, timestamp, timestamp).run();
  await deps.writeAudit(env, user.id, 'ironvale.quest.accepted', user.id, { questId: quest.id });
  return deps.json({ ok: true, message: `Accepted ${quest.name}.`, journal: await getJournal(user.id, env) });
}

export async function handleIronvaleApi(request, env, url, deps) {
  if (!url.pathname.startsWith('/api/ironvale')) return null;
  const auth = await deps.authenticate(request, env);
  if (!auth) return deps.json({ ok: false, error: 'Authentication required' }, 401);
  await ensureIronvaleTables(env);
  const method = request.method.toUpperCase();
  const user = auth.user;

  if (method === 'GET' && url.pathname === '/api/ironvale/bootstrap') return deps.json(await buildBootstrap(user, env));
  if (method === 'GET' && url.pathname === '/api/ironvale/sync') return deps.json(await buildSync(user, env));
  if (method === 'GET' && url.pathname === '/api/ironvale/character') {
    return deps.json({ ok: true, character: publicCharacter(await ensureCharacter(user, env)) });
  }
  if (method === 'GET' && url.pathname === '/api/ironvale/world') {
    const character = await ensureCharacter(user, env);
    return deps.json({ ok: true, world: worldPayload(character) });
  }
  if (method === 'GET' && url.pathname === '/api/ironvale/journal') {
    await ensureCharacter(user, env);
    return deps.json({ ok: true, journal: await getJournal(user.id, env) });
  }
  if (method === 'GET' && url.pathname === '/api/ironvale/inventory') {
    await ensureCharacter(user, env);
    return deps.json({ ok: true, inventory: await getInventory(user.id, env) });
  }
  if (method === 'POST' && url.pathname === '/api/ironvale/quests/accept') {
    return acceptQuest(user, await deps.readJson(request), env, deps);
  }
  return deps.json({ ok: false, error: 'Ironvale endpoint not found' }, 404);
}

export { publicCharacter };
