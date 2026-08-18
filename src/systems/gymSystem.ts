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
      "A cheap neighborhood gym with basic equipment.",
    levelRequired: 1,
    energyCost: 5,
    gain: 0.7,
  },

  {
    id: "iron-gym",
    name: "Iron Gym",
    description:
      "Better equipment and heavier weights.",
    levelRequired: 5,
    energyCost: 10,
    gain: 1.2,
  },

  {
    id: "combat-gym",
    name: "Combat Gym",
    description:
      "A serious training facility built for fighters.",
    levelRequired: 10,
    energyCost: 15,
    gain: 1.7,
  },

  {
    id: "elite-gym",
    name: "Elite Performance Center",
    description:
      "The best training facility currently available in RiftCity.",
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
      "Increases your offensive power.",
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
      "Makes you faster and improves offensive pressure.",
  },

  {
    id: "dexterity",
    name: "Dexterity",
    icon: "🎯",
    description:
      "Improves your accuracy and defensive ability.",
  },
];

export function getTrainingGain(
  gym: Gym,
  stat: TrainingStat
): number {
  /*
   * The player chooses the stat.
   *
   * Gym quality controls the amount
   * gained rather than deciding the
   * stat automatically.
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
