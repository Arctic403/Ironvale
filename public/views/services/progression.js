import { escapeHtml, money, progress, timeUntil, dateTime, panel, badge, empty } from '../../ui/helpers.js';
import { bindActionForms, act } from './common.js';
import { getService } from '../../ui/api.js';
import { state, setPlayer } from '../../ui/state.js';
import { renderPlayerHud, showToast } from '../../ui/shell.js';

export function renderProgressionService(root,service,data) {
  if (service==='gym') return renderGym(root,data);
  if (service==='jobs') return renderJobs(root,data);
  if (service==='education') return renderEducation(root,data);
  if (service==='properties') return renderProperties(root,data);
  if (service==='factions') return renderFactions(root,data);
  if (service==='missions') return renderMissions(root,data);
  if (service==='achievements') return renderAchievements(root,data);
  if (service==='challenges') return renderChallenges(root,data);
}

function renderGym(root,data) {
  const stateRow=data.state||{}, player=data.player||state.player||{}, stats=player.stats||{};
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">FORGE ATHLETICS</span><h2>Rift Performance Lab</h2><p>Program-based training. Energy, streaks, education bonuses and active city events all resolve server-side.</p></div><div class="service-kpis"><div><span>GYM XP</span><strong>${stateRow.gym_exp||0}</strong></div><div><span>STREAK</span><strong>${stateRow.streak||0}</strong></div></div></section>
    <div class="stat-grid wide">
      ${['strength','defense','speed','dexterity'].map(stat=>`<div><span>${stat.toUpperCase()}</span><strong>${stats[stat]??1}</strong></div>`).join('')}
    </div>
    <div class="program-grid">${(data.programs||[]).map(program=>{
      const unlocked=Number(stateRow.gym_exp||0)>=Number(program.unlockExp||0);
      return `<article class="program-card ${unlocked?'':'locked'}"><header><div><span class="eyebrow">${program.energyCost} ENERGY</span><h3>${escapeHtml(program.name)}</h3></div>${badge(unlocked?'UNLOCKED':`XP ${program.unlockExp}` ,unlocked?'success':'danger')}</header><p>${escapeHtml(program.description)}</p>
        <div class="multiplier-grid">${Object.entries(program.multipliers||{}).map(([k,v])=>`<div><span>${k.slice(0,3).toUpperCase()}</span><strong>${Number(v).toFixed(2)}×</strong></div>`).join('')}</div>
        <form data-service-form data-action="train"><input type="hidden" name="programId" value="${escapeHtml(program.id)}"><select name="stat" ${unlocked?'':'disabled'}>${(data.stats||[]).map(stat=>`<option value="${escapeHtml(stat)}">${escapeHtml(stat.toUpperCase())}</option>`).join('')}</select><button class="rc-button primary" ${unlocked?'':'disabled'}>Train</button></form>
      </article>`;
    }).join('')}</div>`;
  bindActionForms(root,'gym',fresh=>renderGym(root,fresh));
}

function renderJobs(root,data) {
  const stateRow=data.state||{}, current=(data.jobs||[]).find(j=>j.id===stateRow.job_id), position=data.position;
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">RIFT EMPLOYMENT BUREAU</span><h2>Careers</h2><p>Pick a career, build skill XP and move through its promotion ladder.</p></div><div class="service-kpis"><div><span>CURRENT</span><strong>${escapeHtml(current?.company||'Unemployed')}</strong></div><div><span>SKILL</span><strong>${stateRow.skill_level||0}</strong></div></div></section>
    ${current?panel('Current Position',`<div class="current-job-card"><div><span class="eyebrow">${escapeHtml(current.company)}</span><h3>${escapeHtml(position?.title||current.title)}</h3><p>${escapeHtml(current.description)}</p></div><div class="job-pay"><span>SHIFT PAY</span><strong>${money(position?.pay||current.basePay)}</strong><small>${current.energyCost} energy</small></div></div><div class="rc-meter"><span style="width:${progress((stateRow.skill_xp||0)%5,5)}%"></span></div><button class="rc-button primary wide" data-service-action="work">Work shift</button>`,{eyebrow:'EMPLOYED'}):''}
    ${panel('Available Careers',`<div class="career-grid">${(data.jobs||[]).map(job=>`<article class="career-card ${current?.id===job.id?'selected':''}"><span class="eyebrow">${escapeHtml(job.company)}</span><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.description)}</p><div class="tag-row">${(job.skills||[]).map(s=>`<span>${escapeHtml(s)}</span>`).join('')}</div><div class="stat-list compact"><div><span>Starting pay</span><strong>${money(job.basePay)}</strong></div><div><span>Energy</span><strong>${job.energyCost}</strong></div><div><span>Top role</span><strong>${escapeHtml(job.positions?.at(-1)?.title||'—')}</strong></div></div>${current?.id===job.id?badge('CURRENT JOB','success'):`<button class="rc-button" data-service-action="join" data-job-id="${escapeHtml(job.id)}">Join career</button>`}</article>`).join('')}</div>`,{eyebrow:'CAREER BOARD'})}`;
  bindActionForms(root,'jobs',fresh=>renderJobs(root,fresh));
}

