/**
 * Game Configuration Constants
 */

// Timers (in milliseconds)
export const GAME_CONFIG = {
  ENERGY_REGEN_INTERVAL: 30 * 1000,
  MAX_ENERGY: 100,
  NERVE_REGEN_INTERVAL: 45 * 1000,
  HAPPINESS_TICK: 15 * 60 * 1000,
  HEALTH_REGEN_INTERVAL: 60 * 1000,
  JAIL_MINUTES: 2,
  HOSPITAL_MINUTES: 2,
  BASE_HAPPINESS: 100,
  BANK_INTEREST_INTERVAL: 24 * 60 * 60 * 1000,
  DAILY_INTERVAL: 24 * 60 * 60 * 1000,
  TRAVEL_COOLDOWN: 30 * 1000,
  TRAVEL_COST: 25,
  MARKET_UPDATE_INTERVAL: 5 * 60 * 1000,
  JOB_PAY_INTERVAL: 60 * 60 * 1000,
} as const;

export const SAVE_KEY = "riftcity-core-v6";

export const DEFAULT_MARKET_PRICES: Record<string, number> = {
  food: 100,
  electronics: 250,
  scrap: 60,
  medical: 180,
};
