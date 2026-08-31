import {
  IRONVALE_FOUNDATION_VERSION, IRONVALE_SYNC_POLL_MS, IRONVALE_REGION, IRONVALE_ZONES,
  IRONVALE_SETTLEMENTS, IRONVALE_POINTS_OF_INTEREST, IRONVALE_FACTIONS, IRONVALE_NPCS,
  IRONVALE_CREATURES, IRONVALE_DUNGEONS, IRONVALE_ITEMS, IRONVALE_EQUIPMENT_SLOTS,
  IRONVALE_QUESTS, IRONVALE_STARTER_ITEMS, IRONVALE_RACES, IRONVALE_CLASSES,
  IRONVALE_ABILITIES, IRONVALE_CAMPAIGNS, getIronvaleItem, getIronvaleQuest, getIronvaleZone,
  getIronvaleRace, getIronvaleClass
} from './content.js';

let schemaReady = false;
const now = () => Date.now();
const num = value => Number(value) || 0;
const first = result => result?.results?.[0] || null;
const objectiveKey = objective => String(objective?.type || '') + ':' + String(objective?.targetId || '');

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ironvale_characters (
    user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0, health INTEGER NOT NULL DEFAULT 100, max_health INTEGER NOT NULL DEFAULT 100,
    stamina INTEGER NOT NULL DEFAULT 100, max_stamina INTEGER NOT NULL DEFAULT 100, coin INTEGER NOT NULL DEFAULT 0,
    strength INTEGER NOT NULL DEFAULT 5, agility INTEGER NOT NULL DEFAULT 5, vitality INTEGER NOT NULL DEFAULT 5,
    willpower INTEGER NOT NULL DEFAULT 5, zone_id TEXT NOT NULL DEFAULT 'brackenford-lowlands',
    spawn_id TEXT NOT NULL DEFAULT 'valeborn-training-yard', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ironvale_character_profiles (
    user_id TEXT PRIMARY KEY, race_id TEXT NOT NULL, class_id TEXT NOT NULL, origin_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL, chapter_id TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
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

function publicProfile(row) {
  if (!row) return null;
  const race = getIronvaleRace(row.race_id);
  const playerClass = getIronvaleClass(row.class_id);
  return {
    raceId: row.race_id, classId: row.class_id, originId: row.origin_id,
    campaignId: row.campaign_id, chapterId: row.chapter_id,
    race, class: playerClass,
    createdAt: num(row.created_at), updatedAt: num(row.updated_at)
  };
}

function publicCharacter(row, profile = null) {
  if (!row) return null;
  return {
    userId: row.user_id, name: row.display_name, level: num(row.level) || 1,
    xp: num(row.xp), xpToNextLevel: xpNeeded(row.level),
    resources: { health: num(row.health), maxHealth: num(row.max_health), stamina: num(row.stamina), maxStamina: num(row.max_stamina), coin: num(row.coin) },
    attributes: { strength: num(row.strength), agility: num(row.agility), vitality: num(row.vitality), willpower: num(row.willpower) },
    zoneId: row.zone_id, spawnId: row.spawn_id, identity: publicProfile(profile),
    createdAt: num(row.created_at), updatedAt: num(row.updated_at)
  };
}

function publicItem(row) {
  const definition = getIronvaleItem(row.item_id);
  if (!definition) return null;
  return { ...definition, quantity: num(row.quantity), durability: row.durability == null ? null : num(row.durability), acquiredAt: num(row.created_at), updatedAt: num(row.updated_at) };
}

function publicEquipment(row) {
  const map = { head: row?.head || null, chest: row?.chest || null, hands: row?.hands || null, legs: row?.legs || null, feet: row?.feet || null, mainHand: row?.main_hand || null, offHand: row?.off_hand || null, neck: row?.neck || null, ring: row?.ring || null };
  return Object.fromEntries(IRONVALE_EQUIPMENT_SLOTS.map(slot => [slot, map[slot] ? getIronvaleItem(map[slot]) || { id: map[slot], name: map[slot] } : null]));
}

async function ensureCharacter(user, env) {
  await ensureIronvaleTables(env);
  const timestamp = now();
  await env.DB.prepare(`INSERT OR IGNORE INTO ironvale_characters(user_id,display_name,created_at,updated_at) VALUES(?,?,?,?)`).bind(user.id, user.username, timestamp, timestamp).run();
  const character = await env.DB.prepare('SELECT * FROM ironvale_characters WHERE user_id=?').bind(user.id).first();
  if (!character) throw new Error('Could not create or load Ironvale character');
  return character;
}

async function getProfile(userId, env) {
  return env.DB.prepare('SELECT * FROM ironvale_character_profiles WHERE user_id=?').bind(userId).first();
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
    return { ...quest, status, progress, startedAt: stored?.started_at || null, completedAt: stored?.completed_at || null, updatedAt: stored?.updated_at || null };
  });
  return { quests, activeCount: quests.filter(q => q.status === 'active').length, completedCount: quests.filter(q => q.status === 'completed').length, availableCount: quests.filter(q => q.status === 'available').length };
}

