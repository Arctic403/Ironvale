export const DIAGNOSTIC_DUMP_FORMAT = 'ironvale-diagnostic-dump-v1';
export const DIAGNOSTIC_RUNTIME_FORMAT = 'ironvale-diagnostics-v2';
export const DIAGNOSTIC_LEVELS = Object.freeze({ QUICK: 1, RUNTIME: 2, DEEP: 3 });

const LAST_CRASH_KEY = 'ironvale:diagnostics:last-crash:v1';
const SETTINGS_KEY = 'ironvale:diagnostics:settings:v1';
const MAX_EVENTS = 160;
const MAX_NETWORK_EVENTS = 120;
const MAX_CONSOLE_EVENTS = 120;
const MAX_STRING = 120000;
const REDACTED_KEY = /(?:password|passphrase|(?:access|refresh|auth|id)[-_]?token|token|ticket|(?:api|private|client)[-_]?secret|secret|authorization|cookie|session(?:[-_]?(?:id|key|token))?|credentials?|api[-_]?key)$/i;

function isoNow() { return new Date().toISOString(); }
function levelName(level) { return level === 1 ? 'quick' : level === 2 ? 'runtime' : 'deep'; }
function clampLevel(value) { return Math.max(1, Math.min(3, Math.trunc(Number(value) || 1))); }

function safeError(error) {
  if (!error) return null;
  return {
    name: sanitizeString(error.name || 'Error').slice(0, 120),
    message: sanitizeString(error.message || error || 'unknown error').slice(0, 4000),
    stack: sanitizeString(error.stack || '').slice(0, 12000)
  };
}

function sanitizeUrl(raw) {
  try {
    const url = new URL(raw);
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) if (REDACTED_KEY.test(key)) url.searchParams.set(key, '[REDACTED]');
    return url.href;
  } catch (_) { return raw; }
}

