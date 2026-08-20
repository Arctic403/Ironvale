import { GAME_CONFIG, DEFAULT_MARKET_PRICES, SAVE_KEY } from "../constants/gameConfig";
import type { SaveData } from "../types/riftCity";

export function freshSave(): SaveData {
  const now = Date.now();
  return {
    cash: 1000, bank: 0, xp: 0, bankInterest: 0, lastBankInterest: now,
    merits: 0, points: 0, energy: 100, lastEnergyUpdate: now,
    nerve: 10, lastNerveUpdate: now, health: 100, lastHealthUpdate: now,
    crimeExperience: 0, stats: { strength: 5, defense: 5, speed: 5, dexterity: 5 },
    gymExperience: 0, gymMemberships: ["premier-fitness"], activeGym: "premier-fitness",
    happiness: GAME_CONFIG.BASE_HAPPINESS, lastHappinessUpdate: now,
    currentJob: null, jobStartedAt: now, lastJobPayment: now, lastJobSkillUpdate: now,
    jobSkills: {}, jobPositionTiers: {}, jailUntil: null, hospitalUntil: null,
    inventory: {}, equippedWeapon: null, equippedArmor: null, ownedProperty: "shack",
    educationCompleted: [], educationActive: null, educationStartedAt: null,
    completedMissions: [], crimesCompleted: 0, crimesFailed: 0, crimesSpooked: 0,
    crimesCritical: 0, timesJailed: 0, fightsWon: 0, fightsLost: 0, gymSessions: 0,
    attacks: 0, locationsVisited: ["city-center"], currentLocation: "city-center",
    travelCooldownUntil: null, faction: null, factionReputation: 0,
    company: null, companyReputation: 0, market: { ...DEFAULT_MARKET_PRICES },
    lastMarketUpdate: now, lastDailyClaim: null, dailyStreak: 0, achievements: [],
    heat: 0, crimeIntel: [], meritUpgrades: {}, propertyUpgrades: {}, factionLeftAt: null,
    factionRewardsClaimed: [], npcReputation: {}, challengeBaselines: {},
    challengesClaimed: [], jobActions: 0,
    marketHistory: Object.fromEntries(Object.entries(DEFAULT_MARKET_PRICES).map(([id, price]) => [id, [price]])),
    activeWorldEvent: null, worldEventUntil: null, lastWorldEventRefresh: 0,
    activities: [{ id: now, text: "Welcome to RiftCity.", type: "system", time: now }],
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw);
    const base = freshSave();
    return {
      ...base,
      ...parsed,
      stats: { ...base.stats, ...(parsed.stats || {}) },
      inventory: { ...(parsed.inventory || {}) },
      activities: Array.isArray(parsed.activities) && parsed.activities.length ? parsed.activities : base.activities,
      gymMemberships: Array.isArray(parsed.gymMemberships) ? parsed.gymMemberships : base.gymMemberships,
      educationCompleted: Array.isArray(parsed.educationCompleted) ? parsed.educationCompleted : [],
      completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      locationsVisited: Array.isArray(parsed.locationsVisited) ? parsed.locationsVisited : ["city-center"],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      factionRewardsClaimed: Array.isArray(parsed.factionRewardsClaimed) ? parsed.factionRewardsClaimed : [],
      crimeIntel: Array.isArray(parsed.crimeIntel) ? parsed.crimeIntel : [],
      challengesClaimed: Array.isArray(parsed.challengesClaimed) ? parsed.challengesClaimed : [],
      market: { ...DEFAULT_MARKET_PRICES, ...(parsed.market || {}) },
      marketHistory: { ...base.marketHistory, ...(parsed.marketHistory || {}) },
      jobSkills: { ...(parsed.jobSkills || {}) },
      jobPositionTiers: { ...(parsed.jobPositionTiers || {}) },
      meritUpgrades: { ...(parsed.meritUpgrades || {}) },
      propertyUpgrades: { ...(parsed.propertyUpgrades || {}) },
      npcReputation: { ...(parsed.npcReputation || {}) },
      challengeBaselines: { ...(parsed.challengeBaselines || {}) },
      heat: Math.max(0, Number(parsed.heat) || 0),
      jobActions: Math.max(0, Number(parsed.jobActions) || 0),
      lastHealthUpdate: typeof parsed.lastHealthUpdate === "number" ? parsed.lastHealthUpdate : base.lastHealthUpdate,
      lastJobSkillUpdate: typeof parsed.lastJobSkillUpdate === "number" ? parsed.lastJobSkillUpdate : base.lastJobSkillUpdate,
      lastMarketUpdate: typeof parsed.lastMarketUpdate === "number" ? parsed.lastMarketUpdate : base.lastMarketUpdate,
    };
  } catch {
    return freshSave();
  }
}
