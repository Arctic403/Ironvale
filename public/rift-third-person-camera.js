const TAU = Math.PI * 2;

export const RIFT_THIRD_PERSON_CAMERA_DEFAULTS = Object.freeze({
  distance: 8.5,
  minDistance: 2.2,
  targetHeight: 1.15,
  lookAhead: 0.45,
  beta: 1.02,
  targetResponsiveness: 10,
  distanceResponsiveness: 14,
  collisionStep: 0.18,
  collisionSkin: 0.28
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function smoothFactor(dt, responsiveness) {
  return 1 - Math.exp(-Math.max(0, Number(dt) || 0) * Math.max(0, Number(responsiveness) || 0));
}
function normalizeAngle(value) {
  let angle = Number(value) || 0;
  angle %= TAU;
  if (angle <= -Math.PI) angle += TAU;
  if (angle > Math.PI) angle -= TAU;
  return angle;
}

export function riftThirdPersonAlphaBehindFacing(facing = 0) {
  return normalizeAngle((Number(facing) || 0) - Math.PI / 2);
}

function desiredTarget(playerPosition, facing, config) {
  const f = Number(facing) || 0;
  return [
    (Number(playerPosition?.[0]) || 0) + Math.sin(f) * config.lookAhead,
    (Number(playerPosition?.[1]) || 0) + config.targetHeight,
    (Number(playerPosition?.[2]) || 0) + Math.cos(f) * config.lookAhead
  ];
}

function desiredCameraPosition(target, alpha, beta, radius) {
  const sinBeta = Math.sin(beta);
  return [
    target[0] + radius * sinBeta * Math.cos(alpha),
    target[1] + radius * Math.cos(beta),
    target[2] + radius * sinBeta * Math.sin(alpha)
  ];
}

function occupiedAt(grid, x, y, z) {
  if (!grid?.getBlockWorld) return false;
  return !!grid.getBlockWorld(Math.floor(x), Math.floor(y), Math.floor(z));
}

export function resolveRiftThirdPersonCameraDistance({
  grid,
  target,
  alpha,
  beta,
  desiredDistance,
  minDistance = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minDistance,
  collisionStep = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.collisionStep,
  collisionSkin = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.collisionSkin
} = {}) {
  const distance = Math.max(minDistance, Number(desiredDistance) || RIFT_THIRD_PERSON_CAMERA_DEFAULTS.distance);
  if (!grid?.getBlockWorld) return distance;
  const end = desiredCameraPosition(target, alpha, beta, distance);
  const dx = end[0] - target[0], dy = end[1] - target[1], dz = end[2] - target[2];
  const length = Math.hypot(dx, dy, dz) || 1;
  const steps = Math.max(1, Math.ceil(length / Math.max(0.08, collisionStep)));
  let safeDistance = distance;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = target[0] + dx * t;
    const y = target[1] + dy * t;
    const z = target[2] + dz * t;
    if (!occupiedAt(grid, x, y, z)) continue;
    safeDistance = Math.max(minDistance, length * Math.max(0, t - collisionSkin / length));
    break;
  }
  return clamp(safeDistance, minDistance, distance);
}

export function createRiftThirdPersonCamera({
  camera,
  getPlayerPosition = () => [0, 0, 0],
  getPlayerFacing = () => 0,
  getGrid = () => null,
  isOverview = () => false,
  options = {}
} = {}) {
  if (!camera) throw new Error('createRiftThirdPersonCamera requires a RiftCamera.');
  const config = { ...RIFT_THIRD_PERSON_CAMERA_DEFAULTS, ...options };
  let preferredDistance = config.distance;

  const reset = ({ immediate = false } = {}) => {
    camera.setProjection('perspective');
    camera.beta = config.beta;
    camera.alpha = riftThirdPersonAlphaBehindFacing(getPlayerFacing());
    preferredDistance = config.distance;
    camera.minRadius = config.minDistance;
    camera.maxRadius = Math.max(config.distance * 1.8, 14);
    if (immediate) {
      const target = desiredTarget(getPlayerPosition(), getPlayerFacing(), config);
      const radius = resolveRiftThirdPersonCameraDistance({
        grid: getGrid(), target, alpha: camera.alpha, beta: camera.beta,
        desiredDistance: preferredDistance, minDistance: config.minDistance,
        collisionStep: config.collisionStep, collisionSkin: config.collisionSkin
      });
      camera.radius = radius;
      camera.setTarget(...target);
    }
  };

  const orbit = (deltaAlpha = 0, deltaBeta = 0) => {
    camera.alpha = normalizeAngle(camera.alpha + Number(deltaAlpha || 0));
    camera.beta = clamp(camera.beta + Number(deltaBeta || 0), 0.72, 1.22);
  };

  const zoom = delta => {
    preferredDistance = clamp(preferredDistance + Number(delta || 0), config.minDistance, 14);
  };

  const update = dt => {
    if (isOverview()) return;
    camera.setProjection('perspective');
    const wantedTarget = desiredTarget(getPlayerPosition(), getPlayerFacing(), config);
    const tf = smoothFactor(dt, config.targetResponsiveness);
    camera.target[0] += (wantedTarget[0] - camera.target[0]) * tf;
    camera.target[1] += (wantedTarget[1] - camera.target[1]) * tf;
    camera.target[2] += (wantedTarget[2] - camera.target[2]) * tf;

    const safeDistance = resolveRiftThirdPersonCameraDistance({
      grid: getGrid(), target: camera.target, alpha: camera.alpha, beta: camera.beta,
      desiredDistance: preferredDistance, minDistance: config.minDistance,
      collisionStep: config.collisionStep, collisionSkin: config.collisionSkin
    });
    const responsiveness = safeDistance < camera.radius ? config.distanceResponsiveness * 2.2 : config.distanceResponsiveness;
    camera.radius += (safeDistance - camera.radius) * smoothFactor(dt, responsiveness);
    camera.updatePosition();
  };

  reset({ immediate: true });
  return { update, reset, orbit, zoom, get preferredDistance() { return preferredDistance; } };
}

export function validateRiftThirdPersonCamera() {
  const failures = [];
  const fakeGrid = {
    getBlockWorld(x, y, z) {
      return (x === 0 && y >= 1 && y <= 4 && z === -4) ? 1 : 0;
    }
  };
  const facing = 0;
  const alpha = riftThirdPersonAlphaBehindFacing(facing);
  if (Math.abs(alpha + Math.PI / 2) > 1e-8) failures.push('north-facing player camera is not positioned behind the player');
  const target = [0.5, 2, 0.5];
  const clear = resolveRiftThirdPersonCameraDistance({ grid: { getBlockWorld: () => 0 }, target, alpha, beta: 1.02, desiredDistance: 8.5 });
  if (Math.abs(clear - 8.5) > 1e-6) failures.push('clear third-person view changed camera distance');
  const blocked = resolveRiftThirdPersonCameraDistance({ grid: fakeGrid, target, alpha, beta: 1.02, desiredDistance: 8.5 });
  if (!(blocked < 8.5 && blocked >= RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minDistance)) failures.push('camera collision did not retract before a blocking wall');
  return { ok: failures.length === 0, failures };
}
