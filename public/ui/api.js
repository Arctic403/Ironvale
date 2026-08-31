const IS_BROWSER = typeof window !== 'undefined';
const CACHE_PREFIX = 'ironvale:api-cache:v1:';
const inFlight = new Map();
const memoryCache = new Map();
const requestWindows = new Map();
const startedAt = Date.now();
let changeQueued = false;

const metrics = {
  apiCalls: 0, networkRequests: 0, cacheHits: 0, staleHits: 0, deduped: 0, retries: 0,
  failures: 0, blocked: 0, mutations: 0, bytesSent: 0, bytesReceived: 0,
  latencyTotalMs: 0, latencyMaxMs: 0, syncRequests: 0, syncBatchQueries: 0,
  syncBatchRowsRead: 0, syncBatchRowsWritten: 0, lastRequestAt: 0
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const timer = () => globalThis.performance?.now?.() ?? Date.now();
const clone = value => {
  if (value == null) return value;
  if (typeof structuredClone === 'function') { try { return structuredClone(value); } catch (_) {} }
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
};

function policy(path, method, options) {
  if (method !== 'GET') return { ttl: 0, persist: false };
  if (Number.isFinite(Number(options.riftCacheTtl))) return { ttl: Math.max(0, Number(options.riftCacheTtl)), persist: !!options.riftPersistCache };
  if (path === '/api/ironvale/world') return { ttl: 30 * 60_000, persist: true };
  if (path === '/api/ironvale/bootstrap') return { ttl: 1200, persist: false };
  if (path === '/api/ironvale/sync') return { ttl: 750, persist: false };
  if (path === '/api/ironvale/character' || path === '/api/ironvale/journal' || path === '/api/ironvale/inventory') return { ttl: 750, persist: false };
  if (path === '/api/auth/me') return { ttl: 1500, persist: false };
  return { ttl: 0, persist: false };
}

const storageKey = path => CACHE_PREFIX + encodeURIComponent(path);
function stored(path) {
  if (!IS_BROWSER) return null;
  try { const data = JSON.parse(localStorage.getItem(storageKey(path)) || 'null'); return data?.data ? data : null; } catch (_) { return null; }
}
function cached(path, allowStale = false) {
  const entry = memoryCache.get(path) || stored(path);
  if (!entry) return null;
  memoryCache.set(path, entry);
  const stale = Number(entry.expiresAt) <= Date.now();
  if (stale && !allowStale) return null;
  return { data: clone(entry.data), stale };
}
function cache(path, data, rule) {
  if (!rule.ttl || !data?.ok) return;
  const entry = { savedAt: Date.now(), expiresAt: Date.now() + rule.ttl, data: clone(data) };
  memoryCache.set(path, entry);
  if (rule.persist && IS_BROWSER) { try { localStorage.setItem(storageKey(path), JSON.stringify(entry)); } catch (_) {} }
}

export function invalidateApiCache(prefix = '') {
  for (const key of [...memoryCache.keys()]) if (!prefix || key.startsWith(prefix)) memoryCache.delete(key);
  if (!IS_BROWSER) return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const path = decodeURIComponent(key.slice(CACHE_PREFIX.length));
      if (!prefix || path.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch (_) {}
}

function invalidateMutation(path) {
  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith('/api/ironvale/') || (path.startsWith('/api/auth/') && key.startsWith('/api/'))) memoryCache.delete(key);
  }
}
function notify() {
  if (!IS_BROWSER || changeQueued) return;
  changeQueued = true;
  queueMicrotask(() => {
    changeQueued = false;
    window.dispatchEvent(new CustomEvent('riftnetworkchange', { detail: getRiftNetworkStatus() }));
  });
}
function guard(path) {
  const t = Date.now(), cutoff = t - 60_000, list = requestWindows.get(path) || [];
  while (list.length && list[0] < cutoff) list.shift();
  const limit = path === '/api/ironvale/sync' ? 12 : 60;
  if (list.length >= limit) { metrics.blocked += 1; notify(); return false; }
  list.push(t); requestWindows.set(path, list); return true;
}
function cleanOptions(options) {
  const { riftCacheTtl, riftPersistCache, riftBackground, riftNoRetry, ...clean } = options || {};
  return clean;
}
function keyFor(path, method, options) { return `${method} ${path} ${typeof options?.body === 'string' ? options.body : ''}`; }
function observeSync(path, data) {
  if (path !== '/api/ironvale/sync') return;
  metrics.syncRequests += 1;
  metrics.syncBatchQueries += Number(data?.usage?.batchQueries) || 0;
  metrics.syncBatchRowsRead += Number(data?.usage?.batchRowsRead) || 0;
  metrics.syncBatchRowsWritten += Number(data?.usage?.batchRowsWritten) || 0;
}

