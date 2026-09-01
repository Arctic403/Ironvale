import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const write = (path, value) => fs.writeFileSync(new URL(`../${path}`, import.meta.url), value);

// 1) Expose the app-owned player transform without leaking the lexical player object.
let app = read('public/app.js');
const playerMarker = "const IRONVALE_PLAYER_STATE_FORMAT = 'ironvale-player-state-runtime-v1';";
if (!app.includes(playerMarker)) {
  const anchor = `window.IronvaleEditorHistory = Object.freeze({\n  format: IRONVALE_EDITOR_HISTORY_FORMAT,\n  capture: captureEditorHistory,\n  restore: restoreEditorHistory,\n  discard: discardEditorHistory,\n  status: editorHistoryStatus\n});\n`;
  if (!app.includes(anchor)) throw new Error('Editor history API anchor not found in app.js');
  const playerApi = `${anchor}\nconst IRONVALE_PLAYER_STATE_FORMAT = 'ironvale-player-state-runtime-v1';\n\nfunction playerStateSnapshot(label = 'external') {\n  return {\n    format: IRONVALE_PLAYER_STATE_FORMAT,\n    label: String(label || 'external').slice(0, 80),\n    x: player.x,\n    y: player.y,\n    z: player.z,\n    yaw: player.yaw,\n    vy: player.vy,\n    grounded: Boolean(player.grounded)\n  };\n}\n\nfunction restorePlayerState(snapshot) {\n  const values = [snapshot?.x, snapshot?.y, snapshot?.z, snapshot?.yaw].map(Number);\n  if (values.some(value => !Number.isFinite(value))) {\n    return { ok: false, error: 'invalid-player-transform', ...playerStateSnapshot('restore-failed') };\n  }\n  input.forward = 0;\n  input.strafe = 0;\n  input.keys.clear();\n  joystickActive = false;\n  playerMoving = false;\n  player.x = values[0];\n  player.y = values[1];\n  player.z = values[2];\n  player.yaw = values[3];\n  player.vy = Number.isFinite(Number(snapshot?.vy)) ? Number(snapshot.vy) : 0;\n  player.grounded = snapshot?.grounded !== false;\n  return { ok: true, ...playerStateSnapshot('restored') };\n}\n\nwindow.IronvalePlayerState = Object.freeze({\n  format: IRONVALE_PLAYER_STATE_FORMAT,\n  capture: playerStateSnapshot,\n  restore: restorePlayerState,\n  status: () => playerStateSnapshot('status')\n});\n`;
  app = app.replace(anchor, playerApi);
}
write('public/app.js', app);

// 2) Restore the player locally and through the existing realtime movement path
// before the final integrity snapshot. The pagehide checkpoint is intentionally
// sent after the exact baseline movement packet so persisted state cannot retain
// the validator's temporary movement drift.
let auto = read('public/rift-auto-validation.js');
if (!auto.includes('playerRestoration: null')) {
  auto = auto.replace(
    `  restoration: null,\n  postValidation: null,`,
    `  restoration: null,\n  playerRestoration: null,\n  postValidation: null,`
  );
  auto = auto.replace(
    `  state.restoration = null;\n  state.postValidation = null;`,
    `  state.restoration = null;\n  state.playerRestoration = null;\n  state.postValidation = null;`
  );
}

const restoreMarker = 'async function restorePlayerBaseline(baseline) {';
if (!auto.includes(restoreMarker)) {
  const anchor = `async function runFullAutoValidation() {`;
  if (!auto.includes(anchor)) throw new Error('runFullAutoValidation anchor not found');
  const helper = `async function restorePlayerBaseline(baseline) {\n  const api = window.IronvalePlayerState;\n  if (!baseline || !api?.restore) throw new Error('Player restoration API unavailable');\n  const restored = api.restore(baseline);\n  if (!restored?.ok) throw new Error(restored?.error || 'Player transform restore failed');\n  await nextFrame();\n  await nextFrame();\n\n  const response = await fetch('/api/character/position', {\n    method: 'PUT',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify({ x: baseline.x, y: baseline.y, z: baseline.z, yaw: baseline.yaw })\n  });\n  if (!response.ok) throw new Error(\`Authoritative player restore HTTP \${response.status}\`);\n\n  // WebSocket message ordering guarantees the exact movement packet precedes\n  // this checkpoint when realtime is connected. The normal HTTP fallback still\n  // remains RAM-authoritative and never writes ordinary movement directly to D1.\n  await sleep(80);\n  window.dispatchEvent(new Event('pagehide'));\n  await sleep(220);\n\n  const current = api.status?.();\n  const distance = current ? Math.hypot(\n    Number(current.x) - Number(baseline.x),\n    Number(current.y) - Number(baseline.y),\n    Number(current.z) - Number(baseline.z)\n  ) : Number.POSITIVE_INFINITY;\n  const yawDelta = current ? Math.abs(Number(current.yaw) - Number(baseline.yaw)) : Number.POSITIVE_INFINITY;\n  const exact = Number.isFinite(distance) && distance <= 0.001 && Number.isFinite(yawDelta) && yawDelta <= 0.001;\n  if (!exact) throw new Error(\`Player baseline restore drifted by \${distance.toFixed(4)}m / yaw \${yawDelta.toFixed(4)}\`);\n  return { ok: true, distance, yawDelta, baseline: { x: baseline.x, y: baseline.y, z: baseline.z, yaw: baseline.yaw } };\n}\n\n`;
  auto = auto.replace(anchor, helper + anchor);
}

