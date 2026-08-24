// RiftCity V2 item registry.
// Item definitions live here as data/config. The core inventory engine remains generic.

export const ITEM_REGISTRY = Object.freeze([
  {
    id: 'first_aid_kit',
    name: 'First Aid Kit',
    category: 'medical',
    rarity: 'common',
    description: 'A compact medical kit stocked with basic supplies for treating injuries.',
    baseValue: 75,
    stackable: true,
    maxStack: 20,
    tradeable: true,
    usable: true,
    consumable: true,
    equipable: false,
    equipmentSlot: null,
    effects: { health: 25 },
    tags: ['MEDICAL', 'CONSUMABLE']
  },
  {
    id: 'knife',
    name: 'Knife',
    category: 'weapon',
    rarity: 'common',
    description: 'A basic close-range weapon. Simple, compact and easy to carry.',
    baseValue: 120,
    stackable: false,
    maxStack: 1,
    tradeable: true,
    usable: false,
    consumable: false,
    equipable: true,
    equipmentSlot: 'weapon',
    effects: {},
    tags: ['WEAPON', 'EQUIPMENT']
  },
  {
    id: 'energy_drink',
    name: 'Energy Drink',
    category: 'drink',
    rarity: 'common',
    description: 'A heavily caffeinated drink that gives a quick burst of energy.',
    baseValue: 18,
    stackable: true,
    maxStack: 20,
    tradeable: true,
    usable: true,
    consumable: true,
    equipable: false,
    equipmentSlot: null,
    effects: { energy: 20 },
    tags: ['DRINK', 'CONSUMABLE']
  },
  {
    id: 'candy_bar',
    name: 'Candy Bar',
    category: 'food',
    rarity: 'common',
    description: 'Cheap sugar and calories. Not glamorous, but it gives a small energy boost.',
    baseValue: 8,
    stackable: true,
    maxStack: 30,
    tradeable: true,
    usable: true,
    consumable: true,
    equipable: false,
    equipmentSlot: null,
    effects: { energy: 5 },
    tags: ['FOOD', 'CONSUMABLE']
  },
  {
    id: 'cheap_watch',
    name: 'Cheap Watch',
    category: 'valuable',
    rarity: 'common',
    description: 'A low-end wristwatch. It is worth a little cash to the right buyer.',
    baseValue: 60,
    stackable: true,
    maxStack: 20,
    tradeable: true,
    usable: false,
    consumable: false,
    equipable: false,
    equipmentSlot: null,
    effects: {},
    tags: ['VALUABLE', 'SELLABLE']
  },
  {
    id: 'screwdriver',
    name: 'Screwdriver',
    category: 'tool',
    rarity: 'common',
    description: 'A reusable hand tool that can become useful in certain jobs and crimes.',
    baseValue: 25,
    stackable: false,
    maxStack: 1,
    tradeable: true,
    usable: false,
    consumable: false,
    equipable: false,
    equipmentSlot: null,
    effects: {},
    tags: ['TOOL', 'REUSABLE']
  },
  {
    id: 'key',
    name: 'Key',
    category: 'key',
    rarity: 'uncommon',
    description: 'An unidentified access key. Its exact use will become clear when the right lock is found.',
    baseValue: 0,
    stackable: false,
    maxStack: 1,
    tradeable: false,
    usable: false,
    consumable: false,
    equipable: false,
    equipmentSlot: null,
    effects: {},
    tags: ['KEY', 'ACCESS']
  },
  {
    id: 'ticket',
    name: 'Ticket',
    category: 'ticket',
    rarity: 'uncommon',
    description: 'A single admission ticket reserved for a future city activity or venue.',
    baseValue: 20,
    stackable: true,
    maxStack: 10,
    tradeable: true,
    usable: false,
    consumable: false,
    equipable: false,
    equipmentSlot: null,
    effects: {},
    tags: ['TICKET', 'ACCESS']
  }
]);

const ITEM_LOOKUP = new Map(ITEM_REGISTRY.map(item => [item.id, item]));

export function getItemDefinition(itemId) {
  return ITEM_LOOKUP.get(itemId) || null;
}

export function toPublicItemDefinition(item) {
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    rarity: item.rarity,
    description: item.description,
    baseValue: item.baseValue,
    stackable: item.stackable,
    maxStack: item.maxStack,
    tradeable: item.tradeable,
    usable: item.usable,
    consumable: item.consumable,
    equipable: item.equipable,
    equipmentSlot: item.equipmentSlot,
    effects: { ...item.effects },
    tags: [...item.tags]
  };
}
