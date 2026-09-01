import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error('Missing patch anchor: ' + label);
  return text.replace(from, to);
}

const diagnosticsModule = `export const DIAGNOSTIC_DUMP_FORMAT = 'ironvale-diagnostic-dump-v1';
export const DIAGNOSTIC_RUNTIME_FORMAT = 'ironvale-diagnostics-v1';
export const DIAGNOSTIC_LEVELS = Object.freeze({ QUICK: 1, RUNTIME: 2, DEEP: 3 });

const LAST_CRASH_KEY = 'ironvale:diagnostics:last-crash:v1';
const SETTINGS_KEY = 'ironvale:diagnostics:settings:v1';
const MAX_EVENTS = 120;
const MAX_STRING = 120000;
const REDACTED_KEY = /(pass(word)?|token|secret|cookie|authorization|session|credential|api[-_]?key)/i;

function isoNow() { return new Date().toISOString(); }
function levelName(level) { return level === 1 ? 'quick' : level === 2 ? 'runtime' : 'deep'; }
function clampLevel(value) { return Math.max(1, Math.min(3, Math.trunc(Number(value) || 1))); }

function safeError(error) {
  if (!error) return null;
  return {
    name: String(error.name || 'Error').slice(0, 120),
    message: String(error.message || error || 'unknown error').slice(0, 4000),
    stack: String(error.stack || '').slice(0, 12000)
  };
}

function sanitizeString(value) {
  let text = String(value);
  if (text.length > MAX_STRING) text = text.slice(0, MAX_STRING) + '…[truncated]';
  if (/^https?:\\/\\//i.test(text)) {
    try {
      const url = new URL(text);
      url.username = '';
      url.password = '';
      for (const key of [...url.searchParams.keys()]) if (REDACTED_KEY.test(key)) url.searchParams.set(key, '[REDACTED]');
      text = url.href;
    } catch (_) {}
  }
  return text;
}

function sanitize(value, depth = 0, seen = new WeakSet()) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Error) return safeError(value);
  if (depth > 10) return '[max-depth]';
  if (ArrayBuffer.isView(value)) {
    const length = Number(value.length ?? value.byteLength) || 0;
    const preview = typeof value.slice === 'function' ? Array.from(value.slice(0, 32)) : [];
    return { type: value.constructor?.name || 'TypedArray', length, preview, truncated: length > preview.length };
  }
  if (value instanceof ArrayBuffer) return { type: 'ArrayBuffer', byteLength: value.byteLength };
  if (typeof value !== 'object') return sanitizeString(value);
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => sanitize(item, depth + 1, seen));
  if (value instanceof Set) return [...value].map(item => sanitize(item, depth + 1, seen));
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([key, item]) => [sanitizeString(key), sanitize(item, depth + 1, seen)]));
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = REDACTED_KEY.test(key) ? '[REDACTED]' : sanitize(item, depth + 1, seen);
  }
  return output;
}

function normalizeChecks(value) {
  const source = Array.isArray(value) ? value : Array.isArray(value?.checks) ? value.checks : [];
  return source.map((check, index) => {
    const status = ['pass', 'warn', 'fail'].includes(check?.status) ? check.status : check?.ok === false ? 'fail' : 'pass';
    return {
      id: String(check?.id || 'check-' + index).slice(0, 120),
      status,
      detail: sanitizeString(check?.detail || '')
    };
  });
}

function validationSummary(checks, reason) {
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const check of checks) counts[check.status] += 1;
  const status = counts.fail ? 'fail' : counts.warn ? 'warn' : 'pass';
  return { format: 'ironvale-validation-result-v1', at: isoNow(), reason, status, counts, checks };
}

export class RiftDiagnostics {
  constructor(options = {}) {
    this.snapshotProvider = typeof options.snapshotProvider === 'function' ? options.snapshotProvider : async () => ({});
    this.validator = typeof options.validator === 'function' ? options.validator : async () => [];
    this.onValidation = typeof options.onValidation === 'function' ? options.onValidation : null;
    this.onCrash = typeof options.onCrash === 'function' ? options.onCrash : null;
    this.intervalMs = Math.max(2000, Math.trunc(Number(options.intervalMs) || 5000));
    this.events = [];
    this.lastValidation = null;
    this.timer = 0;
    this.started = false;
    this.autoEnabled = this._loadAutoSetting();
    this._errorHandler = event => {
      const error = event?.error || new Error(event?.message || 'window error');
      void this.captureCrash(error, 'window.error');
    };
    this._rejectionHandler = event => {
      const reason = event?.reason instanceof Error ? event.reason : new Error(String(event?.reason || 'unhandled rejection'));
      void this.captureCrash(reason, 'unhandledrejection');
    };
  }

  _loadAutoSetting() {
    try {
      const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return value.autoValidator !== false;
    } catch (_) { return true; }
  }

  _saveAutoSetting() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ autoValidator: this.autoEnabled })); } catch (_) {}
  }

  start() {
    if (this.started) return this;
    this.started = true;
    window.addEventListener('error', this._errorHandler);
    window.addEventListener('unhandledrejection', this._rejectionHandler);
    this._restartTimer();
    queueMicrotask(() => { void this.runValidation('startup'); });
    return this;
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    clearInterval(this.timer);
    this.timer = 0;
    window.removeEventListener('error', this._errorHandler);
    window.removeEventListener('unhandledrejection', this._rejectionHandler);
  }

  _restartTimer() {
    clearInterval(this.timer);
    this.timer = 0;
    if (this.started && this.autoEnabled) this.timer = setInterval(() => { void this.runValidation('automatic'); }, this.intervalMs);
  }

  setAutoEnabled(enabled) {
    this.autoEnabled = Boolean(enabled);
    this._saveAutoSetting();
    this._restartTimer();
    this.record('validator', this.autoEnabled ? 'Automatic validator enabled' : 'Automatic validator disabled');
    if (this.autoEnabled) void this.runValidation('auto-enabled');
    return this.autoEnabled;
  }

  record(category, message, data = null, severity = 'info') {
    const event = {
      at: isoNow(),
      category: String(category || 'runtime').slice(0, 80),
      severity: ['info', 'warn', 'error'].includes(severity) ? severity : 'info',
      message: sanitizeString(message || ''),
      data: sanitize(data)
    };
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
    return event;
  }

  async runValidation(reason = 'manual') {
    try {
      const checks = normalizeChecks(await this.validator());
      const next = validationSummary(checks, reason);
      const changed = this.lastValidation?.status !== next.status || reason !== 'automatic';
      this.lastValidation = next;
      if (changed) this.record('validator', 'Validation ' + next.status, next.counts, next.status === 'fail' ? 'error' : next.status === 'warn' ? 'warn' : 'info');
      this.onValidation?.(next);
      return next;
    } catch (error) {
      const next = validationSummary([{ id: 'validator.exception', status: 'fail', detail: String(error?.message || error) }], reason);
      this.lastValidation = next;
      this.record('validator', 'Validator threw an exception', safeError(error), 'error');
      this.onValidation?.(next);
      return next;
    }
  }

  async createDump(level = 1, reason = 'manual', incident = null) {
    const resolvedLevel = clampLevel(level);
    const snapshot = sanitize(await this.snapshotProvider(resolvedLevel));
    const dump = {
      format: DIAGNOSTIC_DUMP_FORMAT,
      schemaVersion: 1,
      runtimeFormat: DIAGNOSTIC_RUNTIME_FORMAT,
      level: resolvedLevel,
      levelName: levelName(resolvedLevel),
      createdAt: isoNow(),
      reason: sanitizeString(reason),
      privacy: {
        sanitized: true,
        credentialsIncluded: false,
        cookiesIncluded: false,
        authFieldsIncluded: false,
        note: 'Known secret-bearing keys are redacted. Authentication form values and cookies are never collected.'
      },
      validation: sanitize(this.lastValidation),
      layers: {
        l1Quick: snapshot?.quick || {}
      }
    };
    if (resolvedLevel >= 2) {
      dump.layers.l2Runtime = {
        ...(snapshot?.runtime || {}),
        recentEvents: sanitize(this.events.slice(-40))
      };
    }
    if (resolvedLevel >= 3) {
      dump.layers.l3Deep = {
        ...(snapshot?.deep || {}),
        recentEvents: sanitize(this.events.slice(-MAX_EVENTS))
      };
    }
    if (incident) dump.incident = sanitize(incident);
    return dump;
  }

  _storeCrash(dump) {
    try {
      let json = JSON.stringify(dump);
      if (json.length > 900000) {
        const reduced = structuredClone ? structuredClone(dump) : JSON.parse(json);
        if (reduced.layers?.l2Runtime?.recentEvents) reduced.layers.l2Runtime.recentEvents = reduced.layers.l2Runtime.recentEvents.slice(-15);
        reduced.storageNote = 'Automatic crash dump reduced to fit browser storage.';
        json = JSON.stringify(reduced);
      }
      localStorage.setItem(LAST_CRASH_KEY, json);
      return true;
    } catch (_) { return false; }
  }

  getLastCrash() {
    try { return JSON.parse(localStorage.getItem(LAST_CRASH_KEY) || 'null'); } catch (_) { return null; }
  }

  hasLastCrash() { return Boolean(this.getLastCrash()); }
  clearLastCrash() { try { localStorage.removeItem(LAST_CRASH_KEY); } catch (_) {} }

  async captureCrash(error, source = 'runtime') {
    const incident = { source: sanitizeString(source), error: safeError(error) };
    this.record('crash', 'Captured ' + source, incident, 'error');
    await this.runValidation('crash');
    const dump = await this.createDump(2, 'automatic-crash', incident);
    const stored = this._storeCrash(dump);
    this.onCrash?.({ dump, stored, incident });
    return dump;
  }

  _download(dump, filename = null) {
    const level = clampLevel(dump?.level);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = filename || 'ironvale-dump-l' + level + '-' + stamp + '.json';
    const blob = new Blob([JSON.stringify(dump, null, 2) + '\\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return name;
  }

  async exportDump(level = 1, reason = 'manual') {
    const dump = await this.createDump(level, reason);
    const name = this._download(dump);
    this.record('dump', 'Exported diagnostic dump', { level: dump.level, name });
    return dump;
  }

  exportLastCrash() {
    const dump = this.getLastCrash();
    if (!dump) return null;
    this._download(dump, 'ironvale-last-crash-l2.json');
    this.record('dump', 'Exported last automatic crash dump', { level: 2 });
    return dump;
  }
}
`;

