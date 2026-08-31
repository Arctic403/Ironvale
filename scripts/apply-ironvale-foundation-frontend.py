from pathlib import Path
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.rstrip() + '\n', encoding='utf-8')

def replace_required(source, old, new, label):
    if old not in source:
        raise RuntimeError(f'{label}: expected text not found: {old[:80]}')
    return source.replace(old, new)

# Rename game-specific asset namespaces while retaining Rift Engine module names.
renames = [
    ('public/riftcity-blocks', 'public/rift-world-blocks'),
    ('public/riftcity-buildings', 'public/rift-buildings')
]
for old, new in renames:
    old_path, new_path = ROOT / old, ROOT / new
    if old_path.exists() and not new_path.exists():
        old_path.rename(new_path)

file_renames = [
    ('public/rift-world-blocks/downtown-block-001.json', 'public/rift-world-blocks/ironvale-foundation-001.json'),
    ('public/rift-buildings/riftcity-bank-001.json', 'public/rift-buildings/legacy-building-fixture-001.json')
]
for old, new in file_renames:
    old_path, new_path = ROOT / old, ROOT / new
    if old_path.exists() and not new_path.exists():
        old_path.rename(new_path)

text_extensions = {'.js','.mjs','.json','.md','.yml','.yaml','.html','.css','.toml','.webmanifest','.sql','.txt'}
replacements = [
    ('riftcity-blocks', 'rift-world-blocks'),
    ('riftcity-buildings', 'rift-buildings'),
    ('downtown-block-001.json', 'ironvale-foundation-001.json'),
    ('riftcity-base-world-001', 'ironvale-foundation-world-001'),
    ('RiftCity Base World', 'Ironvale Foundation World'),
    ('riftcity-bank-001.json', 'legacy-building-fixture-001.json'),
    ('riftcity-bank-001', 'legacy-building-fixture-001'),
    ('RiftCity Bank · H2.01 Research Branch', 'Legacy Building Fixture · Regression Archive')
]
for path in ROOT.rglob('*'):
    if not path.is_file() or '.git' in path.parts or path.suffix.lower() not in text_extensions:
        continue
    try:
        source = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    updated = source
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated != source:
        path.write_text(updated, encoding='utf-8')

manifest = r'''{
  "id": "/",
  "name": "Ironvale",
  "short_name": "Ironvale",
  "description": "A grounded medieval online RPG built on the Rift Engine.",
  "start_url": "/#world",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "browser"],
  "orientation": "any",
  "background_color": "#14120d",
  "theme_color": "#17140e",
  "categories": ["games"],
  "icons": [
    { "src": "/ironvale-icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}'''
write('public/manifest.webmanifest', manifest)

icon = r'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Ironvale">
  <rect width="1024" height="1024" rx="176" fill="#15130f"/>
  <path d="M512 92 840 212v250c0 226-132 390-328 470C316 852 184 688 184 462V212L512 92Z" fill="#242019" stroke="#9d7b45" stroke-width="28"/>
  <path d="M346 276h332v82H558v308h120v82H346v-82h120V358H346v-82Z" fill="#e8dfca"/>
  <path d="M324 780h376" stroke="#9d7b45" stroke-width="32" stroke-linecap="round"/>
</svg>'''
write('public/ironvale-icon.svg', icon)
try:
    (ROOT / 'public/riftcity-icon.svg').unlink()
except FileNotFoundError:
    pass

index_html = r'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no" />
  <meta name="theme-color" content="#17140e" />
  <meta name="application-name" content="Ironvale" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Ironvale" />
  <title>Ironvale — Medieval Online RPG</title>
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="icon" href="/ironvale-icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/ironvale-icon.svg" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/ironvale.css" />
</head>
<body>
  <header class="topbar">
    <a href="#world" class="brand" data-route="world" aria-label="Ironvale world">
      <span class="brand-mark">IV</span>
      <span><strong>IRONVALE</strong><small>MEDIEVAL ONLINE RPG</small></span>
    </a>
    <div class="topbar-center"><span id="page-eyebrow">THE MARCHES</span><strong id="page-title-text">World</strong></div>
    <button id="menu-button" class="menu-button" type="button" aria-label="Open navigation">☰</button>
  </header>

  <div id="status" class="status">Connecting to Ironvale…</div>
  <div id="message" class="message hidden"></div>

  <section id="auth-grid" class="auth-grid">
    <article class="auth-story">
      <span class="eyebrow">IRONVALE · FOUNDATION AGE</span>
      <h1>Enter the Marches.</h1>
      <p>Travel old roads, earn your place among rival factions, uncover forgotten ruins, and shape a persistent character in a grounded medieval world.</p>
      <div class="ironvale-auth-notes"><span>Persistent character</span><span>Quest chains</span><span>Open-world zones</span><span>Dungeon foundation</span></div>
    </article>
    <form id="login-form" class="auth-panel">
      <span class="eyebrow">RETURNING TRAVELER</span><h2>Sign in</h2>
      <label>Username<input name="username" required minlength="3" maxlength="20" autocomplete="username" /></label>
      <label>Password<input name="password" type="password" required minlength="8" autocomplete="current-password" /></label>
      <button class="rc-button primary" type="submit">Enter Ironvale</button>
    </form>
    <form id="register-form" class="auth-panel">
      <span class="eyebrow">NEW TRAVELER</span><h2>Create account</h2>
      <label>Username<input name="username" required minlength="3" maxlength="20" autocomplete="username" /></label>
      <label>Password<input name="password" type="password" required minlength="8" autocomplete="new-password" /></label>
      <button class="rc-button" type="submit">Begin the journey</button>
    </form>
  </section>

  <section id="hud-shell" class="hud-shell hidden">
    <div id="hud-primary" class="hud-primary"></div>
    <div id="effects-strip" class="effects-strip empty"></div>
    <div class="hud-meta"><span id="hud-status" class="hud-status status-active">ACTIVE</span><button id="logout-btn" class="hud-logout" type="button">LOG OUT</button></div>
  </section>

  <main id="game-root" class="game-root hidden"></main>
  <nav id="mobile-nav" class="mobile-nav hidden" aria-label="Primary navigation"></nav>

  <div id="drawer-backdrop" class="drawer-backdrop"></div>
  <aside id="game-drawer" class="game-drawer" aria-label="Ironvale navigation">
    <header><div><span>IRONVALE</span><strong>The Marches</strong></div><button id="drawer-close" type="button">×</button></header>
    <nav id="drawer-nav"></nav>
  </aside>

  <script type="module" src="/rift-wasm-core.js"></script>
  <script type="module" src="/rift-game-menu.js"></script>
  <script type="module" src="/rift-ai-world-tools.js"></script>
  <script type="module" src="/rift-world-composition-runtime.js"></script>
  <script type="module" src="/rift-building-authoring.js"></script>
  <script type="module" src="/app.js"></script>
</body>
</html>'''
write('public/index.html', index_html)

