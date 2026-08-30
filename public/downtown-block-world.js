import { RIFT_WORLD_SCALE as SCALE } from './rift-world-scale.js';

// Legacy RiftBlockWorld fallback. The authored Commerce map was intentionally
// removed during the base-world reset. This source now contains only a flat,
// buildable starter surface so older entry points cannot resurrect the city.
const MATERIALS = Object.freeze({
  ground: Object.freeze({ label: 'Grass', color: '#496447', noise: 0.03 }),
  grass: Object.freeze({ label: 'Grass', color: '#496447', noise: 0.03 }),
  dirt: Object.freeze({ label: 'Dirt', color: '#795432', noise: 0.035 }),
  stone: Object.freeze({ label: 'Stone', color: '#707474', noise: 0.018 }),
  wood: Object.freeze({ label: 'Wood', color: '#895b30', noise: 0.022 })
});

export function createDowntownBlockWorldSource() {
  const half = 48;
  return {
    format: 'riftcity-block-world',
    version: 1,
    id: 'riftcity-base-world-legacy',
    district: 'base-world',
    units: SCALE.units,
    blockSize: 1,
    chunkSize: SCALE.block.chunkSize,
    bounds: { minX: -half, maxX: half - 1, minY: -1, maxY: 47, minZ: -half, maxZ: half - 1 },
    base: { y: -1, material: 'ground' },
    materials: MATERIALS,
    blocks: []
  };
}
