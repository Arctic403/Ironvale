import { CombatStats } from "./progressionSystem";
export type CombatDifficulty="easy"|"fair"|"dangerous"|"very-dangerous";
export type Opponent={id:string;name:string;description:string;health:number;stats:CombatStats;rewardCash:number;rewardXp:number};
export const OPPONENTS:Opponent[]=[
{id:"street-rival",name:"Street Rival",description:"A local troublemaker looking for an easy win.",health:75,stats:{strength:7,defense:5,speed:6,dexterity:5},rewardCash:100,rewardXp:15},
{id:"dock-thief",name:"Dock Thief",description:"A quick-handed criminal who knows the alleys.",health:90,stats:{strength:9,defense:7,speed:10,dexterity:9},rewardCash:160,rewardXp:20},
{id:"brawler",name:"Neighborhood Brawler",description:"Experienced, stubborn and unpleasantly enthusiastic.",health:105,stats:{strength:13,defense:11,speed:9,dexterity:10},rewardCash:240,rewardXp:28},
{id:"enforcer",name:"Local Enforcer",description:"A professional problem for an amateur fighter.",health:125,stats:{strength:19,defense:17,speed:15,dexterity:17},rewardCash:400,rewardXp:38},
{id:"veteran",name:"Street Veteran",description:"A seasoned fighter who has seen almost every trick.",health:145,stats:{strength:27,defense:24,speed:23,dexterity:25},rewardCash:650,rewardXp:50},
{id:"champion",name:"District Champion",description:"The kind of opponent you should not challenge casually.",health:180,stats:{strength:38,defense:34,speed:31,dexterity:36},rewardCash:1200,rewardXp:75},
];
function power(s:CombatStats){return s.strength*1.2+s.defense+s.speed*1.05+s.dexterity*1.1}
export function calculateAttackPower(s:CombatStats){return s.strength*1.2+s.speed*.25}
export function calculateDefensePower(s:CombatStats){return s.defense*1.2+s.dexterity*.2}
export function calculateCombatPower(s:CombatStats){return power(s)}
export function calculateWinChance(a:CombatStats,b:CombatStats){const ap=power(a),bp=power(b);return Math.max(5,Math.min(95,50+(ap-bp)/(Math.max(1,ap+bp))*70))}
export function getCombatDifficulty(a:CombatStats,b:CombatStats):CombatDifficulty{const c=calculateWinChance(a,b);return c>=70?"easy":c>=50?"fair":c>=30?"dangerous":"very-dangerous"}
export function getCombatDifficultyLabel(d:CombatDifficulty){return d.replace("-"," ")}
export function resolveCombat(player:CombatStats,opponent:CombatStats){return Math.random()*100<calculateWinChance(player,opponent) ? "victory" : "defeat";}
