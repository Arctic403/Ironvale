export type Job = {
  id: string;
  company: string;
  title: string;
  description: string;
  salary: number;
  levelRequired: number;
};

export type DistanceZone = "Close" | "Mid" | "Long";

export type Item = {
  id: string;
  name: string;
  description: string;
  type:
    | "weapon"
    | "armor"
    | "medical"
    | "energy"
    | "nerve"
    | "misc";
  price: number;
  effect?: number;

  optimalRange?: DistanceZone;
  accuracy?: number;
  moveCost?: number;
  coverPenetration?: number;
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
  maxHappiness: number;
};

/*
 * ============================================================
 * PLAYER PROFILES
 * ============================================================
 *
 * These are selectable combat opponents.
 *
 * IMPORTANT:
 *
 * equippedWeaponId is OPTIONAL.
 *
 * If it exists:
 *   The player has that weapon equipped.
 *
 * If it does not exist:
 *   The player is UNARMED.
 *
 * We do not give opponents automatic weapons.
 */

export type PlayerCombatStats = {
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
};

export type PlayerProfile = {
  id: string;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  stats: PlayerCombatStats;

  equippedWeaponId?: string;

  zone?: DistanceZone;
  inCover?: boolean;

  cashReward?: number;
  xpReward?: number;
};

export const PLAYER_PROFILES: PlayerProfile[] = [
  /*
   * UNARMED
   */
  {
    id: "street-rat",
    name: "StreetRat",
    level: 1,
    health: 100,
    maxHealth: 100,
    stats: {
      strength: 5,
      defense: 4,
      speed: 5,
      dexterity: 5,
    },
    zone: "Close",
    inCover: false,
    cashReward: 100,
    xpReward: 20,
  },

  /*
   * KNIFE EQUIPPED
   */
  {
    id: "dock-runner",
    name: "DockRunner",
    level: 3,
    health: 115,
    maxHealth: 115,
    stats: {
      strength: 8,
      defense: 7,
      speed: 7,
      dexterity: 8,
    },
    equippedWeaponId: "knife",
    zone: "Close",
    inCover: false,
    cashReward: 175,
    xpReward: 35,
  },

  /*
   * PISTOL EQUIPPED
   */
  {
    id: "night-shift",
    name: "NightShift",
    level: 5,
    health: 130,
    maxHealth: 130,
    stats: {
      strength: 11,
      defense: 10,
      speed: 9,
      dexterity: 10,
    },
    equippedWeaponId: "pistol",
    zone: "Mid",
    inCover: true,
    cashReward: 300,
    xpReward: 50,
  },

  /*
   * BAT EQUIPPED
   */
  {
    id: "iron-jack",
    name: "IronJack",
    level: 8,
    health: 150,
    maxHealth: 150,
    stats: {
      strength: 15,
      defense: 16,
      speed: 11,
      dexterity: 10,
    },
    equippedWeaponId: "bat",
    zone: "Close",
    inCover: false,
    cashReward: 500,
    xpReward: 75,
  },

  /*
   * PISTOL EQUIPPED
   */
  {
    id: "blackout",
    name: "Blackout",
    level: 12,
    health: 175,
    maxHealth: 175,
    stats: {
      strength: 21,
      defense: 18,
      speed: 16,
      dexterity: 17,
    },
    equippedWeaponId: "pistol",
    zone: "Mid",
    inCover: true,
    cashReward: 800,
    xpReward: 110,
  },

  /*
   * PISTOL EQUIPPED
   */
  {
    id: "viper",
    name: "Viper",
    level: 16,
    health: 200,
    maxHealth: 200,
    stats: {
      strength: 26,
      defense: 22,
      speed: 23,
      dexterity: 25,
    },
    equippedWeaponId: "pistol",
    zone: "Long",
    inCover: true,
    cashReward: 1200,
    xpReward: 150,
  },

  /*
   * UNARMED
   */
  {
    id: "ghost",
    name: "Ghost",
    level: 22,
    health: 235,
    maxHealth: 235,
    stats: {
      strength: 32,
      defense: 30,
      speed: 31,
      dexterity: 34,
    },
    zone: "Long",
    inCover: true,
    cashReward: 2000,
    xpReward: 225,
  },

  /*
   * PISTOL EQUIPPED
   */
  {
    id: "kingpin",
    name: "Kingpin",
    level: 30,
    health: 280,
    maxHealth: 280,
    stats: {
      strength: 42,
      defense: 40,
      speed: 36,
      dexterity: 38,
    },
    equippedWeaponId: "pistol",
    zone: "Mid",
    inCover: true,
    cashReward: 3500,
    xpReward: 350,
  },
];

/*
 * ============================================================
 * JOBS
 * ============================================================
 */

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

/*
 * ============================================================
 * ITEMS
 * ============================================================
 */

export const ITEMS: Item[] = [
  {
    id: "knife",
    name: "Street Knife",
    description:
      "A cheap weapon carried by people who expect trouble.",
    type: "weapon",
    price: 250,
    effect: 8,
    optimalRange: "Close",
    accuracy: 85,
    moveCost: 1,
    coverPenetration: 0.1,
  },

  {
    id: "bat",
    name: "Baseball Bat",
    description:
      "Simple, effective and easy to find.",
    type: "weapon",
    price: 600,
    effect: 15,
    optimalRange: "Close",
    accuracy: 75,
    moveCost: 1,
    coverPenetration: 0.2,
  },

  {
    id: "pistol",
    name: "9mm Pistol",
    description:
      "A basic firearm for serious situations.",
    type: "weapon",
    price: 2500,
    effect: 35,
    optimalRange: "Mid",
    accuracy: 70,
    moveCost: 2,
    coverPenetration: 0.4,
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

/*
 * ============================================================
 * MISSIONS
 * ============================================================
 */

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

/*
 * ============================================================
 * EDUCATION
 * ============================================================
 */

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

/*
 * ============================================================
 * PROPERTIES
 * ============================================================
 */

export const PROPERTIES: Property[] = [
  {
    id: "shack",
    name: "Shack",
    description:
      "A tiny place to start your life in RiftCity.",
    price: 0,
    maxHealthBonus: 0,
    gymBonus: 0,
    nerveBonus: 0,
    maxHappiness: 100,
  },

  {
    id: "apartment",
    name: "Small Apartment",
    description:
      "A basic place to call home.",
    price: 5000,
    maxHealthBonus: 5,
    gymBonus: 0,
    nerveBonus: 0,
    maxHappiness: 110,
  },

  {
    id: "house",
    name: "Suburban House",
    description:
      "More space and a better environment.",
    price: 25000,
    maxHealthBonus: 10,
    gymBonus: 0,
    nerveBonus: 0,
    maxHappiness: 120,
  },

  {
    id: "townhouse",
    name: "Luxury Townhouse",
    description:
      "A comfortable home for someone climbing the ladder.",
    price: 100000,
    maxHealthBonus: 20,
    gymBonus: 0,
    nerveBonus: 1,
    maxHappiness: 135,
  },

  {
    id: "mansion",
    name: "City Mansion",
    description:
      "A serious statement of success.",
    price: 500000,
    maxHealthBonus: 40,
    gymBonus: 0,
    nerveBonus: 2,
    maxHappiness: 150,
  },
];

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

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
      (property) => property.id === id
    ) || null
  );
}
