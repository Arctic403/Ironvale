import {
  RiftBlockSection,
  RiftSectionStreamWindow,
  RiftSectionWorldSource,
  RIFT_SECTION_AIR,
  RIFT_SECTION_SOLID,
  RIFT_SECTION_SIZE,
  RIFT_SECTION_VOLUME,
  countRiftGridSharedFacePairs,
  riftSectionIndex
} from './rift-block-section.js';

export const RIFT_CITY_BLOCK_STATES = Object.freeze({
  AIR: RIFT_SECTION_AIR,
  LEGACY_SOLID: RIFT_SECTION_SOLID,
  ROAD: 2,
  SIDEWALK: 3,
  CURB: 4,
  LOT: 5,
  ALLEY: 6
});

export const RIFT_CITY_STREET_SLICE = Object.freeze({
  name: 'Commerce Avenue',
  roadWidth: 14,
  roadMin: 1,
  roadMax: 14,
  sidewalkWidth: 4,
  curbBandWidth: 1,
  northSidewalkMin: -3,
  northSidewalkMax: 0,
  southSidewalkMin: 15,
  southSidewalkMax: 18,
  westSidewalkMin: -3,
  westSidewalkMax: 0,
  eastSidewalkMin: 15,
  eastSidewalkMax: 18,
  intersectionSize: 14,
  alleyWidth: 4,
  alleyMinX: 22,
  alleyMaxX: 25,
  alleyMinZ: -16,
  alleyMaxZ: 0,
  sectionRadius: 1,
  loadedSections: 9,
  loadedCells: 9 * RIFT_SECTION_VOLUME,
  residentStateBytes: 9 * RIFT_SECTION_VOLUME * Uint16Array.BYTES_PER_ELEMENT
});

const MATERIAL_COLORS = Object.freeze({
  [RIFT_CITY_BLOCK_STATES.LEGACY_SOLID]: Object.freeze([0.56, 0.44, 0.33]),
  [RIFT_CITY_BLOCK_STATES.ROAD]: Object.freeze([0.20, 0.23, 0.25]),
  [RIFT_CITY_BLOCK_STATES.SIDEWALK]: Object.freeze([0.61, 0.60, 0.56]),
  [RIFT_CITY_BLOCK_STATES.CURB]: Object.freeze([0.76, 0.73, 0.65]),
  [RIFT_CITY_BLOCK_STATES.LOT]: Object.freeze([0.38, 0.34, 0.27]),
  [RIFT_CITY_BLOCK_STATES.ALLEY]: Object.freeze([0.27, 0.29, 0.30])
});

export const RIFT_CITY_MATERIAL_LABELS = Object.freeze({
  [RIFT_CITY_BLOCK_STATES.ROAD]: 'ROAD',
  [RIFT_CITY_BLOCK_STATES.SIDEWALK]: 'SIDEWALK',
  [RIFT_CITY_BLOCK_STATES.CURB]: 'CURB',
  [RIFT_CITY_BLOCK_STATES.LOT]: 'LOT',
  [RIFT_CITY_BLOCK_STATES.ALLEY]: 'ALLEY'
});

function isBetween(value, min, max) {
  return value >= min && value <= max;
}

export function resolveRiftCityStreetBlock({ worldX = 0, worldY = 0, worldZ = 0 } = {}) {
  worldX = Math.trunc(Number(worldX) || 0);
  worldY = Math.trunc(Number(worldY) || 0);
  worldZ = Math.trunc(Number(worldZ) || 0);

  if (worldY !== 0) return RIFT_CITY_BLOCK_STATES.AIR;

  const road = RIFT_CITY_STREET_SLICE;
  const inEastWestRoad = isBetween(worldZ, road.roadMin, road.roadMax);
  const inNorthSouthRoad = isBetween(worldX, road.roadMin, road.roadMax);
  if (inEastWestRoad || inNorthSouthRoad) return RIFT_CITY_BLOCK_STATES.ROAD;

  // One 4 m service alley cuts through the north sidewalk/curb and into the
  // buildable lot. It is deliberately finite in this first authored slice.
  if (
    isBetween(worldX, road.alleyMinX, road.alleyMaxX) &&
    isBetween(worldZ, road.alleyMinZ, road.alleyMaxZ)
  ) {
    return RIFT_CITY_BLOCK_STATES.ALLEY;
  }

  const inEastWestSidewalk =
    isBetween(worldZ, road.northSidewalkMin, road.northSidewalkMax) ||
    isBetween(worldZ, road.southSidewalkMin, road.southSidewalkMax);
  const inNorthSouthSidewalk =
    isBetween(worldX, road.westSidewalkMin, road.westSidewalkMax) ||
    isBetween(worldX, road.eastSidewalkMin, road.eastSidewalkMax);

  if (inEastWestSidewalk || inNorthSouthSidewalk) {
    // With exact 1 m RiftBlocks a physically raised curb would be a full meter
    // tall, so H1.55 keeps the curb as a one-cell material band at road height.
    // Fractional curb/slab geometry can be introduced later without changing
    // the logical road/sidewalk measurements.
    const isCurbBand =
      worldZ === road.northSidewalkMax ||
      worldZ === road.southSidewalkMin ||
      worldX === road.westSidewalkMax ||
      worldX === road.eastSidewalkMin;
    return isCurbBand ? RIFT_CITY_BLOCK_STATES.CURB : RIFT_CITY_BLOCK_STATES.SIDEWALK;
  }

  return RIFT_CITY_BLOCK_STATES.LOT;
}

