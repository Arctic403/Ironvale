import { RiftDiagnostics } from './rift-diagnostics.js?v=20260901-diagnostic-gzip-r3';

export const IRONVALE_VALIDATOR_GUARD_FORMAT = 'ironvale-validator-guard-v1';

const PATCH_MARK = Symbol.for('ironvale.validator-guard-patched');
const WRAPPED_INSTANCE = Symbol('ironvale.validator-guard-instance');
const originalRunValidation = RiftDiagnostics.prototype.runValidation;
const REALTIME_CONNECTING_GRACE_MS = 1500;

let activeInstance = null;
const guardState = {
  format: IRONVALE_VALIDATOR_GUARD_FORMAT,
  installedAt: new Date().toISOString(),
  lastRunAt: null,
  lastChecks: [],
  previousGlErrorCount: 0,
  runs: 0
};

function statusCheck(id, status, detail = '') {
  return { id, status: ['pass', 'warn', 'fail'].includes(status) ? status : 'pass', detail: String(detail || '').slice(0, 400) };
}

function passFail(id, passed, detail, severity = 'fail') {
  return statusCheck(id, passed ? 'pass' : severity, detail);
}

function isWorldVisible() {
  const world = document.querySelector('#world-screen');
  return Boolean(world && world.hidden === false);
}

function recentNetwork(events, maxAgeMs = 120000) {
  const cutoff = Date.now() - maxAgeMs;
  return (events || []).filter(event => {
    const at = Date.parse(event?.at || '');
    return !Number.isFinite(at) || at >= cutoff;
  });
}

async function provider(instance, name, level = 2) {
  const fn = instance?.providers?.get?.(name);
  if (typeof fn !== 'function') return null;
  try { return await fn(level); }
  catch (error) { return { error: String(error?.message || error || 'provider failed') }; }
}

function rectSnapshot(selector) {
  const element = document.querySelector(selector);
  if (!element || element.hidden) return null;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
  const rect = element.getBoundingClientRect();
  return {
    selector,
    x: Math.round(rect.x * 10) / 10,
    y: Math.round(rect.y * 10) / 10,
    width: Math.round(rect.width * 10) / 10,
    height: Math.round(rect.height * 10) / 10,
    right: Math.round(rect.right * 10) / 10,
    bottom: Math.round(rect.bottom * 10) / 10
  };
}

function layoutSnapshot() {
  const viewport = { width: innerWidth, height: innerHeight };
  const selectors = [
    '#rift-canvas', '.topbar', '#terrain-tools', '#joystick', '#combat-hud',
    '#terrain-reticle', '#freecam-altitude', '#coords'
  ];
  const rects = selectors.map(rectSnapshot).filter(Boolean);
  const tolerance = 6;
  const outOfBounds = rects.filter(rect =>
    rect.width <= 0 || rect.height <= 0 ||
    rect.right < -tolerance || rect.bottom < -tolerance ||
    rect.x > viewport.width + tolerance || rect.y > viewport.height + tolerance ||
    rect.right > viewport.width + tolerance || rect.bottom > viewport.height + tolerance
  ).map(rect => rect.selector);
  const canvas = rects.find(rect => rect.selector === '#rift-canvas') || null;
  const canvasCoverage = canvas && viewport.width > 0 && viewport.height > 0
    ? Math.min(1, Math.max(0, (canvas.width * canvas.height) / (viewport.width * viewport.height)))
    : 0;
  return { viewport, rects, outOfBounds, canvasCoverage };
}

