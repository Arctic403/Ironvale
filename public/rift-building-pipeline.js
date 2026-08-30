export const RIFT_BUILDING_PIPELINE_VERSION = 2;

export const RIFT_BUILDING_PIPELINE_STAGES = Object.freeze([
  { id: 'design-contract', kind: 'plan', dependsOn: [] },
  { id: 'semantic-topology', kind: 'plan', dependsOn: ['design-contract'] },
  { id: 'global-architecture', kind: 'plan', dependsOn: ['semantic-topology'] },
  { id: 'structure', kind: 'geometry', dependsOn: ['global-architecture'] },
  { id: 'core-reservation', kind: 'geometry', dependsOn: ['structure'] },
  { id: 'circulation', kind: 'geometry', dependsOn: ['core-reservation'] },
  { id: 'interior', kind: 'geometry', dependsOn: ['circulation'] },
  { id: 'envelope', kind: 'geometry', dependsOn: ['interior'] },
  { id: 'detail-gameplay', kind: 'geometry', dependsOn: ['envelope'] },
  { id: 'game-geometry', kind: 'compile', dependsOn: ['detail-gameplay'] },
  { id: 'visual-inspection', kind: 'review', dependsOn: ['game-geometry'], external: true }
]);

const STAGE_BY_ID = new Map(RIFT_BUILDING_PIPELINE_STAGES.map(stage => [stage.id, stage]));

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hash(value) {
  const source = JSON.stringify(value);
  let result = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    result ^= source.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return `fnv1a-${(result >>> 0).toString(16).padStart(8, '0')}`;
}

function roofMass(mass) {
  const tags = Array.isArray(mass?.tags) ? mass.tags.map(String) : [];
  return tags.includes('roof') || tags.some(tag => tag.startsWith('roof-'));
}

function normalizeMassForPlan(mass) {
  return {
    id: String(mass?.id || ''),
    origin: clone(mass?.origin || [0, 0, 0]),
    size: clone(mass?.size || [0, 0]),
    floors: Number(mass?.floors || 1),
    floorHeight: Number(mass?.fh ?? mass?.floor_height ?? 0),
    tags: clone(mass?.tags || [])
  };
}

function topologyFromInterior(interior = {}) {
  const spaces = (interior.spaces || []).map(space => ({
    id: String(space.id || ''),
    name: String(space.name || space.id || ''),
    floor: Number(space.floor || 1),
    capacity: space.capacity == null ? null : Number(space.capacity),
    tags: clone(space.tags || [])
  }));
  const edges = [];
  for (const portal of interior.portals || []) {
    const between = Array.isArray(portal.between) ? portal.between.map(String) : [];
    if (between.length === 2) edges.push({ id: String(portal.id || ''), kind: 'portal', from: between[0], to: between[1], floor: Number(portal.floor || 1) });
  }
  for (const core of interior.vertical_cores || []) {
    if (!core.from_space || !core.to_space) continue;
    edges.push({ id: String(core.id || ''), kind: 'vertical-core', from: String(core.from_space), to: String(core.to_space), fromFloor: Number(core.from_floor || 1), toFloor: Number(core.to_floor || 1) });
  }
  return {
    entrySpace: interior.entry_space ? String(interior.entry_space) : null,
    requireAllSpacesReachable: interior.require_all_spaces_reachable !== false,
    spaces,
    edges
  };
}

