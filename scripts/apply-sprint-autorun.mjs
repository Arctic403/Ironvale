import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const write = (path, value) => fs.writeFileSync(new URL(`../${path}`, import.meta.url), value);
function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing sprint patch anchor: ${label}`);
  return source.replace(before, after);
}

let app = read('public/app.js');
app = app.replace("const APP_DIAGNOSTIC_BUILD = '20260901-diagnostic-gzip-r3';", "const APP_DIAGNOSTIC_BUILD = '20260901-sprint-autorun-r1';");
app = replaceOnce(app,
"const TERRAIN_DEBUG_UPDATE_MS = 250;",
"const TERRAIN_DEBUG_UPDATE_MS = 250;\nconst WALK_SPEED_MPS = 7.2;\nconst SPRINT_SPEED_MPS = 10.8;\nconst AUTO_RUN_HOLD_MS = 450;",
'movement constants');
app = replaceOnce(app,
"const authDumpButton = $('#auth-dump-button');",
"const authDumpButton = $('#auth-dump-button');\nconst sprintButton = $('#sprint-button');",
'sprint DOM reference');
app = replaceOnce(app,
"let playerMoving = false;",
"let playerMoving = false;\nlet playerSprinting = false;\nlet sprintEnabled = false;\nlet sprintSawMovement = false;\nlet autoRunEnabled = false;",
'movement state');

const playerApiAnchor = `window.IronvalePlayerState = Object.freeze({\n  format: IRONVALE_PLAYER_STATE_FORMAT,\n  capture: playerStateSnapshot,\n  restore: restorePlayerState,\n  status: () => playerStateSnapshot('status')\n});`;
const movementApi = `${playerApiAnchor}\n\nconst IRONVALE_MOVEMENT_MODE_FORMAT = 'ironvale-movement-mode-v1';\n\nfunction movementModeStatus() {\n  return {\n    format: IRONVALE_MOVEMENT_MODE_FORMAT,\n    walkSpeedMps: WALK_SPEED_MPS,\n    sprintSpeedMps: SPRINT_SPEED_MPS,\n    sprintEnabled,\n    sprinting: playerSprinting,\n    autoRun: autoRunEnabled,\n    sprintSawMovement,\n    moving: playerMoving,\n    effectiveSpeedMps: playerSprinting ? SPRINT_SPEED_MPS : playerMoving ? WALK_SPEED_MPS : 0,\n    mobileControl: Boolean(sprintButton),\n    autoRunHoldMs: AUTO_RUN_HOLD_MS\n  };\n}\n\nfunction refreshSprintButton() {\n  if (!sprintButton) return;\n  sprintButton.classList.toggle('active', sprintEnabled);\n  sprintButton.classList.toggle('auto-run', autoRunEnabled);\n  sprintButton.setAttribute('aria-pressed', sprintEnabled ? 'true' : 'false');\n  sprintButton.textContent = autoRunEnabled ? 'Auto Run' : sprintEnabled ? 'Sprint ON' : 'Sprint';\n}\n\nfunction cancelMovementAssist(reason = 'cancel') {\n  const changed = sprintEnabled || autoRunEnabled || playerSprinting;\n  sprintEnabled = false;\n  autoRunEnabled = false;\n  sprintSawMovement = false;\n  playerSprinting = false;\n  refreshSprintButton();\n  if (changed) {\n    try { diagnostics.record('movement', 'Sprint/auto-run cancelled', { reason }, 'info'); } catch (_) {}\n  }\n  return movementModeStatus();\n}\n\nfunction setSprintMode(enabled, source = 'api') {\n  if (!enabled) return cancelMovementAssist(source);\n  if (freecamEnabled || !terrain || !engine) return movementModeStatus();\n  sprintEnabled = true;\n  autoRunEnabled = false;\n  sprintSawMovement = Math.abs(input.forward) + Math.abs(input.strafe) > .001;\n  refreshSprintButton();\n  try { diagnostics.record('movement', 'Sprint armed', { source }, 'info'); } catch (_) {}\n  return movementModeStatus();\n}\n\nfunction setAutoRunMode(enabled, source = 'api') {\n  if (!enabled) return cancelMovementAssist(source);\n  if (freecamEnabled || !terrain || !engine) return movementModeStatus();\n  sprintEnabled = true;\n  autoRunEnabled = true;\n  sprintSawMovement = true;\n  refreshSprintButton();\n  try { diagnostics.record('movement', 'Auto Run enabled', { source }, 'info'); } catch (_) {}\n  return movementModeStatus();\n}\n\nfunction toggleSprintMode(source = 'tap') {\n  if (sprintEnabled || autoRunEnabled) return cancelMovementAssist(source);\n  return setSprintMode(true, source);\n}\n\nwindow.IronvaleMovementMode = Object.freeze({\n  format: IRONVALE_MOVEMENT_MODE_FORMAT,\n  status: movementModeStatus,\n  setSprint: (enabled, source = 'api') => setSprintMode(Boolean(enabled), source),\n  toggleSprint: (source = 'api') => toggleSprintMode(source),\n  setAutoRun: (enabled, source = 'api') => setAutoRunMode(Boolean(enabled), source),\n  cancel: (reason = 'api') => cancelMovementAssist(reason)\n});`;
app = replaceOnce(app, playerApiAnchor, movementApi, 'movement runtime API');

app = replaceOnce(app,
"  input.forward = 0;\n  input.strafe = 0;\n  input.keys.clear();\n  joystickActive = false;\n  playerMoving = false;",
"  input.forward = 0;\n  input.strafe = 0;\n  input.keys.clear();\n  joystickActive = false;\n  cancelMovementAssist('player-restore');\n  playerMoving = false;",
'player restore cancels movement assist');

app = replaceOnce(app,
"diagnostics.registerProvider('native', level => terrain?.getNativeDiagnostics?.(level >= 3) || null);",
"diagnostics.registerProvider('native', level => terrain?.getNativeDiagnostics?.(level >= 3) || null);\ndiagnostics.registerProvider('movement-mode', () => movementModeStatus());",
'movement diagnostics provider');

app = replaceOnce(app,
"  joystickActive = false;\n  playerMoving = false;\n  player.x = values[0];",
"  joystickActive = false;\n  cancelMovementAssist('authoritative-correction');\n  playerMoving = false;\n  player.x = values[0];",
'correction cancels movement assist');

app = replaceOnce(app,
"setupCanvasControls();\nsetupJoystick();",
"setupCanvasControls();\nsetupJoystick();\nsetupSprintControl();",
'sprint control setup');

app = replaceOnce(app,
"window.addEventListener('blur', () => {\n  input.keys.clear();\n  freecamVertical = 0;\n  cancelGesture();\n});",
"window.addEventListener('blur', () => {\n  input.keys.clear();\n  freecamVertical = 0;\n  cancelMovementAssist('window-blur');\n  cancelGesture();\n});\ndocument.addEventListener('visibilitychange', () => { if (document.hidden) cancelMovementAssist('document-hidden'); });",
'background movement cancellation');

app = replaceOnce(app,
"    diagnosticCheck('character.visual', Boolean(playerMesh), playerCharacter?.meshes?.length ? 'Rigged visual active' : playerMesh ? 'Fallback/player visual active' : 'No player visual')",
"    diagnosticCheck('character.visual', Boolean(playerMesh), playerCharacter?.meshes?.length ? 'Rigged visual active' : playerMesh ? 'Fallback/player visual active' : 'No player visual'),\n    diagnosticCheck('player.movement-mode', Boolean(sprintButton) && typeof window.IronvaleMovementMode?.status === 'function', `walk ${WALK_SPEED_MPS}m/s · sprint ${SPRINT_SPEED_MPS}m/s · auto-run hold ${AUTO_RUN_HOLD_MS}ms`)",
'movement validator check');

app = replaceOnce(app,
"    player: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, vy: player.vy, grounded: player.grounded, moving: playerMoving },",
"    player: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, vy: player.vy, grounded: player.grounded, moving: playerMoving, sprinting: playerSprinting, sprintEnabled, autoRun: autoRunEnabled, movementSpeedMps: playerSprinting ? SPRINT_SPEED_MPS : playerMoving ? WALK_SPEED_MPS : 0 },",
'movement snapshot state');

app = replaceOnce(app,
"  playerMoving = false;\n  playerMesh = engine.addMesh(createCapsuleGeometry(),",
"  cancelMovementAssist('world-start');\n  playerMoving = false;\n  playerMesh = engine.addMesh(createCapsuleGeometry(),",
'world start reset');

app = replaceOnce(app,
"  playerRig = null;\n  playerMoving = false;\n  brushMesh = null;",
"  playerRig = null;\n  cancelMovementAssist('world-stop');\n  playerMoving = false;\n  brushMesh = null;",
'world stop reset');

app = replaceOnce(app,
"  const clip = (!freecamEnabled && playerMoving) ? asset.defaultClips.walk : asset.defaultClips.idle;",
"  const clip = (!freecamEnabled && playerMoving)\n    ? (playerSprinting ? (asset.defaultClips.run || asset.defaultClips.walk) : asset.defaultClips.walk)\n    : asset.defaultClips.idle;",
'run animation selection');

const oldUpdatePlayer = `function updatePlayer(dt) {\n  const moving = Math.abs(input.forward) + Math.abs(input.strafe) > .001;\n  playerMoving = moving;\n  if (moving) {\n    const basis = cameraGroundBasis(orbitCamera.yaw);\n    let dx = basis.forwardX * input.forward + basis.rightX * input.strafe;\n    let dz = basis.forwardZ * input.forward + basis.rightZ * input.strafe;\n    const length = Math.hypot(dx, dz) || 1;\n    dx /= length; dz /= length;\n    const speed = 7.2;`;
const newUpdatePlayer = `function updatePlayer(dt) {\n  const manualMoving = Math.abs(input.forward) + Math.abs(input.strafe) > .001;\n  if (sprintEnabled && !autoRunEnabled) {\n    if (manualMoving) sprintSawMovement = true;\n    else if (sprintSawMovement) cancelMovementAssist('movement-stopped');\n  }\n  const effectiveForward = autoRunEnabled ? 1 : input.forward;\n  const effectiveStrafe = input.strafe;\n  const moving = Math.abs(effectiveForward) + Math.abs(effectiveStrafe) > .001;\n  playerMoving = moving;\n  playerSprinting = moving && sprintEnabled;\n  if (moving) {\n    const basis = cameraGroundBasis(orbitCamera.yaw);\n    let dx = basis.forwardX * effectiveForward + basis.rightX * effectiveStrafe;\n    let dz = basis.forwardZ * effectiveForward + basis.rightZ * effectiveStrafe;\n    const length = Math.hypot(dx, dz) || 1;\n    dx /= length; dz /= length;\n    const speed = playerSprinting ? SPRINT_SPEED_MPS : WALK_SPEED_MPS;`;
app = replaceOnce(app, oldUpdatePlayer, newUpdatePlayer, 'player movement speed modes');

app = replaceOnce(app,
"  freecamEnabled = next;\n  freecamVertical = 0;",
"  if (next) cancelMovementAssist('freecam');\n  freecamEnabled = next;\n  freecamVertical = 0;",
'freecam cancels sprint');

const setupJoystickAnchor = `function moveAngleToward(current, target, maxDelta) {`;
const setupSprint = `function setupSprintControl() {\n  if (!sprintButton) return;\n  let pointerId = null;\n  let holdTimer = 0;\n  let longHoldActivated = false;\n\n  const clearHold = () => { clearTimeout(holdTimer); holdTimer = 0; };\n  sprintButton.addEventListener('pointerdown', event => {\n    if (freecamEnabled) return;\n    event.preventDefault();\n    event.stopPropagation();\n    pointerId = event.pointerId;\n    longHoldActivated = false;\n    try { sprintButton.setPointerCapture?.(pointerId); } catch (_) {}\n    clearHold();\n    holdTimer = setTimeout(() => {\n      if (pointerId !== event.pointerId) return;\n      longHoldActivated = true;\n      setAutoRunMode(true, 'sprint-long-hold');\n    }, AUTO_RUN_HOLD_MS);\n  });\n\n  const finish = (event, cancelled = false) => {\n    if (event.pointerId !== pointerId) return;\n    clearHold();\n    try { if (sprintButton.hasPointerCapture?.(event.pointerId)) sprintButton.releasePointerCapture?.(event.pointerId); } catch (_) {}\n    pointerId = null;\n    if (!cancelled && !longHoldActivated) toggleSprintMode('sprint-tap');\n    longHoldActivated = false;\n  };\n  sprintButton.addEventListener('pointerup', event => finish(event, false));\n  sprintButton.addEventListener('pointercancel', event => finish(event, true));\n  refreshSprintButton();\n}\n\n${setupJoystickAnchor}`;
app = replaceOnce(app, setupJoystickAnchor, setupSprint, 'sprint pointer control');

write('public/app.js', app);

let html = read('public/index.html');
html = replaceOnce(html,
`    <div id="joystick" class="joystick" aria-label="Movement control">\n      <div id="joystick-knob"></div>\n    </div>`,
`    <div id="joystick" class="joystick" aria-label="Movement control">\n      <div id="joystick-knob"></div>\n    </div>\n    <button id="sprint-button" class="sprint-button" type="button" aria-label="Sprint. Hold for Auto Run." aria-pressed="false">Sprint</button>`,
'sprint HUD button');
html = html.replace('/styles.css?v=20260901-diagnostics-r1', '/styles.css?v=20260901-sprint-autorun-r1');
html = html.replace('/app.js?v=20260901-realtime-10hz-r1', '/app.js?v=20260901-sprint-autorun-r1');
html = html.replace('/rift-auto-validation.js?v=20260901-realtime-10hz-r1', '/rift-auto-validation.js?v=20260901-sprint-autorun-r1');
write('public/index.html', html);

let css = read('public/styles.css');
css = replaceOnce(css,
`.joystick>div{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px;border:1px solid #ffffff28;border-radius:50%;background:#d9eee030;transform:translate(0,0)}\n.freecam-altitude`,
`.joystick>div{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px;border:1px solid #ffffff28;border-radius:50%;background:#d9eee030;transform:translate(0,0)}\n.sprint-button{position:absolute;z-index:23;left:max(142px,calc(env(safe-area-inset-left) + 132px));bottom:max(34px,calc(env(safe-area-inset-bottom) + 26px));width:72px;height:72px;border:1px solid #ffffff2b;border-radius:50%;background:#132219d9;color:#f1f7f2;font-size:11px;font-weight:900;letter-spacing:.01em;box-shadow:0 6px 20px #0005;backdrop-filter:blur(8px);touch-action:none}\n.sprint-button.active{background:#2d5a39;border-color:#8bd39a}\n.sprint-button.auto-run{background:#72511e;border-color:#f0c46c;color:#fff0bd}\n#world-screen.freecam .sprint-button{display:none!important}\n.freecam-altitude`,
'sprint HUD styles');
css = css.replace(`@media(pointer:fine){\n  .joystick{opacity:.42}\n}`, `@media(pointer:fine){\n  .joystick{opacity:.42}\n  .sprint-button{opacity:.62}\n}`);
css = css.replace(`  .joystick{width:104px;height:104px;left:max(16px,env(safe-area-inset-left));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px))}\n  .freecam-altitude`, `  .joystick{width:104px;height:104px;left:max(16px,env(safe-area-inset-left));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px))}\n  .sprint-button{left:max(126px,calc(env(safe-area-inset-left) + 116px));bottom:max(24px,calc(env(safe-area-inset-bottom) + 18px));width:66px;height:66px;font-size:10px}\n  .freecam-altitude`);
css = css.replace(`  .joystick{width:100px;height:100px;left:max(16px,env(safe-area-inset-left));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px))}\n  .joystick>div`, `  .joystick{width:100px;height:100px;left:max(16px,env(safe-area-inset-left));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px))}\n  .sprint-button{left:max(124px,calc(env(safe-area-inset-left) + 114px));bottom:max(24px,calc(env(safe-area-inset-bottom) + 18px));width:64px;height:64px}\n  .joystick>div`);
write('public/styles.css', css);

let worker = read('src/realtime-entry.js');
worker = replaceOnce(worker, 'const MAX_HORIZONTAL_SPEED_MPS = 7.2;', 'const MAX_HORIZONTAL_SPEED_MPS = 10.8;', 'server sprint speed authority');
write('src/realtime-entry.js', worker);

let auto = read('public/rift-auto-validation.js');
const realtimeStepAnchor = `    await runStep('realtime movement + checkpoint path', async () => {`;
const sprintStep = `    await runStep('sprint + auto run controls', async () => {\n      const movement = window.IronvaleMovementMode;\n      const button = required('#sprint-button', 'Sprint button');\n      if (!movement?.status || !movement?.cancel) throw new Error('Movement mode runtime unavailable');\n      if ($('#freecam-button')?.classList.contains('active')) $('#freecam-button').click();\n      movement.cancel('validator-start');\n\n      const dispatch = (type, pointerId) => button.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerdown' ? 1 : 0 }));\n      dispatch('pointerdown', 9321);\n      await sleep(90);\n      dispatch('pointerup', 9321);\n      await sleep(60);\n      if (!movement.status().sprintEnabled || movement.status().autoRun) throw new Error('Tap did not arm sprint');\n\n      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));\n      await sleep(180);\n      if (!movement.status().sprinting) throw new Error('Sprint did not activate while moving');\n      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));\n      await sleep(90);\n      if (movement.status().sprintEnabled) throw new Error('Sprint did not cancel when movement stopped');\n\n      dispatch('pointerdown', 9322);\n      await sleep(520);\n      if (!movement.status().autoRun || !movement.status().sprinting) throw new Error('Long hold did not activate Auto Run');\n      dispatch('pointerup', 9322);\n      await sleep(90);\n      if (!movement.status().autoRun) throw new Error('Auto Run did not stay latched after long hold release');\n\n      dispatch('pointerdown', 9323);\n      await sleep(70);\n      dispatch('pointerup', 9323);\n      await sleep(80);\n      if (movement.status().autoRun || movement.status().sprintEnabled) throw new Error('Tap did not cancel Auto Run');\n      return 'tap sprint + stop-to-cancel + ' + movement.status().autoRunHoldMs + 'ms hold Auto Run path exercised';\n    });\n\n${realtimeStepAnchor}`;
auto = replaceOnce(auto, realtimeStepAnchor, sprintStep, 'auto validator sprint step');
auto = auto.replace('      exercisesDirectRealtimePublisher: true,', '      exercisesSprintAndAutoRun: true,\n      exercisesDirectRealtimePublisher: true,');
write('public/rift-auto-validation.js', auto);

let check = read('scripts/check-realtime-state.mjs');
check = check.replace("const html = read('public/index.html');", "const html = read('public/index.html');\nconst styles = read('public/styles.css');");
check = check.replace("/MAX_HORIZONTAL_SPEED_MPS\\s*=\\s*7\\.2/", "/MAX_HORIZONTAL_SPEED_MPS\\s*=\\s*10\\.8/");
check = replaceOnce(check,
"requireMatch(app, /ironvale:movement-correction/, 'app consumes authoritative corrections');",
"requireMatch(app, /ironvale:movement-correction/, 'app consumes authoritative corrections');\nrequireMatch(app, /WALK_SPEED_MPS\\s*=\\s*7\\.2/, 'walk speed contract');\nrequireMatch(app, /SPRINT_SPEED_MPS\\s*=\\s*10\\.8/, 'sprint speed contract');\nrequireMatch(app, /AUTO_RUN_HOLD_MS\\s*=\\s*450/, 'mobile auto-run long-hold threshold');\nrequireMatch(app, /function setupSprintControl\\(/, 'mobile sprint pointer control');\nrequireMatch(app, /autoRunEnabled \\? 1 : input\\.forward/, 'auto-run forward movement source');\nrequireMatch(app, /movement-stopped/, 'tap sprint cancels after movement stops');\nrequireMatch(app, /asset\\.defaultClips\\.run \\|\\| asset\\.defaultClips\\.walk/, 'run animation with walk fallback');\nrequireMatch(html, /id=\"sprint-button\"/, 'sprint HUD button');\nrequireMatch(styles, /\\.sprint-button\\.auto-run/, 'Auto Run HUD state');",
'static sprint contract checks');
check = replaceOnce(check,
"requireMatch(auto, /Direct 10Hz publisher only emitted/, 'auto validator verifies packet cadence path');",
"requireMatch(auto, /sprint \\+ auto run controls/, 'auto validator exercises sprint and Auto Run');\nrequireMatch(auto, /Long hold did not activate Auto Run/, 'auto validator checks long-hold Auto Run');\nrequireMatch(auto, /Direct 10Hz publisher only emitted/, 'auto validator verifies packet cadence path');",
'auto sprint verification');
write('scripts/check-realtime-state.mjs', check);

console.log('Installed mobile tap-to-sprint, stop-to-cancel sprint, long-hold Auto Run, sprint animation selection, diagnostics, validator coverage, and 10.8m/s server authority.');
