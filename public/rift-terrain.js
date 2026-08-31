import { RiftCore } from './rift-core.js';

const EPSILON = 1e-6;
const DEFAULT_CHUNK_SIZE = 32;
const DEFAULT_SAMPLE_SPACING = 1;
const DEFAULT_MAX_WALK_SLOPE = 0.78;
const NATIVE = RiftCore.exports;
const MEMORY = RiftCore.memory;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function normalize3(x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}
function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function distanceToSegment2(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const denom = abx * abx + abz * abz;
  const t = denom > EPSILON ? clamp(((px - ax) * abx + (pz - az) * abz) / denom, 0, 1) : 0;
  const x = lerp(ax, bx, t), z = lerp(az, bz, t);
  return { distance: Math.hypot(px - x, pz - z), t, x, z };
}
function distanceToSegment3(px, py, pz, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const denom = abx * abx + aby * aby + abz * abz;
  const t = denom > EPSILON ? clamp(((px - a.x) * abx + (py - a.y) * aby + (pz - a.z) * abz) / denom, 0, 1) : 0;
  const x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t), z = lerp(a.z, b.z, t);
  return { distance: Math.hypot(px - x, py - y, pz - z), t, x, y, z };
}

function assertNative(ok, message) {
  if (!ok) throw new Error(message);
}

export function validateRiftTerrainConfig(config) {
  const failures = [];
  if (!config || config.format !== 'rift-terrain-v1') failures.push('terrain format must be rift-terrain-v1');
  const size = config?.size || [0, 0];
  if (!(Number(size[0]) > 0 && Number(size[1]) > 0)) failures.push('terrain size must be positive');
  const spacing = Number(config?.sampleSpacing ?? DEFAULT_SAMPLE_SPACING);
  if (!(spacing > 0 && spacing <= 4)) failures.push('sampleSpacing must be > 0 and <= 4 meters');
  const chunkSize = Number(config?.chunkSize ?? DEFAULT_CHUNK_SIZE);
  if (!(chunkSize >= spacing * 4 && chunkSize <= 128)) failures.push('chunkSize must contain at least 4 samples and be <= 128 meters');
  const columns = Math.round(Number(size[0]) / spacing) + 1;
  const rows = Math.round(Number(size[1]) / spacing) + 1;
  if (columns > 1025 || rows > 1025) failures.push('native RiftCore currently supports up to 1025 samples per terrain axis');
  return { ok: failures.length === 0, failures };
}

export class RiftTerrain {
  constructor(config) {
    const validation = validateRiftTerrainConfig(config);
    if (!validation.ok) throw new Error(`Invalid Rift Terrain: ${validation.failures.join('; ')}`);
    this.config = typeof structuredClone === 'function' ? structuredClone(config) : JSON.parse(JSON.stringify(config));
    this.origin = [Number(config.origin?.[0]) || 0, Number(config.origin?.[1]) || 0, Number(config.origin?.[2]) || 0];
    this.width = Number(config.size[0]);
    this.depth = Number(config.size[1]);
    this.sampleSpacing = Number(config.sampleSpacing ?? DEFAULT_SAMPLE_SPACING);
    this.chunkSize = Number(config.chunkSize ?? DEFAULT_CHUNK_SIZE);
    this.seed = Math.trunc(Number(config.seed) || 1337);
    this.baseHeight = Number(config.baseHeight) || 0;
    this.maxWalkSlope = clamp(Number(config.maxWalkSlope) || DEFAULT_MAX_WALK_SLOPE, 0.25, 2.5);
    this.columns = Math.round(this.width / this.sampleSpacing) + 1;
    this.rows = Math.round(this.depth / this.sampleSpacing) + 1;
    this.layers = Array.isArray(config.layers) ? config.layers : [];
    this.holes = Array.isArray(config.holes) ? config.holes : [];
    this.caves = Array.isArray(config.caves) ? config.caves : [];
    this.revision = 1;

    assertNative(
      NATIVE.rift_terrain_init(
        this.columns,
        this.rows,
        this.sampleSpacing,
        this.origin[0],
        this.origin[2],
        this.baseHeight,
        this.maxWalkSlope
      ),
      'RiftCore rejected the terrain configuration.'
    );
    this._bindNativeViews();

    if (this.layers.length) {
      console.warn('RiftCore: procedural terrain layers are ignored by the native blank-canvas runtime. Author terrain with edit layers instead.');
    }
    this._caveCache = this.caves.map((cave, index) => this._normalizeCave(cave, index));
  }