export function createRiftBuildingPlan(program, { masses = [], floorCount = 1, floorHeight = 4 } = {}) {
  const building = program?.building || {};
  const interior = building.interior || {};
  const designRules = clone(building.design_rules || {});
  const normalizedMasses = masses.map(normalizeMassForPlan);
  const roofMasses = normalizedMasses.filter(roofMass);
  const plan = {
    format: 'riftcity-building-plan',
    version: RIFT_BUILDING_PIPELINE_VERSION,
    buildingId: String(program?.id || ''),
    designContract: {
      name: String(program?.name || program?.id || ''),
      district: String(program?.district || program?.world?.district || ''),
      occupancyTarget: building.occupancy_target == null ? null : Number(building.occupancy_target),
      floors: floorCount,
      floorHeight,
      tags: clone(building.tags || []),
      rules: designRules
    },
    topology: topologyFromInterior(interior),
    architecture: {
      lot: clone(program?.lot || {}),
      origin: clone(building.origin || [0, 0, 0]),
      rotation: String(building.rotation || 'north'),
      floorStack: Array.from({ length: floorCount }, (_, index) => ({ floor: index + 1, baseY: index * floorHeight, height: floorHeight })),
      masses: normalizedMasses,
      coreReservations: clone(interior.vertical_cores || []),
      voidReservations: clone(interior.voids || []),
      facadeIntent: {
        windows: clone(building.window_runs || []),
        entrances: clone(building.entrances || [])
      },
      roofIntent: {
        profile: String(designRules.roof_profile || building.roof_plan?.profile || 'mass-envelope'),
        flatRoofForbidden: designRules.flat_roof_forbidden === true,
        authoredPlan: clone(building.roof_plan || null),
        masses: roofMasses
      }
    },
    details: {
      anchors: clone(building.anchors || []),
      assets: clone(building.asset_instances || []),
      siteOps: clone(program?.site_ops || [])
    }
  };

  const stageInputs = {
    'design-contract': plan.designContract,
    'semantic-topology': plan.topology,
    'global-architecture': {
      lot: plan.architecture.lot,
      origin: plan.architecture.origin,
      rotation: plan.architecture.rotation,
      floorStack: plan.architecture.floorStack,
      masses: plan.architecture.masses,
      cores: plan.architecture.coreReservations,
      voids: plan.architecture.voidReservations,
      roofIntent: plan.architecture.roofIntent,
      facadeIntent: plan.architecture.facadeIntent
    },
    structure: {
      floorStack: plan.architecture.floorStack,
      masses: plan.architecture.masses,
      reservedCores: plan.architecture.coreReservations,
      reservedVoids: plan.architecture.voidReservations
    },
    'core-reservation': {
      cores: plan.architecture.coreReservations,
      voids: plan.architecture.voidReservations
    },
    circulation: {
      cores: plan.architecture.coreReservations,
      legacyStairs: clone(building.stair_runs || [])
    },
    interior: clone(interior),
    envelope: {
      facadeIntent: plan.architecture.facadeIntent,
      roofIntent: plan.architecture.roofIntent
    },
    'detail-gameplay': plan.details,
    'game-geometry': {
      palette: clone(program?.palette || {}),
      chunkSize: Number(program?.chunk_size || 0),
      output: clone(program?.output || {})
    },
    'visual-inspection': {
      buildingId: plan.buildingId,
      roofProfile: plan.architecture.roofIntent.profile
    }
  };

  const fingerprints = {};
  for (const stage of RIFT_BUILDING_PIPELINE_STAGES) {
    const dependencies = Object.fromEntries(stage.dependsOn.map(id => [id, fingerprints[id]]));
    fingerprints[stage.id] = hash({ input: stageInputs[stage.id], dependencies });
  }
  plan.stageFingerprints = fingerprints;
  plan.fingerprint = hash({ buildingId: plan.buildingId, fingerprints });
  return plan;
}

function downstreamClosure(seedIds) {
  const dirty = new Set(seedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const stage of RIFT_BUILDING_PIPELINE_STAGES) {
      if (dirty.has(stage.id)) continue;
      if (stage.dependsOn.some(id => dirty.has(id))) {
        dirty.add(stage.id);
        changed = true;
      }
    }
  }
  return RIFT_BUILDING_PIPELINE_STAGES.map(stage => stage.id).filter(id => dirty.has(id));
}

function rootStageForPath(path) {
  const value = String(path || '');
  if (/^building\.interior\.(spaces|portals|entry_space|require_all_spaces_reachable)/.test(value)) return 'semantic-topology';
  if (/^building\.interior\.(vertical_cores|voids)/.test(value)) return 'global-architecture';
  if (/^building\.(masses|floors|floor_height|origin|rotation|design_rules|roof_plan)/.test(value) || /^lot\./.test(value)) return 'global-architecture';
  if (/^building\.stair_runs/.test(value)) return 'circulation';
  if (/^building\.interior\.walls/.test(value)) return 'interior';
  if (/^building\.(window_runs|entrances)/.test(value)) return 'envelope';
  if (/^building\.(anchors|asset_instances)/.test(value) || /^site_ops/.test(value)) return 'detail-gameplay';
  if (/^(palette|chunk_size|output)/.test(value)) return 'game-geometry';
  return 'design-contract';
}

