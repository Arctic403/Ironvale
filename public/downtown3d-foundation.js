import { RiftCamera, RiftEngine } from './rift-engine.js';
import { validateRiftBlockFaceWinding } from './rift-block-world.js';
import { validateRiftBlockSectionStorage } from './rift-block-section.js';
import { validateRiftBlockShapes } from './rift-block-shapes.js';
import { compileRiftCityBlock, validateRiftCityBlockImporter } from './rift-city-block-importer.js';
import { assertMeterScale } from './rift-world-scale.js';

let activeFoundation = null;
const DEFAULT_BLOCK_URL = new URL('./riftcity-blocks/downtown-block-001.json', import.meta.url);
const ACTIVE_BLOCK_STORAGE_KEY = 'riftcity:h1.57:active-city-block:v1';
const ACTIVE_BLOCK_STORAGE_VERSION = 1;
const ACTIVE_BLOCK_MAX_BYTES = 2 * 1024 * 1024;

export function destroyDowntown3D() {
  activeFoundation?.destroy?.();
  activeFoundation = null;
  document.body.classList.remove('world3d-game-mode');
}

export async function renderDowntown3D(root) {
  destroyDowntown3D();

  root.innerHTML = `
    <section class="world3d-shell downtown3d-foundation rift-block-import-lab" aria-label="RiftCity JSON city block importer">
      <canvas id="riftcity-3d-canvas" aria-label="Imported RiftCity block preview"></canvas>
      <div class="world3d-vignette" aria-hidden="true"></div>

      <div class="world3d-top-left downtown3d-title rift-import-title">
        <span class="eyebrow">RIFT BLOCK ENGINE · H1.59 BLUEPRINT COMPOSER</span>
        <strong id="rift-import-name">LOADING COMMERCE BLOCK 01…</strong>
        <small id="rift-import-description">Nested Blueprint prefabs, curb-aware roads, validated anchors and groups expand into normal 1m RiftSections, slabs and stairs at import time.</small>
      </div>

      <div class="world3d-top-right downtown3d-actions rift-import-actions">
        <button id="rift-import-json" class="world3d-hud-button" type="button">IMPORT JSON</button>
        <button id="rift-import-reset" class="world3d-hud-button" type="button">RESET DEFAULT</button>
        <button id="rift-import-spin" class="world3d-hud-button" type="button">SPIN</button>
        <button id="rift-import-cull" class="world3d-hud-button active" type="button">CULL ON</button>
        <button id="rift-import-top" class="world3d-hud-button" type="button">TOP VIEW</button>
        <button id="rift-import-view" class="world3d-hud-button" type="button">RESET VIEW</button>
        <button id="world3d-fullscreen-button" class="world3d-hud-button" type="button">FULLSCREEN</button>
        <input id="rift-import-file" class="rift-import-file" type="file" accept=".json,application/json" aria-label="Choose a RiftCity city block JSON file">
      </div>

      <div id="downtown3d-status" class="downtown3d-status" role="status">
        <strong>LOADING JSON BLOCK IMPORTER…</strong>
        <span>Re-running block winding, section storage, full/slab/stair and importer validation before rendering the first authored city block.</span>
      </div>

      <div class="downtown3d-meter rift-import-meter" aria-live="polite">
        <span id="rift-import-source">ACTIVE DEFAULT</span>
        <span id="rift-import-ops">OPS --</span>
        <span id="rift-import-cells">CELLS --</span>
        <span id="rift-import-partial">PARTIAL --</span>
        <span id="rift-import-sections">SECTIONS --</span>
        <span id="rift-import-memory">STATE --</span>
        <span id="rift-import-tris">TRIS --</span>
        <span id="downtown3d-draws">DRAWS --</span>
        <span id="downtown3d-fps">FPS --</span>
      </div>
    </section>`;

  const canvas = root.querySelector('#riftcity-3d-canvas');
  const status = root.querySelector('#downtown3d-status');

  try {
    if (!root.isConnected || !canvas?.isConnected) return null;
    const foundation = createBlockImporterLab({ root, canvas, status });
    activeFoundation = foundation;
    await foundation.loadActiveBlock();
    return foundation;
  } catch (error) {
    console.error('RiftCity H1.57 JSON block importer failed to start', error);
    if (status) {
      status.classList.add('error');
      status.innerHTML = `<strong>JSON BLOCK IMPORTER FAILED</strong><span>${escapeText(error?.message || 'The importer could not initialize.')}</span>`;
    }
    activeFoundation?.destroy?.();
    activeFoundation = null;
    return null;
  }
}

