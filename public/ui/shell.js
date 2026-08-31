import { api } from './api.js';
import { state, setPlayer, clearState } from './state.js';
import { $, $$, escapeHtml, money, progress, duration, timeUntil } from './helpers.js';
import { go } from './router.js';

const PRIMARY_NAV = [
  ['character','Character','▦'],
  ['city','City','⌂'],
  ['crimes','Crimes','◇'],
  ['combat','Combat','⚔'],
  ['inventory','Inventory','▤']
];

const DRAWER_GROUPS = [
  ['Progression',[
    ['gym','Gym'],['jobs','Jobs'],['education','Education'],['missions','Missions'],
    ['achievements','Awards'],['challenges','Challenges'],['merits','Merits'],['factions','Factions'],['faction-shop','Faction Rewards'],['properties','Property'],['property-portfolio','Rental Portfolio']
  ]],
  ['Economy',[
    ['bank','Bank'],['market','Market'],['shop','Shops'],['auction','Black Market'],['production','Production']
  ]],
  ['World',[
    ['travel','Airport / Travel'],['casino','Casino'],['nightclub','Nightclub'],['law','Police / Heat'],['city-activities','City Activities'],['activity','Activity Feed'],['status','Hospital / Jail'],['events','World Events'],['wiki','Field Manual']
  ]]
];

const EFFECT_SYNC_FALLBACK_MS=120_000;
const EFFECT_SYNC_MIN_GAP_MS=5_000;
let effectTimer=null;
let effectRefreshTimer=null;
let effectSyncPending=null;
let lastEffectSyncAt=0;
let mutationSyncTimer=null;
let lastSessionRefreshAt=0;

export function initShell() {
  $('#menu-button')?.addEventListener('click',()=>$('#game-drawer')?.classList.toggle('open'));
  $('#drawer-close')?.addEventListener('click',()=>$('#game-drawer')?.classList.remove('open'));
  $('#drawer-backdrop')?.addEventListener('click',()=>$('#game-drawer')?.classList.remove('open'));
  $('#logout-btn')?.addEventListener('click',logout);
  document.addEventListener('click', event=>{
    const nav=event.target.closest('[data-route]');
    if (!nav) return;
    event.preventDefault();
    $('#game-drawer')?.classList.remove('open');
    go(nav.dataset.route);
  });
  renderDrawer();
  renderBottomNav();
}

function renderDrawer() {
  const root=$('#drawer-nav');
  if (!root) return;
  const normal=DRAWER_GROUPS.map(([label,items])=>`
    <section class="drawer-group">
      <span class="drawer-group-label">${escapeHtml(label)}</span>
      ${items.map(([route,name])=>`<a href="#${route}" data-route="${escapeHtml(route)}">${escapeHtml(name)}</a>`).join('')}
    </section>`).join('');
  const canDevelop=['admin','developer'].includes(state.user?.role);
  const developer=canDevelop?`
    <section class="drawer-group drawer-group-dev">
      <span class="drawer-group-label">DEVELOPER</span>
      <a href="/dev/block-editor" class="drawer-dev-link">
        <span>▧</span><strong>Block Editor</strong><small>Private authoring workspace</small>
      </a>
      <a href="/dev/ai-builder" class="drawer-dev-link">
        <span>◎</span><strong>AI Builder</strong><small>Rift Engine agent workspace</small>
      </a>
    </section>`:'';
  root.innerHTML=normal+developer;
}

function renderBottomNav() {
  const root=$('#mobile-nav');
  if (!root) return;
  root.innerHTML=PRIMARY_NAV.map(([route,name,icon])=>`
    <a href="#${route}" data-route="${route}" data-nav-route="${route}">
      <span>${icon}</span><small>${escapeHtml(name)}</small>
    </a>`).join('');
}

export function updateActiveNav(routeName) {
  $$('[data-nav-route]').forEach(el=>el.classList.toggle('active',el.dataset.navRoute===routeName));
  $$('[data-route]').forEach(el=>{
    if (el.closest('#drawer-nav')) el.classList.toggle('active',el.dataset.route===routeName);
  });
}

export function setPageTitle(title, eyebrow='RIFTCITY') {
  $('#page-title-text').textContent=title;
  $('#page-eyebrow').textContent=eyebrow;
}

export function setSessionStatus(text, error=false) {
  const el=$('#status');
  if (!el) return;
  el.textContent=text;
  el.classList.toggle('error',error);
}

export function showToast(text, error=false) {
  const el=$('#message');
  if (!el) return;
  el.textContent=text;
  el.classList.toggle('error',error);
  el.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>el.classList.add('hidden'),3200);
}

function regenText(resource, current, max) {
  if (Number(current)>=Number(max)) return 'FULL';
  const regen=state.player?.resources?.regen?.[resource];
  if (!regen) return '';
  const nextAt=Number(regen.nextAt)||0;
  const remaining=nextAt?timeUntil(nextAt):'Ready';
  return `+${regen.amount||1} in ${remaining}`;
}

