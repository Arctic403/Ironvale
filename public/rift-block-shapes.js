export const RIFT_BLOCK_MATERIAL_MASK = 0x00ff;
export const RIFT_BLOCK_SHAPE_SHIFT = 8;
export const RIFT_BLOCK_SHAPE_MASK = 0x0700;
export const RIFT_BLOCK_ROTATION_SHIFT = 11;
export const RIFT_BLOCK_ROTATION_MASK = 0x1800;

export const RIFT_BLOCK_SHAPES = Object.freeze({
  full: 0,
  bottomSlab: 1,
  topSlab: 2,
  stair: 3
});

export const RIFT_BLOCK_SHAPE_NAMES = Object.freeze({
  [RIFT_BLOCK_SHAPES.full]: 'FULL',
  [RIFT_BLOCK_SHAPES.bottomSlab]: 'BOTTOM SLAB',
  [RIFT_BLOCK_SHAPES.topSlab]: 'TOP SLAB',
  [RIFT_BLOCK_SHAPES.stair]: 'STAIR'
});

export const RIFT_BLOCK_ROTATIONS = Object.freeze({
  north: 0,
  east: 1,
  south: 2,
  west: 3
});

export const RIFT_BLOCK_ROTATION_NAMES = Object.freeze(['NORTH', 'EAST', 'SOUTH', 'WEST']);

const FULL_MASK = 0xff;
const BOTTOM_SLAB_MASK = 0x0f;
const TOP_SLAB_MASK = 0xf0;
const STAIR_MASKS = Object.freeze([
  0x3f, // north: upper half occupies -Z side
  0xaf, // east:  upper half occupies +X side
  0xcf, // south: upper half occupies +Z side
  0x5f  // west:  upper half occupies -X side
]);

const FACE_DEFS = Object.freeze([
  Object.freeze({ id: 'east', label: 'EAST +X', d: [1, 0, 0], n: [1, 0, 0] }),
  Object.freeze({ id: 'west', label: 'WEST -X', d: [-1, 0, 0], n: [-1, 0, 0] }),
  Object.freeze({ id: 'top', label: 'TOP +Y', d: [0, 1, 0], n: [0, 1, 0] }),
  Object.freeze({ id: 'bottom', label: 'BOTTOM -Y', d: [0, -1, 0], n: [0, -1, 0] }),
  Object.freeze({ id: 'south', label: 'SOUTH +Z', d: [0, 0, 1], n: [0, 0, 1] }),
  Object.freeze({ id: 'north', label: 'NORTH -Z', d: [0, 0, -1], n: [0, 0, -1] })
]);

const VERTEX_STRIDE = 9;

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.trunc(Number(value) || 0)));
}

function microIndex(mx, my, mz) {
  return (my << 2) | (mz << 1) | mx;
}

function microOccupied(mask, mx, my, mz) {
  if (mx < 0 || mx > 1 || my < 0 || my > 1 || mz < 0 || mz > 1) return false;
  return (mask & (1 << microIndex(mx, my, mz))) !== 0;
}

export function encodeRiftBlockState({ material = 1, shape = RIFT_BLOCK_SHAPES.full, rotation = 0 } = {}) {
  const materialId = clampInt(material, 0, RIFT_BLOCK_MATERIAL_MASK);
  if (materialId === 0) return 0;
  const shapeId = clampInt(shape, 0, 7);
  const rotationId = clampInt(rotation, 0, 3);
  return materialId |
    (shapeId << RIFT_BLOCK_SHAPE_SHIFT) |
    (rotationId << RIFT_BLOCK_ROTATION_SHIFT);
}

export function decodeRiftBlockState(state = 0) {
  const raw = clampInt(state, 0, 65535);
  if (raw === 0) {
    return { state: 0, material: 0, shape: RIFT_BLOCK_SHAPES.full, rotation: 0, occupancyMask: 0, partial: false };
  }
  const material = raw & RIFT_BLOCK_MATERIAL_MASK;
  const shape = (raw & RIFT_BLOCK_SHAPE_MASK) >> RIFT_BLOCK_SHAPE_SHIFT;
  const rotation = (raw & RIFT_BLOCK_ROTATION_MASK) >> RIFT_BLOCK_ROTATION_SHIFT;
  return {
    state: raw,
    material,
    shape,
    rotation,
    occupancyMask: riftBlockShapeOccupancyMask(shape, rotation),
    partial: shape !== RIFT_BLOCK_SHAPES.full
  };
}

