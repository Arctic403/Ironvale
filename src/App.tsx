import React, { useEffect, useMemo, useState } from "react";
import {
  CRIMES,
  Crime,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
  rollCrimeOutcome,
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
  OPPONENTS,
  Opponent,
  calculateWinChance,
  resolveCombat,
} from "./systems/combatSystem";
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

type Screen = "city" | "crimes" | "combat" | "gym" | "jobs" | "items" | "missions" | "education" | "property" | "character" | "market" | "faction" | "awards";
type ActivityType = "success" | "failure" | "critical" | "spooked" | "jailed" | "combat" | "gym" | "job" | "system";
type Activity = { id: number; text: string; type: ActivityType; time: number };
type Encounter = { id: string; title: string; text: string; choices: { label: string; cash?: number; xp?: number; health?: number; energy?: number; nerve?: number; text: string }[] };

type SaveData = {
  cash: number; bank: number; xp: number; bankInterest: number; lastBankInterest: number; merits: number; points: number;
  energy: number; lastEnergyUpdate: number;
  nerve: number; lastNerveUpdate: number;
  health: number;
  crimeExperience: number;
  stats: CombatStats;
  gymExperience: number; gymMemberships: string[]; activeGym: string;
  happiness: number; lastHappinessUpdate: number;
  currentJob: string | null; jobStartedAt: number; lastJobPayment: number;
  jailUntil: number | null; hospitalUntil: number | null;
  inventory: Record<string, number>; equippedWeapon: string | null; equippedArmor: string | null;
  ownedProperty: string;
  educationCompleted: string[]; educationActive: string | null; educationStartedAt: number | null;
  completedMissions: string[];
  crimesCompleted: number; crimesFailed: number; crimesSpooked: number; crimesCritical: number; timesJailed: number;
  fightsWon: number; fightsLost: number; gymSessions: number; attacks: number;
  locationsVisited: string[]; currentLocation: string; travelCooldownUntil: number | null;
  faction: string | null; factionReputation: number; company: string | null; companyReputation: number;
  market: Record<string, number>; lastDailyClaim: number | null; dailyStreak: number;
  achievements: string[];
  activities: Activity[];
};

const SAVE_KEY = "riftcity-core-v4";
const JOB_PAY_INTERVAL = 60 * 60 * 1000;
const HAPPINESS_TICK = 15 * 60 * 1000;
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
  { id: "lost-wallet", title: "A Wallet on the Pavement", text: "You notice a wallet sitting beside a bench. Humanity has apparently invented another tiny moral exam.", choices: [
    { label: "Return it", xp: 12, text: "You return the wallet. The owner rewards your honesty." },
    { label: "Keep the cash", cash: 180, nerve: 1, text: "You pocket the cash and leave before anyone notices." },
  ]},
  { id: "street-deal", title: "A Quiet Offer", text: "A stranger offers a quick deal that could pay well, assuming your luck has decided to cooperate.", choices: [
    { label: "Take the deal", cash: 450, xp: 18, health: -8, text: "The deal works, although it leaves you nursing a bruise." },
    { label: "Walk away", xp: 5, text: "You decide that mysterious strangers are rarely an investment strategy." },
  ]},
  { id: "runner", title: "Courier Wanted", text: "Someone needs a package moved across town. No questions, apparently, because questions are inconvenient.", choices: [
    { label: "Take the run", cash: 240, energy: -10, xp: 10, text: "You deliver the package and collect the fee." },
    { label: "Decline", text: "You keep walking." },
  ]},
];

function freshSave(): SaveData {
  const now = Date.now();
  return {
    cash: 1000, bank: 0, xp: 0, bankInterest: 0, lastBankInterest: now, merits: 0, points: 0, energy: 100, lastEnergyUpdate: now,
    nerve: 10, lastNerveUpdate: now, health: 100, crimeExperience: 0,
    stats: { strength: 1, defense: 1, speed: 1, dexterity: 1 },
    gymExperience: 0, gymMemberships: ["premier-fitness"], activeGym: "premier-fitness",
    happiness: BASE_HAPPINESS, lastHappinessUpdate: now, currentJob: null,
    jobStartedAt: now, lastJobPayment: now, jailUntil: null, hospitalUntil: null,
    inventory: {}, equippedWeapon: null, equippedArmor: null, ownedProperty: "shack",
    educationCompleted: [], educationActive: null, educationStartedAt: null,
    completedMissions: [], crimesCompleted: 0, crimesFailed: 0, crimesSpooked: 0, crimesCritical: 0,
    timesJailed: 0, fightsWon: 0, fightsLost: 0, gymSessions: 0, attacks: 0,
    locationsVisited: ["city-center"], currentLocation: "city-center", travelCooldownUntil: null,
    faction: null, factionReputation: 0, company: null, companyReputation: 0,
    market: { "food": 100, "electronics": 250, "scrap": 60, "medical": 180 }, lastDailyClaim: null, dailyStreak: 0,
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
      ...base, ...parsed,
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
  } catch { return freshSave(); }
}