export function renderPlayerHud(player=state.player) {
  if (!player) return;
  setPlayer(player);
  const resources=player.resources||{};
  const progression=player.progression||{};
  const stats=player.stats||{};
  const status=player.status||{};
  const items=[
    {k:'LVL',v:progression.level??1},
    {k:'XP',v:`${progression.xp??0}/${progression.xpToNextLevel??100}`},
    {k:'HP',v:`${resources.health??0}/${resources.maxHealth??0}`,sub:regenText('health',resources.health,resources.maxHealth)},
    {k:'ENG',v:`${resources.energy??0}/${resources.maxEnergy??0}`,sub:regenText('energy',resources.energy,resources.maxEnergy)},
    {k:'NRV',v:`${resources.nerve??0}/${resources.maxNerve??0}`,sub:regenText('nerve',resources.nerve,resources.maxNerve)},
    {k:'CASH',v:money(resources.cash??0)},
    {k:'HEAT',v:state.law?.heat??0},
    {k:'MERIT',v:state.merits?.points??0},
    {k:'STR',v:stats.strength??1},
    {k:'DEF',v:stats.defense??1},
    {k:'SPD',v:stats.speed??1},
    {k:'DEX',v:stats.dexterity??1}
  ];
  $('#hud-primary').innerHTML=items.map(item=>`<div class="hud-cell"><span>${item.k}</span><strong>${escapeHtml(item.v)}</strong>${item.sub?`<small class="hud-regen">${escapeHtml(item.sub)}</small>`:''}</div>`).join('');
  const badge=$('#hud-status');
  badge.textContent=String(status.type||'active').toUpperCase();
  badge.className=`hud-status status-${String(status.type||'active').replace(/[^a-z0-9_-]/gi,'').toLowerCase()}`;
}

async function refreshResourceHudIfDue() {
  const regen=state.player?.resources?.regen||{};
  const due=['health','energy','nerve'].some(key=>Number(regen[key]?.nextAt)>0&&Number(regen[key].nextAt)<=Date.now());
  if (!due || refreshResourceHudIfDue.pending) return;
  refreshResourceHudIfDue.pending=true;
  try {
    await refreshEffects({reason:'resource-regen',force:true});
  } finally {
    refreshResourceHudIfDue.pending=false;
  }
}

export async function refreshSession({navigate=true,maxAgeMs=0}={}) {
  if (state.authenticated && Number(maxAgeMs)>0 && Date.now()-lastSessionRefreshAt<Number(maxAgeMs)) {
    renderPlayerHud(state.player);
    startEffects();
    return true;
  }
  setSessionStatus('Checking RiftCity session…');
  const result=await api('/api/auth/me');
  if (!result.ok || !result.authenticated) {
    clearState();
    lastSessionRefreshAt=0;
    $('#auth-grid')?.classList.remove('hidden');
    $('#game-root')?.classList.add('hidden');
    $('#hud-shell')?.classList.add('hidden');
    $('#mobile-nav')?.classList.add('hidden');
    setSessionStatus('Not signed in.');
    stopEffects();
    if (navigate && location.hash && !['','#character','#overview'].includes(location.hash)) history.replaceState(null,'','#character');
    return false;
  }
  state.authenticated=true;
  lastSessionRefreshAt=Date.now();
  state.user=result.user;
  state.player=result.player;
  state.location=result.location||state.location;
  renderDrawer();
  $('#auth-grid')?.classList.add('hidden');
  $('#game-root')?.classList.remove('hidden');
  $('#hud-shell')?.classList.remove('hidden');
  $('#mobile-nav')?.classList.remove('hidden');
  setSessionStatus(`Connected as ${result.user.username}. Server state synced.`);
  renderPlayerHud(result.player);
  startEffects();
  return true;
}

async function logout() {
  const result=await api('/api/auth/logout',{method:'POST'});
  if (result.ok) {
    clearState();
    showToast('Logged out.');
    await refreshSession();
  }
}

export async function submitAuth(path, form) {
  const data=new FormData(form);
  const result=await api(path,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:data.get('username'),password:data.get('password')})
  });
  if (!result.ok) return showToast(result.error||'Authentication failed',true);
  showToast(path.endsWith('register')?'Account created.':'Logged in.');
  await refreshSession();
  go('character');
}

function scheduleEffectRefresh(delay=EFFECT_SYNC_FALLBACK_MS) {
  clearTimeout(effectRefreshTimer);
  effectRefreshTimer=null;
  if (!state.authenticated) return;
  effectRefreshTimer=setTimeout(()=>refreshEffects({reason:'timer'}),Math.max(5_000,Number(delay)||EFFECT_SYNC_FALLBACK_MS));
}

