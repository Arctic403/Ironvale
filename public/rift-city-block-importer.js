import {
  RiftBlockSection,
  RiftSectionGrid,
  RIFT_SECTION_AIR,
  RIFT_SECTION_SIZE,
  riftWorldCellToSection
} from './rift-block-section.js';
import { expandRiftCityBlueprintLayer } from './rift-city-blueprints.js';
import { buildRiftVisibilityStructures } from './rift-building-visibility.js';
import { mergeRiftSharedPalette } from './rift-material-library.js';
import {
  RIFT_BLOCK_ROTATIONS,
  RIFT_BLOCK_SHAPES,
  encodeRiftBlockState,
  riftBlockStateHasPartialShape
} from './rift-block-shapes.js';

export const RIFT_CITY_BLOCK_FORMAT = 'riftcity-city-block';
export const RIFT_CITY_BLOCK_VERSION = 2;
export const RIFT_CITY_BLOCK_LEGACY_VERSION = 1;
export const RIFT_CITY_BLOCK_MAX_VOLUME = 2_000_000;
export const RIFT_CITY_BLOCK_MAX_OP_TOUCHES = 3_000_000;

const SHAPE_NAMES = Object.freeze({
  full: RIFT_BLOCK_SHAPES.full,
  slab_bottom: RIFT_BLOCK_SHAPES.bottomSlab,
  bottom_slab: RIFT_BLOCK_SHAPES.bottomSlab,
  slab_top: RIFT_BLOCK_SHAPES.topSlab,
  top_slab: RIFT_BLOCK_SHAPES.topSlab,
  stair: RIFT_BLOCK_SHAPES.stair
});

const SPECIAL_SHAPES = Object.freeze({
  grass_detail: 'detail',
  grass: 'detail',
  water: 'fluid'
});

const ROTATION_NAMES = Object.freeze({
  north: RIFT_BLOCK_ROTATIONS.north,
  east: RIFT_BLOCK_ROTATIONS.east,
  south: RIFT_BLOCK_ROTATIONS.south,
  west: RIFT_BLOCK_ROTATIONS.west
});

function asInt(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) throw new Error(`${label} must be an integer.`);
  return number;
}

function asVec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} must be [x,y,z].`);
  return value.map((item, index) => asInt(item, `${label}[${index}]`));
}

function normalizeBounds(raw) {
  const min = asVec3(raw?.min, 'bounds.min');
  const max = asVec3(raw?.max, 'bounds.max');
  for (let axis = 0; axis < 3; axis += 1) {
    if (min[axis] > max[axis]) throw new Error(`bounds.min[${axis}] exceeds bounds.max[${axis}].`);
  }
  const size = max.map((value, axis) => value - min[axis] + 1);
  const volume = size[0] * size[1] * size[2];
  if (volume > RIFT_CITY_BLOCK_MAX_VOLUME) {
    throw new Error(`Block bounds contain ${volume.toLocaleString()} cells; importer limit is ${RIFT_CITY_BLOCK_MAX_VOLUME.toLocaleString()}.`);
  }
  return { min, max, size, volume };
}

function normalizeColor(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label}.color must contain three RGB values.`);
  return value.map((component, index) => {
    const number = Number(component);
    if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error(`${label}.color[${index}] must be between 0 and 1.`);
    return number;
  });
}

