import { RIFT_BLOCK_SHAPES } from './rift-block-shapes.js';

const BASE_LAYER = 'base';
const WALL_SIDES = Object.freeze(['north', 'east', 'south', 'west']);
const ROOF_ATTACHMENT_MAX_RISE = 8;

function asInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function normalizeOrigin(origin = [0, 0, 0]) {
  return [asInt(origin?.[0]), asInt(origin?.[1]), asInt(origin?.[2])];
}

function safeId(value, fallback) {
  const id = String(value || '').trim().replace(/[^a-zA-Z0-9_.:/-]+/g, '-').replace(/^-+|-+$/g, '');
  return id || fallback;
}

function normalizeBox(op, origin) {
  if (!Array.isArray(op?.min) || !Array.isArray(op?.max) || op.min.length < 3 || op.max.length < 3) return null;
  const min = [0, 1, 2].map(index => Math.min(asInt(op.min[index]), asInt(op.max[index])) + origin[index]);
  const max = [0, 1, 2].map(index => Math.max(asInt(op.min[index]), asInt(op.max[index])) + origin[index]);
  return { min, max };
}

function normalizeOpBounds(op, origin) {
  const type = String(op?.op || '').toLowerCase();
  if (type === 'set') {
    if (!Array.isArray(op?.at) || op.at.length < 3) return null;
    const at = [0, 1, 2].map(index => asInt(op.at[index]) + origin[index]);
    return { min: [...at], max: [...at] };
  }
  if (type === 'fill_box' || type === 'hollow_box') return normalizeBox(op, origin);
  return null;
}

export function riftVisibilityRoofLayer(structureId) {
  return `structure:${structureId}:roof`;
}

export function riftVisibilityWallLayer(structureId, side) {
  return `structure:${structureId}:wall:${side}`;
}

export function riftVisibilityBaseLayer(structureId) {
  return `structure:${structureId}:base`;
}

export function riftVisibilityInteriorLayer(structureId) {
  return `structure:${structureId}:interior`;
}

export function riftVisibilityPartialLayer(structureId) {
  return `structure:${structureId}:partial`;
}

function horizontalOverlapArea(box, structure) {
  const minX = Math.max(box.min[0], structure.bounds.min[0]);
  const maxX = Math.min(box.max[0] + 1, structure.bounds.max[0] + 1);
  const minZ = Math.max(box.min[2], structure.bounds.min[2]);
  const maxZ = Math.min(box.max[2] + 1, structure.bounds.max[2] + 1);
  return Math.max(0, maxX - minX) * Math.max(0, maxZ - minZ);
}

function boxFootprintArea(box) {
  return Math.max(1, box.max[0] - box.min[0] + 1) * Math.max(1, box.max[2] - box.min[2] + 1);
}

function boxesOverlap3D(a, b) {
  return a.min[0] <= b.max[0] && a.max[0] >= b.min[0]
    && a.min[1] <= b.max[1] && a.max[1] >= b.min[1]
    && a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
}

function rootMatchesStructure(op, structure) {
  const root = safeId(op?._blueprintRootId || '', '');
  return !!root && (root === structure.sourceId || root === structure.id);
}

function assignRoofAttachments(ops, structures, origin) {
  const candidates = Array.isArray(ops) ? ops : [];
  for (let index = 0; index < candidates.length; index += 1) {
    const op = candidates[index];
    const type = String(op?.op || '').toLowerCase();
    if (type !== 'set' && type !== 'fill_box') continue;
    const bounds = normalizeOpBounds(op, origin);
    if (!bounds) continue;

    // Geometry that already lives inside an authored shell belongs to that shell/floor.
    // This keeps upper-floor furniture from being mistaken for a lower roof attachment.
    const overlapsShellVolume = structures.some(structure => (
      structure.sourceOpIndex !== index && boxesOverlap3D(bounds, structure.bounds)
    ));
    if (overlapsShellVolume) continue;

    const footprintArea = boxFootprintArea(bounds);
    const eligible = structures.filter(structure => {
      if (structure.sourceOpIndex === index) return false;
      const rise = bounds.min[1] - structure.roofY;
      if (rise < 1 || rise > ROOF_ATTACHMENT_MAX_RISE) return false;
      const overlap = horizontalOverlapArea(bounds, structure);
      if (overlap <= 0) return false;
      const coverage = overlap / footprintArea;
      return coverage >= 0.5 || rootMatchesStructure(op, structure);
    });

    if (!eligible.length) continue;
    eligible.sort((a, b) => {
      const rootDelta = Number(rootMatchesStructure(op, b)) - Number(rootMatchesStructure(op, a));
      if (rootDelta) return rootDelta;
      if (b.roofY !== a.roofY) return b.roofY - a.roofY;
      return (a.volume || 0) - (b.volume || 0);
    });
    const owner = eligible[0];
    owner.roofAttachments.push({
      sourceOpIndex: index,
      name: String(op.name || op._blueprintObjectId || `Roof attachment ${index + 1}`),
      bounds
    });
  }
}