fs.writeFileSync('public/rift-diagnostics.js', diagnosticsModule);

let app = fs.readFileSync('public/app.js', 'utf8');
app = replaceOnce(
  app,
  "import { validateWorldScaleContract } from './rift-scale.js?v=20260901-scale-contract-r1';\n",
  "import { validateWorldScaleContract } from './rift-scale.js?v=20260901-scale-contract-r1';\nimport { RiftDiagnostics } from './rift-diagnostics.js?v=20260901-diagnostics-r1';\n",
  'diagnostics import'
);
app = replaceOnce(
  app,
  "const terrainDebugReadout = $('#terrain-debug-readout');\n",
  "const terrainDebugReadout = $('#terrain-debug-readout');\nconst diagnosticStatus = $('#diagnostic-status');\nconst diagnosticRunButton = $('#diagnostic-run');\nconst diagnosticAutoButton = $('#diagnostic-auto');\nconst diagnosticLastCrashButton = $('#diagnostic-last-crash');\nconst authDumpButton = $('#auth-dump-button');\n",
  'diagnostics dom refs'
);
app = replaceOnce(
  app,
  "let sculptFlattenY = null;\n",
  `let sculptFlattenY = null;\n\nconst diagnostics = new RiftDiagnostics({\n  snapshotProvider: buildDiagnosticSnapshot,\n  validator: buildDiagnosticChecks,\n  intervalMs: 5000,\n  onValidation: refreshDiagnosticUi,\n  onCrash: () => refreshDiagnosticButtons()\n}).start();\n\nwindow.IronvaleDiagnostics = Object.freeze({\n  validate: () => diagnostics.runValidation('api'),\n  dump: level => diagnostics.exportDump(level || 2, 'api'),\n  lastCrash: () => diagnostics.getLastCrash(),\n  exportLastCrash: () => diagnostics.exportLastCrash(),\n  clearLastCrash: () => { diagnostics.clearLastCrash(); refreshDiagnosticButtons(); },\n  setAuto: enabled => { const value = diagnostics.setAutoEnabled(enabled); refreshDiagnosticButtons(); return value; }\n});\n`,
  'diagnostics runtime init'
);
app = replaceOnce(
  app,
  "terrainDebugToggle?.addEventListener('click', () => setTerrainDebug(!terrainDebugEnabled));\n",
  `terrainDebugToggle?.addEventListener('click', () => setTerrainDebug(!terrainDebugEnabled));\ndiagnosticRunButton?.addEventListener('click', () => { void diagnostics.runValidation('manual'); });\ndiagnosticAutoButton?.addEventListener('click', () => { diagnostics.setAutoEnabled(!diagnostics.autoEnabled); refreshDiagnosticButtons(); });\ndocument.querySelectorAll('[data-diagnostic-dump]').forEach(button => button.addEventListener('click', () => {\n  const level = Number(button.dataset.diagnosticDump) || 1;\n  void diagnostics.exportDump(level, 'manual-tools');\n}));\ndiagnosticLastCrashButton?.addEventListener('click', () => diagnostics.exportLastCrash());\nauthDumpButton?.addEventListener('click', () => diagnostics.exportLastCrash());\n`,
  'diagnostics event handlers'
);

