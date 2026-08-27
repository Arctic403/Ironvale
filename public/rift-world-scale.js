export const RIFT_WORLD_SCALE = Object.freeze({
  format: 'riftcity-world-scale',
  version: 1,
  units: 'meters',
  metersPerWorldUnit: 1,

  block: Object.freeze({
    size: 1,
    chunkSize: 32,
    visibleRadiusChunks: 2
  }),

  reference: Object.freeze({
    calibrationCube: 1,
    humanHeight: 1.75,
    doorWidth: 0.9,
    doorHeight: 2.05,
    carLength: 4.5,
    carWidth: 1.82,
    carHeight: 1.48,
    parkingWidth: 2.5,
    parkingLength: 5.5,
    trafficLaneWidth: 3.25,
    curbHeight: 0.15,
    sidewalkWidth: 2.5,
    buildingFloorHeight: 3.4
  })
});

export function metersToWorld(meters) {
  return Number(meters) / RIFT_WORLD_SCALE.metersPerWorldUnit;
}

export function worldToMeters(units) {
  return Number(units) * RIFT_WORLD_SCALE.metersPerWorldUnit;
}

export function assertMeterScale() {
  if (RIFT_WORLD_SCALE.metersPerWorldUnit !== 1) {
    throw new Error('RiftCity world-scale invariant failed: 1 world unit must equal 1 meter.');
  }
  return true;
}
