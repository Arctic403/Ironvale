import { api } from '../ui/api.js';
import { state, setCharacter } from '../ui/state.js';
import { escapeHtml } from '../ui/helpers.js';
import { renderCharacterHud } from '../ui/shell.js';

export async function renderCharacter(root) {
  if (!state.character) {
    const result = await api('/api/ironvale/character');
    if (!result.ok) throw new Error(result.error || 'Could not load character');
    state.character = result.character;
  }
  const c = state.character, r = c.resources || {}, a = c.attributes || {}, gear = state.equipment || {};
  setCharacter(c); renderCharacterHud(c);
  const gearSlots = [['mainHand','Main hand'],['offHand','Off hand'],['head','Head'],['chest','Chest'],['hands','Hands'],['legs','Legs'],['feet','Feet'],['neck','Neck'],['ring','Ring']];
  root.innerHTML = `<section class="ironvale-hero"><div><span class="eyebrow">TRAVELER OF THE MARCHES</span><h2>${escapeHtml(c.name)}</h2><p>Level ${c.level} · ${escapeHtml(state.world?.currentZone?.name || c.zoneId)}</p></div><div class="ironvale-level"><span>LEVEL</span><strong>${c.level}</strong><small>${c.xp}/${c.xpToNextLevel} XP</small></div></section>
  <div class="ironvale-two-column"><section class="ironvale-panel"><span class="eyebrow">ATTRIBUTES</span><div class="ironvale-stat-grid"><div><span>Strength</span><b>${a.strength}</b></div><div><span>Agility</span><b>${a.agility}</b></div><div><span>Vitality</span><b>${a.vitality}</b></div><div><span>Willpower</span><b>${a.willpower}</b></div><div><span>Health</span><b>${r.health}/${r.maxHealth}</b></div><div><span>Stamina</span><b>${r.stamina}/${r.maxStamina}</b></div><div><span>Coin</span><b>${r.coin}</b></div></div></section>
  <section class="ironvale-panel"><span class="eyebrow">EQUIPMENT</span><div class="ironvale-gear-list">${gearSlots.map(([slot,label]) => `<div><span>${label}</span><b>${escapeHtml(gear[slot]?.name || 'Empty')}</b></div>`).join('')}</div></section></div>`;
}
