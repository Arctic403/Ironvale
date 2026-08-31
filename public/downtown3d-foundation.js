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
  activeFoundation?.destroy?.();
  activeFoundation = null;
  document.body.classList.remove('world3d-game-mode');
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

  const calculateCamera = () => {
    if (!imported) return { target: [32, 4, 32], orthoSize: 76 };
    const min = imported.worldBounds.min;
    const max = imported.worldBounds.max;
    const width = max[0] - min[0] + 1;
    const depth = max[2] - min[2] + 1;
    const height = max[1] - min[1] + 1;
    return {
      target: [imported.center[0], min[1] + Math.min(5, height * 0.28), imported.center[2]],
      orthoSize: Math.max(28, Math.min(88, Math.max(width, depth) * 1.18 + height * 0.35))
    };
  };

  const normalizeInspectionBounds = bounds => {
    const fallback = imported?.worldBounds || { min: [0, 0, 0], max: [63, 16, 63] };
    const source = bounds?.min && bounds?.max ? bounds : fallback;
    const min = source.min.map(Number);
    const max = source.max.map(Number);
    return { min, max };
  };

  const setInspectionCamera = (mode = 'birdseye', bounds = null) => {
    const next = String(mode || 'birdseye').toLowerCase();
    if (next === 'first-person' || next === 'first' || next === 'fp') {
      setFirstPerson(true);
      return { mode: 'first-person', target: [...camera.target], position: [...camera.position] };
    }
    if (next === 'third-person' || next === 'third' || next === 'player') {
      setFirstPerson(false, { resetCamera: false });
      topView = false;
      resetPlayerCamera();
      camera.updatePosition();
      return { mode: 'third-person', target: [...camera.target], position: [...camera.position] };
    }
    if (firstPersonActive) setFirstPerson(false, { resetCamera: false });

    const viewBounds = normalizeInspectionBounds(bounds);
    const min = viewBounds.min;
    const max = viewBounds.max;
    const width = Math.max(1, max[0] - min[0] + 1);
    const height = Math.max(1, max[1] - min[1] + 1);
    const depth = Math.max(1, max[2] - min[2] + 1);
    const center = [(min[0] + max[0] + 1) * 0.5, (min[1] + max[1] + 1) * 0.5, (min[2] + max[2] + 1) * 0.5];
    const span = Math.max(width, depth);
    topView = true;
    camera.radius = Math.max(24, Math.min(150, span * 1.45 + height * 0.9));
    camera.orthoSize = Math.max(12, Math.min(120, span * 1.28 + height * 0.22));

    if (next === 'top') {
      camera.setProjection('orthographic');
      camera.alpha = -Math.PI / 2;
      camera.beta = 0.055;
    } else if (next === 'north' || next === 'south' || next === 'east' || next === 'west') {
      camera.setProjection('perspective');
      camera.beta = 1.02;
      camera.radius = Math.max(10, Math.min(100, span * 1.05 + height * 0.8));
      camera.alpha = next === 'north' ? -Math.PI / 2 : next === 'south' ? Math.PI / 2 : next === 'east' ? 0 : Math.PI;
    } else {
      camera.setProjection('orthographic');
      camera.alpha = -Math.PI / 4;
      camera.beta = 0.68;
    }
    camera.setTarget(...center);
    camera.updatePosition();
    topButton?.classList.toggle('active', true);
    if (topButton) topButton.textContent = 'FOLLOW PLAYER';
    syncReticleUi();
    return { mode: next === 'birdseye' ? 'birdseye' : next, target: [...camera.target], position: [...camera.position], bounds: viewBounds };
  };

  const captureCanvasPng = () => {
    engine.render(camera);
    const gl = engine.gl;
    const width = Math.max(1, canvas.width | 0);
    const height = Math.max(1, canvas.height | 0);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const context = output.getContext('2d', { alpha: false });
    const image = context.createImageData(width, height);
    const stride = width * 4;
    for (let y = 0; y < height; y += 1) {
      const sourceStart = (height - 1 - y) * stride;
      image.data.set(pixels.subarray(sourceStart, sourceStart + stride), y * stride);
    }
    context.putImageData(image, 0, 0);
    return output.toDataURL('image/png');
  };

  const updateHud = () => {
    if (!imported) return;
    const stats = imported.stats;
    if (nameLabel) nameLabel.textContent = imported.name.toUpperCase();
    if (descriptionLabel) {
      descriptionLabel.textContent = stats.blueprintObjects
        ? `${imported.id} · ${stats.blueprintObjects} blueprint objects · ${stats.instances} prefab instances (${stats.nestedInstances} nested) · ${stats.anchors} named anchors · ${stats.visibilityStructures || 0} building metadata shells · ${stats.sections} RiftSections.`
        : `${imported.id} · ${stats.sections} RiftSections · ${stats.visibilityStructures || 0} building metadata shells · legacy compact ops expanded into the proven full/slab/stair block vocabulary.`;
    }
    if (sourceMetric) sourceMetric.textContent = `ACTIVE ${imported.id.toUpperCase()} · ${persistenceLabel}`;
    if (opsMetric) opsMetric.textContent = stats.blueprintObjects ? `OPS ${stats.operations} · OBJ ${stats.blueprintObjects}` : `OPS ${stats.operations}`;
    if (cellsMetric) cellsMetric.textContent = `CELLS ${stats.cells.toLocaleString()}`;
    if (partialMetric) partialMetric.textContent = `PARTIAL ${stats.partialCells}`;
    if (sectionsMetric) sectionsMetric.textContent = `SECTIONS ${stats.sections}`;
    if (memoryMetric) memoryMetric.textContent = `STATE ${Math.round(stats.stateBytes / 1024)} KB`;
    if (trisMetric) trisMetric.textContent = `TRIS ${stats.triangles.toLocaleString()}`;
  };

  const showReady = (force = false) => {
    if (!status || !imported) return;
    if (!force && !validatorDebugEnabled()) {
      status.classList.remove('ready');
      status.classList.add('settled');
      return;
    }
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
        // H1.74: third-person camera collision owns visibility. Render each compiled
        // RiftSection as one complete mesh; camera position must never hide authored
        // roof, wall, floor, slab or stair geometry.
        const drawable = engine.addMesh(mesh.geometry, meshOptions);
        drawable.doubleSided = !culling;
        drawable.visible = true;
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
    if (!options.preservePlayer) {
      const preferredAnchor = compiled.blueprint?.anchors?.find(anchor => anchor.tags?.includes?.('public') || anchor.tags?.includes?.('entrance'));
      const preferred = preferredAnchor?.at || [compiled.center[0], compiled.worldBounds.min[1] + 2, compiled.center[2]];
      playerController.teleport(preferred);
    } else {
      // Build Mode and live Blueprint recompiles replace the authoritative grid
      // underneath an already-positioned player. Revalidate immediately so a
      // newly solid cell cannot embed the body and a removed support becomes a
      // controlled fall/recovery rather than stale collision state.
      playerController.revalidateWorld({ allowFall: true });
    }
    if (!options.preserveCamera) resetPlayerCamera(true);
    creative?.onDocumentLoaded?.();
    if (!(options.persist && persistenceLabel === 'UNSAVED')) showReady(options.forceStatus === true);
    return compiled;
  };

  const loadBundledBlock = async ({ reason = '' } = {}) => {
    if (status && validatorDebugEnabled()) {
      status.classList.remove('ready', 'error', 'settled');
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
    }
    return compiled;
  };

  const loadActiveBlock = async () => {
    const saved = readPersistedBlock();
    if (!saved) return loadBundledBlock();

    if (status && validatorDebugEnabled()) {
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
        status.classList.remove('ready', 'settled');
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
        fileName: file.name,
        forceStatus: true
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
        status.classList.remove('ready', 'settled');
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
    if (topView) {
      if (firstPersonActive) setFirstPerson(false, { resetCamera: false });
      const view = calculateCamera();
      camera.setProjection('orthographic');
      camera.alpha = -Math.PI / 2;
      camera.beta = 0.10;
      camera.orthoSize = view.orthoSize;
      camera.setTarget(...view.target);
    } else {
      resetPlayerCamera();
    }
    camera.updatePosition();
    topButton?.classList.toggle('active', topView);
    if (topButton) topButton.textContent = topView ? 'FOLLOW PLAYER' : 'CITY OVERVIEW';
    syncReticleUi();
  };
  topButton?.addEventListener('click', onTop);
  const onResetView = () => resetPlayerCamera();
  viewButton?.addEventListener('click', onResetView);

  const orbit = setupThirdPersonCameraControls(canvas, camera, {
    isLocked: () => topView,
    getController: () => firstPersonActive ? firstPersonCamera : thirdPersonCamera
  });
  creative = createRiftCreativeMode({
    root, canvas, engine, camera, player, playerController,
    getImported: () => imported,
    loadDocument,
    preparePlayerView: () => {
      topView = false;
      topButton?.classList.remove('active');
      if (topButton) topButton.textContent = 'CITY OVERVIEW';
      resetPlayerCamera();
      syncReticleUi();
    }
  });
  thirdPersonCamera = createRiftThirdPersonCamera({
    camera,
    getPlayerPosition: () => player.position,
    getPlayerFacing: () => player.facing,
    // Third-person free-look owns camera yaw. RiftPlayer facing is controlled
    // independently by camera-relative movement in rift-player.js.
    getGrid: () => imported?.grid || null,
    isOverview: () => topView
  });
  firstPersonCamera = createRiftFirstPersonCamera({
    camera,
    getPlayerPosition: () => player.position,
    getPlayerFacing: () => player.facing,
    setPlayerFacing: angle => player.setFacingRadians(angle),
    getEyeHeight: () => player.eyeHeight
  });
  syncFirstPersonUi();

  const toggleFirstPerson = () => setFirstPerson(!firstPersonActive);
  const onFirstPersonButton = () => toggleFirstPerson();
  const onViewModeKey = event => {
    if (event.code !== 'KeyV' || event.repeat) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (!document.body.classList.contains('rift-dev-mode')) return;
    if (creative?.active) return;
    event.preventDefault();
    toggleFirstPerson();
  };
  const onDevModeChange = event => {
    if (!event.detail?.enabled && firstPersonActive) setFirstPerson(false);
  };
  const onValidatorDebugChange = event => {
    if (event.detail?.enabled) showReady(true);
    else if (status && !status.classList.contains('error')) status.classList.add('settled');
  };
  firstPersonButton?.addEventListener('click', onFirstPersonButton);
  window.addEventListener('keydown', onViewModeKey, { passive: false });
  window.addEventListener('riftdevmodechange', onDevModeChange);
  window.addEventListener('riftvalidatordebugchange', onValidatorDebugChange);

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
    style.setProperty('--rift-viewport-left', `${Math.max(0, Number(viewport?.offsetLeft) || 0)}px`);
    style.setProperty('--rift-viewport-top', `${Math.max(0, Number(viewport?.offsetTop) || 0)}px`);

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
    // and orientation APIs finish. Re-measure twice so portrait fullscreen never
    // keeps the pre-fullscreen canvas/HUD geometry.
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
    gameMode = enabled;
    document.body.classList.toggle('world3d-game-mode', enabled);
    fullscreenButton?.classList.toggle('active', enabled);
    if (fullscreenButton) fullscreenButton.textContent = enabled ? 'WINDOW' : 'FULLSCREEN';
    if (enabled) {
      settleViewport();
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
    settleViewport();
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
    settleViewport();
  };

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
