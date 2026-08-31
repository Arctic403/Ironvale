from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing expected block: {label}')
    return text.replace(old, new, 1)

app_path = Path('public/app.js')
app = app_path.read_text()

app = replace_once(
    app,
    "const ORBIT_MAX_PITCH = 1.05;\n",
    "const ORBIT_MAX_PITCH = 1.05;\nconst THIRD_PERSON_FOCUS_HEIGHT = 1.20;\n",
    'third person focus constant'
)
app = replace_once(app, "const reticleScreen = { u: .5, v: .5 };\n", "", 'movable reticle state')
app = replace_once(
    app,
    "  updateOrbitCamera();\n  const stats = terrain.getStats?.() || {};\n",
    "  updateOrbitCamera();\n  reticle.hidden = false;\n  updateReticleVisual();\n  updateReticleTarget();\n  const stats = terrain.getStats?.() || {};\n",
    'world reticle activation'
)
app = replace_once(
    app,
    "  reticleScreen.u = .5;\n  reticleScreen.v = .5;\n  updateReticleVisual();\n",
    "  updateReticleVisual();\n",
    'freecam reticle reset'
)
app = replace_once(app, "  reticle.hidden = !freecamEnabled;\n", "  reticle.hidden = false;\n", 'reticle visibility')
app = replace_once(app, "\n    moveReticleToClient(event.clientX, event.clientY);\n\n    if (gesture.mode === 'pending') {", "\n\n    if (gesture.mode === 'pending') {", 'pointerdown reticle motion')
app = replace_once(
    app,
    "    if (gesture.mode === 'sculpt') {\n      moveReticleToClient(event.clientX, event.clientY);\n      applyContinuousBrushStamp();\n    }\n",
    "    if (gesture.mode === 'sculpt') {\n      applyCameraLookDelta(freecam, dx, dy, FREECAM_MIN_PITCH, FREECAM_MAX_PITCH);\n      updateCamera();\n      updateReticleTarget();\n      applyContinuousBrushStamp();\n    }\n",
    'centered sculpt look'
)
app = replace_once(
    app,
    "    if (endedGesture.mode === 'pending' && duration <= TAP_MAX_MS && displacement <= TAP_MAX_PX) {\n      moveReticleToClient(event.clientX, event.clientY);\n      updateReticleTarget();\n      if (reticleHit) applySingleBrushStamp();\n    }\n",
    "    if (endedGesture.mode === 'pending' && duration <= TAP_MAX_MS && displacement <= TAP_MAX_PX) {\n      updateCamera();\n      updateReticleTarget();\n      if (reticleHit) applySingleBrushStamp();\n    }\n",
    'center tap reticle target'
)
app = replace_once(
    app,
    "  gesture.mode = 'sculpt';\n  moveReticleToClient(gesture.x, gesture.y);\n  updateReticleTarget();\n",
    "  gesture.mode = 'sculpt';\n  updateCamera();\n  updateReticleTarget();\n",
    'begin centered sculpt'
)
app = replace_once(
    app,
    "function applyContinuousBrushStamp() {\n  if (!gesture || gesture.mode !== 'sculpt' || !terrain) return;\n  moveReticleToClient(gesture.x, gesture.y);\n  updateReticleTarget();\n",
    "function applyContinuousBrushStamp() {\n  if (!gesture || gesture.mode !== 'sculpt' || !terrain) return;\n  updateReticleTarget();\n",
    'continuous centered sculpt'
)
app = replace_once(
    app,
    "  const target = [player.x, player.y + .7, player.z];\n",
    "  const target = [player.x, player.y + THIRD_PERSON_FOCUS_HEIGHT, player.z];\n",
    'third person focus above character'
)