pwa_js = r'''const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
  || window.navigator.standalone === true;

document.documentElement.classList.toggle('pwa-standalone', standalone);
document.body.classList.toggle('pwa-standalone', standalone);

export function initPwaSupport() {
  if (standalone) {
    document.documentElement.dataset.displayMode = 'standalone';
    return;
  }
  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isAppleMobile) return;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('ironvale_install_hint_dismissed') === '1'; } catch (_) {}
  if (dismissed) return;
  const banner = document.createElement('aside');
  banner.id = 'ironvale-install-hint';
  banner.className = 'ironvale-install-hint riftcity-install-hint';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `<div><strong>Install Ironvale</strong><span>Safari: Share → Add to Home Screen → Open as Web App</span></div><button type="button" aria-label="Dismiss install hint">×</button>`;
  const dismiss = () => {
    banner.remove();
    try { sessionStorage.setItem('ironvale_install_hint_dismissed', '1'); } catch (_) {}
  };
  banner.querySelector('button')?.addEventListener('click', dismiss);
  document.body.appendChild(banner);
}

export function isStandaloneWebApp() { return standalone; }
'''
write('public/pwa.js', pwa_js)

state_js = r'''export const state = {
  authenticated: false,
  user: null,
  character: null,
  world: null,
  journal: null,
  inventory: null,
  equipment: null,
  sync: null,
  route: null,
  activeRequest: 0,
  inlineMessage: null
};

export function setCharacter(character) {
  if (character) state.character = character;
}

export function clearState() {
  state.authenticated = false;
  state.user = null;
  state.character = null;
  state.world = null;
  state.journal = null;
  state.inventory = null;
  state.equipment = null;
  state.sync = null;
}
'''
write('public/ui/state.js', state_js)

router_js = r'''const aliases = Object.freeze({ city: 'world', overview: 'character', quests: 'journal', equipment: 'inventory', wiki: 'codex' });
const routes = new Set(['world', 'character', 'journal', 'inventory', 'codex']);

export function parseRoute() {
  const raw = (location.hash || '#world').slice(1);
  const [path, query = ''] = raw.split('?');
  const requested = decodeURIComponent(path.split('/').filter(Boolean)[0] || 'world');
  const name = aliases[requested] || requested;
  return { name: routes.has(name) ? name : 'world', params: {}, query: new URLSearchParams(query) };
}

export function go(route) {
  const target = String(route || 'world');
  location.hash = target.startsWith('#') ? target : `#${target}`;
}
'''
write('public/ui/router.js', router_js)

api_js = r'''const IS_BROWSER = typeof window !== 'undefined';
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
'''
write('public/ui/api.js', api_js)

