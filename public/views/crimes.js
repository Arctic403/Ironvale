import { api, getService } from '../ui/api.js';
import { state, setPlayer } from '../ui/state.js';
import { escapeHtml, money, progress, panel, badge } from '../ui/helpers.js';
import { renderPlayerHud, refreshEffects } from '../ui/shell.js';

let inlineResult=null;
let busy=false;

export async function renderCrimes(root) {
  const [result,careers]=await Promise.all([api('/api/crimes'),getService('crime-careers')]);
  if (!result.ok) {
    root.innerHTML=`<div class="rc-error"><strong>Crime engine unavailable</strong><p>${escapeHtml(result.error||'Could not load crimes')}</p></div>`;
    return;
  }
  state.crimes=result;
  if (result.player) { setPlayer(result.player); renderPlayerHud(result.player); }
  draw(root,result,careers.ok?careers:null);
}

function draw(root,result,careers=null) {
  const crimes=result.crimes||[], history=result.history||[];
  root.innerHTML=`
    <section class="crime-hero">
      <div><span class="eyebrow">SERVER CRIME ENGINE</span><h2>Crime Careers</h2><p>Outcomes, rewards, mastery and consequences are resolved by the Worker. The client only presents the opportunity.</p></div>
      <div class="crime-summary"><span>HEAT</span><strong>${result.law?.heat||0}/100</strong><small>${escapeHtml(result.law?.tier?.name||'Clear')} · ${crimes.filter(c=>c.available).length}/${crimes.length} available</small></div>
    </section>
    <div class="crime-career-toolbar"><a class="rc-button" href="#crime-careers" data-route="crime-careers">Operations & Street Rep</a><a class="rc-button" href="#law" data-route="law">Heat / Police</a>${careers?`<span>Street Rep <strong>${careers.state?.reputation||0}</strong> · Active Ops <strong>${(careers.active||[]).filter(x=>x.status==='active').length}</strong></span>`:''}</div><div class="crime-layout-v2">
      <section class="crime-careers">
        ${crimes.map(crime=>crimeCard(crime)).join('')||'<div class="rc-empty">No crimes installed.</div>'}
      </section>
      <aside class="crime-history-panel">
        <header><span class="eyebrow">RECENT ACTIVITY</span><h3>Attempt Log</h3></header>
        ${(history||[]).map(entry=>`<article class="history-row ${entry.success?'success':'failure'}"><div><strong>${escapeHtml(entry.crimeName)}</strong><small>${new Date(entry.createdAt).toLocaleString()}</small></div><b>${entry.success?'SUCCESS':'FAILED'}</b><p>${escapeHtml(entry.text)}</p></article>`).join('')||'<div class="rc-empty">No attempts yet.</div>'}
      </aside>
    </div>`;
  root.querySelectorAll('[data-run-crime]').forEach(button=>button.addEventListener('click',()=>runCrime(root,button.dataset.runCrime)));
}

