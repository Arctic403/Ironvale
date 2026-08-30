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

const DEFAULT_PITCH_LIMIT = Math.PI * 0.46;

export const RIFT_FIRST_PERSON_CAMERA_DEFAULTS = Object.freeze({
  eyeHeight: 1.62,
  lookDistance: 24,
  pitchLimit: DEFAULT_PITCH_LIMIT
});

export function riftFirstPersonLookDirection(yaw = 0, pitch = 0) {
  const cp = Math.cos(Number(pitch) || 0);
  const sp = Math.sin(Number(pitch) || 0);
  const y = Number(yaw) || 0;
  return [Math.sin(y) * cp, sp, Math.cos(y) * cp];
}

export function createRiftFirstPersonCamera({
  camera,
  getPlayerPosition = () => [0, 0, 0],
  getPlayerFacing = () => 0,
  setPlayerFacing = null,
  getEyeHeight = () => RIFT_FIRST_PERSON_CAMERA_DEFAULTS.eyeHeight,
  options = {}
} = {}) {
  if (!camera) throw new Error('createRiftFirstPersonCamera requires a RiftCamera.');
  const config = { ...RIFT_FIRST_PERSON_CAMERA_DEFAULTS, ...options };
  let yaw = normalizeAngle(getPlayerFacing());
  let pitch = 0;

  const apply = () => {
    camera.setProjection?.('perspective');
    const p = getPlayerPosition?.() || [0, 0, 0];
    const eyeHeight = Math.max(0.1, Number(getEyeHeight?.() ?? config.eyeHeight) || config.eyeHeight);
    const eye = [Number(p[0]) || 0, (Number(p[1]) || 0) + eyeHeight, Number(p[2]) || 0];
    const dir = riftFirstPersonLookDirection(yaw, pitch);
    const lookDistance = Math.max(1, Number(config.lookDistance) || 24);

    // RiftEngine calls RiftCamera.updatePosition() immediately before every
    // render. Represent first-person as an orbit whose target sits forward from
    // the eye: the orbit solver then lands the camera position exactly at the
    // eye while still looking toward that forward target.
    camera.alpha = -Math.PI / 2 - yaw;
    camera.beta = Math.PI / 2 + pitch;
    camera.radius = lookDistance;
    camera.target[0] = eye[0] + dir[0] * lookDistance;
    camera.target[1] = eye[1] + dir[1] * lookDistance;
    camera.target[2] = eye[2] + dir[2] * lookDistance;
    camera.updatePosition?.();
    setPlayerFacing?.(yaw);
  };

  const reset = ({ immediate = true } = {}) => {
    yaw = normalizeAngle(getPlayerFacing());
    pitch = 0;
    if (immediate) apply();
  };

  const orbit = (deltaAlpha = 0, deltaBeta = 0) => {
    // The shared drag control sends right-drag as negative alpha and down-drag
    // as positive beta. First person should follow the drag direction, so a
    // rightward drag rotates the view right (negative yaw in this coordinate
    // convention) while vertical look keeps the existing pitch mapping.
    yaw = normalizeAngle(yaw + Number(deltaAlpha || 0));
    pitch = clamp(
      pitch - Number(deltaBeta || 0),
      -Math.abs(Number(config.pitchLimit) || DEFAULT_PITCH_LIMIT),
      Math.abs(Number(config.pitchLimit) || DEFAULT_PITCH_LIMIT)
    );
    apply();
  };

  const update = () => apply();

  reset({ immediate: false });
  return {
    update,
    reset,
    orbit,
    zoom() {},
    get yaw() { return yaw; },
    get pitch() { return pitch; }
  };
}

export function validateRiftFirstPersonCamera() {
  const failures = [];
  const almost = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

  const north = riftFirstPersonLookDirection(0, 0);
  if (!almost(north[0], 0) || !almost(north[1], 0) || !almost(north[2], 1)) failures.push('yaw 0 does not look +Z');
  const east = riftFirstPersonLookDirection(Math.PI / 2, 0);
  if (!almost(east[0], 1) || !almost(east[2], 0)) failures.push('yaw PI/2 does not look +X');
  const upward = riftFirstPersonLookDirection(0, 0.35);
  if (!(upward[1] > 0 && upward[2] > 0)) failures.push('positive pitch does not look upward');

  let facing = 0;
  const camera = {
    projection: 'orthographic',
    position: [0, 0, 0],
    target: [0, 0, 0],
    alpha: 0,
    beta: 0,
    radius: 1,
    setProjection(mode) { this.projection = mode; },
    updatePosition() {
      const sinBeta = Math.sin(this.beta);
      this.position[0] = this.target[0] + this.radius * sinBeta * Math.cos(this.alpha);
      this.position[1] = this.target[1] + this.radius * Math.cos(this.beta);
      this.position[2] = this.target[2] + this.radius * sinBeta * Math.sin(this.alpha);
    }
  };
  const controller = createRiftFirstPersonCamera({
    camera,
    getPlayerPosition: () => [4, 2, 7],
    getPlayerFacing: () => facing,
    setPlayerFacing: value => { facing = value; },
    getEyeHeight: () => 1.62
  });
  controller.update(0);
  if (camera.projection !== 'perspective') failures.push('first-person camera did not force perspective projection');
  if (!almost(camera.position[0], 4) || !almost(camera.position[1], 3.62) || !almost(camera.position[2], 7)) {
    failures.push('first-person camera is not positioned at player eye height');
  }
  controller.orbit(-0.25, 0.1);
  if (!(controller.yaw < 0 && controller.pitch < 0)) failures.push('shared drag deltas do not map to first-person yaw/pitch');

  return { ok: failures.length === 0, failures };
}
