import { api } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml } from '../ui/helpers.js';

export async function renderInventory(root) {
  const result = await api('/api/ironvale/inventory');
  if (!result.ok) throw new Error(result.error || 'Could not load inventory');
  state.inventory = result.inventory; state.equipment = result.inventory.equipment;
  const data = result.inventory, items = data.items || [];
  root.innerHTML = `<section class="ironvale-hero"><div><span class="eyebrow">GEAR & SUPPLIES</span><h2>Inventory</h2><p>Everything carried by your current Ironvale character.</p></div><div class="ironvale-level"><span>ITEMS</span><strong>${data.summary?.totalQuantity || 0}</strong><small>${data.summary?.uniqueItems || 0} types</small></div></section>
  <section class="ironvale-item-grid">${items.length ? items.map(item => `<article class="ironvale-item"><div class="ironvale-item-mark">${escapeHtml(item.name.slice(0,2).toUpperCase())}</div><div><span class="eyebrow">${escapeHtml(item.rarity)} · ${escapeHtml(item.type)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><small>${item.slot ? `Slot: ${escapeHtml(item.slot)}` : 'Supply'}${item.durability != null ? ` · Durability ${item.durability}` : ''}</small></div><b>x${item.quantity}</b></article>`).join('') : '<div class="rc-empty"><strong>Your pack is empty.</strong></div>'}</section>`;
}