function money(n: number) { return `$${Math.max(0, Math.floor(n)).toLocaleString()}`; }
function timeLeft(until: number | null) { return until ? Math.max(0, until - Date.now()) : 0; }
function formatTime(ms: number) { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

export function useRiftCity() {
  const [gameState, setGameState] = useState<SaveData>(() => loadSave());
  const [currentScreen, setCurrentScreen] = useState<Screen>("character");
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [combatOpponent, setCombatOpponent] = useState<Opponent | null>(null);
  const [combatMessage, setCombatMessage] = useState("Choose an opponent.");

  const level = getLevel(gameState.xp).level;
  const property = getProperty(gameState.ownedProperty);
  const maxHealth = getMaxHealth(property?.maxHealthBonus ?? 0);
  const maxNerve = 10 + Math.min(50, Math.floor(gameState.crimeExperience / 100) * 5) + (property?.nerveBonus ?? 0);
  const gym = GYMS.find(g => g.id === gameState.activeGym) ?? GYMS[0];
  const job = getJob(gameState.currentJob);
  const education = EDUCATION.find(e => e.id === gameState.educationActive) ?? null;
  const travelLocked = Boolean(gameState.travelCooldownUntil && gameState.travelCooldownUntil > Date.now());

  const log = (text: string, type: ActivityType = "system") => setGameState(s => ({ ...s, activities: [{ id: Date.now() + Math.random(), text, type, time: Date.now() }, ...s.activities].slice(0, 60) }));

  useEffect(() => { localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)); }, [gameState]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setGameState(prev => {
        let s = { ...prev };
        let changed = false;
        if (s.energy < MAX_ENERGY) {
          const ticks = Math.floor((now - s.lastEnergyUpdate) / ENERGY_REGEN_INTERVAL);
          if (ticks > 0) { s.energy = Math.min(MAX_ENERGY, s.energy + ticks); s.lastEnergyUpdate += ticks * ENERGY_REGEN_INTERVAL; changed = true; }
        } else s.lastEnergyUpdate = now;
        if (s.nerve < maxNerve) {
          const ticks = Math.floor((now - s.lastNerveUpdate) / NERVE_REGEN_INTERVAL);
          if (ticks > 0) { s.nerve = Math.min(maxNerve, s.nerve + ticks); s.lastNerveUpdate += ticks * NERVE_REGEN_INTERVAL; changed = true; }
        } else s.lastNerveUpdate = now;
        if (s.happiness < (property?.maxHappiness ?? 100)) {
          const ticks = Math.floor((now - s.lastHappinessUpdate) / HAPPINESS_TICK);
          if (ticks > 0) { s.happiness = Math.min(property?.maxHappiness ?? 100, s.happiness + ticks * 5); s.lastHappinessUpdate += ticks * HAPPINESS_TICK; changed = true; }
        }
        if (s.health < maxHealth && !s.hospitalUntil && !s.jailUntil) { s.health = Math.min(maxHealth, s.health + 1); changed = true; }
        if (s.jailUntil && now >= s.jailUntil) { s.jailUntil = null; changed = true; }
        if (s.hospitalUntil && now >= s.hospitalUntil) { s.hospitalUntil = null; s.health = maxHealth; changed = true; }
        if (s.bank > 0 && now - (s.lastBankInterest || now) >= BANK_INTEREST_INTERVAL) {
          const days = Math.floor((now - s.lastBankInterest) / BANK_INTEREST_INTERVAL);
          if (days > 0) { const interest = Math.floor(s.bank * 0.01 * days); s.bank += interest; s.bankInterest += interest; s.lastBankInterest += days * BANK_INTEREST_INTERVAL; changed = true; }
        }
        if (s.currentJob && now - s.lastJobPayment >= JOB_PAY_INTERVAL && job) {
          const ticks = Math.floor((now - s.lastJobPayment) / JOB_PAY_INTERVAL);
          s.cash += job.salary * ticks; s.lastJobPayment += ticks * JOB_PAY_INTERVAL; changed = true;
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
    setGameState(prev => {
      const chance = crimeSuccessChance(crime, prev.crimeExperience, 1, getCrimeStatBonus(prev.stats));
      const roll = Math.random() * 100;
      const outcome = roll < chance * 0.08 ? "critical" : roll > 99.5 ? "critical-fail" : roll < chance ? "success" : roll < chance + crime.risk * 0.55 ? "jailed" : "spooked";
      const s = { ...prev, nerve: prev.nerve - crime.nerve };
      if (outcome === "critical") {
        const reward = Math.floor(randomReward(crime) * 1.75); s.cash += reward; s.xp += crime.xp * 2; s.crimeExperience += crime.crimeExperience * 2; s.crimesCompleted++; s.crimesCritical++; log(`CRITICAL SUCCESS: ${crime.name} paid ${money(reward)}.`, "critical");
      } else if (outcome === "success") {
        const reward = randomReward(crime); s.cash += reward; s.xp += crime.xp; s.crimeExperience += crime.crimeExperience; s.crimesCompleted++; log(`SUCCESS: ${crime.name} paid ${money(reward)}.`, "success");
      } else if (outcome === "jailed") {
        s.crimesFailed++; s.timesJailed++; s.jailUntil = Date.now() + JAIL_MINUTES * 60000; log(`FAILED: ${crime.name}. You were jailed.`, "jailed");
      } else if (outcome === "critical-fail") {
        s.crimesFailed++; s.health = Math.max(1, s.health - 12); log(`CRITICAL FAIL: ${crime.name}. You escaped, barely.`, "critical");
      } else { s.crimesSpooked++; log(`SPOOKED: ${crime.name} failed without further consequences.`, "spooked"); }
      return s;
    });
  };

  const train = (stat: TrainingStat) => {
    if (blocked()) return log("You cannot train right now.");
    if (!canTrainStat(gym, stat)) return log("This gym cannot train that stat.");
    if (gameState.energy < gym.energyCost) return log(`You need ${gym.energyCost} energy.`);
    setGameState(prev => {
      const currentGym = GYMS.find(g => g.id === prev.activeGym) ?? GYMS[0];
      const educationMultiplier = prev.educationCompleted.some(id => id === "fitness-basics" || id === "advanced-fitness") ? 1.05 : 1;
      const result = applyTraining(prev.stats, currentGym, stat, prev.happiness, educationMultiplier);
      const s = { ...prev, energy: prev.energy - currentGym.energyCost, stats: result.stats, gymExperience: prev.gymExperience + getGymExperienceGain(currentGym.energyCost), gymSessions: prev.gymSessions + 1, happiness: Math.max(0, prev.happiness - currentGym.energyCost * 0.5) };
      log(`TRAINING: +${result.gain.toFixed(2)} ${stat}.`, "gym");
      return s;
    });
  };

  const buyGym = (id: string) => setGameState(prev => {
    const g = GYMS.find(x => x.id === id); if (!g || g.jailOnly || !gymUnlocked(g, prev.gymExperience)) return prev;
    if (prev.gymMemberships.includes(id)) { return { ...prev, activeGym: id }; }
    if (prev.cash < g.membershipCost) { log("Not enough cash for membership."); return prev; }
    log(`Joined ${g.name}.`, "success"); return { ...prev, cash: prev.cash - g.membershipCost, gymMemberships: [...prev.gymMemberships, id], activeGym: id };
  });

  const attack = (opponent: Opponent) => {
    if (blocked()) return log("You cannot attack right now.");
    if (gameState.energy < 25) return log("You need 25 energy to attack.");
    setCombatOpponent(opponent); setCombatMessage("The encounter begins. Choose your approach."); setCurrentScreen("combat");
  };

  const resolveAttack = () => {
    if (!combatOpponent) return;
    setGameState(prev => {
      const weapon = getItem(prev.equippedWeapon ?? "");
      const armor = getItem(prev.equippedArmor ?? "");
      const player: CombatStats = { ...prev.stats, strength: prev.stats.strength + (weapon?.effect ?? 0), defense: prev.stats.defense + (armor?.effect ?? 0) };
      const result = resolveCombat(player, combatOpponent.stats);
      const s = { ...prev, energy: prev.energy - 25, attacks: prev.attacks + 1 };
      if (result === "victory") { s.fightsWon++; s.cash += combatOpponent.rewardCash; s.xp += combatOpponent.rewardXp; s.health = Math.max(1, s.health - Math.floor(Math.random() * 15)); setCombatMessage(`VICTORY. You earned ${money(combatOpponent.rewardCash)} and ${combatOpponent.rewardXp} XP.`); log(`COMBAT WIN: ${combatOpponent.name}.`, "combat"); }
      else { s.fightsLost++; s.health = Math.max(1, s.health - Math.floor(20 + Math.random() * 30)); setCombatMessage(`DEFEAT. You were sent to hospital.`); s.hospitalUntil = Date.now() + HOSPITAL_MINUTES * 60000; log(`COMBAT LOSS: ${combatOpponent.name}. Hospital for ${HOSPITAL_MINUTES} minutes.`, "failure"); }
      return s;
    });
  };

  const buyItem = (id: string) => setGameState(prev => { const item = getItem(id); if (!item || prev.cash < item.price) { log("Not enough cash."); return prev; } log(`Bought ${item.name}.`, "success"); return { ...prev, cash: prev.cash - item.price, inventory: { ...prev.inventory, [id]: (prev.inventory[id] || 0) + 1 } }; });
  const useItem = (id: string) => setGameState(prev => { const item = getItem(id); const count = prev.inventory[id] || 0; if (!item || count <= 0) return prev; const s = { ...prev, inventory: { ...prev.inventory, [id]: count - 1 } }; if (item.type === "medical") s.health = Math.min(maxHealth, s.health + (item.effect || 0)); if (item.type === "energy") s.energy = Math.min(MAX_ENERGY, s.energy + (item.effect || 0)); if (item.type === "nerve") s.nerve = Math.min(maxNerve, s.nerve + (item.effect || 0)); log(`Used ${item.name}.`, "success"); return s; });
  const equip = (id: string) => setGameState(prev => { const item = getItem(id); if (!item || (prev.inventory[id] || 0) <= 0) return prev; return item.type === "weapon" ? { ...prev, equippedWeapon: id } : { ...prev, equippedArmor: id }; });
  const chooseEncounter = (choice: Encounter["choices"][number]) => { setGameState(prev => ({ ...prev, cash: Math.max(0, prev.cash + (choice.cash || 0)), xp: Math.max(0, prev.xp + (choice.xp || 0)), health: Math.max(1, Math.min(maxHealth, prev.health + (choice.health || 0))), energy: Math.max(0, Math.min(MAX_ENERGY, prev.energy + (choice.energy || 0))), nerve: Math.max(0, Math.min(maxNerve, prev.nerve + (choice.nerve || 0))) })); log(choice.text, "system"); setEncounter(null); };
  const randomEncounter = () => { if (blocked()) return log("You cannot explore right now."); setEncounter(ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)]); };
  const travel = (id: string) => setGameState(prev => {
    if (prev.currentLocation === id) return prev;
    if (prev.cash < TRAVEL_COST) { log(`Travel requires ${money(TRAVEL_COST)}.`); return prev; }
    if (prev.travelCooldownUntil && prev.travelCooldownUntil > Date.now()) { log(`Travel is on cooldown for ${formatTime(prev.travelCooldownUntil - Date.now())}.`); return prev; }
    log(`Travelled to ${LOCATIONS.find(x => x[0] === id)?.[1] || id}.`, "system");
    return { ...prev, cash: prev.cash - TRAVEL_COST, currentLocation: id, travelCooldownUntil: Date.now() + TRAVEL_COOLDOWN, locationsVisited: prev.locationsVisited.includes(id) ? prev.locationsVisited : [...prev.locationsVisited, id] };
  });
  const joinJob = (id: string) => setGameState(prev => { const j = getJob(id); if (!j) return prev; log(`Started work as ${j.title}.`, "job"); return { ...prev, currentJob: id, jobStartedAt: Date.now(), lastJobPayment: Date.now() }; });
  const buyProperty = (id: string) => setGameState(prev => { const p = getProperty(id); if (!p || prev.cash < p.price || p.price < (getProperty(prev.ownedProperty)?.price || 0)) return prev; log(`Moved into ${p.name}.`, "success"); return { ...prev, cash: prev.cash - p.price, ownedProperty: id, happiness: Math.min(p.maxHappiness, prev.happiness + 10) }; });
  const bankDeposit = (amount: number) => setGameState(prev => { const n = Math.min(prev.cash, Math.max(0, amount)); return { ...prev, cash: prev.cash - n, bank: prev.bank + n }; });
  const bankWithdraw = (amount: number) => setGameState(prev => { const n = Math.min(prev.bank, Math.max(0, amount)); return { ...prev, cash: prev.cash + n, bank: prev.bank - n }; });
  const startEducation = (id: string) => setGameState(prev => { const c = EDUCATION.find(x => x.id === id); if (!c || prev.educationActive || prev.educationCompleted.includes(id) || prev.cash < c.cost) return prev; log(`Started ${c.name}.`, "system"); return { ...prev, cash: prev.cash - c.cost, educationActive: id, educationStartedAt: Date.now() }; });
  const finishEducation = () => setGameState(prev => { const c = EDUCATION.find(x => x.id === prev.educationActive); if (!c || !prev.educationStartedAt || Date.now() - prev.educationStartedAt < c.durationHours * 3600000) return prev; log(`Completed ${c.name}.`, "success"); return { ...prev, educationActive: null, educationStartedAt: null, educationCompleted: [...prev.educationCompleted, c.id] }; });

  const missionProgress = (m: typeof MISSIONS[number]) => m.requirement === "crime" ? gameState.crimesCompleted : m.requirement === "combat" ? gameState.fightsWon : m.requirement === "gym" ? gameState.gymSessions : gameState.cash;
  const claimMission = (id: string) => setGameState(prev => { const m = MISSIONS.find(x => x.id === id); if (!m || prev.completedMissions.includes(id)) return prev; const progress = m.requirement === "crime" ? prev.crimesCompleted : m.requirement === "combat" ? prev.fightsWon : m.requirement === "gym" ? prev.gymSessions : prev.cash; if (progress < m.target) return prev; log(`Mission complete: ${m.name}.`, "success"); return { ...prev, cash: prev.cash + m.rewardCash, xp: prev.xp + m.rewardXp, completedMissions: [...prev.completedMissions, id] }; });

  const claimDaily = () => setGameState(prev => {
    if (prev.lastDailyClaim && Date.now() - prev.lastDailyClaim < DAILY_INTERVAL) { log("Daily reward is not ready yet."); return prev; }
    const streak = prev.lastDailyClaim && Date.now() - prev.lastDailyClaim < DAILY_INTERVAL * 2 ? prev.dailyStreak + 1 : 1;
    const reward = 500 + Math.min(5000, streak * 250);
    log(`Daily reward claimed: ${money(reward)} and 1 merit point.`, "success");
    return { ...prev, cash: prev.cash + reward, merits: prev.merits + 1, points: prev.points + 10, dailyStreak: streak, lastDailyClaim: Date.now() };
  });
  const joinFaction = (id: string) => setGameState(prev => {
    const cost = prev.faction ? 0 : 500;
    if (prev.faction === id) return prev;
    if (prev.faction && prev.faction !== id) { log("You must leave your current faction before joining another."); return prev; }
    if (prev.cash < cost) { log("You need $500 to join a faction."); return prev; }
    log(`Joined ${id}.`, "success"); return { ...prev, cash: prev.cash - cost, faction: id, factionReputation: 0 };
  });
  const workFaction = () => setGameState(prev => {
    if (!prev.faction) { log("Join a faction first."); return prev; }
    if (prev.energy < 10) { log("You need 10 energy."); return prev; }
    const gain = 5 + Math.floor(Math.random() * 10);
    log(`Faction work completed: +${gain} reputation.`, "success");
    return { ...prev, energy: prev.energy - 10, factionReputation: prev.factionReputation + gain, points: prev.points + 2 };
  });
  const tradeMarket = (id: string, buy: boolean) => setGameState(prev => {
    const prices: Record<string, number> = { food: 100, electronics: 250, scrap: 60, medical: 180 };
    const price = Math.max(1, Math.floor((prev.market[id] || prices[id] || 100) * (0.9 + Math.random() * 0.2)));
    const key = `market:${id}`; const owned = prev.inventory[key] || 0;
    if (buy) { if (prev.cash < price) { log("Not enough cash."); return prev; } log(`Bought ${id} for ${money(price)}.`); return { ...prev, cash: prev.cash - price, inventory: { ...prev.inventory, [key]: owned + 1 }, market: { ...prev.market, [id]: price } }; }
    if (owned <= 0) { log(`You don't own any ${id}.`); return prev; }
    log(`Sold ${id} for ${money(price)}.`, "success"); return { ...prev, cash: prev.cash + price, inventory: { ...prev.inventory, [key]: owned - 1 }, market: { ...prev.market, [id]: price } };
  });
  const earnMerit = (reason: string) => setGameState(prev => { if (prev.achievements.includes(reason)) return prev; log(`Achievement unlocked: ${reason}.`, "critical"); return { ...prev, achievements: [...prev.achievements, reason], merits: prev.merits + 1 }; });
  return { gameState, setGameState, currentScreen, setCurrentScreen, level, maxHealth, maxNerve, gym, job, education, encounter, setEncounter, combatOpponent, combatMessage, commitCrime, train, buyGym, attack, resolveAttack, buyItem, useItem, equip, randomEncounter, chooseEncounter, travel, joinJob, buyProperty, bankDeposit, bankWithdraw, startEducation, finishEducation, missionProgress, claimMission, claimDaily, joinFaction, workFaction, tradeMarket, earnMerit, travelLocked, log, resetGame: () => setGameState(freshSave()) };
}