async function network(path, options, method, retry = false) {
  const started = timer(), clean = cleanOptions(options);
  metrics.networkRequests += 1; metrics.lastRequestAt = Date.now();
  if (typeof clean.body === 'string') metrics.bytesSent += clean.body.length;
  notify();
  const response = await fetch(path, { credentials: 'same-origin', ...clean });
  const text = await response.text();
  metrics.bytesReceived += text.length;
  let data = {}; try { data = text ? JSON.parse(text) : {}; } catch (_) {}
  const elapsed = Math.max(0, timer() - started);
  metrics.latencyTotalMs += elapsed; metrics.latencyMaxMs = Math.max(metrics.latencyMaxMs, elapsed);
  const result = { ...data, ok: response.ok && data.ok !== false, status: response.status };
  observeSync(path, result);
  if (!result.ok && response.status >= 500 && response.status <= 504 && method === 'GET' && !options.riftNoRetry && !retry && online()) {
    metrics.retries += 1; await sleep(250); return network(path, options, method, true);
  }
  return result;
}

export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase(), rule = policy(path, method, options), key = keyFor(path, method, options);
  metrics.apiCalls += 1;
  if (method === 'GET' && rule.ttl) {
    const hit = cached(path);
    if (hit) { metrics.cacheHits += 1; notify(); return { ...hit.data, cached: true }; }
  }
  if (inFlight.has(key)) { metrics.deduped += 1; notify(); return inFlight.get(key); }
  if (!online()) {
    if (method === 'GET') {
      const stale = cached(path, true);
      if (stale) { metrics.staleHits += 1; notify(); return { ...stale.data, cached: true, stale: true, offline: true }; }
    }
    metrics.failures += 1; notify();
    return { ok: false, error: 'Ironvale is offline. Server-authoritative actions were not replayed.', status: 0, offline: true };
  }
  if (method === 'GET' && !guard(path)) return { ok: false, error: 'Client request guard blocked a runaway polling loop.', status: 429, clientGuard: true };

  const pending = (async () => {
    try {
      const result = await network(path, options, method);
      if (method === 'GET' && result.ok) cache(path, result, rule);
      if (method !== 'GET' && result.ok) {
        metrics.mutations += 1; invalidateMutation(path);
        if (IS_BROWSER && path.startsWith('/api/ironvale/')) window.dispatchEvent(new CustomEvent('riftapi:mutation', { detail: { path, method } }));
      }
      if (!result.ok) metrics.failures += 1;
      return result;
    } catch (_) {
      if (method === 'GET' && !options.riftNoRetry && online()) {
        try {
          metrics.retries += 1; await sleep(250);
          const result = await network(path, { ...options, riftNoRetry: true }, method, true);
          if (result.ok) cache(path, result, rule); else metrics.failures += 1;
          return result;
        } catch (_) {}
      }
      metrics.failures += 1;
      return { ok: false, error: 'Could not reach the Ironvale server', status: 0 };
    } finally { inFlight.delete(key); notify(); }
  })();
  inFlight.set(key, pending);
  return pending;
}

export function getRiftNetworkStatus() {
  const minutes = Math.max(1, Date.now() - startedAt) / 60_000;
  const avgLatencyMs = metrics.networkRequests ? metrics.latencyTotalMs / metrics.networkRequests : 0;
  const avoidedWorkerRequests = metrics.cacheHits + metrics.deduped + metrics.blocked;
  const cacheHitRate = metrics.apiCalls ? (metrics.cacheHits + metrics.deduped) / metrics.apiCalls : 0;
  const estimatedDailyRequests = minutes >= 1 ? Math.round((metrics.networkRequests / minutes) * 1440) : null;
  return Object.freeze({ ...metrics, sessionMinutes: minutes, avgLatencyMs, avoidedWorkerRequests, cacheHitRate, estimatedDailyRequests, inFlight: inFlight.size });
}
export function resetRiftNetworkMetrics() {
  for (const key of Object.keys(metrics)) metrics[key] = 0;
  metrics.lastRequestAt = Date.now(); notify();
}

if (IS_BROWSER) {
  window.IronvaleNetwork = Object.freeze({
    version: 'ironvale-network-v1',
    get status() { return getRiftNetworkStatus(); },
    invalidate: invalidateApiCache,
    resetMetrics: resetRiftNetworkMetrics
  });
}
