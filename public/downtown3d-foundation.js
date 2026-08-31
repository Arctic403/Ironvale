import { RiftCamera, RiftEngine } from './rift-engine.js';
import { validateRiftBlockFaceWinding } from './rift-block-world.js';
import { validateRiftBlockSectionStorage } from './rift-block-section.js';
import { validateRiftBlockShapes } from './rift-block-shapes.js';
import { compileRiftCityBlock, validateRiftCityBlockImporter } from './rift-city-block-importer.js';
import { assertMeterScale } from './rift-world-scale.js';
import { createRiftPlayer, createRiftPlayerController } from './rift-player.js';
import { createRiftCreativeMode } from './rift-creative-mode.js';
import { createRiftThirdPersonCamera, createRiftFirstPersonCamera } from './rift-third-person-camera.js';

let activeFoundation = null;
const DEFAULT_BLOCK_URL = new URL('./rift-world-blocks/ironvale-foundation-001.json', import.meta.url);
const ACTIVE_BLOCK_STORAGE_KEY = 'ironvale:world:active-block:v1';
const ACTIVE_BLOCK_STORAGE_VERSION = 1;
const ACTIVE_BLOCK_MAX_BYTES = 2 * 1024 * 1024;

export function destroyDowntown3D() {
  // Detach the global reference before running disposal. If one cleanup hook
  // throws (WebGL/Safari can do this while a page is being replaced), the SPA
  // must still be able to navigate and a later destroy call must not retry the
  // same half-disposed foundation forever.
  const foundation = activeFoundation;
  activeFoundation = null;
  try {
    foundation?.destroy?.();
  } catch (error) {
    console.warn('Rift world foundation cleanup failed', error);
  } finally {
    document.body.classList.remove('world3d-game-mode');
    const style = document.documentElement.style;
    style.removeProperty('--rift-viewport-width');
    style.removeProperty('--rift-viewport-height');
    style.removeProperty('--rift-viewport-left');
    style.removeProperty('--rift-viewport-top');
  }
}

