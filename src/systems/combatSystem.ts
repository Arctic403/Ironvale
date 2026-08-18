import { CombatStats } from "./progressionSystem";
import { PLAYER_PROFILES, PlayerProfile } from "../data/playerProfiles";

export type CombatDifficulty = "easy"|"fair"|"dangerous"|"very-dangerous";
export type Opponent = PlayerProfile;

// Compatibility alias: the combat screen now uses player profiles rather than anonymous NPC archetypes.
export const PLAYER_OPPONENTS: Opponent[] = PLAYER_PROFILES;
export const OPPONENTS = PLAYER_PROFILES;

function power(s:CombatStats){return s.strength*1.2+s.defense+s.speed*1.05+s.dexterity*1.1}
export function calculateAttackPower(s:CombatStats){return s.strength*1.2+s.speed*.25}
export function calculateDefensePower(s:CombatStats){return s.defense*1.2+s.dexterity*.2}
export function calculateCombatPower(s:CombatStats){return power(s)}
export function calculateWinChance(a:CombatStats,b:CombatStats){
  const ap=power(a),bp=power(b);
  return Math.max(5,Math.min(95,50+(ap-bp)/(Math.max(1,ap+bp))*70));
}
export function getCombatDifficulty(a:CombatStats,b:CombatStats):CombatDifficulty{
  const c=calculateWinChance(a,b);
  return c>=70?"easy":c>=50?"fair":c>=30?"dangerous":"very-dangerous";
}
export function getCombatDifficultyLabel(d:CombatDifficulty){return d.replace("-"," ")}
export function resolveCombat(player:CombatStats,opponent:CombatStats){
  return Math.random()*100<calculateWinChance(player,opponent) ? "victory" : "defeat";
}
