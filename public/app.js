import { RiftEngine } from './rift-engine.js?v=20260901-terrain-lock-r3';
import { RiftLandscape } from './rift-landscape.js?v=20260901-terrain-lock-r1';
import { createRiftTerrainMaterialRuntime } from './rift-terrain-materials.js?v=20260901-terrain-lock-r1';
import { validateWorldScaleContract } from './rift-scale.js?v=20260901-scale-contract-r1';
import { loadRiggedCharacterAsset } from './rift-character.js?v=20260901-scale-contract-r1';

const CHARACTER_MODEL_URL = new URL('./assets/characters/quaternius/universal-base-male.glb?v=14697e33502e41ddbc1b7fdbf56bbf0478027700', import.meta.url).href;
const CHARACTER_ANIMATION_URL = new URL('./assets/characters/quaternius/universal-animation-library.glb?v=4fccf561b9b2ef73f611efe21981ef8739080065', import.meta.url).href;

const $ = selector => document.querySelector(selector);
const authScreen = $('#auth-screen');
const worldScreen = $('#world-screen');
const authForm = $('#auth-form');
const authStatus = $('#auth-status');
const authSubmit = $('#auth-submit');
const canvas = $('#rift-canvas');
const characterName = $('#character-name');
const terrainStatus = $('#terrain-status');
const coords = $('#coords');
const tools = $('#terrain-tools');
const editorStatus = $('#editor-status');
const brushReadout = $('#brush-readout');
const radiusInput = $('#brush-radius');
const strengthInput = $('#brush-strength');
const radiusValue = $('#radius-value');
const strengthValue = $('#strength-value');
const freecamButton = $('#freecam-button');
const freecamSpeedInput = $('#freecam-speed');
const freecamSpeedValue = $('#freecam-speed-value');
const editLayerSelect = $('#terrain-edit-layer');
const addEditLayerButton = $('#add-terrain-edit-layer');
const editLayerNameInput = $('#terrain-layer-name');
const editLayerUpButton = $('#terrain-layer-up');
const editLayerDownButton = $('#terrain-layer-down');
const editLayerVisibleButton = $('#terrain-layer-visible');
const editLayerLockButton = $('#terrain-layer-lock');
const editLayerOpacityInput = $('#terrain-layer-opacity');
const editLayerOpacityValue = $('#terrain-layer-opacity-value');
const deleteEditLayerButton = $('#delete-terrain-edit-layer');
const materialLayerSelect = $('#terrain-material-layer');
const splineSelect = $('#terrain-spline');
const newSplineButton = $('#new-terrain-spline');
const addSplinePointButton = $('#add-spline-point');
const moveSplinePointButton = $('#move-spline-point');
const removeSplinePointButton = $('#remove-spline-point');
const clearSplineButton = $('#clear-terrain-spline');
const splineWidthInput = $('#spline-width');
const splineWidthValue = $('#spline-width-value');
const splineFalloffInput = $('#spline-falloff');
const splineFalloffValue = $('#spline-falloff-value');
const reticle = $('#terrain-reticle');
const altitudeControls = $('#freecam-altitude');
const combatHud = $('#combat-hud');
const targetPill = $('#target-pill');
const targetName = $('#target-name');
const lockTargetButton = $('#lock-target-button');
const basicAttackButton = $('#basic-attack-button');
const lookHint = $('.look-hint');
const terrainDebugToggle = $('#terrain-debug-toggle');
const terrainDebugReadout = $('#terrain-debug-readout');

const TERRAIN_LOD_REFRESH_MS = 180;
const TERRAIN_LOD_FALLBACK_STEP = 2;
const LOCAL_DRAFT_KEY = 'ironvale:terrain:draft:v4';
const LEGACY_LOCAL_DRAFT_KEYS = ['ironvale:terrain:draft:v3', 'ironvale:terrain:draft:v2'];
const MAX_HISTORY = 10;
const LONG_PRESS_MS = 260;
const LOOK_START_PX = 9;
const TAP_MAX_MS = 220;
const TAP_MAX_PX = 7;
const CONTINUOUS_BRUSH_MS = 75;
const CONTINUOUS_STRENGTH_SCALE = 0.2;
const CAMERA_REFERENCE_FOV = Math.PI / 3;
const CAMERA_YAW_RADIANS_PER_VIEW = Math.PI * 0.70;
const CAMERA_PITCH_RADIANS_PER_VIEW = Math.PI * 0.80;
const CAMERA_MAX_EVENT_FRACTION = 0.22;
const ORBIT_MIN_PITCH = -0.12;
const ORBIT_MAX_PITCH = 1.05;
const THIRD_PERSON_FOCUS_HEIGHT = 1.20;
const PLAYER_COLLIDER_HALF_HEIGHT = .9;
const FREECAM_MIN_PITCH = -1.45;
const FREECAM_MAX_PITCH = 1.45;
const MOBILE_LANDSCAPE_DISTANCE = 6.2;
const MOBILE_LANDSCAPE_FOV = 55 * Math.PI / 180;
const MOBILE_LANDSCAPE_PITCH = .34;
const DEFAULT_ORBIT_DISTANCE = 8.0;
const ORBIT_MIN_DISTANCE = 1.0;
const ORBIT_MAX_DISTANCE = 10.0;
const ORBIT_PINCH_EXPONENT = 0.9;
const TARGET_TAP_MAX_MS = 260;
const TARGET_TAP_MAX_PX = 9;
const TARGET_PICK_MAX_DISTANCE = 80;
const AUTO_ATTACK_RANGE = 5.5;
const MOBILE_TERRAIN_PIXEL_RATIO_MAX = 1.5;
const MOBILE_TERRAIN_PIXEL_RATIO_MIN = 1.0;
const TERRAIN_PERF_SAMPLE_FRAMES = 90;
const TERRAIN_DEBUG_UPDATE_MS = 250;

let authMode = 'login';
let engine = null;
let terrain = null;
let worldDocument = null;
let terrainMeshes = new Map();
let terrainLodPlan = new Map();
let terrainStreamPlan = null;
let terrainMaterialRuntime = null;
let terrainDebugEnabled = false;
let terrainDebugMesh = null;
let lastTerrainDebugUpdate = 0;
let lastTerrainLodRefresh = 0;
let terrainPerfFrameCount = 0;
let terrainPerfFrameMs = 0;
let terrainPerfAverageMs = 0;
let playerMesh = null;
let playerCharacter = null;
let playerVisualFeetAnchored = false;
let playerVisualFeetOffset = 0;
let playerRig = null;
let playerMoving = false;
let brushMesh = null;
let animationFrame = 0;
let lastFrame = performance.now();
let lastPositionSave = 0;
let freecamEnabled = false;
let brushMode = 'raise';
let reticleHit = null;
let lastCameraPosition = [320, 16, 338];
let lastCameraTarget = [320, 0, 320];
let freecamVertical = 0;
let joystickActive = false;
let selectedTargetId = null;
let hardLockEnabled = false;
let viewportCameraProfile = '';
const combatTargets = new Map();

const player = { x: 320, y: .9, z: 320, yaw: 0, vy: 0, grounded: true };
const orbitCamera = { yaw: Math.PI, pitch: .34, distance: DEFAULT_ORBIT_DISTANCE, fov: Math.PI / 3 };
const freecam = { x: 320, y: 16, z: 338, yaw: 0, pitch: .6, fov: Math.PI / 3 };
const input = { forward: 0, strafe: 0, keys: new Set() };
const undoStack = [];
const redoStack = [];

let gesture = null;
let longPressTimer = 0;
let continuousBrushTimer = 0;
let sculptFlattenY = null;

document.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => {
  authMode = button.dataset.authTab;
  document.querySelectorAll('[data-auth-tab]').forEach(tab => tab.classList.toggle('active', tab === button));
  authSubmit.textContent = authMode === 'register' ? 'Create account' : 'Enter Ironvale';
  authForm.password.autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
  setAuthStatus('');
}));

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  authSubmit.disabled = true;
  setAuthStatus(authMode === 'register' ? 'Creating account…' : 'Signing in…');
  try {
    const result = await api(`/api/auth/${authMode}`, {
      method: 'POST',
      body: { username: authForm.username.value, password: authForm.password.value }
    });
    if (!result.ok) throw new Error(result.error || 'Authentication failed');
    authForm.reset();
    await bootSession();
  } catch (error) {
    setAuthStatus(error.message, true);
  } finally {
    authSubmit.disabled = false;
  }
});

$('#logout-button').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
  stopWorld();
  showAuth();
});

$('#terrain-tools-button').addEventListener('click', () => { tools.hidden = !tools.hidden; });
freecamButton.addEventListener('click', () => setFreecam(!freecamEnabled));
lockTargetButton.addEventListener('click', () => setHardLock(!hardLockEnabled));
basicAttackButton.addEventListener('click', performBasicAttack);
document.querySelectorAll('[data-ability-slot]').forEach(button => button.addEventListener('click', () => triggerAbility(Number(button.dataset.abilitySlot) || 0, button)));

document.querySelectorAll('[data-brush]').forEach(button => button.addEventListener('click', () => {
  brushMode = button.dataset.brush;
  document.querySelectorAll('[data-brush]').forEach(item => item.classList.toggle('active', item === button));
  refreshEditorLabels();
}));