async function getJournal(userId, env) {
  const result = await env.DB.prepare('SELECT quest_id,status,progress_json,started_at,completed_at,updated_at FROM ironvale_quest_progress WHERE user_id=? ORDER BY updated_at DESC').bind(userId).all();
  return journalFromRows(result.results || []);
}

async function getInventory(userId, env) {
  const [inventoryResult, equipmentResult] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM ironvale_inventory WHERE user_id=? AND quantity>0 ORDER BY updated_at DESC,item_id ASC').bind(userId),
    env.DB.prepare('SELECT * FROM ironvale_equipment WHERE user_id=?').bind(userId)
  ]);
  const items = (inventoryResult.results || []).map(publicItem).filter(Boolean);
  return { items, equipment: publicEquipment(first(equipmentResult)), summary: { uniqueItems: items.length, totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0) } };
}

function worldPayload(character) {
  const currentZone = getIronvaleZone(character?.zone_id || 'brackenford-lowlands') || IRONVALE_ZONES[0];
  return {
    foundationVersion: IRONVALE_FOUNDATION_VERSION, region: IRONVALE_REGION, currentZone,
    zones: IRONVALE_ZONES, settlements: IRONVALE_SETTLEMENTS, pointsOfInterest: IRONVALE_POINTS_OF_INTEREST,
    factions: IRONVALE_FACTIONS, npcs: IRONVALE_NPCS, creatures: IRONVALE_CREATURES, dungeons: IRONVALE_DUNGEONS,
    races: IRONVALE_RACES, classes: IRONVALE_CLASSES, abilities: IRONVALE_ABILITIES, campaigns: IRONVALE_CAMPAIGNS
  };
}

function usage(results) {
  return (results || []).reduce((out, result) => { out.batchRowsRead += num(result?.meta?.rows_read); out.batchRowsWritten += num(result?.meta?.rows_written); return out; }, { batchQueries: (results || []).length, batchRowsRead: 0, batchRowsWritten: 0 });
}

async function buildSync(user, env) {
  await ensureCharacter(user, env);
  const results = await env.DB.batch([
    env.DB.prepare('SELECT * FROM ironvale_characters WHERE user_id=?').bind(user.id),
    env.DB.prepare('SELECT * FROM ironvale_character_profiles WHERE user_id=?').bind(user.id),
    env.DB.prepare('SELECT quest_id,status,progress_json,started_at,completed_at,updated_at FROM ironvale_quest_progress WHERE user_id=? ORDER BY updated_at DESC').bind(user.id),
    env.DB.prepare('SELECT * FROM ironvale_equipment WHERE user_id=?').bind(user.id)
  ]);
  const profile = first(results[1]);
  return {
    ok: true, ironvaleVersion: IRONVALE_FOUNDATION_VERSION, generatedAt: now(), pollAfterMs: IRONVALE_SYNC_POLL_MS,
    needsCharacterCreation: !profile, profile: publicProfile(profile),
    character: publicCharacter(first(results[0]), profile), journal: journalFromRows(results[2]?.results || []), equipment: publicEquipment(first(results[3])), usage: usage(results)
  };
}

async function buildBootstrap(user, env) {
  const characterRow = await ensureCharacter(user, env);
  const profileRow = await getProfile(user.id, env);
  const [journal, inventory] = await Promise.all([getJournal(user.id, env), getInventory(user.id, env)]);
  return {
    ok: true, authenticated: true, ironvaleVersion: IRONVALE_FOUNDATION_VERSION, generatedAt: now(), pollAfterMs: IRONVALE_SYNC_POLL_MS,
    user: { id: user.id, username: user.username, role: user.role, createdAt: user.created_at, lastActiveAt: user.last_active_at },
    needsCharacterCreation: !profileRow,
    creationOptions: { races: IRONVALE_RACES, classes: IRONVALE_CLASSES },
    profile: publicProfile(profileRow), character: publicCharacter(characterRow, profileRow), world: worldPayload(characterRow), journal, inventory, equipment: inventory.equipment
  };
}