function App() {
  const g = useRiftCity();
  const [bankAmount, setBankAmount] = useState("100");
  const levelInfo = getLevel(g.gameState.xp);
  const nav: { id: Screen; label: string; icon: string }[] = [
    {id:"character",label:"Character",icon:"👤"},{id:"city",label:"City",icon:"🏙️"},{id:"crimes",label:"Crimes",icon:"🕵️"},{id:"combat",label:"Combat",icon:"⚔️"},{id:"gym",label:"Gym",icon:"🏋️"},{id:"jobs",label:"Jobs",icon:"💼"},{id:"items",label:"Items",icon:"🎒"},{id:"missions",label:"Missions",icon:"📜"},{id:"education",label:"Education",icon:"🎓"},{id:"property",label:"Property",icon:"🏠"},{id:"market",label:"Market",icon:"📈"},{id:"faction",label:"Faction",icon:"🛡️"},{id:"awards",label:"Awards",icon:"🏆"},
  ];
  const title = nav.find(n => n.id === g.currentScreen)?.label || "RiftCity";
  return <div className="app-shell">
    <header className="topbar"><div><strong>RIFTCITY</strong><span className="muted">CORE</span></div><div className="topstats"><span>LV {g.level}</span><span>💵 {money(g.gameState.cash)}</span><span>🏦 {money(g.gameState.bank)}</span><span>⚡ {g.gameState.energy}/{MAX_ENERGY}</span><span>🧠 {g.gameState.nerve}/{g.maxNerve}</span><span>❤️ {Math.floor(g.gameState.health)}/{g.maxHealth}</span><span>😊 {Math.floor(g.gameState.happiness)}/{getProperty(g.gameState.ownedProperty)?.maxHappiness ?? 100}</span></div></header>
    <aside className="sidebar">{nav.map(n => <button className={g.currentScreen === n.id ? "nav active" : "nav"} onClick={() => g.setCurrentScreen(n.id)} key={n.id}><span>{n.icon}</span>{n.label}</button>)}<div className="side-bottom"><button onClick={g.randomEncounter}>🎲 Random Encounter</button><button onClick={() => { if (confirm("Reset your RiftCity save?")) g.resetGame(); }}>↻ Reset Save</button></div></aside>
    <main className="content"><div className="page-head"><div><div className="eyebrow">RIFTCITY / {g.gameState.currentLocation.toUpperCase()}</div><h1>{title}</h1></div><div className="bars"><div><small>XP {levelInfo.currentXp}/100</small><div className="bar"><i style={{ width: `${levelInfo.currentXp}%` }}/></div></div><div><small>Happiness {Math.floor(g.gameState.happiness)}</small><div className="bar"><i style={{ width: `${Math.min(100, g.gameState.happiness)}%` }}/></div></div></div></div>
      {g.gameState.jailUntil && <div className="alert jail">🔒 JAILED · {formatTime(timeLeft(g.gameState.jailUntil))} remaining</div>}
      {g.gameState.hospitalUntil && <div className="alert hospital">🏥 HOSPITAL · {formatTime(timeLeft(g.gameState.hospitalUntil))} remaining</div>}
      {g.currentScreen === "character" && <Character g={g}/>} 
      {g.currentScreen === "city" && <City g={g}/>} 
      {g.currentScreen === "crimes" && <Crimes g={g}/>} 
      {g.currentScreen === "combat" && <Combat g={g}/>} 
      {g.currentScreen === "gym" && <GymView g={g}/>} 
      {g.currentScreen === "jobs" && <Jobs g={g}/>} 
      {g.currentScreen === "items" && <Items g={g}/>} 
      {g.currentScreen === "missions" && <Missions g={g}/>} 
      {g.currentScreen === "education" && <Education g={g}/>} 
      {g.currentScreen === "property" && <PropertyView g={g}/>} {g.currentScreen === "market" && <Market g={g}/>} {g.currentScreen === "faction" && <Faction g={g}/>} {g.currentScreen === "awards" && <Awards g={g}/>} 
      <section className="panel activity"><div className="panel-title"><span>Activity</span><small>Latest events</small></div>{g.gameState.activities.slice(0, 10).map(a => <div className={`activity-row ${a.type}`} key={a.id}><span>{new Date(a.time).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</span><b>{a.type.toUpperCase()}</b><p>{a.text}</p></div>)}</section>
    </main>
    {g.encounter && <div className="modal-backdrop"><div className="modal"><span className="eyebrow">RANDOM ENCOUNTER</span><h2>{g.encounter.title}</h2><p>{g.encounter.text}</p>{g.encounter.choices.map((c, i) => <button className="choice" key={i} onClick={() => g.chooseEncounter(c)}>{c.label}</button>)}<button className="ghost" onClick={() => g.setEncounter(null)}>Leave</button></div></div>}
  </div>;
}

function Panel({title, children, className=""}: {title: string; children: React.ReactNode; className?: string}) { return <section className={`panel ${className}`}><div className="panel-title"><span>{title}</span></div>{children}</section>; }
function Button({children, onClick, disabled=false, className=""}: {children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string}) { return <button className={`action ${className}`} disabled={disabled} onClick={onClick}>{children}</button>; }

function Character({g}: {g: ReturnType<typeof useRiftCity>}) {
  const [amount,setAmount]=useState("100");
  const n=Math.max(0,Number(amount)||0);
  return <div className="grid two"><Panel title="Combat Stats"><div className="stat-grid">{Object.entries(g.gameState.stats).map(([k,v]) => <div className="stat" key={k}><span>{k}</span><strong>{(v as number).toFixed(2)}</strong></div>)}</div></Panel><Panel title="Core Resources"><div className="resource-grid"><div><b>❤️ Health</b><span>{Math.floor(g.gameState.health)} / {g.maxHealth}</span></div><div><b>⚡ Energy</b><span>{g.gameState.energy} / {MAX_ENERGY}</span></div><div><b>🧠 Nerve</b><span>{g.gameState.nerve} / {g.maxNerve}</span></div><div><b>😊 Happiness</b><span>{Math.floor(g.gameState.happiness)} / {getProperty(g.gameState.ownedProperty)?.maxHappiness ?? 100}</span></div></div></Panel><Panel title="Progress"><div className="rows"><p><span>Crime experience</span><b>{g.gameState.crimeExperience}</b></p><p><span>Gym experience</span><b>{g.gameState.gymExperience}</b></p><p><span>Crimes</span><b>{g.gameState.crimesCompleted} / {g.gameState.crimesFailed} failed</b></p><p><span>Fights</span><b>{g.gameState.fightsWon}W / {g.gameState.fightsLost}L</b></p><p><span>Current job</span><b>{g.job?.title ?? "Unemployed"}</b></p><p><span>Property</span><b>{getProperty(g.gameState.ownedProperty)?.name}</b></p></div></Panel><Panel title="Bank"><div className="bank"><h3>{money(g.gameState.bank)}</h3><input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)} /><div><Button onClick={() => g.bankDeposit(n)}>Deposit</Button><Button onClick={() => g.bankWithdraw(n)}>Withdraw</Button></div></div></Panel><Panel title="Wallet & Equipment"><div className="rows"><p><span>Cash</span><b>{money(g.gameState.cash)}</b></p><p><span>Weapon</span><b>{getItem(g.gameState.equippedWeapon || "")?.name || "None"}</b></p><p><span>Armor</span><b>{getItem(g.gameState.equippedArmor || "")?.name || "None"}</b></p></div></Panel></div> }
