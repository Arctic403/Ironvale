import { ENCOUNTERS, getAvailableEncounter } from "../constants/encounters";
import { LOCATIONS } from "../constants/locations";
import { GAME_CONFIG, SAVE_KEY, DEFAULT_MARKET_PRICES } from "../constants/gameConfig";
import type { SaveData } from "../types/riftCity";

export const {
  ENERGY_REGEN_INTERVAL, MAX_ENERGY, NERVE_REGEN_INTERVAL, HAPPINESS_TICK,
  HEALTH_REGEN_INTERVAL, JAIL_MINUTES, HOSPITAL_MINUTES, BASE_HAPPINESS,
  BANK_INTEREST_INTERVAL, DAILY_INTERVAL, TRAVEL_COOLDOWN, TRAVEL_COST,
  MARKET_UPDATE_INTERVAL, JOB_PAY_INTERVAL,
} = GAME_CONFIG;

export { SAVE_KEY, DEFAULT_MARKET_PRICES, ENCOUNTERS, LOCATIONS, getAvailableEncounter };

export function freshSave(): SaveData {
  const now = Date.now();
  return {
    cash:1000, bank:0, xp:0, bankInterest:0, lastBankInterest:now, merits:0, points:0,
    energy:100, lastEnergyUpdate:now, nerve:10, lastNerveUpdate:now, health:100,
    crimeExperience:0, stats:{strength:5, defense:5, speed:5, dexterity:5},
    gymExperience:0, gymMemberships:["premier-fitness"], activeGym:"premier-fitness",
    happiness:BASE_HAPPINESS, lastHappinessUpdate:now, currentJob:null, jobStartedAt:now,
    lastJobPayment:now, jailUntil:null, hospitalUntil:null, inventory:{},
    equippedWeapon:null, equippedArmor:null, ownedProperty:"shack", educationCompleted:[],
    educationActive:null, educationStartedAt:null, completedMissions:[], crimesCompleted:0,
    crimesFailed:0, crimesSpooked:0, crimesCritical:0, timesJailed:0, fightsWon:0,
    fightsLost:0, gymSessions:0, attacks:0, locationsVisited:["city-center"],
    currentLocation:"city-center", travelCooldownUntil:null, faction:null,
    factionReputation:0, company:null, companyReputation:0, market:{...DEFAULT_MARKET_PRICES},
    lastDailyClaim:null, dailyStreak:0, achievements:[],
    activities:[{id:now,text:"Welcome to RiftCity.",type:"system",time:now}],
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const base = freshSave(), parsed = JSON.parse(raw);
    return {
      ...base, ...parsed,
      stats:{...base.stats,...(parsed.stats||{})},
      inventory:{...(parsed.inventory||{})},
      activities:Array.isArray(parsed.activities)&&parsed.activities.length?parsed.activities:base.activities,
      gymMemberships:Array.isArray(parsed.gymMemberships)?parsed.gymMemberships:base.gymMemberships,
      educationCompleted:Array.isArray(parsed.educationCompleted)?parsed.educationCompleted:[],
      completedMissions:Array.isArray(parsed.completedMissions)?parsed.completedMissions:[],
      locationsVisited:Array.isArray(parsed.locationsVisited)?parsed.locationsVisited:["city-center"],
      achievements:Array.isArray(parsed.achievements)?parsed.achievements:[],
      market:{...DEFAULT_MARKET_PRICES,...(parsed.market||{})},
      lastBankInterest:typeof parsed.lastBankInterest==="number"?parsed.lastBankInterest:base.lastBankInterest,
      lastEnergyUpdate:typeof parsed.lastEnergyUpdate==="number"?parsed.lastEnergyUpdate:base.lastEnergyUpdate,
      lastNerveUpdate:typeof parsed.lastNerveUpdate==="number"?parsed.lastNerveUpdate:base.lastNerveUpdate,
      lastHappinessUpdate:typeof parsed.lastHappinessUpdate==="number"?parsed.lastHappinessUpdate:base.lastHappinessUpdate,
      lastJobPayment:typeof parsed.lastJobPayment==="number"?parsed.lastJobPayment:base.lastJobPayment,
    };
  } catch { return freshSave(); }
}
export function money(n:number){return `$${Math.max(0,Math.floor(n)).toLocaleString()}`;}
export function formatTime(ms:number){const s=Math.ceil(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;}
export function timeLeft(until:number|null){return until?Math.max(0,until-Date.now()):0;}
export function getLocationName(id:string){return LOCATIONS.find(l=>l[0]===id)?.[1]||id;}
export function randomMarketPrice(current:number){return Math.max(1,Math.floor(current*(0.92+Math.random()*0.16)));}
