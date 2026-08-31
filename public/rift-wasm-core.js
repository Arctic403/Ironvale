// RiftCity Native Core browser/Node bridge v3.
// v3 keeps RiftSections resident in WASM memory, emits full-block section meshes
// natively, batches resident-world collision queries and exposes voxel DDA
// raycasting. JavaScript fallbacks remain authoritative whenever a native path
// cannot preserve the existing world semantics.

const CORE_URL = new URL('./wasm/rift-core.wasm', import.meta.url);
const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const SECTION_SIZE = 16;
const SECTION_VOLUME = 4096;
const PARTIAL_SHAPE_MASK = 0x0700;
const FACE_COUNT = 6;
const BORDER_CELLS = 256;
const VERTEX_STRIDE = 9;
let nativeExports = null;
let state = 'loading';
let lastError = null;
let nextWorldId = 1;
let slotClock = 0;
let usableSlotCount = 0;
let slotOwners = [];
const sectionRecords = new WeakMap();

const bridgeMetrics = {
  sectionSyncs: 0,
  sectionBytesCopied: 0,
  slotEvictions: 0,
  nativeMeshBuilds: 0,
  nativeMeshFallbacks: 0,
  nativeMeshBuildMsTotal: 0,
  nativeMeshBuildMsMax: 0,
  borderCellsCopied: 0,
  batchCalls: 0,
  batchCells: 0,
  raycasts: 0,
  raycastFallbacks: 0
};

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}
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
  rift_stair_top(rotation, localX, localZ) { return fallbackStairTop(rotation, localX, localZ); },
  rift_shape_top(shape, rotation, localX, localZ) { return fallbackShapeTop(shape, rotation, localX, localZ); },
  rift_state_shape_top(state, worldX, worldZ) {
    state = Math.max(0, Math.min(65535, Math.trunc(Number(state) || 0)));
    if (!state) return 0;
    return fallbackShapeTop((state >> 8) & 7, (state >> 11) & 3, fraction(worldX), fraction(worldZ));
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
      // Safari/CDN MIME handling can reject streaming compilation. ArrayBuffer
      // instantiation remains the portable fallback.
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

function initializeSlotManager(exports) {
  const total = Math.max(0, Math.trunc(exports.rift_section_slot_capacity?.() || 0));
  // Slot 0 is reserved for the compatibility face-mask workspace.
  usableSlotCount = Math.max(0, total - 1);
  slotOwners = new Array(total).fill(null);
}

export async function initializeRiftWasmCore() {
  if (nativeExports) return nativeExports;
  try {
    const exports = await instantiateCore();
    if (exports.rift_core_version?.() !== 3) throw new Error('Rift native core version mismatch.');
    if (exports.rift_section_index?.(15, 15, 15) !== 4095) throw new Error('Rift native section-index self-test failed.');
    if (exports.rift_floor_div?.(-17, 16) !== -2) throw new Error('Rift native negative-coordinate self-test failed.');
    if (exports.rift_ground_step_classify?.(1, 1.7, 0.58, 0.72) !== 2) throw new Error('Rift native player-kernel self-test failed.');
    if (!(exports.memory instanceof WebAssembly.Memory)) throw new Error('Rift native memory export missing.');
    if ((exports.rift_section_slot_capacity?.() || 0) < 16) throw new Error('Rift native persistent section slots missing.');
    if (!exports.rift_build_section_mesh || !exports.rift_batch_query_world || !exports.rift_raycast_world) {
      throw new Error('Rift native v3 mesh/query/raycast exports missing.');
    }
    initializeSlotManager(exports);
    nativeExports = exports;
    state = 'wasm';
    lastError = null;
  } catch (error) {
    state = 'javascript-fallback';
    lastError = error;
    console.warn('RiftCity native core unavailable; deterministic JavaScript fallback remains active.', error);
  }
  updateBrowserDiagnostics();
  if (IS_BROWSER) window.dispatchEvent(new CustomEvent('riftnativecorechange', { detail: getRiftNativeCoreStatus() }));
  return nativeExports || jsFallback;
}

export function getRiftNativeCore() { return nativeExports || jsFallback; }

function nativeMetricSnapshot() {
  const api = nativeExports;
  return {
    meshBuilds: api?.rift_metric_mesh_builds?.() >>> 0 || 0,
    facesEmitted: api?.rift_metric_faces_emitted?.() >>> 0 || 0,
    batchCalls: api?.rift_metric_batch_calls?.() >>> 0 || 0,
    batchCells: api?.rift_metric_batch_cells?.() >>> 0 || 0,
    raycasts: api?.rift_metric_raycasts?.() >>> 0 || 0,
    raycastSteps: api?.rift_metric_raycast_steps?.() >>> 0 || 0
  };
}

export function getRiftNativeCoreStatus() {
  const avgMeshMs = bridgeMetrics.nativeMeshBuilds
    ? bridgeMetrics.nativeMeshBuildMsTotal / bridgeMetrics.nativeMeshBuilds
    : 0;
  return Object.freeze({
    mode: state,
    ready: state !== 'loading',
    wasm: state === 'wasm',
    version: nativeExports?.rift_core_version?.() || 0,
    error: lastError?.message || null,
    residentSlotCapacity: usableSlotCount,
    metrics: Object.freeze({
      ...bridgeMetrics,
      nativeMeshBuildMsAvg: avgMeshMs,
      native: Object.freeze(nativeMetricSnapshot())
    })
  });
}

export function resetRiftNativeCoreMetrics() {
  for (const key of Object.keys(bridgeMetrics)) bridgeMetrics[key] = 0;
  nativeExports?.rift_metric_reset?.();
}

export function riftNativeSectionIndex(x, y, z) {
  return getRiftNativeCore().rift_section_index(Math.trunc(x), Math.trunc(y), Math.trunc(z));
}
export function riftNativeWorldCellToSection(value, size = SECTION_SIZE) {
  const cell = Math.trunc(Number(value) || 0);
  const divisor = Math.max(1, Math.trunc(Number(size) || SECTION_SIZE));
  const api = getRiftNativeCore();
  return { section: api.rift_floor_div(cell, divisor), local: api.rift_positive_mod(cell, divisor) };
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
  const packed = Math.trunc(Number(state) || 0) >>> 0;
  if (!packed) return 0;
  const shape = (packed >> 8) & 7;
  const rotation = (packed >> 11) & 3;
  // Preserve f64 cell ownership before the WASM f32 boundary. This prevents a
  // 3.999999... stair edge from becoming local 0 after float conversion.
  return getRiftNativeCore().rift_shape_top(shape, rotation, fraction(worldX), fraction(worldZ));
}

function getRecordMap(section) {
  let records = sectionRecords.get(section);
  if (!records) { records = new Map(); sectionRecords.set(section, records); }
  return records;
}
function getSectionRecord(section, worldId) {
  const records = getRecordMap(section);
  let record = records.get(worldId);
  if (!record) {
    record = { section, worldId, slot: -1, revision: -1, states: null, used: 0 };
    records.set(worldId, record);
  }
  return record;
}
function releaseSlot(record) {
  if (!nativeExports || record.slot < 1) return;
  if (slotOwners[record.slot] === record) {
    nativeExports.rift_section_slot_invalidate(record.slot);
    slotOwners[record.slot] = null;
  }
  record.slot = -1;
  record.revision = -1;
  record.states = null;
}
function acquireSlot(record) {
  if (!nativeExports || usableSlotCount <= 0) return -1;
  if (record.slot >= 1 && slotOwners[record.slot] === record) {
    record.used = ++slotClock;
    return record.slot;
  }
  let slot = -1;
  for (let i = 1; i < slotOwners.length; i += 1) {
    if (!slotOwners[i]) { slot = i; break; }
  }
  if (slot < 0) {
    let oldest = Infinity;
    for (let i = 1; i < slotOwners.length; i += 1) {
      const owner = slotOwners[i];
      if (owner && owner.used < oldest) { oldest = owner.used; slot = i; }
    }
    const evicted = slotOwners[slot];
    if (evicted) {
      evicted.slot = -1;
      evicted.revision = -1;
      evicted.states = null;
      bridgeMetrics.slotEvictions += 1;
    }
  }
  record.slot = slot;
  record.used = ++slotClock;
  slotOwners[slot] = record;
  nativeExports.rift_section_slot_bind(
    slot,
    Math.trunc(record.worldId),
    Math.trunc(record.section?.sx || 0),
    Math.trunc(record.section?.sy || 0),
    Math.trunc(record.section?.sz || 0)
  );
  return slot;
}

export function syncRiftNativeSection(section, { worldId = 0 } = {}) {
  if (!nativeExports || !(nativeExports.memory instanceof WebAssembly.Memory) || !section?.states) {
    return { native: false, slot: -1, synced: false, record: null };
  }
  const states = section.states instanceof Uint16Array ? section.states : Uint16Array.from(section.states || []);
  if (states.length !== SECTION_VOLUME) return { native: false, slot: -1, synced: false, record: null };
  const record = getSectionRecord(section, Math.trunc(worldId));
  const slot = acquireSlot(record);
  if (slot < 1) return { native: false, slot: -1, synced: false, record };
  // Rebind in case the section object was reused with new coordinates.
  nativeExports.rift_section_slot_bind(slot, record.worldId, Math.trunc(section.sx || 0), Math.trunc(section.sy || 0), Math.trunc(section.sz || 0));
  const revision = Math.trunc(Number(section.revision) || 0);
  let synced = false;
  if (record.revision !== revision || record.states !== section.states) {
    const ptr = nativeExports.rift_section_slot_states_ptr(slot) >>> 0;
    new Uint16Array(nativeExports.memory.buffer, ptr, SECTION_VOLUME).set(states);
    record.revision = revision;
    record.states = section.states;
    bridgeMetrics.sectionSyncs += 1;
    bridgeMetrics.sectionBytesCopied += states.byteLength;
    synced = true;
  }
  return { native: true, slot, synced, record };
}

export function buildRiftNativeSectionFaceMasks(source) {
  if (!nativeExports || !(nativeExports.memory instanceof WebAssembly.Memory)) return buildSectionFaceMasksFallback(source);
  const states = source instanceof Uint16Array ? source : Uint16Array.from(source || []);
  if (states.length !== SECTION_VOLUME) throw new Error(`Rift native section analysis requires ${SECTION_VOLUME} states.`);
  const statesPtr = nativeExports.rift_section_states_ptr() >>> 0;
  const masksPtr = nativeExports.rift_section_face_masks_ptr() >>> 0;
  new Uint16Array(nativeExports.memory.buffer, statesPtr, SECTION_VOLUME).set(states);
  const packed = nativeExports.rift_build_section_face_masks() >>> 0;
  return {
    masks: new Uint8Array(nativeExports.memory.buffer, masksPtr, SECTION_VOLUME).slice(),
    blocks: (packed >>> 16) & 0x7fff,
    candidateFaces: packed & 0xffff,
    partial: Boolean((packed >>> 31) & 1),
    native: true
  };
}

function copyNeighborBorder(target, face, neighbor) {
  if (!neighbor?.states) return 0;
  const states = neighbor.states;
  let written = 0;
  if (face === 0 || face === 1) {
    const x = face === 0 ? 0 : 15;
    for (let y = 0; y < 16; y += 1) for (let z = 0; z < 16; z += 1) {
      target[y * 16 + z] = states[(y << 8) | (z << 4) | x] || 0; written += 1;
    }
  } else if (face === 2 || face === 3) {
    const y = face === 2 ? 0 : 15;
    for (let z = 0; z < 16; z += 1) for (let x = 0; x < 16; x += 1) {
      target[z * 16 + x] = states[(y << 8) | (z << 4) | x] || 0; written += 1;
    }
  } else {
    const z = face === 4 ? 0 : 15;
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
      target[y * 16 + x] = states[(y << 8) | (z << 4) | x] || 0; written += 1;
    }
  }
  return written;
}

