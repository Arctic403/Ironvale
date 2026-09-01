const AUTO_VALIDATION_FORMAT = 'ironvale-auto-validation-v2';
const STEP_DELAY_MS = 90;
const MOVE_SLICE_MS = 260;
const SYNTHETIC_POINTER_ID = 9157;
const SCREENSHOT_MAX_WIDTH = 720;
const SCREENSHOT_QUALITY = 0.78;

const state = {
  format: AUTO_VALIDATION_FORMAT,
  running: false,
  runId: null,
  startedAt: null,
  completedAt: null,
  status: 'idle',
  steps: [],
  pass: 0,
  warn: 0,
  fail: 0,
  skipped: [],
  manualL3Ready: false,
  lastError: null,
  baselineIntegrity: null,
  finalIntegrity: null,
  restoration: null,
  playerRestoration: null,
  postValidation: null,
  evidence: { captures: 0, failed: 0, totalBytes: 0, files: [] }
};

let button = null;
let bundleButton = null;
let statusNode = null;
let providerRegistered = false;
let evidenceFiles = new Map();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const $ = selector => document.querySelector(selector);

function nowIso() { return new Date().toISOString(); }
function shortError(error) { return String(error?.message || error || 'unknown error').slice(0, 220); }

function diagnosticsRecord(message, data = null, severity = 'info') {
  try { window.IronvaleDiagnostics?.record?.('auto-validation', message, data, severity); } catch (_) {}
}

function setStatus(text, mode = 'idle') {
  if (!statusNode) return;
  statusNode.textContent = text;
  statusNode.dataset.status = mode;
}

function resetRunState() {
  state.runId = crypto?.randomUUID?.() || `auto-${Date.now()}`;
  state.startedAt = nowIso();
  state.completedAt = null;
  state.status = 'running';
  state.steps = [];
  state.pass = 0;
  state.warn = 0;
  state.fail = 0;
  state.skipped = [];
  state.manualL3Ready = false;
  state.lastError = null;
  state.baselineIntegrity = null;
  state.finalIntegrity = null;
  state.restoration = null;
  state.playerRestoration = null;
  state.postValidation = null;
  state.evidence = { captures: 0, failed: 0, totalBytes: 0, files: [] };
  evidenceFiles = new Map();
}

function severityRank(status) {
  return status === 'fail' ? 2 : status === 'warn' ? 1 : 0;
}

function strongestStatus(a, b) {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function safeFilePart(value) {
  return String(value || 'step').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56) || 'step';
}

async function sha256Bytes(bytes) {
  try {
    if (crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch (_) {}
  let hash = 2166136261;
  for (const byte of new Uint8Array(bytes)) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function blobFromCanvas(canvas, type, quality) {
  return new Promise(resolve => {
    try { canvas.toBlob(blob => resolve(blob), type, quality); }
    catch (_) { resolve(null); }
  });
}

function collectVisualUiState() {
  const layout = window.IronvaleValidatorGuard?.layout?.() || null;
  return {
    layout,
    freecam: $('#freecam-button')?.classList.contains('active') || false,
    toolsOpen: $('#terrain-tools')?.hidden === false,
    brush: $('[data-brush].active')?.dataset?.brush || null,
    terrainStatus: $('#terrain-status')?.textContent?.slice(0, 160) || '',
    editorStatus: $('#editor-status')?.textContent?.slice(0, 160) || '',
    coords: $('#coords')?.textContent?.slice(0, 80) || ''
  };
}

function imageStats(canvas) {
  try {
    const probe = document.createElement('canvas');
    probe.width = 24;
    probe.height = 14;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
    const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
    let opaque = 0;
    let sum = 0;
    let sumSq = 0;
    const count = pixels.length / 4;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] / 255;
      if (alpha > 0.05) opaque += 1;
      const luma = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
      sum += luma;
      sumSq += luma * luma;
    }
    const mean = count ? sum / count : 0;
    const variance = count ? Math.max(0, sumSq / count - mean * mean) : 0;
    return {
      opaqueRatio: count ? Math.round((opaque / count) * 1000) / 1000 : 0,
      meanLuma: Math.round(mean * 10) / 10,
      lumaStdDev: Math.round(Math.sqrt(variance) * 10) / 10
    };
  } catch (error) { return { error: shortError(error) }; }
}

async function captureScreenshot(stepName, status = 'pass') {
  const source = $('#rift-canvas');
  const ordinal = state.evidence.files.length + 1;
  const at = nowIso();
  if (!source || !source.width || !source.height) {
    const failed = { status: 'failed', at, step: stepName, error: 'Rift canvas unavailable', ui: collectVisualUiState() };
    state.evidence.failed += 1;
    state.evidence.files.push(failed);
    return failed;
  }

  try {
    await nextFrame();
    await nextFrame();
    try { source.getContext('webgl2')?.finish?.(); } catch (_) {}
    const rect = source.getBoundingClientRect();
    const sourceAspect = source.width / Math.max(1, source.height);
    const width = Math.max(1, Math.min(SCREENSHOT_MAX_WIDTH, Math.round(rect.width || source.width)));
    const height = Math.max(1, Math.round(width / sourceAspect));
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const ctx = output.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!ctx) throw new Error('2D evidence canvas unavailable');
    ctx.drawImage(source, 0, 0, width, height);

    const barHeight = Math.min(34, Math.max(24, Math.round(height * 0.11)));
    ctx.fillStyle = 'rgba(0,0,0,0.66)';
    ctx.fillRect(0, height - barHeight, width, barHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(11, Math.min(15, Math.round(barHeight * 0.43)))}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    const label = `${String(status).toUpperCase()} · ${stepName}`;
    ctx.fillText(label.slice(0, 96), 10, height - barHeight / 2);

    let blob = await blobFromCanvas(output, 'image/webp', SCREENSHOT_QUALITY);
    let mime = 'image/webp';
    let extension = 'webp';
    if (!blob || blob.size === 0) {
      blob = await blobFromCanvas(output, 'image/png');
      mime = 'image/png';
      extension = 'png';
    }
    if (!blob || blob.size === 0) throw new Error('Canvas snapshot returned no image bytes');

    const bytes = await blob.arrayBuffer();
    const filename = `screenshots/${String(ordinal).padStart(2, '0')}-${safeFilePart(stepName)}.${extension}`;
    const metadata = {
      status: 'captured', at, step: stepName, filename, mime, bytes: blob.size,
      width, height, sha256: await sha256Bytes(bytes), stats: imageStats(output), ui: collectVisualUiState()
    };
    evidenceFiles.set(filename, blob);
    state.evidence.captures += 1;
    state.evidence.totalBytes += blob.size;
    state.evidence.files.push(metadata);
    return metadata;
  } catch (error) {
    const failed = { status: 'failed', at, step: stepName, error: shortError(error), ui: collectVisualUiState() };
    state.evidence.failed += 1;
    state.evidence.files.push(failed);
    diagnosticsRecord('Visual evidence capture failed', failed, 'warn');
    return failed;
  }
}

