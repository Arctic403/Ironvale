export const IRONVALE_HISTORY_BRIDGE_FORMAT = 'ironvale-history-bridge-v1';

const state = {
  format: IRONVALE_HISTORY_BRIDGE_FORMAT,
  installedAt: new Date().toISOString(),
  runId: null,
  active: false,
  captureCount: 0,
  undoCaptured: false,
  redoCaptured: false,
  baselineUndoDepth: null,
  baselineRedoDepth: null,
  restored: false,
  restoreAt: null,
  restoreError: null
};

let undoRef = null;
let redoRef = null;
let baselineUndo = [];
let baselineRedo = [];
let operationPhase = null;
let providerRegistered = false;
let guardWrapped = false;
let arrayHooksInstalled = false;
let nativePush = Array.prototype.push;
let nativePop = Array.prototype.pop;

function isoNow() { return new Date().toISOString(); }
function short(error) { return String(error?.message || error || 'unknown error').slice(0, 240); }
function record(message, data = null, severity = 'info') {
  try { window.IronvaleDiagnostics?.record?.('history-bridge', message, data, severity); } catch (_) {}
}
function cloneStack(stack) { return Array.isArray(stack) ? stack.slice() : []; }
function currentAutoStatus() {
  try { return window.IronvaleAutoValidation?.status?.() || null; } catch (_) { return null; }
}
function beginRun(runId) {
  state.runId = runId || `auto-${Date.now()}`;
  state.active = true;
  state.captureCount = 0;
  state.undoCaptured = false;
  state.redoCaptured = false;
  state.baselineUndoDepth = null;
  state.baselineRedoDepth = null;
  state.restored = false;
  state.restoreAt = null;
  state.restoreError = null;
  undoRef = null;
  redoRef = null;
  baselineUndo = [];
  baselineRedo = [];
  installArrayHooks();
}
function finishRun() {
  state.active = false;
  operationPhase = null;
  uninstallArrayHooks();
}
function installArrayHooks() {
  if (arrayHooksInstalled) return;
  arrayHooksInstalled = true;
  nativePush = Array.prototype.push;
  nativePop = Array.prototype.pop;
  Array.prototype.push = function ironvaleHistoryPush(...items) {
    if (state.active && operationPhase === 'undo') {
      redoRef = this;
      state.redoCaptured = true;
    } else if (state.active && operationPhase === 'redo') {
      undoRef = this;
      state.undoCaptured = true;
    }
    return nativePush.apply(this, items);
  };
  Array.prototype.pop = function ironvaleHistoryPop() {
    if (state.active && operationPhase === 'undo') {
      undoRef = this;
      state.undoCaptured = true;
    } else if (state.active && operationPhase === 'redo') {
      redoRef = this;
      state.redoCaptured = true;
    }
    return nativePop.call(this);
  };
}
function uninstallArrayHooks() {
  if (!arrayHooksInstalled) return;
  if (Array.prototype.push?.name === 'ironvaleHistoryPush') Array.prototype.push = nativePush;
  if (Array.prototype.pop?.name === 'ironvaleHistoryPop') Array.prototype.pop = nativePop;
  arrayHooksInstalled = false;
}
function installButtonPhaseHooks() {
  const attach = () => {
    const undo = document.querySelector('#undo-terrain');
    const redo = document.querySelector('#redo-terrain');
    if (!undo || !redo) { setTimeout(attach, 100); return; }
    if (!undo.dataset.ironvaleHistoryBridge) {
      undo.dataset.ironvaleHistoryBridge = '1';
      undo.addEventListener('click', () => {
        if (!state.active) return;
        operationPhase = 'undo';
        queueMicrotask(() => { if (operationPhase === 'undo') operationPhase = null; });
      }, true);
    }
    if (!redo.dataset.ironvaleHistoryBridge) {
      redo.dataset.ironvaleHistoryBridge = '1';
      redo.addEventListener('click', () => {
        if (!state.active) return;
        operationPhase = 'redo';
        queueMicrotask(() => { if (operationPhase === 'redo') operationPhase = null; });
      }, true);
    }
  };
  attach();
}
function clickProbe(kind) {
  const button = document.querySelector(kind === 'undo' ? '#undo-terrain' : '#redo-terrain');
  if (!button) throw new Error(`${kind} button unavailable`);
  operationPhase = kind;
  button.click();
  operationPhase = null;
}
function captureBaselineFromIntegrity(integrity) {
  const undoDepth = Number(integrity?.editor?.undoDepth) || 0;
  const redoDepth = Number(integrity?.editor?.redoDepth) || 0;
  state.baselineUndoDepth = undoDepth;
  state.baselineRedoDepth = redoDepth;

  if (undoDepth > 0) {
    clickProbe('undo');
    clickProbe('redo');
  } else if (redoDepth > 0) {
    clickProbe('redo');
    clickProbe('undo');
  }

  baselineUndo = undoRef ? cloneStack(undoRef) : [];
  baselineRedo = redoRef ? cloneStack(redoRef) : [];
  if (undoDepth === 0) baselineUndo = [];
  if (redoDepth === 0) baselineRedo = [];

  const depthMatches = (!undoRef || undoRef.length === undoDepth) && (!redoRef || redoRef.length === redoDepth);
  record('Captured auto-test history baseline', {
    runId: state.runId,
    undoDepth,
    redoDepth,
    undoRef: Boolean(undoRef),
    redoRef: Boolean(redoRef),
    depthMatches
  }, depthMatches ? 'info' : 'warn');
}
function restoreHistory() {
  try {
    if (undoRef) {
      undoRef.length = 0;
      if (baselineUndo.length) nativePush.apply(undoRef, baselineUndo);
    } else if ((state.baselineUndoDepth || 0) !== 0) {
      throw new Error('Undo stack reference was not captured');
    }
    if (redoRef) {
      redoRef.length = 0;
      if (baselineRedo.length) nativePush.apply(redoRef, baselineRedo);
    } else if ((state.baselineRedoDepth || 0) !== 0) {
      throw new Error('Redo stack reference was not captured');
    }
    state.restored = true;
    state.restoreAt = isoNow();
    state.restoreError = null;
    record('Restored exact pre-test undo/redo history', {
      runId: state.runId,
      undoDepth: undoRef?.length ?? state.baselineUndoDepth,
      redoDepth: redoRef?.length ?? state.baselineRedoDepth
    });
  } catch (error) {
    state.restored = false;
    state.restoreError = short(error);
    record('Failed to restore exact pre-test history', { runId: state.runId, error: state.restoreError }, 'error');
  }
}
function wrapValidatorGuard() {
  if (guardWrapped) return;
  const guard = window.IronvaleValidatorGuard;
  if (!guard?.captureIntegrity) { setTimeout(wrapValidatorGuard, 100); return; }
  const nativeCaptureIntegrity = guard.captureIntegrity.bind(guard);
  const replacement = Object.freeze({
    ...guard,
    captureIntegrity: async (...args) => {
      const auto = currentAutoStatus();
      if (!auto?.running) return nativeCaptureIntegrity(...args);
      if (!state.active || state.runId !== auto.runId) beginRun(auto.runId);
      state.captureCount += 1;

      if (state.captureCount === 1) {
        const integrity = await nativeCaptureIntegrity(...args);
        try { captureBaselineFromIntegrity(integrity); }
        catch (error) {
          state.restoreError = `baseline capture: ${short(error)}`;
          record('History baseline probe failed', { runId: state.runId, error: state.restoreError }, 'warn');
        }
        return integrity;
      }

      restoreHistory();
      const integrity = await nativeCaptureIntegrity(...args);
      if (state.captureCount >= 2) finishRun();
      return integrity;
    }
  });
  window.IronvaleValidatorGuard = replacement;
  guardWrapped = true;
}
function registerProvider() {
  if (providerRegistered) return;
  const diagnostics = window.IronvaleDiagnostics;
  if (!diagnostics?.registerProvider) { setTimeout(registerProvider, 100); return; }
  diagnostics.registerProvider('history-bridge', () => ({
    ...state,
    currentUndoDepth: undoRef?.length ?? null,
    currentRedoDepth: redoRef?.length ?? null,
    policy: { exactBaselineRestore: true, terrainStateUntouchedByBridge: true, arrayHooksOnlyDuringAutoRun: true }
  }));
  providerRegistered = true;
}

installButtonPhaseHooks();
wrapValidatorGuard();
registerProvider();

window.IronvaleHistoryBridge = Object.freeze({
  format: state.format,
  status: () => ({ ...state, currentUndoDepth: undoRef?.length ?? null, currentRedoDepth: redoRef?.length ?? null }),
  restore: restoreHistory
});
