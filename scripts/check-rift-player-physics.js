import assert from 'node:assert/strict';
import {
  RIFT_BLOCK_SHAPES,
  RIFT_BLOCK_ROTATIONS,
  encodeRiftBlockState
} from '../public/rift-block-shapes.js';
import {
  RIFT_PLAYER_COLLISION_SKIN,
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
const southStair = encodeRiftBlockState({
  material: 1,
  shape: RIFT_BLOCK_SHAPES.stair,
  rotation: RIFT_BLOCK_ROTATIONS.south
});
const westStair = encodeRiftBlockState({
  material: 1,
  shape: RIFT_BLOCK_SHAPES.stair,
  rotation: RIFT_BLOCK_ROTATIONS.west
});

approx(riftPlayerShapeTopAt(bottomSlab, 0.5, 0.5), 0.5);
approx(riftPlayerShapeTopAt(eastStair, 0.1, 0.5), 0.1);
approx(riftPlayerShapeTopAt(eastStair, 0.9, 0.5), 0.9);
approx(riftPlayerShapeTopAt(northStair, 0.5, 0.1), 0.9);
approx(riftPlayerShapeTopAt(northStair, 0.5, 0.9), 0.1);
approx(riftPlayerShapeTopAt(southStair, 0.5, 0.1), 0.1);
approx(riftPlayerShapeTopAt(southStair, 0.5, 0.9), 0.9);
approx(riftPlayerShapeTopAt(westStair, 0.1, 0.5), 0.9);
approx(riftPlayerShapeTopAt(westStair, 0.9, 0.5), 0.1);

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
approx(sampler.supportAtPoint(1.1, 0.5, 1, { maxRise: RIFT_PLAYER_STEP_UP, maxDrop: 2 }), 0.1);
approx(sampler.supportAtPoint(1.9, 0.5, 1, { maxRise: RIFT_PLAYER_STEP_UP, maxDrop: 2 }), 0.9);
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
  // H1.72 intentionally keeps the upper support while a meaningful part of the
  // foot still owns it. The old H1.69 test expected an immediate drop here;
  // that behavior is now the bug being prevented.
  assert.equal(edgeController.grounded, true, `Slow ${mode} edge walk must keep partial upper-foot support.`);
  approx(edgePosition[1], 2, 1e-5);
  for (let i = 0; i < 80 && edgePosition[0] < 1 + RIFT_PLAYER_RADIUS + 0.04; i += 1) edgeController.update(1 / 120);
  key('keyup', 'KeyD');
  settle();
  assert.equal(edgeController.grounded, true, `Slow ${mode} edge walk must land instead of falling through.`);
  assert.equal(edgeController.recoveryCount, recoveries, `Slow ${mode} edge walk must not require kill-plane recovery.`);
  if (mode === 'stair') {
    assert.ok(edgePosition[1] >= -1e-5 && edgePosition[1] <= 1 + 1e-5, 'Stair landing must use the invisible 0→1 ramp surface height.');
  } else {
    approx(edgePosition[1], expectedY, 1e-5);
  }
  assert.ok(edgePosition[0] >= 1 + RIFT_PLAYER_RADIUS - 0.005, `Edge walk must clear the upper block before settling lower (${mode}).`);
}

// Deliberately creep across the edge at the old H1.68 failure offsets, then
// continue until the foot genuinely clears the upper support. H1.72 preserves
// partial support first; H1.69 still guarantees the later lower landing.
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
assert.equal(edgeController.grounded, true, 'Diagonal partial-foot contact must retain the upper support until meaningful contact is gone.');
approx(edgePosition[1], 2, 1e-5);
for (let i = 0; i < 80 && (edgePosition[0] < 1 + RIFT_PLAYER_RADIUS + 0.04 || edgePosition[2] < 1 + RIFT_PLAYER_RADIUS + 0.04); i += 1) {
  edgeController.update(1 / 120);
}
key('keyup', 'KeyD');
key('keyup', 'KeyS');
settle();
assert.equal(edgeController.grounded, true, 'Diagonal corner landing must not fall through the lower floor.');
approx(edgePosition[1], 1, 1e-5);
assert.equal(edgeController.recoveryCount, cornerRecoveries, 'Diagonal corner landing must not use kill-plane recovery.');
assert.ok(
  edgePosition[0] >= 1 + RIFT_PLAYER_RADIUS - 0.005 || edgePosition[2] >= 1 + RIFT_PLAYER_RADIUS - 0.005,
  'Corner walk-off must clear the upper support before settling lower.'
);
edgeController.destroy();
if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;

