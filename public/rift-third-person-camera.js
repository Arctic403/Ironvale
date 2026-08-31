const TAU = Math.PI * 2;

export const RIFT_THIRD_PERSON_CAMERA_DEFAULTS = Object.freeze({
  // Minecraft-style third person: camera distance is a fixed boom length.
  // Collision can temporarily shorten the boom, but user input never zooms it.
  distance: 8.5,
  minDistance: 2.2,
  // The orbit pivot stays around the player's upper torso. The camera itself
  // gets a separate framing lift below so the center ray does NOT pass through
  // the avatar. This is the key difference between a useful chase camera and a
  // camera whose reticle is glued to the character's head.
  pivotHeight: 1.35,
  framingLift: 1.15,
  // Keep the render target far forward so screen-center represents a stable
  // world aim direction rather than an orbit target sitting on the player.
  lookDistance: 64,
  pitch: -0.08,
  // Conservative Minecraft-like vertical limits: enough to look up/down while
  // never reaching the near-vertical states that made touch movement feel like
  // the camera was flying on a rotated axis.
  minPitch: -Math.PI * 0.34,
  maxPitch: Math.PI * 0.30,
  distanceResponsiveness: 18,
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

// RiftPlayer facing 0 points +Z. RiftCamera alpha is the azimuth of the
// CAMERA POSITION relative to its target, so the correct position behind a
// facing direction is -PI/2 - facing (not facing - PI/2).
export function riftThirdPersonAlphaBehindFacing(facing = 0) {
  return normalizeAngle(-Math.PI / 2 - (Number(facing) || 0));
}

export function riftThirdPersonLookDirection(yaw = 0, pitch = 0) {
  const p = Number(pitch) || 0;
  const y = Number(yaw) || 0;
  const cp = Math.cos(p);
  return [Math.sin(y) * cp, Math.sin(p), Math.cos(y) * cp];
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
  cameraLift = 0,
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
    // Probe both the physical boom and the camera's lifted render path. The
    // latter matters under ceilings: the old probe could pass safely below a
    // roof, then framingLift moved the actual camera up inside that roof.
    const blockedBoom = occupiedAt(grid, x, y, z);
    const blockedCamera = occupiedAt(grid, x, y + (Number(cameraLift) || 0), z);
    if (!blockedBoom && !blockedCamera) continue;
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
  const fixedDistance = Math.max(config.minDistance, Number(config.distance) || RIFT_THIRD_PERSON_CAMERA_DEFAULTS.distance);
  let yaw = normalizeAngle(getPlayerFacing());
  let pitch = clamp(
    Number(config.pitch) || 0,
    Number(config.minPitch),
    Number(config.maxPitch)
  );
  let currentDistance = fixedDistance;

  const playerPivot = () => {
    const p = getPlayerPosition?.() || [0, 0, 0];
    return [
      Number(p[0]) || 0,
      (Number(p[1]) || 0) + (Number(config.pivotHeight) || 0),
      Number(p[2]) || 0
    ];
  };

  const boomAnchor = () => playerPivot();

  // RiftCamera is an orbit camera internally. Encode an explicit camera pose by
  // making its target lie far along the same forward vector. Because position,
  // target, yaw and pitch all share ONE vector, updatePosition() reproduces the
  // exact pose without the skewed-axis behaviour caused by mixing a player boom
  // with a separate sideways/forward target.
  const setCameraPose = (position, direction) => {
    const lookDistance = Math.max(2, Number(config.lookDistance) || RIFT_THIRD_PERSON_CAMERA_DEFAULTS.lookDistance);
    const target = [
      position[0] + direction[0] * lookDistance,
      position[1] + direction[1] * lookDistance,
      position[2] + direction[2] * lookDistance
    ];
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
    // Third-person free-look owns its own yaw. Player facing may change while
    // walking, but that must never recenter/drag the camera behind the body.
    // Only reset() intentionally re-syncs the view to the player's facing.
    const direction = riftThirdPersonLookDirection(yaw, pitch);
    const anchor = boomAnchor();

    // Position the camera directly backward along the SAME view vector.
    // Convert the backward vector to RiftCamera's orbit alpha/beta only for the
    // collision probe; the final render pose remains direction based.
    const boomAlpha = riftThirdPersonAlphaBehindFacing(yaw);
    const boomBeta = Math.PI / 2 + pitch;
    const safeDistance = resolveRiftThirdPersonCameraDistance({
      grid: getGrid(),
      target: anchor,
      alpha: boomAlpha,
      beta: boomBeta,
      desiredDistance: fixedDistance,
      cameraLift: config.framingLift,
      minDistance: config.minDistance,
      collisionStep: config.collisionStep,
      collisionSkin: config.collisionSkin
    });

    if (immediate) currentDistance = safeDistance;
    else {
      const responsiveness = safeDistance < currentDistance
        ? Number(config.distanceResponsiveness) * 2.4
        : Number(config.distanceResponsiveness);
      currentDistance += (safeDistance - currentDistance) * smoothFactor(dt, responsiveness);
    }

    // Keep the physical boom behind the player, but lift the CAMERA above that
    // boom line. The aim direction stays untouched. At the player's depth the
    // center ray therefore passes above the avatar and keeps travelling into
    // the world instead of intersecting the player's head/body.
    const position = [
      anchor[0] - direction[0] * currentDistance,
      anchor[1] - direction[1] * currentDistance + (Number(config.framingLift) || 0),
      anchor[2] - direction[2] * currentDistance
    ];
    setCameraPose(position, direction);
  };

  const reset = ({ immediate = false } = {}) => {
    camera.setProjection?.('perspective');
    yaw = normalizeAngle(getPlayerFacing());
    pitch = clamp(
      Number(config.pitch) || 0,
      Number(config.minPitch),
      Number(config.maxPitch)
    );
    currentDistance = fixedDistance;
    // radius is used to encode look direction, not zoom. Keep the camera's own
    // limits out of the way and expose no zoom input from this controller.
    camera.minRadius = 0.1;
    camera.maxRadius = 64;
    resolvePose({ immediate: true, dt: 0 });
  };

  const orbit = (deltaAlpha = 0, deltaBeta = 0) => {
    // Shared controls send right drag as negative alpha and down drag as
    // positive beta. Third-person look is CAMERA-ONLY: swiping changes this
    // local yaw while RiftPlayer is free to face the direction of movement.
    yaw = normalizeAngle(yaw + Number(deltaAlpha || 0));
    pitch = clamp(
      pitch - Number(deltaBeta || 0),
      Number(config.minPitch),
      Number(config.maxPitch)
    );
  };

  // Intentionally no gameplay zoom. Collision is the only thing that can
  // temporarily shorten the fixed boom.
  const zoom = () => {};

  const update = dt => {
    if (isOverview()) return;
    camera.setProjection?.('perspective');
    resolvePose({ dt });
  };

  reset({ immediate: true });
  return {
    update,
    reset,
    orbit,
    zoom,
    get preferredDistance() { return fixedDistance; },
    get currentDistance() { return currentDistance; },
    get yaw() { return yaw; },
    get pitch() { return pitch; }
  };
}

export function validateRiftThirdPersonCamera() {
  const failures = [];
  const almost = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
  const fakeGrid = {
    getBlockWorld(x, y, z) {
      return (x === 0 && y >= 1 && y <= 4 && z === -4) ? 1 : 0;
    }
  };

  // Cardinal facing must always put the boom physically BEHIND the player.
  const expectedAlpha = [
    [0, -Math.PI / 2],
    [Math.PI / 2, Math.PI],
    [Math.PI, Math.PI / 2],
    [-Math.PI / 2, 0]
  ];
  for (const [facing, expected] of expectedAlpha) {
    const actual = riftThirdPersonAlphaBehindFacing(facing);
    const delta = normalizeAngle(actual - expected);
    if (Math.abs(delta) > 1e-8) failures.push(`third-person boom alpha is wrong for facing ${facing}`);
  }

  const makeCamera = () => ({
    projection:'perspective', position:[0,0,0], target:[0,0,0], alpha:0, beta:1.02, radius:8.5,
    minRadius:0, maxRadius:64,
    setProjection(mode){ this.projection=mode; this.updatePosition(); },
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
    getGrid: () => ({ getBlockWorld: () => 0 }),
    options: { pitch: 0 }
  });

  const pivotY = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.pivotHeight;
  const expectedCameraY = pivotY + RIFT_THIRD_PERSON_CAMERA_DEFAULTS.framingLift;
  if (!almost(turnCamera.position[0], 0) || !almost(turnCamera.position[2], -RIFT_THIRD_PERSON_CAMERA_DEFAULTS.distance)) {
    failures.push('north-facing third-person camera is not directly behind the player');
  }
  if (!almost(turnCamera.position[1], expectedCameraY)) failures.push('third-person camera framing lift is incorrect');
  const forward = [
    turnCamera.target[0]-turnCamera.position[0],
    turnCamera.target[1]-turnCamera.position[1],
    turnCamera.target[2]-turnCamera.position[2]
  ];
  const forwardLength = Math.hypot(...forward) || 1;
  if (Math.abs(forward[0]/forwardLength) > 1e-6 || Math.abs(forward[1]/forwardLength) > 1e-6 || forward[2]/forwardLength < 0.999999) {
    failures.push('third-person camera target is not collinear with the player look direction');
  }
  if (!(turnCamera.target[2] > RIFT_THIRD_PERSON_CAMERA_DEFAULTS.distance)) {
    failures.push('third-person center ray does not continue well beyond the player into the world');
  }

  // At the player's Z plane, the center ray must stay above the orbit pivot.
  // Otherwise the screen-center reticle visually lands on the avatar again.
  const rayTravelToPlayerPlane = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.distance;
  const centerRayYAtPlayer = turnCamera.position[1] + (forward[1] / forwardLength) * rayTravelToPlayerPlane;
  if (!(centerRayYAtPlayer > pivotY + 0.9)) {
    failures.push('third-person center ray still intersects the avatar framing zone');
  }

  const beforeZoomPosition = [...turnCamera.position];
  turnController.zoom(999);
  turnController.update(0);
  if (!almost(turnController.preferredDistance, RIFT_THIRD_PERSON_CAMERA_DEFAULTS.distance)) failures.push('third-person fixed distance changed through zoom input');
  if (Math.hypot(
    turnCamera.position[0]-beforeZoomPosition[0],
    turnCamera.position[1]-beforeZoomPosition[1],
    turnCamera.position[2]-beforeZoomPosition[2]
  ) > 1e-8) failures.push('third-person zoom input moved the camera');

  turnController.orbit(-Math.PI / 2, 0);
  turnController.update(0);
  if (Math.abs(turnFacing) > 1e-8) failures.push('third-person horizontal drag incorrectly rotates player facing');
  if (Math.abs(normalizeAngle(turnController.yaw + Math.PI / 2)) > 1e-8) failures.push('third-person horizontal drag did not change independent camera yaw');
  if (!(turnCamera.position[0] > 0) || Math.abs(turnCamera.position[2]) > 1e-5) {
    failures.push('third-person camera did not orbit independently after a 90-degree look turn');
  }

  // Movement is allowed to rotate the BODY independently. Simulate that by
  // changing the player facing behind the camera controller's back; update()
  // must preserve the exact free-look yaw/pose instead of auto-recentering.
  const freeLookPosition = [...turnCamera.position];
  turnFacing = Math.PI / 2;
  turnController.update(0);
  if (Math.abs(normalizeAngle(turnController.yaw + Math.PI / 2)) > 1e-8) failures.push('player movement facing overwrote third-person free-look yaw');
  if (Math.hypot(
    turnCamera.position[0]-freeLookPosition[0],
    turnCamera.position[1]-freeLookPosition[1],
    turnCamera.position[2]-freeLookPosition[2]
  ) > 1e-8) failures.push('third-person camera auto-recentered when player facing changed');

  const pitchBefore = turnController.pitch;
  turnController.orbit(0, -0.2);
  turnController.update(0);
  if (!(turnController.pitch > pitchBefore)) failures.push('upward drag does not increase third-person look pitch');
  if (!(turnCamera.target[1] > turnCamera.position[1])) failures.push('positive third-person pitch does not look upward');
  turnController.orbit(0, -100);
  if (turnController.pitch > RIFT_THIRD_PERSON_CAMERA_DEFAULTS.maxPitch + 1e-8) failures.push('third-person pitch escaped upper clamp');
  turnController.orbit(0, 100);
  if (turnController.pitch < RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minPitch - 1e-8) failures.push('third-person pitch escaped lower clamp');

  const target = [0.5, 2, 0.5];
  const clear = resolveRiftThirdPersonCameraDistance({ grid: { getBlockWorld: () => 0 }, target, alpha:-Math.PI/2, beta:Math.PI/2, desiredDistance:8.5 });
  if (Math.abs(clear - 8.5) > 1e-6) failures.push('clear third-person view changed camera distance');
  const blocked = resolveRiftThirdPersonCameraDistance({ grid:fakeGrid, target:[0,2,0], alpha:-Math.PI/2, beta:Math.PI/2, desiredDistance:8.5 });
  if (!(blocked < 8.5 && blocked >= RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minDistance)) failures.push('camera collision did not retract before a blocking wall');

  // A low roof can intersect only the lifted render camera while leaving the
  // lower boom ray clear. Collision must still push the camera forward.
  const roofGrid = {
    getBlockWorld(x, y, z) {
      return (x === 0 && y === 3 && z <= -3 && z >= -5) ? 1 : 0;
    }
  };
  const roofBlocked = resolveRiftThirdPersonCameraDistance({
    grid: roofGrid,
    target: [0, 2, 0],
    alpha: -Math.PI/2,
    beta: Math.PI/2,
    desiredDistance: 8.5,
    cameraLift: RIFT_THIRD_PERSON_CAMERA_DEFAULTS.framingLift
  });
  if (!(roofBlocked < 8.5 && roofBlocked >= RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minDistance)) failures.push('camera collision did not retract under a low roof');

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
