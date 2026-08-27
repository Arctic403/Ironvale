export const RIFT_BLOCK_FACE_DEFS = Object.freeze([
  Object.freeze({ id: 'east', label: 'EAST +X', d: [1, 0, 0], n: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] }),
  Object.freeze({ id: 'west', label: 'WEST -X', d: [-1, 0, 0], n: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] }),
  Object.freeze({ id: 'top', label: 'TOP +Y', d: [0, 1, 0], n: [0, 1, 0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] }),
  Object.freeze({ id: 'bottom', label: 'BOTTOM -Y', d: [0, -1, 0], n: [0, -1, 0], corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] }),
  Object.freeze({ id: 'south', label: 'SOUTH +Z', d: [0, 0, 1], n: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] }),
  Object.freeze({ id: 'north', label: 'NORTH -Z', d: [0, 0, -1], n: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] })
]);

function appendBlockFace(buffer, x, y, z, face) {
  const base = buffer.vertices.length / 6;
  for (const corner of face.corners) {
    buffer.vertices.push(x + corner[0], y + corner[1], z + corner[2], ...face.n);
  }
  buffer.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export function validateRiftBlockFaceWinding() {
  const failures = [];
  for (const face of RIFT_BLOCK_FACE_DEFS) {
    const a = face.corners[0];
    const b = face.corners[1];
    const c = face.corners[2];
    const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const cross = [
      ab[1]*ac[2] - ab[2]*ac[1],
      ab[2]*ac[0] - ab[0]*ac[2],
      ab[0]*ac[1] - ab[1]*ac[0]
    ];
    const dot = cross[0]*face.n[0] + cross[1]*face.n[1] + cross[2]*face.n[2];
    if (!(dot > 0)) failures.push(face.label);
  }
  return { ok: failures.length === 0, failures, faces: RIFT_BLOCK_FACE_DEFS.length };
}

export function createRiftBlockGeometry(x = 0, y = 0, z = 0) {
  const buffer = { vertices: [], indices: [] };
  for (const face of RIFT_BLOCK_FACE_DEFS) appendBlockFace(buffer, x, y, z, face);
  return {
    vertices: new Float32Array(buffer.vertices),
    indices: new Uint16Array(buffer.indices)
  };
}

export function createRiftBlockSetGeometry(cells = []) {
  const occupied = new Set();
  const normalized = [];

  for (const cell of cells || []) {
    const x = Math.trunc(Number(cell?.x) || 0);
    const y = Math.trunc(Number(cell?.y) || 0);
    const z = Math.trunc(Number(cell?.z) || 0);
    const key = key3(x, y, z);
    if (occupied.has(key)) continue;
    occupied.add(key);
    normalized.push({ x, y, z });
  }

  const buffer = { vertices: [], indices: [] };
  let visibleFaces = 0;
  for (const cell of normalized) {
    for (const face of RIFT_BLOCK_FACE_DEFS) {
      const neighborKey = key3(
        cell.x + face.d[0],
        cell.y + face.d[1],
        cell.z + face.d[2]
      );
      if (occupied.has(neighborKey)) continue;
      appendBlockFace(buffer, cell.x, cell.y, cell.z, face);
      visibleFaces += 1;
    }
  }

  const IndexArray = buffer.vertices.length / 6 > 65535 ? Uint32Array : Uint16Array;
  return {
    vertices: new Float32Array(buffer.vertices),
    indices: new IndexArray(buffer.indices),
    blocks: normalized.length,
    visibleFaces,
    triangles: visibleFaces * 2,
    vertexCount: visibleFaces * 4
  };
}

const DEFAULT_MATERIALS = Object.freeze({
  ground: Object.freeze({ id: 'ground', label: 'Ground', color: '#425044', noise: 0.045 }),
  road: Object.freeze({ id: 'road', label: 'Road', color: '#25292d', noise: 0.02 }),
  'road-yellow': Object.freeze({ id: 'road-yellow', label: 'Road Yellow', color: '#d6a92f', noise: 0.012 }),
  'road-white': Object.freeze({ id: 'road-white', label: 'Road White', color: '#d8dbd7', noise: 0.008 }),
  sidewalk: Object.freeze({ id: 'sidewalk', label: 'Sidewalk', color: '#777a77', noise: 0.028 }),
  brick: Object.freeze({ id: 'brick', label: 'Brick', color: '#74463d', noise: 0.032 }),
  concrete: Object.freeze({ id: 'concrete', label: 'Concrete', color: '#858984', noise: 0.022 }),
  glass: Object.freeze({ id: 'glass', label: 'Glass', color: '#5f8794', noise: 0.018 }),
  darkglass: Object.freeze({ id: 'darkglass', label: 'Dark Glass', color: '#344c57', noise: 0.012 }),
  roof: Object.freeze({ id: 'roof', label: 'Roof', color: '#3c4142', noise: 0.025 }),
  trim: Object.freeze({ id: 'trim', label: 'Trim', color: '#b5b1a5', noise: 0.01 }),
  asphalt: Object.freeze({ id: 'asphalt', label: 'Parking / Asphalt', color: '#34393c', noise: 0.024 }),
  grass: Object.freeze({ id: 'grass', label: 'Grass', color: '#496447', noise: 0.05 })
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function key3(x, y, z) {
  return `${x}|${y}|${z}`;
}

function chunkKey(cx, cz) {
  return `${cx}|${cz}`;
}

function parseChunkKey(key) {
  const [cx, cz] = String(key).split('|').map(Number);
  return { cx, cz };
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function normalizeMaterialMap(materials = {}) {
  const result = {};
  for (const [id, source] of Object.entries({ ...DEFAULT_MATERIALS, ...materials })) {
    result[id] = Object.freeze({
      id,
      label: source?.label || id,
      color: source?.color || '#ffffff',
      noise: Number(source?.noise) || 0
    });
  }
  return Object.freeze(result);
}

function normalizeSnapshot(raw) {
  if (!raw || raw.format !== 'riftcity-block-world') throw new Error('Invalid RiftCity block-world snapshot.');
  if (Number(raw.version) !== 1) throw new Error('Unsupported RiftCity block-world version.');
  const blockSize = Number(raw.blockSize);
  if (blockSize !== 1) throw new Error('RiftCity block world requires 1 meter blocks.');
  const chunkSize = clampInt(raw.chunkSize || 32, 8, 64);
  const bounds = {
    minX: Math.trunc(raw.bounds?.minX ?? -128),
    maxX: Math.trunc(raw.bounds?.maxX ?? 127),
    minY: Math.trunc(raw.bounds?.minY ?? -1),
    maxY: Math.trunc(raw.bounds?.maxY ?? 47),
    minZ: Math.trunc(raw.bounds?.minZ ?? -128),
    maxZ: Math.trunc(raw.bounds?.maxZ ?? 127)
  };
  if (bounds.maxX < bounds.minX || bounds.maxY < bounds.minY || bounds.maxZ < bounds.minZ) {
    throw new Error('Block-world bounds are invalid.');
  }
  const base = {
    y: Math.trunc(raw.base?.y ?? -1),
    material: String(raw.base?.material || 'ground')
  };
  const materials = normalizeMaterialMap(raw.materials || {});
  if (!materials[base.material]) throw new Error(`Unknown base material: ${base.material}`);
  const blocks = [];
  for (const entry of Array.isArray(raw.blocks) ? raw.blocks : []) {
    if (!Array.isArray(entry) || entry.length < 4) continue;
    const x = Math.trunc(entry[0]);
    const y = Math.trunc(entry[1]);
    const z = Math.trunc(entry[2]);
    const material = String(entry[3]);
    if (!materials[material]) continue;
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY || z < bounds.minZ || z > bounds.maxZ) continue;
    if (y === base.y && material === base.material) continue;
    blocks.push([x, y, z, material]);
  }
  return {
    format: 'riftcity-block-world',
    version: 1,
    id: String(raw.id || 'riftcity-block-world'),
    district: String(raw.district || 'world'),
    units: 'meters',
    blockSize: 1,
    chunkSize,
    bounds,
    base,
    materials,
    blocks
  };
}

function pointSquareDistance(x, z, minX, minZ, maxX, maxZ) {
  const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
  const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
  return Math.hypot(dx, dz);
}

export class RiftBlockWorld {
  constructor(engine, source, options = {}) {
    if (!engine) throw new Error('RiftBlockWorld requires a Rift Engine instance.');
    this.engine = engine;
    this.source = normalizeSnapshot(source);
    this.data = clone(this.source);
    this.data.materials = this.source.materials;
    this.materials = this.source.materials;
    this.blockSize = 1;
    this.chunkSize = this.source.chunkSize;
    this.renderRadiusChunks = clampInt(options.renderRadiusChunks ?? 2, 1, 5);
    this.overrides = new Map();
    this.chunkOverrides = new Map();
    this.loadedChunks = new Map();
    this.dirtyChunks = new Set();
    this.lastCenter = null;
    this.applySnapshot(this.source, false);
  }

  material(id) {
    return this.materials[id] || null;
  }

  materialList() {
    return Object.values(this.materials);
  }

  inBounds(x, y, z) {
    const b = this.data.bounds;
    return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ;
  }

  chunkCoords(x, z) {
    return {
      cx: Math.floor(x / this.chunkSize),
      cz: Math.floor(z / this.chunkSize)
    };
  }

  getBlock(x, y, z) {
    x = Math.trunc(x); y = Math.trunc(y); z = Math.trunc(z);
    if (!this.inBounds(x, y, z)) return null;
    const direct = this.overrides.get(key3(x, y, z));
    if (direct) return direct.material;
    if (y === this.data.base.y) return this.data.base.material;
    return null;
  }

  setBlock(x, y, z, material) {
    x = Math.trunc(x); y = Math.trunc(y); z = Math.trunc(z);
    if (!this.inBounds(x, y, z)) return false;
    material = material == null ? null : String(material);
    if (material && !this.materials[material]) return false;
    const key = key3(x, y, z);
    const current = this.getBlock(x, y, z);
    const target = material || (y === this.data.base.y ? this.data.base.material : null);
    if (current === target) return false;

    const chunk = this.chunkCoords(x, z);
    const ckey = chunkKey(chunk.cx, chunk.cz);
    const entries = this.chunkOverrides.get(ckey) || new Set();

    if (target == null || (y === this.data.base.y && target === this.data.base.material)) {
      this.overrides.delete(key);
      entries.delete(key);
    } else {
      this.overrides.set(key, { x, y, z, material: target });
      entries.add(key);
    }
    if (entries.size) this.chunkOverrides.set(ckey, entries);
    else this.chunkOverrides.delete(ckey);
    this.markDirtyAround(x, z);
    return true;
  }

  eraseBlock(x, y, z) {
    return this.setBlock(x, y, z, null);
  }

  setMany(cells, material) {
    let changed = 0;
    for (const cell of cells || []) {
      if (this.setBlock(cell.x, cell.y, cell.z, material)) changed += 1;
    }
    return changed;
  }

  fillRect(x0, z0, x1, z1, y, material) {
    const b = this.data.bounds;
    const minX = clampInt(Math.min(x0, x1), b.minX, b.maxX);
    const maxX = clampInt(Math.max(x0, x1), b.minX, b.maxX);
    const minZ = clampInt(Math.min(z0, z1), b.minZ, b.maxZ);
    const maxZ = clampInt(Math.max(z0, z1), b.minZ, b.maxZ);
    let changed = 0;
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.setBlock(x, y, z, material)) changed += 1;
      }
    }
    return changed;
  }

  fillBox(x0, y0, z0, x1, y1, z1, material) {
    const b = this.data.bounds;
    const minX = clampInt(Math.min(x0, x1), b.minX, b.maxX);
    const maxX = clampInt(Math.max(x0, x1), b.minX, b.maxX);
    const minY = clampInt(Math.min(y0, y1), b.minY, b.maxY);
    const maxY = clampInt(Math.max(y0, y1), b.minY, b.maxY);
    const minZ = clampInt(Math.min(z0, z1), b.minZ, b.maxZ);
    const maxZ = clampInt(Math.max(z0, z1), b.minZ, b.maxZ);
    let changed = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.setBlock(x, y, z, material)) changed += 1;
        }
      }
    }
    return changed;
  }

  markDirtyAround(x, z) {
    const { cx, cz } = this.chunkCoords(x, z);
    this.dirtyChunks.add(chunkKey(cx, cz));
    const localX = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const localZ = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;
    if (localX === 0) this.dirtyChunks.add(chunkKey(cx - 1, cz));
    if (localX === this.chunkSize - 1) this.dirtyChunks.add(chunkKey(cx + 1, cz));
    if (localZ === 0) this.dirtyChunks.add(chunkKey(cx, cz - 1));
    if (localZ === this.chunkSize - 1) this.dirtyChunks.add(chunkKey(cx, cz + 1));
  }

  applySnapshot(raw, rebuild = true) {
    const next = normalizeSnapshot(raw);
    this.data = clone(next);
    this.data.materials = next.materials;
    this.materials = next.materials;
    this.chunkSize = next.chunkSize;
    this.overrides.clear();
    this.chunkOverrides.clear();
    for (const [x, y, z, material] of next.blocks) {
      const key = key3(x, y, z);
      this.overrides.set(key, { x, y, z, material });
      const { cx, cz } = this.chunkCoords(x, z);
      const ckey = chunkKey(cx, cz);
      if (!this.chunkOverrides.has(ckey)) this.chunkOverrides.set(ckey, new Set());
      this.chunkOverrides.get(ckey).add(key);
    }
    if (rebuild) {
      this.clearLoadedChunks();
      this.dirtyChunks.clear();
      this.lastCenter = null;
    }
  }

  replace(raw) {
    const center = this.lastCenter ? { ...this.lastCenter } : null;
    this.applySnapshot(raw, true);
    if (center) this.setViewCenter(center.x, center.z, center.radius);
  }

  resetToSource() {
    const center = this.lastCenter ? { ...this.lastCenter } : null;
    this.applySnapshot(this.source, true);
    if (center) this.setViewCenter(center.x, center.z, center.radius);
  }

  snapshot() {
    const blocks = [...this.overrides.values()]
      .sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x || a.material.localeCompare(b.material))
      .map(block => [block.x, block.y, block.z, block.material]);
    return {
      format: 'riftcity-block-world',
      version: 1,
      id: this.data.id,
      district: this.data.district,
      units: 'meters',
      blockSize: 1,
      chunkSize: this.chunkSize,
      bounds: clone(this.data.bounds),
      base: clone(this.data.base),
      materials: Object.fromEntries(Object.entries(this.materials).map(([id, material]) => [id, clone(material)])),
      blocks
    };
  }

  stats() {
    const b = this.data.bounds;
    const baseBlocks = (b.maxX - b.minX + 1) * (b.maxZ - b.minZ + 1);
    let aboveGround = 0;
    let surfaceOverrides = 0;
    for (const block of this.overrides.values()) {
      if (block.y === this.data.base.y) surfaceOverrides += 1;
      else aboveGround += 1;
    }
    return {
      logicalBlocks: baseBlocks + aboveGround,
      editedSurfaceBlocks: surfaceOverrides,
      structureBlocks: aboveGround,
      loadedChunks: this.loadedChunks.size,
      overrides: this.overrides.size,
      chunkSize: this.chunkSize
    };
  }

  isSolidAt(x, y, z) {
    return !!this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  canOccupyCircle(x, z, radius = 0.34, height = 1.75) {
    const b = this.data.bounds;
    if (x - radius < b.minX || x + radius > b.maxX + 1 || z - radius < b.minZ || z + radius > b.maxZ + 1) return false;
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minZ = Math.floor(z - radius);
    const maxZ = Math.floor(z + radius);
    const maxY = Math.max(0, Math.ceil(height) - 1);
    for (let bz = minZ; bz <= maxZ; bz++) {
      for (let bx = minX; bx <= maxX; bx++) {
        if (pointSquareDistance(x, z, bx, bz, bx + 1, bz + 1) > radius) continue;
        for (let by = 0; by <= maxY; by++) {
          if (this.getBlock(bx, by, bz)) return false;
        }
      }
    }
    return true;
  }

  setViewCenter(x, z, radiusChunks = this.renderRadiusChunks) {
    const { cx, cz } = this.chunkCoords(Math.floor(x), Math.floor(z));
    const radius = clampInt(radiusChunks, 1, 5);
    this.lastCenter = { x, z, radius };
    const desired = new Set();
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const ckey = chunkKey(cx + dx, cz + dz);
        if (this.chunkIntersectsWorld(cx + dx, cz + dz)) desired.add(ckey);
      }
    }

    for (const [ckey, chunk] of [...this.loadedChunks.entries()]) {
      if (desired.has(ckey)) continue;
      this.engine.removeDrawables(chunk.drawables);
      this.loadedChunks.delete(ckey);
    }

    for (const ckey of desired) {
      if (!this.loadedChunks.has(ckey) || this.dirtyChunks.has(ckey)) {
        const { cx: buildX, cz: buildZ } = parseChunkKey(ckey);
        this.rebuildChunk(buildX, buildZ);
      }
    }
    for (const ckey of desired) this.dirtyChunks.delete(ckey);
  }

  chunkIntersectsWorld(cx, cz) {
    const b = this.data.bounds;
    const minX = cx * this.chunkSize;
    const minZ = cz * this.chunkSize;
    const maxX = minX + this.chunkSize - 1;
    const maxZ = minZ + this.chunkSize - 1;
    return maxX >= b.minX && minX <= b.maxX && maxZ >= b.minZ && minZ <= b.maxZ;
  }

  rebuildDirtyLoaded() {
    for (const ckey of [...this.dirtyChunks]) {
      if (!this.loadedChunks.has(ckey)) continue;
      const { cx, cz } = parseChunkKey(ckey);
      this.rebuildChunk(cx, cz);
      this.dirtyChunks.delete(ckey);
    }
  }

  rebuildChunk(cx, cz) {
    const ckey = chunkKey(cx, cz);
    const old = this.loadedChunks.get(ckey);
    if (old) this.engine.removeDrawables(old.drawables);
    const buffers = this.buildChunkGeometry(cx, cz);
    const drawables = [];
    for (const [materialId, buffer] of buffers) {
      if (!buffer.indices.length) continue;
      const material = this.materials[materialId];
      drawables.push(this.engine.addMesh({ vertices: buffer.vertices, indices: buffer.indices }, {
        color: material.color,
        noise: material.noise,
        blockGrid: 1
      }));
    }
    this.loadedChunks.set(ckey, { cx, cz, drawables });
  }

  buildChunkGeometry(cx, cz) {
    const b = this.data.bounds;
    const startX = Math.max(b.minX, cx * this.chunkSize);
    const endX = Math.min(b.maxX, cx * this.chunkSize + this.chunkSize - 1);
    const startZ = Math.max(b.minZ, cz * this.chunkSize);
    const endZ = Math.min(b.maxZ, cz * this.chunkSize + this.chunkSize - 1);
    const cells = [];

    // Every in-bounds X/Z has the implicit one-meter foundation block at base.y.
    for (let z = startZ; z <= endZ; z++) {
      for (let x = startX; x <= endX; x++) {
        const material = this.getBlock(x, this.data.base.y, z);
        if (material) cells.push({ x, y: this.data.base.y, z, material });
      }
    }

    const ckey = chunkKey(cx, cz);
    for (const blockKey of this.chunkOverrides.get(ckey) || []) {
      const block = this.overrides.get(blockKey);
      if (!block || block.y === this.data.base.y) continue;
      cells.push(block);
    }

    const buffers = new Map();
    const getBuffer = material => {
      if (!buffers.has(material)) buffers.set(material, { vertices: [], indices: [] });
      return buffers.get(material);
    };

    for (const cell of cells) {
      for (const face of RIFT_BLOCK_FACE_DEFS) {
        if (cell.y === this.data.base.y && face.d[1] < 0) continue;
        const neighbor = this.getBlock(cell.x + face.d[0], cell.y + face.d[1], cell.z + face.d[2]);
        if (neighbor) continue;
        const buffer = getBuffer(cell.material);
        appendBlockFace(buffer, cell.x, cell.y, cell.z, face);
      }
    }
    return buffers;
  }

  clearLoadedChunks() {
    for (const chunk of this.loadedChunks.values()) this.engine.removeDrawables(chunk.drawables);
    this.loadedChunks.clear();
  }

  dispose() {
    this.clearLoadedChunks();
    this.overrides.clear();
    this.chunkOverrides.clear();
    this.dirtyChunks.clear();
  }
}

export function rasterizeBlockLine(a, b, y) {
  const x0 = Math.trunc(a.x), z0 = Math.trunc(a.z);
  const x1 = Math.trunc(b.x), z1 = Math.trunc(b.z);
  const dx = Math.abs(x1 - x0);
  const dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  let x = x0;
  let z = z0;
  const cells = [];
  while (true) {
    cells.push({ x, y, z });
    if (x === x1 && z === z1) break;
    const e2 = err * 2;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
  }
  return cells;
}

export function rectangleCells(a, b, y, limit = 4096) {
  const minX = Math.min(Math.trunc(a.x), Math.trunc(b.x));
  const maxX = Math.max(Math.trunc(a.x), Math.trunc(b.x));
  const minZ = Math.min(Math.trunc(a.z), Math.trunc(b.z));
  const maxZ = Math.max(Math.trunc(a.z), Math.trunc(b.z));
  const cells = [];
  for (let z = minZ; z <= maxZ && cells.length < limit; z++) {
    for (let x = minX; x <= maxX && cells.length < limit; x++) cells.push({ x, y, z });
  }
  return cells;
}