export function createRiftCityStreetSection({ sx = 0, sy = 0, sz = 0 } = {}) {
  sx = Math.trunc(sx); sy = Math.trunc(sy); sz = Math.trunc(sz);
  const states = new Uint16Array(RIFT_SECTION_VOLUME);
  if (sy !== 0) return new RiftBlockSection({ sx, sy, sz, states });

  const originX = sx * RIFT_SECTION_SIZE;
  const originZ = sz * RIFT_SECTION_SIZE;
  for (let z = 0; z < RIFT_SECTION_SIZE; z += 1) {
    for (let x = 0; x < RIFT_SECTION_SIZE; x += 1) {
      states[riftSectionIndex(x, 0, z)] = resolveRiftCityStreetBlock({
        worldX: originX + x,
        worldY: 0,
        worldZ: originZ + z
      });
    }
  }
  return new RiftBlockSection({ sx, sy, sz, states });
}

export function resolveRiftCityStreetBaseBlock(context = {}) {
  return resolveRiftCityStreetBlock(context);
}

export function resolveRiftCityBlockColor({ state = RIFT_CITY_BLOCK_STATES.AIR } = {}) {
  return MATERIAL_COLORS[state] || [1, 1, 1];
}

export function countRiftCityStreetMaterials(grid) {
  const counts = {
    road: 0,
    sidewalk: 0,
    curb: 0,
    lot: 0,
    alley: 0,
    otherSolid: 0
  };
  for (const section of grid.sections.values()) {
    for (const state of section.states) {
      if (state === RIFT_CITY_BLOCK_STATES.ROAD) counts.road += 1;
      else if (state === RIFT_CITY_BLOCK_STATES.SIDEWALK) counts.sidewalk += 1;
      else if (state === RIFT_CITY_BLOCK_STATES.CURB) counts.curb += 1;
      else if (state === RIFT_CITY_BLOCK_STATES.LOT) counts.lot += 1;
      else if (state === RIFT_CITY_BLOCK_STATES.ALLEY) counts.alley += 1;
      else if (state !== RIFT_CITY_BLOCK_STATES.AIR) counts.otherSolid += 1;
    }
  }
  return counts;
}

function summarizeCityGeometry(grid) {
  const totals = {
    blocks: 0,
    visibleFaces: 0,
    culledFaces: 0,
    vertexCount: 0,
    triangles: 0
  };
  for (const section of grid.sections.values()) {
    const geometry = grid.buildGeometryForSection(section, { getBlockColor: resolveRiftCityBlockColor });
    totals.blocks += geometry.blocks;
    totals.visibleFaces += geometry.visibleFaces;
    totals.culledFaces += geometry.culledFaces;
    totals.vertexCount += geometry.vertexCount;
    totals.triangles += geometry.triangles;
    if (geometry.vertexStride !== 9 || geometry.vertices.length !== geometry.vertexCount * 9) {
      throw new Error(`RiftCity material geometry stride failed for section ${section.sx},${section.sz}.`);
    }
  }
  return totals;
}

