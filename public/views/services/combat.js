import { escapeHtml, progress, panel, badge, empty } from '../../ui/helpers.js';
import { postService, getService } from '../../ui/api.js';
import { setPlayer } from '../../ui/state.js';
import { renderPlayerHud, showToast, refreshEffects } from '../../ui/shell.js';

let lastResult=null;

export function renderCombatService(root,data) {
  const player=data.player||{}, stats=player.stats||{}, weapon=data.equippedWeapon;
  root.innerHTML=`
    <section class="combat-hero"><div><span class="eyebrow">BATTLE NETWORK</span><h2>Combat</h2><p>NPC and asynchronous player encounters resolve entirely on the server using player stats and equipped weapon data.</p></div><div class="combat-loadout"><span>EQUIPPED</span><strong>${escapeHtml(weapon?.name||'Unarmed')}</strong><small>${data.settings?.energyCost||10} energy per fight</small></div></section>
    <div class="combat-statbar">${['strength','defense','speed','dexterity'].map(k=>`<div><span>${k.slice(0,3).toUpperCase()}</span><strong>${stats[k]??1}</strong></div>`).join('')}</div>
    ${lastResult?resultCard(lastResult):''}
    <div class="two-col combat-columns">
      ${panel('NPC Encounters',`<div class="opponent-list">${(data.npcs||[]).map(npc=>`<article class="opponent-card"><div class="fighter-avatar">${escapeHtml(npc.name.slice(0,1))}</div><div><span class="eyebrow">LEVEL ${npc.level}</span><h3>${escapeHtml(npc.name)}</h3><p>${escapeHtml(npc.weapon?.name||'Unarmed')} · ${npc.health} HP</p></div><button class="rc-button primary" data-combat-npc="${escapeHtml(npc.id)}">Fight</button></article>`).join('')}</div>`,{eyebrow:'CITY TARGETS'})}
      ${panel('Player Challenge',`<form id="pvp-form" class="pvp-form"><label>Username<input name="targetUsername" placeholder="Player username"></label><button class="rc-button primary">Attack player</button></form><p class="muted">Player-vs-player is asynchronous: the server reads both players, resolves the encounter, records it, and applies health/status consequences.</p>`,{eyebrow:'PVP'})}
    </div>
    ${panel('Weapon Skills',`<div class="weapon-skill-grid">${Object.entries(data.weaponSkills||{}).map(([key,skill])=>`<div><span>${escapeHtml(key.toUpperCase())}</span><strong>Lv ${skill.level}</strong><small>${skill.xp} XP${skill.nextLevelXp?` / ${skill.nextLevelXp}`:''}</small></div>`).join('')}</div>`,{eyebrow:'PROFICIENCY'})}
    ${panel('Recent Fights',(data.history||[]).length?`<div class="combat-history">${data.history.map(row=>`<article class="history-row ${row.winner==='attacker'?'success':'failure'}"><div><strong>${escapeHtml(String(row.opponent_type||'fight').toUpperCase())}</strong><small>${new Date(Number(row.created_at)).toLocaleString()}</small></div><span>${escapeHtml(row.winner)}</span><p>${row.rounds} rounds · ${row.attacker_damage} dealt · ${row.defender_damage} taken · +${row.xp_gain} XP</p></article>`).join('')}</div>`:empty('No combat history'),{eyebrow:'BATTLE LOG'})}`;
  root.querySelectorAll('[data-combat-npc]').forEach(btn=>btn.addEventListener('click',()=>attack(root,{npcId:btn.dataset.combatNpc})));
  root.querySelector('#pvp-form')?.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);attack(root,{targetUsername:fd.get('targetUsername')});});
}

function resultCard(result) {
  const turns=result.turns||[];
  return `<section class="battle-result ${result.won?'win':'loss'}">
    <div class="battle-side"><span>YOU</span><strong>${result.won?'WIN':'LOSS'}</strong></div>
    <div class="battle-center">
      <span class="eyebrow">${escapeHtml(result.opponentName||'Opponent')}</span>
      <h3>${escapeHtml(result.text||'Combat resolved')}</h3>
      <div><span>${result.rounds} rounds</span><span>${result.damageDealt} damage dealt</span><span>${result.damageTaken} damage taken</span><span>-${result.energySpent||0} energy</span><span>+${result.xpGain} XP</span></div>
      ${result.weaponSkill?`<p class="muted">${escapeHtml(result.weapon?.name||'Unarmed')} skill · Level ${result.weaponSkill.level} · ${result.weaponSkill.xp} XP</p>`:''}
      ${turns.length?`<div class="combat-turn-feed">${turns.map(turn=>`<article class="${turn.isMiss?'miss':turn.isCrit?'crit':'hit'}"><span>R${turn.round}</span><p>${escapeHtml(turn.text)}</p><b>${turn.isMiss?'MISS':turn.isCrit?`CRIT · ${turn.damage}`:`${turn.damage}`}</b></article>`).join('')}</div>`:''}
    </div>
    <div class="battle-side opponent"><span>TARGET</span><strong>${result.won?'DEFEATED':'WINS'}</strong></div>
  </section>`;
}

async function attack(root,target) {
  const button=root.querySelector(`[data-combat-npc="${CSS.escape(target.npcId||'')}"]`);
  if (button) {button.disabled=true;button.textContent='Fighting…';}
  const result=await postService('combat',{action:'attack',...target});
  if (!result.ok) return showToast(result.error||'Combat failed',true);
  lastResult=result.result;
  if (result.player) {setPlayer(result.player);renderPlayerHud(result.player);}
  refreshEffects();
  const fresh=await getService('combat');
  if (fresh.ok) renderCombatService(root,fresh);
}
