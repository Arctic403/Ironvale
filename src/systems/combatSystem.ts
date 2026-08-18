export type BodyPart = "head" | "chest" | "stomach" | "arms" | "legs";

export interface WeaponOption {
  id: string;
  name: string;
  type: "primary" | "secondary" | "melee" | "temporary";
  baseDamage: number;
  accuracy: number; // 0 - 100
  critChance: number; // 0 - 100
}

export interface DynamicFighter {
  id: string;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
  weapon: WeaponOption;
}

export interface TurnLog {
  attacker: string;
  defender: string;
  actionText: string;
  damage: number;
  isCrit: boolean;
  isMiss: boolean;
  hitPart?: BodyPart;
}

// --- Legacy Exports for App.tsx Compatibility ---

export interface CombatStats {
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  level: number;
  status: string;
  title: string;
  location: string;
  health: number;
  maxHealth: number;
  cashReward: number;
  stats: CombatStats;
}

export const PLAYER_PROFILES: PlayerProfile[] = [
  {
    id: "target-1",
    name: "Street Thug",
    level: 1,
    status: "Idle",
    title: "Local Brawler",
    location: "city-center",
    health: 80,
    maxHealth: 80,
    cashReward: 150,
    stats: { strength: 4, defense: 3, speed: 4, dexterity: 4 },
  },
  {
    id: "target-2",
    name: "Alley Enforcer",
    level: 3,
    status: "Patrolling",
    title: "Mercenary",
    location: "industrial",
    health: 120,
    maxHealth: 120,
    cashReward: 400,
    stats: { strength: 8, defense: 7, speed: 6, dexterity: 6 },
  },
  {
    id: "target-3",
    name: "Dock Boss",
    level: 5,
    status: "Guarded",
    title: "Smuggler Leader",
    location: "docks",
    health: 200,
    maxHealth: 200,
    cashReward: 1000,
    stats: { strength: 15, defense: 14, speed: 12, dexterity: 10 },
  },
];

export function calculateWinChance(playerStats: CombatStats, opponentStats: CombatStats): number {
  const pSum = playerStats.strength + playerStats.defense + playerStats.speed + playerStats.dexterity;
  const oSum = opponentStats.strength + opponentStats.defense + opponentStats.speed + opponentStats.dexterity;
  const chance = (pSum / (pSum + oSum)) * 100;
  return Math.min(95, Math.max(5, Math.round(chance)));
}

export function simulateCombat(
  playerName: string,
  playerStats: CombatStats,
  playerMaxHealth: number,
  opponent: PlayerProfile
) {
  const winChance = calculateWinChance(playerStats, opponent.stats);
  const isWin = Math.random() * 100 < winChance;

  if (isWin) {
    const damageDealtToPlayer = Math.floor(Math.random() * (playerMaxHealth * 0.3));
    return {
      winner: "player" as const,
      cashReward: opponent.cashReward,
      xpReward: opponent.level * 20,
      damageDealtToPlayer,
    };
  }

  return {
    winner: "opponent" as const,
    cashReward: 0,
    xpReward: 0,
    damageDealtToPlayer: playerMaxHealth,
  };
}

// --- Dynamic Interactive Turn-Based Combat ---

const BODY_PARTS: { part: BodyPart; multiplier: number; label: string }[] = [
  { part: "head", multiplier: 1.8, label: "Head" },
  { part: "chest", multiplier: 1.2, label: "Chest" },
  { part: "stomach", multiplier: 1.1, label: "Stomach" },
  { part: "arms", multiplier: 0.8, label: "Arm" },
  { part: "legs", multiplier: 0.9, label: "Leg" },
];

export function executeCombatTurn(
  attacker: DynamicFighter,
  defender: DynamicFighter,
  selectedWeapon?: WeaponOption
): { updatedDefender: DynamicFighter; log: TurnLog } {
  const weapon = selectedWeapon || attacker.weapon;

  const hitChance = Math.min(
    95,
    Math.max(15, weapon.accuracy + (attacker.dexterity - defender.speed) * 2)
  );
  const roll = Math.random() * 100;

  if (roll > hitChance) {
    return {
      updatedDefender: defender,
      log: {
        attacker: attacker.name,
        defender: defender.name,
        actionText: `${attacker.name} attacked ${defender.name} with ${weapon.name} but missed!`,
        damage: 0,
        isCrit: false,
        isMiss: true,
      },
    };
  }

  const target = BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)];
  const isCrit = Math.random() * 100 < weapon.critChance;
  const critMultiplier = isCrit ? 1.75 : 1.0;

  const rawDamage =
    (weapon.baseDamage + attacker.strength * 1.5 - defender.defense * 0.8) *
    target.multiplier *
    critMultiplier;

  const finalDamage = Math.max(5, Math.floor(rawDamage + (Math.random() * 6 - 3)));
  const newHealth = Math.max(0, defender.health - finalDamage);

  const actionText = `${attacker.name} hit ${defender.name} in the ${target.label} with ${weapon.name} for ${finalDamage} damage! ${
    isCrit ? "🎯 CRITICAL HIT!" : ""
  }`;

  return {
    updatedDefender: { ...defender, health: newHealth },
    log: {
      attacker: attacker.name,
      defender: defender.name,
      actionText,
      damage: finalDamage,
      isCrit,
      isMiss: false,
      hitPart: target.part,
    },
  };
}
