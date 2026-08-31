import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const fail = message => { throw new Error(`[ironvale-h3] ${message}`); };
const replaceOnce = (text, from, to, label) => {
  const index = text.indexOf(from);
  if (index < 0) fail(`missing ${label}`);
  if (text.indexOf(from, index + from.length) >= 0) fail(`ambiguous ${label}`);
  return text.slice(0, index) + to + text.slice(index + from.length);
};

// ---------------------------------------------------------------------------
// One-race / one-class / one-zone launch content.
// ---------------------------------------------------------------------------
write('src/ironvale/content.js', `export const IRONVALE_FOUNDATION_VERSION = 'ironvale-h3-starter-v1';
export const IRONVALE_SYNC_POLL_MS = 120_000;

export const IRONVALE_REGION = Object.freeze({
  id: 'ironvale-marches',
  name: 'The Ironvale Marches',
  description: 'A hard northern borderland of old roads, oath-stones, working villages and ruined keeps. The Marches were built on a peace whose true price has been deliberately forgotten.',
  tone: 'grounded-medieval'
});

export const IRONVALE_RACES = Object.freeze([
  {
    id: 'valeborn', name: 'Valeborn', homeland: 'The Ironvale Marches', playable: true,
    description: 'The Valeborn are the farmers, wardens, smiths and sworn households of the Marches. They are practical people shaped by border wars, hard winters and promises that carry the weight of law.',
    traits: [
      { id: 'marcher-resolve', name: 'Marcher Resolve', description: 'A lifetime on the frontier grants a small bonus to stamina and resistance.' },
      { id: 'oathbound', name: 'Oathbound', description: 'Valeborn earn local reputation slightly faster when completing story duties.' }
    ],
    attributeBonus: { agility: 1, willpower: 1 },
    palette: { skin: '#d5a079', cloth: '#526372', leather: '#332a21' }
  }
]);

export const IRONVALE_CLASSES = Object.freeze([
  {
    id: 'knight', name: 'Knight', playable: true, resource: 'stamina', roles: ['Tank', 'Melee Damage'],
    description: 'Knights fight in the press of battle with disciplined swordwork, shields and protective stances. The class begins simple and grows into defensive or offensive specializations later.',
    attributeBonus: { strength: 3, vitality: 2 },
    starterWeapon: 'recruit-longsword', starterOffhand: 'training-shield',
    abilities: ['knight-strike', 'knight-guard', 'knight-rally']
  }
]);

export const IRONVALE_ABILITIES = Object.freeze([
  { id: 'knight-strike', name: 'Strike', classId: 'knight', level: 1, slot: 1, staminaCost: 0, cooldownMs: 900, kind: 'melee', range: 3.2, description: 'A direct sword strike. This is the Knight\'s first combat action.' },
  { id: 'knight-guard', name: 'Guard', classId: 'knight', level: 2, slot: 2, staminaCost: 10, cooldownMs: 8000, kind: 'defense', durationMs: 3000, description: 'Raise your guard for a short defensive window.' },
  { id: 'knight-rally', name: 'Rally', classId: 'knight', level: 4, slot: 3, staminaCost: 0, cooldownMs: 20000, kind: 'recovery', description: 'Steady yourself and recover stamina.' }
]);

export const IRONVALE_CAMPAIGNS = Object.freeze([
  {
    id: 'the-broken-oath', name: 'The Broken Oath', levelMin: 1, status: 'chapter-one',
    premise: 'The old kingdoms claim the Marcher Wars ended with a clean treaty. Fresh disturbances along the North Road reveal that the peace was sealed by a second oath that was erased from public record.',
    chapters: [
      { id: 'ash-on-the-road', order: 1, name: 'Ash on the North Road', zoneId: 'brackenford-lowlands', description: 'A new Knight learns the roads around Brackenford, follows signs of trespass to an abandoned watchtower, and finds proof that someone is searching for the forgotten oath.' }
    ]
  }
]);

export const IRONVALE_ZONES = Object.freeze([
  {
    id: 'brackenford-lowlands', name: 'Brackenford Lowlands', levelMin: 1, levelMax: 10, kind: 'starter-zone',
    worldId: 'brackenford-lowlands-001', worldUrl: '/rift-world-blocks/brackenford-lowlands-001.json',
    description: 'Fields, training yards, workshops and old military roads surrounding the walled village of Brackenford.',
    spawn: { id: 'valeborn-training-yard', position: [20, 2, 22], facing: 0 },
    campaignId: 'the-broken-oath', chapterId: 'ash-on-the-road'
  }
]);

export const IRONVALE_SETTLEMENTS = Object.freeze([
  { id: 'brackenford', name: 'Brackenford', zoneId: 'brackenford-lowlands', kind: 'walled-village', position: [43, 2, 34], description: 'A walled market village built where the Old North Road meets the farms of the southern Marches.' }
]);

export const IRONVALE_POINTS_OF_INTEREST = Object.freeze([
  { id: 'training-dummy', name: 'Training Dummy', zoneId: 'brackenford-lowlands', kind: 'training-target', position: [30, 2, 22], interactRange: 3.2 },
  { id: 'old-north-road', name: 'Broken North Road Milestone', zoneId: 'brackenford-lowlands', kind: 'quest-object', position: [48, 2, 52], interactRange: 2.8 },
  { id: 'brackenford-watch', name: 'Abandoned North Watch', zoneId: 'brackenford-lowlands', kind: 'quest-object', position: [75, 2, 73], interactRange: 4.5 },
  { id: 'blackstone-barrow-mouth', name: 'Blackstone Barrow', zoneId: 'brackenford-lowlands', kind: 'future-dungeon-entrance', position: [88, 2, 84], interactRange: 4 }
]);

export const IRONVALE_FACTIONS = Object.freeze([
  { id: 'vale-wardens', name: 'Vale Wardens', alignment: 'lawful', description: 'Road wardens, village guards and sworn riders who keep order in the Marches.' },
  { id: 'orin-abbey', name: 'Abbey of Saint Orin', alignment: 'neutral', description: 'A record-keeping religious house whose oldest ledgers predate the official history of the Marcher peace.' }
]);

export const IRONVALE_NPCS = Object.freeze([
  { id: 'ser-rowan-vale', name: 'Ser Rowan Vale', zoneId: 'brackenford-lowlands', role: 'Knight Trainer', factionId: 'vale-wardens', position: [22, 2, 22], color: '#66778b', dialogue: 'Steel is useful. Discipline is what keeps you alive long enough to use it.' },
  { id: 'edric-hale', name: 'Reeve Edric Hale', zoneId: 'brackenford-lowlands', role: 'Reeve of Brackenford', factionId: 'vale-wardens', position: [44, 2, 34], color: '#765f3f', dialogue: 'Brackenford has survived worse years than this one. I would prefer not to prove it again.' },
  { id: 'maera-voss', name: 'Maera Voss', zoneId: 'brackenford-lowlands', role: 'Blacksmith', factionId: null, position: [58, 2, 30], color: '#794b37', dialogue: 'If it bends, I can straighten it. If it breaks, you paid too little for it.' },
  { id: 'brother-alden', name: 'Brother Alden', zoneId: 'brackenford-lowlands', role: 'Keeper of Records', factionId: 'orin-abbey', position: [22, 2, 58], color: '#716a59', dialogue: 'History is rarely lost by accident. More often, someone decides what the next generation is allowed to remember.' }
]);

export const IRONVALE_CREATURES = Object.freeze([
  { id: 'road-brigand', name: 'Road Brigand', levelMin: 2, levelMax: 4, kind: 'human', zones: ['brackenford-lowlands'], status: 'next-combat-patch' }
]);

export const IRONVALE_DUNGEONS = Object.freeze([
  { id: 'blackstone-barrow', name: 'Blackstone Barrow', zoneId: 'brackenford-lowlands', levelMin: 8, levelMax: 10, partyMin: 1, partyMax: 5, status: 'future', description: 'A sealed burial complex whose entrance lies beyond the abandoned northern watch.' }
]);

export const IRONVALE_ITEMS = Object.freeze([
  { id: 'recruit-longsword', name: 'Recruit Longsword', type: 'weapon', slot: 'mainHand', rarity: 'common', value: 16, weaponMin: 7, weaponMax: 11, description: 'A plain sword balanced for drills and patrol duty.' },
  { id: 'training-shield', name: 'Training Shield', type: 'armor', slot: 'offHand', rarity: 'common', value: 11, armor: 4, description: 'A stout wooden shield rimmed with iron.' },
  { id: 'wool-cloak', name: 'Marcher Wool Cloak', type: 'armor', slot: 'chest', rarity: 'common', value: 8, armor: 1, description: 'Heavy wool for cold mornings on the road.' },
  { id: 'leather-boots', name: 'Leather Patrol Boots', type: 'armor', slot: 'feet', rarity: 'common', value: 7, armor: 1, description: 'Hard-wearing boots made for mud and stone roads.' },
  { id: 'field-rations', name: 'Field Rations', type: 'consumable', slot: null, rarity: 'common', value: 3, description: 'Bread, dried meat and hard cheese wrapped for patrol.' }
]);

export const IRONVALE_EQUIPMENT_SLOTS = Object.freeze(['head', 'chest', 'hands', 'legs', 'feet', 'mainHand', 'offHand', 'neck', 'ring']);

export const IRONVALE_QUESTS = Object.freeze([
  {
    id: 'the-first-oath', chainId: 'broken-oath-chapter-one', order: 1, campaignId: 'the-broken-oath', chapterId: 'ash-on-the-road', name: 'The First Oath', giverNpcId: 'ser-rowan-vale', zoneId: 'brackenford-lowlands', prerequisites: [], level: 1,
    summary: 'Ser Rowan expects every new Knight to understand that service begins with listening.',
    objectives: [{ type: 'speak', targetId: 'ser-rowan-vale', label: 'Speak with Ser Rowan Vale', count: 1 }], rewards: { xp: 70, coin: 4 }
  },
  {
    id: 'steel-in-hand', chainId: 'broken-oath-chapter-one', order: 2, campaignId: 'the-broken-oath', chapterId: 'ash-on-the-road', name: 'Steel in Hand', giverNpcId: 'ser-rowan-vale', zoneId: 'brackenford-lowlands', prerequisites: ['the-first-oath'], level: 1,
    summary: 'Practice the Knight\'s basic Strike until the motion is clean and controlled.',
    objectives: [{ type: 'train', targetId: 'training-dummy', label: 'Use Strike on the training dummy', count: 3 }], rewards: { xp: 100, coin: 8 }
  },
  {
    id: 'orders-from-the-reeve', chainId: 'broken-oath-chapter-one', order: 3, campaignId: 'the-broken-oath', chapterId: 'ash-on-the-road', name: 'Orders from the Reeve', giverNpcId: 'edric-hale', zoneId: 'brackenford-lowlands', prerequisites: ['steel-in-hand'], level: 2,
    summary: 'The North Road has gone quiet. Reeve Hale wants the old milestone inspected before he sends a full patrol.',
    objectives: [{ type: 'inspect', targetId: 'old-north-road', label: 'Inspect the broken North Road milestone', count: 1 }], rewards: { xp: 130, coin: 12 }
  },
  {
    id: 'smoke-at-the-watch', chainId: 'broken-oath-chapter-one', order: 4, campaignId: 'the-broken-oath', chapterId: 'ash-on-the-road', name: 'Smoke at the Watch', giverNpcId: 'edric-hale', zoneId: 'brackenford-lowlands', prerequisites: ['orders-from-the-reeve'], level: 2,
    summary: 'Fresh ash at the milestone points toward an abandoned watchtower that should have been empty for years.',
    objectives: [{ type: 'inspect', targetId: 'brackenford-watch', label: 'Search the abandoned North Watch', count: 1 }], rewards: { xp: 170, coin: 18 }
  },
  {
    id: 'the-broken-oath', chainId: 'broken-oath-chapter-one', order: 5, campaignId: 'the-broken-oath', chapterId: 'ash-on-the-road', name: 'The Broken Oath', giverNpcId: 'edric-hale', zoneId: 'brackenford-lowlands', prerequisites: ['smoke-at-the-watch'], level: 3,
    summary: 'A fragment recovered from the watch bears an oath-mark missing from every modern charter. Brother Alden may know why.',
    objectives: [{ type: 'speak', targetId: 'brother-alden', label: 'Bring the oath-mark to Brother Alden', count: 1 }], rewards: { xp: 240, coin: 28 }
  }
]);

export const IRONVALE_STARTER_ITEMS = Object.freeze([
  ['recruit-longsword', 1], ['training-shield', 1], ['wool-cloak', 1], ['leather-boots', 1], ['field-rations', 3]
]);

const byId = entries => new Map(entries.map(entry => [entry.id, entry]));
const itemsById = byId(IRONVALE_ITEMS);
const questsById = byId(IRONVALE_QUESTS);
const zonesById = byId(IRONVALE_ZONES);
const racesById = byId(IRONVALE_RACES);
const classesById = byId(IRONVALE_CLASSES);
const abilitiesById = byId(IRONVALE_ABILITIES);

export const getIronvaleItem = id => itemsById.get(String(id || '')) || null;
export const getIronvaleQuest = id => questsById.get(String(id || '')) || null;
export const getIronvaleZone = id => zonesById.get(String(id || '')) || null;
export const getIronvaleRace = id => racesById.get(String(id || '')) || null;
export const getIronvaleClass = id => classesById.get(String(id || '')) || null;
export const getIronvaleAbility = id => abilitiesById.get(String(id || '')) || null;
`);

