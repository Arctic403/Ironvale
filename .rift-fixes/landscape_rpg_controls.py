from pathlib import Path

BUILD = '20260831-landscape-rpg-r1'


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old, new, 1)

# ---- public/app.js ---------------------------------------------------------
path = Path('public/app.js')
app = path.read_text(encoding='utf-8')

app = replace_once(app,
"const reticle = $('#terrain-reticle');\nconst altitudeControls = $('#freecam-altitude');",
"const reticle = $('#terrain-reticle');\nconst altitudeControls = $('#freecam-altitude');\nconst combatHud = $('#combat-hud');\nconst targetPill = $('#target-pill');\nconst targetName = $('#target-name');\nconst lockTargetButton = $('#lock-target-button');\nconst basicAttackButton = $('#basic-attack-button');\nconst lookHint = $('.look-hint');",
'dom combat hud')

app = replace_once(app,
"const FREECAM_MIN_PITCH = -1.45;\nconst FREECAM_MAX_PITCH = 1.45;",
"const FREECAM_MIN_PITCH = -1.45;\nconst FREECAM_MAX_PITCH = 1.45;\nconst MOBILE_LANDSCAPE_DISTANCE = 6.2;\nconst MOBILE_LANDSCAPE_FOV = 55 * Math.PI / 180;\nconst MOBILE_LANDSCAPE_PITCH = .34;\nconst DEFAULT_ORBIT_DISTANCE = 8.0;\nconst TARGET_TAP_MAX_MS = 260;\nconst TARGET_TAP_MAX_PX = 9;\nconst TARGET_PICK_MAX_DISTANCE = 80;\nconst AUTO_ATTACK_RANGE = 5.5;",
'landscape and target constants')

app = replace_once(app,
"let freecamVertical = 0;\nlet joystickActive = false;",
"let freecamVertical = 0;\nlet joystickActive = false;\nlet selectedTargetId = null;\nlet hardLockEnabled = false;\nlet viewportCameraProfile = '';\nconst combatTargets = new Map();",
'combat state')

app = replace_once(app,
"const orbitCamera = { yaw: Math.PI, pitch: .34, distance: 9.5, fov: Math.PI / 3 };",
"const orbitCamera = { yaw: Math.PI, pitch: .34, distance: DEFAULT_ORBIT_DISTANCE, fov: Math.PI / 3 };",
'orbit default distance')

app = replace_once(app,
"$('#terrain-tools-button').addEventListener('click', () => { tools.hidden = !tools.hidden; });\nfreecamButton.addEventListener('click', () => setFreecam(!freecamEnabled));",
"$('#terrain-tools-button').addEventListener('click', () => { tools.hidden = !tools.hidden; });\nfreecamButton.addEventListener('click', () => setFreecam(!freecamEnabled));\nlockTargetButton.addEventListener('click', () => setHardLock(!hardLockEnabled));\nbasicAttackButton.addEventListener('click', performBasicAttack);\ndocument.querySelectorAll('[data-ability-slot]').forEach(button => button.addEventListener('click', () => triggerAbility(Number(button.dataset.abilitySlot) || 0, button)));",
'combat button listeners')

app = replace_once(app,
"window.addEventListener('pagehide', () => savePosition(true));\nwindow.addEventListener('beforeunload', () => savePosition(true));",
"window.addEventListener('pagehide', () => savePosition(true));\nwindow.addEventListener('beforeunload', () => savePosition(true));\nwindow.addEventListener('resize', () => applyViewportCameraProfile());\nwindow.visualViewport?.addEventListener('resize', () => applyViewportCameraProfile());",
'camera viewport listeners')

app = replace_once(app,
"  snapPlayerToSupport();\n  void installRiggedPlayerVisual();\n  updateOrbitCamera();\n  reticle.hidden = false;\n  updateReticleVisual();\n  updateReticleTarget();",
"  snapPlayerToSupport();\n  void installRiggedPlayerVisual();\n  applyViewportCameraProfile(true);\n  updateOrbitCamera();\n  reticle.hidden = true;\n  combatHud.hidden = false;\n  refreshCombatHud();\n  updateReticleVisual();\n  updateReticleTarget();",
'start world gameplay hud')

