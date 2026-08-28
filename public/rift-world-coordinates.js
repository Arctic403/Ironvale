export const RIFT_WORLD_COORDINATE_VERSION = 1;
export const RIFT_WORLD_CHUNK_SIZE = 128;
export const RIFT_WORLD_COORDINATE_LIMIT = 1_000_000;
export const RIFT_WORLD_ROTATIONS = Object.freeze(['north', 'east', 'south', 'west']);

function asInt(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`${label} must be an integer.`);
  if (Math.abs(n) > RIFT_WORLD_COORDINATE_LIMIT) throw new Error(`${label} exceeds RiftCity world coordinate limit ±${RIFT_WORLD_COORDINATE_LIMIT}.`);
  return n;
}

export function riftVec3(value, label = 'position') {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} must be [x,y,z].`);
  return value.map((v, i) => asInt(v, `${label}[${i}]`));
}

export function riftRotation(value = 'north', label = 'rotation') {
  if (typeof value === 'number' || /^-?\d+$/.test(String(value))) {
    const deg = Number(value);
    if (![0, 90, 180, 270, -90, -180, -270].includes(deg)) throw new Error(`${label} must be north/east/south/west or a 90-degree increment.`);
    const turns = ((Math.round(deg / 90) % 4) + 4) % 4;
    return Object.freeze({ name: RIFT_WORLD_ROTATIONS[turns], turns });
  }
  const name = String(value || 'north').toLowerCase();
  const turns = RIFT_WORLD_ROTATIONS.indexOf(name);
  if (turns < 0) throw new Error(`${label} must be north/east/south/west or a 90-degree increment.`);
  return Object.freeze({ name, turns });
}

export function riftRotateVector(point, rotation = 'north') {
  const p = riftVec3(point, 'point');
  const turns = riftRotation(rotation).turns;
  const [x, y, z] = p;
  if (turns === 1) return [-z, y, x];
  if (turns === 2) return [-x, y, -z];
  if (turns === 3) return [z, y, -x];
  return [x, y, z];
}

export function riftInverseRotateVector(point, rotation = 'north') {
  const turns = riftRotation(rotation).turns;
  return riftRotateVector(point, RIFT_WORLD_ROTATIONS[(4 - turns) % 4]);
}

export function riftAddVec3(a, b) {
  const av = riftVec3(a, 'a');
  const bv = riftVec3(b, 'b');
  return [av[0] + bv[0], av[1] + bv[1], av[2] + bv[2]];
}

export function riftSubVec3(a, b) {
  const av = riftVec3(a, 'a');
  const bv = riftVec3(b, 'b');
  return [av[0] - bv[0], av[1] - bv[1], av[2] - bv[2]];
}

export function createRiftCoordinateFrame({ id = 'frame', origin = [0, 0, 0], rotation = 'north', parent = null, kind = 'local' } = {}) {
  const localOrigin = riftVec3(origin, `${id}.origin`);
  const localRotation = riftRotation(rotation, `${id}.rotation`);
  const frame = {
    id: String(id),
    kind: String(kind),
    origin: localOrigin,
    rotation: localRotation.name,
    rotationTurns: localRotation.turns,
    parent,
    toWorld(point) {
      const rotated = riftRotateVector(point, localRotation.name);
      const inParent = riftAddVec3(localOrigin, rotated);
      return parent?.toWorld ? parent.toWorld(inParent) : inParent;
    },
    fromWorld(point) {
      const inParent = parent?.fromWorld ? parent.fromWorld(point) : riftVec3(point, 'worldPoint');
      return riftInverseRotateVector(riftSubVec3(inParent, localOrigin), localRotation.name);
    }
  };
  return Object.freeze(frame);
}

function floorDiv(value, size) {
  return Math.floor(value / size);
}

export function riftWorldToChunk(point, chunkSize = RIFT_WORLD_CHUNK_SIZE) {
  const p = riftVec3(point, 'worldPoint');
  const size = asInt(chunkSize, 'chunkSize');
  if (size < 1) throw new Error('chunkSize must be at least 1.');
  const chunk = [floorDiv(p[0], size), floorDiv(p[1], size), floorDiv(p[2], size)];
  const origin = chunk.map(v => v * size);
  return Object.freeze({
    size,
    chunk,
    id: `${chunk[0]}:${chunk[1]}:${chunk[2]}`,
    origin,
    local: [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]]
  });
}

export function riftChunkBounds(chunk, chunkSize = RIFT_WORLD_CHUNK_SIZE) {
  if (!Array.isArray(chunk) || chunk.length !== 3) throw new Error('chunk must be [cx,cy,cz].');
  const c = chunk.map((v, i) => asInt(v, `chunk[${i}]`));
  const size = asInt(chunkSize, 'chunkSize');
  const min = c.map(v => v * size);
  return Object.freeze({ min, max: min.map(v => v + size - 1), size: [size, size, size] });
}

export function describeRiftCoordinate(point, frame = null) {
  const world = frame?.toWorld ? frame.toWorld(point) : riftVec3(point, 'point');
  const chunk = riftWorldToChunk(world);
  return Object.freeze({
    local: riftVec3(point, 'point'),
    world,
    chunk: chunk.chunk,
    chunkId: chunk.id,
    chunkLocal: chunk.local
  });
}
