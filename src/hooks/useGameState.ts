/**
 * Game State Management Hook
 * Handles save/load/reset of game data
 */

import { useState, useEffect } from "react";
import { SaveData, CombatStats } from "@/types/game";
import { GAME_CONFIG, SAVE_KEY, DEFAULT_MARKET_PRICES } from "@/constants/gameConfig";

export function useGameState() {
  const [gameState, setGameState] = useState<SaveData>(() => loadSave());

  // Auto-save on state changes
  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  return {
    gameState,
    setGameState,
  };
}

function freshSave(): SaveData {
  const now = Date.now();

  return {
    cash: 1000,
    bank: 0,
    xp: 0,
    bankInterest: 0,
    lastBankInterest: now,
    merits: 0,
    points: 0,
    energy: GAME_CONFIG.MAX_ENERGY,
    lastEnergyUpdate: now,
    nerve: 10,
    lastNerveUpdate: now,
    health: 100,
    crimeExperience: 0,
    stats: {
      strength: 5,
      defense: 5,
      speed: 5,
      dexterity: 5,
    },
    gymExperience: 0,
    gymMemberships: ["premier-fitness"],
    activeGym: "premier-fitness",
    happiness: GAME_CONFIG.BASE_HAPPINESS,
    lastHappinessUpdate: now,
    currentJob: null,
    jobStartedAt: now,
    lastJobPayment: now,
    jailUntil: null,
    hospitalUntil: null,
    inventory: {},
    equippedWeapon: null,
    equippedArmor: null,
    ownedProperty: "shack",
    educationCompleted: [],
    educationActive: null,
    educationStartedAt: null,
    completedMissions: [],
    crimesCompleted: 0,
    crimesFailed: 0,
    crimesSpooked: 0,
    crimesCritical: 0,
    timesJailed: 0,
    fightsWon: 0,
    fightsLost: 0,
    gymSessions: 0,
    attacks: 0,
    locationsVisited: ["city-center"],
    currentLocation: "city-center",
    travelCooldownUntil: null,
    faction: null,
    factionReputation: 0,
    company: null,
    companyReputation: 0,
    market: { ...DEFAULT_MARKET_PRICES },
    lastDailyClaim: null,
    dailyStreak: 0,
    achievements: [],
    activities: [
      {
        id: now,
        text: "Welcome to RiftCity.",
        type: "system",
        time: now,
      },
    ],
  };
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);

    if (!raw) {
      return freshSave();
    }

    const base = freshSave();
    const parsed = JSON.parse(raw);

    return {
      ...base,
      ...parsed,
      stats: {
        ...base.stats,
        ...(parsed.stats || {}),
      },
      inventory: {
        ...(parsed.inventory || {}),
      },
      activities:
        Array.isArray(parsed.activities) && parsed.activities.length
          ? parsed.activities
          : base.activities,
      gymMemberships: Array.isArray(parsed.gymMemberships)
        ? parsed.gymMemberships
        : base.gymMemberships,
      educationCompleted: Array.isArray(parsed.educationCompleted)
        ? parsed.educationCompleted
        : [],
      completedMissions: Array.isArray(parsed.completedMissions)
        ? parsed.completedMissions
        : [],
      locationsVisited: Array.isArray(parsed.locationsVisited)
        ? parsed.locationsVisited
        : ["city-center"],
      achievements: Array.isArray(parsed.achievements)
        ? parsed.achievements
        : [],
      market: {
        ...DEFAULT_MARKET_PRICES,
        ...(parsed.market || {}),
      },
      lastBankInterest:
        typeof parsed.lastBankInterest === "number"
          ? parsed.lastBankInterest
          : base.lastBankInterest,
      lastEnergyUpdate:
        typeof parsed.lastEnergyUpdate === "number"
          ? parsed.lastEnergyUpdate
          : base.lastEnergyUpdate,
      lastNerveUpdate:
        typeof parsed.lastNerveUpdate === "number"
          ? parsed.lastNerveUpdate
          : base.lastNerveUpdate,
      lastHappinessUpdate:
        typeof parsed.lastHappinessUpdate === "number"
          ? parsed.lastHappinessUpdate
          : base.lastHappinessUpdate,
      lastJobPayment:
        typeof parsed.lastJobPayment === "number"
          ? parsed.lastJobPayment
          : base.lastJobPayment,
    };
  } catch {
    return freshSave();
  }
}

export function createFreshSave(): SaveData {
  return freshSave();
}
