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
        <button id="world3d-editor-button" class="world3d-hud-button world3d-editor-toggle" type="button">DEV EDITOR</button>
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
      <aside id="world3d-editor" class="world3d-editor" aria-label="DEV world editor">
        <header>
          <div><span class="eyebrow">PUBLIC DEV TOOL</span><strong>Full World Editor</strong></div>
          <button id="world3d-editor-close" type="button" aria-label="Close editor">×</button>
        </header>
        <div class="world3d-editor-scroll">
          <p class="world3d-editor-note">Tap/click roads, sidewalks, intersections, filler buildings, trees, lights, cars, props or RiftCity locations. Mouse/keyboard gets gizmos + shortcuts; every action still has touch controls.</p>

          <section class="world3d-editor-card">
            <span class="editor-kicker">SELECTED</span>
            <strong data-editor-selected>Nothing selected</strong>
            <small data-editor-type>Tap anything in the city.</small>
            <div class="world3d-editor-readout world3d-editor-readout-xyz">
              <div><span>X</span><b data-editor-x>—</b></div>
              <div><span>Y</span><b data-editor-y>—</b></div>
              <div><span>Z</span><b data-editor-z>—</b></div>
              <div><span>ROT Y</span><b data-editor-rot>—</b></div>
              <div class="wide"><span>SCALE X / Y / Z</span><b data-editor-scale>—</b></div>
            </div>
          </section>

          <section class="world3d-editor-card">
            <span class="editor-kicker">TRANSFORM</span>
            <div class="world3d-editor-modebar">
              <button type="button" data-editor-mode="move">MOVE <kbd>W</kbd></button>
              <button type="button" data-editor-mode="rotate">ROTATE <kbd>E</kbd></button>
              <button type="button" data-editor-mode="scale">SCALE <kbd>R</kbd></button>
            </div>
            <div class="world3d-editor-row">
              <label>SNAP / NUDGE
                <select data-editor-step>
                  <option value="0.25">0.25m</option>
                  <option value="0.5">0.5m</option>
                  <option value="1" selected>1m</option>
                  <option value="5">5m</option>
                </select>
              </label>
              <button type="button" data-editor-grid>CHUNK GRID</button>
            </div>
            <div class="world3d-nudge-grid">
              <span></span><button type="button" data-editor-nudge="z:-">Z−</button><span></span>
              <button type="button" data-editor-nudge="x:-">X−</button><span class="world3d-nudge-center">MOVE</span><button type="button" data-editor-nudge="x:+">X+</button>
              <span></span><button type="button" data-editor-nudge="z:+">Z+</button><span></span>
            </div>
            <div class="world3d-editor-button-row">
              <button type="button" data-editor-nudge="y:+">Y +</button>
              <button type="button" data-editor-nudge="y:-">Y −</button>
              <button type="button" data-editor-rotate="-15">↶ 15°</button>
              <button type="button" data-editor-rotate="15">15° ↷</button>
            </div>
            <div class="world3d-editor-button-row">
              <button type="button" data-editor-scale="x:-0.1">WIDTH −</button>
              <button type="button" data-editor-scale="x:0.1">WIDTH +</button>
              <button type="button" data-editor-scale="y:-0.1">HEIGHT −</button>
              <button type="button" data-editor-scale="y:0.1">HEIGHT +</button>
              <button type="button" data-editor-scale="z:-0.1">LENGTH −</button>
              <button type="button" data-editor-scale="z:0.1">LENGTH +</button>
            </div>
          </section>

          <section class="world3d-editor-card">
            <span class="editor-kicker">PLACE NEW</span>
            <div class="world3d-editor-row">
              <select data-editor-place-type>
                <option value="road">Road segment</option>
                <option value="sidewalk">Sidewalk</option>
                <option value="intersection">Intersection</option>
                <option value="building">Building</option>
                <option value="tree">Tree</option>
                <option value="light">Street light</option>
                <option value="parked-car">Parked car</option>
                <option value="prop">Street prop</option>
              </select>
              <button type="button" class="primary" data-editor-add>ADD HERE</button>
            </div>
          </section>

          <section class="world3d-editor-card">
            <div class="world3d-editor-button-row">
              <button type="button" data-editor-duplicate>DUPLICATE <kbd>⌘D</kbd></button>
              <button type="button" data-editor-reset>RESET SELECTED</button>
              <button type="button" data-editor-undo>UNDO <kbd>⌘Z</kbd></button>
              <button type="button" data-editor-redo>REDO</button>
              <button type="button" class="danger" data-editor-delete>DELETE</button>
            </div>
            <button type="button" class="world3d-editor-export" data-editor-export>EXPORT CITY PATCH</button>
            <button type="button" class="world3d-editor-reset-draft" data-editor-clear-draft>RESET LOCAL DRAFT</button>
            <textarea data-editor-json hidden aria-label="Exported patch JSON"></textarea>
            <small data-editor-status>Full editor loading…</small>
          </section>

          <section class="world3d-editor-shortcuts">
            <strong>Keyboard</strong>
            <span>W/E/R transform · arrows X/Z · PageUp/PageDown Y · Shift = 5× nudge · Delete = remove · Ctrl/Cmd+Z undo · Ctrl/Cmd+D duplicate</span>
          </section>
        </div>
      </aside>
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
