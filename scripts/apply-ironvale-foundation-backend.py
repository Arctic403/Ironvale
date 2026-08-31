from pathlib import Path
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.rstrip() + '\n', encoding='utf-8')

def between(source, start, end, replacement, label):
    a = source.find(start)
    if a < 0:
        raise RuntimeError(f'{label}: start anchor not found')
    b = source.find(end, a)
    if b < 0:
        raise RuntimeError(f'{label}: end anchor not found')
    return source[:a] + replacement + source[b:]

content_js = r'''export const IRONVALE_FOUNDATION_VERSION = 'ironvale-foundation-v1';
export const IRONVALE_SYNC_POLL_MS = 120_000;

export const IRONVALE_REGION = Object.freeze({
  id: 'ironvale-marches',
  name: 'The Ironvale Marches',
  description: 'A hard northern borderland of old roads, working villages, ruined keeps and disputed woodland.',
  tone: 'grounded-medieval'
});

export const IRONVALE_ZONES = Object.freeze([
  { id: 'brackenford-lowlands', name: 'Brackenford Lowlands', levelMin: 1, levelMax: 5, kind: 'settled-frontier', description: 'Fields, hedgerows and river roads surrounding the market village of Brackenford.' },
  { id: 'blackstone-wood', name: 'Blackstone Wood', levelMin: 3, levelMax: 8, kind: 'woodland', description: 'Dense managed forest where charcoal burners, foresters and less lawful travelers share the old tracks.' },
  { id: 'greyfen', name: 'The Greyfen', levelMin: 7, levelMax: 12, kind: 'marsh', description: 'Low wet country cut by causeways, abandoned crofts and the remains of an older frontier.' },
  { id: 'high-vale', name: 'The High Vale', levelMin: 10, levelMax: 16, kind: 'upland', description: 'Cold pasture and broken stone roads beneath the ruined watch forts of the northern ridge.' }
]);

export const IRONVALE_SETTLEMENTS = Object.freeze([
  { id: 'brackenford', name: 'Brackenford', zoneId: 'brackenford-lowlands', kind: 'village', description: 'A walled market village built around an old stone bridge and the road north.' }
]);

export const IRONVALE_POINTS_OF_INTEREST = Object.freeze([
  { id: 'old-north-road', name: 'Old North Road', zoneId: 'brackenford-lowlands', kind: 'road' },
  { id: 'brackenford-watch', name: 'Abandoned Watchtower', zoneId: 'brackenford-lowlands', kind: 'ruin' },
  { id: 'blackstone-barrow-mouth', name: 'Blackstone Barrow', zoneId: 'blackstone-wood', kind: 'dungeon-entrance' },
  { id: 'greyfen-causeway', name: 'Greyfen Causeway', zoneId: 'greyfen', kind: 'road' }
]);

export const IRONVALE_FACTIONS = Object.freeze([
  { id: 'vale-wardens', name: 'Vale Wardens', alignment: 'lawful', description: 'Local watchmen and sworn riders responsible for roads, bridges and village defense.' },
  { id: 'free-companies', name: 'The Free Companies', alignment: 'independent', description: 'Mercenary bands, caravan guards and veterans who sell disciplined steel by contract.' },
  { id: 'orin-abbey', name: 'Abbey of Saint Orin', alignment: 'neutral', description: 'A small religious house that keeps records, tends the sick and preserves older histories of the Marches.' }
]);

export const IRONVALE_NPCS = Object.freeze([
  { id: 'edric-hale', name: 'Reeve Edric Hale', zoneId: 'brackenford-lowlands', settlementId: 'brackenford', role: 'reeve', factionId: 'vale-wardens' },
  { id: 'maera-voss', name: 'Maera Voss', zoneId: 'brackenford-lowlands', settlementId: 'brackenford', role: 'blacksmith', factionId: null },
  { id: 'brother-alden', name: 'Brother Alden', zoneId: 'brackenford-lowlands', settlementId: 'brackenford', role: 'healer-scholar', factionId: 'orin-abbey' },
  { id: 'tomas-reed', name: 'Tomas Reed', zoneId: 'brackenford-lowlands', settlementId: 'brackenford', role: 'carter', factionId: null }
]);

export const IRONVALE_CREATURES = Object.freeze([
  { id: 'grey-wolf', name: 'Grey Wolf', levelMin: 1, levelMax: 4, kind: 'beast', zones: ['brackenford-lowlands', 'blackstone-wood'] },
  { id: 'wild-boar', name: 'Wild Boar', levelMin: 2, levelMax: 5, kind: 'beast', zones: ['brackenford-lowlands', 'blackstone-wood'] },
  { id: 'road-bandit', name: 'Road Bandit', levelMin: 2, levelMax: 7, kind: 'human', zones: ['brackenford-lowlands', 'blackstone-wood'] },
  { id: 'grave-robber', name: 'Grave Robber', levelMin: 4, levelMax: 8, kind: 'human', zones: ['blackstone-wood'] },
  { id: 'barrow-warden', name: 'Barrow Warden', levelMin: 6, levelMax: 9, kind: 'rare-supernatural', zones: ['blackstone-wood'] }
]);

export const IRONVALE_DUNGEONS = Object.freeze([
  {
    id: 'blackstone-barrow', name: 'Blackstone Barrow', zoneId: 'blackstone-wood', levelMin: 5, levelMax: 8,
    partyMin: 1, partyMax: 5, status: 'foundation',
    description: 'An old burial complex beneath a wooded ridge, reopened by recent digging and missing travelers.'
  }
]);

export const IRONVALE_ITEMS = Object.freeze([
  { id: 'militia-sword', name: 'Militia Sword', type: 'weapon', slot: 'mainHand', rarity: 'common', value: 18, description: 'A plain one-handed sword issued to village militia.' },
  { id: 'worn-buckler', name: 'Worn Buckler', type: 'armor', slot: 'offHand', rarity: 'common', value: 10, description: 'A small wooden shield faced with battered iron.' },
  { id: 'wool-cloak', name: 'Wool Cloak', type: 'armor', slot: 'chest', rarity: 'common', value: 8, description: 'A thick travel cloak suited to wet roads and cold evenings.' },
  { id: 'leather-boots', name: 'Leather Boots', type: 'armor', slot: 'feet', rarity: 'common', value: 7, description: 'Hard-wearing boots repaired more than once.' },
  { id: 'field-rations', name: 'Field Rations', type: 'consumable', slot: null, rarity: 'common', value: 3, description: 'Bread, dried meat and hard cheese wrapped for the road.' }
]);

export const IRONVALE_EQUIPMENT_SLOTS = Object.freeze(['head', 'chest', 'hands', 'legs', 'feet', 'mainHand', 'offHand', 'neck', 'ring']);

export const IRONVALE_QUESTS = Object.freeze([
  {
    id: 'road-north', chainId: 'blackstone-road', order: 1, name: 'The Road North', giverNpcId: 'edric-hale',
    zoneId: 'brackenford-lowlands', prerequisites: [], level: 1,
    summary: 'The reeve needs someone to inspect a damaged milestone and learn why carts have stopped using the north road.',
    objectives: [{ type: 'speak', targetId: 'edric-hale', count: 1 }, { type: 'inspect', targetId: 'old-north-road', count: 1 }],
    rewards: { xp: 60, coin: 12 }
  },
  {
    id: 'wolves-at-the-ford', chainId: 'blackstone-road', order: 2, name: 'Wolves at the Ford', giverNpcId: 'tomas-reed',
    zoneId: 'brackenford-lowlands', prerequisites: ['road-north'], level: 2,
    summary: 'Thin winter wolves have begun stalking the ford and the livestock tracks beyond it.',
    objectives: [{ type: 'defeat', targetId: 'grey-wolf', count: 4 }], rewards: { xp: 90, coin: 18 }
  },
  {
    id: 'watchtower-smoke', chainId: 'blackstone-road', order: 3, name: 'Smoke at the Watchtower', giverNpcId: 'edric-hale',
    zoneId: 'brackenford-lowlands', prerequisites: ['wolves-at-the-ford'], level: 3,
    summary: 'Smoke has been seen above an abandoned watchtower that should have been empty for years.',
    objectives: [{ type: 'inspect', targetId: 'brackenford-watch', count: 1 }, { type: 'defeat', targetId: 'road-bandit', count: 3 }], rewards: { xp: 140, coin: 28 }
  },
  {
    id: 'beneath-blackstone', chainId: 'blackstone-road', order: 4, name: 'Beneath Blackstone', giverNpcId: 'brother-alden',
    zoneId: 'blackstone-wood', prerequisites: ['watchtower-smoke'], level: 5,
    summary: 'Evidence from the tower points toward fresh digging at an old barrow in Blackstone Wood.',
    objectives: [{ type: 'discover', targetId: 'blackstone-barrow-mouth', count: 1 }], rewards: { xp: 220, coin: 45 }
  }
]);

export const IRONVALE_STARTER_ITEMS = Object.freeze([
  ['militia-sword', 1], ['wool-cloak', 1], ['leather-boots', 1], ['field-rations', 3]
]);

const byId = entries => new Map(entries.map(entry => [entry.id, entry]));
const itemsById = byId(IRONVALE_ITEMS);
const questsById = byId(IRONVALE_QUESTS);
const zonesById = byId(IRONVALE_ZONES);

export const getIronvaleItem = id => itemsById.get(String(id || '')) || null;
export const getIronvaleQuest = id => questsById.get(String(id || '')) || null;
export const getIronvaleZone = id => zonesById.get(String(id || '')) || null;
'''

