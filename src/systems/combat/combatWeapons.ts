import type { DynamicFighter, WeaponClass, WeaponOption } from "./combatTypes";

export const UNARMED_WEAPON: WeaponOption = {
  id: "unarmed", name: "Unarmed", type: "melee", weaponClass: "unarmed",
  baseDamage: 6, accuracy: 52, critChance: 4, icon: "👊", optimalZone: "Close", coverPenetration: 0,
};

/**
 * Combat catalog. Accuracy values are intentionally conservative: an item is
 * not an 80-90% hit button by itself. Character stats, weapon skill, range,
 * cover and the opponent all participate in the final chance.
 */
export const DEFAULT_WEAPONS: WeaponOption[] = [
  UNARMED_WEAPON,
  { id:"knife", name:"Street Knife", type:"melee", weaponClass:"blade", baseDamage:9, accuracy:45, critChance:7, icon:"🔪", optimalZone:"Close", coverPenetration:.05 },
  { id:"bat", name:"Composite Bat", type:"melee", weaponClass:"blunt", baseDamage:13, accuracy:42, critChance:6, icon:"🏏", optimalZone:"Close", coverPenetration:.12 },
  { id:"crowbar", name:"Heavy Crowbar", type:"melee", weaponClass:"blunt", baseDamage:16, accuracy:36, critChance:7, icon:"🔧", optimalZone:"Close", coverPenetration:.16 },
  { id:"machete", name:"Machete", type:"melee", weaponClass:"blade", baseDamage:18, accuracy:37, critChance:9, icon:"🗡️", optimalZone:"Close", coverPenetration:.12 },
  { id:"pistol", name:"9mm Pistol", type:"secondary", weaponClass:"handgun", baseDamage:22, accuracy:38, critChance:7, icon:"🔫", optimalZone:"Mid", coverPenetration:.32 },
  { id:"heavy-pistol", name:"Heavy Pistol", type:"secondary", weaponClass:"handgun", baseDamage:29, accuracy:31, critChance:10, icon:"🔫", optimalZone:"Mid", coverPenetration:.42 },
  { id:"machine-pistol", name:"Machine Pistol", type:"secondary", weaponClass:"smg", baseDamage:24, accuracy:33, critChance:6, icon:"🔫", optimalZone:"Close", coverPenetration:.34 },
  { id:"smg", name:"Compact SMG", type:"primary", weaponClass:"smg", baseDamage:27, accuracy:35, critChance:7, icon:"🔫", optimalZone:"Mid", coverPenetration:.38 },
  { id:"shotgun", name:"Pump Shotgun", type:"primary", weaponClass:"shotgun", baseDamage:40, accuracy:29, critChance:9, icon:"💥", optimalZone:"Close", coverPenetration:.48 },
  { id:"carbine", name:"Street Carbine", type:"primary", weaponClass:"rifle", baseDamage:33, accuracy:34, critChance:9, icon:"🎯", optimalZone:"Mid", coverPenetration:.52 },
  { id:"rifle", name:"Rift Rifle", type:"primary", weaponClass:"rifle", baseDamage:38, accuracy:31, critChance:11, icon:"🎯", optimalZone:"Long", coverPenetration:.62 },
  { id:"syndicate-blade", name:"Syndicate Blade", type:"melee", weaponClass:"blade", baseDamage:24, accuracy:43, critChance:12, icon:"🗡️", optimalZone:"Close", coverPenetration:.2 },
];

export const WEAPON_SKILL_LABELS: Record<WeaponClass,string> = {
  unarmed:"Unarmed", blade:"Blades", blunt:"Blunt", handgun:"Handguns", smg:"SMGs", shotgun:"Shotguns", rifle:"Rifles",
};

export function getWeaponById(id:string): WeaponOption | null { return DEFAULT_WEAPONS.find(w=>w.id===id) ?? null; }
export function ownsWeapon(fighter:DynamicFighter, weaponId:string):boolean { return weaponId === "unarmed" || (fighter.weapons?.some(w=>w.id===weaponId) ?? false); }
export function getOwnedWeapon(fighter:DynamicFighter, weaponId:string):WeaponOption|null { if(weaponId==="unarmed") return UNARMED_WEAPON; return fighter.weapons?.find(w=>w.id===weaponId) ?? null; }
export function resolveEquippedWeapon(fighter:DynamicFighter):WeaponOption { return fighter.equippedWeaponId ? (getOwnedWeapon(fighter,fighter.equippedWeaponId) ?? UNARMED_WEAPON) : UNARMED_WEAPON; }
export function resolveAttackWeapon(fighter:DynamicFighter, requestedWeapon?:WeaponOption):WeaponOption { if(!requestedWeapon) return resolveEquippedWeapon(fighter); return requestedWeapon.id === "unarmed" ? UNARMED_WEAPON : (getOwnedWeapon(fighter,requestedWeapon.id) ?? UNARMED_WEAPON); }

export function getWeaponSkillLevelFromXp(xp:number):number {
  const safe=Math.max(0,Number(xp)||0);
  return Math.min(100, 1 + Math.floor(Math.sqrt(safe / 12)));
}
export function getWeaponSkillXpForNextLevel(level:number):number {
  const next=Math.min(100,Math.max(2,Math.floor(level)+1));
  return Math.ceil(Math.pow(next-1,2)*12);
}
export function weaponSkillLevel(fighter:DynamicFighter, weapon:WeaponOption):number {
  return Math.max(1, Math.min(100, fighter.weaponSkills?.[weapon.weaponClass] ?? 1));
}
