// RiftCity Native Core browser/Node bridge v2.
// Safari/Chromium load the shared C++ WASM binary over HTTP. Node-based engine
// verification loads the exact same binary from disk. Deterministic JS fallbacks
// remain available so native acceleration can never become a game boot blocker.

const CORE_URL = new URL('./wasm/rift-core.wasm', import.meta.url);
const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const SECTION_SIZE = 16;
const SECTION_VOLUME = 4096;
const PARTIAL_SHAPE_MASK = 0x0700;
let nativeExports = null;
let state = 'loading';
let lastError = null;

function clamp01(value) {
  value = Number(value) || 0;
  return Math.max(0, Math.min(1, value));
}

function fraction(value) {
  value = Number(value) || 0;
  return value - Math.floor(value);
}

function fallbackStairTop(rotation, localX, localZ) {
  let t = 0;
  switch (Math.trunc(rotation) & 3) {
    case 0: t = 1 - localZ; break;
    case 1: t = localX; break;
    case 2: t = localZ; break;
    case 3: t = 1 - localX; break;
    default: t = 0;
  }
  return clamp01(t);
}

function fallbackShapeTop(shape, rotation, localX, localZ) {
  switch (Math.trunc(shape)) {
    case 1: return 0.5;
    case 2: return 1;
    case 3: return fallbackStairTop(rotation, localX, localZ);
    case 0:
    default: return 1;
  }
}

const jsFallback = Object.freeze({
  rift_core_version: () => 0,
  rift_section_index(x, y, z) {
    x = Math.trunc(x); y = Math.trunc(y); z = Math.trunc(z);
    if (x < 0 || x >= SECTION_SIZE || y < 0 || y >= SECTION_SIZE || z < 0 || z >= SECTION_SIZE) return -1;
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
  },
  rift_crossed_support(previousY, candidateY, supportY, tolerance, previousTolerance) {
    tolerance = Math.max(0, Number(tolerance) || 0);
    previousTolerance = Math.max(0, Number(previousTolerance) || 0);
    return candidateY <= supportY + tolerance && previousY >= supportY - previousTolerance ? 1 : 0;
  },
  rift_ground_step_classify(currentY, targetSupportY, stepUp, snapDown) {
    const delta = targetSupportY - currentY;
    if (delta > Math.max(0, stepUp) + 0.0001) return 2;
    if (delta < -Math.max(0, snapDown) - 0.0001) return 0;
    return 1;
  },
  rift_stair_top(rotation, localX, localZ) {
    return fallbackStairTop(rotation, localX, localZ);
  },
  rift_shape_top(shape, rotation, localX, localZ) {
    return fallbackShapeTop(shape, rotation, localX, localZ);
  },
  rift_state_shape_top(state, worldX, worldZ) {
    state = Math.max(0, Math.min(65535, Math.trunc(Number(state) || 0)));
    if (!state) return 0;
    const shape = (state >> 8) & 7;
    const rotation = (state >> 11) & 3;
    return fallbackShapeTop(shape, rotation, fraction(worldX), fraction(worldZ));
  }
});

function buildSectionFaceMasksFallback(source) {
  const states = source instanceof Uint16Array ? source : Uint16Array.from(source || []);
  if (states.length !== SECTION_VOLUME) throw new Error(`Rift native section analysis requires ${SECTION_VOLUME} states.`);
  const masks = new Uint8Array(SECTION_VOLUME);
  let blocks = 0;
  let partial = false;
  for (let index = 0; index < SECTION_VOLUME; index += 1) {
    const blockState = states[index];
    if (!blockState) continue;
    blocks += 1;
    if ((blockState & PARTIAL_SHAPE_MASK) !== 0) partial = true;
  }
  if (partial) return { masks, blocks, candidateFaces: 0, partial: true, native: false };

  let candidateFaces = 0;
  for (let y = 0; y < SECTION_SIZE; y += 1) {
    for (let z = 0; z < SECTION_SIZE; z += 1) {
      for (let x = 0; x < SECTION_SIZE; x += 1) {
        const index = (y << 8) | (z << 4) | x;
        if (!states[index]) continue;
        let mask = 0;
        if (x === 15 || !states[index + 1]) { mask |= 1 << 0; candidateFaces += 1; }
        if (x === 0 || !states[index - 1]) { mask |= 1 << 1; candidateFaces += 1; }
        if (y === 15 || !states[index + 256]) { mask |= 1 << 2; candidateFaces += 1; }
        if (y === 0 || !states[index - 256]) { mask |= 1 << 3; candidateFaces += 1; }
        if (z === 15 || !states[index + 16]) { mask |= 1 << 4; candidateFaces += 1; }
        if (z === 0 || !states[index - 16]) { mask |= 1 << 5; candidateFaces += 1; }
        masks[index] = mask;
      }
    }
  }
  return { masks, blocks, candidateFaces, partial: false, native: false };
}