api_js = r'''import {
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
'''

write('src/ironvale/content.js', content_js)
write('src/ironvale/api.js', api_js)

source = read('src/index.js')
import_start = "import {\n  CRIME_REGISTRY,"
import_end = "import { handleAiBuilderMcpRequest"
a = source.find(import_start)
b = source.find(import_end)
if a < 0 or b < 0 or b <= a:
    raise RuntimeError('src/index.js: legacy import block not found')
source = source[:a] + "import { handleIronvaleApi } from './ironvale/api.js';\n" + source[b:]
source = source.replace("const SESSION_COOKIE = 'riftcity_session';", "const SESSION_COOKIE = 'ironvale_session';")
source = source.replace("let playerStateSchemaEnsured = false;\nlet playerLocationSchemaEnsured = false;\nlet inventorySchemaEnsured = false;\nlet crimeSchemaEnsured = false;\nlet logSchemaEnsured = false;", "let logSchemaEnsured = false;")

state_sql = source.find('const PLAYER_STATE_TABLE_SQL = `')
gameplay_comment = source.find('// Gameplay definitions are plugin/config modules under src/plugins/.')
if state_sql < 0 or gameplay_comment < 0:
    raise RuntimeError('src/index.js: legacy player SQL block not found')
source = source[:state_sql] + "// Ironvale gameplay data lives under src/ironvale and uses its own namespaced tables.\n\n" + source[gameplay_comment:]
source = source.replace('// Gameplay definitions are plugin/config modules under src/plugins/.\n// This Worker owns the generic engines, validation, persistence and API behavior.', '// Rift Engine authoring and Ironvale persistence share this Worker; game-domain state is namespaced under /api/ironvale.')

