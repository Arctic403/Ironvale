import React, { useEffect, useState } from "react";
import {
  CRIMES,
  Crime,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
  randomReward,
} from "./systems/crimeSystem";
import {
  CombatStats,
  getLevel,
  getMaxHealth,
} from "./systems/progressionSystem";
import {
  ENERGY_REGEN_INTERVAL,
  MAX_ENERGY,
  NERVE_REGEN_INTERVAL,
} from "./systems/resourceSystem";
import {
  GYMS,
  TRAINING_STATS,
  TrainingStat,
  applyTraining,
  canTrainStat,
  getGymExperienceGain,
  gymUnlocked,
} from "./systems/gymSystem";
import {
  DEFAULT_WEAPONS,
  PLAYER_PROFILES,
  PlayerProfile,
  calculateWinChance,
  simulateCombat,
} from "./systems/combatSystem";
import { InteractiveCombatView } from "./views/Combat";
import {
  EDUCATION,
  ITEMS,
  JOBS,
  MISSIONS,
  PROPERTIES,
  getItem,
  getJob,
  getProperty,
} from "./data/gameData";

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
  | "character"
  | "market"
  | "faction"
  | "awards";

type ActivityType =
  | "success"
  | "failure"
  | "critical"
  | "spooked"
  | "jailed"
  | "combat"
  | "gym"
  | "job"
  | "system";

type Activity = { id: number; text: string; type: ActivityType; time: number };

type Encounter = {
  id: string;
  title: string;
  text: string;
  choices: {
    label: string;
    cash?: number;
    xp?: number;
    health?: number;
    energy?: number;
    nerve?: number;
    text: string;
  }[];
};

type SaveData = {
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
  lastDailyClaim: number | null;
  dailyStreak: number;
  achievements: string[];
  activities: Activity[];
};

type ActiveModal = "energy" | "nerve" | "happy" | "health" | null;

const SAVE_KEY = "riftcity-core-v5";
const JOB_PAY_INTERVAL = 60 * 60 * 1000;
const HAPPINESS_TICK = 15 * 60 * 1000;
const HEALTH_REGEN_INTERVAL = 60 * 1000;
const JAIL_MINUTES = 2;
const HOSPITAL_MINUTES = 2;
const BASE_HAPPINESS = 100;
const BANK_INTEREST_INTERVAL = 24 * 60 * 60 * 1000;
const DAILY_INTERVAL = 24 * 60 * 60 * 1000;
const TRAVEL_COOLDOWN = 30 * 1000;
const TRAVEL_COST = 25;

const LOCATIONS = [
  ["city-center", "City Center", "Banks, shops, jobs and the busiest streets."],
  ["industrial", "Industrial District", "Factories, warehouses and rougher encounters."],
  ["suburbs", "Suburbs", "Quiet streets and expensive property."],
  ["docks", "The Docks", "Black-market deals and high-risk opportunities."],
] as const;

const ENCOUNTERS: Encounter[] = [
  {
    id: "lost-wallet",
    title: "A Wallet on the Pavement",
    text: "You notice a wallet sitting beside a bench. Humanity has apparently invented another tiny moral exam.",
    choices: [
      { label: "Return it", xp: 12, text: "You return the wallet. The owner rewards your honesty." },
      { label: "Keep the cash", cash: 180, nerve: 1, text: "You pocket the cash and leave before anyone notices." },
    ],
  },
  {
    id: "street-deal",
    title: "A Quiet Offer",
    text: "A stranger offers a quick deal that could pay well, assuming your luck has decided to cooperate.",
    choices: [
      { label: "Take the deal", cash: 450, xp: 18, health: -8, text: "The deal works, although it leaves you nursing a bruise." },
      { label: "Walk away", xp: 5, text: "You decide that mysterious strangers are rarely an investment strategy." },
    ],
  },
  {
    id: "runner",
    title: "Courier Wanted",
    text: "Someone needs a package moved across town. No questions, apparently, because questions are inconvenient.",
    choices: [
      { label: "Take the run", cash: 240, energy: -10, xp: 10, text: "You deliver the package and collect the fee." },
      { label: "Decline", text: "You keep walking." },
    ],
  },
];

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
    energy: 100,
    lastEnergyUpdate: now,
    nerve: 10,
    lastNerveUpdate: now,
    health: 100,
    crimeExperience: 0,
    stats: { strength: 5, defense: 5, speed: 5, dexterity: 5 },
    gymExperience: 0,
    gymMemberships: ["premier-fitness"],
    activeGym: "premier-fitness",
    happiness: BASE_HAPPINESS,
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
    market: { food: 100, electronics: 250, scrap: 60, medical: 180 },
    lastDailyClaim: null,
    dailyStreak: 0,
    achievements: [],
    activities: [{ id: Date.now(), text: "Welcome to RiftCity.", type: "system", time: now }],
  };
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const base = freshSave();
    const parsed = JSON.parse(raw);
    return {
      ...base,
      ...parsed,
      stats: { ...base.stats, ...(parsed.stats || {}) },
      inventory: parsed.inventory || {},
      activities: Array.isArray(parsed.activities) ? parsed.activities : base.activities,
      gymMemberships: Array.isArray(parsed.gymMemberships) ? parsed.gymMemberships : base.gymMemberships,
      educationCompleted: Array.isArray(parsed.educationCompleted) ? parsed.educationCompleted : [],
      completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      locationsVisited: Array.isArray(parsed.locationsVisited) ? parsed.locationsVisited : ["city-center"],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      market: parsed.market || base.market,
      lastBankInterest: typeof parsed.lastBankInterest === "number" ? parsed.lastBankInterest : base.lastBankInterest,
    };
  } catch {
    return freshSave();
  }
}

function money(n: number) {
  return `$${Math.max(0, Math.floor(n)).toLocaleString()}`;
}

function timeLeft(until: number | null) {
  return until ? Math.max(0, until - Date.now()) : 0;
}

