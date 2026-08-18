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
  getNaturalNerveMax,
} from "./systems/progressionSystem";
import {
  ENERGY_REGEN_INTERVAL,
  MAX_ENERGY,
  NERVE_REGEN_INTERVAL,
  regenerateResources,
  getEnergyTimeRemaining,
  getNerveTimeRemaining,
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

type Screen = "character" | "city" | "crimes" | "combat" | "gym" | "jobs" | "items" | "missions" | "education" | "property" | "bank" | "market";
type ActivityType = "success" | "failure" | "critical" | "spooked" | "jailed" | "combat" | "gym" | "job" | "system" | "bank" | "market" | "travel";
type Activity = { id: number; text: string; type: ActivityType; time: number };
type Encounter = { id: string; title: string; text: string; choices: { label: string; cash?: number; xp?: number; health?: number; energy?: number; nerve?: number; text: string }[] };

type SaveData = {
  cash: number; bank: number; xp: number;
  energy: number; lastEnergyUpdate: number;
  nerve: number; lastNerveUpdate: number;
  health: number;
  crimeExperience: number;
  crimesById: Record<string, number>;
  bankLastInterest: number;
  bankInterestEarned: number;
  points: number;
  merits: number;
  dailyStreak: number;
  lastDailyClaim: number | null;
  netWorthPeak: number;
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
  locationsVisited: string[]; currentLocation: string;
  activities: Activity[];
};

const SAVE_KEY = "riftcity-core-v6";
const BANK_INTEREST_INTERVAL = 24 * 60 * 60 * 1000;
const BANK_INTEREST_RATE = 0.005;
const DAILY_INTERVAL = 24 * 60 * 60 * 1000;
const JOB_PAY_INTERVAL = 60 * 60 * 1000;
const HAPPINESS_TICK = 15 * 60 * 1000;
const JAIL_MINUTES = 2;
const HOSPITAL_MINUTES = 2;
const BASE_HAPPINESS = 100;

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
    cash: 1000, bank: 0, xp: 0, energy: 100, lastEnergyUpdate: now,
    nerve: 10, lastNerveUpdate: now, health: 100, crimeExperience: 0,
    crimesById: {}, bankLastInterest: now, bankInterestEarned: 0,
    points: 0, merits: 0, dailyStreak: 0, lastDailyClaim: null, netWorthPeak: 1000,
    stats: { strength: 1, defense: 1, speed: 1, dexterity: 1 },
    gymExperience: 0, gymMemberships: ["premier-fitness"], activeGym: "premier-fitness",
    happiness: BASE_HAPPINESS, lastHappinessUpdate: now, currentJob: null,
    jobStartedAt: now, lastJobPayment: now, jailUntil: null, hospitalUntil: null,
    inventory: {}, equippedWeapon: null, equippedArmor: null, ownedProperty: "shack",
    educationCompleted: [], educationActive: null, educationStartedAt: null,
    completedMissions: [], crimesCompleted: 0, crimesFailed: 0, crimesSpooked: 0, crimesCritical: 0,
    timesJailed: 0, fightsWon: 0, fightsLost: 0, gymSessions: 0, attacks: 0,
    locationsVisited: ["city-center"], currentLocation: "city-center",
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
      crimesById: parsed.crimesById || {},
      bankLastInterest: typeof parsed.bankLastInterest === "number" ? parsed.bankLastInterest : base.bankLastInterest,
      bankInterestEarned: parsed.bankInterestEarned || 0,
      points: parsed.points || 0,
      merits: parsed.merits || 0,
      dailyStreak: parsed.dailyStreak || 0,
      lastDailyClaim: parsed.lastDailyClaim ?? null,
      netWorthPeak: parsed.netWorthPeak || (parsed.cash || 0) + (parsed.bank || 0),
      stats: { ...base.stats, ...(parsed.stats || {}) },
      inventory: parsed.inventory || {},
      activities: Array.isArray(parsed.activities) ? parsed.activities : base.activities,
      gymMemberships: Array.isArray(parsed.gymMemberships) ? parsed.gymMemberships : base.gymMemberships,
      educationCompleted: Array.isArray(parsed.educationCompleted) ? parsed.educationCompleted : [],
      completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      locationsVisited: Array.isArray(parsed.locationsVisited) ? parsed.locationsVisited : ["city-center"],
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
  const maxNerve = getNaturalNerveMax(gameState.crimeExperience) + (property?.nerveBonus ?? 0);
  const gym = GYMS.find(g => g.id === gameState.activeGym) ?? GYMS[0];
  const job = getJob(gameState.currentJob);
  const education = EDUCATION.find(e => e.id === gameState.educationActive) ?? null;
  const propertyMaxHappiness = property?.maxHappiness ?? 100;

  const log = (text: string, type: ActivityType = "system") => setGameState(s => ({ ...s, activities: [{ id: Date.now() + Math.random(), text, type, time: Date.now() }, ...s.activities].slice(0, 60) }));

  useEffect(() => { localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)); }, [gameState]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setGameState(prev => {
        let s = { ...prev };
        let changed = false;

        const resources = regenerateResources(
          { energy: s.energy, nerve: s.nerve, lastEnergyUpdate: s.lastEnergyUpdate, lastNerveUpdate: s.lastNerveUpdate },
          now,
          maxNerve
        );
        if (resources.energy !== s.energy || resources.nerve !== s.nerve ||
            resources.lastEnergyUpdate !== s.lastEnergyUpdate || resources.lastNerveUpdate !== s.lastNerveUpdate) {
          s = { ...s, ...resources }; changed = true;
        }

        const maxHappy = property?.maxHappiness ?? 100;
        if (s.happiness < maxHappy) {
          const ticks = Math.floor(Math.max(0, now - s.lastHappinessUpdate) / HAPPINESS_TICK);
          if (ticks > 0) {
            s.happiness = Math.min(maxHappy, s.happiness + ticks * 2);
            s.lastHappinessUpdate += ticks * HAPPINESS_TICK;
            changed = true;
          }
        } else if (s.lastHappinessUpdate !== now) {
          s.lastHappinessUpdate = now;
        }

        if (s.health < maxHealth && !s.hospitalUntil && !s.jailUntil) {
          s.health = Math.min(maxHealth, s.health + 1);
          changed = true;
        }

        if (s.jailUntil && now >= s.jailUntil) {
          s.jailUntil = null; s.happiness = Math.min(maxHappy, s.happiness + 3); changed = true;
          s.activities = [{ id: now + Math.random(), text: "You have been released from jail.", type: "success", time: now }, ...s.activities].slice(0, 60);
        }

        if (s.hospitalUntil && now >= s.hospitalUntil) {
          s.hospitalUntil = null; s.health = maxHealth; changed = true;
          s.activities = [{ id: now + Math.random(), text: "You have recovered and left hospital.", type: "success", time: now }, ...s.activities].slice(0, 60);
        }

        if (s.currentJob && now - s.lastJobPayment >= JOB_PAY_INTERVAL && job) {
          const ticks = Math.floor((now - s.lastJobPayment) / JOB_PAY_INTERVAL);
          const pay = job.salary * ticks;
          s.cash += pay;
          s.lastJobPayment += ticks * JOB_PAY_INTERVAL;
          s.points += Math.min(10, ticks);
          changed = true;
          s.activities = [{ id: now + Math.random(), text: `Salary received: ${money(pay)}.`, type: "job", time: now }, ...s.activities].slice(0, 60);
        }

        if (s.bank > 0 && now - s.bankLastInterest >= BANK_INTEREST_INTERVAL) {
          const ticks = Math.floor((now - s.bankLastInterest) / BANK_INTEREST_INTERVAL);
          const interest = Math.floor(s.bank * (Math.pow(1 + BANK_INTEREST_RATE, ticks) - 1));
          if (interest > 0) {
            s.bank += interest;
            s.bankInterestEarned += interest;
            s.bankLastInterest += ticks * BANK_INTEREST_INTERVAL;
            s.points += 1;
            changed = true;
            s.activities = [{ id: now + Math.random(), text: `Bank interest credited: ${money(interest)}.`, type: "bank", time: now }, ...s.activities].slice(0, 60);
          } else {
            s.bankLastInterest = now;
          }
        }

        const worth = s.cash + s.bank;
        if (worth > s.netWorthPeak) { s.netWorthPeak = worth; changed = true; }

        return changed ? s : prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [maxNerve, maxHealth, property?.maxHappiness, job]);

  const blocked = () => Boolean(gameState.jailUntil || gameState.hospitalUntil);

  const commitCrime = (crime: Crime) => {
    if (blocked()) return log(gameState.jailUntil ? "You are in jail." : "You are in hospital.");
    if (!crimeUnlocked(crime, level)) return log("That crime is locked.");
    if (gameState.nerve < crime.nerve) return log("Not enough nerve.");
    setGameState(prev => {
      const chance = crimeSuccessChance(crime, prev.crimeExperience, 1, getCrimeStatBonus(prev.stats));
      const roll = Math.random() * 100;
      const outcome = roll < chance * 0.08 ? "critical" : roll > 99.5 ? "critical-fail" : roll < chance ? "success" : roll < chance + crime.risk * 0.55 ? "jailed" : "spooked";
      const s = { ...prev, nerve: prev.nerve - crime.nerve };
      if (outcome === "critical") {
        const reward = Math.floor(randomReward(crime) * 1.75); s.cash += reward; s.xp += crime.xp * 2; s.crimeExperience += crime.crimeExperience * 2; s.crimesCompleted++; s.crimesCritical++; s.crimesById[crime.id] = (s.crimesById[crime.id] || 0) + 1; s.points += 3; log(`CRITICAL SUCCESS: ${crime.name} paid ${money(reward)}.`, "critical");
      } else if (outcome === "success") {
        const reward = randomReward(crime); s.cash += reward; s.xp += crime.xp; s.crimeExperience += crime.crimeExperience; s.crimesCompleted++; s.crimesById[crime.id] = (s.crimesById[crime.id] || 0) + 1; s.points += 1; log(`SUCCESS: ${crime.name} paid ${money(reward)}.`, "success");
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
      if (result === "victory") { s.fightsWon++; s.cash += combatOpponent.rewardCash; s.xp += combatOpponent.rewardXp; s.points += 2; s.health = Math.max(1, s.health - Math.floor(Math.random() * 15)); setCombatMessage(`VICTORY. You earned ${money(combatOpponent.rewardCash)} and ${combatOpponent.rewardXp} XP.`); log(`COMBAT WIN: ${combatOpponent.name}.`, "combat"); }
      else { s.fightsLost++; s.health = Math.max(1, s.health - Math.floor(20 + Math.random() * 30)); setCombatMessage(`DEFEAT. You were sent to hospital.`); s.hospitalUntil = Date.now() + HOSPITAL_MINUTES * 60000; log(`COMBAT LOSS: ${combatOpponent.name}. Hospital for ${HOSPITAL_MINUTES} minutes.`, "failure"); }
      return s;
    });
  };

  const buyItem = (id: string) => setGameState(prev => { const item = getItem(id); if (!item || prev.cash < item.price) { log("Not enough cash."); return prev; } log(`Bought ${item.name}.`, "success"); return { ...prev, cash: prev.cash - item.price, points: prev.points + 1, happiness: prev.happiness, inventory: { ...prev.inventory, [id]: (prev.inventory[id] || 0) + 1 } }; });
  const useItem = (id: string) => setGameState(prev => { const item = getItem(id); const count = prev.inventory[id] || 0; if (!item || count <= 0) return prev; const s = { ...prev, inventory: { ...prev.inventory, [id]: count - 1 } }; if (item.type === "medical") s.health = Math.min(maxHealth, s.health + (item.effect || 0)); if (item.type === "energy") s.energy = Math.min(MAX_ENERGY, s.energy + (item.effect || 0)); if (item.type === "nerve") s.nerve = Math.min(maxNerve, s.nerve + (item.effect || 0)); log(`Used ${item.name}.`, "success"); return s; });
  const equip = (id: string) => setGameState(prev => { const item = getItem(id); if (!item || (prev.inventory[id] || 0) <= 0) return prev; return item.type === "weapon" ? { ...prev, equippedWeapon: id } : { ...prev, equippedArmor: id }; });
  const chooseEncounter = (choice: Encounter["choices"][number]) => { setGameState(prev => ({ ...prev, cash: Math.max(0, prev.cash + (choice.cash || 0)), xp: Math.max(0, prev.xp + (choice.xp || 0)), health: Math.max(1, Math.min(maxHealth, prev.health + (choice.health || 0))), energy: Math.max(0, Math.min(MAX_ENERGY, prev.energy + (choice.energy || 0))), nerve: Math.max(0, Math.min(maxNerve, prev.nerve + (choice.nerve || 0))) })); log(choice.text, "system"); setEncounter(null); };
  const randomEncounter = () => { if (blocked()) return log("You cannot explore right now."); setEncounter(ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)]); };
  const travel = (id: string) => setGameState(prev => {
    if (prev.currentLocation === id) return prev;
    if (prev.energy < 2) { log("You need 2 energy to travel."); return prev; }
    log(`Travelled to ${LOCATIONS.find(x => x[0] === id)?.[1] || id}.`, "travel");
    return { ...prev, energy: prev.energy - 2, happiness: Math.max(0, prev.happiness - 1), currentLocation: id, locationsVisited: prev.locationsVisited.includes(id) ? prev.locationsVisited : [...prev.locationsVisited, id] };
  });
  const joinJob = (id: string) => setGameState(prev => { const j = getJob(id); if (!j || level < j.levelRequired) return prev; log(`Started work as ${j.title}.`, "job"); return { ...prev, currentJob: id, jobStartedAt: Date.now(), lastJobPayment: Date.now() }; });
  const buyProperty = (id: string) => setGameState(prev => { const p = getProperty(id); if (!p || prev.cash < p.price || p.price < (getProperty(prev.ownedProperty)?.price || 0)) return prev; log(`Moved into ${p.name}.`, "success"); return { ...prev, cash: prev.cash - p.price, ownedProperty: id, happiness: Math.min(p.maxHappiness, prev.happiness + 10) }; });
  const bankDeposit = (amount: number) => setGameState(prev => { const n = Math.min(prev.cash, Math.max(0, amount)); return { ...prev, cash: prev.cash - n, bank: prev.bank + n }; });
  const bankWithdraw = (amount: number) => setGameState(prev => { const n = Math.min(prev.bank, Math.max(0, amount)); return { ...prev, cash: prev.cash + n, bank: prev.bank - n }; });
  const startEducation = (id: string) => setGameState(prev => { const c = EDUCATION.find(x => x.id === id); if (!c || prev.educationActive || prev.educationCompleted.includes(id) || level < c.levelRequired || prev.cash < c.cost) return prev; log(`Started ${c.name}.`, "system"); return { ...prev, cash: prev.cash - c.cost, educationActive: id, educationStartedAt: Date.now() }; });
  const finishEducation = () => setGameState(prev => { const c = EDUCATION.find(x => x.id === prev.educationActive); if (!c || !prev.educationStartedAt || Date.now() - prev.educationStartedAt < c.durationHours * 3600000) return prev; log(`Completed ${c.name}.`, "success"); return { ...prev, educationActive: null, educationStartedAt: null, educationCompleted: [...prev.educationCompleted, c.id] }; });

  const missionProgress = (m: typeof MISSIONS[number]) => m.requirement === "crime" ? gameState.crimesCompleted : m.requirement === "combat" ? gameState.fightsWon : m.requirement === "gym" ? gameState.gymSessions : gameState.cash;
  const claimMission = (id: string) => setGameState(prev => { const m = MISSIONS.find(x => x.id === id); if (!m || prev.completedMissions.includes(id)) return prev; const progress = m.requirement === "crime" ? prev.crimesCompleted : m.requirement === "combat" ? prev.fightsWon : m.requirement === "gym" ? prev.gymSessions : prev.cash; if (progress < m.target) return prev; log(`Mission complete: ${m.name}.`, "success"); return { ...prev, cash: prev.cash + m.rewardCash, xp: prev.xp + m.rewardXp, completedMissions: [...prev.completedMissions, id] }; });

  const quitJob = () => setGameState(prev => {
    if (!prev.currentJob) return prev;
    log("You resigned from your current job.", "job");
    return { ...prev, currentJob: null, jobStartedAt: Date.now(), lastJobPayment: Date.now() };
  });

  const claimDaily = () => setGameState(prev => {
    const now = Date.now();
    if (prev.lastDailyClaim && now - prev.lastDailyClaim < DAILY_INTERVAL) return prev;
    const streak = prev.lastDailyClaim && now - prev.lastDailyClaim < DAILY_INTERVAL * 2 ? prev.dailyStreak + 1 : 1;
    const reward = 250 + Math.min(10, streak) * 50;
    log(`Daily reward claimed: ${money(reward)}.`, "success");
    return { ...prev, cash: prev.cash + reward, points: prev.points + 5, dailyStreak: streak, lastDailyClaim: now };
  });

  const rest = () => setGameState(prev => {
    if (blocked()) return prev;
    const maxHappy = property?.maxHappiness ?? 100;
    const gain = Math.min(15, maxHappy - prev.happiness);
    const energyGain = Math.min(10, MAX_ENERGY - prev.energy);
    log(`You rested. +${gain} happiness, +${energyGain} energy.`, "system");
    return { ...prev, happiness: prev.happiness + gain, energy: prev.energy + energyGain };
  });

  const sellItem = (id: string, quantity = 1) => setGameState(prev => {
    const item = getItem(id);
    const owned = prev.inventory[id] || 0;
    const qty = Math.max(0, Math.min(owned, Math.floor(quantity)));
    if (!item || qty <= 0) return prev;
    const value = Math.floor(item.price * 0.6) * qty;
    log(`Sold ${qty} × ${item.name} for ${money(value)}.`, "market");
    return { ...prev, cash: prev.cash + value, inventory: { ...prev.inventory, [id]: owned - qty } };
  });

  return { gameState, setGameState, currentScreen, propertyMaxHappiness, setCurrentScreen, level, maxHealth, maxNerve, gym, job, education, encounter, setEncounter, combatOpponent, combatMessage, commitCrime, train, buyGym, attack, resolveAttack, buyItem, useItem, equip, randomEncounter, chooseEncounter, travel, joinJob, buyProperty, bankDeposit, bankWithdraw, startEducation, finishEducation, missionProgress, claimMission, quitJob, claimDaily, rest, sellItem, log, resetGame: () => setGameState(freshSave()) };
}

