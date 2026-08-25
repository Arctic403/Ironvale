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


export { JOB_REGISTRY, JOB_SHIFT_EVENTS, getJobDefinition, getJobPosition } from './jobs.js';
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

export { COMBAT_SETTINGS, NPC_OPPONENTS, COMBAT_WEAPONS, WEAPON_SKILL_CLASSES, getNpcOpponent, getCombatWeapon } from './combat.js';
export { TRAVEL_DESTINATIONS, getTravelDestination } from './travel.js';
export { ACHIEVEMENT_REGISTRY, getAchievementDefinition } from './achievements.js';
export { DAILY_CHALLENGE_TEMPLATES, WEEKLY_CHALLENGE_TEMPLATES } from './challenges.js';
export { PRODUCTION_FACILITIES, PRODUCTION_RECIPES, getProductionFacility, getProductionRecipe } from './production.js';

export { RESOURCE_REGEN, getResourceRegen } from './resources.js';
export { HEAT_TIERS, HEAT_DECAY_PER_HOUR, LAY_LOW_ENERGY_COST, LAY_LOW_HEAT_REDUCTION, LAY_LOW_COOLDOWN_MS, getHeatTier } from './law.js';
export { NIGHTCLUB_TIERS, NIGHTCLUB_ACTIVITIES, NIGHTCLUB_EVENTS, getNightclubTier, getNightclubEvent } from './nightclub.js';
export { MERIT_UPGRADES, getMeritUpgrade } from './merits.js';
export { CITY_ACTIVITIES, getCityActivity } from './city-activities.js';
