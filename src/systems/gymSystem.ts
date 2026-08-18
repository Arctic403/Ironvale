import {
  CombatStats,
} from "./progressionSystem";

export type TrainingStat =
  | "strength"
  | "defense"
  | "speed"
  | "dexterity";

export type Gym = {
  id: string;
  name: string;
  description: string;

  /*
   * Torn-style progression:
   * gyms are unlocked by gym experience,
   * not by player level.
   */
  gymExpRequired: number;

  /*
   * One-time membership fee.
   */
  membershipCost: number;

  /*
   * Energy consumed by one train.
   */
  energyCost: number;

  /*
   * Torn-style gym dots/gains.
   * Each stat can have a different value.
   * null means the gym cannot train that stat.
   */
  gains: Record<
    TrainingStat,
    number | null
  >;
};

export const TRAINING_STATS: {
  id: TrainingStat;
  name: string;
  icon: string;
  description: string;
}[] = [
  {
    id: "strength",
    name: "Strength",
    icon: "💪",
    description:
      "Raw offensive power.",
  },
  {
    id: "speed",
    name: "Speed",
    icon: "⚡",
    description:
      "Speed and offensive pressure.",
  },
  {
    id: "defense",
    name: "Defense",
    icon: "🛡️",
    description:
      "Damage resistance and survivability.",
  },
  {
    id: "dexterity",
    name: "Dexterity",
    icon: "🎯",
    description:
      "Accuracy, evasion and defensive ability.",
  },
];

/*
 * These are deliberately inspired by Torn's
 * progression rather than being a 1:1 copy.
 *
 * Torn currently has many more gyms. This gives
 * RiftCity a scalable progression while keeping
 * the game manageable.
 */
export const GYMS: Gym[] = [
  {
    id: "premier-fitness",
    name: "Premier Fitness",
    description:
      "The city's entry-level gym. Cheap, simple and available to everyone.",
    gymExpRequired: 0,
    membershipCost: 10,
    energyCost: 5,
    gains: {
      strength: 2.0,
      speed: 2.0,
      defense: 2.0,
      dexterity: 2.0,
    },
  },

  {
    id: "average-joes",
    name: "Average Joe's",
    description:
      "A step up from Premier Fitness with slightly better training equipment.",
    gymExpRequired: 200,
    membershipCost: 100,
    energyCost: 5,
    gains: {
      strength: 2.4,
      speed: 2.4,
      defense: 2.8,
      dexterity: 2.4,
    },
  },

  {
    id: "woodys-workout",
    name: "Woody's Workout",
    description:
      "A serious neighborhood gym with improved equipment.",
    gymExpRequired: 700,
    membershipCost: 250,
    energyCost: 5,
    gains: {
      strength: 2.8,
      speed: 3.2,
      defense: 3.0,
      dexterity: 2.8,
    },
  },

  {
    id: "beach-bods",
    name: "Beach Bods",
    description:
      "Specialized equipment focused on strength, speed and defense.",
    gymExpRequired: 1700,
    membershipCost: 500,
    energyCost: 5,
    gains: {
      strength: 3.2,
      speed: 3.2,
      defense: 3.2,
      dexterity: null,
    },
  },

  {
    id: "silver-gym",
    name: "Silver Gym",
    description:
      "A premium gym with balanced, high-quality equipment.",
    gymExpRequired: 3700,
    membershipCost: 1000,
    energyCost: 5,
    gains: {
      strength: 3.4,
      speed: 3.6,
      defense: 3.4,
      dexterity: 3.2,
    },
  },

  {
    id: "pour-femme",
    name: "Pour Femme",
    description:
      "A specialized facility with excellent dexterity equipment.",
    gymExpRequired: 6450,
    membershipCost: 2500,
    energyCost: 5,
    gains: {
      strength: 3.4,
      speed: 3.6,
      defense: 3.6,
      dexterity: 3.8,
    },
  },

  {
    id: "global-gym",
    name: "Global Gym",
    description:
      "A major training facility with excellent all-round gains.",
    gymExpRequired: 9450,
    membershipCost: 10000,
    energyCost: 5,
    gains: {
      strength: 4.0,
      speed: 4.0,
      defense: 4.0,
      dexterity: 4.0,
    },
  },

  {
    id: "knuckle-heads",
    name: "Knuckle Heads",
    description:
      "The first serious middleweight gym.",
    gymExpRequired: 13450,
    membershipCost: 50000,
    energyCost: 10,
    gains: {
      strength: 4.8,
      speed: 4.4,
      defense: 4.0,
      dexterity: 4.2,
    },
  },

  {
    id: "pioneer-fitness",
    name: "Pioneer Fitness",
    description:
      "High-end equipment for experienced fighters.",
    gymExpRequired: 19450,
    membershipCost: 100000,
    energyCost: 10,
    gains: {
      strength: 4.4,
      speed: 4.5,
      defense: 4.8,
      dexterity: 4.4,
    },
  },

  {
    id: "anabolic-anomalies",
    name: "Anabolic Anomalies",
    description:
      "An elite gym designed for serious stat growth.",
    gymExpRequired: 26450,
    membershipCost: 250000,
    energyCost: 10,
    gains: {
      strength: 5.0,
      speed: 4.5,
      defense: 5.2,
      dexterity: 4.5,
    },
  },

  {
    id: "core",
    name: "Core",
    description:
      "A specialized high-performance training facility.",
    gymExpRequired: 34450,
    membershipCost: 500000,
    energyCost: 10,
    gains: {
      strength: 5.0,
      speed: 5.2,
      defense: 5.0,
      dexterity: 5.0,
    },
  },

  {
    id: "deep-burn",
    name: "Deep Burn",
    description:
      "An advanced gym for players approaching endgame training.",
    gymExpRequired: 56450,
    membershipCost: 5000000,
    energyCost: 10,
    gains: {
      strength: 6.0,
      speed: 6.0,
      defense: 6.0,
      dexterity: 6.0,
    },
  },

  {
    id: "apollo-gym",
    name: "Apollo Gym",
    description:
      "Heavyweight equipment for veteran fighters.",
    gymExpRequired: 80590,
    membershipCost: 7500000,
    energyCost: 10,
    gains: {
      strength: 6.0,
      speed: 6.2,
      defense: 6.4,
      dexterity: 6.2,
    },
  },

  {
    id: "georges",
    name: "George's",
    description:
      "The pinnacle of standard RiftCity gym training.",
    gymExpRequired: 200000,
    membershipCost: 100000000,
    energyCost: 10,
    gains: {
      strength: 7.3,
      speed: 7.3,
      defense: 7.3,
      dexterity: 7.3,
    },
  },

  /*
   * Jail-only gym.
   */
  {
    id: "crims-gym",
    name: "Crims Gym",
    description:
      "The jail gym. Defense training is especially effective here.",
    gymExpRequired: 0,
    membershipCost: 0,
    energyCost: 5,
    gains: {
      strength: 3.4,
      speed: 3.4,
      defense: 4.5,
      dexterity: null,
    },
  },
];

