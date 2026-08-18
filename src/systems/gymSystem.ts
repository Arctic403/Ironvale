import { CombatStats } from "./progressionSystem";

export type TrainingStat =
  | "strength"
  | "defense"
  | "speed"
  | "dexterity";

export type Gym = {
  id: string;
  name: string;
  description: string;

  unlockCost: number;

  energyCost: number;

  gymExpRequired: number;

  gains: Record<TrainingStat, number | null>;

  tier: "light" | "middle" | "heavy" | "special";
};

export type TrainingContext = {
  happiness: number;

  stat: number;

  educationBonus: number;

  propertyBonus: number;

  globalBonus?: number;
};

/*
 * RiftCity gym progression is inspired by Torn's
 * gym progression rather than using player level
 * as the primary gym unlock mechanic.
 *
 * Gains are intentionally lower than Torn's raw
 * numbers because RiftCity currently uses much
 * smaller combat stats.
 */
export const GYMS: Gym[] = [
  {
    id: "premier-fitness",
    name: "Premier Fitness",
    description:
      "A basic commercial gym. Cheap, reliable and available to new players.",

    unlockCost: 0,

    energyCost: 5,

    gymExpRequired: 0,

    gains: {
      strength: 2.0,
      defense: 2.0,
      speed: 2.0,
      dexterity: 2.0,
    },

    tier: "light",
  },

  {
    id: "average-joes",
    name: "Average Joe's",
    description:
      "A step up from the neighborhood gym with better equipment.",

    unlockCost: 100,

    energyCost: 5,

    gymExpRequired: 100,

    gains: {
      strength: 2.4,
      defense: 2.8,
      speed: 2.4,
      dexterity: 2.4,
    },

    tier: "light",
  },

  {
    id: "woody-workout",
    name: "Woody's Workout",
    description:
      "A serious training facility with improved equipment.",

    unlockCost: 250,

    energyCost: 5,

    gymExpRequired: 250,

    gains: {
      strength: 2.8,
      defense: 3.0,
      speed: 3.2,
      dexterity: 2.8,
    },

    tier: "light",
  },

  {
    id: "beach-bods",
    name: "Beach Bods",
    description:
      "A specialized gym focused on physical conditioning.",

    unlockCost: 500,

    energyCost: 5,

    gymExpRequired: 500,

    gains: {
      strength: 3.2,
      defense: 3.2,
      speed: 3.2,
      dexterity: null,
    },

    tier: "light",
  },

  {
    id: "global-gym",
    name: "Global Gym",
    description:
      "A high-quality facility suitable for experienced fighters.",

    unlockCost: 10000,

    energyCost: 5,

    gymExpRequired: 4000,

    gains: {
      strength: 4.0,
      defense: 4.0,
      speed: 4.0,
      dexterity: 4.0,
    },

    tier: "light",
  },

  {
    id: "knuckle-heads",
    name: "Knuckle Heads",
    description:
      "A powerful middleweight gym designed for serious training.",

    unlockCost: 50000,

    energyCost: 10,

    gymExpRequired: 6000,

    gains: {
      strength: 4.8,
      defense: 4.0,
      speed: 4.4,
      dexterity: 4.2,
    },

    tier: "middle",
  },

  {
    id: "pioneer-fitness",
    name: "Pioneer Fitness",
    description:
      "A premium gym with balanced middleweight gains.",

    unlockCost: 100000,

    energyCost: 10,

    gymExpRequired: 7000,

    gains: {
      strength: 4.4,
      defense: 4.8,
      speed: 4.5,
      dexterity: 4.4,
    },

    tier: "middle",
  },

  {
    id: "complete-cardio",
    name: "Complete Cardio",
    description:
      "A specialist facility with excellent overall gains.",

    unlockCost: 2000000,

    energyCost: 10,

    gymExpRequired: 18000,

    gains: {
      strength: 5.5,
      defense: 5.5,
      speed: 5.8,
      dexterity: 5.2,
    },

    tier: "middle",
  },

  {
    id: "deep-burn",
    name: "Deep Burn",
    description:
      "An elite middleweight gym built around maximum training intensity.",

    unlockCost: 5000000,

    energyCost: 10,

    gymExpRequired: 24140,

    gains: {
      strength: 6.0,
      defense: 6.0,
      speed: 6.0,
      dexterity: 6.0,
    },

    tier: "middle",
  },

  {
    id: "apollo-gym",
    name: "Apollo Gym",
    description:
      "A heavyweight training facility for established fighters.",

    unlockCost: 7500000,

    energyCost: 10,

    gymExpRequired: 31260,

    gains: {
      strength: 6.0,
      defense: 6.4,
      speed: 6.2,
      dexterity: 6.2,
    },

    tier: "heavy",
  },

  {
    id: "force-training",
    name: "Force Training",
    description:
      "A premium gym offering excellent speed and dexterity gains.",

    unlockCost: 15000000,

    energyCost: 10,

    gymExpRequired: 46640,

    gains: {
      strength: 6.4,
      defense: 6.4,
      speed: 6.6,
      dexterity: 6.8,
    },

    tier: "heavy",
  },

  {
    id: "atlas",
    name: "Atlas",
    description:
      "One of RiftCity's strongest conventional gyms.",

    unlockCost: 30000000,

    energyCost: 10,

    gymExpRequired: 67775,

    gains: {
      strength: 7.0,
      defense: 6.4,
      speed: 6.4,
      dexterity: 6.6,
    },

    tier: "heavy",
  },

  {
    id: "georges",
    name: "George's Elite Fitness",
    description:
      "The pinnacle of conventional gym training.",

    unlockCost: 100000000,

    energyCost: 10,

    gymExpRequired: 106305,

    gains: {
      strength: 7.3,
      defense: 7.3,
      speed: 7.3,
      dexterity: 7.3,
    },

    tier: "heavy",
  },
];

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
      "Increases offensive power.",
  },

  {
    id: "defense",
    name: "Defense",
    icon: "🛡️",
    description:
      "Improves your ability to withstand attacks.",
  },

  {
    id: "speed",
    name: "Speed",
    icon: "⚡",
    description:
      "Improves attack pressure and combat speed.",
  },

  {
    id: "dexterity",
    name: "Dexterity",
    icon: "🎯",
    description:
      "Improves accuracy and defensive ability.",
  },
];

