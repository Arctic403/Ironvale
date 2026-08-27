export const RIFT_CITY_BLUEPRINT_VERSION = 1;

const ROTATIONS = Object.freeze(['north', 'east', 'south', 'west']);
const LAYOUT_TYPES = Object.freeze(new Set(['instance', 'prefab', 'road', 'intersection']));
const OP_TYPES = Object.freeze(new Set(['set', 'fill_box', 'cut_box', 'hollow_box']));
const MAX_BLUEPRINT_OBJECTS = 2_000;
const MAX_PREFABS = 512;
const MAX_PREFAB_OPS = 5_000;
const MAX_ANCHORS = 10_000;
const MAX_EXPANDED_OPS = 20_000;
const MAX_PREFAB_DEPTH = 16;
const MAX_VALIDATION_CELLS = 3_000_000;
const MAX_CONNECTIONS = 10_000;
const MAX_GROUPS = 2_000;

function asInt(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) throw new Error(`${label} must be an integer.`);
  return number;
}

function asPositiveInt(value, label, fallback = null) {
  const source = value == null && fallback != null ? fallback : value;
  const number = asInt(source, label);
  if (number < 1) throw new Error(`${label} must be at least 1.`);
  return number;
}

function asVec2(value, label) {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${label} must be [a,b].`);
  return value.map((item, index) => asInt(item, `${label}[${index}]`));
}

function asVec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} must be [x,y,z].`);
  return value.map((item, index) => asInt(item, `${label}[${index}]`));
}

function normalizeBounds(raw, label) {
  const min = asVec3(raw?.min, `${label}.min`);
  const max = asVec3(raw?.max, `${label}.max`);
  for (let axis = 0; axis < 3; axis += 1) {
    if (min[axis] > max[axis]) throw new Error(`${label}.min[${axis}] exceeds max.`);
  }
  return {
    min,
    max,
    size: max.map((value, axis) => value - min[axis] + 1)
  };
}

function pointInside(bounds, point) {
  return point[0] >= bounds.min[0] && point[0] <= bounds.max[0] &&
    point[1] >= bounds.min[1] && point[1] <= bounds.max[1] &&
    point[2] >= bounds.min[2] && point[2] <= bounds.max[2];
}

function boxInside(bounds, box) {
  return pointInside(bounds, box.min) && pointInside(bounds, box.max);
}

function boxesOverlap(a, b) {
  return a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] && a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
}

function normalizeRotation(value, label) {
  if (value == null || value === '') return { name: 'north', turns: 0 };
  if (typeof value === 'number' || /^-?\d+$/.test(String(value))) {
    const degrees = Number(value);
    if (![0, 90, 180, 270, -90, -180, -270].includes(degrees)) {
      throw new Error(`${label} numeric rotation must be 0, 90, 180 or 270 degrees.`);
    }
    const turns = ((Math.round(degrees / 90) % 4) + 4) % 4;
    return { name: ROTATIONS[turns], turns };
  }
  const name = String(value).toLowerCase();
  const turns = ROTATIONS.indexOf(name);
  if (turns < 0) throw new Error(`${label} must be north/east/south/west or a 90-degree increment.`);
  return { name, turns };
}

function rotateFacing(value, turns, label) {
  if (value == null || value === '') return null;
  const base = normalizeRotation(value, label);
  return ROTATIONS[(base.turns + turns) % 4];
}

