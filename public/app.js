import { RiftEngine } from './rift-engine.js?v=20260831-character-freecam-r2';
import { RiftTerrain } from './rift-terrain.js?v=20260831-character-freecam-r2';
import { loadRiggedCharacterAsset } from './rift-character.js?v=20260831-character-sparse-r1';

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
const reticle = $('#terrain-reticle');
const altitudeControls = $('#freecam-altitude');

const TERRAIN_LOD_REFRESH_MS = 180;
const TERRAIN_LOD_FALLBACK_STEP = 2;
const LOCAL_DRAFT_KEY = 'ironvale:terrain:draft:v2';
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

let authMode = 'login';
let engine = null;
let terrain = null;
let worldDocument = null;
let terrainMeshes = new Map();
let terrainLodPlan = new Map();
let lastTerrainLodRefresh = 0;
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

const player = { x: 320, y: .9, z: 320, yaw: 0, vy: 0, grounded: true };
const orbitCamera = { yaw: Math.PI, pitch: .34, distance: 9.5, fov: Math.PI / 3 };
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

document.querySelectorAll('[data-brush]').forEach(button => button.addEventListener('click', () => {
  brushMode = button.dataset.brush;
  document.querySelectorAll('[data-brush]').forEach(item => item.classList.toggle('active', item === button));
  refreshEditorLabels();
}));

radiusInput.addEventListener('input', () => { refreshEditorLabels(); rebuildBrushMarker(); });
strengthInput.addEventListener('input', refreshEditorLabels);
freecamSpeedInput.addEventListener('input', refreshEditorLabels);
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
    console.error(error);
    showAuth();
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
  terrain = new RiftTerrain(worldDocument.terrain);
  restoreLocalDraft();
  engine = new RiftEngine(canvas);
  engine.environment.fogNear = 320;
  engine.environment.fogFar = 1200;
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
  updateOrbitCamera();
  reticle.hidden = false;
  updateReticleVisual();
  updateReticleTarget();
  const stats = terrain.getStats?.() || {};
  terrainStatus.textContent = `640×640 · ${stats.components ?? 25} components · ${stats.surfaceSections ?? terrainMeshes.size} sections · adaptive LOD`;
  lastFrame = performance.now();
  animationFrame = requestAnimationFrame(frame);
}

function stopWorld() {
  cancelGesture();
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  if (engine) engine.destroy();
  engine = null;
  terrain = null;
  worldDocument = null;
  terrainMeshes = new Map();
  terrainLodPlan = new Map();
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
  worldScreen.classList.remove('freecam');
  freecamButton.classList.remove('active');
  freecamButton.textContent = 'Freecam';
  reticle.hidden = true;
  altitudeControls.hidden = true;
  brushReadout.hidden = true;
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
    existing.lodStep = section.lodStep;
    existing.signature = signature;
    existing.componentId = section.componentId;
  } else {
    terrainMeshes.set(key, {
      mesh: engine.addMesh(entry.geometry || entry),
      lodStep: section.lodStep,
      signature,
      componentId: section.componentId
    });
  }
}

function rebuildTerrainMeshes() {
  if (!engine || !terrain) return;
  for (const entry of terrainMeshes.values()) if (entry?.mesh) engine.removeMesh(entry.mesh);
  terrainMeshes.clear();

  terrainLodPlan = terrain.planSectionLods(player.x, player.z);
  for (const section of terrainLodPlan.values()) buildTerrainSection(section, terrainLodPlan, true);
  terrain.consumeDirtySections();
  lastTerrainLodRefresh = performance.now();
  rebuildBrushMarker();
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
  if (!force && now - lastTerrainLodRefresh < TERRAIN_LOD_REFRESH_MS) return;
  lastTerrainLodRefresh = now;

  const cameraX = Number(lastCameraPosition?.[0]);
  const cameraZ = Number(lastCameraPosition?.[2]);
  const nextPlan = terrain.planSectionLods(
    Number.isFinite(cameraX) ? cameraX : player.x,
    Number.isFinite(cameraZ) ? cameraZ : player.z
  );

  for (const section of nextPlan.values()) {
    const neighbors = terrain.sectionNeighborLods(nextPlan, section.sectionX, section.sectionZ, section.lodStep);
    const signature = sectionSignature(section, neighbors);
    const existing = terrainMeshes.get(section.key);
    if (force || !existing || existing.signature !== signature) buildTerrainSection(section, nextPlan, true);
  }

  terrainLodPlan = nextPlan;
}

function rebuildDirtyTerrainSections() {
  if (!engine || !terrain) return;
  if (!terrainLodPlan.size) terrainLodPlan = terrain.planSectionLods(player.x, player.z);
  const dirty = terrain.consumeDirtySections();
  for (const key of dirty) {
    const section = terrainLodPlan.get(key);
    if (section) buildTerrainSection(section, terrainLodPlan, true);
  }
}

function rebuildTerrainArea(x, z, radius) {
  if (!terrain) return;
  terrain.markDirtyRegion(x, z, radius);
  rebuildDirtyTerrainSections();
}