function renderEducation(root,data) {
  const rows=new Map((data.enrollments||[]).map(e=>[e.course_id,e]));
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">RIFT METROPOLITAN INSTITUTE</span><h2>Education</h2><p>Courses complete on server timers and feed real crime, gym and combat bonuses.</p></div></section>
    <div class="course-grid">${(data.courses||[]).map(course=>{
      const row=rows.get(course.id), complete=row?.status==='completed'||(row&&Number(row.completes_at)<=Date.now());
      const studying=row&&!complete;
      return `<article class="course-card ${complete?'complete':studying?'active':''}"><header><div><span class="eyebrow">LEVEL ${course.levelRequired}</span><h3>${escapeHtml(course.name)}</h3></div>${complete?badge('COMPLETED','success'):studying?badge(timeUntil(row.completes_at),'info'):badge(money(course.cost))}</header><p>${escapeHtml(course.description)}</p><div class="stat-list compact"><div><span>Duration</span><strong>${escapeHtml(timeUntil(Date.now()+course.durationSeconds*1000))}</strong></div><div><span>Bonus</span><strong>+${course.bonus?.amount||0}% ${escapeHtml(course.bonus?.type||'')}</strong></div></div>${!row?`<button class="rc-button primary" data-service-action="enroll" data-course-id="${escapeHtml(course.id)}">Enroll · ${money(course.cost)}</button>`:''}</article>`;
    }).join('')}</div>`;
  bindActionForms(root,'education',fresh=>renderEducation(root,fresh));
}

function renderProperties(root,data) {
  const ownedIds=new Set((data.owned||[]).map(x=>x.property_id));
  const home=(data.owned||[]).find(x=>x.is_home);
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">KEYSTONE REALTY</span><h2>Properties</h2><p>Residences change real player limits and can generate passive property income.</p></div><div class="service-kpis"><div><span>OWNED</span><strong>${ownedIds.size}</strong></div><div><span>HOME</span><strong>${escapeHtml((data.properties||[]).find(p=>p.id===home?.property_id)?.name||'None')}</strong></div></div></section>
    <div class="property-grid">${(data.properties||[]).map(prop=>{
      const owned=ownedIds.has(prop.id), isHome=home?.property_id===prop.id;
      return `<article class="property-card ${isHome?'home':''}"><header><div><span class="eyebrow">${isHome?'CURRENT HOME':'RESIDENCE'}</span><h3>${escapeHtml(prop.name)}</h3></div><strong>${prop.price?money(prop.price):'STARTER'}</strong></header><p>${escapeHtml(prop.description)}</p><div class="stat-list compact"><div><span>Max health</span><strong>+${prop.bonuses?.maxHealth||0}</strong></div><div><span>Nerve</span><strong>+${prop.bonuses?.nerve||0}</strong></div><div><span>Income/hr</span><strong>${money(prop.incomePerHour)}</strong></div><div><span>Upkeep/day</span><strong>${money(prop.upkeepPerDay)}</strong></div></div><div class="property-actions">${!owned?`<button class="rc-button primary" data-service-action="buy" data-property-id="${escapeHtml(prop.id)}">Buy</button>`:''}${owned&&!isHome?`<button class="rc-button" data-service-action="set-home" data-property-id="${escapeHtml(prop.id)}">Set home</button>`:''}${owned&&Number(prop.incomePerHour)>0?`<button class="rc-button" data-service-action="collect-income" data-property-id="${escapeHtml(prop.id)}">Collect income</button>`:''}${isHome?badge('ACTIVE','success'):''}</div></article>`;
    }).join('')}</div>`;
  bindActionForms(root,'properties',fresh=>renderProperties(root,fresh));
}