const diagnosticHelpers = `\nfunction diagnosticCheck(id, passed, detail = '', severity = 'error') {\n  return { id, status: passed ? 'pass' : severity === 'warn' ? 'warn' : 'fail', detail };\n}\n\nfunction finiteVector(values) {\n  return Array.isArray(values) && values.length >= 3 && values.slice(0, 3).every(Number.isFinite);\n}\n\nfunction summarizeStreamPlan(plan) {\n  if (!plan) return null;\n  return {\n    render: [...(plan.render || [])],\n    preload: [...(plan.preload || [])],\n    unloaded: [...(plan.unloaded || [])]\n  };\n}\n\nfunction webGlDiagnosticInfo(gl, deep = false) {\n  if (!gl) return null;\n  const read = parameter => { try { return gl.getParameter(parameter); } catch (_) { return null; } };\n  const info = {\n    contextLost: Boolean(gl.isContextLost?.()),\n    maxTextureSize: read(gl.MAX_TEXTURE_SIZE),\n    maxArrayTextureLayers: read(gl.MAX_ARRAY_TEXTURE_LAYERS),\n    maxTextureImageUnits: read(gl.MAX_TEXTURE_IMAGE_UNITS),\n    maxVertexTextureImageUnits: read(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),\n    maxRenderbufferSize: read(gl.MAX_RENDERBUFFER_SIZE)\n  };\n  try {\n    const extension = gl.getExtension('WEBGL_debug_renderer_info');\n    if (extension) {\n      info.vendor = read(extension.UNMASKED_VENDOR_WEBGL);\n      info.renderer = read(extension.UNMASKED_RENDERER_WEBGL);\n    }\n  } catch (_) {}\n  if (deep) {\n    try { info.extensions = gl.getSupportedExtensions?.() || []; } catch (_) { info.extensions = []; }\n  }\n  return info;\n}\n\nfunction buildDiagnosticChecks() {\n  const checks = [\n    diagnosticCheck('browser.webgl2-api', typeof WebGL2RenderingContext !== 'undefined', 'WebGL2 API available'),\n    diagnosticCheck('runtime.scale-module', typeof validateWorldScaleContract === 'function', 'World scale validator loaded')\n  ];\n  if (!worldDocument) return checks;\n\n  const scaleValidation = validateWorldScaleContract(worldDocument);\n  const terrainValidation = terrain?.validateLandscape?.();\n  checks.push(\n    diagnosticCheck('world.scale-contract', scaleValidation.ok, scaleValidation.errors?.join('; ') || '1 unit = 1 meter'),\n    diagnosticCheck('world.terrain-runtime', Boolean(terrain), terrain ? 'RiftLandscape loaded' : 'Terrain runtime missing'),\n    diagnosticCheck('renderer.engine', Boolean(engine?.gl), engine?.gl ? 'WebGL2 engine ready' : 'Renderer missing'),\n    diagnosticCheck('renderer.context', Boolean(engine?.gl) && !engine.gl.isContextLost?.(), engine?.gl?.isContextLost?.() ? 'WebGL context lost' : 'Context active'),\n    diagnosticCheck('player.position', [player.x, player.y, player.z, player.yaw].every(Number.isFinite), 'Player transform finite'),\n    diagnosticCheck('camera.position', finiteVector(lastCameraPosition) && finiteVector(lastCameraTarget), 'Camera transform finite'),\n    diagnosticCheck('terrain.validation', terrainValidation?.ok !== false, terrainValidation?.errors?.join('; ') || 'Landscape valid'),\n    diagnosticCheck('terrain.meshes', terrainMeshes.size > 0, terrainMeshes.size + ' terrain meshes'),\n    diagnosticCheck('terrain.lod-plan', terrainLodPlan.size > 0, terrainLodPlan.size + ' planned sections'),\n    diagnosticCheck('terrain.streaming', Boolean(terrainStreamPlan?.render?.size), (terrainStreamPlan?.render?.size || 0) + ' render components'),\n    diagnosticCheck('character.visual', Boolean(playerCharacter?.meshes?.length), playerCharacter?.meshes?.length ? 'Rigged visual active' : 'Capsule fallback active', 'warn')\n  );\n  return checks;\n}\n\nasync function buildDiagnosticSnapshot(level = 1) {\n  const resolvedLevel = Math.max(1, Math.min(3, Math.trunc(Number(level) || 1)));\n  const scaleValidation = worldDocument ? validateWorldScaleContract(worldDocument) : null;\n  const terrainValidation = terrain?.validateLandscape?.() || null;\n  const terrainStats = terrain?.getStats?.() || null;\n  const viewport = engine?.getViewport?.() || null;\n  const gl = engine?.gl || null;\n  const quick = {\n    app: 'Ironvale',\n    diagnostics: 'ironvale-diagnostics-v1',\n    phase: worldDocument ? 'world' : 'auth',\n    worldId: worldDocument?.id || null,\n    worldUnits: worldDocument?.units || null,\n    player: [player.x, player.y, player.z, player.yaw],\n    cameraMode: freecamEnabled ? 'freecam' : 'third-person',\n    terrainReady: Boolean(terrain),\n    rendererReady: Boolean(engine),\n    characterVisual: playerCharacter?.meshes?.length ? 'rigged' : playerMesh ? 'fallback' : 'none',\n    status: terrainStatus?.textContent || authStatus?.textContent || '',\n    userAgent: navigator.userAgent,\n    viewportCss: viewport ? [viewport.cssWidth, viewport.cssHeight] : [innerWidth, innerHeight]\n  };\n  if (resolvedLevel === 1) return { quick };\n\n  const runtime = {\n    world: worldDocument ? {\n      format: worldDocument.format, version: worldDocument.version, id: worldDocument.id, units: worldDocument.units,\n      scale: worldDocument.scale, metadata: worldDocument.metadata, terrainSize: worldDocument.terrain?.size,\n      scaleValidation\n    } : null,\n    terrain: {\n      stats: terrainStats, validation: terrainValidation, meshCount: terrainMeshes.size, lodPlanSize: terrainLodPlan.size,\n      lodSummary: terrainLodPlan.size ? lodSummary() : '', streamPlan: summarizeStreamPlan(terrainStreamPlan),\n      activeEditLayer: terrain?.activeEditLayer?.id || null, activeMaterialLayer: terrain?.activeMaterialLayer?.id || null, activeSpline: terrain?.activeSpline?.id || null\n    },\n    renderer: {\n      ready: Boolean(engine), viewport, pixelRatioCap: engine?.pixelRatioCap ?? null, meshCount: engine?.meshes?.size ?? 0,\n      textureCount: engine?.textures?.size ?? 0, textureArrayCount: engine?.textureArrays?.size ?? 0, skinCount: engine?.skins?.size ?? 0,\n      camera: engine?.camera || null, environment: engine?.environment || null, webgl: webGlDiagnosticInfo(gl, false)\n    },\n    player: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, vy: player.vy, grounded: player.grounded, moving: playerMoving },\n    character: {\n      rigged: Boolean(playerCharacter?.meshes?.length), meshCount: playerCharacter?.meshes?.length || (playerMesh ? 1 : 0),\n      rig: playerRig ? { renderHeight: playerRig.renderHeight, renderScale: playerRig.renderScale, feetAtY: playerRig.feetAtY, jointCount: playerRig.jointCount, animationClipCount: playerRig.animationClipCount, authoredForward: playerRig.authoredForward } : null\n    },\n    camera: { orbit: { ...orbitCamera }, freecam: { ...freecam }, lastPosition: [...lastCameraPosition], lastTarget: [...lastCameraTarget], profile: viewportCameraProfile },\n    performance: { averageFrameMs: terrainPerfAverageMs, approximateFps: terrainPerfAverageMs > 0 ? 1000 / terrainPerfAverageMs : null, mobileLandscape: isMobileLandscapeGameplay() },\n    editor: { freecamEnabled, brushMode, undoDepth: undoStack.length, redoDepth: redoStack.length, reticleHit, terrainDebugEnabled },\n    browser: { language: navigator.language, hardwareConcurrency: navigator.hardwareConcurrency || null, deviceMemory: navigator.deviceMemory || null, online: navigator.onLine }\n  };\n  if (resolvedLevel === 2) return { quick, runtime };\n\n  let remoteLibraryPointer = null;\n  try {\n    const response = await fetch('/assets/remote-library.json', { cache: 'no-store' });\n    remoteLibraryPointer = response.ok ? await response.json() : { error: 'HTTP ' + response.status };\n  } catch (error) {\n    remoteLibraryPointer = { error: String(error?.message || error) };\n  }\n  const draftText = localStorage.getItem(LOCAL_DRAFT_KEY);\n  const deep = {\n    worldDocument,\n    landscapeEdits: terrain?.serializeLandscapeEdits?.() || null,\n    localDraft: { key: LOCAL_DRAFT_KEY, bytes: draftText ? new TextEncoder().encode(draftText).byteLength : 0 },\n    remoteLibraryPointer,\n    renderer: { webgl: webGlDiagnosticInfo(gl, true) },\n    targeting: { registeredTargets: combatTargets.size, selectedTargetId, hardLockEnabled },\n    moduleContracts: { terrainDraft: 'v4', landscape: worldDocument?.terrain?.landscape?.format || null, scale: worldDocument?.scale?.format || null }\n  };\n  return { quick, runtime, deep };\n}\n\nfunction refreshDiagnosticUi(validation = diagnostics.lastValidation) {\n  if (!diagnosticStatus) return;\n  if (!validation) { diagnosticStatus.textContent = 'Validator starting…'; diagnosticStatus.dataset.status = 'idle'; return; }\n  const counts = validation.counts || { pass: 0, warn: 0, fail: 0 };\n  diagnosticStatus.dataset.status = validation.status;\n  diagnosticStatus.textContent = validation.status.toUpperCase() + ' · ' + counts.pass + ' pass · ' + counts.warn + ' warn · ' + counts.fail + ' fail';\n}\n\nfunction refreshDiagnosticButtons() {\n  if (diagnosticAutoButton) {\n    diagnosticAutoButton.textContent = 'Auto Validator: ' + (diagnostics.autoEnabled ? 'On' : 'Off');\n    diagnosticAutoButton.classList.toggle('active', diagnostics.autoEnabled);\n  }\n  const hasCrash = diagnostics.hasLastCrash();\n  if (diagnosticLastCrashButton) diagnosticLastCrashButton.hidden = !hasCrash;\n  if (authDumpButton) authDumpButton.hidden = !hasCrash;\n}\n\n`;
app = replaceOnce(app, 'async function bootSession() {\n', diagnosticHelpers + 'async function bootSession() {\n', 'diagnostic helper functions');
app = replaceOnce(
  app,
  "  } catch (error) {\n    console.error('Ironvale world boot failed.', error);\n    showAuth();\n    setAuthStatus(`World boot failed: ${String(error?.message || error || 'unknown error').slice(0, 180)}`, true);\n  }\n}\n",
  "  } catch (error) {\n    console.error('Ironvale world boot failed.', error);\n    const crashDump = await diagnostics.captureCrash(error, 'world-boot').catch(() => null);\n    showAuth();\n    refreshDiagnosticButtons();\n    setAuthStatus(`World boot failed: ${String(error?.message || error || 'unknown error').slice(0, 180)}${crashDump ? ' · L2 diagnostic dump saved' : ''}`, true);\n  }\n}\n",
  'boot crash dump capture'
);
app = replaceOnce(
  app,
  "  lastFrame = performance.now();\n  animationFrame = requestAnimationFrame(frame);\n}\n",
  "  diagnostics.record('world', 'World boot completed', { worldId: worldDocument?.id, terrainMeshes: terrainMeshes.size });\n  void diagnostics.runValidation('world-boot');\n  refreshDiagnosticButtons();\n  lastFrame = performance.now();\n  animationFrame = requestAnimationFrame(frame);\n}\n",
  'world boot diagnostics'
);
app = replaceOnce(
  app,
  "    console.warn('Rigged humanoid failed to load; keeping capsule fallback.', error);\n",
  "    diagnostics.record('character', 'Rigged humanoid failed; capsule fallback active', { error }, 'warn');\n    console.warn('Rigged humanoid failed to load; keeping capsule fallback.', error);\n",
  'character fallback diagnostics'
);
app = replaceOnce(
  app,
  "setupCanvasControls();\nsetupJoystick();\nrefreshEditorLabels();\nupdateReticleVisual();\nbootSession();\n",
  "setupCanvasControls();\nsetupJoystick();\nrefreshEditorLabels();\nupdateReticleVisual();\nrefreshDiagnosticUi();\nrefreshDiagnosticButtons();\nbootSession();\n",
  'diagnostics initial ui'
);
fs.writeFileSync('public/app.js', app);