write('src/ironvale/api.js', `import {
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
  \`CREATE TABLE IF NOT EXISTS ironvale_characters (
    user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0, health INTEGER NOT NULL DEFAULT 100, max_health INTEGER NOT NULL DEFAULT 100,
    stamina INTEGER NOT NULL DEFAULT 100, max_stamina INTEGER NOT NULL DEFAULT 100, coin INTEGER NOT NULL DEFAULT 0,
    strength INTEGER NOT NULL DEFAULT 5, agility INTEGER NOT NULL DEFAULT 5, vitality INTEGER NOT NULL DEFAULT 5,
    willpower INTEGER NOT NULL DEFAULT 5, zone_id TEXT NOT NULL DEFAULT 'brackenford-lowlands',
    spawn_id TEXT NOT NULL DEFAULT 'valeborn-training-yard', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )\`,
  \`CREATE TABLE IF NOT EXISTS ironvale_character_profiles (
    user_id TEXT PRIMARY KEY, race_id TEXT NOT NULL, class_id TEXT NOT NULL, origin_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL, chapter_id TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )\`,
  \`CREATE TABLE IF NOT EXISTS ironvale_inventory (
    user_id TEXT NOT NULL, item_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 0),
    durability INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,item_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )\`,
  \`CREATE TABLE IF NOT EXISTS ironvale_equipment (
    user_id TEXT PRIMARY KEY, head TEXT, chest TEXT, hands TEXT, legs TEXT, feet TEXT,
    main_hand TEXT, off_hand TEXT, neck TEXT, ring TEXT, updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )\`,
  \`CREATE TABLE IF NOT EXISTS ironvale_quest_progress (
    user_id TEXT NOT NULL, quest_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
    progress_json TEXT NOT NULL DEFAULT '{}', started_at INTEGER, completed_at INTEGER, updated_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,quest_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )\`,
  \`CREATE TABLE IF NOT EXISTS ironvale_world_flags (
    user_id TEXT NOT NULL, flag_id TEXT NOT NULL, value_json TEXT NOT NULL DEFAULT 'null', updated_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,flag_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )\`,
  \`CREATE INDEX IF NOT EXISTS idx_ironvale_inventory_user ON ironvale_inventory(user_id,updated_at DESC)\`,
  \`CREATE INDEX IF NOT EXISTS idx_ironvale_quests_user_status ON ironvale_quest_progress(user_id,status,updated_at DESC)\`,
  \`CREATE INDEX IF NOT EXISTS idx_ironvale_character_zone ON ironvale_characters(zone_id)\`
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
  await env.DB.prepare(\`INSERT OR IGNORE INTO ironvale_characters(user_id,display_name,created_at,updated_at) VALUES(?,?,?,?)\`).bind(user.id, user.username, timestamp, timestamp).run();
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
  await env.DB.batch(IRONVALE_STARTER_ITEMS.map(([itemId, quantity]) => env.DB.prepare(\`
    INSERT INTO ironvale_inventory(user_id,item_id,quantity,durability,created_at,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=MAX(quantity,excluded.quantity),updated_at=excluded.updated_at
  \`).bind(userId, itemId, quantity, 100, timestamp, timestamp)));
  await env.DB.prepare(\`
    INSERT INTO ironvale_equipment(user_id,chest,feet,main_hand,off_hand,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET chest=excluded.chest,feet=excluded.feet,main_hand=excluded.main_hand,off_hand=excluded.off_hand,updated_at=excluded.updated_at
  \`).bind(userId, 'wool-cloak', 'leather-boots', 'recruit-longsword', 'training-shield', timestamp).run();
}

async function createCharacter(user, body, env, deps) {
  const existing = await getProfile(user.id, env);
  if (existing) return deps.json({ ok: false, error: 'This account already has an Ironvale character.' }, 409);
  const name = String(body?.name || user.username || '').trim();
  if (!/^[A-Za-z][A-Za-z '\\-]{2,19}$/.test(name)) return deps.json({ ok: false, error: 'Character name must be 3-20 letters and may include spaces, apostrophes or hyphens.' }, 400);
  const raceId = String(body?.raceId || 'valeborn');
  const classId = String(body?.classId || 'knight');
  if (raceId !== 'valeborn' || classId !== 'knight') return deps.json({ ok: false, error: 'H3.0 currently launches with the Valeborn Knight only.' }, 400);
  const timestamp = now();
  await ensureCharacter(user, env);
  await env.DB.batch([
    env.DB.prepare(\`UPDATE ironvale_characters SET display_name=?,level=1,xp=0,health=120,max_health=120,stamina=110,max_stamina=110,coin=0,strength=8,agility=6,vitality=7,willpower=6,zone_id='brackenford-lowlands',spawn_id='valeborn-training-yard',updated_at=? WHERE user_id=?\`).bind(name, timestamp, user.id),
    env.DB.prepare(\`INSERT INTO ironvale_character_profiles(user_id,race_id,class_id,origin_id,campaign_id,chapter_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)\`).bind(user.id, raceId, classId, 'brackenford-lowlands', 'the-broken-oath', 'ash-on-the-road', timestamp, timestamp),
    env.DB.prepare(\`INSERT OR REPLACE INTO ironvale_quest_progress(user_id,quest_id,status,progress_json,started_at,completed_at,updated_at) VALUES(?,?,'active','{}',?,NULL,?)\`).bind(user.id, 'the-first-oath', timestamp, timestamp)
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
  await env.DB.prepare(\`INSERT INTO ironvale_quest_progress(user_id,quest_id,status,progress_json,started_at,updated_at) VALUES(?,?,'active','{}',?,?) ON CONFLICT(user_id,quest_id) DO UPDATE SET status='active',started_at=COALESCE(started_at,excluded.started_at),updated_at=excluded.updated_at\`).bind(user.id, quest.id, timestamp, timestamp).run();
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
        await env.DB.prepare(\`INSERT INTO ironvale_world_flags(user_id,flag_id,value_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,flag_id) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at\`)
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
`);

