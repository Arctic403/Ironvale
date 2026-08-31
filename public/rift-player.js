import { decodeRiftBlockState, RIFT_BLOCK_SHAPES, RIFT_BLOCK_ROTATIONS } from './rift-block-shapes.js';
import {
  riftNativeCrossedSupport,
  riftNativeGroundStepClassify,
  riftNativeStairTop,
  riftNativeStateShapeTop
} from './rift-wasm-core.js';

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export const RIFT_PLAYER_HEIGHT = 1.8;
export const RIFT_PLAYER_EYE_HEIGHT = 1.62;
export const RIFT_PLAYER_RADIUS = 0.28;
export const RIFT_PLAYER_PHYSICS_MAX_STEP = 1 / 120;
export const RIFT_PLAYER_KILL_MARGIN = 8;
export const RIFT_PLAYER_COLLISION_SKIN = 0.012;
const RIFT_PLAYER_WORLD_EPSILON = 0.002;

export function getRiftPlayerWorldFootprint(bounds, radius = RIFT_PLAYER_RADIUS) {
  if (!bounds?.min || !bounds?.max) return null;
  const r = Math.max(0, Number(radius) || 0);
  let minX = Number(bounds.min[0]) + r + RIFT_PLAYER_WORLD_EPSILON;
  let maxX = Number(bounds.max[0]) + 1 - r - RIFT_PLAYER_WORLD_EPSILON;
  let minZ = Number(bounds.min[2]) + r + RIFT_PLAYER_WORLD_EPSILON;
  let maxZ = Number(bounds.max[2]) + 1 - r - RIFT_PLAYER_WORLD_EPSILON;
  if (minX > maxX) minX = maxX = (Number(bounds.min[0]) + Number(bounds.max[0]) + 1) / 2;
  if (minZ > maxZ) minZ = maxZ = (Number(bounds.min[2]) + Number(bounds.max[2]) + 1) / 2;
  return { minX, maxX, minZ, maxZ };
}

export function constrainRiftPlayerToWorldFootprint(x, z, bounds, radius = RIFT_PLAYER_RADIUS) {
  const footprint = getRiftPlayerWorldFootprint(bounds, radius);
  if (!footprint) return { x: Number(x) || 0, z: Number(z) || 0, constrained: false };
  const nextX = clamp(Number(x) || 0, footprint.minX, footprint.maxX);
  const nextZ = clamp(Number(z) || 0, footprint.minZ, footprint.maxZ);
  return {
    x: nextX,
    z: nextZ,
    constrained: Math.abs(nextX - x) > 1e-7 || Math.abs(nextZ - z) > 1e-7
  };
}

export function riftPlayerKillPlane(bounds, margin = RIFT_PLAYER_KILL_MARGIN) {
  return bounds?.min ? Number(bounds.min[1]) - Math.max(1, Number(margin) || RIFT_PLAYER_KILL_MARGIN) : -64;
}

export function riftPlayerCrossedSupport(previousY, candidateY, supportY, tolerance = 0.055, previousTolerance = 0.015) {
  if (![previousY, candidateY, supportY].every(Number.isFinite)) return false;
  const contactTolerance = Math.max(0, Number(tolerance) || 0);
  const startTolerance = Math.max(0, Number(previousTolerance) || 0);
  return riftNativeCrossedSupport(previousY, candidateY, supportY, contactTolerance, startTolerance);
}

export function createRiftPlayer(engine, options = {}) {
  const skin = options.skin || '#d8a276';
  const shirt = options.shirt || '#466c82';
  const pants = options.pants || '#313943';
  const make = (name, scale, color) => engine.addBox({ name, color, dynamic: true, blockGrid: 0, blockFaceShade: 1, scale });
  const parts = {
    head: make('head', [0.50, 0.50, 0.50], skin),
    torso: make('torso', [0.62, 0.72, 0.34], shirt),
    armL: make('armL', [0.22, 0.70, 0.24], shirt),
    armR: make('armR', [0.22, 0.70, 0.24], shirt),
    legL: make('legL', [0.25, 0.78, 0.27], pants),
    legR: make('legR', [0.25, 0.78, 0.27], pants)
  };
  const drawables = Object.values(parts);
  let position = [...(options.position || [0, 1, 0])];
  let facing = Number(options.facing) || 0;
  let moving = false;
  let runAmount = 0;
  let strideTime = 0;
  let visible = true;
  let visualGroundOffset = 0;

  function setVisible(next) { visible = !!next; for (const d of drawables) d.visible = visible; }
  function setPosition(x, y, z) { position = [Number(x) || 0, Number(y) || 0, Number(z) || 0]; }
  function setVisualGroundOffset(value) { visualGroundOffset = clamp(Number(value) || 0, 0, 0.5); }
  function setFacingRadians(angle) { facing = Number(angle) || 0; }
  function setMotion(isMoving, running = false) { moving = !!isMoving; runAmount = running ? 1 : 0; }

  function update(dt = 0) {
    if (!visible) return;
    strideTime += Math.max(0, Number(dt) || 0) * (moving ? (runAmount > 0.4 ? 10 : 7) : 2.2);
    const swing = moving ? Math.sin(strideTime) * (0.15 + runAmount * 0.08) : Math.sin(strideTime) * 0.01;
    const bob = moving ? Math.abs(Math.sin(strideTime * 2)) * 0.018 : 0;
    const [x, physicsY, z] = position;
    const y = physicsY + visualGroundOffset;
    const forwardX = Math.sin(facing), forwardZ = Math.cos(facing);
    const sideX = Math.cos(facing), sideZ = -Math.sin(facing);
    const place = (drawable, ox, oy, oz) => {
      const wx = x + sideX * ox + forwardX * oz;
      const wz = z + sideZ * ox + forwardZ * oz;
      engine.setTransform(drawable, [wx, y + oy + bob, wz], facing, drawable.scale);
    };
    place(parts.legL, -0.14, 0.39, swing);
    place(parts.legR, 0.14, 0.39, -swing);
    place(parts.torso, 0, 1.03, 0);
    place(parts.armL, -0.43, 1.03, -swing);
    place(parts.armR, 0.43, 1.03, swing);
    place(parts.head, 0, 1.55, 0);
  }

  function destroy() { engine.removeDrawables(drawables); }
  update(0);
  return {
    parts, drawables,
    get position() { return [...position]; },
    get visualGroundOffset() { return visualGroundOffset; },
    get facing() { return facing; },
    get height() { return RIFT_PLAYER_HEIGHT; },
    get eyeHeight() { return RIFT_PLAYER_EYE_HEIGHT; },
    get radius() { return RIFT_PLAYER_RADIUS; },
    setVisible, setPosition, setVisualGroundOffset, setFacingRadians, setMotion, update, destroy
  };
}

export const RIFT_PLAYER_STEP_UP = 0.58;
export const RIFT_PLAYER_GROUND_SNAP_DOWN = 0.72;