function City({g}: {g: ReturnType<typeof useRiftCity>}) { return <><div className="grid four">{LOCATIONS.map(([id,name,desc]) => <div className="card" key={id}><span className="eyebrow">LOCATION</span><h3>{name}</h3><p>{desc}</p><Button onClick={() => g.travel(id)}>{g.gameState.currentLocation === id ? "Current Location" : "Travel"}</Button></div>)}</div><Panel title="City Interactions"><div className="grid three"><Button onClick={g.randomEncounter}>🎲 Explore</Button><Button onClick={() => g.setCurrentScreen("crimes")}>🕵️ Find Work</Button><Button onClick={() => g.setCurrentScreen("combat")}>⚔️ Find a Fight</Button></div></Panel></> }
function Crimes({g}: {g: ReturnType<typeof useRiftCity>}) { return <div className="grid two">{CRIMES.map(c => { const chance = crimeSuccessChance(c, g.gameState.crimeExperience, 1, getCrimeStatBonus(g.gameState.stats)); const unlocked = crimeUnlocked(c, g.gameState.crimeExperience); return <div className={`card ${unlocked ? "" : "locked"}`} key={c.id}><div className="card-top"><span className="tag">NERVE {c.nerve}</span><span className="chance">{unlocked ? `${chance.toFixed(0)}%` : `CE ${c.crimeExperienceRequired}`}</span></div><h3>{c.name}</h3><p>{c.description}</p><div className="meter"><i style={{width: `${unlocked ? chance : 0}%`}}/></div><small>Success chance · risk {c.risk}%</small><Button disabled={!unlocked || g.gameState.nerve < c.nerve} onClick={() => g.commitCrime(c)}>Commit Crime</Button></div>})}</div> }
function Combat({g}: {g: ReturnType<typeof useRiftCity>}) {
  return <><Panel title="Player Search"><p>Select a real player-profile style opponent. Profiles show level, status, location, equipment, health and combat stats before you attack.</p><div className="grid two">{OPPONENTS.map(o => <div className="card" key={o.id}>
    <div className="card-top"><span className="tag">LV {o.level}</span><span className="chance">{o.status}</span></div>
    <h3>{o.name}</h3><p>{o.title} · {o.location}</p>
    <div className="rows"><p><span>Health</span><b>{o.health}/{o.maxHealth}</b></p><p><span>Faction</span><b>{o.faction}</b></p><p><span>Weapon</span><b>{o.weapon}</b></p><p><span>Armor</span><b>{o.armor}</b></p><p><span>Bounty</span><b>{money(o.bounty)}</b></p></div>
    <div className="stat-grid">{Object.entries(o.stats).map(([k,v])=><div className="stat" key={k}><span>{k}</span><strong>{(v as number).toFixed(0)}</strong></div>)}</div>
    <p><small>Estimated win chance: {calculateWinChance(g.gameState.stats, o.stats).toFixed(0)}%</small></p>
    <Button onClick={() => g.attack(o)} disabled={Boolean(g.gameState.jailUntil || g.gameState.hospitalUntil) || g.gameState.energy<25}>Attack · 25 ⚡</Button>
  </div>)}</div></Panel>
  {g.combatOpponent && <Panel title={`Fight: ${g.combatOpponent.name}`}>
    <div className="combat-box"><p>{g.combatMessage}</p><Button onClick={g.resolveAttack} disabled={g.gameState.energy<25}>Resolve Fight</Button></div>
  </Panel>}</>
}
function GymView({g}: {g: ReturnType<typeof useRiftCity>}) { return <><div className="gym-switch">{GYMS.filter(x => !x.jailOnly).map(x => <button className={g.gym.id === x.id ? "selected" : ""} key={x.id} disabled={!gymUnlocked(x,g.gameState.gymExperience)} onClick={() => g.buyGym(x.id)}>{x.name}<small>{gymUnlocked(x,g.gameState.gymExperience) ? money(x.membershipCost) : `EXP ${x.gymExpRequired}`}</small></button>)}</div><Panel title={`${g.gym.name} · ${g.gym.energyCost} energy`}><p>{g.gym.description}</p><div className="grid four">{TRAINING_STATS.map(s => <div className="card mini" key={s.id}><span className="icon">{s.icon}</span><h3>{s.name}</h3><p>{s.description}</p><Button disabled={!canTrainStat(g.gym,s.id)} onClick={() => g.train(s.id)}>Train</Button></div>)}</div></Panel></> }
function Jobs({g}: {g: ReturnType<typeof useRiftCity>}) { return <><Panel title="Employment"><p>Jobs are available through the city employment system. Better roles pay more; advancement is driven by your overall progression, not an arbitrary level gate.</p></Panel><div className="grid two">{JOBS.map(j => <div className="card" key={j.id}><span className="eyebrow">{j.company}</span><h3>{j.title}</h3><p>{j.description}</p><div className="rows"><p><span>Hourly payout</span><b>{money(j.salary)}</b></p><p><span>Status</span><b>{g.gameState.currentJob===j.id?"Current":"Available"}</b></p></div><Button onClick={() => g.joinJob(j.id)}>{g.gameState.currentJob === j.id ? "Current Job" : "Take Job"}</Button></div>)}</div></> }
function Items({g}: {g: ReturnType<typeof useRiftCity>}) { return <div className="grid three">{ITEMS.map(i => <div className="card" key={i.id}><span className="tag">{i.type}</span><h3>{i.name}</h3><p>{i.description}</p><strong>{money(i.price)}</strong><div className="button-row"><Button onClick={() => g.buyItem(i.id)}>Buy</Button>{(g.gameState.inventory[i.id]||0)>0 && <Button onClick={() => i.type === "weapon" || i.type === "armor" ? g.equip(i.id) : g.useItem(i.id)}>{i.type === "weapon" || i.type === "armor" ? "Equip" : "Use"}</Button>}</div><small>Owned: {g.gameState.inventory[i.id]||0}</small></div>)}</div> }
function Missions({g}: {g: ReturnType<typeof useRiftCity>}) { return <div className="grid two">{MISSIONS.map(m => { const p=g.missionProgress(m); const done=g.gameState.completedMissions.includes(m.id); return <div className="card" key={m.id}><span className="eyebrow">MISSION</span><h3>{m.name}</h3><p>{m.description}</p><div className="meter"><i style={{width:`${Math.min(100,p/m.target*100)}%`}}/></div><p>{Math.min(p,m.target).toLocaleString()} / {m.target.toLocaleString()}</p><Button disabled={done || p<m.target} onClick={() => g.claimMission(m.id)}>{done ? "Claimed" : "Claim Reward"}</Button></div>})}</div> }
function Education({g}: {g: ReturnType<typeof useRiftCity>}) { return <><Panel title="Active Course">{g.education ? <><h3>{g.education.name}</h3><p>Started {new Date(g.gameState.educationStartedAt || Date.now()).toLocaleString()} · {g.education.durationHours}h</p><Button onClick={g.finishEducation}>Check Completion</Button></> : <p>No active course.</p>}</Panel><div className="grid two">{EDUCATION.map(c => <div className="card" key={c.id}><h3>{c.name}</h3><p>{c.description}</p><div className="rows"><p><span>Cost</span><b>{money(c.cost)}</b></p><p><span>Time</span><b>{c.durationHours}h</b></p><p><span>Requirement</span><b>Level {c.levelRequired}</b></p></div><Button disabled={g.gameState.educationCompleted.includes(c.id) || Boolean(g.education) || g.gameState.cash<c.cost} onClick={() => g.startEducation(c.id)}>{g.gameState.educationCompleted.includes(c.id)?"Completed":"Enroll"}</Button></div>)}</div></> }
function PropertyView({g}: {g: ReturnType<typeof useRiftCity>}) { const current=getProperty(g.gameState.ownedProperty)?.price||0; return <div className="grid two">{PROPERTIES.map(p=><div className={`card ${p.price<current?"locked":""}`} key={p.id}><span className="eyebrow">PROPERTY</span><h3>{p.name}</h3><p>{p.description}</p><div className="rows"><p><span>Price</span><b>{money(p.price)}</b></p><p><span>Health bonus</span><b>+{p.maxHealthBonus}</b></p><p><span>Nerve bonus</span><b>+{p.nerveBonus}</b></p></div><Button disabled={p.price<current || g.gameState.cash<p.price} onClick={()=>g.buyProperty(p.id)}>{g.gameState.ownedProperty===p.id?"Current Home":"Move In"}</Button></div>)}</div> }