function App() {
  const g = useRiftCity();
  const [bankAmount, setBankAmount] = useState("100");
  const levelInfo = getLevel(g.gameState.xp);
  const nav: { id: Screen; label: string; icon: string }[] = [
    {id:"character",label:"Character",icon:"👤"},{id:"city",label:"City",icon:"🏙️"},{id:"crimes",label:"Crimes",icon:"🕵️"},{id:"combat",label:"Combat",icon:"⚔️"},{id:"gym",label:"Gym",icon:"🏋️"},{id:"jobs",label:"Jobs",icon:"💼"},{id:"items",label:"Items",icon:"🎒"},{id:"missions",label:"Missions",icon:"📜"},{id:"education",label:"Education",icon:"🎓"},{id:"property",label:"Property",icon:"🏠"},{id:"bank",label:"Bank",icon:"🏦"},{id:"market",label:"Market",icon:"🛒"},
  ];
  const title = nav.find(n => n.id === g.currentScreen)?.label || "RiftCity";
  return <div className="app-shell">
    <header className="topbar"><div><strong>RIFTCITY</strong><span className="muted">CORE</span></div><div className="topstats"><span>LV {g.level}</span><span>💵 {money(g.gameState.cash)}</span><span>🏦 {money(g.gameState.bank)}</span><span>⚡ {g.gameState.energy}/{MAX_ENERGY}</span><span>🧠 {g.gameState.nerve}/{g.maxNerve}</span><span>❤️ {Math.floor(g.gameState.health)}/{g.maxHealth}</span></div></header>
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
      {g.currentScreen === "property" && <PropertyView g={g}/>} {g.currentScreen === "bank" && <BankView g={g}/>} {g.currentScreen === "market" && <MarketView g={g}/>} 
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
  const info=getLevel(g.gameState.xp);
  const netWorth=g.gameState.cash+g.gameState.bank;
  const dailyReady=!g.gameState.lastDailyClaim || Date.now()-g.gameState.lastDailyClaim>=DAILY_INTERVAL;
  const energyTimer=getEnergyTimeRemaining(g.gameState.energy,Date.now(),g.gameState.lastEnergyUpdate);
  const nerveTimer=getNerveTimeRemaining(g.gameState.nerve,g.maxNerve,Date.now(),g.gameState.lastNerveUpdate);
  return <div className="grid two">
    <Panel title="Core Resources"><div className="stat-grid">
      <div className="stat"><span>❤️ Health</span><strong>{Math.floor(g.gameState.health)} / {g.maxHealth}</strong></div>
      <div className="stat"><span>⚡ Energy</span><strong>{g.gameState.energy} / {MAX_ENERGY}</strong><small>{g.gameState.energy<MAX_ENERGY ? `next +1 in ${Math.ceil(energyTimer/1000)}s` : "FULL"}</small></div>
      <div className="stat"><span>🧠 Nerve</span><strong>{g.gameState.nerve} / {g.maxNerve}</strong><small>{g.gameState.nerve<g.maxNerve ? `next +1 in ${Math.ceil(nerveTimer/1000)}s` : "FULL"}</small></div>
      <div className="stat"><span>😊 Happiness</span><strong>{Math.floor(g.gameState.happiness)} / {g.propertyMaxHappiness}</strong></div>
    </div></Panel>
    <Panel title="Combat Stats"><div className="stat-grid">{Object.entries(g.gameState.stats).map(([k,v])=><div className="stat" key={k}><span>{k}</span><strong>{(v as number).toFixed(2)}</strong></div>)}</div></Panel>
    <Panel title="Progress"><div className="rows"><p><span>Level</span><b>{g.level}</b></p><p><span>XP</span><b>{info.currentXp} / 100</b></p><p><span>Crime experience</span><b>{g.gameState.crimeExperience}</b></p><p><span>Gym experience</span><b>{g.gameState.gymExperience}</b></p><p><span>Points</span><b>{g.gameState.points}</b></p><p><span>Merits</span><b>{g.gameState.merits}</b></p><p><span>Net worth</span><b>{money(netWorth)}</b></p><p><span>Peak net worth</span><b>{money(g.gameState.netWorthPeak)}</b></p></div></Panel>
    <Panel title="Career & Streak"><div className="rows"><p><span>Job</span><b>{g.job?.title || "Unemployed"}</b></p><p><span>Daily streak</span><b>{g.gameState.dailyStreak}</b></p></div><Button onClick={g.claimDaily} disabled={!dailyReady}>{dailyReady ? "Claim Daily Reward" : "Daily Reward Claimed"}</Button><Button onClick={g.rest}>Rest & Recover</Button></Panel>
    <Panel title="Banking"><div className="rows"><p><span>Cash</span><b>{money(g.gameState.cash)}</b></p><p><span>Bank</span><b>{money(g.gameState.bank)}</b></p><p><span>Interest</span><b>0.5% / 24h</b></p><p><span>Lifetime interest</span><b>{money(g.gameState.bankInterestEarned)}</b></p></div><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="numeric" /><Button onClick={()=>g.bankDeposit(n)} disabled={n<=0}>Deposit</Button><Button onClick={()=>g.bankWithdraw(n)} disabled={n<=0}>Withdraw</Button></Panel>
  </div>;
}