export function validateRiftCityStreetSlice() {
  const failures = [];
  const worldSource = new RiftSectionWorldSource({
    generator: createRiftCityStreetSection,
    baseBlockResolver: resolveRiftCityStreetBaseBlock
  });
  const stream = new RiftSectionStreamWindow({
    radius: RIFT_CITY_STREET_SLICE.sectionRadius,
    worldSource
  });
  const initial = stream.sync(0, 0);

  if (stream.grid.size !== 9) failures.push(`initial sections ${stream.grid.size} != 9`);
  if (stream.loadedStateBytes() !== 73728) failures.push(`resident bytes ${stream.loadedStateBytes()} != 73728`);

  const samples = [
    [8, 0, 8, RIFT_CITY_BLOCK_STATES.ROAD, 'intersection'],
    [20, 0, 8, RIFT_CITY_BLOCK_STATES.ROAD, 'east-west road'],
    [20, 0, 0, RIFT_CITY_BLOCK_STATES.CURB, 'north curb band'],
    [20, 0, -2, RIFT_CITY_BLOCK_STATES.SIDEWALK, 'north sidewalk'],
    [23, 0, -8, RIFT_CITY_BLOCK_STATES.ALLEY, 'service alley'],
    [28, 0, -8, RIFT_CITY_BLOCK_STATES.LOT, 'buildable lot'],
    [8, 0, 20, RIFT_CITY_BLOCK_STATES.ROAD, 'north-south road']
  ];
  for (const [worldX, worldY, worldZ, expected, label] of samples) {
    const actual = worldSource.getBlockWorld(worldX, worldY, worldZ);
    if (actual !== expected) failures.push(`${label} state ${actual} != ${expected}`);
  }

  const materialCounts = countRiftCityStreetMaterials(stream.grid);
  const expectedMaterials = { road: 1148, sidewalk: 336, curb: 128, lot: 624, alley: 68, otherSolid: 0 };
  for (const [key, expected] of Object.entries(expectedMaterials)) {
    if (materialCounts[key] !== expected) failures.push(`${key} cells ${materialCounts[key]} != ${expected}`);
  }

  let initialGeometry = null;
  try {
    initialGeometry = summarizeCityGeometry(stream.grid);
  } catch (error) {
    failures.push(error.message);
  }
  if (
    initialGeometry &&
    (
      initialGeometry.blocks !== 2304 ||
      initialGeometry.visibleFaces !== 4800 ||
      initialGeometry.culledFaces !== 9024 ||
      initialGeometry.vertexCount !== 19200 ||
      initialGeometry.triangles !== 9600
    )
  ) {
    failures.push(`initial city geometry ${JSON.stringify(initialGeometry)}`);
  }

  const sharedPairs = countRiftGridSharedFacePairs(stream.grid);
  if (sharedPairs !== 192) failures.push(`shared boundary pairs ${sharedPairs} != 192`);

  const east = stream.sync(1, 0);
  if (east.loaded.length !== 3 || east.unloaded.length !== 3 || east.retained.length !== 6) {
    failures.push(`east churn ${east.loaded.length}/${east.unloaded.length}/${east.retained.length} != 3/3/6`);
  }
  let eastGeometry = null;
  try {
    eastGeometry = summarizeCityGeometry(stream.grid);
  } catch (error) {
    failures.push(error.message);
  }
  if (
    eastGeometry &&
    (
      eastGeometry.blocks !== 2304 ||
      eastGeometry.visibleFaces !== 4800 ||
      eastGeometry.culledFaces !== 9024 ||
      eastGeometry.vertexCount !== 19200 ||
      eastGeometry.triangles !== 9600
    )
  ) {
    failures.push(`east city geometry ${JSON.stringify(eastGeometry)}`);
  }

  const back = stream.sync(0, 0);
  if (back.loaded.length !== 3 || back.unloaded.length !== 3 || back.retained.length !== 6) {
    failures.push(`return churn ${back.loaded.length}/${back.unloaded.length}/${back.retained.length} != 3/3/6`);
  }

  // Regression-proof the H1.54 separation using the city generator itself:
  // write one sparse AIR -> SOLID edit above a lot, unload its section, then
  // return and verify a fresh section is hydrated from the logical source.
  const edit = { x: 28, y: 1, z: -8 };
  const targetBefore = stream.grid.getSection(1, 0, -1);
  const write = stream.setBlockWorld(edit.x, edit.y, edit.z, RIFT_SECTION_SOLID);
  if (!write.changed || worldSource.overrideCount !== 1) failures.push('city sparse override write failed');

  stream.sync(-1, 0);
  if (stream.grid.getSection(1, 0, -1)) failures.push('city persistence target did not unload');
  if (worldSource.getBlockWorld(edit.x, edit.y, edit.z) !== RIFT_SECTION_SOLID) {
    failures.push('city logical source lost off-screen edit');
  }

  stream.sync(0, 0);
  const targetAfter = stream.grid.getSection(1, 0, -1);
  if (!targetAfter || targetAfter === targetBefore || targetAfter.getBlock(12, 1, 8) !== RIFT_SECTION_SOLID) {
    failures.push('city fresh-section override hydration failed');
  }

  const clear = stream.resetBlockWorld(edit.x, edit.y, edit.z);
  if (!clear.changed || worldSource.overrideCount !== 0 || worldSource.getBlockWorld(edit.x, edit.y, edit.z) !== RIFT_SECTION_AIR) {
    failures.push('city sparse override clear failed');
  }

  return {
    ok: failures.length === 0,
    failures,
    dimensions: { ...RIFT_CITY_STREET_SLICE },
    initialSections: initial.sections.length,
    loadedCells: stream.grid.size * RIFT_SECTION_VOLUME,
    residentStateBytes: stream.loadedStateBytes(),
    geometry: initialGeometry,
    materialCounts,
    sharedPairs,
    crossFacesSaved: sharedPairs * 2
  };
}
