import assert from 'node:assert/strict';
import {
  RIFT_BLOCK_SHAPES,
  RIFT_BLOCK_ROTATIONS,
  encodeRiftBlockState
} from '../public/rift-block-shapes.js';
import {
  RIFT_PLAYER_GROUND_SNAP_DOWN,
  RIFT_PLAYER_KILL_MARGIN,
  RIFT_PLAYER_PHYSICS_MAX_STEP,
  RIFT_PLAYER_RADIUS,
  RIFT_PLAYER_STEP_UP,
  classifyRiftPlayerGroundStep,
  constrainRiftPlayerToWorldFootprint,
  createRiftPlayerController,
  createRiftPlayerSurfaceSampler,
  getRiftPlayerWorldFootprint,
  riftPlayerCrossedSupport,
  riftPlayerKillPlane,
  riftPlayerShapeTopAt
} from '../public/rift-player.js';

const approx = (actual, expected, epsilon = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} ~= ${expected}`);
};

const full = encodeRiftBlockState({ material: 1, shape: RIFT_BLOCK_SHAPES.full });
const bottomSlab = encodeRiftBlockState({ material: 1, shape: RIFT_BLOCK_SHAPES.bottomSlab });
const eastStair = encodeRiftBlockState({
  material: 1,
  shape: RIFT_BLOCK_SHAPES.stair,
  rotation: RIFT_BLOCK_ROTATIONS.east
});
const northStair = encodeRiftBlockState({
  material: 1,
  shape: RIFT_BLOCK_SHAPES.stair,
  rotation: RIFT_BLOCK_ROTATIONS.north
});

approx(riftPlayerShapeTopAt(bottomSlab, 0.5, 0.5), 0.5);
approx(riftPlayerShapeTopAt(eastStair, 0.1, 0.5), 0.55);
approx(riftPlayerShapeTopAt(eastStair, 0.9, 0.5), 0.95);
approx(riftPlayerShapeTopAt(northStair, 0.5, 0.1), 0.95);
approx(riftPlayerShapeTopAt(northStair, 0.5, 0.9), 0.55);

const cells = new Map([
  ['0,0,0', full],
  ['1,0,0', eastStair]
]);
const getState = (x, y, z) => cells.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) || 0;
const sampler = createRiftPlayerSurfaceSampler({
  getState,
  getWorldBounds: () => ({ min: [0, 0, 0], max: [3, 3, 3] })
});

approx(sampler.supportAtPoint(0.5, 0.5, 1, { maxRise: RIFT_PLAYER_STEP_UP, maxDrop: 2 }), 1);
approx(sampler.supportAtPoint(1.1, 0.5, 1, { maxRise: RIFT_PLAYER_STEP_UP, maxDrop: 2 }), 0.55);
approx(sampler.supportAtPoint(1.9, 0.5, 1, { maxRise: RIFT_PLAYER_STEP_UP, maxDrop: 2 }), 0.95);
assert.equal(sampler.supportAtPoint(2.5, 0.5, 1, { maxRise: RIFT_PLAYER_STEP_UP, maxDrop: 2 }), null);

assert.equal(classifyRiftPlayerGroundStep(1, 1.5), 'grounded', 'A legal half-meter stair must be walkable at normal speed.');
assert.equal(classifyRiftPlayerGroundStep(1, 1 + RIFT_PLAYER_STEP_UP + 0.1), 'blocked', 'A rise above the step limit must block.');
assert.equal(classifyRiftPlayerGroundStep(1, null), 'drop', 'Missing center support must immediately become a fall.');
assert.equal(classifyRiftPlayerGroundStep(2, 2 - RIFT_PLAYER_GROUND_SNAP_DOWN - 0.1), 'drop', 'A real ledge drop must not magnetize the player.');

console.log('[player-physics-check] center support, smooth stair heights, normal-speed step-up and immediate ledge release: PASS');


// H1.68: the currently loaded RiftBlock document is a finite collision world.
// The player's full radius must remain inside that footprint until neighboring
// blocks are actually streamed/loaded; outside cells are AIR by definition.
const world64 = { min: [0, 0, 0], max: [63, 15, 63] };
const footprint = getRiftPlayerWorldFootprint(world64, RIFT_PLAYER_RADIUS);
assert.ok(footprint.minX > 0 && footprint.minZ > 0);
assert.ok(footprint.maxX < 64 && footprint.maxZ < 64);

for (const [x, z, edge] of [
  [-50, 32, 'west'],
  [500, 32, 'east'],
  [32, -50, 'north'],
  [32, 500, 'south']
]) {
  const constrained = constrainRiftPlayerToWorldFootprint(x, z, world64, RIFT_PLAYER_RADIUS);
  assert.equal(constrained.constrained, true, `${edge} loaded-world edge must constrain the player.`);
  assert.ok(constrained.x >= footprint.minX - 1e-9 && constrained.x <= footprint.maxX + 1e-9);
  assert.ok(constrained.z >= footprint.minZ - 1e-9 && constrained.z <= footprint.maxZ + 1e-9);
}

const flat64Sampler = createRiftPlayerSurfaceSampler({
  getWorldBounds: () => world64,
  getState: (x, y, z) => (
    y === 0 && x >= 0 && x < 64 && z >= 0 && z < 64 ? full : 0
  )
});
approx(flat64Sampler.supportAtPoint(footprint.minX, 32, 1, { maxRise: 0.1, maxDrop: 2 }), 1);
approx(flat64Sampler.supportAtPoint(footprint.maxX, 32, 1, { maxRise: 0.1, maxDrop: 2 }), 1);
assert.equal(flat64Sampler.supportAtPoint(-0.001, 32, 1, { maxRise: 0.1, maxDrop: 2 }), null);
assert.equal(flat64Sampler.supportAtPoint(64.001, 32, 1, { maxRise: 0.1, maxDrop: 2 }), null);

// Falling uses a swept previous->candidate crossing test, so a low frame-rate
// step cannot tunnel through a floor merely because candidateY passed below it.
assert.equal(riftPlayerCrossedSupport(1.35, 0.72, 1), true);
assert.equal(riftPlayerCrossedSupport(1.35, 1.12, 1), false);
assert.equal(riftPlayerCrossedSupport(0.7, 0.2, 1), false);

assert.equal(riftPlayerKillPlane(world64), -RIFT_PLAYER_KILL_MARGIN);
assert.ok(RIFT_PLAYER_PHYSICS_MAX_STEP <= 1 / 90, 'Physics must sub-step at least as finely as 90 Hz.');

// Exercise the real controller against a finite 64x64 loaded grid. This catches
// the original intermittent fall-through bug: ordinary movement could previously
// walk past x/z=0..63, after which getBlockWorld() correctly returned AIR forever.
const inputListeners = new Map();
const oldWindow = globalThis.window;
globalThis.window = {
  addEventListener(type, handler) { inputListeners.set(type, handler); },
  removeEventListener(type, handler) { if (inputListeners.get(type) === handler) inputListeners.delete(type); }
};
let fakePosition = [10, 1, 10];
let fakeFacing = 0;
const fakePlayer = {
  radius: RIFT_PLAYER_RADIUS,
  height: 1.8,
  get position() { return [...fakePosition]; },
  get facing() { return fakeFacing; },
  setPosition(x, y, z) { fakePosition = [x, y, z]; },
  setFacingRadians(value) { fakeFacing = value; },
  setMotion() {},
  update() {}
};
const finiteGrid = {
  getBlockWorld(x, y, z) {
    return y === 0 && x >= 0 && x <= 63 && z >= 0 && z <= 63 ? full : 0;
  }
};
const controller = createRiftPlayerController({
  canvas: null,
  camera: { flatForward: () => [0, 0, 1] },
  getGrid: () => finiteGrid,
  getWorldBounds: () => world64,
  player: fakePlayer,
  touchRoot: { querySelector: () => null }
});
controller.teleport([63.6, 2, 32]);
inputListeners.get('keydown')?.({ code: 'KeyD', preventDefault() {} });
for (let i = 0; i < 120; i += 1) controller.update(0.05);
inputListeners.get('keyup')?.({ code: 'KeyD' });
assert.ok(fakePosition[0] <= footprint.maxX + 1e-7, 'Normal movement must not leave the loaded east edge.');
assert.ok(fakePosition[0] >= footprint.minX - 1e-7);
approx(fakePosition[1], 1, 1e-5);
assert.equal(controller.grounded, true, 'Loaded-world edge containment must not turn into a fall.');

// Frame-time jitter and a tall fall must still cross/land on the ground instead
// of tunneling through it. This exercises the real semi-fixed substep loop.
controller.teleport([10, 2, 10]);
fakePlayer.setPosition(10, 12, 10);
controller.revalidateWorld({ allowFall: true });
const recoveryBeforeTallFall = controller.recoveryCount;
const jitter = [0.003, 0.017, 0.049, 0.091, 0.008, 0.033, 0.012, 0.057];
for (let i = 0; i < 500 && !controller.grounded; i += 1) controller.update(jitter[i % jitter.length]);
assert.equal(controller.grounded, true, 'Tall fall under frame-time jitter must land on the loaded ground.');
approx(fakePosition[1], 1, 1e-5);
assert.equal(controller.recoveryCount, recoveryBeforeTallFall, 'A valid tall fall should land, not hit the kill-plane recovery.');

controller.teleport([10, 2, 10]);
fakePlayer.setPosition(10, -20, 10);
controller.update(0.05);
approx(fakePosition[1], 1, 1e-5);
assert.ok(controller.recoveryCount >= 1, 'Crossing the kill plane must recover to a safe grounded position.');
assert.ok(controller.lastSafeGroundedPosition, 'Controller must remember a validated safe grounded position.');
controller.destroy();
if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;

console.log('[player-physics-check] world-edge containment, swept landing, fixed substeps and kill-plane recovery: PASS');

// H1.69: stacked-surface edge regression. A player can be geometrically below
// the top of the block they just left while that upper block is still within
// their horizontal body radius. The upper surface must not mask the lower floor.
const stackedSampler = createRiftPlayerSurfaceSampler({
  getWorldBounds: () => ({ min: [0, 0, 0], max: [2, 3, 2] }),
  getState: (x, y, z) => (Math.floor(x) === 0 && Math.floor(z) === 0 && (y === 0 || y === 1) ? full : 0)
});
assert.deepEqual(
  stackedSampler.supportCandidatesAtPoint(0.5, 0.5, 1.98, { maxRise: 0.05, maxDrop: 2 }),
  [2, 1],
  'Sampler must preserve every stacked support candidate instead of only the highest one.'
);
assert.deepEqual(
  stackedSampler.supportCrossings(0.5, 0.5, 1.98, 1.90),
  [],
  'A surface already above the player feet must not be treated as a new landing.'
);
assert.deepEqual(
  stackedSampler.supportCrossings(0.5, 0.5, 1.02, 0.98),
  [1],
  'The lower surface must become the landing candidate as soon as the falling feet cross it.'
);

const edgeListeners = new Map();
globalThis.window = {
  addEventListener(type, handler) { edgeListeners.set(type, handler); },
  removeEventListener(type, handler) { if (edgeListeners.get(type) === handler) edgeListeners.delete(type); }
};
let edgePosition = [0.72, 2, 1.5];
let edgeFacing = 0;
let lowerShape = 'full';
let upperCell = [0, 1];
const edgePlayer = {
  radius: RIFT_PLAYER_RADIUS,
  height: 1.8,
  get position() { return [...edgePosition]; },
  get facing() { return edgeFacing; },
  setPosition(x, y, z) { edgePosition = [x, y, z]; },
  setFacingRadians(value) { edgeFacing = value; },
  setMotion() {},
  update() {}
};
const edgeBounds = { min: [0, 0, 0], max: [3, 4, 3] };
const edgeGrid = {
  getBlockWorld(x, y, z) {
    if (y === 1 && x === upperCell[0] && z === upperCell[1]) return full;
    if (y !== 0 || x < 0 || x > 3 || z < 0 || z > 3) return 0;
    if (x === upperCell[0] && z === upperCell[1]) return full;
    if (lowerShape === 'slab') return bottomSlab;
    if (lowerShape === 'stair') return eastStair;
    return full;
  }
};
const edgeController = createRiftPlayerController({
  canvas: null,
  camera: { flatForward: () => [0, 0, -1] }, // D is +X and S is +Z.
  getGrid: () => edgeGrid,
  getWorldBounds: () => edgeBounds,
  player: edgePlayer,
  touchRoot: { querySelector: () => null }
});

function key(type, code) { edgeListeners.get(type)?.({ code, preventDefault() {} }); }
function settle(maxFrames = 500) {
  for (let i = 0; i < maxFrames && !edgeController.grounded; i += 1) edgeController.update(1 / 120);
}
function slowWalkOff({ steps = 15, expectedY = 1, mode = 'full' } = {}) {
  lowerShape = mode;
  upperCell = [0, 1];
  edgeController.teleport([0.72, 2.2, 1.5]);
  const recoveries = edgeController.recoveryCount;
  key('keydown', 'KeyD');
  for (let i = 0; i < steps; i += 1) edgeController.update(1 / 120);
  key('keyup', 'KeyD');
  assert.equal(edgeController.grounded, false, `Slow ${mode} edge walk must actually leave the upper support.`);
  settle();
  assert.equal(edgeController.grounded, true, `Slow ${mode} edge walk must land instead of falling through.`);
  assert.equal(edgeController.recoveryCount, recoveries, `Slow ${mode} edge walk must not require kill-plane recovery.`);
  if (mode === 'stair') {
    assert.ok(edgePosition[1] >= 0.5 - 1e-5 && edgePosition[1] <= 1 + 1e-5, 'Stair landing must use the stair surface height.');
  } else {
    approx(edgePosition[1], expectedY, 1e-5);
  }
  assert.ok(edgePosition[0] >= 1 + RIFT_PLAYER_RADIUS - 0.005, `Edge landing must depenetrate from the upper block side (${mode}).`);
}

// Deliberately release movement while the body radius still overlaps the upper
// block side. This was the exact H1.68 fall-through path.
for (const steps of [11, 13, 15, 17]) slowWalkOff({ steps, expectedY: 1, mode: 'full' });
slowWalkOff({ steps: 15, expectedY: 0.5, mode: 'slab' });
slowWalkOff({ steps: 15, mode: 'stair' });

// Diagonal corner overlap is the harsher version: two radius probes can remain
// inside the block that was left. It must still resolve onto the floor below.
lowerShape = 'full';
upperCell = [0, 0];
edgeController.teleport([0.72, 2.2, 0.72]);
const cornerRecoveries = edgeController.recoveryCount;
key('keydown', 'KeyD');
key('keydown', 'KeyS');
for (let i = 0; i < 18; i += 1) edgeController.update(1 / 120);
key('keyup', 'KeyD');
key('keyup', 'KeyS');
assert.equal(edgeController.grounded, false, 'Diagonal corner test must leave the upper block.');
settle();
assert.equal(edgeController.grounded, true, 'Diagonal corner landing must not fall through the lower floor.');
approx(edgePosition[1], 1, 1e-5);
assert.equal(edgeController.recoveryCount, cornerRecoveries, 'Diagonal corner landing must not use kill-plane recovery.');
assert.ok(
  edgePosition[0] >= 1 + RIFT_PLAYER_RADIUS - 0.005 || edgePosition[2] >= 1 + RIFT_PLAYER_RADIUS - 0.005,
  'Corner landing must resolve the remaining upper-block body overlap.'
);
edgeController.destroy();
if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;

console.log('[player-physics-check] stacked supports, slow edge landings, slab/stair drops and corner depenetration: PASS');