console.log('[player-physics-check] stacked supports, slow edge landings, slab/stair drops and corner depenetration: PASS');


// H1.70: zero-penetration invariant. The player transform committed to the
// renderer must never place the cylinder inside a FULL block, even for the two
// troublesome cases reported in playtesting: jumping onto a full block from the
// side and creeping off its edge slowly enough that the body radius still clips
// the block while gravity begins.
const hardenListeners = new Map();
globalThis.window = {
  addEventListener(type, handler) { hardenListeners.set(type, handler); },
  removeEventListener(type, handler) { if (hardenListeners.get(type) === handler) hardenListeners.delete(type); }
};
let hardenPosition = [3.35, 1, 2.5];
let hardenFacing = 0;
let committedPositions = [];
const hardenPlayer = {
  radius: RIFT_PLAYER_RADIUS,
  height: 1.8,
  get position() { return [...hardenPosition]; },
  get facing() { return hardenFacing; },
  setPosition(x, y, z) {
    hardenPosition = [x, y, z];
    committedPositions.push([...hardenPosition]);
  },
  setFacingRadians(value) { hardenFacing = value; },
  setMotion() {},
  update() {}
};
const hardenBounds = { min: [0, 0, 0], max: [4, 4, 4] };
const hardenGrid = {
  getBlockWorld(x, y, z) {
    if (y === 0 && x >= 0 && x <= 4 && z >= 0 && z <= 4) return full;
    if (x === 2 && y === 1 && z === 2) return full;
    return 0;
  }
};
const hardenController = createRiftPlayerController({
  canvas: null,
  camera: { flatForward: () => [0, 0, -1] }, // A = -X, D = +X.
  getGrid: () => hardenGrid,
  getWorldBounds: () => hardenBounds,
  player: hardenPlayer,
  touchRoot: { querySelector: () => null }
});
const hardenKey = (type, code) => hardenListeners.get(type)?.({ code, preventDefault() {} });
const upperCellPenetrated = ([x, y, z]) => {
  const closestX = Math.max(2, Math.min(3, x));
  const closestZ = Math.max(2, Math.min(3, z));
  const dx = x - closestX;
  const dz = z - closestZ;
  const horizontalOverlap = dx * dx + dz * dz < (RIFT_PLAYER_RADIUS - RIFT_PLAYER_COLLISION_SKIN * 0.5) ** 2;
  const verticalOverlap = y + RIFT_PLAYER_COLLISION_SKIN < 2 && y + 1.8 - RIFT_PLAYER_COLLISION_SKIN > 1;
  return horizontalOverlap && verticalOverlap;
};
const assertNoCommittedPenetration = (label) => {
  const bad = committedPositions.find(upperCellPenetrated);
  assert.equal(bad, undefined, `${label} committed an embedded player transform: ${JSON.stringify(bad)}`);
};

// Jump from the east side onto the upper full block. The side collision must
// hold until the feet clear y=2, after which horizontal travel can continue and
// the descending sweep must land exactly on the top surface.
hardenController.teleport([3.35, 1.1, 2.5]);
committedPositions = [];
hardenKey('keydown', 'KeyA');
hardenKey('keydown', 'Space');
let reachedBlockCenter = false;
for (let i = 0; i < 240; i += 1) {
  hardenController.update(1 / 120);
  if (hardenPosition[0] < 2.72) {
    reachedBlockCenter = true;
    hardenKey('keyup', 'KeyA');
    break;
  }
}
hardenKey('keyup', 'Space');
assert.equal(reachedBlockCenter, true, 'Jump test must actually travel over the full block.');
for (let i = 0; i < 360 && !hardenController.grounded; i += 1) hardenController.update(1 / 120);
assert.equal(hardenController.grounded, true, 'Jump onto full block must land.');
approx(hardenPosition[1], 2, 1e-4);
assertNoCommittedPenetration('Jump-on-full-block');

