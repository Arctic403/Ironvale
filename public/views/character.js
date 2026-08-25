import { getService } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml, money, meter, panel, badge, number } from '../ui/helpers.js';

export async function renderCharacter(root) {
  const player=state.player||{};
  const res=player.resources||{}, prog=player.progression||{}, stats=player.stats||{}, status=player.status||{};
  const [bank,jobs,factions,properties,missions,achievements,challenges]=await Promise.all([
    getService('bank'),getService('jobs'),getService('factions'),getService('properties'),
    getService('missions'),getService('achievements'),getService('challenges')
  ]);
  const activeHome=(properties.owned||[]).find(p=>p.is_home);
  const property=(properties.properties||[]).find(p=>p.id===activeHome?.property_id);
  const job=(jobs.jobs||[]).find(j=>j.id===jobs.state?.job_id);
  const faction=(factions.factions||[]).find(f=>f.id===factions.state?.faction_id);
  const claimed=(missions.missions||[]).filter(m=>m.claimed).length;
  const unlocked=(achievements.achievements||[]).filter(a=>a.unlocked).length;
  const ready=(challenges.challenges||[]).filter(c=>c.complete&&!c.claimed).length;

  root.innerHTML=`
    <section class="hero-card">
      <div>
        <span class="eyebrow">PLAYER PROFILE</span>
        <h2>${escapeHtml(state.user?.username||'Player')}</h2>
        <p>${escapeHtml(status.reason||'Active in RiftCity')}</p>
      </div>
      <div class="hero-level"><span>LEVEL</span><strong>${escapeHtml(prog.level??1)}</strong></div>
    </section>

    <div class="dashboard-grid">
      ${panel('Progression',`
        ${meter('XP',prog.xp??0,prog.xpToNextLevel??100)}
        <div class="stat-grid compact">
          <div><span>Missions</span><strong>${claimed}</strong></div>
          <div><span>Awards</span><strong>${unlocked}</strong></div>
          <div><span>Challenges Ready</span><strong>${ready}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(String(status.type||'active').toUpperCase())}</strong></div>
        </div>`,{eyebrow:'LONG-TERM'})
      }
      ${panel('Combat Attributes',`
        <div class="stat-grid">
          <div><span>Strength</span><strong>${number(stats.strength)}</strong></div>
          <div><span>Defense</span><strong>${number(stats.defense)}</strong></div>
          <div><span>Speed</span><strong>${number(stats.speed)}</strong></div>
          <div><span>Dexterity</span><strong>${number(stats.dexterity)}</strong></div>
        </div>
        <a class="rc-button wide" href="#combat" data-route="combat">Open Combat</a>`,{eyebrow:'BATTLE STATS'})
      }
      ${panel('Economy',`
        <div class="stat-list">
          <div><span>On hand</span><strong>${money(res.cash)}</strong></div>
          <div><span>Checking</span><strong>${money(bank.account?.checking)}</strong></div>
          <div><span>Savings</span><strong>${money(bank.account?.savings)}</strong></div>
          <div><span>Investments</span><strong>${(bank.investments||[]).filter(x=>!x.claimed).length}</strong></div>
        </div>
        <a class="rc-button wide" href="#bank" data-route="bank">Open Bank</a>`,{eyebrow:'FINANCES'})
      }
      ${panel('Life',`
        <div class="stat-list">
          <div><span>Job</span><strong>${escapeHtml(job?.company||'Unemployed')}</strong></div>
          <div><span>Faction</span><strong>${escapeHtml(faction?.name||'Independent')}</strong></div>
          <div><span>Home</span><strong>${escapeHtml(property?.name||'Starter residence')}</strong></div>
          <div><span>Location</span><strong>${escapeHtml(state.location?.locationName||state.location?.locationId||'RiftCity')}</strong></div>
        </div>`,{eyebrow:'CURRENT LIFE'})
      }
    </div>

    <section class="quick-actions">
      ${['city','crimes','gym','jobs','missions','inventory','market','auction','travel','production'].map(route=>`<a href="#${route}" data-route="${route}">${route.replace('-',' ')}</a>`).join('')}
    </section>`;
}
