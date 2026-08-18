import {
  CombatStats,
} from "./progressionSystem";

export type Gym = {
  id: string;
  name: string;
  description: string;
  levelRequired: number;
  energyCost: number;
  gains: Partial<CombatStats>;
};

export const GYMS: Gym[] = [
  {
    id: "street-gym",
    name: "Street Gym",
    description:
      "A cheap neighborhood gym.",
    levelRequired: 1,
    energyCost: 5,
    gains: {
      strength: 0.7,
      defense: 0.7,
      speed: 0.7,
      dexterity: 0.4,
    },
  },
  {
    id: "iron-gym",
    name: "Iron Gym",
    description:
      "Better equipment and heavier weights.",
    levelRequired: 5,
    energyCost: 10,
    gains: {
      strength: 1.4,
      defense: 1.1,
      speed: 0.8,
      dexterity: 0.6,
    },
  },
  {
    id: "combat-gym",
    name: "Combat Gym",
    description:
      "Built for people who expect to use what they learn.",
    levelRequired: 10,
    energyCost: 15,
    gains: {
      strength: 1.6,
      defense: 1.5,
      speed: 1.2,
      dexterity: 1.2,
    },
  },
  {
    id: "elite-gym",
    name: "Elite Performance Center",
    description:
      "The best training facility in RiftCity.",
    levelRequired: 20,
    energyCost: 25,
    gains: {
      strength: 2.8,
      defense: 2.8,
      speed: 2.8,
      dexterity: 2.8,
    },
  },
];
