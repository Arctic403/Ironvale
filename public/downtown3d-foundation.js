import { DOWNTOWN3D_FOUNDATION as CONFIG } from './downtown3d-config.js';
import { DOWNTOWN_ROAD_NETWORK } from './downtown-road-network.js';
import { RiftCamera, RiftEngine } from './rift-engine.js';
import { clamp, lerpAngle, rotateXZ } from './rift-engine-math.js';
import { RiftRoadNetwork } from './rift-road-network.js';
import { mountRiftWorldEditor } from './rift-world-editor.js';

let activeFoundation = null;

export function destroyDowntown3D() {
  activeFoundation?.destroy?.();
  activeFoundation = null;
  document.body.classList.remove('world3d-game-mode');
}

export async function renderDowntown3D(root) {
  destroyDowntown3D();

  root.innerHTML = `
    <section class="world3d-shell downtown3d-foundation" aria-label="Playable Rift Engine Downtown foundation">
      <canvas id="riftcity-3d-canvas" aria-label="RiftCity Downtown Rift Engine viewport"></canvas>
      <div class="world3d-vignette" aria-hidden="true"></div>

      <div class="world3d-top-left downtown3d-title">
        <span class="eyebrow">RIFT ENGINE 0.2 · DOWNTOWN</span>
        <strong>Commerce Avenue</strong>
        <small>Raw WebGL2 · procedural road network · meter-based city scale</small>
      </div>

      <div class="world3d-top-right downtown3d-actions">
        <button id="rift-world-editor-button" class="world3d-hud-button rift-world-editor-button" type="button">WORLD EDITOR</button>
        <button id="downtown3d-reset-camera" class="world3d-hud-button" type="button">CAMERA</button>
        <button id="world3d-fullscreen-button" class="world3d-hud-button" type="button">FULLSCREEN</button>
      </div>

      <div id="downtown3d-status" class="downtown3d-status" role="status">
        <strong>STARTING RIFT ENGINE…</strong>
        <span>Preparing the custom WebGL2 Downtown renderer.</span>
      </div>

      <div class="downtown3d-meter" aria-live="polite">
        <span id="downtown3d-fps">FPS --</span>
        <span id="downtown3d-draws">DRAWS --</span>
        <span id="downtown3d-aa">MSAA --</span>
        <span>WEBGL2</span>
        <span>ROAD ${CONFIG.street.roadWidth}M</span>
        <span>WORLD ${CONFIG.world.width}×${CONFIG.world.depth}M</span>
      </div>

      <div class="world3d-touch">
        <div id="world3d-joystick" class="world3d-joystick" aria-label="Movement joystick">
          <div class="world3d-joystick-ring"><div id="world3d-joystick-knob" class="world3d-joystick-knob"></div></div>
          <span>MOVE</span>
        </div>
        <div class="world3d-action-pad downtown3d-action-pad">
          <button id="downtown3d-run" class="world3d-action" type="button">RUN</button>
        </div>
      </div>
    </section>`;

  const canvas = root.querySelector('#riftcity-3d-canvas');
  const status = root.querySelector('#downtown3d-status');

  try {
    if (!root.isConnected || !canvas?.isConnected) return null;
    activeFoundation = createFoundation({ root, canvas, status });
    return activeFoundation;
  } catch (error) {
    console.error('Rift Engine Downtown foundation failed to start', error);
    if (status) {
      status.classList.add('error');
      status.innerHTML = `<strong>RIFT ENGINE FAILED TO START</strong><span>${escapeText(error?.message || 'WebGL2 could not initialize.')}</span>`;
    }
    return null;
  }
}

