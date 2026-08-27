import { decodeRiftBlockState, RIFT_BLOCK_SHAPES, RIFT_BLOCK_ROTATIONS } from './rift-block-shapes.js';

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export const RIFT_PLAYER_HEIGHT = 1.8;
export const RIFT_PLAYER_EYE_HEIGHT = 1.62;
export const RIFT_PLAYER_RADIUS = 0.28;
export const RIFT_PLAYER_PHYSICS_MAX_STEP = 1 / 120;
export const RIFT_PLAYER_KILL_MARGIN = 8;
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
  return candidateY <= supportY + contactTolerance && previousY >= supportY - startTolerance;
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

  function setVisible(next) { visible = !!next; for (const d of drawables) d.visible = visible; }
  function setPosition(x, y, z) { position = [Number(x) || 0, Number(y) || 0, Number(z) || 0]; }
  function setFacingRadians(angle) { facing = Number(angle) || 0; }
  function setMotion(isMoving, running = false) { moving = !!isMoving; runAmount = running ? 1 : 0; }

  function update(dt = 0) {
    if (!visible) return;
    strideTime += Math.max(0, Number(dt) || 0) * (moving ? (runAmount > 0.4 ? 10 : 7) : 2.2);
    const swing = moving ? Math.sin(strideTime) * (0.15 + runAmount * 0.08) : Math.sin(strideTime) * 0.01;
    const bob = moving ? Math.abs(Math.sin(strideTime * 2)) * 0.018 : 0;
    const [x, y, z] = position;
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
    get facing() { return facing; },
    get height() { return RIFT_PLAYER_HEIGHT; },
    get eyeHeight() { return RIFT_PLAYER_EYE_HEIGHT; },
    get radius() { return RIFT_PLAYER_RADIUS; },
    setVisible, setPosition, setFacingRadians, setMotion, update, destroy
  };
}

export const RIFT_PLAYER_STEP_UP = 0.58;
export const RIFT_PLAYER_GROUND_SNAP_DOWN = 0.72;

export function riftPlayerStairTop(decoded, localX, localZ) {
  let t = 0;
  switch (decoded.rotation) {
    case RIFT_BLOCK_ROTATIONS.north: t = 1 - localZ; break;
    case RIFT_BLOCK_ROTATIONS.east: t = localX; break;
    case RIFT_BLOCK_ROTATIONS.south: t = localZ; break;
    case RIFT_BLOCK_ROTATIONS.west: t = 1 - localX; break;
    default: t = 0;
  }
  return 0.5 + clamp(t, 0, 1) * 0.5;
}

export function riftPlayerShapeTopAt(state, worldX, worldZ) {
  if (!state) return 0;
  const decoded = decodeRiftBlockState(state);
  const localX = worldX - Math.floor(worldX);
  const localZ = worldZ - Math.floor(worldZ);
  switch (decoded.shape) {
    case RIFT_BLOCK_SHAPES.bottomSlab: return 0.5;
    case RIFT_BLOCK_SHAPES.topSlab: return 1;
    case RIFT_BLOCK_SHAPES.stair: return riftPlayerStairTop(decoded, localX, localZ);
    case RIFT_BLOCK_SHAPES.full:
    default: return 1;
  }
}

