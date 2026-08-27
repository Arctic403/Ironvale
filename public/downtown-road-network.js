import { DOWNTOWN3D_FOUNDATION as CONFIG } from './downtown3d-config.js';

const street = CONFIG.street;

export const DOWNTOWN_ROAD_NETWORK = Object.freeze({
  format: 'riftcity-road-network',
  version: 1,
  id: 'downtown-road-network-01',
  district: 'downtown',
  units: 'meters',
  defaultProfile: 'downtown-avenue',
  profiles: Object.freeze({
    'downtown-avenue': Object.freeze({
      id: 'downtown-avenue',
      label: 'Downtown Avenue',
      roadWidth: street.roadWidth,
      sidewalkWidth: street.sidewalkWidth,
      curbWidth: street.curbWidth,
      curbHeight: street.curbHeight,
      sidewalkHeight: street.sidewalkHeight,
      centerDashLength: street.centerDashLength,
      centerDashGap: street.centerDashGap,
      roadColor: '#252a2e',
      sidewalkColor: '#777a77',
      curbColor: '#9a9a94',
      centerLineColor: '#d5a83c',
      edgeLineColor: '#d7d9d7'
    })
  }),
  nodes: Object.freeze([
    Object.freeze({ id: 'n1', x: 0, z: -street.length / 2 }),
    Object.freeze({ id: 'n2', x: 0, z: street.length / 2 })
  ]),
  segments: Object.freeze([
    Object.freeze({ id: 'r1', a: 'n1', b: 'n2', profile: 'downtown-avenue' })
  ])
});