shell_js = r'''import { api } from './api.js';
import { state, setCharacter, clearState } from './state.js';
import { $, $$, escapeHtml } from './helpers.js';
import { go } from './router.js';

const PRIMARY_NAV = [
  ['world','World','⌂'], ['character','Character','♙'], ['journal','Journal','▧'], ['inventory','Inventory','▤'], ['codex','Codex','◇']
];
let syncTimer = null;
let syncPending = false;
let syncAfterMutation = null;

export function initShell() {
  $('#menu-button')?.addEventListener('click', () => $('#game-drawer')?.classList.toggle('open'));
  $('#drawer-close')?.addEventListener('click', () => $('#game-drawer')?.classList.remove('open'));
  $('#drawer-backdrop')?.addEventListener('click', () => $('#game-drawer')?.classList.remove('open'));
  $('#logout-btn')?.addEventListener('click', logout);
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-route]');
    if (!nav) return;
    event.preventDefault(); $('#game-drawer')?.classList.remove('open'); go(nav.dataset.route);
  });
  window.addEventListener('riftapi:mutation', scheduleMutationSync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.authenticated) syncNow(); });
  renderDrawer(); renderBottomNav();
}

function renderDrawer() {
  const root = $('#drawer-nav'); if (!root) return;
  const journey = `<section class="drawer-group"><span class="drawer-group-label">JOURNEY</span>${PRIMARY_NAV.map(([route,name]) => `<a href="#${route}" data-route="${route}">${escapeHtml(name)}</a>`).join('')}</section>`;
  const canDevelop = ['admin','developer'].includes(state.user?.role);
  const developer = canDevelop ? `<section class="drawer-group drawer-group-dev"><span class="drawer-group-label">RIFT ENGINE</span><a href="/dev/block-editor" class="drawer-dev-link"><span>▧</span><strong>World Editor</strong><small>Private authoring workspace</small></a><a href="/dev/ai-builder" class="drawer-dev-link"><span>◎</span><strong>AI Builder</strong><small>Ironvale world staging</small></a></section>` : '';
  root.innerHTML = journey + developer;
}
function renderBottomNav() {
  const root = $('#mobile-nav'); if (!root) return;
  root.innerHTML = PRIMARY_NAV.map(([route,name,icon]) => `<a href="#${route}" data-route="${route}" data-nav-route="${route}"><span>${icon}</span><small>${escapeHtml(name)}</small></a>`).join('');
}
export function updateActiveNav(routeName) {
  $$('[data-nav-route]').forEach(el => el.classList.toggle('active', el.dataset.navRoute === routeName));
  $$('[data-route]').forEach(el => { if (el.closest('#drawer-nav')) el.classList.toggle('active', el.dataset.route === routeName); });
}
export function setPageTitle(title, eyebrow = 'IRONVALE') { $('#page-title-text').textContent = title; $('#page-eyebrow').textContent = eyebrow; }
export function setSessionStatus(text, error = false) { const el = $('#status'); if (!el) return; el.textContent = text; el.classList.toggle('error', error); }
export function showToast(text, error = false) { const el = $('#message'); if (!el) return; el.textContent = text; el.classList.toggle('error', error); el.classList.remove('hidden'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.add('hidden'), 3200); }

export function renderCharacterHud(character = state.character) {
  if (!character) return;
  setCharacter(character);
  const r = character.resources || {}, a = character.attributes || {};
  const items = [
    ['LVL', character.level ?? 1], ['XP', `${character.xp ?? 0}/${character.xpToNextLevel ?? 100}`],
    ['HP', `${r.health ?? 0}/${r.maxHealth ?? 0}`], ['STA', `${r.stamina ?? 0}/${r.maxStamina ?? 0}`],
    ['COIN', r.coin ?? 0], ['STR', a.strength ?? 5], ['AGI', a.agility ?? 5], ['VIT', a.vitality ?? 5], ['WIL', a.willpower ?? 5]
  ];
  $('#hud-primary').innerHTML = items.map(([k,v]) => `<div class="hud-cell"><span>${k}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
  const badge = $('#hud-status'); if (badge) { badge.textContent = 'ACTIVE'; badge.className = 'hud-status status-active'; }
}

function applyBootstrap(result) {
  state.authenticated = true; state.user = result.user; state.character = result.character; state.world = result.world;
  state.journal = result.journal; state.inventory = result.inventory; state.equipment = result.equipment;
  renderDrawer(); renderCharacterHud(result.character);
}
function applySync(result) {
  state.sync = result; if (result.character) state.character = result.character; if (result.journal) state.journal = result.journal; if (result.equipment) state.equipment = result.equipment;
  renderCharacterHud(state.character);
}

export async function refreshSession({ navigate = true } = {}) {
  setSessionStatus('Checking Ironvale session…');
  const result = await api('/api/ironvale/bootstrap', { riftCacheTtl: 1000 });
  if (!result.ok || !result.authenticated) {
    clearState(); $('#auth-grid')?.classList.remove('hidden'); $('#game-root')?.classList.add('hidden'); $('#hud-shell')?.classList.add('hidden'); $('#mobile-nav')?.classList.add('hidden');
    setSessionStatus('Not signed in.'); stopSync();
    if (navigate && location.hash && !['','#world'].includes(location.hash)) history.replaceState(null, '', '#world');
    return false;
  }
  applyBootstrap(result);
  $('#auth-grid')?.classList.add('hidden'); $('#game-root')?.classList.remove('hidden'); $('#hud-shell')?.classList.remove('hidden'); $('#mobile-nav')?.classList.remove('hidden');
  setSessionStatus(`Connected as ${result.user.username}. Ironvale state synced.`); startSync(); return true;
}

async function syncNow() {
  if (!state.authenticated || syncPending || document.hidden) return;
  syncPending = true;
  try { const result = await api('/api/ironvale/sync', { riftCacheTtl: 500, riftBackground: true }); if (result.ok) applySync(result); }
  finally { syncPending = false; }
}
function startSync() { if (syncTimer) return; syncTimer = setInterval(syncNow, 120_000); }
function stopSync() { clearInterval(syncTimer); syncTimer = null; clearTimeout(syncAfterMutation); syncAfterMutation = null; }
function scheduleMutationSync() { clearTimeout(syncAfterMutation); syncAfterMutation = setTimeout(syncNow, 500); }

async function logout() {
  const result = await api('/api/auth/logout', { method: 'POST' });
  if (result.ok) { clearState(); stopSync(); showToast('Logged out.'); await refreshSession(); }
}
export async function submitAuth(path, form) {
  const data = new FormData(form);
  const result = await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
  if (!result.ok) return showToast(result.error || 'Authentication failed', true);
  showToast(path.endsWith('register') ? 'Account created.' : 'Welcome back.');
  await refreshSession(); go('world');
}
'''
write('public/ui/shell.js', shell_js)

