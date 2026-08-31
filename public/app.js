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
