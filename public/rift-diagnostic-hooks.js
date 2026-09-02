import { RiftTerrainMaterialRuntime } from './rift-terrain-materials.js?v=20260901-terrain-lock-r1';

export const RIFT_SUBSYSTEM_DIAGNOSTICS_FORMAT = 'ironvale-subsystem-hooks-v1';

const MAX_BACKEND_EVENTS = 80;
const MAX_ASSET_EVENTS = 120;
const MAX_INPUT_ACTIONS = 120;
const MAX_EDITOR_ACTIONS = 120;
const MAX_MATERIAL_EVENTS = 80;
const GAMEPLAY_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'control']);
const EDITOR_MUTATION_IDS = new Set([
  'add-terrain-edit-layer', 'terrain-layer-up', 'terrain-layer-down', 'terrain-layer-visible', 'terrain-layer-lock',
  'delete-terrain-edit-layer', 'new-terrain-spline', 'add-spline-point', 'move-spline-point', 'remove-spline-point',
  'clear-terrain-spline', 'undo-terrain', 'redo-terrain', 'save-terrain', 'export-terrain', 'reset-terrain'
]);
const EDITOR_VALUE_IDS = new Set([
  'terrain-edit-layer', 'terrain-layer-name', 'terrain-layer-opacity', 'terrain-material-layer', 'terrain-spline',
  'spline-width', 'spline-falloff', 'brush-radius', 'brush-strength', 'freecam-speed'
]);

const backendEvents = [];
const assetEvents = [];
const inputActions = [];
const editorActions = [];
const materialEvents = [];
const materialInstances = new Set();
const materialState = new WeakMap();
const pointerGestures = new Map();
const seenResources = new Set();
let diagnosticsApi = null;
let providersRegistered = false;
let resourceObserver = null;

function isoNow() { return new Date().toISOString(); }
function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((Number(value) || 0) * scale) / scale;
}
function pushRing(target, value, max) {
  target.push(value);
  if (target.length > max) target.splice(0, target.length - max);
  return value;
}
function text(value, max = 120) { return String(value == null ? '' : value).slice(0, max); }
function safeUrl(raw) {
  try {
    const url = new URL(raw, location.href);
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/(?:token|ticket|secret|password|auth|session|key)/i.test(key)) url.searchParams.set(key, '[REDACTED]');
    }
    return url.href;
  } catch (_) { return text(raw, 500); }
}
function currentBrush() { return document.querySelector('[data-brush].active')?.dataset?.brush || null; }
function elementAction(element) {
  if (!element) return null;
  if (element.id) return element.id;
  if (element.dataset?.brush) return `brush:${element.dataset.brush}`;
  if (element.dataset?.abilitySlot) return `ability:${element.dataset.abilitySlot}`;
  if (element.dataset?.freecamVertical) return `freecam-vertical:${element.dataset.freecamVertical}`;
  return null;
}
function isTextEntryTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
}
function resourceKey(entry) { return `${entry.name}|${round(entry.startTime, 3)}|${round(entry.duration, 3)}`; }
function metricByName(entry, name) { return Array.from(entry.serverTiming || []).find(metric => metric.name === name) || null; }
function descriptionMap(description) {
  const output = {};
  for (const piece of String(description || '').split(',')) {
    const [key, value] = piece.split('=');
    if (!key) continue;
    const number = Number(value);
    output[key.trim()] = Number.isFinite(number) ? number : text(value, 80);
  }
  return output;
}
function resourceDescriptor(entry) {
  return {
    at: new Date(performance.timeOrigin + entry.startTime).toISOString(),
    name: safeUrl(entry.name),
    initiatorType: entry.initiatorType || null,
    durationMs: round(entry.duration),
    transferSize: Number(entry.transferSize) || 0,
    encodedBodySize: Number(entry.encodedBodySize) || 0,
    decodedBodySize: Number(entry.decodedBodySize) || 0,
    protocol: entry.nextHopProtocol || null
  };
}
function isAssetResource(entry) {
  const name = String(entry?.name || '');
  return /(?:\/assets\/|\/world\/|rift-core\.wasm|\.(?:glb|gltf|bin|png|jpe?g|webp|ktx2|wasm)(?:\?|$))/i.test(name);
}
function isCharacterResource(entry) { return /\/assets\/characters\/|universal-(?:base|animation).*\.glb/i.test(String(entry?.name || '')); }
function isMaterialResource(entry) { return /terrain-materials|(?:Grass|Ground|Rock|PavingStones)\d*_[^/]*\.(?:jpg|png|webp)/i.test(String(entry?.name || '')); }