async function instantiateCore() {
  if (!IS_BROWSER) {
    const { readFile } = await import('node:fs/promises');
    const bytes = await readFile(CORE_URL);
    const result = await WebAssembly.instantiate(bytes, {});
    return result.instance.exports;
  }

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

function updateBrowserDiagnostics() {
  if (!IS_BROWSER) return;
  document.documentElement.dataset.riftNativeCore = state === 'wasm' ? 'wasm' : 'javascript-fallback';
  document.documentElement.dataset.riftNativeCoreVersion = String(nativeExports?.rift_core_version?.() || 0);
}

export async function initializeRiftWasmCore() {
  if (nativeExports) return nativeExports;
  try {
    const exports = await instantiateCore();
    if (exports.rift_core_version?.() !== 2) throw new Error('Rift native core version mismatch.');
    if (exports.rift_section_index?.(15, 15, 15) !== 4095) throw new Error('Rift native section-index self-test failed.');
    if (exports.rift_floor_div?.(-17, 16) !== -2) throw new Error('Rift native negative-coordinate self-test failed.');
    if (exports.rift_ground_step_classify?.(1, 1.7, 0.58, 0.72) !== 2) throw new Error('Rift native player-kernel self-test failed.');
    if (!(exports.memory instanceof WebAssembly.Memory)) throw new Error('Rift native memory export missing.');
    const statesPtr = exports.rift_section_states_ptr?.() >>> 0;
    const masksPtr = exports.rift_section_face_masks_ptr?.() >>> 0;
    const statesView = new Uint16Array(exports.memory.buffer, statesPtr, SECTION_VOLUME);
    statesView.fill(0);
    statesView[(1 << 8) | (1 << 4) | 1] = 1;
    const packed = exports.rift_build_section_face_masks?.() >>> 0;
    const masksView = new Uint8Array(exports.memory.buffer, masksPtr, SECTION_VOLUME);
    if (((packed >>> 16) & 0x7fff) !== 1 || (packed & 0xffff) !== 6 || masksView[(1 << 8) | (1 << 4) | 1] !== 0x3f) {
      throw new Error('Rift native section-culling self-test failed.');
    }
    nativeExports = exports;
    state = 'wasm';
    lastError = null;
  } catch (error) {
    state = 'javascript-fallback';
    lastError = error;
    console.warn('RiftCity native core unavailable; deterministic JavaScript fallback remains active.', error);
  }
  updateBrowserDiagnostics();
  if (IS_BROWSER) {
    window.dispatchEvent(new CustomEvent('riftnativecorechange', { detail: getRiftNativeCoreStatus() }));
  }
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

export function riftNativeSectionIndex(x, y, z) {
  return getRiftNativeCore().rift_section_index(Math.trunc(x), Math.trunc(y), Math.trunc(z));
}

export function riftNativeWorldCellToSection(value, size = SECTION_SIZE) {
  const cell = Math.trunc(Number(value) || 0);
  const divisor = Math.max(1, Math.trunc(Number(size) || SECTION_SIZE));
  const api = getRiftNativeCore();
  return {
    section: api.rift_floor_div(cell, divisor),
    local: api.rift_positive_mod(cell, divisor)
  };
}

export function riftNativeCrossedSupport(previousY, candidateY, supportY, tolerance, previousTolerance) {
  return getRiftNativeCore().rift_crossed_support(previousY, candidateY, supportY, tolerance, previousTolerance) === 1;
}

export function riftNativeGroundStepClassify(currentY, targetSupportY, stepUp, snapDown) {
  return getRiftNativeCore().rift_ground_step_classify(currentY, targetSupportY, stepUp, snapDown);
}

export function riftNativeStairTop(rotation, localX, localZ) {
  return getRiftNativeCore().rift_stair_top(rotation, localX, localZ);
}

export function riftNativeShapeTop(shape, rotation, localX, localZ) {
  return getRiftNativeCore().rift_shape_top(shape, rotation, localX, localZ);
}

export function riftNativeStateShapeTop(state, worldX, worldZ) {
  return getRiftNativeCore().rift_state_shape_top(Math.trunc(Number(state) || 0) >>> 0, worldX, worldZ);
}

export function buildRiftNativeSectionFaceMasks(source) {
  if (!nativeExports || !(nativeExports.memory instanceof WebAssembly.Memory)) {
    return buildSectionFaceMasksFallback(source);
  }
  const states = source instanceof Uint16Array ? source : Uint16Array.from(source || []);
  if (states.length !== SECTION_VOLUME) throw new Error(`Rift native section analysis requires ${SECTION_VOLUME} states.`);
  const statesPtr = nativeExports.rift_section_states_ptr() >>> 0;
  const masksPtr = nativeExports.rift_section_face_masks_ptr() >>> 0;
  new Uint16Array(nativeExports.memory.buffer, statesPtr, SECTION_VOLUME).set(states);
  const packed = nativeExports.rift_build_section_face_masks() >>> 0;
  const partial = Boolean((packed >>> 31) & 1);
  const blocks = (packed >>> 16) & 0x7fff;
  const candidateFaces = packed & 0xffff;
  const masks = new Uint8Array(nativeExports.memory.buffer, masksPtr, SECTION_VOLUME).slice();
  return { masks, blocks, candidateFaces, partial, native: true };
}

await initializeRiftWasmCore();

const publicBridge = Object.freeze({
  version: 'native-core-browser-v2',
  get exports() { return getRiftNativeCore(); },
  get status() { return getRiftNativeCoreStatus(); },
  initialize: initializeRiftWasmCore,
  buildSectionFaceMasks: buildRiftNativeSectionFaceMasks
});

if (IS_BROWSER) window.RiftCityNativeCore = publicBridge;
