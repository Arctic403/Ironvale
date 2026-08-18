export type CombatStats = {
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
};

export type LevelInfo = {
  level: number;
  currentXp: number;
  requiredXp: number;
};

export function getLevel(
  xp: number
): LevelInfo {
  const level =
    Math.floor(xp / 100) + 1;

  const currentXp =
    xp % 100;

  return {
    level,
    currentXp,
    requiredXp: 100,
  };
}

export function addXp(
  currentXp: number,
  amount: number
): number {
  return Math.max(
    0,
    currentXp + amount
  );
}

export function getNaturalNerveMax(
  crimeExperience: number
): number {
  const steps = Math.floor(
    crimeExperience / 100
  );

  return Math.min(
    60,
    10 + steps * 5
  );
}

export function getMaxHealth(
  propertyHealthBonus: number
): number {
  return 100 + propertyHealthBonus;
}

export function getEffectiveCombatStats(
  stats: CombatStats,
  educationBonus: number
): CombatStats {
  const multiplier =
    1 + educationBonus / 100;

  return {
    strength:
      stats.strength *
      multiplier,

    defense:
      stats.defense *
      multiplier,

    speed:
      stats.speed *
      multiplier,

    dexterity:
      stats.dexterity *
      multiplier,
  };
}
