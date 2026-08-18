import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  MAX_ENERGY,
  ENERGY_REGEN_INTERVAL,
  NERVE_REGEN_INTERVAL,
} from "./systems/resourceSystem";

import {
  CRIMES,
  Crime,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
  randomReward,
  rollCrimeOutcome,
} from "./systems/crimeSystem";

import {
  OPPONENTS,
  Opponent,
  resolveCombat,
  calculateWinChance,
  calculateCombatPower,
  getCombatDifficulty,
  getCombatDifficultyLabel,
} from "./systems/combatSystem";

import {
  GYMS,
  Gym,
  TrainingStat,
  TRAINING_STATS,
  applyTraining,
  canTrainStat,
  getGymExperienceGain,
  getNextGym,
  gymUnlocked,
  isJailGym,
} from "./systems/gymSystem";

import {
  CombatStats,
  getLevel,
  getMaxHealth,
  getNaturalNerveMax,
} from "./systems/progressionSystem";

import {
  EDUCATION,
  ITEMS,
  JOBS,
  MISSIONS,
  PROPERTIES,
  EducationCourse,
  Item,
  Job,
  Mission,
  Property,
  getProperty,
} from "./data/gameData";

import {
  getCurrentPosition,
  formatSkillName,
  canJoinJob
} from "./jobSystem";

type Screen =
  | "city"
  | "crimes"
  | "combat"
  | "gym"
  | "jobs"
  | "items"
  | "missions"
  | "education"
  | "property"
  | "character";

type ActivityType =
  | "success"
  | "failure"
  | "spooked"
  | "jailed"
  | "combat"
  | "gym"
  | "job"
  | "system";

type Activity = {
  id: number;
  text: string;
  type: ActivityType;
  time: number;
};

type SaveData = {
  cash: number;
  xp: number;
  energy: number;
  lastEnergyUpdate: number;
  nerve: number;
  lastNerveUpdate: number;
  health: number;
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
  jailUntil: number | null;
  inventory: Record<string, number>;
  equippedWeapon: string | null;
  equippedArmor: string | null;
  ownedProperty: string | null;
  educationCompleted: string[];
  educationActive: string | null;
  educationStartedAt: number | null;
  completedMissions: string[];
  crimesCompleted: number;
  crimesFailed: number;
  crimesSpooked: number;
  timesJailed: number;
  fightsWon: number;
  fightsLost: number;
  gymSessions: number;
  activities: Activity[];
};

const SAVE_KEY = "riftcity-core-v3";
const JOB_PAY_INTERVAL = 60 * 60 * 1000;
const JAIL_BASE_MINUTES = 2;
const BASE_HAPPINESS = 100;

function getTrainingHappinessLoss(energyCost: number): number {
  const low = energyCost * 0.4;
  const high = energyCost * 0.6;
  return low + Math.random() * (high - low);
}

function freshSave(): SaveData {
  const now = Date.now();
  return {
    cash: 1000,
    xp: 0,
    energy: 100,
    lastEnergyUpdate: now,
    nerve: 10,
    lastNerveUpdate: now,
    health: 100,
    crimeExperience: 0,
    stats: { strength: 1, defense: 1, speed: 1, dexterity: 1 },
    gymExperience: 0,
    gymMemberships: ["premier-fitness"],
    activeGym: "premier-fitness",
    happiness: BASE_HAPPINESS,
    lastHappinessUpdate: now,
    currentJob: null,
    jobStartedAt: now,
    lastJobPayment: now,
    jailUntil: null,
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
    timesJailed: 0,
    fightsWon: 0,
    fightsLost: 0,
    gymSessions: 0,
    activities: [{ id: 1, text: "Welcome to RiftCity.", type: "system", time: now }],
  };
}

