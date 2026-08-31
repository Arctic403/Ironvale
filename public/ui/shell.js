import { api } from './api.js';
import { state, setCharacter, clearState } from './state.js';
import { $, $$, escapeHtml } from './helpers.js';
import { go } from './router.js';

const PRIMARY_NAV = [
  ['world','World','⌂'], ['character','Character','♙'], ['journal','Journal','▧'], ['inventory','Inventory','▤'], ['codex','Codex','◇']
];
let syncTimer = null;
let syncPending = false;
let syncAfterMutation = null;

function setDrawerOpen(open) {
  const drawer = $('#game-drawer');
  const button = $('#menu-button');
  const nextOpen = Boolean(open);
  drawer?.classList.toggle('open', nextOpen);
  drawer?.setAttribute('aria-hidden', String(!nextOpen));
  button?.setAttribute('aria-expanded', String(nextOpen));
  document.body.classList.toggle('drawer-open', nextOpen);
}

export function initShell() {
  // Never inherit a visually open drawer from cached/restored mobile Safari state.
  setDrawerOpen(false);
  $('#menu-button')?.addEventListener('click', () => setDrawerOpen(!$('#game-drawer')?.classList.contains('open')));
  $('#drawer-close')?.addEventListener('click', () => setDrawerOpen(false));
  $('#drawer-backdrop')?.addEventListener('click', () => setDrawerOpen(false));
  $('#logout-btn')?.addEventListener('click', logout);
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-route]');
    if (!nav) return;
    event.preventDefault(); setDrawerOpen(false); go(nav.dataset.route);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setDrawerOpen(false); });
  window.addEventListener('pageshow', () => setDrawerOpen(false));
  window.addEventListener('orientationchange', () => setDrawerOpen(false));
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
    clearState(); setDrawerOpen(false); $('#auth-grid')?.classList.remove('hidden'); $('#game-root')?.classList.add('hidden'); $('#hud-shell')?.classList.add('hidden'); $('#mobile-nav')?.classList.add('hidden');
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
  if (result.ok) { clearState(); setDrawerOpen(false); stopSync(); showToast('Logged out.'); await refreshSession(); }
}
export async function submitAuth(path, form) {
  const data = new FormData(form);
  const result = await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
  if (!result.ok) return showToast(result.error || 'Authentication failed', true);
  showToast(path.endsWith('register') ? 'Account created.' : 'Welcome back.');
  await refreshSession(); go('world');
}