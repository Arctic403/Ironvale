import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('public/index.html');
const app = read('public/app.js');
const geometryGuard = read('public/rift-geometry-guard.js');
const glTripwire = read('public/rift-gl-tripwire.js');
const historyBridge = read('public/rift-history-bridge.js');
const architectureGuard = read('public/rift-architecture-guard.js');

function assert(condition, message) {
  if (!condition) throw new Error(`Render forensics check failed: ${message}`);
}

for (const file of ['rift-geometry-guard.js', 'rift-gl-tripwire.js', 'rift-architecture-guard.js', 'rift-validator-guard.js', 'rift-history-bridge.js', 'rift-auto-validation.js']) {
  assert(index.includes(`/${file}`), `${file} is not loaded by index.html`);
}

const geometryIndex = index.indexOf('/rift-geometry-guard.js');
const appIndex = index.indexOf('/app.js');
const glIndex = index.indexOf('/rift-gl-tripwire.js');
const architectureIndex = index.indexOf('/rift-architecture-guard.js');
const validatorIndex = index.indexOf('/rift-validator-guard.js');
const historyIndex = index.indexOf('/rift-history-bridge.js');
const autoIndex = index.indexOf('/rift-auto-validation.js');
assert(geometryIndex >= 0 && geometryIndex < appIndex, 'geometry guard must load before app creates fallback meshes');
assert(glIndex > appIndex, 'GL tripwire must load after app engine module');
assert(architectureIndex < validatorIndex, 'architecture guard must wrap diagnostics before validator guard');
assert(validatorIndex < historyIndex && historyIndex < autoIndex, 'history bridge must load after validator guard and before auto validation');

assert(app.includes('function createCapsuleGeometry()'), 'fallback capsule generator missing');
assert(app.includes('const d = (ring + 1) * radial + next;'), 'fallback capsule source must wrap the next-ring seam directly');
assert(app.includes("IRONVALE_EDITOR_HISTORY_FORMAT = 'ironvale-editor-history-runtime-v1'"), 'explicit editor history runtime format missing');
assert(app.includes('window.IronvaleEditorHistory = Object.freeze'), 'explicit editor history runtime API missing');
assert(app.includes('captureEditorHistory') && app.includes('restoreEditorHistory'), 'editor history capture/restore API incomplete');

assert(geometryGuard.includes("CAPSULE_LABEL = 'player-capsule'"), 'fallback capsule safety-net target missing');
assert(geometryGuard.includes('const d = (ring + 1) * CAPSULE_RADIAL + next'), 'capsule safety-net seam repair missing');
assert(geometryGuard.includes('index >= vertexCount'), 'generic out-of-bounds index rejection missing');
assert(geometryGuard.includes('IRONVALE_GEOMETRY_INDEX_OOB'), 'descriptive geometry bounds error missing');
assert(geometryGuard.includes('rejectsOutOfBoundsIndicesBeforeWebGL: true'), 'geometry guard policy assertion missing');

assert(glTripwire.includes("dormantUntilPeriodicError: true"), 'tripwire must remain dormant until a periodic GL error');
assert(glTripwire.includes("tripwire:render") === false, 'tripwire telemetry source must identify exact operations, not a generic render source');
assert(glTripwire.includes('drawElements'), 'tripwire must instrument drawElements');
assert(glTripwire.includes('meshSnapshot'), 'tripwire must capture mesh context');
assert(glTripwire.includes('state.armedFrames'), 'tripwire must be bounded in time');

assert(historyBridge.includes("IRONVALE_HISTORY_BRIDGE_FORMAT = 'ironvale-history-bridge-v3'"), 'explicit history bridge version missing');
assert(historyBridge.includes('IronvaleEditorHistory'), 'history bridge must use the app-owned history runtime API');
assert(historyBridge.includes('opaqueSnapshotTokens: true'), 'history bridge must use opaque runtime snapshot tokens');
assert(historyBridge.includes('globalArrayPrototypeHooks: false'), 'history bridge must declare global array hooks disabled');
assert(historyBridge.includes('diagnosticJournalInterception: false'), 'history bridge must not intercept diagnostic journal arrays');
assert(historyBridge.includes("restoreHistory('pre-integrity')"), 'history must restore before post-test integrity snapshot');
assert(!historyBridge.includes('Array.prototype.push ='), 'history bridge must not patch Array.prototype.push');
assert(!historyBridge.includes('Array.prototype.pop ='), 'history bridge must not patch Array.prototype.pop');

assert(architectureGuard.includes('architecture.movement-zero-d1'), 'zero-D1 movement validator check missing');
assert(architectureGuard.includes("MOVEMENT_ROUTE = '/api/character/position'"), 'movement route guard missing');
assert(architectureGuard.includes('d1Calls > 0 || d1Writes > 0 || d1Failures > 0'), 'movement D1 guard must fail on any D1 activity');
assert(architectureGuard.includes('ordinaryMovementWritesToD1 === false'), 'movement authority policy assertion missing');

console.log('Ironvale renderer forensics verification passed.');