function fillOutsideBorder(target, face, section, getOutsideBlock) {
  if (typeof getOutsideBlock !== 'function') return 0;
  const ox = Math.trunc(section.sx || 0) * 16;
  const oy = Math.trunc(section.sy || 0) * 16;
  const oz = Math.trunc(section.sz || 0) * 16;
  let written = 0;
  if (face === 0 || face === 1) {
    const x = face === 0 ? 16 : -1;
    for (let y=0;y<16;y+=1) for (let z=0;z<16;z+=1) { target[y*16+z] = Math.trunc(Number(getOutsideBlock(ox+x,oy+y,oz+z)) || 0); written+=1; }
  } else if (face === 2 || face === 3) {
    const y = face === 2 ? 16 : -1;
    for (let z=0;z<16;z+=1) for (let x=0;x<16;x+=1) { target[z*16+x] = Math.trunc(Number(getOutsideBlock(ox+x,oy+y,oz+z)) || 0); written+=1; }
  } else {
    const z = face === 4 ? 16 : -1;
    for (let y=0;y<16;y+=1) for (let x=0;x<16;x+=1) { target[y*16+x] = Math.trunc(Number(getOutsideBlock(ox+x,oy+y,oz+z)) || 0); written+=1; }
  }
  return written;
}
function normalizedColor(value) {
  if (!Array.isArray(value) && !(value instanceof Float32Array)) return [1,1,1];
  return [clamp01(value[0]), clamp01(value[1]), clamp01(value[2])];
}
function sameColor(a, b) { return Math.abs(a[0]-b[0]) < 1e-7 && Math.abs(a[1]-b[1]) < 1e-7 && Math.abs(a[2]-b[2]) < 1e-7; }
function prepareMaterialTable(section, getBlockColor) {
  const colorsPtr = nativeExports.rift_material_colors_ptr() >>> 0;
  const table = new Float32Array(nativeExports.memory.buffer, colorsPtr, 256 * 3);
  const used = new Map();
  for (let i=0;i<section.states.length;i+=1) {
    const packed = section.states[i]; if (!packed) continue;
    if ((packed & PARTIAL_SHAPE_MASK) !== 0) return false;
    const material = packed & 255;
    if (!used.has(material)) used.set(material, packed);
  }
  for (const [material, packed] of used) {
    let color = [1,1,1];
    if (typeof getBlockColor === 'function') {
      try {
        const origin = section.origin?.() || { x: (section.sx||0)*16, y:(section.sy||0)*16, z:(section.sz||0)*16 };
        const a = normalizedColor(getBlockColor({ state: packed, face: { id:'east', n:[1,0,0] }, worldX:origin.x, worldY:origin.y, worldZ:origin.z, localX:0, localY:0, localZ:0, section }));
        const b = normalizedColor(getBlockColor({ state: packed, face: { id:'north', n:[0,0,-1] }, worldX:origin.x+7, worldY:origin.y+3, worldZ:origin.z+11, localX:7, localY:3, localZ:11, section }));
        // A face/world-dependent material cannot be represented by the v3 256-entry
        // native palette without changing visuals, so preserve the JS geometry path.
        if (!sameColor(a,b)) return false;
        color = a;
      } catch (_) { return false; }
    }
    table[material*3] = color[0]; table[material*3+1] = color[1]; table[material*3+2] = color[2];
  }
  return true;
}