export function classifyRiftPlayerGroundStep(currentY, targetSupportY, options = {}) {
  const stepUp = Number(options.stepUp ?? RIFT_PLAYER_STEP_UP);
  const snapDown = Number(options.snapDown ?? RIFT_PLAYER_GROUND_SNAP_DOWN);
  if (targetSupportY == null || !Number.isFinite(targetSupportY)) return 'drop';
  const delta = targetSupportY - currentY;
  if (delta > stepUp + 0.0001) return 'blocked';
  if (delta < -snapDown - 0.0001) return 'drop';
  return 'grounded';
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

  function bodyBlocked(x, floorY, z) {
    const r = player.radius;
    const probes = [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]];
    // Start above the maximum height variation that can occur across the player's
    // footprint on one legal 0.5 m stair ramp. This prevents the support stair
    // itself from becoming an invisible knee-high wall.
    const heights = [0.24, 0.72, 1.28, player.height - 0.08];

    for (const [dx, dz] of probes) {
      for (const h of heights) {
        const px = x + dx, pz = z + dz, py = floorY + h;
        if (!surfaces.pointSolidAt(px, py, pz)) continue;

        if (h < RIFT_PLAYER_STEP_UP + 0.04) {
          const cy = Math.floor(py);
          const state = getState(px, cy, pz);
          if (state) {
            const obstacleTop = cy + riftPlayerShapeTopAt(state, px, pz);
            if (obstacleTop <= floorY + RIFT_PLAYER_STEP_UP + 0.025) continue;
          }
        }
        return true;
      }
    }
    return false;
  }

  function bodyBlockScore(x, floorY, z) {
    const r = player.radius;
    const probes = [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0], [-r, 0], [r, 0], [0, -r], [0, r]];
    const heights = [0.24, 0.72, 1.28, player.height - 0.08];
    let score = 0;
    for (const [dx, dz] of probes) {
      for (const h of heights) {
        const px = x + dx, pz = z + dz, py = floorY + h;
        if (!surfaces.pointSolidAt(px, py, pz)) continue;
        if (h < RIFT_PLAYER_STEP_UP + 0.04) {
          const cy = Math.floor(py);
          const state = getState(px, cy, pz);
          if (state) {
            const obstacleTop = cy + riftPlayerShapeTopAt(state, px, pz);
            if (obstacleTop <= floorY + RIFT_PLAYER_STEP_UP + 0.025) continue;
          }
        }
        score += 1;
      }
    }
    return score;
  }

  function resolveLandingPlacement(x, z, landingY, preferX = 0, preferZ = 0) {
    const constrainedBase = constrainHorizontal(x, z);
    const baseX = constrainedBase.x, baseZ = constrainedBase.z;
    const validAt = (px, pz) => {
      const support = findGroundY(px, pz, landingY + 0.22, { maxRise: 0.24, maxDrop: 0.28 });
      if (support == null || Math.abs(support - landingY) > 0.24) return null;
      if (bodyBlocked(px, support, pz)) return null;
      return support;
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
    const base = [clampedBase.x, requested[1], clampedBase.z];
    const sampled = findGroundY(base[0], base[2], base[1] + 2, { maxRise: 0.1, maxDrop: 8 });
    const y = sampled ?? (bounds ? bounds.min[1] + 1 : 0);
    if (sampled != null && !bodyBlocked(base[0], y, base[2])) return [base[0], y, base[2]];

    for (let radius = 1; radius <= 14; radius += 1) {
      for (let a = 0; a < 16; a += 1) {
        const angle = a / 16 * Math.PI * 2;
        const constrained = constrainHorizontal(base[0] + Math.cos(angle) * radius, base[2] + Math.sin(angle) * radius);
        const x = constrained.x, z = constrained.z;
        const support = findGroundY(x, z, base[1] + 2, { maxRise: 0.1, maxDrop: 8 });
        if (support == null) continue;
        if (!bodyBlocked(x, support, z)) return [x, support, z];
      }
    }
    return [base[0], y, base[2]];
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
    jumpVelocity = 0;
    grounded = true;
    recoveryCount += 1;
    rememberSafeGrounded(...target);
    return { position: [...target], reason, recoveryCount };
  }

  function teleport(preferred) {
    const spawn = resolveSpawn(preferred);
    player.setPosition(...spawn);
    jumpVelocity = 0;
    grounded = true;
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
    const classification = classifyRiftPlayerGroundStep(current.y, support);

    if (classification === 'grounded') {
      if (bodyBlocked(targetX, support, targetZ)) {
        const currentScore = bodyBlockScore(current.x, current.y, current.z);
        const targetScore = bodyBlockScore(targetX, support, targetZ);
        if (!(currentScore > 0 && targetScore < currentScore)) return { moved: false, ...current };
      }
      return { moved: true, x: targetX, y: support, z: targetZ, grounded: true };
    }

    if (classification === 'drop') {
      // Losing the support under the player's CENTER immediately releases the
      // player into gravity. We never replace "no ground" with the world minimum,
      // which was the source of the old ledge magnet/stick.
      if (bodyBlocked(targetX, current.y, targetZ)) return { moved: false, ...current };
      return { moved: true, x: targetX, y: current.y, z: targetZ, grounded: false };
    }

    return { moved: false, ...current };
  }

  function tryAirMove(current, targetX, targetZ) {
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
          const landings = surfaces.supportCrossings(nextX, nextZ, previousY, candidateY, {
            extraDrop: 0.2,
            tolerance: 0.035,
            previousTolerance: 0.015
          });
          let resolvedLanding = null;
          for (const landing of landings) {
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
            nextY = candidateY;
          }
        } else {
          nextY = candidateY;
        }
      } else {
        const support = findGroundY(nextX, nextZ, nextY, {
          maxRise: RIFT_PLAYER_STEP_UP + 0.02,
          maxDrop: RIFT_PLAYER_GROUND_SNAP_DOWN + 0.04
        });
        const classification = classifyRiftPlayerGroundStep(nextY, support);
        if (classification === 'grounded') {
          nextY = support;
        } else if (classification === 'drop') {
          grounded = false;
          jumpVelocity = 0;
        }
      }
    }

    const dx = Math.sin(targetFacing - player.facing);
    const dy = Math.cos(targetFacing - player.facing);
    if (Math.hypot(vx, vz) > .01) {
      player.setFacingRadians(player.facing + Math.atan2(dx, dy) * Math.min(1, dt * 10));
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
      if (wasFlying && !flying) revalidateWorld({ allowFall: true });
    },
    toggleFlying() {
      if (creative) {
        const wasFlying = flying;
        flying = !flying;
        jumpVelocity = 0;
        grounded = !flying;
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