app = replace_once(app,
"  freecamEnabled = false;\n  freecamVertical = 0;\n  worldScreen.classList.remove('freecam');",
"  freecamEnabled = false;\n  freecamVertical = 0;\n  selectedTargetId = null;\n  hardLockEnabled = false;\n  viewportCameraProfile = '';\n  worldScreen.classList.remove('freecam');",
'stop world target reset')

app = replace_once(app,
"  reticle.hidden = true;\n  altitudeControls.hidden = true;\n  brushReadout.hidden = true;\n  worldScreen.hidden = true;",
"  reticle.hidden = true;\n  altitudeControls.hidden = true;\n  brushReadout.hidden = true;\n  combatHud.hidden = true;\n  refreshCombatHud();\n  worldScreen.hidden = true;",
'stop world combat hud')

app = replace_once(app,
"  updatePlayerCharacterAnimation(dt);\n  updateCamera();",
"  updatePlayerCharacterAnimation(dt);\n  if (!freecamEnabled) updateHardLockCamera(dt);\n  updateCamera();",
'hard lock camera frame')

app = replace_once(app,
"function updateCamera() {",
"function isMobileLandscapeGameplay() {\n  return window.matchMedia?.('(pointer: coarse)').matches === true && window.innerWidth > window.innerHeight;\n}\n\nfunction applyViewportCameraProfile(force = false) {\n  const profile = isMobileLandscapeGameplay() ? 'mobile-landscape' : 'default';\n  if (!force && profile === viewportCameraProfile) return;\n  viewportCameraProfile = profile;\n  if (profile === 'mobile-landscape') {\n    orbitCamera.distance = MOBILE_LANDSCAPE_DISTANCE;\n    orbitCamera.fov = MOBILE_LANDSCAPE_FOV;\n    orbitCamera.pitch = MOBILE_LANDSCAPE_PITCH;\n  } else {\n    orbitCamera.distance = DEFAULT_ORBIT_DISTANCE;\n    orbitCamera.fov = Math.PI / 3;\n    orbitCamera.pitch = .34;\n  }\n  if (engine && !freecamEnabled) updateOrbitCamera();\n}\n\nfunction updateCamera() {",
'viewport camera profile')

app = replace_once(app,
"  reticle.hidden = false;\n  altitudeControls.hidden = !freecamEnabled;\n  brushReadout.hidden = !freecamEnabled;",
"  reticle.hidden = !freecamEnabled;\n  altitudeControls.hidden = !freecamEnabled;\n  brushReadout.hidden = !freecamEnabled;\n  combatHud.hidden = freecamEnabled;\n  if (freecamEnabled) hardLockEnabled = false;\n  refreshCombatHud();\n  lookHint.textContent = freecamEnabled\n    ? 'Swipe: look · center reticle: terrain tools'\n    : 'Swipe: look · tap enemy: target';",
'freecam versus gameplay ui')

app = replace_once(app,
"  let orbitPointerId = null;\n  let orbitLastX = 0;\n  let orbitLastY = 0;",
"  let orbitPointerId = null;\n  let orbitLastX = 0;\n  let orbitLastY = 0;\n  let orbitDownX = 0;\n  let orbitDownY = 0;\n  let orbitDownAt = 0;\n  let orbitTravel = 0;\n  let orbitLooking = false;",
'orbit tap state')

app = replace_once(app,
"      orbitPointerId = event.pointerId;\n      orbitLastX = event.clientX;\n      orbitLastY = event.clientY;\n      canvas.setPointerCapture(event.pointerId);",
"      orbitPointerId = event.pointerId;\n      orbitLastX = orbitDownX = event.clientX;\n      orbitLastY = orbitDownY = event.clientY;\n      orbitDownAt = performance.now();\n      orbitTravel = 0;\n      orbitLooking = false;\n      canvas.setPointerCapture(event.pointerId);",
'orbit pointerdown targeting')

