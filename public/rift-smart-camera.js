import { resolveRiftBuildingVisibility } from './rift-building-visibility.js';

const TAU = Math.PI * 2;
const QUARTER_TURN = Math.PI / 2;
const EPSILON = 1e-6;

export const RIFT_SMART_CAMERA_DEFAULTS = Object.freeze({
  lookAhead: 1.35,
  panDistance: 2.4,
  secondaryPanDistance: 1.25,
  occlusionGrace: 0.28,
  rotationCooldown: 1.35,
  improvementThreshold: 0.55,
  followResponsiveness: 5.5,
  panResponsiveness: 7.5,
  rotationResponsiveness: 4.4
});

export function normalizeRiftCameraAngle(angle) {
  let value = Number(angle) || 0;
  value %= TAU;
  if (value <= -Math.PI) value += TAU;
  if (value > Math.PI) value -= TAU;
  return value;
}

export function shortestRiftCameraAngleDelta(from, to) {
  return normalizeRiftCameraAngle((Number(to) || 0) - (Number(from) || 0));
}

export function createRiftSmartCameraAngles(baseAlpha = -Math.PI / 4) {
  const base = normalizeRiftCameraAngle(baseAlpha);
  return Object.freeze([0, 1, 2, 3].map(index => normalizeRiftCameraAngle(base + index * QUARTER_TURN)));
}

export function riftSmartCameraPositionFor(target, alpha, beta, radius) {
  const sinBeta = Math.sin(Number(beta) || 0);
  const safeRadius = Math.max(0, Number(radius) || 0);
  return [
    (Number(target?.[0]) || 0) + safeRadius * sinBeta * Math.cos(alpha),
    (Number(target?.[1]) || 0) + safeRadius * Math.cos(beta),
    (Number(target?.[2]) || 0) + safeRadius * sinBeta * Math.sin(alpha)
  ];
}

function flatForwardForAlpha(alpha) {
  const x = -Math.cos(alpha);
  const z = -Math.sin(alpha);
  const length = Math.hypot(x, z) || 1;
  return [x / length, 0, z / length];
}

function screenRightForAlpha(alpha) {
  const forward = flatForwardForAlpha(alpha);
  return [-forward[2], 0, forward[0]];
}

function followTarget(playerPosition, playerFacing, lookAhead) {
  const facing = Number(playerFacing) || 0;
  return [
    (Number(playerPosition?.[0]) || 0) + Math.sin(facing) * lookAhead,
    (Number(playerPosition?.[1]) || 0) + 0.82,
    (Number(playerPosition?.[2]) || 0) + Math.cos(facing) * lookAhead
  ];
}

function addPan(target, pan) {
  return [target[0] + pan[0], target[1], target[2] + pan[1]];
}

function panCandidatesForAlpha(alpha, panDistance, secondaryPanDistance) {
  const right = screenRightForAlpha(alpha);
  const forward = flatForwardForAlpha(alpha);
  return [
    [0, 0],
    [right[0] * panDistance, right[2] * panDistance],
    [-right[0] * panDistance, -right[2] * panDistance],
    [forward[0] * secondaryPanDistance, forward[2] * secondaryPanDistance],
    [-forward[0] * secondaryPanDistance, -forward[2] * secondaryPanDistance]
  ];
}

export function scoreRiftSmartCameraView({
  structures = [],
  playerPosition = [0, 0, 0],
  target = [0, 0, 0],
  alpha = 0,
  beta = 0.66,
  radius = 38
} = {}) {
  const cameraPosition = riftSmartCameraPositionFor(target, alpha, beta, radius);
  const visibility = resolveRiftBuildingVisibility({
    structures,
    playerPosition,
    cameraPosition,
    overview: false
  });
  const fallbackScore = visibility.blockingStructures.length
    + Object.values(visibility.blockingWallSides || {}).reduce((sum, sides) => sum + Math.max(0, (sides?.length || 0) - 1) * 0.1, 0);
  const score = Number.isFinite(Number(visibility.blockingScore))
    ? Number(visibility.blockingScore)
    : fallbackScore;
  return {
    score,
    inside: visibility.insideStructures.length > 0,
    cameraPosition,
    visibility
  };
}