export function buildRiftNativeSectionMesh(section, {
  neighbors = null,
  getOutsideBlock = null,
  getBlockColor = null
} = {}) {
  if (!nativeExports || !(nativeExports.memory instanceof WebAssembly.Memory) || !section?.states) {
    bridgeMetrics.nativeMeshFallbacks += 1;
    return null;
  }
  const sync = syncRiftNativeSection(section, { worldId: 0 });
  if (!sync.native) { bridgeMetrics.nativeMeshFallbacks += 1; return null; }
  if (!prepareMaterialTable(section, getBlockColor)) { bridgeMetrics.nativeMeshFallbacks += 1; return null; }

  const borderPtr = nativeExports.rift_section_borders_ptr() >>> 0;
  const borders = new Uint16Array(nativeExports.memory.buffer, borderPtr, FACE_COUNT * BORDER_CELLS);
  borders.fill(0);
  for (let face=0; face<FACE_COUNT; face+=1) {
    const target = borders.subarray(face*BORDER_CELLS, (face+1)*BORDER_CELLS);
    const neighbor = Array.isArray(neighbors) ? neighbors[face] : null;
    const copied = neighbor ? copyNeighborBorder(target, face, neighbor) : fillOutsideBorder(target, face, section, getOutsideBlock);
    bridgeMetrics.borderCellsCopied += copied;
  }

  const started = nowMs();
  const faceCount = nativeExports.rift_build_section_mesh(sync.slot);
  const elapsed = Math.max(0, nowMs() - started);
  if (faceCount < 0) { bridgeMetrics.nativeMeshFallbacks += 1; return null; }
  const blocks = nativeExports.rift_mesh_block_count();
  const vertexCount = nativeExports.rift_mesh_vertex_count();
  const indexCount = nativeExports.rift_mesh_index_count();
  const vertexPtr = nativeExports.rift_mesh_vertices_ptr() >>> 0;
  const indexPtr = nativeExports.rift_mesh_indices_ptr() >>> 0;
  const vertices = new Float32Array(nativeExports.memory.buffer, vertexPtr, vertexCount * VERTEX_STRIDE).slice();
  const nativeIndices = new Uint32Array(nativeExports.memory.buffer, indexPtr, indexCount);
  const indices = vertexCount > 65535 ? nativeIndices.slice() : Uint16Array.from(nativeIndices);

  bridgeMetrics.nativeMeshBuilds += 1;
  bridgeMetrics.nativeMeshBuildMsTotal += elapsed;
  bridgeMetrics.nativeMeshBuildMsMax = Math.max(bridgeMetrics.nativeMeshBuildMsMax, elapsed);
  return {
    vertices,
    vertexStride: VERTEX_STRIDE,
    indices,
    blocks,
    visibleFaces: faceCount,
    culledFaces: blocks * 6 - faceCount,
    vertexCount,
    triangles: faceCount * 2,
    section: [section.sx, section.sy, section.sz],
    revision: section.revision,
    stateBytes: section.states.byteLength,
    visibilityLayers: [],
    nativeFaceCulling: true,
    nativeMesh: true,
    nativeResident: true,
    nativeSlot: sync.slot,
    nativeBuildMs: elapsed
  };
}