function loadSave(): SaveData {
  try {
    const current = localStorage.getItem(SAVE_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      const fresh = freshSave();
      return {
        ...fresh,
        ...parsed,
        stats: { ...fresh.stats, ...(parsed.stats || {}) },
        inventory: parsed.inventory || {},
        activities: parsed.activities || fresh.activities,
        educationCompleted: parsed.educationCompleted || [],
        completedMissions: parsed.completedMissions || [],
        gymExperience: typeof parsed.gymExperience === "number" ? parsed.gymExperience : 0,
        gymMemberships: Array.isArray(parsed.gymMemberships) ? parsed.gymMemberships : ["premier-fitness"],
        activeGym: parsed.activeGym || "premier-fitness",
        happiness: typeof parsed.happiness === "number" ? parsed.happiness : BASE_HAPPINESS,
        lastHappinessUpdate: typeof parsed.lastHappinessUpdate === "number" ? parsed.lastHappinessUpdate : Date.now(),
      };
    }
    const old = localStorage.getItem("riftcity-core-v2");
    if (old) {
      const oldSave = JSON.parse(old);
      const fresh = freshSave();
      return {
        ...fresh,
        cash: typeof oldSave.cash === "number" ? oldSave.cash : fresh.cash,
        xp: typeof oldSave.xp === "number" ? oldSave.xp : fresh.xp,
        energy: typeof oldSave.energy === "number" ? oldSave.energy : fresh.energy,
        nerve: typeof oldSave.nerve === "number" ? oldSave.nerve : fresh.nerve,
        health: typeof oldSave.health === "number" ? oldSave.health : fresh.health,
        crimeExperience: typeof oldSave.crimeExperience === "number" ? oldSave.crimeExperience : 0,
        stats: { ...fresh.stats, ...(oldSave.stats || {}) },
        currentJob: oldSave.currentJob || null,
        inventory: oldSave.inventory || {},
        equippedWeapon: oldSave.equippedWeapon || null,
        equippedArmor: oldSave.equippedArmor || null,
        ownedProperty: oldSave.ownedProperty || "shack",
        educationCompleted: oldSave.educationCompleted || [],
        completedMissions: oldSave.completedMissions || [],
        crimesCompleted: oldSave.crimesCompleted || 0,
        crimesFailed: oldSave.crimesFailed || 0,
        crimesSpooked: oldSave.crimesSpooked || 0,
        timesJailed: oldSave.timesJailed || 0,
        fightsWon: oldSave.fightsWon || 0,
        fightsLost: oldSave.fightsLost || 0,
      };
    }
  } catch (e) {
    print("Error parsing save data:", e)
  }
  return freshSave();
}