export function getRiftBuildingAffectedStages(changedPaths = []) {
  const roots = [...new Set((changedPaths || []).map(rootStageForPath))];
  return downstreamClosure(roots);
}

export function diffRiftBuildingPlans(previousPlan, nextPlan) {
  if (!previousPlan) return { changedStages: RIFT_BUILDING_PIPELINE_STAGES.map(stage => stage.id), dirtyStages: RIFT_BUILDING_PIPELINE_STAGES.map(stage => stage.id) };
  const changedStages = RIFT_BUILDING_PIPELINE_STAGES
    .filter(stage => previousPlan?.stageFingerprints?.[stage.id] !== nextPlan?.stageFingerprints?.[stage.id])
    .map(stage => stage.id);
  return { changedStages, dirtyStages: downstreamClosure(changedStages) };
}

export function createRiftBuildingPipelineTracker(plan, { strict = true } = {}) {
  const results = new Map(RIFT_BUILDING_PIPELINE_STAGES.map(stage => [stage.id, {
    id: stage.id,
    kind: stage.kind,
    dependsOn: [...stage.dependsOn],
    fingerprint: plan?.stageFingerprints?.[stage.id] || null,
    status: stage.external ? 'deferred' : 'pending',
    hardFailures: 0,
    softIssues: 0,
    notices: 0,
    diagnosticCodes: []
  }]));
  const marks = new Map();

  function assertDependencies(id) {
    const stage = STAGE_BY_ID.get(id);
    if (!stage) throw new Error(`Unknown Rift building stage '${id}'.`);
    for (const dependency of stage.dependsOn) {
      const status = results.get(dependency)?.status;
      if (!['pass', 'soft-pass'].includes(status)) throw new Error(`Stage '${id}' cannot run before '${dependency}' passes.`);
    }
  }

  function begin(id, diagnostics) {
    assertDependencies(id);
    const result = results.get(id);
    result.status = 'running';
    marks.set(id, Array.isArray(diagnostics) ? diagnostics.length : 0);
  }

  function gate(id, diagnostics, summary = null) {
    const result = results.get(id);
    if (!result || result.status !== 'running') throw new Error(`Stage '${id}' was not started.`);
    const start = marks.get(id) || 0;
    const slice = (diagnostics || []).slice(start);
    result.hardFailures = slice.filter(item => item?.severity === 'error').length;
    result.softIssues = slice.filter(item => item?.severity === 'warning').length;
    result.notices = slice.filter(item => item?.severity === 'notice').length;
    result.diagnosticCodes = slice.map(item => String(item?.code || 'diagnostic'));
    result.summary = summary == null ? null : clone(summary);
    result.status = result.hardFailures ? 'fail' : (result.softIssues ? 'soft-pass' : 'pass');
    if (strict && result.hardFailures) {
      const first = slice.find(item => item?.severity === 'error');
      const error = new Error(`Building stage '${id}' failed: ${first?.message || 'hard constraint failed.'}`);
      error.stage = id;
      error.pipeline = snapshot();
      error.diagnostics = slice;
      throw error;
    }
    return result;
  }

  function markExternal(id, status = 'deferred', summary = null) {
    const result = results.get(id);
    if (!result) throw new Error(`Unknown Rift building stage '${id}'.`);
    result.status = status;
    result.summary = summary == null ? null : clone(summary);
  }

  function snapshot() {
    const stages = RIFT_BUILDING_PIPELINE_STAGES.map(stage => clone(results.get(stage.id)));
    return {
      format: 'riftcity-building-pipeline',
      version: RIFT_BUILDING_PIPELINE_VERSION,
      planFingerprint: plan?.fingerprint || null,
      ok: stages.every(stage => stage.status !== 'fail'),
      stages
    };
  }

  return { begin, gate, markExternal, snapshot };
}