function createBlockImporterLab({ root, canvas, status }) {
  assertMeterScale();

  const faceValidation = validateRiftBlockFaceWinding();
  if (!faceValidation.ok) throw new Error(`Invalid block face winding: ${faceValidation.failures.join(', ')}`);
  const storageValidation = validateRiftBlockSectionStorage();
  if (!storageValidation.ok) throw new Error(`RiftSection storage failed: ${storageValidation.failures.join('; ')}`);
  const shapeValidation = validateRiftBlockShapes();
  if (!shapeValidation.ok) throw new Error(`RiftBlock shapes failed: ${shapeValidation.failures.join('; ')}`);
  const importerValidation = validateRiftCityBlockImporter();
  if (!importerValidation.ok) throw new Error(`JSON block importer failed: ${importerValidation.failures.join('; ')}`);

  const shell = root.querySelector('.world3d-shell');
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const engine = new RiftEngine(canvas, {
    antialias: true,
    clearColor: [0.045, 0.055, 0.065],
    fogColor: [0.045, 0.055, 0.065],
    fogStart: 105,
    fogEnd: 220
  });
  const camera = new RiftCamera({
    alpha: -0.72,
    beta: 0.78,
    radius: 88,
    minRadius: 12,
    maxRadius: 190,
    minBeta: 0.10,
    maxBeta: 1.48,
    fov: Math.PI / 3.05,
    near: 0.05,
    far: 280
  });

  const meshOptions = {
    color: '#ffffff',
    noise: 0,
    blockGrid: 0.16,
    blockFaceShade: 1,
    blockElevationCue: 0.01,
    blockElevationBase: 0,
    doubleSided: false
  };

  let imported = null;
  let blockDrawables = [];
  let spinning = false;
  let culling = true;
  let topView = false;
  let gameMode = false;
  let destroyed = false;
  let sourceLabel = 'DEFAULT BLOCK 001';
  let persistenceLabel = 'BUNDLED';

  const nameLabel = root.querySelector('#rift-import-name');
  const descriptionLabel = root.querySelector('#rift-import-description');
  const sourceMetric = root.querySelector('#rift-import-source');
  const opsMetric = root.querySelector('#rift-import-ops');
  const cellsMetric = root.querySelector('#rift-import-cells');
  const partialMetric = root.querySelector('#rift-import-partial');
  const sectionsMetric = root.querySelector('#rift-import-sections');
  const memoryMetric = root.querySelector('#rift-import-memory');
  const trisMetric = root.querySelector('#rift-import-tris');
  const drawsMetric = root.querySelector('#downtown3d-draws');
  const fpsMetric = root.querySelector('#downtown3d-fps');
  const importButton = root.querySelector('#rift-import-json');
  const resetButton = root.querySelector('#rift-import-reset');
  const spinButton = root.querySelector('#rift-import-spin');
  const cullButton = root.querySelector('#rift-import-cull');
  const topButton = root.querySelector('#rift-import-top');
  const viewButton = root.querySelector('#rift-import-view');
  const fullscreenButton = root.querySelector('#world3d-fullscreen-button');
  const fileInput = root.querySelector('#rift-import-file');

  const calculateCamera = () => {
    if (!imported) return { target: [32, 5, 32], radius: 88 };
    const min = imported.worldBounds.min;
    const max = imported.worldBounds.max;
    const width = max[0] - min[0] + 1;
    const depth = max[2] - min[2] + 1;
    const height = max[1] - min[1] + 1;
    return {
      target: [imported.center[0], min[1] + Math.min(6, height * 0.34), imported.center[2]],
      radius: Math.max(34, Math.min(150, Math.max(width, depth) * 1.18 + height * 0.7))
    };
  };

  const resetCamera = () => {
    const view = calculateCamera();
    camera.setTarget(...view.target);
    camera.alpha = -0.72;
    camera.beta = 0.78;
    camera.radius = view.radius;
    camera.updatePosition();
    topView = false;
    topButton?.classList.remove('active');
    if (topButton) topButton.textContent = 'TOP VIEW';
  };

  const updateHud = () => {
    if (!imported) return;
    const stats = imported.stats;
    if (nameLabel) nameLabel.textContent = imported.name.toUpperCase();
    if (descriptionLabel) {
      descriptionLabel.textContent = stats.blueprintObjects
        ? `${imported.id} · ${stats.blueprintObjects} blueprint objects · ${stats.instances} prefab instances (${stats.nestedInstances} nested) · ${stats.anchors} named anchors · ${stats.sections} RiftSections.`
        : `${imported.id} · ${stats.sections} RiftSections · legacy compact ops expanded into the proven full/slab/stair block vocabulary.`;
    }
    if (sourceMetric) sourceMetric.textContent = `ACTIVE ${imported.id.toUpperCase()} · ${persistenceLabel}`;
    if (opsMetric) opsMetric.textContent = stats.blueprintObjects ? `OPS ${stats.operations} · OBJ ${stats.blueprintObjects}` : `OPS ${stats.operations}`;
    if (cellsMetric) cellsMetric.textContent = `CELLS ${stats.cells.toLocaleString()}`;
    if (partialMetric) partialMetric.textContent = `PARTIAL ${stats.partialCells}`;
    if (sectionsMetric) sectionsMetric.textContent = `SECTIONS ${stats.sections}`;
    if (memoryMetric) memoryMetric.textContent = `STATE ${Math.round(stats.stateBytes / 1024)} KB`;
    if (trisMetric) trisMetric.textContent = `TRIS ${stats.triangles.toLocaleString()}`;
  };

  const showReady = () => {
    if (!status || !imported) return;
    const stats = imported.stats;
    status.classList.add('ready');
    status.classList.remove('error', 'settled');
    const blueprintSummary = stats.blueprintObjects
      ? `${stats.blueprintObjects} blueprint objects (${stats.instances} prefab instances, ${stats.nestedInstances} nested, ${stats.roads} roads, ${stats.intersections} intersections) expanded into ${stats.operations} block operations. ${stats.anchors} anchors, ${stats.groups} groups and ${stats.connections} validated connections are available.`
      : `${stats.operations} compact JSON operations were accepted.`;
    const warningSummary = stats.warnings ? ` ${stats.warnings} non-fatal blueprint overlap warning${stats.warnings === 1 ? '' : 's'} reported.` : '';
    status.innerHTML = `<strong>${escapeText(imported.name)} · IMPORT PASS</strong><span>${blueprintSummary} ${stats.cells.toLocaleString()} occupied cells across ${stats.sections} RiftSections; ${stats.triangles.toLocaleString()} triangles are live.${warningSummary}</span>`;
    window.setTimeout(() => status.classList.add('settled'), 2400);
  };

  const loadDocument = (document, label = 'LOCAL JSON', options = {}) => {
    const compiled = compileRiftCityBlock(document);
    if (destroyed) return compiled;

    const nextDrawables = [];
    try {
      for (const mesh of compiled.meshes) {
        const drawable = engine.addMesh(mesh.geometry, meshOptions);
        drawable.doubleSided = !culling;
        nextDrawables.push(drawable);
      }
    } catch (error) {
      engine.removeDrawables(nextDrawables);
      throw error;
    }

    engine.removeDrawables(blockDrawables);
    blockDrawables = nextDrawables;
    imported = compiled;
    sourceLabel = label;
    persistenceLabel = options.persistenceLabel || 'PREVIEW ONLY';

    if (options.persist) {
      const saved = persistActiveBlock({
        document: compiled.document,
        fileName: options.fileName || label,
        id: compiled.id,
        name: compiled.name
      });
      persistenceLabel = saved.mode;
      if (!saved.ok && status) {
        status.classList.add('error');
        status.classList.remove('ready', 'settled');
        status.innerHTML = `<strong>${escapeText(compiled.name)} · LOADED, NOT SAVED</strong><span>${escapeText(saved.error || 'Browser storage is unavailable in this preview, so this import will reset when the preview reloads.')}</span>`;
      }
    }

    updateHud();
    resetCamera();
    if (!(options.persist && persistenceLabel === 'UNSAVED')) showReady();
    return compiled;
  };

  const loadBundledBlock = async ({ reason = '' } = {}) => {
    if (status) {
      status.classList.remove('ready', 'error', 'settled');
      status.innerHTML = '<strong>IMPORTING COMMERCE BLOCK 01…</strong><span>Fetching the bundled JSON, validating its contract, expanding compact operations and compiling cross-section block meshes.</span>';
    }
    const response = await fetch(DEFAULT_BLOCK_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Bundled Block 001 request failed with HTTP ${response.status}.`);
    const document = await response.json();
    if (destroyed) return null;
    const compiled = loadDocument(document, 'DEFAULT BLOCK 001', { persistenceLabel: 'BUNDLED' });
    if (reason && status) {
      status.classList.add('ready');
      status.classList.remove('error', 'settled');
      status.innerHTML = `<strong>DEFAULT BLOCK RESTORED</strong><span>${escapeText(reason)}</span>`;
    }
    return compiled;
  };

  const loadActiveBlock = async () => {
    const saved = readPersistedBlock();
    if (!saved) return loadBundledBlock();

    if (status) {
      status.classList.remove('ready', 'error', 'settled');
      status.innerHTML = `<strong>RESTORING ACTIVE IMPORT…</strong><span>${escapeText(saved.fileName || saved.name || saved.id || 'Saved city block')} was saved by the JSON importer in this browser preview.</span>`;
    }

    try {
      return loadDocument(saved.document, saved.fileName || 'SAVED IMPORT', {
        persistenceLabel: saved.mode === 'SESSION' ? 'SESSION SAVED' : 'PERSISTED'
      });
    } catch (error) {
      console.warn('Saved RiftCity block could not be restored; falling back to bundled Block 001.', error);
      clearPersistedBlock();
      return loadBundledBlock({
        reason: `The saved import could not be restored (${error?.message || 'invalid saved JSON'}), so RiftCity cleared it and loaded the bundled default.`
      });
    }
  };

  const onImportClick = () => {
    if (fileInput) fileInput.value = '';
    fileInput?.click();
  };
  importButton?.addEventListener('click', onImportClick);

  const onFileChange = async () => {
    const file = fileInput?.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      if (status) {
        status.classList.add('error');
        status.innerHTML = '<strong>IMPORT REJECTED</strong><span>JSON test files are capped at 2 MB so a bad import cannot freeze the iPhone preview.</span>';
      }
      fileInput.value = '';
      return;
    }
    try {
      if (status) {
        status.classList.remove('ready', 'error', 'settled');
        status.innerHTML = `<strong>IMPORTING ${escapeText(file.name)}…</strong><span>Validating JSON and compiling RiftSections.</span>`;
      }
      const text = await file.text();
      loadDocument(JSON.parse(text), file.name.toUpperCase(), {
        persist: true,
        fileName: file.name
      });
    } catch (error) {
      console.error('RiftCity JSON block import rejected', error);
      if (status) {
        status.classList.add('error');
        status.classList.remove('ready', 'settled');
        const active = imported ? ` Current active block remains ${imported.name}.` : '';
        status.innerHTML = `<strong>IMPORT REJECTED</strong><span>${escapeText(error?.message || 'Invalid RiftCity block JSON.')}${escapeText(active)}</span>`;
      }
    } finally {
      if (fileInput) fileInput.value = '';
    }
  };
  fileInput?.addEventListener('change', onFileChange);

  const onResetBlock = async () => {
    try {
      clearPersistedBlock();
      await loadBundledBlock({ reason: 'Saved imported-block state was cleared. Refreshes will now open the bundled default until another JSON block is imported.' });
    } catch (error) {
      if (status) {
        status.classList.add('error');
        status.innerHTML = `<strong>BLOCK 001 RELOAD FAILED</strong><span>${escapeText(error?.message || 'Could not reload bundled block.')}</span>`;
      }
    }
  };
  resetButton?.addEventListener('click', onResetBlock);

  const onSpin = () => {
    spinning = !spinning;
    spinButton?.classList.toggle('active', spinning);
    if (spinButton) spinButton.textContent = spinning ? 'SPIN ON' : 'SPIN';
  };
  spinButton?.addEventListener('click', onSpin);

  const onCull = () => {
    culling = !culling;
    for (const drawable of blockDrawables) drawable.doubleSided = !culling;
    cullButton?.classList.toggle('active', culling);
    if (cullButton) cullButton.textContent = culling ? 'CULL ON' : 'CULL OFF';
  };
  cullButton?.addEventListener('click', onCull);

  const onTop = () => {
    if (!imported) return;
    topView = !topView;
    const view = calculateCamera();
    camera.setTarget(imported.center[0], imported.worldBounds.min[1], imported.center[2]);
    if (topView) {
      camera.alpha = -Math.PI / 2;
      camera.beta = 0.11;
      camera.radius = Math.max(72, view.radius * 1.05);
    } else {
      camera.alpha = -0.72;
      camera.beta = 0.78;
      camera.radius = view.radius;
      camera.setTarget(...view.target);
    }
    camera.updatePosition();
    topButton?.classList.toggle('active', topView);
    if (topButton) topButton.textContent = topView ? 'ANGLE VIEW' : 'TOP VIEW';
  };
  topButton?.addEventListener('click', onTop);
  viewButton?.addEventListener('click', resetCamera);

  const orbit = setupDiagnosticOrbit(canvas, camera);
  const resize = () => {
    const target = coarsePointer ? 1.35 : 1.75;
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

  let raf = 0;
  let fpsTimer = performance.now();
  let frames = 0;
  let lastFrame = performance.now();
  const tick = now => {
    if (destroyed) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (spinning) camera.orbit(dt * 0.34, 0);
    engine.render(camera);
    const renderStats = engine.getStats();
    if (drawsMetric) drawsMetric.textContent = `DRAWS ${renderStats.draws}`;
    frames += 1;
    if (now - fpsTimer >= 500) {
      const fps = Math.round(frames * 1000 / Math.max(1, now - fpsTimer));
      if (fpsMetric) fpsMetric.textContent = `FPS ${fps}`;
      fpsTimer = now;
      frames = 0;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    engine,
    camera,
    faceValidation,
    storageValidation,
    shapeValidation,
    importerValidation,
    loadDocument,
    loadBundledBlock,
    loadActiveBlock,
    get imported() { return imported; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      orbit.destroy();
      importButton?.removeEventListener('click', onImportClick);
      fileInput?.removeEventListener('change', onFileChange);
      resetButton?.removeEventListener('click', onResetBlock);
      spinButton?.removeEventListener('click', onSpin);
      cullButton?.removeEventListener('click', onCull);
      topButton?.removeEventListener('click', onTop);
      viewButton?.removeEventListener('click', resetCamera);
      fullscreenButton?.removeEventListener('click', onFullscreenButton);
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


function storageCandidates() {
  const candidates = [];
  try {
    if (window.localStorage) candidates.push({ mode: 'PERSISTED', storage: window.localStorage });
  } catch (_) {}
  try {
    if (window.sessionStorage) candidates.push({ mode: 'SESSION', storage: window.sessionStorage });
  } catch (_) {}
  return candidates;
}

function encodedByteLength(text) {
  try { return new TextEncoder().encode(text).byteLength; }
  catch (_) { return String(text).length * 2; }
}

function persistActiveBlock({ document, fileName, id, name }) {
  const payload = JSON.stringify({
    version: ACTIVE_BLOCK_STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    fileName: String(fileName || 'imported-block.json'),
    id: String(id || document?.id || 'imported-block'),
    name: String(name || document?.name || document?.id || 'Imported RiftCity Block'),
    document
  });

  if (encodedByteLength(payload) > ACTIVE_BLOCK_MAX_BYTES) {
    return { ok: false, mode: 'UNSAVED', error: 'The imported block loaded, but its saved JSON is larger than the 2 MB active-block persistence limit.' };
  }

  const errors = [];
  let primaryMode = null;
  for (const candidate of storageCandidates()) {
    try {
      candidate.storage.setItem(ACTIVE_BLOCK_STORAGE_KEY, payload);
      if (!primaryMode) primaryMode = candidate.mode;
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  if (!primaryMode) {
    return {
      ok: false,
      mode: 'UNSAVED',
      error: errors[0] || 'This local preview does not expose localStorage/sessionStorage, so the import cannot survive a preview refresh.'
    };
  }

  return { ok: true, mode: primaryMode };
}

function readPersistedBlock() {
  for (const candidate of storageCandidates()) {
    try {
      const raw = candidate.storage.getItem(ACTIVE_BLOCK_STORAGE_KEY);
      if (!raw) continue;
      const saved = JSON.parse(raw);
      if (Number(saved?.version) !== ACTIVE_BLOCK_STORAGE_VERSION || !saved?.document) {
        candidate.storage.removeItem(ACTIVE_BLOCK_STORAGE_KEY);
        continue;
      }
      return { ...saved, mode: candidate.mode };
    } catch (_) {}
  }
  return null;
}

function clearPersistedBlock() {
  for (const candidate of storageCandidates()) {
    try { candidate.storage.removeItem(ACTIVE_BLOCK_STORAGE_KEY); } catch (_) {}
  }
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
      const pinch = pinchDistance();
      if (pinch != null && lastPinch != null) camera.zoom((lastPinch - pinch) * 0.075);
      lastPinch = pinch;
      return;
    }

    camera.orbit((next.x - previous.x) * 0.006, (next.y - previous.y) * 0.005);
  };

  const onPointerUp = event => {
    pointers.delete(event.pointerId);
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    lastPinch = pinchDistance();
  };

  const onWheel = event => {
    event.preventDefault();
    camera.zoom(event.deltaY * 0.025);
  };

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp, { passive: false });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: false });
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    destroy() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    }
  };
}

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