function finiteNumber(value, fallback, min = -Infinity, max = Infinity) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeFlow(value, label) {
  if (value == null) return [0.8, 0.35];
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${label}.flow must be [x,z].`);
  const x = Number(value[0]), z = Number(value[1]);
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error(`${label}.flow must contain finite numbers.`);
  const length = Math.hypot(x, z);
  return length > 0.0001 ? [x / length, z / length] : [0.8, 0.35];
}

function normalizePalette(rawPalette) {
  if (!rawPalette || typeof rawPalette !== 'object' || Array.isArray(rawPalette)) throw new Error('palette must be an object.');
  const palette = new Map();
  const stateColors = new Map();
  const stateLabels = new Map();
  const mergedPalette = mergeRiftSharedPalette(rawPalette);

  for (const [name, raw] of Object.entries(mergedPalette)) {
    if (!name || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Invalid palette entry ${name || '(unnamed)'}.`);
    if (String(raw.shape || '').toLowerCase() === 'air' || Number(raw.material_id) === 0) {
      palette.set(name, Object.freeze({ name, state: 0, materialId: 0, shape: 'air', rotation: 'north', color: [0, 0, 0], kind: 'air' }));
      continue;
    }

    const materialId = asInt(raw.material_id, `palette.${name}.material_id`);
    if (materialId < 1 || materialId > 255) throw new Error(`palette.${name}.material_id must be 1..255.`);
    const shapeName = String(raw.shape || 'full').toLowerCase();
    const requestedKind = String(raw.kind || '').toLowerCase();
    const specialKind = requestedKind === 'fluid' || requestedKind === 'detail'
      ? requestedKind
      : SPECIAL_SHAPES[shapeName] || null;
    const color = normalizeColor(raw.color || [1, 1, 1], `palette.${name}`);
    const texture = String(raw.texture || name || '').toLowerCase();

    if (specialKind) {
      const entry = Object.freeze({
        name,
        state: 0,
        materialId,
        shape: shapeName,
        rotation: 'north',
        color,
        texture,
        kind: specialKind,
        height: finiteNumber(raw.height, 0.58, 0.08, 1.5),
        width: finiteNumber(raw.width, 0.72, 0.08, 1.5),
        surfaceHeight: finiteNumber(raw.surface_height, 0.86, 0.05, 0.98),
        flow: normalizeFlow(raw.flow, `palette.${name}`),
        flowSpeed: finiteNumber(raw.flow_speed, 0.55, 0, 4)
      });
      palette.set(name, entry);
      continue;
    }

    const shape = SHAPE_NAMES[shapeName];
    if (shape == null) throw new Error(`palette.${name}.shape '${shapeName}' is unsupported.`);
    const rotationName = String(raw.rotation || 'north').toLowerCase();
    const rotation = shape === RIFT_BLOCK_SHAPES.stair ? ROTATION_NAMES[rotationName] : RIFT_BLOCK_ROTATIONS.north;
    if (rotation == null) throw new Error(`palette.${name}.rotation '${rotationName}' is unsupported.`);
    const state = encodeRiftBlockState({ material: materialId, shape, rotation });
    const entry = Object.freeze({ name, state, materialId, shape: shapeName, rotation: rotationName, color, texture, kind: 'solid' });
    palette.set(name, entry);
    stateColors.set(state, color);
    stateLabels.set(state, name);
  }

  if (!palette.size) throw new Error('palette cannot be empty.');
  return { palette, stateColors, stateLabels };
}

function opBox(op, label) {
  const min = asVec3(op?.min, `${label}.min`);
  const max = asVec3(op?.max, `${label}.max`);
  for (let axis = 0; axis < 3; axis += 1) {
    if (min[axis] > max[axis]) throw new Error(`${label}.min[${axis}] exceeds max.`);
  }
  return { min, max, volume: (max[0] - min[0] + 1) * (max[1] - min[1] + 1) * (max[2] - min[2] + 1) };
}

function localInside(bounds, point) {
  return point[0] >= bounds.min[0] && point[0] <= bounds.max[0] &&
    point[1] >= bounds.min[1] && point[1] <= bounds.max[1] &&
    point[2] >= bounds.min[2] && point[2] <= bounds.max[2];
}

function boxInside(bounds, box) {
  return localInside(bounds, box.min) && localInside(bounds, box.max);
}

function addOrigin(point, origin) {
  return [point[0] + origin[0], point[1] + origin[1], point[2] + origin[2]];
}

function resolvePaletteEntry(parsed, key, label, rotationTurns = 0) {
  const name = String(key || '');
  const entry = parsed.palette.get(name);
  if (!entry) throw new Error(`${label} references unknown palette state '${name}'.`);
  const turns = ((Number(rotationTurns) || 0) % 4 + 4) % 4;
  if (!turns || entry.kind !== 'solid' || entry.shape !== 'stair') return entry;

  const baseRotation = ROTATION_NAMES[entry.rotation];
  const rotation = (baseRotation + turns) % 4;
  const state = encodeRiftBlockState({ material: entry.materialId, shape: RIFT_BLOCK_SHAPES.stair, rotation });
  if (!parsed.stateColors.has(state)) parsed.stateColors.set(state, entry.color);
  if (!parsed.stateLabels.has(state)) parsed.stateLabels.set(state, `${name}@${['north', 'east', 'south', 'west'][rotation]}`);
  return Object.freeze({ ...entry, state, rotation: ['north', 'east', 'south', 'west'][rotation] });
}