app = replace_once(app,
"      const dx = event.clientX - orbitLastX;\n      const dy = event.clientY - orbitLastY;\n      orbitLastX = event.clientX;\n      orbitLastY = event.clientY;\n      applyCameraLookDelta(orbitCamera, dx, dy, ORBIT_MIN_PITCH, ORBIT_MAX_PITCH);\n      return;",
"      const dx = event.clientX - orbitLastX;\n      const dy = event.clientY - orbitLastY;\n      orbitLastX = event.clientX;\n      orbitLastY = event.clientY;\n      orbitTravel += Math.hypot(dx, dy);\n      if (!orbitLooking && orbitTravel > LOOK_START_PX) orbitLooking = true;\n      if (orbitLooking) applyCameraLookDelta(orbitCamera, dx, dy, ORBIT_MIN_PITCH, ORBIT_MAX_PITCH);\n      return;",
'orbit pointermove tap threshold')

app = replace_once(app,
"    if (!freecamEnabled) {\n      if (event.pointerId === orbitPointerId) orbitPointerId = null;\n      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);\n      return;\n    }",
"    if (!freecamEnabled) {\n      if (event.pointerId !== orbitPointerId) return;\n      const duration = performance.now() - orbitDownAt;\n      const displacement = Math.hypot(event.clientX - orbitDownX, event.clientY - orbitDownY);\n      if (!orbitLooking && duration <= TARGET_TAP_MAX_MS && displacement <= TARGET_TAP_MAX_PX) {\n        selectCombatTargetAtScreen(event.clientX, event.clientY);\n      }\n      orbitPointerId = null;\n      orbitLooking = false;\n      orbitTravel = 0;\n      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);\n      return;\n    }",
'orbit pointerup target tap')

app = replace_once(app,
"  canvas.addEventListener('pointercancel', event => {\n    if (event.pointerId === orbitPointerId) orbitPointerId = null;",
"  canvas.addEventListener('pointercancel', event => {\n    if (event.pointerId === orbitPointerId) { orbitPointerId = null; orbitLooking = false; orbitTravel = 0; }",
'orbit pointer cancel')

app = replace_once(app,
"function updateReticleTarget() {\n  if (!terrain || !engine) {",
"function updateReticleTarget() {\n  if (!freecamEnabled) {\n    reticleHit = null;\n    reticle.classList.remove('no-hit');\n    if (brushMesh) brushMesh.visible = false;\n    return;\n  }\n  if (!terrain || !engine) {",
'freecam-only visible reticle target')