  _bindNativeViews() {
    const samples = NATIVE.rift_terrain_sample_count();
    const cells = NATIVE.rift_terrain_cell_count();
    this.heights = new Float32Array(MEMORY.buffer, NATIVE.rift_terrain_heights_ptr(), samples);
    this.manualDelta = new Float32Array(MEMORY.buffer, NATIVE.rift_terrain_delta_ptr(), samples);
    this.manualHoles = new Uint8Array(MEMORY.buffer, NATIVE.rift_terrain_holes_ptr(), cells);
  }

  _heightIndex(ix, iz) { return iz * this.columns + ix; }
  _cellIndex(ix, iz) { return iz * (this.columns - 1) + ix; }
  _worldX(ix) { return this.origin[0] + ix * this.sampleSpacing; }
  _worldZ(iz) { return this.origin[2] + iz * this.sampleSpacing; }

  containsXZ(x, z) {
    return x >= this.origin[0] && z >= this.origin[2] && x <= this.origin[0] + this.width && z <= this.origin[2] + this.depth;
  }

  sampleHeight(x, z) {
    if (!this.containsXZ(x, z)) return null;
    const value = NATIVE.rift_terrain_sample_height(Number(x), Number(z));
    return value > 1e20 ? null : value;
  }

  sampleNormal(x, z) {
    if (!NATIVE.rift_terrain_sample_normal(Number(x), Number(z))) return [0, 1, 0];
    const view = new Float32Array(MEMORY.buffer, NATIVE.rift_terrain_normal_ptr(), 3);
    return [view[0], view[1], view[2]];
  }

  slopeAt(x, z) {
    const value = NATIVE.rift_terrain_slope_at(Number(x), Number(z));
    return value > 1e20 ? Infinity : value;
  }

  walkableAt(x, z) { return Boolean(NATIVE.rift_terrain_walkable_at(Number(x), Number(z))); }

  isHoleAt(x, z) {
    if (!this.containsXZ(x, z)) return false;
    if (NATIVE.rift_terrain_is_manual_hole_at(Number(x), Number(z))) return true;
    for (const hole of this.holes) {
      if (hole?.enabled === false) continue;
      const radius = Math.max(0.001, Number(hole.radius) || 3);
      if (Math.hypot(x - (Number(hole.x) || 0), z - (Number(hole.z) || 0)) <= radius) return true;
    }
    for (const cave of this._caveCache || []) {
      const entrance = cave.entrance;
      if (entrance && Math.hypot(x - entrance.x, z - entrance.z) <= entrance.holeRadius) return true;
    }
    return false;
  }

  _normalizeCave(cave, index) {
    const radiusDefault = Math.max(1, Number(cave?.radius) || 4.5);
    const sourcePoints = Array.isArray(cave?.points) ? cave.points : [];
    const points = sourcePoints.map((point, pointIndex) => {
      const x = Number(point.x ?? point[0]) || 0;
      const z = Number(point.z ?? point[2] ?? point[1]) || 0;
      const radius = Math.max(0.75, Number(point.radius) || radiusDefault);
      let y;
      if (Number.isFinite(Number(point.y))) y = Number(point.y);
      else {
        const surface = this.sampleHeight(x, z) ?? this.baseHeight;
        const depth = Number(point.depth ?? point.surfaceDepth ?? (pointIndex === 0 ? radius * 0.45 : radius * 1.25));
        y = surface - depth;
      }
      return { x, y, z, radius };
    });
    return {
      id: String(cave?.id || `cave-${index + 1}`),
      points,
      sides: clamp(Math.trunc(Number(cave?.sides) || 18), 8, 32),
      color: Array.isArray(cave?.color) ? cave.color.slice(0, 3).map(Number) : [0.33, 0.31, 0.28],
      entrance: points.length ? {
        x: points[0].x,
        z: points[0].z,
        holeRadius: Math.max(1, Number(cave?.entranceRadius) || points[0].radius * 0.9)
      } : null
    };
  }

  _nearestCaveXZ(x, z) {
    let best = null;
    for (const cave of this._caveCache) {
      for (let i = 0; i < cave.points.length - 1; i += 1) {
        const a = cave.points[i], b = cave.points[i + 1];
        const hit = distanceToSegment2(x, z, a.x, a.z, b.x, b.z);
        const radius = lerp(a.radius, b.radius, hit.t);
        if (hit.distance > radius) continue;
        const y = lerp(a.y, b.y, hit.t);
        if (!best || hit.distance < best.distance) best = { cave, segment: i, ...hit, y, radius };
      }
    }
    return best;
  }