function worldLocation(value) {
  const cell = Math.floor(Number(value) || 0);
  const api = getRiftNativeCore();
  return { cell, section: api.rift_floor_div(cell,16), local: api.rift_positive_mod(cell,16) };
}

export function createRiftNativeGridAccelerator(getGrid) {
  const worldId = nextWorldId++;
  const ownedRecords = new Set();
  let currentGrid = null;
  function grid() {
    const next = typeof getGrid === 'function' ? getGrid() : getGrid;
    if (next !== currentGrid) {
      for (const record of ownedRecords) releaseSlot(record);
      ownedRecords.clear();
      currentGrid = next || null;
    }
    return currentGrid;
  }
  function syncSection(section) {
    const sync = syncRiftNativeSection(section, { worldId });
    if (sync.record) ownedRecords.add(sync.record);
    return sync;
  }
  function getBlockWorld(x, y, z) {
    const g = grid();
    const wx=Math.floor(Number(x)||0), wy=Math.floor(Number(y)||0), wz=Math.floor(Number(z)||0);
    if (!nativeExports || !g?.getSection) return g?.getBlockWorld?.(wx,wy,wz) || 0;
    const lx=worldLocation(wx), ly=worldLocation(wy), lz=worldLocation(wz);
    const section=g.getSection(lx.section,ly.section,lz.section);
    if (!section) return 0;
    const sync=syncSection(section); if (!sync.native) return g.getBlockWorld(wx,wy,wz) || 0;
    const index=(ly.local<<8)|(lz.local<<4)|lx.local;
    return nativeExports.rift_section_slot_get_state(sync.slot,index) >>> 0;
  }
  function syncAll() {
    const g=grid();
    if (!nativeExports || !g?.sections || g.sections.size > usableSlotCount) return false;
    const records=[];
    for (const section of g.sections.values()) {
      const sync=syncSection(section); if (!sync.native) return false;
      records.push(sync.record);
    }
    return records.every(record => record.slot >= 1 && slotOwners[record.slot] === record);
  }
  function batchGetBlockWorld(points = []) {
    const g=grid();
    if (!nativeExports || !g || points.length > (nativeExports.rift_batch_capacity?.() || 0)) {
      return Uint16Array.from(points, p => g?.getBlockWorld?.(Math.floor(p[0]),Math.floor(p[1]),Math.floor(p[2])) || 0);
    }
    const touched=new Set();
    for (const p of points) {
      const wx=Math.floor(Number(p?.[0])||0), wy=Math.floor(Number(p?.[1])||0), wz=Math.floor(Number(p?.[2])||0);
      const lx=worldLocation(wx), ly=worldLocation(wy), lz=worldLocation(wz);
      const section=g.getSection?.(lx.section,ly.section,lz.section);
      if (section) { const sync=syncSection(section); if (sync.record) touched.add(sync.record); }
    }
    if (touched.size > usableSlotCount || [...touched].some(record => record.slot < 1 || slotOwners[record.slot] !== record)) {
      return Uint16Array.from(points, p => g?.getBlockWorld?.(Math.floor(p[0]),Math.floor(p[1]),Math.floor(p[2])) || 0);
    }
    const xyzPtr=nativeExports.rift_batch_query_xyz_ptr()>>>0;
    const outPtr=nativeExports.rift_batch_query_states_ptr()>>>0;
    const xyz=new Int32Array(nativeExports.memory.buffer,xyzPtr,points.length*3);
    for (let i=0;i<points.length;i+=1) { xyz[i*3]=Math.floor(points[i]?.[0]||0);xyz[i*3+1]=Math.floor(points[i]?.[1]||0);xyz[i*3+2]=Math.floor(points[i]?.[2]||0); }
    nativeExports.rift_batch_query_world(worldId,points.length);
    bridgeMetrics.batchCalls+=1; bridgeMetrics.batchCells+=points.length;
    return new Uint16Array(nativeExports.memory.buffer,outPtr,points.length).slice();
  }
  function raycast(origin, direction, maxDistance = 120) {
    if (!syncAll()) { bridgeMetrics.raycastFallbacks += 1; return { native:false, hit:null }; }
    const ox=Number(origin?.[0])||0, oy=Number(origin?.[1])||0, oz=Number(origin?.[2])||0;
    let dx=Number(direction?.[0])||0, dy=Number(direction?.[1])||0, dz=Number(direction?.[2])||0;
    const length=Math.hypot(dx,dy,dz); if (!(length>0)) return { native:true, hit:null };
    dx/=length;dy/=length;dz/=length;
    const found=nativeExports.rift_raycast_world(worldId,ox,oy,oz,dx,dy,dz,Math.max(0,Number(maxDistance)||0));
    bridgeMetrics.raycasts+=1;
    if (!found) return { native:true, hit:null };
    const ptr=nativeExports.rift_raycast_hit_ptr()>>>0;
    const data=new Int32Array(nativeExports.memory.buffer,ptr,5);
    return { native:true, hit:[data[0],data[1],data[2]], face:data[3], state:data[4]>>>0, distance:nativeExports.rift_raycast_distance() };
  }
  function dispose() {
    for (const record of ownedRecords) releaseSlot(record);
    ownedRecords.clear(); currentGrid=null;
  }
  return Object.freeze({ worldId, getBlockWorld, batchGetBlockWorld, raycast, syncAll, dispose });
}

await initializeRiftWasmCore();

const publicBridge = Object.freeze({
  version: 'native-core-browser-v3',
  get exports() { return getRiftNativeCore(); },
  get status() { return getRiftNativeCoreStatus(); },
  initialize: initializeRiftWasmCore,
  buildSectionFaceMasks: buildRiftNativeSectionFaceMasks,
  buildSectionMesh: buildRiftNativeSectionMesh,
  createGridAccelerator: createRiftNativeGridAccelerator,
  resetMetrics: resetRiftNativeCoreMetrics
});
if (IS_BROWSER) window.RiftCityNativeCore = publicBridge;