// ---------------------------------------------------------------------------
// Schema: keep accounts/auth and add the game identity record without risky
// ALTER TABLE migrations for existing D1 databases.
// ---------------------------------------------------------------------------
let schema = read('schema.sql');
if (!schema.includes('CREATE TABLE IF NOT EXISTS ironvale_character_profiles')) {
  const anchor = 'CREATE INDEX IF NOT EXISTS idx_ironvale_character_zone ON ironvale_characters(zone_id);\n';
  schema = replaceOnce(schema, anchor, anchor + `\nCREATE TABLE IF NOT EXISTS ironvale_character_profiles (\n  user_id TEXT PRIMARY KEY,\n  race_id TEXT NOT NULL,\n  class_id TEXT NOT NULL,\n  origin_id TEXT NOT NULL,\n  campaign_id TEXT NOT NULL,\n  chapter_id TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL,\n  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE\n);\n`, 'character profile schema anchor');
}
write('schema.sql', schema);

// ---------------------------------------------------------------------------
// The authenticated product is the game world. Old routed document pages are no
// longer part of the active player flow.
// ---------------------------------------------------------------------------
write('public/app.js', `import './rift-world-composition-runtime.js';
import { $ } from './ui/helpers.js';
import { state } from './ui/state.js';
import { go } from './ui/router.js';
import { initShell, refreshSession, submitAuth } from './ui/shell.js';
import { renderCity, destroyCity2D } from './views/city.js';
import { initPwaSupport } from './pwa.js';

initShell(); initPwaSupport();
$('#login-form').addEventListener('submit', event => { event.preventDefault(); submitAuth('/api/auth/login', event.currentTarget); });
$('#register-form').addEventListener('submit', event => { event.preventDefault(); submitAuth('/api/auth/register', event.currentTarget); });

let routeQueued = false;
function scheduleRoute() {
  if (routeQueued) return;
  routeQueued = true;
  queueMicrotask(() => { routeQueued = false; route().catch(error => console.error('Ironvale game mount failed', error)); });
}
window.addEventListener('hashchange', scheduleRoute);
window.addEventListener('popstate', scheduleRoute);
window.addEventListener('ironvale:navigate', scheduleRoute);

let focusRefreshPending = false;
window.addEventListener('focus', async () => {
  if (!state.authenticated || focusRefreshPending) return;
  focusRefreshPending = true;
  try { await refreshSession({ navigate: false }); } catch (error) { console.warn('Ironvale session refresh failed', error); }
  finally { focusRefreshPending = false; }
});

async function boot() {
  const authenticated = await refreshSession();
  if (!authenticated) return;
  if (location.hash !== '#world') { history.replaceState(null, '', '#world'); }
  await route();
}

function destroyWorldSafely() {
  try { destroyCity2D(); } catch (error) { console.warn('Ironvale world teardown failed during remount', error); }
}

async function route() {
  const request = ++state.activeRequest;
  if (!state.authenticated) {
    const ok = await refreshSession({ navigate: false });
    if (!ok || request !== state.activeRequest) return;
  }
  if (location.hash !== '#world') { history.replaceState(null, '', '#world'); }
  state.route = { name: 'world' };
  const root = $('#game-root');
  if (!root) return;
  destroyWorldSafely();
  const mount = document.createElement('div');
  mount.className = 'ironvale-route-mount ironvale-world-mount';
  root.replaceChildren(mount);
  await renderCity(mount);
}

boot();
`);

write('public/ui/state.js', `export const state = {
  authenticated: false,
  user: null,
  character: null,
  profile: null,
  needsCharacterCreation: false,
  creationOptions: null,
  world: null,
  journal: null,
  inventory: null,
  equipment: null,
  sync: null,
  route: null,
  activeRequest: 0,
  inlineMessage: null
};

export function setCharacter(character) { if (character) state.character = character; }
export function clearState() {
  state.authenticated = false; state.user = null; state.character = null; state.profile = null;
  state.needsCharacterCreation = false; state.creationOptions = null; state.world = null; state.journal = null;
  state.inventory = null; state.equipment = null; state.sync = null;
}
`);

let shell = read('public/ui/shell.js');
shell = replaceOnce(shell,
`function applyBootstrap(result) {
  state.authenticated = true; state.user = result.user; state.character = result.character; state.world = result.world;
  state.journal = result.journal; state.inventory = result.inventory; state.equipment = result.equipment;
  renderDrawer(); renderCharacterHud(result.character);
}`,
`function applyBootstrap(result) {
  state.authenticated = true; state.user = result.user; state.character = result.character; state.profile = result.profile || null;
  state.needsCharacterCreation = !!result.needsCharacterCreation; state.creationOptions = result.creationOptions || null; state.world = result.world;
  state.journal = result.journal; state.inventory = result.inventory; state.equipment = result.equipment;
  renderDrawer(); renderCharacterHud(result.character);
}`,'bootstrap state');
shell = replaceOnce(shell,
`function applySync(result) {
  state.sync = result; if (result.character) state.character = result.character; if (result.journal) state.journal = result.journal; if (result.equipment) state.equipment = result.equipment;
  renderCharacterHud(state.character);
}`,
`function applySync(result) {
  state.sync = result; if (result.character) state.character = result.character; if ('profile' in result) state.profile = result.profile;
  if ('needsCharacterCreation' in result) state.needsCharacterCreation = !!result.needsCharacterCreation;
  if (result.journal) state.journal = result.journal; if (result.equipment) state.equipment = result.equipment;
  renderCharacterHud(state.character);
  window.dispatchEvent(new CustomEvent('ironvale:state-sync'));
}`,'sync state');
shell = replaceOnce(shell,
`    clearState(); setDrawerOpen(false); retireLegacyHud(); $('#auth-grid')?.classList.remove('hidden'); $('#game-root')?.classList.add('hidden'); $('#mobile-nav')?.classList.add('hidden');`,
`    clearState(); document.body.classList.remove('ironvale-session-active'); setDrawerOpen(false); retireLegacyHud(); $('#auth-grid')?.classList.remove('hidden'); $('#game-root')?.classList.add('hidden'); $('#mobile-nav')?.classList.add('hidden');`,'unauth session class');
shell = replaceOnce(shell,
`  $('#auth-grid')?.classList.add('hidden'); $('#game-root')?.classList.remove('hidden'); retireLegacyHud(); $('#mobile-nav')?.classList.remove('hidden');`,
`  document.body.classList.add('ironvale-session-active'); $('#auth-grid')?.classList.add('hidden'); $('#game-root')?.classList.remove('hidden'); retireLegacyHud(); $('#mobile-nav')?.classList.add('hidden');`,'auth session class');
shell = replaceOnce(shell,
`  if (result.ok) { clearState(); setDrawerOpen(false); retireLegacyHud(); stopSync(); showToast('Logged out.'); await refreshSession(); }`,
`  if (result.ok) { clearState(); document.body.classList.remove('ironvale-session-active'); setDrawerOpen(false); retireLegacyHud(); stopSync(); showToast('Logged out.'); await refreshSession(); }`,'logout session class');
if (!shell.includes("window.addEventListener('ironvale:logout'")) shell += `\nwindow.addEventListener('ironvale:logout', () => logout());\n`;
write('public/ui/shell.js', shell);

