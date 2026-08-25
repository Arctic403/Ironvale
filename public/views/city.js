import { api } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml, panel, empty } from '../ui/helpers.js';
import { go } from '../ui/router.js';
import { showToast } from '../ui/shell.js';
import { mountCity3D, renderWorldDirectory } from '../game3d.js';

const ROUTE_BY_TYPE={bank:'bank',education:'education',gym:'gym',jobs:'jobs',properties:'properties',shop:'shop',status:'status',casino:'casino',travel:'travel',production:'production',market:'market',auction:'auction',law:'law',nightclub:'nightclub','city-activities':'city-activities'};

export async function renderCity(root) {
  const result=await api('/api/world');
  if (!result.ok) {
    root.innerHTML=`<div class="rc-error"><strong>Could not load RiftCity</strong><p>${escapeHtml(result.error||'World service unavailable')}</p></div>`;
    return;
  }
  state.world=result.world;
  state.location=result.world?.current||state.location;
  const current=state.location?.locationName||'RiftCity';
  root.innerHTML=`
    <section class="world3d-shell" aria-label="Playable 3D RiftCity">
      <canvas id="riftcity-3d-canvas" tabindex="0"></canvas>
      <div class="world3d-vignette"></div>
      <div class="world3d-top-left">
        <span class="eyebrow">RIFTCITY / LIVE WORLD</span>
        <strong id="world3d-status">Loading 3D city…</strong>
        <small>WASD / arrows to move · Shift to run · drag to orbit · E to enter</small>
      </div>
      <div class="world3d-top-right">
        <button id="world3d-fullscreen-button" class="world3d-hud-button" type="button">FULLSCREEN</button>
        <button id="world3d-directory-button" class="world3d-hud-button" type="button">CITY DIRECTORY</button>
      </div>
      <div id="world3d-prompt" class="world3d-prompt">
        <span>NEARBY</span><strong id="world3d-location">Location</strong>
        <button id="world3d-interact">ENTER <kbd>E</kbd></button>
      </div>
      <div class="world3d-current"><span>CURRENT</span><strong>${escapeHtml(current)}</strong></div>
      <div class="world3d-touch" aria-label="Touch game controls">
        <div id="world3d-joystick" class="world3d-joystick" role="group" aria-label="Movement joystick">
          <div class="world3d-joystick-ring">
            <div id="world3d-joystick-knob" class="world3d-joystick-knob"></div>
          </div>
          <span>MOVE</span>
        </div>
        <div class="world3d-action-pad">
          <button id="world3d-touch-interact" class="world3d-action world3d-action-enter" type="button">ENTER</button>
          <button class="world3d-action world3d-action-run" data-move="run" type="button">RUN</button>
        </div>
      </div>
      <div id="world3d-rotate" class="world3d-rotate" aria-live="polite">
        <div class="world3d-phone-icon">▯</div>
        <strong>Rotate sideways</strong>
        <span>RiftCity plays best in landscape.</span>
      </div>
      <aside id="world3d-directory" class="world3d-directory">
        <header><div><span class="eyebrow">FAST NAV / DEV</span><strong>City Directory</strong></div><button id="world3d-directory-close">×</button></header>
        <p>Dev teleport moves your character near a location. Walk onto its marker and enter normally to sync server travel.</p>
        <div>${renderWorldDirectory(result.world)}</div>
      </aside>
    </section>`;
  mountCity3D({root,world:result.world,onEnterLocation:openLocation});
}

async function openLocation(id) {
  const result=await api('/api/world/travel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locationId:id})});
  if (!result.ok) return showToast(result.error||'Could not enter location',true);
  state.location=result.current;
  if (state.world) state.world.current=result.current;
  go(`city/place/${encodeURIComponent(id)}`);
}

export async function renderLocation(root,id) {
  const result=await api(`/api/world/locations/${encodeURIComponent(id)}`);
  if (!result.ok) {
    root.innerHTML=`<div class="rc-error"><strong>Location unavailable</strong><p>${escapeHtml(result.error||'Could not load location')}</p><a class="rc-button" href="#city" data-route="city">Return to City</a></div>`;
    return;
  }
  const location=result.location, category=result.category;
  state.selectedLocation=location;
  state.location=result.current||state.location;
  const actions=location.actions||[];
  root.innerHTML=`
    <a class="back-link" href="#city" data-route="city">← Return to 3D City</a>
    <section class="location-hero">
      <div><span class="location-code">${escapeHtml(location.code)}</span><span class="eyebrow">${escapeHtml(category?.name||location.categoryId)}</span><h2>${escapeHtml(location.name)}</h2><p>${escapeHtml(location.description)}</p></div>
      <div class="location-status-box"><span>STATUS</span><strong>${escapeHtml(location.status)}</strong><small>${escapeHtml(location.type)}</small></div>
    </section>
    <div class="tag-row">${(location.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div>
    ${panel('Available Services',actions.length?`<div class="service-launch-grid">${actions.map(action=>{
      const route=ROUTE_BY_TYPE[action.type]||ROUTE_BY_TYPE[action.id]||null;
      const shopQuery=action.type==='shop'?`?location=${encodeURIComponent(location.id)}`:'';
      return `<button class="service-launch" data-service-route="${route||''}" data-service-query="${shopQuery}" ${!action.enabled?'disabled':''}>
        <span><strong>${escapeHtml(action.label)}</strong><small>${escapeHtml(action.note||'Service')}</small></span><b>${action.enabled?(route?'OPEN':'INFO'):'LOCKED'}</b>
      </button>`;
    }).join('')}</div>`:empty('No services installed'),{eyebrow:'LOCATION MODULES'})}`;
  root.querySelectorAll('[data-service-route]').forEach(btn=>btn.addEventListener('click',()=>{
    if (!btn.dataset.serviceRoute) return showToast('This service is not installed yet.');
    window.location.hash=`#${btn.dataset.serviceRoute}${btn.dataset.serviceQuery||''}`;
  }));
}
