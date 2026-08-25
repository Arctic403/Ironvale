import { api, getService } from './api.js';
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
    ['achievements','Awards'],['challenges','Challenges'],['factions','Factions'],['properties','Property']
  ]],
  ['Economy',[
    ['bank','Bank'],['market','Market'],['shop','Shops'],['auction','Black Market'],['production','Production']
  ]],
  ['World',[
    ['travel','Airport / Travel'],['casino','Casino'],['status','Hospital / Jail'],['events','World Events'],['wiki','Field Manual']
  ]]
];

let effectTimer=null;

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
  root.innerHTML=DRAWER_GROUPS.map(([label,items])=>`
    <section class="drawer-group">
      <span class="drawer-group-label">${escapeHtml(label)}</span>
      ${items.map(([route,name])=>`<a href="#${route}" data-route="${escapeHtml(route)}">${escapeHtml(name)}</a>`).join('')}
    </section>`).join('');
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
    const result=await api('/api/player/state');
    if (result.ok&&result.player) renderPlayerHud(result.player);
  } finally {
    refreshResourceHudIfDue.pending=false;
  }
}

export async function refreshSession({navigate=true}={}) {
  setSessionStatus('Checking RiftCity session…');
  const result=await api('/api/auth/me');
  if (!result.ok || !result.authenticated) {
    clearState();
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
  state.user=result.user;
  state.player=result.player;
  state.location=result.location||state.location;
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

export function startEffects() {
  if (effectTimer) return;
  refreshEffects();
  effectTimer=setInterval(tickEffects,1000);
  refreshEffects.timer=setInterval(refreshEffects,30000);
}

export function stopEffects() {
  clearInterval(effectTimer); effectTimer=null;
  clearInterval(refreshEffects.timer); refreshEffects.timer=null;
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

export async function refreshEffects() {
  if (!state.authenticated) return;
  const [status,events,travel,education,production,bank]=await Promise.all([
    getService('status'),getService('events'),getService('travel'),
    getService('education'),getService('production'),getService('bank')
  ]);
  const next=[];
  if (status.ok && status.status?.type && status.status.type!=='active') {
    next.push({label:String(status.status.type).toUpperCase(),until:status.status.until,route:'status',tone:'danger'});
  }
  const event=events.event||events.activeEvent||events.current||events.events?.active;
  if (events.ok && event) next.push({label:'CITY EVENT',value:event.name||event.title||'Active',route:'events',tone:'event'});
  if (travel.ok && travel.state?.traveling_to) next.push({label:'TRAVEL',until:travel.state.arrives_at,route:'travel',tone:'info'});
  if (education.ok) {
    for (const row of education.enrollments||[]) {
      if (row.status==='studying' && Number(row.completes_at)>Date.now()) {
        const course=(education.courses||[]).find(c=>c.id===row.course_id);
        next.push({label:'EDUCATION',value:course?.name||row.course_id,until:row.completes_at,route:'education'});
      }
    }
  }
  if (production.ok) {
    const active=(production.batches||[]).filter(b=>!b.claimed);
    if (active.length) next.push({label:'PRODUCTION',value:`${active.length} active`,route:'production'});
  }
  if (bank.ok && bank.security?.frozen) next.push({label:'BANK FROZEN',until:bank.security.frozenUntil||bank.security.frozen_until,route:'bank',tone:'danger'});
  effects=next;
  const root=$('#effects-strip');
  root?.classList.toggle('empty',!effects.length);
  tickEffects();
}