app_js = r'''import './rift-world-composition-runtime.js';
import { $, escapeHtml } from './ui/helpers.js';
import { state } from './ui/state.js';
import { parseRoute, go } from './ui/router.js';
import { initShell, refreshSession, submitAuth, setPageTitle, updateActiveNav, showToast } from './ui/shell.js';
import { renderCharacter } from './views/character.js';
import { renderCity, destroyCity2D } from './views/city.js';
import { renderJournal } from './views/journal.js';
import { renderInventory } from './views/inventory.js';
import { renderCodex } from './views/codex.js';
import { initPwaSupport } from './pwa.js';

initShell(); initPwaSupport();
$('#login-form').addEventListener('submit', event => { event.preventDefault(); submitAuth('/api/auth/login', event.currentTarget); });
$('#register-form').addEventListener('submit', event => { event.preventDefault(); submitAuth('/api/auth/register', event.currentTarget); });
window.addEventListener('hashchange', route);
let focusSessionRefreshPending = false;
window.addEventListener('focus', async () => {
  if (!state.authenticated || focusSessionRefreshPending) return;
  focusSessionRefreshPending = true;
  try { await refreshSession({ navigate: false }); }
  catch (error) { console.warn('Ironvale focus session refresh failed', error); }
  finally { focusSessionRefreshPending = false; }
});

async function boot() {
  await refreshSession();
  if (!location.hash) go('world'); else await route();
}

async function route() {
  destroyCity2D();
  const request = ++state.activeRequest, parsed = parseRoute(); state.route = parsed;
  if (!state.authenticated) { const ok = await refreshSession({ navigate: false }); if (!ok) return; }
  const root = $('#game-root'); root.innerHTML = '<div class="rc-loading"><span></span><strong>Loading Ironvale…</strong></div>';
  updateActiveNav(parsed.name);
  try {
    if (parsed.name === 'world') { setPageTitle('World', 'THE IRONVALE MARCHES'); await renderCity(root); }
    else if (parsed.name === 'character') { setPageTitle('Character', 'TRAVELER'); await renderCharacter(root); }
    else if (parsed.name === 'journal') { setPageTitle('Journal', 'QUESTS'); await renderJournal(root); }
    else if (parsed.name === 'inventory') { setPageTitle('Inventory', 'GEAR & SUPPLIES'); await renderInventory(root); }
    else if (parsed.name === 'codex') { setPageTitle('Codex', 'WORLD KNOWLEDGE'); await renderCodex(root); }
    else go('world');
  } catch (error) {
    console.error(error);
    root.innerHTML = `<div class="rc-error"><strong>Page failed to load</strong><p>${escapeHtml(error?.message || 'Unknown frontend error')}</p><button class="rc-button" data-route="world">Return to World</button></div>`;
    showToast('An Ironvale page failed to render.', true);
  }
  if (request !== state.activeRequest) return;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

boot();
'''
write('public/app.js', app_js)

city_js = r'''import { renderDowntown3D, destroyDowntown3D } from '../downtown3d-foundation.js';

export function destroyCity2D() { destroyDowntown3D(); }
export const destroyIronvaleWorld = destroyDowntown3D;
export async function renderCity(root) { return renderDowntown3D(root); }
'''
write('public/views/city.js', city_js)

character_js = r'''import { api } from '../ui/api.js';
import { state, setCharacter } from '../ui/state.js';
import { escapeHtml } from '../ui/helpers.js';
import { renderCharacterHud } from '../ui/shell.js';

export async function renderCharacter(root) {
  if (!state.character) {
    const result = await api('/api/ironvale/character');
    if (!result.ok) throw new Error(result.error || 'Could not load character');
    state.character = result.character;
  }
  const c = state.character, r = c.resources || {}, a = c.attributes || {}, gear = state.equipment || {};
  setCharacter(c); renderCharacterHud(c);
  const gearSlots = [['mainHand','Main hand'],['offHand','Off hand'],['head','Head'],['chest','Chest'],['hands','Hands'],['legs','Legs'],['feet','Feet'],['neck','Neck'],['ring','Ring']];
  root.innerHTML = `<section class="ironvale-hero"><div><span class="eyebrow">TRAVELER OF THE MARCHES</span><h2>${escapeHtml(c.name)}</h2><p>Level ${c.level} · ${escapeHtml(state.world?.currentZone?.name || c.zoneId)}</p></div><div class="ironvale-level"><span>LEVEL</span><strong>${c.level}</strong><small>${c.xp}/${c.xpToNextLevel} XP</small></div></section>
  <div class="ironvale-two-column"><section class="ironvale-panel"><span class="eyebrow">ATTRIBUTES</span><div class="ironvale-stat-grid"><div><span>Strength</span><b>${a.strength}</b></div><div><span>Agility</span><b>${a.agility}</b></div><div><span>Vitality</span><b>${a.vitality}</b></div><div><span>Willpower</span><b>${a.willpower}</b></div><div><span>Health</span><b>${r.health}/${r.maxHealth}</b></div><div><span>Stamina</span><b>${r.stamina}/${r.maxStamina}</b></div><div><span>Coin</span><b>${r.coin}</b></div></div></section>
  <section class="ironvale-panel"><span class="eyebrow">EQUIPMENT</span><div class="ironvale-gear-list">${gearSlots.map(([slot,label]) => `<div><span>${label}</span><b>${escapeHtml(gear[slot]?.name || 'Empty')}</b></div>`).join('')}</div></section></div>`;
}
'''
write('public/views/character.js', character_js)