function snapPlayerToSupport() {
  if (!terrain) return;
  const surface = terrain.supportAtPoint(player.x, player.z, player.y - .9, { maxRise: 1000, maxDrop: 10000 });
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
  updateCamera();
  updateTerrainLod(now);
  updateReticleTarget();
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
    const support = terrain.supportAtPoint(nextX, nextZ, player.y - .9, { maxRise: .9, maxDrop: 3.2 });
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
    const support = terrain.supportAtPoint(player.x, player.z, player.y - .9, { maxRise: .35, maxDrop: 1.5 });
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
  reticle.hidden = false;
  altitudeControls.hidden = !freecamEnabled;
  brushReadout.hidden = !freecamEnabled;
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

  canvas.addEventListener('contextmenu', event => {
    if (freecamEnabled) event.preventDefault();
  });

  canvas.addEventListener('pointerdown', event => {
    if (!freecamEnabled) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      orbitPointerId = event.pointerId;
      orbitLastX = event.clientX;
      orbitLastY = event.clientY;
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
      if (event.pointerId !== orbitPointerId) return;
      const dx = event.clientX - orbitLastX;
      const dy = event.clientY - orbitLastY;
      orbitLastX = event.clientX;
      orbitLastY = event.clientY;
      applyCameraLookDelta(orbitCamera, dx, dy, ORBIT_MIN_PITCH, ORBIT_MAX_PITCH);
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
      if (event.pointerId === orbitPointerId) orbitPointerId = null;
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
    if (event.pointerId === orbitPointerId) orbitPointerId = null;
    if (gesture && event.pointerId === gesture.pointerId) cancelGesture();
  });

  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    if (freecamEnabled) return;
    orbitCamera.distance = clamp(orbitCamera.distance + event.deltaY * .01, 3.5, 28);
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
  const brush = {
    mode: brushMode,
    x: reticleHit.x,
    z: reticleHit.z,
    radius,
    strength: Number(strengthInput.value) * strengthScale
  };
  if (brushMode === 'flatten') brush.targetHeight = Number.isFinite(flattenY) ? flattenY : reticleHit.y;
  terrain.applyBrush(brush);
  rebuildDirtyTerrainSections();
  snapPlayerToSupport();
  updateReticleTarget();
  if (saveImmediately) saveDraftSilently();
  terrainStatus.textContent = `640×640 · edit ${terrain.revision} · ${lodSummary() || 'adaptive LOD'}`;
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

function captureTerrainState() {
  return {
    heights: new Float32Array(terrain.heights),
    manualDelta: new Float32Array(terrain.manualDelta),
    manualHoles: new Uint8Array(terrain.manualHoles),
    revision: terrain.revision
  };
}

function restoreTerrainState(state) {
  if (!terrain || !state) return;
  terrain.heights.set(state.heights);
  terrain.manualDelta.set(state.manualDelta);
  terrain.manualHoles.set(state.manualHoles);
  terrain.revision = state.revision + 1;
  rebuildTerrainMeshes();
  snapPlayerToSupport();
  updateReticleTarget();
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
  const delta = [];
  for (let i = 0; i < terrain.manualDelta.length; i += 1) {
    const value = terrain.manualDelta[i];
    if (Math.abs(value) > .0001) delta.push([i, Number(value.toFixed(4))]);
  }
  const holes = [];
  for (let i = 0; i < terrain.manualHoles.length; i += 1) if (terrain.manualHoles[i]) holes.push(i);
  return {
    format: 'rift-terrain-edit-v2',
    worldId: worldDocument?.id || 'ironvale-terrain',
    width: terrain.width,
    depth: terrain.depth,
    sampleSpacing: terrain.sampleSpacing,
    savedAt: Date.now(),
    delta,
    holes
  };
}

function applySerializedEdits(data) {
  if (!terrain || !data || data.format !== 'rift-terrain-edit-v2') return false;
  if (Number(data.width) !== terrain.width || Number(data.depth) !== terrain.depth || Number(data.sampleSpacing) !== terrain.sampleSpacing) return false;
  terrain = new RiftTerrain(worldDocument.terrain);
  for (const entry of data.delta || []) {
    const index = Number(entry[0]);
    const value = Number(entry[1]);
    if (Number.isInteger(index) && index >= 0 && index < terrain.manualDelta.length && Number.isFinite(value)) {
      terrain.manualDelta[index] = value;
      terrain.heights[index] += value;
    }
  }
  for (const indexValue of data.holes || []) {
    const index = Number(indexValue);
    if (Number.isInteger(index) && index >= 0 && index < terrain.manualHoles.length) terrain.manualHoles[index] = 1;
  }
  terrain.revision += 1;
  return true;
}

function saveDraft() {
  saveDraftSilently();
  editorStatus.textContent = 'Terrain draft saved on this device.';
}

function saveDraftSilently() {
  if (!terrain) return;
  try { localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(serializeTerrainEdits())); } catch {}
}

function restoreLocalDraft() {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (raw) applySerializedEdits(JSON.parse(raw));
  } catch {}
}

async function exportDraft() {
  if (!terrain) return;
  const text = JSON.stringify(serializeTerrainEdits(), null, 2);
  try {
    const file = new File([text], 'ironvale-terrain-edits.json', { type: 'application/json' });
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
  link.download = 'ironvale-terrain-edits.json';
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
  terrain = new RiftTerrain(worldDocument.terrain);
  try { localStorage.removeItem(LOCAL_DRAFT_KEY); } catch {}
  rebuildTerrainMeshes();
  snapPlayerToSupport();
  updateReticleTarget();
  terrainStatus.textContent = `640×640 blank terrain reset · ${lodSummary() || 'adaptive LOD'}`;
  editorStatus.textContent = 'Back to a perfectly flat blank canvas.';
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
  return ({ raise: 'Raise', lower: 'Lower', smooth: 'Smooth', flatten: 'Flatten', hole: 'Cut Hole', unhole: 'Fill Hole' })[mode] || mode;
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