export function getGym(
  id: string
): Gym | null {
  return (
    GYMS.find(
      (gym) =>
        gym.id === id
    ) || null
  );
}

export function getStandardGyms(): Gym[] {
  return GYMS.filter(
    (gym) =>
      gym.id !== "crims-gym"
  );
}

export function isJailGym(
  gym: Gym
): boolean {
  return gym.id === "crims-gym";
}

export function gymUnlocked(
  gym: Gym,
  gymExperience: number
): boolean {
  return (
    isJailGym(gym) ||
    gymExperience >=
      gym.gymExpRequired
  );
}

export function canTrainStat(
  gym: Gym,
  stat: TrainingStat
): boolean {
  return (
    gym.gains[stat] !== null
  );
}

/*
 * Happiness is one of the most important
 * differences between a basic RPG gym and
 * Torn-style training.
 *
 * We keep it bounded and use diminishing
 * returns so huge happiness values don't
 * explode the stat system.
 */
export function getHappinessMultiplier(
  happiness: number
): number {
  const safeHappy =
    Math.max(
      0,
      happiness
    );

  /*
   * 100 happy = roughly baseline.
   * 1,000+ begins becoming meaningful.
   * Returns diminish naturally.
   */
  const multiplier =
    0.72 +
    0.28 *
      Math.log10(
        safeHappy + 100
      );

  return Math.max(
    0.72,
    Math.min(
      2.25,
      multiplier
    )
  );
}

/*
 * Training gains scale from:
 *
 * gym gain
 * × energy
 * × happiness
 * × education modifier
 * × other modifiers
 *
 * This is intentionally an approximation
 * rather than reproducing Torn's proprietary
 * server-side calculation exactly.
 */
export function calculateTrainingGain(
  gym: Gym,
  stat: TrainingStat,
  currentStat: number,
  happiness: number,
  energyMultiplier = 1,
  educationMultiplier = 1,
  otherMultiplier = 1
): number {
  const gymGain =
    gym.gains[stat];

  if (
    gymGain === null ||
    gymGain === undefined
  ) {
    return 0;
  }

  /*
   * Small stat growth bonus as the stat rises,
   * with strong diminishing returns.
   */
  const statMultiplier =
    1 +
    Math.log10(
      Math.max(
        1,
        currentStat
      )
    ) *
      0.035;

  const happinessMultiplier =
    getHappinessMultiplier(
      happiness
    );

  /*
   * 5 Energy is the base unit.
   */
  const energyFactor =
    Math.max(
      0.1,
      energyMultiplier
    );

  const result =
    gymGain *
    energyFactor *
    happinessMultiplier *
    statMultiplier *
    educationMultiplier *
    otherMultiplier;

  return Number(
    Math.max(
      0.01,
      result
    ).toFixed(2)
  );
}

export function applyTraining(
  stats: CombatStats,
  gym: Gym,
  stat: TrainingStat,
  happiness: number,
  educationMultiplier = 1,
  otherMultiplier = 1
): {
  stats: CombatStats;
  gain: number;
} {
  const gain =
    calculateTrainingGain(
      gym,
      stat,
      stats[stat],
      happiness,
      gym.energyCost / 5,
      educationMultiplier,
      otherMultiplier
    );

  return {
    stats: {
      ...stats,
      [stat]:
        stats[stat] +
        gain,
    },
    gain,
  };
}

/*
 * Gym EXP is deliberately slow.
 *
 * In Torn, gym EXP is gained from training
 * and is what unlocks the next gym.
 */
export function getGymExperienceGain(
  energyCost: number
): number {
  return Math.max(
    1,
    Math.floor(
      energyCost / 5
    )
  );
}

export function getNextGym(
  gymExperience: number
): Gym | null {
  const standard =
    getStandardGyms();

  return (
    standard.find(
      (gym) =>
        gym.gymExpRequired >
        gymExperience
    ) || null
  );
}

export function getBestUnlockedGym(
  gymExperience: number
): Gym {
  const standard =
    getStandardGyms();

  let best =
    standard[0];

  for (
    const gym of standard
  ) {
    if (
      gym.gymExpRequired <=
      gymExperience
    ) {
      best = gym;
    }
  }

  return best;
}
