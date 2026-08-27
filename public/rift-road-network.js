const EPSILON = 1e-4;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function pointSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= EPSILON) return { distance: distance(point, a), t: 0, x: a.x, z: a.z };
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq));
  const x = a.x + dx * t;
  const z = a.z + dz * t;
  return { distance: Math.hypot(point.x - x, point.z - z), t, x, z };
}

function segmentIntersection(a, b, c, d) {
  const rX = b.x - a.x;
  const rZ = b.z - a.z;
  const sX = d.x - c.x;
  const sZ = d.z - c.z;
  const denominator = rX * sZ - rZ * sX;
  if (Math.abs(denominator) < EPSILON) return null;
  const qX = c.x - a.x;
  const qZ = c.z - a.z;
  const t = (qX * sZ - qZ * sX) / denominator;
  const u = (qX * rZ - qZ * rX) / denominator;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return null;
  return { t, u, x: a.x + rX * t, z: a.z + rZ * t };
}

function signedAngleSimilarity(a, b, center) {
  const ax = a.x - center.x;
  const az = a.z - center.z;
  const bx = b.x - center.x;
  const bz = b.z - center.z;
  const al = Math.hypot(ax, az) || 1;
  const bl = Math.hypot(bx, bz) || 1;
  return (ax * bx + az * bz) / (al * bl);
}

function uniqueById(rows) {
  const map = new Map();
  for (const row of rows) map.set(row.id, row);
  return [...map.values()];
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize2(x, z) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

function samplePolyline(points, targetDistance) {
  if (!points.length) return null;
  if (points.length === 1) return { point: { ...points[0] }, tangent: { x: 0, z: 1 }, distance: 0 };
  const total = polylineLength(points);
  const wanted = clamp(targetDistance, 0, total);
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segmentLength = distance(a, b);
    if (segmentLength <= EPSILON) continue;
    if (walked + segmentLength >= wanted - EPSILON) {
      const t = clamp((wanted - walked) / segmentLength, 0, 1);
      return {
        point: lerpPoint(a, b, t),
        tangent: normalize2(b.x - a.x, b.z - a.z),
        distance: wanted
      };
    }
    walked += segmentLength;
  }
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  return { point: { ...b }, tangent: normalize2(b.x - a.x, b.z - a.z), distance: total };
}

function slicePolyline(points, startDistance = 0, endDistance = Infinity) {
  if (!Array.isArray(points) || points.length < 2) return [];
  const total = polylineLength(points);
  const start = clamp(startDistance, 0, total);
  const end = clamp(endDistance, start, total);
  if (end - start <= 0.02) return [];
  const output = [];
  const startSample = samplePolyline(points, start);
  const endSample = samplePolyline(points, end);
  if (!startSample || !endSample) return [];
  output.push(startSample.point);
  let walked = 0;
  for (let i = 1; i < points.length - 1; i++) {
    walked += distance(points[i - 1], points[i]);
    if (walked > start + EPSILON && walked < end - EPSILON) output.push({ ...points[i] });
  }
  if (distance(output[output.length - 1], endSample.point) > 0.01) output.push(endSample.point);
  return output;
}