function City({g}: {g: ReturnType<typeof useRiftCity>}) { return <><div className="grid four">{LOCATIONS.map(([id,name,desc]) => <div className="card" key={id}><span className="eyebrow">LOCATION</span><h3>{name}</h3><p>{desc}</p><Button onClick={() => g.travel(id)}>{g.gameState.currentLocation === id ? "Current Location" : "Travel"}</Button></div>)}</div><Panel title="City Interactions"><div className="grid three"><Button onClick={g.randomEncounter}>🎲 Explore</Button><Button onClick={() => g.setCurrentScreen("crimes")}>🕵️ Find Work</Button><Button onClick={() => g.setCurrentScreen("combat")}>⚔️ Find a Fight</Button></div></Panel></> }
function Crimes({g}: {g: ReturnType<typeof useRiftCity>}) { return <div className="grid two">{CRIMES.map(c => { const chance = crimeSuccessChance(c, g.gameState.crimeExperience, 1, getCrimeStatBonus(g.gameState.stats)); const unlocked = crimeUnlocked(c, g.level); return <div className={`card ${unlocked ? "" : "locked"}`} key={c.id}><div className="card-top"><span className="tag">NERVE {c.nerve}</span><span className="chance">{unlocked ? `${chance.toFixed(0)}%` : `LV ${c.levelRequired}`}</span></div><h3>{c.name}</h3><p>{c.description}</p><div className="meter"><i style={{width: `${unlocked ? chance : 0}%`}}/></div><small>Success chance · risk {c.risk}%</small><Button disabled={!unlocked || g.gameState.nerve < c.nerve} onClick={() => g.commitCrime(c)}>Commit Crime</Button></div>})}</div> }
function Combat({g}: {g: ReturnType<typeof useRiftCity>}) { return <><div className="grid two">{OPPONENTS.map(o => <div className="card" key={o.id}><div className="card-top"><span className="tag">HP {o.health}</span><span className="chance">{calculateWinChance(g.gameState.stats, o.stats).toFixed(0)}%</span></div><h3>{o.name}</h3><p>{o.description}</p><small>Win chance is an estimate, not a prophecy. Humanity already has enough prophecies.</small><Button onClick={() => g.attack(o)}>Attack · 25 ⚡</Button></div>)}</div>{g.combatOpponent && <Panel title={`Encounter: ${g.combatOpponent.name}`}><div className="combat-box"><p>{g.combatMessage}</p><Button onClick={g.resolveAttack}>Resolve Fight</Button><Button className="ghost" onClick={() => g.setCurrentScreen("combat")}>Keep Browsing</Button></div></Panel>}</> }
function GymView({g}: {g: ReturnType<typeof useRiftCity>}) { return <><div className="gym-switch">{GYMS.filter(x => !x.jailOnly).map(x => <button className={g.gym.id === x.id ? "selected" : ""} key={x.id} disabled={!gymUnlocked(x,g.gameState.gymExperience)} onClick={() => g.buyGym(x.id)}>{x.name}<small>{gymUnlocked(x,g.gameState.gymExperience) ? money(x.membershipCost) : `EXP ${x.gymExpRequired}`}</small></button>)}</div><Panel title={`${g.gym.name} · ${g.gym.energyCost} energy`}><p>{g.gym.description}</p><div className="grid four">{TRAINING_STATS.map(s => <div className="card mini" key={s.id}><span className="icon">{s.icon}</span><h3>{s.name}</h3><p>{s.description}</p><Button disabled={!canTrainStat(g.gym,s.id)} onClick={() => g.train(s.id)}>Train</Button></div>)}</div></Panel></> }
function Jobs({g}: {g: ReturnType<typeof useRiftCity>}) { return <div className="grid two">{JOBS.map(j => <div className={`card ${g.level < j.levelRequired ? "locked" : ""}`} key={j.id}><span className="eyebrow">{j.company}</span><h3>{j.title}</h3><p>{j.description}</p><div className="rows"><p><span>Hourly-ish payout</span><b>{money(j.salary)}</b></p><p><span>Requirement</span><b>Level {j.levelRequired}</b></p></div><Button disabled={g.level < j.levelRequired} onClick={() => g.joinJob(j.id)}>{g.gameState.currentJob === j.id ? "Current Job" : "Join Job"}</Button></div>)}</div> }
function Items({g}: {g: ReturnType<typeof useRiftCity>}) { return <div className="grid three">{ITEMS.map(i => <div className="card" key={i.id}><span className="tag">{i.type}</span><h3>{i.name}</h3><p>{i.description}</p><strong>{money(i.price)}</strong><div className="button-row"><Button onClick={() => g.buyItem(i.id)}>Buy</Button>{(g.gameState.inventory[i.id]||0)>0 && <Button onClick={() => i.type === "weapon" || i.type === "armor" ? g.equip(i.id) : g.useItem(i.id)}>{i.type === "weapon" || i.type === "armor" ? "Equip" : "Use"}</Button>}</div><small>Owned: {g.gameState.inventory[i.id]||0}</small></div>)}</div> }
function Missions({g}: {g: ReturnType<typeof useRiftCity>}) { return <div className="grid two">{MISSIONS.map(m => { const p=g.missionProgress(m); const done=g.gameState.completedMissions.includes(m.id); return <div className="card" key={m.id}><span className="eyebrow">MISSION</span><h3>{m.name}</h3><p>{m.description}</p><div className="meter"><i style={{width:`${Math.min(100,p/m.target*100)}%`}}/></div><p>{Math.min(p,m.target).toLocaleString()} / {m.target.toLocaleString()}</p><Button disabled={done || p<m.target} onClick={() => g.claimMission(m.id)}>{done ? "Claimed" : "Claim Reward"}</Button></div>})}</div> }
function Education({g}: {g: ReturnType<typeof useRiftCity>}) { return <><Panel title="Active Course">{g.education ? <><h3>{g.education.name}</h3><p>Started {new Date(g.gameState.educationStartedAt || Date.now()).toLocaleString()} · {g.education.durationHours}h</p><Button onClick={g.finishEducation}>Check Completion</Button></> : <p>No active course.</p>}</Panel><div className="grid two">{EDUCATION.map(c => <div className="card" key={c.id}><h3>{c.name}</h3><p>{c.description}</p><div className="rows"><p><span>Cost</span><b>{money(c.cost)}</b></p><p><span>Time</span><b>{c.durationHours}h</b></p><p><span>Requirement</span><b>Level {c.levelRequired}</b></p></div><Button disabled={g.level<c.levelRequired || g.gameState.educationCompleted.includes(c.id) || Boolean(g.education)} onClick={() => g.startEducation(c.id)}>{g.gameState.educationCompleted.includes(c.id)?"Completed":"Enroll"}</Button></div>)}</div></> }
function BankView({g}: {g: ReturnType<typeof useRiftCity>}) {
  const [amount,setAmount]=useState("100");
  const n=Math.max(0,Number(amount)||0);
  const next=Math.max(0, BANK_INTEREST_INTERVAL-(Date.now()-g.gameState.bankLastInterest));
  return <div className="grid two"><Panel title="RiftCity Bank"><div className="rows"><p><span>Cash</span><b>{money(g.gameState.cash)}</b></p><p><span>Account balance</span><b>{money(g.gameState.bank)}</b></p><p><span>Interest rate</span><b>0.5% every 24h</b></p><p><span>Lifetime interest</span><b>{money(g.gameState.bankInterestEarned)}</b></p><p><span>Next interest cycle</span><b>{formatTime(next)}</b></p></div><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="numeric"/><Button onClick={()=>g.bankDeposit(n)} disabled={n<=0}>Deposit</Button><Button onClick={()=>g.bankWithdraw(n)} disabled={n<=0}>Withdraw</Button></Panel><Panel title="Financial Record"><p>Banking is persistent and continues while you are offline. Interest is calculated from elapsed 24-hour cycles.</p><p>Your net worth is tracked automatically.</p></Panel></div>;
}

