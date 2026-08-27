import { RiftCamera, RiftEngine } from './rift-engine.js';
import { validateRiftBlockFaceWinding } from './rift-block-world.js';
import { RiftBlockSection, validateRiftBlockSectionStorage } from './rift-block-section.js';
import {
  RIFT_BLOCK_SHAPE_LAB_SCENES,
  buildRiftPartialShapeGeometry,
  getRiftBlockShapeLabScene,
  resolveRiftShapeLabColor,
  validateRiftBlockShapes
} from './rift-block-shapes.js';
import { assertMeterScale } from './rift-world-scale.js';

let activeFoundation = null;

export function destroyDowntown3D() {
  activeFoundation?.destroy?.();
  activeFoundation = null;
  document.body.classList.remove('world3d-game-mode');
}

export async function renderDowntown3D(root) {
  destroyDowntown3D();

  const tabs = RIFT_BLOCK_SHAPE_LAB_SCENES.map((scene, index) =>
    `<button class="rift-shape-tab${index === 0 ? ' active' : ''}" data-rift-shape-scene="${scene.id}" type="button">${scene.label}</button>`
  ).join('');

  root.innerHTML = `
    <section class="world3d-shell downtown3d-foundation rift-shape-lab" aria-label="RiftCity RiftBlock Shape Lab">
      <canvas id="riftcity-3d-canvas" aria-label="RiftBlock full block, slab and stair shape validation lab"></canvas>
      <div class="world3d-vignette" aria-hidden="true"></div>

      <div class="world3d-top-left downtown3d-title">
        <span class="eyebrow">RIFT BLOCK ENGINE · H1.56 SHAPE LAB</span>
        <strong id="rift-shape-title">ALL SHAPES</strong>
        <small id="rift-shape-description">Full blocks, half slabs, directional stairs and partial occlusion in one switchable validation build.</small>
      </div>

      <div class="world3d-top-right downtown3d-actions rift-shape-actions">
        <button id="rift-shape-spin" class="world3d-hud-button" type="button">SPIN</button>
        <button id="rift-shape-cull" class="world3d-hud-button active" type="button">CULL ON</button>
        <button id="rift-shape-top" class="world3d-hud-button" type="button">TOP VIEW</button>
        <button id="rift-shape-reset" class="world3d-hud-button" type="button">RESET VIEW</button>
        <button id="world3d-fullscreen-button" class="world3d-hud-button" type="button">FULLSCREEN</button>
      </div>

      <div class="rift-shape-tabs" aria-label="RiftBlock shape tests">${tabs}</div>

      <div id="downtown3d-status" class="downtown3d-status" role="status">
        <strong>BUILDING RIFTBLOCK SHAPE LAB…</strong>
        <span>Validating full blocks, top/bottom slabs, four stair rotations, stacked stairs and partial shared-face occlusion.</span>
      </div>

      <div class="downtown3d-meter rift-shape-meter" aria-live="polite">
        <span id="rift-shape-scene">SCENE ALL</span>
        <span id="rift-shape-cells">CELLS --</span>
        <span id="rift-shape-micro">HALF-CELLS --</span>
        <span id="rift-shape-surface">SURFACE TILES --</span>
        <span id="rift-shape-hidden">HIDDEN TILES --</span>
        <span id="rift-shape-quads">MERGED QUADS --</span>
        <span id="rift-shape-tris">TRIS --</span>
        <span id="downtown3d-draws">DRAWS --</span>
        <span id="downtown3d-fps">FPS --</span>
        <span id="downtown3d-aa">MSAA --</span>
      </div>
    </section>`;

  const canvas = root.querySelector('#riftcity-3d-canvas');
  const status = root.querySelector('#downtown3d-status');

  try {
    if (!root.isConnected || !canvas?.isConnected) return null;
    activeFoundation = createShapeLab({ root, canvas, status });
    return activeFoundation;
  } catch (error) {
    console.error('RiftCity H1.56 Shape Lab failed to start', error);
    if (status) {
      status.classList.add('error');
      status.innerHTML = `<strong>SHAPE LAB FAILED</strong><span>${escapeText(error?.message || 'WebGL2 could not initialize.')}</span>`;
    }
    return null;
  }
}

function createSectionForScene(scene) {
  const section = new RiftBlockSection({ sx: 0, sy: 0, sz: 0 });
  for (const cell of scene.cells) {
    section.setBlock(cell.x, cell.y, cell.z, cell.state);
  }
  return section;
}

