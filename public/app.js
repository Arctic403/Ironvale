import './rift-world-composition-runtime.js';
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

let routeQueued = false;
function scheduleRoute() {
  if (routeQueued) return;
  routeQueued = true;
  queueMicrotask(() => {
    routeQueued = false;
    route().catch(error => {
      console.error('Ironvale route dispatch failed', error);
      const root = $('#game-root');
      if (root) root.innerHTML = `<div class="rc-error"><strong>Navigation failed</strong><p>${escapeHtml(error?.message || 'Unknown navigation error')}</p><button class="rc-button" data-route="world">Return to World</button></div>`;
    });
  });
}

window.addEventListener('hashchange', scheduleRoute);
window.addEventListener('popstate', scheduleRoute);
window.addEventListener('ironvale:navigate', scheduleRoute);

let focusSessionRefreshPending = false;
window.addEventListener('focus', async () => {
  if (!state.authenticated || focusSessionRefreshPending) return;
  focusSessionRefreshPending = true;
  try { await refreshSession({ navigate: false }); }
  catch (error) { console.warn('Ironvale focus session refresh failed', error); }
  finally { focusSessionRefreshPending = false; }
});

async function boot() {
  const authenticated = await refreshSession();
  if (!authenticated) return;
  if (!location.hash) { go('world'); return; }
  await route();
}

function destroyWorldSafely() {
  try { destroyCity2D(); }
  catch (error) {
    // World teardown must never be allowed to abort SPA navigation. The native
    // engine cleanup is best-effort here; the next world mount creates a fresh
    // foundation instance.
    console.warn('Ironvale world teardown failed during navigation', error);
    document.body.classList.remove('world3d-game-mode');
  }
}

function createRouteMount(root, routeName) {
  const mount = document.createElement('div');
  mount.className = 'ironvale-route-mount';
  mount.dataset.routeMount = routeName;
  mount.innerHTML = '<div class="rc-loading"><span></span><strong>Loading Ironvale…</strong></div>';
  root.replaceChildren(mount);
  return mount;
}

async function route() {
  const request = ++state.activeRequest;
  const parsed = parseRoute();
  state.route = parsed;

  destroyWorldSafely();

  if (!state.authenticated) {
    const ok = await refreshSession({ navigate: false });
    if (!ok || request !== state.activeRequest) return;
  }

  const root = $('#game-root');
  if (!root) return;
  const mount = createRouteMount(root, parsed.name);
  updateActiveNav(parsed.name);
  const isCurrent = () => request === state.activeRequest && state.route?.name === parsed.name && mount.isConnected;

  try {
    if (parsed.name === 'world') {
      setPageTitle('World', 'THE IRONVALE MARCHES');
      await renderCity(mount);
    } else if (parsed.name === 'character') {
      setPageTitle('Character', 'TRAVELER');
      await renderCharacter(mount);
    } else if (parsed.name === 'journal') {
      setPageTitle('Journal', 'QUESTS');
      await renderJournal(mount);
    } else if (parsed.name === 'inventory') {
      setPageTitle('Inventory', 'GEAR & SUPPLIES');
      await renderInventory(mount);
    } else if (parsed.name === 'codex') {
      setPageTitle('Codex', 'WORLD KNOWLEDGE');
      await renderCodex(mount);
    } else {
      go('world');
      return;
    }
  } catch (error) {
    // A slow request from a route that has already been replaced must not paint
    // over the current route or report a misleading page error.
    if (!isCurrent()) return;
    console.error(error);
    mount.innerHTML = `<div class="rc-error"><strong>Page failed to load</strong><p>${escapeHtml(error?.message || 'Unknown frontend error')}</p><button class="rc-button" data-route="world">Return to World</button></div>`;
    showToast('An Ironvale page failed to render.', true);
  }

  if (!isCurrent()) return;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

boot();
