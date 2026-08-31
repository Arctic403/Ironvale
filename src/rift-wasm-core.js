// RiftCity Native Core Cloudflare bridge v2.
// Wrangler bundles .wasm imports as WebAssembly.Module objects. The same C++
// binary is also served to browsers from public/wasm/rift-core.wasm.
import riftCoreModule from './wasm/rift-core.wasm';

const instance = new WebAssembly.Instance(riftCoreModule, {});
const api = instance.exports;

if (api.rift_core_version?.() !== 2) {
  throw new Error('RiftCity Worker native core version mismatch.');
}
if (
  api.rift_section_index?.(15, 15, 15) !== 4095 ||
  api.rift_floor_div?.(-17, 16) !== -2 ||
  api.rift_ground_step_classify?.(1, 1.7, 0.58, 0.72) !== 2 ||
  api.rift_build_section_face_masks == null
) {
  throw new Error('RiftCity Worker native core v2 self-test failed.');
}

export const RIFT_SERVER_NATIVE_CORE = Object.freeze({
  version: api.rift_core_version(),
  wasm: true,
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
  sectionWorkspace: Object.freeze({
    statesPtr: api.rift_section_states_ptr(),
    faceMasksPtr: api.rift_section_face_masks_ptr(),
    cells: 4096
  })
});

// Side-effect marker used by Worker diagnostics and local Wrangler runtime smoke tests.
globalThis.__RIFT_SERVER_NATIVE_CORE__ = RIFT_SERVER_NATIVE_CORE;
