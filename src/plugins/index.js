// Central plugin registry surface for RiftCity.
// Core engines import from this file; gameplay definitions stay in isolated modules.

export {
  CRIME_REGISTRY,
  getCrimeDefinition
} from './crimes.js';

export {
  WORLD_CATEGORIES,
  WORLD_LOCATIONS,
  getWorldCategory,
  getWorldLocation
} from './world.js';

export {
  ITEM_REGISTRY,
  getItemDefinition,
  toPublicItemDefinition
} from './items.js';


export { JOB_REGISTRY, getJobDefinition, getJobPosition } from './jobs.js';
export { EDUCATION_REGISTRY, getEducationDefinition } from './education.js';
export { GYM_PROGRAMS, TRAINING_STATS, getGymProgram } from './gym.js';
export { BANK_INVESTMENT_TIERS, getBankTier, SAVINGS_WITHDRAWAL_FEE_RATE, SAVINGS_WITHDRAWAL_MIN_FEE } from './banking.js';
export { PROPERTY_REGISTRY, getPropertyDefinition } from './properties.js';
export { FACTION_REGISTRY, getFactionDefinition, getFactionRank } from './factions.js';
export { MISSION_REGISTRY, getMissionDefinition } from './missions.js';
export { MARKET_ASSETS, getMarketAsset, getMarketPrice } from './markets.js';
export { WORLD_EVENT_REGISTRY, getActiveWorldEvent } from './events.js';
export { SHOP_REGISTRY, getShopDefinition } from './shops.js';
export { CASINO_GAMES, DAILY_CHIP_GRANT } from './casino.js';
