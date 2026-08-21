export type CrimeFamily = "theft" | "burglary" | "vehicle" | "fraud" | "street" | "organized";
export type TargetCrimeKind = "pickpocket" | "burglary" | "vehicle";

export type CrimeTarget = {
  id: string;
  kind: TargetCrimeKind;
  name: string;
  area: string;
  profile: string;
  difficulty: number;
  nerve: number;
  minReward: number;
  maxReward: number;
  heat: number;
  family: CrimeFamily;
  hint: string;
};

export type CrimeOperationDefinition = {
  id: string;
  name: string;
  description: string;
  family: CrimeFamily;
  crimeExperienceRequired: number;
  setupCost: number;
  nerve: number;
  durationMs: number;
  minReward: number;
  maxReward: number;
  heat: number;
  detectionRisk: number;
  icon: "chip" | "envelope" | "package" | "garage" | "cash";
};

export type GraffitiSpot = {
  id: string;
  name: string;
  district: string;
  description: string;
  reputationRequired: number;
  nerve: number;
  paintCost: number;
  difficulty: number;
  reputationGain: number;
  heat: number;
  cooldownMs: number;
};

export const CRIME_FAMILY_LABELS: Record<CrimeFamily, string> = {
  theft: "Street Theft",
  burglary: "Burglary",
  vehicle: "Vehicle Crime",
  fraud: "Fraud",
  street: "Street Art",
  organized: "Organized Crime",
};

export function crimeFamilyLevel(xp: number) {
  const safe = Math.max(0, Number(xp) || 0);
  return Math.min(100, 1 + Math.floor(Math.sqrt(safe / 25)));
}

export function crimeFamilyProgress(xp: number) {
  const safe = Math.max(0, Number(xp) || 0);
  const level = crimeFamilyLevel(safe);
  if (level >= 100) return 100;
  const floorXp = Math.pow(level - 1, 2) * 25;
  const nextXp = Math.pow(level, 2) * 25;
  return Math.max(0, Math.min(100, ((safe - floorXp) / Math.max(1, nextXp - floorXp)) * 100));
}

export function crimeFamilyForLegacyCrime(crimeId: string): CrimeFamily {
  if (["pickpocket", "shoplift", "package-swipe"].includes(crimeId)) return "theft";
  if (["burglary", "cargo-theft"].includes(crimeId)) return "burglary";
  if (crimeId === "vehicle-theft") return "vehicle";
  if (crimeId === "data-breach") return "fraud";
  return "organized";
}

const TARGET_POOLS: Record<TargetCrimeKind, Array<Omit<CrimeTarget, "id" | "kind" | "family">>> = {
  pickpocket: [
    { name: "Distracted Commuter", area: "Metro Concourse", profile: "Low-value / low attention", difficulty: 18, nerve: 2, minReward: 45, maxReward: 130, heat: 1, hint: "Usually easy to read, but the payout is modest." },
    { name: "Weekend Tourist", area: "City Center", profile: "Cash-heavy visitor", difficulty: 25, nerve: 2, minReward: 80, maxReward: 240, heat: 2, hint: "Better cash potential with a little more attention around them." },
    { name: "Nightlife Regular", area: "Entertainment Strip", profile: "Unpredictable target", difficulty: 32, nerve: 3, minReward: 120, maxReward: 360, heat: 3, hint: "Higher variance: sometimes excellent, sometimes not worth the risk." },
    { name: "Luxury Shopper", area: "Financial District", profile: "High-value target", difficulty: 43, nerve: 4, minReward: 220, maxReward: 620, heat: 5, hint: "A strong score if your Theft skill can handle the attention." },
    { name: "Private Courier", area: "Commerce Row", profile: "Rare valuables possible", difficulty: 52, nerve: 5, minReward: 300, maxReward: 850, heat: 6, hint: "Difficult to approach, but the ceiling is much higher." },
    { name: "VIP Guest", area: "Nightclub District", profile: "Elite target", difficulty: 63, nerve: 6, minReward: 480, maxReward: 1250, heat: 8, hint: "Designed for experienced thieves, not fresh characters." },
  ],
  burglary: [
    { name: "Studio Apartment", area: "Residential Block", profile: "Basic security", difficulty: 28, nerve: 4, minReward: 180, maxReward: 520, heat: 3, hint: "Low-end property with a short exposure window." },
    { name: "Townhouse", area: "Northside", profile: "Moderate security", difficulty: 37, nerve: 5, minReward: 300, maxReward: 820, heat: 5, hint: "A balanced target for building Burglary skill." },
    { name: "Collector Condo", area: "Financial District", profile: "Valuables reported", difficulty: 47, nerve: 6, minReward: 520, maxReward: 1450, heat: 7, hint: "Worth scouting before committing Nerve to the attempt." },
    { name: "Executive Penthouse", area: "Downtown", profile: "High security", difficulty: 59, nerve: 8, minReward: 900, maxReward: 2700, heat: 10, hint: "Big payout, high exposure and a poor beginner target." },
    { name: "Warehouse Office", area: "Industrial District", profile: "Commercial valuables", difficulty: 50, nerve: 7, minReward: 650, maxReward: 1900, heat: 8, hint: "Commercial targets lean toward larger but less predictable scores." },
  ],
  vehicle: [
    { name: "Aging Compact", area: "Southside", profile: "Low resale value", difficulty: 30, nerve: 4, minReward: 260, maxReward: 620, heat: 4, hint: "A reasonable first Vehicle Crime target." },
    { name: "Sport Coupe", area: "Entertainment Strip", profile: "Desirable resale", difficulty: 42, nerve: 6, minReward: 620, maxReward: 1500, heat: 7, hint: "Higher demand makes the score worthwhile, but attention rises quickly." },
    { name: "Luxury Sedan", area: "Financial District", profile: "Premium target", difficulty: 51, nerve: 7, minReward: 1000, maxReward: 2600, heat: 9, hint: "High-value vehicle with a much tougher skill check." },
    { name: "Performance SUV", area: "Northside", profile: "High demand", difficulty: 57, nerve: 8, minReward: 1350, maxReward: 3300, heat: 11, hint: "A mid-game vehicle score with serious Heat potential." },
    { name: "Collector Car", area: "Private Garage Row", profile: "Rare market demand", difficulty: 68, nerve: 10, minReward: 2400, maxReward: 6000, heat: 14, hint: "A late-game target intended for specialists." },
  ],
};