  isCaveVoidPoint(x, y, z) {
    for (const cave of this._caveCache) {
      for (let i = 0; i < cave.points.length - 1; i += 1) {
        const a = cave.points[i], b = cave.points[i + 1];
        const hit = distanceToSegment3(x, y, z, a, b);
        const radius = lerp(a.radius, b.radius, hit.t);
        if (hit.distance <= radius) return true;
      }
    }
    return false;
  }

  isSolidPoint(x, y, z) {
    const height = this.sampleHeight(x, z);
    if (height == null || y > height + 0.002) return false;
    return !this.isCaveVoidPoint(x, y, z);
  }

  supportCandidatesAt(x, z, aroundY, options = {}) {
    if (!this.containsXZ(x, z)) return [];
    const maxRise = Math.max(0, Number(options.maxRise ?? 0.6));
    const maxDrop = Math.max(0, Number(options.maxDrop ?? 4));
    const upper = aroundY + maxRise;
    const lower = aroundY - maxDrop;
    const values = [];
    const surface = this.sampleHeight(x, z);
    if (surface != null && !this.isHoleAt(x, z) && surface <= upper + 0.002 && surface >= lower - 0.002) values.push(surface);
    const caveHit = this._nearestCaveXZ(x, z);
    if (caveHit) {
      const half = Math.sqrt(Math.max(0, caveHit.radius * caveHit.radius - caveHit.distance * caveHit.distance));
      const floor = caveHit.y - half;
      if (floor <= upper + 0.002 && floor >= lower - 0.002) values.push(floor);
    }
    values.sort((a, b) => b - a);
    return values.filter((value, index) => index === 0 || Math.abs(value - values[index - 1]) > 0.002);
  }

  supportAtPoint(x, z, aroundY, options = {}) {
    return this.supportCandidatesAt(x, z, aroundY, options)[0] ?? null;
  }

  applyBrush(brush = {}) {
    const modes = { raise: 0, lower: 1, flatten: 2, smooth: 3, hole: 4, unhole: 5 };
    const modeName = String(brush.mode || 'raise').toLowerCase();
    const mode = modes[modeName];
    if (mode == null) return;
    const x = Number(brush.x) || 0;
    const z = Number(brush.z) || 0;
    const radius = Math.max(this.sampleSpacing, Number(brush.radius) || 6);
    const strength = Number(brush.strength) || 1;
    const target = Number.isFinite(Number(brush.targetHeight)) ? Number(brush.targetHeight) : 0;
    assertNative(NATIVE.rift_terrain_apply_brush(mode, x, z, radius, strength, target), 'RiftCore brush failed.');
    this._caveCache = this.caves.map((cave, index) => this._normalizeCave(cave, index));
    this.revision += 1;
  }

  rebuildFromManualDelta() {
    NATIVE.rift_terrain_rebuild_from_delta();
    this._caveCache = this.caves.map((cave, index) => this._normalizeCave(cave, index));
    this.revision += 1;
  }

  raycast(origin, direction, maxDistance = 1800, step = 1) {
    const dx = Number(direction?.[0]) || 0;
    const dy = Number(direction?.[1]) || 0;
    const dz = Number(direction?.[2]) || 0;
    const hit = NATIVE.rift_terrain_raycast(
      Number(origin?.[0]) || 0,
      Number(origin?.[1]) || 0,
      Number(origin?.[2]) || 0,
      dx, dy, dz,
      Math.max(0.1, Number(maxDistance) || 1800),
      Math.max(0.05, Number(step) || 1)
    );
    if (!hit) return null;
    const view = new Float32Array(MEMORY.buffer, NATIVE.rift_raycast_ptr(), 4);
    return { x: view[0], y: view[1], z: view[2], distance: view[3] };
  }

