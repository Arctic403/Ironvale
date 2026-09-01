import fs from 'node:fs';

const failures = [];
const read = path => fs.readFileSync(path, 'utf8');

for (const path of ['public/rift-diagnostic-hooks.js', 'src/index.js', 'public/index.html', 'public/app.js']) {
  if (!fs.existsSync(path)) failures.push(`missing ${path}`);
}

if (!failures.length) {
  const hooks = read('public/rift-diagnostic-hooks.js');
  const worker = read('src/index.js');
  const html = read('public/index.html');
  const app = read('public/app.js');

  if (!html.includes('rift-diagnostic-hooks.js?v=')) failures.push('diagnostic subsystem sidecar is not loaded');
  for (const provider of ['backend', 'assets', 'materials', 'character', 'input-actions', 'editor-journal']) {
    if (!hooks.includes(`registerProvider('${provider}'`)) failures.push(`missing ${provider} diagnostic provider`);
  }
  if (!hooks.includes('RiftTerrainMaterialRuntime') || !hooks.includes('proto.loadLayer = async function diagnosticLoadLayer')) failures.push('terrain material diagnostic runtime patch');
  if (!hooks.includes("window.addEventListener('pointerdown'") || !hooks.includes("window.addEventListener('keydown'")) failures.push('input action journal hooks');
  if (!hooks.includes('EDITOR_MUTATION_IDS') || !hooks.includes('EDITOR_VALUE_IDS') || !hooks.includes('terrain-canvas-gesture')) failures.push('terrain editor mutation journal hooks');
  if (!hooks.includes('PerformanceObserver') || !hooks.includes('serverTiming') || !hooks.includes("metricByName(entry, 'd1')")) failures.push('backend/server timing telemetry consumer');
  if (!hooks.includes('isCharacterResource') || !hooks.includes('isMaterialResource') || !hooks.includes('assetProvider')) failures.push('unified asset/character/material telemetry');

  if (!worker.includes('createBackendDiagnostic') || !worker.includes('instrumentDatabase') || !worker.includes('finalizeBackendResponse')) failures.push('worker backend black-box instrumentation');
  if (!worker.includes('Server-Timing') || !worker.includes("timingMetric('d1'") || !worker.includes("timingMetric('auth'")) failures.push('worker compact server timing export');
  if (/INSERT\s+INTO\s+.*diagnostic/i.test(worker) || /CREATE TABLE[^;]*diagnostic/i.test(worker)) failures.push('backend diagnostics must not write diagnostic rows to D1');
  if (!app.includes("registerProvider('engine'") || !app.includes("registerProvider('native'")) failures.push('engine/native diagnostic providers regressed');
}

if (failures.length) {
  console.error('Ironvale black-box hook verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Ironvale black-box subsystem hooks verified.');
