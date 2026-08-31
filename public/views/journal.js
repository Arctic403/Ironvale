import { api } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml } from '../ui/helpers.js';
import { showToast } from '../ui/shell.js';

export async function renderJournal(root) {
  const result = await api('/api/ironvale/journal');
  if (!result.ok) throw new Error(result.error || 'Could not load journal');
  state.journal = result.journal; draw(root);
}
function draw(root) {
  const journal = state.journal || { quests: [] };
  root.innerHTML = `<section class="ironvale-hero"><div><span class="eyebrow">BLACKSTONE ROAD · STORY FOUNDATION</span><h2>Quest Journal</h2><p>The first Ironvale story chain begins around Brackenford and leads toward Blackstone Wood.</p></div><div class="ironvale-level"><span>ACTIVE</span><strong>${journal.activeCount || 0}</strong><small>${journal.completedCount || 0} complete</small></div></section>
  <section class="ironvale-quest-list">${(journal.quests || []).map(quest => `<article class="ironvale-quest ${escapeHtml(quest.status)}"><div><span class="eyebrow">LEVEL ${quest.level} · ${escapeHtml(quest.status.toUpperCase())}</span><h3>${escapeHtml(quest.name)}</h3><p>${escapeHtml(quest.summary)}</p><small>${quest.objectives.map(o => `${o.type.toUpperCase()} ${escapeHtml(o.targetId)} ×${o.count}`).join(' · ')}</small></div><div class="ironvale-quest-reward"><span>REWARD</span><b>${quest.rewards.xp} XP</b><small>${quest.rewards.coin} coin</small>${quest.status === 'available' ? `<button class="rc-button primary" data-quest-accept="${escapeHtml(quest.id)}">Accept</button>` : ''}</div></article>`).join('')}</section>`;
  root.querySelectorAll('[data-quest-accept]').forEach(button => button.addEventListener('click', () => accept(root, button.dataset.questAccept)));
}
async function accept(root, questId) {
  const result = await api('/api/ironvale/quests/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questId }) });
  if (!result.ok) return showToast(result.error || 'Could not accept quest', true);
  state.journal = result.journal; showToast(result.message || 'Quest accepted.'); draw(root);
}
