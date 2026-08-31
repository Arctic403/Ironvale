import { RiftEngine } from './rift-engine.js';
import { RiftTerrain } from './rift-terrain.js';

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

const TERRAIN_RENDER_LOD = 2;
const LOCAL_DRAFT_KEY = 'ironvale:terrain:draft:v2';
const MAX_HISTORY = 10;
const LONG_PRESS_MS = 260;
const LOOK_START_PX = 9;
const TAP_MAX_MS = 220;
const TAP_MAX_PX = 7;
const CONTINUOUS_BRUSH_MS = 75;
const CONTINUOUS_STRENGTH_SCALE = 0.2;

let authMode = 'login';
let engine = null;
let terrain = null;
let worldDocument = null;
let terrainMeshes = new Map();
let playerMesh = null;
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
const reticleScreen = { u: .5, v: .5 };
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
    orbitCamera.yaw = player.yaw + Math.PI;
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
  rebuildTerrainMeshes();

  const spawn = worldDocument?.anchors?.starter_spawn || { x: 320, z: 320 };
  if (!terrain.containsXZ(player.x, player.z)) {
    player.x = spawn.x;
    player.z = spawn.z;
  }

  playerMesh = engine.addMesh(createCapsuleGeometry(), { position: [player.x, player.y, player.z] });
  snapPlayerToSupport();
  updateOrbitCamera();
  const stats = terrain.getStats?.() || {};
  terrainStatus.textContent = `640×640 blank terrain · ${stats.surfaceChunks ?? terrainMeshes.size} render chunks · LOD ${TERRAIN_RENDER_LOD}`;
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
  playerMesh = null;
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

function rebuildTerrainMeshes() {
  if (!engine || !terrain) return;
  for (const mesh of terrainMeshes.values()) engine.removeMesh(mesh);
  terrainMeshes.clear();
  const chunksX = Math.ceil(terrain.width / terrain.chunkSize);
  const chunksZ = Math.ceil(terrain.depth / terrain.chunkSize);
  for (let cz = 0; cz < chunksZ; cz += 1) {
    for (let cx = 0; cx < chunksX; cx += 1) {
      const entry = terrain.buildSurfaceChunkGeometry(cx, cz, TERRAIN_RENDER_LOD);
      terrainMeshes.set(`${cx}:${cz}`, engine.addMesh(entry.geometry || entry));
    }
  }
  rebuildBrushMarker();
}

function rebuildTerrainArea(x, z, radius) {
  if (!engine || !terrain) return;
  const chunksX = Math.ceil(terrain.width / terrain.chunkSize);
  const chunksZ = Math.ceil(terrain.depth / terrain.chunkSize);
  const minCx = clamp(Math.floor((x - radius - terrain.origin[0]) / terrain.chunkSize), 0, chunksX - 1);
  const maxCx = clamp(Math.floor((x + radius - terrain.origin[0]) / terrain.chunkSize), 0, chunksX - 1);
  const minCz = clamp(Math.floor((z - radius - terrain.origin[2]) / terrain.chunkSize), 0, chunksZ - 1);
  const maxCz = clamp(Math.floor((z + radius - terrain.origin[2]) / terrain.chunkSize), 0, chunksZ - 1);
  for (let cz = minCz; cz <= maxCz; cz += 1) {
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      const key = `${cx}:${cz}`;
      const entry = terrain.buildSurfaceChunkGeometry(cx, cz, TERRAIN_RENDER_LOD);
      const mesh = terrainMeshes.get(key);
      if (mesh) engine.updateMesh(mesh, entry.geometry || entry);
      else terrainMeshes.set(key, engine.addMesh(entry.geometry || entry));
    }
  }
}

function snapPlayerToSupport() {
  if (!terrain) return;
  const surface = terrain.supportAtPoint(player.x, player.z, player.y - .9, { maxRise: 1000, maxDrop: 10000 });
  if (surface != null) {
    player.y = surface + .9;
    player.vy = 0;
    player.grounded = true;
  }
  if (playerMesh) playerMesh.position = [player.x, player.y, player.z];
}