function crimeCard(crime) {
  const chance=Math.round((Number(crime.successChance)||0)*100);
  const mode=String(crime.category||'street').toLowerCase();
  const required=crime.requiredItem;
  const result=inlineResult?.crimeId===crime.id?inlineMarkup(inlineResult):'';
  return `<article class="crime-card-v2 crime-mode-${escapeHtml(mode)} ${crime.available?'':'locked'}">
    <div class="crime-card-accent"></div>
    <header><div><span class="eyebrow">${escapeHtml(String(crime.category||'crime').toUpperCase())}</span><h3>${escapeHtml(crime.name)}</h3></div><div class="chance-ring" style="--chance:${chance}"><strong>${chance}%</strong><small>chance</small></div></header>
    <p>${escapeHtml(crime.description)}</p><div class="tag-row"><span>${escapeHtml(String(crime.uiType||'target').toUpperCase())}</span><span>HEAT +${crime.heat?.success||0}/+${crime.heat?.failure||0}</span>${crime.modifiers?.heatPenalty?`<span>HEAT PENALTY -${Math.round(crime.modifiers.heatPenalty*100)}%</span>`:''}</div>
    <div class="crime-progress">
      <div><span>Mastery</span><strong>${escapeHtml(crime.mastery)}/100</strong></div>
      <div class="rc-meter"><span style="width:${progress(crime.mastery,100)}%"></span></div>
    </div>
    <div class="crime-metrics-v2">
      <div><span>Nerve</span><strong>${escapeHtml(crime.nerveCost)}</strong></div>
      <div><span>Attempts</span><strong>${escapeHtml(crime.attempts)}</strong></div>
      <div><span>Record</span><strong>${escapeHtml(crime.successes)}W / ${escapeHtml(crime.failures)}L</strong></div>
    </div>
    <div class="crime-requirement-row">
      ${required?badge(`${required.name} · ${required.owned>0?'OWNED':'REQUIRED'}`,required.owned>0?'success':'danger'):badge('NO TOOL REQUIRED','success')}
      ${(crime.lockedReasons||[]).map(r=>badge(r,'danger')).join('')}
    </div>
    <div class="crime-approach-row"><label><span>Approach</span><select data-crime-approach="${escapeHtml(crime.id)}"><option value="quiet">Quiet · safer / lower reward</option><option value="balanced" selected>Balanced</option><option value="bold">Bold · riskier / higher reward</option></select></label></div><button class="rc-button primary wide" data-run-crime="${escapeHtml(crime.id)}" ${crime.available?'':'disabled'}>${crime.available?`Attempt · ${crime.nerveCost} nerve`:'Unavailable'}</button>
    ${result}
  </article>`;
}

function inlineMarkup(result) {
  const tone=result.error?'error':result.success?'success':'failure';
  const details=[];
  if (!result.error) {
    if (Number(result.cashDelta)) details.push(`${result.cashDelta>0?'+':''}${money(result.cashDelta)} cash`);
    if (Number(result.xpDelta)) details.push(`+${result.xpDelta} XP`);
    if (Number(result.masteryDelta)) details.push(`+${result.masteryDelta} mastery`);
    if (Number(result.nerveSpent)) details.push(`-${result.nerveSpent} nerve`);
    if (result.approach) details.push(`${result.approach} approach`);
    if (result.itemReward?.name) details.push(`Found ${result.itemReward.name}${Number(result.itemReward.quantity)>1?` x${result.itemReward.quantity}`:''}`);
  }
  return `<div class="inline-result ${tone}"><header><strong>${result.error?'BLOCKED':result.success?'SUCCESS':'FAILED'}</strong>${result.chance!=null?`<span>${Math.round(Number(result.chance)*100)}% roll</span>`:''}</header><p>${escapeHtml(result.text||'Crime resolved.')}</p>${details.length?`<div>${details.map(d=>`<span>${escapeHtml(d)}</span>`).join('')}</div>`:''}</div>`;
}

async function runCrime(root,crimeId) {
  if (busy) return;
  busy=true; inlineResult=null;
  const button=root.querySelector(`[data-run-crime="${CSS.escape(crimeId)}"]`);
  if (button) { button.disabled=true; button.textContent='Resolving on server…'; }
  const approach=root.querySelector(`[data-crime-approach="${CSS.escape(crimeId)}"]`)?.value||'balanced';
  const result=await api('/api/crimes/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crimeId,approach})});
  busy=false;
  if (!result.ok) inlineResult={crimeId,error:true,success:false,text:result.error||'Attempt failed.'};
  else {
    inlineResult={...(result.result||{}),crimeId};
    if (result.player) { setPlayer(result.player); renderPlayerHud(result.player); }
  }
  state.inventory=null;
  const fresh=await api('/api/crimes');
  if (fresh.ok) { state.crimes=fresh; const careers=await getService('crime-careers'); draw(root,fresh,careers.ok?careers:null); }
  refreshEffects();
}