inventory_js = r'''import { api } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml } from '../ui/helpers.js';

export async function renderInventory(root) {
  const result = await api('/api/ironvale/inventory');
  if (!result.ok) throw new Error(result.error || 'Could not load inventory');
  state.inventory = result.inventory; state.equipment = result.inventory.equipment;
  const data = result.inventory, items = data.items || [];
  root.innerHTML = `<section class="ironvale-hero"><div><span class="eyebrow">GEAR & SUPPLIES</span><h2>Inventory</h2><p>Everything carried by your current Ironvale character.</p></div><div class="ironvale-level"><span>ITEMS</span><strong>${data.summary?.totalQuantity || 0}</strong><small>${data.summary?.uniqueItems || 0} types</small></div></section>
  <section class="ironvale-item-grid">${items.length ? items.map(item => `<article class="ironvale-item"><div class="ironvale-item-mark">${escapeHtml(item.name.slice(0,2).toUpperCase())}</div><div><span class="eyebrow">${escapeHtml(item.rarity)} · ${escapeHtml(item.type)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><small>${item.slot ? `Slot: ${escapeHtml(item.slot)}` : 'Supply'}${item.durability != null ? ` · Durability ${item.durability}` : ''}</small></div><b>x${item.quantity}</b></article>`).join('') : '<div class="rc-empty"><strong>Your pack is empty.</strong></div>'}</section>`;
}
'''
write('public/views/inventory.js', inventory_js)

journal_js = r'''import { api } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml } from '../ui/helpers.js';
import { showToast } from '../ui/shell.js';

export async function renderJournal(root) {
  const result = await api('/api/ironvale/journal');
  if (!result.ok) throw new Error(result.error || 'Could not load journal');
  state.journal = result.journal; draw(root);
}
function draw(root) {
  const journal = state.journal || { quests: [] };
  root.innerHTML = `<section class="ironvale-hero"><div><span class="eyebrow">BLACKSTONE ROAD · STORY FOUNDATION</span><h2>Quest Journal</h2><p>The first Ironvale story chain begins around Brackenford and leads toward Blackstone Wood.</p></div><div class="ironvale-level"><span>ACTIVE</span><strong>${journal.activeCount || 0}</strong><small>${journal.completedCount || 0} complete</small></div></section>
  <section class="ironvale-quest-list">${(journal.quests || []).map(quest => `<article class="ironvale-quest ${escapeHtml(quest.status)}"><div><span class="eyebrow">LEVEL ${quest.level} · ${escapeHtml(quest.status.toUpperCase())}</span><h3>${escapeHtml(quest.name)}</h3><p>${escapeHtml(quest.summary)}</p><small>${quest.objectives.map(o => `${o.type.toUpperCase()} ${escapeHtml(o.targetId)} ×${o.count}`).join(' · ')}</small></div><div class="ironvale-quest-reward"><span>REWARD</span><b>${quest.rewards.xp} XP</b><small>${quest.rewards.coin} coin</small>${quest.status === 'available' ? `<button class="rc-button primary" data-quest-accept="${escapeHtml(quest.id)}">Accept</button>` : ''}</div></article>`).join('')}</section>`;
  root.querySelectorAll('[data-quest-accept]').forEach(button => button.addEventListener('click', () => accept(root, button.dataset.questAccept)));
}
async function accept(root, questId) {
  const result = await api('/api/ironvale/quests/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questId }) });
  if (!result.ok) return showToast(result.error || 'Could not accept quest', true);
  state.journal = result.journal; showToast(result.message || 'Quest accepted.'); draw(root);
}
'''
write('public/views/journal.js', journal_js)

codex_js = r'''import { api } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml } from '../ui/helpers.js';

export async function renderCodex(root) {
  const result = await api('/api/ironvale/world', { riftCacheTtl: 30 * 60_000, riftPersistCache: true });
  if (!result.ok) throw new Error(result.error || 'Could not load world codex');
  state.world = result.world; const w = result.world;
  root.innerHTML = `<section class="ironvale-hero"><div><span class="eyebrow">${escapeHtml(w.region.name)}</span><h2>World Codex</h2><p>${escapeHtml(w.region.description)}</p></div><div class="ironvale-level"><span>ZONES</span><strong>${w.zones.length}</strong><small>Foundation map</small></div></section>
  <div class="ironvale-codex-grid"><section class="ironvale-panel"><span class="eyebrow">REGIONS & SETTLEMENTS</span>${w.zones.map(z => `<div class="ironvale-codex-row"><div><b>${escapeHtml(z.name)}</b><small>Levels ${z.levelMin}-${z.levelMax}</small></div><p>${escapeHtml(z.description)}</p></div>`).join('')}${w.settlements.map(s => `<div class="ironvale-codex-row"><div><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.kind)}</small></div><p>${escapeHtml(s.description)}</p></div>`).join('')}</section>
  <section class="ironvale-panel"><span class="eyebrow">PEOPLE & FACTIONS</span>${w.factions.map(f => `<div class="ironvale-codex-row"><div><b>${escapeHtml(f.name)}</b><small>${escapeHtml(f.alignment)}</small></div><p>${escapeHtml(f.description)}</p></div>`).join('')}${w.npcs.map(n => `<div class="ironvale-codex-row"><div><b>${escapeHtml(n.name)}</b><small>${escapeHtml(n.role)}</small></div></div>`).join('')}</section>
  <section class="ironvale-panel"><span class="eyebrow">DANGERS</span>${w.creatures.map(c => `<div class="ironvale-codex-row"><div><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.kind)} · ${c.levelMin}-${c.levelMax}</small></div></div>`).join('')}</section>
  <section class="ironvale-panel"><span class="eyebrow">DUNGEONS</span>${w.dungeons.map(d => `<div class="ironvale-codex-row"><div><b>${escapeHtml(d.name)}</b><small>Levels ${d.levelMin}-${d.levelMax} · ${d.partyMin}-${d.partyMax} players</small></div><p>${escapeHtml(d.description)}</p></div>`).join('')}</section></div>`;
}
'''
write('public/views/codex.js', codex_js)

