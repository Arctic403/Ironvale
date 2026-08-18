import {
  CombatStats,
} from "./progressionSystem";

export type Opponent = {
  id: string;
  name: string;
  level: number;
  health: number;
  stats: CombatStats;
  rewardCash: number;
  rewardXp: number;
};

export type CombatResult =
  | "victory"
  | "defeat";

export const OPPONENTS: Opponent[] = [
  {
    id: "street-thug",
    name: "Street Thug",
    level: 1,
    health: 60,
    stats: {
      strength: 4,
      defense: 3,
      speed: 3,
      dexterity: 3,
    },
    rewardCash: 100,
    rewardXp: 20,
  },
  {
    id: "gang-runner",
    name: "Gang Runner",
    level: 5,
    health: 90,
    stats: {
      strength: 7,
      defense: 6,
      speed: 6,
      dexterity: 5,
    },
    rewardCash: 300,
    rewardXp: 40,
  },
  {
    id: "enforcer",
    name: "Gang Enforcer",
    level: 10,
    health: 130,
    stats: {
      strength: 11,
      defense: 10,
      speed: 7,
      dexterity: 8,
    },
    rewardCash: 750,
    rewardXp: 70,
  },
  {
    id: "hitman",
    name: "Professional Hitman",
    level: 20,
    health: 180,
    stats: {
      strength: 18,
      defense: 14,
      speed: 16,
      dexterity: 18,
    },
    rewardCash: 2000,
    rewardXp: 120,
  },
];

export function calculateAttackPower(
  stats: CombatStats
): number {
  return (
    stats.strength * 2 +
    stats.speed
  );
}

export function calculateDefensePower(
  stats: CombatStats
): number {
  return (
    stats.defense * 2 +
    stats.dexterity
  );
}

export function calculateWinChance(
  player: CombatStats,
  opponent: CombatStats
): number {
  const playerPower =
    calculateAttackPower(
      player
    ) +
    calculateDefensePower(
      player
    );

  const opponentPower =
    calculateAttackPower(
      opponent
    ) +
    calculateDefensePower(
      opponent
    );

  return Math.max(
    10,
    Math.min(
      90,
      50 +
        (playerPower -
          opponentPower) *
          1.5
    )
  );
}

export function resolveCombat(
  player: CombatStats,
  opponent: CombatStats
): CombatResult {
  const chance =
    calculateWinChance(
      player,
      opponent
    );

  return Math.random() * 100 <
    chance
    ? "victory"
    : "defeat";
}