export async function renderDowntown3D(root) {
  destroyDowntown3D();

  root.innerHTML = `
    <section class="world3d-shell downtown3d-foundation rift-block-import-lab" aria-label="Ironvale Rift Engine world">
      <canvas id="riftcity-3d-canvas" aria-label="Ironvale world preview"></canvas>
      <div class="world3d-vignette" aria-hidden="true"></div>
      <div id="rift-first-person-reticle" class="rift-first-person-reticle" aria-hidden="true"><span></span></div>

      <div class="world3d-top-left downtown3d-title rift-import-title">
        <span class="eyebrow">IRONVALE · RIFT ENGINE WORLD FOUNDATION</span>
        <strong id="rift-import-name">LOADING IRONVALE FOUNDATION…</strong>
        <small id="rift-import-description">The Ironvale world foundation is live on Rift Engine: native sections, third-person movement, build tools and streaming-ready terrain.</small>
      </div>

      <div class="world3d-top-right downtown3d-actions rift-import-actions">
        <button id="rift-creative-toggle" class="world3d-hud-button rift-creative-toggle" type="button">BUILD MODE</button>
        <button id="rift-creative-open-panel" class="world3d-hud-button rift-creative-panel-button" type="button">TOOLS</button>
        <button id="rift-import-json" class="world3d-hud-button" type="button">IMPORT JSON</button>
        <button id="rift-import-reset" class="world3d-hud-button" type="button">RESET DEFAULT</button>
        <button id="rift-import-cull" class="world3d-hud-button active" type="button">CULL ON</button>
        <button id="rift-import-top" class="world3d-hud-button" type="button">WORLD OVERVIEW</button>
        <button id="rift-import-view" class="world3d-hud-button" type="button">RESET VIEW</button>
        <button id="rift-first-person-toggle" class="world3d-hud-button" type="button">FIRST PERSON</button>
        <button id="world3d-fullscreen-button" class="world3d-hud-button" type="button">FULLSCREEN</button>
        <input id="rift-import-file" class="rift-import-file" type="file" accept=".json,application/json" aria-label="Choose a Rift Engine world block JSON file">
      </div>

      <div id="downtown3d-status" class="downtown3d-status settled" role="status">
        <strong>LOADING JSON BLOCK IMPORTER…</strong>
        <span>Re-running block winding, section storage, full/slab/stair and importer validation before rendering the first authored city block.</span>
      </div>



      <div class="rift-player-touch" aria-label="RiftPlayer controls">
        <div class="rift-player-pad" data-rift-player-pad><span></span></div>
        <div class="rift-player-actions">
          <button type="button" data-rift-player-jump>JUMP</button>
          <button type="button" data-rift-player-run>RUN</button>
        </div>
      </div>

      <aside id="rift-creative-panel" class="rift-creative-panel" aria-label="Ironvale reticle build tools">
        <header><div><span>IRONVALE BUILD MODE</span><strong>RIFT WORLD BUILDER</strong></div><button id="rift-creative-close" type="button">HIDE</button></header>
        <div class="rift-creative-block-actions"><button data-rift-block-action="break" class="active">BREAK CELL</button><button data-rift-block-action="place">PLACE CELL</button></div>
        <label>BLOCK<select id="rift-creative-block-state"></select></label>
        <button id="rift-creative-stair-rotate" type="button">ROTATE STAIR ↷</button>
        <p id="rift-creative-status">Enter Build Mode, aim the center reticle at a RiftBlock, then tap/click the canvas to use BREAK or PLACE.</p>
        <details><summary>BLUEPRINT OBJECT TOOLS</summary>
          <label>OBJECT<select id="rift-creative-object"></select></label>
          <div class="rift-creative-readout"><div><span>SELECTED</span><b id="rift-creative-selected">NONE</b></div><div><span>POSITION</span><b id="rift-creative-pos">--</b></div><div><span>ROTATION</span><b id="rift-creative-rot">--</b></div></div>
          <div class="rift-creative-nudge">
            <button data-rift-nudge="0,0,-1">N</button><button data-rift-nudge="0,1,0">+Y</button><button data-rift-nudge="0,0,1">S</button>
            <button data-rift-nudge="-1,0,0">W</button><button data-rift-nudge="0,-1,0">-Y</button><button data-rift-nudge="1,0,0">E</button>
          </div>
          <div class="rift-creative-actions"><button id="rift-creative-rotate-left">↶ ROTATE</button><button id="rift-creative-rotate-right">ROTATE ↷</button><button id="rift-creative-duplicate">DUPLICATE</button><button id="rift-creative-delete" class="danger">DELETE</button></div>
        </details>
        <div class="rift-creative-actions"><button id="rift-creative-undo">UNDO</button><button id="rift-creative-redo">REDO</button></div>
        <details class="rift-ai-draft-inbox">
          <summary>AI DRAFT INBOX · DEV ONLY</summary>
          <p id="rift-ai-draft-status">Developer/admin accounts can load public AI Builder drafts from D1 into this normal Build Mode. Loading is still staging only.</p>
          <label>AI DRAFT<select id="rift-ai-draft-select"><option value="">REFRESH TO LIST DRAFTS</option></select></label>
          <div class="rift-creative-actions"><button id="rift-ai-draft-refresh" type="button">REFRESH</button><button id="rift-ai-draft-load" class="primary" type="button">LOAD DRAFT</button></div>
          <small id="rift-ai-draft-meta">Nothing from this inbox publishes automatically.</small>
        </details>
        <button id="rift-creative-export" class="primary" type="button">EXPORT WORLD JSON</button>
        <small>BUILD MODE: keep walking normally · tap/click cells directly · BREAK/PLACE · B swaps tools · R rotates stairs/prefabs · swipe/drag to look · Ctrl/Cmd+Z undo</small>
      </aside>

      <div class="downtown3d-meter rift-import-meter" aria-live="polite">
        <span id="rift-mode-label">PLAY</span>
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
    console.error('Ironvale Rift Engine world failed to start', error);
    if (status) {
      status.classList.add('error');
      status.classList.remove('settled');
      status.innerHTML = `<strong>JSON BLOCK IMPORTER FAILED</strong><span>${escapeText(error?.message || 'The importer could not initialize.')}</span>`;
    }
    activeFoundation?.destroy?.();
    activeFoundation = null;
    return null;
  }
}

function createBlockImporterLab({ root, canvas, status }) {
  assertMeterScale();
  const validatorDebugEnabled = () => document.body.classList.contains('rift-validator-debug');

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
  const THIRD_PERSON_ALPHA = -Math.PI / 2;
  const THIRD_PERSON_BETA = 1.02;
  const THIRD_PERSON_DISTANCE = 8.5;
  const OVERHEAD_ORTHO_SIZE = 24;
  const camera = new RiftCamera({
    projection: 'perspective',
    alpha: THIRD_PERSON_ALPHA,
    beta: THIRD_PERSON_BETA,
    radius: THIRD_PERSON_DISTANCE,
    minRadius: 2.2,
    maxRadius: 14,
    orthoSize: OVERHEAD_ORTHO_SIZE,
    minOrthoSize: 12,
    maxOrthoSize: 88,
    minBeta: 0.08,
    maxBeta: 1.15,
    fov: Math.PI / 3.05,
    near: 0.05,
    far: 300
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
  let sourceLabel = 'IRONVALE FOUNDATION';
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
  const firstPersonButton = root.querySelector('#rift-first-person-toggle');
  const firstPersonReticle = root.querySelector('#rift-first-person-reticle');
  const fullscreenButton = root.querySelector('#world3d-fullscreen-button');
  const fileInput = root.querySelector('#rift-import-file');

  const player = createRiftPlayer(engine, { position: [32, 2, 32] });
  let requestedPlayerVisible = true;
  player.setVisible(true);
  const playerController = createRiftPlayerController({
    canvas, camera, player, touchRoot: root,
    getGrid: () => imported?.grid || null,
    getWorldBounds: () => imported?.worldBounds || null
  });
  let creative = null;
  let thirdPersonCamera = null;
  let firstPersonCamera = null;
  let firstPersonActive = false;

  const syncPlayerVisibility = () => player.setVisible(requestedPlayerVisible && !firstPersonActive);
  const syncReticleUi = () => {
    const reticleActive = !topView;
    root.classList.toggle('rift-reticle-active', reticleActive);
    shell?.classList.toggle('rift-reticle-active', reticleActive);
    firstPersonReticle?.setAttribute('aria-hidden', reticleActive ? 'false' : 'true');
  };
  const syncFirstPersonUi = () => {
    root.classList.toggle('rift-first-person-active', firstPersonActive);
    shell?.classList.toggle('rift-first-person-active', firstPersonActive);
    firstPersonButton?.classList.toggle('active', firstPersonActive);
    if (firstPersonButton) firstPersonButton.textContent = firstPersonActive ? 'THIRD PERSON' : 'FIRST PERSON';
    syncReticleUi();
    syncPlayerVisibility();
  };
  const setFirstPerson = (next, { resetCamera = true } = {}) => {
    firstPersonActive = !!next;
    if (firstPersonActive) {
      topView = false;
      topButton?.classList.remove('active');
      if (topButton) topButton.textContent = 'CITY OVERVIEW';
      if (resetCamera) firstPersonCamera?.reset({ immediate: true });
    } else if (resetCamera) {
      thirdPersonCamera?.reset({ immediate: true });
    }
    syncFirstPersonUi();
    return firstPersonActive;
  };

  const resetPlayerCamera = () => {
    topView = false;
    topButton?.classList.remove('active');
    if (topButton) topButton.textContent = 'CITY OVERVIEW';
    if (firstPersonActive && firstPersonCamera) {
      firstPersonCamera.reset({ immediate: true });
    } else if (thirdPersonCamera) {
      thirdPersonCamera.reset({ immediate: true });
    } else {
      const p = player.position;
      camera.setProjection('perspective');
      camera.alpha = THIRD_PERSON_ALPHA;
      camera.beta = THIRD_PERSON_BETA;
      camera.radius = THIRD_PERSON_DISTANCE;
      camera.setTarget(p[0], p[1] + 1.15, p[2]);
    }
    syncReticleUi();
  };

  const updatePlayerCamera = dt => {
    if (topView) return;
    if (firstPersonActive) firstPersonCamera?.update(dt);
    else thirdPersonCamera?.update(dt);
  };

  const syncBuildUi = () => {
    const buildMode = !!creative?.active;
    root.classList.toggle('rift-build-active', buildMode);
    shell?.classList.toggle('rift-build-active', buildMode);
    const toggle = root.querySelector('#rift-creative-toggle');
    if (toggle) {
      toggle.classList.toggle('active', buildMode);
      toggle.textContent = buildMode ? 'EXIT BUILD' : 'BUILD MODE';
    }
    const label = root.querySelector('#rift-mode-label');
    if (label) label.textContent = buildMode ? 'BUILD' : 'PLAY';
  };

  const resetCamera = () => {
    setFirstPerson(false, { resetCamera: false });
    resetPlayerCamera();
  };

  const setInspectionCamera = (view = 'top') => {
    topView = false;
    setFirstPerson(false, { resetCamera: false });
    const bounds = imported?.worldBounds;
    const minX = Number(bounds?.min?.[0]) || 0;
    const minY = Number(bounds?.min?.[1]) || 0;
    const minZ = Number(bounds?.min?.[2]) || 0;
    const maxX = Number(bounds?.max?.[0]) || 64;
    const maxY = Number(bounds?.max?.[1]) || 16;
    const maxZ = Number(bounds?.max?.[2]) || 64;
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const span = Math.max(spanX, spanZ);
    camera.setProjection('orthographic');
    camera.orthoSize = Math.max(24, span * 0.62);
    camera.radius = Math.max(42, span * 0.95);
    if (view === 'birdseye') {
      camera.alpha = -Math.PI * 0.72;
      camera.beta = 0.62;
      camera.orthoSize = Math.max(24, span * 0.48);
      camera.radius = Math.max(38, span * 0.78);
    } else {
      camera.alpha = -Math.PI / 2;
      camera.beta = 0.001;
    }
    camera.setTarget(centerX, Math.max(minY, Math.min(maxY, minY + 1.5)), centerZ);
    syncReticleUi();
    engine.render(camera);
  };

  const captureCanvasPng = () => canvas.toDataURL('image/png');

  const clearCurrentMeshes = () => {
    for (const mesh of blockDrawables) engine.removeMesh(mesh);
    blockDrawables = [];
  };

  const updateStats = compiled => {
    if (!compiled) return;
    if (nameLabel) nameLabel.textContent = String(compiled.name || compiled.id || 'IRONVALE FOUNDATION').toUpperCase();
    if (descriptionLabel) descriptionLabel.textContent = compiled.description || 'Compiled Rift Engine JSON world block.';
    if (sourceMetric) sourceMetric.textContent = sourceLabel;
    if (opsMetric) opsMetric.textContent = `OPS ${compiled.operationCount ?? '--'}`;
    if (cellsMetric) cellsMetric.textContent = `CELLS ${compiled.cellCount ?? '--'}`;
    if (partialMetric) partialMetric.textContent = `PARTIAL ${compiled.partialCellCount ?? 0}`;
    if (sectionsMetric) sectionsMetric.textContent = `SECTIONS ${compiled.sectionCount ?? '--'}`;
    if (memoryMetric) memoryMetric.textContent = `STATE ${persistenceLabel}`;
    if (trisMetric) trisMetric.textContent = `TRIS ${compiled.triangleCount ?? '--'}`;
  };

  const reportReady = compiled => {
    if (!status || !validatorDebugEnabled()) return;
    status.classList.add('ready');
    status.classList.remove('error', 'settled');
    status.innerHTML = `<strong>IRONVALE WORLD READY</strong><span>${escapeText(compiled?.name || compiled?.id || 'Foundation')} · ${compiled?.cellCount ?? 0} cells · ${compiled?.triangleCount ?? 0} triangles</span>`;
    window.setTimeout(() => status.classList.add('settled'), 2400);
  };

  const loadDocument = (document, label = 'LOCAL JSON', options = {}) => {
    const compiled = compileRiftCityBlock(document);
    if (destroyed) return compiled;

    const nextDrawables = [];
    try {
      for (const mesh of compiled.meshes) {
        // H1.74: third-person camera collision owns visibility. Render each compiled
        // chunk as a normal Rift mesh and let the camera/visibility systems decide.
        const drawable = engine.createMesh(mesh.geometry, {
          ...meshOptions,
          name: mesh.name || `${compiled.id}-mesh`
        });
        nextDrawables.push(drawable);
      }
    } catch (error) {
      for (const mesh of nextDrawables) engine.removeMesh(mesh);
      throw error;
    }

    clearCurrentMeshes();
    blockDrawables = nextDrawables;
    imported = compiled;
    sourceLabel = label;
    persistenceLabel = options.persistenceLabel || persistenceLabel;
    updateStats(compiled);
    playerController.setGrid?.(compiled.grid || null);
    creative?.setGrid?.(compiled.grid || null, compiled);
    resetCamera();
    reportReady(compiled);
    return compiled;
  };

  const loadBundledBlock = async ({ reason = '' } = {}) => {
    if (status && validatorDebugEnabled()) {
      status.classList.remove('error', 'settled');
      status.innerHTML = '<strong>IMPORTING COMMERCE BLOCK 01…</strong><span>Fetching the bundled JSON, validating its contract, expanding compact operations and compiling cross-section block meshes.</span>';
    }
    const response = await fetch(DEFAULT_BLOCK_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Bundled Block 001 request failed with HTTP ${response.status}.`);
    const document = await response.json();
    if (destroyed) return null;
    const compiled = loadDocument(document, 'DEFAULT BLOCK 001', { persistenceLabel: 'BUNDLED' });
    if (reason && status && validatorDebugEnabled()) {
      status.classList.add('ready');
      status.classList.remove('error', 'settled');
      status.innerHTML = `<strong>DEFAULT BLOCK RESTORED</strong><span>${escapeText(reason)}</span>`;
      window.setTimeout(() => status.classList.add('settled'), 2200);
    }
    return compiled;
  };

  const loadActiveBlock = async () => {
    const saved = readPersistedBlock();
    if (saved?.document) {
      try {
        return loadDocument(saved.document, 'ACTIVE IMPORT', { persistenceLabel: saved.mode || 'PERSISTED' });
      } catch (error) {
        console.warn('Ignoring invalid persisted Ironvale block', error);
        clearPersistedBlock();
      }
    }
    return loadBundledBlock();
  };

  const onImportClick = () => fileInput?.click();
  const onFileChange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const document = JSON.parse(text);
      const compiled = loadDocument(document, 'LOCAL IMPORT', { persistenceLabel: 'SESSION' });
      const saved = persistActiveBlock({ document, fileName: file.name, id: compiled.id, name: compiled.name });
      persistenceLabel = saved.mode;
      if (memoryMetric) memoryMetric.textContent = `STATE ${persistenceLabel}`;
      if (!saved.ok && status && validatorDebugEnabled()) {
        status.classList.add('error');
        status.classList.remove('settled');
        status.innerHTML = `<strong>WORLD LOADED, SAVE FAILED</strong><span>${escapeText(saved.error)}</span>`;
      }
    } catch (error) {
      console.error(error);
      if (status && validatorDebugEnabled()) {
        status.classList.add('error');
        status.classList.remove('settled');
        status.innerHTML = `<strong>IMPORT FAILED</strong><span>${escapeText(error?.message || 'Invalid JSON world block.')}</span>`;
      }
    } finally {
      event.target.value = '';
    }
  };
  const onResetBlock = async () => {
    clearPersistedBlock();
    persistenceLabel = 'BUNDLED';
    await loadBundledBlock({ reason: 'Local active block cleared.' });
  };
  const onSpin = () => { spinning = !spinning; spinButton?.classList.toggle('active', spinning); };
  const onCull = () => {
    culling = !culling;
    cullButton?.classList.toggle('active', culling);
    if (cullButton) cullButton.textContent = culling ? 'CULL ON' : 'CULL OFF';
    for (const mesh of blockDrawables) mesh.setCulling?.(culling);
  };
  const onTop = () => {
    topView = !topView;
    if (topView) setInspectionCamera('top'); else resetPlayerCamera();
    topButton?.classList.toggle('active', topView);
    if (topButton) topButton.textContent = topView ? 'RETURN TO PLAYER' : 'WORLD OVERVIEW';
  };
  const onResetView = () => resetPlayerCamera();
  const onFirstPersonButton = () => setFirstPerson(!firstPersonActive);
  const onViewModeKey = event => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key?.toLowerCase() !== 'v') return;
    if (!document.body.classList.contains('rift-dev-mode')) return;
    setFirstPerson(!firstPersonActive);
  };
  const onDevModeChange = () => {
    if (!document.body.classList.contains('rift-dev-mode') && firstPersonActive) setFirstPerson(false);
  };
  const onValidatorDebugChange = () => {
    if (!validatorDebugEnabled() && status) {
      status.classList.remove('ready', 'error');
      status.classList.add('settled');
    } else if (validatorDebugEnabled() && imported) reportReady(imported);
  };

  importButton?.addEventListener('click', onImportClick);
  fileInput?.addEventListener('change', onFileChange);
  resetButton?.addEventListener('click', onResetBlock);
  spinButton?.addEventListener('click', onSpin);
  cullButton?.addEventListener('click', onCull);
  topButton?.addEventListener('click', onTop);
  viewButton?.addEventListener('click', onResetView);
  firstPersonButton?.addEventListener('click', onFirstPersonButton);
  window.addEventListener('keydown', onViewModeKey);
  window.addEventListener('riftdevmodechange', onDevModeChange);
  window.addEventListener('riftvalidatordebugchange', onValidatorDebugChange);

  const orbit = setupThirdPersonCameraControls(canvas, camera, {
    isLocked: () => topView,
    getController: () => firstPersonActive ? firstPersonCamera : thirdPersonCamera
  });
  creative = createRiftCreativeMode({
    root, canvas, engine, camera, player, playerController,
    getGrid: () => imported?.grid || null,
    getCompiled: () => imported,
    onChanged: compiled => {
      imported = compiled;
      updateStats(compiled);
    },
    onModeChanged: syncBuildUi
  });
  thirdPersonCamera = createRiftThirdPersonCamera({ canvas, camera, player, playerController, getGrid: () => imported?.grid || null });
  firstPersonCamera = createRiftFirstPersonCamera({ canvas, camera, player, playerController, getGrid: () => imported?.grid || null });
  resetCamera();
  syncBuildUi();

  let viewportSettleTimer = 0;
  let viewportFinalTimer = 0;

  const syncViewport = () => {
    if (destroyed) return;
    const viewport = window.visualViewport;
    const width = Math.max(1, Math.round(Number(viewport?.width) || window.innerWidth || shell?.clientWidth || canvas.clientWidth || 1));
    const height = Math.max(1, Math.round(Number(viewport?.height) || window.innerHeight || shell?.clientHeight || canvas.clientHeight || 1));
    const style = document.documentElement.style;
    style.setProperty('--rift-viewport-width', `${width}px`);
    style.setProperty('--rift-viewport-height', `${height}px`);
    style.setProperty('--rift-viewport-left', `${Math.round(Number(viewport?.offsetLeft) || 0)}px`);
    style.setProperty('--rift-viewport-top', `${Math.round(Number(viewport?.offsetTop) || 0)}px`);
    const target = coarsePointer ? 1.35 : 1.75;
    const deviceRatio = Math.max(1, window.devicePixelRatio || 1);
    engine.resize(Math.min(deviceRatio, target));
  };

  const settleViewport = () => {
    if (destroyed) return;
    syncViewport();
    requestAnimationFrame(syncViewport);
    clearTimeout(viewportSettleTimer);
    clearTimeout(viewportFinalTimer);
    // Mobile Safari/PWA viewport dimensions can settle after fullscreen chrome
    // and orientation promises resolve. Sample again across that window.
    viewportSettleTimer = window.setTimeout(syncViewport, 80);
    viewportFinalTimer = window.setTimeout(syncViewport, 220);
  };

  const clearViewportMetrics = () => {
    const style = document.documentElement.style;
    style.removeProperty('--rift-viewport-width');
    style.removeProperty('--rift-viewport-height');
    style.removeProperty('--rift-viewport-left');
    style.removeProperty('--rift-viewport-top');
  };

  const setGameMode = async enabled => {
    gameMode = !!enabled;
    document.body.classList.toggle('world3d-game-mode', gameMode);
    settleViewport();
    if (gameMode) {
      try { await shell?.requestFullscreen?.({ navigationUI: 'hide' }); }
      catch (_) {
        try { await shell?.webkitRequestFullscreen?.(); } catch (_) {}
      }
      try { await screen.orientation?.lock?.('landscape'); } catch (_) {}
    } else {
      try { screen.orientation?.unlock?.(); } catch (_) {}
      if (document.fullscreenElement) { try { await document.exitFullscreen?.(); } catch (_) {} }
      else if (document.webkitFullscreenElement) { try { document.webkitExitFullscreen?.(); } catch (_) {} }
    }
    settleViewport();
  };
  const onFullscreenButton = () => setGameMode(!gameMode);
  const onFullscreenChange = () => {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fullscreenElement && gameMode) {
      gameMode = false;
      document.body.classList.remove('world3d-game-mode');
      try { screen.orientation?.unlock?.(); } catch (_) {}
    }
    settleViewport();
  };
  fullscreenButton?.addEventListener('click', onFullscreenButton);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  window.addEventListener('resize', settleViewport);
  window.addEventListener('orientationchange', settleViewport);
  window.visualViewport?.addEventListener('resize', settleViewport);
  window.visualViewport?.addEventListener('scroll', settleViewport);
  settleViewport();

  let raf = 0;
  let fpsTimer = performance.now();
  let frames = 0;
  let lastFrame = performance.now();
  const tick = now => {
    if (destroyed) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    playerController.update(dt);
    updatePlayerCamera(dt);
    if (creative?.active) creative.update(dt);
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
    canvas,
    player,
    playerController,
    creative,
    setInspectionCamera,
    captureCanvasPng,
    setPlayerVisible(next) {
      requestedPlayerVisible = !!next;
      syncPlayerVisibility();
    },
    setFirstPerson,
    get firstPersonActive() { return firstPersonActive; },
    renderNow() { engine.render(camera); },
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
      viewButton?.removeEventListener('click', onResetView);
      firstPersonButton?.removeEventListener('click', onFirstPersonButton);
      window.removeEventListener('keydown', onViewModeKey);
      window.removeEventListener('riftdevmodechange', onDevModeChange);
      window.removeEventListener('riftvalidatordebugchange', onValidatorDebugChange);
      fullscreenButton?.removeEventListener('click', onFullscreenButton);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      window.removeEventListener('resize', settleViewport);
      window.removeEventListener('orientationchange', settleViewport);
      window.visualViewport?.removeEventListener('resize', settleViewport);
      window.visualViewport?.removeEventListener('scroll', settleViewport);
      clearTimeout(viewportSettleTimer);
      clearTimeout(viewportFinalTimer);
      clearViewportMetrics();
      document.body.classList.remove('world3d-game-mode');
      creative?.destroy?.();
      playerController.destroy();
      player.destroy();
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

function setupThirdPersonCameraControls(canvas, camera, { isLocked = () => false, getController = () => null } = {}) {
  let lookPointerId = null;
  let previousPoint = null;

  const onPointerDown = event => {
    if (event.button != null && event.button !== 0) return;
    if (isLocked() || lookPointerId != null) return;
    event.preventDefault();
    lookPointerId = event.pointerId;
    previousPoint = { x: event.clientX, y: event.clientY };
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
  };

  const onPointerMove = event => {
    if (event.pointerId !== lookPointerId || !previousPoint || isLocked()) return;
    event.preventDefault();
    const next = { x: event.clientX, y: event.clientY };
    const dx = next.x - previousPoint.x;
    const dy = next.y - previousPoint.y;
    previousPoint = next;
    getController()?.orbit?.(dx * -0.008, dy * 0.006);
  };

  const onPointerUp = event => {
    if (event.pointerId !== lookPointerId) return;
    lookPointerId = null;
    previousPoint = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
  };

  // No pinch and no wheel handler by design: gameplay third-person distance is
  // fixed. Additional fingers are ignored instead of being interpreted as zoom.
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp, { passive: false });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: false });

  return {
    destroy() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
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