function normalizeTags(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of strings.`);
  const seen = new Set();
  const tags = [];
  for (const raw of value) {
    const tag = String(raw || '').trim();
    if (!tag) throw new Error(`${label} cannot contain an empty tag.`);
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

function combineTags(...groups) {
  const seen = new Set();
  const tags = [];
  for (const group of groups) {
    for (const tag of group || []) {
      if (!seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    }
  }
  return tags;
}

function normalizeGroup(value) {
  const group = String(value || '').trim();
  return group || null;
}

function opBounds(op, label) {
  const min = asVec3(op?.min, `${label}.min`);
  const max = asVec3(op?.max, `${label}.max`);
  for (let axis = 0; axis < 3; axis += 1) {
    if (min[axis] > max[axis]) throw new Error(`${label}.min[${axis}] exceeds max.`);
  }
  return { min, max };
}

function validatePrefabOp(op, bounds, label) {
  const type = String(op?.op || '').toLowerCase();
  if (!OP_TYPES.has(type)) throw new Error(`${label}.op '${type}' is unsupported inside a prefab.`);
  if (type === 'set') {
    const at = asVec3(op.at, `${label}.at`);
    if (!pointInside(bounds, at)) throw new Error(`${label}.at is outside its prefab bounds.`);
    return;
  }
  const box = opBounds(op, label);
  if (!boxInside(bounds, box)) throw new Error(`${label} is outside its prefab bounds.`);
}

function transformNormalizedPoint(point, size, turns) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const width = size[0];
  const depth = size[2];
  switch (turns) {
    case 1: return [depth - 1 - z, y, x];
    case 2: return [width - 1 - x, y, depth - 1 - z];
    case 3: return [z, y, width - 1 - x];
    default: return [x, y, z];
  }
}

function transformPrefabPoint(point, prefabBounds, origin, turns) {
  const normalized = [
    point[0] - prefabBounds.min[0],
    point[1] - prefabBounds.min[1],
    point[2] - prefabBounds.min[2]
  ];
  const rotated = transformNormalizedPoint(normalized, prefabBounds.size, turns);
  return [origin[0] + rotated[0], origin[1] + rotated[1], origin[2] + rotated[2]];
}

function transformPrefabBox(box, prefabBounds, origin, turns) {
  const corners = [
    [box.min[0], box.min[1], box.min[2]],
    [box.min[0], box.min[1], box.max[2]],
    [box.max[0], box.min[1], box.min[2]],
    [box.max[0], box.min[1], box.max[2]],
    [box.min[0], box.max[1], box.min[2]],
    [box.min[0], box.max[1], box.max[2]],
    [box.max[0], box.max[1], box.min[2]],
    [box.max[0], box.max[1], box.max[2]]
  ].map(point => transformPrefabPoint(point, prefabBounds, origin, turns));

  return {
    min: [
      Math.min(...corners.map(point => point[0])),
      Math.min(...corners.map(point => point[1])),
      Math.min(...corners.map(point => point[2]))
    ],
    max: [
      Math.max(...corners.map(point => point[0])),
      Math.max(...corners.map(point => point[1])),
      Math.max(...corners.map(point => point[2]))
    ]
  };
}

function transformedPrefabBounds(prefabBounds, origin, turns) {
  const width = turns % 2 === 0 ? prefabBounds.size[0] : prefabBounds.size[2];
  const depth = turns % 2 === 0 ? prefabBounds.size[2] : prefabBounds.size[0];
  return {
    min: [...origin],
    max: [origin[0] + width - 1, origin[1] + prefabBounds.size[1] - 1, origin[2] + depth - 1]
  };
}

function transformPrefabOp(op, prefabBounds, origin, turns, sourceId) {
  const type = String(op.op || '').toLowerCase();
  const base = { ...op, _blueprintObjectId: sourceId, _stateRotationTurns: turns };
  if (type === 'set') {
    base.at = transformPrefabPoint(asVec3(op.at, `${sourceId}.at`), prefabBounds, origin, turns);
    return base;
  }
  const box = transformPrefabBox(opBounds(op, sourceId), prefabBounds, origin, turns);
  base.min = box.min;
  base.max = box.max;
  return base;
}

function normalizeAnchor(raw, label) {
  const anchor = Array.isArray(raw) ? { at: raw } : raw;
  if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) throw new Error(`${label} must be an anchor object or [x,y,z].`);
  return {
    at: asVec3(anchor.at, `${label}.at`),
    facing: anchor.facing == null ? null : normalizeRotation(anchor.facing, `${label}.facing`).name,
    group: normalizeGroup(anchor.group),
    tags: normalizeTags(anchor.tags, `${label}.tags`),
    note: anchor.note == null ? null : String(anchor.note)
  };
}

function normalizePrefabs(rawPrefabs) {
  if (rawPrefabs == null) return new Map();
  if (!rawPrefabs || typeof rawPrefabs !== 'object' || Array.isArray(rawPrefabs)) throw new Error('prefabs must be an object keyed by prefab name.');
  const names = Object.keys(rawPrefabs);
  if (names.length > MAX_PREFABS) throw new Error(`prefabs exceeds the ${MAX_PREFABS} prefab safety limit.`);
  const prefabs = new Map();

  for (const name of names) {
    const raw = rawPrefabs[name];
    const label = `prefabs.${name}`;
    if (!name.trim()) throw new Error('prefab names cannot be empty.');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${label} must be an object.`);
    const bounds = normalizeBounds(raw.bounds, `${label}.bounds`);
    const ops = Array.isArray(raw.ops) ? raw.ops : [];
    const instances = Array.isArray(raw.instances) ? raw.instances : [];
    if (!ops.length && !instances.length) throw new Error(`${label} must contain ops and/or nested instances.`);
    if (ops.length > MAX_PREFAB_OPS) throw new Error(`${label}.ops exceeds the ${MAX_PREFAB_OPS} operation safety limit.`);
    ops.forEach((op, index) => validatePrefabOp(op, bounds, `${label}.ops[${index}]`));

    instances.forEach((instance, index) => {
      const childLabel = `${label}.instances[${index}]`;
      if (!instance || typeof instance !== 'object' || Array.isArray(instance)) throw new Error(`${childLabel} must be an object.`);
      const prefabName = String(instance.prefab || '').trim();
      if (!prefabName) throw new Error(`${childLabel}.prefab is required.`);
      asVec3(instance.origin ?? instance.at ?? [0, 0, 0], `${childLabel}.origin`);
      normalizeRotation(instance.rotation, `${childLabel}.rotation`);
      normalizeTags(instance.tags, `${childLabel}.tags`);
    });

    const anchors = new Map();
    if (raw.anchors != null) {
      if (!raw.anchors || typeof raw.anchors !== 'object' || Array.isArray(raw.anchors)) throw new Error(`${label}.anchors must be an object.`);
      for (const [anchorName, anchorRaw] of Object.entries(raw.anchors)) {
        if (!anchorName.trim()) throw new Error(`${label}.anchors contains an empty anchor name.`);
        const anchor = normalizeAnchor(anchorRaw, `${label}.anchors.${anchorName}`);
        if (!pointInside(bounds, anchor.at)) throw new Error(`${label}.anchors.${anchorName}.at is outside its prefab bounds.`);
        anchors.set(anchorName, anchor);
      }
    }

    prefabs.set(name, {
      name,
      kind: String(raw.kind || 'structure'),
      bounds,
      ops,
      instances,
      anchors,
      group: normalizeGroup(raw.group),
      tags: normalizeTags(raw.tags, `${label}.tags`)
    });
  }
  return prefabs;
}