function MarketView({g}: {g: ReturnType<typeof useRiftCity>}) {
  return <><Panel title="City Market"><p>Buy useful equipment and resell owned items at the standard 60% vendor value.</p></Panel><div className="grid two">{ITEMS.map(i=><div className="card" key={i.id}><span className="eyebrow">{i.type.toUpperCase()}</span><h3>{i.name}</h3><p>{i.description}</p><div className="rows"><p><span>Buy</span><b>{money(i.price)}</b></p><p><span>Sell</span><b>{money(i.price*0.6)}</b></p><p><span>Owned</span><b>{g.gameState.inventory[i.id]||0}</b></p></div><Button onClick={()=>g.buyItem(i.id)} disabled={g.gameState.cash<i.price}>Buy</Button><Button onClick={()=>g.sellItem(i.id)} disabled={(g.gameState.inventory[i.id]||0)<=0}>Sell</Button></div>)}</div></>;
}

function PropertyView({g}: {g: ReturnType<typeof useRiftCity>}) { const current=getProperty(g.gameState.ownedProperty)?.price||0; return <div className="grid two">{PROPERTIES.map(p=><div className={`card ${p.price<current?"locked":""}`} key={p.id}><span className="eyebrow">PROPERTY</span><h3>{p.name}</h3><p>{p.description}</p><div className="rows"><p><span>Price</span><b>{money(p.price)}</b></p><p><span>Health bonus</span><b>+{p.maxHealthBonus}</b></p><p><span>Nerve bonus</span><b>+{p.nerveBonus}</b></p></div><Button disabled={p.price<current || g.gameState.cash<p.price} onClick={()=>g.buyProperty(p.id)}>{g.gameState.ownedProperty===p.id?"Current Home":"Move In"}</Button></div>)}</div> }

export default App;
