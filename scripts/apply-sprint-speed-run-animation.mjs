import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const replaceOnce = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(before, after);
};

// App: make sprint visibly faster and load the updated character mapping.
{
  const path = 'public/app.js';
  let source = read(path);
  source = replaceOnce(source,
    "import { loadRiggedCharacterAsset } from './rift-character.js?v=20260901-scale-contract-r1';",
    "import { loadRiggedCharacterAsset } from './rift-character.js?v=20260901-run-animation-r1';",
    'character runtime cache version');
  source = replaceOnce(source,
    "const APP_DIAGNOSTIC_BUILD = '20260901-sprint-autorun-r1';",
    "const APP_DIAGNOSTIC_BUILD = '20260901-sprint-speed-r2';",
    'app diagnostic build');
  source = replaceOnce(source,
    'const SPRINT_SPEED_MPS = 10.8;',
    'const SPRINT_SPEED_MPS = 12;',
    'sprint speed');
  source = replaceOnce(source,
    '    sprintSpeedMps: SPRINT_SPEED_MPS,\n    sprintEnabled,',
    '    sprintSpeedMps: SPRINT_SPEED_MPS,\n    sprintSpeedRatio: Math.round((SPRINT_SPEED_MPS / WALK_SPEED_MPS) * 100) / 100,\n    sprintEnabled,',
    'sprint speed ratio telemetry');
  write(path, source);
}

// Character: map a real run/sprint clip separately from walking.
{
  const path = 'public/rift-character.js';
  let source = read(path);
  source = replaceOnce(source,
    "  const idle = chooseClip(clipNames, [/^idle_loop$/i, /^idle$/i, /^idle_/i, /stand/i], clipNames[0] || null);\n  const walk = chooseClip(clipNames, [/^walk_loop$/i, /^walk$/i, /^walk_/i, /walking/i, /run/i], idle);\n  const runtime = new RiftCharacterRuntime(modelParsed.document, skins, clips);",
    "  const idle = chooseClip(clipNames, [/^idle_loop$/i, /^idle$/i, /^idle_/i, /stand/i], clipNames[0] || null);\n  const walk = chooseClip(clipNames, [/^walk_loop$/i, /^walk$/i, /^walk_/i, /walking/i], idle);\n  const run = chooseClip(clipNames, [/^run_loop$/i, /^run$/i, /^run[_ -]/i, /running/i, /sprint/i, /run/i], null);\n  const runtime = new RiftCharacterRuntime(modelParsed.document, skins, clips);",
    'separate run clip mapping');
  source = replaceOnce(source,
    '    defaultClips: { idle, walk },',
    '    defaultClips: { idle, walk, run },',
    'default locomotion clips');
  source = replaceOnce(source,
    "      feetAtY: built.bounds.minY * built.renderScale, sourceHeight: built.sourceHeight, renderHeight: TARGET_HEIGHT, renderScale: built.renderScale,\n      textured: textureIndices.length > 0, animationClipCount: clipNames.length, animationReady: clipNames.length > 0",
    "      feetAtY: built.bounds.minY * built.renderScale, sourceHeight: built.sourceHeight, renderHeight: TARGET_HEIGHT, renderScale: built.renderScale,\n      defaultClips: { idle, walk, run },\n      textured: textureIndices.length > 0, animationClipCount: clipNames.length, animationReady: clipNames.length > 0",
    'rig locomotion diagnostics');
  write(path, source);
}

// Server authority must allow the same sprint speed the client actually applies.
{
  const path = 'src/realtime-entry.js';
  let source = read(path);
  source = replaceOnce(source, 'const MAX_HORIZONTAL_SPEED_MPS = 10.8;', 'const MAX_HORIZONTAL_SPEED_MPS = 12;', 'server sprint authority');
  write(path, source);
}