function compareCandidate(a, b, currentAlpha) {
  if (!b) return -1;
  if (Math.abs(a.score - b.score) > 1e-5) return a.score < b.score ? -1 : 1;
  const aTurn = Math.abs(shortestRiftCameraAngleDelta(currentAlpha, a.alpha));
  const bTurn = Math.abs(shortestRiftCameraAngleDelta(currentAlpha, b.alpha));
  if (Math.abs(aTurn - bTurn) > 1e-5) return aTurn < bTurn ? -1 : 1;
  const aPan = Math.hypot(a.pan[0], a.pan[1]);
  const bPan = Math.hypot(b.pan[0], b.pan[1]);
  if (Math.abs(aPan - bPan) > 1e-5) return aPan < bPan ? -1 : 1;
  return 0;
}

export function chooseRiftSmartCameraView({
  structures = [],
  playerPosition = [0, 0, 0],
  baseTarget = [0, 0, 0],
  currentAlpha = 0,
  angles = [currentAlpha],
  beta = 0.66,
  radius = 38,
  panDistance = RIFT_SMART_CAMERA_DEFAULTS.panDistance,
  secondaryPanDistance = RIFT_SMART_CAMERA_DEFAULTS.secondaryPanDistance
} = {}) {
  let best = null;
  for (const alpha of angles || []) {
    for (const pan of panCandidatesForAlpha(alpha, panDistance, secondaryPanDistance)) {
      const target = addPan(baseTarget, pan);
      const evaluated = scoreRiftSmartCameraView({ structures, playerPosition, target, alpha, beta, radius });
      const candidate = { alpha, pan, target, ...evaluated };
      if (compareCandidate(candidate, best, currentAlpha) < 0) best = candidate;
    }
  }
  return best;
}

function smoothFactor(dt, responsiveness) {
  return 1 - Math.exp(-Math.max(0, Number(dt) || 0) * Math.max(0, responsiveness));
}

