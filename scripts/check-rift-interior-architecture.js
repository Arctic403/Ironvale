import { compileRiftBuildingProgram } from '../public/rift-building-program.js';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';
import { decodeRiftBlockState, RIFT_BLOCK_SHAPES } from '../public/rift-block-shapes.js';

const failures = [];

function cleanProgram() {
  return {
    format: 'riftcity-building-program',
    version: 1,
    id: 'interior-architecture-smoke',
    name: 'Interior Architecture Smoke',
    units: 'meters',
    world_origin: [0, 0, 0],
    lot: {
      id: 'interior-smoke-lot',
      bounds: { min: [0, 0, 0], max: [15, 8, 15] }
    },
    palette: {
      wall: { material_id: 1, shape: 'full', color: [0.6, 0.6, 0.6] },
      floor: { material_id: 2, shape: 'full', color: [0.4, 0.4, 0.4] },
      roof: { material_id: 3, shape: 'full', color: [0.2, 0.2, 0.2] },
      glass: { material_id: 4, shape: 'full', color: [0.2, 0.5, 0.7] },
      stair: { material_id: 5, shape: 'stair', rotation: 'north', color: [0.7, 0.65, 0.55] }
    },
    building: {
      origin: [1, 0, 1],
      rotation: 'north',
      floors: 2,
      floor_height: 4,
      wall_state: 'wall',
      floor_state: 'floor',
      roof_state: 'roof',
      masses: [
        { id: 'main', origin: [0, 0, 0], size: [14, 14], floors: 2 }
      ],
      entrances: [
        {
          id: 'front',
          mass: 'main',
          side: 'south',
          offset: 6,
          width: 2,
          height: 3,
          floor: 1,
          tags: ['public', 'entrance']
        }
      ],
      interior: {
        version: 1,
        entry_space: 'south-hall',
        require_all_spaces_reachable: true,
        spaces: [
          { id: 'north-hall', name: 'North Hall', floor: 1, min: [1, 1], max: [12, 5], tags: ['public'] },
          { id: 'south-hall', name: 'South Hall', floor: 1, min: [1, 7], max: [12, 12], tags: ['public'] },
          { id: 'upper-hall', name: 'Upper Hall', floor: 2, min: [1, 1], max: [12, 12], tags: ['public'] }
        ],
        walls: [
          { id: 'hall-divider', floor: 1, min: [1, 6], max: [12, 6], height: 3, state: 'wall' }
        ],
        portals: [
          {
            id: 'hall-door',
            floor: 1,
            between: ['south-hall', 'north-hall'],
            at: [7, 6],
            axis: 'x',
            width: 4,
            height: 3
          }
        ],
        voids: [
          {
            id: 'upper-atrium',
            kind: 'atrium',
            floors: [2],
            min: [9, 8],
            max: [11, 10]
          }
        ],
        vertical_cores: [
          {
            id: 'main-stair',
            kind: 'stair',
            from_floor: 1,
            to_floor: 2,
            from_space: 'north-hall',
            to_space: 'upper-hall',
            at: [3, 2],
            direction: 'east',
            width: 2,
            steps: 4,
            head_clearance: 3,
            state: 'stair'
          }
        ]
      }
    },
    output: {
      id: 'interior-architecture-smoke-generated',
      name: 'Interior Architecture Smoke · Generated'
    }
  };
}

try {
  const source = cleanProgram();
  const result = compileRiftBuildingProgram(source, { strict: true });
  const runtime = compileRiftCityBlock(result.document);
  const interior = result.semantics.interior;

  if (!result.report.ok) failures.push('clean interior program report is not ok');
  if (!interior) failures.push('clean interior program has no interior semantics');
  if (result.report.stats.spaces !== 3) failures.push(`spaces ${result.report.stats.spaces} != 3`);
  if (result.report.stats.portals !== 1) failures.push(`portals ${result.report.stats.portals} != 1`);
  if (result.report.stats.voids !== 1) failures.push(`voids ${result.report.stats.voids} != 1`);
  if (result.report.stats.verticalCores !== 1) failures.push(`vertical cores ${result.report.stats.verticalCores} != 1`);
  if (result.report.stats.unreachableSpaces !== 0) failures.push(`unreachable spaces ${result.report.stats.unreachableSpaces} != 0`);
  if (result.report.stats.blockedPortals !== 0) failures.push(`blocked portals ${result.report.stats.blockedPortals} != 0`);
  if (result.report.stats.invalidVerticalCores !== 0) failures.push(`invalid vertical cores ${result.report.stats.invalidVerticalCores} != 0`);

  const core = interior?.verticalCores?.[0];
  if (!core || core.removedFloorCells < 1) failures.push('main-stair did not reserve a real upper-floor opening');

  const origin = source.building.origin;
  for (const opening of core?.openingCells || []) {
    const world = [origin[0] + opening[0], origin[1] + opening[1], origin[2] + opening[2]];
    const state = runtime.grid.getBlockWorld(...world);
    if (!state) continue;
    const decoded = decodeRiftBlockState(state);
    if (decoded.shape !== RIFT_BLOCK_SHAPES.stair) {
      failures.push(`stair opening ${world.join(',')} was re-capped by a non-stair block`);
      break;
    }
  }

  const portal = interior?.portals?.[0];
  if (!portal || portal.blockedCells !== 0) failures.push('hall-door is not physically open after compilation');

  const atrium = interior?.voids?.[0];
  if (!atrium || atrium.removedCells < 1) failures.push('upper-atrium removed no floor cells');

  const disconnected = cleanProgram();
  disconnected.id = 'interior-disconnected-smoke';
  disconnected.building.interior.portals = [];
  let disconnectedFailed = false;
  try {
    compileRiftBuildingProgram(disconnected, { strict: true });
  } catch (error) {
    disconnectedFailed = !!error?.report?.diagnostics?.some(item => item.code === 'interior_spaces_unreachable');
  }
  if (!disconnectedFailed) failures.push('disconnected spaces were not rejected');

  const badLanding = cleanProgram();
  badLanding.id = 'interior-bad-landing-smoke';
  badLanding.building.interior.vertical_cores[0].at = [9, 2];
  let landingFailed = false;
  try {
    compileRiftBuildingProgram(badLanding, { strict: true });
  } catch (error) {
    landingFailed = !!error?.report?.diagnostics?.some(item =>
      item.code === 'vertical_core_top_landing_missing' || item.code === 'vertical_core_missing_stairs'
    );
  }
  if (!landingFailed) failures.push('invalid stair landing was not rejected');

  if (!failures.length) {
    console.log(
      `[interior-architecture] PASS · ${result.report.stats.spaces} spaces · `
      + `${result.report.stats.portals} portal · ${result.report.stats.verticalCores} stair core · `
      + `${core.removedFloorCells} reserved floor-opening cells · ${runtime.stats.cells.toLocaleString()} runtime cells.`
    );
  }
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[interior-architecture] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
