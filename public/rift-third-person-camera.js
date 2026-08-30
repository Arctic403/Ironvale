const TAU = Math.PI * 2;

export const RIFT_THIRD_PERSON_CAMERA_DEFAULTS = Object.freeze({
  distance: 8.5,
  minDistance: 2.2,
  targetHeight: 1.15,
  // Keep the center reticle meaningfully out in the world instead of sitting
  // on top of the avatar. The camera boom remains centered on the player; this
  // value controls only the forward look/aim point.
  lookAhead: 7.5,
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
  setPlayerFacing = null,
  getGrid = () => null,
  isOverview = () => false,
  options = {}
} = {}) {
  if (!camera) throw new Error('createRiftThirdPersonCamera requires a RiftCamera.');
  const config = { ...RIFT_THIRD_PERSON_CAMERA_DEFAULTS, ...options };
  const fixedDistance = Math.max(config.minDistance, Number(config.distance) || RIFT_THIRD_PERSON_CAMERA_DEFAULTS.distance);
  let boomBeta = Number(config.beta) || RIFT_THIRD_PERSON_CAMERA_DEFAULTS.beta;
  let currentDistance = fixedDistance;

  const playerAnchor = () => {
    const p = getPlayerPosition?.() || [0, 0, 0];
    return [
      Number(p[0]) || 0,
      (Number(p[1]) || 0) + config.targetHeight,
      Number(p[2]) || 0
    ];
  };

  const aimTarget = (anchor, facing) => {
    const f = Number(facing) || 0;
    const ahead = Math.max(2, Number(config.lookAhead) || RIFT_THIRD_PERSON_CAMERA_DEFAULTS.lookAhead);
    return [
      anchor[0] + Math.sin(f) * ahead,
      anchor[1],
      anchor[2] + Math.cos(f) * ahead
    ];
  };

  const setCameraPose = (position, target) => {
    const dx = position[0] - target[0];
    const dy = position[1] - target[1];
    const dz = position[2] - target[2];
    const radius = Math.max(0.001, Math.hypot(dx, dy, dz));
    camera.target[0] = target[0];
    camera.target[1] = target[1];
    camera.target[2] = target[2];
    camera.radius = radius;
    camera.alpha = Math.atan2(dz, dx);
    camera.beta = Math.acos(clamp(dy / radius, -1, 1));
    camera.updatePosition?.();
  };

  const resolvePose = ({ immediate = false, dt = 0 } = {}) => {
    const facing = normalizeAngle(getPlayerFacing());
    const anchor = playerAnchor();
    const boomAlpha = riftThirdPersonAlphaBehindFacing(facing);
    const safeDistance = resolveRiftThirdPersonCameraDistance({
      grid: getGrid(), target: anchor, alpha: boomAlpha, beta: boomBeta,
      desiredDistance: fixedDistance, minDistance: config.minDistance,
      collisionStep: config.collisionStep, collisionSkin: config.collisionSkin
    });
    if (immediate) currentDistance = safeDistance;
    else {
      const responsiveness = safeDistance < currentDistance ? config.distanceResponsiveness * 2.2 : config.distanceResponsiveness;
      currentDistance += (safeDistance - currentDistance) * smoothFactor(dt, responsiveness);
    }
    const position = desiredCameraPosition(anchor, boomAlpha, boomBeta, currentDistance);
    setCameraPose(position, aimTarget(anchor, facing));
  };

  const reset = ({ immediate = false } = {}) => {
    camera.setProjection('perspective');
    boomBeta = Number(config.beta) || RIFT_THIRD_PERSON_CAMERA_DEFAULTS.beta;
    currentDistance = fixedDistance;
    // Radius is now the encoded camera->aim distance, not a user zoom value.
    // Keep broad limits so RiftCamera can faithfully represent the manual pose.
    camera.minRadius = 0.1;
    camera.maxRadius = 64;
    resolvePose({ immediate: true, dt: 0 });
  };

  const orbit = (deltaAlpha = 0, deltaBeta = 0) => {
    // One-finger look: horizontal drag turns RiftPlayer; vertical drag changes
    // only the boom elevation. Camera distance is intentionally fixed.
    const nextFacing = normalizeAngle(getPlayerFacing() + Number(deltaAlpha || 0));
    setPlayerFacing?.(nextFacing);
    boomBeta = clamp(boomBeta + Number(deltaBeta || 0), 0.72, 1.34);
  };

  // Third-person zoom is intentionally disabled. Camera collision may retract
  // the boom temporarily, but touch/pinch/wheel input can never change distance.
  const zoom = () => {};

  const update = dt => {
    if (isOverview()) return;
    camera.setProjection('perspective');
    resolvePose({ dt });
  };

  reset({ immediate: true });
  return {
    update,
    reset,
    orbit,
    zoom,
    get preferredDistance() { return fixedDistance; },
    get boomBeta() { return boomBeta; }
  };
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

  const makeCamera = () => ({
    projection:'perspective', position:[0,0,0], target:[0,0,0], alpha:0, beta:1.02, radius:8.5,
    minRadius:0, maxRadius:64,
    setProjection(mode){ this.projection=mode; },
    setTarget(x,y,z){ this.target=[x,y,z]; this.updatePosition(); },
    updatePosition(){
      const sinBeta=Math.sin(this.beta);
      this.position[0]=this.target[0]+this.radius*sinBeta*Math.cos(this.alpha);
      this.position[1]=this.target[1]+this.radius*Math.cos(this.beta);
      this.position[2]=this.target[2]+this.radius*sinBeta*Math.sin(this.alpha);
    }
  });

  let turnFacing = 0;
  const turnCamera = makeCamera();
  const turnController = createRiftThirdPersonCamera({
    camera: turnCamera,
    getPlayerPosition: () => [0,0,0],
    getPlayerFacing: () => turnFacing,
    setPlayerFacing: value => { turnFacing = value; },
    getGrid: () => ({ getBlockWorld: () => 0 })
  });
  if (turnCamera.target[2] < RIFT_THIRD_PERSON_CAMERA_DEFAULTS.lookAhead - 0.01) failures.push('third-person reticle target is not projected far enough in front of the player');
  if (!(turnCamera.position[2] < 0)) failures.push('third-person camera position is not physically behind the player');
  const beforeZoomPosition = [...turnCamera.position];
  turnController.zoom(999);
  turnController.update(0);
  if (Math.abs(turnController.preferredDistance - RIFT_THIRD_PERSON_CAMERA_DEFAULTS.distance) > 1e-8) failures.push('third-person fixed camera distance changed through zoom input');
  if (Math.hypot(turnCamera.position[0]-beforeZoomPosition[0],turnCamera.position[1]-beforeZoomPosition[1],turnCamera.position[2]-beforeZoomPosition[2]) > 1e-8) failures.push('third-person zoom input moved the camera');

  turnController.orbit(-0.25, 0);
  turnController.update(0);
  if (Math.abs(turnFacing + 0.25) > 1e-8) failures.push('third-person horizontal look does not rotate player facing');
  const expectedAhead = [Math.sin(turnFacing) * RIFT_THIRD_PERSON_CAMERA_DEFAULTS.lookAhead, Math.cos(turnFacing) * RIFT_THIRD_PERSON_CAMERA_DEFAULTS.lookAhead];
  if (Math.hypot(turnCamera.target[0]-expectedAhead[0],turnCamera.target[2]-expectedAhead[1]) > 1e-6) failures.push('third-person center aim target does not stay far ahead of player facing');

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
