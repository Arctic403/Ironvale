// RiftCity item plugins.
// Item definitions are data/config. The core inventory engine remains generic.
// Add or tune items here without changing inventory persistence/action code.

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
    combat: { weaponId: 'knife' },
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
  },
  {id:'bat',name:'Composite Bat',category:'weapon',rarity:'common',description:'A reinforced blunt weapon.',baseValue:180,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'bat'},tags:['WEAPON','EQUIPMENT']},
  {id:'crowbar',name:'Heavy Crowbar',category:'weapon',rarity:'common',description:'A heavy improvised weapon.',baseValue:210,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'crowbar'},tags:['WEAPON','EQUIPMENT']},
  {id:'machete',name:'Machete',category:'weapon',rarity:'uncommon',description:'A heavier blade with strong close-range damage.',baseValue:360,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'machete'},tags:['WEAPON','EQUIPMENT']},
  {id:'pistol',name:'9mm Pistol',category:'weapon',rarity:'uncommon',description:'A compact handgun.',baseValue:700,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'pistol'},tags:['WEAPON','EQUIPMENT']},
  {id:'heavy-pistol',name:'Heavy Pistol',category:'weapon',rarity:'rare',description:'A high-damage handgun with slower handling.',baseValue:1200,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'heavy-pistol'},tags:['WEAPON','EQUIPMENT']},
  {id:'machine-pistol',name:'Machine Pistol',category:'weapon',rarity:'rare',description:'A compact automatic sidearm.',baseValue:1450,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'machine-pistol'},tags:['WEAPON','EQUIPMENT']},
  {id:'smg',name:'Compact SMG',category:'weapon',rarity:'rare',description:'A compact automatic primary weapon.',baseValue:1900,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'smg'},tags:['WEAPON','EQUIPMENT']},
  {id:'shotgun',name:'Pump Shotgun',category:'weapon',rarity:'rare',description:'A close-range primary weapon.',baseValue:2200,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'shotgun'},tags:['WEAPON','EQUIPMENT']},
  {id:'carbine',name:'Street Carbine',category:'weapon',rarity:'epic',description:'A balanced mid-range rifle.',baseValue:3100,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'carbine'},tags:['WEAPON','EQUIPMENT']},
  {id:'rifle',name:'Rift Rifle',category:'weapon',rarity:'epic',description:'A powerful long-range rifle.',baseValue:3900,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'rifle'},tags:['WEAPON','EQUIPMENT']},
  {id:'syndicate-blade',name:'Syndicate Blade',category:'weapon',rarity:'epic',description:'A specialized high-skill blade.',baseValue:2800,stackable:false,maxStack:1,tradeable:true,usable:false,consumable:false,equipable:true,equipmentSlot:'weapon',effects:{},combat:{weaponId:'syndicate-blade'},tags:['WEAPON','EQUIPMENT']}

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
    combat: item.combat ? { ...item.combat } : null,
    tags: [...item.tags]
  };
}
