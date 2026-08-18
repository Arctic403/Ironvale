import { CombatStats } from "./progressionSystem";
import { PLAYER_PROFILES, PlayerProfile } from "../data/playerProfiles";

// Re-export so App.tsx can import them directly from combatSystem.ts
export { PLAYER_PROFILES, PlayerProfile };

export type CombatDifficulty = "easy" | "fair" | "dangerous" | "very-dangerous";
export type Opponent = PlayerProfile;

export const PLAYER_OPPONENTS: Opponent[] = PLAYER_PROFILES;
export const OPPONENTS: Opponent[] = PLAYER_PROFILES;

export interface CombatResult {
  winner: "player" | "opponent";
  damageDealtToPlayer: number;
  damageDealtToOpponent: number;
  cashReward: number;
  xpReward: number;
  turns: number;
}

function power(s: CombatStats): number {
  return s.strength * 1.2 + s.defense + s.speed * 1.05 + s.dexterity * 1.1;
}

export function calculateAttackPower(s: CombatStats): number {
  return s.strength * 1.2 + s.speed * 0.25;
}

export function calculateDefensePower(s: CombatStats): number {
  return s.defense * 1.2 + s.dexterity * 0.2;
}

export function calculateCombatPower(s: CombatStats): number {
  return power(s);
}

export function calculateWinChance(a: CombatStats, b: CombatStats): number {
  const ap = power(a);
  const bp = power(b);
  const total = Math.max(1, ap + bp);
  const rawRate = 50 + ((ap - bp) / total) * 70;
  return Math.round(Math.max(5, Math.min(95, rawRate)));
}

export function getCombatDifficulty(a: CombatStats, b: CombatStats): CombatDifficulty {
  const c = calculateWinChance(a, b);
  return c >= 70 ? "easy" : c >= 50 ? "fair" : c >= 30 ? "dangerous" : "very-dangerous";
}

export function getCombatDifficultyLabel(d: CombatDifficulty): string {
  return d.replace("-", " ");
}

export function resolveCombat(player: CombatStats, opponent: CombatStats): "victory" | "defeat" {
  return Math.random() * 100 < calculateWinChance(player, opponent) ? "victory" : "defeat";
}

export function simulateCombat(
  playerName: string,
  playerStats: CombatStats,
  playerMaxHp: number,
  opponent: PlayerProfile
): CombatResult {
  const winChance = calculateWinChance(playerStats, opponent.stats);
  const isVictory = Math.random() * 100 < winChance;

  if (isVictory) {
    const damageTaken = Math.floor(Math.random() * (playerMaxHp * 0.35));
    return {
      winner: "player",
      damageDealtToPlayer: damageTaken,
      damageDealtToOpponent: opponent.maxHealth,
      cashReward: opponent.cashReward,
      xpReward: opponent.xpReward,
      turns: Math.floor(Math.random() * 3) + 2,
    };
  } else {
    return {
      winner: "opponent",
      damageDealtToPlayer: playerMaxHp,
      damageDealtToOpponent: Math.floor(Math.random() * (opponent.maxHealth * 0.5)),
      cashReward: 0,
      xpReward: 0,
      turns: Math.floor(Math.random() * 4) + 1,
    };
  }
}