combat_code = r'''

function screenPointRay(clientX, clientY) {
  if (!engine) return null;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const nx = ((clientX - rect.left) / width) * 2 - 1;
  const ny = 1 - ((clientY - rect.top) / height) * 2;
  const forward = normalize3(
    lastCameraTarget[0] - lastCameraPosition[0],
    lastCameraTarget[1] - lastCameraPosition[1],
    lastCameraTarget[2] - lastCameraPosition[2]
  );
  const right = normalize3(...cross3(forward, [0, 1, 0]));
  const up = normalize3(...cross3(right, forward));
  const fov = Number(freecamEnabled ? freecam.fov : orbitCamera.fov) || Math.PI / 3;
  const tan = Math.tan(fov * .5);
  const aspect = width / height;
  const direction = normalize3(
    forward[0] + right[0] * nx * tan * aspect + up[0] * ny * tan,
    forward[1] + right[1] * nx * tan * aspect + up[1] * ny * tan,
    forward[2] + right[2] * nx * tan * aspect + up[2] * ny * tan
  );
  return { origin: [...lastCameraPosition], direction };
}

function targetWorldPosition(target) {
  if (!target) return null;
  let source = typeof target.getPosition === 'function' ? target.getPosition() : target.position;
  if (!source) return null;
  if (Array.isArray(source)) {
    const x = Number(source[0]), y = Number(source[1]), z = Number(source[2]);
    return [x, y, z].every(Number.isFinite) ? [x, y, z] : null;
  }
  const x = Number(source.x), y = Number(source.y), z = Number(source.z);
  return [x, y, z].every(Number.isFinite) ? [x, y, z] : null;
}

function raySphereDistance(ray, center, radius) {
  const ox = ray.origin[0] - center[0];
  const oy = ray.origin[1] - center[1];
  const oz = ray.origin[2] - center[2];
  const b = ox * ray.direction[0] + oy * ray.direction[1] + oz * ray.direction[2];
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const near = -b - root;
  if (near >= 0) return near;
  const far = -b + root;
  return far >= 0 ? far : null;
}

function registerCombatTarget(id, descriptor = {}) {
  const key = String(id || '').trim();
  if (!key) throw new Error('Combat target id is required.');
  combatTargets.set(key, {
    ...descriptor,
    id: key,
    name: String(descriptor.name || key),
    radius: Math.max(.25, Number(descriptor.radius) || 1),
    enabled: descriptor.enabled !== false
  });
  refreshCombatHud();
  return () => unregisterCombatTarget(key);
}

function unregisterCombatTarget(id) {
  const key = String(id || '');
  combatTargets.delete(key);
  if (selectedTargetId === key) clearCombatTarget();
}

function selectedCombatTarget() {
  const target = selectedTargetId ? combatTargets.get(selectedTargetId) : null;
  if (!target || target.enabled === false || !targetWorldPosition(target)) return null;
  return target;
}

function setSelectedCombatTarget(target) {
  selectedTargetId = target?.id && combatTargets.has(target.id) ? target.id : null;
  if (!selectedTargetId) hardLockEnabled = false;
  refreshCombatHud();
  window.dispatchEvent(new CustomEvent('ironvale:target-changed', { detail: { targetId: selectedTargetId, target: selectedCombatTarget() } }));
}

function clearCombatTarget() {
  setSelectedCombatTarget(null);
}

function pickCombatTargetAtScreen(clientX, clientY) {
  const ray = screenPointRay(clientX, clientY);
  if (!ray) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const target of combatTargets.values()) {
    if (target.enabled === false) continue;
    const center = targetWorldPosition(target);
    if (!center) continue;
    const hitDistance = raySphereDistance(ray, center, target.radius);
    const maxDistance = Math.max(1, Number(target.maxTargetDistance) || TARGET_PICK_MAX_DISTANCE);
    if (hitDistance == null || hitDistance > maxDistance || hitDistance >= bestDistance) continue;
    best = target;
    bestDistance = hitDistance;
  }
  return best;
}

function selectCombatTargetAtScreen(clientX, clientY) {
  if (freecamEnabled) return null;
  const target = pickCombatTargetAtScreen(clientX, clientY);
  setSelectedCombatTarget(target);
  return target;
}

function findAutoAttackTarget() {
  const basis = cameraGroundBasis(orbitCamera.yaw);
  let best = null;
  let bestScore = Infinity;
  for (const target of combatTargets.values()) {
    if (target.enabled === false) continue;
    const position = targetWorldPosition(target);
    if (!position) continue;
    const dx = position[0] - player.x;
    const dz = position[2] - player.z;
    const distance = Math.hypot(dx, dz);
    const range = Math.max(1, Number(target.autoAttackRange) || AUTO_ATTACK_RANGE);
    if (distance > range || distance < .001) continue;
    const facing = (dx / distance) * basis.forwardX + (dz / distance) * basis.forwardZ;
    if (facing < .1) continue;
    const score = distance - facing * 1.5;
    if (score < bestScore) { best = target; bestScore = score; }
  }
  return best;
}

function facePlayerTowardTarget(target) {
  const position = targetWorldPosition(target);
  if (!position) return;
  const dx = position[0] - player.x;
  const dz = position[2] - player.z;
  if (Math.hypot(dx, dz) < .001) return;
  player.yaw = Math.atan2(dx, dz);
  updatePlayerVisualTransform();
}

function setHardLock(enabled) {
  hardLockEnabled = Boolean(enabled) && Boolean(selectedCombatTarget()) && !freecamEnabled;
  refreshCombatHud();
}

function updateHardLockCamera(dt) {
  if (!hardLockEnabled || freecamEnabled) return;
  const target = selectedCombatTarget();
  const position = targetWorldPosition(target);
  if (!target || !position) { setHardLock(false); return; }
  const dx = position[0] - player.x;
  const dz = position[2] - player.z;
  const distance = Math.hypot(dx, dz);
  if (distance > TARGET_PICK_MAX_DISTANCE || distance < .001) { setHardLock(false); return; }
  const desiredYaw = cameraAnglesFromDirection([dx, 0, dz]).yaw;
  orbitCamera.yaw = moveAngleToward(orbitCamera.yaw, desiredYaw, Math.max(.01, dt) * 7.5);
  player.yaw = Math.atan2(dx, dz);
  updatePlayerVisualTransform();
}

function performBasicAttack() {
  if (freecamEnabled) return;
  let target = selectedCombatTarget();
  if (!target) {
    target = findAutoAttackTarget();
    if (target) setSelectedCombatTarget(target);
  }
  if (!target) {
    flashTargetStatus('No target nearby');
    pulseCombatButton(basicAttackButton);
    return;
  }
  facePlayerTowardTarget(target);
  pulseCombatButton(basicAttackButton);
  window.dispatchEvent(new CustomEvent('ironvale:basic-attack', { detail: { targetId: target.id, target } }));
}

function triggerAbility(slot, button) {
  if (freecamEnabled || !slot) return;
  const target = selectedCombatTarget();
  if (!target) {
    flashTargetStatus('Tap a target first');
    pulseCombatButton(button);
    return;
  }
  facePlayerTowardTarget(target);
  pulseCombatButton(button);
  window.dispatchEvent(new CustomEvent('ironvale:ability', { detail: { slot, targetId: target.id, target } }));
}

function refreshCombatHud() {
  if (!targetName || !lockTargetButton || !targetPill) return;
  const target = selectedCombatTarget();
  targetName.textContent = target?.name || 'No target';
  targetPill.classList.toggle('active', Boolean(target));
  lockTargetButton.disabled = !target || freecamEnabled;
  lockTargetButton.classList.toggle('active', Boolean(target && hardLockEnabled));
  lockTargetButton.textContent = hardLockEnabled && target ? 'Locked' : 'Lock';
}

function flashTargetStatus(message) {
  if (!targetName) return;
  targetName.textContent = message;
  setTimeout(refreshCombatHud, 850);
}

function pulseCombatButton(button) {
  if (!button) return;
  button.classList.remove('pressed');
  void button.offsetWidth;
  button.classList.add('pressed');
  setTimeout(() => button.classList.remove('pressed'), 140);
}

window.IronvaleTargeting = Object.freeze({
  register: registerCombatTarget,
  unregister: unregisterCombatTarget,
  select: id => setSelectedCombatTarget(combatTargets.get(String(id || '')) || null),
  clear: clearCombatTarget,
  getSelected: selectedCombatTarget
});
'''

