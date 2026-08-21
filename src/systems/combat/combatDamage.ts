import type { DistanceZone } from "../../data/dataTypes";
import type { BodyPart, DynamicFighter, WeaponOption } from "./combatTypes";
import { weaponSkillLevel } from "./combatWeapons";

export const BODY_PARTS:{part:BodyPart;multiplier:number;label:string}[] = [
  {part:"head",multiplier:1.45,label:"Head"},{part:"chest",multiplier:1.12,label:"Chest"},{part:"stomach",multiplier:1.05,label:"Stomach"},{part:"arms",multiplier:.86,label:"Arm"},{part:"legs",multiplier:.9,label:"Leg"},
];
export const ZONE_DISTANCE_MAP:Record<DistanceZone,number>={Close:1,Mid:2,Long:3};

export function calculateAccuracy(attacker:DynamicFighter, defender:DynamicFighter, weapon:WeaponOption):number {
  const optimalZone=weapon.optimalZone ?? "Close";
  const defenderZone=defender.zone ?? optimalZone;
  const skill=weaponSkillLevel(attacker,weapon);
  // Skills matter over months of MMO progression, but never erase opponent stats.
  let accuracy=weapon.accuracy + (skill-1)*.48 + attacker.stats.dexterity*.72 - defender.stats.speed*.46;
  const delta=Math.abs(ZONE_DISTANCE_MAP[optimalZone]-ZONE_DISTANCE_MAP[defenderZone]);
  accuracy -= delta * (weapon.weaponClass === "unarmed" ? 23 : 17);
  if(defender.inCover) accuracy -= 18*(1-(weapon.coverPenetration ?? 0));
  return accuracy;
}
export function calculateHitChance(accuracy:number):number { return Math.min(92,Math.max(8,accuracy)); }
export function randomBodyPart(){ const roll=Math.random(); if(roll<.10)return BODY_PARTS[0]; if(roll<.50)return BODY_PARTS[1]; if(roll<.68)return BODY_PARTS[2]; if(roll<.84)return BODY_PARTS[3]; return BODY_PARTS[4]; }
export function rollCritical(weapon:WeaponOption, attacker?:DynamicFighter):boolean { const skill=attacker?weaponSkillLevel(attacker,weapon):1; return Math.random()*100 < Math.min(22,weapon.critChance+(skill-1)*.035); }
export function calculateDamage(attacker:DynamicFighter, defender:DynamicFighter, weapon:WeaponOption, target:{multiplier:number}, isCrit:boolean):number {
  const skill=weaponSkillLevel(attacker,weapon);
  const physical=["unarmed","blade","blunt"].includes(weapon.weaponClass);
  const statPower=physical ? attacker.stats.strength*.48 : attacker.stats.dexterity*.18;
  const armorProtection=Math.max(0, defender.armorProtection ?? 0);
  const mitigation=defender.stats.defense*(physical ? .32 : .24) + armorProtection*(physical ? .28 : .38);
  let raw=(weapon.baseDamage+statPower-mitigation)*target.multiplier*(isCrit?1.5:1);
  raw*=1+Math.min(.28,(skill-1)*.003);
  const optimal=weapon.optimalZone??"Close"; const defenderZone=defender.zone??optimal;
  raw*=optimal===defenderZone?1.08:.9;
  if(defender.inCover) raw*=.62+(weapon.coverPenetration??0)*.25;
  const variance=.88+Math.random()*.24;
  return Math.max(1,Math.floor(raw*variance));
}
