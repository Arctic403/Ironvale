export type MeritUpgrade = {
  id: string;
  name: string;
  description: string;
  maxRank: number;
  baseCost: number;
  effectLabel: string;
};

export const MERIT_UPGRADES: MeritUpgrade[] = [
  { id: "energy-cap", name: "Deep Reserves", description: "Increase maximum energy by 5 per rank.", maxRank: 5, baseCost: 1, effectLabel: "+5 max energy" },
  { id: "nerve-cap", name: "Cold Nerves", description: "Increase maximum nerve by 1 per rank.", maxRank: 5, baseCost: 1, effectLabel: "+1 max nerve" },
  { id: "crime-edge", name: "Street Instinct", description: "Improve crime success chance by 2% per rank.", maxRank: 5, baseCost: 2, effectLabel: "+2% crime success" },
  { id: "gym-focus", name: "Training Focus", description: "Increase gym gains by 3% per rank.", maxRank: 5, baseCost: 2, effectLabel: "+3% gym gain" },
  { id: "banker", name: "Compound Mind", description: "Increase bank interest earned by 0.2% per rank.", maxRank: 5, baseCost: 2, effectLabel: "+0.2% bank interest" },
  { id: "job-drive", name: "Career Drive", description: "Increase manual job action skill gain by 10% per rank.", maxRank: 5, baseCost: 1, effectLabel: "+10% job skill gain" },
];

export type Challenge = {
  id: string;
  name: string;
  description: string;
  metric: "crime" | "combat" | "gym" | "cash" | "travel" | "faction" | "job";
  target: number;
  rewardCash: number;
  rewardPoints: number;
  rewardMerits?: number;
};

export const DAILY_CHALLENGES: Challenge[] = [
  { id: "daily-crime", name: "Five Scores", description: "Complete 5 successful crimes.", metric: "crime", target: 5, rewardCash: 750, rewardPoints: 8 },
  { id: "daily-gym", name: "Stay Sharp", description: "Complete 3 gym sessions.", metric: "gym", target: 3, rewardCash: 500, rewardPoints: 6 },
  { id: "daily-travel", name: "Around Town", description: "Visit 3 locations.", metric: "travel", target: 3, rewardCash: 400, rewardPoints: 5 },
];

export const WEEKLY_CHALLENGES: Challenge[] = [
  { id: "weekly-crime", name: "Street Operator", description: "Complete 35 crimes.", metric: "crime", target: 35, rewardCash: 6000, rewardPoints: 35, rewardMerits: 1 },
  { id: "weekly-combat", name: "Contender", description: "Win 10 fights.", metric: "combat", target: 10, rewardCash: 8000, rewardPoints: 40, rewardMerits: 1 },
  { id: "weekly-faction", name: "Faction Loyalist", description: "Earn 100 faction reputation.", metric: "faction", target: 100, rewardCash: 5000, rewardPoints: 30, rewardMerits: 1 },
];

export type FactionDefinition = {
  id: string;
  description: string;
  specialty: string;
  ranks: { name: string; reputation: number; bonus: string }[];
  rewards: { id: string; name: string; reputation: number; points: number; itemId?: string; cash?: number }[];
};

export const FACTIONS: FactionDefinition[] = [
  {
    id: "Iron Syndicate",
    description: "A hard-edged network controlling black-market routes and high-risk scores.",
    specialty: "Crime payouts and contraband",
    ranks: [
      { name: "Associate", reputation: 0, bonus: "Faction jobs unlocked" },
      { name: "Enforcer", reputation: 75, bonus: "+5% faction work cash" },
      { name: "Lieutenant", reputation: 200, bonus: "Syndicate reward shop tier II" },
      { name: "Captain", reputation: 500, bonus: "Elite faction rewards" },
    ],
    rewards: [
      { id: "syndicate-cash", name: "Clean Cash Bundle", reputation: 50, points: 20, cash: 2500 },
      { id: "syndicate-knife", name: "Syndicate Blade", reputation: 150, points: 45, itemId: "syndicate-blade" },
    ],
  },
  {
    id: "Rift Guard",
    description: "Private security contractors who trade discipline for access and influence.",
    specialty: "Defense and heat reduction",
    ranks: [
      { name: "Recruit", reputation: 0, bonus: "Faction patrols unlocked" },
      { name: "Officer", reputation: 75, bonus: "Faction work reduces extra Heat" },
      { name: "Sergeant", reputation: 200, bonus: "Guard reward shop tier II" },
      { name: "Commander", reputation: 500, bonus: "Elite faction rewards" },
    ],
    rewards: [
      { id: "guard-clearance", name: "Heat Clearance", reputation: 50, points: 20 },
      { id: "guard-armor", name: "Guard Plate Carrier", reputation: 150, points: 45, itemId: "guard-carrier" },
    ],
  },
  {
    id: "Dock Union",
    description: "Dockworkers, haulers and fixers who know where everything in RiftCity moves.",
    specialty: "Market and logistics",
    ranks: [
      { name: "Hand", reputation: 0, bonus: "Union jobs unlocked" },
      { name: "Steward", reputation: 75, bonus: "+5% faction work cash" },
      { name: "Foreman", reputation: 200, bonus: "Union reward shop tier II" },
      { name: "Boss", reputation: 500, bonus: "Elite faction rewards" },
    ],
    rewards: [
      { id: "union-cash", name: "Overtime Envelope", reputation: 50, points: 20, cash: 2200 },
      { id: "union-tonic", name: "Union Reserve Tonic", reputation: 150, points: 35, itemId: "union-tonic" },
    ],
  },
];