// Now creep across the same edge. H1.72 retains the upper support while the
// circular foot still has meaningful top contact; once the foot really clears,
// H1.70's zero-penetration fall path still guarantees that no embedded frame is
// committed on the way to the lower floor.
hardenController.teleport([2.72, 2.2, 2.5]);
committedPositions = [];
hardenKey('keydown', 'KeyD');
for (let i = 0; i < 13; i += 1) hardenController.update(1 / 120);
assert.equal(hardenController.grounded, true, 'Partial-foot edge contact must remain grounded on the upper block.');
approx(hardenPosition[1], 2, 1e-4);
for (let i = 0; i < 80 && hardenPosition[0] < 3 + RIFT_PLAYER_RADIUS + 0.04; i += 1) hardenController.update(1 / 120);
hardenKey('keyup', 'KeyD');
for (let i = 0; i < 360 && !hardenController.grounded; i += 1) hardenController.update(1 / 120);
assert.equal(hardenController.grounded, true, 'Slow edge drop must land on the lower floor after support is genuinely gone.');
approx(hardenPosition[1], 1, 1e-4);
assert.ok(hardenPosition[0] >= 3 + RIFT_PLAYER_RADIUS - 0.012, 'Slow edge drop must clear the upper block side before descending.');
assertNoCommittedPenetration('Slow-edge-drop');

hardenController.destroy();
if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
console.log('[player-physics-check] zero-penetration jump/edge invariant and pre-render collision hardening: PASS');

// H1.71: strict partial-shape transitions + invisible stair ramp. H1.70's
// no-penetration rule must not turn legal 0.5 m slab steps into walls, and the
// visible two-tread stair must behave as one continuous 0->1 m collision ramp.
const transitionListeners = new Map();
globalThis.window = {
  addEventListener(type, handler) { transitionListeners.set(type, handler); },
  removeEventListener(type, handler) { if (transitionListeners.get(type) === handler) transitionListeners.delete(type); }
};
let transitionPosition = [2.4, 1, 2.5];
let transitionFacing = 0;
const transitionCommits = [];
const transitionPlayer = {
  radius: RIFT_PLAYER_RADIUS,
  height: 1.8,
  get position() { return [...transitionPosition]; },
  get facing() { return transitionFacing; },
  setPosition(x, y, z) {
    transitionPosition = [x, y, z];
    transitionCommits.push([...transitionPosition]);
  },
  setFacingRadians(value) { transitionFacing = value; },
  setMotion() {},
  update() {}
};
const transitionBounds = { min: [0, 0, 0], max: [7, 5, 5] };
const transitionCells = new Map();
const transitionGrid = {
  getBlockWorld(x, y, z) { return transitionCells.get(`${x},${y},${z}`) || 0; }
};
const transitionController = createRiftPlayerController({
  canvas: null,
  camera: { flatForward: () => [0, 0, -1] }, // D = +X, A = -X.
  getGrid: () => transitionGrid,
  getWorldBounds: () => transitionBounds,
  player: transitionPlayer,
  touchRoot: { querySelector: () => null }
});
const transitionKey = (type, code) => transitionListeners.get(type)?.({ code, preventDefault() {} });
const transitionSet = (x, y, z, state) => transitionCells.set(`${x},${y},${z}`, state);
function resetTransitionWorld() {
  transitionCells.clear();
  for (let x = 0; x <= 7; x += 1) {
    for (let z = 0; z <= 5; z += 1) transitionSet(x, 0, z, full);
  }
  transitionCommits.length = 0;
}
function walkTransition(code, predicate, { dt = 1 / 120, frames = 1200 } = {}) {
  transitionKey('keydown', code);
  const samples = [];
  for (let i = 0; i < frames; i += 1) {
    transitionController.update(dt);
    samples.push([...transitionPosition]);
    if (predicate(transitionPosition)) {
      transitionKey('keyup', code);
      return { reached: true, samples };
    }
  }
  transitionKey('keyup', code);
  return { reached: false, samples };
}
function settleTransition(frames = 480) {
  for (let i = 0; i < frames && !transitionController.grounded; i += 1) transitionController.update(1 / 120);
}

