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

  nerve: number;

  minReward: number;
  maxReward: number;

  xp: number;

  risk: number;
  successChance: number;
};

export const CRIMES: Crime[] = [
  {
    id: "pickpocket",
    name: "Pickpocket",
    description:
      "Lift something from an unsuspecting target without drawing attention.",
    levelRequired: 1,
    nerve: 1,
    minReward: 20,
    maxReward: 65,
    xp: 7,
    risk: 10,
    successChance: 72,
  },

  {
    id: "shoplift",
    name: "Shoplifting",
    description:
      "Slip into a small store and walk out with something valuable.",
    levelRequired: 2,
    nerve: 2,
    minReward: 45,
    maxReward: 140,
    xp: 12,
    risk: 20,
    successChance: 66,
  },

  {
    id: "burglary",
    name: "Residential Burglary",
    description:
      "Break into a residence and search for valuables.",
    levelRequired: 5,
    nerve: 3,
    minReward: 120,
    maxReward: 360,
    xp: 20,
    risk: 32,
    successChance: 58,
  },

  {
    id: "vehicle-theft",
    name: "Vehicle Theft",
    description:
      "Steal a vehicle before anyone realizes what happened.",
    levelRequired: 8,
    nerve: 4,
    minReward: 180,
    maxReward: 500,
    xp: 24,
    risk: 42,
    successChance: 52,
  },

  {
    id: "store-robbery",
    name: "Store Robbery",
    description:
      "Hit a local business and get out before the police arrive.",
    levelRequired: 12,
    nerve: 5,
    minReward: 300,
    maxReward: 850,
    xp: 35,
    risk: 55,
    successChance: 48,
  },

  {
    id: "system-intrusion",
    name: "System Intrusion",
    description:
      "Break into a poorly secured computer system and extract something valuable.",
    levelRequired: 15,
    nerve: 4,
    minReward: 300,
    maxReward: 1000,
    xp: 40,
    risk: 48,
    successChance: 50,
  },

  {
    id: "major-robbery",
    name: "Major Robbery",
    description:
      "A serious operation with a serious payout — and serious consequences.",
    levelRequired: 20,
    nerve: 7,
    minReward: 900,
    maxReward: 2500,
    xp: 65,
    risk: 75,
    successChance: 40,
  },

  {
    id: "bank-heist",
    name: "Bank Heist",
    description:
      "The big score. Almost nobody gets away clean.",
    levelRequired: 30,
    nerve: 10,
    minReward: 2500,
    maxReward: 7500,
    xp: 100,
    risk: 90,
    successChance: 30,
  },
];

export function crimeUnlocked(
  crime: Crime,
  level: number
) {
  return level >= crime.levelRequired;
}

export function calculateSuccessChance(
  crime: Crime,
  stats: {
    strength: number;
    defense: number;
    intelligence: number;
    speed: number;
  }
) {
  const averageStat =
    (
      stats.strength +
      stats.defense +
      stats.intelligence +
      stats.speed
    ) / 4;

  const statBonus =
    Math.min(
      25,
      averageStat * 0.45
    );

  return Math.max(
    10,
    Math.min(
      90,
      crime.successChance +
        statBonus
    )
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
    100 - successChance;

  const jailChance =
    Math.min(
      remaining * 0.55,
      crime.risk * 0.38
    );

  const spookedChance =
    Math.min(
      remaining * 0.45,
      crime.risk * 0.62
    );

  const consequenceRoll =
    Math.random() * remaining;

  if (
    consequenceRoll <
    jailChance
  ) {
    return "jailed";
  }

  if (
    consequenceRoll <
    jailChance +
      spookedChance
  ) {
    return "spooked";
  }

  return "failed";
}

export function randomReward(
  crime: Crime
) {
  return (
    Math.floor(
      Math.random() *
        (
          crime.maxReward -
          crime.minReward +
          1
        )
    ) +
    crime.minReward
  );
}