for path in ['public/views/crimes.js','public/views/service.js','public/views/wiki.js']:
    try: (ROOT / path).unlink()
    except FileNotFoundError: pass
shutil.rmtree(ROOT / 'public/views/services', ignore_errors=True)

ironvale_css = r''':root{--ironvale-bg:#14120d;--ironvale-panel:#211d15;--ironvale-panel-2:#2b251a;--ironvale-line:#6c5737;--ironvale-brass:#b48a4a;--ironvale-cream:#e6dcc5;--ironvale-muted:#a99d86;--ironvale-green:#6f7c55}
body{background:radial-gradient(circle at 50% 0,#292319 0,#14120d 46%,#0e0d0a 100%);color:var(--ironvale-cream)}
.brand-mark{background:#282117!important;border-color:#9d7b45!important;color:#e8dfca!important}.brand strong,.game-drawer header strong{letter-spacing:.12em}.topbar{background:linear-gradient(180deg,#1f1b14f5,#14120df0)!important;border-bottom-color:#514229!important}.status{background:#19160f!important;border-color:#4b3e28!important;color:#b9ad95!important}
.auth-grid{background:transparent}.auth-story,.auth-panel{border-color:#5d4a2e!important;background:linear-gradient(145deg,#252016f4,#17140ef2)!important;box-shadow:0 24px 80px #0008}.auth-story h1{font-family:Georgia,serif;font-size:clamp(2.4rem,8vw,5.8rem);line-height:.9;letter-spacing:-.04em}.auth-story p{max-width:700px;color:#b8ad96}.ironvale-auth-notes{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.ironvale-auth-notes span{padding:8px 10px;border:1px solid #6b5635;background:#15130e;color:#d5c8ad;font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
.rc-button.primary{background:#76572e!important;border-color:#b88a4c!important;color:#fff8e8!important}.rc-button{border-color:#6c5737!important}.drawer-group-label,.eyebrow{color:#b48a4a!important}.game-drawer{background:#17140ef7!important;border-left-color:#5d4a2e!important}.mobile-nav{background:#15130ef5!important;border-top-color:#57472e!important}.mobile-nav a.active{color:#d5b477!important}
.ironvale-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:16px;padding:22px;border:1px solid #5f4c30;background:linear-gradient(135deg,#2a2419,#18150f);box-shadow:0 18px 60px #0005}.ironvale-hero h2{margin:4px 0 5px;font:800 clamp(1.8rem,5vw,3.2rem)/1 Georgia,serif}.ironvale-hero p{margin:0;color:var(--ironvale-muted);max-width:760px}.ironvale-level{min-width:112px;padding:14px;border-left:1px solid #695434;text-align:right}.ironvale-level span,.ironvale-level small{display:block;color:var(--ironvale-muted);font-size:9px;font-weight:800;letter-spacing:.1em}.ironvale-level strong{display:block;font:800 2rem/1 Georgia,serif;margin:4px 0}
.ironvale-two-column,.ironvale-codex-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.ironvale-panel{padding:18px;border:1px solid #56452d;background:#1d1912e8}.ironvale-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.ironvale-stat-grid div,.ironvale-gear-list div{display:flex;justify-content:space-between;gap:12px;padding:11px;border:1px solid #413621;background:#14120d}.ironvale-stat-grid span,.ironvale-gear-list span{color:var(--ironvale-muted);font-size:11px}.ironvale-gear-list{display:grid;gap:7px;margin-top:12px}
.ironvale-item-grid,.ironvale-quest-list{display:grid;gap:10px}.ironvale-item{display:grid;grid-template-columns:58px 1fr auto;gap:13px;align-items:start;padding:14px;border:1px solid #54442c;background:#1d1912}.ironvale-item-mark{display:grid;place-items:center;width:58px;height:58px;border:1px solid #876a3c;background:#292216;font:900 16px Georgia,serif}.ironvale-item h3,.ironvale-quest h3{margin:4px 0 5px}.ironvale-item p,.ironvale-quest p,.ironvale-codex-row p{margin:0;color:#ad9f86;font-size:12px;line-height:1.45}.ironvale-item small,.ironvale-quest small{color:#887d6b}.ironvale-item>b{font-size:12px}
.ironvale-quest{display:grid;grid-template-columns:1fr minmax(110px,150px);gap:16px;padding:16px;border:1px solid #55442b;background:#1d1912}.ironvale-quest.locked{opacity:.58}.ironvale-quest.active{border-color:#8a6a37}.ironvale-quest.completed{border-color:#66714d}.ironvale-quest-reward{text-align:right;border-left:1px solid #493b26;padding-left:13px}.ironvale-quest-reward span,.ironvale-quest-reward small{display:block}.ironvale-quest-reward b{display:block;margin:4px 0 2px}.ironvale-quest-reward button{margin-top:10px;width:100%}
.ironvale-codex-row{padding:11px 0;border-bottom:1px solid #3d3322}.ironvale-codex-row:last-child{border-bottom:0}.ironvale-codex-row>div{display:flex;justify-content:space-between;gap:12px}.ironvale-codex-row small{color:#8f836f;text-transform:uppercase;font-size:8px;letter-spacing:.08em}.ironvale-codex-row p{margin-top:5px}
body.world3d-game-mode .topbar,body.world3d-game-mode #status,body.world3d-game-mode #hud-shell,body.world3d-game-mode #mobile-nav{display:none!important}
@media(max-width:760px){.ironvale-two-column,.ironvale-codex-grid{grid-template-columns:1fr}.ironvale-hero{align-items:flex-start}.ironvale-level{min-width:82px}.ironvale-quest{grid-template-columns:1fr}.ironvale-quest-reward{text-align:left;border-left:0;border-top:1px solid #493b26;padding:10px 0 0}.auth-story h1{font-size:3.2rem}}
'''
write('public/ironvale.css', ironvale_css)