function seeded(seed: number) {
  let value = (seed >>> 0) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function kindSalt(kind: TargetCrimeKind) {
  return kind === "pickpocket" ? 9187 : kind === "burglary" ? 27103 : 51047;
}

export function crimeTargetBoardSeed(now = Date.now()) {
  return Math.floor(now / (5 * 60 * 1000));
}

export function buildCrimeTargets(kind: TargetCrimeKind, boardSeed = crimeTargetBoardSeed()): CrimeTarget[] {
  const pool = TARGET_POOLS[kind];
  const random = seeded(boardSeed * kindSalt(kind));
  const shuffled = pool.map((target) => ({ target, key: random() })).sort((a, b) => a.key - b.key);
  return shuffled.slice(0, Math.min(4, pool.length)).map(({ target }, index) => {
    const variance = 0.9 + random() * 0.22;
    const difficultyShift = Math.round((random() - 0.5) * 6);
    return {
      ...target,
      id: `${kind}-${boardSeed}-${index}-${target.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      kind,
      family: kind === "pickpocket" ? "theft" : kind === "burglary" ? "burglary" : "vehicle",
      difficulty: Math.max(10, target.difficulty + difficultyShift),
      minReward: Math.max(1, Math.round(target.minReward * variance)),
      maxReward: Math.max(2, Math.round(target.maxReward * variance)),
    };
  });
}

export function targetSuccessChance(target: CrimeTarget, skillXp: number, dexterity: number, heat: number, scouted: boolean, streetReputation = 0) {
  const skill = crimeFamilyLevel(skillXp);
  const repBonus = Math.min(5, Math.floor(Math.max(0, streetReputation) / 25));
  const scoutBonus = scouted ? 9 : 0;
  const value = 79 - target.difficulty * 0.72 + skill * 1.25 + Math.min(22, dexterity * 0.42) - heat * 0.16 + scoutBonus + repBonus;
  return Math.max(8, Math.min(94, value));
}

export const CRIME_OPERATIONS: CrimeOperationDefinition[] = [
  {
    id: "card-skimming",
    name: "Card Skimming Operation",
    description: "Deploy an abstract illicit payment-data operation and let it run in the background. The game models setup, time, payout and detection only—no real-world technique.",
    family: "fraud",
    crimeExperienceRequired: 55,
    setupCost: 350,
    nerve: 3,
    durationMs: 2 * 60 * 1000,
    minReward: 750,
    maxReward: 1900,
    heat: 5,
    detectionRisk: 16,
    icon: "chip",
  },
  {
    id: "email-fraud",
    name: "Email Fraud Campaign",
    description: "Fund a fictional campaign that resolves passively after a timer. Better Fraud skill improves the expected return and lowers detection pressure.",
    family: "fraud",
    crimeExperienceRequired: 90,
    setupCost: 650,
    nerve: 4,
    durationMs: 4 * 60 * 1000,
    minReward: 1400,
    maxReward: 3600,
    heat: 7,
    detectionRisk: 20,
    icon: "envelope",
  },
  {
    id: "counterfeit-run",
    name: "Counterfeit Goods Run",
    description: "Finance a fictional black-market goods run. It takes longer, costs more to start and pays out when the operation finishes.",
    family: "organized",
    crimeExperienceRequired: 145,
    setupCost: 1400,
    nerve: 5,
    durationMs: 6 * 60 * 1000,
    minReward: 3000,
    maxReward: 7200,
    heat: 9,
    detectionRisk: 23,
    icon: "package",
  },
  {
    id: "chop-shop",
    name: "Chop Shop Queue",
    description: "Put a stolen-vehicle processing job into a fictional underground shop queue. Vehicle Crime skill improves the final margin.",
    family: "vehicle",
    crimeExperienceRequired: 190,
    setupCost: 2100,
    nerve: 6,
    durationMs: 8 * 60 * 1000,
    minReward: 4800,
    maxReward: 10500,
    heat: 11,
    detectionRisk: 25,
    icon: "garage",
  },
  {
    id: "protection-racket",
    name: "Protection Collection",
    description: "Start a fictional organized-crime collection cycle. It is expensive and slow, but designed as a late-game passive criminal income stream.",
    family: "organized",
    crimeExperienceRequired: 300,
    setupCost: 5000,
    nerve: 8,
    durationMs: 12 * 60 * 1000,
    minReward: 9000,
    maxReward: 21000,
    heat: 15,
    detectionRisk: 29,
    icon: "cash",
  },
];

export const GRAFFITI_SPOTS: GraffitiSpot[] = [
  { id: "rail-wall", name: "Rail Yard Wall", district: "Industrial District", description: "A low-pressure wall where unknown players can start building a name.", reputationRequired: 0, nerve: 1, paintCost: 25, difficulty: 16, reputationGain: 3, heat: 1, cooldownMs: 45 * 1000 },
  { id: "underpass", name: "East Underpass", district: "Southside", description: "More foot traffic means more recognition and a little more attention.", reputationRequired: 8, nerve: 2, paintCost: 45, difficulty: 24, reputationGain: 5, heat: 2, cooldownMs: 75 * 1000 },
  { id: "market-shutters", name: "Market Shutters", district: "Commerce Row", description: "A visible spot that starts putting your tag in front of the wider city.", reputationRequired: 20, nerve: 2, paintCost: 70, difficulty: 31, reputationGain: 7, heat: 3, cooldownMs: 2 * 60 * 1000 },
  { id: "club-alley", name: "Nightclub Alley", district: "Entertainment Strip", description: "A popular wall with strong exposure among nightlife regulars and contacts.", reputationRequired: 45, nerve: 3, paintCost: 120, difficulty: 40, reputationGain: 10, heat: 4, cooldownMs: 3 * 60 * 1000 },
  { id: "rooftop", name: "Downtown Rooftop", district: "Downtown", description: "A high-visibility location for established names with enough Street Rep.", reputationRequired: 80, nerve: 4, paintCost: 220, difficulty: 50, reputationGain: 14, heat: 6, cooldownMs: 5 * 60 * 1000 },
  { id: "financial-display", name: "Financial District Display", district: "Financial District", description: "A notorious prestige spot. It gives major reputation but attracts serious Heat.", reputationRequired: 140, nerve: 5, paintCost: 400, difficulty: 62, reputationGain: 20, heat: 9, cooldownMs: 8 * 60 * 1000 },
];

export function graffitiRank(reputation: number) {
  if (reputation >= 300) return "City Legend";
  if (reputation >= 180) return "Notorious";
  if (reputation >= 100) return "Citywide Name";
  if (reputation >= 55) return "Known";
  if (reputation >= 20) return "Local Name";
  if (reputation >= 6) return "Tagger";
  return "Unknown";
}

export function graffitiSuccessChance(spot: GraffitiSpot, streetSkillXp: number, dexterity: number, heat: number, streetReputation: number) {
  const skill = crimeFamilyLevel(streetSkillXp);
  const rep = Math.min(10, Math.floor(streetReputation / 20));
  const value = 88 - spot.difficulty * 0.62 + skill * 1.15 + Math.min(16, dexterity * 0.3) + rep - heat * 0.14;
  return Math.max(12, Math.min(96, value));
}

export function randomCrimeReward(min: number, max: number) {
  return Math.floor(min + Math.random() * Math.max(1, max - min + 1));
}