export function riftBlockShapeOccupancyMask(shape = RIFT_BLOCK_SHAPES.full, rotation = 0) {
  switch (clampInt(shape, 0, 7)) {
    case RIFT_BLOCK_SHAPES.bottomSlab: return BOTTOM_SLAB_MASK;
    case RIFT_BLOCK_SHAPES.topSlab: return TOP_SLAB_MASK;
    case RIFT_BLOCK_SHAPES.stair: return STAIR_MASKS[clampInt(rotation, 0, 3)];
    case RIFT_BLOCK_SHAPES.full:
    default: return FULL_MASK;
  }
}

export function riftBlockStateHasPartialShape(state = 0) {
  return state !== 0 && (state & RIFT_BLOCK_SHAPE_MASK) !== 0;
}

export function riftBlockShapeLabel(state = 0) {
  const decoded = decodeRiftBlockState(state);
  const shapeName = RIFT_BLOCK_SHAPE_NAMES[decoded.shape] || `SHAPE ${decoded.shape}`;
  return decoded.shape === RIFT_BLOCK_SHAPES.stair
    ? `${shapeName} ${RIFT_BLOCK_ROTATION_NAMES[decoded.rotation]}`
    : shapeName;
}

function normalizeColor(color) {
  if (!Array.isArray(color) && !(color instanceof Float32Array)) return [1, 1, 1];
  return [
    Math.max(0, Math.min(1, Number(color[0]) || 0)),
    Math.max(0, Math.min(1, Number(color[1]) || 0)),
    Math.max(0, Math.min(1, Number(color[2]) || 0))
  ];
}

