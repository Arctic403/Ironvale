import { api } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml, panel, empty } from '../ui/helpers.js';
import { serviceRoute, go } from '../ui/router.js';
import { renderPlayerHud, showToast } from '../ui/shell.js';

const ROUTE_BY_TYPE={bank:'bank',education:'education',gym:'gym',jobs:'jobs',properties:'properties',shop:'shop',status:'status',casino:'casino',travel:'travel',production:'production',market:'market',auction:'auction'};

export async function renderCity(root) {
  const result=await api('/api/world');
  if (!result.ok) {
    root.innerHTML=`<div class="rc-error"><strong>Could not load RiftCity</strong><p>${escapeHtml(result.error||'World service unavailable')}</p></div>`;
    return;
  }
  state.world=result.world;
  state.location=result.world?.current||state.location;
  const categories=result.world?.categories||[], locations=result.world?.locations||[];
  root.innerHTML=`
    <section class="city-hero">
      <div><span class="eyebrow">RIFTCITY / RC-01</span><h2>City Network</h2><p>Select a destination. Server travel state and location requirements remain authoritative.</p></div>
      <div class="current-location"><span>CURRENT LOCATION</span><strong>${escapeHtml(state.location?.locationName||'RiftCity')}</strong><small>${escapeHtml(state.location?.categoryName||'')}</small></div>
    </section>
    <section class="city-map-shell">
      <div class="city-map-grid" aria-label="RiftCity district map">
        ${categories.map((cat,index)=>`<button class="district-block district-${index+1}" data-city-category="${escapeHtml(cat.id)}"><span>${escapeHtml(cat.code)}</span><strong>${escapeHtml(cat.name)}</strong><small>${locations.filter(l=>l.categoryId===cat.id).length} locations</small></button>`).join('')}
      </div>
    </section>
    <div class="city-directory">
      ${categories.map(cat=>{
        const rows=locations.filter(l=>l.categoryId===cat.id);
        return `<section class="city-category" data-category-section="${escapeHtml(cat.id)}">
          <header><div><span class="category-code">${escapeHtml(cat.code)}</span><h3>${escapeHtml(cat.name)}</h3></div><small>${rows.length}</small></header>
          <div class="location-grid">${rows.map(location=>locationCard(location,result.world.current)).join('')}</div>
        </section>`;
      }).join('')}
    </div>`;
  root.querySelectorAll('[data-city-category]').forEach(btn=>btn.addEventListener('click',()=>{
    root.querySelector(`[data-category-section="${CSS.escape(btn.dataset.cityCategory)}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  root.querySelectorAll('[data-location-id]').forEach(btn=>btn.addEventListener('click',()=>openLocation(btn.dataset.locationId)));
}

function locationCard(location,current) {
  const here=current?.locationId===location.id;
  return `<button class="location-card ${here?'current':''}" data-location-id="${escapeHtml(location.id)}">
    <span class="location-card-top"><b>${escapeHtml(location.code)}</b><em>${here?'HERE':escapeHtml(location.status)}</em></span>
    <strong>${escapeHtml(location.name)}</strong>
    <small>${escapeHtml(location.type)}</small>
    <p>${escapeHtml(location.shortDescription)}</p>
  </button>`;
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
    <a class="back-link" href="#city" data-route="city">← Return to City</a>
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
    location.hash=`#${btn.dataset.serviceRoute}${btn.dataset.serviceQuery||''}`;
  }));
}