// Auto validation: measure equal-time displacement instead of merely checking a boolean sprint state.
{
  const path = 'public/rift-auto-validation.js';
  let source = read(path);
  const startMarker = "    await runStep('sprint + auto run controls', async () => {";
  const endMarker = "\n\n    await runStep('realtime movement + checkpoint path'";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Missing sprint auto-validation block');
  const block = `    await runStep('sprint + auto run controls', async () => {\n      const movement = window.IronvaleMovementMode;\n      const playerState = window.IronvalePlayerState;\n      const button = required('#sprint-button', 'Sprint button');\n      if (!movement?.status || !movement?.cancel) throw new Error('Movement mode runtime unavailable');\n      if (!playerState?.status) throw new Error('Player state runtime unavailable');\n      if ($('#freecam-button')?.classList.contains('active')) $('#freecam-button').click();\n      movement.cancel('validator-start');\n\n      const dispatch = (type, pointerId) => button.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerdown' ? 1 : 0 }));\n      const position = () => playerState.status();\n      const horizontalDistance = (a, b) => Math.hypot(Number(b.x) - Number(a.x), Number(b.z) - Number(a.z));\n\n      const walkStart = position();\n      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));\n      await sleep(320);\n      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));\n      await sleep(90);\n      const walkEnd = position();\n      const walkDistance = horizontalDistance(walkStart, walkEnd);\n      if (walkDistance < 0.5) throw new Error('Walk displacement was too small to validate sprint speed');\n\n      dispatch('pointerdown', 9321);\n      await sleep(90);\n      dispatch('pointerup', 9321);\n      await sleep(60);\n      if (!movement.status().sprintEnabled || movement.status().autoRun) throw new Error('Tap did not arm sprint');\n\n      const sprintStart = position();\n      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));\n      await sleep(320);\n      if (!movement.status().sprinting) throw new Error('Sprint did not activate while moving');\n      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));\n      await sleep(90);\n      const sprintEnd = position();\n      const sprintDistance = horizontalDistance(sprintStart, sprintEnd);\n      const sprintRatio = sprintDistance / Math.max(0.001, walkDistance);\n      if (sprintRatio < 1.35) throw new Error('Sprint displacement ratio ' + sprintRatio.toFixed(2) + 'x is not meaningfully faster than walk');\n      if (movement.status().sprintEnabled) throw new Error('Sprint did not cancel when movement stopped');\n\n      dispatch('pointerdown', 9322);\n      await sleep(520);\n      if (!movement.status().autoRun || !movement.status().sprinting) throw new Error('Long hold did not activate Auto Run');\n      dispatch('pointerup', 9322);\n      await sleep(90);\n      if (!movement.status().autoRun) throw new Error('Auto Run did not stay latched after long hold release');\n\n      dispatch('pointerdown', 9323);\n      await sleep(70);\n      dispatch('pointerup', 9323);\n      await sleep(80);\n      if (movement.status().autoRun || movement.status().sprintEnabled) throw new Error('Tap did not cancel Auto Run');\n      return 'walk=' + walkDistance.toFixed(2) + 'm · sprint=' + sprintDistance.toFixed(2) + 'm · ratio=' + sprintRatio.toFixed(2) + 'x · ' + movement.status().autoRunHoldMs + 'ms Auto Run hold';\n    });`;
  source = source.slice(0, start) + block + source.slice(end);
  write(path, source);
}

// Guard: require a distinct run clip at runtime when the rigged character is active.
{
  const path = 'public/rift-validator-guard.js';
  let source = read(path);
  const marker = "  checks.push(statusCheck('character.rig-runtime', rigOk ? 'pass' : 'fail', character.rigged ? `${character.rig?.jointCount || 0} joints · ${character.rig?.animationClipCount || 0} clips` : 'Capsule fallback active'));";
  const addition = marker + "\n  if (character.rigged) {\n    const walkClip = character.rig?.defaultClips?.walk || null;\n    const runClip = character.rig?.defaultClips?.run || null;\n    const runOk = Boolean(runClip && runClip !== walkClip);\n    checks.push(statusCheck('character.run-animation', runOk ? 'pass' : 'fail', runOk ? `Run clip=${runClip} · walk clip=${walkClip || 'none'}` : `Distinct run animation unavailable · walk=${walkClip || 'none'} run=${runClip || 'none'}`));\n  }";
  source = replaceOnce(source, marker, addition, 'runtime run-animation guard');
  write(path, source);
}

