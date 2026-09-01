export const IRONVALE_HISTORY_BRIDGE_FORMAT = 'ironvale-history-bridge-v3';

const state = {
  format: IRONVALE_HISTORY_BRIDGE_FORMAT,
  installedAt: new Date().toISOString(),
  runId: null,
  active: false,
  captureCount: 0,
  apiAvailable: false,
  baselineUndoDepth: null,
  baselineRedoDepth: null,
  snapshotToken: null,
  restored: false,
  restoreAt: null,
  restoreError: null,
  recoveryRestores: 0
};

let baselineSnapshot = null;
let providerRegistered = false;
let guardWrapped = false;
let recoveryTimer = 0;

function isoNow() { return new Date().toISOString(); }
function short(error) { return String(error?.message || error || 'unknown error').slice(0, 240); }
function record(message, data = null, severity = 'info') {
  try { window.IronvaleDiagnostics?.record?.('history-bridge', message, data, severity); } catch (_) {}
}
function currentAutoStatus() {
  try { return window.IronvaleAutoValidation?.status?.() || null; } catch (_) { return null; }
}
function historyRuntime() {
  return window.IronvaleEditorHistory || null;
}
function historyStatus() {
  try { return historyRuntime()?.status?.() || null; } catch (_) { return null; }
}
function beginRun(runId) {
  state.runId = runId || `auto-${Date.now()}`;
  state.active = true;
  state.captureCount = 0;
  state.apiAvailable = Boolean(historyRuntime()?.capture && historyRuntime()?.restore);
  state.baselineUndoDepth = null;
  state.baselineRedoDepth = null;
  state.snapshotToken = null;
  state.restored = false;
  state.restoreAt = null;
  state.restoreError = null;
  baselineSnapshot = null;
  installRecoveryWatch();
}
function finishRun() {
  state.active = false;
  baselineSnapshot = null;
  if (recoveryTimer) clearInterval(recoveryTimer);
  recoveryTimer = 0;
}
function installRecoveryWatch() {
  if (recoveryTimer) clearInterval(recoveryTimer);
  recoveryTimer = setInterval(() => {
    if (!state.active) return;
    const auto = currentAutoStatus();
    if (auto?.running) return;
    if (baselineSnapshot && !state.restored) {
      restoreHistory('recovery');
      state.recoveryRestores += 1;
    }
    finishRun();
  }, 250);
}
function captureBaseline(integrity) {
  const runtime = historyRuntime();
  if (!runtime?.capture || !runtime?.restore) throw new Error('IronvaleEditorHistory runtime API unavailable');
  state.apiAvailable = true;
  baselineSnapshot = runtime.capture(`auto-validation:${state.runId}`);
  if (!baselineSnapshot?.token) throw new Error('Editor history runtime did not return a snapshot token');
  state.snapshotToken = baselineSnapshot.token;
  state.baselineUndoDepth = Number(integrity?.editor?.undoDepth) || 0;
  state.baselineRedoDepth = Number(integrity?.editor?.redoDepth) || 0;
  const runtimeState = historyStatus();
  const depthsMatch = Number(runtimeState?.undoDepth) === state.baselineUndoDepth && Number(runtimeState?.redoDepth) === state.baselineRedoDepth;
  record('Captured exact editor history through app runtime API', {
    runId: state.runId,
    token: state.snapshotToken,
    undoDepth: state.baselineUndoDepth,
    redoDepth: state.baselineRedoDepth,
    runtimeUndoDepth: runtimeState?.undoDepth ?? null,
    runtimeRedoDepth: runtimeState?.redoDepth ?? null,
    depthsMatch
  }, depthsMatch ? 'info' : 'warn');
}
function restoreHistory(reason = 'integrity') {
  try {
    if (!baselineSnapshot) return { ok: true, skipped: true, ...historyStatus() };
    const runtime = historyRuntime();
    if (!runtime?.restore) throw new Error('IronvaleEditorHistory restore API unavailable');
    const result = runtime.restore(baselineSnapshot);
    if (!result?.ok) throw new Error(result?.error || 'Editor history restore failed');
    state.restored = true;
    state.restoreAt = isoNow();
    state.restoreError = null;
    state.snapshotToken = null;
    baselineSnapshot = null;
    record('Restored exact pre-test editor history through app runtime API', {
      runId: state.runId,
      reason,
      undoDepth: result.undoDepth,
      redoDepth: result.redoDepth,
      retainedSnapshots: result.retainedSnapshots
    });
    return result;
  } catch (error) {
    state.restored = false;
    state.restoreError = short(error);
    record('Failed to restore exact pre-test editor history', { runId: state.runId, reason, error: state.restoreError }, 'error');
    return { ok: false, error: state.restoreError, ...historyStatus() };
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
        try { captureBaseline(integrity); }
        catch (error) {
          state.restoreError = `baseline capture: ${short(error)}`;
          record('Editor history baseline capture failed', { runId: state.runId, error: state.restoreError }, 'error');
        }
        return integrity;
      }

      // Restore the real private undo/redo stacks through app.js before the
      // validator reads its post-test undoDepth/redoDepth values.
      restoreHistory('pre-integrity');
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
  diagnostics.registerProvider('history-bridge', () => {
    const runtime = historyStatus();
    return {
      ...state,
      currentUndoDepth: runtime?.undoDepth ?? null,
      currentRedoDepth: runtime?.redoDepth ?? null,
      retainedSnapshots: runtime?.retainedSnapshots ?? null,
      runtimeFormat: runtime?.format || historyRuntime()?.format || null,
      policy: {
        exactBaselineRestore: true,
        restoreBeforeIntegritySnapshot: true,
        appOwnedPrivateStacks: true,
        opaqueSnapshotTokens: true,
        globalArrayPrototypeHooks: false,
        diagnosticJournalInterception: false,
        recoveryRestoreIfRunAborts: true
      }
    };
  });
  providerRegistered = true;
}

wrapValidatorGuard();
registerProvider();

window.IronvaleHistoryBridge = Object.freeze({
  format: state.format,
  status: () => ({ ...state, ...historyStatus() }),
  restore: () => restoreHistory('manual')
});
