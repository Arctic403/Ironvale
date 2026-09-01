const AUTO_VALIDATION_FORMAT = 'ironvale-auto-validation-v1';
const STEP_DELAY_MS = 90;
const MOVE_SLICE_MS = 260;
const SYNTHETIC_POINTER_ID = 9157;

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
  lastError: null
};

let button = null;
let statusNode = null;
let providerRegistered = false;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const $ = selector => document.querySelector(selector);

function nowIso() {
  return new Date().toISOString();
}

function shortError(error) {
  return String(error?.message || error || 'unknown error').slice(0, 220);
}

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
}

function stepResult(name, status, startedAt, detail = '') {
  const entry = {
    name,
    status,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    detail: String(detail || '').slice(0, 180)
  };
  state.steps.push(entry);
  if (status === 'pass') state.pass += 1;
  else if (status === 'warn') state.warn += 1;
  else state.fail += 1;
  diagnosticsRecord(`Auto validation ${status}: ${name}`, entry, status === 'fail' ? 'error' : status === 'warn' ? 'warn' : 'info');
  return entry;
}

async function runStep(name, operation, { optional = false } = {}) {
  const started = performance.now();
  setStatus(`AUTO TEST · ${name}`, 'running');
  try {
    const detail = await operation();
    return stepResult(name, 'pass', started, detail || 'ok');
  } catch (error) {
    const detail = shortError(error);
    return stepResult(name, optional ? 'warn' : 'fail', started, detail);
  } finally {
    await sleep(STEP_DELAY_MS);
  }
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

function activeBrush() {
  return $('[data-brush].active')?.dataset?.brush || null;
}

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
      bubbles: true,
      cancelable: true,
      pointerId: SYNTHETIC_POINTER_ID,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y
    }));
    await sleep(45);
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerId: SYNTHETIC_POINTER_ID,
      pointerType: 'mouse',
      button: 0,
      buttons: 0,
      clientX: x,
      clientY: y
    }));
    await sleep(85);
  } finally {
    restoreCapture();
  }
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