if (!auto.includes("const playerBaseline = window.IronvalePlayerState?.capture?.('auto-validation') || null;")) {
  auto = auto.replace(
    `  const uiBaseline = captureUiBaseline();\n  diagnosticsRecord('Full auto validation started'`,
    `  const uiBaseline = captureUiBaseline();\n  const playerBaseline = window.IronvalePlayerState?.capture?.('auto-validation') || null;\n  diagnosticsRecord('Full auto validation started'`
  );
}

if (!auto.includes('state.playerRestoration = await restorePlayerBaseline(playerBaseline);')) {
  auto = auto.replace(
    `    await restoreUiBaseline(uiBaseline);\n    await runStep('post-test restoration integrity'`,
    `    await restoreUiBaseline(uiBaseline);\n    state.playerRestoration = await restorePlayerBaseline(playerBaseline);\n    await runStep('post-test restoration integrity'`
  );
}

auto = auto.replace(
  `      const status = r.terrainMatched === false || r.draftMatched === false || r.terrainSelectionMatched === false ? 'fail' : r.historyMatched === false ? 'warn' : 'pass';`,
  `      const playerExact = Number.isFinite(Number(r.playerDistance)) && Number(r.playerDistance) <= 0.001;\n      const status = r.terrainMatched === false || r.draftMatched === false || r.terrainSelectionMatched === false || !playerExact ? 'fail' : r.historyMatched === false ? 'warn' : 'pass';`
);
auto = auto.replace(
  `        detail: \`terrain=\${r.terrainMatched} draft=\${r.draftMatched} selection=\${r.terrainSelectionMatched} history=\${r.historyMatched} undoΔ=\${r.undoDelta} redoΔ=\${r.redoDelta} playerΔ=\${r.playerDistance ?? 'n/a'}m\``,
  `        detail: \`terrain=\${r.terrainMatched} draft=\${r.draftMatched} selection=\${r.terrainSelectionMatched} history=\${r.historyMatched} undoΔ=\${r.undoDelta} redoΔ=\${r.redoDelta} playerΔ=\${r.playerDistance ?? 'n/a'}m exact=\${playerExact}\``
);

if (!auto.includes('playerRestoration: state.playerRestoration')) {
  auto = auto.replace(
    `    restoration: state.restoration,\n    postValidation: state.postValidation,`,
    `    restoration: state.restoration,\n    playerRestoration: state.playerRestoration,\n    postValidation: state.postValidation,`
  );
}
if (!auto.includes('restoresPlayerTransformExactly: true')) {
  auto = auto.replace(
    `      verifiesRestorationIntegrity: true,\n      exercisesRealtimeCheckpoint: true,`,
    `      verifiesRestorationIntegrity: true,\n      restoresPlayerTransformExactly: true,\n      restoresRealtimeAuthorityBeforeCheckpoint: true,\n      exercisesRealtimeCheckpoint: true,`
  );
}
write('public/rift-auto-validation.js', auto);

// 3) Cache-bust only the modules changed by this cleanup.
let index = read('public/index.html');
index = index
  .replace('/rift-geometry-guard.js?v=20260901-capsule-index-r1', '/rift-geometry-guard.js?v=20260901-capsule-index-r2')
  .replace('/app.js?v=20260901-root-cleanup-r1', '/app.js?v=20260901-player-restore-r1')
  .replace('/rift-auto-validation.js?v=20260901-validator-evidence-r1', '/rift-auto-validation.js?v=20260901-player-restore-r1');
write('public/index.html', index);

console.log('Installed exact player restoration and cache-busted geometry guard v2.');