# Rebrand the active Rift Engine world shell without renaming engine APIs.
foundation = read('public/downtown3d-foundation.js')
foundation_replacements = [
    ("const ACTIVE_BLOCK_STORAGE_KEY = 'riftcity:h1.57:active-city-block:v1';", "const ACTIVE_BLOCK_STORAGE_KEY = 'ironvale:world:active-block:v1';"),
    ('aria-label="RiftCity JSON city block importer"', 'aria-label="Ironvale Rift Engine world"'),
    ('aria-label="Imported RiftCity block preview"', 'aria-label="Ironvale world preview"'),
    ('RIFT BLOCK ENGINE · H1.75 THIRD-PERSON · STAIR ALIGNMENT', 'IRONVALE · RIFT ENGINE WORLD FOUNDATION'),
    ('LOADING COMMERCE BLOCK 01…', 'LOADING IRONVALE FOUNDATION…'),
    ('Third-person camera collision keeps the view inside playable space; roofs, walls and upper floors always render normally with no camera-driven cutaway behavior.', 'The Ironvale world foundation is live on Rift Engine: native sections, third-person movement, build tools and streaming-ready terrain.'),
    ('>CITY OVERVIEW<', '>WORLD OVERVIEW<'),
    ('aria-label="Choose a RiftCity city block JSON file"', 'aria-label="Choose a Rift Engine world block JSON file"'),
    ('aria-label="RiftCity reticle build tools"', 'aria-label="Ironvale reticle build tools"'),
    ('<span>RIFTCITY BUILD MODE</span><strong>OVERHEAD CITY BUILDER</strong>', '<span>IRONVALE BUILD MODE</span><strong>RIFT WORLD BUILDER</strong>'),
    ("console.error('RiftCity H1.75 third-person block world failed to start'", "console.error('Ironvale Rift Engine world failed to start'"),
    ("let sourceLabel = 'DEFAULT BLOCK 001';", "let sourceLabel = 'IRONVALE FOUNDATION';")
]
for old, new in foundation_replacements:
    if old in foundation: foundation = foundation.replace(old, new)
write('public/downtown3d-foundation.js', foundation)

menu = read('public/rift-game-menu.js')
menu = menu.replace("const DEV_MODE_KEY = 'riftcity:dev-mode:v1';", "const DEV_MODE_KEY = 'ironvale:dev-mode:v1';")
menu = menu.replace("const VALIDATOR_DEBUG_KEY = 'riftcity:validator-debug:v1';", "const VALIDATOR_DEBUG_KEY = 'ironvale:validator-debug:v1';")
menu = menu.replace('window.RiftCityNetwork?.status', 'window.IronvaleNetwork?.status')
menu = menu.replace('Network telemetry becomes available after the RiftCity API bridge loads.', 'Network telemetry becomes available after the Ironvale API bridge loads.')
menu = menu.replace('aria-label="RiftCity game menu"', 'aria-label="Ironvale game menu"')
menu = menu.replace('<div><span>RIFTCITY</span><strong>Game Menu</strong></div>', '<div><span>IRONVALE</span><strong>Game Menu</strong></div>')
menu = menu.replace('>CITY OVERVIEW<', '>WORLD OVERVIEW<')
menu = menu.replace('window.RiftCityGameMenu = Object.freeze({', 'window.IronvaleGameMenu = Object.freeze({')
menu = menu.replace("version: 'H1.87-cloudflare-efficiency'", "version: 'ironvale-foundation-v1'")
write('public/rift-game-menu.js', menu)

# Light rebrand across developer/admin HTML surfaces while keeping Rift Engine API identifiers intact.
for rel in ['public/admin-logs.html','public/admin-logs.js','public/inspection.html','public/building-inspection.html','public/building-3d-inspection.html','public/builder/index.html']:
    path = ROOT / rel
    if path.exists():
        src = path.read_text(encoding='utf-8').replace('RiftCity', 'Ironvale').replace('RIFTCITY', 'IRONVALE')
        path.write_text(src, encoding='utf-8')

