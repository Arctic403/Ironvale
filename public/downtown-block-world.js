import { RIFT_WORLD_SCALE as SCALE } from './rift-world-scale.js';

const MATERIALS = Object.freeze({
  ground: Object.freeze({ label: 'Ground', color: '#425044', noise: 0.045 }),
  grass: Object.freeze({ label: 'Grass', color: '#496447', noise: 0.05 }),
  road: Object.freeze({ label: 'Road', color: '#25292d', noise: 0.02 }),
  'road-yellow': Object.freeze({ label: 'Road Yellow', color: '#d6a92f', noise: 0.012 }),
  'road-white': Object.freeze({ label: 'Road White', color: '#d8dbd7', noise: 0.008 }),
  sidewalk: Object.freeze({ label: 'Sidewalk', color: '#777a77', noise: 0.028 }),
  brick: Object.freeze({ label: 'Brick', color: '#74463d', noise: 0.032 }),
  concrete: Object.freeze({ label: 'Concrete', color: '#858984', noise: 0.022 }),
  glass: Object.freeze({ label: 'Glass', color: '#5f8794', noise: 0.018 }),
  darkglass: Object.freeze({ label: 'Dark Glass', color: '#344c57', noise: 0.012 }),
  roof: Object.freeze({ label: 'Roof', color: '#3c4142', noise: 0.025 }),
  trim: Object.freeze({ label: 'Trim', color: '#b5b1a5', noise: 0.01 }),
  asphalt: Object.freeze({ label: 'Parking / Asphalt', color: '#34393c', noise: 0.024 })
});

function key(x, y, z) {
  return `${x}|${y}|${z}`;
}

function makeBuilder() {
  const blocks = new Map();
  const set = (x, y, z, material) => blocks.set(key(x, y, z), [x, y, z, material]);
  const fill = (x0, y0, z0, x1, y1, z1, material) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y, z, material);
      }
    }
  };
  const surface = (x0, z0, x1, z1, material) => fill(x0, -1, z0, x1, -1, z1, material);

  const shell = ({ x0, z0, x1, z1, height, wall = 'brick', window = 'glass', roof = 'roof', storefront = false }) => {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
    for (let y = 0; y < height; y++) {
      const windowBand = y >= 2 && y < height - 1 && y % 3 !== 0;
      for (let x = minX; x <= maxX; x++) {
        let frontMat = wall;
        let backMat = wall;
        if (windowBand && (x - minX) % 3 !== 0) {
          frontMat = window;
          backMat = window;
        }
        set(x, y, minZ, frontMat);
        set(x, y, maxZ, backMat);
      }
      for (let z = minZ + 1; z < maxZ; z++) {
        let sideMat = wall;
        if (windowBand && (z - minZ) % 3 !== 0) sideMat = window;
        set(minX, y, z, sideMat);
        set(maxX, y, z, sideMat);
      }
    }
    if (storefront) {
      for (let x = minX + 2; x <= Math.min(maxX - 2, minX + 9); x++) {
        set(x, 0, minZ, 'darkglass');
        set(x, 1, minZ, 'darkglass');
      }
      const doorX = Math.min(maxX - 2, minX + 5);
      blocks.delete(key(doorX, 0, minZ));
      blocks.delete(key(doorX, 1, minZ));
    }
    fill(minX, height, minZ, maxX, height, maxZ, roof);
    if (height >= 8) {
      fill(minX, 2, minZ, maxX, 2, minZ, 'trim');
      fill(minX, 2, maxZ, maxX, 2, maxZ, 'trim');
    }
  };

  // Block-authored Commerce Avenue: 14 one-meter road cells, 4m sidewalks.
  surface(-11, -96, 10, 95, 'sidewalk');
  surface(-7, -96, 6, 95, 'road');
  // Cross street proves that intersections are just shared cells now.
  surface(-96, -9, 95, 8, 'sidewalk');
  surface(-96, -5, 95, 4, 'road');

  // Road paint is also authored as one-meter cells.
  for (let z = -94; z <= 94; z += 6) set(-1, -1, z, 'road-yellow');
  for (let x = -94; x <= 94; x += 6) set(x, -1, 0, 'road-yellow');
  for (let z = -96; z <= 95; z++) {
    set(-7, -1, z, 'road-white');
    set(6, -1, z, 'road-white');
  }
  for (let x = -96; x <= 95; x++) {
    set(x, -1, -5, 'road-white');
    set(x, -1, 4, 'road-white');
  }
  // Restore intersection asphalt so lane edge stripes do not cut through the crossing.
  surface(-7, -5, 6, 4, 'road');

  // Four authored block buildings around the test intersection.
  shell({ x0: -48, z0: 14, x1: -18, z1: 48, height: 12, wall: 'brick', window: 'glass', storefront: true });
  shell({ x0: 18, z0: 16, x1: 45, z1: 52, height: 9, wall: 'concrete', window: 'darkglass', storefront: true });
  shell({ x0: -44, z0: -48, x1: -17, z1: -15, height: 7, wall: 'concrete', window: 'glass', storefront: true });
  shell({ x0: 18, z0: -50, x1: 52, z1: -16, height: 15, wall: 'brick', window: 'darkglass' });

  // Parking / service yards remain block-authored ground cells too.
  surface(58, -48, 86, -16, 'asphalt');
  surface(-84, 16, -58, 44, 'asphalt');
  for (let z = -45; z <= -19; z += 6) {
    for (let x = 61; x <= 83; x += 3) set(x, -1, z, 'road-white');
  }

  return [...blocks.values()];
}

export function createDowntownBlockWorldSource() {
  const half = 128;
  return {
    format: 'riftcity-block-world',
    version: 1,
    id: 'downtown-block-world-01',
    district: 'downtown',
    units: SCALE.units,
    blockSize: 1,
    chunkSize: SCALE.block.chunkSize,
    bounds: { minX: -half, maxX: half - 1, minY: -1, maxY: 47, minZ: -half, maxZ: half - 1 },
    base: { y: -1, material: 'ground' },
    materials: MATERIALS,
    blocks: makeBuilder()
  };
}