route_start = source.find("  if (method === 'GET' && url.pathname === '/api/player/state')")
route_end = source.find("  if (method === 'GET' && url.pathname === '/api/health')", route_start)
if route_start < 0 or route_end < 0:
    raise RuntimeError('src/index.js: legacy gameplay route block not found')
new_routes = """  const ironvaleResponse = await handleIronvaleApi(request, env, url, {\n    authenticate, json, readJson, writeAudit\n  });\n  if (ironvaleResponse) return ironvaleResponse;\n  if (method === 'GET' && url.pathname.startsWith('/api/world/blocks/')) return getPublishedBlockLayout(request, env, url);\n"""
source = source[:route_start] + new_routes + source[route_end:]

register_start = source.find('  await ensurePlayerStateTable(env);')
register_end_marker = '  const playerState = await getPlayerStateRow(env, userId);'
register_end = source.find(register_end_marker, register_start)
if register_start < 0 or register_end < 0:
    raise RuntimeError('src/index.js: register legacy player bootstrap not found')
register_end += len(register_end_marker)
register_replacement = """  await env.DB.prepare(`\n    INSERT INTO users (id, username, password_hash, password_salt, role, created_at, last_active_at)\n    VALUES (?, ?, ?, ?, 'player', ?, ?)\n  `).bind(userId, username, passwordHash, salt, now, now).run();"""
source = source[:register_start] + register_replacement + source[register_end:]
source = source.replace("    user: { id: userId, username, role: 'player', createdAt: now, lastActiveAt: now },\n    player: toPublicPlayerState(playerState)", "    user: { id: userId, username, role: 'player', createdAt: now, lastActiveAt: now }")
source = source.replace("  const playerState = await ensurePlayerState(env, user.id);\n  const session = await createSession(env, request, user.id);", "  const session = await createSession(env, request, user.id);")
source = source.replace("    user: { id: user.id, username: user.username, role: user.role, createdAt: user.created_at, lastActiveAt: now },\n    player: toPublicPlayerState(playerState)", "    user: { id: user.id, username: user.username, role: user.role, createdAt: user.created_at, lastActiveAt: now }")

