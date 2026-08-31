export const IRONVALE_FOUNDATION_VERSION = 'ironvale-h3-starter-v1';
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