function requireSolidEntry(parsed, key, label, rotationTurns = 0) {
  const entry = resolvePaletteEntry(parsed, key, label, rotationTurns);
  if (entry.kind !== 'solid') throw new Error(`${label} '${entry.name}' is ${entry.kind}; hollow building shells require a solid block state.`);
  return entry;
}

function createSectionAt(grid, worldX, worldY, worldZ) {
  const x = riftWorldCellToSection(worldX);
  const y = riftWorldCellToSection(worldY);
  const z = riftWorldCellToSection(worldZ);
  let section = grid.getSection(x.section, y.section, z.section);
  if (!section) {
    section = new RiftBlockSection({ sx: x.section, sy: y.section, sz: z.section });
    grid.addSection(section);
  }
  return { section, x: x.local, y: y.local, z: z.local };
}

function writeWorldState(grid, worldX, worldY, worldZ, state) {
  if (state === RIFT_SECTION_AIR) {
    const location = grid.locateWorldCell(worldX, worldY, worldZ);
    if (!location.section) return false;
    return location.section.eraseBlock(location.x, location.y, location.z);
  }
  const location = createSectionAt(grid, worldX, worldY, worldZ);
  return location.section.setBlock(location.x, location.y, location.z, state);
}

function forEachBoxCell(box, callback) {
  for (let y = box.min[1]; y <= box.max[1]; y += 1) {
    for (let z = box.min[2]; z <= box.max[2]; z += 1) {
      for (let x = box.min[0]; x <= box.max[0]; x += 1) callback(x, y, z);
    }
  }
}

function countSectionCells(grid) {
  let cells = 0;
  let partialCells = 0;
  for (const section of grid.sections.values()) {
    for (const state of section.states) {
      if (state === 0) continue;
      cells += 1;
      if (riftBlockStateHasPartialShape(state)) partialCells += 1;
    }
  }
  return { cells, partialCells };
}

function compileSectionMeshes(grid, resolveColor) {
  const meshes = [];
  const totals = { quads: 0, vertices: 0, triangles: 0, shapeAwareSections: 0, visibilityLayers: 0 };
  const sections = [...grid.sections.values()].sort((a, b) => a.sy - b.sy || a.sz - b.sz || a.sx - b.sx);
  for (const section of sections) {
    if (!section.countSolid()) continue;
    // H1.74 deliberately compiles one complete render mesh per RiftSection. Building
    // shell metadata is still collected for future gameplay/streaming uses, but it
    // no longer partitions faces into hideable camera-visibility layers.
    const geometry = grid.buildGeometryForSection(section, { getBlockColor: resolveColor });
    if (geometry.vertexStride !== 9) throw new Error(`Section ${section.sx},${section.sy},${section.sz} lost the 9-float vertex contract.`);
    if (geometry.shapeAware) totals.shapeAwareSections += 1;
    totals.quads += geometry.visibleFaces;
    totals.vertices += geometry.vertexCount;
    totals.triangles += geometry.triangles;
    meshes.push({ section: [section.sx, section.sy, section.sz], geometry, visibilityLayers: [] });
  }
  return { meshes, totals };
}


function specialKey(x, y, z) { return `${x}|${y}|${z}`; }

function pushGeometryQuad(buffer, corners, normal, color, doubleSided = false) {
  const add = (points, faceNormal) => {
    const base = buffer.vertices.length / 9;
    for (const point of points) buffer.vertices.push(
      point[0], point[1], point[2],
      faceNormal[0], faceNormal[1], faceNormal[2],
      color[0], color[1], color[2]
    );
    buffer.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    buffer.quads += 1;
  };
  add(corners, normal);
  if (doubleSided) add([corners[3], corners[2], corners[1], corners[0]], [-normal[0], -normal[1], -normal[2]]);
}

function finishSpecialGeometry(buffer, kind, extra = {}) {
  const vertexCount = buffer.vertices.length / 9;
  const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
  return {
    vertices: new Float32Array(buffer.vertices),
    vertexStride: 9,
    indices: new IndexArray(buffer.indices),
    visibleFaces: buffer.quads,
    quads: buffer.quads,
    vertexCount,
    triangles: buffer.quads * 2,
    shapeAware: true,
    riftSpecialKind: kind,
    ...extra
  };
}