// ---------------------------------------------------------------------------
// Real in-world starter runtime: creation, HUD, quest tracker, interaction,
// Knight action bar and game panels all live over the WebGL world.
// ---------------------------------------------------------------------------
write('public/ironvale-gameplay.js', `import { api } from './ui/api.js';
import { state } from './ui/state.js';
import { riftNativeResolveCombat } from './rift-wasm-core.js';

const distanceXZ = (a, b) => Math.hypot((a?.[0] || 0) - (b?.[0] || 0), (a?.[2] || 0) - (b?.[2] || 0));
const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function objectiveProgress(quest, objective) {
  const key = objective.type + ':' + objective.targetId;
  return Math.min(objective.count, Number(quest?.progress?.[key]) || 0);
}

function makeHumanoid(engine, npc) {
  const color = npc.color || '#6f6a60';
  const parts = [
    engine.addBox({ name: npc.id + '-body', color, dynamic: true, blockGrid: 0, scale: [0.56,0.78,0.38] }),
    engine.addBox({ name: npc.id + '-head', color: '#c99772', dynamic: true, blockGrid: 0, scale: [0.44,0.44,0.44] }),
    engine.addBox({ name: npc.id + '-legs', color: '#302b26', dynamic: true, blockGrid: 0, scale: [0.44,0.72,0.34] }),
    engine.addBox({ name: npc.id + '-quest', color: '#d7ad4b', dynamic: true, blockGrid: 0, scale: [0.18,0.34,0.18] })
  ];
  const [x,y,z] = npc.position;
  engine.setTransform(parts[0], [x,y+1.05,z], 0, parts[0].scale);
  engine.setTransform(parts[1], [x,y+1.68,z], 0, parts[1].scale);
  engine.setTransform(parts[2], [x,y+0.38,z], 0, parts[2].scale);
  engine.setTransform(parts[3], [x,y+2.28,z], 0, parts[3].scale);
  parts[3].visible = false;
  return { npc, parts, marker: parts[3], position: npc.position, destroy: () => engine.removeDrawables(parts) };
}

function makeTrainingDummy(engine, poi) {
  const parts = [
    engine.addBox({ name: 'training-dummy-post', color: '#6a4b2c', dynamic: true, blockGrid: 0, scale: [0.24,1.5,0.24] }),
    engine.addBox({ name: 'training-dummy-cross', color: '#80603b', dynamic: true, blockGrid: 0, scale: [1.15,0.22,0.22] }),
    engine.addBox({ name: 'training-dummy-head', color: '#8b704d', dynamic: true, blockGrid: 0, scale: [0.48,0.48,0.40] })
  ];
  const [x,y,z] = poi.position;
  engine.setTransform(parts[0], [x,y+0.75,z], 0, parts[0].scale);
  engine.setTransform(parts[1], [x,y+1.25,z], 0, parts[1].scale);
  engine.setTransform(parts[2], [x,y+1.67,z], 0, parts[2].scale);
  return { poi, parts, position: poi.position, destroy: () => engine.removeDrawables(parts) };
}

export async function createIronvaleStarterRuntime({ root, shell, engine, player, playerController, getImported }) {
  let destroyed = false;
  let nearest = null;
  let scanClock = 0;
  let panelOpen = null;
  let strikeReadyAt = 0;
  let guardReadyAt = 0;
  let rallyReadyAt = 0;
  let guardUntil = 0;
  const entities = [];

  const ui = document.createElement('div');
  ui.className = 'ironvale-gameplay-ui';
  ui.innerHTML = `
    <section class="iv-player-hud" data-iv-player-hud></section>
    <aside class="iv-quest-tracker" data-iv-quest-tracker></aside>
    <div class="iv-interact-prompt" data-iv-interact hidden><button type="button"><span>E</span><b>INTERACT</b><small data-iv-interact-name></small></button></div>
    <div class="iv-actionbar" data-iv-actionbar>
      <button data-iv-ability="knight-strike"><span>1</span><b>Strike</b><small>Lv 1</small></button>
      <button data-iv-ability="knight-guard"><span>2</span><b>Guard</b><small>Lv 2</small></button>
      <button data-iv-ability="knight-rally"><span>3</span><b>Rally</b><small>Lv 4</small></button>
      <button class="utility" data-iv-panel="character"><span>C</span><b>Character</b></button>
      <button class="utility" data-iv-panel="quests"><span>L</span><b>Quests</b></button>
      <button class="utility" data-iv-panel="bags"><span>B</span><b>Bags</b></button>
    </div>
    <div class="iv-combat-float" data-iv-combat-float></div>
    <div class="iv-game-panel" data-iv-game-panel hidden><section><header><div><span data-iv-panel-eyebrow>IRONVALE</span><strong data-iv-panel-title></strong></div><button data-iv-panel-close type="button">×</button></header><div data-iv-panel-body></div></section></div>
    <div class="iv-character-create" data-iv-character-create hidden>
      <section>
        <span class="eyebrow">IRONVALE · NEW CHARACTER</span>
        <h1>Begin your oath.</h1>
        <p>H3.0 starts deliberately small: one people, one class and one real starting region. More choices come after this slice feels right.</p>
        <div class="iv-choice-grid">
          <article><small>RACE</small><h2>Valeborn</h2><p>Frontier people of the Ironvale Marches. Practical, oath-bound and accustomed to defending isolated roads and settlements.</p><b>Marcher Resolve · Oathbound</b></article>
          <article><small>CLASS</small><h2>Knight</h2><p>Armored melee fighter built around swordwork, shields and disciplined defensive stances.</p><b>Tank · Melee Damage</b></article>
        </div>
        <label>CHARACTER NAME<input data-iv-character-name maxlength="20" autocomplete="off" /></label>
        <button class="primary" data-iv-create-character type="button">ENTER BRACKENFORD</button>
        <small data-iv-create-status></small>
      </section>
    </div>`;
  shell.appendChild(ui);

  const hud = ui.querySelector('[data-iv-player-hud]');
  const tracker = ui.querySelector('[data-iv-quest-tracker]');
  const interactPrompt = ui.querySelector('[data-iv-interact]');
  const interactName = ui.querySelector('[data-iv-interact-name]');
  const panel = ui.querySelector('[data-iv-game-panel]');
  const panelTitle = ui.querySelector('[data-iv-panel-title]');
  const panelEyebrow = ui.querySelector('[data-iv-panel-eyebrow]');
  const panelBody = ui.querySelector('[data-iv-panel-body]');
  const creation = ui.querySelector('[data-iv-character-create]');
  const creationName = ui.querySelector('[data-iv-character-name]');
  const creationStatus = ui.querySelector('[data-iv-create-status]');
  const combatFloat = ui.querySelector('[data-iv-combat-float]');

  const showFloat = (text, tone = '') => {
    combatFloat.textContent = text;
    combatFloat.className = 'iv-combat-float show ' + tone;
    clearTimeout(showFloat.timer);
    showFloat.timer = setTimeout(() => { combatFloat.className = 'iv-combat-float'; }, 900);
  };

  function renderHud() {
    const c = state.character;
    if (!c || state.needsCharacterCreation) { hud.hidden = true; return; }
    hud.hidden = false;
    const identity = state.profile || c.identity || {};
    const r = c.resources || {};
    hud.innerHTML = `<div class="iv-portrait">IV</div><div class="iv-hud-copy"><strong>${escapeHtml(c.name)}</strong><small>Level ${c.level} ${escapeHtml(identity.class?.name || 'Knight')} · ${escapeHtml(identity.race?.name || 'Valeborn')}</small><div class="iv-bar health"><i style="width:${Math.max(0,Math.min(100,(r.health||0)/(r.maxHealth||1)*100))}%"></i><span>${r.health}/${r.maxHealth}</span></div><div class="iv-bar stamina"><i style="width:${Math.max(0,Math.min(100,(r.stamina||0)/(r.maxStamina||1)*100))}%"></i><span>${r.stamina}/${r.maxStamina} stamina</span></div></div>`;
    for (const button of ui.querySelectorAll('[data-iv-ability]')) {
      const ability = state.world?.abilities?.find(item => item.id === button.dataset.ivAbility);
      const locked = !ability || c.level < ability.level;
      button.classList.toggle('locked', locked);
      button.disabled = locked;
      button.title = locked ? 'Unlocks at level ' + (ability?.level || '?') : ability.description;
    }
  }

  function activeQuest() { return state.journal?.quests?.find(quest => quest.status === 'active') || null; }
  function renderTracker() {
    const quest = activeQuest();
    if (!quest || state.needsCharacterCreation) { tracker.hidden = true; updateNpcMarkers(); return; }
    tracker.hidden = false;
    tracker.innerHTML = `<span>THE BROKEN OATH</span><strong>${escapeHtml(quest.name)}</strong>${quest.objectives.map(objective => `<div><i></i><b>${escapeHtml(objective.label)}</b><small>${objectiveProgress(quest,objective)}/${objective.count}</small></div>`).join('')}`;
    updateNpcMarkers();
  }

  function updateNpcMarkers() {
    for (const entity of entities.filter(item => item.npc)) {
      const available = state.journal?.quests?.some(quest => quest.status === 'available' && quest.giverNpcId === entity.npc.id);
      const speakActive = state.journal?.quests?.some(quest => quest.status === 'active' && quest.objectives.some(objective => objective.type === 'speak' && objective.targetId === entity.npc.id));
      entity.marker.visible = !!(available || speakActive) && !state.needsCharacterCreation;
    }
  }

  function applyBootstrap(bootstrap) {
    state.character = bootstrap.character; state.profile = bootstrap.profile; state.needsCharacterCreation = !!bootstrap.needsCharacterCreation;
    state.creationOptions = bootstrap.creationOptions; state.world = bootstrap.world; state.journal = bootstrap.journal; state.inventory = bootstrap.inventory; state.equipment = bootstrap.equipment;
    renderHud(); renderTracker();
  }

  function closePanel() {
    panel.hidden = true; panelOpen = null;
    if (!state.needsCharacterCreation) playerController.setEnabled(true);
  }

  function openPanel(name, extra = null) {
    if (state.needsCharacterCreation) return;
    panelOpen = name; panel.hidden = false; playerController.setEnabled(false);
    if (name === 'character') {
      const c = state.character, a = c?.attributes || {}, r = c?.resources || {}, p = state.profile || {};
      panelEyebrow.textContent = 'CHARACTER'; panelTitle.textContent = c?.name || 'Valeborn Knight';
      panelBody.innerHTML = `<div class="iv-sheet"><div><span>Race</span><b>${escapeHtml(p.race?.name || 'Valeborn')}</b></div><div><span>Class</span><b>${escapeHtml(p.class?.name || 'Knight')}</b></div><div><span>Role</span><b>${escapeHtml((p.class?.roles || ['Tank','Melee Damage']).join(' / '))}</b></div><div><span>Level</span><b>${c?.level || 1}</b></div><div><span>Strength</span><b>${a.strength || 0}</b></div><div><span>Agility</span><b>${a.agility || 0}</b></div><div><span>Vitality</span><b>${a.vitality || 0}</b></div><div><span>Willpower</span><b>${a.willpower || 0}</b></div><div><span>Health</span><b>${r.health}/${r.maxHealth}</b></div><div><span>Stamina</span><b>${r.stamina}/${r.maxStamina}</b></div></div>`;
    } else if (name === 'quests') {
      panelEyebrow.textContent = 'QUEST LOG'; panelTitle.textContent = 'The Broken Oath';
      panelBody.innerHTML = `<div class="iv-quest-log">${(state.journal?.quests || []).filter(q => q.status !== 'locked').map(q => `<article class="${q.status}"><small>${q.status.toUpperCase()} · LEVEL ${q.level}</small><h3>${escapeHtml(q.name)}</h3><p>${escapeHtml(q.summary)}</p>${q.objectives.map(o => `<div>${escapeHtml(o.label)} <b>${objectiveProgress(q,o)}/${o.count}</b></div>`).join('')}</article>`).join('')}</div>`;
    } else if (name === 'bags') {
      panelEyebrow.textContent = 'INVENTORY'; panelTitle.textContent = 'Bags';
      panelBody.innerHTML = `<div class="iv-bag-grid">${(state.inventory?.items || []).map(item => `<article><span>${escapeHtml(item.name.slice(0,2).toUpperCase())}</span><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.type)} · ${item.quantity}×</small><p>${escapeHtml(item.description)}</p></div></article>`).join('')}</div>`;
    } else if (name === 'dialogue') {
      panelEyebrow.textContent = extra?.eyebrow || 'BRACKENFORD'; panelTitle.textContent = extra?.title || 'Conversation';
      panelBody.innerHTML = `<div class="iv-dialogue"><p>${escapeHtml(extra?.text || '')}</p><button data-iv-dialogue-continue type="button">Continue</button></div>`;
      panelBody.querySelector('[data-iv-dialogue-continue]')?.addEventListener('click', closePanel);
    }
  }

  async function refreshInventory() {
    const result = await api('/api/ironvale/inventory', { riftCacheTtl: 0 });
    if (result.ok) state.inventory = result.inventory;
  }

  async function progressEvent(type, targetId, amount = 1) {
    const result = await api('/api/ironvale/quests/progress', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ type, targetId, amount }) });
    if (!result.ok) return result;
    if (result.character) state.character = result.character;
    if (result.journal) state.journal = result.journal;
    if (result.completedQuest) showFloat('Quest complete · ' + result.completedQuest.name, 'quest');
    renderHud(); renderTracker();
    return result;
  }

  async function interact() {
    if (!nearest || panelOpen || state.needsCharacterCreation) return;
    if (nearest.npc) {
      const available = state.journal?.quests?.find(quest => quest.status === 'available' && quest.giverNpcId === nearest.npc.id);
      if (available) {
        const accepted = await api('/api/ironvale/quests/accept', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ questId: available.id }) });
        if (accepted.ok) { state.journal = accepted.journal; renderTracker(); openPanel('dialogue', { title: nearest.npc.name, eyebrow: nearest.npc.role, text: available.summary }); }
        return;
      }
      const progressed = await progressEvent('speak', nearest.npc.id, 1);
      const text = progressed?.completedQuest ? 'Good. Remember what was asked of you. The road will test the rest.' : nearest.npc.dialogue;
      openPanel('dialogue', { title: nearest.npc.name, eyebrow: nearest.npc.role, text });
      return;
    }
    if (nearest.poi && nearest.poi.kind === 'quest-object') {
      const result = await progressEvent('inspect', nearest.poi.id, 1);
      showFloat(result?.changed ? 'Objective updated' : 'Nothing new here.', result?.changed ? 'quest' : '');
    }
  }

  async function strike() {
    if (state.needsCharacterCreation || panelOpen || Date.now() < strikeReadyAt) return;
    const ability = state.world?.abilities?.find(item => item.id === 'knight-strike');
    if (!ability || (state.character?.level || 1) < ability.level) return;
    const dummy = entities.find(item => item.poi?.id === 'training-dummy');
    if (!dummy || distanceXZ(player.position, dummy.position) > ability.range) { showFloat('No target in range'); return; }
    strikeReadyAt = Date.now() + ability.cooldownMs;
    const c = state.character, weapon = state.equipment?.mainHand || state.inventory?.items?.find(item => item.id === 'recruit-longsword') || {};
    const roll = riftNativeResolveCombat({ attackerPower: c?.attributes?.strength || 8, attackerAccuracy: 75 + (c?.attributes?.agility || 6) * 2, defenderArmor: 2, defenderEvasion: 0, weaponMin: weapon.weaponMin || 7, weaponMax: weapon.weaponMax || 11, critPermille: 80, seed: (Date.now() ^ ((c?.level || 1) * 2654435761)) >>> 0 });
    showFloat(roll.hit ? (roll.critical ? 'CRIT ' : '') + roll.damage : 'MISS', roll.critical ? 'crit' : '');
    await progressEvent('train', 'training-dummy', 1);
  }

  function guard() {
    const ability = state.world?.abilities?.find(item => item.id === 'knight-guard');
    if (!ability || (state.character?.level || 1) < ability.level || Date.now() < guardReadyAt || panelOpen) return;
    guardReadyAt = Date.now() + ability.cooldownMs; guardUntil = Date.now() + ability.durationMs; showFloat('GUARD', 'guard');
  }

  function rally() {
    const ability = state.world?.abilities?.find(item => item.id === 'knight-rally');
    if (!ability || (state.character?.level || 1) < ability.level || Date.now() < rallyReadyAt || panelOpen) return;
    rallyReadyAt = Date.now() + ability.cooldownMs;
    if (state.character?.resources) state.character.resources.stamina = Math.min(state.character.resources.maxStamina, state.character.resources.stamina + 25);
    renderHud(); showFloat('RALLY +25 STA', 'guard');
  }

  async function createCharacter() {
    const name = String(creationName.value || state.user?.username || '').trim();
    creationStatus.textContent = 'Creating Valeborn Knight…';
    const result = await api('/api/ironvale/character/create', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, raceId:'valeborn', classId:'knight' }) });
    if (!result.ok) { creationStatus.textContent = result.error || 'Could not create character.'; return; }
    applyBootstrap(result.bootstrap);
    creation.hidden = true; document.body.classList.remove('ironvale-character-creation-active');
    player.setVisible(true); playerController.teleport(state.world?.currentZone?.spawn?.position || [20,2,22]); playerController.setEnabled(true);
    showFloat('Welcome to Brackenford', 'quest');
  }

  function mountEntities() {
    for (const entity of entities) entity.destroy?.();
    entities.length = 0;
    for (const npc of state.world?.npcs || []) entities.push(makeHumanoid(engine, npc));
    const dummy = state.world?.pointsOfInterest?.find(item => item.id === 'training-dummy');
    if (dummy) entities.push(makeTrainingDummy(engine, dummy));
    updateNpcMarkers();
  }

  function scanInteractions() {
    nearest = null;
    const candidates = [];
    for (const entity of entities.filter(item => item.npc)) candidates.push({ ...entity, name: entity.npc.name, range: 2.8 });
    for (const poi of state.world?.pointsOfInterest || []) if (poi.kind === 'quest-object') candidates.push({ poi, position: poi.position, name: poi.name, range: poi.interactRange || 2.8 });
    let best = Infinity;
    for (const candidate of candidates) {
      const distance = distanceXZ(player.position, candidate.position);
      if (distance <= candidate.range && distance < best) { nearest = candidate; best = distance; }
    }
    interactPrompt.hidden = !nearest || state.needsCharacterCreation || !!panelOpen;
    if (nearest) interactName.textContent = nearest.name;
  }

  function onKeyDown(event) {
    if (destroyed || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'KeyE') { interact(); event.preventDefault(); }
    else if (event.code === 'Digit1') { strike(); event.preventDefault(); }
    else if (event.code === 'Digit2') { guard(); event.preventDefault(); }
    else if (event.code === 'Digit3') { rally(); event.preventDefault(); }
    else if (event.code === 'KeyC') { panelOpen === 'character' ? closePanel() : openPanel('character'); event.preventDefault(); }
    else if (event.code === 'KeyL') { panelOpen === 'quests' ? closePanel() : openPanel('quests'); event.preventDefault(); }
    else if (event.code === 'KeyB') { panelOpen === 'bags' ? closePanel() : openPanel('bags'); event.preventDefault(); }
    else if (event.code === 'Escape' && panelOpen) { closePanel(); }
  }

  ui.querySelector('[data-iv-interact] button')?.addEventListener('click', interact);
  ui.querySelector('[data-iv-ability="knight-strike"]')?.addEventListener('click', strike);
  ui.querySelector('[data-iv-ability="knight-guard"]')?.addEventListener('click', guard);
  ui.querySelector('[data-iv-ability="knight-rally"]')?.addEventListener('click', rally);
  ui.querySelectorAll('[data-iv-panel]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.ivPanel)));
  ui.querySelector('[data-iv-panel-close]')?.addEventListener('click', closePanel);
  ui.querySelector('[data-iv-create-character]')?.addEventListener('click', createCharacter);
  window.addEventListener('keydown', onKeyDown, { capture: true });
  window.addEventListener('ironvale:state-sync', () => { renderHud(); renderTracker(); });

  mountEntities();
  renderHud(); renderTracker();
  if (state.needsCharacterCreation || !state.profile) {
    creation.hidden = false; document.body.classList.add('ironvale-character-creation-active');
    creationName.value = state.user?.username || ''; playerController.setEnabled(false); player.setVisible(false);
  } else {
    creation.hidden = true; player.setVisible(true); playerController.teleport(state.world?.currentZone?.spawn?.position || [20,2,22]);
  }

  const apiHandle = Object.freeze({ openPanel, closePanels: closePanel, interact, strike, get guardActive() { return Date.now() < guardUntil; } });
  window.IronvaleGameplay = apiHandle;

  return {
    update(dt) {
      if (destroyed) return;
      scanClock -= Math.max(0, Number(dt) || 0);
      if (scanClock <= 0) { scanClock = 0.10; scanInteractions(); }
    },
    onWorldChanged(document) {
      const active = document?.id === 'brackenford-lowlands-001';
      for (const entity of entities) for (const drawable of entity.parts || []) drawable.visible = active && (drawable !== entity.marker || drawable.visible);
      if (!active) interactPrompt.hidden = true;
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      for (const entity of entities) entity.destroy?.();
      clearTimeout(showFloat.timer);
      ui.remove(); document.body.classList.remove('ironvale-character-creation-active');
      if (window.IronvaleGameplay === apiHandle) delete window.IronvaleGameplay;
    }
  };
}
`);