export function riftPlayerStairTop(decoded, localX, localZ) {
  // H1.71's smooth collision ramp now runs through the shared C++ kernel. The
  // authored two-tread visual mesh is unchanged.
  return riftNativeStairTop(decoded?.rotation ?? RIFT_BLOCK_ROTATIONS.north, localX, localZ);
}

export function riftPlayerVisibleStairTop(decoded, localX, localZ) {
  const rampTop = riftPlayerStairTop(decoded, localX, localZ);
  // Authored stair geometry is two discrete 0.5 m treads. Collision intentionally
  // stays on the smooth ramp; this helper exists only to align the visible avatar
  // with the top of whichever rendered tread is underneath its center.
  return rampTop < 0.5 ? 0.5 : 1;
}

export function riftPlayerStairVisualOffset(state, worldX, physicsY, worldZ, cellY = Math.floor(physicsY - RIFT_PLAYER_COLLISION_SKIN)) {
  if (!state) return 0;
  const decoded = decodeRiftBlockState(state);
  if (decoded.shape !== RIFT_BLOCK_SHAPES.stair) return 0;
  const localX = worldX - Math.floor(worldX);
  const localZ = worldZ - Math.floor(worldZ);
  const visibleTopY = cellY + riftPlayerVisibleStairTop(decoded, localX, localZ);
  return clamp(visibleTopY - physicsY, 0, 0.5);
}

export function riftPlayerShapeTopAt(state, worldX, worldZ) {
  if (!state) return 0;
  // Packed state decode + negative-coordinate fractional math is native here;
  // this helper sits in the deepest support/body-probe loops.
  return riftNativeStateShapeTop(state, worldX, worldZ);
}

export function classifyRiftPlayerGroundStep(currentY, targetSupportY, options = {}) {
  const stepUp = Number(options.stepUp ?? RIFT_PLAYER_STEP_UP);
  const snapDown = Number(options.snapDown ?? RIFT_PLAYER_GROUND_SNAP_DOWN);
  if (targetSupportY == null || !Number.isFinite(targetSupportY)) return 'drop';
  const code = riftNativeGroundStepClassify(currentY, targetSupportY, stepUp, snapDown);
  return code === 2 ? 'blocked' : code === 1 ? 'grounded' : 'drop';
}

export function createRiftPlayerSurfaceSampler({ getState, getWorldBounds }) {
  function pointSolidAt(x, y, z) {
    const bounds = getWorldBounds?.();
    if (bounds && (x < bounds.min[0] || x >= bounds.max[0] + 1 || z < bounds.min[2] || z >= bounds.max[2] + 1)) return false;
    const cy = Math.floor(y);
    const state = getState(x, cy, z);
    if (!state) return false;
    const localY = y - cy;
    const decoded = decodeRiftBlockState(state);
    if (decoded.shape === RIFT_BLOCK_SHAPES.topSlab) return localY >= 0.5 && localY < 1;
    return localY >= 0 && localY < riftPlayerShapeTopAt(state, x, z) - 0.001;
  }

  function supportCandidatesAtPoint(x, z, aroundY, options = {}) {
    const bounds = getWorldBounds?.();
    if (!bounds) return [];
    if (x < bounds.min[0] || x >= bounds.max[0] + 1 || z < bounds.min[2] || z >= bounds.max[2] + 1) return [];
    const maxRise = Math.max(0, Number(options.maxRise ?? RIFT_PLAYER_STEP_UP));
    const maxDrop = Math.max(0, Number(options.maxDrop ?? 4));
    const upperSurface = aroundY + maxRise;
    const lowerSurface = aroundY - maxDrop;
    const topCell = Math.min(bounds.max[1], Math.floor(upperSurface));
    const bottomCell = Math.max(bounds.min[1], Math.floor(lowerSurface) - 1);
    const candidates = [];

    for (let cy = topCell; cy >= bottomCell; cy -= 1) {
      const state = getState(x, cy, z);
      if (!state) continue;
      const topY = cy + riftPlayerShapeTopAt(state, x, z);
      if (topY > upperSurface + 0.001 || topY < lowerSurface - 0.001) continue;
      if (!candidates.some(value => Math.abs(value - topY) <= 0.001)) candidates.push(topY);
    }
    candidates.sort((a, b) => b - a);
    return candidates;
  }

  function supportAtPoint(x, z, aroundY, options = {}) {
    return supportCandidatesAtPoint(x, z, aroundY, options)[0] ?? null;
  }

  function supportCrossings(x, z, previousY, candidateY, options = {}) {
    if (![previousY, candidateY].every(Number.isFinite) || candidateY > previousY) return [];
    const maxDrop = Math.max(0.3, previousY - candidateY + Math.max(0.18, Number(options.extraDrop) || 0));
    const candidates = supportCandidatesAtPoint(x, z, previousY, {
      maxRise: Math.max(0.02, Number(options.maxRise) || 0),
      maxDrop
    });
    return candidates.filter(supportY => riftPlayerCrossedSupport(
      previousY,
      candidateY,
      supportY,
      options.tolerance ?? 0.035,
      options.previousTolerance ?? 0.015
    ));
  }

  function supportBelow(x, z, ceilingY, maxDrop = 5) {
    return supportAtPoint(x, z, ceilingY, { maxRise: 0.035, maxDrop });
  }

  return { pointSolidAt, supportCandidatesAtPoint, supportAtPoint, supportCrossings, supportBelow };
}