function stepResult(name, status, startedAt, detail = '', screenshot = null) {
  const entry = {
    name,
    status,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    detail: String(detail || '').slice(0, 220),
    screenshot
  };
  state.steps.push(entry);
  if (status === 'pass') state.pass += 1;
  else if (status === 'warn') state.warn += 1;
  else state.fail += 1;
  diagnosticsRecord(`Auto validation ${status}: ${name}`, entry, status === 'fail' ? 'error' : status === 'warn' ? 'warn' : 'info');
  return entry;
}

async function runStep(name, operation, { optional = false, screenshot = true } = {}) {
  const started = performance.now();
  setStatus(`AUTO TEST · ${name}`, 'running');
  let desiredStatus = 'pass';
  let detail = 'ok';
  try {
    const outcome = await operation();
    if (outcome && typeof outcome === 'object' && !Array.isArray(outcome)) {
      desiredStatus = ['pass', 'warn', 'fail'].includes(outcome.status) ? outcome.status : 'pass';
      detail = outcome.detail || 'ok';
    } else detail = outcome || 'ok';
  } catch (error) {
    desiredStatus = optional ? 'warn' : 'fail';
    detail = shortError(error);
  }
  const evidence = screenshot ? await captureScreenshot(name, desiredStatus) : null;
  if (evidence?.status === 'failed' && desiredStatus === 'pass') desiredStatus = 'warn';
  const result = stepResult(name, desiredStatus, started, detail, evidence);
  await sleep(STEP_DELAY_MS);
  return result;
}

function required(selector, label = selector) {
  const element = $(selector);
  if (!element) throw new Error(`${label} missing`);
  return element;
}

function keyEvent(type, key) {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
}

async function holdKey(key, ms = MOVE_SLICE_MS) {
  keyEvent('keydown', key);
  await sleep(ms);
  keyEvent('keyup', key);
  await sleep(35);
}

async function moveSquare() {
  for (const key of ['w', 'd', 's', 'a']) await holdKey(key);
}

function wheel(canvas, deltaY) {
  canvas.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
}

function fireInput(element, value, type = 'input') {
  element.value = String(value);
  element.dispatchEvent(new Event(type, { bubbles: true }));
}

function activeBrush() { return $('[data-brush].active')?.dataset?.brush || null; }

function selectBrush(name) {
  const target = document.querySelector(`[data-brush="${name}"]`);
  if (!target) throw new Error(`Brush ${name} missing`);
  target.click();
  if (activeBrush() !== name) throw new Error(`Brush ${name} did not activate`);
}