let index = fs.readFileSync('public/index.html', 'utf8');
index = replaceOnce(
  index,
  '      <div id="auth-status" role="status"></div>\n',
  '      <div id="auth-status" role="status"></div>\n      <button id="auth-dump-button" class="auth-dump-button" type="button" hidden>Export Last Diagnostic Dump</button>\n',
  'auth diagnostic dump button'
);
index = replaceOnce(
  index,
  `      <div class="terrain-debug-tools">\n        <button id="terrain-debug-toggle" class="wide" type="button">Terrain Debug</button>\n        <small id="terrain-debug-readout">Debug overlay off.</small>\n      </div>\n`,
  `      <div class="terrain-debug-tools">\n        <button id="terrain-debug-toggle" class="wide" type="button">Terrain Debug</button>\n        <small id="terrain-debug-readout">Debug overlay off.</small>\n      </div>\n\n      <div class="diagnostic-tools">\n        <strong>Diagnostics</strong>\n        <small id="diagnostic-status" data-status="idle">Validator starting…</small>\n        <div class="history-grid"><button id="diagnostic-run" type="button">Validate Now</button><button id="diagnostic-auto" type="button">Auto Validator: On</button></div>\n        <div class="diagnostic-dump-grid" aria-label="Diagnostic dump layers">\n          <button data-diagnostic-dump="1" type="button">L1 Quick</button>\n          <button data-diagnostic-dump="2" type="button">L2 Runtime</button>\n          <button data-diagnostic-dump="3" type="button">L3 Deep</button>\n        </div>\n        <button id="diagnostic-last-crash" class="wide" type="button" hidden>Export Last Crash</button>\n        <small>Automatic checks stay silent. Crashes save an L2 dump; L3 is the full sanitized forensic snapshot.</small>\n      </div>\n`,
  'diagnostic tools markup'
);
index = replaceOnce(index, '/styles.css?v=20260901-terrain-lock-r1', '/styles.css?v=20260901-diagnostics-r1', 'styles cache key');
index = replaceOnce(index, '/app.js?v=20260901-scale-contract-r1', '/app.js?v=20260901-diagnostics-r1', 'app cache key');
fs.writeFileSync('public/index.html', index);

