export const RIFT_INTERIOR_ARCHITECTURE_VERSION = 1;
export const RIFT_INTERIOR_MIN_CLEAR_HEIGHT = 4;

const SIDES = ['north', 'east', 'south', 'west'];
const DIR = Object.freeze({
  north: [0, 0, -1],
  east: [1, 0, 0],
  south: [0, 0, 1],
  west: [-1, 0, 0]
});

const key = (x, y, z) => `${x}|${y}|${z}`;

function fail(message, path) {
  const error = new Error(message);
  if (path) error.path = path;
  throw error;
}

function asObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} must be an object.`, path);
  return value;
}

function asInt(value, path) {
  const number = Number(value);
  if (!Number.isInteger(number)) fail(`${path} must be an integer.`, path);
  return number;
}

function asPositiveInt(value, path, max = Infinity) {
  const number = asInt(value, path);
  if (number < 1 || number > max) fail(`${path} must be 1..${max}.`, path);
  return number;
}

function asVec2(value, path) {
  if (!Array.isArray(value) || value.length !== 2) fail(`${path} must be [x,z].`, path);
  return value.map((item, index) => asInt(item, `${path}[${index}]`));
}

function asTags(value, path) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(`${path} must be an array.`, path);
  return [...new Set(value.map((item, index) => {
    const tag = String(item || '').trim();
    if (!tag) fail(`${path}[${index}] cannot be empty.`, path);
    return tag;
  }))];
}

function asId(value, fallback, path) {
  const id = String(value || fallback || '').trim();
  if (!id) fail(`${path} id is required.`, path);
  return id;
}

function asFloor(value, path, floorCount) {
  return asPositiveInt(value, path, floorCount);
}

function asSide(value, path) {
  const side = String(value || '').toLowerCase();
  if (!SIDES.includes(side)) fail(`${path} must be north/east/south/west.`, path);
  return side;
}

function normalizeRect(raw, path) {
  const min = asVec2(raw.min, `${path}.min`);
  const max = asVec2(raw.max, `${path}.max`);
  if (min[0] > max[0] || min[1] > max[1]) fail(`${path}.min exceeds max.`, path);
  return { min, max };
}

function floorPlane(floor, floorHeight) {
  return (floor - 1) * floorHeight;
}

function rectContains(rect, x, z) {
  return x >= rect.min[0] && x <= rect.max[0] && z >= rect.min[1] && z <= rect.max[1];
}

function rectOverlap(a, b) {
  return !(a.max[0] < b.min[0] || b.max[0] < a.min[0] || a.max[1] < b.min[1] || b.max[1] < a.min[1]);
}

function diag(diagnostics, severity, code, message, extra = {}) {
  diagnostics.push({ severity, code, message, ...extra });
}

function uniqueById(items, path) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) fail(`${path} contains duplicate id '${item.id}'.`, path);
    seen.add(item.id);
  }
}

function normalizeSpaces(raw, floorCount, floorHeight, minimumClearHeight) {
  const spaces = (raw || []).map((item, index) => {
    const path = `building.interior.spaces[${index}]`;
    item = asObject(item, path);
    const rect = normalizeRect(item, path);
    const floor = asFloor(item.floor ?? 1, `${path}.floor`, floorCount);
    const capacity = item.capacity == null ? null : asPositiveInt(item.capacity, `${path}.capacity`, 10000);
    const clearHeight = asPositiveInt(item.clear_height ?? minimumClearHeight, `${path}.clear_height`, Math.max(1, floorHeight - 1));
    if (clearHeight < minimumClearHeight) fail(`${path}.clear_height must be at least the interior minimum of ${minimumClearHeight}m.`, `${path}.clear_height`);
    return {
      id: asId(item.id, `space-${index + 1}`, path),
      name: String(item.name || item.id || `Space ${index + 1}`),
      floor,
      min: rect.min,
      max: rect.max,
      capacity,
      clearHeight,
      tags: asTags(item.tags, `${path}.tags`)
    };
  });
  uniqueById(spaces, 'building.interior.spaces');
  return spaces;
}

function normalizeWalls(raw, floorCount, floorHeight, resolveState) {
  const walls = (raw || []).map((item, index) => {
    const path = `building.interior.walls[${index}]`;
    item = asObject(item, path);
    const rect = normalizeRect(item, path);
    const floor = asFloor(item.floor, `${path}.floor`, floorCount);
    const height = asPositiveInt(item.height ?? floorHeight - 1, `${path}.height`, Math.max(1, floorHeight - 1));
    const state = String(item.state || '').trim();
    resolveState(state, `${path}.state`);
    return {
      id: asId(item.id, `wall-${index + 1}`, path),
      floor,
      min: rect.min,
      max: rect.max,
      height,
      state,
      tags: asTags(item.tags, `${path}.tags`)
    };
  });
  uniqueById(walls, 'building.interior.walls');
  return walls;
}

function normalizePortals(raw, spaces, floorCount, floorHeight) {
  const spaceIds = new Set(spaces.map(space => space.id));
  const portals = (raw || []).map((item, index) => {
    const path = `building.interior.portals[${index}]`;
    item = asObject(item, path);
    const floor = asFloor(item.floor, `${path}.floor`, floorCount);
    const at = asVec2(item.at, `${path}.at`);
    const axis = String(item.axis || '').toLowerCase();
    if (axis !== 'x' && axis !== 'z') fail(`${path}.axis must be x or z.`, `${path}.axis`);
    const between = Array.isArray(item.between) && item.between.length === 2
      ? item.between.map(value => String(value || '').trim())
      : fail(`${path}.between must contain two space ids.`, `${path}.between`);
    if (between[0] === between[1]) fail(`${path}.between must connect two different spaces.`, `${path}.between`);
    for (const id of between) if (!spaceIds.has(id)) fail(`${path}.between references unknown space '${id}'.`, `${path}.between`);
    const a = spaces.find(space => space.id === between[0]);
    const b = spaces.find(space => space.id === between[1]);
    if (a.floor !== floor || b.floor !== floor) fail(`${path} must connect spaces on floor ${floor}.`, path);
    return {
      id: asId(item.id, `portal-${index + 1}`, path),
      floor,
      at,
      axis,
      width: asPositiveInt(item.width ?? 2, `${path}.width`, 32),
      height: asPositiveInt(item.height ?? Math.min(3, floorHeight - 1), `${path}.height`, Math.max(1, floorHeight - 1)),
      between,
      tags: asTags(item.tags, `${path}.tags`)
    };
  });
  uniqueById(portals, 'building.interior.portals');
  return portals;
}

function normalizeVoids(raw, floorCount) {
  const voids = (raw || []).map((item, index) => {
    const path = `building.interior.voids[${index}]`;
    item = asObject(item, path);
    const rect = normalizeRect(item, path);
    const floors = Array.isArray(item.floors) && item.floors.length
      ? [...new Set(item.floors.map((floor, floorIndex) => asFloor(floor, `${path}.floors[${floorIndex}]`, floorCount)))]
      : [asFloor(item.floor, `${path}.floor`, floorCount)];
    return {
      id: asId(item.id, `void-${index + 1}`, path),
      kind: String(item.kind || 'floor-opening'),
      floors,
      min: rect.min,
      max: rect.max,
      tags: asTags(item.tags, `${path}.tags`)
    };
  });
  uniqueById(voids, 'building.interior.voids');
  return voids;
}

function normalizeVerticalCores(raw, spaces, floorCount, floorHeight, resolveState) {
  const spaceIds = new Set(spaces.map(space => space.id));
  const cores = (raw || []).map((item, index) => {
    const path = `building.interior.vertical_cores[${index}]`;
    item = asObject(item, path);
    const kind = String(item.kind || 'stair').toLowerCase();
    if (kind !== 'stair') fail(`${path}.kind '${kind}' is unsupported in interior architecture v1.`, `${path}.kind`);
    const fromFloor = asFloor(item.from_floor, `${path}.from_floor`, floorCount);
    const toFloor = asFloor(item.to_floor, `${path}.to_floor`, floorCount);
    if (toFloor !== fromFloor + 1) fail(`${path} must connect consecutive floors in v1.`, path);
    const fromSpace = item.from_space == null ? null : String(item.from_space);
    const toSpace = item.to_space == null ? null : String(item.to_space);
    if (fromSpace && !spaceIds.has(fromSpace)) fail(`${path}.from_space references unknown space '${fromSpace}'.`, `${path}.from_space`);
    if (toSpace && !spaceIds.has(toSpace)) fail(`${path}.to_space references unknown space '${toSpace}'.`, `${path}.to_space`);
    if (fromSpace && spaces.find(space => space.id === fromSpace)?.floor !== fromFloor) fail(`${path}.from_space must be on floor ${fromFloor}.`, `${path}.from_space`);
    if (toSpace && spaces.find(space => space.id === toSpace)?.floor !== toFloor) fail(`${path}.to_space must be on floor ${toFloor}.`, `${path}.to_space`);
    const state = String(item.state || '').trim();
    resolveState(state, `${path}.state`);
    const headClearance = asPositiveInt(item.head_clearance ?? 3, `${path}.head_clearance`, Math.max(3, floorHeight));
    if (headClearance < 2) fail(`${path}.head_clearance must be at least 2m for walkable stairs.`, `${path}.head_clearance`);
    return {
      id: asId(item.id, `vertical-core-${index + 1}`, path),
      kind,
      fromFloor,
      toFloor,
      at: asVec2(item.at, `${path}.at`),
      direction: asSide(item.direction || 'north', `${path}.direction`),
      width: asPositiveInt(item.width ?? 2, `${path}.width`, 32),
      steps: asPositiveInt(item.steps ?? floorHeight, `${path}.steps`, 64),
      headClearance,
      state,
      fromSpace,
      toSpace,
      tags: asTags(item.tags, `${path}.tags`)
    };
  });
  uniqueById(cores, 'building.interior.vertical_cores');
  return cores;
}

function normalizeInterior(building, { floorCount, floorHeight, resolveState }) {
  const raw = building.interior;
  if (!raw) return null;
  asObject(raw, 'building.interior');
  const version = asPositiveInt(raw.version ?? 1, 'building.interior.version', RIFT_INTERIOR_ARCHITECTURE_VERSION);
  const minimumClearHeight = asPositiveInt(raw.minimum_clear_height ?? RIFT_INTERIOR_MIN_CLEAR_HEIGHT, 'building.interior.minimum_clear_height', 16);
  if (minimumClearHeight < RIFT_INTERIOR_MIN_CLEAR_HEIGHT) fail(`building.interior.minimum_clear_height must be at least ${RIFT_INTERIOR_MIN_CLEAR_HEIGHT}m.`, 'building.interior.minimum_clear_height');
  if (minimumClearHeight > floorHeight - 1) fail(`building.interior.minimum_clear_height ${minimumClearHeight}m does not fit floor_height ${floorHeight}m.`, 'building.interior.minimum_clear_height');
  const spaces = normalizeSpaces(raw.spaces, floorCount, floorHeight, minimumClearHeight);
  const walls = normalizeWalls(raw.walls, floorCount, floorHeight, resolveState);
  const portals = normalizePortals(raw.portals, spaces, floorCount, floorHeight);
  const voids = normalizeVoids(raw.voids, floorCount);
  const verticalCores = normalizeVerticalCores(raw.vertical_cores, spaces, floorCount, floorHeight, resolveState);
  const entrySpace = String(raw.entry_space || '').trim() || null;
  if (entrySpace && !spaces.some(space => space.id === entrySpace)) fail(`building.interior.entry_space references unknown space '${entrySpace}'.`, 'building.interior.entry_space');
  return {
    version,
    minimumClearHeight,
    entrySpace,
    requireAllSpacesReachable: raw.require_all_spaces_reachable !== false,
    spaces,
    walls,
    portals,
    voids,
    verticalCores
  };
}

function applyFloorVoids(cells, architecture, floorHeight, diagnostics) {
  const compiled = [];
  for (const authored of architecture.voids) {
    let totalRemoved = 0;
    const floorResults = [];
    for (const floor of authored.floors) {
      const y = floorPlane(floor, floorHeight);
      let removed = 0;
      for (let z = authored.min[1]; z <= authored.max[1]; z += 1) {
        for (let x = authored.min[0]; x <= authored.max[0]; x += 1) {
          const k = key(x, y, z);
          const cell = cells.get(k);
          if (!cell || (cell.role !== 'floor' && cell.role !== 'roof')) continue;
          cells.delete(k);
          removed += 1;
        }
      }
      totalRemoved += removed;
      floorResults.push({ floor, localY: y, removedCells: removed });
      if (!removed) {
        diag(diagnostics, 'error', 'interior_void_missed_floor',
          `${authored.id} removed no floor cells on floor ${floor}.`,
          { path: 'building.interior.voids', interiorId: authored.id, floor });
      }
    }
    compiled.push({ ...authored, floorResults, removedCells: totalRemoved });
  }
  return compiled;
}

function applyWalls(cells, architecture, floorHeight, diagnostics) {
  const compiled = [];
  for (const wall of architecture.walls) {
    const floorY = floorPlane(wall.floor, floorHeight);
    let written = 0;
    let exteriorConflicts = 0;
    let unsupported = 0;
    for (let z = wall.min[1]; z <= wall.max[1]; z += 1) {
      for (let x = wall.min[0]; x <= wall.max[0]; x += 1) {
        if (!cells.has(key(x, floorY, z))) unsupported += 1;
        for (let h = 1; h <= wall.height; h += 1) {
          const k = key(x, floorY + h, z);
          const current = cells.get(k);
          if (current && ['wall', 'window', 'roof'].includes(current.role)) {
            exteriorConflicts += 1;
            continue;
          }
          cells.set(k, {
            state: wall.state,
            role: 'interior-wall',
            group: `interior.wall.${wall.id}`,
            turns: 0
          });
          written += 1;
        }
      }
    }
    if (exteriorConflicts) {
      diag(diagnostics, 'error', 'interior_wall_hits_shell',
        `${wall.id} intersects ${exteriorConflicts} exterior shell cell(s).`,
        { path: 'building.interior.walls', interiorId: wall.id, floor: wall.floor });
    }
    if (unsupported) {
      diag(diagnostics, 'error', 'interior_wall_unsupported',
        `${wall.id} has ${unsupported} footprint cell(s) without floor support.`,
        { path: 'building.interior.walls', interiorId: wall.id, floor: wall.floor });
    }
    compiled.push({ ...wall, writtenCells: written, exteriorConflicts, unsupportedCells: unsupported });
  }
  return compiled;
}

function portalCells(portal, floorHeight) {
  const floorY = floorPlane(portal.floor, floorHeight);
  const start = -Math.floor((portal.width - 1) / 2);
  const end = start + portal.width - 1;
  const cells = [];
  for (let offset = start; offset <= end; offset += 1) {
    const x = portal.at[0] + (portal.axis === 'x' ? offset : 0);
    const z = portal.at[1] + (portal.axis === 'z' ? offset : 0);
    for (let h = 1; h <= portal.height; h += 1) cells.push([x, floorY + h, z]);
  }
  return cells;
}

function applyPortals(cells, architecture, floorHeight, diagnostics) {
  const compiled = [];
  for (const portal of architecture.portals) {
    let removed = 0;
    const expected = portalCells(portal, floorHeight);
    for (const [x, y, z] of expected) {
      const k = key(x, y, z);
      const current = cells.get(k);
      if (!current || current.role !== 'interior-wall') continue;
      cells.delete(k);
      removed += 1;
    }
    if (!removed) {
      diag(diagnostics, 'error', 'interior_portal_missed_wall',
        `${portal.id} did not cut an interior wall.`,
        { path: 'building.interior.portals', interiorId: portal.id, floor: portal.floor });
    }
    compiled.push({ ...portal, removedCells: removed });
  }
  return compiled;
}

function laneOffset(direction, lane) {
  return direction === 'east' || direction === 'west' ? [0, lane] : [lane, 0];
}

function reserveVerticalCoreOpenings(cells, architecture, floorHeight, diagnostics) {
  const stairRuns = [];
  const connectors = [];
  const compiled = [];

  for (const core of architecture.verticalCores) {
    const direction = DIR[core.direction];
    const lowerY = floorPlane(core.fromFloor, floorHeight);
    const upperY = floorPlane(core.toFloor, floorHeight);
    const openingKeys = new Set();
    let removedFloorCells = 0;
    let wallConflicts = 0;

    for (let lane = 0; lane < core.width; lane += 1) {
      const [laneX, laneZ] = laneOffset(core.direction, lane);
      const startX = core.at[0] + laneX;
      const startZ = core.at[1] + laneZ;
      const run = {
        id: `${core.id}.lane-${lane + 1}`,
        at: [startX, lowerY + 1, startZ],
        direction: core.direction,
        steps: core.steps,
        state: core.state,
        head_clearance: core.headClearance,
        _recordConnector: false,
        _interiorCoreId: core.id
      };
      stairRuns.push(run);

      for (let step = 0; step < core.steps; step += 1) {
        const stairY = lowerY + 1 + step;
        if (!(stairY <= upperY && stairY + core.headClearance >= upperY)) continue;
        const x = startX + direction[0] * step;
        const z = startZ + direction[2] * step;
        openingKeys.add(key(x, upperY, z));
      }
    }

    for (const openingKey of openingKeys) {
      const current = cells.get(openingKey);
      if (!current) continue;
      if (current.role === 'interior-wall') {
        wallConflicts += 1;
        continue;
      }
      if (current.role === 'floor' || current.role === 'roof') {
        cells.delete(openingKey);
        removedFloorCells += 1;
      }
    }

    if (!removedFloorCells) {
      diag(diagnostics, 'error', 'vertical_core_no_floor_opening',
        `${core.id} reserved no destination-floor opening; the stair would terminate into a slab.`,
        { path: 'building.interior.vertical_cores', interiorId: core.id, floor: core.toFloor });
    }
    if (wallConflicts) {
      diag(diagnostics, 'error', 'vertical_core_hits_partition',
        `${core.id} intersects ${wallConflicts} interior partition cell(s) inside its required opening.`,
        { path: 'building.interior.vertical_cores', interiorId: core.id, floor: core.toFloor });
    }

    const firstLane = laneOffset(core.direction, Math.floor((core.width - 1) / 2));
    const at = [core.at[0] + firstLane[0], lowerY + 1, core.at[1] + firstLane[1]];
    connectors.push({
      id: core.id,
      kind: 'stair-core',
      at,
      direction: core.direction,
      steps: core.steps,
      width: core.width,
      fromFloor: core.fromFloor,
      toFloor: core.toFloor,
      fromSpace: core.fromSpace,
      toSpace: core.toSpace,
      headClearance: core.headClearance,
      tags: core.tags
    });
    compiled.push({
      ...core,
      openingCells: [...openingKeys].map(value => value.split('|').map(Number)),
      removedFloorCells,
      wallConflicts
    });
  }
  return { stairRuns, connectors, verticalCores: compiled };
}

function checkSpaceWalkability(cells, architecture, floorHeight, diagnostics) {
  const compiled = [];
  for (const space of architecture.spaces) {
    const floorY = floorPlane(space.floor, floorHeight);
    const footprintCells = (space.max[0] - space.min[0] + 1) * (space.max[1] - space.min[1] + 1);
    let supportedCells = 0;
    let walkableCells = 0;
    for (let z = space.min[1]; z <= space.max[1]; z += 1) {
      for (let x = space.min[0]; x <= space.max[0]; x += 1) {
        const support = cells.get(key(x, floorY, z));
        if (!support || !['floor', 'stair'].includes(support.role)) continue;
        supportedCells += 1;
        let clear = true;
        for (let h = 1; h <= space.clearHeight; h += 1) {
          if (cells.has(key(x, floorY + h, z))) {
            clear = false;
            break;
          }
        }
        if (clear) walkableCells += 1;
      }
    }
    const clearRatio = footprintCells ? walkableCells / footprintCells : 0;
    if (!walkableCells) {
      diag(diagnostics, 'error', 'interior_space_not_walkable',
        `${space.id} has no walkable floor cell with ${space.clearHeight}m clear height.`,
        { path: 'building.interior.spaces', interiorId: space.id, floor: space.floor });
    } else if (clearRatio < 0.65) {
      diag(diagnostics, 'error', 'interior_space_clearance_insufficient',
        `${space.id} has ${Math.round(clearRatio * 100)}% of its footprint clear to ${space.clearHeight}m; at least 65% is required.`,
        { path: 'building.interior.spaces', interiorId: space.id, floor: space.floor, clearHeight: space.clearHeight, clearRatio });
    }
    compiled.push({ ...space, footprintCells, supportedCells, walkableCells, clearRatio });
  }
  return compiled;
}

function checkPortalOpenings(cells, architecture, floorHeight, diagnostics) {
  const compiled = [];
  for (const portal of architecture.portals) {
    let blocked = 0;
    const expected = portalCells(portal, floorHeight);
    for (const [x, y, z] of expected) if (cells.has(key(x, y, z))) blocked += 1;
    if (blocked) {
      diag(diagnostics, 'error', 'interior_portal_blocked',
        `${portal.id} has ${blocked} blocked opening cell(s).`,
        { path: 'building.interior.portals', interiorId: portal.id, floor: portal.floor });
    }
    compiled.push({ ...portal, blockedCells: blocked, openingCells: expected });
  }
  return compiled;
}

function checkCoreGeometry(cells, architecture, floorHeight, diagnostics) {
  const compiled = [];
  for (const core of architecture.verticalCores) {
    const direction = DIR[core.direction];
    const lowerY = floorPlane(core.fromFloor, floorHeight);
    const upperY = floorPlane(core.toFloor, floorHeight);
    let missingStairs = 0;
    let blockedHeadroom = 0;
    let bottomLandings = 0;
    let topLandings = 0;

    for (let lane = 0; lane < core.width; lane += 1) {
      const [laneX, laneZ] = laneOffset(core.direction, lane);
      const startX = core.at[0] + laneX;
      const startZ = core.at[1] + laneZ;
      for (let step = 0; step < core.steps; step += 1) {
        const x = startX + direction[0] * step;
        const y = lowerY + 1 + step;
        const z = startZ + direction[2] * step;
        const stair = cells.get(key(x, y, z));
        if (!stair || stair.role !== 'stair') missingStairs += 1;
        for (let h = 1; h <= core.headClearance; h += 1) {
          const above = cells.get(key(x, y + h, z));
          if (above && above.role !== 'stair') blockedHeadroom += 1;
        }
      }
      const bottomX = startX - direction[0];
      const bottomZ = startZ - direction[2];
      const bottomSupport = cells.get(key(bottomX, lowerY, bottomZ));
      if (bottomSupport && ['floor', 'stair'].includes(bottomSupport.role)) bottomLandings += 1;
      const topX = startX + direction[0] * core.steps;
      const topZ = startZ + direction[2] * core.steps;
      const topSupport = cells.get(key(topX, upperY, topZ));
      if (topSupport && ['floor', 'stair'].includes(topSupport.role)) topLandings += 1;
    }

    if (missingStairs) {
      diag(diagnostics, 'error', 'vertical_core_missing_stairs',
        `${core.id} is missing ${missingStairs} authored stair cell(s).`,
        { path: 'building.interior.vertical_cores', interiorId: core.id });
    }
    if (blockedHeadroom) {
      diag(diagnostics, 'error', 'vertical_core_blocked_headroom',
        `${core.id} has ${blockedHeadroom} blocked head-clearance cell(s).`,
        { path: 'building.interior.vertical_cores', interiorId: core.id });
    }
    if (bottomLandings < core.width) {
      diag(diagnostics, 'error', 'vertical_core_bottom_landing_missing',
        `${core.id} has floor support for only ${bottomLandings}/${core.width} bottom landing lanes.`,
        { path: 'building.interior.vertical_cores', interiorId: core.id, floor: core.fromFloor });
    }
    if (topLandings < core.width) {
      diag(diagnostics, 'error', 'vertical_core_top_landing_missing',
        `${core.id} has floor support for only ${topLandings}/${core.width} top landing lanes.`,
        { path: 'building.interior.vertical_cores', interiorId: core.id, floor: core.toFloor });
    }

    compiled.push({ ...core, missingStairs, blockedHeadroom, bottomLandings, topLandings });
  }
  return compiled;
}

function checkSpaceGraph(architecture, diagnostics) {
  if (!architecture.spaces.length) return { reachable: [], unreachable: [], edges: [] };
  const graph = new Map(architecture.spaces.map(space => [space.id, new Set()]));
  const edges = [];
  for (const portal of architecture.portals) {
    const [a, b] = portal.between;
    graph.get(a)?.add(b);
    graph.get(b)?.add(a);
    edges.push({ id: portal.id, kind: 'portal', from: a, to: b });
  }
  for (const core of architecture.verticalCores) {
    if (!core.fromSpace || !core.toSpace) continue;
    graph.get(core.fromSpace)?.add(core.toSpace);
    graph.get(core.toSpace)?.add(core.fromSpace);
    edges.push({ id: core.id, kind: 'vertical-core', from: core.fromSpace, to: core.toSpace });
  }

  const start = architecture.entrySpace || architecture.spaces[0]?.id;
  const visited = new Set(start ? [start] : []);
  const queue = start ? [start] : [];
  while (queue.length) {
    const id = queue.shift();
    for (const next of graph.get(id) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  const unreachable = architecture.spaces.map(space => space.id).filter(id => !visited.has(id));
  if (architecture.requireAllSpacesReachable && unreachable.length) {
    diag(diagnostics, 'error', 'interior_spaces_unreachable',
      `${unreachable.length} interior space(s) are unreachable from '${start}': ${unreachable.join(', ')}.`,
      { path: 'building.interior', unreachableSpaces: unreachable });
  }
  return { entrySpace: start, reachable: [...visited], unreachable, edges };
}

function checkOverlaps(architecture, diagnostics) {
  for (let i = 0; i < architecture.spaces.length; i += 1) {
    const a = architecture.spaces[i];
    for (let j = i + 1; j < architecture.spaces.length; j += 1) {
      const b = architecture.spaces[j];
      if (a.floor !== b.floor || !rectOverlap(a, b)) continue;
      if (a.tags.includes('overlap-ok') || b.tags.includes('overlap-ok')) continue;
      diag(diagnostics, 'warning', 'interior_space_overlap',
        `${a.id} overlaps ${b.id} on floor ${a.floor}.`,
        { path: 'building.interior.spaces', floor: a.floor, spaces: [a.id, b.id] });
    }
  }
}

export function prepareRiftInteriorArchitecture({
  building,
  cells,
  floorCount,
  floorHeight,
  resolveState,
  diagnostics
} = {}) {
  const architecture = normalizeInterior(building, { floorCount, floorHeight, resolveState });
  if (!architecture) return null;

  checkOverlaps(architecture, diagnostics);
  const voids = applyFloorVoids(cells, architecture, floorHeight, diagnostics);
  const walls = applyWalls(cells, architecture, floorHeight, diagnostics);
  const portals = applyPortals(cells, architecture, floorHeight, diagnostics);
  const corePrep = reserveVerticalCoreOpenings(cells, architecture, floorHeight, diagnostics);

  return {
    architecture: {
      ...architecture,
      voids,
      walls,
      portals,
      verticalCores: corePrep.verticalCores
    },
    stairRuns: corePrep.stairRuns,
    connectors: corePrep.connectors
  };
}

export function validateRiftInteriorArchitecture({
  prepared,
  cells,
  floorHeight,
  diagnostics
} = {}) {
  if (!prepared) return null;
  const architecture = prepared.architecture;
  const spaces = checkSpaceWalkability(cells, architecture, floorHeight, diagnostics);
  const portals = checkPortalOpenings(cells, architecture, floorHeight, diagnostics);
  const verticalCores = checkCoreGeometry(cells, architecture, floorHeight, diagnostics);
  const graph = checkSpaceGraph(architecture, diagnostics);
  return {
    ...architecture,
    spaces,
    portals,
    verticalCores,
    graph,
    stats: {
      spaces: spaces.length,
      walls: architecture.walls.length,
      portals: portals.length,
      voids: architecture.voids.length,
      verticalCores: verticalCores.length,
      unreachableSpaces: graph.unreachable.length,
      blockedPortals: portals.filter(portal => portal.blockedCells > 0).length,
      invalidVerticalCores: verticalCores.filter(core =>
        core.missingStairs || core.blockedHeadroom || core.bottomLandings < core.width || core.topLandings < core.width
      ).length
    }
  };
}