function coordNoise(x, y, z) {
  const value = Math.sin(x * 12.9898 + y * 37.719 + z * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildGrassDetailGeometry(cells) {
  const buffer = { vertices: [], indices: [], quads: 0 };
  for (const cell of cells) {
    const entry = cell.entry;
    const jitter = coordNoise(cell.x, cell.y, cell.z);
    const width = entry.width * (0.82 + jitter * 0.32);
    const height = entry.height * (0.78 + coordNoise(cell.z, cell.x, cell.y) * 0.42);
    const cx = cell.x + 0.5 + (jitter - 0.5) * 0.16;
    const cz = cell.z + 0.5 + (coordNoise(cell.y, cell.z, cell.x) - 0.5) * 0.16;
    const y0 = cell.y + 0.025;
    const y1 = y0 + height;
    const shade = 0.86 + jitter * 0.22;
    const color = entry.color.map(component => Math.max(0, Math.min(1, component * shade)));
    for (const angle of [Math.PI * 0.25, Math.PI * 0.75]) {
      const dx = Math.cos(angle) * width * 0.5;
      const dz = Math.sin(angle) * width * 0.5;
      const corners = [
        [cx - dx, y0, cz - dz],
        [cx - dx, y1, cz - dz],
        [cx + dx, y1, cz + dz],
        [cx + dx, y0, cz + dz]
      ];
      const length = Math.hypot(dx, dz) || 1;
      const normal = [dz / length, 0, -dx / length];
      pushGeometryQuad(buffer, corners, normal, color, true);
    }
  }
  return finishSpecialGeometry(buffer, 'detail');
}

function buildWaterGeometry(cells, cellMap) {
  const buffer = { vertices: [], indices: [], quads: 0 };
  for (const cell of cells) {
    const { x, y, z, entry } = cell;
    const top = y + entry.surfaceHeight;
    const bottom = y + 0.04;
    const color = entry.color;
    const waterAt = (dx, dy, dz) => {
      const neighbor = cellMap.get(specialKey(x + dx, y + dy, z + dz));
      return neighbor?.entry?.kind === 'fluid';
    };
    if (!waterAt(0, 1, 0)) {
      pushGeometryQuad(buffer, [
        [x, top, z], [x, top, z + 1], [x + 1, top, z + 1], [x + 1, top, z]
      ], [0, 1, 0], color, false);
    }
    if (!waterAt(1, 0, 0)) pushGeometryQuad(buffer, [
      [x + 1, bottom, z], [x + 1, top, z], [x + 1, top, z + 1], [x + 1, bottom, z + 1]
    ], [1, 0, 0], color, false);
    if (!waterAt(-1, 0, 0)) pushGeometryQuad(buffer, [
      [x, bottom, z + 1], [x, top, z + 1], [x, top, z], [x, bottom, z]
    ], [-1, 0, 0], color, false);
    if (!waterAt(0, 0, 1)) pushGeometryQuad(buffer, [
      [x + 1, bottom, z + 1], [x + 1, top, z + 1], [x, top, z + 1], [x, bottom, z + 1]
    ], [0, 0, 1], color, false);
    if (!waterAt(0, 0, -1)) pushGeometryQuad(buffer, [
      [x, bottom, z], [x, top, z], [x + 1, top, z], [x + 1, bottom, z]
    ], [0, 0, -1], color, false);
  }
  const first = cells[0]?.entry;
  return finishSpecialGeometry(buffer, 'fluid', {
    riftFlow: first?.flow ? [...first.flow] : [0.8, 0.35],
    riftFlowSpeed: Number(first?.flowSpeed) || 0.55
  });
}

function compileSpecialMeshes(specialCells) {
  const details = [];
  const fluidGroups = new Map();
  let fluidCount = 0;
  for (const cell of specialCells.values()) {
    if (cell.entry.kind === 'fluid') {
      fluidCount += 1;
      const flow = cell.entry.flow || [0.8, 0.35];
      const key = `${cell.entry.name}|${flow[0].toFixed(4)},${flow[1].toFixed(4)}|${Number(cell.entry.flowSpeed || 0).toFixed(4)}`;
      let group = fluidGroups.get(key);
      if (!group) { group = []; fluidGroups.set(key, group); }
      group.push(cell);
    } else if (cell.entry.kind === 'detail') details.push(cell);
  }
  const meshes = [];
  let triangles = 0, quads = 0, vertices = 0, fluidMeshIndex = 0;
  if (details.length) {
    const geometry = buildGrassDetailGeometry(details);
    meshes.push({ section: ['detail', 0, 0], geometry, visibilityLayers: [], specialKind: 'detail' });
    triangles += geometry.triangles; quads += geometry.quads; vertices += geometry.vertexCount;
  }
  for (const fluids of fluidGroups.values()) {
    const geometry = buildWaterGeometry(fluids, specialCells);
    meshes.push({ section: ['fluid', fluidMeshIndex++, 0], geometry, visibilityLayers: [], specialKind: 'fluid' });
    triangles += geometry.triangles; quads += geometry.quads; vertices += geometry.vertexCount;
  }
  return { meshes, details: details.length, fluids: fluidCount, triangles, quads, vertices };
}

export function parseRiftCityBlockJson(input) {
  const document = typeof input === 'string' ? JSON.parse(input) : input;
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('RiftCity block JSON must be an object.');
  if (document.format !== RIFT_CITY_BLOCK_FORMAT) throw new Error(`Expected format '${RIFT_CITY_BLOCK_FORMAT}'.`);
  const version = Number(document.version);
  if (version !== RIFT_CITY_BLOCK_LEGACY_VERSION && version !== RIFT_CITY_BLOCK_VERSION) {
    throw new Error(`Unsupported RiftCity block version ${document.version}; expected ${RIFT_CITY_BLOCK_LEGACY_VERSION} or ${RIFT_CITY_BLOCK_VERSION}.`);
  }
  if (String(document.units || '').toLowerCase() !== 'meters') throw new Error("units must be 'meters'.");
  if (Number(document.grid?.cell_size) !== 1) throw new Error('grid.cell_size must remain exactly 1 meter.');
  if (Number(document.grid?.shape_increment) !== 0.5) throw new Error('grid.shape_increment must be 0.5 for the current full/slab/stair vocabulary.');

  const origin = asVec3(document.origin || [0, 0, 0], 'origin');
  const bounds = normalizeBounds(document.bounds);
  const paletteInfo = normalizePalette(document.palette);
  const blueprint = expandRiftCityBlueprintLayer({ ...document, palette: mergeRiftSharedPalette(document.palette) }, { bounds });
  const ops = blueprint.ops;
  if (!ops.length) throw new Error(version === 1
    ? 'ops must contain at least one operation.'
    : 'RiftCity block v2 requires at least one layout object or raw op.');
  if (ops.length > 20_000) throw new Error('Expanded ops exceeds the 20,000 operation safety limit.');

  return {
    document,
    version,
    id: String(document.id || 'unnamed-block'),
    name: String(document.name || document.id || 'Unnamed RiftCity Block'),
    origin,
    bounds,
    ops,
    blueprint,
    ...paletteInfo
  };
}

export function compileRiftCityBlock(input) {
  const parsed = parseRiftCityBlockJson(input);
  const grid = new RiftSectionGrid();
  const specialCells = new Map();
  let opTouches = 0;
  let writes = 0;

  const touch = volume => {
    opTouches += volume;
    if (opTouches > RIFT_CITY_BLOCK_MAX_OP_TOUCHES) {
      throw new Error(`Block operations touch more than ${RIFT_CITY_BLOCK_MAX_OP_TOUCHES.toLocaleString()} cells.`);
    }
  };
  const clearLocal = (x, y, z) => {
    const local = [x, y, z];
    if (!localInside(parsed.bounds, local)) throw new Error(`Operation writes outside declared bounds at ${x},${y},${z}.`);
    const world = addOrigin(local, parsed.origin);
    const key = specialKey(world[0], world[1], world[2]);
    const specialRemoved = specialCells.delete(key);
    const solidRemoved = writeWorldState(grid, world[0], world[1], world[2], RIFT_SECTION_AIR);
    if (specialRemoved || solidRemoved) writes += 1;
  };
  const writeLocalEntry = (x, y, z, entry) => {
    const local = [x, y, z];
    if (!localInside(parsed.bounds, local)) throw new Error(`Operation writes outside declared bounds at ${x},${y},${z}.`);
    const world = addOrigin(local, parsed.origin);
    const key = specialKey(world[0], world[1], world[2]);
    if (entry.kind === 'fluid' || entry.kind === 'detail') {
      writeWorldState(grid, world[0], world[1], world[2], RIFT_SECTION_AIR);
      specialCells.set(key, { x: world[0], y: world[1], z: world[2], local: [...local], entry });
      writes += 1;
      return;
    }
    specialCells.delete(key);
    if (writeWorldState(grid, world[0], world[1], world[2], entry.state)) writes += 1;
  };

  parsed.ops.forEach((op, index) => {
    const label = op?._blueprintObjectId
      ? `blueprint '${String(op._blueprintObjectId)}' / ops[${index}]`
      : `ops[${index}]`;
    const type = String(op?.op || '').toLowerCase();
    if (type === 'set') {
      const at = asVec3(op.at, `${label}.at`);
      if (!localInside(parsed.bounds, at)) throw new Error(`${label}.at is outside declared bounds.`);
      touch(1);
      writeLocalEntry(at[0], at[1], at[2], resolvePaletteEntry(parsed, op.state, `${label}.state`, op._stateRotationTurns));
      return;
    }

    if (type === 'fill_box' || type === 'cut_box' || type === 'hollow_box') {
      const box = opBox(op, label);
      if (!boxInside(parsed.bounds, box)) throw new Error(`${label} is outside declared bounds.`);
      touch(box.volume);

      if (type === 'fill_box') {
        const entry = resolvePaletteEntry(parsed, op.state, `${label}.state`, op._stateRotationTurns);
        forEachBoxCell(box, (x, y, z) => writeLocalEntry(x, y, z, entry));
        return;
      }
      if (type === 'cut_box') {
        forEachBoxCell(box, clearLocal);
        return;
      }

      const wallEntry = requireSolidEntry(parsed, op.state, `${label}.state`, op._stateRotationTurns);
      const roofEntry = op.roof_state ? requireSolidEntry(parsed, op.roof_state, `${label}.roof_state`, op._stateRotationTurns) : wallEntry;
      const thickness = Math.max(1, Math.min(8, asInt(op.wall_thickness ?? 1, `${label}.wall_thickness`)));
      const floor = op.floor !== false;
      forEachBoxCell(box, (x, y, z) => {
        const edgeX = Math.min(x - box.min[0], box.max[0] - x) < thickness;
        const edgeZ = Math.min(z - box.min[2], box.max[2] - z) < thickness;
        if (floor && y === box.min[1]) writeLocalEntry(x, y, z, wallEntry);
        else if (y === box.max[1]) writeLocalEntry(x, y, z, roofEntry);
        else if (edgeX || edgeZ) writeLocalEntry(x, y, z, wallEntry);
      });
      return;
    }

    throw new Error(`${label}.op '${type}' is unsupported.`);
  });

  const resolveColor = ({ state = 0 } = {}) => parsed.stateColors.get(state) || [1, 1, 1];
  const { cells, partialCells } = countSectionCells(grid);
  const visibilityStructures = buildRiftVisibilityStructures(parsed.ops, { origin: parsed.origin });
  const solidCompilation = compileSectionMeshes(grid, resolveColor);
  const specialCompilation = compileSpecialMeshes(specialCells);
  const meshes = [...solidCompilation.meshes, ...specialCompilation.meshes];
  const totals = solidCompilation.totals;
  const worldMin = addOrigin(parsed.bounds.min, parsed.origin);
  const worldMax = addOrigin(parsed.bounds.max, parsed.origin);
  const center = [
    (worldMin[0] + worldMax[0] + 1) / 2,
    (worldMin[1] + worldMax[1] + 1) / 2,
    (worldMin[2] + worldMax[2] + 1) / 2
  ];

  const stats = {
    operations: parsed.ops.length,
    sourceOperations: parsed.blueprint.sourceOperations,
    blueprintObjects: parsed.blueprint.objects.length,
    prefabCount: parsed.blueprint.prefabCount,
    instances: parsed.blueprint.instanceCount,
    nestedInstances: parsed.blueprint.nestedInstanceCount || 0,
    roads: parsed.blueprint.roadCount,
    intersections: parsed.blueprint.intersectionCount,
    anchors: parsed.blueprint.anchors.length,
    groups: Object.keys(parsed.blueprint.groups || {}).length,
    connections: parsed.blueprint.connections?.length || 0,
    overlaps: parsed.blueprint.validation?.overlaps?.length || 0,
    validationCells: parsed.blueprint.validation?.checkedCells || 0,
    warnings: parsed.blueprint.warnings.length,
    writes,
    cells,
    partialCells,
    sections: grid.size,
    stateBytes: grid.size * (RIFT_SECTION_SIZE ** 3) * Uint16Array.BYTES_PER_ELEMENT,
    quads: totals.quads + specialCompilation.quads,
    vertices: totals.vertices + specialCompilation.vertices,
    triangles: totals.triangles + specialCompilation.triangles,
    fluidCells: specialCompilation.fluids,
    detailCells: specialCompilation.details,
    shapeAwareSections: totals.shapeAwareSections,
    visibilityStructures: visibilityStructures.length,
    visibilityRoofAttachments: visibilityStructures.reduce((sum, structure) => sum + (structure.roofAttachments?.length || 0), 0),
    visibilityLayers: totals.visibilityLayers
  };

  const compiledBlueprintObjects = parsed.blueprint.objects.map(object => ({
    ...object,
    ...(object.origin ? { localOrigin: object.origin, origin: addOrigin(object.origin, parsed.origin) } : {}),
    localBounds: object.bounds,
    bounds: {
      min: addOrigin(object.bounds.min, parsed.origin),
      max: addOrigin(object.bounds.max, parsed.origin)
    }
  }));
  const compiledBlueprintAnchors = parsed.blueprint.anchors.map(anchor => ({
    ...anchor,
    localAt: anchor.at,
    at: addOrigin(anchor.at, parsed.origin)
  }));

  const expected = parsed.document.validation?.expected;
  if (expected && typeof expected === 'object') {
    for (const [key, rawExpected] of Object.entries(expected)) {
      if (!(key in stats)) continue;
      const expectedValue = Number(rawExpected);
      if (!Number.isFinite(expectedValue) || stats[key] !== expectedValue) {
        throw new Error(`Imported block locked ${key} ${stats[key]} != ${rawExpected}.`);
      }
    }
  }

  return {
    id: parsed.id,
    name: parsed.name,
    document: parsed.document,
    grid,
    meshes,
    specialCells,
    palette: parsed.palette,
    stateColors: parsed.stateColors,
    stateLabels: parsed.stateLabels,
    resolveColor,
    blueprint: {
      version: parsed.blueprint.blueprintVersion,
      objects: compiledBlueprintObjects,
      anchors: compiledBlueprintAnchors,
      groups: parsed.blueprint.groups || {},
      connections: parsed.blueprint.connections || [],
      validation: parsed.blueprint.validation || null,
      warnings: parsed.blueprint.warnings
    },
    visibility: {
      mode: 'metadata-only-no-cutaway',
      structures: visibilityStructures
    },
    worldBounds: { min: worldMin, max: worldMax },
    center,
    stats
  };
}

export function validateRiftCityBlockImporter() {
  const failures = [];
  const sample = {
    format: RIFT_CITY_BLOCK_FORMAT,
    version: 1,
    id: 'importer-self-test',
    name: 'Importer Self Test',
    units: 'meters',
    grid: { cell_size: 1, shape_increment: 0.5 },
    origin: [0, 0, 0],
    bounds: { min: [0, 0, 0], max: [3, 3, 3] },
    palette: {
      air: { material_id: 0, shape: 'air', color: [0, 0, 0] },
      solid: { material_id: 1, shape: 'full', color: [0.6, 0.5, 0.4] },
      slab: { material_id: 2, shape: 'slab_bottom', color: [0.7, 0.7, 0.7] },
      stair: { material_id: 2, shape: 'stair', rotation: 'east', color: [0.7, 0.7, 0.7] }
    },
    ops: [
      { op: 'fill_box', state: 'solid', min: [0, 0, 0], max: [3, 0, 3] },
      { op: 'hollow_box', state: 'solid', roof_state: 'solid', floor: true, wall_thickness: 1, min: [0, 1, 0], max: [3, 3, 3] },
      { op: 'cut_box', min: [1, 1, 0], max: [1, 2, 0] },
      { op: 'set', state: 'slab', at: [1, 1, 1] },
      { op: 'set', state: 'stair', at: [2, 1, 1] },
      { op: 'set', state: 'grass_detail', at: [1, 2, 1] },
      { op: 'set', state: 'water', at: [2, 2, 1] }
    ]
  };

  try {
    const result = compileRiftCityBlock(sample);
    if (result.grid.getBlockWorld(1, 1, 0) !== 0) failures.push('cut_box did not clear the test doorway');
    if (!riftBlockStateHasPartialShape(result.grid.getBlockWorld(1, 1, 1))) failures.push('bottom slab did not compile as a partial shape');
    if (!riftBlockStateHasPartialShape(result.grid.getBlockWorld(2, 1, 1))) failures.push('stair did not compile as a partial shape');
    if (result.stats.sections !== 1) failures.push(`self-test section count ${result.stats.sections} != 1`);
    if (result.stats.triangles <= 0 || result.stats.vertices <= 0) failures.push('self-test produced no render geometry');
    if (result.grid.getBlockWorld(1, 2, 1) !== 0 || result.grid.getBlockWorld(2, 2, 1) !== 0) failures.push('detail/fluid states incorrectly became solid collision blocks');
    if (result.stats.detailCells !== 1 || result.stats.fluidCells !== 1) failures.push(`special material counts ${result.stats.detailCells}/${result.stats.fluidCells} != 1/1`);
    if (result.specialCells.get('1|2|1')?.entry?.kind !== 'detail') failures.push('grass detail did not compile into the non-solid detail layer');
    if (result.specialCells.get('2|2|1')?.entry?.kind !== 'fluid') failures.push('water did not compile into the non-solid fluid layer');
  } catch (error) {
    failures.push(error.message);
  }

  const blueprintSample = {
    format: RIFT_CITY_BLOCK_FORMAT,
    version: 2,
    blueprint_version: 1,
    id: 'blueprint-self-test',
    name: 'Blueprint Self Test',
    units: 'meters',
    grid: { cell_size: 1, shape_increment: 0.5 },
    origin: [0, 0, 0],
    bounds: { min: [0, 0, 0], max: [15, 4, 15] },
    palette: {
      air: { material_id: 0, shape: 'air', color: [0, 0, 0] },
      solid: { material_id: 1, shape: 'full', color: [0.55, 0.5, 0.45] },
      stair_n: { material_id: 2, shape: 'stair', rotation: 'north', color: [0.72, 0.72, 0.72] }
    },
    prefabs: {
      doorway: {
        kind: 'building-test',
        bounds: { min: [0, 0, 0], max: [2, 2, 1] },
        tags: ['test-structure'],
        ops: [
          { op: 'fill_box', state: 'solid', min: [0, 0, 0], max: [2, 0, 1] },
          { op: 'set', state: 'stair_n', at: [0, 1, 0] }
        ],
        anchors: {
          door: { at: [0, 1, 0], facing: 'north', tags: ['entrance'] }
        }
      }
    },
    layout: [
      { type: 'instance', id: 'rotated-entry', prefab: 'doorway', origin: [5, 0, 5], rotation: 'east', group: 'buildings' },
      { type: 'road', id: 'test-road', from: [0, 0, 10], to: [15, 0, 10], width: 3, state: 'solid' },
      { type: 'intersection', id: 'test-junction', center: [10, 0, 10], size: [3, 3], state: 'solid' }
    ]
  };

  try {
    const result = compileRiftCityBlock(blueprintSample);
    const rotatedStair = result.grid.getBlockWorld(6, 1, 5);
    const expectedStair = encodeRiftBlockState({ material: 2, shape: RIFT_BLOCK_SHAPES.stair, rotation: RIFT_BLOCK_ROTATIONS.east });
    if (rotatedStair !== expectedStair) failures.push(`blueprint stair rotation ${rotatedStair} != ${expectedStair}`);
    const door = result.blueprint.anchors.find(anchor => anchor.id === 'rotated-entry.door');
    if (!door || door.at.join(',') !== '6,1,5' || door.facing !== 'east') failures.push('blueprint named anchor did not rotate with its prefab instance');
    if (result.stats.instances !== 1 || result.stats.roads !== 1 || result.stats.intersections !== 1) failures.push('blueprint object counts are incorrect');
    if (result.stats.blueprintObjects !== 3) failures.push(`blueprint object count ${result.stats.blueprintObjects} != 3`);
    if (result.stats.operations <= 3) failures.push('blueprint objects did not expand into block operations');
  } catch (error) {
    failures.push(`blueprint self-test: ${error.message}`);
  }

  return { ok: failures.length === 0, failures };
}