export function useRiftCity() {
  const [gameState, setGameState] = useState<SaveData>(() => loadSave());
  const [currentScreen, setCurrentScreen] = useState<Screen>("character");

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  const playerLevel = useMemo(() => getLevel(gameState.xp), [gameState.xp]);
  const maxHealth = useMemo(() => getMaxHealth(playerLevel), [playerLevel]);
  const maxNerve = useMemo(() => getNaturalNerveMax(gameState.crimeExperience), [gameState.crimeExperience]);
  const maxHappiness = useMemo(() => {
    const currentProp = getProperty(gameState.ownedProperty || "shack");
    return currentProp ? currentProp.maxHappiness : BASE_HAPPINESS;
  }, [gameState.ownedProperty]);

  const activeGymData = useMemo(() => {
    return GYMS.find((g) => g.id === gameState.activeGym) || GYMS[0];
  }, [gameState.activeGym]);

  const activeJobData = useMemo(() => {
    return JOBS.find((j) => j.id === gameState.currentJob) || null;
  }, [gameState.currentJob]);

  const activeCourseData = useMemo(() => {
    return EDUCATION.find((c) => c.id === gameState.educationActive) || null;
  }, [gameState.educationActive]);

  const logActivity = (text: string, type: ActivityType) => {
    setGameState((prev) => ({
      ...prev,
      activities: [
        {
          id: Date.now() + Math.random(),
          text,
          type,
          time: Date.now(),
        },
        ...prev.activities.slice(0, 49),
      ],
    }));
  };

  useEffect(() => {
    const ticker = setInterval(() => {
      const now = Date.now();
      setGameState((prev) => {
        let updated = { ...prev };
        let stateChanged = false;

        if (updated.jailUntil && now >= updated.jailUntil) {
          updated.jailUntil = null;
          stateChanged = true;
          setTimeout(() => logActivity("You have been released from jail.", "system"), 0);
        }

        if (updated.energy < MAX_ENERGY && now - updated.lastEnergyUpdate >= ENERGY_REGEN_INTERVAL) {
          const energyTicks = Math.floor((now - updated.lastEnergyUpdate) / ENERGY_REGEN_INTERVAL);
          updated.energy = Math.min(MAX_ENERGY, updated.energy + energyTicks);
          updated.lastEnergyUpdate = updated.lastEnergyUpdate + energyTicks * ENERGY_REGEN_INTERVAL;
          stateChanged = true;
        }

        if (updated.nerve < maxNerve && now - updated.lastNerveUpdate >= NERVE_REGEN_INTERVAL) {
          const nerveTicks = Math.floor((now - updated.lastNerveUpdate) / NERVE_REGEN_INTERVAL);
          updated.nerve = Math.min(maxNerve, updated.nerve + nerveTicks);
          updated.lastNerveUpdate = updated.lastNerveUpdate + nerveTicks * NERVE_REGEN_INTERVAL;
          stateChanged = true;
        }

        const HAPPINESS_TICK_INTERVAL = 15 * 60 * 1000;
        if (updated.happiness < maxHappiness && now - updated.lastHappinessUpdate >= HAPPINESS_TICK_INTERVAL) {
          const happyTicks = Math.floor((now - updated.lastHappinessUpdate) / HAPPINESS_TICK_INTERVAL);
          const restoreAmount = Math.max(5, Math.floor(maxHappiness * 0.05)) * happyTicks;
          updated.happiness = Math.min(maxHappiness, updated.happiness + restoreAmount);
          updated.lastHappinessUpdate = updated.lastHappinessUpdate + happyTicks * HAPPINESS_TICK_INTERVAL;
          stateChanged = true;
        }

        if (updated.currentJob && now - updated.lastJobPayment >= JOB_PAY_INTERVAL) {
          const payTicks = Math.floor((now - updated.lastJobPayment) / JOB_PAY_INTERVAL);
          if (activeJobData) {
            updated.cash += activeJobData.payPerInterval * payTicks;
            updated.lastJobPayment = updated.lastJobPayment + payTicks * JOB_PAY_INTERVAL;
            stateChanged = true;
            setTimeout(() => logActivity(`Received salary of $${activeJobData.payPerInterval * payTicks}.`, "job"), 0);
          }
        }

        if (updated.health < maxHealth && !updated.jailUntil) {
          updated.health = Math.min(maxHealth, updated.health + 2);
          stateChanged = true;
        }

        return stateChanged ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(ticker);
  }, [maxNerve, maxHappiness, maxHealth, activeJobData]);

  const commitCrime = (crime: Crime) => {
    if (gameState.jailUntil) return logActivity("You cannot commit crimes while in jail.", "system");
    if (gameState.nerve < crime.nerveCost) return logActivity("Not enough nerve.", "system");

    setGameState((prev) => {
      const outcome = rollCrimeOutcome(crime, prev.crimeExperience, prev.stats);
      let updated = { ...prev, nerve: prev.nerve - crime.nerveCost };

      if (outcome.type === "success") {
        updated.crimesCompleted += 1;
        updated.cash += outcome.cashReward || 0;
        updated.xp += outcome.xpReward || 0;
        updated.crimeExperience += crime.crimeXpGain;
        if (outcome.itemReward) {
          updated.inventory[outcome.itemReward] = (updated.inventory[outcome.itemReward] || 0) + 1;
        }
        setTimeout(() => logActivity(`Success! ${crime.successText}.`, "success"), 0);
      } else if (outcome.type === "spooked") {
        updated.crimesSpooked += 1;
        setTimeout(() => logActivity(`Spooked!`, "spooked"), 0);
      } else {
        updated.crimesFailed += 1;
        if (outcome.jailed) {
          updated.timesJailed += 1;
          updated.jailUntil = Date.now() + JAIL_BASE_MINUTES * 60 * 1000;
          setTimeout(() => logActivity(`Busted! Sent to jail.`, "jailed"), 0);
        } else {
          setTimeout(() => logActivity(`Failed!`, "failure"), 0);
        }
      }
      return updated;
    });
  };

  const trainGymStat = (stat: TrainingStat, energyAmount: number) => {
    if (gameState.jailUntil) return logActivity("You cannot train while in jail.", "system");
    if (gameState.energy < energyAmount) return logActivity("Not enough energy.", "system");
    if (!activeGymData || !canTrainStat(activeGymData, stat)) return logActivity("Cannot train that stat here.", "system");

    setGameState((prev) => {
      let updated = { ...prev };
      updated.energy -= energyAmount;
      updated.gymSessions += 1;
      const happyLoss = getTrainingHappinessLoss(energyAmount);
      updated.happiness = Math.max(0, updated.happiness - happyLoss);
      updated.stats = applyTraining(updated.stats, stat, energyAmount, updated.happiness, activeGymData);
      updated.gymExperience += getGymExperienceGain(energyAmount, activeGymData);

      const nextGym = getNextGym(updated.gymExperience);
      if (nextGym && !updated.gymMemberships.includes(nextGym.id)) {
        updated.gymMemberships.push(nextGym.id);
        updated.activeGym = nextGym.id;
      }
      return updated;
    });
    logActivity(`Trained ${stat} in ${activeGymData.name}.`, "gym");
  };

  return {
    gameState,
    setGameState,
    currentScreen,
    setCurrentScreen,
    playerLevel,
    maxHealth,
    maxNerve,
    maxHappiness,
    activeGymData,
    activeJobData,
    activeCourseData,
    commitCrime,
    trainGymStat,
    logActivity,
    resetGame: () => setGameState(freshSave()),
  };
}