export function buildRiftVisibilityStructures(ops = [], { origin = [0, 0, 0] } = {}) {
  const worldOrigin = normalizeOrigin(origin);
  const structures = [];
  const usedIds = new Set();

  (Array.isArray(ops) ? ops : []).forEach((op, index) => {
    if (String(op?.op || '').toLowerCase() !== 'hollow_box') return;
    const bounds = normalizeBox(op, worldOrigin);
    if (!bounds) return;
    const width = bounds.max[0] - bounds.min[0] + 1;
    const height = bounds.max[1] - bounds.min[1] + 1;
    const depth = bounds.max[2] - bounds.min[2] + 1;
    const wallThickness = Math.max(1, Math.min(8, asInt(op.wall_thickness ?? 1, 1)));
    if (height < 3 || width < wallThickness * 2 + 1 || depth < wallThickness * 2 + 1) return;

    const sourceId = safeId(op._blueprintRootId || op._blueprintObjectId || op.name, `shell-${index + 1}`);
    let id = sourceId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${sourceId}-${suffix++}`;
    usedIds.add(id);

    structures.push({
      id,
      sourceId,
      sourceOpIndex: index,
      name: String(op.name || op._blueprintObjectId || `Structure ${structures.length + 1}`),
      bounds,
      wallThickness,
      floorY: bounds.min[1],
      roofY: bounds.max[1],
      interior: {
        minX: bounds.min[0] + wallThickness,
        maxX: bounds.max[0] - wallThickness + 1,
        minZ: bounds.min[2] + wallThickness,
        maxZ: bounds.max[2] - wallThickness + 1,
        minY: bounds.min[1] + 0.75,
        maxY: bounds.max[1] + 0.05
      },
      roofAttachments: [],
      volume: width * height * depth,
      layers: {
        base: riftVisibilityBaseLayer(id),
        interior: riftVisibilityInteriorLayer(id),
        partial: riftVisibilityPartialLayer(id),
        roof: riftVisibilityRoofLayer(id),
        walls: Object.fromEntries(WALL_SIDES.map(side => [side, riftVisibilityWallLayer(id, side)]))
      }
    });
  });

  assignRoofAttachments(ops, structures, worldOrigin);
  return structures;
}

function coordinateInsideCellBounds(value, minCell, maxCell) {
  return value >= minCell && value < maxCell + 1;
}

function cellInsideBounds(x, y, z, bounds) {
  return x >= bounds.min[0] && x <= bounds.max[0]
    && y >= bounds.min[1] && y <= bounds.max[1]
    && z >= bounds.min[2] && z <= bounds.max[2];
}

function cellInsideAnyBox(x, y, z, boxes = []) {
  return (boxes || []).some(entry => cellInsideBounds(x, y, z, entry.bounds || entry));
}

function wallSidesForCell(structure, x, z) {
  const { min, max } = structure.bounds;
  const thickness = structure.wallThickness;
  const sides = [];
  if (x < min[0] + thickness) sides.push('west');
  if (x > max[0] - thickness) sides.push('east');
  if (z < min[2] + thickness) sides.push('north');
  if (z > max[2] - thickness) sides.push('south');
  return sides;
}

function pickWallSide(sides, faceId) {
  if (!sides.length) return null;
  if (sides.includes(faceId)) return faceId;
  if ((faceId === 'east' || faceId === 'west')) {
    const xSide = sides.find(side => side === 'east' || side === 'west');
    if (xSide) return xSide;
  }
  if ((faceId === 'north' || faceId === 'south')) {
    const zSide = sides.find(side => side === 'north' || side === 'south');
    if (zSide) return zSide;
  }
  return sides[0];
}

export function classifyRiftVisibilityFace({
  structures = [],
  worldX = 0,
  worldY = 0,
  worldZ = 0,
  shape = RIFT_BLOCK_SHAPES.full,
  face = null
} = {}) {
  const x = asInt(worldX);
  const y = asInt(worldY);
  const z = asInt(worldZ);
  const faceId = String(face?.id || '').toLowerCase();

  // Small/nested shells get first ownership of their own geometry. This lets a holding
  // cell or garage bay cut away independently while the surrounding station floor stays live.
  const orderedStructures = [...(structures || [])].sort((a, b) => (a.volume || 0) - (b.volume || 0));
  for (const structure of orderedStructures) {
    if (!cellInsideBounds(x, y, z, structure.bounds)) continue;

    // Partial gameplay shapes are semantic whole pieces. They may be hidden only
    // when an entire upper floor is suppressed; they are never sliced by a fragment mask.
    if (shape !== RIFT_BLOCK_SHAPES.full) return structure.layers.partial;

    if (y === structure.floorY) return structure.layers.base;
    if (y === structure.roofY) return structure.layers.roof;

    if (y > structure.floorY && y < structure.roofY) {
      const sides = wallSidesForCell(structure, x, z);
      if (sides.length) {
        // Keep a one-metre wall stub around the currently visible floor so room edges
        // remain readable when the upper wall layer is removed.
        if (y <= structure.floorY + 1) return structure.layers.base;
        const side = pickWallSide(sides, faceId);
        return side ? structure.layers.walls[side] : structure.layers.base;
      }
      return structure.layers.interior;
    }
  }

  // Rooftop utility boxes, vents, parapets, signs and similar authored block geometry
  // inherit the roof layer of the shell they physically sit on. They therefore disappear
  // only when that roof is intentionally hidden, never from a circular fragment cutout.
  const attachmentOwners = orderedStructures
    .filter(structure => cellInsideAnyBox(x, y, z, structure.roofAttachments))
    .sort((a, b) => b.roofY - a.roofY || (a.volume || 0) - (b.volume || 0));
  if (attachmentOwners.length) return attachmentOwners[0].layers.roof;

  return BASE_LAYER;
}

function pointInsideStructure(structure, position) {
  const x = Number(position?.[0]) || 0;
  const y = Number(position?.[1]) || 0;
  const z = Number(position?.[2]) || 0;
  const interior = structure.interior;
  return x >= interior.minX && x <= interior.maxX
    && z >= interior.minZ && z <= interior.maxZ
    && y >= interior.minY && y <= interior.maxY;
}

function segmentAabbIntersection3D(a, b, min, max) {
  let tEnter = 0;
  let tExit = 1;
  for (let axis = 0; axis < 3; axis += 1) {
    const start = Number(a?.[axis]) || 0;
    const end = Number(b?.[axis]) || 0;
    const delta = end - start;
    const lo = min[axis];
    const hi = max[axis];
    if (Math.abs(delta) < 1e-9) {
      if (start < lo || start > hi) return null;
      continue;
    }
    let near = (lo - start) / delta;
    let far = (hi - start) / delta;
    if (near > far) [near, far] = [far, near];
    tEnter = Math.max(tEnter, near);
    tExit = Math.min(tExit, far);
    if (tEnter > tExit) return null;
  }
  if (tExit <= 0.02 || tEnter >= 0.985) return null;
  return { tEnter, tExit };
}

function segmentRectEntrySides2D(ax, az, bx, bz, minX, minZ, maxX, maxZ) {
  const dx = bx - ax;
  const dz = bz - az;
  let tEnter = 0;
  let tExit = 1;
  let entrySides = [];
  const axes = [
    { start: ax, delta: dx, min: minX, max: maxX, minSide: 'west', maxSide: 'east' },
    { start: az, delta: dz, min: minZ, max: maxZ, minSide: 'north', maxSide: 'south' }
  ];

  for (const axis of axes) {
    if (Math.abs(axis.delta) < 1e-9) {
      if (axis.start < axis.min || axis.start > axis.max) return null;
      continue;
    }
    let near = (axis.min - axis.start) / axis.delta;
    let far = (axis.max - axis.start) / axis.delta;
    let nearSide = axis.minSide;
    if (near > far) {
      [near, far] = [far, near];
      nearSide = axis.maxSide;
    }
    if (near > tEnter + 1e-6) {
      tEnter = near;
      entrySides = [nearSide];
    } else if (Math.abs(near - tEnter) <= 1e-6 && near > 0) {
      entrySides.push(nearSide);
    }
    tExit = Math.min(tExit, far);
    if (tEnter > tExit) return null;
  }

  if (tExit <= 0.02 || tEnter >= 0.985) return null;
  return { tEnter, tExit, sides: [...new Set(entrySides)] };
}

function cameraFacingSides(structure, cameraPosition) {
  const centerX = (structure.bounds.min[0] + structure.bounds.max[0] + 1) * 0.5;
  const centerZ = (structure.bounds.min[2] + structure.bounds.max[2] + 1) * 0.5;
  const dx = (Number(cameraPosition?.[0]) || 0) - centerX;
  const dz = (Number(cameraPosition?.[2]) || 0) - centerZ;
  const sides = [];
  if (Math.abs(dx) > 0.05) sides.push(dx < 0 ? 'west' : 'east');
  if (Math.abs(dz) > 0.05) sides.push(dz < 0 ? 'north' : 'south');
  return sides;
}

function structureOcclusion(structure, playerPosition, cameraPosition) {
  const playerY = Number(playerPosition?.[1]) || 0;
  if (playerY >= structure.roofY + 0.95) return null;

  const boundsMin = [
    structure.bounds.min[0] - 0.05,
    structure.bounds.min[1] - 0.05,
    structure.bounds.min[2] - 0.05
  ];
  const boundsMax = [
    structure.bounds.max[0] + 1.05,
    structure.bounds.max[1] + 1.05,
    structure.bounds.max[2] + 1.05
  ];
  const hit3D = segmentAabbIntersection3D(cameraPosition, playerPosition, boundsMin, boundsMax);
  if (!hit3D) return null;

  const entry2D = segmentRectEntrySides2D(
    Number(cameraPosition?.[0]) || 0,
    Number(cameraPosition?.[2]) || 0,
    Number(playerPosition?.[0]) || 0,
    Number(playerPosition?.[2]) || 0,
    boundsMin[0],
    boundsMin[2],
    boundsMax[0],
    boundsMax[2]
  );

  const wallSides = entry2D?.sides?.length
    ? entry2D.sides
    : cameraFacingSides(structure, cameraPosition).slice(0, 1);

  return {
    tEnter: hit3D.tEnter,
    tExit: hit3D.tExit,
    wallSides
  };
}

function structureFootprintOverlap(a, b) {
  const minX = Math.max(a.bounds.min[0], b.bounds.min[0]);
  const maxX = Math.min(a.bounds.max[0] + 1, b.bounds.max[0] + 1);
  const minZ = Math.max(a.bounds.min[2], b.bounds.min[2]);
  const maxZ = Math.min(a.bounds.max[2] + 1, b.bounds.max[2] + 1);
  return maxX - minX > 0.25 && maxZ - minZ > 0.25;
}

function allStructureLayerKeys(structure) {
  return [
    structure.layers.base,
    structure.layers.interior,
    structure.layers.partial,
    structure.layers.roof,
    ...Object.values(structure.layers.walls || {})
  ].filter(Boolean);
}

export function resolveRiftBuildingVisibility({
  structures = [],
  playerPosition = [0, 0, 0],
  cameraPosition = [0, 0, 0],
  overview = false,
  exteriorOcclusion = true
} = {}) {
  // H1.74: this function is metadata-only. Third-person camera collision owns
  // visibility, so no camera/player state is allowed to hide authored geometry.
  // We retain containment and line-of-sight records because they are useful for
  // diagnostics, gameplay triggers and the legacy smart-camera regression.
  const hiddenLayers = new Set();
  const insideStructures = [];
  const blockingStructures = [];
  const blockingWallSides = {};
  let blockingScore = 0;

  if (!overview) {
    for (const structure of structures || []) {
      if (pointInsideStructure(structure, playerPosition)) {
        insideStructures.push(structure.id);
        continue;
      }
      if (!exteriorOcclusion) continue;
      const occlusion = structureOcclusion(structure, playerPosition, cameraPosition);
      if (!occlusion) continue;
      blockingStructures.push(structure.id);
      blockingWallSides[structure.id] = [...occlusion.wallSides];
      blockingScore += 1
        + Math.max(0, occlusion.tExit - occlusion.tEnter) * 2
        + Math.max(0, occlusion.wallSides.length - 1) * 0.08;
    }
  }

  return {
    hiddenLayers,
    activeStructures: [...new Set([...insideStructures, ...blockingStructures])],
    insideStructures,
    blockingStructures,
    blockingWallSides,
    blockingScore,
    suppressedStructures: []
  };
}

export function isPointInsideRiftVisibilityStructure(structure, position) {
  return !!structure && pointInsideStructure(structure, position);
}

export function validateRiftBuildingVisibility() {
  const failures = [];
  const structures = buildRiftVisibilityStructures([
    { op: 'hollow_box', name: 'test-shell', min: [2, 1, 2], max: [9, 6, 9], wall_thickness: 1, floor: true },
    { op: 'fill_box', name: 'test rooftop HVAC', min: [4, 7, 4], max: [5, 8, 5], state: 'roof' }
  ]);
  const structure = structures[0];
  if (!structure) failures.push('hollow_box did not produce building metadata');
  if (structure) {
    if (!structure.roofAttachments.length) failures.push('rooftop attachment metadata was not assigned to its supporting structure');

    const inside = resolveRiftBuildingVisibility({ structures, playerPosition: [5.5, 2, 5.5], cameraPosition: [-20, 20, -20] });
    if (!inside.insideStructures.includes(structure.id)) failures.push('inside containment metadata was lost');
    if (inside.hiddenLayers.size) failures.push('inside third-person view attempted to hide building geometry');
    if (inside.suppressedStructures.length) failures.push('inside third-person view attempted upper-floor suppression');

    const exterior = resolveRiftBuildingVisibility({ structures, playerPosition: [14, 2, 5.5], cameraPosition: [-20, 20, 5.5] });
    if (!exterior.blockingStructures.includes(structure.id)) failures.push('camera-blocking structure metadata was not detected');
    if (exterior.hiddenLayers.size) failures.push('exterior third-person view attempted to hide building geometry');

    const overview = resolveRiftBuildingVisibility({ structures, playerPosition: [5.5, 2, 5.5], cameraPosition: [-20, 20, -20], overview: true });
    if (overview.hiddenLayers.size) failures.push('overview attempted to hide building geometry');

    const stacked = buildRiftVisibilityStructures([
      { op: 'hollow_box', name: 'ground', min: [0, 0, 0], max: [8, 4, 8], wall_thickness: 1 },
      { op: 'hollow_box', name: 'upper', min: [0, 5, 0], max: [8, 9, 8], wall_thickness: 1 },
      { op: 'fill_box', name: 'upper desk', min: [2, 6, 2], max: [3, 6, 3], state: 'wood' }
    ]);
    const lower = stacked.find(entry => entry.name === 'ground');
    if (lower?.roofAttachments?.length) failures.push('upper-floor interior geometry was incorrectly assigned as a lower roof attachment');
    const floorView = resolveRiftBuildingVisibility({ structures: stacked, playerPosition: [4.5, 1.5, 4.5], cameraPosition: [-20, 20, -20] });
    if (floorView.hiddenLayers.size || floorView.suppressedStructures.length) failures.push('stacked floors were camera-suppressed in no-cutaway mode');
  }
  return { ok: failures.length === 0, failures };
}