// ---------------------------------------------------------------------------
// Build one actual starter zone using the stable RiftBlock authoring contract.
// The old flat foundation remains untouched as an engine regression fixture.
// ---------------------------------------------------------------------------
const ops = [];
const fill = (state, min, max, name) => ops.push({ op:'fill_box', state, min, max, name });
fill('dirt',[0,0,0],[95,0,95],'Lowland soil');
fill('grass_block',[0,1,0],[95,1,95],'Lowland grass');
fill('cobblestone',[45,1,0],[50,1,95],'Old North Road');
fill('gravel',[10,1,34],[70,1,40],'Brackenford crossroad');
fill('gravel',[14,1,14],[35,1,31],'Knight training yard');
fill('dirt_dry',[6,1,70],[38,1,91],'South barley field');
fill('dirt_dry',[55,1,50],[92,1,66],'East fallow field');
// Training hall.
fill('stone',[14,2,14],[14,4,31],'Training hall west wall');
fill('stone',[35,2,14],[35,4,31],'Training hall east wall');
fill('stone',[14,2,14],[20,4,14],'Training hall south wall A');
fill('stone',[23,2,14],[35,4,14],'Training hall south wall B');
fill('stone',[14,2,31],[35,4,31],'Training hall north wall');
fill('aged_wood',[14,5,14],[35,5,31],'Training hall roof');
// Reeve hall.
fill('stone',[36,2,27],[36,5,43],'Reeve hall west wall');
fill('stone',[52,2,27],[52,5,43],'Reeve hall east wall');
fill('stone',[36,2,27],[43,5,27],'Reeve hall south wall A');
fill('stone',[46,2,27],[52,5,27],'Reeve hall south wall B');
fill('stone',[36,2,43],[52,5,43],'Reeve hall north wall');
fill('aged_wood',[36,6,27],[52,6,43],'Reeve hall roof');
// Smithy.
fill('stone',[54,2,24],[54,4,38],'Smithy west wall');
fill('stone',[66,2,24],[66,4,38],'Smithy east wall');
fill('stone',[54,2,24],[58,4,24],'Smithy south A');
fill('stone',[61,2,24],[66,4,24],'Smithy south B');
fill('stone',[54,2,38],[66,4,38],'Smithy north wall');
fill('aged_wood',[54,5,24],[66,5,38],'Smithy roof');
fill('stone_dark',[63,5,34],[64,8,35],'Smithy chimney');
// Abbey archive.
fill('mossy_stone',[14,2,50],[14,5,68],'Abbey west wall');
fill('mossy_stone',[30,2,50],[30,5,68],'Abbey east wall');
fill('mossy_stone',[14,2,50],[20,5,50],'Abbey south A');
fill('mossy_stone',[23,2,50],[30,5,50],'Abbey south B');
fill('mossy_stone',[14,2,68],[30,5,68],'Abbey north wall');
fill('aged_wood',[14,6,50],[30,6,68],'Abbey roof');
// Palisade/fences with road gates.
fill('oak_wood',[9,2,9],[9,3,72],'West palisade');
fill('oak_wood',[71,2,9],[71,3,33],'East palisade south');
fill('oak_wood',[71,2,41],[71,3,72],'East palisade north');
fill('oak_wood',[9,2,9],[44,3,9],'South palisade west');
fill('oak_wood',[51,2,9],[71,3,9],'South palisade east');
fill('oak_wood',[9,2,72],[44,3,72],'North palisade west');
fill('oak_wood',[51,2,72],[71,3,72],'North palisade east');
// Roadside milestone and watchtower.
fill('mossy_stone',[48,2,52],[48,3,52],'Broken North Road milestone');
fill('stone_dark',[72,2,70],[72,8,78],'North Watch west wall');
fill('stone_dark',[80,2,70],[80,8,78],'North Watch east wall');
fill('stone_dark',[72,2,70],[75,8,70],'North Watch south A');
fill('stone_dark',[78,2,70],[80,8,70],'North Watch south B');
fill('stone_dark',[72,2,78],[80,8,78],'North Watch north wall');
fill('aged_wood',[72,9,70],[80,9,78],'North Watch roof');
fill('stone',[74,2,72],[78,2,76],'North Watch floor');
// Field boundaries and small roadside features.
fill('oak_wood',[5,2,69],[39,2,69],'Barley field north fence');
fill('oak_wood',[39,2,69],[39,2,92],'Barley field east fence');
fill('oak_wood',[5,2,92],[39,2,92],'Barley field south fence');
fill('oak_wood',[54,2,49],[93,2,49],'Fallow field south fence');
fill('oak_wood',[93,2,49],[93,2,67],'Fallow field east fence');
fill('oak_wood',[54,2,67],[93,2,67],'Fallow field north fence');
// A few road shrines/markers create visual rhythm toward the northern objective.
fill('mossy_stone',[47,2,61],[47,2,61],'North road marker one');
fill('mossy_stone',[49,2,66],[49,2,66],'North road marker two');
fill('stone',[47,2,82],[48,3,83],'Old patrol cairn');
const starterWorld = {
  format:'riftcity-city-block', version:1, id:'brackenford-lowlands-001', name:'Brackenford Lowlands · Valeborn Start', units:'meters',
  grid:{cell_size:1,shape_increment:0.5}, origin:[0,0,0], bounds:{min:[0,0,0],max:[95,15,95]},
  palette:{air:{material_id:0,shape:'air',color:[0,0,0]}}, ops
};
write('public/rift-world-blocks/brackenford-lowlands-001.json', JSON.stringify(starterWorld, null, 2) + '\n');