// Character audit should describe the actual locomotion contract.
{
  const path = 'public/assets/characters/quaternius/character-audit.json';
  const audit = JSON.parse(read(path));
  audit.runtime.locomotion = ['idle', 'walk', 'run'];
  audit.runtime.runClipRequired = true;
  write(path, JSON.stringify(audit, null, 2) + '\n');
}

// Cache-bust the changed modules.
{
  const path = 'public/index.html';
  let source = read(path);
  source = replaceOnce(source, '/app.js?v=20260901-sprint-autorun-r1', '/app.js?v=20260901-sprint-speed-r2', 'app cache version');
  source = replaceOnce(source, '/rift-validator-guard.js?v=20260901-reconnect-grace-r1', '/rift-validator-guard.js?v=20260901-sprint-speed-r2', 'validator cache version');
  source = replaceOnce(source, '/rift-auto-validation.js?v=20260901-sprint-autorun-r1', '/rift-auto-validation.js?v=20260901-sprint-speed-r2', 'auto validator cache version');
  write(path, source);
}

// Static contract: lock the real speed, real run mapping, and measured displacement test into CI.
{
  const path = 'scripts/check-realtime-state.mjs';
  let source = read(path);
  source = replaceOnce(source,
    "const app = read('public/app.js');\nconst auto = read('public/rift-auto-validation.js');",
    "const app = read('public/app.js');\nconst character = read('public/rift-character.js');\nconst auto = read('public/rift-auto-validation.js');",
    'character verifier source');
  source = replaceOnce(source,
    "requireMatch(worker, /MAX_HORIZONTAL_SPEED_MPS\\s*=\\s*10\\.8/, 'movement speed authority matches runtime');",
    "requireMatch(worker, /MAX_HORIZONTAL_SPEED_MPS\\s*=\\s*12/, 'movement speed authority matches runtime');",
    'server sprint verifier');
  source = replaceOnce(source,
    "requireMatch(app, /SPRINT_SPEED_MPS\\s*=\\s*10\\.8/, 'sprint speed contract');",
    "requireMatch(app, /SPRINT_SPEED_MPS\\s*=\\s*12/, 'sprint speed contract');",
    'client sprint verifier');
  source = replaceOnce(source,
    "requireMatch(app, /asset\\.defaultClips\\.run \\|\\| asset\\.defaultClips\\.walk/, 'run animation with walk fallback');",
    "requireMatch(app, /asset\\.defaultClips\\.run \\|\\| asset\\.defaultClips\\.walk/, 'run animation with walk fallback');\nrequireMatch(character, /const run = chooseClip\\(clipNames,[\\s\\S]*?\\/sprint\\/i,[\\s\\S]*?\\/run\\/i/, 'dedicated run clip mapping');\nrequireMatch(character, /defaultClips:\\s*\\{ idle, walk, run \\}/, 'run clip exposed to locomotion runtime');",
    'run animation verifier');
  source = replaceOnce(source,
    "requireMatch(auto, /Long hold did not activate Auto Run/, 'auto validator checks long-hold Auto Run');",
    "requireMatch(auto, /Long hold did not activate Auto Run/, 'auto validator checks long-hold Auto Run');\nrequireMatch(auto, /Sprint displacement ratio/, 'auto validator measures walk versus sprint displacement');\nrequireMatch(auto, /sprintRatio < 1\\.35/, 'auto validator enforces meaningful sprint speed gain');",
    'measured sprint verifier');
  write(path, source);
}

console.log('Applied real sprint speed + run animation patch.');
