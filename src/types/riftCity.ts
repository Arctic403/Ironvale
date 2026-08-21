export type Screen =
  | "city" | "crimes" | "combat" | "gym" | "jobs" | "inventory" | "shops"
  | "missions" | "education" | "property" | "character"
  | "market" | "faction" | "awards" | "progression"
  | "bank" | "hospital" | "jail" | "police" | "pharmacy" | "casino" | "nightclub"
  | "blackmarket" | "park" | "downtown" | "airport" | "wiki";

export type ActivityType =
  | "success" | "failure" | "critical" | "spooked" | "jailed"
  | "combat" | "gym" | "job" | "system";

export type Activity = {
  id: number;
  text: string;
  type: ActivityType;
  time: number;
};

export type AuctionListing = {
  id: string;
  itemId: string;
  seller: string;
  price: number;
  quantity: number;
  createdAt: number;
};

export type ActiveProduction = { id:string; recipeId:string; startedAt:number; finishesAt:number; quantity:number; };

import type { CombatStats } from "../systems/progressionSystem";

export type BankTransaction = { id: string; type: string; amount: number; time: number; note: string; };
export type BankInvestment = { id: string; tierId: string; principal: number; rate: number; startedAt: number; maturesAt: number; };

export type SaveData = {
  cash: number;
  bank: number;
  xp: number;
  bankInterest: number;
  lastBankInterest: number;
  bankSavings: number;
  bankLifetimeDeposits: number;
  bankOpenedAt: number;
  bankHistory: number[];
  bankTransactions: BankTransaction[];
  bankInvestments: BankInvestment[];
  bankRiskLastCheck: number;
  bankLosses: number;
  bankFrozenUntil: number | null;
  bankSeizures: number;
  offshoreBalance: number;
  offshoreTier: string | null;
  offshoreProtectedUntil: number | null;
  offshoreRiskLastCheck: number;
  offshoreLosses: number;
  merits: number;
  points: number;
  energy: number;
  lastEnergyUpdate: number;
  nerve: number;
  lastNerveUpdate: number;
  health: number;
  lastHealthUpdate: number;
  crimeExperience: number;
  crimeMastery: Record<string, number>;
  stats: CombatStats;
  gymExperience: number;
  gymMemberships: string[];
  activeGym: string;
  activeTrainingProgram: string;
  trainingStreak: number;
  lastTrainingAt: number | null;
  happiness: number;
  lastHappinessUpdate: number;
  currentJob: string | null;
  jobStartedAt: number;
  lastJobPayment: number;
  lastJobSkillUpdate: number;
  jobSkills: Record<string, number>;
  jobPositionTiers: Record<string, number>;
  jailUntil: number | null;
  jailStartedAt: number | null;
  jailReason: string | null;
  jailSentenceMs: number | null;
  hospitalUntil: number | null;
  hospitalStartedAt: number | null;
  hospitalReason: string | null;
  hospitalDurationMs: number | null;
  inventory: Record<string, number>;
  auctionListings: AuctionListing[];
  auctionRemovedListingIds: string[];
  productionFacilities: string[];
  activeProductions: ActiveProduction[];
  productionAttention: number;
  productionBatches: number;
  productionRaids: number;
  equippedWeapon: string | null;
  weaponSkillXp: Record<string, number>;
  equippedArmor: string | null;
  ownedProperty: string;
  propertyHoldings: Record<string, number>;
  propertyRentalEnabled: Record<string, boolean>;
  propertyRentEarned: number;
  propertyLosses: number;
  propertyLastRentAt: number;
  propertyRiskLastCheck: number;
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
  heat: number;
  playerBounty: number;
  activeCharges: string[];
  crimeIntel: string[];
  meritUpgrades: Record<string, number>;
  propertyUpgrades: Record<string, number>;
  factionLeftAt: number | null;
  factionRewardsClaimed: string[];
  npcReputation: Record<string, number>;
  challengeBaselines: Record<string, number>;
  challengesClaimed: string[];
  jobActions: number;
  marketHistory: Record<string, number[]>;
  activeWorldEvent: string | null;
  worldEventUntil: number | null;
  lastWorldEventRefresh: number;
  casinoChips: number;
  casinoActionsUsed: number;
  casinoWindowStartedAt: number;
  casinoCooldownUntil: number | null;
  casinoSessionActions: number;
  casinoReputation: number;
  casinoGamesPlayed: number;
  casinoWins: number;
  casinoBestStreak: number;
  casinoCurrentStreak: number;
  casinoJackpotPool: number;
  nightclubReputation: number;
  nightclubVisits: number;
  activities: Activity[];
};

export type ActiveModal = "energy" | "nerve" | "happy" | "health" | null;