function createFoundation({ root, canvas, status }) {
  const shell = root.querySelector('.world3d-shell');
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const engine = new RiftEngine(canvas, {
    antialias: true,
    clearColor: [0.105, 0.135, 0.17],
    fogColor: [0.105, 0.135, 0.17],
    fogStart: CONFIG.render.fogStart,
    fogEnd: CONFIG.render.fogEnd
  });

  const camera = new RiftCamera({
    alpha: CONFIG.camera.alpha,
    beta: CONFIG.camera.beta,
    radius: CONFIG.camera.radius,
    minRadius: CONFIG.camera.minRadius,
    maxRadius: CONFIG.camera.maxRadius,
    minBeta: CONFIG.camera.minBeta,
    maxBeta: CONFIG.camera.maxBeta,
    fov: CONFIG.camera.fov,
    near: CONFIG.camera.near,
    far: CONFIG.camera.far
  });
  camera.setTarget(CONFIG.player.spawn.x, CONFIG.camera.followHeight, CONFIG.player.spawn.z);

  const foundation = buildWorldFoundation(engine);
  const roadNetwork = new RiftRoadNetwork(engine, DOWNTOWN_ROAD_NETWORK, { connectRadius: 1.8 });
  const editorGrid = createEditorGrid(engine);
  const player = createScalePlayer(engine);
  player.position.x = CONFIG.player.spawn.x;
  player.position.z = CONFIG.player.spawn.z;
  updatePlayerVisual(engine, player, 0);

  const input = { x: 0, y: 0, run: false };
  const keys = new Set();
  const joystick = setupJoystick(root, input);
  let worldEditor = null;
  const orbit = setupCameraOrbit(canvas, camera, () => !worldEditor?.isOpen?.() || worldEditor?.getTool?.() === 'camera');
  const runButton = root.querySelector('#downtown3d-run');
  const resetCameraButton = root.querySelector('#downtown3d-reset-camera');
  const fullscreenButton = root.querySelector('#world3d-fullscreen-button');
  const fpsLabel = root.querySelector('#downtown3d-fps');
  const drawsLabel = root.querySelector('#downtown3d-draws');
  const aaLabel = root.querySelector('#downtown3d-aa');

  const onKeyDown = event => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    keys.add(event.code);
  };
  const onKeyUp = event => keys.delete(event.code);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const setRun = enabled => {
    input.run = enabled;
    runButton?.classList.toggle('active', enabled);
  };
  const runStart = event => { event.preventDefault(); setRun(true); };
  const runStop = event => { event.preventDefault(); setRun(false); };
  runButton?.addEventListener('pointerdown', runStart);
  runButton?.addEventListener('pointerup', runStop);
  runButton?.addEventListener('pointercancel', runStop);
  runButton?.addEventListener('pointerleave', runStop);

  const resetCamera = () => {
    camera.alpha = CONFIG.camera.alpha;
    camera.beta = CONFIG.camera.beta;
    camera.radius = CONFIG.camera.radius;
    camera.setTarget(player.position.x, CONFIG.camera.followHeight, player.position.z);
  };
  resetCameraButton?.addEventListener('click', resetCamera);

  let gameMode = false;
  const resize = () => {
    const target = coarsePointer ? CONFIG.render.mobileTargetPixelRatio : CONFIG.render.desktopTargetPixelRatio;
    const deviceRatio = Math.max(1, window.devicePixelRatio || 1);
    engine.resize(Math.min(deviceRatio, target));
  };

  const setGameMode = async enabled => {
    gameMode = enabled;
    document.body.classList.toggle('world3d-game-mode', enabled);
    fullscreenButton?.classList.toggle('active', enabled);
    if (fullscreenButton) fullscreenButton.textContent = enabled ? 'WINDOW' : 'FULLSCREEN';

    if (enabled) {
      try {
        const request = shell?.requestFullscreen || shell?.webkitRequestFullscreen;
        if (request && !document.fullscreenElement && !document.webkitFullscreenElement) await request.call(shell);
      } catch (_) {}
      try { await screen.orientation?.lock?.('landscape'); } catch (_) {}
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (_) {}
      try { screen.orientation?.unlock?.(); } catch (_) {}
    }
    requestAnimationFrame(resize);
  };
  fullscreenButton?.addEventListener('click', () => setGameMode(!gameMode));

  const onFullscreenChange = () => {
    const nativeActive = document.fullscreenElement === shell || document.webkitFullscreenElement === shell;
    if (gameMode && !nativeActive && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      gameMode = false;
      document.body.classList.remove('world3d-game-mode');
      fullscreenButton?.classList.remove('active');
      if (fullscreenButton) fullscreenButton.textContent = 'FULLSCREEN';
    }
    requestAnimationFrame(resize);
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.visualViewport?.addEventListener('resize', resize);

  worldEditor = mountRiftWorldEditor({
    root,
    canvas,
    engine,
    camera,
    roadNetwork,
    worldBounds: foundation.bounds,
    onModeChange(enabled) {
      for (const line of editorGrid) line.visible = enabled;
      input.x = 0;
      input.y = 0;
      setRun(false);
      joystick?.reset?.();
      if (!enabled) camera.setTarget(player.position.x, CONFIG.camera.followHeight, player.position.z);
    }
  });

  if (aaLabel) aaLabel.textContent = engine.getStats().antialias ? 'MSAA ON' : 'MSAA OFF';

  let destroyed = false;
  let frameId = 0;
  let previousTime = performance.now();
  let fpsFrames = 0;
  let fpsTimer = 0;
  let fpsAverage = 0;

  const tick = now => {
    if (destroyed) return;
    const dt = clamp((now - previousTime) / 1000, 0, 0.05);
    previousTime = now;
    const editing = worldEditor?.isOpen?.() || false;

    if (!editing) {
      let inputX = input.x;
      let inputY = input.y;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) inputY -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) inputY += 1;
      const magnitude = Math.hypot(inputX, inputY);
      if (magnitude > 1) { inputX /= magnitude; inputY /= magnitude; }

      const moving = Math.hypot(inputX, inputY) > 0.05;
      if (moving) {
        const forward = camera.flatForward();
        const right = [-forward[2], 0, forward[0]];
        let dx = right[0] * inputX + forward[0] * -inputY;
        let dz = right[2] * inputX + forward[2] * -inputY;
        const directionLength = Math.hypot(dx, dz) || 1;
        dx /= directionLength; dz /= directionLength;

        const running = input.run || keys.has('ShiftLeft') || keys.has('ShiftRight');
        const speed = running ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
        player.position.x = clamp(player.position.x + dx * speed * dt, foundation.bounds.minX, foundation.bounds.maxX);
        player.position.z = clamp(player.position.z + dz * speed * dt, foundation.bounds.minZ, foundation.bounds.maxZ);
        const targetYaw = Math.atan2(dx, dz);
        player.yaw = lerpAngle(player.yaw, targetYaw, Math.min(1, dt * 12));
        player.walkPhase += dt * (running ? 11 : 7.5);
        player.bob = Math.sin(player.walkPhase) * (running ? 0.035 : 0.02);
      } else {
        player.bob += (0 - player.bob) * Math.min(1, dt * 10);
      }

      const followT = 1 - Math.exp(-CONFIG.camera.followSharpness * dt);
      camera.target[0] += (player.position.x - camera.target[0]) * followT;
      camera.target[1] += (CONFIG.camera.followHeight - camera.target[1]) * followT;
      camera.target[2] += (player.position.z - camera.target[2]) * followT;
      camera.updatePosition();
    } else {
      player.bob += (0 - player.bob) * Math.min(1, dt * 10);
    }

    updatePlayerVisual(engine, player, player.bob);
    engine.render(camera);

    fpsFrames += 1;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      const instant = fpsFrames / fpsTimer;
      fpsAverage = fpsAverage ? fpsAverage * 0.6 + instant * 0.4 : instant;
      const stats = engine.getStats();
      if (fpsLabel) fpsLabel.textContent = `FPS ${Math.round(fpsAverage)}`;
      if (drawsLabel) drawsLabel.textContent = `DRAWS ${stats.draws}`;
      fpsTimer = 0;
      fpsFrames = 0;
    }

    frameId = requestAnimationFrame(tick);
  };

  resize();
  frameId = requestAnimationFrame(tick);

  if (status) {
    status.classList.add('ready');
    status.innerHTML = '<strong>RIFT ENGINE 0.3 ONLINE</strong><span>Continuous curve meshes + repaired semantic junctions. Paint straight or curved roads directly on the ground.</span>';
    setTimeout(() => status?.classList.add('settled'), 2600);
  }

  return {
    engine,
    camera,
    roadNetwork,
    worldEditor,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameId);
      worldEditor?.destroy?.();
      roadNetwork?.dispose?.();
      joystick?.destroy?.();
      orbit?.destroy?.();
      setRun(false);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      runButton?.removeEventListener('pointerdown', runStart);
      runButton?.removeEventListener('pointerup', runStop);
      runButton?.removeEventListener('pointercancel', runStop);
      runButton?.removeEventListener('pointerleave', runStop);
      resetCameraButton?.removeEventListener('click', resetCamera);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      if (document.fullscreenElement === shell || document.webkitFullscreenElement === shell) {
        try { document.exitFullscreen?.() || document.webkitExitFullscreen?.(); } catch (_) {}
      }
      document.body.classList.remove('world3d-game-mode');
      engine.dispose();
      root.style.height = '';
    }
  };
}