function appendQuad(buffer, corners, normal, color) {
  const base = buffer.vertices.length / VERTEX_STRIDE;
  const faceColor = normalizeColor(color);
  for (const corner of corners) {
    buffer.vertices.push(
      corner[0], corner[1], corner[2],
      normal[0], normal[1], normal[2],
      faceColor[0], faceColor[1], faceColor[2]
    );
  }
  buffer.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function appendAxisRect(buffer, cellX, cellY, cellZ, face, plane, u0, v0, u1, v1, color) {
  const p = plane * 0.5;
  const a = u0 * 0.5;
  const b = v0 * 0.5;
  const c = u1 * 0.5;
  const d = v1 * 0.5;
  let corners;

  switch (face.id) {
    case 'east': {
      const x = cellX + p;
      corners = [[x, cellY + b, cellZ + a], [x, cellY + d, cellZ + a], [x, cellY + d, cellZ + c], [x, cellY + b, cellZ + c]];
      break;
    }
    case 'west': {
      const x = cellX + p;
      corners = [[x, cellY + b, cellZ + c], [x, cellY + d, cellZ + c], [x, cellY + d, cellZ + a], [x, cellY + b, cellZ + a]];
      break;
    }
    case 'top': {
      const y = cellY + p;
      corners = [[cellX + a, y, cellZ + b], [cellX + a, y, cellZ + d], [cellX + c, y, cellZ + d], [cellX + c, y, cellZ + b]];
      break;
    }
    case 'bottom': {
      const y = cellY + p;
      corners = [[cellX + a, y, cellZ + d], [cellX + a, y, cellZ + b], [cellX + c, y, cellZ + b], [cellX + c, y, cellZ + d]];
      break;
    }
    case 'south': {
      const z = cellZ + p;
      corners = [[cellX + c, cellY + b, z], [cellX + c, cellY + d, z], [cellX + a, cellY + d, z], [cellX + a, cellY + b, z]];
      break;
    }
    case 'north':
    default: {
      const z = cellZ + p;
      corners = [[cellX + a, cellY + b, z], [cellX + a, cellY + d, z], [cellX + c, cellY + d, z], [cellX + c, cellY + b, z]];
      break;
    }
  }

  appendQuad(buffer, corners, face.n, color);
}

function faceTileCoordinates(face, mx, my, mz) {
  if (face.id === 'east' || face.id === 'west') {
    return { plane: mx + (face.d[0] > 0 ? 1 : 0), u: mz, v: my };
  }
  if (face.id === 'top' || face.id === 'bottom') {
    return { plane: my + (face.d[1] > 0 ? 1 : 0), u: mx, v: mz };
  }
  return { plane: mz + (face.d[2] > 0 ? 1 : 0), u: mx, v: my };
}

function wrappedNeighborMicro(face, mx, my, mz) {
  let nx = mx + face.d[0];
  let ny = my + face.d[1];
  let nz = mz + face.d[2];
  let cx = 0, cy = 0, cz = 0;
  if (nx < 0) { nx = 1; cx = -1; }
  else if (nx > 1) { nx = 0; cx = 1; }
  if (ny < 0) { ny = 1; cy = -1; }
  else if (ny > 1) { ny = 0; cy = 1; }
  if (nz < 0) { nz = 1; cz = -1; }
  else if (nz > 1) { nz = 0; cz = 1; }
  return { mx: nx, my: ny, mz: nz, cx, cy, cz };
}

function mergeTileGrid(tileKeys) {
  const grid = [[false, false], [false, false]];
  for (const key of tileKeys) {
    const [u, v] = key.split(',').map(Number);
    if (u >= 0 && u < 2 && v >= 0 && v < 2) grid[v][u] = true;
  }
  const used = [[false, false], [false, false]];
  const rects = [];
  for (let v = 0; v < 2; v += 1) {
    for (let u = 0; u < 2; u += 1) {
      if (!grid[v][u] || used[v][u]) continue;
      let width = 1;
      if (u + 1 < 2 && grid[v][u + 1] && !used[v][u + 1]) width = 2;
      let height = 1;
      if (v + 1 < 2) {
        let rowOk = true;
        for (let x = u; x < u + width; x += 1) {
          if (!grid[v + 1][x] || used[v + 1][x]) rowOk = false;
        }
        if (rowOk) height = 2;
      }
      for (let yy = v; yy < v + height; yy += 1) {
        for (let xx = u; xx < u + width; xx += 1) used[yy][xx] = true;
      }
      rects.push({ u0: u, v0: v, u1: u + width, v1: v + height });
    }
  }
  return rects;
}

export function buildRiftPartialShapeGeometry({
  cells = [],
  getStateAt = null,
  getBlockColor = null
} = {}) {
  const normalized = [];
  const localStates = new Map();
  for (const cell of cells || []) {
    const x = Math.trunc(Number(cell?.x) || 0);
    const y = Math.trunc(Number(cell?.y) || 0);
    const z = Math.trunc(Number(cell?.z) || 0);
    const state = clampInt(cell?.state, 0, 65535);
    if (state === 0) continue;
    const key = `${x}|${y}|${z}`;
    if (!localStates.has(key)) normalized.push({ x, y, z, state });
    localStates.set(key, state);
  }
  for (const cell of normalized) cell.state = localStates.get(`${cell.x}|${cell.y}|${cell.z}`);

  const readState = (x, y, z) => {
    const key = `${x}|${y}|${z}`;
    if (localStates.has(key)) return localStates.get(key);
    if (typeof getStateAt === 'function') return clampInt(getStateAt(x, y, z), 0, 65535);
    return 0;
  };

  const buffer = { vertices: [], indices: [] };
  let blocks = 0;
  let occupiedMicrovoxels = 0;
  let visibleMicroFaces = 0;
  let culledMicroFaces = 0;
  let quads = 0;

  for (const cell of normalized) {
    const decoded = decodeRiftBlockState(cell.state);
    const mask = decoded.occupancyMask;
    if (!mask) continue;
    blocks += 1;
    for (let bit = 0; bit < 8; bit += 1) if (mask & (1 << bit)) occupiedMicrovoxels += 1;

    const groups = new Map();
    for (let my = 0; my < 2; my += 1) {
      for (let mz = 0; mz < 2; mz += 1) {
        for (let mx = 0; mx < 2; mx += 1) {
          if (!microOccupied(mask, mx, my, mz)) continue;
          for (const face of FACE_DEFS) {
            const neighborMicro = wrappedNeighborMicro(face, mx, my, mz);
            let neighborMask = mask;
            if (neighborMicro.cx || neighborMicro.cy || neighborMicro.cz) {
              const neighborState = readState(
                cell.x + neighborMicro.cx,
                cell.y + neighborMicro.cy,
                cell.z + neighborMicro.cz
              );
              neighborMask = decodeRiftBlockState(neighborState).occupancyMask;
            }
            if (microOccupied(neighborMask, neighborMicro.mx, neighborMicro.my, neighborMicro.mz)) {
              culledMicroFaces += 1;
              continue;
            }
            visibleMicroFaces += 1;
            const tile = faceTileCoordinates(face, mx, my, mz);
            const groupKey = `${face.id}:${tile.plane}`;
            if (!groups.has(groupKey)) groups.set(groupKey, { face, plane: tile.plane, tiles: new Set() });
            groups.get(groupKey).tiles.add(`${tile.u},${tile.v}`);
          }
        }
      }
    }

    for (const group of groups.values()) {
      const rects = mergeTileGrid(group.tiles);
      for (const rect of rects) {
        const color = typeof getBlockColor === 'function'
          ? getBlockColor({
              state: cell.state,
              materialId: decoded.material,
              shape: decoded.shape,
              rotation: decoded.rotation,
              face: group.face,
              worldX: cell.x,
              worldY: cell.y,
              worldZ: cell.z
            })
          : [1, 1, 1];
        appendAxisRect(
          buffer,
          cell.x,
          cell.y,
          cell.z,
          group.face,
          group.plane,
          rect.u0,
          rect.v0,
          rect.u1,
          rect.v1,
          color
        );
        quads += 1;
      }
    }
  }

  const vertexCount = quads * 4;
  const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
  return {
    vertices: new Float32Array(buffer.vertices),
    vertexStride: VERTEX_STRIDE,
    indices: new IndexArray(buffer.indices),
    blocks,
    occupiedMicrovoxels,
    visibleMicroFaces,
    culledMicroFaces,
    theoreticalMicroFaces: occupiedMicrovoxels * 6,
    visibleFaces: quads,
    quads,
    vertexCount,
    triangles: quads * 2
  };
}

function cell(x, y, z, shape = RIFT_BLOCK_SHAPES.full, rotation = 0, material = 1) {
  return { x, y, z, state: encodeRiftBlockState({ material, shape, rotation }) };
}

function full(x, y, z, material = 1) { return cell(x, y, z, RIFT_BLOCK_SHAPES.full, 0, material); }
function bottomSlab(x, y, z, material = 2) { return cell(x, y, z, RIFT_BLOCK_SHAPES.bottomSlab, 0, material); }
function topSlab(x, y, z, material = 3) { return cell(x, y, z, RIFT_BLOCK_SHAPES.topSlab, 0, material); }
function stair(x, y, z, rotation = 0, material = 4) { return cell(x, y, z, RIFT_BLOCK_SHAPES.stair, rotation, material); }

function uniqueCells(cells) {
  const map = new Map();
  for (const entry of cells) map.set(`${entry.x}|${entry.y}|${entry.z}`, entry);
  return [...map.values()];
}

const LAB_SCENES_RAW = [
  {
    id: 'all', label: 'ALL', title: 'ALL SHAPES', description: 'Full blocks, both slabs, all four stair rotations and mixed partial-occlusion examples in one mesh.',
    cells: uniqueCells([
      full(2,1,2,1), bottomSlab(4,1,2,2), topSlab(6,1,2,3),
      stair(2,1,5,RIFT_BLOCK_ROTATIONS.north,4), stair(5,1,5,RIFT_BLOCK_ROTATIONS.east,4), stair(8,1,5,RIFT_BLOCK_ROTATIONS.south,4), stair(11,1,5,RIFT_BLOCK_ROTATIONS.west,4),
      full(2,1,9,1), bottomSlab(3,1,9,2),
      full(6,1,9,1), stair(7,1,9,RIFT_BLOCK_ROTATIONS.east,4),
      stair(10,1,9,RIFT_BLOCK_ROTATIONS.east,4), stair(11,2,9,RIFT_BLOCK_ROTATIONS.east,4), stair(12,3,9,RIFT_BLOCK_ROTATIONS.east,4)
    ])
  },
  {
    id: 'full', label: 'FULL', title: 'FULL BLOCK COMPATIBILITY', description: 'Two touching legacy/full RiftBlocks. Their shared face must still disappear exactly as before.',
    cells: [full(6,1,7,1), full(7,1,7,1)]
  },
  {
    id: 'slabs', label: 'SLABS', title: 'TOP + BOTTOM SLABS', description: 'Isolated bottom/top slabs, touching bottom slabs, and vertically touching top/bottom slabs.',
    cells: [
      bottomSlab(3,1,6,2), topSlab(5,1,6,3),
      bottomSlab(8,1,6,2), bottomSlab(9,1,6,2),
      topSlab(12,1,6,3), bottomSlab(12,2,6,2)
    ]
  },
  {
    id: 'stairs', label: 'STAIRS', title: 'FOUR-WAY STAIRS', description: 'The same two-step stair shape rotated north, east, south and west.',
    cells: [
      stair(5,1,5,RIFT_BLOCK_ROTATIONS.north,4),
      stair(9,1,5,RIFT_BLOCK_ROTATIONS.east,4),
      stair(9,1,9,RIFT_BLOCK_ROTATIONS.south,4),
      stair(5,1,9,RIFT_BLOCK_ROTATIONS.west,4)
    ]
  },
  {
    id: 'staircase', label: 'STAIRCASE', title: 'SIX-STEP STAIRCASE', description: 'Three east-facing stair cells climb continuously from 0 to 3 meters in six half-meter steps.',
    cells: [
      stair(5,0,7,RIFT_BLOCK_ROTATIONS.east,4),
      stair(6,1,7,RIFT_BLOCK_ROTATIONS.east,4),
      stair(7,2,7,RIFT_BLOCK_ROTATIONS.east,4)
    ]
  },
  {
    id: 'mixed', label: 'MIXED', title: 'MIXED SHAPE CONTACT', description: 'Full↔slab, full↔stair, slab↔stair and stair↔stair contacts exercise partial shared-face coverage.',
    cells: [
      full(3,1,5,1), bottomSlab(4,1,5,2),
      full(7,1,5,1), stair(8,1,5,RIFT_BLOCK_ROTATIONS.east,4),
      bottomSlab(3,1,9,2), stair(4,1,9,RIFT_BLOCK_ROTATIONS.east,4),
      stair(8,1,9,RIFT_BLOCK_ROTATIONS.east,4), stair(9,1,9,RIFT_BLOCK_ROTATIONS.west,4)
    ]
  },
  {
    id: 'occlusion', label: 'OCCLUSION', title: 'PARTIAL OCCLUSION', description: 'A full block touches a half slab and a stair. Only the actually covered half-face tiles are culled.',
    cells: [
      full(6,1,7,1),
      bottomSlab(7,1,7,2),
      stair(6,1,8,RIFT_BLOCK_ROTATIONS.south,4),
      topSlab(5,1,7,3)
    ]
  }
];

const LAB_EXPECTED = Object.freeze({
  all: Object.freeze({ blocks: 14, occupiedMicrovoxels: 84, visibleMicroFaces: 288, culledMicroFaces: 216, quads: 114, vertexCount: 456, triangles: 228 }),
  full: Object.freeze({ blocks: 2, occupiedMicrovoxels: 16, visibleMicroFaces: 40, culledMicroFaces: 56, quads: 10, vertexCount: 40, triangles: 20 }),
  slabs: Object.freeze({ blocks: 6, occupiedMicrovoxels: 24, visibleMicroFaces: 84, culledMicroFaces: 60, quads: 32, vertexCount: 128, triangles: 64 }),
  stairs: Object.freeze({ blocks: 4, occupiedMicrovoxels: 24, visibleMicroFaces: 88, culledMicroFaces: 56, quads: 40, vertexCount: 160, triangles: 80 }),
  staircase: Object.freeze({ blocks: 3, occupiedMicrovoxels: 18, visibleMicroFaces: 66, culledMicroFaces: 42, quads: 30, vertexCount: 120, triangles: 60 }),
  mixed: Object.freeze({ blocks: 8, occupiedMicrovoxels: 48, visibleMicroFaces: 148, culledMicroFaces: 140, quads: 58, vertexCount: 232, triangles: 116 }),
  occlusion: Object.freeze({ blocks: 4, occupiedMicrovoxels: 22, visibleMicroFaces: 66, culledMicroFaces: 66, quads: 25, vertexCount: 100, triangles: 50 })
});

export const RIFT_BLOCK_SHAPE_LAB_SCENES = Object.freeze(LAB_SCENES_RAW.map(scene => Object.freeze({
  ...scene,
  expected: LAB_EXPECTED[scene.id]
})));

export function getRiftBlockShapeLabScene(id = 'all') {
  return RIFT_BLOCK_SHAPE_LAB_SCENES.find(scene => scene.id === id) || RIFT_BLOCK_SHAPE_LAB_SCENES[0];
}

export function resolveRiftShapeLabColor({ materialId = 1 } = {}) {
  switch (materialId) {
    case 2: return [0.72, 0.78, 0.82];
    case 3: return [0.83, 0.70, 0.50];
    case 4: return [0.63, 0.77, 0.56];
    case 5: return [0.68, 0.58, 0.82];
    case 1:
    default: return [0.63, 0.48, 0.34];
  }
}

export function validateRiftBlockShapes() {
  const failures = [];

  const legacy = decodeRiftBlockState(5);
  if (legacy.material !== 5 || legacy.shape !== RIFT_BLOCK_SHAPES.full || legacy.occupancyMask !== FULL_MASK) {
    failures.push('legacy material-only state no longer decodes as a full block');
  }

  const bottom = decodeRiftBlockState(encodeRiftBlockState({ material: 2, shape: RIFT_BLOCK_SHAPES.bottomSlab }));
  const top = decodeRiftBlockState(encodeRiftBlockState({ material: 3, shape: RIFT_BLOCK_SHAPES.topSlab }));
  if (bottom.occupancyMask !== BOTTOM_SLAB_MASK || top.occupancyMask !== TOP_SLAB_MASK) failures.push('slab occupancy masks are invalid');

  for (let rotation = 0; rotation < 4; rotation += 1) {
    const decoded = decodeRiftBlockState(encodeRiftBlockState({ material: 4, shape: RIFT_BLOCK_SHAPES.stair, rotation }));
    if (decoded.occupancyMask !== STAIR_MASKS[rotation]) failures.push(`stair rotation ${rotation} occupancy mask is invalid`);
  }

  const fullPair = buildRiftPartialShapeGeometry({ cells: [full(0,0,0), full(1,0,0)] });
  if (fullPair.visibleMicroFaces !== 40 || fullPair.culledMicroFaces !== 56 || fullPair.quads !== 10 || fullPair.triangles !== 20) {
    failures.push(`full-pair compatibility expected 40 exposed half-face tiles / 56 internally-or-neighbor-hidden tiles / 10 merged quads / 20 tris, got ${fullPair.visibleMicroFaces}/${fullPair.culledMicroFaces}/${fullPair.quads}/${fullPair.triangles}`);
  }

  const slabPair = buildRiftPartialShapeGeometry({ cells: [bottomSlab(0,0,0), bottomSlab(1,0,0)] });
  if (!(slabPair.culledMicroFaces > 0 && slabPair.quads < slabPair.visibleMicroFaces)) failures.push('touching slabs did not partially cull/merge micro faces');

  const fullSlab = buildRiftPartialShapeGeometry({ cells: [full(0,0,0), bottomSlab(1,0,0)] });
  if (fullSlab.culledMicroFaces !== 36) failures.push(`full↔bottom-slab total hidden half-face tiles should be 36, got ${fullSlab.culledMicroFaces}`);

  const stairRotations = new Set();
  for (let rotation = 0; rotation < 4; rotation += 1) {
    stairRotations.add(decodeRiftBlockState(stair(0,0,0,rotation).state).occupancyMask);
  }
  if (stairRotations.size !== 4) failures.push('four stair rotations are not unique');

  for (const scene of RIFT_BLOCK_SHAPE_LAB_SCENES) {
    const geometry = buildRiftPartialShapeGeometry({ cells: scene.cells });
    for (const key of ['blocks','occupiedMicrovoxels','visibleMicroFaces','culledMicroFaces','quads','vertexCount','triangles']) {
      if (geometry[key] !== scene.expected[key]) failures.push(`${scene.id} ${key} changed from ${scene.expected[key]} to ${geometry[key]}`);
    }
    if (geometry.visibleMicroFaces + geometry.culledMicroFaces !== geometry.theoreticalMicroFaces) {
      failures.push(`${scene.id} micro-face accounting is inconsistent`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    scenes: RIFT_BLOCK_SHAPE_LAB_SCENES.map(scene => ({ id: scene.id, ...scene.expected }))
  };
}
