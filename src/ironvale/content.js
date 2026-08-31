export const IRONVALE_FOUNDATION_VERSION = 'ironvale-foundation-v1';
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
