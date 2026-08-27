import { $, escapeHtml } from './ui/helpers.js';
import { api } from './ui/api.js';
import { state } from './ui/state.js';
import { parseRoute, go } from './ui/router.js';
import { initShell, refreshSession, submitAuth, setPageTitle, updateActiveNav, showToast } from './ui/shell.js';
import { renderCharacter } from './views/character.js';
import { renderCity, renderLocation, destroyCity2D } from './views/city.js';
import { renderCrimes } from './views/crimes.js';
import { renderInventory } from './views/inventory.js';
import { renderService } from './views/service.js';
import { renderWiki } from './views/wiki.js';
import { initPwaSupport } from './pwa.js';

initShell();
initPwaSupport();

$('#login-form').addEventListener('submit', event=>{event.preventDefault();submitAuth('/api/auth/login',event.currentTarget);});
$('#register-form').addEventListener('submit', event=>{event.preventDefault();submitAuth('/api/auth/register',event.currentTarget);});
window.addEventListener('hashchange', route);
let focusSessionRefreshPending=false;
window.addEventListener('focus', async ()=>{
  if (!state.authenticated || focusSessionRefreshPending) return;
  focusSessionRefreshPending=true;
  try {
    // Do not rebuild the active route on focus. Native file pickers blur/refocus
    // the page; rerendering here used to destroy the City JSON import input
    // before Safari/iOS delivered its change event, making Block 001 appear
    // permanently hardcoded. Session/HUD state can refresh without replacing
    // the current renderer/UI tree.
    await refreshSession({navigate:false});
  } catch (error) {
    console.warn('RiftCity focus session refresh failed', error);
  } finally {
    focusSessionRefreshPending=false;
  }
});

async function boot() {
  const authed=await refreshSession();
  if (!location.hash) go(authed?'character':'character');
  else await route();
}

async function route() {
  destroyCity2D();
  const request=++state.activeRequest;
  const parsed=parseRoute();
  state.route=parsed;
  if (!state.authenticated) {
    const ok=await refreshSession({navigate:false});
    if (!ok) return;
  }
  const root=$('#game-root');
  root.innerHTML='<div class="rc-loading"><span></span><strong>Loading RiftCity…</strong></div>';
  updateActiveNav(parsed.name==='service'?parsed.params.service:parsed.name);
  try {
    if (parsed.name==='character') {
      setPageTitle('Character','PLAYER CORE');
      await renderCharacter(root);
    } else if (parsed.name==='city') {
      setPageTitle('City','WORLD NETWORK');
      await renderCity(root);
    } else if (parsed.name==='location') {
      setPageTitle('Location','CITY LOCATION');
      await renderLocation(root,parsed.params.id);
    } else if (parsed.name==='crimes') {
      setPageTitle('Crimes','UNDERGROUND');
      await renderCrimes(root);
    } else if (parsed.name==='inventory') {
      setPageTitle('Inventory','PLAYER STORAGE');
      await renderInventory(root);
    } else if (parsed.name==='wiki') {
      setPageTitle('Field Manual','RIFTCITY WIKI');
      await renderWiki(root);
    } else {
      const service=parsed.name==='service'?parsed.params.service:parsed.name;
      await renderService(root,service,parsed.query);
    }
  } catch (error) {
    console.error(error);
    root.innerHTML=`<div class="rc-error"><strong>Page failed to load</strong><p>${escapeHtml(error?.message||'Unknown frontend error')}</p><button class="rc-button" data-route="city">Return to City</button></div>`;
    showToast('A frontend page failed to render.',true);
  }
  if (request!==state.activeRequest) return;
  window.scrollTo({top:0,behavior:'instant'});
}

boot();