pattern = re.compile(r"function moveReticleToClient\(clientX, clientY\) \{.*?\n\}\n\nfunction captureTerrainState\(\) \{", re.S)
replacement = """function updateReticleVisual() {
  // RPG interaction contract: the reticle never follows the pointer.
  reticle.style.left = '50%';
  reticle.style.top = '50%';
  brushReadout.style.left = '50%';
  brushReadout.style.top = 'calc(50% + 25px)';
}

function currentViewRay() {
  if (!engine) return null;
  const origin = [lastCameraPosition[0], lastCameraPosition[1], lastCameraPosition[2]];
  const direction = normalize3(
    lastCameraTarget[0] - lastCameraPosition[0],
    lastCameraTarget[1] - lastCameraPosition[1],
    lastCameraTarget[2] - lastCameraPosition[2]
  );
  return { origin, direction };
}

function updateReticleTarget() {
  if (!terrain || !engine) {
    reticleHit = null;
    reticle.classList.remove('no-hit');
    if (brushMesh) brushMesh.visible = false;
    return;
  }

  reticleHit = raycastTerrainAtReticle();
  reticle.classList.toggle('no-hit', !reticleHit);

  if (!freecamEnabled) {
    if (brushMesh) brushMesh.visible = false;
    return;
  }

  if (reticleHit) {
    brushReadout.textContent = `${brushModeLabel(brushMode)} · ${Number(radiusInput.value)}m · Y ${reticleHit.y.toFixed(1)}`;
    updateBrushMarkerPosition();
  } else {
    brushReadout.textContent = `${brushModeLabel(brushMode)} · no terrain under reticle`;
    if (brushMesh) brushMesh.visible = false;
  }
}

function raycastTerrainAtReticle() {
  const ray = currentViewRay();
  if (!ray || !terrain) return null;
  return terrain.raycast(ray.origin, ray.direction, 1800, .5);
}

function captureTerrainState() {"""
app, count = pattern.subn(replacement, app, count=1)
if count != 1:
    raise SystemExit(f'expected one movable reticle/raycast block, replaced {count}')

for forbidden in ('reticleScreen', 'moveReticleToClient(', 'raycastTerrainAtScreen('):
    if forbidden in app:
        raise SystemExit(f'legacy reticle path remained: {forbidden}')

app_path.write_text(app)

index_path = Path('public/index.html')
index = index_path.read_text()
index = replace_once(index, 'Freecam + hold-to-paint sculpting.', 'Centered-reticle RPG camera + Freecam sculpting.', 'tool copy')
index = replace_once(index, 'Turn Freecam ON. Swipe to look; hold then drag to sculpt continuously.', 'Swipe to look. The reticle stays centered; Freecam uses the same aim rule.', 'editor status copy')
index = replace_once(index, 'Swipe: look · hold + drag: sculpt', 'Swipe: look · center reticle: aim', 'look hint copy')
index_path.write_text(index)

check_path = Path('scripts/check-core.js')
check = check_path.read_text()
needle = "if (!app.includes('function applyCameraLookDelta(') || !app.includes('function cameraForward(') || !app.includes('function cameraAnglesFromDirection(')) failures.push('shared camera math');\n"
extra = needle + "if (!app.includes('const THIRD_PERSON_FOCUS_HEIGHT = 1.20') || !app.includes('player.y + THIRD_PERSON_FOCUS_HEIGHT')) failures.push('third-person RPG focus');\nif (!app.includes('function currentViewRay(') || !app.includes('terrain.raycast(ray.origin, ray.direction, 1800, .5)')) failures.push('center-view interaction ray');\nif (app.includes('reticleScreen') || app.includes('moveReticleToClient(') || app.includes('raycastTerrainAtScreen(')) failures.push('movable pointer reticle returned');\nif (!app.includes('reticle.hidden = false;')) failures.push('world reticle is not persistent');\n"
check = replace_once(check, needle, extra, 'camera contract checks')
check = replace_once(
    check,
    "console.log('Ironvale core verified: stable viewport-normalized camera math + 128m components + 64m sections + adaptive stitched LOD + dirty rebuilds + C++/WASM terrain core.');",
    "console.log('Ironvale core verified: centered-reticle RPG camera + stable viewport camera math + adaptive stitched terrain LOD + C++/WASM terrain core.');",
    'verification summary'
)
check_path.write_text(check)

print('Applied centered-reticle third-person RPG camera contract.')
