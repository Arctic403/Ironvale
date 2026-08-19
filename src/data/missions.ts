import type { DistanceZone, Item, Mission, EducationCourse, Property } from "./dataTypes";

export const MISSIONS: Mission[] = [
  {
    id: "first-crime",
    name: "First Score",
    description:
      "Successfully complete your first crime.",
    requirement: "crime",
    target: 1,
    rewardCash: 500,
    rewardXp: 50,
  },

  {
    id: "street-criminal",
    name: "Street Criminal",
    description:
      "Successfully complete 10 crimes.",
    requirement: "crime",
    target: 10,
    rewardCash: 2500,
    rewardXp: 150,
  },

  {
    id: "fighter",
    name: "First Blood",
    description:
      "Win your first fight.",
    requirement: "combat",
    target: 1,
    rewardCash: 750,
    rewardXp: 75,
  },

  {
    id: "gym-rat",
    name: "Gym Rat",
    description:
      "Complete 10 gym training sessions.",
    requirement: "gym",
    target: 10,
    rewardCash: 1500,
    rewardXp: 100,
  },

  {
    id: "money-maker",
    name: "Making Money",
    description:
      "Accumulate $10,000.",
    requirement: "cash",
    target: 10000,
    rewardCash: 1000,
    rewardXp: 100,
  },
];