// Ground -> bottom slab at tiny spatial increments. H1.70 used to stop the
// cylinder as soon as its radius touched the slab side, before center support
// could discover the legal +0.5 m surface.
resetTransitionWorld();
transitionSet(3, 1, 2, bottomSlab);
transitionController.teleport([2.4, 1.1, 2.5]);
let recoveriesBefore = transitionController.recoveryCount;
let transition = walkTransition('KeyD', p => p[0] >= 3.4, { dt: 1 / 600 });
assert.equal(transition.reached, true, 'Creeping from ground onto a bottom slab must not stick on the slab side.');
approx(transitionPosition[1], 1.5, 1e-4);
assert.equal(transitionController.grounded, true);
assert.equal(transitionController.recoveryCount, recoveriesBefore);

// Bottom slab -> full block is the mirror +0.5 m step. The controller may
// raise before center crossing, but every committed transform remains clear of
// solid collision because vertical clearance is resolved before horizontal move.
resetTransitionWorld();
transitionSet(2, 1, 2, bottomSlab);
transitionSet(3, 1, 2, full);
transitionController.teleport([2.45, 1.6, 2.5]);
recoveriesBefore = transitionController.recoveryCount;
transition = walkTransition('KeyD', p => p[0] >= 3.4, { dt: 1 / 600 });
assert.equal(transition.reached, true, 'Creeping from a bottom slab onto a full block +0.5 m higher must auto-step instead of stick.');
approx(transitionPosition[1], 2, 1e-4);
assert.equal(transitionController.recoveryCount, recoveriesBefore);

// Full -> lower slab must keep moving horizontally at the old safe height until
// the cylinder clears the departing full-block side, then land on the slab.
resetTransitionWorld();
transitionSet(2, 1, 2, full);
transitionSet(3, 1, 2, bottomSlab);
transitionController.teleport([2.45, 2.1, 2.5]);
recoveriesBefore = transitionController.recoveryCount;
transition = walkTransition('KeyD', p => p[0] >= 3.42, { dt: 1 / 600 });
assert.equal(transition.reached, true, 'Creeping from a full block down onto a half slab must leave the edge instead of stick.');
settleTransition();
assert.equal(transitionController.grounded, true);
approx(transitionPosition[1], 1.5, 1e-4);
assert.equal(transitionController.recoveryCount, recoveriesBefore, 'Full->slab transition must not use kill-plane recovery.');

// Slab -> ground must equally release into the lower support without a ledge
// magnet. This covers the reverse direction of the common street/curb case.
resetTransitionWorld();
transitionSet(3, 1, 2, bottomSlab);
transitionController.teleport([3.45, 1.6, 2.5]);
recoveriesBefore = transitionController.recoveryCount;
transition = walkTransition('KeyA', p => p[0] <= 2.6, { dt: 1 / 600 });
assert.equal(transition.reached, true, 'Creeping from a half slab down to ground must not stick on the slab edge.');
settleTransition();
assert.equal(transitionController.grounded, true);
approx(transitionPosition[1], 1, 1e-4);
assert.equal(transitionController.recoveryCount, recoveriesBefore);

