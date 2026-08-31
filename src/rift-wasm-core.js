// RiftCity Native Core Cloudflare bridge v3.
// Wrangler bundles the same C++ WASM binary used by Safari/Chromium. Server
// code keeps request/I/O orchestration in JavaScript while deterministic CPU
// kernels remain shareable with the client engine.
import riftCoreModule from './wasm/rift-core.wasm';

const instance = new WebAssembly.Instance(riftCoreModule, {});
const api = instance.exports;

if (api.rift_core_version?.() !== 3) {
  throw new Error('RiftCity Worker native core version mismatch.');
}
if (
  api.rift_section_index?.(15, 15, 15) !== 4095 ||
  api.rift_floor_div?.(-17, 16) !== -2 ||
  api.rift_ground_step_classify?.(1, 1.7, 0.58, 0.72) !== 2 ||
  (api.rift_section_slot_capacity?.() || 0) < 16 ||
  api.rift_build_section_mesh == null ||
  api.rift_batch_query_world == null ||
  api.rift_raycast_world == null
) {
  throw new Error('RiftCity Worker native core v3 self-test failed.');
}

export const RIFT_SERVER_NATIVE_CORE = Object.freeze({
  version: api.rift_core_version(),
  wasm: true,
  memoryBytes: api.memory?.buffer?.byteLength || 0,
  sectionSlotCapacity: api.rift_section_slot_capacity(),
  batchCapacity: api.rift_batch_capacity(),
  sectionIndex: (x, y, z) => api.rift_section_index(x, y, z),
  floorDiv: (value, divisor) => api.rift_floor_div(value, divisor),
  positiveMod: (value, divisor) => api.rift_positive_mod(value, divisor),
  aabbIntersects: (...args) => api.rift_aabb_intersects(...args) === 1,
  distanceSq3: (...args) => api.rift_distance_sq3(...args),
  hash3: (x, y, z, seed = 0) => api.rift_hash3(x, y, z, seed) >>> 0,
  crossedSupport: (...args) => api.rift_crossed_support(...args) === 1,
  groundStepCode: (...args) => api.rift_ground_step_classify(...args),
  stairTop: (...args) => api.rift_stair_top(...args),
  shapeTop: (...args) => api.rift_shape_top(...args),
  stateShapeTop: (...args) => api.rift_state_shape_top(...args),
  get metrics() {
    return Object.freeze({
      meshBuilds: api.rift_metric_mesh_builds() >>> 0,
      facesEmitted: api.rift_metric_faces_emitted() >>> 0,
      batchCalls: api.rift_metric_batch_calls() >>> 0,
      batchCells: api.rift_metric_batch_cells() >>> 0,
      raycasts: api.rift_metric_raycasts() >>> 0,
      raycastSteps: api.rift_metric_raycast_steps() >>> 0
    });
  }
});

// Side-effect marker used by Worker diagnostics and local Wrangler runtime smoke tests.
globalThis.__RIFT_SERVER_NATIVE_CORE__ = RIFT_SERVER_NATIVE_CORE;