async function seedStarterKit(userId, env, timestamp) {
  await env.DB.batch(IRONVALE_STARTER_ITEMS.map(([itemId, quantity]) => env.DB.prepare(`
    INSERT INTO ironvale_inventory(user_id,item_id,quantity,durability,created_at,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=MAX(quantity,excluded.quantity),updated_at=excluded.updated_at
  `).bind(userId, itemId, quantity, 100, timestamp, timestamp)));
  await env.DB.prepare(`
    INSERT INTO ironvale_equipment(user_id,chest,feet,main_hand,off_hand,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET chest=excluded.chest,feet=excluded.feet,main_hand=excluded.main_hand,off_hand=excluded.off_hand,updated_at=excluded.updated_at
  `).bind(userId, 'wool-cloak', 'leather-boots', 'recruit-longsword', 'training-shield', timestamp).run();
}

async function createCharacter(user, body, env, deps) {
  const existing = await getProfile(user.id, env);
  if (existing) return deps.json({ ok: false, error: 'This account already has an Ironvale character.' }, 409);
  const name = String(body?.name || user.username || '').trim();
  if (!/^[A-Za-z][A-Za-z '\-]{2,19}$/.test(name)) return deps.json({ ok: false, error: 'Character name must be 3-20 letters and may include spaces, apostrophes or hyphens.' }, 400);
  const raceId = String(body?.raceId || 'valeborn');
  const classId = String(body?.classId || 'knight');
  if (raceId !== 'valeborn' || classId !== 'knight') return deps.json({ ok: false, error: 'H3.0 currently launches with the Valeborn Knight only.' }, 400);
  const timestamp = now();
  await ensureCharacter(user, env);
  await env.DB.batch([
    env.DB.prepare(`UPDATE ironvale_characters SET display_name=?,level=1,xp=0,health=120,max_health=120,stamina=110,max_stamina=110,coin=0,strength=8,agility=6,vitality=7,willpower=6,zone_id='brackenford-lowlands',spawn_id='valeborn-training-yard',updated_at=? WHERE user_id=?`).bind(name, timestamp, user.id),
    env.DB.prepare(`INSERT INTO ironvale_character_profiles(user_id,race_id,class_id,origin_id,campaign_id,chapter_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(user.id, raceId, classId, 'brackenford-lowlands', 'the-broken-oath', 'ash-on-the-road', timestamp, timestamp),
    env.DB.prepare(`INSERT OR REPLACE INTO ironvale_quest_progress(user_id,quest_id,status,progress_json,started_at,completed_at,updated_at) VALUES(?,?,'active','{}',?,NULL,?)`).bind(user.id, 'the-first-oath', timestamp, timestamp)
  ]);
  await seedStarterKit(user.id, env, timestamp);
  await deps.writeAudit(env, user.id, 'ironvale.character.created', user.id, { raceId, classId, originId: 'brackenford-lowlands' });
  return deps.json({ ok: true, message: 'Your oath begins in Brackenford.', bootstrap: await buildBootstrap(user, env) });
}

async function acceptQuest(user, body, env, deps) {
  const quest = getIronvaleQuest(body?.questId);
  if (!quest) return deps.json({ ok: false, error: 'Unknown quest' }, 404);
  if (!await getProfile(user.id, env)) return deps.json({ ok: false, error: 'Create your character first.' }, 409);
  const rows = await env.DB.prepare('SELECT quest_id,status FROM ironvale_quest_progress WHERE user_id=?').bind(user.id).all();
  const progress = new Map((rows.results || []).map(row => [row.quest_id, row.status]));
  if (progress.get(quest.id) === 'active') return deps.json({ ok: false, error: 'Quest is already active.' }, 409);
  if (progress.get(quest.id) === 'completed') return deps.json({ ok: false, error: 'Quest is already completed.' }, 409);
  if (!quest.prerequisites.every(id => progress.get(id) === 'completed')) return deps.json({ ok: false, error: 'Quest prerequisites are not complete.' }, 409);
  const timestamp = now();
  await env.DB.prepare(`INSERT INTO ironvale_quest_progress(user_id,quest_id,status,progress_json,started_at,updated_at) VALUES(?,?,'active','{}',?,?) ON CONFLICT(user_id,quest_id) DO UPDATE SET status='active',started_at=COALESCE(started_at,excluded.started_at),updated_at=excluded.updated_at`).bind(user.id, quest.id, timestamp, timestamp).run();
  await deps.writeAudit(env, user.id, 'ironvale.quest.accepted', user.id, { questId: quest.id });
  return deps.json({ ok: true, message: 'Quest accepted: ' + quest.name, journal: await getJournal(user.id, env) });
}

async function rewardQuest(userId, quest, env, timestamp) {
  const row = await env.DB.prepare('SELECT * FROM ironvale_characters WHERE user_id=?').bind(userId).first();
  if (!row) return;
  let level = Math.max(1, num(row.level)), xp = num(row.xp) + num(quest.rewards?.xp), coin = num(row.coin) + num(quest.rewards?.coin);
  let maxHealth = num(row.max_health), maxStamina = num(row.max_stamina), strength = num(row.strength), vitality = num(row.vitality);
  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level); level += 1; maxHealth += 8; maxStamina += 4;
    if (level % 2 === 0) strength += 1; else vitality += 1;
  }
  await env.DB.prepare('UPDATE ironvale_characters SET level=?,xp=?,coin=?,health=?,max_health=?,stamina=?,max_stamina=?,strength=?,vitality=?,updated_at=? WHERE user_id=?')
    .bind(level, xp, coin, maxHealth, maxHealth, maxStamina, maxStamina, strength, vitality, timestamp, userId).run();
}

async function progressQuestEvent(user, body, env, deps) {
  const type = String(body?.type || '').trim();
  const targetId = String(body?.targetId || '').trim();
  const amount = Math.max(1, Math.min(20, Math.trunc(num(body?.amount) || 1)));
  if (!['speak','inspect','train'].includes(type) || !targetId) return deps.json({ ok: false, error: 'Invalid quest event.' }, 400);
  if (!await getProfile(user.id, env)) return deps.json({ ok: false, error: 'Create your character first.' }, 409);
  const rows = await env.DB.prepare("SELECT quest_id,status,progress_json FROM ironvale_quest_progress WHERE user_id=? AND status='active'").bind(user.id).all();
  let completedQuest = null;
  let changed = false;
  for (const row of rows.results || []) {
    const quest = getIronvaleQuest(row.quest_id);
    if (!quest) continue;
    const objective = quest.objectives.find(item => item.type === type && item.targetId === targetId);
    if (!objective) continue;
    let progress = {};
    try { progress = JSON.parse(row.progress_json || '{}') || {}; } catch (_) {}
    const key = objectiveKey(objective);
    progress[key] = Math.min(objective.count, num(progress[key]) + amount);
    const complete = quest.objectives.every(item => num(progress[objectiveKey(item)]) >= num(item.count));
    const timestamp = now();
    await env.DB.prepare('UPDATE ironvale_quest_progress SET progress_json=?,status=?,completed_at=?,updated_at=? WHERE user_id=? AND quest_id=?')
      .bind(JSON.stringify(progress), complete ? 'completed' : 'active', complete ? timestamp : null, timestamp, user.id, quest.id).run();
    changed = true;
    if (complete) {
      completedQuest = quest;
      await rewardQuest(user.id, quest, env, timestamp);
      if (quest.id === 'the-broken-oath') {
        await env.DB.prepare(`INSERT INTO ironvale_world_flags(user_id,flag_id,value_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,flag_id) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`)
          .bind(user.id, 'campaign:the-broken-oath:chapter-one-complete', JSON.stringify(true), timestamp).run();
      }
      await deps.writeAudit(env, user.id, 'ironvale.quest.completed', user.id, { questId: quest.id });
    }
  }
  const [characterRow, profileRow, journal] = await Promise.all([ensureCharacter(user, env), getProfile(user.id, env), getJournal(user.id, env)]);
  return deps.json({ ok: true, changed, completedQuest: completedQuest ? { id: completedQuest.id, name: completedQuest.name, rewards: completedQuest.rewards } : null, character: publicCharacter(characterRow, profileRow), journal });
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
    const row = await ensureCharacter(user, env); const profile = await getProfile(user.id, env);
    return deps.json({ ok: true, needsCharacterCreation: !profile, profile: publicProfile(profile), character: publicCharacter(row, profile), creationOptions: { races: IRONVALE_RACES, classes: IRONVALE_CLASSES } });
  }
  if (method === 'POST' && url.pathname === '/api/ironvale/character/create') return createCharacter(user, await deps.readJson(request), env, deps);
  if (method === 'GET' && url.pathname === '/api/ironvale/world') return deps.json({ ok: true, world: worldPayload(await ensureCharacter(user, env)) });
  if (method === 'GET' && url.pathname === '/api/ironvale/journal') return deps.json({ ok: true, journal: await getJournal(user.id, env) });
  if (method === 'GET' && url.pathname === '/api/ironvale/inventory') return deps.json({ ok: true, inventory: await getInventory(user.id, env) });
  if (method === 'POST' && url.pathname === '/api/ironvale/quests/accept') return acceptQuest(user, await deps.readJson(request), env, deps);
  if (method === 'POST' && url.pathname === '/api/ironvale/quests/progress') return progressQuestEvent(user, await deps.readJson(request), env, deps);
  return deps.json({ ok: false, error: 'Ironvale endpoint not found' }, 404);
}

export { publicCharacter };