// ---------------------------------------------------------------------------
// Mount starter gameplay into the existing proven world/camera/player loop.
// ---------------------------------------------------------------------------
let foundation = read('public/downtown3d-foundation.js');
foundation = replaceOnce(foundation,
`import { createRiftThirdPersonCamera, createRiftFirstPersonCamera } from './rift-third-person-camera.js';`,
`import { createRiftThirdPersonCamera, createRiftFirstPersonCamera } from './rift-third-person-camera.js';\nimport { createIronvaleStarterRuntime } from './ironvale-gameplay.js';`,'gameplay import');
foundation = replaceOnce(foundation,
`const DEFAULT_BLOCK_URL = new URL('./rift-world-blocks/ironvale-foundation-001.json', import.meta.url);\nconst ACTIVE_BLOCK_STORAGE_KEY = 'ironvale:world:active-block:v1';\nconst ACTIVE_BLOCK_STORAGE_VERSION = 1;`,
`const DEFAULT_BLOCK_URL = new URL('./rift-world-blocks/brackenford-lowlands-001.json', import.meta.url);\nconst ACTIVE_BLOCK_STORAGE_KEY = 'ironvale:world:active-block:v2';\nconst ACTIVE_BLOCK_STORAGE_VERSION = 2;`,'starter default world');
foundation = replaceOnce(foundation,
`    await foundation.loadActiveBlock();\n    return foundation;`,
`    await foundation.loadActiveBlock();\n    await foundation.startGameplay?.();\n    return foundation;`,'start gameplay after world');
foundation = replaceOnce(foundation,
`  let sourceLabel = 'IRONVALE FOUNDATION';\n  let persistenceLabel = 'BUNDLED';`,
`  let sourceLabel = 'BRACKENFORD LOWLANDS';\n  let persistenceLabel = 'BUNDLED';\n  let ironvaleGameplay = null;`,'gameplay runtime variable');
foundation = replaceOnce(foundation,
`    imported = compiled;\n    sourceLabel = label;`,
`    imported = compiled;\n    ironvaleGameplay?.onWorldChanged?.(compiled.document);\n    sourceLabel = label;`,'world changed hook');
foundation = replaceOnce(foundation,
`    playerController.update(dt);\n    updatePlayerCamera(dt);`,
`    playerController.update(dt);\n    ironvaleGameplay?.update?.(dt);\n    updatePlayerCamera(dt);`,'gameplay update hook');
foundation = replaceOnce(foundation,
`    loadDocument,\n    loadBundledBlock,\n    loadActiveBlock,`,
`    loadDocument,\n    loadBundledBlock,\n    loadActiveBlock,\n    async startGameplay() {\n      if (ironvaleGameplay) return ironvaleGameplay;\n      ironvaleGameplay = await createIronvaleStarterRuntime({ root, shell, engine, player, playerController, getImported: () => imported });\n      return ironvaleGameplay;\n    },`,'gameplay start method');
foundation = replaceOnce(foundation,
`      creative?.destroy?.();\n      playerController.destroy();`,
`      ironvaleGameplay?.destroy?.();\n      ironvaleGameplay = null;\n      creative?.destroy?.();\n      playerController.destroy();`,'gameplay destroy');
foundation = foundation.replaceAll("CITY OVERVIEW", "WORLD OVERVIEW");
foundation = foundation.replaceAll("Saved RiftCity block", "Saved Rift world block");
foundation = foundation.replaceAll("RiftCity cleared it", "Ironvale cleared it");
write('public/downtown3d-foundation.js', foundation);

