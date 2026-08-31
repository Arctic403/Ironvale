import './rift-world-composition-runtime.js';
import { $ } from './ui/helpers.js';
import { state } from './ui/state.js';
import { go } from './ui/router.js';
import { initShell, refreshSession, submitAuth } from './ui/shell.js';
import { renderCity, destroyCity2D } from './views/city.js';
import { initPwaSupport } from './pwa.js';

initShell(); initPwaSupport();
$('#login-form').addEventListener('submit', event => { event.preventDefault(); submitAuth('/api/auth/login', event.currentTarget); });
$('#register-form').addEventListener('submit', event => { event.preventDefault(); submitAuth('/api/auth/register', event.currentTarget); });

let routeQueued = false;
function scheduleRoute() {
  if (routeQueued) return;
  routeQueued = true;
  queueMicrotask(() => { routeQueued = false; route().catch(error => console.error('Ironvale game mount failed', error)); });
}
window.addEventListener('hashchange', scheduleRoute);
window.addEventListener('popstate', scheduleRoute);
window.addEventListener('ironvale:navigate', scheduleRoute);

let focusRefreshPending = false;
window.addEventListener('focus', async () => {
  if (!state.authenticated || focusRefreshPending) return;
  focusRefreshPending = true;
  try { await refreshSession({ navigate: false }); } catch (error) { console.warn('Ironvale session refresh failed', error); }
  finally { focusRefreshPending = false; }
});

async function boot() {
  const authenticated = await refreshSession();
  if (!authenticated) return;
  if (location.hash !== '#world') { history.replaceState(null, '', '#world'); }
  await route();
}

function destroyWorldSafely() {
  try { destroyCity2D(); } catch (error) { console.warn('Ironvale world teardown failed during remount', error); }
}

async function route() {
  const request = ++state.activeRequest;
  if (!state.authenticated) {
    const ok = await refreshSession({ navigate: false });
    if (!ok || request !== state.activeRequest) return;
  }
  if (location.hash !== '#world') { history.replaceState(null, '', '#world'); }
  state.route = { name: 'world' };
  const root = $('#game-root');
  if (!root) return;
  destroyWorldSafely();
  const mount = document.createElement('div');
  mount.className = 'ironvale-route-mount ironvale-world-mount';
  root.replaceChildren(mount);
  await renderCity(mount);
}

boot();
