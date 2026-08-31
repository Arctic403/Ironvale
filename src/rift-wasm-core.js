// RiftCity Native Core Cloudflare bridge v1.
// Wrangler bundles .wasm imports as WebAssembly.Module objects. The same C++
// binary is also served to browsers from public/wasm/rift-core.wasm.
import riftCoreModule from './wasm/rift-core.wasm';

const instance = new WebAssembly.Instance(riftCoreModule, {});
const api = instance.exports;

if (api.rift_core_version?.() !== 1) {
  throw new Error('RiftCity Worker native core version mismatch.');
}
if (api.rift_section_index?.(15, 15, 15) !== 4095 || api.rift_floor_div?.(-17, 16) !== -2) {
  throw new Error('RiftCity Worker native core self-test failed.');
}

export const RIFT_SERVER_NATIVE_CORE = Object.freeze({
  version: api.rift_core_version(),
  wasm: true,
  sectionIndex: (x, y, z) => api.rift_section_index(x, y, z),
  floorDiv: (value, divisor) => api.rift_floor_div(value, divisor),
  positiveMod: (value, divisor) => api.rift_positive_mod(value, divisor),
  aabbIntersects: (...args) => api.rift_aabb_intersects(...args) === 1,
  distanceSq3: (...args) => api.rift_distance_sq3(...args),
  hash3: (x, y, z, seed = 0) => api.rift_hash3(x, y, z, seed) >>> 0
});

// Side-effect marker used by Worker diagnostics and build-time bundling checks.
globalThis.__RIFT_SERVER_NATIVE_CORE__ = RIFT_SERVER_NATIVE_CORE;