app = replace_once(app,
"function captureTerrainState() {",
combat_code + "\nfunction captureTerrainState() {",
'combat targeting system')

app = replace_once(app,
"function wrapAngle(angle) {",
"function moveAngleToward(current, target, maxDelta) {\n  const delta = wrapAngle(target - current);\n  return wrapAngle(current + clamp(delta, -maxDelta, maxDelta));\n}\n\nfunction wrapAngle(angle) {",
'angle lock helper')

path.write_text(app, encoding='utf-8')

# ---- public/index.html -----------------------------------------------------
path = Path('public/index.html')
html = path.read_text(encoding='utf-8')
html = replace_once(html,
'  <link rel="stylesheet" href="/styles.css">',
f'  <link rel="stylesheet" href="/styles.css?v={BUILD}">',
'css cache version')
html = replace_once(html,
'    <canvas id="rift-canvas"></canvas>',
'''    <canvas id="rift-canvas"></canvas>

    <div id="rotate-device" class="rotate-device" aria-live="polite">
      <div class="rotate-device-card">
        <strong>Rotate to Landscape</strong>
        <span>Ironvale gameplay is landscape only.</span>
      </div>
    </div>''',
'landscape orientation overlay')
html = replace_once(html,
'''    <div id="freecam-altitude" class="freecam-altitude" hidden>
      <button type="button" data-freecam-vertical="1" aria-label="Freecam up">▲</button>
      <button type="button" data-freecam-vertical="-1" aria-label="Freecam down">▼</button>
    </div>

    <div class="look-hint">Swipe: look · center reticle: aim</div>''',
'''    <div id="freecam-altitude" class="freecam-altitude" hidden>
      <button type="button" data-freecam-vertical="1" aria-label="Freecam up">▲</button>
      <button type="button" data-freecam-vertical="-1" aria-label="Freecam down">▼</button>
    </div>

    <div id="combat-hud" class="combat-hud">
      <div id="target-pill" class="target-pill">
        <span>Target</span>
        <strong id="target-name">No target</strong>
        <button id="lock-target-button" type="button" disabled>Lock</button>
      </div>
      <div class="combat-actions">
        <div class="ability-buttons" aria-label="Abilities">
          <button type="button" data-ability-slot="1" aria-label="Ability 1">1</button>
          <button type="button" data-ability-slot="2" aria-label="Ability 2">2</button>
          <button type="button" data-ability-slot="3" aria-label="Ability 3">3</button>
        </div>
        <button id="basic-attack-button" class="basic-attack" type="button">Attack</button>
      </div>
    </div>

    <div class="look-hint">Swipe: look · tap enemy: target</div>''',
'combat hud')
html = replace_once(html,
'  <script type="module" src="/app.js?v=20260831-character-sparse-r1"></script>',
f'  <script type="module" src="/app.js?v={BUILD}"></script>',
'app cache version')
path.write_text(html, encoding='utf-8')