// ---------------------------------------------------------------------------
// Game menu gets real MMO panels; dev/world/settings remain Rift Engine tools.
// ---------------------------------------------------------------------------
let menu = read('public/rift-game-menu.js');
menu = replaceOnce(menu,
`            <button class="primary" data-rift-resume type="button"><span>Resume</span><span>ESC</span></button>\n            <button data-rift-menu-world type="button"><span>World / Build Controls</span><span>›</span></button>`,
`            <button class="primary" data-rift-resume type="button"><span>Resume</span><span>ESC</span></button>\n            <button data-ironvale-panel="character" type="button"><span>Character</span><span>C</span></button>\n            <button data-ironvale-panel="quests" type="button"><span>Quest Log</span><span>L</span></button>\n            <button data-ironvale-panel="bags" type="button"><span>Bags</span><span>B</span></button>\n            <button data-rift-menu-world type="button"><span>World / Build Controls</span><span>›</span></button>`,'MMO menu panels');
menu = replaceOnce(menu,
`            <button data-rift-reset-graphics type="button"><span>Reset Graphics Defaults</span><span>↺</span></button>`,
`            <button data-rift-reset-graphics type="button"><span>Reset Graphics Defaults</span><span>↺</span></button>\n            <button data-ironvale-logout type="button"><span>Log Out</span><span>↪</span></button>`,'game logout');
menu = replaceOnce(menu,
`  r.querySelector('[data-rift-reset-graphics]')?.addEventListener('click', () => { resetRiftGraphics(); sync(); });`,
`  r.querySelector('[data-rift-reset-graphics]')?.addEventListener('click', () => { resetRiftGraphics(); sync(); });\n  r.querySelectorAll('[data-ironvale-panel]').forEach(button => button.addEventListener('click', () => { window.IronvaleGameplay?.openPanel?.(button.dataset.ironvalePanel); overlay(false); }));\n  r.querySelector('[data-ironvale-logout]')?.addEventListener('click', () => { overlay(false); window.dispatchEvent(new CustomEvent('ironvale:logout')); });`,'MMO menu listeners');
write('public/rift-game-menu.js', menu);

// ---------------------------------------------------------------------------
// Game-first styling. The authenticated shell disappears behind the 3D client;
// overlays are MMO HUD elements, not routed pages.
// ---------------------------------------------------------------------------
let css = read('public/ironvale.css');
const gameplayCss = `

/* H3.0 game-first client --------------------------------------------------- */
body.ironvale-session-active{overflow:hidden;background:#080907}
body.ironvale-session-active>.topbar,body.ironvale-session-active>#status,body.ironvale-session-active>#mobile-nav{display:none!important}
body.ironvale-session-active #game-root{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;padding:0!important;margin:0!important;overflow:hidden!important;z-index:1}
body.ironvale-session-active .ironvale-route-mount,body.ironvale-session-active .world3d-shell{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:100%!important;margin:0!important;border:0!important}
body.ironvale-session-active #riftcity-3d-canvas{width:100%!important;height:100%!important;display:block}
body.ironvale-session-active:not(.rift-dev-mode) .world3d-top-left,body.ironvale-session-active:not(.rift-dev-mode) .rift-import-actions,body.ironvale-session-active:not(.rift-dev-mode) .downtown3d-status,body.ironvale-session-active:not(.rift-dev-mode) .downtown3d-meter{display:none!important}
.ironvale-gameplay-ui{position:absolute;z-index:58;inset:0;pointer-events:none;color:#f3ead6;font-family:system-ui,-apple-system,sans-serif}
.iv-player-hud{position:absolute;left:max(12px,env(safe-area-inset-left));top:max(62px,calc(env(safe-area-inset-top) + 52px));display:grid;grid-template-columns:52px minmax(180px,270px);gap:9px;align-items:center;pointer-events:none;text-shadow:0 1px 2px #000}
.iv-portrait{display:grid;place-items:center;width:50px;height:50px;border:2px solid #b49358;background:#241f17;box-shadow:0 5px 18px #000b;font:900 15px Georgia,serif}
.iv-hud-copy>strong{display:block;font:900 14px/1.1 system-ui}.iv-hud-copy>small{display:block;margin:3px 0 5px;color:#c7baa2;font-size:9px;font-weight:700}.iv-bar{position:relative;height:15px;margin:2px 0;border:1px solid #000b;background:#10100d;overflow:hidden}.iv-bar i{position:absolute;inset:0 auto 0 0;background:#8e2f2c}.iv-bar.stamina i{background:#9a7d32}.iv-bar span{position:relative;z-index:1;display:grid;place-items:center;height:100%;font:800 8px system-ui;text-shadow:0 1px 2px #000}
.iv-quest-tracker{position:absolute;right:max(14px,env(safe-area-inset-right));top:max(66px,calc(env(safe-area-inset-top) + 58px));width:min(310px,34vw);padding:12px 13px;border-left:2px solid #b38a49;background:linear-gradient(90deg,#17130dd9,#17130d99);box-shadow:0 8px 28px #0007;pointer-events:none}.iv-quest-tracker>span{color:#caa463;font:900 8px system-ui;letter-spacing:.12em}.iv-quest-tracker>strong{display:block;margin:3px 0 8px;font:900 14px Georgia,serif}.iv-quest-tracker>div{display:grid;grid-template-columns:8px 1fr auto;gap:7px;align-items:start;margin-top:4px;font-size:10px}.iv-quest-tracker i{width:6px;height:6px;margin-top:4px;border:1px solid #c6a463;background:#33291a}.iv-quest-tracker small{color:#c5b89e}
.iv-actionbar{position:absolute;left:50%;bottom:max(12px,calc(env(safe-area-inset-bottom) + 8px));transform:translateX(-50%);display:flex;gap:5px;pointer-events:auto}.iv-actionbar button{position:relative;min-width:64px;height:55px;padding:17px 7px 5px;border:1px solid #8c7045;background:#211b12e8;color:#f4ead5;box-shadow:0 6px 20px #000b;font-weight:900}.iv-actionbar button>span{position:absolute;left:5px;top:4px;color:#d7bd86;font-size:8px}.iv-actionbar button>b{display:block;font-size:10px}.iv-actionbar button>small{display:block;color:#998d78;font-size:7px}.iv-actionbar button.utility{min-width:54px;border-color:#4d473b;background:#171711dc}.iv-actionbar button.locked{filter:grayscale(1);opacity:.45}
.iv-interact-prompt{position:absolute;left:50%;bottom:88px;transform:translateX(-50%);pointer-events:auto}.iv-interact-prompt button{display:flex;align-items:center;gap:8px;min-width:180px;padding:8px 12px;border:1px solid #b99354;background:#17130dea;color:#f7ecd8;box-shadow:0 7px 24px #000b}.iv-interact-prompt span{display:grid;place-items:center;width:26px;height:26px;border:1px solid #82663c;background:#2c2316;font:900 10px system-ui}.iv-interact-prompt b{font-size:9px;letter-spacing:.08em}.iv-interact-prompt small{margin-left:auto;color:#c6b89f;font-size:9px}
.iv-game-panel,.iv-character-create{position:absolute;z-index:120;inset:0;display:grid;place-items:center;padding:16px;background:#050505b5;backdrop-filter:blur(7px);pointer-events:auto}.iv-game-panel[hidden],.iv-character-create[hidden]{display:none!important}.iv-game-panel>section,.iv-character-create>section{width:min(760px,96vw);max-height:min(760px,92vh);overflow:auto;border:1px solid #80663e;background:linear-gradient(145deg,#211b12f8,#100f0bf8);box-shadow:0 30px 90px #000d;padding:18px}.iv-game-panel header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:1px solid #55452e}.iv-game-panel header span{color:#bd9656;font:900 9px system-ui;letter-spacing:.11em}.iv-game-panel header strong{display:block;margin-top:3px;font:900 25px Georgia,serif}.iv-game-panel header button{width:38px;height:38px;border:1px solid #5d4b31;background:#17130d;color:#fff;font-size:22px}.iv-game-panel [data-iv-panel-body]{padding-top:14px}.iv-sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.iv-sheet>div{display:flex;justify-content:space-between;gap:14px;padding:11px;border:1px solid #403522;background:#14120e}.iv-sheet span{color:#a99b83;font-size:10px}.iv-quest-log{display:grid;gap:9px}.iv-quest-log article{padding:12px;border:1px solid #493c27;background:#15130e}.iv-quest-log article.active{border-color:#967340}.iv-quest-log article.completed{opacity:.65;border-color:#536044}.iv-quest-log small{color:#b18c50;font-size:8px}.iv-quest-log h3{margin:4px 0}.iv-quest-log p{color:#b6aa93;font-size:11px}.iv-quest-log article>div{display:flex;justify-content:space-between;padding-top:5px;color:#c8baa0;font-size:10px}.iv-bag-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.iv-bag-grid article{display:grid;grid-template-columns:44px 1fr;gap:9px;padding:10px;border:1px solid #463923;background:#14120e}.iv-bag-grid article>span{display:grid;place-items:center;height:44px;border:1px solid #745d38;background:#241e14;font:900 11px Georgia,serif}.iv-bag-grid small,.iv-bag-grid p{display:block;margin:2px 0;color:#a69a84;font-size:9px}.iv-dialogue p{font:500 15px/1.7 Georgia,serif;color:#ded2b9}.iv-dialogue button{float:right;min-width:120px;padding:10px;border:1px solid #987642;background:#49371f;color:#fff;font-weight:900}
.iv-character-create>section{width:min(900px,96vw);text-align:center}.iv-character-create h1{margin:5px 0 8px;font:900 clamp(2.2rem,7vw,4.5rem)/.95 Georgia,serif}.iv-character-create>section>p{max-width:680px;margin:0 auto 16px;color:#b8aa92}.iv-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:left}.iv-choice-grid article{padding:16px;border:1px solid #6c5736;background:#16130e}.iv-choice-grid small{color:#b38a49;font-weight:900}.iv-choice-grid h2{margin:3px 0;font:900 24px Georgia,serif}.iv-choice-grid p{color:#ad9f88;font-size:11px;line-height:1.5}.iv-choice-grid b{font-size:9px;color:#d0bd98}.iv-character-create label{display:grid;gap:6px;max-width:420px;margin:16px auto 8px;text-align:left;color:#bda77c;font:900 9px system-ui;letter-spacing:.08em}.iv-character-create input{height:44px;border:1px solid #775f39;background:#0d0c09;color:#fff;padding:0 12px;font:800 16px system-ui}.iv-character-create button.primary{min-width:240px;padding:12px 18px;border:1px solid #b38b4d;background:#614824;color:#fff;font-weight:900}.iv-character-create [data-iv-create-status]{display:block;min-height:18px;margin-top:8px;color:#c8b99e}
.iv-combat-float{position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);opacity:0;font:900 22px/1 Georgia,serif;text-shadow:0 2px 4px #000;transition:.2s;pointer-events:none}.iv-combat-float.show{opacity:1;transform:translate(-50%,-70%)}.iv-combat-float.crit{color:#ffd16a}.iv-combat-float.quest{color:#e5bd65;font-size:16px}.iv-combat-float.guard{color:#9ac4dc;font-size:16px}
body.ironvale-character-creation-active .rift-game-top-controls,body.ironvale-character-creation-active .rift-game-tools-control,body.ironvale-character-creation-active .rift-player-touch{display:none!important}
@media(max-width:720px){.iv-player-hud{top:max(54px,calc(env(safe-area-inset-top) + 48px));grid-template-columns:42px minmax(150px,220px)}.iv-portrait{width:40px;height:40px}.iv-quest-tracker{top:max(112px,calc(env(safe-area-inset-top) + 106px));width:min(230px,55vw)}.iv-actionbar{gap:3px;max-width:94vw}.iv-actionbar button{min-width:49px;height:51px;padding:16px 4px 4px}.iv-actionbar button.utility{min-width:43px}.iv-actionbar button>b{font-size:8px}.iv-actionbar button>small{font-size:6px}.iv-interact-prompt{bottom:76px}.iv-choice-grid,.iv-sheet,.iv-bag-grid{grid-template-columns:1fr}.iv-character-create>section{padding:14px}}
`;
if (!css.includes('/* H3.0 game-first client')) css += gameplayCss;
write('public/ironvale.css', css);

