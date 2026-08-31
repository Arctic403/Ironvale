import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`[cloudflare-efficiency] ${label}: expected block not found`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`[cloudflare-efficiency] ${label}: expected block is not unique`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}
function replaceRegex(source, regex, replacement, label) {
  const matches = source.match(regex);
  if (!matches) throw new Error(`[cloudflare-efficiency] ${label}: expected pattern not found`);
  return source.replace(regex, replacement);
}

const apiSource = `const IS_BROWSER = typeof window !== 'undefined';
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

export const getService = (service, params = '', options = {}) => api(\`/api/services/\${encodeURIComponent(service)}\${params}\`, options);
export const postService = (service, body) => api(\`/api/services/\${encodeURIComponent(service)}\`, {
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
`;
write('public/ui/api.js', apiSource);

const syncSource = `import { getActiveWorldEvent, getEducationDefinition } from '../plugins/index.js';
import { ensureGameplayTables } from './gameplay.js';
import { getLawState } from './living-city.js';

export const RIFT_SYNC_VERSION = 'rift-sync-v1';
export const RIFT_SYNC_POLL_MS = 120_000;

const first = result => result?.results?.[0] || null;
const number = value => Number(value) || 0;

function batchUsage(results) {
  return (results || []).reduce((usage, result) => {
    usage.batchRowsRead += number(result?.meta?.rows_read);
    usage.batchRowsWritten += number(result?.meta?.rows_written);
    return usage;
  }, { batchQueries: (results || []).length, batchRowsRead: 0, batchRowsWritten: 0 });
}

export async function buildRiftSyncSnapshot(userId, env, deps) {
  await ensureGameplayTables(env);
  const generatedAt = Date.now();
  const playerRow = await deps.ensureActivePlayerState(env, userId);
  const locationRow = await deps.ensurePlayerLocation(env, userId);
  const law = await getLawState(userId, env);

  const results = await env.DB.batch([
    env.DB.prepare('SELECT current_region, traveling_to, arrives_at, updated_at FROM player_travel WHERE user_id=?').bind(userId),
    env.DB.prepare("SELECT course_id, completes_at FROM player_education WHERE user_id=? AND status='studying' AND completes_at>? ORDER BY completes_at ASC LIMIT 6").bind(userId, generatedAt),
    env.DB.prepare('SELECT COUNT(*) AS count, MIN(completes_at) AS next_at FROM production_batches WHERE user_id=? AND claimed=0').bind(userId),
    env.DB.prepare('SELECT frozen_until, protection_until, updated_at FROM player_bank_security WHERE user_id=?').bind(userId),
    env.DB.prepare('SELECT COUNT(*) AS count FROM activity_feed WHERE user_id=? AND read=0').bind(userId),
    env.DB.prepare('SELECT points, lifetime_points, updated_at FROM player_merits WHERE user_id=?').bind(userId)
  ]);

  const travelRow = first(results[0]);
  const educationRows = results[1]?.results || [];
  const productionRow = first(results[2]);
  const bankRow = first(results[3]);
  const activityRow = first(results[4]);
  const meritRow = first(results[5]);
  const player = deps.toPublicPlayerState(playerRow);
  const location = deps.toPublicPlayerLocation(locationRow);
  const frozenUntil = number(bankRow?.frozen_until);
  const travelActive = travelRow?.traveling_to && number(travelRow.arrives_at) > generatedAt;

  return {
    ok: true,
    syncVersion: RIFT_SYNC_VERSION,
    generatedAt,
    pollAfterMs: RIFT_SYNC_POLL_MS,
    player,
    location,
    effects: {
      status: player.status,
      event: getActiveWorldEvent() || null,
      travel: travelActive ? {
        currentRegion: travelRow.current_region || 'riftcity',
        travelingTo: travelRow.traveling_to,
        arrivesAt: number(travelRow.arrives_at),
        updatedAt: number(travelRow.updated_at) || null
      } : null,
      education: educationRows.map(row => {
        const course = getEducationDefinition(row.course_id);
        return { courseId: row.course_id, name: course?.name || row.course_id, completesAt: number(row.completes_at) };
      }),
      production: { activeCount: number(productionRow?.count), nextAt: number(productionRow?.next_at) || null },
      bank: {
        frozen: frozenUntil > generatedAt,
        frozenUntil: frozenUntil > generatedAt ? frozenUntil : null,
        protectionUntil: number(bankRow?.protection_until) || null
      },
      law,
      activity: { unread: number(activityRow?.count) },
      merits: { points: number(meritRow?.points), lifetimePoints: number(meritRow?.lifetime_points), updatedAt: number(meritRow?.updated_at) || null }
    },
    usage: batchUsage(results)
  };
}
`;
write('src/services/sync.js', syncSource);