readme = r'''# Ironvale

Ironvale is a grounded medieval online RPG built on the **Rift Engine**. The repository began as RiftCity; the complete pre-conversion game is preserved on the `riftcity-backup-2026-08-31` branch.

## Current foundation

The active game path is now Ironvale-first: a persistent character, a world/codex model, quest journal, medieval inventory/equipment, starter NPCs/factions/creatures, and the Blackstone Road story foundation. The playable 3D world continues to use the proven Rift Engine renderer, Native Core v3 WebAssembly, RiftSection streaming/storage, collision/raycasting, third-person camera, mobile controls, world/building authoring and Cloudflare-efficient networking.

## Engine vs game naming

`rift-*` modules, RiftSection, Rift Native and Rift Engine terminology are intentional engine names. Game-facing UI, PWA metadata, account/session namespace and new persistence/API domains use **Ironvale**.

The internal `riftcity-city-block` / `riftcity-world-index` JSON format strings remain compatibility identifiers for the current Rift authoring format. They are not Ironvale branding and can be version-migrated later without breaking existing authored fixtures.

## Cloudflare

`wrangler.toml` currently preserves the existing Worker/D1/R2 resource names so the proven deployment bindings are not accidentally disconnected during the game conversion. Those infrastructure resource names can be migrated separately after the Ironvale runtime is stable.

## Active routes

- `#world` — Rift Engine 3D world
- `#character` — persistent Ironvale character
- `#journal` — quest chains
- `#inventory` — gear and supplies
- `#codex` — regions, settlements, factions, NPCs, creatures and dungeons

## Development

```bash
npm run build
npm run dev
```

The build runs the Ironvale foundation verifier plus the existing Rift Engine/native/WASM/world/building/camera regression suite.
'''
write('README.md', readme)

verifier = r'''import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const exists = path => fs.existsSync(path);
const fail = message => { console.error(`[ironvale-foundation] FAIL · ${message}`); process.exit(1); };
const expect = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const index = read('public/index.html');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const app = read('public/app.js');
const router = read('public/ui/router.js');
const server = read('src/index.js');
const schema = read('schema.sql');
const content = read('src/ironvale/content.js');
const api = read('src/ironvale/api.js');
const worldShell = read('public/downtown3d-foundation.js');

expect(pkg.name === 'ironvale-medieval-mmo', 'package must identify Ironvale');
expect(pkg.scripts?.build?.includes('verify:ironvale'), 'build must run Ironvale verifier');
expect(index.includes('IRONVALE') && !index.includes('RiftCity'), 'active HTML must be Ironvale branded');
expect(manifest.name === 'Ironvale' && manifest.start_url === '/#world' && manifest.orientation === 'any', 'PWA must launch Ironvale world in any orientation');
expect(manifest.icons?.[0]?.src === '/ironvale-icon.svg' && exists('public/ironvale-icon.svg'), 'Ironvale icon must be installed');
expect(!exists('public/riftcity-icon.svg'), 'old RiftCity icon must be removed');
expect(router.includes("'world'") && !router.includes("casino:'casino'") && !router.includes("police:'law'"), 'router must expose the new RPG surface');
expect(app.includes('renderJournal') && app.includes('renderCodex') && !app.includes('renderCrimes') && !app.includes('renderService'), 'active app must route to Ironvale views only');
for (const path of ['public/views/crimes.js','public/views/service.js','public/views/wiki.js','public/views/services','src/plugins','src/services']) expect(!exists(path), `${path} must be removed from active source`);
for (const path of ['native/rift-core.cpp','public/rift-engine.js','public/rift-player.js','public/rift-wasm-core.js','public/rift-block-section.js','public/rift-building-pipeline.js']) expect(exists(path), `${path} Rift Engine foundation must remain`);
expect(exists('public/rift-world-blocks') && exists('public/rift-buildings'), 'game asset namespaces must use Rift Engine names');
expect(!exists('public/riftcity-blocks') && !exists('public/riftcity-buildings'), 'RiftCity-named asset directories must be gone');
expect(exists('public/rift-world-blocks/ironvale-foundation-001.json'), 'Ironvale foundation world must be the default block');
expect(server.includes("handleIronvaleApi") && server.includes("ironvale_session"), 'Worker must use Ironvale API and session namespace');
expect(!server.includes("url.pathname === '/api/crimes'") && !server.includes("url.pathname.startsWith('/api/services')") && !server.includes("url.pathname === '/api/world/travel'"), 'modern RiftCity gameplay routes must be removed');
expect(server.includes("url.pathname.startsWith('/api/world/blocks/')"), 'Rift authoring block endpoint must remain');
for (const table of ['ironvale_characters','ironvale_inventory','ironvale_equipment','ironvale_quest_progress','ironvale_world_flags']) expect(schema.includes(table), `schema missing ${table}`);
for (const legacy of ['player_crime_progress','crime_history','player_casino','player_law','player_bank_accounts']) expect(!schema.includes(legacy), `fresh schema still contains ${legacy}`);
for (const token of ['IRONVALE_QUESTS','IRONVALE_NPCS','IRONVALE_FACTIONS','IRONVALE_CREATURES','IRONVALE_DUNGEONS','blackstone-barrow','brackenford']) expect(content.includes(token), `content foundation missing ${token}`);
expect(api.includes("/api/ironvale/bootstrap") && api.includes("/api/ironvale/sync") && api.includes("/api/ironvale/quests/accept"), 'Ironvale API foundation incomplete');
expect(worldShell.includes('IRONVALE · RIFT ENGINE WORLD FOUNDATION') && worldShell.includes("ironvale:world:active-block:v1"), '3D world shell must be Ironvale-branded');

console.log('[ironvale-foundation] PASS · Ironvale owns the active MMO/RPG surface while Rift Engine, Native Core v3, authoring and Cloudflare foundations remain intact.');
'''
write('scripts/check-ironvale-foundation.js', verifier)

print('Ironvale frontend foundation applied.')