# ---- public/styles.css -----------------------------------------------------
path = Path('public/styles.css')
css = path.read_text(encoding='utf-8')
css += r'''

/* Normal RPG interaction HUD: tap targets + action buttons. Freecam owns the reticle. */
.combat-hud{position:absolute;z-index:24;right:max(18px,env(safe-area-inset-right));bottom:max(72px,calc(env(safe-area-inset-bottom) + 62px));display:grid;justify-items:end;gap:8px;pointer-events:auto}
.combat-hud[hidden]{display:none!important}
.target-pill{display:flex;align-items:center;gap:8px;min-height:38px;padding:5px 6px 5px 10px;border:1px solid #ffffff1f;border-radius:11px;background:#07100bd9;backdrop-filter:blur(10px);max-width:260px}
.target-pill>span{font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#93a99a}
.target-pill>strong{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#eef4ef}
.target-pill>button,.ability-buttons button,.basic-attack{border:1px solid #ffffff24;background:#15231b;color:#f2f7f3;font-weight:900;box-shadow:0 4px 16px #0004}
.target-pill>button{height:28px;padding:0 9px;border-radius:8px;font-size:9px}
.target-pill>button.active,.target-pill.active>button{border-color:#91d39e;background:#295639}
.target-pill>button:disabled{opacity:.42}
.combat-actions{display:flex;align-items:flex-end;gap:9px}
.ability-buttons{display:flex;gap:6px}
.ability-buttons button{width:46px;height:46px;border-radius:50%;font-size:14px}
.basic-attack{width:78px;height:78px;border-radius:50%;font-size:13px;letter-spacing:.02em;background:#274b32;border-color:#83c891}
.combat-hud button.pressed{transform:scale(.91)}
#world-screen.freecam .combat-hud{display:none!important}

.rotate-device{display:none;position:absolute;inset:0;z-index:1000;place-items:center;padding:24px;background:#0b120ff5;pointer-events:auto}
.rotate-device-card{display:grid;gap:6px;max-width:320px;padding:22px 26px;border:1px solid #ffffff20;border-radius:16px;background:#132019;text-align:center;box-shadow:0 18px 60px #0008}
.rotate-device-card strong{font-size:20px}
.rotate-device-card span{font-size:12px;color:#a9bcad}

@media (orientation:portrait) and (pointer:coarse){
  #world-screen:not([hidden]) .rotate-device{display:grid}
}

@media (orientation:landscape) and (pointer:coarse) and (max-height:700px){
  .topbar{top:max(7px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right))}
  .topbar>div:first-child{padding:8px 10px;border-radius:10px}
  .topbar strong{font-size:12px}
  .topbar span{font-size:9px}
  .top-actions button{height:36px;padding:0 10px;font-size:10px}
  .joystick{width:100px;height:100px;left:max(16px,env(safe-area-inset-left));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px))}
  .joystick>div{width:44px;height:44px;margin:-22px}
  .combat-hud{right:max(16px,env(safe-area-inset-right));bottom:max(68px,calc(env(safe-area-inset-bottom) + 58px));gap:6px}
  .ability-buttons button{width:42px;height:42px}
  .basic-attack{width:72px;height:72px;font-size:12px}
  .target-pill{min-height:34px}
  .look-hint{right:50%;bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));transform:translateX(50%);font-size:10px}
  #world-screen.freecam .look-hint{bottom:max(24px,calc(env(safe-area-inset-bottom) + 18px))}
}
'''
path.write_text(css, encoding='utf-8')

