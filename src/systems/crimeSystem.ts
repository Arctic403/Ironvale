export type CrimeOutcome =
  | "success"
  | "failed"
  | "spooked"
  | "jailed";

export type Crime = {
  id: string;
  name: string;
  description: string;

  levelRequired: number;

  /*
   * Crimes consume Nerve.
   *
   * There is intentionally NO cooldownMinutes
   * or cooldownUntil property.
   */
  nerve: number;

  difficulty: number;

  minReward: number;
  maxReward: number;

  xp: number;

  crimeExperience: number;

  risk: number;
};

export type CrimeStats = {
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
};

export const CRIMES: Crime[] = [
  {
    id: "pickpocket",
    name: "Pickpocket",
    description:
      "Lift something from an unsuspecting target without drawing attention.",

    levelRequired: 1,

    nerve: 2,

    difficulty: 10,

    minReward: 25,
    maxReward: 75,

    xp: 8,

    crimeExperience: 5,

    risk: 5,
  },

  {
    id: "shoplift",
    name: "Shoplift",
    description:
      "Slip into a store and walk out with something valuable.",

    levelRequired: 1,

    nerve: 3,

    difficulty: 18,

    minReward: 50,
    maxReward: 140,

    xp: 12,

    crimeExperience: 8,

    risk: 8,
  },

  {
    id: "mugging",
    name: "Mugging",
    description:
      "Find an easy target and take their cash by force.",

    levelRequired: 2,

    nerve: 4,

    difficulty: 26,

    minReward: 90,
    maxReward: 220,

    xp: 16,

    crimeExperience: 11,

    risk: 12,
  },

  {
    id: "burglary",
    name: "Burglary",
    description:
      "Break into a property and search it for valuables.",

    levelRequired: 3,

    nerve: 5,

    difficulty: 34,

    minReward: 150,
    maxReward: 400,

    xp: 22,

    crimeExperience: 15,

    risk: 16,
  },

  {
    id: "car_theft",
    name: "Car Theft",
    description:
      "Steal a parked vehicle before anyone realizes what happened.",

    levelRequired: 4,

    nerve: 6,

    difficulty: 42,

    minReward: 250,
    maxReward: 650,

    xp: 30,

    crimeExperience: 20,

    risk: 21,
  },

  {
    id: "armed_robbery",
    name: "Armed Robbery",
    description:
      "Hit a high-value target and get out before the police arrive.",

    levelRequired: 6,

    nerve: 8,

    difficulty: 52,

    minReward: 500,
    maxReward: 1200,

    xp: 42,

    crimeExperience: 28,

    risk: 28,
  },

  {
    id: "bank_job",
    name: "Bank Job",
    description:
      "Plan and execute a dangerous robbery against a major financial target.",

    levelRequired: 9,

    nerve: 10,

    difficulty: 64,

    minReward: 1000,
    maxReward: 3000,

    xp: 60,

    crimeExperience: 40,

    risk: 36,
  },

  {
    id: "major_heist",
    name: "Major Heist",
    description:
      "Attempt one of the biggest scores available in RiftCity.",

    levelRequired: 13,

    nerve: 12,

    difficulty: 76,

    minReward: 2500,
    maxReward: 7500,

    xp: 85,

    crimeExperience: 55,

    risk: 45,
  },
];

export function crimeUnlocked(
  crime: Crime,
  playerLevel: number
): boolean {
  return (
    playerLevel >=
    crime.levelRequired
  );
}

export function getCrimeStatBonus(
  stats: CrimeStats
): number {
  /*
   * Strength / Speed / Dexterity help
   * without becoming more important than
   * Crime Experience.
   */
  const average =
    (
      stats.strength +
      stats.speed +
      stats.dexterity
    ) / 3;

  return Math.min(
    20,
    Math.max(
      0,
      average - 1
    ) * 1.5
  );
}

export function crimeSuccessChance(
  crime: Crime,
  crimeExperience: number,
  intelligence: number = 1,
  statBonus: number = 0
): number {
  const experienceBonus =
    Math.min(
      25,
      crimeExperience / 20
    );

  const intelligenceBonus =
    Math.min(
      15,
      Math.max(
        0,
        intelligence - 1
      ) * 2
    );

  const chance =
    78 -
    crime.difficulty +
    experienceBonus +
    intelligenceBonus +
    statBonus;

  return Math.min(
    92,
    Math.max(
      8,
      chance
    )
  );
}

export function randomReward(
  crime: Crime
): number {
  const range =
    crime.maxReward -
    crime.minReward;

  return Math.floor(
    crime.minReward +
      Math.random() *
        (range + 1)
  );
}

export function rollCrimeOutcome(
  crime: Crime,
  successChance: number
): CrimeOutcome {
  const roll =
    Math.random() * 100;

  if (
    roll <
    successChance
  ) {
    return "success";
  }

  const remaining =
    100 -
    successChance;

  const normalized =
    remaining <= 0
      ? 0
      : (
          roll -
          successChance
        ) /
        remaining;

  /*
   * Jail probability increases with risk.
   */
  const jailChance =
    Math.min(
      0.45,
      crime.risk / 100
    );

  /*
   * Spooked is more common than jail.
   */
  const spookedChance =
    Math.min(
      0.35,
      0.15 +
        crime.risk / 180
    );

  if (
    normalized <
    jailChance
  ) {
    return "jailed";
  }

  if (
    normalized <
    jailChance +
      spookedChance
  ) {
    return "spooked";
  }

  return "failed";
}
