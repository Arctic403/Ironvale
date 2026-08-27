export const DOWNTOWN3D_FOUNDATION = Object.freeze({
  version: 1,
  id: 'downtown-commerce-avenue-foundation-01',
  label: 'Downtown Street Foundation',
  units: 'meters',

  street: Object.freeze({
    length: 120,
    roadWidth: 14,
    sidewalkWidth: 4,
    buildableDepth: 12,
    curbWidth: 0.28,
    curbHeight: 0.18,
    sidewalkHeight: 0.16,
    centerDashLength: 3.2,
    centerDashGap: 4.8,
    worldMargin: 5
  }),

  player: Object.freeze({
    height: 1.75,
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
    maxBeta: 1.28
  }),

  render: Object.freeze({
    fogStart: 62,
    fogEnd: 150,
    mobileTargetPixelRatio: 1.35,
    desktopTargetPixelRatio: 1.7,
    mobileShadowMapSize: 512,
    desktopShadowMapSize: 1024
  })
});
