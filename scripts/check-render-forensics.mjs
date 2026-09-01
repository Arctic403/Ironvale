import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('public/index.html');
const glTripwire = read('public/rift-gl-tripwire.js');
const historyBridge = read('public/rift-history-bridge.js');
const architectureGuard = read('public/rift-architecture-guard.js');

function assert(condition, message) {
  if (!condition) throw new Error(`Render forensics check failed: ${message}`);
}

for (const file of ['rift-gl-tripwire.js', 'rift-architecture-guard.js', 'rift-validator-guard.js', 'rift-history-bridge.js', 'rift-auto-validation.js']) {
  assert(index.includes(`/${file}`), `${file} is not loaded by index.html`);
}

const glIndex = index.indexOf('/rift-gl-tripwire.js');
const architectureIndex = index.indexOf('/rift-architecture-guard.js');
const validatorIndex = index.indexOf('/rift-validator-guard.js');
const historyIndex = index.indexOf('/rift-history-bridge.js');
const autoIndex = index.indexOf('/rift-auto-validation.js');
assert(glIndex > index.indexOf('/app.js'), 'GL tripwire must load after app engine module');
assert(architectureIndex < validatorIndex, 'architecture guard must wrap diagnostics before validator guard');
assert(validatorIndex < historyIndex && historyIndex < autoIndex, 'history bridge must load after validator guard and before auto validation');

assert(glTripwire.includes("dormantUntilPeriodicError: true"), 'tripwire must remain dormant until a periodic GL error');
assert(glTripwire.includes("tripwire:render") === false, 'tripwire telemetry source must identify exact operations, not a generic render source');
assert(glTripwire.includes("drawElements"), 'tripwire must instrument drawElements');
assert(glTripwire.includes("meshSnapshot"), 'tripwire must capture mesh context');
assert(glTripwire.includes("state.armedFrames"), 'tripwire must be bounded in time');

assert(historyBridge.includes("baselineUndo") && historyBridge.includes("baselineRedo"), 'history bridge must retain both baseline stacks');
assert(historyBridge.includes("restoreHistory"), 'history bridge must restore exact history');
assert(historyBridge.includes("arrayHooksOnlyDuringAutoRun: true"), 'history array hooks must be scoped to auto validation');

assert(architectureGuard.includes("architecture.movement-zero-d1"), 'zero-D1 movement validator check missing');
assert(architectureGuard.includes("MOVEMENT_ROUTE = '/api/character/position'"), 'movement route guard missing');
assert(architectureGuard.includes("d1Calls > 0 || d1Writes > 0 || d1Failures > 0"), 'movement D1 guard must fail on any D1 activity');
assert(architectureGuard.includes("ordinaryMovementWritesToD1 === false"), 'movement authority policy assertion missing');

console.log('Ironvale renderer forensics verification passed.');