function captureBackendResource(entry) {
  let url;
  try { url = new URL(entry.name, location.href); } catch (_) { return; }
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return;
  const total = metricByName(entry, 'ironvale');
  const db = metricByName(entry, 'd1');
  const auth = metricByName(entry, 'auth');
  if (!total && !db && !auth) return;
  const dbStats = descriptionMap(db?.description);
  const totalStats = descriptionMap(total?.description);
  pushRing(backendEvents, {
    at: new Date(performance.timeOrigin + entry.startTime).toISOString(),
    route: url.pathname,
    method: text(totalStats.method || '', 12) || null,
    status: Number(totalStats.status) || null,
    totalMs: round(total?.duration ?? entry.duration),
    auth: text(auth?.description || 'not-reported', 48),
    d1: {
      calls: Number(dbStats.calls) || 0,
      queries: Number(dbStats.q) || 0,
      reads: Number(dbStats.r) || 0,
      writes: Number(dbStats.w) || 0,
      batches: Number(dbStats.b) || 0,
      failures: Number(dbStats.f) || 0,
      totalMs: round(db?.duration || 0),
      maxMs: round(dbStats.max || 0)
    }
  }, MAX_BACKEND_EVENTS);
}

function captureResourceEntry(entry) {
  if (!entry?.name) return;
  const key = resourceKey(entry);
  if (seenResources.has(key)) return;
  seenResources.add(key);
  if (seenResources.size > 800) {
    const keep = [...seenResources].slice(-500);
    seenResources.clear();
    for (const item of keep) seenResources.add(item);
  }
  captureBackendResource(entry);
  if (isAssetResource(entry)) pushRing(assetEvents, resourceDescriptor(entry), MAX_ASSET_EVENTS);
}

function installResourceObserver() {
  for (const entry of performance.getEntriesByType?.('resource') || []) captureResourceEntry(entry);
  if (typeof PerformanceObserver !== 'function') return;
  try {
    resourceObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) captureResourceEntry(entry);
    });
    resourceObserver.observe({ type: 'resource', buffered: true });
  } catch (_) {
    try {
      resourceObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) captureResourceEntry(entry);
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (_) {}
  }
}

function materialRuntimeState(runtime) {
  let state = materialState.get(runtime);
  if (!state) {
    state = { createdAt: isoNow(), attempts: 0, successes: 0, failures: 0, lastLayer: null, lastDurationMs: 0, lastError: null };
    materialState.set(runtime, state);
  }
  materialInstances.add(runtime);
  return state;
}

function patchMaterialRuntime() {
  const proto = RiftTerrainMaterialRuntime?.prototype;
  if (!proto || proto.__ironvaleDiagnosticHooks) return;
  Object.defineProperty(proto, '__ironvaleDiagnosticHooks', { value: true });
  const nativeLoadLayer = proto.loadLayer;
  const nativeDestroy = proto.destroy;

  proto.loadLayer = async function diagnosticLoadLayer(id) {
    const state = materialRuntimeState(this);
    const key = text(id, 80);
    const started = performance.now();
    state.attempts += 1;
    state.lastLayer = key;
    try {
      const result = await nativeLoadLayer.call(this, id);
      const ok = Boolean(result && this.loaded?.has?.(key));
      state.lastDurationMs = round(performance.now() - started);
      state.lastError = null;
      if (ok) state.successes += 1;
      else state.failures += 1;
      pushRing(materialEvents, { at: isoNow(), layer: key, ok, durationMs: state.lastDurationMs, loaded: this.loaded?.size || 0 }, MAX_MATERIAL_EVENTS);
      return result;
    } catch (error) {
      state.failures += 1;
      state.lastDurationMs = round(performance.now() - started);
      state.lastError = text(error?.message || error, 300);
      pushRing(materialEvents, { at: isoNow(), layer: key, ok: false, durationMs: state.lastDurationMs, error: state.lastError }, MAX_MATERIAL_EVENTS);
      throw error;
    }
  };

  proto.destroy = function diagnosticDestroy(...args) {
    const state = materialState.get(this);
    if (state) state.destroyedAt = isoNow();
    materialInstances.delete(this);
    return nativeDestroy.apply(this, args);
  };
}