function asRoadPoint(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be [x,z] or [x,y,z].`);
  if (value.length === 2) {
    const pair = asVec2(value, label);
    return [pair[0], 0, pair[1]];
  }
  return asVec3(value, label);
}

function appendFill(ops, state, min, max, objectId, name = null) {
  ops.push({
    op: 'fill_box',
    state,
    min,
    max,
    ...(name ? { name } : {}),
    _blueprintObjectId: objectId,
    _stateRotationTurns: 0
  });
}

function roadBox(from, to, width) {
  if (from[1] !== to[1]) throw new Error('road.from and road.to must use the same Y level.');
  const low = Math.floor((width - 1) / 2);
  const high = width - 1 - low;
  if (from[0] !== to[0] && from[2] !== to[2]) throw new Error('roads must be axis-aligned on the 1m block grid.');
  if (from[0] === to[0] && from[2] === to[2]) throw new Error('road.from and road.to must describe a non-zero road segment.');
  if (from[2] === to[2]) {
    return {
      axis: 'x',
      min: [Math.min(from[0], to[0]), from[1], from[2] - low],
      max: [Math.max(from[0], to[0]), from[1], from[2] + high]
    };
  }
  return {
    axis: 'z',
    min: [from[0] - low, from[1], Math.min(from[2], to[2])],
    max: [from[0] + high, from[1], Math.max(from[2], to[2])]
  };
}

function expandRoad(raw, label, bounds, ops) {
  const id = String(raw.id || label);
  const from = asRoadPoint(raw.from, `${label}.from`);
  const to = asRoadPoint(raw.to, `${label}.to`);
  const width = asPositiveInt(raw.width, `${label}.width`);
  const state = String(raw.state || raw.surface || '').trim();
  if (!state) throw new Error(`${label}.state is required.`);
  const surface = roadBox(from, to, width);

  const sidewalk = raw.sidewalk == null ? null : raw.sidewalk;
  if (sidewalk != null && (!sidewalk || typeof sidewalk !== 'object' || Array.isArray(sidewalk))) throw new Error(`${label}.sidewalk must be an object.`);
  const sidewalkWidth = sidewalk ? asPositiveInt(sidewalk.width, `${label}.sidewalk.width`) : 0;
  const sidewalkState = sidewalk ? String(sidewalk.state || '').trim() : '';
  if (sidewalk && !sidewalkState) throw new Error(`${label}.sidewalk.state is required.`);

  const curb = raw.curb == null ? null : raw.curb;
  if (curb != null && (!curb || typeof curb !== 'object' || Array.isArray(curb))) throw new Error(`${label}.curb must be an object.`);
  const curbWidth = curb ? asPositiveInt(curb.width ?? 1, `${label}.curb.width`) : 0;
  const curbState = curb ? String(curb.state || '').trim() : '';
  if (curb && !curbState) throw new Error(`${label}.curb.state is required.`);
  if (curb && !sidewalk) throw new Error(`${label}.curb requires sidewalk so its placement is unambiguous.`);
  if (curbWidth > sidewalkWidth && sidewalk) throw new Error(`${label}.curb.width cannot exceed sidewalk.width.`);

  const generatedBoxes = [surface];
  if (sidewalk) {
    if (surface.axis === 'x') {
      const low = { min: [surface.min[0], surface.min[1], surface.min[2] - sidewalkWidth], max: [surface.max[0], surface.max[1], surface.min[2] - 1] };
      const high = { min: [surface.min[0], surface.min[1], surface.max[2] + 1], max: [surface.max[0], surface.max[1], surface.max[2] + sidewalkWidth] };
      generatedBoxes.push(low, high);
      appendFill(ops, sidewalkState, low.min, low.max, id, `${id} sidewalk`);
      appendFill(ops, sidewalkState, high.min, high.max, id, `${id} sidewalk`);
      if (curb) {
        const curbLow = { min: [surface.min[0], surface.min[1], surface.min[2] - curbWidth], max: [surface.max[0], surface.max[1], surface.min[2] - 1] };
        const curbHigh = { min: [surface.min[0], surface.min[1], surface.max[2] + 1], max: [surface.max[0], surface.max[1], surface.max[2] + curbWidth] };
        appendFill(ops, curbState, curbLow.min, curbLow.max, id, `${id} curb`);
        appendFill(ops, curbState, curbHigh.min, curbHigh.max, id, `${id} curb`);
      }
    } else {
      const low = { min: [surface.min[0] - sidewalkWidth, surface.min[1], surface.min[2]], max: [surface.min[0] - 1, surface.max[1], surface.max[2]] };
      const high = { min: [surface.max[0] + 1, surface.min[1], surface.min[2]], max: [surface.max[0] + sidewalkWidth, surface.max[1], surface.max[2]] };
      generatedBoxes.push(low, high);
      appendFill(ops, sidewalkState, low.min, low.max, id, `${id} sidewalk`);
      appendFill(ops, sidewalkState, high.min, high.max, id, `${id} sidewalk`);
      if (curb) {
        const curbLow = { min: [surface.min[0] - curbWidth, surface.min[1], surface.min[2]], max: [surface.min[0] - 1, surface.max[1], surface.max[2]] };
        const curbHigh = { min: [surface.max[0] + 1, surface.min[1], surface.min[2]], max: [surface.max[0] + curbWidth, surface.max[1], surface.max[2]] };
        appendFill(ops, curbState, curbLow.min, curbLow.max, id, `${id} curb`);
        appendFill(ops, curbState, curbHigh.min, curbHigh.max, id, `${id} curb`);
      }
    }
  }

  appendFill(ops, state, surface.min, surface.max, id, id);
  for (const box of generatedBoxes) {
    if (!boxInside(bounds, box)) throw new Error(`${label} generates road/sidewalk cells outside declared bounds.`);
  }
  return { id, type: 'road', bounds: unionBoxes(generatedBoxes), rotation: null };
}

function unionBoxes(boxes) {
  return {
    min: [
      Math.min(...boxes.map(box => box.min[0])),
      Math.min(...boxes.map(box => box.min[1])),
      Math.min(...boxes.map(box => box.min[2]))
    ],
    max: [
      Math.max(...boxes.map(box => box.max[0])),
      Math.max(...boxes.map(box => box.max[1])),
      Math.max(...boxes.map(box => box.max[2]))
    ]
  };
}

function centeredSpan(center, size) {
  const low = Math.floor((size - 1) / 2);
  return [center - low, center + (size - 1 - low)];
}

function expandIntersection(raw, label, bounds, ops) {
  const id = String(raw.id || label);
  const center = asRoadPoint(raw.center, `${label}.center`);
  const size = Array.isArray(raw.size)
    ? asVec2(raw.size, `${label}.size`).map((value, index) => {
      if (value < 1) throw new Error(`${label}.size[${index}] must be at least 1.`);
      return value;
    })
    : [asPositiveInt(raw.size, `${label}.size`), asPositiveInt(raw.size, `${label}.size`)];
  const state = String(raw.state || raw.surface || '').trim();
  if (!state) throw new Error(`${label}.state is required.`);
  const [minX, maxX] = centeredSpan(center[0], size[0]);
  const [minZ, maxZ] = centeredSpan(center[2], size[1]);
  const surface = { min: [minX, center[1], minZ], max: [maxX, center[1], maxZ] };
  const generatedBoxes = [surface];

  const sidewalk = raw.sidewalk == null ? null : raw.sidewalk;
  if (sidewalk != null && (!sidewalk || typeof sidewalk !== 'object' || Array.isArray(sidewalk))) throw new Error(`${label}.sidewalk must be an object.`);
  const sidewalkWidth = sidewalk ? asPositiveInt(sidewalk.width, `${label}.sidewalk.width`) : 0;
  const sidewalkState = sidewalk ? String(sidewalk.state || '').trim() : '';
  if (sidewalk && !sidewalkState) throw new Error(`${label}.sidewalk.state is required.`);

  const curb = raw.curb == null ? null : raw.curb;
  if (curb != null && (!curb || typeof curb !== 'object' || Array.isArray(curb))) throw new Error(`${label}.curb must be an object.`);
  const curbWidth = curb ? asPositiveInt(curb.width ?? 1, `${label}.curb.width`) : 0;
  const curbState = curb ? String(curb.state || '').trim() : '';
  if (curb && !curbState) throw new Error(`${label}.curb.state is required.`);
  if (curb && !sidewalk) throw new Error(`${label}.curb requires sidewalk so its placement is unambiguous.`);
  if (curbWidth > sidewalkWidth && sidewalk) throw new Error(`${label}.curb.width cannot exceed sidewalk.width.`);

  if (sidewalk) {
    const outer = {
      min: [surface.min[0] - sidewalkWidth, surface.min[1], surface.min[2] - sidewalkWidth],
      max: [surface.max[0] + sidewalkWidth, surface.max[1], surface.max[2] + sidewalkWidth]
    };
    generatedBoxes.push(outer);
    appendFill(ops, sidewalkState, outer.min, outer.max, id, `${id} sidewalk square`);
  }
  appendFill(ops, state, surface.min, surface.max, id, id);

  if (curb) {
    const north = { min: [surface.min[0] - curbWidth, surface.min[1], surface.min[2] - curbWidth], max: [surface.max[0] + curbWidth, surface.max[1], surface.min[2] - 1] };
    const south = { min: [surface.min[0] - curbWidth, surface.min[1], surface.max[2] + 1], max: [surface.max[0] + curbWidth, surface.max[1], surface.max[2] + curbWidth] };
    const west = { min: [surface.min[0] - curbWidth, surface.min[1], surface.min[2]], max: [surface.min[0] - 1, surface.max[1], surface.max[2]] };
    const east = { min: [surface.max[0] + 1, surface.min[1], surface.min[2]], max: [surface.max[0] + curbWidth, surface.max[1], surface.max[2]] };
    for (const box of [north, south, west, east]) appendFill(ops, curbState, box.min, box.max, id, `${id} curb`);
  }

  for (const box of generatedBoxes) {
    if (!boxInside(bounds, box)) throw new Error(`${label} generates intersection/sidewalk cells outside declared bounds.`);
  }
  return { id, type: 'intersection', bounds: unionBoxes(generatedBoxes), rotation: null };
}

function normalizeTopLevelAnchors(rawAnchors, bounds, output, seenAnchorIds) {
  if (rawAnchors == null) return;
  if (!rawAnchors || typeof rawAnchors !== 'object' || Array.isArray(rawAnchors)) throw new Error('anchors must be an object keyed by anchor name.');
  for (const [name, raw] of Object.entries(rawAnchors)) {
    const id = String(name || '').trim();
    if (!id) throw new Error('anchors contains an empty anchor name.');
    if (seenAnchorIds.has(id)) throw new Error(`Duplicate anchor id '${id}'.`);
    const anchor = normalizeAnchor(raw, `anchors.${id}`);
    if (!pointInside(bounds, anchor.at)) throw new Error(`anchors.${id}.at is outside declared bounds.`);
    seenAnchorIds.add(id);
    output.push({ id, ...anchor, sourceObject: null, prefab: null });
  }
}

function transformBoxWith(transformPoint, box) {
  const corners = [
    [box.min[0], box.min[1], box.min[2]],
    [box.min[0], box.min[1], box.max[2]],
    [box.max[0], box.min[1], box.min[2]],
    [box.max[0], box.min[1], box.max[2]],
    [box.min[0], box.max[1], box.min[2]],
    [box.min[0], box.max[1], box.max[2]],
    [box.max[0], box.max[1], box.min[2]],
    [box.max[0], box.max[1], box.max[2]]
  ].map(transformPoint);
  return {
    min: [
      Math.min(...corners.map(point => point[0])),
      Math.min(...corners.map(point => point[1])),
      Math.min(...corners.map(point => point[2]))
    ],
    max: [
      Math.max(...corners.map(point => point[0])),
      Math.max(...corners.map(point => point[1])),
      Math.max(...corners.map(point => point[2]))
    ]
  };
}

function transformPrefabOpWith(op, transformPoint, rotationTurns, source) {
  const type = String(op.op || '').toLowerCase();
  const base = {
    ...op,
    _blueprintObjectId: source.id,
    _blueprintRootId: source.rootId,
    _blueprintAllowOverlap: source.allowOverlap,
    _stateRotationTurns: rotationTurns
  };
  if (type === 'set') {
    base.at = transformPoint(asVec3(op.at, `${source.id}.at`));
    return base;
  }
  const box = transformBoxWith(transformPoint, opBounds(op, source.id));
  base.min = box.min;
  base.max = box.max;
  return base;
}

function normalizeValidation(raw) {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const overlapPolicy = String(value.overlap_policy || 'error').toLowerCase();
  if (!['error', 'warn', 'allow'].includes(overlapPolicy)) throw new Error("validation.overlap_policy must be 'error', 'warn' or 'allow'.");
  const requested = value.max_validation_cells == null ? MAX_VALIDATION_CELLS : Number(value.max_validation_cells);
  if (!Number.isInteger(requested) || requested < 1) throw new Error('validation.max_validation_cells must be a positive integer.');
  return { overlapPolicy, maxCells: Math.min(requested, MAX_VALIDATION_CELLS) };
}

function cellKey(x, y, z) {
  return `${x}|${y}|${z}`;
}

function pairKey(a, b, category) {
  return a < b ? `${category}|${a}|${b}` : `${category}|${b}|${a}`;
}

function forEachBoxCell(box, callback) {
  for (let y = box.min[1]; y <= box.max[1]; y += 1) {
    for (let z = box.min[2]; z <= box.max[2]; z += 1) {
      for (let x = box.min[0]; x <= box.max[0]; x += 1) callback(x, y, z);
    }
  }
}

function forEachHollowCell(box, thickness, floor, callback) {
  forEachBoxCell(box, (x, y, z) => {
    const edgeX = Math.min(x - box.min[0], box.max[0] - x) < thickness;
    const edgeZ = Math.min(z - box.min[2], box.max[2] - z) < thickness;
    if ((floor && y === box.min[1]) || y === box.max[1] || edgeX || edgeZ) callback(x, y, z, y === box.max[1]);
  });
}

function stateToken(stateName, turns, palette) {
  const name = String(stateName || '');
  const entry = palette && typeof palette === 'object' ? palette[name] : null;
  if (!entry || String(entry.shape || '').toLowerCase() !== 'stair') return name;
  const base = normalizeRotation(entry.rotation || 'north', `palette.${name}.rotation`).turns;
  return `${name}@${ROTATIONS[(base + (turns || 0)) % 4]}`;
}

function validateExpandedCells(ops, sourceById, palette, validationOptions) {
  const occupied = new Map();
  const overlaps = new Map();
  const errors = [];
  const warnings = [];
  let touchedCells = 0;

  const recordOverlap = (previous, source, category, point, previousState, nextState) => {
    const key = pairKey(previous.id, source.id, category);
    const item = overlaps.get(key) || {
      category,
      a: previous.id,
      b: source.id,
      cells: 0,
      sample: point,
      states: [previousState, nextState]
    };
    item.cells += 1;
    overlaps.set(key, item);
  };

  const touch = (x, y, z, nextState, source, isCut = false) => {
    touchedCells += 1;
    if (touchedCells > validationOptions.maxCells) throw new Error(`Blueprint overlap validation exceeds ${validationOptions.maxCells.toLocaleString()} cell touches.`);
    const key = cellKey(x, y, z);
    const previous = occupied.get(key);
    if (isCut) {
      if (previous && previous.source.id !== source.id && previous.source.rootId !== source.rootId) {
        const allowed = previous.source.allowOverlap || source.allowOverlap;
        const transport = ['road', 'intersection'].includes(previous.source.type) && ['road', 'intersection'].includes(source.type);
        const category = allowed ? 'allowed_cut' : transport ? 'transport_cut' : 'cut_conflict';
        recordOverlap(previous.source, source, category, [x, y, z], previous.state, 'air');
        if (category === 'cut_conflict' && validationOptions.overlapPolicy !== 'allow') {
          const message = `${source.id} cuts a cell owned by ${previous.source.id} at ${x},${y},${z}.`;
          (validationOptions.overlapPolicy === 'warn' ? warnings : errors).push(message);
        }
      }
      occupied.delete(key);
      return;
    }

    if (previous && previous.source.id !== source.id && previous.source.rootId !== source.rootId) {
      const sameState = previous.state === nextState;
      const transport = ['road', 'intersection'].includes(previous.source.type) && ['road', 'intersection'].includes(source.type);
      const allowed = previous.source.allowOverlap || source.allowOverlap;
      const category = allowed ? 'allowed' : transport ? 'transport' : sameState ? 'same_state' : 'conflict';
      recordOverlap(previous.source, source, category, [x, y, z], previous.state, nextState);
      if (category === 'conflict' && validationOptions.overlapPolicy !== 'allow') {
        const message = `${previous.source.id} conflicts with ${source.id} at ${x},${y},${z}.`;
        (validationOptions.overlapPolicy === 'warn' ? warnings : errors).push(message);
      }
    }
    occupied.set(key, { state: nextState, source });
  };

  for (const op of ops) {
    const sourceId = String(op?._blueprintObjectId || '');
    if (!sourceId) continue;
    const source = sourceById.get(sourceId);
    if (!source) throw new Error(`Expanded blueprint op references unknown source '${sourceId}'.`);
    const type = String(op.op || '').toLowerCase();
    if (type === 'set') {
      const at = asVec3(op.at, `${sourceId}.at`);
      touch(at[0], at[1], at[2], stateToken(op.state, op._stateRotationTurns, palette), source);
      continue;
    }
    const box = opBounds(op, sourceId);
    if (type === 'fill_box') {
      const state = stateToken(op.state, op._stateRotationTurns, palette);
      forEachBoxCell(box, (x, y, z) => touch(x, y, z, state, source));
    } else if (type === 'cut_box') {
      forEachBoxCell(box, (x, y, z) => touch(x, y, z, null, source, true));
    } else if (type === 'hollow_box') {
      const state = stateToken(op.state, op._stateRotationTurns, palette);
      const roofState = stateToken(op.roof_state || op.state, op._stateRotationTurns, palette);
      const thickness = Math.max(1, Math.min(8, asInt(op.wall_thickness ?? 1, `${sourceId}.wall_thickness`)));
      const floor = op.floor !== false;
      forEachHollowCell(box, thickness, floor, (x, y, z, roof) => touch(x, y, z, roof ? roofState : state, source));
    }
  }

  const compact = [...overlaps.values()].sort((a, b) => b.cells - a.cells);
  for (const overlap of compact) {
    if (overlap.category === 'same_state') warnings.push(`${overlap.a} and ${overlap.b} share ${overlap.cells} cell(s) with the same final state.`);
    else if (overlap.category === 'transport' || overlap.category === 'transport_cut') warnings.push(`${overlap.a} and ${overlap.b} overlap across ${overlap.cells} transport cell(s).`);
  }

  return {
    ok: errors.length === 0,
    overlapPolicy: validationOptions.overlapPolicy,
    checkedCells: touchedCells,
    occupiedCells: occupied.size,
    overlaps: compact,
    errors: [...new Set(errors)].slice(0, 100),
    warnings: [...new Set(warnings)].slice(0, 100)
  };
}

function normalizeGroups(rawGroups) {
  if (rawGroups == null) return {};
  if (!rawGroups || typeof rawGroups !== 'object' || Array.isArray(rawGroups)) throw new Error('groups must be an object keyed by group name.');
  const names = Object.keys(rawGroups);
  if (names.length > MAX_GROUPS) throw new Error(`groups exceeds the ${MAX_GROUPS} group safety limit.`);
  const groups = {};
  for (const [name, raw] of Object.entries(rawGroups)) {
    if (!name.trim()) throw new Error('group names cannot be empty.');
    const value = Array.isArray(raw) ? { members: raw } : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`groups.${name} must be an array or object.`);
    if (!Array.isArray(value.members)) throw new Error(`groups.${name}.members must be an array.`);
    groups[name] = {
      members: value.members.map((member, index) => {
        const ref = String(member || '').trim();
        if (!ref) throw new Error(`groups.${name}.members[${index}] cannot be empty.`);
        return ref;
      }),
      tags: normalizeTags(value.tags, `groups.${name}.tags`)
    };
  }
  return groups;
}

function resolveGroups(rawGroups, objectIds, anchorIds) {
  const groups = normalizeGroups(rawGroups);
  for (const [name, group] of Object.entries(groups)) {
    for (const ref of group.members) {
      if (!objectIds.has(ref) && !anchorIds.has(ref)) throw new Error(`groups.${name} references unknown blueprint object or anchor '${ref}'.`);
    }
  }
  return groups;
}

function resolveConnections(rawConnections, anchors) {
  if (rawConnections == null) return [];
  if (!Array.isArray(rawConnections)) throw new Error('connections must be an array.');
  if (rawConnections.length > MAX_CONNECTIONS) throw new Error(`connections exceeds the ${MAX_CONNECTIONS} connection safety limit.`);
  return rawConnections.map((raw, index) => {
    const label = `connections[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${label} must be an object.`);
    const from = String(raw.from || '').trim();
    const to = String(raw.to || '').trim();
    if (!from || !anchors.has(from)) throw new Error(`${label}.from references unknown anchor '${from}'.`);
    if (!to || !anchors.has(to)) throw new Error(`${label}.to references unknown anchor '${to}'.`);
    const a = anchors.get(from);
    const b = anchors.get(to);
    const distance = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1], a.at[2] - b.at[2]);
    let tolerance = null;
    if (raw.tolerance != null) {
      tolerance = Number(raw.tolerance);
      if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error(`${label}.tolerance must be a non-negative number.`);
      if (distance > tolerance) throw new Error(`${label} connects anchors ${distance.toFixed(3)}m apart, exceeding tolerance ${tolerance}m.`);
    }
    if (raw.require_opposite_facing === true && a.facing && b.facing) {
      const expected = ROTATIONS[(ROTATIONS.indexOf(a.facing) + 2) % 4];
      if (b.facing !== expected) throw new Error(`${label} requires opposite anchor facings, but ${from} faces ${a.facing} and ${to} faces ${b.facing}.`);
    }
    return { from, to, distance, tolerance, tags: normalizeTags(raw.tags, `${label}.tags`) };
  });
}

function expandPrefabInstance(raw, label, context, options = {}) {
  const {
    parentPath = '',
    parentTransform = null,
    parentBounds = null,
    parentRotationTurns = 0,
    parentTags = [],
    parentGroup = null,
    parentAllowOverlap = false,
    rootId = null,
    depth = 0,
    stack = []
  } = options;
  if (depth > MAX_PREFAB_DEPTH) throw new Error(`Blueprint prefab nesting exceeds ${MAX_PREFAB_DEPTH} levels.`);

  const prefabName = String(raw.prefab || '').trim();
  if (!prefabName) throw new Error(`${label}.prefab is required.`);
  const prefab = context.prefabs.get(prefabName);
  if (!prefab) throw new Error(`${label} references unknown prefab '${prefabName}'.`);
  if (stack.includes(prefabName)) throw new Error(`Blueprint prefab cycle detected: ${[...stack, prefabName].join(' -> ')}.`);

  const localId = String(raw.id || '').trim() || `${prefabName}-${context.objects.length + 1}`;
  const id = parentPath ? `${parentPath}/${localId}` : localId;
  if (context.objectIds.has(id)) throw new Error(`Duplicate blueprint object id '${id}'.`);
  const localOrigin = asVec3(raw.origin ?? raw.at ?? [0, 0, 0], `${label}.origin`);
  const ownRotation = normalizeRotation(raw.rotation, `${label}.rotation`);
  const totalRotationTurns = (parentRotationTurns + ownRotation.turns) % 4;
  const localPlacedBounds = transformedPrefabBounds(prefab.bounds, localOrigin, ownRotation.turns);
  if (parentBounds && !boxInside(parentBounds, localPlacedBounds)) throw new Error(`${label} places prefab '${prefabName}' outside parent prefab bounds.`);

  const transformPoint = parentTransform
    ? point => parentTransform(transformPrefabPoint(point, prefab.bounds, localOrigin, ownRotation.turns))
    : point => transformPrefabPoint(point, prefab.bounds, localOrigin, ownRotation.turns);
  const placedBounds = transformBoxWith(transformPoint, prefab.bounds);
  if (!boxInside(context.bounds, placedBounds)) throw new Error(`${label} places prefab '${prefabName}' outside declared bounds.`);

  const tags = combineTags(parentTags, prefab.tags, normalizeTags(raw.tags, `${label}.tags`));
  const group = normalizeGroup(raw.group) || prefab.group || parentGroup;
  const allowOverlap = parentAllowOverlap || raw.allow_overlap === true;
  const resolvedRootId = rootId || id;
  const object = {
    id,
    localId,
    parentId: parentPath || null,
    rootId: resolvedRootId,
    type: 'instance',
    prefab: prefabName,
    kind: prefab.kind,
    origin: placedBounds.min,
    rotation: ROTATIONS[totalRotationTurns],
    bounds: placedBounds,
    group,
    tags,
    allowOverlap,
    depth
  };
  context.objectIds.add(id);
  context.objects.push(object);
  context.sourceById.set(id, object);

  prefab.ops.forEach(op => context.ops.push(transformPrefabOpWith(op, transformPoint, totalRotationTurns, object)));

  for (const [anchorName, anchor] of prefab.anchors.entries()) {
    const anchorId = `${id}.${anchorName}`;
    if (context.anchorIds.has(anchorId)) throw new Error(`Duplicate anchor id '${anchorId}'.`);
    const at = transformPoint(anchor.at);
    if (!pointInside(context.bounds, at)) throw new Error(`${label} anchor '${anchorName}' lands outside declared bounds.`);
    context.anchorIds.add(anchorId);
    context.anchors.push({
      id: anchorId,
      at,
      facing: anchor.facing ? rotateFacing(anchor.facing, totalRotationTurns, `${label}.anchors.${anchorName}.facing`) : null,
      group: anchor.group || group,
      tags: combineTags(tags, anchor.tags),
      note: anchor.note,
      sourceObject: id,
      prefab: prefabName
    });
  }

  prefab.instances.forEach((child, index) => {
    expandPrefabInstance(child, `${label} -> prefabs.${prefabName}.instances[${index}]`, context, {
      parentPath: id,
      parentTransform: transformPoint,
      parentBounds: prefab.bounds,
      parentRotationTurns: totalRotationTurns,
      parentTags: tags,
      parentGroup: group,
      parentAllowOverlap: allowOverlap,
      rootId: resolvedRootId,
      depth: depth + 1,
      stack: [...stack, prefabName]
    });
  });

  return object;
}

export function expandRiftCityBlueprintLayer(document, { bounds } = {}) {
  const version = Number(document?.version);
  if (version < 2) {
    return {
      ops: Array.isArray(document?.ops) ? document.ops : [],
      objects: [],
      anchors: [],
      groups: {},
      connections: [],
      warnings: [],
      validation: { ok: true, checkedCells: 0, occupiedCells: 0, overlaps: [], errors: [], warnings: [] },
      sourceOperations: Array.isArray(document?.ops) ? document.ops.length : 0,
      expandedOperations: Array.isArray(document?.ops) ? document.ops.length : 0,
      prefabCount: 0,
      instanceCount: 0,
      nestedInstanceCount: 0,
      roadCount: 0,
      intersectionCount: 0,
      blueprintVersion: 0
    };
  }

  const blueprintVersion = Number(document?.blueprint_version ?? RIFT_CITY_BLUEPRINT_VERSION);
  if (blueprintVersion !== RIFT_CITY_BLUEPRINT_VERSION) throw new Error(`Unsupported RiftCity blueprint_version ${document?.blueprint_version}.`);
  if (!bounds) throw new Error('Blueprint expansion requires normalized document bounds.');

  const prefabs = normalizePrefabs(document.prefabs);
  const layout = Array.isArray(document.layout) ? document.layout : [];
  if (layout.length > MAX_BLUEPRINT_OBJECTS) throw new Error(`layout exceeds the ${MAX_BLUEPRINT_OBJECTS} object safety limit.`);
  const rawOps = Array.isArray(document.ops) ? document.ops : [];
  if (rawOps.length > MAX_EXPANDED_OPS) throw new Error(`ops exceeds the ${MAX_EXPANDED_OPS} operation safety limit.`);

  const context = {
    prefabs,
    bounds,
    ops: [],
    objects: [],
    anchors: [],
    objectIds: new Set(),
    anchorIds: new Set(),
    sourceById: new Map()
  };
  normalizeTopLevelAnchors(document.anchors, bounds, context.anchors, context.anchorIds);

  layout.forEach((raw, index) => {
    const label = `layout[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${label} must be an object.`);
    const type = String(raw.type || '').toLowerCase();
    if (!LAYOUT_TYPES.has(type)) throw new Error(`${label}.type '${type}' is unsupported.`);

    let object;
    if (type === 'instance' || type === 'prefab') {
      object = expandPrefabInstance(raw, label, context);
    } else if (type === 'road') {
      object = expandRoad(raw, label, bounds, context.ops);
      object.group = normalizeGroup(raw.group);
      object.tags = normalizeTags(raw.tags, `${label}.tags`);
      object.allowOverlap = raw.allow_overlap !== false;
      object.rootId = object.id;
      object.parentId = null;
      if (context.objectIds.has(object.id)) throw new Error(`Duplicate blueprint object id '${object.id}'.`);
      context.objectIds.add(object.id);
      context.objects.push(object);
      context.sourceById.set(object.id, object);
    } else {
      object = expandIntersection(raw, label, bounds, context.ops);
      object.group = normalizeGroup(raw.group);
      object.tags = normalizeTags(raw.tags, `${label}.tags`);
      object.allowOverlap = raw.allow_overlap !== false;
      object.rootId = object.id;
      object.parentId = null;
      if (context.objectIds.has(object.id)) throw new Error(`Duplicate blueprint object id '${object.id}'.`);
      context.objectIds.add(object.id);
      context.objects.push(object);
      context.sourceById.set(object.id, object);
    }

    if (context.ops.length > MAX_EXPANDED_OPS) throw new Error(`Blueprint expansion exceeds the ${MAX_EXPANDED_OPS} operation safety limit.`);
  });

  if (context.ops.length + rawOps.length > MAX_EXPANDED_OPS) throw new Error(`Blueprint + raw ops exceed the ${MAX_EXPANDED_OPS} operation safety limit.`);
  if (context.anchors.length > MAX_ANCHORS) throw new Error(`Expanded anchors exceed the ${MAX_ANCHORS} anchor safety limit.`);

  const anchorMap = new Map(context.anchors.map(anchor => [anchor.id, anchor]));
  const groups = resolveGroups(document.groups, context.objectIds, context.anchorIds);
  const connections = resolveConnections(document.connections, anchorMap);
  const validation = validateExpandedCells(context.ops, context.sourceById, document.palette, normalizeValidation(document.validation));
  if (!validation.ok) {
    const preview = validation.errors.slice(0, 4).join('; ');
    const error = new Error(`Blueprint overlap validation failed: ${preview}${validation.errors.length > 4 ? ` (+${validation.errors.length - 4} more)` : ''}`);
    error.blueprintValidation = validation;
    throw error;
  }

  const warnings = [...validation.warnings];
  const ops = [...context.ops, ...rawOps];
  return {
    ops,
    objects: context.objects,
    anchors: context.anchors,
    groups,
    connections,
    warnings,
    validation,
    sourceOperations: rawOps.length,
    expandedOperations: ops.length,
    prefabCount: prefabs.size,
    instanceCount: context.objects.filter(object => object.type === 'instance').length,
    nestedInstanceCount: context.objects.filter(object => object.type === 'instance' && object.parentId).length,
    roadCount: context.objects.filter(object => object.type === 'road').length,
    intersectionCount: context.objects.filter(object => object.type === 'intersection').length,
    blueprintVersion
  };
}