async function sha256Text(text) {
  const value = String(text || '');
  try {
    if (crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch (_) {}
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function cloneJson(value) {
  if (value == null) return value;
  try { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  catch (_) { return value; }
}

function normalizeLandscapeEdits(value) {
  const clone = cloneJson(value);
  if (clone && typeof clone === 'object' && !Array.isArray(clone)) delete clone.savedAt;
  return clone;
}

function normalizeDraftText(text) {
  const raw = String(text || '');
  if (!raw) return '';
  try { return JSON.stringify(normalizeLandscapeEdits(JSON.parse(raw))); }
  catch (_) { return raw; }
}

async function snapshotRuntime(instance, level = 2) {
  if (!instance?.snapshotProvider) return null;
  try { return await instance.snapshotProvider(level); }
  catch (error) { return { error: String(error?.message || error || 'snapshot failed') }; }
}

async function captureIntegrity() {
  if (!activeInstance) throw new Error('Validator instance has not run yet.');
  const snapshot = await snapshotRuntime(activeInstance, 3);
  if (!snapshot || snapshot.error) throw new Error(snapshot?.error || 'Deep integrity snapshot unavailable.');
  const runtime = snapshot.runtime || {};
  const edits = normalizeLandscapeEdits(snapshot.deep?.landscapeEdits || null);
  const draft = (() => { try { return localStorage.getItem('ironvale:terrain:draft:v4') || ''; } catch (_) { return ''; } })();
  return {
    at: new Date().toISOString(),
    worldId: runtime.world?.id || snapshot.quick?.worldId || null,
    terrainHash: await sha256Text(JSON.stringify(edits)),
    draftHash: await sha256Text(normalizeDraftText(draft)),
    editor: {
      undoDepth: Number(runtime.editor?.undoDepth) || 0,
      redoDepth: Number(runtime.editor?.redoDepth) || 0,
      freecamEnabled: Boolean(runtime.editor?.freecamEnabled),
      brushMode: runtime.editor?.brushMode || null,
      terrainDebugEnabled: Boolean(runtime.editor?.terrainDebugEnabled)
    },
    terrain: {
      activeEditLayer: runtime.terrain?.activeEditLayer || null,
      activeMaterialLayer: runtime.terrain?.activeMaterialLayer || null,
      activeSpline: runtime.terrain?.activeSpline || null,
      editLayers: Number(runtime.terrain?.stats?.editLayers) || 0,
      splines: Number(runtime.terrain?.stats?.splines) || 0
    },
    player: runtime.player ? {
      x: Number(runtime.player.x), y: Number(runtime.player.y), z: Number(runtime.player.z), yaw: Number(runtime.player.yaw)
    } : null,
    layout: layoutSnapshot()
  };
}

function compareIntegrity(before, after) {
  if (!before || !after) return { ok: false, terrainMatched: false, draftMatched: false, historyMatched: false, detail: 'integrity snapshot missing' };
  const terrainMatched = before.terrainHash === after.terrainHash;
  const draftMatched = before.draftHash === after.draftHash;
  const historyMatched = before.editor?.undoDepth === after.editor?.undoDepth && before.editor?.redoDepth === after.editor?.redoDepth;
  const terrainSelectionMatched = before.terrain?.activeEditLayer === after.terrain?.activeEditLayer &&
    before.terrain?.activeMaterialLayer === after.terrain?.activeMaterialLayer &&
    before.terrain?.activeSpline === after.terrain?.activeSpline &&
    before.terrain?.editLayers === after.terrain?.editLayers && before.terrain?.splines === after.terrain?.splines;
  let playerDistance = null;
  if (before.player && after.player && [before.player.x, before.player.z, after.player.x, after.player.z].every(Number.isFinite)) {
    playerDistance = Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z);
  }
  return {
    ok: terrainMatched && draftMatched && terrainSelectionMatched && historyMatched,
    terrainMatched,
    draftMatched,
    terrainSelectionMatched,
    historyMatched,
    undoDelta: (after.editor?.undoDepth || 0) - (before.editor?.undoDepth || 0),
    redoDelta: (after.editor?.redoDepth || 0) - (before.editor?.redoDepth || 0),
    playerDistance: playerDistance == null ? null : Math.round(playerDistance * 1000) / 1000,
    layout: after.layout || null
  };
}

async function buildGuardChecks(instance) {
  const checks = [];
  const worldVisible = isWorldVisible();
  const consoleEvents = instance?.consoleEvents || [];
  const consoleErrors = consoleEvents.filter(event => event?.level === 'error').length;
  const consoleWarnings = consoleEvents.filter(event => event?.level === 'warn').length;
  checks.push(statusCheck('runtime.console-errors', consoleErrors ? 'fail' : 'pass', consoleErrors ? `${consoleErrors} console error(s) captured` : 'No console errors captured'));
  checks.push(statusCheck('runtime.console-warnings', consoleWarnings ? 'warn' : 'pass', consoleWarnings ? `${consoleWarnings} console warning(s) captured` : 'No console warnings captured'));

  const network = recentNetwork(instance?.networkEvents || []);
  const serverFailures = network.filter(event => Number(event?.status) === 0 || Number(event?.status) >= 500);
  const clientFailures = network.filter(event => {
    const status = Number(event?.status);
    if (status < 400 || status >= 500) return false;
    let path = '';
    try { path = new URL(event?.url || '', location.href).pathname; } catch (_) { path = String(event?.url || ''); }
    if (status === 401 && ['/api/bootstrap', '/api/auth/login', '/api/auth/register'].includes(path)) return false;
    return true;
  });
  checks.push(statusCheck('network.server-failures', serverFailures.length ? 'fail' : 'pass', serverFailures.length ? `${serverFailures.length} recent network/5xx failure(s)` : 'No recent network/5xx failures'));
  checks.push(statusCheck('network.client-failures', clientFailures.length ? 'warn' : 'pass', clientFailures.length ? `${clientFailures.length} unexpected recent 4xx response(s)` : 'No unexpected recent 4xx responses'));

  if (!worldVisible) return checks;

  const [engine, native, realtime] = await Promise.all([
    provider(instance, 'engine', 2), provider(instance, 'native', 2), provider(instance, 'realtime-movement', 2)
  ]);
  const snapshot = await snapshotRuntime(instance, 2);
  const runtime = snapshot?.runtime || {};

  const glErrors = Array.isArray(engine?.glErrors) ? engine.glErrors : [];
  const glCount = glErrors.length;
  const glDelta = Math.max(0, glCount - guardState.previousGlErrorCount);
  guardState.previousGlErrorCount = glCount;
  checks.push(statusCheck('renderer.gl-errors', glCount >= 2 || glDelta >= 2 ? 'fail' : glCount === 1 || glDelta === 1 ? 'warn' : 'pass',
    glCount ? `${glCount} WebGL error(s) recorded; ${glDelta} new since previous guarded validation; last=${glErrors.at(-1)?.name || glErrors.at(-1)?.code || 'unknown'}` : 'No WebGL errors recorded'));
  const contextLost = Boolean(engine?.contextLost);
  const contextEvents = Array.isArray(engine?.contextEvents) ? engine.contextEvents : [];
  checks.push(statusCheck('renderer.context-history', contextLost ? 'fail' : contextEvents.length ? 'warn' : 'pass', contextLost ? 'WebGL context is lost' : contextEvents.length ? `${contextEvents.length} historical context event(s)` : 'No context-loss history'));
  const lastFrame = engine?.lastFrame || null;
  checks.push(passFail('renderer.draw-activity', Number(lastFrame?.drawCalls) > 0 && Number(lastFrame?.visibleMeshes) > 0, lastFrame ? `${lastFrame.drawCalls || 0} draw calls · ${lastFrame.visibleMeshes || 0} visible meshes` : 'No renderer frame telemetry'));

  const nativeFailures = Number(native?.failureCount) || 0;
  checks.push(statusCheck('native.failures', nativeFailures ? 'fail' : 'pass', nativeFailures ? `${nativeFailures} native/WASM failure(s); last=${native?.lastFailure?.message || native?.lastFailure || 'unknown'}` : 'No native/WASM failures'));

  if (!realtime) {
    checks.push(statusCheck('realtime.provider', 'warn', 'Realtime diagnostics provider unavailable'));
  } else {
    const socketState = String(realtime.socketState || 'unknown');
    const connectingAgeMs = Number(realtime.connectingAgeMs);
    const connectingWithinGrace = socketState === 'connecting' && Number.isFinite(connectingAgeMs) && connectingAgeMs >= 0 && connectingAgeMs < REALTIME_CONNECTING_GRACE_MS;
    const socketStatus = socketState === 'open' || connectingWithinGrace ? 'pass' : ['connecting', 'idle'].includes(socketState) ? 'warn' : 'fail';
    const socketDetail = connectingWithinGrace
      ? `Realtime socket=connecting · ${Math.round(connectingAgeMs)}ms/${REALTIME_CONNECTING_GRACE_MS}ms startup/reconnect grace`
      : `Realtime socket=${socketState}`;
    checks.push(statusCheck('realtime.socket', socketStatus, socketDetail));
    const policyOk = realtime.authority === 'server-durable-object' && realtime.d1Policy === 'load-checkpoint-only' && realtime.checkpointPolicy?.ordinaryMovementWritesToD1 === false;
    checks.push(passFail('realtime.d1-policy', policyOk, policyOk ? 'Server RAM authority; D1 load/checkpoint only' : 'Realtime/D1 authority policy mismatch'));
    const rejected = Number(realtime.rejected) || 0;
    const corrections = Number(realtime.corrections) || 0;
    checks.push(statusCheck('realtime.corrections', rejected >= 3 || corrections >= 3 ? 'fail' : rejected || corrections ? 'warn' : 'pass', rejected || corrections ? `${rejected} rejected · ${corrections} correction(s)` : 'No rejected movement/corrections'));
    const fallback = Number(realtime.fallbackHttp) || 0;
    checks.push(statusCheck('realtime.http-fallback', fallback ? 'warn' : 'pass', fallback ? `${fallback} movement packet(s) used HTTP fallback` : 'No movement HTTP fallback'));
  }

  const avgFrame = Number(runtime.performance?.averageFrameMs) || 0;
  if (avgFrame > 0) {
    const frameStatus = avgFrame > 33.4 ? 'fail' : avgFrame > 22.2 ? 'warn' : 'pass';
    checks.push(statusCheck('performance.frame-time', frameStatus, `${avgFrame.toFixed(2)}ms average · ${(1000 / avgFrame).toFixed(1)} FPS`));
  }
  const maxSubsystem = Number(runtime.performance?.subsystemTimings?.maxTotalMs) || 0;
  if (maxSubsystem > 0) checks.push(statusCheck('performance.frame-spike', maxSubsystem >= 100 ? 'fail' : maxSubsystem >= 50 ? 'warn' : 'pass', `${maxSubsystem.toFixed(2)}ms max sampled subsystem frame`));

  const stats = runtime.terrain?.stats || {};
  const expectedSections = Number(stats.surfaceSections) || 0;
  const meshes = Number(runtime.terrain?.meshCount) || 0;
  const lodPlan = Number(runtime.terrain?.lodPlanSize) || 0;
  const renderedComponents = Array.isArray(runtime.terrain?.streamPlan?.render) ? runtime.terrain.streamPlan.render.length : 0;
  const sectionsPerComponent = Math.max(1, Number(stats.sectionsPerComponent) || 1);
  const expectedStreamedMeshes = renderedComponents > 0 ? Math.min(expectedSections, renderedComponents * sectionsPerComponent * sectionsPerComponent) : expectedSections;
  if (expectedSections) {
    const coverageOk = lodPlan === expectedSections && meshes === expectedStreamedMeshes;
    checks.push(passFail('terrain.section-coverage', coverageOk, meshes + '/' + expectedStreamedMeshes + ' streamed meshes · ' + lodPlan + '/' + expectedSections + ' LOD entries · ' + (renderedComponents || 'all') + ' render component(s)'));
  }

  const viewport = runtime.renderer?.viewport || null;
  const viewportOk = viewport && Number(viewport.cssWidth) > 0 && Number(viewport.cssHeight) > 0 && Number(viewport.width) > 0 && Number(viewport.height) > 0 && Number(viewport.aspect) > 0;
  checks.push(passFail('renderer.viewport', viewportOk, viewportOk ? `${viewport.cssWidth}×${viewport.cssHeight} CSS · ${viewport.width}×${viewport.height} render` : 'Renderer viewport invalid'));

  const character = runtime.character || {};
  const rigOk = !character.rigged || (Number(character.rig?.jointCount) > 0 && Number(character.rig?.animationClipCount) > 0);
  checks.push(statusCheck('character.rig-runtime', rigOk ? 'pass' : 'fail', character.rigged ? `${character.rig?.jointCount || 0} joints · ${character.rig?.animationClipCount || 0} clips` : 'Fallback character visual active'));
  if (character.rigged) {
    const walkClip = character.rig?.defaultClips?.walk || null;
    const runClip = character.rig?.defaultClips?.run || null;
    const runOk = Boolean(runClip && runClip !== walkClip);
    checks.push(statusCheck('character.run-animation', runOk ? 'pass' : 'fail', runOk ? `Run clip=${runClip} · walk clip=${walkClip || 'none'}` : `Distinct run animation unavailable · walk=${walkClip || 'none'} run=${runClip || 'none'}`));
  }

  const layout = layoutSnapshot();
  const layoutStatus = layout.outOfBounds.length ? 'warn' : layout.canvasCoverage < 0.85 ? 'warn' : 'pass';
  checks.push(statusCheck('ui.layout', layoutStatus, layout.outOfBounds.length ? `Out-of-bounds UI: ${layout.outOfBounds.join(', ')}` : `Canvas coverage ${(layout.canvasCoverage * 100).toFixed(0)}% · visible UI in viewport`));

  const auto = window.IronvaleAutoValidation?.status?.();
  if (auto?.completedAt && !auto.running) {
    checks.push(statusCheck('auto-validation.last-run', auto.status === 'fail' ? 'fail' : auto.status === 'warn' ? 'warn' : 'pass', `Last auto run=${auto.status} · ${auto.counts?.pass ?? auto.pass ?? 0} pass · ${auto.counts?.warn ?? auto.warn ?? 0} warn · ${auto.counts?.fail ?? auto.fail ?? 0} fail`));
    const evidence = auto.evidence || {};
    const evidenceStatus = Number(evidence.captures) === 0 ? 'fail' : Number(evidence.failed) > 0 ? 'warn' : 'pass';
    checks.push(statusCheck('auto-validation.visual-evidence', evidenceStatus, `${Number(evidence.captures) || 0} screenshot(s) · ${Number(evidence.failed) || 0} capture failure(s) · ${Number(evidence.totalBytes) || 0} bytes`));
    const restoration = auto.restoration || null;
    if (restoration) {
      const restoreStatus = restoration.terrainMatched === false || restoration.draftMatched === false || restoration.terrainSelectionMatched === false
        ? 'fail' : restoration.historyMatched === false ? 'warn' : 'pass';
      checks.push(statusCheck('auto-validation.restoration', restoreStatus, `terrain=${restoration.terrainMatched !== false} draft=${restoration.draftMatched !== false} selection=${restoration.terrainSelectionMatched !== false} history=${restoration.historyMatched !== false} undoΔ=${restoration.undoDelta || 0} redoΔ=${restoration.redoDelta || 0}`));
    }
  }

  return checks;
}

if (!RiftDiagnostics.prototype[PATCH_MARK]) {
  Object.defineProperty(RiftDiagnostics.prototype, PATCH_MARK, { value: true });
  RiftDiagnostics.prototype.runValidation = async function guardedRunValidation(reason = 'manual') {
    activeInstance = this;
    if (!this[WRAPPED_INSTANCE]) {
      const baseValidator = this.validator;
      this.validator = async () => {
        const base = await baseValidator();
        const baseChecks = Array.isArray(base) ? base : Array.isArray(base?.checks) ? base.checks : [];
        const guardChecks = await buildGuardChecks(this);
        guardState.lastChecks = guardChecks;
        guardState.lastRunAt = new Date().toISOString();
        guardState.runs += 1;
        return [...baseChecks, ...guardChecks];
      };
      Object.defineProperty(this, WRAPPED_INSTANCE, { value: true });
    }
    return originalRunValidation.call(this, reason);
  };
}

window.IronvaleValidatorGuard = Object.freeze({
  format: IRONVALE_VALIDATOR_GUARD_FORMAT,
  status: () => ({ ...guardState, lastChecks: guardState.lastChecks.map(check => ({ ...check })) }),
  layout: layoutSnapshot,
  snapshot: async (level = 2) => {
    if (!activeInstance) throw new Error('Validator instance has not run yet.');
    return snapshotRuntime(activeInstance, Math.max(1, Math.min(3, Number(level) || 2)));
  },
  captureIntegrity,
  compareIntegrity,
  createDump: async (level = 3, reason = 'auto-validation-bundle') => {
    if (!activeInstance) throw new Error('Validator instance has not run yet.');
    return activeInstance.createDump(level, reason);
  }
});

queueMicrotask(() => { try { void window.IronvaleDiagnostics?.validate?.(); } catch (_) {} });
