import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const guard = read('public/rift-validator-guard.js');
const auto = read('public/rift-auto-validation.js');
const index = read('public/index.html');
const pkg = JSON.parse(read('package.json'));

const requiredGuardChecks = [
  'renderer.gl-errors',
  'runtime.console-errors',
  'network.server-failures',
  'native.failures',
  'realtime.socket',
  'realtime.d1-policy',
  'realtime.corrections',
  'performance.frame-time',
  'terrain.section-coverage',
  'renderer.viewport',
  'character.rig-runtime',
  'ui.layout',
  'auto-validation.visual-evidence',
  'auto-validation.restoration'
];

for (const id of requiredGuardChecks) {
  if (!guard.includes(`'${id}'`) && !guard.includes(`\"${id}\"`)) throw new Error(`Validator guard missing check: ${id}`);
}

for (const token of [
  'captureScreenshot',
  'image/webp',
  'sha256',
  'Export Validation Bundle',
  'makeStoredZip',
  'manual-auto-validation-bundle',
  'exportsDumpAutomatically: false',
  'exportsScreenshotsAutomatically: false',
  'verifiesRestorationIntegrity: true'
]) {
  if (!auto.includes(token)) throw new Error(`Auto validation evidence missing: ${token}`);
}

const guardIndex = index.indexOf('/rift-validator-guard.js');
const autoIndex = index.indexOf('/rift-auto-validation.js');
const realtimeIndex = index.indexOf('/rift-realtime.js');
if (guardIndex < 0 || autoIndex < 0 || realtimeIndex < 0) throw new Error('Validator/realtime modules are not all loaded by index.html');
if (!(realtimeIndex < guardIndex && guardIndex < autoIndex)) throw new Error('Module order must be realtime -> validator guard -> auto validation');

const build = pkg?.scripts?.build || '';
for (const token of ['node --check public/rift-validator-guard.js', 'node --check public/rift-auto-validation.js', 'node scripts/check-validator-evidence.mjs']) {
  if (!build.includes(token)) throw new Error(`Build contract missing: ${token}`);
}

console.log('Validator evidence architecture check passed.');
