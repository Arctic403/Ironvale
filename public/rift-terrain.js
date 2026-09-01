import { RiftCore } from './rift-core.js';

const EPSILON = 1e-6;
const DEFAULT_SECTION_SIZE = 64;
const DEFAULT_COMPONENT_SIZE = 128;
const DEFAULT_SAMPLE_SPACING = 1;
const DEFAULT_MAX_WALK_SLOPE = 0.78;
const DEFAULT_LOD_STEPS = Object.freeze([1, 2, 4, 8, 16]);
const DEFAULT_LOD_DISTANCES = Object.freeze([96, 192, 320, 480]);
const DEFAULT_COLLISION_LOD_STEPS = Object.freeze([1, 2, 4]);
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
  const sectionSize = Number(config?.sectionSize ?? config?.chunkSize ?? DEFAULT_SECTION_SIZE);
  const componentSize = Number(config?.componentSize ?? DEFAULT_COMPONENT_SIZE);
  if (!(sectionSize >= spacing * 4 && sectionSize <= 128)) failures.push('sectionSize must contain at least 4 samples and be <= 128 meters');
  if (!(componentSize >= sectionSize && componentSize <= 512 && componentSize % sectionSize === 0)) failures.push('componentSize must be an integer multiple of sectionSize');
  const lodSteps = Array.isArray(config?.lod?.steps) ? config.lod.steps.map(Number) : [...DEFAULT_LOD_STEPS];
  if (!lodSteps.length || lodSteps[0] !== 1 || lodSteps.some((step, index) => !Number.isInteger(step) || step < 1 || (index && step <= lodSteps[index - 1]) || Math.abs(sectionSize / (spacing * step) - Math.round(sectionSize / (spacing * step))) > EPSILON)) {
    failures.push('LOD steps must start at 1, increase, and evenly divide each terrain section');
  }
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
    this.sectionSize = Number(config.sectionSize ?? config.chunkSize ?? DEFAULT_SECTION_SIZE);
    this.chunkSize = this.sectionSize; // compatibility alias: old "chunks" are now terrain sections.
    this.componentSize = Number(config.componentSize ?? DEFAULT_COMPONENT_SIZE);
    this.sectionsPerComponent = Math.max(1, Math.round(this.componentSize / this.sectionSize));
    this.lodSteps = (Array.isArray(config.lod?.steps) ? config.lod.steps : DEFAULT_LOD_STEPS).map(Number);
    this.lodDistances = (Array.isArray(config.lod?.distances) ? config.lod.distances : DEFAULT_LOD_DISTANCES).map(Number);
    this.collisionLodSteps = (Array.isArray(config.collision?.lodSteps) ? config.collision.lodSteps : DEFAULT_COLLISION_LOD_STEPS).map(Number);
    this._dirtySections = new Set();
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

  getNativeDiagnostics(deep = false) {
    const memoryBytes = MEMORY.buffer.byteLength;
    const exportNames = Object.keys(NATIVE).sort();
    const nativeFunctions = exportNames.filter(name => typeof NATIVE[name] === 'function');
    return {
      format: 'riftcore-native-diagnostics-v1',
      abi: RiftCore.abi,
      memoryBytes,
      memoryPages: memoryBytes / 65536,
      terrain: { columns: this.columns, rows: this.rows, sampleSpacing: this.sampleSpacing, samples: this.heights?.length || this.columns * this.rows, cells: this.manualHoles?.length || (this.columns - 1) * (this.rows - 1), revision: this.revision },
      exportCount: exportNames.length,
      functionCount: nativeFunctions.length,
      ...(deep ? { exports: exportNames, nativeFunctions } : {})
    };
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

  sectionCounts() {
    return {
      x: Math.ceil(this.width / this.sectionSize),
      z: Math.ceil(this.depth / this.sectionSize)
    };
  }

  componentCounts() {
    return {
      x: Math.ceil(this.width / this.componentSize),
      z: Math.ceil(this.depth / this.componentSize)
    };
  }

  sectionKey(sectionX, sectionZ) { return `${sectionX}:${sectionZ}`; }

  sectionBounds(sectionX, sectionZ) {
    const minX = this.origin[0] + sectionX * this.sectionSize;
    const minZ = this.origin[2] + sectionZ * this.sectionSize;
    return {
      minX,
      minZ,
      maxX: Math.min(this.origin[0] + this.width, minX + this.sectionSize),
      maxZ: Math.min(this.origin[2] + this.depth, minZ + this.sectionSize)
    };
  }

  getSectionDescriptor(sectionX, sectionZ, lodStep = 1) {
    const bounds = this.sectionBounds(sectionX, sectionZ);
    const componentX = Math.floor(sectionX / this.sectionsPerComponent);
    const componentZ = Math.floor(sectionZ / this.sectionsPerComponent);
    return {
      id: `section-${sectionX}-${sectionZ}`,
      key: this.sectionKey(sectionX, sectionZ),
      sectionX,
      sectionZ,
      componentX,
      componentZ,
      componentId: `component-${componentX}-${componentZ}`,
      lodStep,
      lodLevel: Math.max(0, this.lodSteps.indexOf(lodStep)),
      bounds
    };
  }

  getComponentDescriptor(componentX, componentZ) {
    const minSectionX = componentX * this.sectionsPerComponent;
    const minSectionZ = componentZ * this.sectionsPerComponent;
    const counts = this.sectionCounts();
    const sections = [];
    for (let dz = 0; dz < this.sectionsPerComponent; dz += 1) {
      for (let dx = 0; dx < this.sectionsPerComponent; dx += 1) {
        const sectionX = minSectionX + dx;
        const sectionZ = minSectionZ + dz;
        if (sectionX < counts.x && sectionZ < counts.z) sections.push(this.getSectionDescriptor(sectionX, sectionZ));
      }
    }
    return {
      id: `component-${componentX}-${componentZ}`,
      componentX,
      componentZ,
      size: this.componentSize,
      sections
    };
  }

  buildComponentIndex() {
    const counts = this.componentCounts();
    const components = [];
    for (let z = 0; z < counts.z; z += 1) {
      for (let x = 0; x < counts.x; x += 1) components.push(this.getComponentDescriptor(x, z));
    }
    return components;
  }

  _distanceToSection(x, z, bounds) {
    const dx = x < bounds.minX ? bounds.minX - x : x > bounds.maxX ? x - bounds.maxX : 0;
    const dz = z < bounds.minZ ? bounds.minZ - z : z > bounds.maxZ ? z - bounds.maxZ : 0;
    return Math.hypot(dx, dz);
  }

  _desiredLodLevel(distance) {
    let level = 0;
    while (level < this.lodSteps.length - 1 && distance >= (this.lodDistances[level] ?? Infinity)) level += 1;
    return level;
  }

  planSectionLods(cameraX, cameraZ) {
    const counts = this.sectionCounts();
    const levels = new Map();
    for (let z = 0; z < counts.z; z += 1) {
      for (let x = 0; x < counts.x; x += 1) {
        const key = this.sectionKey(x, z);
        const distance = this._distanceToSection(cameraX, cameraZ, this.sectionBounds(x, z));
        levels.set(key, this._desiredLodLevel(distance));
      }
    }

    // Unreal-style neighbor constraint: an edge may only cross one LOD level.
    let changed = true;
    while (changed) {
      changed = false;
      for (let z = 0; z < counts.z; z += 1) {
        for (let x = 0; x < counts.x; x += 1) {
          const key = this.sectionKey(x, z);
          let level = levels.get(key);
          for (const [nx, nz] of [[x, z - 1], [x + 1, z], [x, z + 1], [x - 1, z]]) {
            if (nx < 0 || nz < 0 || nx >= counts.x || nz >= counts.z) continue;
            const neighborKey = this.sectionKey(nx, nz);
            const neighbor = levels.get(neighborKey);
            if (level > neighbor + 1) {
              level = neighbor + 1;
              levels.set(key, level);
              changed = true;
            }
          }
        }
      }
    }

    const plan = new Map();
    for (let z = 0; z < counts.z; z += 1) {
      for (let x = 0; x < counts.x; x += 1) {
        const key = this.sectionKey(x, z);
        const level = levels.get(key);
        plan.set(key, {
          ...this.getSectionDescriptor(x, z, this.lodSteps[level]),
          lodLevel: level,
          lodStep: this.lodSteps[level]
        });
      }
    }
    return plan;
  }

  sectionNeighborLods(plan, sectionX, sectionZ, fallbackStep = 1) {
    const counts = this.sectionCounts();
    const read = (x, z) => {
      if (x < 0 || z < 0 || x >= counts.x || z >= counts.z) return fallbackStep;
      return plan?.get(this.sectionKey(x, z))?.lodStep ?? fallbackStep;
    };
    return {
      north: read(sectionX, sectionZ - 1),
      east: read(sectionX + 1, sectionZ),
      south: read(sectionX, sectionZ + 1),
      west: read(sectionX - 1, sectionZ)
    };
  }

  markDirtyRegion(x, z, radius = 0) {
    const counts = this.sectionCounts();
    const pad = Math.max(this.sampleSpacing * 2, Number(radius) || 0);
    const minX = clamp(Math.floor((x - pad - this.origin[0]) / this.sectionSize) - 1, 0, counts.x - 1);
    const maxX = clamp(Math.floor((x + pad - this.origin[0]) / this.sectionSize) + 1, 0, counts.x - 1);
    const minZ = clamp(Math.floor((z - pad - this.origin[2]) / this.sectionSize) - 1, 0, counts.z - 1);
    const maxZ = clamp(Math.floor((z + pad - this.origin[2]) / this.sectionSize) + 1, 0, counts.z - 1);
    for (let sectionZ = minZ; sectionZ <= maxZ; sectionZ += 1) {
      for (let sectionX = minX; sectionX <= maxX; sectionX += 1) {
        this._dirtySections.add(this.sectionKey(sectionX, sectionZ));
      }
    }
  }

  markAllSectionsDirty() {
    const counts = this.sectionCounts();
    for (let z = 0; z < counts.z; z += 1) {
      for (let x = 0; x < counts.x; x += 1) this._dirtySections.add(this.sectionKey(x, z));
    }
  }

  consumeDirtySections() {
    const result = [...this._dirtySections];
    this._dirtySections.clear();
    return result;
  }

  collisionLodStepForDistance(distance) {
    const d = Math.max(0, Number(distance) || 0);
    if (d < this.sectionSize * 2) return this.collisionLodSteps[0] ?? 1;
    if (d < this.componentSize * 2) return this.collisionLodSteps[1] ?? this.collisionLodSteps[0] ?? 1;
    return this.collisionLodSteps[2] ?? this.collisionLodSteps.at(-1) ?? 1;
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
    this.markDirtyRegion(x, z, radius);
    this._caveCache = this.caves.map((cave, index) => this._normalizeCave(cave, index));
    this.revision += 1;
  }

  rebuildFromManualDelta() {
    NATIVE.rift_terrain_rebuild_from_delta();
    this.markAllSectionsDirty();
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

  buildSurfaceSectionGeometry(sectionX, sectionZ, lodStep = 1, neighborLods = null) {
    const step = Math.max(1, Math.trunc(lodStep));
    const neighbors = neighborLods || { north: step, east: step, south: step, west: step };
    const build = NATIVE.rift_terrain_build_section || NATIVE.rift_terrain_build_chunk;
    const ok = NATIVE.rift_terrain_build_section
      ? build(
          Math.trunc(sectionX),
          Math.trunc(sectionZ),
          this.sectionSize,
          step,
          Math.max(step, Math.trunc(neighbors.north || step)),
          Math.max(step, Math.trunc(neighbors.east || step)),
          Math.max(step, Math.trunc(neighbors.south || step)),
          Math.max(step, Math.trunc(neighbors.west || step))
        )
      : build(Math.trunc(sectionX), Math.trunc(sectionZ), this.sectionSize, step);
    assertNative(ok, `RiftCore could not build terrain section ${sectionX}:${sectionZ}.`);

    const vertexFloatCount = NATIVE.rift_mesh_vertex_float_count();
    const indexCount = NATIVE.rift_mesh_index_count();
    const vertexView = new Float32Array(MEMORY.buffer, NATIVE.rift_mesh_vertices_ptr(), vertexFloatCount);
    const indexView = new Uint32Array(MEMORY.buffer, NATIVE.rift_mesh_indices_ptr(), indexCount);
    const vertices = new Float32Array(vertexView);
    const vertexCount = vertices.length / 9;
    const indices = vertexCount > 65535 ? new Uint32Array(indexView) : Uint16Array.from(indexView);
    return {
      id: `terrain-section-${sectionX}-${sectionZ}`,
      sectionX,
      sectionZ,
      chunkX: sectionX,
      chunkZ: sectionZ,
      lod: step,
      lodStep: step,
      neighborLods: { ...neighbors },
      geometry: { vertices, indices, vertexStride: 9 },
      triangles: indices.length / 3
    };
  }

  buildSurfaceChunkGeometry(chunkX, chunkZ, lod = 1) {
    return this.buildSurfaceSectionGeometry(chunkX, chunkZ, lod);
  }

  buildSurfaceGeometries(lod = 1) {
    const counts = this.sectionCounts();
    const result = [];
    for (let sectionZ = 0; sectionZ < counts.z; sectionZ += 1) {
      for (let sectionX = 0; sectionX < counts.x; sectionX += 1) {
        result.push(this.buildSurfaceSectionGeometry(sectionX, sectionZ, lod));
      }
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
    const sections = this.sectionCounts();
    const components = this.componentCounts();
    const surfaceSections = sections.x * sections.z;
    const componentCount = components.x * components.z;
    return {
      format: 'rift-terrain-v1',
      engine: 'rift-core-wasm',
      nativeAbi: RiftCore.abi,
      width: this.width,
      depth: this.depth,
      sampleSpacing: this.sampleSpacing,
      samples: this.columns * this.rows,
      sectionSize: this.sectionSize,
      chunkSize: this.sectionSize,
      componentSize: this.componentSize,
      sectionsPerComponent: this.sectionsPerComponent,
      surfaceSections,
      surfaceChunks: surfaceSections,
      components: componentCount,
      lodSteps: [...this.lodSteps],
      collisionLodSteps: [...this.collisionLodSteps],
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
