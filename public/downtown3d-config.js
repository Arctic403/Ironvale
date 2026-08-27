import { RIFT_WORLD_SCALE as SCALE } from './rift-world-scale.js';

export const DOWNTOWN3D_FOUNDATION = Object.freeze({
  version: 3,
  id: 'downtown-commerce-avenue-foundation-01',
  label: 'Downtown Street Foundation',
  units: SCALE.units,
  metersPerWorldUnit: SCALE.metersPerWorldUnit,

  world: Object.freeze({
    width: 260,
    depth: 260,
    groundHeight: 0.08
  }),

  street: Object.freeze({
    length: 120,
    roadWidth: 14,
    sidewalkWidth: 4,
    buildableDepth: 12,
    curbWidth: 0.28,
    curbHeight: SCALE.reference.curbHeight,
    sidewalkHeight: 0.16,
    centerDashLength: 3.2,
    centerDashGap: 4.8,
    worldMargin: 5
  }),

  player: Object.freeze({
    height: SCALE.reference.humanHeight,
    radius: 0.34,
    walkSpeed: 4.2,
    runSpeed: 6.6,
    spawn: Object.freeze({ x: 9.1, z: 42 })
  }),

  camera: Object.freeze({
    alpha: Math.PI / 2,
    beta: 1.02,
    radius: 12.5,
    minRadius: 7,
    maxRadius: 19,
    followHeight: 1.35,
    followSharpness: 10,
    minBeta: 0.62,
    maxBeta: 1.28,
    fov: Math.PI / 3.25,
    near: 0.08,
    far: 360
  }),

  render: Object.freeze({
    fogStart: 105,
    fogEnd: 285,
    mobileTargetPixelRatio: 1.45,
    desktopTargetPixelRatio: 1.8
  })
});