let styles = fs.readFileSync('public/styles.css', 'utf8');
styles += `\n\n/* Silent automated validator + three-layer dump controls. */\n.auth-dump-button{width:100%;min-height:40px;margin-top:8px;border:1px solid #d89c5970;border-radius:10px;background:#2b2115;color:#ffe0b3;font-weight:800}\n.diagnostic-tools{margin-top:12px;padding-top:10px;border-top:1px solid #ffffff14}\n.diagnostic-tools>strong{display:block;margin-bottom:6px;font-size:11px;color:#b8c9bc}\n.diagnostic-tools>small{display:block;margin-top:7px;color:#9fb0a3;font:700 10px/1.35 monospace;white-space:normal}\n#diagnostic-status[data-status=pass]{color:#8ed59c}\n#diagnostic-status[data-status=warn]{color:#f0c46c}\n#diagnostic-status[data-status=fail]{color:#ff9f98}\n.diagnostic-dump-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}\n.diagnostic-dump-grid button{min-width:0;padding:0 5px;font-size:10px}\n#diagnostic-auto.active{border-color:#7bc58c;background:#2c5a3a}\n`;
fs.writeFileSync('public/styles.css', styles);

const worldPath = 'public/world/ironvale-terrain.json';
const world = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
world.metadata = {
  ...(world.metadata || {}),
  automatedValidator: true,
  diagnosticDumpSystem: true,
  diagnosticDumpLayers: 3,
  diagnosticSchemaVersion: 1
};
world.diagnostics = {
  format: 'ironvale-diagnostics-v1',
  autoValidator: true,
  validatorIntervalMs: 5000,
  dumpFormat: 'ironvale-diagnostic-dump-v1',
  layers: [
    { level: 1, id: 'quick', purpose: 'compact failure summary and core state' },
    { level: 2, id: 'runtime', purpose: 'subsystem state, renderer, terrain, camera, player and recent events' },
    { level: 3, id: 'deep', purpose: 'sanitized forensic world/edit/runtime snapshot' }
  ],
  automaticCrashDumpLevel: 2,
  privacy: { includeCredentials: false, includeCookies: false, redactSecretKeys: true }
};
fs.writeFileSync(worldPath, JSON.stringify(world, null, 2) + '\n');

