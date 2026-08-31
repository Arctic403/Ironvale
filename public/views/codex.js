import { api } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml } from '../ui/helpers.js';

export async function renderCodex(root) {
  const result = await api('/api/ironvale/world', { riftCacheTtl: 30 * 60_000, riftPersistCache: true });
  if (!result.ok) throw new Error(result.error || 'Could not load world codex');
  state.world = result.world; const w = result.world;
  root.innerHTML = `<section class="ironvale-hero"><div><span class="eyebrow">${escapeHtml(w.region.name)}</span><h2>World Codex</h2><p>${escapeHtml(w.region.description)}</p></div><div class="ironvale-level"><span>ZONES</span><strong>${w.zones.length}</strong><small>Foundation map</small></div></section>
  <div class="ironvale-codex-grid"><section class="ironvale-panel"><span class="eyebrow">REGIONS & SETTLEMENTS</span>${w.zones.map(z => `<div class="ironvale-codex-row"><div><b>${escapeHtml(z.name)}</b><small>Levels ${z.levelMin}-${z.levelMax}</small></div><p>${escapeHtml(z.description)}</p></div>`).join('')}${w.settlements.map(s => `<div class="ironvale-codex-row"><div><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.kind)}</small></div><p>${escapeHtml(s.description)}</p></div>`).join('')}</section>
  <section class="ironvale-panel"><span class="eyebrow">PEOPLE & FACTIONS</span>${w.factions.map(f => `<div class="ironvale-codex-row"><div><b>${escapeHtml(f.name)}</b><small>${escapeHtml(f.alignment)}</small></div><p>${escapeHtml(f.description)}</p></div>`).join('')}${w.npcs.map(n => `<div class="ironvale-codex-row"><div><b>${escapeHtml(n.name)}</b><small>${escapeHtml(n.role)}</small></div></div>`).join('')}</section>
  <section class="ironvale-panel"><span class="eyebrow">DANGERS</span>${w.creatures.map(c => `<div class="ironvale-codex-row"><div><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.kind)} · ${c.levelMin}-${c.levelMax}</small></div></div>`).join('')}</section>
  <section class="ironvale-panel"><span class="eyebrow">DUNGEONS</span>${w.dungeons.map(d => `<div class="ironvale-codex-row"><div><b>${escapeHtml(d.name)}</b><small>Levels ${d.levelMin}-${d.levelMax} · ${d.partyMin}-${d.partyMax} players</small></div><p>${escapeHtml(d.description)}</p></div>`).join('')}</section></div>`;
}