function formatTime(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function useRiftCity() {
  const [gameState, setGameState] = useState<SaveData>(() => loadSave());
  const [currentScreen, setCurrentScreen] = useState<Screen>("character");
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [combatOpponent, setCombatOpponent] = useState<PlayerProfile | null>(null);
  const [combatMessage, setCombatMessage] = useState("Choose an opponent.");

  const level = getLevel(gameState.xp).level;
  const property = getProperty(gameState.ownedProperty);
  const maxHealth = getMaxHealth(property?.maxHealthBonus ?? 0);
  const maxNerve = 10 + Math.min(50, Math.floor(gameState.crimeExperience / 100) * 5) + (property?.nerveBonus ?? 0);
  const gym = GYMS.find((g) => g.id === gameState.activeGym) ?? GYMS[0];
  const job = getJob(gameState.currentJob);
  const education = EDUCATION.find((e) => e.id === gameState.educationActive) ?? null;
  const travelLocked = Boolean(gameState.travelCooldownUntil && gameState.travelCooldownUntil > Date.now());

  const log = (text: string, type: ActivityType = "system") =>
    setGameState((s) => ({
      ...s,
      activities: [{ id: Date.now() + Math.random(), text, type, time: Date.now() }, ...s.activities].slice(0, 60),
    }));

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setGameState((prev) => {
        let s = { ...prev };
        let changed = false;
        if (s.energy < MAX_ENERGY) {
          const ticks = Math.floor((now - s.lastEnergyUpdate) / ENERGY_REGEN_INTERVAL);
          if (ticks > 0) {
            s.energy = Math.min(MAX_ENERGY, s.energy + ticks);
            s.lastEnergyUpdate += ticks * ENERGY_REGEN_INTERVAL;
            changed = true;
          }
        } else s.lastEnergyUpdate = now;

        if (s.nerve < maxNerve) {
          const ticks = Math.floor((now - s.lastNerveUpdate) / NERVE_REGEN_INTERVAL);
          if (ticks > 0) {
            s.nerve = Math.min(maxNerve, s.nerve + ticks);
            s.lastNerveUpdate += ticks * NERVE_REGEN_INTERVAL;
            changed = true;
          }
        } else s.lastNerveUpdate = now;

        if (s.happiness < (property?.maxHappiness ?? 100)) {
          const ticks = Math.floor((now - s.lastHappinessUpdate) / HAPPINESS_TICK);
          if (ticks > 0) {
            s.happiness = Math.min(property?.maxHappiness ?? 100, s.happiness + ticks * 5);
            s.lastHappinessUpdate += ticks * HAPPINESS_TICK;
            changed = true;
          }
        }

        if (s.health < maxHealth && !s.hospitalUntil && !s.jailUntil) {
          s.health = Math.min(maxHealth, s.health + 1);
          changed = true;
        }

        if (s.jailUntil && now >= s.jailUntil) {
          s.jailUntil = null;
          changed = true;
        }

        if (s.hospitalUntil && now >= s.hospitalUntil) {
          s.hospitalUntil = null;
          s.health = maxHealth;
          changed = true;
        }

        if (s.bank > 0 && now - (s.lastBankInterest || now) >= BANK_INTEREST_INTERVAL) {
          const days = Math.floor((now - s.lastBankInterest) / BANK_INTEREST_INTERVAL);
          if (days > 0) {
            const interest = Math.floor(s.bank * 0.01 * days);
            s.bank += interest;
            s.bankInterest += interest;
            s.lastBankInterest += days * BANK_INTEREST_INTERVAL;
            changed = true;
          }
        }

        if (s.currentJob && now - s.lastJobPayment >= JOB_PAY_INTERVAL && job) {
          const ticks = Math.floor((now - s.lastJobPayment) / JOB_PAY_INTERVAL);
          s.cash += job.salary * ticks;
          s.lastJobPayment += ticks * JOB_PAY_INTERVAL;
          changed = true;
        }

        return changed ? s : prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [maxNerve, maxHealth, property?.maxHappiness, job]);

  const blocked = () => Boolean(gameState.jailUntil || gameState.hospitalUntil);

  const commitCrime = (crime: Crime) => {
    if (blocked()) return log(gameState.jailUntil ? "You are in jail." : "You are in hospital.");
    if (!crimeUnlocked(crime, gameState.crimeExperience)) return log("That crime is locked until your crime experience is high enough.");
    if (gameState.nerve < crime.nerve) return log("Not enough nerve.");

    setGameState((prev) => {
      const chance = crimeSuccessChance(crime, prev.crimeExperience, 1, getCrimeStatBonus(prev.stats));
      const roll = Math.random() * 100;
      const outcome = roll < chance * 0.08 ? "critical" : roll > 99.5 ? "critical-fail" : roll < chance ? "success" : roll < chance + crime.risk * 0.55 ? "jailed" : "spooked";
      const s = { ...prev, nerve: prev.nerve - crime.nerve };

      if (outcome === "critical") {
        const reward = Math.floor(randomReward(crime) * 1.75);
        s.cash += reward;
        s.xp += crime.xp * 2;
        s.crimeExperience += crime.crimeExperience * 2;
        s.crimesCompleted++;
        s.crimesCritical++;
        log(`CRITICAL SUCCESS: ${crime.name} paid ${money(reward)}.`, "critical");
      } else if (outcome === "success") {
        const reward = randomReward(crime);
        s.cash += reward;
        s.xp += crime.xp;
        s.crimeExperience += crime.crimeExperience;
        s.crimesCompleted++;
        log(`SUCCESS: ${crime.name} paid ${money(reward)}.`, "success");
      } else if (outcome === "jailed") {
        s.crimesFailed++;
        s.timesJailed++;
        s.jailUntil = Date.now() + JAIL_MINUTES * 60000;
        log(`FAILED: ${crime.name}. You were jailed.`, "jailed");
      } else if (outcome === "critical-fail") {
        s.crimesFailed++;
        s.health = Math.max(1, s.health - 12);
        log(`CRITICAL FAIL: ${crime.name}. You escaped, barely.`, "critical");
      } else {
        s.crimesSpooked++;
        log(`SPOOKED: ${crime.name} failed without further consequences.`, "spooked");
      }
      return s;
    });
  };

  const train = (stat: TrainingStat) => {
    if (blocked()) return log("You cannot train right now.");
    if (!canTrainStat(gym, stat)) return log("This gym cannot train that stat.");
    if (gameState.energy < gym.energyCost) return log(`You need ${gym.energyCost} energy.`);

    setGameState((prev) => {
      const currentGym = GYMS.find((g) => g.id === prev.activeGym) ?? GYMS[0];
      const educationMultiplier = prev.educationCompleted.some((id) => id === "fitness-basics" || id === "advanced-fitness") ? 1.05 : 1;
      const result = applyTraining(prev.stats, currentGym, stat, prev.happiness, educationMultiplier);

      const s = {
        ...prev,
        energy: prev.energy - currentGym.energyCost,
        stats: result.stats,
        gymExperience: prev.gymExperience + getGymExperienceGain(currentGym.energyCost),
        gymSessions: prev.gymSessions + 1,
        happiness: Math.max(0, prev.happiness - currentGym.energyCost * 0.5),
      };
      log(`TRAINED ${stat.toUpperCase()}: +${result.gain.toFixed(2)} gain.`, "gym");
      return s;
    });
  };

  const buyGym = (id: string) =>
    setGameState((prev) => {
      const g = GYMS.find((x) => x.id === id);
      if (!g || g.jailOnly || !gymUnlocked(g, prev.gymExperience)) return prev;
      if (prev.gymMemberships.includes(id)) {
        return { ...prev, activeGym: id };
      }
      if (prev.cash < g.membershipCost) {
        log("Not enough cash for membership.");
        return prev;
      }
      log(`Joined ${g.name}.`, "success");
      return { ...prev, cash: prev.cash - g.membershipCost, gymMemberships: [...prev.gymMemberships, id], activeGym: id };
    });

  const attack = (opponent: PlayerProfile) => {
    if (blocked()) return log("You cannot attack right now.");
    if (gameState.energy < 10) return log("You need at least 10 energy to attack.");
    setGameState((prev) => ({ ...prev, energy: prev.energy - 10, attacks: prev.attacks + 1 }));
    setCombatOpponent(opponent);
    setCombatMessage(`Target acquired: ${opponent.name}. Ready to engage.`);
    setCurrentScreen("combat");
  };

  const resolveAttack = () => {
    if (!combatOpponent) return;
    setGameState((prev) => {
      const weapon = getItem(prev.equippedWeapon ?? "");
      const armor = getItem(prev.equippedArmor ?? "");
      const playerEffectiveStats: CombatStats = {
        strength: prev.stats.strength + (weapon?.effect ?? 0),
        defense: prev.stats.defense + (armor?.effect ?? 0),
        speed: prev.stats.speed,
        dexterity: prev.stats.dexterity,
      };

      const result = simulateCombat("You", playerEffectiveStats, maxHealth, combatOpponent);
      const s = { ...prev, attacks: prev.attacks + 1 };

      if (result.winner === "player") {
        s.fightsWon++;
        s.cash += result.cashReward;
        s.xp += result.xpReward;
        s.health = Math.max(1, s.health - result.damageDealtToPlayer);
        setCombatMessage(`VICTORY! You defeated ${combatOpponent.name} and earned ${money(result.cashReward)} and ${result.xpReward} XP.`);
        log(`COMBAT WIN: Defeated ${combatOpponent.name}. Earned ${money(result.cashReward)}.`, "combat");
      } else {
        s.fightsLost++;
        s.health = 0;
        s.hospitalUntil = Date.now() + HOSPITAL_MINUTES * 60000;
        setCombatMessage(`DEFEAT! You were knocked out by ${combatOpponent.name} and rushed to hospital.`);
        log(`COMBAT LOSS: Defeated by ${combatOpponent.name}. In hospital for ${HOSPITAL_MINUTES} minutes.`, "failure");
      }
      return s;
    });
  };

  const buyItem = (id: string) =>
    setGameState((prev) => {
      const item = getItem(id);
      if (!item || prev.cash < item.price) {
        log("Not enough cash.");
        return prev;
      }
      log(`Bought ${item.name}.`, "success");
      return { ...prev, cash: prev.cash - item.price, inventory: { ...prev.inventory, [id]: (prev.inventory[id] || 0) + 1 } };
    });

  const useItem = (id: string) =>
    setGameState((prev) => {
      const item = getItem(id);
      const count = prev.inventory[id] || 0;
      if (!item || count <= 0) return prev;
      const s = { ...prev, inventory: { ...prev.inventory, [id]: count - 1 } };
      if (item.type === "medical") s.health = Math.min(maxHealth, s.health + (item.effect || 0));
      if (item.type === "energy") s.energy = Math.min(MAX_ENERGY, s.energy + (item.effect || 0));
      if (item.type === "nerve") s.nerve = Math.min(maxNerve, s.nerve + (item.effect || 0));
      log(`Used ${item.name}.`, "success");
      return s;
    });

  const equip = (id: string) =>
    setGameState((prev) => {
      const item = getItem(id);
      if (!item || (prev.inventory[id] || 0) <= 0) return prev;
      return item.type === "weapon" ? { ...prev, equippedWeapon: id } : { ...prev, equippedArmor: id };
    });

  const chooseEncounter = (choice: Encounter["choices"][number]) => {
    setGameState((prev) => ({
      ...prev,
      cash: Math.max(0, prev.cash + (choice.cash || 0)),
      xp: Math.max(0, prev.xp + (choice.xp || 0)),
      health: Math.max(1, Math.min(maxHealth, prev.health + (choice.health || 0))),
      energy: Math.max(0, Math.min(MAX_ENERGY, prev.energy + (choice.energy || 0))),
      nerve: Math.max(0, Math.min(maxNerve, prev.nerve + (choice.nerve || 0))),
    }));
    log(choice.text, "system");
    setEncounter(null);
  };

  const randomEncounter = () => {
    if (blocked()) return log("You cannot explore right now.");
    setEncounter(ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)]);
  };

  const travel = (id: string) =>
    setGameState((prev) => {
      if (prev.currentLocation === id) return prev;
      if (prev.cash < TRAVEL_COST) {
        log(`Travel requires ${money(TRAVEL_COST)}.`);
        return prev;
      }
      if (prev.travelCooldownUntil && prev.travelCooldownUntil > Date.now()) {
        log(`Travel is on cooldown for ${formatTime(prev.travelCooldownUntil - Date.now())}.`);
        return prev;
      }
      log(`Travelled to ${LOCATIONS.find((x) => x[0] === id)?.[1] || id}.`, "system");
      return {
        ...prev,
        cash: prev.cash - TRAVEL_COST,
        currentLocation: id,
        travelCooldownUntil: Date.now() + TRAVEL_COOLDOWN,
        locationsVisited: prev.locationsVisited.includes(id) ? prev.locationsVisited : [...prev.locationsVisited, id],
      };
    });

  const joinJob = (id: string) =>
    setGameState((prev) => {
      const j = getJob(id);
      if (!j) return prev;
      log(`Started work as ${j.title}.`, "job");
      return { ...prev, currentJob: id, jobStartedAt: Date.now(), lastJobPayment: Date.now() };
    });

  const buyProperty = (id: string) =>
    setGameState((prev) => {
      const p = getProperty(id);
      if (!p || prev.cash < p.price || p.price < (getProperty(prev.ownedProperty)?.price || 0)) return prev;
      log(`Moved into ${p.name}.`, "success");
      return { ...prev, cash: prev.cash - p.price, ownedProperty: id, happiness: Math.min(p.maxHappiness, prev.happiness + 10) };
    });

  const bankDeposit = (amount: number) =>
    setGameState((prev) => {
      const n = Math.min(prev.cash, Math.max(0, amount));
      return { ...prev, cash: prev.cash - n, bank: prev.bank + n };
    });

  const bankWithdraw = (amount: number) =>
    setGameState((prev) => {
      const n = Math.min(prev.bank, Math.max(0, amount));
      return { ...prev, cash: prev.cash + n, bank: prev.bank - n };
    });

  const startEducation = (id: string) =>
    setGameState((prev) => {
      const c = EDUCATION.find((x) => x.id === id);
      if (!c || prev.educationActive || prev.educationCompleted.includes(id) || prev.cash < c.cost) return prev;
      log(`Started ${c.name}.`, "system");
      return { ...prev, cash: prev.cash - c.cost, educationActive: id, educationStartedAt: Date.now() };
    });

  const finishEducation = () =>
    setGameState((prev) => {
      const c = EDUCATION.find((x) => x.id === prev.educationActive);
      if (!c || !prev.educationStartedAt || Date.now() - prev.educationStartedAt < c.durationHours * 3600000) return prev;
      log(`Completed ${c.name}.`, "success");
      return { ...prev, educationActive: null, educationStartedAt: null, educationCompleted: [...prev.educationCompleted, c.id] };
    });

  const missionProgress = (m: (typeof MISSIONS)[number]) =>
    m.requirement === "crime" ? gameState.crimesCompleted : m.requirement === "combat" ? gameState.fightsWon : m.requirement === "gym" ? gameState.gymSessions : gameState.cash;

  const claimMission = (id: string) =>
    setGameState((prev) => {
      const m = MISSIONS.find((x) => x.id === id);
      if (!m || prev.completedMissions.includes(id)) return prev;
      const progress = m.requirement === "crime" ? prev.crimesCompleted : m.requirement === "combat" ? prev.fightsWon : m.requirement === "gym" ? prev.gymSessions : prev.cash;
      if (progress < m.target) return prev;
      log(`Mission complete: ${m.name}.`, "success");
      return { ...prev, cash: prev.cash + m.rewardCash, xp: prev.xp + m.rewardXp, completedMissions: [...prev.completedMissions, id] };
    });

  const claimDaily = () =>
    setGameState((prev) => {
      if (prev.lastDailyClaim && Date.now() - prev.lastDailyClaim < DAILY_INTERVAL) {
        log("Daily reward is not ready yet.");
        return prev;
      }
      const streak = prev.lastDailyClaim && Date.now() - prev.lastDailyClaim < DAILY_INTERVAL * 2 ? prev.dailyStreak + 1 : 1;
      const reward = 500 + Math.min(5000, streak * 250);
      log(`Daily reward claimed: ${money(reward)} and 1 merit point.`, "success");
      return { ...prev, cash: prev.cash + reward, merits: prev.merits + 1, points: prev.points + 10, dailyStreak: streak, lastDailyClaim: Date.now() };
    });

  const joinFaction = (id: string) =>
    setGameState((prev) => {
      const cost = prev.faction ? 0 : 500;
      if (prev.faction === id) return prev;
      if (prev.faction && prev.faction !== id) {
        log("You must leave your current faction before joining another.");
        return prev;
      }
      if (prev.cash < cost) {
        log("You need $500 to join a faction.");
        return prev;
      }
      log(`Joined ${id}.`, "success");
      return { ...prev, cash: prev.cash - cost, faction: id, factionReputation: 0 };
    });

  const workFaction = () =>
    setGameState((prev) => {
      if (!prev.faction) {
        log("Join a faction first.");
        return prev;
      }
      if (prev.energy < 10) {
        log("You need 10 energy.");
        return prev;
      }
      const gain = 5 + Math.floor(Math.random() * 10);
      log(`Faction work completed: +${gain} reputation.`, "success");
      return { ...prev, energy: prev.energy - 10, factionReputation: prev.factionReputation + gain, points: prev.points + 2 };
    });

  const tradeMarket = (id: string, buy: boolean) =>
    setGameState((prev) => {
      const prices: Record<string, number> = { food: 100, electronics: 250, scrap: 60, medical: 180 };
      const price = Math.max(1, Math.floor((prev.market[id] || prices[id] || 100) * (0.9 + Math.random() * 0.2)));
      const owned = prev.inventory[id] || 0;
      if (buy) {
        if (prev.cash < price) {
          log("Not enough cash.");
          return prev;
        }
        log(`Bought ${id} for ${money(price)}.`);
        return { ...prev, cash: prev.cash - price, inventory: { ...prev.inventory, [id]: owned + 1 }, market: { ...prev.market, [id]: price } };
      }
      if (owned <= 0) {
        log(`You don't own any ${id}.`);
        return prev;
      }
      log(`Sold ${id} for ${money(price)}.`, "success");
      return { ...prev, cash: prev.cash + price, inventory: { ...prev.inventory, [id]: owned - 1 }, market: { ...prev.market, [id]: price } };
    });

  const earnMerit = (reason: string) =>
    setGameState((prev) => {
      if (prev.achievements.includes(reason)) return prev;
      log(`Achievement unlocked: ${reason}.`, "critical");
      return { ...prev, achievements: [...prev.achievements, reason], merits: prev.merits + 1 };
    });

  return {
    gameState,
    setGameState,
    currentScreen,
    setCurrentScreen,
    level,
    maxHealth,
    maxNerve,
    gym,
    job,
    education,
    encounter,
    setEncounter,
    combatOpponent,
    setCombatOpponent,
    combatMessage,
    commitCrime,
    train,
    buyGym,
    attack,
    resolveAttack,
    buyItem,
    useItem,
    equip,
    randomEncounter,
    chooseEncounter,
    travel,
    joinJob,
    buyProperty,
    bankDeposit,
    bankWithdraw,
    startEducation,
    finishEducation,
    missionProgress,
    claimMission,
    claimDaily,
    joinFaction,
    workFaction,
    tradeMarket,
    earnMerit,
    travelLocked,
    log,
    resetGame: () => setGameState(freshSave()),
  };
}

