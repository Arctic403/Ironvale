const EPSILON = 1e-6;
const DEFAULT_CHUNK_SIZE = 32;
const DEFAULT_SAMPLE_SPACING = 1;
const DEFAULT_MAX_WALK_SLOPE = 0.78;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }
function fade5(t) { const x = clamp(t, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); }
function fract(value) { return value - Math.floor(value); }
function hash2(x, z, seed = 0) {
  const h = Math.sin((x * 127.1 + z * 311.7 + seed * 74.7) * 0.017453292519943295) * 43758.5453123;
  return fract(h) * 2 - 1;
}
function valueNoise2(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fade5(fx), sz = fade5(fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sz);
}
function fractalNoise2(x, z, options = {}) {
  const octaves = clamp(Math.trunc(Number(options.octaves) || 4), 1, 8);
  let frequency = Math.max(0.00001, Number(options.frequency) || 0.0125);
  let amplitude = Number(options.amplitude) || 1;
  const persistence = clamp(Number(options.persistence) || 0.5, 0.05, 0.95);
  const lacunarity = clamp(Number(options.lacunarity) || 2, 1.1, 4);
  const seed = Math.trunc(Number(options.seed) || 0);
  const ridge = clamp(Number(options.ridge) || 0, 0, 1);
  let sum = 0, norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const raw = valueNoise2(x * frequency, z * frequency, seed + octave * 1013);
    const shaped = lerp(raw, 1 - Math.abs(raw) * 2, ridge);
    sum += shaped * amplitude;
    norm += Math.abs(amplitude);
    frequency *= lacunarity;
    amplitude *= persistence;
  }
  return norm > EPSILON ? sum / norm : 0;
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
function normalize3(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function layerDelta(layer, x, z, currentHeight, seed) {
  if (!layer || layer.enabled === false) return 0;
  const type = String(layer.type || 'noise').toLowerCase();
  if (type === 'noise') {
    return fractalNoise2(x, z, { ...layer, seed: (Number(layer.seed) || 0) + seed }) * (Number(layer.strength) || Number(layer.height) || 1);
  }
  if (type === 'radial' || type === 'hill' || type === 'depression') {
    const cx = Number(layer.x) || 0, cz = Number(layer.z) || 0;
    const radius = Math.max(0.001, Number(layer.radius) || 16);
    const distance = Math.hypot(x - cx, z - cz);
    if (distance >= radius) return 0;
    const t = 1 - distance / radius;
    const falloff = Math.pow(smoothstep(t), Math.max(0.2, Number(layer.falloff) || 1));
    const strength = Number(layer.strength ?? layer.height ?? (type === 'depression' ? -4 : 4));
    return falloff * strength;
  }
  if (type === 'ridge' || type === 'channel') {
    const a = layer.a || [0, 0], b = layer.b || [1, 1];
    const radius = Math.max(0.001, Number(layer.radius) || 12);
    const hit = distanceToSegment2(x, z, Number(a[0]) || 0, Number(a[1]) || 0, Number(b[0]) || 0, Number(b[1]) || 0);
    if (hit.distance >= radius) return 0;
    const t = 1 - hit.distance / radius;
    const strength = Number(layer.strength ?? (type === 'channel' ? -5 : 5));
    return Math.pow(smoothstep(t), Math.max(0.2, Number(layer.falloff) || 1)) * strength;
  }
  if (type === 'flatten') {
    const cx = Number(layer.x) || 0, cz = Number(layer.z) || 0;
    const radius = Math.max(0.001, Number(layer.radius) || 12);
    const distance = Math.hypot(x - cx, z - cz);
    if (distance >= radius) return 0;
    const target = Number(layer.targetHeight) || 0;
    const strength = clamp(Number(layer.strength) || 1, 0, 1);
    const t = smoothstep(1 - distance / radius) * strength;
    return (target - currentHeight) * t;
  }
  return 0;
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
    this.heights = new Float32Array(this.columns * this.rows);
    this.manualDelta = new Float32Array(this.columns * this.rows);
    this.manualHoles = new Uint8Array((this.columns - 1) * (this.rows - 1));
    this.layers = Array.isArray(config.layers) ? config.layers : [];
    this.holes = Array.isArray(config.holes) ? config.holes : [];
    this.caves = Array.isArray(config.caves) ? config.caves : [];
    this.revision = 1;
    this._generateHeightfield();
    this._caveCache = this.caves.map((cave, index) => this._normalizeCave(cave, index));
  }

  _heightIndex(ix, iz) { return iz * this.columns + ix; }
  _cellIndex(ix, iz) { return iz * (this.columns - 1) + ix; }
  _worldX(ix) { return this.origin[0] + ix * this.sampleSpacing; }
  _worldZ(iz) { return this.origin[2] + iz * this.sampleSpacing; }

  _generateHeightfield() {
    for (let iz = 0; iz < this.rows; iz += 1) {
      const z = this._worldZ(iz);
      for (let ix = 0; ix < this.columns; ix += 1) {
        const x = this._worldX(ix);
        let height = this.baseHeight;
        for (const layer of this.layers) height += layerDelta(layer, x, z, height, this.seed);
        this.heights[this._heightIndex(ix, iz)] = height + this.manualDelta[this._heightIndex(ix, iz)];
      }
    }
  }

  containsXZ(x, z) {
    return x >= this.origin[0] && z >= this.origin[2] && x <= this.origin[0] + this.width && z <= this.origin[2] + this.depth;
  }

  sampleHeight(x, z) {
    if (!this.containsXZ(x, z)) return null;
    const gx = clamp((x - this.origin[0]) / this.sampleSpacing, 0, this.columns - 1);
    const gz = clamp((z - this.origin[2]) / this.sampleSpacing, 0, this.rows - 1);
    const x0 = Math.floor(gx), z0 = Math.floor(gz);
    const x1 = Math.min(this.columns - 1, x0 + 1), z1 = Math.min(this.rows - 1, z0 + 1);
    const tx = gx - x0, tz = gz - z0;
    const a = this.heights[this._heightIndex(x0, z0)], b = this.heights[this._heightIndex(x1, z0)];
    const c = this.heights[this._heightIndex(x0, z1)], d = this.heights[this._heightIndex(x1, z1)];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  sampleNormal(x, z) {
    const s = this.sampleSpacing;
    const center = this.sampleHeight(x, z) ?? 0;
    const hL = this.sampleHeight(x - s, z) ?? center;
    const hR = this.sampleHeight(x + s, z) ?? center;
    const hD = this.sampleHeight(x, z - s) ?? center;
    const hU = this.sampleHeight(x, z + s) ?? center;
    return normalize3(hL - hR, s * 2, hD - hU);
  }

  slopeAt(x, z) {
    const n = this.sampleNormal(x, z);
    return Math.hypot(n[0], n[2]) / Math.max(0.001, n[1]);
  }

  walkableAt(x, z) { return this.slopeAt(x, z) <= this.maxWalkSlope; }

  isHoleAt(x, z) {
    if (!this.containsXZ(x, z)) return false;
    const gx = Math.floor((x - this.origin[0]) / this.sampleSpacing);
    const gz = Math.floor((z - this.origin[2]) / this.sampleSpacing);
    if (gx >= 0 && gz >= 0 && gx < this.columns - 1 && gz < this.rows - 1 && this.manualHoles[this._cellIndex(gx, gz)]) return true;
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
    const mode = String(brush.mode || 'raise').toLowerCase();
    const x = Number(brush.x) || 0, z = Number(brush.z) || 0;
    const radius = Math.max(this.sampleSpacing, Number(brush.radius) || 6);
    const strength = Number(brush.strength) || 1;
    const minX = clamp(Math.floor((x - radius - this.origin[0]) / this.sampleSpacing), 0, this.columns - 1);
    const maxX = clamp(Math.ceil((x + radius - this.origin[0]) / this.sampleSpacing), 0, this.columns - 1);
    const minZ = clamp(Math.floor((z - radius - this.origin[2]) / this.sampleSpacing), 0, this.rows - 1);
    const maxZ = clamp(Math.ceil((z + radius - this.origin[2]) / this.sampleSpacing), 0, this.rows - 1);

    if (mode === 'hole' || mode === 'unhole') {
      for (let iz = Math.max(0, minZ); iz < Math.min(this.rows - 1, maxZ + 1); iz += 1) {
        for (let ix = Math.max(0, minX); ix < Math.min(this.columns - 1, maxX + 1); ix += 1) {
          const cx = this._worldX(ix) + this.sampleSpacing * 0.5, cz = this._worldZ(iz) + this.sampleSpacing * 0.5;
          if (Math.hypot(cx - x, cz - z) <= radius) this.manualHoles[this._cellIndex(ix, iz)] = mode === 'hole' ? 1 : 0;
        }
      }
      this.revision += 1;
      return;
    }

    const target = Number(brush.targetHeight);
    const original = new Float32Array(this.heights);
    for (let iz = minZ; iz <= maxZ; iz += 1) {
      for (let ix = minX; ix <= maxX; ix += 1) {
        const wx = this._worldX(ix), wz = this._worldZ(iz);
        const distance = Math.hypot(wx - x, wz - z);
        if (distance > radius) continue;
        const weight = smoothstep(1 - distance / radius);
        const index = this._heightIndex(ix, iz);
        let next = original[index];
        if (mode === 'raise') next += Math.abs(strength) * weight;
        else if (mode === 'lower') next -= Math.abs(strength) * weight;
        else if (mode === 'flatten' && Number.isFinite(target)) next = lerp(next, target, clamp(Math.abs(strength) * weight, 0, 1));
        else if (mode === 'smooth') {
          let sum = 0, count = 0;
          for (let oz = -1; oz <= 1; oz += 1) for (let ox = -1; ox <= 1; ox += 1) {
            const sx = clamp(ix + ox, 0, this.columns - 1), sz = clamp(iz + oz, 0, this.rows - 1);
            sum += original[this._heightIndex(sx, sz)]; count += 1;
          }
          next = lerp(next, sum / count, clamp(Math.abs(strength) * weight, 0, 1));
        }
        const delta = next - original[index];
        this.manualDelta[index] += delta;
        this.heights[index] = next;
      }
    }
    this._caveCache = this.caves.map((cave, index) => this._normalizeCave(cave, index));
    this.revision += 1;
  }

  _terrainColor(x, y, z, normal) {
    const slope = clamp(1 - normal[1], 0, 1);
    const low = [0.26, 0.39, 0.19];
    const grass = [0.32, 0.48, 0.22];
    const rock = [0.42, 0.40, 0.35];
    const elevation = clamp((y - this.baseHeight) / 22, -1, 1);
    const grassMix = clamp(0.65 + elevation * 0.18, 0.3, 0.9);
    const base = [lerp(low[0], grass[0], grassMix), lerp(low[1], grass[1], grassMix), lerp(low[2], grass[2], grassMix)];
    const rockMix = smoothstep(clamp((slope - 0.18) / 0.45, 0, 1));
    return [lerp(base[0], rock[0], rockMix), lerp(base[1], rock[1], rockMix), lerp(base[2], rock[2], rockMix)];
  }

  buildSurfaceChunkGeometry(chunkX, chunkZ, lod = 1) {
    const step = Math.max(1, Math.trunc(lod));
    const startX = chunkX * this.chunkSize;
    const startZ = chunkZ * this.chunkSize;
    const endX = Math.min(this.width, startX + this.chunkSize);
    const endZ = Math.min(this.depth, startZ + this.chunkSize);
    const cellStep = this.sampleSpacing * step;
    const cellsX = Math.max(1, Math.round((endX - startX) / cellStep));
    const cellsZ = Math.max(1, Math.round((endZ - startZ) / cellStep));
    const vertsX = cellsX + 1, vertsZ = cellsZ + 1;
    const vertices = new Float32Array(vertsX * vertsZ * 9);
    const indices = [];
    let vertex = 0;
    for (let iz = 0; iz < vertsZ; iz += 1) {
      const z = this.origin[2] + Math.min(endZ, startZ + iz * cellStep);
      for (let ix = 0; ix < vertsX; ix += 1) {
        const x = this.origin[0] + Math.min(endX, startX + ix * cellStep);
        const y = this.sampleHeight(x, z) ?? this.baseHeight;
        const normal = this.sampleNormal(x, z);
        const color = this._terrainColor(x, y, z, normal);
        const offset = vertex * 9;
        vertices[offset] = x; vertices[offset + 1] = y; vertices[offset + 2] = z;
        vertices[offset + 3] = normal[0]; vertices[offset + 4] = normal[1]; vertices[offset + 5] = normal[2];
        vertices[offset + 6] = color[0]; vertices[offset + 7] = color[1]; vertices[offset + 8] = color[2];
        vertex += 1;
      }
    }
    for (let iz = 0; iz < cellsZ; iz += 1) {
      for (let ix = 0; ix < cellsX; ix += 1) {
        const centerX = this.origin[0] + startX + (ix + 0.5) * cellStep;
        const centerZ = this.origin[2] + startZ + (iz + 0.5) * cellStep;
        if (this.isHoleAt(centerX, centerZ)) continue;
        const a = iz * vertsX + ix, b = a + 1, c = a + vertsX, d = c + 1;
        indices.push(a, c, d, a, d, b);
      }
    }
    return {
      id: `terrain-${chunkX}-${chunkZ}`,
      chunkX, chunkZ, lod: step,
      geometry: { vertices, indices: vertices.length / 9 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), vertexStride: 9 },
      triangles: indices.length / 3
    };
  }

  buildSurfaceGeometries(lod = 1) {
    const chunksX = Math.ceil(this.width / this.chunkSize), chunksZ = Math.ceil(this.depth / this.chunkSize);
    const result = [];
    for (let cz = 0; cz < chunksZ; cz += 1) for (let cx = 0; cx < chunksX; cx += 1) result.push(this.buildSurfaceChunkGeometry(cx, cz, lod));
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
      geometry: { vertices, indices: vertices.length / 9 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), vertexStride: 9 },
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
      format: 'rift-terrain-v1', width: this.width, depth: this.depth,
      sampleSpacing: this.sampleSpacing, samples: this.columns * this.rows,
      chunkSize: this.chunkSize, surfaceChunks, caves: this._caveCache.length,
      layers: this.layers.length, revision: this.revision
    };
  }
}

export function createRiftTerrain(config) { return new RiftTerrain(config); }
export function createRiftTerrainFromDocument(document) {
  return document?.terrain?.format === 'rift-terrain-v1' ? new RiftTerrain(document.terrain) : null;
}