export function getFaction(id: string | null | undefined) {
  return id ? FACTIONS.find((f) => f.id === id) : undefined;
}

export function getFactionRank(id: string | null | undefined, reputation: number) {
  const faction = getFaction(id);
  if (!faction) return null;
  return [...faction.ranks].reverse().find((rank) => reputation >= rank.reputation) ?? faction.ranks[0];
}

export type PropertyUpgrade = {
  id: string;
  name: string;
  description: string;
  maxRank: number;
  basePrice: number;
  benefit: string;
};

export const PROPERTY_UPGRADES: PropertyUpgrade[] = [
  { id: "bedroom", name: "Bedroom Upgrade", description: "A better place to recover after long days.", maxRank: 3, basePrice: 1500, benefit: "+10 max happiness / rank" },
  { id: "home-gym", name: "Home Gym", description: "Extra training equipment at your residence.", maxRank: 3, basePrice: 3000, benefit: "+2% gym gains / rank" },
  { id: "medical-room", name: "Medical Room", description: "Improves passive recovery and survivability.", maxRank: 3, basePrice: 4500, benefit: "+5 max health / rank" },
  { id: "security", name: "Security System", description: "Keeps attention away from your home base.", maxRank: 3, basePrice: 4000, benefit: "-2 Heat on successful crime / rank" },
  { id: "storage", name: "Storage Expansion", description: "Dedicated organized space for equipment and loot.", maxRank: 3, basePrice: 2000, benefit: "+10 storage rating / rank" },
];

export type NpcDefinition = {
  id: string;
  name: string;
  role: string;
  location: string;
  description: string;
};

export const NPCS: NpcDefinition[] = [
  { id: "mara", name: "Mara Venn", role: "Fixer", location: "city-center", description: "Knows who needs work done and who should not be trusted." },
  { id: "dax", name: "Dax Mercer", role: "Trainer", location: "gym", description: "A retired fighter who respects consistency more than talk." },
  { id: "lena", name: "Lena Cho", role: "Broker", location: "market", description: "Tracks market movement and remembers every favor." },
  { id: "torres", name: "Officer Torres", role: "Guard Liaison", location: "police", description: "Can make certain problems smaller if your reputation is good enough." },
  { id: "brick", name: "Brick Halden", role: "Dock Foreman", location: "jobs", description: "Controls crews, cargo information and overtime work." },
];

export type WorldEvent = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  effect: string;
};

export const WORLD_EVENTS: WorldEvent[] = [
  { id: "dock-strike", name: "Dock Strike", description: "Cargo movement has slowed and shortages are spreading.", durationMinutes: 30, effect: "Market trades award +1 point." },
  { id: "guard-crackdown", name: "Guard Crackdown", description: "Patrols are heavier across the city.", durationMinutes: 30, effect: "Crime Heat gain is increased by 2." },
  { id: "gym-rush", name: "Training Rush", description: "Gyms are running open-floor sessions.", durationMinutes: 30, effect: "Gym gains receive +10%." },
  { id: "hiring-boom", name: "Hiring Boom", description: "Companies are paying bonuses for productive shifts.", durationMinutes: 30, effect: "Manual work shifts pay +25%." },
  { id: "quiet-night", name: "Quiet Night", description: "The streets have cooled down for a while.", durationMinutes: 30, effect: "Successful crimes shed 2 extra Heat." },
];

export function challengeProgress(metric: Challenge["metric"], state: {
  crimesCompleted: number;
  fightsWon: number;
  gymSessions: number;
  cash: number;
  locationsVisited: string[];
  factionReputation: number;
  jobActions: number;
}) {
  switch (metric) {
    case "crime": return state.crimesCompleted;
    case "combat": return state.fightsWon;
    case "gym": return state.gymSessions;
    case "cash": return state.cash;
    case "travel": return state.locationsVisited.length;
    case "faction": return state.factionReputation;
    case "job": return state.jobActions;
  }
}

export const LOCATION_TRAITS: Record<string, string> = {
  hospital: "Medical District: passive health recovery is stronger here.",
  police: "Justice Presence: laying low removes extra Heat here.",
  bank: "Financial District: safe place to manage long-term wealth.",
  university: "University District: education and progression hub.",
  park: "Central Park: a low-pressure place to recover and explore.",
  jobs: "Business District: manual work shifts earn a local pay bonus.",
  market: "Market District: commodity trading and broker contacts are strongest here.",
  crime: "Underground: local knowledge gives a small crime-success edge.",
  gym: "Rift Fitness: training gains receive a small local boost.",
  missions: "Operations District: mission chains and city objectives converge here.",
  shops: "Commercial District: standard equipment and supplies.",
  downtown: "Downtown: high encounter density and social contacts.",
};