function sanitizeString(value) {
  let text = String(value);
  if (text.length > MAX_STRING) text = text.slice(0, MAX_STRING) + '…[truncated]';
  text = text.replace(/((?:password|passphrase|(?:access|refresh|auth|id)[-_]?token|token|ticket|(?:api|private|client)[-_]?secret|secret|cookie|authorization|session(?:[-_]?(?:id|key|token))?|credentials?|api[-_]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[REDACTED]');
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/https?:\/\/[^\s"'<>]+/gi, match => sanitizeUrl(match));
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
    this.networkEvents = [];
    this.consoleEvents = [];
    this.providers = new Map();
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
    this._nativeFetch = null;
    this._fetchWrapper = null;
    this._consoleOriginals = null;
  }

  _installFetchTelemetry() {
    if (this._fetchWrapper || typeof globalThis.fetch !== 'function') return;
    this._nativeFetch = globalThis.fetch.bind(globalThis);
    this._fetchWrapper = async (input, init = undefined) => {
      const started = performance.now();
      const method = String(init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
      const url = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
      try {
        const response = await this._nativeFetch(input, init);
        this._recordNetwork({
          at: isoNow(), method, url, ok: response.ok, status: response.status, type: response.type,
          durationMs: performance.now() - started,
          contentLength: Number(response.headers?.get?.('content-length')) || null,
          contentType: response.headers?.get?.('content-type') || null,
          cacheControl: response.headers?.get?.('cache-control') || null
        });
        return response;
      } catch (error) {
        this._recordNetwork({ at: isoNow(), method, url, ok: false, status: 0, durationMs: performance.now() - started, error: safeError(error) });
        throw error;
      }
    };
    globalThis.fetch = this._fetchWrapper;
  }

  _restoreFetchTelemetry() {
    if (this._fetchWrapper && globalThis.fetch === this._fetchWrapper && this._nativeFetch) globalThis.fetch = this._nativeFetch;
    this._fetchWrapper = null;
    this._nativeFetch = null;
  }

  _recordNetwork(entry) {
    this.networkEvents.push(sanitize(entry));
    if (this.networkEvents.length > MAX_NETWORK_EVENTS) this.networkEvents.splice(0, this.networkEvents.length - MAX_NETWORK_EVENTS);
  }

  getNetworkTelemetry() { return sanitize(this.networkEvents); }

  _recordConsole(level, args) {
    const values = Array.from(args || []).slice(0, 8).map(value => value instanceof Error ? safeError(value) : sanitize(value));
    this.consoleEvents.push({ at: isoNow(), level, values });
    if (this.consoleEvents.length > MAX_CONSOLE_EVENTS) this.consoleEvents.splice(0, this.consoleEvents.length - MAX_CONSOLE_EVENTS);
  }

  _installConsoleTelemetry() {
    if (this._consoleOriginals || !globalThis.console) return;
    this._consoleOriginals = {};
    for (const level of ['warn', 'error']) {
      if (typeof console[level] !== 'function') continue;
      const original = console[level];
      this._consoleOriginals[level] = original;
      console[level] = (...args) => { this._recordConsole(level, args); return original.apply(console, args); };
    }
  }

  _restoreConsoleTelemetry() {
    if (!this._consoleOriginals) return;
    for (const [level, original] of Object.entries(this._consoleOriginals)) console[level] = original;
    this._consoleOriginals = null;
  }

  getConsoleTelemetry(deep = true) {
    const events = deep ? this.consoleEvents : this.consoleEvents.slice(-30);
    return { total: this.consoleEvents.length, warnings: this.consoleEvents.filter(item => item.level === 'warn').length, errors: this.consoleEvents.filter(item => item.level === 'error').length, events: sanitize(events) };
  }

  registerProvider(name, provider) {
    const key = String(name || '').trim().slice(0, 80);
    if (!key || typeof provider !== 'function') throw new Error('Diagnostic provider requires a name and function.');
    this.providers.set(key, provider);
    this.record('diagnostics', 'Registered diagnostic provider', { name: key });
    return () => this.unregisterProvider(key);
  }

  unregisterProvider(name) { return this.providers.delete(String(name || '')); }

  async _collectProviders(level) {
    const output = {};
    for (const [name, provider] of this.providers) {
      try { output[name] = sanitize(await provider(level)); }
      catch (error) { output[name] = { error: safeError(error) }; }
    }
    return output;
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
    this._installFetchTelemetry();
    this._installConsoleTelemetry();
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
    this._restoreFetchTelemetry();
    this._restoreConsoleTelemetry();
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
    let snapshot = {};
    let snapshotError = null;
    try {
      snapshot = sanitize(await this.snapshotProvider(resolvedLevel)) || {};
    } catch (error) {
      snapshotError = safeError(error);
      this.record('diagnostics', 'Snapshot provider failed', snapshotError, 'error');
    }
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
      captureErrors: snapshotError ? [{ source: 'snapshotProvider', error: snapshotError }] : [],
      layers: {
        l1Quick: snapshot?.quick || {}
      }
    };
    if (resolvedLevel >= 2) {
      dump.layers.l2Runtime = {
        ...(snapshot?.runtime || {}),
        network: sanitize(this.networkEvents.slice(-24)),
        console: this.getConsoleTelemetry(false),
        subsystemProviders: await this._collectProviders(2),
        recentEvents: sanitize(this.events.slice(-50))
      };
    }
    if (resolvedLevel >= 3) {
      dump.layers.l3Deep = {
        ...(snapshot?.deep || {}),
        network: sanitize(this.networkEvents),
        console: this.getConsoleTelemetry(true),
        subsystemProviders: await this._collectProviders(3),
        recentEvents: sanitize(this.events.slice(-MAX_EVENTS))
      };
    }
    if (incident) dump.incident = sanitize(incident);
    return dump;
  }

  _storeCrash(dump) {
    const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
    const reduced = clone(dump);
    const candidates = [dump];

    if (reduced.layers?.l2Runtime?.recentEvents) reduced.layers.l2Runtime.recentEvents = reduced.layers.l2Runtime.recentEvents.slice(-15);
    if (reduced.layers?.l2Runtime?.network) reduced.layers.l2Runtime.network = reduced.layers.l2Runtime.network.slice(-8);
    if (reduced.layers?.l2Runtime?.console?.events) reduced.layers.l2Runtime.console.events = reduced.layers.l2Runtime.console.events.slice(-8);
    reduced.storageNote = 'Automatic crash dump reduced for durable browser storage.';
    candidates.push(reduced);

    const minimal = {
      format: dump?.format || DIAGNOSTIC_DUMP_FORMAT,
      schemaVersion: dump?.schemaVersion || 1,
      runtimeFormat: dump?.runtimeFormat || DIAGNOSTIC_RUNTIME_FORMAT,
      level: 2,
      levelName: 'runtime',
      createdAt: dump?.createdAt || isoNow(),
      reason: dump?.reason || 'automatic-crash',
      privacy: dump?.privacy || { sanitized: true, credentialsIncluded: false },
      validation: dump?.validation || null,
      incident: dump?.incident || null,
      captureErrors: dump?.captureErrors || [],
      layers: { l1Quick: dump?.layers?.l1Quick || {} },
      storageNote: 'Minimal automatic crash dump stored after the full runtime dump exceeded browser storage.'
    };
    candidates.push(minimal);
    candidates.push({
      ...minimal,
      validation: minimal.validation ? { status: minimal.validation.status, counts: minimal.validation.counts } : null,
      layers: { l1Quick: { storageFallback: true } },
      storageNote: 'Emergency crash summary stored because detailed diagnostic state exceeded browser storage.'
    });

    for (const candidate of candidates) {
      try {
        const json = JSON.stringify(candidate);
        if (json.length > 900000 && candidate !== minimal) continue;
        localStorage.setItem(LAST_CRASH_KEY, json);
        return true;
      } catch (_) {}
    }
    return false;
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
    const blob = new Blob([JSON.stringify(dump, null, 2) + '\n'], { type: 'application/json' });
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
    this.record('dump', 'Exported raw diagnostic dump', { level: dump.level, name, encoding: 'json-pretty' });
    return dump;
  }

  async _downloadCompressed(dump, filename = null) {
    if (typeof CompressionStream !== 'function') throw new Error('Lossless GZIP export is not supported by this browser.');
    const level = clampLevel(dump?.level);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = filename || 'ironvale-dump-l' + level + '-' + stamp + '.json.gz';
    const json = JSON.stringify(dump) + '\n';
    const rawBytes = new TextEncoder().encode(json).byteLength;
    const compressedStream = new Blob([json], { type: 'application/json' }).stream().pipeThrough(new CompressionStream('gzip'));
    const blob = await new Response(compressedStream).blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return {
      name,
      encoding: 'gzip',
      rawBytes,
      compressedBytes: blob.size,
      ratio: rawBytes ? blob.size / rawBytes : 1
    };
  }

  async exportCompressedDump(level = 1, reason = 'manual-compressed') {
    const dump = await this.createDump(level, reason);
    const exported = await this._downloadCompressed(dump);
    this.record('dump', 'Exported lossless compressed diagnostic dump', { level: dump.level, ...exported });
    return { dump, export: exported };
  }

  exportLastCrash() {
    const dump = this.getLastCrash();
    if (!dump) return null;
    this._download(dump, 'ironvale-last-crash-l2.json');
    this.record('dump', 'Exported last automatic crash dump', { level: 2 });
    return dump;
  }
}