function buildWorldFoundation(engine) {
  const halfWidth = CONFIG.world.width * 0.5;
  const halfDepth = CONFIG.world.depth * 0.5;
  engine.addBox({
    position: [0, -CONFIG.world.groundHeight * 0.5, 0],
    scale: [CONFIG.world.width, CONFIG.world.groundHeight, CONFIG.world.depth],
    color: '#353a36',
    noise: 0.012
  });
  return {
    bounds: {
      minX: -halfWidth + CONFIG.player.radius,
      maxX: halfWidth - CONFIG.player.radius,
      minZ: -halfDepth + CONFIG.player.radius,
      maxZ: halfDepth - CONFIG.player.radius
    }
  };
}

function createEditorGrid(engine) {
  const drawables = [];
  const halfWidth = CONFIG.world.width * 0.5;
  const halfDepth = CONFIG.world.depth * 0.5;
  const step = 20;
  for (let x = -Math.floor(halfWidth / step) * step; x <= halfWidth; x += step) {
    const line = engine.addBox({ position: [x, 0.055, 0], scale: [0.035, 0.012, CONFIG.world.depth], color: '#59615c', visible: false });
    drawables.push(line);
  }
  for (let z = -Math.floor(halfDepth / step) * step; z <= halfDepth; z += step) {
    const line = engine.addBox({ position: [0, 0.056, z], scale: [CONFIG.world.width, 0.012, 0.035], color: '#59615c', visible: false });
    drawables.push(line);
  }
  return drawables;
}