// East stair: visual geometry stays two authored half-meter treads, but player
// support must traverse a continuous 0->1 m ramp from street level to the top
// of the neighboring full block. Sample the middle of the stair away from both
// entry/exit contacts so the expected y is exactly cellY + localX.
resetTransitionWorld();
transitionSet(3, 1, 2, eastStair);
transitionSet(4, 1, 2, full);
transitionController.teleport([2.4, 1.1, 2.5]);
recoveriesBefore = transitionController.recoveryCount;
transition = walkTransition('KeyD', p => p[0] >= 4.32, { dt: 1 / 600, frames: 1800 });
assert.equal(transition.reached, true, 'Ground->stair->full traversal must not stick at either stair edge.');
const uphillRampSamples = transition.samples.filter(([x]) => x >= 3.12 && x <= 3.64);
assert.ok(uphillRampSamples.length >= 20, 'Stair regression must sample the continuous ramp interior.');
for (const [x, y] of uphillRampSamples) approx(y, 1 + (x - 3), 0.025);
approx(transitionPosition[1], 2, 1e-4);
assert.equal(transitionController.recoveryCount, recoveriesBefore);

// Traverse the same stair downhill. This verifies descending support follows the
// invisible ramp instead of catching the two visible risers or dropping in two
// discrete 0.5 m steps.
transitionController.teleport([4.45, 2.1, 2.5]);
recoveriesBefore = transitionController.recoveryCount;
transition = walkTransition('KeyA', p => p[0] <= 2.62, { dt: 1 / 600, frames: 1800 });
assert.equal(transition.reached, true, 'Full->stair->ground traversal must not stick at the high stair edge.');
const downhillRampSamples = transition.samples.filter(([x]) => x >= 3.18 && x <= 3.62);
assert.ok(downhillRampSamples.length >= 20, 'Downhill stair regression must sample the ramp interior.');
for (const [x, y] of downhillRampSamples) approx(y, 1 + (x - 3), 0.03);
settleTransition();
approx(transitionPosition[1], 1, 1e-4);
assert.equal(transitionController.recoveryCount, recoveriesBefore);

// Repeat the real controller traversal for every remaining stair rotation.
// This catches a rotation mapping that looks correct in the scalar height helper
// but still sticks when the player's full cylinder/body probes cross the ramp.
for (const rotated of [
  {
    name: 'west', state: westStair, key: 'KeyA', start: [4.6, 1.1, 2.5],
    stair: [3, 1, 2], high: [2, 1, 2], done: p => p[0] <= 2.68,
    progress: p => 4 - p[0]
  },
  {
    name: 'south', state: southStair, key: 'KeyS', start: [3.5, 1.1, 1.4],
    stair: [3, 1, 2], high: [3, 1, 3], done: p => p[2] >= 3.32,
    progress: p => p[2] - 2
  },
  {
    name: 'north', state: northStair, key: 'KeyW', start: [3.5, 1.1, 3.6],
    stair: [3, 1, 2], high: [3, 1, 1], done: p => p[2] <= 1.68,
    progress: p => 3 - p[2]
  }
]) {
  resetTransitionWorld();
  transitionSet(...rotated.stair, rotated.state);
  transitionSet(...rotated.high, full);
  transitionController.teleport(rotated.start);
  recoveriesBefore = transitionController.recoveryCount;
  transition = walkTransition(rotated.key, rotated.done, { dt: 1 / 600, frames: 1800 });
  assert.equal(transition.reached, true, `${rotated.name} stair must traverse from low ground to its high platform.`);
  approx(transitionPosition[1], 2, 1e-4);
  assert.equal(transitionController.recoveryCount, recoveriesBefore, `${rotated.name} stair traversal must not recover/teleport.`);
  const rampSamples = transition.samples.filter(sample => {
    const t = rotated.progress(sample);
    return t >= 0.16 && t <= 0.68;
  });
  assert.ok(rampSamples.length >= 20, `${rotated.name} stair must sample the continuous ramp interior.`);
  for (const sample of rampSamples) approx(sample[1], 1 + rotated.progress(sample), 0.03);
  assert.ok(new Set(rampSamples.map(sample => sample[1].toFixed(3))).size >= 12, `${rotated.name} stair must not collapse to two collision treads.`);
}