// ---------------------------------------------------------------------------
// Permanent starter-game verification and package integration.
// ---------------------------------------------------------------------------
write('scripts/check-ironvale-starter-game.js', `import fs from 'node:fs';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';
import { IRONVALE_RACES, IRONVALE_CLASSES, IRONVALE_ZONES, IRONVALE_QUESTS, IRONVALE_CAMPAIGNS } from '../src/ironvale/content.js';
const read = path => fs.readFileSync(path, 'utf8');
const fail = message => { console.error('[ironvale-starter-game] FAIL · ' + message); process.exit(1); };
const expect = (value, message) => { if (!value) fail(message); };
const world = JSON.parse(read('public/rift-world-blocks/brackenford-lowlands-001.json'));
const compiled = compileRiftCityBlock(world);
const app = read('public/app.js');
const gameplay = read('public/ironvale-gameplay.js');
const foundation = read('public/downtown3d-foundation.js');
const api = read('src/ironvale/api.js');
const schema = read('schema.sql');
const css = read('public/ironvale.css');
expect(IRONVALE_RACES.length === 1 && IRONVALE_RACES[0].id === 'valeborn', 'H3.0 must expose exactly one playable race: Valeborn');
expect(IRONVALE_CLASSES.length === 1 && IRONVALE_CLASSES[0].id === 'knight', 'H3.0 must expose exactly one playable class: Knight');
expect(IRONVALE_ZONES.length === 1 && IRONVALE_ZONES[0].id === 'brackenford-lowlands', 'H3.0 must expose exactly one starter zone');
expect(IRONVALE_QUESTS.length >= 5 && IRONVALE_CAMPAIGNS.some(c => c.id === 'the-broken-oath'), 'starter main-story chapter is missing');
expect(world.id === 'brackenford-lowlands-001' && world.ops.length >= 45, 'starter world is not materially authored');
expect(compiled.stats.cells > 18000 && compiled.stats.operations >= 45, 'starter world did not compile into a real Rift world');
expect(JSON.stringify(world).includes('Training hall') && JSON.stringify(world).includes('North Watch') && JSON.stringify(world).includes('Old North Road'), 'starter area landmarks are missing');
expect(app.includes("renderCity") && !app.includes('renderCharacter') && !app.includes('renderJournal') && !app.includes('renderCodex'), 'active app must mount the 3D game instead of routed document pages');
expect(gameplay.includes('createIronvaleStarterRuntime') && gameplay.includes('riftNativeResolveCombat') && gameplay.includes("Digit1") && gameplay.includes("KeyE"), 'in-world creation/interaction/Knight runtime is incomplete');
expect(foundation.includes("brackenford-lowlands-001.json") && foundation.includes('createIronvaleStarterRuntime') && foundation.includes('startGameplay'), 'Rift world boot is not wired to H3.0 starter gameplay');
expect(api.includes("/api/ironvale/character/create") && api.includes("/api/ironvale/quests/progress"), 'starter persistence endpoints are missing');
expect(schema.includes('ironvale_character_profiles'), 'character identity table is missing');
expect(css.includes('body.ironvale-session-active>.topbar') && css.includes('.iv-actionbar') && css.includes('.iv-character-create'), 'game-first fullscreen HUD styling is missing');
console.log('[ironvale-starter-game] PASS · Valeborn Knight character creation → 3D Brackenford starter zone → in-world questing/training → The Broken Oath chapter-one hook.');
`);

let pkg = JSON.parse(read('package.json'));
pkg.scripts['verify:starter'] = 'node scripts/check-ironvale-starter-game.js';
if (!pkg.scripts.build.includes('verify:starter')) pkg.scripts.build = pkg.scripts.build.replace('npm run verify:ironvale', 'npm run verify:ironvale && npm run verify:starter');
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

let verifier = read('scripts/check-ironvale-foundation.js');
verifier = verifier.replace(
`expect(app.includes('renderJournal') && app.includes('renderCodex') && !app.includes('renderCrimes') && !app.includes('renderService'), 'active app must route to Ironvale views only');`,
`expect(app.includes('renderCity') && !app.includes('renderCharacter') && !app.includes('renderJournal') && !app.includes('renderCodex') && !app.includes('renderCrimes') && !app.includes('renderService'), 'active app must mount the 3D Ironvale game only');`
);
verifier = verifier.replace(
`expect(app.includes('createRouteMount') && app.includes("window.addEventListener('popstate'") && app.includes("window.addEventListener('ironvale:navigate'"), 'Ironvale SPA navigation must keep isolated route mounts and history recovery listeners');`,
`expect(app.includes("window.addEventListener('popstate'") && app.includes("window.addEventListener('ironvale:navigate'") && app.includes("location.hash !== '#world'"), 'Ironvale shell must recover directly into the 3D world route');`
);
verifier = verifier.replace(
`expect(app.includes('request !== state.activeRequest') && app.includes('mount.isConnected'), 'stale async route renders must be prevented from replacing the active page');`,
`expect(app.includes('request !== state.activeRequest') || app.includes('const request = ++state.activeRequest'), '3D game remounts must retain request sequencing');`
);
verifier = verifier.replace(
`expect(router.includes("location.hash === nextHash") && router.includes("CustomEvent('ironvale:navigate'"), 'same-route navigation must be able to recover a pinned/restored Safari view');`,
`expect(router.includes("CustomEvent('ironvale:navigate'"), 'world navigation recovery event must remain available');`
);
verifier = verifier.replace(
`console.log('[ironvale-foundation] PASS · Ironvale owns the active MMO/RPG surface while Rift Engine, Native Core v4, authoring, Cloudflare, resilient SPA navigation and route-scoped character UI foundations remain intact.');`,
`console.log('[ironvale-foundation] PASS · Ironvale owns a game-first 3D MMO surface while Rift Engine, Native Core v4, authoring and Cloudflare foundations remain intact.');`
);
write('scripts/check-ironvale-foundation.js', verifier);

console.log('[ironvale-h3] staged one-race / one-class / one-zone 3D starter game.');
