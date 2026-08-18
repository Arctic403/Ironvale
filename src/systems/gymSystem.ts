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
  levelRequired: number;
  energyCost: number;
  gain: number;
};

export const GYMS: Gym[] = [
  {
    id: "street-gym",
    name: "Street Gym",
    description:
      "A cheap neighborhood gym with basic equipment. Nothing fancy, but everyone has to start somewhere.",
    levelRequired: 1,
    energyCost: 5,
    gain: 0.7,
  },

  {
    id: "iron-gym",
    name: "Iron Gym",
    description:
      "Better equipment, heavier weights and a serious crowd.",
    levelRequired: 5,
    energyCost: 10,
    gain: 1.2,
  },

  {
    id: "combat-gym",
    name: "Combat Gym",
    description:
      "A serious training facility built for people who actually plan on fighting.",
    levelRequired: 10,
    energyCost: 15,
    gain: 1.7,
  },

  {
    id: "elite-gym",
    name: "Elite Performance Center",
    description:
      "RiftCity's premier training facility. Expensive, exclusive and extremely effective.",
    levelRequired: 20,
    energyCost: 25,
    gain: 2.8,
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
      "Build offensive power and hit harder.",
  },

  {
    id: "defense",
    name: "Defense",
    icon: "🛡️",
    description:
      "Become harder to damage in combat.",
  },

  {
    id: "speed",
    name: "Speed",
    icon: "⚡",
    description:
      "Improve your speed and offensive pressure.",
  },

  {
    id: "dexterity",
    name: "Dexterity",
    icon: "🎯",
    description:
      "Improve accuracy, precision and combat effectiveness.",
  },
];

export function getTrainingGain(
  gym: Gym,
  stat: TrainingStat
): number {
  /*
   * The player chooses the stat.
   *
   * The gym determines how much
   * that selected stat increases.
   *
   * We intentionally do not use
   * different gains for each stat.
   */
  void stat;

  return gym.gain;
}

export function applyTraining(
  stats: CombatStats,
  gym: Gym,
  stat: TrainingStat
): CombatStats {
  const gain =
    getTrainingGain(
      gym,
      stat
    );

  return {
    ...stats,

    [stat]:
      stats[stat] +
      gain,
  };
}
