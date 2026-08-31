// RiftCity Native Core browser bridge v1.
// Loads the shared C++ WASM core in Safari/Chromium while keeping deterministic
// JavaScript fallbacks so native acceleration can never become a boot blocker.

const CORE_URL = new URL('./wasm/rift-core.wasm', import.meta.url);
let nativeExports = null;
let state = 'loading';
let lastError = null;

const jsFallback = Object.freeze({
  rift_core_version: () => 0,
  rift_section_index(x, y, z) {
    x = Math.trunc(x); y = Math.trunc(y); z = Math.trunc(z);
    if (x < 0 || x >= 16 || y < 0 || y >= 16 || z < 0 || z >= 16) return -1;
    return (y << 8) | (z << 4) | x;
  },
  rift_floor_div(value, divisor) {
    value = Math.trunc(value); divisor = Math.trunc(divisor);
    return divisor > 0 ? Math.floor(value / divisor) : 0;
  },
  rift_positive_mod(value, divisor) {
    value = Math.trunc(value); divisor = Math.trunc(divisor);
    if (divisor <= 0) return 0;
    return ((value % divisor) + divisor) % divisor;
  },
  rift_aabb_intersects(aMinX,aMinY,aMinZ,aMaxX,aMaxY,aMaxZ,bMinX,bMinY,bMinZ,bMaxX,bMaxY,bMaxZ) {
    return aMinX < bMaxX && aMaxX > bMinX && aMinY < bMaxY && aMaxY > bMinY && aMinZ < bMaxZ && aMaxZ > bMinZ ? 1 : 0;
  },
  rift_distance_sq3(ax,ay,az,bx,by,bz) {
    const dx=ax-bx, dy=ay-by, dz=az-bz;
    return dx*dx + dy*dy + dz*dz;
  }
});

async function instantiateCore() {
  const response = await fetch(CORE_URL, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Rift native core request failed with HTTP ${response.status}.`);

  if (typeof WebAssembly.instantiateStreaming === 'function') {
    try {
      const result = await WebAssembly.instantiateStreaming(response.clone(), {});
      return result.instance.exports;
    } catch (_) {
      // Safari/CDN MIME handling can reject streaming compilation even when the
      // binary itself is valid. Fall through to the portable ArrayBuffer path.
    }
  }

  const bytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(bytes, {});
  return result.instance.exports;
}

export async function initializeRiftWasmCore() {
  if (nativeExports) return nativeExports;
  try {
    const exports = await instantiateCore();
    if (exports.rift_core_version?.() !== 1) throw new Error('Rift native core version mismatch.');
    if (exports.rift_section_index?.(15, 15, 15) !== 4095) throw new Error('Rift native section-index self-test failed.');
    if (exports.rift_floor_div?.(-17, 16) !== -2) throw new Error('Rift native negative-coordinate self-test failed.');
    nativeExports = exports;
    state = 'wasm';
    lastError = null;
  } catch (error) {
    state = 'javascript-fallback';
    lastError = error;
    console.warn('RiftCity native core unavailable; deterministic JavaScript fallback remains active.', error);
  }
  window.dispatchEvent(new CustomEvent('riftnativecorechange', { detail: getRiftNativeCoreStatus() }));
  return nativeExports || jsFallback;
}

export function getRiftNativeCore() {
  return nativeExports || jsFallback;
}

export function getRiftNativeCoreStatus() {
  return Object.freeze({
    mode: state,
    ready: state !== 'loading',
    wasm: state === 'wasm',
    version: nativeExports?.rift_core_version?.() || 0,
    error: lastError?.message || null
  });
}

await initializeRiftWasmCore();

window.RiftCityNativeCore = Object.freeze({
  version: 'native-core-browser-v1',
  get exports() { return getRiftNativeCore(); },
  get status() { return getRiftNativeCoreStatus(); },
  initialize: initializeRiftWasmCore
});