async function runFullAutoValidation() {
  if (state.running) return;
  const world = required('#world-screen', 'World screen');
  if (world.hidden) {
    setStatus('AUTO TEST · enter the world first', 'fail');
    return;
  }

  state.running = true;
  resetRunState();
  button.disabled = true;
  button.textContent = 'Running Full Auto Test…';
  const baseline = captureUiBaseline();
  diagnosticsRecord('Full auto validation started', { runId: state.runId, format: AUTO_VALIDATION_FORMAT });

  try {
    await runStep('runtime + diagnostics ready', async () => {
      if (!window.IronvaleDiagnostics?.validate) throw new Error('IronvaleDiagnostics API unavailable');
      const validation = await window.IronvaleDiagnostics.validate();
      return validation?.status ? `validator=${validation.status}` : 'diagnostics API responded';
    });

    await runStep('third-person movement square', async () => {
      if ($('#freecam-button')?.classList.contains('active')) $('#freecam-button').click();
      await moveSquare();
      return 'W/D/S/A movement path exercised';
    });

    await runStep('third-person camera zoom', async () => {
      const canvas = required('#rift-canvas', 'Rift canvas');
      wheel(canvas, 36);
      await sleep(80);
      wheel(canvas, -36);
      return 'wheel zoom out/in exercised';
    });

    await runStep('freecam movement + altitude', async () => {
      const freecamButton = required('#freecam-button', 'Freecam button');
      if (!freecamButton.classList.contains('active')) freecamButton.click();
      await holdKey('w', 220);
      await holdKey('e', 150);
      await holdKey('s', 220);
      await holdKey('q', 150);
      return 'freecam movement and vertical controls exercised';
    });

    await runStep('terrain debug overlay', async () => {
      const toggle = required('#terrain-debug-toggle', 'Terrain Debug');
      const initial = toggle.classList.contains('active');
      toggle.click();
      await sleep(110);
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
      fireInput(radius, before[0], 'input');
      fireInput(strength, before[1], 'input');
      fireInput(flySpeed, before[2], 'input');
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
      undo.click();
      await sleep(90);
      redo.click();
      await sleep(90);
      undo.click();
      return 'mutation → undo → redo → undo completed';
    }, { optional: true });

    await runStep('edit layer lifecycle', async () => {
      const add = required('#add-terrain-edit-layer');
      const select = required('#terrain-edit-layer');
      const undo = required('#undo-terrain');
      const initialCount = select.options.length;
      add.click();
      await sleep(100);
      if (select.options.length <= initialCount) throw new Error('Edit layer was not created');

      const name = required('#terrain-layer-name');
      name.value = `AutoTest ${String(state.runId).slice(0, 6)}`;
      name.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(70);
      undo.click();

      for (const selector of ['#terrain-layer-visible', '#terrain-layer-lock']) {
        const control = required(selector);
        control.click();
        await sleep(55);
        undo.click();
      }

      const opacity = required('#terrain-layer-opacity');
      const oldOpacity = opacity.value;
      fireInput(opacity, oldOpacity === '0.55' ? '0.65' : '0.55', 'change');
      await sleep(55);
      undo.click();

      const up = $('#terrain-layer-up');
      if (up && !up.disabled) {
        up.click();
        await sleep(55);
        undo.click();
      }

      const remove = $('#delete-terrain-edit-layer');
      if (remove && !remove.disabled) {
        remove.click();
        await sleep(55);
        undo.click();
      }

      undo.click();
      await sleep(100);
      if (select.options.length !== initialCount) throw new Error('Temporary edit layer did not restore cleanly');
      return 'create/rename/visibility/lock/opacity/reorder/delete paths exercised; state restored';
    });

    await runStep('landscape spline lifecycle', async () => {
      const create = required('#new-terrain-spline');
      const select = required('#terrain-spline');
      const undo = required('#undo-terrain');
      const initialCount = select.options.length;
      create.click();
      await sleep(100);
      if (select.options.length <= initialCount) throw new Error('Spline was not created');

      const width = required('#spline-width');
      const falloff = required('#spline-falloff');
      const beforeWidth = width.value;
      const beforeFalloff = falloff.value;
      fireInput(width, Math.min(Number(width.max), Number(width.value) + 1), 'change');
      await sleep(55);
      undo.click();
      fireInput(falloff, Math.min(Number(falloff.max), Number(beforeFalloff) + 1), 'change');
      await sleep(55);
      undo.click();
      width.value = beforeWidth;
      falloff.value = beforeFalloff;

      undo.click();
      await sleep(100);
      if (select.options.length !== initialCount) throw new Error('Temporary spline did not restore cleanly');
      return 'create/settings/history spline paths exercised; state restored';
    });

    await runStep('material layer switching', async () => {
      const select = required('#terrain-material-layer');
      if (select.options.length < 2) return 'single material layer; change path not applicable';
      const initial = select.value;
      const alternate = [...select.options].find(option => option.value !== initial);
      select.value = alternate.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(120);
      select.value = initial;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return `material ${alternate.value} loaded then restored`;
    }, { optional: true });

    await runStep('combat controls no-target path', async () => {
      required('#basic-attack-button').click();
      for (const ability of document.querySelectorAll('[data-ability-slot]')) ability.click();
      return 'attack + ability 1/2/3 handlers exercised';
    }, { optional: true });

    await runStep('realtime movement + checkpoint path', async () => {
      const freecamButton = required('#freecam-button');
      if (freecamButton.classList.contains('active')) freecamButton.click();
      await holdKey('w', 300);
      window.dispatchEvent(new Event('pagehide'));
      await sleep(350);
      return 'movement save interception + pagehide checkpoint requested';
    });

    await runStep('backend health + network telemetry', async () => {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (!response.ok) throw new Error(`health HTTP ${response.status}`);
      const body = await response.json().catch(() => ({}));
      if (body?.ok === false) throw new Error('backend health reported failure');
      return `health HTTP ${response.status}`;
    });

    await runStep('final validator pass', async () => {
      const result = await window.IronvaleDiagnostics.validate();
      return result?.status ? `final validator=${result.status}` : 'final validator completed';
    });

    state.status = state.fail > 0 ? 'fail' : state.warn > 0 ? 'warn' : 'pass';
    state.manualL3Ready = true;
  } catch (error) {
    state.status = 'fail';
    state.fail += 1;
    state.lastError = shortError(error);
    diagnosticsRecord('Full auto validation aborted', { error: state.lastError, runId: state.runId }, 'error');
  } finally {
    try { await restoreUiBaseline(baseline); } catch (error) {
      state.warn += 1;
      state.steps.push({ name: 'restore UI baseline', status: 'warn', durationMs: 0, detail: shortError(error) });
    }
    state.completedAt = nowIso();
    state.running = false;
    button.disabled = false;
    button.textContent = 'Run Full Auto Test';
    if (state.status === 'pass') setStatus(`AUTO TEST PASS · ${state.pass} pass · export L3 Raw now`, 'pass');
    else if (state.status === 'warn') setStatus(`AUTO TEST WARN · ${state.pass} pass · ${state.warn} warn · export L3 Raw`, 'warn');
    else setStatus(`AUTO TEST FAIL · ${state.fail} fail · export L3 Raw for diagnosis`, 'fail');
    diagnosticsRecord('Full auto validation finished', {
      runId: state.runId,
      status: state.status,
      pass: state.pass,
      warn: state.warn,
      fail: state.fail,
      manualL3Ready: state.manualL3Ready
    }, state.status === 'fail' ? 'error' : state.status === 'warn' ? 'warn' : 'info');
  }
}

function registerProvider() {
  if (providerRegistered) return;
  if (!window.IronvaleDiagnostics?.registerProvider) {
    setTimeout(registerProvider, 100);
    return;
  }
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
    steps: level >= 3 ? [...state.steps] : state.steps.slice(-6),
    policy: {
      exportsDumpAutomatically: false,
      restoresTemporaryTerrainEdits: true,
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
  if (!tools) {
    setTimeout(installUi, 150);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'auto-validation-tools';

  button = document.createElement('button');
  button.id = 'diagnostic-auto-full-test';
  button.className = 'wide';
  button.type = 'button';
  button.textContent = 'Run Full Auto Test';
  button.addEventListener('click', () => { void runFullAutoValidation(); });

  statusNode = document.createElement('small');
  statusNode.id = 'diagnostic-auto-full-status';
  statusNode.dataset.status = 'idle';
  statusNode.textContent = 'Exercises gameplay/editor/realtime systems. L3 export stays manual.';

  wrapper.append(button, statusNode);
  const rawLabel = [...tools.querySelectorAll('small')].find(node => node.textContent?.trim() === 'Raw JSON');
  if (rawLabel) tools.insertBefore(wrapper, rawLabel);
  else tools.appendChild(wrapper);
}

window.IronvaleAutoValidation = Object.freeze({
  run: runFullAutoValidation,
  status: () => ({ ...state, steps: [...state.steps] })
});

registerProvider();
installUi();