export function startEffects() {
  if (effectTimer) return;
  effectTimer=setInterval(tickEffects,1000);
  tickEffects();
  refreshEffects({reason:'start',force:true});
}

export function stopEffects() {
  clearInterval(effectTimer); effectTimer=null;
  clearTimeout(effectRefreshTimer); effectRefreshTimer=null;
  clearTimeout(mutationSyncTimer); mutationSyncTimer=null;
  effectSyncPending=null;
}

let effects=[];

function tickEffects() {
  renderPlayerHud(state.player);
  refreshResourceHudIfDue();
  const root=$('#effects-strip');
  if (!root || !effects.length) return;
  root.innerHTML=effects.map(renderEffect).join('');
}

function renderEffect(effect) {
  const remaining=effect.until?timeUntil(effect.until):effect.remaining||'';
  return `<button class="effect-chip ${effect.tone||''}" ${effect.route?`data-route="${escapeHtml(effect.route)}"`:''}>
    <span>${escapeHtml(effect.label)}</span>
    <strong>${escapeHtml(effect.value||remaining||'ACTIVE')}</strong>
  </button>`;
}

export async function refreshEffects({reason='manual',force=false}={}) {
  if (!state.authenticated) return null;
  if (!force && document.visibilityState==='hidden') {
    scheduleEffectRefresh(EFFECT_SYNC_FALLBACK_MS);
    return null;
  }
  if (typeof navigator!=='undefined' && navigator.onLine===false) {
    scheduleEffectRefresh(30_000);
    return null;
  }
  const age=Date.now()-lastEffectSyncAt;
  if (!force && age<EFFECT_SYNC_MIN_GAP_MS) {
    scheduleEffectRefresh(Math.max(EFFECT_SYNC_MIN_GAP_MS-age,5_000));
    return null;
  }
  if (effectSyncPending) return effectSyncPending;

  effectSyncPending=(async()=>{
    const result=await api('/api/sync',{riftBackground:true,riftCacheTtl:750});
    if (!result.ok) {
      scheduleEffectRefresh(result.offline?30_000:45_000);
      return result;
    }
    lastEffectSyncAt=Date.now();
    if (result.player) renderPlayerHud(result.player);
    if (result.location) state.location=result.location;
    const bundle=result.effects||{};
    if (bundle.law) state.law=bundle.law;
    if (bundle.merits) state.merits=bundle.merits;

    const next=[];
    const status=bundle.status||result.player?.status;
    if (status?.type&&status.type!=='active') next.push({label:String(status.type).toUpperCase(),until:status.until,route:'status',tone:'danger'});
    const event=bundle.event;
    if (event) next.push({label:'CITY EVENT',value:event.name||event.title||'Active',route:'events',tone:'event'});
    const travel=bundle.travel;
    if (travel?.travelingTo&&Number(travel.arrivesAt)>Date.now()) next.push({label:'TRAVEL',until:travel.arrivesAt,route:'travel',tone:'info'});
    for (const enrollment of bundle.education||[]) {
      if (Number(enrollment.completesAt)>Date.now()) next.push({label:'EDUCATION',value:enrollment.name||enrollment.courseId,until:enrollment.completesAt,route:'education'});
    }
    if (Number(bundle.production?.activeCount)>0) next.push({label:'PRODUCTION',value:`${bundle.production.activeCount} active`,route:'production'});
    if (bundle.bank?.frozen) next.push({label:'BANK FROZEN',until:bundle.bank.frozenUntil,route:'bank',tone:'danger'});
    if (Number(bundle.law?.heat)>0) next.push({label:'HEAT',value:`${bundle.law.heat} · ${bundle.law.tier?.name||''}`,route:'law',tone:Number(bundle.law.heat)>=60?'danger':'event'});
    if (Number(bundle.activity?.unread)>0) next.push({label:'ACTIVITY',value:`${bundle.activity.unread} unread`,route:'activity',tone:'info'});
    effects=next;
    const root=$('#effects-strip');
    root?.classList.toggle('empty',!effects.length);
    tickEffects();
    scheduleEffectRefresh(Math.max(30_000,Number(result.pollAfterMs)||EFFECT_SYNC_FALLBACK_MS));
    return result;
  })();

  try { return await effectSyncPending; }
  finally { effectSyncPending=null; }
}

function scheduleMutationSync() {
  if (!state.authenticated) return;
  clearTimeout(mutationSyncTimer);
  mutationSyncTimer=setTimeout(()=>refreshEffects({reason:'mutation',force:true}),350);
}

window.addEventListener('riftapi:mutation',scheduleMutationSync);
window.addEventListener('online',()=>{ if(state.authenticated) refreshEffects({reason:'online',force:true}); });
document.addEventListener('visibilitychange',()=>{
  if (document.visibilityState==='visible'&&state.authenticated&&Date.now()-lastEffectSyncAt>30_000) refreshEffects({reason:'visible',force:true});
});
