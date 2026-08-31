import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RIFT_BUILDING_PIPELINE_VERSION,
  compileRiftBuildingProgram,
  planRiftBuildingProgram,
  getRiftBuildingAffectedStages,
  diffRiftBuildingPlans
} from '../public/rift-building-program.js';
import { RIFT_INTERIOR_ARCHITECTURE_VERSION } from '../public/rift-interior-architecture.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const assert = (value, message) => { if (!value) failures.push(message); };
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const stageIds = pipeline => pipeline.stages.map(stage => stage.id);
const expectedStages = [
  'design-contract',
  'semantic-topology',
  'global-architecture',
  'structure',
  'core-reservation',
  'circulation',
  'interior',
  'envelope',
  'detail-gameplay',
  'game-geometry',
  'visual-inspection'
];

try {
  assert(RIFT_BUILDING_PIPELINE_VERSION === 2, 'Building pipeline version must be H2/v2.');
  assert(RIFT_INTERIOR_ARCHITECTURE_VERSION === 2, 'Interior architecture must route through staged v2.');

  const bank = readJson('public/rift-buildings/legacy-building-fixture-001.json');
  const bankResult = compileRiftBuildingProgram(bank, { strict: true });
  assert(JSON.stringify(stageIds(bankResult.pipeline)) === JSON.stringify(expectedStages), 'Bank pipeline stage order is not authoritative H2 order.');
  assert(bankResult.pipeline.version === 2, 'Bank compile did not record pipeline v2.');
  assert(bankResult.document.metadata?.building_pipeline_version === 2, 'Generated Bank block does not advertise building pipeline v2.');
  assert(bankResult.document.metadata?.building_plan_fingerprint === bankResult.plan.fingerprint, 'Generated Bank block lost its BuildingPlan fingerprint.');
  assert(bankResult.pipeline.stages.at(-1)?.status === 'deferred', 'Visual inspection must remain a post-compile review stage.');
  for (const stage of bankResult.pipeline.stages.slice(0, -1)) {
    assert(['pass', 'soft-pass'].includes(stage.status), `Bank stage ${stage.id} did not pass.`);
  }
  const index = id => expectedStages.indexOf(id);
  assert(index('structure') < index('core-reservation'), 'Physical core reservation must occur after structural plates exist.');
  assert(index('core-reservation') < index('circulation'), 'Core openings must be reserved before stairs/circulation are realized.');
  assert(index('circulation') < index('interior'), 'Circulation must be protected before interior partitions are realized.');
  assert(index('interior') < index('envelope'), 'Interior realization must precede facade/roof realization.');

  const massDirty = getRiftBuildingAffectedStages(['building.masses[0].size']);
  assert(massDirty[0] === 'global-architecture' && massDirty.includes('structure') && massDirty.includes('envelope'), 'Massing edits must invalidate architecture and all dependent geometry.');
  const coreDirty = getRiftBuildingAffectedStages(['building.interior.vertical_cores[0].at']);
  assert(coreDirty[0] === 'global-architecture' && coreDirty.includes('structure') && coreDirty.includes('circulation'), 'Core edits must invalidate global architecture, slabs, and circulation.');
  const wallDirty = getRiftBuildingAffectedStages(['building.interior.walls[0].min']);
  assert(wallDirty[0] === 'interior' && !wallDirty.includes('structure') && wallDirty.includes('envelope'), 'Partition edits should selectively rebuild interior and downstream stages only.');
  const facadeDirty = getRiftBuildingAffectedStages(['building.window_runs[0].spacing']);
  assert(facadeDirty[0] === 'envelope' && !facadeDirty.includes('interior') && facadeDirty.includes('game-geometry'), 'Facade edits should not invalidate completed interior geometry.');
  const propDirty = getRiftBuildingAffectedStages(['building.anchors[0].at']);
  assert(propDirty[0] === 'detail-gameplay' && !propDirty.includes('envelope'), 'Gameplay/detail edits should not rebuild the envelope.');

  const before = planRiftBuildingProgram(bank);
  const wallEdit = structuredClone(bank);
  if (wallEdit.building?.interior?.walls?.[0]?.min) wallEdit.building.interior.walls[0].min[0] += 1;
  const after = planRiftBuildingProgram(wallEdit);
  const diff = diffRiftBuildingPlans(before, after);
  assert(diff.dirtyStages.includes('interior') && diff.dirtyStages.includes('game-geometry'), 'Plan fingerprints did not propagate an interior edit downstream.');
  assert(!diff.dirtyStages.includes('structure'), 'Interior-only edit unnecessarily invalidated structure.');

  const disconnected = {
    format: 'riftcity-building-program', version: 1, id: 'h2-disconnected-topology', world_origin: [0,0,0],
    lot: { id: 'lot', bounds: { min: [0,0,0], max: [15,12,15] } },
    palette: {
      wall: { material_id: 1, shape: 'full', color: [.6,.6,.6] },
      floor: { material_id: 2, shape: 'full', color: [.4,.4,.4] },
      roof: { material_id: 3, shape: 'full', color: [.2,.2,.2] }
    },
    building: {
      origin: [1,0,1], rotation: 'north', floors: 1, floor_height: 6,
      wall_state: 'wall', floor_state: 'floor', roof_state: 'roof',
      masses: [{ id: 'shell', origin: [0,0,0], size: [14,14], floors: 1 }],
      entrances: [{ id: 'entry', mass: 'shell', side: 'south', offset: 6, width: 2, height: 4, floor: 1 }],
      interior: {
        version: 1, minimum_clear_height: 4, entry_space: 'a', require_all_spaces_reachable: true,
        spaces: [
          { id: 'a', floor: 1, min: [1,1], max: [5,12], clear_height: 4 },
          { id: 'b', floor: 1, min: [8,1], max: [12,12], clear_height: 4 }
        ],
        walls: [], portals: [], vertical_cores: []
      }
    }
  };
  let topologyStopped = false;
  try { compileRiftBuildingProgram(disconnected, { strict: true }); }
  catch (error) {
    topologyStopped = error?.stage === 'semantic-topology' && /unreachable/.test(String(error?.message || ''));
  }
  assert(topologyStopped, 'Disconnected space graph was not stopped at semantic-topology before geometry generation.');

  const compilerShim = fs.readFileSync(path.join(root, 'public/rift-building-program.js'), 'utf8');
  const interiorShim = fs.readFileSync(path.join(root, 'public/rift-interior-architecture.js'), 'utf8');
  assert(compilerShim.includes("from './rift-building-compiler.js'"), 'Legacy BuildingProgram path is not routed to authoritative staged compiler.');
  assert(!compilerShim.includes('function shell('), 'Old monolithic BuildingProgram implementation is still active.');
  assert(interiorShim.includes("from './rift-interior-pipeline.js'"), 'Legacy interior path is not routed to authoritative staged interior pipeline.');

  if (!failures.length) {
    console.log(`[building-stage-pipeline] PASS · H2.${RIFT_BUILDING_PIPELINE_VERSION} · ${expectedStages.length} dependency stages · Bank ${bankResult.report.stats.structuralCells.toLocaleString()} cells/${bankResult.report.stats.operations} ops · selective invalidation + topology hard-gate verified.`);
  }
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[building-stage-pipeline] FAIL');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