function Market({g}: {g: ReturnType<typeof useRiftCity>}) { const goods = Object.keys(g.gameState.market); return <><Panel title="City Market"><p>Prices move every trade. Buy low, sell when the market swings back up.</p><div className="grid four">{goods.map(id => { const key=`market:${id}`; return <div className="card mini" key={id}><span className="tag">TRADEABLE</span><h3>{id}</h3><p>Current reference: {money(g.gameState.market[id])}</p><small>Owned: {g.gameState.inventory[key]||0}</small><div className="button-row"><Button onClick={()=>g.tradeMarket(id,true)}>Buy</Button><Button onClick={()=>g.tradeMarket(id,false)} disabled={!g.gameState.inventory[key]}>Sell</Button></div></div>})}</div></Panel></> }
function Faction({g}: {g: ReturnType<typeof useRiftCity>}) { const factions=["Iron Syndicate","Rift Guard","Dock Union"]; return <><Panel title="Faction"><p>Faction reputation unlocks status and earns points. Membership is persistent.</p><div className="grid three">{factions.map(f=><div className={`card ${g.gameState.faction && g.gameState.faction!==f?"locked":""}`} key={f}><h3>{f}</h3><p>{g.gameState.faction===f?`Reputation: ${g.gameState.factionReputation}`:"Join for $500"}</p><Button disabled={Boolean(g.gameState.faction) && g.gameState.faction!==f} onClick={()=>g.joinFaction(f)}>{g.gameState.faction===f?"Member":"Join"}</Button></div>)}</div>{g.gameState.faction && <Button onClick={g.workFaction}>Work for faction · 10 ⚡</Button>}</Panel></> }
function Awards({g}: {g: ReturnType<typeof useRiftCity>}) { const awards=[['First Crime',g.gameState.crimesCompleted>=1],['Ten Crimes',g.gameState.crimesCompleted>=10],['First Victory',g.gameState.fightsWon>=1],['Gym Rat',g.gameState.gymSessions>=10],['Five Figures',g.gameState.cash>=100000],['Level 10',g.level>=10]]; return <><Panel title="Awards & Merits"><p>Permanent milestones grant merit points. No progress gets erased just because the interface had a mood swing.</p><div className="grid three">{awards.map(([name,done])=><div className={`card ${done?"":"locked"}`} key={String(name)}><h3>{name}</h3><p>{done?"Unlocked":"Locked"}</p>{done && !g.gameState.achievements.includes(name as string) && <Button onClick={()=>g.earnMerit(name as string)}>Claim Merit</Button>}</div>)}</div><div className="rows"><p><span>Merits</span><b>{g.gameState.merits}</b></p><p><span>Points</span><b>{g.gameState.points}</b></p><p><span>Daily streak</span><b>{g.gameState.dailyStreak}</b></p><p><span>Bank interest earned</span><b>{money(g.gameState.bankInterest)}</b></p></div></Panel><Panel title="Daily"><p>{g.gameState.lastDailyClaim && Date.now()-g.gameState.lastDailyClaim<DAILY_INTERVAL?"Claimed for today.":"Ready to claim."}</p><Button onClick={g.claimDaily}>Claim Daily Reward</Button></Panel></> }

export default App;