function patchPointerCapture(canvas) {
  const own = {
    set: Object.prototype.hasOwnProperty.call(canvas, 'setPointerCapture') ? canvas.setPointerCapture : undefined,
    release: Object.prototype.hasOwnProperty.call(canvas, 'releasePointerCapture') ? canvas.releasePointerCapture : undefined,
    has: Object.prototype.hasOwnProperty.call(canvas, 'hasPointerCapture') ? canvas.hasPointerCapture : undefined
  };
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  return () => {
    if (own.set === undefined) delete canvas.setPointerCapture; else canvas.setPointerCapture = own.set;
    if (own.release === undefined) delete canvas.releasePointerCapture; else canvas.releasePointerCapture = own.release;
    if (own.has === undefined) delete canvas.hasPointerCapture; else canvas.hasPointerCapture = own.has;
  };
}

async function stampCenteredBrush(canvas) {
  if (typeof PointerEvent !== 'function') throw new Error('PointerEvent unavailable');
  const rect = canvas.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const restoreCapture = patchPointerCapture(canvas);
  try {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: SYNTHETIC_POINTER_ID, pointerType: 'mouse',
      button: 0, buttons: 1, clientX: x, clientY: y
    }));
    await sleep(45);
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: SYNTHETIC_POINTER_ID, pointerType: 'mouse',
      button: 0, buttons: 0, clientX: x, clientY: y
    }));
    await sleep(85);
  } finally { restoreCapture(); }
}

async function testBrushWithUndo(name, canvas, undoButton) {
  selectBrush(name);
  await stampCenteredBrush(canvas);
  undoButton.click();
  await sleep(100);
}

function captureUiBaseline() {
  return {
    toolsHidden: $('#terrain-tools')?.hidden ?? true,
    freecam: $('#freecam-button')?.classList.contains('active') || false,
    terrainDebug: $('#terrain-debug-toggle')?.classList.contains('active') || false,
    brush: activeBrush(),
    radius: $('#brush-radius')?.value ?? null,
    strength: $('#brush-strength')?.value ?? null,
    freecamSpeed: $('#freecam-speed')?.value ?? null,
    editLayer: $('#terrain-edit-layer')?.value ?? null,
    materialLayer: $('#terrain-material-layer')?.value ?? null,
    spline: $('#terrain-spline')?.value ?? null
  };
}