function installInputJournal() {
  window.addEventListener('keydown', event => {
    if (isTextEntryTarget(event.target)) return;
    const key = String(event.key || '').toLowerCase();
    if (!GAMEPLAY_KEYS.has(key)) return;
    pushRing(inputActions, { at: isoNow(), type: 'key-down', key, repeat: Boolean(event.repeat) }, MAX_INPUT_ACTIONS);
  }, true);
  window.addEventListener('keyup', event => {
    if (isTextEntryTarget(event.target)) return;
    const key = String(event.key || '').toLowerCase();
    if (!GAMEPLAY_KEYS.has(key)) return;
    pushRing(inputActions, { at: isoNow(), type: 'key-up', key }, MAX_INPUT_ACTIONS);
  }, true);

  window.addEventListener('pointerdown', event => {
    const target = event.target;
    const canvas = target?.id === 'rift-canvas';
    const joystick = Boolean(target?.closest?.('#joystick'));
    if (!canvas && !joystick) return;
    pointerGestures.set(event.pointerId, {
      at: isoNow(), started: performance.now(), x: event.clientX, y: event.clientY,
      pointerType: event.pointerType || null, area: joystick ? 'joystick' : 'canvas', brush: currentBrush()
    });
  }, true);

  const finishPointer = (event, cancelled = false) => {
    const start = pointerGestures.get(event.pointerId);
    if (!start) return;
    pointerGestures.delete(event.pointerId);
    const action = {
      at: isoNow(), type: cancelled ? 'pointer-cancel' : 'pointer-gesture', area: start.area,
      pointerType: start.pointerType, durationMs: round(performance.now() - start.started),
      dx: Math.round(event.clientX - start.x), dy: Math.round(event.clientY - start.y), brush: start.brush
    };
    pushRing(inputActions, action, MAX_INPUT_ACTIONS);
    if (start.area === 'canvas' && start.brush) {
      pushRing(editorActions, { ...action, type: 'terrain-canvas-gesture' }, MAX_EDITOR_ACTIONS);
    }
  };
  window.addEventListener('pointerup', event => finishPointer(event, false), true);
  window.addEventListener('pointercancel', event => finishPointer(event, true), true);

  window.addEventListener('click', event => {
    const button = event.target?.closest?.('button');
    if (!button) return;
    const action = elementAction(button);
    if (!action || action.startsWith('diagnostic-') || action === 'auth-submit' || action === 'auth-dump-button') return;
    pushRing(inputActions, { at: isoNow(), type: 'button', action }, MAX_INPUT_ACTIONS);
    if (button.closest('#terrain-tools') && (EDITOR_MUTATION_IDS.has(button.id) || button.dataset?.brush)) {
      pushRing(editorActions, { at: isoNow(), type: 'editor-action', action, brush: currentBrush() }, MAX_EDITOR_ACTIONS);
    }
  }, true);

  window.addEventListener('change', event => {
    const target = event.target;
    if (!target?.closest?.('#terrain-tools') || !EDITOR_VALUE_IDS.has(target.id)) return;
    const value = target.type === 'range' ? Number(target.value) : text(target.value, 80);
    pushRing(editorActions, { at: isoNow(), type: 'editor-value', action: target.id, value }, MAX_EDITOR_ACTIONS);
  }, true);
}

function assetProvider(level) {
  const resources = assetEvents.slice(level >= 3 ? -MAX_ASSET_EVENTS : -30);
  return {
    format: RIFT_SUBSYSTEM_DIAGNOSTICS_FORMAT,
    totalObserved: assetEvents.length,
    characterResources: assetEvents.filter(entry => isCharacterResource(entry)).length,
    materialResources: assetEvents.filter(entry => isMaterialResource(entry)).length,
    wasmResources: assetEvents.filter(entry => /\.wasm/i.test(entry.name)).length,
    resources
  };
}

