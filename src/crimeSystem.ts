import {
  CombatStats,
} from "./progressionSystem";

export type CrimeOutcome =
  | "success"
  | "failed"
  | "spooked"
  | "jailed";

export type Crime = {
  id: string;
  name: string;
  description: string;
  nerve: number;
  minReward: number;
  maxReward: number;
  xp: number;
  crimeExperience: number;
  levelRequired: number;
  risk: number;
  baseSuccess: number;
};

export const CRIMES: Crime[] = [
  {
    id: "pickpocket",
    name: "Pickpocket",
    description:
      "Lift something from an unsuspecting target.",
    nerve: 1,
    minReward: 20,
    maxReward: 65,
    xp: 7,
    crimeExperience: 12,
    levelRequired: 1,
    risk: 10,
    baseSuccess: 72,
  },
  {
    id: "shoplift",
    name: "Shoplifting",
    description:
      "Walk out of a small store with something valuable.",
    nerve: 2,
    minReward: 45,
    maxReward: 140,
    xp: 12,
    crimeExperience: 18,
    levelRequired: 2,
    risk: 20,
    baseSuccess: 66,
  },
  {
    id: "burglary",
    name: "Residential Burglary",
    description:
      "Break into a residence and search for valuables.",
    nerve: 3,
    minReward: 120,
    maxReward: 360,
    xp: 20,
    crimeExperience: 28,
    levelRequired: 5,
    risk: 32,
    baseSuccess: 58,
  },
  {
    id: "vehicle-theft",
    name: "Vehicle Theft",
    description:
      "Steal a vehicle before anyone notices.",
    nerve: 4,
    minReward: 180,
    maxReward: 500,
    xp: 24,
    crimeExperience: 34,
    levelRequired: 8,
    risk: 42,
    baseSuccess: 52,
  },
  {
    id: "store-robbery",
    name: "Store Robbery",
    description:
      "Hit a local business and get out quickly.",
    nerve: 5,
    minReward: 300,
    maxReward: 850,
    xp: 35,
    crimeExperience: 45,
    levelRequired: 12,
    risk: 55,
    baseSuccess: 48,
  },
  {
    id: "system-intrusion",
    name: "System Intrusion",
    description:
      "Break into a poorly secured computer system.",
    nerve: 4,
    minReward: 300,
    maxReward: 1000,
    xp: 40,
    crimeExperience: 50,
    levelRequired: 15,
    risk: 48,
    baseSuccess: 50,
  },
  {
    id: "major-robbery",
    name: "Major Robbery",
    description:
      "A serious operation with a serious payout.",
    nerve: 7,
    minReward: 900,
    maxReward: 2500,
    xp: 65,
    crimeExperience: 75,
    levelRequired: 20,
    risk: 75,
    baseSuccess: 40,
  },
  {
    id: "bank-heist",
    name: "Bank Heist",
    description:
      "The big score. Almost nobody gets away clean.",
    nerve: 10,
    minReward: 2500,
    maxReward: 7500,
    xp: 100,
    crimeExperience: 110,
    levelRequired: 30,
    risk: 90,
    baseSuccess: 30,
  },
];

export function crimeUnlocked(
  crime: Crime,
  level: number
): boolean {
  return (
    level >=
    crime.levelRequired
  );
}

export function crimeSuccessChance(
  crime: Crime,
  crimeExperience: number,
  intelligence: number,
  educationBonus: number
): number {
  const experienceBonus =
    Math.min(
      25,
      crimeExperience / 40
    );

  const intelligenceBonus =
    Math.min(
      12,
      intelligence / 20
    );

  return Math.max(
    5,
    Math.min(
      95,
      crime.baseSuccess +
        experienceBonus +
        intelligenceBonus +
        educationBonus
    )
  );
}

export function randomReward(
  crime: Crime
): number {
  return (
    Math.floor(
      Math.random() *
        (crime.maxReward -
          crime.minReward +
          1)
    ) + crime.minReward
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

  const failureRoll =
    Math.random() * 100;

  if (
    failureRoll <
    crime.risk * 0.35
  ) {
    return "jailed";
  }

  if (
    failureRoll <
    crime.risk * 0.75
  ) {
    return "spooked";
  }

  return "failed";
}

export function getCrimeStatBonus(
  stats: CombatStats
): number {
  return Math.min(
    15,
    stats.intelligence / 10
  );
}