/*
 * Torn-style happiness curve.
 *
 * Happiness has a strong effect at low values,
 * then progressively less influence at high values.
 */
function happinessMultiplier(
  happiness: number
): number {
  const happy =
    Math.max(
      0,
      Math.min(
        10000,
        happiness
      )
    );

  return (
    0.75 +
    0.25 *
      (Math.log(
        happy + 250
      ) /
        Math.log(
          10250
        ))
  );
}

/*
 * Small diminishing-return component.
 *
 * This prevents late-game stats from becoming
 * completely linear forever.
 */
function statMultiplier(
  stat: number
): number {
  const safeStat =
    Math.max(
      0,
      stat
    );

  if (
    safeStat < 100
  ) {
    return 1;
  }

  return (
    1 +
    Math.log10(
      safeStat
    ) *
      0.025
  );
}

export function getTrainingGain(
  gym: Gym,
  stat: TrainingStat,
  context: TrainingContext
): number {
  const gymGain =
    gym.gains[stat];

  /*
   * A gym can refuse to train a stat.
   */
  if (
    gymGain === null
  ) {
    return 0;
  }

  const happy =
    happinessMultiplier(
      context.happiness
    );

  const statScale =
    statMultiplier(
      context.stat
    );

  const education =
    1 +
    context.educationBonus /
      100;

  const property =
    1 +
    context.propertyBonus /
      100;

  const global =
    1 +
    (context.globalBonus ||
      0) /
      100;

  /*
   * Gym gain is the base multiplier,
   * modified by happiness, education,
   * property and other bonuses.
   */
  const gain =
    gymGain *
    happy *
    statScale *
    education *
    property *
    global;

  return Math.max(
    0.01,
    gain
  );
}

export function applyTraining(
  stats: CombatStats,
  gym: Gym,
  stat: TrainingStat,
  context: TrainingContext
): CombatStats {
  const gain =
    getTrainingGain(
      gym,
      stat,
      context
    );

  return {
    ...stats,

    [stat]:
      stats[stat] +
      gain,
  };
}

export function getGymForExp(
  gymExp: number
): Gym {
  let result =
    GYMS[0];

  for (
    const gym of GYMS
  ) {
    if (
      gymExp >=
      gym.gymExpRequired
    ) {
      result = gym;
    }
  }

  return result;
}

export function getNextGym(
  gymExp: number
): Gym | null {
  return (
    GYMS.find(
      (gym) =>
        gym.gymExpRequired >
        gymExp
    ) || null
  );
}
