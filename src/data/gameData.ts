export type Job = {
  id: string;
  company: string;
  title: string;
  description: string;
  salary: number;
  levelRequired: number;
};

export type Item = {
  id: string;
  name: string;
  description: string;
  type: "weapon" | "armor" | "medical" | "energy" | "nerve" | "misc";
  price: number;
  effect?: number;
};

export type Mission = {
  id: string;
  name: string;
  description: string;
  requirement:
    | "crime"
    | "combat"
    | "gym"
    | "cash";
  target: number;
  rewardCash: number;
  rewardXp: number;
};

export type EducationCourse = {
  id: string;
  name: string;
  description: string;
  cost: number;
  durationHours: number;
  levelRequired: number;
  bonus:
    | "crime"
    | "gym"
    | "combat"
    | "energy"
    | "nerve";
  bonusAmount: number;
};

export type Property = {
  id: string;
  name: string;
  description: string;
  price: number;
  maxHealthBonus: number;
  gymBonus: number;
  nerveBonus: number;
};

export const JOBS: Job[] = [
  {
    id: "delivery",
    company: "RiftExpress",
    title: "Courier",
    description:
      "Deliver packages across RiftCity.",
    salary: 100,
    levelRequired: 1,
  },
  {
    id: "security",
    company: "RiftShield",
    title: "Security Guard",
    description:
      "Protect businesses and keep troublemakers out.",
    salary: 180,
    levelRequired: 5,
  },
  {
    id: "construction",
    company: "Ironworks",
    title: "Construction Worker",
    description:
      "Build the city while building your wallet.",
    salary: 300,
    levelRequired: 10,
  },
  {
    id: "technician",
    company: "RiftTech",
    title: "Technician",
    description:
      "Keep RiftCity's technology running.",
    salary: 500,
    levelRequired: 15,
  },
  {
    id: "finance",
    company: "Rift Capital",
    title: "Finance Associate",
    description:
      "Move money for people who have too much of it.",
    salary: 800,
    levelRequired: 25,
  },
];

export const ITEMS: Item[] = [
  {
    id: "knife",
    name: "Street Knife",
    description:
      "A cheap weapon carried by people who expect trouble.",
    type: "weapon",
    price: 250,
    effect: 5,
  },
  {
    id: "bat",
    name: "Baseball Bat",
    description:
      "Simple, effective and easy to find.",
    type: "weapon",
    price: 600,
    effect: 10,
  },
  {
    id: "pistol",
    name: "9mm Pistol",
    description:
      "A basic firearm for serious situations.",
    type: "weapon",
    price: 2500,
    effect: 20,
  },
  {
    id: "jacket",
    name: "Reinforced Jacket",
    description:
      "Offers a little protection in a fight.",
    type: "armor",
    price: 500,
    effect: 5,
  },
  {
    id: "vest",
    name: "Tactical Vest",
    description:
      "A proper piece of protective equipment.",
    type: "armor",
    price: 3000,
    effect: 15,
  },
  {
    id: "medkit",
    name: "Small Medkit",
    description:
      "Restore 25 health.",
    type: "medical",
    price: 300,
    effect: 25,
  },
  {
    id: "energy-drink",
    name: "Energy Drink",
    description:
      "Restore 25 Energy.",
    type: "energy",
    price: 400,
    effect: 25,
  },
  {
    id: "nerve-tonic",
    name: "Nerve Tonic",
    description:
      "Restore 3 Nerve.",
    type: "nerve",
    price: 700,
    effect: 3,
  },
];

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

export const EDUCATION: EducationCourse[] = [
  {
    id: "street-smarts",
    name: "Street Smarts",
    description:
      "Learn how to keep your head down and spot opportunities.",
    cost: 1000,
    durationHours: 2,
    levelRequired: 1,
    bonus: "crime",
    bonusAmount: 3,
  },
  {
    id: "fitness-basics",
    name: "Fitness Fundamentals",
    description:
      "Learn the basics of effective training.",
    cost: 2500,
    durationHours: 4,
    levelRequired: 5,
    bonus: "gym",
    bonusAmount: 5,
  },
  {
    id: "self-defense",
    name: "Self Defense",
    description:
      "Learn practical fighting techniques.",
    cost: 5000,
    durationHours: 8,
    levelRequired: 10,
    bonus: "combat",
    bonusAmount: 5,
  },
  {
    id: "criminal-psychology",
    name: "Criminal Psychology",
    description:
      "Understand how criminals and investigators think.",
    cost: 10000,
    durationHours: 12,
    levelRequired: 15,
    bonus: "crime",
    bonusAmount: 7,
  },
  {
    id: "advanced-fitness",
    name: "Sports Science",
    description:
      "Learn how to get more from every training session.",
    cost: 25000,
    durationHours: 24,
    levelRequired: 20,
    bonus: "gym",
    bonusAmount: 10,
  },
];

export const PROPERTIES: Property[] = [
  {
    id: "apartment",
    name: "Small Apartment",
    description:
      "A basic place to call home.",
    price: 5000,
    maxHealthBonus: 5,
    gymBonus: 0,
    nerveBonus: 0,
  },
  {
    id: "house",
    name: "Suburban House",
    description:
      "More space and a better environment.",
    price: 25000,
    maxHealthBonus: 10,
    gymBonus: 2,
    nerveBonus: 0,
  },
  {
    id: "townhouse",
    name: "Luxury Townhouse",
    description:
      "A comfortable home for someone climbing the ladder.",
    price: 100000,
    maxHealthBonus: 20,
    gymBonus: 4,
    nerveBonus: 1,
  },
  {
    id: "mansion",
    name: "City Mansion",
    description:
      "A serious statement of success.",
    price: 500000,
    maxHealthBonus: 40,
    gymBonus: 7,
    nerveBonus: 2,
  },
];

export function getJob(
  id: string | null
): Job | null {
  if (!id) {
    return null;
  }

  return (
    JOBS.find(
      (job) => job.id === id
    ) || null
  );
}

export function getItem(
  id: string
): Item | null {
  return (
    ITEMS.find(
      (item) => item.id === id
    ) || null
  );
}

export function getProperty(
  id: string | null
): Property | null {
  if (!id) {
    return null;
  }

  return (
    PROPERTIES.find(
      (property) =>
        property.id === id
    ) || null
  );
}
