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
