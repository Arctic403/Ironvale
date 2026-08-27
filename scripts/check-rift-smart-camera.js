import { RiftCamera } from '../public/rift-engine.js';
import { buildRiftVisibilityStructures } from '../public/rift-building-visibility.js';
import {
  createRiftSmartCamera,
  createRiftSmartCameraAngles,
  chooseRiftSmartCameraView,
  shortestRiftCameraAngleDelta
} from '../public/rift-smart-camera.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const baseAlpha = -0.72;
const beta = 0.66;
const radius = 38;
const playerPosition = [0, 2, 0];
const playerFacing = 0;
const baseTarget = [0, 2.82, 1.35];
const angles = createRiftSmartCameraAngles(baseAlpha);

assert(angles.length === 4, 'smart camera must expose four stable view directions');
for (let i = 1; i < angles.length; i += 1) {
  const delta = Math.abs(shortestRiftCameraAngleDelta(angles[i - 1], angles[i]));
  assert(Math.abs(delta - Math.PI / 2) < 1e-6, 'smart camera directions must be quarter-turn spaced');
}

// A narrow obstruction can be solved by reframing the player without rotating.
const panStructures = buildRiftVisibilityStructures([
  { op: 'hollow_box', name: 'pan-blocker', min: [3, 1, -6], max: [5, 8, -4], wall_thickness: 1, floor: true }
]);
const panBest = chooseRiftSmartCameraView({
  structures: panStructures,
  playerPosition,
  baseTarget,
  currentAlpha: baseAlpha,
  angles: [baseAlpha],
  beta,
  radius
});
assert(panBest?.score === 0, 'same-angle pan should recover a clear view for the narrow blocker fixture');
assert(Math.hypot(...panBest.pan) > 0.5, 'pan-first fixture must actually use a follow offset');

// A broad obstruction cannot be solved by panning; one of the other isometric directions is clear.
const rotateStructures = buildRiftVisibilityStructures([
  { op: 'hollow_box', name: 'rotation-blocker', min: [4, 1, -9], max: [10, 10, -3], wall_thickness: 1, floor: true }
]);
const sameAngle = chooseRiftSmartCameraView({
  structures: rotateStructures,
  playerPosition,
  baseTarget,
  currentAlpha: baseAlpha,
  angles: [baseAlpha],
  beta,
  radius
});
const allAngles = chooseRiftSmartCameraView({
  structures: rotateStructures,
  playerPosition,
  baseTarget,
  currentAlpha: baseAlpha,
  angles,
  beta,
  radius
});
assert((sameAngle?.score ?? 0) > 0, 'rotation fixture must remain blocked after pan attempts');
assert(allAngles?.score === 0, 'another stable view direction must clear the rotation fixture');
assert(Math.abs(shortestRiftCameraAngleDelta(baseAlpha, allAngles.alpha)) > 1, 'rotation fixture must choose another camera quadrant');

const camera = new RiftCamera({
  projection: 'orthographic',
  alpha: baseAlpha,
  beta,
  radius,
  orthoSize: 24
});
camera.setTarget(...baseTarget);
let structures = rotateStructures;
let position = [...playerPosition];
let facing = playerFacing;
let overview = false;
let locked = false;
const smart = createRiftSmartCamera({
  camera,
  getStructures: () => structures,
  getPlayerPosition: () => position,
  getPlayerFacing: () => facing,
  isOverview: () => overview,
  isLocked: () => locked,
  baseAlpha,
  beta
});

for (let i = 0; i < 50; i += 1) smart.update(0.05);
assert(Math.abs(shortestRiftCameraAngleDelta(baseAlpha, smart.state.desiredAlpha)) > 1,
  'persistent outdoor occlusion must select a new stable camera direction');
assert(smart.state.score < sameAngle.score, 'automatic rotation must improve the camera-to-player occlusion score');

// Hysteresis: once a direction is selected, a clear world does not immediately snap back.
const rotatedDirection = smart.state.desiredAlpha;
structures = [];
for (let i = 0; i < 30; i += 1) smart.update(0.05);
assert(Math.abs(shortestRiftCameraAngleDelta(rotatedDirection, smart.state.desiredAlpha)) < 1e-6,
  'clear outdoor travel must retain the current stable direction instead of oscillating back');

// Interior containment owns visibility and prevents smart-camera rotation.
structures = buildRiftVisibilityStructures([
  { op: 'hollow_box', name: 'interior-shell', min: [-4, 1, -4], max: [4, 8, 4], wall_thickness: 1, floor: true }
]);
position = [0, 2, 0];
const beforeInterior = camera.alpha;
for (let i = 0; i < 20; i += 1) smart.update(0.05);
assert(smart.state.mode === 'interior-lock', 'player containment must switch legacy smart-camera decisions to interior-lock mode');
assert(Math.abs(shortestRiftCameraAngleDelta(beforeInterior, camera.alpha)) < 0.02,
  'smart camera must not orbit around the player while they are inside a building');

// Build Mode deliberately locks the camera so direct cell/object edits remain spatially stable.
structures = rotateStructures;
position = [...playerPosition];
locked = true;
const beforeLock = camera.alpha;
for (let i = 0; i < 20; i += 1) smart.update(0.05);
assert(smart.state.mode === 'locked', 'Build Mode lock must be reported by the smart camera');
assert(Math.abs(shortestRiftCameraAngleDelta(beforeLock, camera.alpha)) < 0.02,
  'Build Mode must not auto-rotate the world under the editor pointer');

// City Overview remains authoritative and bypasses follow decisions.
locked = false;
overview = true;
const beforeOverview = camera.alpha;
for (let i = 0; i < 10; i += 1) smart.update(0.05);
assert(smart.state.mode === 'overview', 'City Overview must bypass smart follow decisions');
assert(Math.abs(shortestRiftCameraAngleDelta(beforeOverview, camera.alpha)) < 1e-6,
  'City Overview must retain the explicit overview camera orientation');

console.log('[smart-camera-check] legacy pan/rotation scoring remains diagnostic-only with no geometry cutaway: PASS');