function frame(now) {
  if (!engine || !terrain) return;
  const dt = Math.min(.05, Math.max(.001, (now - lastFrame) / 1000));
  lastFrame = now;
  updateKeyboardInput();
  if (freecamEnabled) updateFreecam(dt);
  else updatePlayer(dt);
  updateCamera();
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
  if (moving) {
    const forwardX = -Math.sin(orbitCamera.yaw);
    const forwardZ = -Math.cos(orbitCamera.yaw);
    const rightX = Math.cos(orbitCamera.yaw);
    const rightZ = -Math.sin(orbitCamera.yaw);
    let dx = forwardX * input.forward + rightX * input.strafe;
    let dz = forwardZ * input.forward + rightZ * input.strafe;
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

  if (playerMesh) {
    playerMesh.position[0] = player.x;
    playerMesh.position[1] = player.y;
    playerMesh.position[2] = player.z;
    playerMesh.yaw = player.yaw;
  }
}

function updateFreecam(dt) {
  const speed = Number(freecamSpeedInput.value) || 14;
  const forwardX = -Math.sin(freecam.yaw);
  const forwardZ = -Math.cos(freecam.yaw);
  const rightX = Math.cos(freecam.yaw);
  const rightZ = -Math.sin(freecam.yaw);
  freecam.x += (forwardX * input.forward + rightX * input.strafe) * speed * dt;
  freecam.z += (forwardZ * input.forward + rightZ * input.strafe) * speed * dt;

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
  const targetY = player.y + .7;
  const horizontal = Math.cos(orbitCamera.pitch) * orbitCamera.distance;
  const position = [
    player.x + Math.sin(orbitCamera.yaw) * horizontal,
    targetY + Math.sin(orbitCamera.pitch) * orbitCamera.distance,
    player.z + Math.cos(orbitCamera.yaw) * horizontal
  ];
  const target = [player.x, targetY, player.z];
  lastCameraPosition = position;
  lastCameraTarget = target;
  engine.setCamera({ position, target, fov: orbitCamera.fov, near: .08, far: 1000 });
}

function setFreecam(enabled, { preserveCamera = true } = {}) {
  const next = Boolean(enabled) && Boolean(terrain) && Boolean(engine);
  if (next === freecamEnabled) return;
  cancelGesture();
  if (next && preserveCamera) {
    const direction = normalize3(
      lastCameraTarget[0] - lastCameraPosition[0],
      lastCameraTarget[1] - lastCameraPosition[1],
      lastCameraTarget[2] - lastCameraPosition[2]
    );
    freecam.x = lastCameraPosition[0];
    freecam.y = lastCameraPosition[1];
    freecam.z = lastCameraPosition[2];
    freecam.yaw = Math.atan2(-direction[0], -direction[2]);
    freecam.pitch = Math.asin(clamp(-direction[1], -1, 1));
  }
  freecamEnabled = next;
  freecamVertical = 0;
  input.forward = 0;
  input.strafe = 0;
  reticleScreen.u = .5;
  reticleScreen.v = .5;
  updateReticleVisual();
  worldScreen.classList.toggle('freecam', freecamEnabled);
  freecamButton.classList.toggle('active', freecamEnabled);
  freecamButton.textContent = freecamEnabled ? 'Freecam ON' : 'Freecam';
  reticle.hidden = !freecamEnabled;
  altitudeControls.hidden = !freecamEnabled;
  brushReadout.hidden = !freecamEnabled;
  reticleHit = null;
  if (brushMesh) brushMesh.visible = false;
  editorStatus.textContent = freecamEnabled
    ? 'Swipe to look. Hold, then drag to sculpt continuously. Tap for one stamp.'
    : 'Turn Freecam ON to sculpt terrain.';
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

    moveReticleToClient(event.clientX, event.clientY);

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
      orbitCamera.yaw -= dx * .005;
      orbitCamera.pitch = clamp(orbitCamera.pitch + dy * .004, -.12, 1.05);
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
      freecam.yaw -= dx * .005;
      freecam.pitch = clamp(freecam.pitch + dy * .004, -1.48, 1.48);
      return;
    }

    if (gesture.mode === 'sculpt') {
      moveReticleToClient(event.clientX, event.clientY);
      applyContinuousBrushStamp();
    }
  });

  const finish = event => {
    if (!freecamEnabled) {
      if (event.pointerId === orbitPointerId) orbitPointerId = null;
      return;
    }
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const endedGesture = gesture;
    const duration = performance.now() - endedGesture.downAt;
    const displacement = Math.hypot(event.clientX - endedGesture.downX, event.clientY - endedGesture.downY);

    if (endedGesture.mode === 'pending' && duration <= TAP_MAX_MS && displacement <= TAP_MAX_PX) {
      moveReticleToClient(event.clientX, event.clientY);
      updateReticleTarget();
      if (reticleHit) applySingleBrushStamp();
    }

    const sculpted = endedGesture.mode === 'sculpt';
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
  moveReticleToClient(gesture.x, gesture.y);
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
  moveReticleToClient(gesture.x, gesture.y);
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
  rebuildTerrainArea(reticleHit.x, reticleHit.z, radius + terrain.sampleSpacing * 2);
  snapPlayerToSupport();
  updateReticleTarget();
  if (saveImmediately) saveDraftSilently();
  terrainStatus.textContent = `640×640 blank terrain · edit revision ${terrain.revision}`;
}

function moveReticleToClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const safeX = clamp(clientX - rect.left, 18, Math.max(18, rect.width - 18));
  const safeY = clamp(clientY - rect.top, 18, Math.max(18, rect.height - 18));
  reticleScreen.u = safeX / Math.max(1, rect.width);
  reticleScreen.v = safeY / Math.max(1, rect.height);
  updateReticleVisual();
  updateReticleTarget();
}

function updateReticleVisual() {
  const left = `${reticleScreen.u * 100}%`;
  const top = `${reticleScreen.v * 100}%`;
  reticle.style.left = left;
  reticle.style.top = top;
  brushReadout.style.left = left;
  brushReadout.style.top = `calc(${top} + 25px)`;
}

function updateReticleTarget() {
  if (!freecamEnabled || !terrain) {
    reticleHit = null;
    reticle.classList.remove('no-hit');
    if (brushMesh) brushMesh.visible = false;
    return;
  }
  reticleHit = raycastTerrainAtReticle();
  reticle.classList.toggle('no-hit', !reticleHit);
  if (reticleHit) {
    brushReadout.textContent = `${brushModeLabel(brushMode)} · ${Number(radiusInput.value)}m · Y ${reticleHit.y.toFixed(1)}`;
    updateBrushMarkerPosition();
  } else {
    brushReadout.textContent = `${brushModeLabel(brushMode)} · no terrain under reticle`;
    if (brushMesh) brushMesh.visible = false;
  }
}

function raycastTerrainAtReticle() {
  const rect = canvas.getBoundingClientRect();
  const clientX = rect.left + reticleScreen.u * rect.width;
  const clientY = rect.top + reticleScreen.v * rect.height;
  return raycastTerrainAtScreen(clientX, clientY);
}

function raycastTerrainAtScreen(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  const ny = 1 - ((clientY - rect.top) / Math.max(1, rect.height)) * 2;
  const forward = normalize3(
    lastCameraTarget[0] - lastCameraPosition[0],
    lastCameraTarget[1] - lastCameraPosition[1],
    lastCameraTarget[2] - lastCameraPosition[2]
  );
  const right = normalize3(...cross3(forward, [0, 1, 0]));
  const up = normalize3(...cross3(right, forward));
  const tangent = Math.tan(freecam.fov / 2);
  const aspect = rect.width / Math.max(1, rect.height);
  const direction = normalize3(
    forward[0] + right[0] * nx * tangent * aspect + up[0] * ny * tangent,
    forward[1] + right[1] * nx * tangent * aspect + up[1] * ny * tangent,
    forward[2] + right[2] * nx * tangent * aspect + up[2] * ny * tangent
  );

  let previous = null;
  for (let t = .2; t <= 1800; t += 1) {
    const x = lastCameraPosition[0] + direction[0] * t;
    const y = lastCameraPosition[1] + direction[1] * t;
    const z = lastCameraPosition[2] + direction[2] * t;
    const height = terrain.sampleHeight(x, z);
    if (height == null) { previous = null; continue; }
    const diff = y - height;
    if (Math.abs(diff) < .02) return { x, y: height, z };
    if (previous && previous.diff > 0 && diff <= 0) {
      let low = previous.t, high = t;
      for (let i = 0; i < 10; i += 1) {
        const mid = (low + high) / 2;
        const mx = lastCameraPosition[0] + direction[0] * mid;
        const my = lastCameraPosition[1] + direction[1] * mid;
        const mz = lastCameraPosition[2] + direction[2] * mid;
        const mh = terrain.sampleHeight(mx, mz);
        if (mh == null || my - mh > 0) low = mid;
        else high = mid;
      }
      const finalT = (low + high) / 2;
      const fx = lastCameraPosition[0] + direction[0] * finalT;
      const fz = lastCameraPosition[2] + direction[2] * finalT;
      return { x: fx, y: terrain.sampleHeight(fx, fz) ?? 0, z: fz };
    }
    previous = { t, diff };
  }
  return null;
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
  terrainStatus.textContent = '640×640 blank terrain reset';
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

function freecamForward() {
  const cp = Math.cos(freecam.pitch);
  return normalize3(
    -Math.sin(freecam.yaw) * cp,
    -Math.sin(freecam.pitch),
    -Math.cos(freecam.yaw) * cp
  );
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