radiusInput.addEventListener('input', () => { refreshEditorLabels(); rebuildBrushMarker(); });
strengthInput.addEventListener('input', refreshEditorLabels);
freecamSpeedInput.addEventListener('input', refreshEditorLabels);
editLayerSelect?.addEventListener('change', () => {
  if (!terrain?.setActiveEditLayer(editLayerSelect.value)) return;
  refreshTerrainLayerControls();
  editorStatus.textContent = `Editing terrain layer: ${terrain.activeEditLayer?.name || editLayerSelect.value}.`;
});
addEditLayerButton?.addEventListener('click', () => {
  if (!terrain?.createEditLayer) return;
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  const created = terrain.createEditLayer(`Layer ${terrain.listEditLayers().length + 1}`);
  refreshTerrainLayerControls();
  saveDraftSilently();
  editorStatus.textContent = `Created non-destructive terrain layer: ${created?.name || 'Layer'}.`;
});
editLayerNameInput?.addEventListener('change', updateActiveEditLayerName);
editLayerUpButton?.addEventListener('click', () => moveActiveEditLayer(-1));
editLayerDownButton?.addEventListener('click', () => moveActiveEditLayer(1));
editLayerVisibleButton?.addEventListener('click', toggleActiveEditLayerVisibility);
editLayerLockButton?.addEventListener('click', toggleActiveEditLayerLock);
editLayerOpacityInput?.addEventListener('change', updateActiveEditLayerOpacity);
deleteEditLayerButton?.addEventListener('click', deleteActiveEditLayer);
materialLayerSelect?.addEventListener('change', () => {
  if (!terrain?.setActiveMaterialLayer?.(materialLayerSelect.value)) return;
  refreshTerrainLayerControls();
  void terrainMaterialRuntime?.loadLayer?.(materialLayerSelect.value);
  editorStatus.textContent = `Painting terrain material: ${terrain.activeMaterialLayer?.name || materialLayerSelect.value}.`;
});
splineSelect?.addEventListener('change', () => {
  if (!terrain?.setActiveSpline?.(splineSelect.value)) return;
  refreshTerrainLayerControls();
});
newSplineButton?.addEventListener('click', createTerrainSpline);
addSplinePointButton?.addEventListener('click', addSplinePointAtReticle);
moveSplinePointButton?.addEventListener('click', moveLastSplinePointToReticle);
removeSplinePointButton?.addEventListener('click', removeLastSplinePoint);
clearSplineButton?.addEventListener('click', clearActiveTerrainSpline);
terrainDebugToggle?.addEventListener('click', () => setTerrainDebug(!terrainDebugEnabled));
splineWidthInput?.addEventListener('change', updateActiveSplineSettings);
splineFalloffInput?.addEventListener('change', updateActiveSplineSettings);
$('#undo-terrain').addEventListener('click', undoTerrain);
$('#redo-terrain').addEventListener('click', redoTerrain);
$('#save-terrain').addEventListener('click', saveDraft);
$('#export-terrain').addEventListener('click', exportDraft);
$('#reset-terrain').addEventListener('click', resetTerrain);

document.querySelectorAll('[data-freecam-vertical]').forEach(button => {
  const value = Number(button.dataset.freecamVertical) || 0;
  const start = event => {
    if (!freecamEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    freecamVertical = value;
    button.setPointerCapture?.(event.pointerId);
  };
  const stop = event => {
    if (event && button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture?.(event.pointerId);
    if (freecamVertical === value) freecamVertical = 0;
  };
  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('pointerleave', event => { if (event.buttons === 0) stop(event); });
});

window.addEventListener('keydown', event => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'z') {
    event.preventDefault();
    event.shiftKey ? redoTerrain() : undoTerrain();
    return;
  }
  if (key === 'f') {
    event.preventDefault();
    setFreecam(!freecamEnabled);
    return;
  }
  input.keys.add(key);
});
window.addEventListener('keyup', event => input.keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => {
  input.keys.clear();
  freecamVertical = 0;
  cancelGesture();
});
window.addEventListener('pagehide', () => savePosition(true));
window.addEventListener('beforeunload', () => savePosition(true));
window.addEventListener('resize', () => applyViewportCameraProfile());
window.visualViewport?.addEventListener('resize', () => applyViewportCameraProfile());

setupCanvasControls();
setupJoystick();
refreshEditorLabels();
updateReticleVisual();
bootSession();

async function bootSession() {
  try {
    const data = await api('/api/bootstrap');
    if (!data.ok || !data.authenticated) { showAuth(); return; }
    characterName.textContent = data.character.displayName || data.user.username;
    const saved = data.character.position || {};
    player.x = finiteOr(saved.x, 320);
    player.y = finiteOr(saved.y, .9);
    player.z = finiteOr(saved.z, 320);
    player.yaw = finiteOr(saved.yaw, 0);
    orbitCamera.yaw = wrapAngle(player.yaw + Math.PI);
    await startWorld(data.world?.url || '/world/ironvale-terrain.json');
  } catch (error) {
    console.error('Ironvale world boot failed.', error);
    showAuth();
    setAuthStatus(`World boot failed: ${String(error?.message || error || 'unknown error').slice(0, 180)}`, true);
  }
}

