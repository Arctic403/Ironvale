export type BodyPart = "head" | "chest" | "stomach" | "arms" | "legs";

export interface WeaponOption {
  id: string;
  name: string;
  type: "primary" | "secondary" | "melee" | "temporary";
  baseDamage: number;
  accuracy: number;
  critChance: number;
  icon?: string;
}

export interface CombatStats {
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
}

export interface DynamicFighter {
  id: string;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  stats: CombatStats;
  weapons: WeaponOption[];
  cashReward?: number;
  xpReward?: number;
}

export interface TurnLog {
  id: string;
  attacker: string;
  defender: string;
  actionText: string;
  damage: number;
  isCrit: boolean;
  isMiss: boolean;
  hitPart?: BodyPart;
}

export const DEFAULT_WEAPONS: WeaponOption[] = [
  { id: "primary", name: "AK-47", type: "primary", baseDamage: 32, accuracy: 75, critChance: 18, icon: "🔫" },
  { id: "secondary", name: "9mm Pistol", type: "secondary", baseDamage: 22, accuracy: 85, critChance: 12, icon: "🔫" },
  { id: "melee", name: "Combat Knife", type: "melee", baseDamage: 18, accuracy: 92, critChance: 25, icon: "🔪" },
  { id: "temporary", name: "Pepper Spray", type: "temporary", baseDamage: 10, accuracy: 98, critChance: 5, icon: "🌶️" },
];

const BODY_PARTS: { part: BodyPart; multiplier: number; label: string }[] = [
  { part: "head", multiplier: 1.8, label: "Head" },
  { part: "chest", multiplier: 1.2, label: "Chest" },
  { part: "stomach", multiplier: 1.1, label: "Stomach" },
  { part: "arms", multiplier: 0.8, label: "Arm" },
  { part: "legs", multiplier: 0.9, label: "Leg" },
];

export function calculateWinChance(playerStats: CombatStats, opponentStats: CombatStats): number {
  const pSum = playerStats.strength + playerStats.defense + playerStats.speed + playerStats.dexterity;
  const oSum = opponentStats.strength + opponentStats.defense + opponentStats.speed + opponentStats.dexterity;
  const chance = (pSum / (pSum + oSum)) * 100;
  return Math.min(95, Math.max(5, Math.round(chance)));
}

export function executeCombatTurn(
  attacker: DynamicFighter,
  defender: DynamicFighter,
  weapon?: WeaponOption
): { updatedDefender: DynamicFighter; log: TurnLog } {
  // Use specified weapon or default to a random weapon from attacker inventory
  const activeWeapon =
    weapon ||
    (attacker.weapons && attacker.weapons.length > 0
      ? attacker.weapons[Math.floor(Math.random() * attacker.weapons.length)]
      : DEFAULT_WEAPONS[1]);

  const hitChance = Math.min(
    95,
    Math.max(15, activeWeapon.accuracy + (attacker.stats.dexterity - defender.stats.speed) * 2)
  );

  if (Math.random() * 100 > hitChance) {
    return {
      updatedDefender: defender,
      log: {
        id: Math.random().toString(),
        attacker: attacker.name,
        defender: defender.name,
        actionText: `${attacker.name} attacked with ${activeWeapon.name} but MISSED!`,
        damage: 0,
        isCrit: false,
        isMiss: true,
      },
    };
  }

  const target = BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)];
  const isCrit = Math.random() * 100 < activeWeapon.critChance;
  const critMultiplier = isCrit ? 1.75 : 1.0;

  const rawDamage =
    (activeWeapon.baseDamage + attacker.stats.strength * 1.2 - defender.stats.defense * 0.6) *
    target.multiplier *
    critMultiplier;

  const finalDamage = Math.max(4, Math.floor(rawDamage + (Math.random() * 6 - 3)));
  const newHealth = Math.max(0, defender.health - finalDamage);

  const actionText = `${attacker.name} hit ${defender.name} in the ${target.label} with ${activeWeapon.name} for ${finalDamage} damage!${
    isCrit ? " 🎯 CRITICAL HIT!" : ""
  }`;

  return {
    updatedDefender: {
      ...defender,
      health: newHealth,
    },
    log: {
      id: Math.random().toString(),
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