export function createRiftSmartCamera({
  camera,
  getStructures = () => [],
  getPlayerPosition = () => [0, 0, 0],
  getPlayerFacing = () => 0,
  isOverview = () => false,
  isLocked = () => false,
  baseAlpha = camera?.alpha ?? -Math.PI / 4,
  beta = camera?.beta ?? 0.66,
  options = {}
} = {}) {
  if (!camera) throw new Error('createRiftSmartCamera requires a RiftCamera.');

  const config = { ...RIFT_SMART_CAMERA_DEFAULTS, ...options };
  const angles = createRiftSmartCameraAngles(baseAlpha);
  let desiredAlpha = angles.reduce((best, angle) => (
    Math.abs(shortestRiftCameraAngleDelta(camera.alpha, angle)) < Math.abs(shortestRiftCameraAngleDelta(camera.alpha, best)) ? angle : best
  ), angles[0]);
  let pan = [0, 0];
  let desiredPan = [0, 0];
  let occludedFor = 0;
  let rotateCooldown = 0;
  let lastState = {
    mode: 'follow',
    score: 0,
    blockingStructures: [],
    insideStructures: [],
    pan: [0, 0],
    alpha: camera.alpha,
    desiredAlpha
  };

  const snapTargetToPlayer = () => {
    const playerPosition = getPlayerPosition();
    const baseTarget = followTarget(playerPosition, getPlayerFacing(), config.lookAhead);
    const target = addPan(baseTarget, pan);
    camera.target[0] = target[0];
    camera.target[1] = target[1];
    camera.target[2] = target[2];
    camera.updatePosition();
  };

  const reset = ({ immediate = false } = {}) => {
    desiredAlpha = angles[0];
    pan = [0, 0];
    desiredPan = [0, 0];
    occludedFor = 0;
    rotateCooldown = 0;
    if (immediate) {
      camera.alpha = desiredAlpha;
      camera.beta = beta;
      snapTargetToPlayer();
    }
  };

  const update = dt => {
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    if (isOverview()) {
      occludedFor = 0;
      rotateCooldown = Math.max(0, rotateCooldown - safeDt);
      lastState = { ...lastState, mode: 'overview', pan: [...pan], alpha: camera.alpha, desiredAlpha };
      return lastState;
    }

    const structures = getStructures() || [];
    const playerPosition = getPlayerPosition();
    const baseTarget = followTarget(playerPosition, getPlayerFacing(), config.lookAhead);
    rotateCooldown = Math.max(0, rotateCooldown - safeDt);

    const currentTarget = addPan(baseTarget, pan);
    const currentView = scoreRiftSmartCameraView({
      structures,
      playerPosition,
      target: currentTarget,
      alpha: camera.alpha,
      beta,
      radius: camera.radius
    });

    const inside = currentView.inside;
    const locked = !!isLocked();
    let bestAtCurrentAngle = null;

    if (inside || locked) {
      // Indoors the legacy smart camera remains stable. H1.74 never hides geometry;
      // Build Mode is also camera-stable so a selection gesture cannot rotate the world.
      desiredAlpha = camera.alpha;
      desiredPan = [0, 0];
      occludedFor = 0;
    } else {
      bestAtCurrentAngle = chooseRiftSmartCameraView({
        structures,
        playerPosition,
        baseTarget,
        currentAlpha: camera.alpha,
        angles: [camera.alpha],
        beta,
        radius: camera.radius,
        panDistance: config.panDistance,
        secondaryPanDistance: config.secondaryPanDistance
      });

      const baseView = scoreRiftSmartCameraView({
        structures,
        playerPosition,
        target: baseTarget,
        alpha: camera.alpha,
        beta,
        radius: camera.radius
      });

      // First try a small screen-space follow offset. This keeps the current camera
      // direction whenever a simple framing change can recover line of sight.
      if (bestAtCurrentAngle && bestAtCurrentAngle.score + 0.08 < baseView.score) {
        desiredPan = [...bestAtCurrentAngle.pan];
      } else if (baseView.score <= EPSILON) {
        desiredPan = [0, 0];
      }

      const currentBestScore = bestAtCurrentAngle?.score ?? currentView.score;
      if (currentBestScore <= EPSILON) {
        occludedFor = 0;
      } else {
        occludedFor += safeDt;
      }

      if (occludedFor >= config.occlusionGrace && rotateCooldown <= 0) {
        const best = chooseRiftSmartCameraView({
          structures,
          playerPosition,
          baseTarget,
          currentAlpha: camera.alpha,
          angles,
          beta,
          radius: camera.radius,
          panDistance: config.panDistance,
          secondaryPanDistance: config.secondaryPanDistance
        });
        if (best && best.score + config.improvementThreshold < currentBestScore
          && Math.abs(shortestRiftCameraAngleDelta(camera.alpha, best.alpha)) > 0.08) {
          desiredAlpha = best.alpha;
          desiredPan = [...best.pan];
          rotateCooldown = config.rotationCooldown;
          occludedFor = 0;
        }
      }
    }

    const rotationFollow = smoothFactor(safeDt, config.rotationResponsiveness);
    const delta = shortestRiftCameraAngleDelta(camera.alpha, desiredAlpha);
    camera.alpha = normalizeRiftCameraAngle(camera.alpha + delta * rotationFollow);
    if (Math.abs(delta) < 0.002) camera.alpha = normalizeRiftCameraAngle(desiredAlpha);
    camera.beta = beta;

    const panFollow = smoothFactor(safeDt, config.panResponsiveness);
    pan[0] += (desiredPan[0] - pan[0]) * panFollow;
    pan[1] += (desiredPan[1] - pan[1]) * panFollow;
    if (Math.hypot(desiredPan[0] - pan[0], desiredPan[1] - pan[1]) < 0.002) pan = [...desiredPan];

    const desiredTarget = addPan(baseTarget, pan);
    const targetFollow = smoothFactor(safeDt, config.followResponsiveness);
    camera.target[0] += (desiredTarget[0] - camera.target[0]) * targetFollow;
    camera.target[1] += (desiredTarget[1] - camera.target[1]) * targetFollow;
    camera.target[2] += (desiredTarget[2] - camera.target[2]) * targetFollow;
    camera.updatePosition();

    const postView = scoreRiftSmartCameraView({
      structures,
      playerPosition,
      target: camera.target,
      alpha: camera.alpha,
      beta,
      radius: camera.radius
    });
    lastState = {
      mode: inside ? 'interior-lock' : locked ? 'locked' : postView.score > EPSILON ? 'occluded' : Math.hypot(pan[0], pan[1]) > 0.05 ? 'pan' : 'follow',
      score: postView.score,
      blockingStructures: [...postView.visibility.blockingStructures],
      insideStructures: [...postView.visibility.insideStructures],
      pan: [...pan],
      alpha: camera.alpha,
      desiredAlpha,
      rotating: Math.abs(shortestRiftCameraAngleDelta(camera.alpha, desiredAlpha)) > 0.015,
      cooldown: rotateCooldown,
      occludedFor
    };
    return lastState;
  };

  return {
    update,
    reset,
    get angles() { return [...angles]; },
    get state() { return { ...lastState, pan: [...lastState.pan] }; }
  };
}