function renderFactions(root,data) {
  const current=(data.factions||[]).find(f=>f.id===data.state?.faction_id);
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">CITY INFLUENCE</span><h2>Factions</h2><p>Build reputation and faction points with server-tracked work.</p></div><div class="service-kpis"><div><span>FACTION</span><strong>${escapeHtml(current?.name||'Independent')}</strong></div><div><span>REP</span><strong>${data.state?.reputation||0}</strong></div></div></section>
    ${current?panel('Current Faction',`<div class="current-faction"><div><span class="eyebrow">${escapeHtml(data.rank?.name||'Member')}</span><h3>${escapeHtml(current.name)}</h3><p>${escapeHtml(current.description)}</p><div class="tag-row"><span>${escapeHtml(current.specialty)}</span></div></div><div><button class="rc-button primary wide" data-service-action="work">Faction work</button><button class="rc-button wide" data-service-action="leave">Leave faction</button></div></div>`,{eyebrow:'MEMBERSHIP'}):''}
    <div class="faction-grid">${(data.factions||[]).map(f=>`<article class="faction-card ${current?.id===f.id?'selected':''}"><span class="eyebrow">${escapeHtml(f.specialty)}</span><h3>${escapeHtml(f.name)}</h3><p>${escapeHtml(f.description)}</p><div class="rank-list">${(f.ranks||[]).map(r=>`<span>${escapeHtml(r.name)} <b>${r.reputation}</b></span>`).join('')}</div>${current?.id===f.id?badge('JOINED','success'):!current?`<button class="rc-button" data-service-action="join" data-faction-id="${escapeHtml(f.id)}">Join</button>`:''}</article>`).join('')}</div>`;
  bindActionForms(root,'factions',fresh=>renderFactions(root,fresh));
}

function renderMissions(root,data) {
  const missions=data.missions||[];
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">RIFTCITY STORY</span><h2>Missions</h2><p>Shared progression counters connect crime, combat, economy, travel, work and production.</p></div><div class="service-kpis"><div><span>CLAIMED</span><strong>${missions.filter(m=>m.claimed).length}</strong></div><div><span>READY</span><strong>${missions.filter(m=>m.complete&&!m.claimed).length}</strong></div></div></section>
    ${[...new Set(missions.map(m=>m.chapter))].map(ch=>panel(`Chapter ${ch}`,`<div class="mission-list">${missions.filter(m=>m.chapter===ch).map(m=>missionCard(m)).join('')}</div>`,{eyebrow:'MISSION CHAIN'})).join('')}`;
  bindActionForms(root,'missions',fresh=>renderMissions(root,fresh));
}
function missionCard(m) {
  return `<article class="mission-card ${m.claimed?'claimed':m.complete?'ready':!m.prerequisiteMet?'locked':''}"><div><span class="eyebrow">${escapeHtml(m.metric)}</span><h3>${escapeHtml(m.name)}</h3><p>${escapeHtml(m.description)}</p><div class="rc-meter"><span style="width:${progress(m.progress,m.target)}%"></span></div><small>${Math.min(m.progress,m.target)} / ${m.target}</small></div><div class="mission-reward"><span>${money(m.reward?.cash)} + ${m.reward?.xp||0} XP</span>${m.claimed?badge('CLAIMED','success'):m.complete?`<button class="rc-button primary" data-service-action="claim" data-mission-id="${escapeHtml(m.id)}">Claim</button>`:badge(m.prerequisiteMet?'IN PROGRESS':'LOCKED',m.prerequisiteMet?'info':'danger')}</div></article>`;
}

function renderAchievements(root,data) {
  const list=data.achievements||[];
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">AWARDS</span><h2>Achievements</h2><p>Lifetime milestones unlock automatically from shared server progression.</p></div><div class="service-kpis"><div><span>UNLOCKED</span><strong>${list.filter(a=>a.unlocked).length}/${list.length}</strong></div></div></section>
    <div class="achievement-grid">${list.map(a=>`<article class="achievement-card ${a.unlocked?'unlocked':'locked'}"><div class="achievement-mark">${a.unlocked?'◆':'◇'}</div><span class="eyebrow">${escapeHtml(a.metric)}</span><h3>${escapeHtml(a.name)}</h3><p>${escapeHtml(a.description)}</p><div class="rc-meter"><span style="width:${progress(a.progress,a.target)}%"></span></div><small>${Math.min(a.progress,a.target)} / ${a.target}</small><div class="achievement-footer"><span>Reward ${a.reward?.xp||0} XP</span>${a.claimed?badge('CLAIMED','success'):a.unlocked?`<button class="rc-button small" data-service-action="claim" data-achievement-id="${escapeHtml(a.id)}">Claim</button>`:badge('LOCKED')}</div></article>`).join('')}</div>`;
  bindActionForms(root,'achievements',fresh=>renderAchievements(root,fresh));
}

function renderChallenges(root,data) {
  const list=data.challenges||[];
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">ROTATING GOALS</span><h2>Challenges</h2><p>Daily and weekly goals use period baselines, so only new progress in the active period counts.</p></div></section>
    ${['daily','weekly'].map(cadence=>panel(cadence==='daily'?'Daily Challenges':'Weekly Challenges',`<div class="challenge-grid">${list.filter(c=>c.cadence===cadence).map(c=>`<article class="challenge-card ${c.complete?'complete':''}"><span class="eyebrow">${escapeHtml(c.metric)}</span><h3>${escapeHtml(c.name)}</h3><div class="rc-meter"><span style="width:${progress(c.progress,c.target)}%"></span></div><small>${Math.min(c.progress,c.target)} / ${c.target}</small><div><span>${money(c.reward?.cash)} · ${c.reward?.xp||0} XP</span>${c.claimed?badge('CLAIMED','success'):c.complete?`<button class="rc-button small" data-service-action="claim" data-challenge-key="${escapeHtml(c.challengeKey)}">Claim</button>`:badge('ACTIVE','info')}</div></article>`).join('')||empty('No active challenges')}</div>`,{eyebrow:cadence.toUpperCase()})).join('')}`;
  bindActionForms(root,'challenges',fresh=>renderChallenges(root,fresh));
}
