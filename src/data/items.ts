import type { Item } from "./dataTypes";

export const ITEMS: Item[] = [
  { id:"knife", name:"Street Knife", description:"A cheap weapon carried by people who expect trouble.", type:"weapon", price:250, effect:8, optimalRange:"Close", accuracy:85, moveCost:1, coverPenetration:.1, rarity:"Common", durability:70, sellValue:150 },
  { id:"bat", name:"Baseball Bat", description:"Simple, effective and easy to find.", type:"weapon", price:600, effect:15, optimalRange:"Close", accuracy:75, moveCost:1, coverPenetration:.2, rarity:"Common", durability:85, sellValue:360 },
  { id:"pistol", name:"9mm Pistol", description:"A basic firearm for serious situations.", type:"weapon", price:2500, effect:35, optimalRange:"Mid", accuracy:70, moveCost:2, coverPenetration:.4, rarity:"Rare", durability:80, sellValue:1600 },
  { id:"syndicate-blade", name:"Syndicate Blade", description:"A balanced black-market blade reserved for proven Syndicate members.", type:"weapon", price:0, effect:22, optimalRange:"Close", accuracy:90, moveCost:1, coverPenetration:.3, rarity:"Epic", durability:95, sellValue:2500 },
  { id:"jacket", name:"Reinforced Jacket", description:"Offers a little protection in a fight.", type:"armor", price:500, effect:5, rarity:"Common", durability:75, sellValue:300 },
  { id:"vest", name:"Tactical Vest", description:"A proper piece of protective equipment.", type:"armor", price:3000, effect:15, rarity:"Rare", durability:90, sellValue:1900 },
  { id:"guard-carrier", name:"Guard Plate Carrier", description:"Heavy Rift Guard armor built for dangerous patrol work.", type:"armor", price:0, effect:24, rarity:"Epic", durability:100, sellValue:3200 },
  { id:"medkit", name:"Small Medkit", description:"Restore 25 health.", type:"medical", price:300, effect:25, rarity:"Common", sellValue:180 },
  { id:"energy-drink", name:"Energy Drink", description:"Restore 25 Energy.", type:"energy", price:400, effect:25, rarity:"Common", sellValue:240 },
  { id:"nerve-tonic", name:"Nerve Tonic", description:"Restore 3 Nerve.", type:"nerve", price:700, effect:3, rarity:"Uncommon", sellValue:420 },
  { id:"union-tonic", name:"Union Reserve Tonic", description:"A Dock Union reserve blend that restores 8 Nerve.", type:"nerve", price:0, effect:8, rarity:"Epic", sellValue:1800 },
];

export function getItem(id:string){ return ITEMS.find(item=>item.id===id) ?? null; }