function characterProvider(level) {
  const resources = assetEvents.filter(entry => isCharacterResource(entry));
  const terrainStatus = document.querySelector('#terrain-status')?.textContent || '';
  return {
    format: RIFT_SUBSYSTEM_DIAGNOSTICS_FORMAT,
    resourceCount: resources.length,
    fallbackActive: /character fallback/i.test(terrainStatus),
    status: text(terrainStatus, 240),
    resources: resources.slice(level >= 3 ? -40 : -10)
  };
}

function materialProvider(level) {
  const runtimes = [...materialInstances].map(runtime => {
    const state = materialState.get(runtime) || {};
    return {
      size: runtime.size || null,
      layers: [...(runtime.layerIds || [])],
      loaded: [...(runtime.loaded || [])],
      loading: [...(runtime.loading?.keys?.() || [])],
      attempts: state.attempts || 0,
      successes: state.successes || 0,
      failures: state.failures || 0,
      lastLayer: state.lastLayer || null,
      lastDurationMs: state.lastDurationMs || 0,
      lastError: state.lastError || null
    };
  });
  return {
    format: RIFT_SUBSYSTEM_DIAGNOSTICS_FORMAT,
    activeRuntimes: runtimes.length,
    runtimes,
    recentEvents: materialEvents.slice(level >= 3 ? -MAX_MATERIAL_EVENTS : -20),
    resourceEvents: assetEvents.filter(entry => isMaterialResource(entry)).slice(level >= 3 ? -50 : -12)
  };
}

function backendProvider(level) {
  const recent = backendEvents.slice(level >= 3 ? -MAX_BACKEND_EVENTS : -24);
  const totals = backendEvents.reduce((sum, entry) => {
    sum.requests += 1;
    sum.d1Calls += entry.d1?.calls || 0;
    sum.d1Queries += entry.d1?.queries || 0;
    sum.d1Reads += entry.d1?.reads || 0;
    sum.d1Writes += entry.d1?.writes || 0;
    sum.d1Failures += entry.d1?.failures || 0;
    return sum;
  }, { requests: 0, d1Calls: 0, d1Queries: 0, d1Reads: 0, d1Writes: 0, d1Failures: 0 });
  return { format: RIFT_SUBSYSTEM_DIAGNOSTICS_FORMAT, totals, recent };
}

function inputProvider(level) {
  return { format: RIFT_SUBSYSTEM_DIAGNOSTICS_FORMAT, total: inputActions.length, recent: inputActions.slice(level >= 3 ? -MAX_INPUT_ACTIONS : -30) };
}
function editorProvider(level) {
  return { format: RIFT_SUBSYSTEM_DIAGNOSTICS_FORMAT, total: editorActions.length, recent: editorActions.slice(level >= 3 ? -MAX_EDITOR_ACTIONS : -30) };
}

function registerProviders() {
  if (providersRegistered || !diagnosticsApi?.registerProvider) return false;
  diagnosticsApi.registerProvider('backend', backendProvider);
  diagnosticsApi.registerProvider('assets', assetProvider);
  diagnosticsApi.registerProvider('materials', materialProvider);
  diagnosticsApi.registerProvider('character', characterProvider);
  diagnosticsApi.registerProvider('input-actions', inputProvider);
  diagnosticsApi.registerProvider('editor-journal', editorProvider);
  diagnosticsApi.record?.('diagnostics', 'Subsystem black-box hooks registered', {
    providers: ['backend', 'assets', 'materials', 'character', 'input-actions', 'editor-journal'],
    format: RIFT_SUBSYSTEM_DIAGNOSTICS_FORMAT
  });
  providersRegistered = true;
  return true;
}

function connectDiagnostics() {
  diagnosticsApi = window.IronvaleDiagnostics || null;
  if (registerProviders()) return;
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    diagnosticsApi = window.IronvaleDiagnostics || null;
    if (registerProviders() || attempts >= 400) clearInterval(timer);
  }, 25);
}

patchMaterialRuntime();
installResourceObserver();
installInputJournal();
connectDiagnostics();

window.addEventListener('pagehide', () => resourceObserver?.disconnect?.(), { once: true });
