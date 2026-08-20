import type { Item } from "./dataTypes";

export const ITEMS: Item[] = [
  { id:"knife", name:"Street Knife", description:"A cheap close-range weapon from a licensed city outfitter.", type:"weapon", price:250, effect:8, optimalRange:"Close", accuracy:85, moveCost:1, coverPenetration:.1, rarity:"Common", durability:70, sellValue:150, store:"shop" },
  { id:"bat", name:"Composite Bat", description:"A sturdy impact weapon sold for sport and personal defense.", type:"weapon", price:600, effect:15, optimalRange:"Close", accuracy:75, moveCost:1, coverPenetration:.2, rarity:"Common", durability:85, sellValue:360, store:"shop" },
  { id:"pistol", name:"9mm Pistol", description:"A standard sidearm sold through the regulated RiftCity weapon counter.", type:"weapon", price:2500, effect:35, optimalRange:"Mid", accuracy:70, moveCost:2, coverPenetration:.4, rarity:"Rare", durability:80, sellValue:1600, store:"shop" },
  { id:"jacket", name:"Reinforced Jacket", description:"Light protection for rough parts of the city.", type:"armor", price:500, effect:5, rarity:"Common", durability:75, sellValue:300, store:"shop" },
  { id:"vest", name:"Tactical Vest", description:"A heavier protective vest from the city outfitter.", type:"armor", price:3000, effect:15, rarity:"Rare", durability:90, sellValue:1900, store:"shop" },

  { id:"medkit", name:"Small Medkit", description:"Restore 25 health.", type:"medical", price:300, effect:25, rarity:"Common", sellValue:180, store:"pharmacy" },
  { id:"energy-drink", name:"Volt Energy", description:"Restore 25 Energy.", type:"energy", price:400, effect:25, rarity:"Common", sellValue:240, store:"pharmacy" },
  { id:"nerve-tonic", name:"Focus Tonic", description:"Restore 3 Nerve.", type:"nerve", price:700, effect:3, rarity:"Uncommon", sellValue:420, store:"pharmacy" },
  { id:"sugar-rush", name:"Rift Pops", description:"Bright candy that restores a little Energy and Happiness.", type:"misc", price:90, rarity:"Common", sellValue:45, store:"shop", specialEffect:"+6 Energy, +3 Happiness" },
  { id:"moon-chews", name:"Moon Chews", description:"A rare imported candy with a surprisingly strong mood boost.", type:"misc", price:450, rarity:"Uncommon", sellValue:260, store:"shop", specialEffect:"+12 Happiness, small chance of +1 Nerve" },

  { id:"syndicate-blade", name:"Syndicate Blade", description:"A balanced underground blade reserved for proven Syndicate members.", type:"weapon", price:0, effect:22, optimalRange:"Close", accuracy:90, moveCost:1, coverPenetration:.3, rarity:"Epic", durability:95, sellValue:2500, store:"reward" },
  { id:"guard-carrier", name:"Guard Plate Carrier", description:"Heavy Rift Guard armor built for dangerous patrol work.", type:"armor", price:0, effect:24, rarity:"Epic", durability:100, sellValue:3200, store:"reward" },
  { id:"union-tonic", name:"Union Reserve Tonic", description:"A Dock Union reserve blend that restores 8 Nerve.", type:"nerve", price:0, effect:8, rarity:"Epic", sellValue:1800, store:"reward" },

  { id:"neon-dust", name:"Neon Dust", description:"Fictional RiftCity contraband. A risky stimulant with a sharp short-term payoff and extra police attention.", type:"misc", price:0, rarity:"Rare", sellValue:1300, store:"blackmarket", contraband:true, dropChance:0.035, specialEffect:"+18 Energy, +2 Nerve, +8 Heat" },
  { id:"rift-tabs", name:"Rift Tabs", description:"Fictional contraband tablets traded through underground listings.", type:"misc", price:0, rarity:"Rare", sellValue:1650, store:"blackmarket", contraband:true, dropChance:0.022, specialEffect:"Random boost: XP, Nerve, or Happiness; +5 Heat" },
  { id:"ghost-serum", name:"Ghost Serum", description:"Extremely rare fictional contraband with an unpredictable game effect.", type:"misc", price:0, rarity:"Legendary", sellValue:8500, store:"blackmarket", contraband:true, dropChance:0.003, specialEffect:"Rare randomized outcome; always increases Heat" },

  { id:"encrypted-chip", name:"Encrypted Rift Chip", description:"A tiny data chip sought by collectors and faction brokers.", type:"misc", price:0, rarity:"Rare", sellValue:2200, store:"loot", dropChance:0.018, specialEffect:"High-value collectible; future mission material" },
  { id:"old-city-token", name:"Old City Transit Token", description:"A discontinued token from before RiftCity's reconstruction.", type:"misc", price:0, rarity:"Epic", sellValue:5000, store:"loot", dropChance:0.007, specialEffect:"Rare collectible" },
  { id:"prototype-key", name:"Prototype Vault Key", description:"A one-off experimental access key with almost no legitimate market supply.", type:"misc", price:0, rarity:"Legendary", sellValue:18000, store:"loot", dropChance:0.0015, specialEffect:"Ultra-rare collectible with special crime outcomes" },
  { id:"black-envelope", name:"Black Envelope", description:"A sealed envelope that can contain money, intel, or nothing at all.", type:"misc", price:0, rarity:"Uncommon", sellValue:350, store:"loot", dropChance:0.06, specialEffect:"Open for a random cash/intel outcome" },
];

export function getItem(id:string){ return ITEMS.find(item=>item.id===id) ?? null; }
