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
  
  // Accuracy vs Dexterity / Speed calculation
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

  // Body part hit selection
  const target = BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)];
  const isCrit = Math.random() * 100 < weapon.critChance;
  const critMultiplier = isCrit ? 1.75 : 1.0;

  // Damage calculation based on Strength vs Defense
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