# ---- scripts/check-core.js ------------------------------------------------
path = Path('scripts/check-core.js')
check = path.read_text(encoding='utf-8')
check = replace_once(check,
"if (!app.includes('const THIRD_PERSON_FOCUS_HEIGHT = 1.20') || !app.includes('player.y + THIRD_PERSON_FOCUS_HEIGHT')) failures.push('third-person RPG focus');",
"if (!app.includes('const THIRD_PERSON_FOCUS_HEIGHT = 1.20') || !app.includes('player.y + THIRD_PERSON_FOCUS_HEIGHT')) failures.push('third-person RPG focus');\nif (!app.includes('const MOBILE_LANDSCAPE_DISTANCE = 6.2') || !app.includes('function applyViewportCameraProfile(') || !app.includes('isMobileLandscapeGameplay()')) failures.push('mobile landscape camera profile');\nif (!app.includes('function selectCombatTargetAtScreen(') || !app.includes('function performBasicAttack(') || !app.includes('window.IronvaleTargeting')) failures.push('tap-target RPG combat controls');",
'new camera/target guards')
check = replace_once(check,
"if (!app.includes('reticle.hidden = false;')) failures.push('world reticle is not persistent');",
"if (!app.includes('reticle.hidden = true;') || !app.includes('reticle.hidden = !freecamEnabled;')) failures.push('reticle must be Freecam-only during normal RPG gameplay');",
'reticle guard')
check = replace_once(check,
"const characterRuntime = fs.readFileSync('public/rift-character.js', 'utf8');",
"const indexHtml = fs.readFileSync('public/index.html', 'utf8');\nconst styles = fs.readFileSync('public/styles.css', 'utf8');\nif (!indexHtml.includes('id=\"combat-hud\"') || !indexHtml.includes('id=\"rotate-device\"') || !indexHtml.includes('data-ability-slot=\"1\"')) failures.push('landscape RPG HUD markup');\nif (!styles.includes('@media (orientation:portrait) and (pointer:coarse)') || !styles.includes('.combat-hud')) failures.push('landscape-only mobile presentation');\n\nconst characterRuntime = fs.readFileSync('public/rift-character.js', 'utf8');",
'html css guards')
check = replace_once(check,
"console.log('Ironvale core verified: textured animated humanoid + centered-reticle RPG camera + adaptive stitched terrain LOD + C++/WASM terrain core.');",
"console.log('Ironvale core verified: textured animated humanoid + landscape RPG tap-target controls + Freecam reticle tools + adaptive stitched terrain LOD + C++/WASM terrain core.');",
'check summary')
path.write_text(check, encoding='utf-8')

print('Landscape-only RPG controls and camera patch applied.')
