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
   * Gym progression.
   *
   * Gym EXP unlocks the facility.
   * Membership is purchased separately.
   */
  gymExpRequired: number;
  membershipCost: number;

  /*
   * Energy spent per training session.
   */
  energyCost: number;

  /*
   * Base gain for each battle stat.
   *
   * null = this gym cannot train that stat.
   */
  gains: Record<
    TrainingStat,
    number | null
  >;

  /*
   * Jail-only facility.
   */
  jailOnly?: boolean;
};

export type TrainingStatInfo = {
  id: TrainingStat;
  name: string;
  icon: string;
  description: string;
};

export type TrainingResult = {
  stats: CombatStats;
  gain: number;
};

export const TRAINING_STATS: TrainingStatInfo[] = [
  {
    id: "strength",
    name: "Strength",
    icon: "💪",
    description:
      "Improves your physical attacking ability.",
  },
  {
    id: "defense",
    name: "Defense",
    icon: "🛡️",
    description:
      "Improves your ability to absorb attacks.",
  },
  {
    id: "speed",
    name: "Speed",
    icon: "⚡",
    description:
      "Improves your speed and combat initiative.",
  },
  {
    id: "dexterity",
    name: "Dexterity",
    icon: "🎯",
    description:
      "Improves accuracy, agility and precision.",
  },
];

/*
 * Torn-inspired gym progression.
 *
 * The important distinction is:
 *
 * - Energy is the training resource.
 * - Gym EXP unlocks better gyms.
 * - Memberships unlock access.
 * - There is NO gym cooldown.
 * - The player chooses the stat trained.
 */
export const GYMS: Gym[] = [
  {
    id: "premier-fitness",
    name: "Premier Fitness",
    description:
      "The entry-level city gym. A reliable place to build your first battle stats.",
    gymExpRequired: 0,
    membershipCost: 0,
    energyCost: 5,
    gains: {
      strength: 0.65,
      defense: 0.65,
      speed: 0.55,
      dexterity: 0.45,
    },
  },

  {
    id: "ricks-gym",
    name: "Ricks Gym",
    description:
      "A serious training facility for players who have started building their battle stats.",
    gymExpRequired: 500,
    membershipCost: 5000,
    energyCost: 10,
    gains: {
      strength: 1.10,
      defense: 1.05,
      speed: 0.90,
      dexterity: 0.80,
    },
  },

  {
    id: "frontline-fitness",
    name: "Frontline Fitness",
    description:
      "Specialized equipment designed for experienced fighters.",
    gymExpRequired: 2500,
    membershipCost: 15000,
    energyCost: 15,
    gains: {
      strength: 1.55,
      defense: 1.50,
      speed: 1.30,
      dexterity: 1.20,
    },
  },

  {
    id: "apollo-gym",
    name: "Apollo Gym",
    description:
      "A premium facility reserved for dedicated fighters.",
    gymExpRequired: 7500,
    membershipCost: 50000,
    energyCost: 20,
    gains: {
      strength: 2.05,
      defense: 2.00,
      speed: 1.80,
      dexterity: 1.70,
    },
  },

  {
    id: "gym-3000",
    name: "Gym 3000",
    description:
      "An elite training facility with advanced equipment across every discipline.",
    gymExpRequired: 20000,
    membershipCost: 150000,
    energyCost: 25,
    gains: {
      strength: 2.70,
      defense: 2.65,
      speed: 2.45,
      dexterity: 2.35,
    },
  },

  {
    id: "crims-gym",
    name: "Crims Gym",
    description:
      "A prison gym. Basic equipment, limited resources, but training is still possible while incarcerated.",
    gymExpRequired: 0,
    membershipCost: 0,
    energyCost: 5,
    gains: {
      strength: null,
      defense: 0.45,
      speed: null,
      dexterity: null,
    },
    jailOnly: true,
  },
];

export function isJailGym(
  gym: Gym
): boolean {
  return gym.jailOnly === true;
}

export function gymUnlocked(
  gym: Gym,
  gymExperience: number
): boolean {
  if (isJailGym(gym)) {
    return true;
  }

  return (
    gymExperience >=
    gym.gymExpRequired
  );
}

export function canTrainStat(
  gym: Gym,
  stat: TrainingStat
): boolean {
  return (
    gym.gains[stat] !== null &&
    gym.gains[stat] !== undefined
  );
}

/*
 * Returns the first gym that is not yet
 * unlocked by Gym EXP.
 */
export function getNextGym(
  gymExperience: number
): Gym | null {
  const next =
    GYMS
      .filter(
        (gym) =>
          !isJailGym(gym) &&
          gym.gymExpRequired >
            gymExperience
      )
      .sort(
        (a, b) =>
          a.gymExpRequired -
          b.gymExpRequired
      )[0];

  return next || null;
}

/*
 * Gym EXP gained from a training session.
 *
 * More Energy spent = more Gym EXP.
 */
export function getGymExperienceGain(
  energyCost: number
): number {
  return Math.max(
    1,
    Math.floor(
      energyCost
    )
  );
}

/*
 * Happiness affects training gains.
 *
 * This deliberately has diminishing extremes:
 *
 * 100 happiness = full gain
 * 50 happiness  = roughly 75% gain
 * 0 happiness   = roughly 50% gain
 *
 * This keeps Happiness meaningful without
 * making low Happiness completely disable training.
 */
export function getHappinessMultiplier(
  happiness: number
): number {
  const clamped =
    Math.max(
      0,
      Math.min(
        100,
        happiness
      )
    );

  return (
    0.5 +
    clamped / 200
  );
}

/*
 * Apply one training session.
 *
 * IMPORTANT:
 * This function changes the selected stat
 * exactly once.
 *
 * The old App implementation had a bug where
 * applyTraining() was called and the stat was
 * then manually incremented again.
 */
export function applyTraining(
  stats: CombatStats,
  gym: Gym,
  stat: TrainingStat,
  happiness = 100,
  educationMultiplier = 1
): TrainingResult {
  const baseGain = gym.gains[stat];
  if (baseGain === null || baseGain === undefined) return { stats: { ...stats }, gain: 0 };
  const gain = baseGain * getHappinessMultiplier(happiness) * Math.max(0, educationMultiplier);
  return { stats: { ...stats, [stat]: stats[stat] + gain }, gain };
}