function smoothPolyline(points, options = {}) {
  if (!Array.isArray(points) || points.length < 3) return (points || []).map(point => ({ ...point }));
  const maxTurn = (options.maxTurnDegrees ?? 58) * Math.PI / 180;
  const spacing = Math.max(0.35, options.spacing ?? 0.8);
  const output = [{ ...points[0] }];

  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    const incoming = normalize2(current.x - previous.x, current.z - previous.z);
    const outgoing = normalize2(next.x - current.x, next.z - current.z);
    const dot = clamp(incoming.x * outgoing.x + incoming.z * outgoing.z, -1, 1);
    const turn = Math.acos(dot);
    const previousLength = distance(previous, current);
    const nextLength = distance(current, next);

    if (turn < 0.035 || turn > maxTurn || previousLength < 0.6 || nextLength < 0.6) {
      if (distance(output[output.length - 1], current) > 0.02) output.push({ ...current });
      continue;
    }

    const tangentDistance = Math.min(previousLength, nextLength) * 0.36;
    const start = {
      x: current.x - incoming.x * tangentDistance,
      z: current.z - incoming.z * tangentDistance
    };
    const end = {
      x: current.x + outgoing.x * tangentDistance,
      z: current.z + outgoing.z * tangentDistance
    };
    if (distance(output[output.length - 1], start) > 0.02) output.push(start);
    const approximateLength = distance(start, current) + distance(current, end);
    const steps = Math.max(2, Math.ceil(approximateLength / spacing));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const inv = 1 - t;
      const point = {
        x: inv * inv * start.x + 2 * inv * t * current.x + t * t * end.x,
        z: inv * inv * start.z + 2 * inv * t * current.z + t * t * end.z
      };
      if (distance(output[output.length - 1], point) > 0.02) output.push(point);
    }
  }

  const last = points[points.length - 1];
  if (distance(output[output.length - 1], last) > 0.02) output.push({ ...last });
  return output;
}

function offsetPolyline(points, offset, miterLimit = 3.5) {
  if (!Array.isArray(points) || points.length < 2) return [];
  const normals = [];
  for (let i = 0; i < points.length - 1; i++) {
    const direction = normalize2(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
    normals.push({ x: direction.z, z: -direction.x });
  }
  return points.map((point, index) => {
    if (index === 0) return { x: point.x + normals[0].x * offset, z: point.z + normals[0].z * offset };
    if (index === points.length - 1) {
      const normal = normals[normals.length - 1];
      return { x: point.x + normal.x * offset, z: point.z + normal.z * offset };
    }
    const before = normals[index - 1];
    const after = normals[index];
    const sum = normalize2(before.x + after.x, before.z + after.z);
    const denominator = sum.x * after.x + sum.z * after.z;
    if (Math.abs(denominator) < 0.18) {
      return { x: point.x + after.x * offset, z: point.z + after.z * offset };
    }
    const scale = clamp(offset / denominator, -Math.abs(offset) * miterLimit, Math.abs(offset) * miterLimit);
    return { x: point.x + sum.x * scale, z: point.z + sum.z * scale };
  });
}

function createMeshBuilder() {
  return { vertices: [], indices: [] };
}

function addVertex(builder, point, y, normal) {
  const index = builder.vertices.length / 6;
  builder.vertices.push(point.x, y, point.z, normal[0], normal[1], normal[2]);
  return index;
}

function addTopQuad(builder, a, b, c, d, y) {
  const base = builder.vertices.length / 6;
  for (const point of [a, b, c, d]) builder.vertices.push(point.x, y, point.z, 0, 1, 0);
  builder.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function addStrip(builder, points, minOffset, maxOffset, y) {
  if (!Array.isArray(points) || points.length < 2) return;
  const low = offsetPolyline(points, minOffset);
  const high = offsetPolyline(points, maxOffset);
  for (let i = 0; i < points.length - 1; i++) {
    // low is the left side of the path, high is the right side. This winding faces upward.
    addTopQuad(builder, low[i], low[i + 1], high[i + 1], high[i], y);
  }
}

function addPolygon(builder, points, y) {
  if (!Array.isArray(points) || points.length < 3) return;
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, z: sum.z + point.z / points.length }), { x: 0, z: 0 });
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    const a = points[i];
    const b = points[next];
    const cross = (a.x - center.x) * (b.z - center.z) - (a.z - center.z) * (b.x - center.x);
    if (cross > 0) addTopQuad(builder, center, b, a, center, y);
    else addTopQuad(builder, center, a, b, center, y);
  }
}