me_start = source.find('async function me(request, env) {')
old_player_start = source.find('async function getPlayerState(request, env) {', me_start)
if me_start < 0 or old_player_start < 0:
    raise RuntimeError('src/index.js: me/getPlayerState anchors not found')
new_me = """async function me(request, env) {\n  const auth = await authenticate(request, env);\n  if (!auth) return json({ ok: false, authenticated: false }, 401);\n  return json({\n    ok: true, authenticated: true,\n    user: {\n      id: auth.user.id, username: auth.user.username, role: auth.user.role,\n      createdAt: auth.user.created_at, lastActiveAt: auth.user.last_active_at, online: true\n    }\n  });\n}\n\n"""
source = source[:me_start] + new_me + source[old_player_start:]
old_player_end = source.find('async function health(env) {', source.find('async function getPlayerState(request, env) {'))
old_player_start = source.find('async function getPlayerState(request, env) {')
if old_player_start < 0 or old_player_end < 0:
    raise RuntimeError('src/index.js: legacy player/gameplay function region not found')
source = source[:old_player_start] + source[old_player_end:]

legacy_helpers_start = source.find('async function ensurePlayerStateTable(env) {')
log_table_start = source.find('async function ensureLogTable(env) {', legacy_helpers_start)
if legacy_helpers_start < 0 or log_table_start < 0:
    raise RuntimeError('src/index.js: legacy player helper region not found')
source = source[:legacy_helpers_start] + source[log_table_start:]

source = source.replace('riftcity-v2-phase6-foundation', 'ironvale-foundation-v1')
source = source.replace('RiftCity', 'Ironvale')
source = source.replace('riftcity-ai-builder', 'ironvale-ai-builder')
source = source.replace('riftcity-riftbridge', 'ironvale-riftbridge')
source = source.replace('`RC-${', '`IV-${')
write('src/index.js', source)

for path in ['src/plugins', 'src/services']:
    shutil.rmtree(ROOT / path, ignore_errors=True)
for path in ['src/items.js', 'scripts/check-rift-cloudflare-efficiency.js']:
    try:
        (ROOT / path).unlink()
    except FileNotFoundError:
        pass

schema = r'''PRAGMA foreign_keys = ON;

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
'''
write('schema.sql', schema)

package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['name'] = 'ironvale-medieval-mmo'
package['version'] = '0.1.0'
scripts = package.setdefault('scripts', {})
scripts['build'] = scripts['build'].replace('npm run verify:cloudflare-efficiency && ', 'npm run verify:ironvale && ')
scripts.pop('verify:cloudflare-efficiency', None)
scripts['verify:ironvale'] = 'node scripts/check-ironvale-foundation.js'
package_path.write_text(json.dumps(package, indent=2) + '\n', encoding='utf-8')

print('Ironvale backend foundation applied.')