async function restoreUiBaseline(baseline) {
  const freecamButton = $('#freecam-button');
  if (freecamButton && freecamButton.classList.contains('active') !== baseline.freecam) freecamButton.click();
  const debugButton = $('#terrain-debug-toggle');
  if (debugButton && debugButton.classList.contains('active') !== baseline.terrainDebug) debugButton.click();
  if (baseline.brush && document.querySelector(`[data-brush="${baseline.brush}"]`)) selectBrush(baseline.brush);
  if (baseline.radius != null && $('#brush-radius')) fireInput($('#brush-radius'), baseline.radius, 'input');
  if (baseline.strength != null && $('#brush-strength')) fireInput($('#brush-strength'), baseline.strength, 'input');
  if (baseline.freecamSpeed != null && $('#freecam-speed')) fireInput($('#freecam-speed'), baseline.freecamSpeed, 'input');

  const editLayer = $('#terrain-edit-layer');
  if (baseline.editLayer && editLayer && [...editLayer.options].some(option => option.value === baseline.editLayer)) {
    editLayer.value = baseline.editLayer;
    editLayer.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const material = $('#terrain-material-layer');
  if (baseline.materialLayer && material && [...material.options].some(option => option.value === baseline.materialLayer)) {
    material.value = baseline.materialLayer;
    material.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const spline = $('#terrain-spline');
  if (baseline.spline && spline && [...spline.options].some(option => option.value === baseline.spline)) {
    spline.value = baseline.spline;
    spline.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const tools = $('#terrain-tools');
  if (tools && tools.hidden !== baseline.toolsHidden) $('#terrain-tools-button')?.click();
  await sleep(80);
}

async function restorePlayerBaseline(baseline) {
  const api = window.IronvalePlayerState;
  const realtime = window.IronvaleRealtimeMovement;
  if (!baseline || !api?.restore) throw new Error('Player restoration API unavailable');
  if (!realtime?.publish || !realtime?.checkpoint) throw new Error('Direct realtime publisher unavailable');
  const restored = api.restore(baseline);
  if (!restored?.ok) throw new Error(restored?.error || 'Player transform restore failed');
  await nextFrame();
  await nextFrame();

  const published = realtime.publish({ x: baseline.x, y: baseline.y, z: baseline.z, yaw: baseline.yaw }, { force: true, source: 'validator-restore' });
  if (published?.ok === false) throw new Error(published?.reason || 'Authoritative player restore publish failed');
  await sleep(140);
  const checkpoint = await realtime.checkpoint('validator-restore');
  if (checkpoint?.ok === false) throw new Error(checkpoint?.error || 'Authoritative player restore checkpoint failed');
  await sleep(180);

  const current = api.status?.();
  const distance = current ? Math.hypot(
    Number(current.x) - Number(baseline.x),
    Number(current.y) - Number(baseline.y),
    Number(current.z) - Number(baseline.z)
  ) : Number.POSITIVE_INFINITY;
  const yawDelta = current ? Math.abs(Number(current.yaw) - Number(baseline.yaw)) : Number.POSITIVE_INFINITY;
  const exact = Number.isFinite(distance) && distance <= 0.001 && Number.isFinite(yawDelta) && yawDelta <= 0.001;
  if (!exact) throw new Error(`Player baseline restore drifted by ${distance.toFixed(4)}m / yaw ${yawDelta.toFixed(4)}`);
  return { ok: true, distance, yawDelta, transport: published?.transport || null, checkpointTransport: checkpoint?.transport || null, baseline: { x: baseline.x, y: baseline.y, z: baseline.z, yaw: baseline.yaw } };
}

async function runFullAutoValidation() {
  if (state.running) return;
  const world = required('#world-screen', 'World screen');
  if (world.hidden) { setStatus('AUTO TEST · enter the world first', 'fail'); return; }

  state.running = true;
  resetRunState();
  button.disabled = true;
  if (bundleButton) bundleButton.disabled = true;
  button.textContent = 'Running Full Auto Test…';
  const uiBaseline = captureUiBaseline();
  const playerBaseline = window.IronvalePlayerState?.capture?.('auto-validation') || null;
  diagnosticsRecord('Full auto validation started', { runId: state.runId, format: AUTO_VALIDATION_FORMAT });

  try {
    await runStep('runtime + diagnostics ready', async () => {
      if (!window.IronvaleDiagnostics?.validate) throw new Error('IronvaleDiagnostics API unavailable');
      const validation = await window.IronvaleDiagnostics.validate();
      return { status: validation?.status || 'pass', detail: validation?.status ? `validator=${validation.status}` : 'diagnostics API responded' };
    });

    await runStep('baseline integrity snapshot', async () => {
      if (!window.IronvaleValidatorGuard?.captureIntegrity) throw new Error('Validator guard unavailable');
      state.baselineIntegrity = await window.IronvaleValidatorGuard.captureIntegrity();
      return `terrain=${String(state.baselineIntegrity.terrainHash).slice(0, 12)} · undo=${state.baselineIntegrity.editor.undoDepth} redo=${state.baselineIntegrity.editor.redoDepth}`;
    });

    await runStep('third-person movement square', async () => {
      if ($('#freecam-button')?.classList.contains('active')) $('#freecam-button').click();
      await moveSquare();
      return 'W/D/S/A movement path exercised';
    });

    await runStep('third-person camera zoom', async () => {
      const canvas = required('#rift-canvas', 'Rift canvas');
      wheel(canvas, 36); await sleep(80); wheel(canvas, -36);
      return 'wheel zoom out/in exercised';
    });

    await runStep('freecam movement + altitude', async () => {
      const freecamButton = required('#freecam-button', 'Freecam button');
      if (!freecamButton.classList.contains('active')) freecamButton.click();
      await holdKey('w', 220); await holdKey('e', 150); await holdKey('s', 220); await holdKey('q', 150);
      return 'freecam movement and vertical controls exercised';
    });

    await runStep('terrain debug overlay', async () => {
      const toggle = required('#terrain-debug-toggle', 'Terrain Debug');
      const initial = toggle.classList.contains('active');
      toggle.click(); await sleep(110);
      if (toggle.classList.contains('active') === initial) throw new Error('Terrain Debug did not toggle');
      toggle.click();
      return 'terrain debug toggled on/off';
    });

    await runStep('terrain brush controls', async () => {
      const radius = required('#brush-radius');
      const strength = required('#brush-strength');
      const flySpeed = required('#freecam-speed');
      const before = [radius.value, strength.value, flySpeed.value];
      fireInput(radius, Math.min(Number(radius.max), Math.max(Number(radius.min), Number(radius.value) + 1)), 'input');
      fireInput(strength, Math.min(Number(strength.max), Math.max(Number(strength.min), Number(strength.value) + 0.1)), 'input');
      fireInput(flySpeed, Math.min(Number(flySpeed.max), Math.max(Number(flySpeed.min), Number(flySpeed.value) + 1)), 'input');
      await sleep(80);
      fireInput(radius, before[0], 'input'); fireInput(strength, before[1], 'input'); fireInput(flySpeed, before[2], 'input');
      return 'radius/strength/freecam speed input paths exercised';
    });

    await runStep('real terrain brush mutations + undo', async () => {
      const freecamButton = required('#freecam-button');
      if (!freecamButton.classList.contains('active')) freecamButton.click();
      const canvas = required('#rift-canvas');
      const undo = required('#undo-terrain');
      const brushes = ['raise', 'lower', 'smooth', 'flatten', 'hole', 'unhole', 'paint', 'erase-material'];
      for (const brush of brushes) await testBrushWithUndo(brush, canvas, undo);
      return `${brushes.length} real centered brush paths exercised and undone`;
    }, { optional: true });

    await runStep('undo + redo history', async () => {
      const canvas = required('#rift-canvas');
      const undo = required('#undo-terrain');
      const redo = required('#redo-terrain');
      selectBrush('raise');
      await stampCenteredBrush(canvas);
      undo.click(); await sleep(90); redo.click(); await sleep(90); undo.click();
      return 'mutation → undo → redo → undo completed';
    }, { optional: true });

    await runStep('edit layer lifecycle', async () => {
      const add = required('#add-terrain-edit-layer');
      const select = required('#terrain-edit-layer');
      const undo = required('#undo-terrain');
      const initialCount = select.options.length;
      add.click(); await sleep(100);
      if (select.options.length <= initialCount) throw new Error('Edit layer was not created');
      const name = required('#terrain-layer-name');
      name.value = `AutoTest ${String(state.runId).slice(0, 6)}`;
      name.dispatchEvent(new Event('change', { bubbles: true })); await sleep(70); undo.click();
      for (const selector of ['#terrain-layer-visible', '#terrain-layer-lock']) { const control = required(selector); control.click(); await sleep(55); undo.click(); }
      const opacity = required('#terrain-layer-opacity');
      fireInput(opacity, opacity.value === '0.55' ? '0.65' : '0.55', 'change'); await sleep(55); undo.click();
      const up = $('#terrain-layer-up'); if (up && !up.disabled) { up.click(); await sleep(55); undo.click(); }
      const remove = $('#delete-terrain-edit-layer'); if (remove && !remove.disabled) { remove.click(); await sleep(55); undo.click(); }
      undo.click(); await sleep(100);
      if (select.options.length !== initialCount) throw new Error('Temporary edit layer did not restore cleanly');
      return 'create/rename/visibility/lock/opacity/reorder/delete paths exercised; state restored';
    });

    await runStep('landscape spline lifecycle', async () => {
      const create = required('#new-terrain-spline');
      const select = required('#terrain-spline');
      const undo = required('#undo-terrain');
      const initialCount = select.options.length;
      create.click(); await sleep(100);
      if (select.options.length <= initialCount) throw new Error('Spline was not created');
      const width = required('#spline-width'); const falloff = required('#spline-falloff');
      const beforeWidth = width.value; const beforeFalloff = falloff.value;
      fireInput(width, Math.min(Number(width.max), Number(width.value) + 1), 'change'); await sleep(55); undo.click();
      fireInput(falloff, Math.min(Number(falloff.max), Number(beforeFalloff) + 1), 'change'); await sleep(55); undo.click();
      width.value = beforeWidth; falloff.value = beforeFalloff;
      undo.click(); await sleep(100);
      if (select.options.length !== initialCount) throw new Error('Temporary spline did not restore cleanly');
      return 'create/settings/history spline paths exercised; state restored';
    });

    await runStep('material layer switching', async () => {
      const select = required('#terrain-material-layer');
      if (select.options.length < 2) return 'single material layer; change path not applicable';
      const initial = select.value;
      const alternate = [...select.options].find(option => option.value !== initial);
      select.value = alternate.value; select.dispatchEvent(new Event('change', { bubbles: true })); await sleep(120);
      select.value = initial; select.dispatchEvent(new Event('change', { bubbles: true }));
      return `material ${alternate.value} loaded then restored`;
    }, { optional: true });

    await runStep('combat controls no-target path', async () => {
      required('#basic-attack-button').click();
      for (const ability of document.querySelectorAll('[data-ability-slot]')) ability.click();
      return 'attack + ability 1/2/3 handlers exercised';
    }, { optional: true });

    await runStep('sprint + auto run controls', async () => {
      const movement = window.IronvaleMovementMode;
      const button = required('#sprint-button', 'Sprint button');
      if (!movement?.status || !movement?.cancel) throw new Error('Movement mode runtime unavailable');
      if ($('#freecam-button')?.classList.contains('active')) $('#freecam-button').click();
      movement.cancel('validator-start');

      const dispatch = (type, pointerId) => button.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerdown' ? 1 : 0 }));
      dispatch('pointerdown', 9321);
      await sleep(90);
      dispatch('pointerup', 9321);
      await sleep(60);
      if (!movement.status().sprintEnabled || movement.status().autoRun) throw new Error('Tap did not arm sprint');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
      await sleep(180);
      if (!movement.status().sprinting) throw new Error('Sprint did not activate while moving');
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));
      await sleep(90);
      if (movement.status().sprintEnabled) throw new Error('Sprint did not cancel when movement stopped');

      dispatch('pointerdown', 9322);
      await sleep(520);
      if (!movement.status().autoRun || !movement.status().sprinting) throw new Error('Long hold did not activate Auto Run');
      dispatch('pointerup', 9322);
      await sleep(90);
      if (!movement.status().autoRun) throw new Error('Auto Run did not stay latched after long hold release');

      dispatch('pointerdown', 9323);
      await sleep(70);
      dispatch('pointerup', 9323);
      await sleep(80);
      if (movement.status().autoRun || movement.status().sprintEnabled) throw new Error('Tap did not cancel Auto Run');
      return 'tap sprint + stop-to-cancel + ' + movement.status().autoRunHoldMs + 'ms hold Auto Run path exercised';
    });

    await runStep('realtime movement + checkpoint path', async () => {
      const freecamButton = required('#freecam-button');
      if (freecamButton.classList.contains('active')) freecamButton.click();
      const realtime = window.IronvaleRealtimeMovement;
      if (!realtime?.status || !realtime?.checkpoint) throw new Error('Direct realtime publisher unavailable');
      const before = realtime.status();
      await holdKey('w', 300);
      await holdKey('s', 300);
      await sleep(180);
      const afterMovement = realtime.status();
      const directDelta = Number(afterMovement?.directPublished || 0) - Number(before?.directPublished || 0);
      if (directDelta < 2) throw new Error(`Direct 10Hz publisher only emitted ${directDelta} packet(s)`);
      const checkpoint = await realtime.checkpoint('auto-validation');
      if (checkpoint?.ok === false) throw new Error('Realtime checkpoint request failed');
      await sleep(220);
      const after = realtime.status();
      return `direct packets=${directDelta} · total sent=${after.sent || 0} · accepted=${after.accepted || 0} · RTT=${after.lastRttMs ?? 'n/a'}ms · checkpoint=${checkpoint?.transport || 'unknown'}`;
    });

    await runStep('backend health + network telemetry', async () => {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (!response.ok) throw new Error(`health HTTP ${response.status}`);
      const body = await response.json().catch(() => ({}));
      if (body?.ok === false) throw new Error('backend health reported failure');
      return `health HTTP ${response.status}`;
    });

    await restoreUiBaseline(uiBaseline);
    state.playerRestoration = await restorePlayerBaseline(playerBaseline);
    await runStep('post-test restoration integrity', async () => {
      if (!state.baselineIntegrity || !window.IronvaleValidatorGuard?.captureIntegrity) throw new Error('Baseline integrity snapshot unavailable');
      state.finalIntegrity = await window.IronvaleValidatorGuard.captureIntegrity();
      state.restoration = window.IronvaleValidatorGuard.compareIntegrity(state.baselineIntegrity, state.finalIntegrity);
      const r = state.restoration;
      const playerExact = Number.isFinite(Number(r.playerDistance)) && Number(r.playerDistance) <= 0.001;
      const status = r.terrainMatched === false || r.draftMatched === false || r.terrainSelectionMatched === false || !playerExact ? 'fail' : r.historyMatched === false ? 'warn' : 'pass';
      return {
        status,
        detail: `terrain=${r.terrainMatched} draft=${r.draftMatched} selection=${r.terrainSelectionMatched} history=${r.historyMatched} undoΔ=${r.undoDelta} redoΔ=${r.redoDelta} playerΔ=${r.playerDistance ?? 'n/a'}m exact=${playerExact}`
      };
    });

    await runStep('final guarded validator', async () => {
      const result = await window.IronvaleDiagnostics.validate();
      return { status: result?.status || 'fail', detail: `guarded validator=${result?.status || 'unknown'} · ${result?.counts?.pass || 0} pass / ${result?.counts?.warn || 0} warn / ${result?.counts?.fail || 0} fail` };
    });

    state.status = state.fail > 0 ? 'fail' : state.warn > 0 ? 'warn' : 'pass';
    state.manualL3Ready = true;
  } catch (error) {
    state.status = 'fail';
    state.fail += 1;
    state.lastError = shortError(error);
    diagnosticsRecord('Full auto validation aborted', { error: state.lastError, runId: state.runId }, 'error');
  } finally {
    try { await restoreUiBaseline(uiBaseline); } catch (error) {
      state.warn += 1;
      state.steps.push({ name: 'restore UI baseline', status: 'warn', durationMs: 0, detail: shortError(error), screenshot: null });
      state.status = strongestStatus(state.status, 'warn');
    }
    state.completedAt = nowIso();
    state.running = false;

    try {
      const post = await window.IronvaleDiagnostics?.validate?.();
      state.postValidation = post ? { status: post.status, counts: post.counts, at: post.at } : null;
      if (post?.status) state.status = strongestStatus(state.status, post.status);
    } catch (error) {
      state.postValidation = { status: 'fail', error: shortError(error) };
      state.status = 'fail';
      state.fail += 1;
    }

    button.disabled = false;
    button.textContent = 'Run Full Auto Test';
    if (bundleButton) bundleButton.disabled = state.evidence.captures === 0;
    if (state.status === 'pass') setStatus(`AUTO TEST PASS · ${state.pass} pass · L3 Raw or Validation Bundle ready`, 'pass');
    else if (state.status === 'warn') setStatus(`AUTO TEST WARN · ${state.pass} pass · ${state.warn} warn · export L3/Bundle`, 'warn');
    else setStatus(`AUTO TEST FAIL · ${state.fail} fail · export L3/Bundle for diagnosis`, 'fail');
    diagnosticsRecord('Full auto validation finished', {
      runId: state.runId, status: state.status, pass: state.pass, warn: state.warn, fail: state.fail,
      screenshots: state.evidence.captures, screenshotFailures: state.evidence.failed, manualL3Ready: state.manualL3Ready,
      restoration: state.restoration, postValidation: state.postValidation
    }, state.status === 'fail' ? 'error' : state.status === 'warn' ? 'warn' : 'info');
  }
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function writeU16(view, offset, value) { view.setUint16(offset, value & 0xffff, true); }
function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimeDate(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function makeStoredZip(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  const stamp = dosTimeDate();

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    writeU32(lv, 0, 0x04034b50); writeU16(lv, 4, 20); writeU16(lv, 6, 0x0800); writeU16(lv, 8, 0);
    writeU16(lv, 10, stamp.time); writeU16(lv, 12, stamp.day); writeU32(lv, 14, crc); writeU32(lv, 18, data.length); writeU32(lv, 22, data.length);
    writeU16(lv, 26, name.length); writeU16(lv, 28, 0); local.set(name, 30);
    locals.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    writeU32(cv, 0, 0x02014b50); writeU16(cv, 4, 20); writeU16(cv, 6, 20); writeU16(cv, 8, 0x0800); writeU16(cv, 10, 0);
    writeU16(cv, 12, stamp.time); writeU16(cv, 14, stamp.day); writeU32(cv, 16, crc); writeU32(cv, 20, data.length); writeU32(cv, 24, data.length);
    writeU16(cv, 28, name.length); writeU16(cv, 30, 0); writeU16(cv, 32, 0); writeU16(cv, 34, 0); writeU16(cv, 36, 0); writeU32(cv, 38, 0); writeU32(cv, 42, localOffset);
    central.set(name, 46); centrals.push(central);
    localOffset += local.length + data.length;
  }

  const centralBytes = concatBytes(centrals);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  writeU32(ev, 0, 0x06054b50); writeU16(ev, 4, 0); writeU16(ev, 6, 0); writeU16(ev, 8, files.length); writeU16(ev, 10, files.length);
  writeU32(ev, 12, centralBytes.length); writeU32(ev, 16, localOffset); writeU16(ev, 20, 0);
  return concatBytes([...locals, centralBytes, end]);
}

async function gzipText(text) {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'function') return { bytes, extension: 'json', encoding: 'identity' };
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return { bytes: compressed, extension: 'json.gz', encoding: 'gzip' };
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.rel = 'noopener';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function exportValidationBundle() {
  if (state.running) return;
  if (!state.completedAt) { setStatus('Run Full Auto Test before exporting a bundle.', 'warn'); return; }
  if (!window.IronvaleValidatorGuard?.createDump) { setStatus('Validator guard bundle API unavailable.', 'fail'); return; }
  bundleButton.disabled = true;
  const original = bundleButton.textContent;
  bundleButton.textContent = 'Building Validation Bundle…';
  try {
    const dump = await window.IronvaleValidatorGuard.createDump(3, 'manual-auto-validation-bundle');
    const dumpText = JSON.stringify(dump);
    const packedDump = await gzipText(dumpText);
    const report = {
      format: state.format,
      runId: state.runId,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      status: state.status,
      counts: { pass: state.pass, warn: state.warn, fail: state.fail },
      restoration: state.restoration,
      postValidation: state.postValidation,
      evidence: state.evidence,
      steps: state.steps,
      dumpEncoding: packedDump.encoding
    };
    const files = [
      { name: `ironvale-dump-l3.${packedDump.extension}`, bytes: packedDump.bytes },
      { name: 'auto-validation-report.json', bytes: new TextEncoder().encode(JSON.stringify(report, null, 2)) },
      { name: 'README.txt', bytes: new TextEncoder().encode('Ironvale Full Auto Validation Bundle\nContains the L3 diagnostic dump plus per-step visual evidence. Existing L1/L2/L3 Raw and GZIP exports remain unchanged.\n') }
    ];
    for (const [name, blob] of evidenceFiles) files.push({ name, bytes: new Uint8Array(await blob.arrayBuffer()) });
    const zip = makeStoredZip(files);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `ironvale-validation-${stamp}.zip`;
    downloadBlob(new Blob([zip], { type: 'application/zip' }), name);
    diagnosticsRecord('Exported visual validation bundle', { name, files: files.length, bytes: zip.length, screenshots: evidenceFiles.size });
    setStatus(`Validation Bundle exported · ${evidenceFiles.size} screenshots`, state.status === 'fail' ? 'fail' : state.status === 'warn' ? 'warn' : 'pass');
  } catch (error) {
    diagnosticsRecord('Validation bundle export failed', { error: shortError(error) }, 'error');
    setStatus(`Validation Bundle failed · ${shortError(error)}`, 'fail');
  } finally {
    bundleButton.disabled = state.evidence.captures === 0;
    bundleButton.textContent = original;
  }
}

function registerProvider() {
  if (providerRegistered) return;
  if (!window.IronvaleDiagnostics?.registerProvider) { setTimeout(registerProvider, 100); return; }
  window.IronvaleDiagnostics.registerProvider('auto-validation', level => ({
    format: state.format,
    running: state.running,
    runId: state.runId,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    status: state.status,
    counts: { pass: state.pass, warn: state.warn, fail: state.fail },
    manualL3Ready: state.manualL3Ready,
    lastError: state.lastError,
    skipped: state.skipped,
    restoration: state.restoration,
    playerRestoration: state.playerRestoration,
    postValidation: state.postValidation,
    evidence: {
      captures: state.evidence.captures,
      failed: state.evidence.failed,
      totalBytes: state.evidence.totalBytes,
      files: level >= 3 ? state.evidence.files.map(file => ({ ...file })) : state.evidence.files.slice(-6).map(file => ({ ...file }))
    },
    steps: level >= 3 ? state.steps.map(step => ({ ...step })) : state.steps.slice(-6).map(step => ({ ...step })),
    policy: {
      exportsDumpAutomatically: false,
      exportsScreenshotsAutomatically: false,
      validationBundleManual: true,
      restoresTemporaryTerrainEdits: true,
      verifiesRestorationIntegrity: true,
      restoresPlayerTransformExactly: true,
      restoresRealtimeAuthorityBeforeCheckpoint: true,
      exercisesSprintAndAutoRun: true,
      exercisesDirectRealtimePublisher: true,
      exercisesRealtimeCheckpoint: true,
      destructiveReset: false,
      logout: false
    }
  }));
  providerRegistered = true;
}

function installUi() {
  if ($('#diagnostic-auto-full-test')) return;
  const tools = $('.diagnostic-tools');
  if (!tools) { setTimeout(installUi, 150); return; }
  const wrapper = document.createElement('div');
  wrapper.className = 'auto-validation-tools';

  button = document.createElement('button');
  button.id = 'diagnostic-auto-full-test';
  button.className = 'wide';
  button.type = 'button';
  button.textContent = 'Run Full Auto Test';
  button.addEventListener('click', () => { void runFullAutoValidation(); });

  bundleButton = document.createElement('button');
  bundleButton.id = 'diagnostic-auto-bundle';
  bundleButton.className = 'wide';
  bundleButton.type = 'button';
  bundleButton.textContent = 'Export Validation Bundle';
  bundleButton.disabled = true;
  bundleButton.addEventListener('click', () => { void exportValidationBundle(); });

  statusNode = document.createElement('small');
  statusNode.id = 'diagnostic-auto-full-status';
  statusNode.dataset.status = 'idle';
  statusNode.textContent = 'Exercises gameplay/editor/realtime systems and captures visual evidence. L3 Raw stays manual.';

  wrapper.append(button, bundleButton, statusNode);
  const rawLabel = [...tools.querySelectorAll('small')].find(node => node.textContent?.trim() === 'Raw JSON');
  if (rawLabel) tools.insertBefore(wrapper, rawLabel); else tools.appendChild(wrapper);
}

window.IronvaleAutoValidation = Object.freeze({
  run: runFullAutoValidation,
  exportBundle: exportValidationBundle,
  status: () => ({
    ...state,
    counts: { pass: state.pass, warn: state.warn, fail: state.fail },
    evidence: { ...state.evidence, files: state.evidence.files.map(file => ({ ...file })) },
    steps: state.steps.map(step => ({ ...step }))
  })
});

registerProvider();
installUi();
