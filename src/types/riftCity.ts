export type Screen =
  | "city" | "crimes" | "combat" | "gym" | "jobs" | "inventory" | "shops"
  | "missions" | "education" | "property" | "character"
  | "market" | "faction" | "awards";

export type ActivityType =
  | "success" | "failure" | "critical" | "spooked" | "jailed"
  | "combat" | "gym" | "job" | "system";

export type Activity = {
  id: number;
  text: string;
  type: ActivityType;
  time: number;
};

import type { CombatStats } from "../systems/progressionSystem";

export type SaveData = {
  cash: number;
  bank: number;
  xp: number;
  bankInterest: number;
  lastBankInterest: number;
  merits: number;
  points: number;
  energy: number;
  lastEnergyUpdate: number;
  nerve: number;
  lastNerveUpdate: number;
  health: number;
  lastHealthUpdate: number;
  crimeExperience: number;
  stats: CombatStats;
  gymExperience: number;
  gymMemberships: string[];
  activeGym: string;
  happiness: number;
  lastHappinessUpdate: number;
  currentJob: string | null;
  jobStartedAt: number;
  lastJobPayment: number;
  lastJobSkillUpdate: number;
  jobSkills: Record<string, number>;
  jobPositionTiers: Record<string, number>;
  jailUntil: number | null;
  hospitalUntil: number | null;
  inventory: Record<string, number>;
  equippedWeapon: string | null;
  equippedArmor: string | null;
  ownedProperty: string;
  educationCompleted: string[];
  educationActive: string | null;
  educationStartedAt: number | null;
  completedMissions: string[];
  crimesCompleted: number;
  crimesFailed: number;
  crimesSpooked: number;
  crimesCritical: number;
  timesJailed: number;
  fightsWon: number;
  fightsLost: number;
  gymSessions: number;
  attacks: number;
  locationsVisited: string[];
  currentLocation: string;
  travelCooldownUntil: number | null;
  faction: string | null;
  factionReputation: number;
  company: string | null;
  companyReputation: number;
  market: Record<string, number>;
  lastMarketUpdate: number;
  lastDailyClaim: number | null;
  dailyStreak: number;
  achievements: string[];
  activities: Activity[];
};

export type ActiveModal = "energy" | "nerve" | "happy" | "health" | null;