function createScalePlayer(engine) {
  const scale = CONFIG.player.height / 1.88;
  return {
    position: { x: 0, z: 0 },
    yaw: 0,
    bob: 0,
    walkPhase: 0,
    parts: [
      { mesh: engine.addCylinder({ scale: [0.54 * scale, 0.92 * scale, 0.54 * scale], color: '#1e2228', dynamic: true }), local: [0, 1.08 * scale, 0], scale: [0.54 * scale, 0.92 * scale, 0.54 * scale] },
      { mesh: engine.addBox({ scale: [0.54 * scale, 0.52 * scale, 0.32 * scale], color: '#c98635', dynamic: true }), local: [0, 1.18 * scale, 0.02 * scale], scale: [0.54 * scale, 0.52 * scale, 0.32 * scale] },
      { mesh: engine.addSphere({ scale: [0.38 * scale, 0.38 * scale, 0.38 * scale], color: '#a8785e', dynamic: true }), local: [0, 1.69 * scale, 0], scale: [0.38 * scale, 0.38 * scale, 0.38 * scale] },
      { mesh: engine.addBox({ scale: [0.18 * scale, 0.72 * scale, 0.22 * scale], color: '#1e2228', dynamic: true }), local: [-0.16 * scale, 0.46 * scale, 0], scale: [0.18 * scale, 0.72 * scale, 0.22 * scale] },
      { mesh: engine.addBox({ scale: [0.18 * scale, 0.72 * scale, 0.22 * scale], color: '#1e2228', dynamic: true }), local: [0.16 * scale, 0.46 * scale, 0], scale: [0.18 * scale, 0.72 * scale, 0.22 * scale] },
      { mesh: engine.addCylinder({ scale: [0.85 * scale, 0.02, 0.85 * scale], color: '#111315', dynamic: true }), local: [0, 0.018, 0], scale: [0.85 * scale, 0.02, 0.85 * scale], shadow: true }
    ]
  };
}

