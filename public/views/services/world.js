import { escapeHtml, money, timeUntil, dateTime, panel, badge, empty } from '../../ui/helpers.js';
import { bindActionForms } from './common.js';
import { state } from '../../ui/state.js';

export function renderWorldService(root,service,data) {
  if (service==='travel') return renderTravel(root,data);
  if (service==='production') return renderProduction(root,data);
  if (service==='status') return renderStatus(root,data);
  if (service==='events') return renderEvents(root,data);
  if (service==='casino') return renderCasino(root,data);
}

function renderTravel(root,data) {
  const s=data.state||{};
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">RIFT INTERNATIONAL AIRPORT</span><h2>Travel</h2><p>International travel uses server-owned fares, level gates and arrival timers.</p></div>
      <div class="service-kpis"><div><span>CURRENT REGION</span><strong>${escapeHtml((data.destinations||[]).find(d=>d.id===s.current_region)?.name||s.current_region||'RiftCity')}</strong></div><div><span>STATUS</span><strong>${s.traveling_to?'IN TRANSIT':'READY'}</strong></div></div>
    </section>
    ${s.traveling_to?`<div class="travel-progress"><span class="eyebrow">IN TRANSIT</span><h3>${escapeHtml((data.destinations||[]).find(d=>d.id===s.traveling_to)?.name||s.traveling_to)}</h3><strong>${escapeHtml(timeUntil(s.arrives_at))}</strong><small>Arrival is settled by the server.</small></div>`:''}
    <div class="destination-grid">${(data.destinations||[]).map(dest=>{
      const here=s.current_region===dest.id&&!s.traveling_to;
      return `<article class="destination-card ${here?'current':''}"><header><div><span class="eyebrow">${escapeHtml(dest.country)}</span><h3>${escapeHtml(dest.name)}</h3></div>${here?badge('YOU ARE HERE','success'):badge(`LVL ${dest.levelRequired}`)}</header><div class="stat-list compact"><div><span>Fare</span><strong>${money(dest.fare)}</strong></div><div><span>Travel time</span><strong>${dest.durationSeconds?escapeHtml(timeUntil(Date.now()+dest.durationSeconds*1000)):'Local'}</strong></div><div><span>Offshore bank</span><strong>${dest.offshoreBanking?'YES':'NO'}</strong></div></div>${!here&&!s.traveling_to?`<button class="rc-button primary wide" data-service-action="depart" data-destination-id="${escapeHtml(dest.id)}">Travel to ${escapeHtml(dest.name)}</button>`:''}${here&&dest.offshoreBanking?'<a class="rc-button wide" href="#offshore" data-route="offshore">Open Offshore Bank</a>':''}</article>`;
    }).join('')}</div>`;
  bindActionForms(root,'travel',fresh=>renderTravel(root,fresh));
}

function renderProduction(root,data) {
  const ownedIds=new Set((data.ownedFacilities||[]).map(x=>x.facility_id));
  const active=(data.batches||[]).filter(b=>!b.claimed);
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">GREYWATER WORKSHOPS</span><h2>Production</h2><p>Facilities run timed server batches and place completed outputs into your persistent inventory.</p></div><div class="service-kpis"><div><span>FACILITIES</span><strong>${ownedIds.size}</strong></div><div><span>ACTIVE BATCHES</span><strong>${active.length}</strong></div></div></section>
    ${panel('Facilities',`<div class="production-grid">${(data.facilities||[]).map((fac,index)=>`<article class="facility-card ${ownedIds.has(fac.id)?'owned':''}"><header><div><span class="eyebrow">TIER ${index+1}</span><h3>${escapeHtml(fac.name)}</h3></div>${ownedIds.has(fac.id)?badge('OWNED','success'):badge(money(fac.price))}</header><p>${escapeHtml(fac.description)}</p><div class="stat-list compact"><div><span>Slots</span><strong>${fac.slots}</strong></div><div><span>Level</span><strong>${fac.levelRequired}</strong></div></div>${!ownedIds.has(fac.id)?`<button class="rc-button primary" data-service-action="buy-facility" data-facility-id="${escapeHtml(fac.id)}">Buy facility</button>`:''}</article>`).join('')}</div>`,{eyebrow:'WORKSHOP SPACE'})}
    ${panel('Recipes',`<div class="recipe-grid">${(data.recipes||[]).map(recipe=>`<article class="recipe-card"><span class="eyebrow">PRODUCTION RECIPE</span><h3>${escapeHtml(recipe.name)}</h3><div class="stat-list compact"><div><span>Cost</span><strong>${money(recipe.cashCost)}</strong></div><div><span>Duration</span><strong>${escapeHtml(timeUntil(Date.now()+recipe.durationSeconds*1000))}</strong></div><div><span>Facility tier</span><strong>${Number(recipe.facilityLevel)+1}</strong></div><div><span>Outputs</span><strong>${(recipe.outputs||[]).map(o=>`${escapeHtml(o.itemId)} x${o.quantity}`).join(', ')}</strong></div></div>${ownedIds.size?`<form data-service-form data-action="start"><select name="facilityId">${(data.facilities||[]).filter(f=>ownedIds.has(f.id)).map(f=>`<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('')}</select><input type="hidden" name="recipeId" value="${escapeHtml(recipe.id)}"><button class="rc-button">Start batch</button></form>`:''}</article>`).join('')}</div>`,{eyebrow:'BATCH CATALOG'})}
    ${panel('Batch Queue',active.length?`<div class="batch-list">${active.map(batch=>`<article class="list-card"><div><strong>${escapeHtml((data.recipes||[]).find(r=>r.id===batch.recipe_id)?.name||batch.recipe_id)}</strong><small>${escapeHtml((data.facilities||[]).find(f=>f.id===batch.facility_id)?.name||batch.facility_id)}</small></div><div><span>${Number(batch.completes_at)<=Date.now()?'READY':escapeHtml(timeUntil(batch.completes_at))}</span>${Number(batch.completes_at)<=Date.now()?`<button class="rc-button primary small" data-service-action="claim" data-batch-id="${escapeHtml(batch.id)}">Collect</button>`:''}</div></article>`).join('')}</div>`:empty('No active production'),{eyebrow:'LIVE PRODUCTION'})}`;
  bindActionForms(root,'production',fresh=>renderProduction(root,fresh));
}

function renderStatus(root,data) {
  const s=data.status||{}, player=data.player||state.player||{};
  const type=String(s.type||'active');
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">PLAYER STATUS NETWORK</span><h2>${type==='hospitalized'?'Mercy Point Medical':type==='jailed'?'Blackridge Detention':'Status Center'}</h2><p>Hospital, jail, travel and other blocking statuses are stored on the player server record.</p></div><div class="status-orb ${escapeHtml(type)}"><span>STATUS</span><strong>${escapeHtml(type.toUpperCase())}</strong></div></section>
    <div class="status-board">
      <div><span>Reason</span><strong>${escapeHtml(s.reason||'No active restriction')}</strong></div>
      <div><span>Remaining</span><strong>${s.until?escapeHtml(timeUntil(s.until)):'Ready'}</strong></div>
      <div><span>Until</span><strong>${escapeHtml(dateTime(s.until))}</strong></div>
    </div>
    <div class="two-col">
      ${panel('Hospital',`<p>Combat and crime injuries send players to Mercy Point Medical. Recovery is automatic when the server timer expires.</p>${type==='hospitalized'?badge('CURRENTLY ADMITTED','danger'):badge('NOT HOSPITALIZED','success')}`,{eyebrow:'MERCY POINT'})}
      ${panel('Jail',`<p>Crime consequences can send players to Blackridge Detention. Sentence restrictions clear when the authoritative timer expires.</p>${type==='jailed'?badge('CURRENTLY DETAINED','danger'):badge('NOT JAILED','success')}`,{eyebrow:'BLACKRIDGE'})}
    </div>`;
}

function renderEvents(root,data) {
  const event=data.event||data.activeEvent||data.current||data.events?.active||data;
  const effects=event?.effects||{};
  root.innerHTML=`
    <section class="event-hero"><span class="eyebrow">ACTIVE CITY CONDITION</span><h2>${escapeHtml(event?.name||'RiftCity Event Cycle')}</h2><p>${escapeHtml(event?.description||'Rotating city conditions alter selected server systems.')}</p></section>
    ${panel('Active Modifiers',Object.keys(effects).length?`<div class="modifier-grid">${Object.entries(effects).map(([k,v])=>`<div><span>${escapeHtml(k)}</span><strong>${typeof v==='number'&&v<2?`${((v-1)*100>=0?'+':'')}${Math.round((v-1)*100)}%`:escapeHtml(v)}</strong></div>`).join('')}</div>`:empty('No visible modifiers'),{eyebrow:'SERVER EFFECTS'})}
    <div class="info-banner">World events rotate on the server. The frontend displays their effects but never calculates crime, gym, job, market or combat outcomes itself.</div>`;
}

function renderCasino(root,data) {
  const chips=Number(data.state?.chips)||0;
  root.innerHTML=`
    <section class="casino-hero"><div><span class="eyebrow">THE MERIDIAN</span><h2>Casino Floor</h2><p>Fictional in-game chips only. Every table result is resolved and persisted by the server.</p></div><div class="chip-balance"><span>CHIPS</span><strong>${chips}</strong><button class="rc-button primary" data-service-action="claim-daily">Claim ${data.dailyChipGrant||75} daily chips</button></div></section>
    <div class="casino-floor">${(data.games||[]).map((game,index)=>`<article class="casino-game game-${index}"><div class="game-mark">${['♠','◆','●','⚄','▥','▦','♞','♣'][index]||'◆'}</div><span class="eyebrow">IN-GAME CHIPS</span><h3>${escapeHtml(game.name)}</h3><p>${escapeHtml(game.description||'Server-resolved casino round.')}</p><form data-service-form data-action="play"><input type="hidden" name="gameId" value="${escapeHtml(game.id)}"><input name="wager" type="number" min="${game.minBet||1}" max="${game.maxBet||25}" value="${game.minBet||1}"><button class="rc-button primary">Play</button></form></article>`).join('')}</div>
    ${panel('Recent Casino Rounds',`<div class="ledger-list">${(data.history||[]).map(h=>`<div class="ledger-row"><div><strong>${escapeHtml(h.game_id)}</strong><small>${escapeHtml(h.result_text||'')}</small></div><span>${h.payout-h.wager>=0?'+':''}${h.payout-h.wager} chips</span><b>${escapeHtml(dateTime(h.created_at))}</b></div>`).join('')||empty('No casino rounds yet')}</div>`,{eyebrow:'SERVER HISTORY'})}`;
  bindActionForms(root,'casino',fresh=>renderCasino(root,fresh));
}