  buildSurfaceChunkGeometry(chunkX, chunkZ, lod = 1) {
    const step = Math.max(1, Math.trunc(lod));
    assertNative(
      NATIVE.rift_terrain_build_chunk(Math.trunc(chunkX), Math.trunc(chunkZ), this.chunkSize, step),
      `RiftCore could not build terrain chunk ${chunkX}:${chunkZ}.`
    );
    const vertexFloatCount = NATIVE.rift_mesh_vertex_float_count();
    const indexCount = NATIVE.rift_mesh_index_count();
    const vertexView = new Float32Array(MEMORY.buffer, NATIVE.rift_mesh_vertices_ptr(), vertexFloatCount);
    const indexView = new Uint32Array(MEMORY.buffer, NATIVE.rift_mesh_indices_ptr(), indexCount);
    const vertices = new Float32Array(vertexView);
    const vertexCount = vertices.length / 9;
    const indices = vertexCount > 65535 ? new Uint32Array(indexView) : Uint16Array.from(indexView);
    return {
      id: `terrain-${chunkX}-${chunkZ}`,
      chunkX,
      chunkZ,
      lod: step,
      geometry: { vertices, indices, vertexStride: 9 },
      triangles: indices.length / 3
    };
  }

  buildSurfaceGeometries(lod = 1) {
    const chunksX = Math.ceil(this.width / this.chunkSize);
    const chunksZ = Math.ceil(this.depth / this.chunkSize);
    const result = [];
    for (let cz = 0; cz < chunksZ; cz += 1) {
      for (let cx = 0; cx < chunksX; cx += 1) result.push(this.buildSurfaceChunkGeometry(cx, cz, lod));
    }
    return result;
  }

  buildCaveGeometry(caveIndex = 0) {
    const cave = this._caveCache[caveIndex];
    if (!cave || cave.points.length < 2) return null;
    const sides = cave.sides;
    const vertices = new Float32Array(cave.points.length * sides * 9);
    const indices = [];
    for (let i = 0; i < cave.points.length; i += 1) {
      const point = cave.points[i];
      const prev = cave.points[Math.max(0, i - 1)], next = cave.points[Math.min(cave.points.length - 1, i + 1)];
      const tangent = normalize3(next.x - prev.x, next.y - prev.y, next.z - prev.z);
      let side = cross3([0, 1, 0], tangent);
      if (Math.hypot(...side) < 0.01) side = [1, 0, 0];
      side = normalize3(...side);
      const binormal = normalize3(...cross3(tangent, side));
      for (let s = 0; s < sides; s += 1) {
        const angle = s / sides * Math.PI * 2;
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const rx = side[0] * ca + binormal[0] * sa;
        const ry = side[1] * ca + binormal[1] * sa;
        const rz = side[2] * ca + binormal[2] * sa;
        const offset = (i * sides + s) * 9;
        vertices[offset] = point.x + rx * point.radius;
        vertices[offset + 1] = point.y + ry * point.radius;
        vertices[offset + 2] = point.z + rz * point.radius;
        vertices[offset + 3] = -rx; vertices[offset + 4] = -ry; vertices[offset + 5] = -rz;
        vertices[offset + 6] = cave.color[0]; vertices[offset + 7] = cave.color[1]; vertices[offset + 8] = cave.color[2];
      }
    }
    for (let i = 0; i < cave.points.length - 1; i += 1) {
      for (let s = 0; s < sides; s += 1) {
        const n = (s + 1) % sides;
        const a = i * sides + s, b = i * sides + n, c = (i + 1) * sides + s, d = (i + 1) * sides + n;
        indices.push(a, b, d, a, d, c);
      }
    }
    return {
      id: cave.id,
      geometry: {
        vertices,
        indices: vertices.length / 9 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
        vertexStride: 9
      },
      triangles: indices.length / 3
    };
  }

  buildCaveGeometries() {
    const result = [];
    for (let i = 0; i < this._caveCache.length; i += 1) {
      const mesh = this.buildCaveGeometry(i);
      if (mesh) result.push(mesh);
    }
    return result;
  }

  getStats() {
    const surfaceChunks = Math.ceil(this.width / this.chunkSize) * Math.ceil(this.depth / this.chunkSize);
    return {
      format: 'rift-terrain-v1',
      engine: 'rift-core-wasm',
      nativeAbi: RiftCore.abi,
      width: this.width,
      depth: this.depth,
      sampleSpacing: this.sampleSpacing,
      samples: this.columns * this.rows,
      chunkSize: this.chunkSize,
      surfaceChunks,
      caves: this._caveCache.length,
      layers: this.layers.length,
      revision: this.revision
    };
  }
}

export function createRiftTerrain(config) { return new RiftTerrain(config); }
export function createRiftTerrainFromDocument(document) {
  return document?.terrain?.format === 'rift-terrain-v1' ? new RiftTerrain(document.terrain) : null;
}
