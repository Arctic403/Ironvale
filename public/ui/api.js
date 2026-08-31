const IS_BROWSER = typeof window !== 'undefined';
const CACHE_PREFIX = 'riftcity:api-cache:v1:';
const inFlight = new Map();
const memoryCache = new Map();
const requestWindows = new Map();
const startedAt = Date.now();
let changeQueued = false;

const metrics = {
  apiCalls: 0,
  networkRequests: 0,
  cacheHits: 0,
  staleHits: 0,
  deduped: 0,
  retries: 0,
  failures: 0,
  blocked: 0,
  mutations: 0,
  bytesSent: 0,
  bytesReceived: 0,
  latencyTotalMs: 0,
  latencyMaxMs: 0,
  syncRequests: 0,
  syncBatchQueries: 0,
  syncBatchRowsRead: 0,
  syncBatchRowsWritten: 0,
  lastRequestAt: 0
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const nowMs = () => globalThis.performance?.now?.() ?? Date.now();

function cloneValue(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
}

function cachePolicy(path, method, options) {
  if (method !== 'GET') return { ttl: 0, persist: false };
  if (Number.isFinite(Number(options.riftCacheTtl))) {
    return { ttl: Math.max(0, Number(options.riftCacheTtl)), persist: !!options.riftPersistCache };
  }
  if (path === '/api/items' || path.startsWith('/api/items/')) return { ttl: 30 * 60_000, persist: true };
  if (path === '/api/services') return { ttl: 10 * 60_000, persist: true };
  if (path.startsWith('/api/sync')) return { ttl: 750, persist: false };
  if (path === '/api/auth/me') return { ttl: 1500, persist: false };
  if (path === '/api/player/state' || path === '/api/inventory' || path === '/api/crimes') return { ttl: 500, persist: false };
  return { ttl: 0, persist: false };
}

function storageKey(path) { return CACHE_PREFIX + encodeURIComponent(path); }

function readStoredCache(path) {
  if (!IS_BROWSER) return null;
  try {
    const raw = localStorage.getItem(storageKey(path));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return null;
    return parsed;
  } catch (_) { return null; }
}

function readCache(path, { allowStale = false } = {}) {
  const timestamp = Date.now();
  let entry = memoryCache.get(path) || null;
  if (!entry) {
    entry = readStoredCache(path);
    if (entry) memoryCache.set(path, entry);
  }
  if (!entry) return null;
  const fresh = Number(entry.expiresAt) > timestamp;
  if (!fresh && !allowStale) return null;
  return { data: cloneValue(entry.data), stale: !fresh };
}

function writeCache(path, data, policy) {
  if (!policy.ttl || !data?.ok) return;
  const entry = { savedAt: Date.now(), expiresAt: Date.now() + policy.ttl, data: cloneValue(data) };
  memoryCache.set(path, entry);
  if (policy.persist && IS_BROWSER) {
    try { localStorage.setItem(storageKey(path), JSON.stringify(entry)); } catch (_) {}
  }
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

function invalidateAfterMutation(path) {
  memoryCache.delete('/api/sync');
  for (const key of [...memoryCache.keys()]) if (key.startsWith('/api/sync?')) memoryCache.delete(key);
  if (path.startsWith('/api/inventory')) memoryCache.delete('/api/inventory');
  if (path.startsWith('/api/crimes')) memoryCache.delete('/api/crimes');
  if (path.startsWith('/api/world/')) memoryCache.delete('/api/world');
  if (path.startsWith('/api/services/')) {
    const service = path.split('/')[3] || '';
    if (service) for (const key of [...memoryCache.keys()]) if (key.startsWith('/api/services/' + service)) memoryCache.delete(key);
  }
  if (path.startsWith('/api/auth/')) {
    for (const key of [...memoryCache.keys()]) if (!key.startsWith('/api/items')) memoryCache.delete(key);
  }
}

function queueNetworkChange() {
  if (!IS_BROWSER || changeQueued) return;
  changeQueued = true;
  queueMicrotask(() => {
    changeQueued = false;
    window.dispatchEvent(new CustomEvent('riftnetworkchange', { detail: getRiftNetworkStatus() }));
  });
}

function noteRequest(path) {
  const timestamp = Date.now();
  const cutoff = timestamp - 60_000;
  const list = requestWindows.get(path) || [];
  while (list.length && list[0] < cutoff) list.shift();
  const limit = path.startsWith('/api/sync') ? 12 : 60;
  if (list.length >= limit) {
    metrics.blocked += 1;
    queueNetworkChange();
    return false;
  }
  list.push(timestamp);
  requestWindows.set(path, list);
  return true;
}

function fetchOptions(options) {
  const {
    riftCacheTtl, riftPersistCache, riftBackground, riftNoRetry,
    ...clean
  } = options || {};
  return clean;
}

function requestKey(path, method, options) {
  return method + ' ' + path + ' ' + (typeof options?.body === 'string' ? options.body : '');
}

function observeSyncUsage(path, data) {
  if (!path.startsWith('/api/sync')) return;
  metrics.syncRequests += 1;
  const usage = data?.usage || {};
  metrics.syncBatchQueries += Number(usage.batchQueries) || 0;
  metrics.syncBatchRowsRead += Number(usage.batchRowsRead) || 0;
  metrics.syncBatchRowsWritten += Number(usage.batchRowsWritten) || 0;
}

async function networkFetch(path, options, method, retry = false) {
  const started = nowMs();
  const clean = fetchOptions(options);
  metrics.networkRequests += 1;
  metrics.lastRequestAt = Date.now();
  if (typeof clean.body === 'string') metrics.bytesSent += clean.body.length;
  queueNetworkChange();

  const response = await fetch(path, { credentials: 'same-origin', ...clean });
  const text = await response.text();
  metrics.bytesReceived += text.length;
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) {}
  const elapsed = Math.max(0, nowMs() - started);
  metrics.latencyTotalMs += elapsed;
  metrics.latencyMaxMs = Math.max(metrics.latencyMaxMs, elapsed);
  const result = { ...data, ok: response.ok && data.ok !== false, status: response.status };
  observeSyncUsage(path, result);
  if (!result.ok && response.status >= 500 && response.status <= 504 && method === 'GET' && !options.riftNoRetry && !retry && online()) {
    metrics.retries += 1;
    await sleep(250);
    return networkFetch(path, options, method, true);
  }
  return result;
}

export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const policy = cachePolicy(path, method, options);
  const key = requestKey(path, method, options);
  metrics.apiCalls += 1;

  if (method === 'GET' && policy.ttl > 0) {
    const cached = readCache(path);
    if (cached) {
      metrics.cacheHits += 1;
      queueNetworkChange();
      return { ...cached.data, cached: true };
    }
  }

  const pending = inFlight.get(key);
  if (pending) {
    metrics.deduped += 1;
    queueNetworkChange();
    return pending;
  }

  if (!online()) {
    if (method === 'GET') {
      const stale = readCache(path, { allowStale: true });
      if (stale) {
        metrics.staleHits += 1;
        queueNetworkChange();
        return { ...stale.data, cached: true, stale: true, offline: true };
      }
    }
    metrics.failures += 1;
    queueNetworkChange();
    return { ok: false, error: 'RiftCity is offline. Server-authoritative actions were not replayed.', status: 0, offline: true };
  }

  if (method === 'GET' && !noteRequest(path)) {
    return { ok: false, error: 'Client request guard blocked a runaway polling loop.', status: 429, clientGuard: true };
  }

  const promise = (async () => {
    try {
      const result = await networkFetch(path, options, method);
      if (method === 'GET' && result.ok) writeCache(path, result, policy);
      if (method !== 'GET' && result.ok) {
        metrics.mutations += 1;
        invalidateAfterMutation(path);
        if (IS_BROWSER && (path.startsWith('/api/services') || path.startsWith('/api/crimes') || path.startsWith('/api/inventory') || path.startsWith('/api/world/travel'))) {
          window.dispatchEvent(new CustomEvent('riftapi:mutation', { detail: { path, method } }));
        }
      }
      if (!result.ok) metrics.failures += 1;
      return result;
    } catch (_) {
      if (method === 'GET' && !options.riftNoRetry && online()) {
        try {
          metrics.retries += 1;
          await sleep(250);
          const result = await networkFetch(path, { ...options, riftNoRetry: true }, method, true);
          if (result.ok) writeCache(path, result, policy);
          else metrics.failures += 1;
          return result;
        } catch (_) {}
      }
      metrics.failures += 1;
      return { ok: false, error: 'Could not reach the RiftCity server', status: 0 };
    } finally {
      inFlight.delete(key);
      queueNetworkChange();
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export function getRiftNetworkStatus() {
  const elapsedMs = Math.max(1, Date.now() - startedAt);
  const sessionMinutes = elapsedMs / 60_000;
  const avgLatencyMs = metrics.networkRequests ? metrics.latencyTotalMs / metrics.networkRequests : 0;
  const avoidedWorkerRequests = metrics.cacheHits + metrics.deduped + metrics.blocked;
  const cacheHitRate = metrics.apiCalls ? (metrics.cacheHits + metrics.deduped) / metrics.apiCalls : 0;
  const estimatedDailyRequests = sessionMinutes >= 1
    ? Math.round((metrics.networkRequests / sessionMinutes) * 1440)
    : null;
  return Object.freeze({
    ...metrics,
    sessionMinutes,
    avgLatencyMs,
    avoidedWorkerRequests,
    cacheHitRate,
    estimatedDailyRequests,
    inFlight: inFlight.size
  });
}

export function resetRiftNetworkMetrics() {
  for (const key of Object.keys(metrics)) metrics[key] = 0;
  metrics.lastRequestAt = Date.now();
  queueNetworkChange();
}

export const getService = (service, params = '', options = {}) => api(`/api/services/${encodeURIComponent(service)}${params}`, options);
export const postService = (service, body) => api(`/api/services/${encodeURIComponent(service)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

if (IS_BROWSER) {
  window.RiftCityNetwork = Object.freeze({
    version: 'rift-network-v1',
    get status() { return getRiftNetworkStatus(); },
    invalidate: invalidateApiCache,
    resetMetrics: resetRiftNetworkMetrics
  });
}