export function createRiftPlayerController({ canvas, camera, getGrid, getWorldBounds, player, touchRoot = document }) {
  const keys = new Set();
  let enabled = true, creative = false, flying = false, jumpVelocity = 0, grounded = true, targetFacing = player.facing;
  let lastSafeGroundedPosition = null;
  let recoveryCount = 0;
  let stepAssist = null;
  const touch = { x: 0, z: 0, run: false, jump: false, down: false };

  const getState = (x, y, z) => getGrid?.()?.getBlockWorld(Math.floor(x), Math.floor(y), Math.floor(z)) || 0;
  const surfaces = createRiftPlayerSurfaceSampler({ getState, getWorldBounds });

  function constrainHorizontal(x, z) {
    return constrainRiftPlayerToWorldFootprint(x, z, getWorldBounds?.(), player.radius);
  }

  function findGroundY(x, z, aroundY, options = {}) {
    return surfaces.supportAtPoint(x, z, aroundY, {
      maxRise: options.maxRise ?? RIFT_PLAYER_STEP_UP + 0.02,
      maxDrop: options.maxDrop ?? 4
    });
  }

  const bodyProbes = (() => {
    const r = player.radius;
    return [
      [-r, -r], [r, -r], [-r, r], [r, r], [0, 0],
      [-r, 0], [r, 0], [0, -r], [0, r]
    ];
  })();
  // H1.72: support ownership is sampled over the circular foot instead of only
  // at its center. These probes are intentionally denser than body collision
  // probes: a character may stand/land with part of the foot over a ledge, but a
  // single numerical point touching a corner must not create an infinite ledge
  // magnet. Flat surfaces need a small manifold of contacts to own support.
  const supportFootprintProbes = (() => {
    const points = [[0, 0]];
    for (const [fraction, count] of [[0.44, 8], [0.74, 12], [0.96, 16]]) {
      const radius = player.radius * fraction;
      for (let i = 0; i < count; i += 1) {
        const angle = i / count * Math.PI * 2;
        points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }
    }
    return points;
  })();
  const stableSupportMinContacts = Math.max(4, Math.ceil(supportFootprintProbes.length * 0.12));
  const bodyProbeHeights = [
    RIFT_PLAYER_COLLISION_SKIN,
    0.18,
    0.46,
    0.82,
    1.24,
    player.height - RIFT_PLAYER_COLLISION_SKIN
  ];
  // A vertical cylinder riding a slope has uphill footprint probes above the
  // center support plane. Ignore only that predictable near-feet ramp wedge;
  // the high vertical face of a stair still blocks when approached backward.
  const stairFootClearance = Math.max(0.32, player.radius + 0.04);

  function stairSupportContext(x, floorY, z) {
    // The visible stair is still two treads, but the controller stands on a
    // virtual ramp. A vertical cylinder with a perfectly flat bottom would
    // intersect the uphill terrain under its own radius, so collision needs a
    // small slope-foot context while the CENTER is genuinely supported by a
    // stair. This is intentionally unavailable beside ordinary full blocks.
    const supportCellY = Math.floor(floorY - RIFT_PLAYER_COLLISION_SKIN);
    const state = getState(x, supportCellY, z);
    if (!state) return null;
    const decoded = decodeRiftBlockState(state);
    if (decoded.shape !== RIFT_BLOCK_SHAPES.stair) return null;
    const supportY = supportCellY + riftPlayerShapeTopAt(state, x, z);
    if (Math.abs(supportY - floorY) > 0.07) return null;
    return { x, z, rotation: decoded.rotation };
  }

  function stairUphillDistance(context, px, pz) {
    if (!context) return 0;
    switch (context.rotation) {
      case RIFT_BLOCK_ROTATIONS.north: return Math.max(0, context.z - pz);
      case RIFT_BLOCK_ROTATIONS.east: return Math.max(0, px - context.x);
      case RIFT_BLOCK_ROTATIONS.south: return Math.max(0, pz - context.z);
      case RIFT_BLOCK_ROTATIONS.west: return Math.max(0, context.x - px);
      default: return 0;
    }
  }

  function probeIsBlocking(px, py, pz, floorY, h, stairContext = null) {
    if (!surfaces.pointSolidAt(px, py, pz)) return false;
    const cy = Math.floor(py);
    const state = getState(px, cy, pz);
    if (!state) return false;
    const decoded = decodeRiftBlockState(state);
    const obstacleTop = cy + riftPlayerShapeTopAt(state, px, pz);

    // While the center rides an authored stair ramp, allow only the predictable
    // terrain wedge under the uphill portion of the body footprint. This also
    // covers the final centimeters where the uphill probe has entered the full
    // block/platform connected to the high edge of the ramp. It is NOT a generic
    // full-block step exemption: without a validated stair under the center this
    // branch cannot run, preserving H1.70's zero-penetration wall rule.
    if (stairContext) {
      const uphill = stairUphillDistance(stairContext, px, pz);
      const allowedRise = Math.min(stairFootClearance, uphill + 0.045);
      if (allowedRise > 0 && h <= allowedRise + RIFT_PLAYER_COLLISION_SKIN && obstacleTop <= floorY + allowedRise + 0.01) {
        return false;
      }
    }

    // Same-ramp probes need the equivalent allowance even before the footprint
    // crosses into the neighboring high platform.
    if (decoded.shape === RIFT_BLOCK_SHAPES.stair && h <= 0.24) {
      if (obstacleTop <= floorY + stairFootClearance) return false;
    }
    return true;
  }

  function bodyBlocked(x, floorY, z) {
    const stairContext = stairSupportContext(x, floorY, z);
    for (const [dx, dz] of bodyProbes) {
      for (const h of bodyProbeHeights) {
        const px = x + dx, pz = z + dz, py = floorY + h;
        if (probeIsBlocking(px, py, pz, floorY, h, stairContext)) return true;
      }
    }
    return false;
  }

  function bodyBlockScore(x, floorY, z) {
    const stairContext = stairSupportContext(x, floorY, z);
    let score = 0;
    for (const [dx, dz] of bodyProbes) {
      for (const h of bodyProbeHeights) {
        const px = x + dx, pz = z + dz, py = floorY + h;
        if (probeIsBlocking(px, py, pz, floorY, h, stairContext)) score += 1;
      }
    }
    return score;
  }


  function hasSupportAtHeightUnderFootprint(x, z, supportY, tolerance = 0.065) {
    if (!Number.isFinite(supportY)) return false;
    const points = [[0, 0], ...bodyProbes];
    for (const [dx, dz] of points) {
      const sampled = surfaces.supportAtPoint(x + dx, z + dz, supportY + 0.04, {
        maxRise: 0.08,
        maxDrop: 0.14
      });
      if (sampled != null && Math.abs(sampled - supportY) <= tolerance) return true;
    }
    return false;
  }

  function flatSupportContactAtHeight(x, z, supportY, tolerance = 0.045) {
    if (!Number.isFinite(supportY)) return { count: 0, total: supportFootprintProbes.length, fraction: 0 };
    let count = 0;
    for (const [dx, dz] of supportFootprintProbes) {
      const px = x + dx, pz = z + dz;
      const candidates = surfaces.supportCandidatesAtPoint(px, pz, supportY + 0.025, {
        maxRise: 0.055,
        maxDrop: 0.08
      });
      const matched = candidates.find(value => Math.abs(value - supportY) <= tolerance);
      if (matched == null) continue;
      const cellY = Math.floor(matched - RIFT_PLAYER_COLLISION_SKIN);
      const state = getState(px, cellY, pz);
      if (!state) continue;
      if (decodeRiftBlockState(state).shape === RIFT_BLOCK_SHAPES.stair) continue;
      count += 1;
    }
    return { count, total: supportFootprintProbes.length, fraction: count / supportFootprintProbes.length };
  }

  function hasStableFlatSupportAtHeight(x, z, supportY, tolerance = 0.045) {
    return flatSupportContactAtHeight(x, z, supportY, tolerance).count >= stableSupportMinContacts;
  }

  // H1.75: the high edge of a stair can still be under one foot after the
  // player's center has crossed onto a lower slab/floor. Preserve that legitimate
  // partial support until the circular foot really clears the stair. Without this
  // handoff the center snapped down early and the trailing foot became trapped in
  // the ramp volume. These probes are independent from flat-surface ownership so
  // stairs do not become an infinite ledge magnet.
  const stairEdgeSupportProbes = (() => {
    const points = [[0, 0]];
    for (const [fraction, count] of [[0.20, 8], [0.45, 12], [0.72, 16], [0.96, 20]]) {
      const radius = player.radius * fraction;
      for (let i = 0; i < count; i += 1) {
        const angle = i / count * Math.PI * 2;
        points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }
    }
    return points;
  })();

  function hasStairSupportNearHeight(x, z, supportY, tolerance = 0.085) {
    if (!Number.isFinite(supportY)) return false;
    const cellY = Math.floor(supportY - RIFT_PLAYER_COLLISION_SKIN);
    for (const [dx, dz] of stairEdgeSupportProbes) {
      const px = x + dx, pz = z + dz;
      const state = getState(px, cellY, pz);
      if (!state) continue;
      const decoded = decodeRiftBlockState(state);
      if (decoded.shape !== RIFT_BLOCK_SHAPES.stair) continue;
      const topY = cellY + riftPlayerShapeTopAt(state, px, pz);
      if (Math.abs(topY - supportY) <= tolerance) return true;
    }
    return false;
  }

  function syncPlayerStairVisualOffset() {
    if (typeof player.setVisualGroundOffset !== 'function') return;
    if (creative && flying) {
      player.setVisualGroundOffset(0);
      return;
    }
    const [x, y, z] = player.position;
    const cellY = Math.floor(y - RIFT_PLAYER_COLLISION_SKIN);
    const state = getState(x, cellY, z);
    player.setVisualGroundOffset(riftPlayerStairVisualOffset(state, x, y, z, cellY));
  }

  function landingCandidatesUnderFootprint(x, z, previousY, candidateY, options = {}) {
    const groups = [];
    const groupTolerance = Math.max(0.018, Number(options.groupTolerance) || 0.028);
    for (let probeIndex = 0; probeIndex < supportFootprintProbes.length; probeIndex += 1) {
      const [dx, dz] = supportFootprintProbes[probeIndex];
      const px = x + dx, pz = z + dz;
      const crossings = surfaces.supportCrossings(px, pz, previousY, candidateY, options);
      for (const supportY of crossings) {
        const cellY = Math.floor(supportY - RIFT_PLAYER_COLLISION_SKIN);
        const state = getState(px, cellY, pz);
        const shape = state ? decodeRiftBlockState(state).shape : null;
        // Non-center stair samples have intentionally different ramp heights. Do
        // not combine those into a fake flat landing plane; the center probe owns
        // continuous stair/ramp landings. Flat block/slab surfaces form a real
        // multi-contact manifold and may own support even when center is over air
        // or a lower floor.
        if (probeIndex !== 0 && shape === RIFT_BLOCK_SHAPES.stair) continue;
        let group = groups.find(item => Math.abs(item.y - supportY) <= groupTolerance);
        if (!group) {
          group = { y: supportY, contacts: 0, center: false };
          groups.push(group);
        }
        group.contacts += 1;
        if (probeIndex === 0) group.center = true;
      }
    }
    return groups
      .filter(group => group.center || group.contacts >= stableSupportMinContacts)
      .sort((a, b) => b.y - a.y);
  }

  function findWalkableStepUpY(current, targetX, targetZ) {
    // A strict zero-penetration sweep sees a half slab (or the final high edge
    // of a ramp) before the player's center has crossed into that cell. Rather
    // than exempting the obstacle side from collision, find the real top/support
    // under the target footprint and move vertically FIRST. Full-block walls are
    // still hard blockers unless their top is genuinely within STEP_UP.
    const maxY = current.y + RIFT_PLAYER_STEP_UP + 0.02;
    const moveX = targetX - current.x;
    const moveZ = targetZ - current.z;
    const moveLength = Math.hypot(moveX, moveZ);
    const dirX = moveLength > 1e-8 ? moveX / moveLength : 0;
    const dirZ = moveLength > 1e-8 ? moveZ / moveLength : 0;
    let stepY = null;
    for (const [dx, dz] of bodyProbes) {
      // Only inspect the leading half of the footprint. A higher surface behind
      // the player is the ledge being LEFT, not a step we should climb back onto.
      if (moveLength > 1e-8 && dx * dirX + dz * dirZ < -0.001) continue;
      const sampled = surfaces.supportAtPoint(targetX + dx, targetZ + dz, current.y, {
        maxRise: RIFT_PLAYER_STEP_UP + 0.02,
        maxDrop: 0.04
      });
      if (sampled == null || sampled <= current.y + RIFT_PLAYER_COLLISION_SKIN || sampled > maxY) continue;
      if (stepY == null || sampled > stepY) stepY = sampled;
    }
    if (stepY == null) return null;
    if (!hasSupportAtHeightUnderFootprint(targetX, targetZ, stepY)) return null;
    if (bodyBlocked(targetX, stepY, targetZ)) return null;
    return stepY;
  }

  function resolveNonPenetratingHorizontal(x, floorY, z, preferX = 0, preferZ = 0, maxResolve = player.radius + 0.06) {
    const constrainedBase = constrainHorizontal(x, z);
    const baseX = constrainedBase.x, baseZ = constrainedBase.z;
    if (!bodyBlocked(baseX, floorY, baseZ)) {
      return { x: baseX, y: floorY, z: baseZ, adjusted: constrainedBase.constrained };
    }

    const preferLength = Math.hypot(preferX, preferZ);
    const dirX = preferLength > 1e-7 ? preferX / preferLength : 0;
    const dirZ = preferLength > 1e-7 ? preferZ / preferLength : 0;
    let best = null;

    // Search from tiny corrections outward. Prefer the current motion direction
    // so slowly leaving a ledge clears the old block instead of popping backward.
    for (let radius = 0.005; radius <= maxResolve + 1e-9; radius += 0.005) {
      const candidates = [];
      if (preferLength > 1e-7) candidates.push([dirX * radius, dirZ * radius]);
      for (let i = 0; i < 32; i += 1) {
        const angle = i / 32 * Math.PI * 2;
        candidates.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }
      for (const [ox, oz] of candidates) {
        const constrained = constrainHorizontal(baseX + ox, baseZ + oz);
        const cx = constrained.x, cz = constrained.z;
        if (bodyBlocked(cx, floorY, cz)) continue;
        const alignment = preferLength > 1e-7 ? (ox * dirX + oz * dirZ) / Math.max(radius, 1e-7) : 0;
        const score = Math.hypot(cx - baseX, cz - baseZ) - alignment * 0.002;
        if (!best || score < best.score) best = { x: cx, y: floorY, z: cz, adjusted: true, score };
      }
      if (best) break;
    }
    return best ? { x: best.x, y: best.y, z: best.z, adjusted: true } : null;
  }

  function sweepVerticalToNonPenetrating(x, previousY, candidateY, z) {
    if (!bodyBlocked(x, candidateY, z)) return candidateY;
    if (bodyBlocked(x, previousY, z)) return previousY;
    let safe = previousY;
    let blocked = candidateY;
    // Binary-search the first contact plane. This is intentionally conservative:
    // we stay one skin-width outside the solid instead of rendering one frame
    // embedded and correcting afterward.
    for (let i = 0; i < 14; i += 1) {
      const mid = (safe + blocked) * 0.5;
      if (bodyBlocked(x, mid, z)) blocked = mid; else safe = mid;
    }
    return safe;
  }

  function resolveLandingPlacement(x, z, landingY, preferX = 0, preferZ = 0) {
    const constrainedBase = constrainHorizontal(x, z);
    const baseX = constrainedBase.x, baseZ = constrainedBase.z;
    const landingSlopeTolerance = Math.max(0.24, player.radius + 0.08);
    const validAt = (px, pz) => {
      const support = findGroundY(px, pz, landingY + 0.22, { maxRise: 0.24, maxDrop: 0.22 + landingSlopeTolerance });
      if (support != null && Math.abs(support - landingY) <= landingSlopeTolerance && !bodyBlocked(px, support, pz)) return support;
      // H1.72 partial-foot landing: the center may already be over a lower block
      // while a meaningful part of the circular foot has crossed the higher flat
      // top. That higher manifold is a valid landing and must not be discarded or
      // "corrected" sideways onto the lower floor.
      if (hasStableFlatSupportAtHeight(px, pz, landingY) && !bodyBlocked(px, landingY, pz)) return landingY;
      return null;
    };
    const baseSupport = validAt(baseX, baseZ);
    if (baseSupport != null) return { x: baseX, y: baseSupport, z: baseZ, adjusted: constrainedBase.constrained };

    // Edge landings can overlap the SIDE of the block that was just left even
    // though a perfectly valid lower floor is directly underneath. Search only
    // a player-radius-sized neighborhood for the nearest non-embedded point on
    // the same landing surface. This is a collision depenetration, not a teleport.
    const preferLength = Math.hypot(preferX, preferZ);
    const pxDir = preferLength > 1e-6 ? preferX / preferLength : 0;
    const pzDir = preferLength > 1e-6 ? preferZ / preferLength : 0;
    const maxResolve = player.radius + 0.08;
    let best = null;
    for (let radius = 0.02; radius <= maxResolve + 1e-9; radius += 0.02) {
      for (let i = 0; i < 24; i += 1) {
        const angle = i / 24 * Math.PI * 2;
        const ox = Math.cos(angle) * radius;
        const oz = Math.sin(angle) * radius;
        const constrained = constrainHorizontal(baseX + ox, baseZ + oz);
        const cx = constrained.x, cz = constrained.z;
        const candidateSupport = validAt(cx, cz);
        if (candidateSupport == null) continue;
        const alignment = preferLength > 1e-6 ? (ox * pxDir + oz * pzDir) / Math.max(radius, 1e-6) : 0;
        const score = Math.hypot(cx - baseX, cz - baseZ) - alignment * 0.006;
        if (!best || score < best.score) best = { x: cx, y: candidateSupport, z: cz, adjusted: true, score };
      }
      if (best) break;
    }
    return best ? { x: best.x, y: best.y, z: best.z, adjusted: true } : null;
  }

  function resolveSpawn(preferred) {
  const bounds = getWorldBounds?.();
  const requested = preferred || (bounds
    ? [(bounds.min[0] + bounds.max[0] + 1) / 2, bounds.min[1] + 2, (bounds.min[2] + bounds.max[2] + 1) / 2]
    : [0, 1, 0]);
  const clampedBase = constrainHorizontal(requested[0], requested[2]);
  const base = [clampedBase.x, Number(requested[1]) || 0, clampedBase.z];
  const trySpawnAt = (x, z, probeY, maxDrop) => {
    const support = findGroundY(x, z, probeY, { maxRise: 0.1, maxDrop });
    if (support == null || bodyBlocked(x, support, z)) return null;
    return [x, support, z];
  };

  // Preserve authored anchors/floor targets first. A valid basement or
  // upper-floor anchor must stay on its intended nearby support plane.
  let spawn = trySpawnAt(base[0], base[2], base[1] + 2, 8);
  if (spawn) return spawn;
  for (let radius = 1; radius <= 14; radius += 1) {
    for (let a = 0; a < 16; a += 1) {
      const angle = a / 16 * Math.PI * 2;
      const constrained = constrainHorizontal(base[0] + Math.cos(angle) * radius, base[2] + Math.sin(angle) * radius);
      spawn = trySpawnAt(constrained.x, constrained.z, base[1] + 2, 8);
      if (spawn) return spawn;
    }
  }

  // H1.88: world minY is a storage/collision bound, NOT a surface datum.
  // Basements, subway tunnels and sewers may extend below zero. If an
  // old fallback/invalid anchor asks to spawn below all nearby support,
  // scan the full loaded vertical column from above and recover onto a
  // real walkable surface instead of returning minY + 1 and falling.
  if (bounds) {
    const worldHeight = Math.max(1, Number(bounds.max[1]) - Number(bounds.min[1]) + 1);
    const topProbeY = Number(bounds.max[1]) + 1.25;
    const fullDrop = worldHeight + 4;
    spawn = trySpawnAt(base[0], base[2], topProbeY, fullDrop);
    if (spawn) return spawn;
    for (let radius = 1; radius <= 18; radius += 1) {
      for (let a = 0; a < 24; a += 1) {
        const angle = a / 24 * Math.PI * 2;
        const constrained = constrainHorizontal(base[0] + Math.cos(angle) * radius, base[2] + Math.sin(angle) * radius);
        spawn = trySpawnAt(constrained.x, constrained.z, topProbeY, fullDrop);
        if (spawn) return spawn;
      }
    }
  }

  return [base[0], bounds ? Number(bounds.min[1]) + 1 : base[1], base[2]];
}

  function rememberSafeGrounded(x, y, z) {
    const constrained = constrainHorizontal(x, z);
    if (constrained.constrained) return false;
    const support = findGroundY(x, z, y + 0.04, { maxRise: 0.08, maxDrop: 0.18 });
    if (support == null || Math.abs(support - y) > 0.09 || bodyBlocked(x, support, z)) return false;
    lastSafeGroundedPosition = [x, support, z];
    return true;
  }

  function safeRecoveryTarget() {
    if (lastSafeGroundedPosition) {
      const [sx, sy, sz] = lastSafeGroundedPosition;
      const constrained = constrainHorizontal(sx, sz);
      const support = findGroundY(constrained.x, constrained.z, sy + 0.1, { maxRise: 0.12, maxDrop: 1.5 });
      if (support != null && !bodyBlocked(constrained.x, support, constrained.z)) return [constrained.x, support, constrained.z];
    }
    return resolveSpawn();
  }

  function recoverToSafeGround(reason = 'recovery') {
    const target = safeRecoveryTarget();
    player.setPosition(...target);
    player.setVisualGroundOffset?.(0);
    jumpVelocity = 0;
    grounded = true;
    stepAssist = null;
    recoveryCount += 1;
    rememberSafeGrounded(...target);
    return { position: [...target], reason, recoveryCount };
  }

  function teleport(preferred) {
    const spawn = resolveSpawn(preferred);
    player.setPosition(...spawn);
    player.setVisualGroundOffset?.(0);
    jumpVelocity = 0;
    grounded = true;
    stepAssist = null;
    rememberSafeGrounded(...spawn);
    return spawn;
  }

  function revalidateWorld({ allowFall = true } = {}) {
    const pos = player.position;
    const constrained = constrainHorizontal(pos[0], pos[2]);
    let x = constrained.x, y = pos[1], z = constrained.z;
    const bounds = getWorldBounds?.();
    if (y < riftPlayerKillPlane(bounds)) return recoverToSafeGround('kill-plane');

    if (bodyBlocked(x, y, z)) return recoverToSafeGround('embedded-after-world-change');

    const support = findGroundY(x, z, y, {
      maxRise: RIFT_PLAYER_STEP_UP + 0.02,
      maxDrop: Math.max(2, RIFT_PLAYER_GROUND_SNAP_DOWN + 0.04)
    });
    const classification = classifyRiftPlayerGroundStep(y, support);
    if (classification === 'grounded' && support != null && !bodyBlocked(x, support, z)) {
      y = support;
      grounded = true;
      jumpVelocity = 0;
      player.setPosition(x, y, z);
      rememberSafeGrounded(x, y, z);
      return { position: [x, y, z], recovered: false, grounded: true };
    }

    player.setPosition(x, y, z);
    if (allowFall) {
      grounded = false;
      jumpVelocity = Math.min(0, jumpVelocity);
      return { position: [x, y, z], recovered: false, grounded: false };
    }
    return recoverToSafeGround('unsupported-after-world-change');
  }

  function onKeyDown(event) {
    if (!enabled) return;
    const code = event.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyQ'].includes(code)) {
      keys.add(code);
      if (code === 'Space' && !flying && grounded) {
        jumpVelocity = 5.1;
        grounded = false;
        stepAssist = null;
      }
      event.preventDefault();
    }
  }
  function onKeyUp(event) { keys.delete(event.code); }
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);

  const pad = touchRoot.querySelector?.('[data-rift-player-pad]');
  const runButton = touchRoot.querySelector?.('[data-rift-player-run]');
  const jumpButton = touchRoot.querySelector?.('[data-rift-player-jump]');
  const downButton = touchRoot.querySelector?.('[data-rift-player-down]');
  let padPointer = null;

  const updatePad = event => {
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const radius = Math.max(1, rect.width * .42);
    const length = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, radius / length);
    touch.x = clamp(dx * scale / radius, -1, 1);
    touch.z = clamp(-dy * scale / radius, -1, 1);
    pad.style.setProperty('--rift-stick-x', `${touch.x * 26}px`);
    pad.style.setProperty('--rift-stick-y', `${-touch.z * 26}px`);
  };
  const onPadDown = event => {
    if (!enabled || padPointer != null) return;
    padPointer = event.pointerId;
    try { pad.setPointerCapture(event.pointerId); } catch (_) {}
    updatePad(event);
    event.preventDefault();
  };
  const onPadMove = event => {
    if (event.pointerId !== padPointer) return;
    updatePad(event);
    event.preventDefault();
  };
  const onPadUp = event => {
    if (event.pointerId !== padPointer) return;
    padPointer = null;
    touch.x = touch.z = 0;
    pad?.style.setProperty('--rift-stick-x', '0px');
    pad?.style.setProperty('--rift-stick-y', '0px');
  };
  pad?.addEventListener('pointerdown', onPadDown, { passive: false });
  pad?.addEventListener('pointermove', onPadMove, { passive: false });
  pad?.addEventListener('pointerup', onPadUp);
  pad?.addEventListener('pointercancel', onPadUp);
  runButton?.addEventListener('pointerdown', () => { touch.run = true; });
  runButton?.addEventListener('pointerup', () => { touch.run = false; });
  runButton?.addEventListener('pointercancel', () => { touch.run = false; });
  jumpButton?.addEventListener('pointerdown', event => {
    if (!enabled) return;
    touch.jump = true;
    if (!flying && grounded) {
      jumpVelocity = 5.1;
      grounded = false;
      stepAssist = null;
    }
    event.preventDefault();
  });
  jumpButton?.addEventListener('pointerup', () => { touch.jump = false; });
  jumpButton?.addEventListener('pointercancel', () => { touch.jump = false; });
  downButton?.addEventListener('pointerdown', event => {
    if (enabled && creative) {
      touch.down = true;
      event.preventDefault();
    }
  });
  downButton?.addEventListener('pointerup', () => { touch.down = false; });
  downButton?.addEventListener('pointercancel', () => { touch.down = false; });

  function tryGroundMove(current, targetX, targetZ) {
    const constrained = constrainHorizontal(targetX, targetZ);
    targetX = constrained.x;
    targetZ = constrained.z;
    if (Math.abs(targetX - current.x) < 1e-8 && Math.abs(targetZ - current.z) < 1e-8) return { moved: false, ...current };

    const support = findGroundY(targetX, targetZ, current.y, {
      maxRise: RIFT_PLAYER_STEP_UP + 0.02,
      maxDrop: 4
    });

    // If a previous strict step-up happened before the player's center crossed
    // the riser, keep the player on that real top surface while any part of the
    // footprint is still supported by it. This avoids immediately snapping back
    // down for the few centimeters between first contact and center crossing.
    if (stepAssist && Math.abs(current.y - stepAssist.y) <= 0.08) {
      if (support != null && Math.abs(support - stepAssist.y) <= 0.08) {
        stepAssist = null;
      } else if (hasSupportAtHeightUnderFootprint(targetX, targetZ, stepAssist.y) && !bodyBlocked(targetX, stepAssist.y, targetZ)) {
        return { moved: true, x: targetX, y: stepAssist.y, z: targetZ, grounded: true };
      } else {
        stepAssist = null;
      }
    }

    // H1.72 support hysteresis: a lower CENTER sample cannot steal support from
    // a flat upper surface while a meaningful part of the foot still rests on
    // that surface. This is what makes "one foot on / one foot off" stable. A
    // small center-height change (notably a stair ramp) still follows the center
    // immediately, and legal upward steps retain H1.71 precedence.
    const supportDelta = support == null ? -Infinity : support - current.y;
    const keepCurrentFlatSupport = supportDelta <= -0.08
      && hasStableFlatSupportAtHeight(targetX, targetZ, current.y)
      && !bodyBlocked(targetX, current.y, targetZ);
    if (keepCurrentFlatSupport) {
      stepAssist = null;
      return { moved: true, x: targetX, y: current.y, z: targetZ, grounded: true };
    }

    // H1.75 stair-exit ownership: a lower center sample (especially a half slab)
    // must not pull the player down while the high end of the departing ramp is
    // still under the foot. Keep the current height only while a stair sample is
    // genuinely near that height; once the foot clears, the lower support wins.
    const keepCurrentStairEdgeSupport = supportDelta <= -0.08
      && hasStairSupportNearHeight(targetX, targetZ, current.y)
      && !bodyBlocked(targetX, current.y, targetZ);
    if (keepCurrentStairEdgeSupport) {
      stepAssist = null;
      return { moved: true, x: targetX, y: current.y, z: targetZ, grounded: true };
    }

    const classification = classifyRiftPlayerGroundStep(current.y, support);

    if (classification === 'grounded') {
      if (bodyBlocked(targetX, support, targetZ)) {
        const stepY = findWalkableStepUpY(current, targetX, targetZ);
        if (stepY != null) {
          stepAssist = { y: stepY };
          return { moved: true, x: targetX, y: stepY, z: targetZ, grounded: true };
        }

        // A lower center support can be perfectly valid while the player's body
        // radius still overlaps the SIDE of the higher block being left. Do not
        // snap down into that side and do not stop horizontal motion: move clear
        // at the current height, release grounded state, then let the swept fall
        // land on the lower slab/ramp/floor once the cylinder has cleared.
        if (support < current.y - 0.001 && !bodyBlocked(targetX, current.y, targetZ)) {
          stepAssist = null;
          return { moved: true, x: targetX, y: current.y, z: targetZ, grounded: false };
        }

        const currentScore = bodyBlockScore(current.x, current.y, current.z);
        const targetScore = bodyBlockScore(targetX, support, targetZ);
        if (!(currentScore > 0 && targetScore < currentScore)) return { moved: false, ...current };
      }
      if (stepAssist && Math.abs(support - stepAssist.y) <= 0.08) stepAssist = null;
      return { moved: true, x: targetX, y: support, z: targetZ, grounded: true };
    }

    if (classification === 'drop') {
      // Losing the support under the player's CENTER immediately releases the
      // player into gravity. We never replace "no ground" with the world minimum,
      // which was the source of the old ledge magnet/stick. A legal low obstacle
      // may still be stepped onto, but only by moving vertically first.
      if (bodyBlocked(targetX, current.y, targetZ)) {
        const stepY = findWalkableStepUpY(current, targetX, targetZ);
        if (stepY != null) {
          stepAssist = { y: stepY };
          return { moved: true, x: targetX, y: stepY, z: targetZ, grounded: true };
        }
        return { moved: false, ...current };
      }
      stepAssist = null;
      return { moved: true, x: targetX, y: current.y, z: targetZ, grounded: false };
    }

    return { moved: false, ...current };
  }

  function tryAirMove(current, targetX, targetZ) {
    stepAssist = null;
    const constrained = constrainHorizontal(targetX, targetZ);
    targetX = constrained.x;
    targetZ = constrained.z;
    if (Math.abs(targetX - current.x) < 1e-8 && Math.abs(targetZ - current.z) < 1e-8) return { moved: false, ...current };
    if (bodyBlocked(targetX, current.y, targetZ)) {
      const currentScore = bodyBlockScore(current.x, current.y, current.z);
      const targetScore = bodyBlockScore(targetX, current.y, targetZ);
      if (!(currentScore > 0 && targetScore < currentScore)) return { moved: false, ...current };
    }
    return { moved: true, x: targetX, y: current.y, z: targetZ, grounded: false };
  }

  function moveHorizontal(startX, startY, startZ, totalDx, totalDz) {
    const distance = Math.hypot(totalDx, totalDz);
    const steps = Math.max(1, Math.ceil(distance / 0.095));
    const dx = totalDx / steps;
    const dz = totalDz / steps;
    let state = { x: startX, y: startY, z: startZ, grounded };

    for (let i = 0; i < steps; i += 1) {
      const move = state.grounded ? tryGroundMove : tryAirMove;
      let next = move(state, state.x + dx, state.z + dz);
      if (!next.moved && Math.abs(dx) > 0.00001 && Math.abs(dz) > 0.00001) {
        // Wall sliding still works, but each axis uses the same support/step
        // solver so a diagonal stair edge cannot require sprinting to cross.
        const alongX = move(state, state.x + dx, state.z);
        if (alongX.moved) state = alongX;
        const alongZ = move(state, state.x, state.z + dz);
        if (alongZ.moved) state = alongZ;
      } else if (next.moved) {
        state = next;
      }
    }
    grounded = state.grounded;
    return state;
  }

  function simulatePhysicsStep(dt, inputX, inputZ, running) {
    const speed = creative ? (running ? 8.5 : 5.2) : (running ? 5.2 : 3.2);
    const pos = player.position;
    const forward = camera.flatForward();
    const right = [-forward[2], 0, forward[0]];
    const vx = (forward[0] * inputZ + right[0] * inputX) * speed;
    const vz = (forward[2] * inputZ + right[2] * inputX) * speed;
    let nextX = pos[0], nextY = pos[1], nextZ = pos[2];

    if (creative && flying) {
      const vertical = (keys.has('Space') || touch.jump ? 1 : 0) - (keys.has('KeyQ') || touch.down ? 1 : 0);
      nextX += vx * dt;
      nextZ += vz * dt;
      nextY += vertical * speed * dt;
      const bounds = getWorldBounds?.();
      if (bounds) {
        nextX = clamp(nextX, bounds.min[0] - 16, bounds.max[0] + 17);
        nextY = clamp(nextY, bounds.min[1] + .2, bounds.max[1] + 32);
        nextZ = clamp(nextZ, bounds.min[2] - 16, bounds.max[2] + 17);
      }
      grounded = false;
      jumpVelocity = 0;
      stepAssist = null;
    } else {
      if (Math.hypot(vx, vz) > .01) {
        targetFacing = Math.atan2(vx, vz);
        const moved = moveHorizontal(pos[0], pos[1], pos[2], vx * dt, vz * dt);
        nextX = moved.x;
        nextY = moved.y;
        nextZ = moved.z;
      }

      if (!grounded || jumpVelocity > 0) {
        const previousY = nextY;
        jumpVelocity -= 12.5 * dt;
        const candidateY = nextY + jumpVelocity * dt;

        if (jumpVelocity <= 0) {
          // A descending player can overlap the side of the block they just left
          // while crossing a lower floor. Never let that upper/side contact mask
          // the valid surface below: evaluate every crossed support from high to
          // low and resolve a tiny horizontal depenetration when necessary.
          const landings = landingCandidatesUnderFootprint(nextX, nextZ, previousY, candidateY, {
            extraDrop: 0.2,
            tolerance: 0.035,
            previousTolerance: 0.015
          });
          let resolvedLanding = null;
          for (const landingCandidate of landings) {
            const landing = landingCandidate.y;
            const placement = resolveLandingPlacement(nextX, nextZ, landing, vx, vz);
            if (!placement) continue;
            resolvedLanding = { landing: placement.y ?? landing, ...placement };
            break;
          }
          if (resolvedLanding) {
            nextX = resolvedLanding.x;
            nextZ = resolvedLanding.z;
            nextY = resolvedLanding.landing;
            jumpVelocity = 0;
            grounded = true;
          } else {
            // If the falling cylinder is still brushing the SIDE of the block it
            // just left, clear that overlap before lowering the feet. H1.69 only
            // corrected this at the eventual landing, which still allowed a
            // visible frame or two inside the upper block.
            const cleared = resolveNonPenetratingHorizontal(nextX, candidateY, nextZ, vx, vz);
            if (cleared) {
              nextX = cleared.x;
              nextZ = cleared.z;
              nextY = candidateY;
            } else {
              nextY = sweepVerticalToNonPenetrating(nextX, previousY, candidateY, nextZ);
              if (nextY > candidateY + 1e-5) jumpVelocity = Math.min(0, jumpVelocity);
            }
          }
        } else {
          // Upward motion gets the same pre-contact sweep. This prevents feet or
          // the body entering a full block side while jumping onto it, and also
          // prevents head/ceiling tunnelling.
          const upwardPlacement = resolveNonPenetratingHorizontal(nextX, candidateY, nextZ, vx, vz, 0.08);
          if (upwardPlacement) {
            nextX = upwardPlacement.x;
            nextZ = upwardPlacement.z;
            nextY = candidateY;
          } else {
            nextY = sweepVerticalToNonPenetrating(nextX, previousY, candidateY, nextZ);
            jumpVelocity = 0;
          }
        }
      } else {
        const support = findGroundY(nextX, nextZ, nextY, {
          maxRise: RIFT_PLAYER_STEP_UP + 0.02,
          maxDrop: RIFT_PLAYER_GROUND_SNAP_DOWN + 0.04
        });
        if (stepAssist && Math.abs(nextY - stepAssist.y) <= 0.08 && support != null && Math.abs(support - stepAssist.y) <= 0.08) {
          stepAssist = null;
        }
        if (stepAssist && Math.abs(nextY - stepAssist.y) <= 0.08 && hasSupportAtHeightUnderFootprint(nextX, nextZ, stepAssist.y) && !bodyBlocked(nextX, stepAssist.y, nextZ)) {
          nextY = stepAssist.y;
          grounded = true;
        } else {
          if (stepAssist) stepAssist = null;
          const supportDelta = support == null ? -Infinity : support - nextY;
          const keepFlatOwner = supportDelta <= -0.08
            && hasStableFlatSupportAtHeight(nextX, nextZ, nextY)
            && !bodyBlocked(nextX, nextY, nextZ);
          const keepStairEdgeOwner = supportDelta <= -0.08
            && hasStairSupportNearHeight(nextX, nextZ, nextY)
            && !bodyBlocked(nextX, nextY, nextZ);
          if (keepFlatOwner || keepStairEdgeOwner) {
            // Flat tops and the high edge of a departing stair both retain
            // support only while meaningful foot contact remains. This prevents
            // idle stair->slab snapping/trapping without changing the smooth ramp.
            grounded = true;
          } else {
            const classification = classifyRiftPlayerGroundStep(nextY, support);
            if (classification === 'grounded') {
              nextY = support;
            } else if (classification === 'drop') {
              grounded = false;
              jumpVelocity = 0;
            }
          }
        }
      }
    }

    const dx = Math.sin(targetFacing - player.facing);
    const dy = Math.cos(targetFacing - player.facing);
    if (Math.hypot(vx, vz) > .01) {
      player.setFacingRadians(player.facing + Math.atan2(dx, dy) * Math.min(1, dt * 10));
    }

    if (!(creative && flying) && bodyBlocked(nextX, nextY, nextZ)) {
      // Final invariant before rendering: never commit a player transform that
      // intersects solid RiftBlock volume. Prefer a tiny horizontal correction;
      // otherwise roll back to the start of this physics substep.
      const corrected = resolveNonPenetratingHorizontal(nextX, nextY, nextZ, vx, vz);
      if (corrected) {
        nextX = corrected.x;
        nextZ = corrected.z;
      } else if (!bodyBlocked(pos[0], pos[1], pos[2])) {
        nextX = pos[0];
        nextY = pos[1];
        nextZ = pos[2];
        jumpVelocity = Math.min(0, jumpVelocity);
      } else {
        recoverToSafeGround('solid-penetration-invariant');
        return;
      }
    }

    player.setPosition(nextX, nextY, nextZ);
    if (!(creative && flying)) {
      const bounds = getWorldBounds?.();
      if (nextY < riftPlayerKillPlane(bounds)) {
        recoverToSafeGround('kill-plane');
        return;
      }
      if (grounded) rememberSafeGrounded(nextX, nextY, nextZ);
    }
  }

  function update(dt) {
    if (!enabled) {
      player.setMotion(false, false);
      return;
    }

    const keyboardX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const keyboardZ = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    let inputX = keyboardX || touch.x;
    let inputZ = keyboardZ || touch.z;
    const len = Math.hypot(inputX, inputZ);
    if (len > 1) {
      inputX /= len;
      inputZ /= len;
    }

    const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.run;
    const frameDt = clamp(Number(dt) || 0, 0, 0.1);
    const stepCount = Math.max(1, Math.ceil(frameDt / RIFT_PLAYER_PHYSICS_MAX_STEP));
    const stepDt = stepCount ? frameDt / stepCount : 0;
    for (let i = 0; i < stepCount; i += 1) simulatePhysicsStep(stepDt, inputX, inputZ, running);

    syncPlayerStairVisualOffset();
    const movingNow = Math.hypot(inputX, inputZ) > .04;
    player.setMotion(movingNow, running);
    player.update(frameDt);
  }

  return {
    update,
    teleport,
    revalidateWorld,
    recoverToSafeGround,
    setEnabled(next) {
      enabled = !!next;
      keys.clear();
      touch.x = touch.z = 0;
      touch.run = false;
      touch.jump = false;
      touch.down = false;
    },
    get enabled() { return enabled; },
    setCreativeMode(next) {
      creative = !!next;
      if (!creative) {
        flying = false;
        stepAssist = null;
        revalidateWorld({ allowFall: true });
      }
      jumpVelocity = 0;
    },
    get creative() { return creative; },
    setFlying(next) {
      const wasFlying = flying;
      flying = creative && !!next;
      jumpVelocity = 0;
      grounded = !flying;
      stepAssist = null;
      if (wasFlying && !flying) revalidateWorld({ allowFall: true });
    },
    toggleFlying() {
      if (creative) {
        const wasFlying = flying;
        flying = !flying;
        jumpVelocity = 0;
        grounded = !flying;
        stepAssist = null;
        if (wasFlying && !flying) revalidateWorld({ allowFall: true });
      }
      return flying;
    },
    get flying() { return flying; },
    get grounded() { return grounded; },
    get lastSafeGroundedPosition() { return lastSafeGroundedPosition ? [...lastSafeGroundedPosition] : null; },
    get recoveryCount() { return recoveryCount; },
    getGroundY: findGroundY,
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      pad?.removeEventListener('pointerdown', onPadDown);
      pad?.removeEventListener('pointermove', onPadMove);
      pad?.removeEventListener('pointerup', onPadUp);
      pad?.removeEventListener('pointercancel', onPadUp);
    }
  };
}
