import { RiftEngine } from './rift-engine.js?v=20260901-engine-blackbox-r1';

export const IRONVALE_GEOMETRY_GUARD_FORMAT = 'ironvale-geometry-guard-v1';

const PATCH_MARK = Symbol.for('ironvale.geometry-guard-patched');
const CAPSULE_KIND = 'character-fallback';
const CAPSULE_LABEL = 'player-capsule';
const CAPSULE_RADIAL = 12;

const state = {
  format: IRONVALE_GEOMETRY_GUARD_FORMAT,
  installedAt: new Date().toISOString(),
  validationCount: 0,
  repairCount: 0,
  rejectionCount: 0,
  lastRepair: null,
  lastRejection: null
};

function isoNow() { return new Date().toISOString(); }
function short(value, max = 260) { return String(value == null ? '' : value).slice(0, max); }
function meshName(mesh) { return mesh?.label || mesh?.diagnosticId || mesh?.kind || 'mesh'; }

function geometryMetrics(geometry) {
  if (!geometry) throw new Error('Mesh geometry is required');
  const vertices = geometry.vertices;
  const indices = geometry.indices;
  const stride = Math.trunc(Number(geometry.vertexStride) || 9);
  if (!vertices || typeof vertices.length !== 'number') throw new Error('Mesh vertices are missing');
  if (!indices || typeof indices.length !== 'number') throw new Error('Mesh indices are missing');
  if (stride < 9 || vertices.length % stride !== 0) throw new Error(`Invalid vertex stride ${stride} for ${vertices.length} floats`);
  const vertexCount = vertices.length / stride;
  return { vertices, indices, stride, vertexCount };
}

function validateIndexBounds(mesh, geometry) {
  const { indices, vertexCount } = geometryMetrics(geometry);
  let maxIndex = -1;
  let minIndex = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset < indices.length; offset += 1) {
    const index = Number(indices[offset]);
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
      const error = new Error(`Geometry index out of bounds for ${meshName(mesh)}: index=${index} at offset=${offset}, vertexCount=${vertexCount}`);
      error.code = 'IRONVALE_GEOMETRY_INDEX_OOB';
      throw error;
    }
    if (index > maxIndex) maxIndex = index;
    if (index < minIndex) minIndex = index;
  }
  return {
    vertexCount,
    indexCount: indices.length,
    minIndex: Number.isFinite(minIndex) ? minIndex : null,
    maxIndex: maxIndex >= 0 ? maxIndex : null
  };
}

function shouldRepairLegacyCapsule(mesh, geometry) {
  if (mesh?.kind !== CAPSULE_KIND || mesh?.label !== CAPSULE_LABEL) return false;
  try {
    const { indices, stride, vertexCount } = geometryMetrics(geometry);
    return stride === 9 && vertexCount === 108 && indices.length === 576;
  } catch (_) {
    return false;
  }
}

function repairLegacyCapsule(mesh, geometry) {
  if (!shouldRepairLegacyCapsule(mesh, geometry)) return geometry;
  const { vertices, stride, vertexCount } = geometryMetrics(geometry);
  const ringCount = vertexCount / CAPSULE_RADIAL;
  if (!Number.isInteger(ringCount) || ringCount < 2) return geometry;

  const repaired = new Uint16Array((ringCount - 1) * CAPSULE_RADIAL * 6);
  let offset = 0;
  for (let ring = 0; ring < ringCount - 1; ring += 1) {
    for (let side = 0; side < CAPSULE_RADIAL; side += 1) {
      const next = (side + 1) % CAPSULE_RADIAL;
      const a = ring * CAPSULE_RADIAL + side;
      const b = ring * CAPSULE_RADIAL + next;
      const c = (ring + 1) * CAPSULE_RADIAL + side;
      const d = (ring + 1) * CAPSULE_RADIAL + next;
      repaired[offset++] = a;
      repaired[offset++] = c;
      repaired[offset++] = b;
      repaired[offset++] = b;
      repaired[offset++] = c;
      repaired[offset++] = d;
    }
  }

  state.repairCount += 1;
  state.lastRepair = {
    at: isoNow(),
    mesh: meshName(mesh),
    kind: mesh?.kind || null,
    repair: 'capsule-ring-wrap-v1',
    radial: CAPSULE_RADIAL,
    rings: ringCount,
    vertexCount,
    indexCount: repaired.length
  };
  mesh.geometryGuardRepair = 'capsule-ring-wrap-v1';
  return { ...geometry, vertices, indices: repaired, vertexStride: stride };
}

const proto = RiftEngine?.prototype;
if (proto && !proto[PATCH_MARK]) {
  const nativeUpload = proto._upload;
  if (typeof nativeUpload !== 'function') throw new Error('RiftEngine._upload is unavailable for geometry guard');

  Object.defineProperty(proto, PATCH_MARK, { value: true });
  proto._upload = function guardedGeometryUpload(mesh, geometry) {
    let prepared = geometry;
    try {
      prepared = repairLegacyCapsule(mesh, geometry);
      const metrics = validateIndexBounds(mesh, prepared);
      state.validationCount += 1;
      mesh.geometryGuardMetrics = metrics;
      return nativeUpload.call(this, mesh, prepared);
    } catch (error) {
      state.rejectionCount += 1;
      state.lastRejection = {
        at: isoNow(),
        mesh: meshName(mesh),
        kind: mesh?.kind || null,
        code: error?.code || 'IRONVALE_GEOMETRY_INVALID',
        error: short(error?.message || error)
      };
      try {
        window.IronvaleDiagnostics?.record?.('geometry-guard', 'Rejected invalid mesh geometry before WebGL upload', state.lastRejection, 'error');
      } catch (_) {}
      throw error;
    }
  };
}

let providerRegistered = false;
function registerProvider() {
  if (providerRegistered) return;
  const diagnostics = window.IronvaleDiagnostics;
  if (!diagnostics?.registerProvider) { setTimeout(registerProvider, 100); return; }
  diagnostics.registerProvider('geometry-guard', () => ({
    ...state,
    policy: {
      rejectsOutOfBoundsIndicesBeforeWebGL: true,
      repairsKnownLegacyFallbackCapsule: true,
      capsuleRepair: 'd = (ring + 1) * radial + next'
    }
  }));
  providerRegistered = true;
}

registerProvider();
window.IronvaleGeometryGuard = Object.freeze({ format: state.format, status: () => ({ ...state }) });