let pkg = fs.readFileSync('package.json', 'utf8');
pkg = replaceOnce(pkg, 'node --check public/rift-character.js &&', 'node --check public/rift-character.js && node --check public/rift-diagnostics.js &&', 'package diagnostics syntax check');
fs.writeFileSync('package.json', pkg);

let check = fs.readFileSync('scripts/check-core.js', 'utf8');
check = replaceOnce(
  check,
  "if (world.metadata?.frustumCulling !== true || world.metadata?.componentStreamingRuntime !== true || world.metadata?.collisionLodRuntime !== true) failures.push('terrain runtime optimization metadata');\n",
  "if (world.metadata?.frustumCulling !== true || world.metadata?.componentStreamingRuntime !== true || world.metadata?.collisionLodRuntime !== true) failures.push('terrain runtime optimization metadata');\nif (world.metadata?.automatedValidator !== true || world.metadata?.diagnosticDumpSystem !== true || world.metadata?.diagnosticDumpLayers !== 3) failures.push('automated diagnostics metadata');\nif (world.diagnostics?.format !== 'ironvale-diagnostics-v1' || world.diagnostics?.dumpFormat !== 'ironvale-diagnostic-dump-v1' || world.diagnostics?.automaticCrashDumpLevel !== 2 || world.diagnostics?.layers?.length !== 3) failures.push('three-layer diagnostic dump contract');\n",
  'diagnostic world contract check'
);
check = replaceOnce(
  check,
  "if (!app.includes('function updateActiveEditLayerName(') || !app.includes('function deleteActiveEditLayer(')) failures.push('terrain edit layer management');\n",
  "if (!app.includes('function updateActiveEditLayerName(') || !app.includes('function deleteActiveEditLayer(')) failures.push('terrain edit layer management');\nif (!app.includes(\"import { RiftDiagnostics } from './rift-diagnostics.js?v=\") || !app.includes('buildDiagnosticSnapshot') || !app.includes('buildDiagnosticChecks') || !app.includes('window.IronvaleDiagnostics')) failures.push('automated runtime validator integration');\nif (!app.includes(\"diagnostics.captureCrash(error, 'world-boot')\") || !app.includes('L2 diagnostic dump saved')) failures.push('automatic boot crash dump');\n",
  'diagnostic app checks'
);
check = replaceOnce(
  check,
  "if (!indexHtml.includes('id=\"terrain-debug-toggle\"') || !indexHtml.includes('id=\"terrain-debug-readout\"')) failures.push('terrain debug tools');\n",
  "if (!indexHtml.includes('id=\"terrain-debug-toggle\"') || !indexHtml.includes('id=\"terrain-debug-readout\"')) failures.push('terrain debug tools');\nif (!indexHtml.includes('id=\"diagnostic-run\"') || !indexHtml.includes('id=\"diagnostic-auto\"') || !indexHtml.includes('data-diagnostic-dump=\"1\"') || !indexHtml.includes('data-diagnostic-dump=\"2\"') || !indexHtml.includes('data-diagnostic-dump=\"3\"')) failures.push('three-layer diagnostic tools UI');\nif (!indexHtml.includes('id=\"auth-dump-button\"')) failures.push('auth crash dump export');\n",
  'diagnostic ui checks'
);
check = replaceOnce(
  check,
  "const terrain = fs.readFileSync('public/rift-terrain.js', 'utf8');\n",
  "const diagnosticsRuntime = fs.readFileSync('public/rift-diagnostics.js', 'utf8');\nif (!diagnosticsRuntime.includes('class RiftDiagnostics') || !diagnosticsRuntime.includes('automatic-crash') || !diagnosticsRuntime.includes('l1Quick') || !diagnosticsRuntime.includes('l2Runtime') || !diagnosticsRuntime.includes('l3Deep') || !diagnosticsRuntime.includes('credentialsIncluded: false')) failures.push('three-layer sanitized diagnostics runtime');\n\nconst terrain = fs.readFileSync('public/rift-terrain.js', 'utf8');\n",
  'diagnostic module check'
);
check = replaceOnce(
  check,
  "console.log('Ironvale core verified: RiftLandscape v2 edit layers + visible material painting + spline terrain deformation + scrollable mobile tools + component LOD hysteresis + C++/WASM terrain + RPG runtime.');",
  "console.log('Ironvale core verified: RiftLandscape + meter scale contract + silent automated validator + three-layer diagnostic dumps + C++/WASM terrain + RPG runtime.');",
  'verification summary'
);
fs.writeFileSync('scripts/check-core.js', check);

console.log('Diagnostics patch staged.');