function updatePlayerVisual(engine, player, bob) {
  for (const part of player.parts) {
    const rotated = rotateXZ(part.local[0], part.local[2], player.yaw);
    const y = part.shadow ? part.local[1] : part.local[1] + bob;
    engine.setTransform(
      part.mesh,
      [player.position.x + rotated[0], y, player.position.z + rotated[1]],
      part.shadow ? 0 : player.yaw,
      part.scale
    );
  }
}

function setupCameraOrbit(canvas, camera, canOrbit = () => true) {
  const pointers = new Map();
  let lastDistance = 0;
  let dragPointer = null;
  let lastX = 0;
  let lastY = 0;

  const resetPointers = () => {
    pointers.clear();
    lastDistance = 0;
    dragPointer = null;
  };

  const pointerDown = event => {
    if (!canOrbit()) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { canvas.setPointerCapture?.(event.pointerId); } catch (_) {}
    if (pointers.size === 1) {
      dragPointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()];
      lastDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  const pointerMove = event => {
    if (!canOrbit()) { resetPointers(); return; }
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastDistance > 0) camera.zoom((lastDistance - distance) * 0.018);
      lastDistance = distance;
      return;
    }
    if (event.pointerId === dragPointer) {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      camera.orbit(-dx * 0.006, -dy * 0.0045);
    }
  };

  const pointerEnd = event => {
    pointers.delete(event.pointerId);
    try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
    if (dragPointer === event.pointerId) dragPointer = null;
    if (pointers.size < 2) lastDistance = 0;
    if (pointers.size === 1) {
      const [id, point] = pointers.entries().next().value;
      dragPointer = id;
      lastX = point.x;
      lastY = point.y;
    }
  };

  const wheel = event => {
    if (!canOrbit()) return;
    event.preventDefault();
    camera.zoom(Math.sign(event.deltaY) * Math.min(1.4, Math.abs(event.deltaY) * 0.008));
  };

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('wheel', wheel, { passive: false });

  return {
    destroy() {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerEnd);
      canvas.removeEventListener('pointercancel', pointerEnd);
      canvas.removeEventListener('wheel', wheel);
      resetPointers();
    }
  };
}

function setupJoystick(root, input) {
  const zone = root.querySelector('#world3d-joystick');
  const ring = zone?.querySelector('.world3d-joystick-ring');
  const knob = root.querySelector('#world3d-joystick-knob');
  if (!zone || !ring || !knob) return null;

  let pointerId = null;
  const max = 38;

  const update = event => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    const rect = ring.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > max) {
      const scale = max / distance;
      dx *= scale;
      dy *= scale;
    }
    input.x = dx / max;
    input.y = dy / max;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  };

  const start = event => {
    event.preventDefault();
    pointerId = event.pointerId;
    zone.classList.add('active');
    try { zone.setPointerCapture?.(event.pointerId); } catch (_) {}
    update(event);
  };

  const reset = event => {
    if (event && pointerId !== null && event.pointerId !== pointerId) return;
    if (event) event.preventDefault();
    try { if (event && pointerId !== null) zone.releasePointerCapture?.(pointerId); } catch (_) {}
    pointerId = null;
    input.x = 0;
    input.y = 0;
    knob.style.transform = 'translate(0,0)';
    zone.classList.remove('active');
  };

  zone.addEventListener('pointerdown', start);
  zone.addEventListener('pointermove', update);
  zone.addEventListener('pointerup', reset);
  zone.addEventListener('pointercancel', reset);

  return {
    reset: () => reset(),
    destroy() {
      reset();
      zone.removeEventListener('pointerdown', start);
      zone.removeEventListener('pointermove', update);
      zone.removeEventListener('pointerup', reset);
      zone.removeEventListener('pointercancel', reset);
    }
  };
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