async function startWorld(url) {
  stopWorld();
  authScreen.hidden = true;
  worldScreen.hidden = false;
  terrainStatus.textContent = 'Loading blank Rift Terrain…';
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Terrain failed to load (${response.status})`);
  worldDocument = await response.json();
  const worldScaleValidation = validateWorldScaleContract(worldDocument);
  if (!worldScaleValidation.ok) throw new Error(`World scale validation failed: ${worldScaleValidation.errors.join('; ')}`);
  terrain = new RiftLandscape(worldDocument.terrain);
  const terrainValidation = terrain.validateLandscape?.();
  if (terrainValidation && !terrainValidation.ok) throw new Error(`Terrain validation failed: ${terrainValidation.errors.join('; ')}`);
  restoreLocalDraft();
  refreshTerrainLayerControls();
  engine = new RiftEngine(canvas);
  engine.environment.fogNear = 320;
  engine.environment.fogFar = 1200;
  engine.setPixelRatioCap(isMobileLandscapeGameplay() ? MOBILE_TERRAIN_PIXEL_RATIO_MAX : 2);
  const materialTextureSize = clamp(Math.trunc(Number(worldDocument?.terrain?.landscape?.mobilePerformance?.materialTextureSize) || 512), 128, 1024);
  terrainMaterialRuntime = createRiftTerrainMaterialRuntime(engine, terrain, { size: materialTextureSize });
  void terrainMaterialRuntime.loadInitial().then(() => {
    if (terrainMaterialRuntime?.terrain === terrain) terrainStatus.textContent = `${terrainStatus.textContent} · terrain PBR ready`;
  });
  const spawn = worldDocument?.anchors?.starter_spawn || { x: 320, z: 320 };
  if (!terrain.containsXZ(player.x, player.z)) {
    player.x = spawn.x;
    player.z = spawn.z;
  }

  rebuildTerrainMeshes();
  playerCharacter = null;
  playerVisualFeetAnchored = false;
  playerVisualFeetOffset = 0;
  playerRig = null;
  playerMoving = false;
  playerMesh = engine.addMesh(createCapsuleGeometry(), { position: [player.x, player.y, player.z] });
  snapPlayerToSupport();
  void installRiggedPlayerVisual();
  applyViewportCameraProfile(true);
  updateOrbitCamera();
  reticle.hidden = true;
  combatHud.hidden = false;
  refreshCombatHud();
  updateReticleVisual();
  updateReticleTarget();
  const stats = terrain.getStats?.() || {};
  terrainStatus.textContent = `RiftLandscape · 640×640 · ${stats.components ?? 25} components · ${stats.surfaceSections ?? terrainMeshes.size} sections · ${stats.editLayers ?? 1} edit layer${(stats.editLayers ?? 1) === 1 ? '' : 's'} · adaptive LOD`;
  lastFrame = performance.now();
  animationFrame = requestAnimationFrame(frame);
}

function stopWorld() {
  cancelGesture();
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  if (terrainMaterialRuntime) terrainMaterialRuntime.destroy();
  terrainMaterialRuntime = null;
  if (engine) engine.destroy();
  engine = null;
  terrain = null;
  worldDocument = null;
  terrainMeshes = new Map();
  terrainLodPlan = new Map();
  terrainStreamPlan = null;
  terrainDebugEnabled = false;
  terrainDebugMesh = null;
  lastTerrainDebugUpdate = 0;
  terrainPerfFrameCount = 0;
  terrainPerfFrameMs = 0;
  terrainPerfAverageMs = 0;
  lastTerrainLodRefresh = 0;
  playerMesh = null;
  playerCharacter = null;
  playerVisualFeetAnchored = false;
  playerVisualFeetOffset = 0;
  playerRig = null;
  playerMoving = false;
  brushMesh = null;
  reticleHit = null;
  undoStack.length = 0;
  redoStack.length = 0;
  freecamEnabled = false;
  freecamVertical = 0;
  selectedTargetId = null;
  hardLockEnabled = false;
  viewportCameraProfile = '';
  worldScreen.classList.remove('freecam');
  terrainDebugToggle?.classList.remove('active');
  if (terrainDebugReadout) terrainDebugReadout.textContent = 'Debug overlay off.';
  freecamButton.classList.remove('active');
  freecamButton.textContent = 'Freecam';
  reticle.hidden = true;
  altitudeControls.hidden = true;
  brushReadout.hidden = true;
  combatHud.hidden = true;
  refreshCombatHud();
  worldScreen.hidden = true;
}

function showAuth() {
  authScreen.hidden = false;
  worldScreen.hidden = true;
  setAuthStatus('');
}

function sectionSignature(section, neighbors) {
  return [
    section.lodStep,
    neighbors.north,
    neighbors.east,
    neighbors.south,
    neighbors.west
  ].join(':');
}

function refreshTerrainStreamPlan(cameraX = player.x, cameraZ = player.z) {
  terrainStreamPlan = terrain?.planComponentStreaming?.(cameraX, cameraZ) || null;
  return terrainStreamPlan;
}

function sectionIsStreamed(section) {
  return !terrainStreamPlan?.render || terrainStreamPlan.render.has(section.componentId);
}

function removeUnstreamedTerrainMeshes() {
  if (!engine || !terrainStreamPlan?.render) return;
  for (const [key, entry] of terrainMeshes) {
    if (terrainStreamPlan.render.has(entry.componentId)) continue;
    if (entry.mesh) engine.removeMesh(entry.mesh);
    terrainMeshes.delete(key);
  }
}

function updateTerrainMeshVisibility(now = performance.now()) {
  if (!engine || !terrain) return;
  let visible = 0;
  for (const [key, entry] of terrainMeshes) {
    const section = terrainLodPlan.get(key);
    if (!section || !sectionIsStreamed(section)) {
      if (entry.mesh) entry.mesh.visible = false;
      continue;
    }
    const sphere = terrain.sectionRenderSphere?.(section);
    const inView = sphere ? engine.isSphereVisible(sphere.center, sphere.radius) : true;
    entry.mesh.visible = inView;
    if (inView) visible += 1;
  }
  if (terrainDebugEnabled && now - lastTerrainDebugUpdate >= TERRAIN_DEBUG_UPDATE_MS) {
    lastTerrainDebugUpdate = now;
    rebuildTerrainDebugOverlay();
    refreshTerrainDebugReadout(visible);
  }
}

function buildTerrainSection(section, plan = terrainLodPlan, force = false) {
  if (!engine || !terrain || !section) return;
  const key = section.key;
  const neighbors = terrain.sectionNeighborLods(plan, section.sectionX, section.sectionZ, section.lodStep);
  const signature = sectionSignature(section, neighbors);
  const existing = terrainMeshes.get(key);
  if (!force && existing?.signature === signature) return;

  const entry = terrain.buildSurfaceSectionGeometry(
    section.sectionX,
    section.sectionZ,
    section.lodStep,
    neighbors
  );
  if (existing?.mesh) {
    engine.updateMesh(existing.mesh, entry.geometry || entry);
    terrainMaterialRuntime?.attach(existing.mesh);
    existing.lodStep = section.lodStep;
    existing.signature = signature;
    existing.componentId = section.componentId;
    existing.triangles = Number(entry.triangles) || 0;
  } else {
    const mesh = engine.addMesh(entry.geometry || entry, { terrainMaterial: terrainMaterialRuntime?.material || null });
    terrainMeshes.set(key, {
      mesh,
      lodStep: section.lodStep,
      signature,
      componentId: section.componentId,
      triangles: Number(entry.triangles) || 0
    });
  }
}

function rebuildTerrainMeshes() {
  if (!engine || !terrain) return;
  for (const entry of terrainMeshes.values()) if (entry?.mesh) engine.removeMesh(entry.mesh);
  terrainMeshes.clear();

  const cameraX = Number(lastCameraPosition?.[0]);
  const cameraZ = Number(lastCameraPosition?.[2]);
  const originX = Number.isFinite(cameraX) ? cameraX : player.x;
  const originZ = Number.isFinite(cameraZ) ? cameraZ : player.z;
  refreshTerrainStreamPlan(originX, originZ);
  terrainLodPlan = terrain.planSectionLods(originX, originZ);
  for (const section of terrainLodPlan.values()) if (sectionIsStreamed(section)) buildTerrainSection(section, terrainLodPlan, true);
  terrain.consumeDirtySections();
  lastTerrainLodRefresh = performance.now();
  rebuildBrushMarker();
  updateTerrainMeshVisibility(lastTerrainLodRefresh);
}

function lodSummary() {
  const counts = new Map();
  for (const section of terrainLodPlan.values()) {
    counts.set(section.lodLevel, (counts.get(section.lodLevel) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => `L${level}:${count}`)
    .join(' ');
}

function updateTerrainLod(now = performance.now(), force = false) {
  if (!engine || !terrain) return;
  if (!force && now - lastTerrainLodRefresh < TERRAIN_LOD_REFRESH_MS) {
    updateTerrainMeshVisibility(now);
    return;
  }
  lastTerrainLodRefresh = now;

  const cameraX = Number(lastCameraPosition?.[0]);
  const cameraZ = Number(lastCameraPosition?.[2]);
  const resolvedX = Number.isFinite(cameraX) ? cameraX : player.x;
  const resolvedZ = Number.isFinite(cameraZ) ? cameraZ : player.z;
  refreshTerrainStreamPlan(resolvedX, resolvedZ);
  removeUnstreamedTerrainMeshes();

  const nextPlan = terrain.planSectionLods(resolvedX, resolvedZ, terrainLodPlan);
  for (const section of nextPlan.values()) {
    if (!sectionIsStreamed(section)) continue;
    const neighbors = terrain.sectionNeighborLods(nextPlan, section.sectionX, section.sectionZ, section.lodStep);
    const signature = sectionSignature(section, neighbors);
    const existing = terrainMeshes.get(section.key);
    if (force || !existing || existing.signature !== signature) buildTerrainSection(section, nextPlan, true);
  }

  terrainLodPlan = nextPlan;
  updateTerrainMeshVisibility(now);
}

function rebuildDirtyTerrainSections() {
  if (!engine || !terrain) return;
  if (!terrainLodPlan.size) terrainLodPlan = terrain.planSectionLods(player.x, player.z);
  if (!terrainStreamPlan) refreshTerrainStreamPlan(player.x, player.z);
  const dirty = terrain.consumeDirtySections();
  for (const key of dirty) {
    const section = terrainLodPlan.get(key);
    if (section && sectionIsStreamed(section)) buildTerrainSection(section, terrainLodPlan, true);
  }
  updateTerrainMeshVisibility();
}

function rebuildTerrainArea(x, z, radius) {
  if (!terrain) return;
  terrain.markDirtyRegion(x, z, radius);
  rebuildDirtyTerrainSections();
}

function collisionSupportHeight(x, z, aroundY, options = {}) {
  if (!terrain) return null;
  if (terrain.supportAtPointCollision) {
    return terrain.supportAtPointCollision(x, z, aroundY, player.x, player.z, options)?.height ?? null;
  }
  return terrain.supportAtPoint(x, z, aroundY, options);
}

function snapPlayerToSupport() {
  if (!terrain) return;
  const surface = collisionSupportHeight(player.x, player.z, player.y - .9, { maxRise: 1000, maxDrop: 10000 });
  if (surface != null) {
    player.y = surface + .9;
    player.vy = 0;
    player.grounded = true;
  }
  updatePlayerVisualTransform();
}

function updatePlayerVisualTransform() {
  if (!playerMesh) return;
  const feetY = playerVisualFeetAnchored
    ? player.y - PLAYER_COLLIDER_HALF_HEIGHT + playerVisualFeetOffset
    : player.y;
  if (playerCharacter?.meshes?.length) {
    for (const mesh of playerCharacter.meshes) {
      mesh.position[0] = player.x;
      mesh.position[1] = feetY;
      mesh.position[2] = player.z;
      mesh.yaw = player.yaw;
    }
    return;
  }
  playerMesh.position[0] = player.x;
  playerMesh.position[1] = feetY;
  playerMesh.position[2] = player.z;
  playerMesh.yaw = player.yaw;
}

function closeDecodedCharacterImages(asset) {
  const images = new Set((asset?.primitives || []).map(entry => entry?.material?.baseColorImage).filter(Boolean));
  for (const image of images) image.close?.();
}

async function installRiggedPlayerVisual() {
  if (!engine || !playerMesh) return;
  const activeEngine = engine;
  const fallbackMesh = playerMesh;
  let skin = null;
  const meshes = [];
  const textures = new Map();
  let asset = null;
  try {
    asset = await loadRiggedCharacterAsset(
      CHARACTER_MODEL_URL,
      CHARACTER_ANIMATION_URL
    );
    if (!engine || engine !== activeEngine || playerMesh !== fallbackMesh) {
      closeDecodedCharacterImages(asset);
      return;
    }

    skin = activeEngine.createSkin(asset.rig.jointCount);
    const initialMatrices = asset.runtime.getSkinMatrices(0);
    if (!initialMatrices) throw new Error('Character runtime did not produce skin matrices.');
    activeEngine.updateSkin(skin, initialMatrices);

    const renderScale = Number(asset.rig.renderScale) || 1;
    for (const primitive of asset.primitives) {
      const textureIndex = primitive.material?.baseColorTextureIndex;
      let texture = null;
      if (Number.isInteger(textureIndex) && primitive.material?.baseColorImage) {
        if (!textures.has(textureIndex)) textures.set(textureIndex, activeEngine.createTexture(primitive.material.baseColorImage));
        texture = textures.get(textureIndex);
      }
      const human = activeEngine.addMesh(primitive.geometry, {
        position: [player.x, player.y - PLAYER_COLLIDER_HALF_HEIGHT, player.z],
        yaw: player.yaw,
        scale: [renderScale, renderScale, renderScale],
        baseColorFactor: primitive.material?.baseColorFactor || [1, 1, 1, 1],
        texture,
        skin: primitive.skinIndex == null ? null : skin
      });
      human.rig = asset.rig;
      human.characterAsset = 'quaternius-universal-base-male';
      meshes.push(human);
    }
    if (!meshes.length) throw new Error('Character runtime produced no renderable primitives.');

    closeDecodedCharacterImages(asset);
    activeEngine.removeMesh(fallbackMesh);
    playerCharacter = { asset, meshes, skin, textures: [...textures.values()] };
    playerMesh = meshes[0];
    playerVisualFeetAnchored = true;
    playerVisualFeetOffset = -(Number(asset.rig.feetAtY) || 0);
    playerRig = asset.rig;
    updatePlayerVisualTransform();
    const jointText = Number(asset.rig?.jointCount) || 0;
    const clipText = Number(asset.rig?.animationClipCount) || asset.clips?.length || 0;
    terrainStatus.textContent = `${terrainStatus.textContent} · textured animated humanoid · ${jointText} joints · ${clipText} clips`;
    console.info('Rift character visual loaded', { rig: asset.rig, clips: asset.clips, defaults: asset.defaultClips });
  } catch (error) {
    closeDecodedCharacterImages(asset);
    if (engine === activeEngine) {
      for (const mesh of meshes) activeEngine.removeMesh(mesh);
      for (const texture of textures.values()) activeEngine.destroyTexture(texture);
      if (skin) activeEngine.destroySkin(skin);
    }
    const characterError = String(error?.message || error || 'unknown error').slice(0, 120);
    if (terrainStatus) terrainStatus.textContent = `${terrainStatus.textContent} · character fallback: ${characterError}`;
    console.warn('Rigged humanoid failed to load; keeping capsule fallback.', error);
  }
}

function updatePlayerCharacterAnimation(dt) {
  if (!playerCharacter?.asset || !playerCharacter.skin || !engine) return;
  const { asset, skin } = playerCharacter;
  const clip = (!freecamEnabled && playerMoving) ? asset.defaultClips.walk : asset.defaultClips.idle;
  asset.runtime.update(dt, clip);
  const matrices = asset.runtime.getSkinMatrices(0);
  if (matrices) engine.updateSkin(skin, matrices);
}

function frame(now) {
  if (!engine || !terrain) return;
  const dt = Math.min(.05, Math.max(.001, (now - lastFrame) / 1000));
  lastFrame = now;
  updateKeyboardInput();
  if (freecamEnabled) updateFreecam(dt);
  else updatePlayer(dt);
  updatePlayerCharacterAnimation(dt);
  if (!freecamEnabled) updateHardLockCamera(dt);
  updateCamera();
  updateTerrainLod(now);
  updateReticleTarget();
  updateTerrainPerformance(dt);
  engine.render();

  coords.textContent = freecamEnabled
    ? `CAM ${freecam.x.toFixed(1)}, ${freecam.y.toFixed(1)}, ${freecam.z.toFixed(1)}`
    : `${player.x.toFixed(1)}, ${player.y.toFixed(1)}, ${player.z.toFixed(1)}`;

  if (!freecamEnabled && now - lastPositionSave > 5000) {
    lastPositionSave = now;
    savePosition();
  }
  animationFrame = requestAnimationFrame(frame);
}

function updateTerrainPerformance(dt) {
  if (!engine) return;
  terrainPerfFrameCount += 1;
  terrainPerfFrameMs += dt * 1000;
  if (terrainPerfFrameCount < TERRAIN_PERF_SAMPLE_FRAMES) return;
  terrainPerfAverageMs = terrainPerfFrameMs / terrainPerfFrameCount;
  terrainPerfFrameCount = 0;
  terrainPerfFrameMs = 0;

  if (isMobileLandscapeGameplay()) {
    let cap = Number(engine.pixelRatioCap) || MOBILE_TERRAIN_PIXEL_RATIO_MAX;
    if (terrainPerfAverageMs > 22 && cap > MOBILE_TERRAIN_PIXEL_RATIO_MIN) cap -= .25;
    else if (terrainPerfAverageMs < 15 && cap < MOBILE_TERRAIN_PIXEL_RATIO_MAX) cap += .25;
    engine.setPixelRatioCap(clamp(cap, MOBILE_TERRAIN_PIXEL_RATIO_MIN, MOBILE_TERRAIN_PIXEL_RATIO_MAX));
  }
}

function updateKeyboardInput() {
  let forward = 0, strafe = 0;
  if (input.keys.has('w') || input.keys.has('arrowup')) forward += 1;
  if (input.keys.has('s') || input.keys.has('arrowdown')) forward -= 1;
  if (input.keys.has('d') || input.keys.has('arrowright')) strafe += 1;
  if (input.keys.has('a') || input.keys.has('arrowleft')) strafe -= 1;
  if (forward || strafe) {
    const length = Math.hypot(forward, strafe) || 1;
    input.forward = forward / length;
    input.strafe = strafe / length;
  } else if (!joystickActive) {
    input.forward = 0;
    input.strafe = 0;
  }
}

function updatePlayer(dt) {
  const moving = Math.abs(input.forward) + Math.abs(input.strafe) > .001;
  playerMoving = moving;
  if (moving) {
    const basis = cameraGroundBasis(orbitCamera.yaw);
    let dx = basis.forwardX * input.forward + basis.rightX * input.strafe;
    let dz = basis.forwardZ * input.forward + basis.rightZ * input.strafe;
    const length = Math.hypot(dx, dz) || 1;
    dx /= length; dz /= length;
    const speed = 7.2;
    const nextX = clamp(player.x + dx * speed * dt, terrain.origin[0] + .5, terrain.origin[0] + terrain.width - .5);
    const nextZ = clamp(player.z + dz * speed * dt, terrain.origin[2] + .5, terrain.origin[2] + terrain.depth - .5);
    const support = collisionSupportHeight(nextX, nextZ, player.y - .9, { maxRise: .9, maxDrop: 3.2 });
    player.x = nextX;
    player.z = nextZ;
    player.yaw = Math.atan2(dx, dz);
    if (support != null) {
      player.y = support + .9;
      player.vy = 0;
      player.grounded = true;
    } else player.grounded = false;
  }

  if (!player.grounded) {
    player.vy -= 18 * dt;
    player.y += player.vy * dt;
    const support = collisionSupportHeight(player.x, player.z, player.y - .9, { maxRise: .35, maxDrop: 1.5 });
    if (support != null && player.y - .9 <= support + .25) {
      player.y = support + .9;
      player.vy = 0;
      player.grounded = true;
    }
  }

  updatePlayerVisualTransform();
}

function updateFreecam(dt) {
  const speed = Number(freecamSpeedInput.value) || 14;
  const basis = cameraGroundBasis(freecam.yaw);
  freecam.x += (basis.forwardX * input.forward + basis.rightX * input.strafe) * speed * dt;
  freecam.z += (basis.forwardZ * input.forward + basis.rightZ * input.strafe) * speed * dt;

  let vertical = freecamVertical;
  if (input.keys.has(' ') || input.keys.has('e')) vertical += 1;
  if (input.keys.has('q') || input.keys.has('c')) vertical -= 1;
  freecam.y += clamp(vertical, -1, 1) * speed * dt;
}

function isMobileLandscapeGameplay() {
  return window.matchMedia?.('(pointer: coarse)').matches === true && window.innerWidth > window.innerHeight;
}

function applyViewportCameraProfile(force = false) {
  const profile = isMobileLandscapeGameplay() ? 'mobile-landscape' : 'default';
  if (!force && profile === viewportCameraProfile) return;
  viewportCameraProfile = profile;
  if (profile === 'mobile-landscape') {
    orbitCamera.distance = MOBILE_LANDSCAPE_DISTANCE;
    orbitCamera.fov = MOBILE_LANDSCAPE_FOV;
    orbitCamera.pitch = MOBILE_LANDSCAPE_PITCH;
    engine?.setPixelRatioCap(Math.min(MOBILE_TERRAIN_PIXEL_RATIO_MAX, engine.pixelRatioCap || MOBILE_TERRAIN_PIXEL_RATIO_MAX));
  } else {
    orbitCamera.distance = DEFAULT_ORBIT_DISTANCE;
    orbitCamera.fov = Math.PI / 3;
    orbitCamera.pitch = .34;
    engine?.setPixelRatioCap(2);
  }
  if (engine && !freecamEnabled) updateOrbitCamera();
}

function updateCamera() {
  if (freecamEnabled) {
    const direction = freecamForward();
    const target = [
      freecam.x + direction[0] * 20,
      freecam.y + direction[1] * 20,
      freecam.z + direction[2] * 20
    ];
    lastCameraPosition = [freecam.x, freecam.y, freecam.z];
    lastCameraTarget = target;
    engine.setCamera({ position: lastCameraPosition, target, fov: freecam.fov, near: .05, far: 1800 });
    return;
  }
  updateOrbitCamera();
}

function updateOrbitCamera() {
  if (!engine) return;
  const target = [player.x, player.y + THIRD_PERSON_FOCUS_HEIGHT, player.z];
  const forward = cameraForward(orbitCamera.yaw, orbitCamera.pitch);
  const position = [
    target[0] - forward[0] * orbitCamera.distance,
    target[1] - forward[1] * orbitCamera.distance,
    target[2] - forward[2] * orbitCamera.distance
  ];
  lastCameraPosition = position;
  lastCameraTarget = target;
  engine.setCamera({ position, target, fov: orbitCamera.fov, near: .08, far: 1000 });
}

function setFreecam(enabled, { preserveCamera = true } = {}) {
  const next = Boolean(enabled) && Boolean(terrain) && Boolean(engine);
  if (next === freecamEnabled) return;
  cancelGesture();
  // Capture the actual current orbit view, not a potentially stale previous-frame camera.
  if (next && preserveCamera && !freecamEnabled) updateOrbitCamera();
  if (next && preserveCamera) {
    const direction = normalize3(
      lastCameraTarget[0] - lastCameraPosition[0],
      lastCameraTarget[1] - lastCameraPosition[1],
      lastCameraTarget[2] - lastCameraPosition[2]
    );
    freecam.x = lastCameraPosition[0];
    freecam.y = lastCameraPosition[1];
    freecam.z = lastCameraPosition[2];
    const angles = cameraAnglesFromDirection(direction);
    freecam.yaw = angles.yaw;
    freecam.pitch = clamp(angles.pitch, FREECAM_MIN_PITCH, FREECAM_MAX_PITCH);
  }
  freecamEnabled = next;
  freecamVertical = 0;
  input.forward = 0;
  input.strafe = 0;
  updateReticleVisual();
  worldScreen.classList.toggle('freecam', freecamEnabled);
  freecamButton.classList.toggle('active', freecamEnabled);
  freecamButton.textContent = freecamEnabled ? 'Freecam ON' : 'Freecam';
  reticle.hidden = !freecamEnabled;
  altitudeControls.hidden = !freecamEnabled;
  brushReadout.hidden = !freecamEnabled;
  combatHud.hidden = freecamEnabled;
  if (freecamEnabled) hardLockEnabled = false;
  refreshCombatHud();
  lookHint.textContent = freecamEnabled
    ? 'Swipe: look · center reticle: terrain tools'
    : 'Swipe: look · tap enemy: target';
  reticleHit = null;
  if (brushMesh) brushMesh.visible = false;
  editorStatus.textContent = freecamEnabled
    ? 'Swipe to look. Hold, then drag to sculpt continuously. Tap for one stamp.'
    : 'Turn Freecam ON to sculpt terrain.';
  // Make the mode switch atomic: camera, center ray and reticle all agree immediately.
  updateCamera();
  updateReticleTarget();
}

function setupCanvasControls() {
  let orbitPointerId = null;
  let orbitLastX = 0;
  let orbitLastY = 0;
  let orbitDownX = 0;
  let orbitDownY = 0;
  let orbitDownAt = 0;
  let orbitTravel = 0;
  let orbitLooking = false;
  const orbitTouches = new Map();
  let orbitPinch = null;
  let orbitGestureWasPinch = false;

  const beginOrbitPointer = (pointerId, x, y, { suppressTarget = false } = {}) => {
    orbitPointerId = pointerId;
    orbitLastX = orbitDownX = x;
    orbitLastY = orbitDownY = y;
    orbitDownAt = performance.now();
    orbitTravel = suppressTarget ? LOOK_START_PX + 1 : 0;
    orbitLooking = Boolean(suppressTarget);
  };

  const resetOrbitPointer = () => {
    orbitPointerId = null;
    orbitLooking = false;
    orbitTravel = 0;
    orbitGestureWasPinch = false;
  };

  const beginPinchZoom = () => {
    if (freecamEnabled || orbitTouches.size < 2) return;
    const points = [...orbitTouches.values()].slice(0, 2);
    const span = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    if (span < 1) return;
    orbitPinch = {
      startSpan: span,
      startDistance: orbitCamera.distance
    };
    orbitGestureWasPinch = true;
    orbitPointerId = null;
    orbitLooking = false;
    orbitTravel = 0;
  };

  const updatePinchZoom = () => {
    if (!orbitPinch || orbitTouches.size < 2 || freecamEnabled) return false;
    const points = [...orbitTouches.values()].slice(0, 2);
    const span = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    if (span < 1) return true;
    const ratio = orbitPinch.startSpan / span;
    orbitCamera.distance = clamp(
      orbitPinch.startDistance * Math.pow(ratio, ORBIT_PINCH_EXPONENT),
      ORBIT_MIN_DISTANCE,
      ORBIT_MAX_DISTANCE
    );
    updateOrbitCamera();
    return true;
  };

  canvas.addEventListener('contextmenu', event => {
    if (freecamEnabled) event.preventDefault();
  });

  canvas.addEventListener('pointerdown', event => {
    if (!freecamEnabled) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      if (event.pointerType === 'touch') {
        event.preventDefault();
        orbitTouches.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
        canvas.setPointerCapture(event.pointerId);
        if (orbitTouches.size === 1) {
          orbitGestureWasPinch = false;
          beginOrbitPointer(event.pointerId, event.clientX, event.clientY);
        } else if (orbitTouches.size === 2) {
          beginPinchZoom();
        }
        return;
      }

      beginOrbitPointer(event.pointerId, event.clientX, event.clientY);
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (gesture) return;
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    gesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      mode: event.pointerType === 'mouse' && event.button === 2 ? 'look' : 'pending',
      downAt: performance.now(),
      downX: event.clientX,
      downY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      travel: 0
    };


    if (gesture.mode === 'pending') {
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (!gesture || gesture.mode !== 'pending' || gesture.travel > LOOK_START_PX) return;
        beginContinuousSculpt();
      }, LONG_PRESS_MS);
    }
  });

  canvas.addEventListener('pointermove', event => {
    if (!freecamEnabled) {
      if (event.pointerType === 'touch' && orbitTouches.has(event.pointerId)) {
        event.preventDefault();
        orbitTouches.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
        if (updatePinchZoom()) return;
      }

      if (event.pointerId !== orbitPointerId) return;
      const dx = event.clientX - orbitLastX;
      const dy = event.clientY - orbitLastY;
      orbitLastX = event.clientX;
      orbitLastY = event.clientY;
      orbitTravel += Math.hypot(dx, dy);
      if (!orbitLooking && orbitTravel > LOOK_START_PX) orbitLooking = true;
      if (orbitLooking) applyCameraLookDelta(orbitCamera, dx, dy, ORBIT_MIN_PITCH, ORBIT_MAX_PITCH);
      return;
    }

    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.lastX;
    const dy = event.clientY - gesture.lastY;
    gesture.travel += Math.hypot(dx, dy);
    gesture.lastX = gesture.x = event.clientX;
    gesture.lastY = gesture.y = event.clientY;

    if (gesture.mode === 'pending' && gesture.travel > LOOK_START_PX) {
      clearTimeout(longPressTimer);
      longPressTimer = 0;
      gesture.mode = 'look';
    }

    if (gesture.mode === 'look') {
      event.preventDefault();
      applyCameraLookDelta(freecam, dx, dy, FREECAM_MIN_PITCH, FREECAM_MAX_PITCH);
      updateCamera();
      updateReticleTarget();
      return;
    }

    if (gesture.mode === 'sculpt') {
      applyCameraLookDelta(freecam, dx, dy, FREECAM_MIN_PITCH, FREECAM_MAX_PITCH);
      updateCamera();
      updateReticleTarget();
      applyContinuousBrushStamp();
    }
  });

  const finish = event => {
    if (!freecamEnabled) {
      if (event.pointerType === 'touch' && orbitTouches.has(event.pointerId)) {
        event.preventDefault();
        const wasPinch = orbitGestureWasPinch;
        orbitTouches.delete(event.pointerId);
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);

        if (orbitPinch && orbitTouches.size < 2) {
          orbitPinch = null;
          if (orbitTouches.size === 1) {
            const remaining = orbitTouches.values().next().value;
            beginOrbitPointer(remaining.id, remaining.x, remaining.y, { suppressTarget: true });
          } else {
            resetOrbitPointer();
          }
          return;
        }

        if (wasPinch) {
          if (orbitTouches.size === 0) resetOrbitPointer();
          return;
        }
      }

      if (event.pointerId !== orbitPointerId) return;
      const duration = performance.now() - orbitDownAt;
      const displacement = Math.hypot(event.clientX - orbitDownX, event.clientY - orbitDownY);
      if (!orbitGestureWasPinch && !orbitLooking && duration <= TARGET_TAP_MAX_MS && displacement <= TARGET_TAP_MAX_PX) {
        selectCombatTargetAtScreen(event.clientX, event.clientY);
      }
      resetOrbitPointer();
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const endedGesture = gesture;
    const duration = performance.now() - endedGesture.downAt;
    const displacement = Math.hypot(event.clientX - endedGesture.downX, event.clientY - endedGesture.downY);

    if (endedGesture.mode === 'pending' && duration <= TAP_MAX_MS && displacement <= TAP_MAX_PX) {
      updateCamera();
      updateReticleTarget();
      if (reticleHit) applySingleBrushStamp();
    }

    const sculpted = endedGesture.mode === 'sculpt';
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);
    endContinuousSculpt();
    gesture = null;
    clearTimeout(longPressTimer);
    longPressTimer = 0;
    if (sculpted) {
      saveDraftSilently();
      editorStatus.textContent = `${brushModeLabel(brushMode)} stroke finished.`;
    }
  };

  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', event => {
    if (!freecamEnabled && event.pointerType === 'touch' && orbitTouches.has(event.pointerId)) {
      orbitTouches.delete(event.pointerId);
      if (orbitTouches.size < 2) orbitPinch = null;
      if (orbitTouches.size === 1) {
        const remaining = orbitTouches.values().next().value;
        orbitGestureWasPinch = true;
        beginOrbitPointer(remaining.id, remaining.x, remaining.y, { suppressTarget: true });
      } else if (orbitTouches.size === 0) {
        resetOrbitPointer();
      }
      return;
    }
    if (event.pointerId === orbitPointerId) resetOrbitPointer();
    if (gesture && event.pointerId === gesture.pointerId) cancelGesture();
  });

  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    if (freecamEnabled) return;
    orbitCamera.distance = clamp(
      orbitCamera.distance + event.deltaY * .01,
      ORBIT_MIN_DISTANCE,
      ORBIT_MAX_DISTANCE
    );
  }, { passive: false });
}

function beginContinuousSculpt() {
  if (!gesture || gesture.mode !== 'pending' || !terrain) return;
  gesture.mode = 'sculpt';
  updateCamera();
  updateReticleTarget();
  if (!reticleHit) {
    gesture.mode = 'pending';
    return;
  }
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  sculptFlattenY = brushMode === 'flatten' ? reticleHit.y : null;
  editorStatus.textContent = `${brushModeLabel(brushMode)} painting… release to stop.`;
  applyContinuousBrushStamp();
  clearInterval(continuousBrushTimer);
  continuousBrushTimer = setInterval(applyContinuousBrushStamp, CONTINUOUS_BRUSH_MS);
}

function endContinuousSculpt() {
  clearInterval(continuousBrushTimer);
  continuousBrushTimer = 0;
  sculptFlattenY = null;
}

function cancelGesture() {
  clearTimeout(longPressTimer);
  longPressTimer = 0;
  endContinuousSculpt();
  gesture = null;
}

function applyContinuousBrushStamp() {
  if (!gesture || gesture.mode !== 'sculpt' || !terrain) return;
  updateReticleTarget();
  if (!reticleHit) return;
  applyBrushAtReticle(CONTINUOUS_STRENGTH_SCALE, sculptFlattenY, false);
}

function applySingleBrushStamp() {
  if (!terrain || !reticleHit) return;
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  applyBrushAtReticle(1, brushMode === 'flatten' ? reticleHit.y : null, true);
  editorStatus.textContent = `${brushModeLabel(brushMode)} applied.`;
}

function applyBrushAtReticle(strengthScale = 1, flattenY = null, saveImmediately = false) {
  if (!terrain || !reticleHit) return;
  const radius = Number(radiusInput.value);
  const strength = Number(strengthInput.value) * strengthScale;

  if (brushMode === 'paint' || brushMode === 'erase-material') {
    const painted = terrain.paintMaterial?.({
      layerId: terrain.activeMaterialLayerId,
      x: reticleHit.x,
      z: reticleHit.z,
      radius,
      strength: Math.min(1, Math.max(0.01, strength * 0.35)),
      erase: brushMode === 'erase-material'
    });
    if (!painted) return;
    rebuildDirtyTerrainSections();
    updateReticleTarget();
    if (saveImmediately) saveDraftSilently();
    terrainStatus.textContent = `RiftLandscape · ${terrain.activeMaterialLayer?.name || 'Material'} ${brushMode === 'erase-material' ? 'erase' : 'paint'} · edit ${terrain.revision} · ${lodSummary() || 'adaptive LOD'}`;
    return;
  }

  const brush = {
    mode: brushMode,
    x: reticleHit.x,
    z: reticleHit.z,
    radius,
    strength
  };
  if (brushMode === 'flatten') brush.targetHeight = Number.isFinite(flattenY) ? flattenY : reticleHit.y;
  terrain.applyBrush(brush);
  rebuildDirtyTerrainSections();
  snapPlayerToSupport();
  updateReticleTarget();
  if (saveImmediately) saveDraftSilently();
  terrainStatus.textContent = `RiftLandscape · ${terrain.activeEditLayer?.name || 'Sculpt'} · edit ${terrain.revision} · ${lodSummary() || 'adaptive LOD'}`;
}

function updateReticleVisual() {
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
  if (!freecamEnabled) {
    reticleHit = null;
    reticle.classList.remove('no-hit');
    if (brushMesh) brushMesh.visible = false;
    return;
  }
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

function captureTerrainState() {
  return terrain?.captureEditState?.() || null;
}

function restoreTerrainState(state) {
  if (!terrain || !state || !terrain.restoreEditState?.(state)) return;
  rebuildTerrainMeshes();
  snapPlayerToSupport();
  updateReticleTarget();
  refreshTerrainLayerControls();
}

function pushUndo(state) {
  undoStack.push(state);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
}

function undoTerrain() {
  if (!terrain || !undoStack.length) return;
  redoStack.push(captureTerrainState());
  restoreTerrainState(undoStack.pop());
  saveDraftSilently();
  editorStatus.textContent = 'Undo';
}

function redoTerrain() {
  if (!terrain || !redoStack.length) return;
  pushUndo(captureTerrainState());
  restoreTerrainState(redoStack.pop());
  saveDraftSilently();
  editorStatus.textContent = 'Redo';
}

function serializeTerrainEdits() {
  if (!terrain?.serializeLandscapeEdits) return null;
  return terrain.serializeLandscapeEdits({ worldId: worldDocument?.id || 'ironvale-terrain' });
}

function applySerializedEdits(data) {
  if (!terrain || !data) return false;
  if (String(data.format || '').startsWith('rift-landscape-edits-v')) return terrain.applySerializedLandscapeEdits?.(data) === true;
  if (data.format === 'rift-terrain-edit-v2') return terrain.importLegacyManualEdits?.(data) === true;
  return false;
}

function saveDraft() {
  saveDraftSilently();
  editorStatus.textContent = 'Terrain draft saved on this device.';
}

function saveDraftSilently() {
  if (!terrain) return;
  try {
    const serialized = serializeTerrainEdits();
    if (serialized) localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(serialized));
  } catch {}
}

function restoreLocalDraft() {
  try {
    const current = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (current && applySerializedEdits(JSON.parse(current))) return;
    for (const key of LEGACY_LOCAL_DRAFT_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy && applySerializedEdits(JSON.parse(legacy))) {
        saveDraftSilently();
        return;
      }
    }
  } catch {}
}

async function exportDraft() {
  if (!terrain) return;
  const text = JSON.stringify(serializeTerrainEdits(), null, 2);
  try {
    const file = new File([text], 'ironvale-landscape-edits.json', { type: 'application/json' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Ironvale Terrain Edits' });
      editorStatus.textContent = 'Terrain draft shared.';
      return;
    }
  } catch {}
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ironvale-landscape-edits.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  editorStatus.textContent = 'Terrain draft exported.';
}

function resetTerrain() {
  if (!worldDocument || !terrain) return;
  cancelGesture();
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  terrain = new RiftLandscape(worldDocument.terrain);
  try {
    localStorage.removeItem(LOCAL_DRAFT_KEY);
    for (const key of LEGACY_LOCAL_DRAFT_KEYS) localStorage.removeItem(key);
  } catch {}
  rebuildTerrainMeshes();
  snapPlayerToSupport();
  updateReticleTarget();
  refreshTerrainLayerControls();
  terrainStatus.textContent = `640×640 blank terrain reset · ${lodSummary() || 'adaptive LOD'}`;
  editorStatus.textContent = 'Back to a perfectly flat blank canvas.';
}

function commitTerrainManagementEdit(label, mutation, { rebuild = true } = {}) {
  if (!terrain || typeof mutation !== 'function') return false;
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  const changed = mutation();
  if (changed === false || changed == null) {
    undoStack.pop();
    return false;
  }
  if (rebuild) rebuildDirtyTerrainSections();
  refreshTerrainLayerControls();
  saveDraftSilently();
  editorStatus.textContent = label;
  return true;
}

function activeEditLayerInfo() {
  return (terrain?.listEditLayers?.() || []).find(layer => layer.id === terrain.activeEditLayerId) || null;
}

function updateActiveEditLayerName() {
  const layer = activeEditLayerInfo();
  if (!layer || !editLayerNameInput) return;
  const name = editLayerNameInput.value.trim();
  if (!name || name === layer.name) return;
  commitTerrainManagementEdit(`Renamed terrain layer to ${name}.`, () => terrain.renameEditLayer(layer.id, name), { rebuild: false });
}

function moveActiveEditLayer(direction) {
  const layers = terrain?.listEditLayers?.() || [];
  const layer = activeEditLayerInfo();
  if (!layer) return;
  const target = clamp(layer.order + Math.sign(Number(direction) || 0), 0, layers.length - 1);
  if (target === layer.order) return;
  commitTerrainManagementEdit(`Moved ${layer.name} to layer ${target + 1}.`, () => terrain.moveEditLayer(layer.id, target));
}

function toggleActiveEditLayerVisibility() {
  const layer = activeEditLayerInfo();
  if (!layer) return;
  commitTerrainManagementEdit(`${layer.name} ${layer.enabled ? 'hidden' : 'visible'}.`, () => terrain.setEditLayerEnabled(layer.id, !layer.enabled));
}

function toggleActiveEditLayerLock() {
  const layer = activeEditLayerInfo();
  if (!layer) return;
  commitTerrainManagementEdit(`${layer.name} ${layer.locked ? 'unlocked' : 'locked'}.`, () => terrain.setEditLayerLocked(layer.id, !layer.locked), { rebuild: false });
}

function updateActiveEditLayerOpacity() {
  const layer = activeEditLayerInfo();
  if (!layer || !editLayerOpacityInput) return;
  const opacity = clamp(Number(editLayerOpacityInput.value), 0, 1);
  if (Math.abs(opacity - layer.opacity) < .001) return;
  commitTerrainManagementEdit(`${layer.name} opacity ${Math.round(opacity * 100)}%.`, () => terrain.setEditLayerOpacity(layer.id, opacity));
}

function deleteActiveEditLayer() {
  const layers = terrain?.listEditLayers?.() || [];
  const layer = activeEditLayerInfo();
  if (!layer || layers.length <= 1) return;
  commitTerrainManagementEdit(`Deleted terrain layer ${layer.name}.`, () => terrain.deleteEditLayer(layer.id));
}

function refreshTerrainLayerControls() {
  const layers = terrain?.listEditLayers?.() || [];
  if (editLayerSelect) {
    editLayerSelect.replaceChildren(...layers.map(layer => {
      const option = document.createElement('option');
      option.value = layer.id;
      option.textContent = `${layer.name}${layer.locked ? ' 🔒' : ''}${layer.enabled ? '' : ' · hidden'}`;
      return option;
    }));
    if (terrain?.activeEditLayerId) editLayerSelect.value = terrain.activeEditLayerId;
  }
  if (addEditLayerButton) addEditLayerButton.disabled = !terrain?.createEditLayer;
  const activeLayer = layers.find(layer => layer.id === terrain?.activeEditLayerId) || null;
  if (editLayerNameInput) {
    editLayerNameInput.disabled = !activeLayer;
    editLayerNameInput.value = activeLayer?.name || '';
  }
  if (editLayerUpButton) editLayerUpButton.disabled = !activeLayer || activeLayer.order <= 0;
  if (editLayerDownButton) editLayerDownButton.disabled = !activeLayer || activeLayer.order >= layers.length - 1;
  if (editLayerVisibleButton) {
    editLayerVisibleButton.disabled = !activeLayer;
    editLayerVisibleButton.classList.toggle('active', Boolean(activeLayer?.enabled));
    editLayerVisibleButton.textContent = activeLayer?.enabled ? 'Visible' : 'Hidden';
  }
  if (editLayerLockButton) {
    editLayerLockButton.disabled = !activeLayer;
    editLayerLockButton.classList.toggle('active', Boolean(activeLayer?.locked));
    editLayerLockButton.textContent = activeLayer?.locked ? 'Locked' : 'Lock';
  }
  if (editLayerOpacityInput) {
    editLayerOpacityInput.disabled = !activeLayer;
    editLayerOpacityInput.value = String(activeLayer?.opacity ?? 1);
  }
  if (editLayerOpacityValue) editLayerOpacityValue.textContent = `${Math.round((activeLayer?.opacity ?? 1) * 100)}%`;
  if (deleteEditLayerButton) deleteEditLayerButton.disabled = !activeLayer || layers.length <= 1;

  const materials = terrain?.listMaterialLayers?.() || [];
  if (materialLayerSelect) {
    materialLayerSelect.replaceChildren(...materials.map(layer => {
      const option = document.createElement('option');
      option.value = layer.id;
      option.textContent = `${layer.name}${layer.base ? ' · base' : ''}${layer.texture ? ' · PBR' : ''}`;
      return option;
    }));
    if (terrain?.activeMaterialLayerId) materialLayerSelect.value = terrain.activeMaterialLayerId;
    materialLayerSelect.disabled = materials.length === 0;
  }

  const splines = terrain?.listSplines?.() || [];
  if (splineSelect) {
    splineSelect.replaceChildren(...splines.map(spline => {
      const option = document.createElement('option');
      option.value = spline.id;
      option.textContent = `${spline.name} · ${spline.pointCount} pts`;
      return option;
    }));
    if (terrain?.activeSplineId) splineSelect.value = terrain.activeSplineId;
    splineSelect.disabled = splines.length === 0;
  }
  const activeSpline = terrain?.activeSpline || null;
  if (splineWidthInput) {
    splineWidthInput.disabled = !activeSpline;
    if (activeSpline) splineWidthInput.value = String(Number(activeSpline.width) || 6);
  }
  if (splineFalloffInput) {
    splineFalloffInput.disabled = !activeSpline;
    if (activeSpline) splineFalloffInput.value = String(Number(activeSpline.falloff) || 4);
  }
  if (splineWidthValue) splineWidthValue.textContent = `${activeSpline ? Number(activeSpline.width || 6).toFixed(0) : 0}m`;
  if (splineFalloffValue) splineFalloffValue.textContent = `${activeSpline ? Number(activeSpline.falloff || 4).toFixed(0) : 0}m`;
  if (addSplinePointButton) addSplinePointButton.disabled = !terrain?.appendSplinePoint;
  if (moveSplinePointButton) moveSplinePointButton.disabled = !activeSpline?.points?.length;
  if (removeSplinePointButton) removeSplinePointButton.disabled = !activeSpline?.points?.length;
  if (clearSplineButton) clearSplineButton.disabled = !activeSpline || !(activeSpline.points?.length);
  if (newSplineButton) newSplineButton.disabled = !terrain?.createSpline;
}

function createTerrainSpline() {
  if (!terrain?.createSpline) return;
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  const created = terrain.createSpline(`Spline ${terrain.listSplines().length + 1}`, {
    width: Number(splineWidthInput?.value) || 6,
    falloff: Number(splineFalloffInput?.value) || 4
  });
  refreshTerrainLayerControls();
  saveDraftSilently();
  editorStatus.textContent = `Created ${created?.name || 'landscape spline'}. Aim the Freecam reticle and tap Add Point.`;
}

function addSplinePointAtReticle() {
  if (!terrain?.appendSplinePoint) return;
  if (!freecamEnabled) {
    editorStatus.textContent = 'Enter Freecam to place landscape spline points.';
    return;
  }
  updateCamera();
  updateReticleTarget();
  if (!reticleHit) {
    editorStatus.textContent = 'Aim the centered reticle at terrain first.';
    return;
  }
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  if (!terrain.activeSplineId) terrain.createSpline(`Spline ${terrain.listSplines().length + 1}`);
  const spline = terrain.appendSplinePoint(terrain.activeSplineId, { x: reticleHit.x, y: reticleHit.y, z: reticleHit.z });
  rebuildDirtyTerrainSections();
  snapPlayerToSupport();
  updateReticleTarget();
  refreshTerrainLayerControls();
  saveDraftSilently();
  editorStatus.textContent = `${spline?.name || 'Spline'} point added · ${spline?.points?.length || 0} points.`;
}

function moveLastSplinePointToReticle() {
  const spline = terrain?.activeSpline;
  if (!terrain?.updateSplinePoint || !spline?.points?.length) return;
  if (!freecamEnabled) {
    editorStatus.textContent = 'Enter Freecam to move spline points.';
    return;
  }
  updateCamera();
  updateReticleTarget();
  if (!reticleHit) {
    editorStatus.textContent = 'Aim the centered reticle at terrain first.';
    return;
  }
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  terrain.updateSplinePoint(spline.id, spline.points.length - 1, { x: reticleHit.x, y: reticleHit.y, z: reticleHit.z });
  rebuildDirtyTerrainSections();
  snapPlayerToSupport();
  updateReticleTarget();
  refreshTerrainLayerControls();
  saveDraftSilently();
  editorStatus.textContent = `${spline.name} last point moved.`;
}

function removeLastSplinePoint() {
  const spline = terrain?.activeSpline;
  if (!terrain?.removeSplinePoint || !spline?.points?.length) return;
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  terrain.removeSplinePoint(spline.id, spline.points.length - 1);
  rebuildDirtyTerrainSections();
  snapPlayerToSupport();
  updateReticleTarget();
  refreshTerrainLayerControls();
  saveDraftSilently();
  editorStatus.textContent = `${spline.name} last point removed.`;
}

function clearActiveTerrainSpline() {
  if (!terrain?.activeSplineId || !terrain?.clearSpline) return;
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  terrain.clearSpline(terrain.activeSplineId);
  rebuildDirtyTerrainSections();
  snapPlayerToSupport();
  updateReticleTarget();
  refreshTerrainLayerControls();
  saveDraftSilently();
  editorStatus.textContent = 'Active landscape spline cleared.';
}

function updateActiveSplineSettings() {
  if (!terrain?.activeSplineId || !terrain?.updateSpline) return;
  pushUndo(captureTerrainState());
  redoStack.length = 0;
  terrain.updateSpline(terrain.activeSplineId, {
    width: Number(splineWidthInput?.value) || 6,
    falloff: Number(splineFalloffInput?.value) || 4
  });
  rebuildDirtyTerrainSections();
  snapPlayerToSupport();
  updateReticleTarget();
  refreshTerrainLayerControls();
  saveDraftSilently();
  editorStatus.textContent = 'Landscape spline width/falloff updated.';
}

function refreshEditorLabels() {
  const radius = Number(radiusInput.value);
  const strength = Number(strengthInput.value);
  const speed = Number(freecamSpeedInput.value);
  radiusValue.textContent = `${radius}m`;
  strengthValue.textContent = strength.toFixed(1);
  freecamSpeedValue.textContent = `${speed}m/s`;
  if (!freecamEnabled) brushReadout.textContent = `${brushModeLabel(brushMode)} · ${radius}m`;
  else updateReticleTarget();
}

function brushModeLabel(mode) {
  return ({ raise: 'Raise', lower: 'Lower', smooth: 'Smooth', flatten: 'Flatten', hole: 'Cut Hole', unhole: 'Fill Hole', paint: 'Paint Material', 'erase-material': 'Erase Material' })[mode] || mode;
}

function rebuildBrushMarker() {
  if (!engine) return;
  if (brushMesh) engine.removeMesh(brushMesh);
  brushMesh = engine.addMesh(createRingGeometry(Number(radiusInput.value)), { position: [0, -999999, 0] });
  brushMesh.visible = freecamEnabled && Boolean(reticleHit);
  updateBrushMarkerPosition();
}

function updateBrushMarkerPosition() {
  if (!brushMesh) return;
  brushMesh.visible = freecamEnabled && Boolean(reticleHit);
  if (reticleHit) brushMesh.position = [reticleHit.x, reticleHit.y + .035, reticleHit.z];
}

async function savePosition(useKeepalive = false) {
  if (!engine || freecamEnabled) return;
  try {
    await fetch('/api/character/position', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: player.x, y: player.y, z: player.z, yaw: player.yaw }),
      keepalive: useKeepalive
    });
  } catch {}
}

async function api(path, options = {}) {
  const request = { method: options.method || 'GET', headers: {} };
  if (options.body !== undefined) {
    request.headers['Content-Type'] = 'application/json';
    request.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, request);
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok && !data.error) data.error = `Request failed (${response.status})`;
  return data;
}

function setAuthStatus(message, error = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle('error', error);
}

function setupJoystick() {
  const stick = $('#joystick');
  const knob = $('#joystick-knob');
  let pointerId = null;
  const max = 34;
  const update = event => {
    const rect = stick.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > max) { dx *= max / length; dy *= max / length; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    input.strafe = dx / max;
    input.forward = -dy / max;
  };
  stick.addEventListener('pointerdown', event => {
    event.stopPropagation();
    pointerId = event.pointerId;
    joystickActive = true;
    stick.setPointerCapture(pointerId);
    update(event);
  });
  stick.addEventListener('pointermove', event => { if (event.pointerId === pointerId) update(event); });
  const end = event => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    joystickActive = false;
    input.forward = 0;
    input.strafe = 0;
    knob.style.transform = 'translate(0,0)';
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
}

function moveAngleToward(current, target, maxDelta) {
  const delta = wrapAngle(target - current);
  return wrapAngle(current + clamp(delta, -maxDelta, maxDelta));
}

function wrapAngle(angle) {
  if (!Number.isFinite(angle)) return 0;
  let wrapped = (angle + Math.PI) % (Math.PI * 2);
  if (wrapped < 0) wrapped += Math.PI * 2;
  return wrapped - Math.PI;
}

function cameraForward(yaw, pitch) {
  const cp = Math.cos(pitch);
  return normalize3(
    -Math.sin(yaw) * cp,
    -Math.sin(pitch),
    -Math.cos(yaw) * cp
  );
}

function cameraAnglesFromDirection(direction) {
  const x = Number(direction?.[0]) || 0;
  const y = Number(direction?.[1]) || 0;
  const z = Number(direction?.[2]) || -1;
  const horizontal = Math.hypot(x, z);
  return {
    yaw: wrapAngle(Math.atan2(-x, -z)),
    pitch: Math.atan2(-y, Math.max(1e-6, horizontal))
  };
}

function cameraGroundBasis(yaw) {
  const wrapped = wrapAngle(yaw);
  return {
    forwardX: -Math.sin(wrapped),
    forwardZ: -Math.cos(wrapped),
    rightX: Math.cos(wrapped),
    rightZ: -Math.sin(wrapped)
  };
}

function applyCameraLookDelta(camera, dx, dy, minPitch, maxPitch) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Number(rect.width) || Number(canvas.clientWidth) || 1);
  const height = Math.max(1, Number(rect.height) || Number(canvas.clientHeight) || 1);
  const safeDx = clamp(Number(dx) || 0, -width * CAMERA_MAX_EVENT_FRACTION, width * CAMERA_MAX_EVENT_FRACTION);
  const safeDy = clamp(Number(dy) || 0, -height * CAMERA_MAX_EVENT_FRACTION, height * CAMERA_MAX_EVENT_FRACTION);
  const fovScale = clamp((Number(camera.fov) || CAMERA_REFERENCE_FOV) / CAMERA_REFERENCE_FOV, 0.55, 1.8);
  camera.yaw = wrapAngle(camera.yaw - (safeDx / width) * CAMERA_YAW_RADIANS_PER_VIEW * fovScale);
  camera.pitch = clamp(camera.pitch + (safeDy / height) * CAMERA_PITCH_RADIANS_PER_VIEW * fovScale, minPitch, maxPitch);
}

function freecamForward() {
  return cameraForward(freecam.yaw, freecam.pitch);
}

function setTerrainDebug(enabled) {
  terrainDebugEnabled = Boolean(enabled) && Boolean(engine) && Boolean(terrain);
  terrainDebugToggle?.classList.toggle('active', terrainDebugEnabled);
  if (!terrainDebugEnabled) {
    if (terrainDebugMesh && engine) engine.removeMesh(terrainDebugMesh);
    terrainDebugMesh = null;
    if (terrainDebugReadout) terrainDebugReadout.textContent = 'Debug overlay off.';
    return;
  }
  rebuildTerrainDebugOverlay();
  refreshTerrainDebugReadout();
}

function refreshTerrainDebugReadout(visibleOverride = null) {
  if (!terrainDebugReadout || !terrain) return;
  let visible = Number.isFinite(Number(visibleOverride)) ? Number(visibleOverride) : 0;
  let triangles = 0;
  for (const entry of terrainMeshes.values()) {
    if (entry.mesh?.visible) {
      if (!Number.isFinite(Number(visibleOverride))) visible += 1;
      triangles += Number(entry.triangles) || 0;
    }
  }
  const activeComponents = terrainStreamPlan?.active?.size ?? terrain.componentCounts().x * terrain.componentCounts().z;
  const preloadComponents = terrainStreamPlan?.preload?.size ?? 0;
  const collision = terrain.collisionLodStepAt?.(
    player.x, player.z,
    Number(lastCameraPosition?.[0]) || player.x,
    Number(lastCameraPosition?.[2]) || player.z
  ) ?? 1;
  const fps = terrainPerfAverageMs > 0 ? Math.round(1000 / terrainPerfAverageMs) : 0;
  terrainDebugReadout.textContent =
    `sections ${visible}/${terrainMeshes.size} · tris ${Math.round(triangles).toLocaleString()}\n` +
    `components active ${activeComponents} + preload ${preloadComponents} · collision LOD ${collision}m\n` +
    `render ${engine?.pixelRatioCap?.toFixed?.(2) || '1.00'}x cap · ${fps ? `${fps} fps avg` : 'warming up'}`;
}

function debugStrip(vertices, indices, ax, az, bx, bz, width, color) {
  const ay = (terrain?.sampleHeight(ax, az) ?? terrain?.baseHeight ?? 0) + .08;
  const by = (terrain?.sampleHeight(bx, bz) ?? terrain?.baseHeight ?? 0) + .08;
  const dx = bx - ax, dz = bz - az;
  const length = Math.hypot(dx, dz) || 1;
  const px = -dz / length * width * .5, pz = dx / length * width * .5;
  const base = vertices.length / 9;
  for (const [x, y, z] of [
    [ax + px, ay, az + pz], [ax - px, ay, az - pz],
    [bx + px, by, bz + pz], [bx - px, by, bz - pz]
  ]) vertices.push(x, y, z, 0, 1, 0, color[0], color[1], color[2]);
  indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
}

function createTerrainDebugOverlayGeometry() {
  if (!terrain) return null;
  const vertices = [];
  const indices = [];
  const lodColors = [
    [0.25, 1.0, 0.35],
    [0.35, 0.75, 1.0],
    [1.0, 0.85, 0.25],
    [1.0, 0.55, 0.18],
    [1.0, 0.28, 0.28]
  ];
  for (const [key, section] of terrainLodPlan) {
    if (!sectionIsStreamed(section)) continue;
    const entry = terrainMeshes.get(key);
    if (!entry) continue;
    const b = section.bounds;
    const color = lodColors[Math.max(0, Math.min(lodColors.length - 1, section.lodLevel || 0))];
    debugStrip(vertices, indices, b.minX, b.minZ, b.maxX, b.minZ, .16, color);
    debugStrip(vertices, indices, b.maxX, b.minZ, b.maxX, b.maxZ, .16, color);
    debugStrip(vertices, indices, b.maxX, b.maxZ, b.minX, b.maxZ, .16, color);
    debugStrip(vertices, indices, b.minX, b.maxZ, b.minX, b.minZ, .16, color);
  }
  for (const componentId of terrainStreamPlan?.active || []) {
    const match = /^component-(\d+)-(\d+)$/.exec(componentId);
    if (!match) continue;
    const component = terrain.getComponentDescriptor(Number(match[1]), Number(match[2]));
    const b = component.bounds;
    const color = [0.95, 0.95, 1.0];
    debugStrip(vertices, indices, b.minX, b.minZ, b.maxX, b.minZ, .34, color);
    debugStrip(vertices, indices, b.maxX, b.minZ, b.maxX, b.maxZ, .34, color);
    debugStrip(vertices, indices, b.maxX, b.maxZ, b.minX, b.maxZ, .34, color);
    debugStrip(vertices, indices, b.minX, b.maxZ, b.minX, b.minZ, .34, color);
  }
  if (!indices.length) return null;
  const IndexType = vertices.length / 9 > 65535 ? Uint32Array : Uint16Array;
  return { vertices: new Float32Array(vertices), indices: new IndexType(indices), vertexStride: 9 };
}

function rebuildTerrainDebugOverlay() {
  if (!engine) return;
  if (terrainDebugMesh) {
    engine.removeMesh(terrainDebugMesh);
    terrainDebugMesh = null;
  }
  if (!terrainDebugEnabled) return;
  const geometry = createTerrainDebugOverlayGeometry();
  if (!geometry) return;
  terrainDebugMesh = engine.addMesh(geometry);
}

function createRingGeometry(radius) {
  const segments = 64;
  const width = Math.max(.08, radius * .025);
  const vertices = [];
  const indices = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = i / segments * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (const r of [Math.max(.05, radius - width), radius + width]) {
      vertices.push(c * r, 0, s * r, 0, 1, 0, .95, .72, .18);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    const n = (i + 1) % segments;
    const a = i * 2;
    const b = a + 1;
    const c = n * 2;
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices), vertexStride: 9 };
}

function createCapsuleGeometry() {
  const radial = 12;
  const rings = [];
  const radius = .36;
  const half = .48;
  for (let i = 0; i <= 4; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI / 2) * (i / 4);
    rings.push({ y: -half + Math.sin(angle) * radius, r: Math.cos(angle) * radius, ny: Math.sin(angle), nr: Math.cos(angle) });
  }
  for (let i = 1; i <= 4; i += 1) {
    const angle = (Math.PI / 2) * (i / 4);
    rings.push({ y: half + Math.sin(angle) * radius, r: Math.cos(angle) * radius, ny: Math.sin(angle), nr: Math.cos(angle) });
  }
  const vertices = [];
  const indices = [];
  for (const ring of rings) {
    for (let side = 0; side < radial; side += 1) {
      const angle = side / radial * Math.PI * 2;
      const x = Math.cos(angle) * ring.r;
      const z = Math.sin(angle) * ring.r;
      const nx = Math.cos(angle) * ring.nr;
      const nz = Math.sin(angle) * ring.nr;
      vertices.push(x, ring.y, z, nx, ring.ny, nz, .30, .43, .34);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < radial; side += 1) {
      const next = (side + 1) % radial;
      const a = ring * radial + side;
      const b = ring * radial + next;
      const c = (ring + 1) * radial + side;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices), vertexStride: 9 };
}

function normalize3(x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