function addOrientedRect(builder, center, tangent, halfAlong, halfAcross, y) {
  const normal = { x: tangent.z, z: -tangent.x };
  const a = { x: center.x - tangent.x * halfAlong - normal.x * halfAcross, z: center.z - tangent.z * halfAlong - normal.z * halfAcross };
  const b = { x: center.x + tangent.x * halfAlong - normal.x * halfAcross, z: center.z + tangent.z * halfAlong - normal.z * halfAcross };
  const c = { x: center.x + tangent.x * halfAlong + normal.x * halfAcross, z: center.z + tangent.z * halfAlong + normal.z * halfAcross };
  const d = { x: center.x - tangent.x * halfAlong + normal.x * halfAcross, z: center.z - tangent.z * halfAlong + normal.z * halfAcross };
  addTopQuad(builder, a, b, c, d, y);
}

function branchDirection(node, other) {
  return normalize2(other.x - node.x, other.z - node.z);
}


function convexHull(points) {
  const rows = [...points]
    .filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.z))
    .sort((a, b) => a.x === b.x ? a.z - b.z : a.x - b.x);
  if (rows.length <= 3) return rows;
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower = [];
  for (const point of rows) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const point = rows[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function validateNetworkShape(source) {
  if (!source || typeof source !== 'object') throw new Error('Road network must be an object.');
  if (!Array.isArray(source.nodes) || !Array.isArray(source.segments)) throw new Error('Road network nodes/segments are required.');
  if (!source.profiles || typeof source.profiles !== 'object') throw new Error('Road network profiles are required.');
}

export class RiftRoadNetwork {
  constructor(engine, source, options = {}) {
    validateNetworkShape(source);
    this.engine = engine;
    this.source = clone(source);
    this.data = clone(source);
    this.drawables = [];
    this.nodeCounter = 1;
    this.segmentCounter = 1;
    this.connectRadius = options.connectRadius ?? 1.6;
    this.nodeEpsilon = options.nodeEpsilon ?? 0.12;
    this.paramEpsilon = options.paramEpsilon ?? 0.002;
    this.worldY = options.worldY ?? 0;
    this.reseedCounters();
    this.cleanup();
    this.rebuildGeometry();
  }

  reseedCounters() {
    for (const node of this.data.nodes) {
      const match = String(node.id || '').match(/(\d+)$/);
      if (match) this.nodeCounter = Math.max(this.nodeCounter, Number(match[1]) + 1);
    }
    for (const segment of this.data.segments) {
      const match = String(segment.id || '').match(/(\d+)$/);
      if (match) this.segmentCounter = Math.max(this.segmentCounter, Number(match[1]) + 1);
    }
  }

  snapshot() {
    return clone(this.data);
  }

  replace(source) {
    validateNetworkShape(source);
    this.data = clone(source);
    this.reseedCounters();
    this.cleanup();
    this.rebuildGeometry();
  }

  resetToSource() {
    this.replace(this.source);
  }

  profile(id) {
    return this.data.profiles[id] || this.data.profiles[this.data.defaultProfile] || Object.values(this.data.profiles)[0];
  }

  node(id) {
    return this.data.nodes.find(node => node.id === id) || null;
  }

  segment(id) {
    return this.data.segments.find(segment => segment.id === id) || null;
  }

  degrees() {
    const result = new Map(this.data.nodes.map(node => [node.id, 0]));
    for (const segment of this.data.segments) {
      result.set(segment.a, (result.get(segment.a) || 0) + 1);
      result.set(segment.b, (result.get(segment.b) || 0) + 1);
    }
    return result;
  }

  stats() {
    const degrees = this.degrees();
    let intersections = 0;
    for (const degree of degrees.values()) if (degree >= 3) intersections += 1;
    return {
      nodes: this.data.nodes.length,
      segments: this.data.segments.length,
      intersections
    };
  }

  createNode(x, z) {
    const node = { id: `n${this.nodeCounter++}`, x: Number(x), z: Number(z) };
    this.data.nodes.push(node);
    return node;
  }

  findNearbyNode(point, radius = this.connectRadius) {
    let best = null;
    let bestDistance = radius;
    for (const node of this.data.nodes) {
      const d = distance(point, node);
      if (d <= bestDistance) {
        best = node;
        bestDistance = d;
      }
    }
    return best;
  }

  findNearestSegment(point, radius = Infinity) {
    let best = null;
    for (const segment of this.data.segments) {
      const a = this.node(segment.a);
      const b = this.node(segment.b);
      if (!a || !b) continue;
      const hit = pointSegmentDistance(point, a, b);
      if (hit.distance > radius) continue;
      if (!best || hit.distance < best.distance) best = { ...hit, segment, a, b };
    }
    return best;
  }

  ensureNodeAtPoint(point, radius = this.nodeEpsilon) {
    const nearby = this.findNearbyNode(point, radius);
    if (nearby) return nearby;
    return this.createNode(point.x, point.z);
  }

  splitSegmentAtNode(segmentId, nodeId) {
    const index = this.data.segments.findIndex(segment => segment.id === segmentId);
    if (index < 0) return false;
    const segment = this.data.segments[index];
    if (segment.a === nodeId || segment.b === nodeId) return false;
    const node = this.node(nodeId);
    const a = this.node(segment.a);
    const b = this.node(segment.b);
    if (!node || !a || !b) return false;
    const hit = pointSegmentDistance(node, a, b);
    if (hit.t <= this.paramEpsilon || hit.t >= 1 - this.paramEpsilon) return false;
    this.data.segments.splice(index, 1,
      { id: `r${this.segmentCounter++}`, a: segment.a, b: nodeId, profile: segment.profile },
      { id: `r${this.segmentCounter++}`, a: nodeId, b: segment.b, profile: segment.profile }
    );
    return true;
  }

  connectPoint(point) {
    const node = this.findNearbyNode(point, this.connectRadius);
    if (node) return node;

    const nearest = this.findNearestSegment(point, this.connectRadius);
    if (nearest && nearest.t > 0.03 && nearest.t < 0.97) {
      const splitNode = this.createNode(nearest.x, nearest.z);
      this.splitSegmentAtNode(nearest.segment.id, splitNode.id);
      return splitNode;
    }
    return this.createNode(point.x, point.z);
  }

  hasSegmentBetween(aId, bId) {
    return this.data.segments.some(segment =>
      (segment.a === aId && segment.b === bId) || (segment.a === bId && segment.b === aId)
    );
  }

  addSegmentByNodeIds(aId, bId, profileId) {
    if (!aId || !bId || aId === bId || this.hasSegmentBetween(aId, bId)) return null;
    const a = this.node(aId);
    const b = this.node(bId);
    if (!a || !b || distance(a, b) < 0.35) return null;
    const segment = { id: `r${this.segmentCounter++}`, a: aId, b: bId, profile: profileId || this.data.defaultProfile };
    this.data.segments.push(segment);
    return segment;
  }

  insertSegment(startPoint, endPoint, profileId = this.data.defaultProfile) {
    if (distance(startPoint, endPoint) < 0.5) return { added: 0, intersections: 0 };
    const intersectionsBefore = this.stats().intersections;
    const start = this.connectPoint(startPoint);
    const end = this.connectPoint(endPoint);
    if (start.id === end.id) return { added: 0, intersections: 0 };

    const startLive = this.node(start.id);
    const endLive = this.node(end.id);
    const cuts = [
      { t: 0, nodeId: start.id },
      { t: 1, nodeId: end.id }
    ];

    const existing = [...this.data.segments];
    for (const segment of existing) {
      if (segment.a === start.id || segment.b === start.id || segment.a === end.id || segment.b === end.id) continue;
      const a = this.node(segment.a);
      const b = this.node(segment.b);
      if (!a || !b) continue;
      const hit = segmentIntersection(startLive, endLive, a, b);
      if (!hit) continue;
      if (hit.t <= this.paramEpsilon || hit.t >= 1 - this.paramEpsilon) continue;

      let intersectionNode = null;
      if (hit.u <= this.paramEpsilon) intersectionNode = a;
      else if (hit.u >= 1 - this.paramEpsilon) intersectionNode = b;
      else {
        intersectionNode = this.ensureNodeAtPoint(hit, this.nodeEpsilon);
        this.splitSegmentAtNode(segment.id, intersectionNode.id);
      }
      cuts.push({ t: hit.t, nodeId: intersectionNode.id });
    }

    cuts.sort((a, b) => a.t - b.t);
    const ordered = [];
    for (const cut of cuts) {
      if (!ordered.length || ordered[ordered.length - 1].nodeId !== cut.nodeId) ordered.push(cut);
    }

    let added = 0;
    for (let index = 0; index < ordered.length - 1; index++) {
      if (this.addSegmentByNodeIds(ordered[index].nodeId, ordered[index + 1].nodeId, profileId)) added += 1;
    }
    this.cleanup();
    return { added, intersections: Math.max(0, this.stats().intersections - intersectionsBefore) };
  }

  addStroke(points, profileId = this.data.defaultProfile) {
    const clean = [];
    for (const point of points || []) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) continue;
      if (!clean.length || distance(point, clean[clean.length - 1]) >= 0.45) clean.push({ x: point.x, z: point.z });
    }
    if (clean.length < 2) return { added: 0, intersections: 0 };

    let added = 0;
    let intersections = 0;
    for (let index = 0; index < clean.length - 1; index++) {
      const result = this.insertSegment(clean[index], clean[index + 1], profileId);
      added += result.added;
      intersections += result.intersections;
    }
    this.cleanup();
    this.rebuildGeometry();
    return { added, intersections };
  }

  eraseAt(point, radius = 2.2) {
    const nearest = this.findNearestSegment(point, radius);
    if (!nearest) return false;
    const index = this.data.segments.findIndex(segment => segment.id === nearest.segment.id);
    if (index < 0) return false;
    this.data.segments.splice(index, 1);
    this.cleanup();
    this.rebuildGeometry();
    return true;
  }

  cleanup() {
    this.data.nodes = uniqueById(this.data.nodes.filter(node => Number.isFinite(node.x) && Number.isFinite(node.z)));
    const validNodes = new Set(this.data.nodes.map(node => node.id));
    this.data.segments = uniqueById(this.data.segments.filter(segment =>
      validNodes.has(segment.a) && validNodes.has(segment.b) && segment.a !== segment.b && this.profile(segment.profile)
    ));

    let changed = true;
    let guard = 0;
    while (changed && guard++ < 200) {
      changed = false;
      const byNode = new Map(this.data.nodes.map(node => [node.id, []]));
      for (const segment of this.data.segments) {
        byNode.get(segment.a)?.push(segment);
        byNode.get(segment.b)?.push(segment);
      }

      for (const node of [...this.data.nodes]) {
        const connected = byNode.get(node.id) || [];
        if (connected.length === 0) {
          this.data.nodes = this.data.nodes.filter(row => row.id !== node.id);
          changed = true;
          break;
        }
        if (connected.length !== 2) continue;
        const first = connected[0];
        const second = connected[1];
        if (first.profile !== second.profile) continue;
        const firstOther = this.node(first.a === node.id ? first.b : first.a);
        const secondOther = this.node(second.a === node.id ? second.b : second.a);
        if (!firstOther || !secondOther || firstOther.id === secondOther.id) continue;
        const similarity = signedAngleSimilarity(firstOther, secondOther, node);
        if (similarity > -0.985) continue;

        this.data.segments = this.data.segments.filter(segment => segment.id !== first.id && segment.id !== second.id);
        if (!this.hasSegmentBetween(firstOther.id, secondOther.id)) {
          this.data.segments.push({
            id: `r${this.segmentCounter++}`,
            a: firstOther.id,
            b: secondOther.id,
            profile: first.profile
          });
        }
        this.data.nodes = this.data.nodes.filter(row => row.id !== node.id);
        changed = true;
        break;
      }
    }
  }

  clearGeometry() {
    if (!this.drawables.length) return;
    this.engine.removeDrawables(this.drawables);
    this.drawables.length = 0;
  }

  addBox(options) {
    const drawable = this.engine.addBox(options);
    this.drawables.push(drawable);
    return drawable;
  }

  junctionNodeIds() {
    const degrees = this.degrees();
    return new Set([...degrees.entries()].filter(([, degree]) => degree >= 3).map(([id]) => id));
  }

  buildRoadChains() {
    const degrees = this.degrees();
    const segmentByNode = new Map(this.data.nodes.map(node => [node.id, []]));
    for (const segment of this.data.segments) {
      segmentByNode.get(segment.a)?.push(segment);
      segmentByNode.get(segment.b)?.push(segment);
    }
    const visited = new Set();
    const chains = [];

    const walk = (firstSegment, startNodeId) => {
      const profileId = firstSegment.profile;
      const nodeIds = [startNodeId];
      const segmentIds = [];
      let currentNodeId = startNodeId;
      let currentSegment = firstSegment;
      let guard = 0;
      while (currentSegment && guard++ < this.data.segments.length + 4) {
        visited.add(currentSegment.id);
        segmentIds.push(currentSegment.id);
        const nextNodeId = currentSegment.a === currentNodeId ? currentSegment.b : currentSegment.a;
        nodeIds.push(nextNodeId);
        const connected = segmentByNode.get(nextNodeId) || [];
        if ((degrees.get(nextNodeId) || 0) !== 2) break;
        const candidates = connected.filter(segment => segment.id !== currentSegment.id && !visited.has(segment.id) && segment.profile === profileId);
        if (candidates.length !== 1) break;
        currentNodeId = nextNodeId;
        currentSegment = candidates[0];
      }
      return { profileId, nodeIds, segmentIds };
    };

    for (const segment of this.data.segments) {
      if (visited.has(segment.id)) continue;
      const aDegree = degrees.get(segment.a) || 0;
      const bDegree = degrees.get(segment.b) || 0;
      if (aDegree === 2 && bDegree === 2) continue;
      const startNodeId = aDegree !== 2 ? segment.a : segment.b;
      chains.push(walk(segment, startNodeId));
    }

    // Closed loops and any remaining same-profile degree-two runs.
    for (const segment of this.data.segments) {
      if (visited.has(segment.id)) continue;
      chains.push(walk(segment, segment.a));
    }

    return chains;
  }

  addMesh(builder, color, noise = 0) {
    if (!builder.indices.length) return null;
    const drawable = this.engine.addMesh({ vertices: builder.vertices, indices: builder.indices }, {
      color,
      noise,
      doubleSided: true
    });
    this.drawables.push(drawable);
    return drawable;
  }

  rebuildGeometry() {
    this.clearGeometry();
    const degrees = this.degrees();
    const chains = this.buildRoadChains();
    const roadBuilders = new Map();
    const sidewalkBuilders = new Map();
    const curbBuilders = new Map();
    const centerBuilders = new Map();
    const edgeBuilders = new Map();
    const builderFor = (map, key) => {
      if (!map.has(key)) map.set(key, createMeshBuilder());
      return map.get(key);
    };

    for (const chain of chains) {
      const profile = this.profile(chain.profileId);
      if (!profile || chain.nodeIds.length < 2) continue;
      const rawPoints = chain.nodeIds.map(id => this.node(id)).filter(Boolean).map(node => ({ x: node.x, z: node.z }));
      if (rawPoints.length < 2) continue;
      const path = smoothPolyline(rawPoints, { spacing: 0.72, maxTurnDegrees: 58 });
      const totalLength = polylineLength(path);
      if (totalLength < 0.35) continue;
      const roadHalf = profile.roadWidth * 0.5;
      const startNodeId = chain.nodeIds[0];
      const endNodeId = chain.nodeIds[chain.nodeIds.length - 1];
      const trimStart = (degrees.get(startNodeId) || 0) >= 3 ? Math.min(roadHalf + 0.55, totalLength * 0.42) : 0;
      const trimEnd = (degrees.get(endNodeId) || 0) >= 3 ? Math.min(roadHalf + 0.55, totalLength * 0.42) : 0;
      const detailPath = slicePolyline(path, trimStart, totalLength - trimEnd);

      addStrip(builderFor(roadBuilders, chain.profileId), path, -roadHalf, roadHalf, this.worldY + 0.031);

      if (detailPath.length >= 2) {
        const sidewalkBuilder = builderFor(sidewalkBuilders, chain.profileId);
        const curbBuilder = builderFor(curbBuilders, chain.profileId);
        for (const side of [-1, 1]) {
          const inner = side < 0 ? -roadHalf - profile.sidewalkWidth : roadHalf;
          const outer = side < 0 ? -roadHalf : roadHalf + profile.sidewalkWidth;
          addStrip(sidewalkBuilder, detailPath, Math.min(inner, outer), Math.max(inner, outer), this.worldY + profile.sidewalkHeight + 0.002);

          const curbInner = side < 0 ? -roadHalf - profile.curbWidth : roadHalf;
          const curbOuter = side < 0 ? -roadHalf : roadHalf + profile.curbWidth;
          addStrip(curbBuilder, detailPath, Math.min(curbInner, curbOuter), Math.max(curbInner, curbOuter), this.worldY + profile.curbHeight + 0.004);
        }

        const detailLength = polylineLength(detailPath);
        const dashStep = profile.centerDashLength + profile.centerDashGap;
        const centerBuilder = builderFor(centerBuilders, chain.profileId);
        for (let start = profile.centerDashGap * 0.25; start < detailLength - 0.15; start += dashStep) {
          const end = Math.min(detailLength, start + profile.centerDashLength);
          const dashPath = slicePolyline(detailPath, start, end);
          if (dashPath.length >= 2) addStrip(centerBuilder, dashPath, -0.075, 0.075, this.worldY + 0.062);
        }

        const edgeBuilder = builderFor(edgeBuilders, chain.profileId);
        const edgeOffset = Math.max(0.6, roadHalf - 1.05);
        for (let along = 5; along <= detailLength - 5; along += 7.5) {
          const sample = samplePolyline(detailPath, along);
          if (!sample) continue;
          const normal = { x: sample.tangent.z, z: -sample.tangent.x };
          for (const side of [-1, 1]) {
            const center = {
              x: sample.point.x + normal.x * edgeOffset * side,
              z: sample.point.z + normal.z * edgeOffset * side
            };
            addOrientedRect(edgeBuilder, center, sample.tangent, 0.035, 0.95, this.worldY + 0.059);
          }
        }
      }
    }

    // Fill sidewalk/curb corners around semantic junctions. This prevents the old broken slabs/gaps
    // while still leaving the road mouth open for every connected branch.
    for (const node of this.data.nodes) {
      if ((degrees.get(node.id) || 0) < 3) continue;
      const connected = this.data.segments.filter(segment => segment.a === node.id || segment.b === node.id);
      const branches = [];
      for (const segment of connected) {
        const other = this.node(segment.a === node.id ? segment.b : segment.a);
        const profile = this.profile(segment.profile);
        if (!other || !profile) continue;
        const direction = branchDirection(node, other);
        branches.push({
          segment,
          profile,
          direction,
          angle: Math.atan2(direction.z, direction.x)
        });
      }
      branches.sort((a, b) => a.angle - b.angle);
      if (branches.length < 2) continue;

      const junctionRoadPoints = [];
      for (const branch of branches) {
        const half = branch.profile.roadWidth * 0.5;
        const mouth = half + 0.7;
        const normal = { x: branch.direction.z, z: -branch.direction.x };
        for (const side of [-1, 1]) {
          junctionRoadPoints.push({
            x: node.x + branch.direction.x * mouth + normal.x * half * side,
            z: node.z + branch.direction.z * mouth + normal.z * half * side
          });
        }
      }
      const roadHull = convexHull(junctionRoadPoints);
      if (roadHull.length >= 3) {
        addPolygon(builderFor(roadBuilders, branches[0].segment.profile), roadHull, this.worldY + 0.035);
      }

      for (let i = 0; i < branches.length; i++) {
        const first = branches[i];
        const second = branches[(i + 1) % branches.length];
        let gap = second.angle - first.angle;
        if (gap <= 0) gap += Math.PI * 2;
        if (gap < 0.22) continue;

        // Use the smaller profile where two road styles meet so corner geometry cannot intrude into either carriageway.
        const roadHalf = Math.min(first.profile.roadWidth, second.profile.roadWidth) * 0.5;
        const sidewalkWidth = Math.min(first.profile.sidewalkWidth, second.profile.sidewalkWidth);
        const curbWidth = Math.min(first.profile.curbWidth, second.profile.curbWidth);
        const trim = roadHalf + 0.55;
        const firstLeft = { x: -first.direction.z, z: first.direction.x };
        const secondRight = { x: second.direction.z, z: -second.direction.x };
        const pointOn = (direction, normal, lateral) => ({
          x: node.x + direction.x * trim + normal.x * lateral,
          z: node.z + direction.z * trim + normal.z * lateral
        });
        const innerA = pointOn(first.direction, firstLeft, roadHalf);
        const outerA = pointOn(first.direction, firstLeft, roadHalf + sidewalkWidth);
        const outerB = pointOn(second.direction, secondRight, roadHalf + sidewalkWidth);
        const innerB = pointOn(second.direction, secondRight, roadHalf);
        const sidewalkProfileId = first.segment.profile;
        addPolygon(builderFor(sidewalkBuilders, sidewalkProfileId), [innerA, outerA, outerB, innerB], this.worldY + first.profile.sidewalkHeight + 0.003);

        const curbOuterA = pointOn(first.direction, firstLeft, roadHalf + curbWidth);
        const curbOuterB = pointOn(second.direction, secondRight, roadHalf + curbWidth);
        addPolygon(builderFor(curbBuilders, sidewalkProfileId), [innerA, curbOuterA, curbOuterB, innerB], this.worldY + first.profile.curbHeight + 0.005);
      }
    }

    for (const [profileId, builder] of roadBuilders) {
      const profile = this.profile(profileId);
      this.addMesh(builder, profile?.roadColor || '#252a2e', 0.018);
    }
    for (const [profileId, builder] of sidewalkBuilders) {
      const profile = this.profile(profileId);
      this.addMesh(builder, profile?.sidewalkColor || '#777a77', 0.012);
    }
    for (const [profileId, builder] of curbBuilders) {
      const profile = this.profile(profileId);
      this.addMesh(builder, profile?.curbColor || '#9a9a94', 0.006);
    }
    for (const [profileId, builder] of centerBuilders) {
      const profile = this.profile(profileId);
      this.addMesh(builder, profile?.centerLineColor || '#d5a83c', 0);
    }
    for (const [profileId, builder] of edgeBuilders) {
      const profile = this.profile(profileId);
      this.addMesh(builder, profile?.edgeLineColor || '#d7d9d7', 0);
    }
  }

  dispose() {
    this.clearGeometry();
  }
}

export function simplifyRoadStroke(points, tolerance = 0.2) {
  if (!Array.isArray(points) || points.length <= 2) return (points || []).map(point => ({ x: point.x, z: point.z }));
  const output = [{ x: points[0].x, z: points[0].z }];
  for (let index = 1; index < points.length - 1; index++) {
    const previous = output[output.length - 1];
    const current = points[index];
    const next = points[index + 1];
    const dx1 = current.x - previous.x;
    const dz1 = current.z - previous.z;
    const dx2 = next.x - current.x;
    const dz2 = next.z - current.z;
    const len1 = Math.hypot(dx1, dz1);
    const len2 = Math.hypot(dx2, dz2);
    if (len1 < tolerance) continue;
    const cross = Math.abs(dx1 * dz2 - dz1 * dx2) / Math.max(EPSILON, len1 * len2);
    if (cross < 0.025 && len1 < 8) continue;
    output.push({ x: current.x, z: current.z });
  }
  output.push({ x: points[points.length - 1].x, z: points[points.length - 1].z });
  return output;
}