// H1.72: stable edge support + partial-foot jump landing. A lower center
// sample must not steal support while a meaningful part of the circular foot is
// still on the upper flat top, and landing with the center just outside the block
// must choose the highest contacted surface rather than shoving the player down.
resetTransitionWorld();
transitionSet(2, 1, 2, full);
transitionController.teleport([2.55, 2.1, 2.5]);
recoveriesBefore = transitionController.recoveryCount;
transition = walkTransition('KeyD', p => p[0] >= 3.10, { dt: 1 / 600, frames: 400 });
assert.equal(transition.reached, true, 'Partial-support test must reach a center position just beyond the upper block edge.');
assert.ok(transitionPosition[0] > 3 && transitionPosition[0] < 3 + RIFT_PLAYER_RADIUS, 'Player center must be outside while the foot still overlaps the upper block.');
approx(transitionPosition[1], 2, 1e-5);
assert.equal(transitionController.grounded, true, 'One-foot-on/one-foot-off standing must retain the upper support.');
const heldEdgeX = transitionPosition[0];
for (let i = 0; i < 120; i += 1) transitionController.update(1 / 120);
approx(transitionPosition[0], heldEdgeX, 1e-6);
approx(transitionPosition[1], 2, 1e-5);
assert.equal(transitionController.grounded, true, 'Idle partial support must not depenetrate/push the player off the block.');
assert.equal(transitionController.recoveryCount, recoveriesBefore);

// Once the meaningful upper contact is really gone, ownership may transfer to
// the lower floor normally. This prevents the new support hysteresis becoming a
// ledge magnet.
transition = walkTransition('KeyD', p => p[0] >= 3 + RIFT_PLAYER_RADIUS + 0.05, { dt: 1 / 600, frames: 500 });
assert.equal(transition.reached, true, 'Player must still be able to deliberately walk completely off the upper block.');
settleTransition();
approx(transitionPosition[1], 1, 1e-4);
assert.equal(transitionController.grounded, true);
assert.equal(transitionController.recoveryCount, recoveriesBefore);

// Jump from the lower floor toward the upper block, then release horizontal
// input while the CENTER is still outside x=3. The overlapping foot manifold
// crosses y=2 first and must own the landing without any sideways correction.
transitionController.teleport([3.4, 1.1, 2.5]);
recoveriesBefore = transitionController.recoveryCount;
transitionKey('keydown', 'KeyA');
transitionKey('keydown', 'Space');
transitionKey('keyup', 'Space');
let releasedPartialJump = false;
let partialJumpLanded = false;
let partialLandingX = null;
for (let i = 0; i < 300; i += 1) {
  transitionController.update(1 / 120);
  if (!releasedPartialJump && transitionPosition[0] <= 3.18 && transitionPosition[1] > 1.95) {
    transitionKey('keyup', 'KeyA');
    releasedPartialJump = true;
    partialLandingX = transitionPosition[0];
  }
  if (releasedPartialJump && transitionController.grounded) {
    partialJumpLanded = true;
    break;
  }
}
transitionKey('keyup', 'KeyA');
assert.equal(releasedPartialJump, true, 'Partial jump test must release with the center still outside the upper block.');
assert.equal(partialJumpLanded, true, 'Partial-foot jump must find a stable landing.');
assert.ok(transitionPosition[0] > 3 && transitionPosition[0] < 3 + RIFT_PLAYER_RADIUS, 'Partial jump landing center must remain outside the upper block footprint.');
approx(transitionPosition[0], partialLandingX, 1e-5);
approx(transitionPosition[1], 2, 1e-5);
assert.equal(transitionController.grounded, true);
assert.equal(transitionController.recoveryCount, recoveriesBefore, 'Partial-foot landing must not use recovery/teleport.');
for (let i = 0; i < 90; i += 1) transitionController.update(1 / 120);
approx(transitionPosition[0], partialLandingX, 1e-5);
approx(transitionPosition[1], 2, 1e-5);
assert.equal(transitionController.grounded, true, 'Partial-foot landing must remain owned by the upper block after landing.');

transitionController.destroy();
if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
console.log('[player-physics-check] H1.71 slab transitions + four-way visual-stair/invisible-ramp traversal: PASS');
console.log('[player-physics-check] H1.72 stable edge support + partial-foot jump landing ownership: PASS');
