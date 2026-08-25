import { api } from '../ui/api.js';
import { state, setPlayer } from '../ui/state.js';
import { escapeHtml, money, badge, empty } from '../ui/helpers.js';
import { renderPlayerHud, showToast } from '../ui/shell.js';

let filter='all', query='', selected=null;

export async function renderInventory(root) {
  const result=await api('/api/inventory');
  if (!result.ok) {
    root.innerHTML=`<div class="rc-error"><strong>Inventory unavailable</strong><p>${escapeHtml(result.error||'Could not load inventory')}</p></div>`;
    return;
  }
  state.inventory=result;
  draw(root);
}

function draw(root) {
  const data=state.inventory||{}, owned=(data.inventory||[]).filter(item=>Number(item.quantity)>0);
  const filtered=owned.filter(item=>{
    const matchesFilter=filter==='all'||String(item.category||'').toLowerCase()===filter;
    const q=query.trim().toLowerCase();
    const matchesQ=!q||`${item.name} ${item.description} ${(item.tags||[]).join(' ')}`.toLowerCase().includes(q);
    return matchesFilter&&matchesQ;
  });
  const categories=['all',...new Set(owned.map(i=>String(i.category||'item').toLowerCase()))];
  if (selected && !owned.some(item=>item.id===selected)) selected=null;
  if (!selected && owned[0]) selected=owned[0].id;
  const item=owned.find(i=>i.id===selected)||filtered[0]||owned[0]||null;

  root.innerHTML=`
    <section class="inventory-hero"><div><span class="eyebrow">PLAYER STORAGE</span><h2>Inventory</h2><p>Only items you currently own are shown here.</p></div><div class="inventory-count"><span>OWNED</span><strong>${data.summary?.totalQuantity||0}</strong><small>${data.summary?.uniqueItems||0} item types</small></div></section>
    ${owned.length?`<div class="inventory-toolbar"><input id="inventory-search" placeholder="Search owned items…" value="${escapeHtml(query)}" />${categories.map(c=>`<button class="${filter===c?'active':''}" data-inventory-filter="${escapeHtml(c)}">${escapeHtml(c.toUpperCase())}</button>`).join('')}</div>`:''}
    <div class="inventory-layout-v2">
      <section class="inventory-grid">${owned.length?(filtered.map(item=>itemCard(item)).join('')||empty('No matching owned items')):empty('Inventory empty','Shops, crimes, trades and rewards will add items here.')}</section>
      <aside class="item-inspector">${item?detail(item):empty('No owned item selected')}</aside>
    </div>`;
  root.querySelector('#inventory-search')?.addEventListener('input',e=>{query=e.target.value;draw(root);root.querySelector('#inventory-search')?.focus();});
  root.querySelectorAll('[data-inventory-filter]').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.inventoryFilter;draw(root);}));
  root.querySelectorAll('[data-item-select]').forEach(btn=>btn.addEventListener('click',()=>{selected=btn.dataset.itemSelect;draw(root);}));
  root.querySelectorAll('[data-item-action]').forEach(btn=>btn.addEventListener('click',()=>itemAction(root,btn.dataset.itemAction,btn.dataset.itemId)));
}

function itemCard(item) {
  return `<button class="item-card ${item.equipped?'equipped':''} ${selected===item.id?'selected':''}" data-item-select="${escapeHtml(item.id)}">
    <div class="item-art item-art-${escapeHtml(item.category)}"><span>${escapeHtml(item.name.slice(0,2).toUpperCase())}</span></div>
    <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.rarity)}</small></div>
    <b>${item.quantity?`x${item.quantity}`:'—'}</b>
  </button>`;
}

function detail(item) {
  const owned=Number(item.quantity)>0;
  const effects=Object.entries(item.effects||{}).filter(([,v])=>Number(v));
  const combat=item.combat||item.combatStats||{};
  return `<div class="inspector-art item-art-${escapeHtml(item.category)}"><span>${escapeHtml(item.name.slice(0,2).toUpperCase())}</span></div>
    <span class="eyebrow">${escapeHtml(String(item.category).toUpperCase())} / ${escapeHtml(String(item.rarity).toUpperCase())}</span>
    <h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description)}</p>
    <div class="tag-row">${(item.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div>
    <div class="stat-list">
      <div><span>Quantity</span><strong>${item.quantity||0}</strong></div>
      <div><span>Value</span><strong>${money(item.baseValue)}</strong></div>
      <div><span>Tradeable</span><strong>${item.tradeable?'YES':'NO'}</strong></div>
      <div><span>Equipment</span><strong>${item.equipable?escapeHtml(item.equipmentSlot||'YES'):'NO'}</strong></div>
      ${Object.entries(combat).map(([k,v])=>`<div><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}
    </div>
    ${effects.length?`<div class="effect-list">${effects.map(([k,v])=>badge(`${k.toUpperCase()} +${v}`,'success')).join('')}</div>`:''}
    <div class="inspector-actions">
      ${owned&&item.usable?`<button class="rc-button primary" data-item-action="use" data-item-id="${escapeHtml(item.id)}">Use</button>`:''}
      ${owned&&item.equipable&&!item.equipped?`<button class="rc-button" data-item-action="equip" data-item-id="${escapeHtml(item.id)}">Equip</button>`:''}
      ${owned&&item.equipable&&item.equipped?`<button class="rc-button" data-item-action="unequip" data-item-id="${escapeHtml(item.id)}">Unequip</button>`:''}
      ${!owned?'<span class="not-owned">NOT CURRENTLY OWNED</span>':''}
    </div>`;
}

async function itemAction(root,action,itemId) {
  const endpoint=action==='use'?'/api/inventory/use':action==='equip'?'/api/inventory/equip':'/api/inventory/unequip';
  const result=await api(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({itemId})});
  if (!result.ok) return showToast(result.error||'Item action failed',true);
  if (result.player) { setPlayer(result.player); renderPlayerHud(result.player); }
  showToast(result.message||'Inventory updated.');
  const fresh=await api('/api/inventory');
  if (fresh.ok) { state.inventory=fresh; draw(root); }
}
