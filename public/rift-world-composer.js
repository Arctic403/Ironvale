import { compileRiftBuildingProgram } from './rift-building-program.js';

const CITY_FORMAT = 'riftcity-city-block';
const SUPPORTED_OPS = new Set(['set', 'fill_box', 'cut_box', 'hollow_box']);
const DEFAULT_MAX_BOUNDS_VOLUME = 2_000_000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function vec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} must be [x,y,z].`);
  return value.map((item, index) => {
    const number = Number(item);
    if (!Number.isFinite(number) || !Number.isInteger(number)) throw new Error(`${label}[${index}] must be an integer.`);
    return number;
  });
}

function add(point, delta) {
  return point.map((value, axis) => value + delta[axis]);
}

function inside(bounds, point) {
  return point[0] >= bounds.min[0] && point[0] <= bounds.max[0]
    && point[1] >= bounds.min[1] && point[1] <= bounds.max[1]
    && point[2] >= bounds.min[2] && point[2] <= bounds.max[2];
}

function transformOp(raw, delta, label) {
  const op = clone(raw);
  const type = String(op?.op || '').toLowerCase();
  if (!SUPPORTED_OPS.has(type)) throw new Error(`${label} uses unsupported op '${type}'.`);
  if (type === 'set') op.at = add(vec3(op.at, `${label}.at`), delta);
  else {
    op.min = add(vec3(op.min, `${label}.min`), delta);
    op.max = add(vec3(op.max, `${label}.max`), delta);
  }
  return op;
}

function opPoints(op) {
  return op.op === 'set' ? [op.at] : [op.min, op.max];
}

function opInside(bounds, op) {
  return opPoints(op).every(point => inside(bounds, point));
}

function expandBounds(bounds, ops) {
  const next = { min: [...bounds.min], max: [...bounds.max] };
  for (const op of ops) {
    for (const point of opPoints(op)) {
      for (let axis = 0; axis < 3; axis += 1) {
        next.min[axis] = Math.min(next.min[axis], point[axis]);
        next.max[axis] = Math.max(next.max[axis], point[axis]);
      }
    }
  }
  return next;
}

function boundsVolume(bounds) {
  return bounds.min.reduce((volume, min, axis) => volume * (bounds.max[axis] - min + 1), 1);
}

function shouldRemove(op, exact, prefixes) {
  const name = String(op?.name || '');
  if (exact.has(name)) return true;
  return prefixes.some(prefix => name.startsWith(prefix));
}

export function composeRiftBuildingProgramIntoCityBlock(baseInput, programInput, options = {}) {
  const base = clone(baseInput);
  if (!base || base.format !== CITY_FORMAT) throw new Error(`Base document must be '${CITY_FORMAT}'.`);
  if (!Array.isArray(base.ops)) throw new Error('Base city block must contain an ops array.');
  const baseOrigin = vec3(base.origin || [0, 0, 0], 'base.origin');
  let bounds = {
    min: vec3(base.bounds?.min, 'base.bounds.min'),
    max: vec3(base.bounds?.max, 'base.bounds.max')
  };

  const result = compileRiftBuildingProgram(programInput, { strict: options.strict !== false });
  const generated = result.document;
  const generatedOrigin = vec3(generated.origin || [0, 0, 0], 'BuildingProgram output origin');
  const delta = generatedOrigin.map((value, axis) => value - baseOrigin[axis]);
  const overlayId = result.semantics.buildingId;

  const exact = new Set((options.removeNames || []).map(String));
  const prefixes = (options.removeNamePrefixes || []).map(String).filter(Boolean);
  const kept = [];
  const removed = [];
  for (const op of base.ops) (shouldRemove(op, exact, prefixes) ? removed : kept).push(op);

  const overlayOps = generated.ops.map((raw, index) => {
    const op = transformOp(raw, delta, `overlay ${overlayId} ops[${index}]`);
    if (!op.name) {
      const semantic = String(op._semanticGroup || op._semanticRole || `part-${index + 1}`);
      op.name = `${result.semantics.name} · ${semantic}`;
    }
    op._worldOverlayId = overlayId;
    return op;
  });

  if (options.expandBounds) {
    bounds = expandBounds(bounds, overlayOps);
    const limit = Number(options.maxBoundsVolume) || DEFAULT_MAX_BOUNDS_VOLUME;
    const volume = boundsVolume(bounds);
    if (volume > limit) {
      throw new Error(`Composed district bounds volume ${volume.toLocaleString()} exceeds ${limit.toLocaleString()} cells.`);
    }
    base.bounds = clone(bounds);
  }

  for (const op of overlayOps) {
    if (!opInside(bounds, op)) {
      const where = op.op === 'set' ? op.at : `${op.min.join(',')} -> ${op.max.join(',')}`;
      throw new Error(`BuildingProgram '${overlayId}' writes outside base district bounds at ${where}.`);
    }
  }

  base.palette = { ...(base.palette || {}), ...(generated.palette || {}) };
  base.ops = [...kept, ...overlayOps];
  base.metadata = {
    ...(base.metadata || {}),
    world_composition: {
      version: 2,
      boundsExpanded: !!options.expandBounds,
      bounds: clone(bounds),
      overlays: [
        ...((base.metadata?.world_composition?.overlays || []).filter(item => item?.id !== overlayId)),
        {
          id: overlayId,
          sourceFormat: 'riftcity-building-program',
          sourceFingerprint: result.report.sourceFingerprint,
          worldOrigin: generatedOrigin,
          worldBounds: result.semantics.worldBounds,
          chunk: result.semantics.chunk,
          removedBaseOperations: removed.length,
          generatedOperations: overlayOps.length,
          report: result.report,
          semantics: result.semantics
        }
      ]
    }
  };

  return {
    document: base,
    overlay: result,
    stats: {
      baseOperations: baseInput.ops.length,
      removedOperations: removed.length,
      overlayOperations: overlayOps.length,
      composedOperations: base.ops.length,
      boundsVolume: boundsVolume(bounds)
    }
  };
}

export const RIFT_DOWNTOWN_BANK_REPLACEMENT = Object.freeze({
  expandBounds: true,
  maxBoundsVolume: DEFAULT_MAX_BOUNDS_VOLUME,
  removeNames: Object.freeze([
    'RiftCity Bank',
    'Bank entrance',
    'Bank window A cut',
    'Bank window A glass',
    'Bank window B cut',
    'Bank window B glass',
    'Bank forecourt'
  ])
});