function App() {
  const g = useRiftCity();
  const levelInfo = getLevel(g.gameState.xp);
  const maxHappy = getProperty(g.gameState.ownedProperty)?.maxHappiness ?? 100;

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const energyNextTick = g.gameState.energy >= MAX_ENERGY ? 0 : Math.max(0, ENERGY_REGEN_INTERVAL - ((now - g.gameState.lastEnergyUpdate) % ENERGY_REGEN_INTERVAL));
  const nerveNextTick = g.gameState.nerve >= g.maxNerve ? 0 : Math.max(0, NERVE_REGEN_INTERVAL - ((now - g.gameState.lastNerveUpdate) % NERVE_REGEN_INTERVAL));
  const happyNextTick = g.gameState.happiness >= maxHappy ? 0 : Math.max(0, HAPPINESS_TICK - ((now - g.gameState.lastHappinessUpdate) % HAPPINESS_TICK));
  const healthNextTick = g.gameState.health >= g.maxHealth ? 0 : Math.max(0, HEALTH_REGEN_INTERVAL - (now % HEALTH_REGEN_INTERVAL));

  const nav: { id: Screen; label: string; icon: string }[] = [
    { id: "character", label: "Character", icon: "👤" },
    { id: "city", label: "City", icon: "🏙️" },
    { id: "crimes", label: "Crimes", icon: "🕵️" },
    { id: "combat", label: "Combat", icon: "⚔️" },
    { id: "gym", label: "Gym", icon: "🏋️" },
    { id: "jobs", label: "Jobs", icon: "💼" },
    { id: "items", label: "Items", icon: "🎒" },
    { id: "missions", label: "Missions", icon: "📜" },
    { id: "education", label: "Education", icon: "🎓" },
    { id: "property", label: "Property", icon: "🏠" },
    { id: "market", label: "Market", icon: "📈" },
    { id: "faction", label: "Faction", icon: "🛡️" },
    { id: "awards", label: "Awards", icon: "🏆" },
  ];

  const title = nav.find((n) => n.id === g.currentScreen)?.label || "RiftCity";

  return (
    <div className="layout-root">
      {/* LEFT NAVIGATION RAIL */}
      <aside className="nav-rail">
        <div className="brand">
          <h2>RIFTCITY</h2>
          <span className="badge">v2.0</span>
        </div>
        <nav className="nav-list">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${g.currentScreen === n.id ? "active" : ""}`}
              onClick={() => g.setCurrentScreen(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="nav-footer">
          <button className="btn-secondary" onClick={g.randomEncounter}>
            🎲 Explore
          </button>
          <button
            className="btn-danger-ghost"
            onClick={() => {
              if (confirm("Reset save data?")) g.resetGame();
            }}
          >
            ↻ Reset
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-wrapper">
        {/* TOP STATUS BAR WITH SIDE-BY-SIDE COMPACT METERS */}
        <header className="top-status-bar" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="user-level" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="level-badge" style={{ whiteSpace: 'nowrap' }}>LV {g.level}</span>
              <div className="xp-container" style={{ minWidth: '80px' }}>
                <div className="xp-text" style={{ fontSize: '10px' }}>XP {levelInfo.currentXp}/100</div>
                <div className="bar-track compact" style={{ height: '4px', background: '#222' }}>
                  <div className="bar-fill xp" style={{ width: `${levelInfo.currentXp}%`, height: '100%', background: '#3b82f6' }} />
                </div>
              </div>
            </div>

            {/* SIDE-BY-SIDE COMPACT STAT ICONS */}
            <div className="compact-vitals" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
              <button onClick={() => setActiveModal("energy")} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px' }}>
                <span style={{ fontSize: '16px' }}>⚡</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{g.gameState.energy}</span>
              </button>

              <button onClick={() => setActiveModal("nerve")} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px' }}>
                <span style={{ fontSize: '16px' }}>🔥</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{g.gameState.nerve}</span>
              </button>

              <button onClick={() => setActiveModal("happy")} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px' }}>
                <span style={{ fontSize: '16px' }}>😊</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{Math.floor(g.gameState.happiness)}</span>
              </button>

              <button onClick={() => setActiveModal("health")} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px' }}>
                <span style={{ fontSize: '16px' }}>❤️</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{Math.floor(g.gameState.health)}</span>
              </button>
            </div>
          </div>

          <div className="currency-bar" style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
            <div>💵 {money(g.gameState.cash)}</div>
            <div>🏦 {money(g.gameState.bank)}</div>
            <div>💎 {g.gameState.points} Pts</div>
          </div>
        </header>

        {/* STAT OVERLAY POPUP MODAL */}
        {activeModal && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setActiveModal(null)}>
            <div className="modal-card" style={{ background: '#18181b', padding: '20px', borderRadius: '8px', minWidth: '240px', border: '1px solid #3f3f46', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
              {activeModal === "energy" && (
                <>
                  <h2>⚡ Energy</h2>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '12px 0' }}>{g.gameState.energy} / {MAX_ENERGY}</p>
                  <p style={{ color: '#a1a1aa' }}>{g.gameState.energy >= MAX_ENERGY ? "Fully charged" : `Next +1 tick in: ${formatTime(energyNextTick)}`}</p>
                </>
              )}

              {activeModal === "nerve" && (
                <>
                  <h2>🔥 Nerve</h2>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '12px 0' }}>{g.gameState.nerve} / {g.maxNerve}</p>
                  <p style={{ color: '#a1a1aa' }}>{g.gameState.nerve >= g.maxNerve ? "At capacity" : `Next +1 tick in: ${formatTime(nerveNextTick)}`}</p>
                </>
              )}

              {activeModal === "happy" && (
                <>
                  <h2>😊 Happiness</h2>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '12px 0' }}>{Math.floor(g.gameState.happiness)} / {maxHappy}</p>
                  <p style={{ color: '#a1a1aa' }}>{g.gameState.happiness >= maxHappy ? "Max happiness" : `Next +5 tick in: ${formatTime(happyNextTick)}`}</p>
                </>
              )}

              {activeModal === "health" && (
                <>
                  <h2>❤️ Health</h2>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '12px 0' }}>{Math.floor(g.gameState.health)} / {g.maxHealth}</p>
                  <p style={{ color: '#a1a1aa' }}>{g.gameState.health >= g.maxHealth ? "Full health" : `Next +1 tick in: ${formatTime(healthNextTick)}`}</p>
                </>
              )}

              <button className="btn-primary" style={{ marginTop: '16px', width: '100%' }} onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* SCREEN CONTAINER */}
        <main className="screen-container">
          <div className="screen-header">
            <span className="location-tag">LOCATION: {g.gameState.currentLocation.toUpperCase()}</span>
            <h1>{title}</h1>
          </div>

          {g.gameState.jailUntil && (
            <div className="status-alert jail">
              🔒 JAILED · {formatTime(timeLeft(g.gameState.jailUntil))} remaining
            </div>
          )}
          {g.gameState.hospitalUntil && (
            <div className="status-alert hospital">
              🏥 HOSPITAL · {formatTime(timeLeft(g.gameState.hospitalUntil))} remaining
            </div>
          )}

          {g.currentScreen === "character" && <Character g={g} />}
          {g.currentScreen === "city" && <City g={g} />}
          {g.currentScreen === "crimes" && <Crimes g={g} />}
          {g.currentScreen === "combat" && <Combat g={g} />}
          {g.currentScreen === "gym" && <GymView g={g} />}
          {g.currentScreen === "jobs" && <Jobs g={g} />}
          {g.currentScreen === "items" && <Items g={g} />}
          {g.currentScreen === "missions" && <Missions g={g} />}
          {g.currentScreen === "education" && <Education g={g} />}
          {g.currentScreen === "property" && <PropertyView g={g} />}
          {g.currentScreen === "market" && <Market g={g} />}
          {g.currentScreen === "faction" && <Faction g={g} />}
          {g.currentScreen === "awards" && <Awards g={g} />}

          {/* ACTIVITY FEED */}
          <section className="card activity-card">
            <div className="card-header">
              <h3>Activity Log</h3>
            </div>
            <div className="activity-list">
              {g.gameState.activities.slice(0, 8).map((a) => (
                <div className={`activity-item ${a.type}`} key={a.id}>
                  <span className="time">{new Date(a.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="type-tag">{a.type.toUpperCase()}</span>
                  <p className="desc">{a.text}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* ENCOUNTER MODAL */}
      {g.encounter && (
        <div className="modal-overlay">
          <div className="modal-card">
            <span className="modal-tag">RANDOM ENCOUNTER</span>
            <h2>{g.encounter.title}</h2>
            <p>{g.encounter.text}</p>
            <div className="modal-actions">
              {g.encounter.choices.map((c, i) => (
                <button className="btn-primary" key={i} onClick={() => g.chooseEncounter(c)}>
                  {c.label}
                </button>
              ))}
              <button className="btn-secondary" onClick={() => g.setEncounter(null)}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function Button({ children, onClick, disabled = false, className = "" }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button className={`btn-primary ${className}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function Character({ g }: { g: ReturnType<typeof useRiftCity> }) {
  const [amount, setAmount] = useState("100");
  const n = Math.max(0, Number(amount) || 0);
  return (
    <div className="ui-grid two-col">
      <Panel title="Combat Stats">
        <div className="stats-list">
          {Object.entries(g.gameState.stats).map(([k, v]) => (
            <div className="stat-row" key={k}>
              <span className="stat-name">{k}</span>
              <strong className="stat-val">{(v as number).toFixed(2)}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Core Resources">
        <div className="data-list">
          <div className="data-row">
            <span>❤️ Health</span>
            <b>{Math.floor(g.gameState.health)} / {g.maxHealth}</b>
          </div>
          <div className="data-row">
            <span>⚡ Energy</span>
            <b>{g.gameState.energy} / {MAX_ENERGY}</b>
          </div>
          <div className="data-row">
            <span>🧠 Nerve</span>
            <b>{g.gameState.nerve} / {g.maxNerve}</b>
          </div>
          <div className="data-row">
            <span>😊 Happiness</span>
            <b>{Math.floor(g.gameState.happiness)} / {getProperty(g.gameState.ownedProperty)?.maxHappiness ?? 100}</b>
          </div>
        </div>
      </Panel>
      <Panel title="Progress Overview">
        <div className="data-list">
          <div className="data-row">
            <span>Crime Experience</span>
            <b>{g.gameState.crimeExperience}</b>
          </div>
          <div className="data-row">
            <span>Gym Experience</span>
            <b>{g.gameState.gymExperience}</b>
          </div>
          <div className="data-row">
            <span>Crimes Completed</span>
            <b>{g.gameState.crimesCompleted} / {g.gameState.crimesFailed} failed</b>
          </div>
          <div className="data-row">
            <span>Fight Record</span>
            <b>{g.gameState.fightsWon}W / {g.gameState.fightsLost}L</b>
          </div>
        </div>
      </Panel>
      <Panel title="Bank Vault">
        <div className="bank-control">
          <h2 className="bank-balance">{money(g.gameState.bank)}</h2>
          <div className="input-group">
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="btn-group">
              <Button onClick={() => g.bankDeposit(n)}>Deposit</Button>
              <Button onClick={() => g.bankWithdraw(n)}>Withdraw</Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function City({ g }: { g: ReturnType<typeof useRiftCity> }) {
  return (
    <>
      <div className="ui-grid four-col">
        {LOCATIONS.map(([id, name, desc]) => (
          <div className="card location-card" key={id}>
            <span className="card-tag">DISTRICT</span>
            <h3>{name}</h3>
            <p>{desc}</p>
            <Button onClick={() => g.travel(id)}>{g.gameState.currentLocation === id ? "Current Location" : "Travel"}</Button>
          </div>
        ))}
      </div>
      <Panel title="District Actions">
        <div className="ui-grid three-col">
          <Button onClick={g.randomEncounter}>🎲 Explore Area</Button>
          <Button onClick={() => g.setCurrentScreen("crimes")}>🕵️ Street Hustles</Button>
          <Button onClick={() => g.setCurrentScreen("combat")}>⚔️ Arena Fights</Button>
        </div>
      </Panel>
    </>
  );
}

function Crimes({ g }: { g: ReturnType<typeof useRiftCity> }) {
  return (
    <div className="ui-grid two-col">
      {CRIMES.map((c) => {
        const chance = crimeSuccessChance(c, g.gameState.crimeExperience, 1, getCrimeStatBonus(g.gameState.stats));
        const unlocked = crimeUnlocked(c, g.gameState.crimeExperience);
        return (
          <div className={`card crime-card ${unlocked ? "" : "disabled"}`} key={c.id}>
            <div className="card-header-split">
              <span className="card-tag">NERVE {c.nerve}</span>
              <span className="chance-badge">{unlocked ? `${chance.toFixed(0)}% Success` : `Requires CE ${c.crimeExperienceRequired}`}</span>
            </div>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <div className="bar-track">
              <div className="bar-fill crime" style={{ width: `${unlocked ? chance : 0}%` }} />
            </div>
            <Button disabled={!unlocked || g.gameState.nerve < c.nerve} onClick={() => g.commitCrime(c)}>
              Commit Crime
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function Combat({ g }: { g: ReturnType<typeof useRiftCity> }) {
  if (g.combatOpponent) {
    return (
      <InteractiveCombatView
        player={{
          id: "player",
          name: "You",
          level: g.level,
          health: g.gameState.health,
          maxHealth: g.maxHealth,
          stats: g.gameState.stats,
          weapons: DEFAULT_WEAPONS,
        }}
        enemy={{
          id: g.combatOpponent.id,
          name: g.combatOpponent.name,
          level: g.combatOpponent.level,
          health: g.combatOpponent.health,
          maxHealth: g.combatOpponent.maxHealth,
          stats: g.combatOpponent.stats,
          weapons: g.combatOpponent.weapons || DEFAULT_WEAPONS,
          cashReward: g.combatOpponent.cashReward,
          xpReward: g.combatOpponent.level * 25,
        }}
        onFinish={(outcome, enemy, finalPlayerHealth) => {
          let cashEarned = 0;
          let xpEarned = enemy.xpReward || 50;

          if (outcome === "mug") {
            cashEarned = Math.floor((enemy.cashReward || 100) * (0.4 + Math.random() * 0.4));
            xpEarned = Math.floor(xpEarned * 0.25);
          } else if (outcome === "leave") {
            xpEarned = Math.floor(xpEarned * 1.5);
          }

          g.setGameState((prev) => ({
            ...prev,
            cash: prev.cash + cashEarned,
            xp: prev.xp + xpEarned,
            health: finalPlayerHealth,
            fightsWon: prev.fightsWon + 1,
          }));

          g.log(
            `COMBAT VICTORY (${outcome.toUpperCase()}): Earned ${cashEarned ? `$${cashEarned}` : ""} and ${xpEarned} XP.`,
            "combat"
          );
          g.setCombatOpponent(null);
          g.setCurrentScreen("city");
        }}
        onDefeat={(finalPlayerHealth) => {
          g.setGameState((prev) => ({
            ...prev,
            health: 0,
            fightsLost: prev.fightsLost + 1,
            hospitalUntil: Date.now() + HOSPITAL_MINUTES * 60000,
          }));
          g.log("COMBAT LOSS: Knocked out and hospitalized.", "failure");
          g.setCombatOpponent(null);
          g.setCurrentScreen("city");
        }}
      />
    );
  }

  return (
    <Panel title="Available Targets">
      <div className="ui-grid two-col">
        {PLAYER_PROFILES.map((o) => (
          <div className="card target-card" key={o.id}>
            <div className="card-header-split">
              <span className="card-tag">LV {o.level}</span>
              <span className="status-badge">{o.status}</span>
            </div>
            <h3>{o.name}</h3>
            <p>{o.title} · {o.location}</p>
            <div className="data-list">
              <div className="data-row"><span>Health</span><b>{o.health}/{o.maxHealth}</b></div>
              <div className="data-row"><span>Reward</span><b>{money(o.cashReward)}</b></div>
              <div className="data-row"><span>Win Chance</span><b>{calculateWinChance(g.gameState.stats, o.stats)}%</b></div>
            </div>
            <Button onClick={() => g.attack(o)} disabled={Boolean(g.gameState.jailUntil || g.gameState.hospitalUntil) || g.gameState.energy < 10}>
              Attack (10 ⚡)
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function GymView({ g }: { g: ReturnType<typeof useRiftCity> }) {
  return (
    <>
      <div className="gym-selector">
        {GYMS.filter((x) => !x.jailOnly).map((x) => (
          <button
            key={x.id}
            className={`gym-btn ${g.gym.id === x.id ? "active" : ""}`}
            disabled={!gymUnlocked(x, g.gameState.gymExperience)}
            onClick={() => g.buyGym(x.id)}
          >
            <span>{x.name}</span>
            <small>{gymUnlocked(x, g.gameState.gymExperience) ? money(x.membershipCost) : `EXP ${x.gymExpRequired}`}</small>
          </button>
        ))}
      </div>
      <Panel title={`${g.gym.name} · (${g.gym.energyCost} Energy per set)`}>
        <div className="ui-grid four-col">
          {TRAINING_STATS.map((s) => (
            <div className="card train-card" key={s.id}>
              <span className="train-icon">{s.icon}</span>
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <Button disabled={!canTrainStat(g.gym, s.id) || g.gameState.energy < g.gym.energyCost} onClick={() => g.train(s.id)}>
                Train
              </Button>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function Jobs({ g }: { g: ReturnType<typeof useRiftCity> }) {
  return (
    <div className="ui-grid two-col">
      {JOBS.map((j) => (
        <div className="card job-card" key={j.id}>
          <span className="card-tag">{j.company}</span>
          <h3>{j.title}</h3>
          <p>{j.description}</p>
          <div className="data-row">
            <span>Hourly Salary</span>
            <b>{money(j.salary)}</b>
          </div>
          <Button onClick={() => g.joinJob(j.id)}>{g.gameState.currentJob === j.id ? "Current Position" : "Apply Now"}</Button>
        </div>
      ))}
    </div>
  );
}

function Items({ g }: { g: ReturnType<typeof useRiftCity> }) {
  return (
    <div className="ui-grid three-col">
      {ITEMS.map((i) => (
        <div className="card item-card" key={i.id}>
          <span className="card-tag">{i.type.toUpperCase()}</span>
          <h3>{i.name}</h3>
          <p>{i.description}</p>
          <strong className="item-price">{money(i.price)}</strong>
          <div className="btn-group">
            <Button onClick={() => g.buyItem(i.id)}>Buy</Button>
            {(g.gameState.inventory[i.id] || 0) > 0 && (
              <Button onClick={() => (i.type === "weapon" || i.type === "armor" ? g.equip(i.id) : g.useItem(i.id))}>
                {i.type === "weapon" || i.type === "armor" ? "Equip" : "Use"}
              </Button>
            )}
          </div>
          <span className="item-count">Owned: {g.gameState.inventory[i.id] || 0}</span>
        </div>
      ))}
    </div>
  );
}

function Missions({ g }: { g: ReturnType<typeof useRiftCity> }) {
  return (
    <div className="ui-grid two-col">
      {MISSIONS.map((m) => {
        const p = g.missionProgress(m);
        const done = g.gameState.completedMissions.includes(m.id);
        return (
          <div className="card mission-card" key={m.id}>
            <span className="card-tag">MISSION</span>
            <h3>{m.name}</h3>
            <p>{m.description}</p>
            <div className="bar-track">
              <div className="bar-fill mission" style={{ width: `${Math.min(100, (p / m.target) * 100)}%` }} />
            </div>
            <div className="data-row">
              <span>Progress</span>
              <b>{Math.min(p, m.target).toLocaleString()} / {m.target.toLocaleString()}</b>
            </div>
            <Button disabled={done || p < m.target} onClick={() => g.claimMission(m.id)}>
              {done ? "Claimed" : "Claim Reward"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function Education({ g }: { g: ReturnType<typeof useRiftCity> }) {
  return (
    <>
      <Panel title="Active Course Status">
        {g.education ? (
          <div className="course-active">
            <h3>{g.education.name}</h3>
            <p>Duration: {g.education.durationHours} hours</p>
            <Button onClick={g.finishEducation}>Check Completion</Button>
          </div>
        ) : (
          <p>No course currently active.</p>
        )}
      </Panel>
      <div className="ui-grid two-col">
        {EDUCATION.map((c) => (
          <div className="card course-card" key={c.id}>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <div className="data-list">
              <div className="data-row"><span>Cost</span><b>{money(c.cost)}</b></div>
              <div className="data-row"><span>Time</span><b>{c.durationHours}h</b></div>
            </div>
            <Button
              disabled={g.gameState.educationCompleted.includes(c.id) || Boolean(g.education) || g.gameState.cash < c.cost}
              onClick={() => g.startEducation(c.id)}
            >
              {g.gameState.educationCompleted.includes(c.id) ? "Completed" : "Enroll"}
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}

function PropertyView({ g }: { g: ReturnType<typeof useRiftCity> }) {
  const current = getProperty(g.gameState.ownedProperty)?.price || 0;
  return (
    <div className="ui-grid two-col">
      {PROPERTIES.map((p) => (
        <div className={`card property-card ${p.price < current ? "disabled" : ""}`} key={p.id}>
          <span className="card-tag">REAL ESTATE</span>
          <h3>{p.name}</h3>
          <p>{p.description}</p>
          <div className="data-list">
            <div className="data-row"><span>Price</span><b>{money(p.price)}</b></div>
            <div className="data-row"><span>Health Bonus</span><b>+{p.maxHealthBonus}</b></div>
            <div className="data-row"><span>Nerve Bonus</span><b>+{p.nerveBonus}</b></div>
          </div>
          <Button disabled={p.price < current || g.gameState.cash < p.price} onClick={() => g.buyProperty(p.id)}>
            {g.gameState.ownedProperty === p.id ? "Current Residence" : "Purchase"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function Market({ g }: { g: ReturnType<typeof useRiftCity> }) {
  const goods = Object.keys(g.gameState.market);
  return (
    <Panel title="Dynamic Commodities Market">
      <div className="ui-grid four-col">
        {goods.map((id) => (
          <div className="card market-card" key={id}>
            <span className="card-tag">COMMODITY</span>
            <h3>{id.toUpperCase()}</h3>
            <p>Unit Price: {money(g.gameState.market[id])}</p>
            <span className="item-count">Owned: {g.gameState.inventory[id] || 0}</span>
            <div className="btn-group">
              <Button onClick={() => g.tradeMarket(id, true)}>Buy</Button>
              <Button onClick={() => g.tradeMarket(id, false)} disabled={!g.gameState.inventory[id]}>
                Sell
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Faction({ g }: { g: ReturnType<typeof useRiftCity> }) {
  const factions = ["Iron Syndicate", "Rift Guard", "Dock Union"];
  return (
    <Panel title="Faction Headquarters">
      <div className="ui-grid three-col">
        {factions.map((f) => (
          <div className={`card faction-card ${g.gameState.faction && g.gameState.faction !== f ? "disabled" : ""}`} key={f}>
            <h3>{f}</h3>
            <p>{g.gameState.faction === f ? `Reputation: ${g.gameState.factionReputation}` : "Entry Fee: $500"}</p>
            <Button disabled={Boolean(g.gameState.faction) && g.gameState.faction !== f} onClick={() => g.joinFaction(f)}>
              {g.gameState.faction === f ? "Member" : "Join Faction"}
            </Button>
          </div>
        ))}
      </div>
      {g.gameState.faction && <Button className="mt-4" onClick={g.workFaction}>Complete Faction Work (10 ⚡)</Button>}
    </Panel>
  );
}

function Awards({ g }: { g: ReturnType<typeof useRiftCity> }) {
  const awards: [string, boolean][] = [
    ["First Crime", g.gameState.crimesCompleted >= 1],
    ["Ten Crimes", g.gameState.crimesCompleted >= 10],
    ["First Victory", g.gameState.fightsWon >= 1],
    ["Gym Rat", g.gameState.gymSessions >= 10],
    ["Five Figures", g.gameState.cash >= 100000],
    ["Level 10", g.level >= 10],
  ];

  return (
    <>
      <Panel title="Milestones & Achievements">
        <div className="ui-grid three-col">
          {awards.map(([name, done]) => (
            <div className={`card achievement-card ${done ? "unlocked" : "locked"}`} key={name}>
              <h3>{name}</h3>
              <span className="status-text">{done ? "Unlocked" : "Locked"}</span>
              {done && !g.gameState.achievements.includes(name) && <Button onClick={() => g.earnMerit(name)}>Claim Merit</Button>}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Daily Rewards">
        <Button onClick={g.claimDaily}>Claim Daily Bonus</Button>
      </Panel>
    </>
  );
}

export default App;