function calculateSceneBounds(scene) {
  if (!scene.cells.length) return { center: [8, 1, 8], span: 8 };
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const cell of scene.cells) {
    minX = Math.min(minX, cell.x); minY = Math.min(minY, cell.y); minZ = Math.min(minZ, cell.z);
    maxX = Math.max(maxX, cell.x + 1); maxY = Math.max(maxY, cell.y + 1); maxZ = Math.max(maxZ, cell.z + 1);
  }
  return {
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    span: Math.max(maxX - minX, maxZ - minZ, (maxY - minY) * 1.4, 4)
  };
}

function createShapeLab({ root, canvas, status }) {
  assertMeterScale();

  const faceValidation = validateRiftBlockFaceWinding();
  if (!faceValidation.ok) throw new Error(`Invalid block face winding: ${faceValidation.failures.join(', ')}`);

  const storageValidation = validateRiftBlockSectionStorage();
  if (!storageValidation.ok) throw new Error(`RiftSection storage failed: ${storageValidation.failures.join('; ')}`);

  const shapeValidation = validateRiftBlockShapes();
  if (!shapeValidation.ok) throw new Error(`RiftBlock shapes failed: ${shapeValidation.failures.join('; ')}`);

  const shell = root.querySelector('.world3d-shell');
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const engine = new RiftEngine(canvas, {
    antialias: true,
    clearColor: [0.045, 0.055, 0.065],
    fogColor: [0.045, 0.055, 0.065],
    fogStart: 34,
    fogEnd: 72
  });

  const camera = new RiftCamera({
    alpha: Math.PI * 0.23,
    beta: 0.92,
    radius: 18,
    minRadius: 6,
    maxRadius: 36,
    minBeta: 0.16,
    maxBeta: 1.48,
    fov: Math.PI / 3.05,
    near: 0.035,
    far: 96
  });

  const floor = engine.addBox({
    position: [8, -0.11, 8],
    scale: [16, 0.18, 16],
    color: '#232a2d',
    noise: 0,
    blockGrid: 0.16,
    blockFaceShade: 1,
    blockElevationCue: 0,
    doubleSided: false
  });

  const meshOptions = {
    color: '#ffffff',
    noise: 0,
    blockGrid: 0.22,
    blockFaceShade: 1,
    blockElevationCue: 0.028,
    blockElevationBase: 0,
    doubleSided: false
  };

  let shapeDrawable = null;
  let activeScene = getRiftBlockShapeLabScene('all');
  let currentSection = null;
  let currentGeometry = null;
  let currentOracle = null;
  let spinning = false;
  let culling = true;
  let topView = false;
  let gameMode = false;

  const title = root.querySelector('#rift-shape-title');
  const description = root.querySelector('#rift-shape-description');
  const sceneLabel = root.querySelector('#rift-shape-scene');
  const cellsLabel = root.querySelector('#rift-shape-cells');
  const microLabel = root.querySelector('#rift-shape-micro');
  const surfaceLabel = root.querySelector('#rift-shape-surface');
  const hiddenLabel = root.querySelector('#rift-shape-hidden');
  const quadsLabel = root.querySelector('#rift-shape-quads');
  const trisLabel = root.querySelector('#rift-shape-tris');
  const drawsLabel = root.querySelector('#downtown3d-draws');
  const fpsLabel = root.querySelector('#downtown3d-fps');
  const aaLabel = root.querySelector('#downtown3d-aa');
  const spinButton = root.querySelector('#rift-shape-spin');
  const cullButton = root.querySelector('#rift-shape-cull');
  const topButton = root.querySelector('#rift-shape-top');
  const resetButton = root.querySelector('#rift-shape-reset');
  const fullscreenButton = root.querySelector('#world3d-fullscreen-button');
  const tabButtons = [...root.querySelectorAll('[data-rift-shape-scene]')];

  const setCameraForScene = (scene, { keepAngle = false } = {}) => {
    const bounds = calculateSceneBounds(scene);
    camera.setTarget(...bounds.center);
    camera.radius = Math.max(9, Math.min(26, bounds.span * 1.45 + 6));
    if (!keepAngle) {
      camera.alpha = Math.PI * 0.23;
      camera.beta = 0.92;
      topView = false;
      topButton?.classList.remove('active');
      if (topButton) topButton.textContent = 'TOP VIEW';
    }
    camera.updatePosition();
  };

  const verifyGeometry = (scene, sectionGeometry, oracle) => {
    const expected = scene.expected;
    if (oracle.blocks !== expected.blocks || oracle.occupiedMicrovoxels !== expected.occupiedMicrovoxels ||
        oracle.visibleMicroFaces !== expected.visibleMicroFaces || oracle.culledMicroFaces !== expected.culledMicroFaces ||
        oracle.quads !== expected.quads || oracle.vertexCount !== expected.vertexCount || oracle.triangles !== expected.triangles) {
      throw new Error(`${scene.label} shape oracle changed from locked expected totals.`);
    }

    if (sectionGeometry.blocks !== expected.blocks || sectionGeometry.vertexCount !== expected.vertexCount || sectionGeometry.triangles !== expected.triangles) {
      throw new Error(`${scene.label} RiftSection mesh ${sectionGeometry.blocks}/${sectionGeometry.vertexCount}/${sectionGeometry.triangles} != ${expected.blocks}/${expected.vertexCount}/${expected.triangles}.`);
    }

    if (scene.id === 'full') {
      if (sectionGeometry.visibleFaces !== 10 || sectionGeometry.culledFaces !== 2) {
        throw new Error(`Legacy full-block fast path changed: ${sectionGeometry.visibleFaces}/${sectionGeometry.culledFaces} != 10/2.`);
      }
    } else {
      if (!sectionGeometry.shapeAware || sectionGeometry.visibleMicroFaces !== expected.visibleMicroFaces ||
          sectionGeometry.culledMicroFaces !== expected.culledMicroFaces || sectionGeometry.quads !== expected.quads) {
        throw new Error(`${scene.label} shape-aware RiftSection totals do not match the shape oracle.`);
      }
    }
    if (sectionGeometry.vertexStride !== 9 || sectionGeometry.vertices.length !== sectionGeometry.vertexCount * 9) {
      throw new Error(`${scene.label} lost its position/normal/color vertex contract.`);
    }
  };

  const showStatus = (scene) => {
    if (!status) return;
    status.classList.add('ready');
    status.classList.remove('error', 'settled');
    status.innerHTML = `<strong>${escapeText(scene.title)} · PASS</strong><span>${escapeText(scene.description)} ${scene.expected.visibleMicroFaces} exposed 0.5 m surface tiles merge to ${scene.expected.quads} GPU quads / ${scene.expected.triangles} triangles.</span>`;
    window.setTimeout(() => status.classList.add('settled'), 1750);
  };

  const loadScene = (sceneId, { announce = true } = {}) => {
    const scene = getRiftBlockShapeLabScene(sceneId);
    const section = createSectionForScene(scene);
    const sectionGeometry = section.buildGeometry({ getBlockColor: resolveRiftShapeLabColor });
    const oracle = buildRiftPartialShapeGeometry({ cells: scene.cells, getBlockColor: resolveRiftShapeLabColor });
    verifyGeometry(scene, sectionGeometry, oracle);

    if (shapeDrawable) {
      engine.updateMesh(shapeDrawable, sectionGeometry);
    } else {
      shapeDrawable = engine.addMesh(sectionGeometry, meshOptions);
    }
    shapeDrawable.visible = true;
    shapeDrawable.doubleSided = !culling;

    activeScene = scene;
    currentSection = section;
    currentGeometry = sectionGeometry;
    currentOracle = oracle;

    if (title) title.textContent = scene.title;
    if (description) description.textContent = scene.description;
    if (sceneLabel) sceneLabel.textContent = `SCENE ${scene.label}`;
    if (cellsLabel) cellsLabel.textContent = `CELLS ${oracle.blocks}`;
    if (microLabel) microLabel.textContent = `HALF-CELLS ${oracle.occupiedMicrovoxels}`;
    if (surfaceLabel) surfaceLabel.textContent = `SURFACE ${oracle.visibleMicroFaces}`;
    if (hiddenLabel) hiddenLabel.textContent = `HIDDEN ${oracle.culledMicroFaces}`;
    if (quadsLabel) quadsLabel.textContent = `QUADS ${oracle.quads}`;
    if (trisLabel) trisLabel.textContent = `TRIS ${oracle.triangles}`;

    for (const button of tabButtons) button.classList.toggle('active', button.dataset.riftShapeScene === scene.id);
    setCameraForScene(scene);
    if (announce) showStatus(scene);
  };

  loadScene('all', { announce: false });

  if (status) {
    status.classList.add('ready');
    status.innerHTML = `<strong>RIFTBLOCK SHAPE LAB · ALL CORE TESTS PASS</strong><span>FULL, bottom/top slabs, four stair rotations, a six-step staircase, mixed contacts and partial occlusion are live. Switch tabs and orbit from every angle; each scene is one shape mesh plus the reference floor.</span>`;
    window.setTimeout(() => status.classList.add('settled'), 2400);
  }

  const tabHandlers = new Map();
  for (const button of tabButtons) {
    const handler = () => loadScene(button.dataset.riftShapeScene);
    tabHandlers.set(button, handler);
    button.addEventListener('click', handler);
  }

  const onSpin = () => {
    spinning = !spinning;
    spinButton?.classList.toggle('active', spinning);
    if (spinButton) spinButton.textContent = spinning ? 'SPIN ON' : 'SPIN';
  };
  spinButton?.addEventListener('click', onSpin);

  const onCull = () => {
    culling = !culling;
    if (shapeDrawable) shapeDrawable.doubleSided = !culling;
    floor.doubleSided = !culling;
    cullButton?.classList.toggle('active', culling);
    if (cullButton) cullButton.textContent = culling ? 'CULL ON' : 'CULL OFF';
  };
  cullButton?.addEventListener('click', onCull);

  const onTop = () => {
    topView = !topView;
    const bounds = calculateSceneBounds(activeScene);
    camera.setTarget(...bounds.center);
    if (topView) {
      camera.alpha = -Math.PI / 2;
      camera.beta = 0.18;
      camera.radius = Math.max(10, Math.min(28, bounds.span * 1.5 + 7));
    } else {
      camera.alpha = Math.PI * 0.23;
      camera.beta = 0.92;
      camera.radius = Math.max(9, Math.min(26, bounds.span * 1.45 + 6));
    }
    camera.updatePosition();
    topButton?.classList.toggle('active', topView);
    if (topButton) topButton.textContent = topView ? 'ANGLE VIEW' : 'TOP VIEW';
  };
  topButton?.addEventListener('click', onTop);

  const resetCamera = () => setCameraForScene(activeScene);
  resetButton?.addEventListener('click', resetCamera);

  const onKeyDown = event => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = String(event.key || '').toLowerCase();
    const number = Number(key);
    if (Number.isInteger(number) && number >= 1 && number <= RIFT_BLOCK_SHAPE_LAB_SCENES.length) {
      event.preventDefault();
      loadScene(RIFT_BLOCK_SHAPE_LAB_SCENES[number - 1].id);
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const orbit = setupDiagnosticOrbit(canvas, camera);
  const resize = () => {
    const target = coarsePointer ? 1.45 : 1.8;
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
  const onFullscreenButton = () => setGameMode(!gameMode);
  fullscreenButton?.addEventListener('click', onFullscreenButton);

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
  resize();

  const initialStats = engine.getStats();
  if (aaLabel) aaLabel.textContent = `MSAA ${initialStats.antialias ? 'ON' : 'OFF'}`;

  let destroyed = false;
  let raf = 0;
  let fpsTimer = performance.now();
  let frames = 0;
  let lastFrame = performance.now();

  const tick = now => {
    if (destroyed) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (spinning) camera.orbit(dt * 0.45, 0);

    engine.render(camera);
    const renderStats = engine.getStats();
    if (drawsLabel) drawsLabel.textContent = `DRAWS ${renderStats.draws}`;

    frames += 1;
    if (now - fpsTimer >= 500) {
      const fps = Math.round(frames * 1000 / Math.max(1, now - fpsTimer));
      if (fpsLabel) fpsLabel.textContent = `FPS ${fps}`;
      fpsTimer = now;
      frames = 0;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    engine,
    camera,
    shapeValidation,
    get activeScene() { return activeScene; },
    get currentSection() { return currentSection; },
    get currentGeometry() { return currentGeometry; },
    get currentOracle() { return currentOracle; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      orbit.destroy();
      for (const [button, handler] of tabHandlers) button.removeEventListener('click', handler);
      spinButton?.removeEventListener('click', onSpin);
      cullButton?.removeEventListener('click', onCull);
      topButton?.removeEventListener('click', onTop);
      resetButton?.removeEventListener('click', resetCamera);
      fullscreenButton?.removeEventListener('click', onFullscreenButton);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      document.body.classList.remove('world3d-game-mode');
      engine.dispose();
    }
  };
}

function setupDiagnosticOrbit(canvas, camera) {
  const pointers = new Map();
  let lastPinch = null;

  const pinchDistance = () => {
    if (pointers.size < 2) return null;
    const [a, b] = [...pointers.values()].slice(0, 2);
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = event => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    lastPinch = pinchDistance();
  };

  const onPointerMove = event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    const next = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, next);
    if (pointers.size >= 2) {
      const distance = pinchDistance();
      if (lastPinch != null && distance != null) camera.zoom((lastPinch - distance) * 0.018);
      lastPinch = distance;
      return;
    }
    camera.orbit((previous.x - next.x) * 0.009, (next.y - previous.y) * 0.009);
  };

  const release = event => {
    pointers.delete(event.pointerId);
    lastPinch = pinchDistance();
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
  };

  const onWheel = event => {
    event.preventDefault();
    camera.zoom(event.deltaY * 0.012);
  };

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    destroy() {
      pointers.clear();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', release);
      canvas.removeEventListener('pointercancel', release);
      canvas.removeEventListener('wheel', onWheel);
    }
  };
}

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
