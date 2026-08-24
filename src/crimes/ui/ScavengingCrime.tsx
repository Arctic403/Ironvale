import React from "react";
import { Button } from "../../components/ui";
import { GameIcon } from "../../components/GameIcon";
import { money } from "../../core/gameCore";
import { getItem } from "../../data/items";
import type { CrimeCareerDefinition } from "../core/types";
import { SCAVENGE_LOCATIONS } from "../modules/theft";
import { crimeCareerMasteryLevel, formatRiftCityTime, scavengingOpportunity, scavengingOpportunityLabel, scavengingOpportunityTrend, scavengingOutcomeRates } from "../../systems/crimeCareerSystem";
import { CrimeRequiredItems } from "./CrimeRequiredItems";
import type { CrimeGame, FeedbackRenderer, WithCrimeFeedback } from "./types";

export function ScavengingCrime({g,career,now,incapacitated,feedbackBusy,withCrimeFeedback,renderFeedback}:{g:CrimeGame;career:CrimeCareerDefinition;now:number;incapacitated:boolean;feedbackBusy:boolean;withCrimeFeedback:WithCrimeFeedback;renderFeedback:FeedbackRenderer}) {
  const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery[career.id]??0);
  const clock=formatRiftCityTime(now);
  return <div className="crime-detail-stack">
    <div className="crime-mechanic-note"><GameIcon name="clock" size={16}/><div><strong>REAL-TIME OPPORTUNITY</strong><span>Opportunity follows the real clock instead of bouncing randomly. Commuter, nightlife, harbor, casino and premium areas rise and fall on different daily schedules, with small weekday/weekend changes.</span></div></div>
    <div className="crime-live-row"><span><GameIcon name="clock" size={13}/>Current city time <b>{clock}</b></span><span>Scavenging Mastery <b>{mastery}/100</b></span></div>
    <div className="scavenge-grid">{SCAVENGE_LOCATIONS.map((location)=>{
      const opp=scavengingOpportunity(location,now); const trend=scavengingOpportunityTrend(location,now); const opportunityLabel=scavengingOpportunityLabel(opp);
      const masteryLocked=mastery<location.masteryRequired; const missingItems=(location.requiredItems??[]).filter((id)=>(g.gameState.inventory[id]||0)<=0); const itemLocked=missingItems.length>0; const locked=masteryLocked||itemLocked;
      const outcomeRates=scavengingOutcomeRates(location,mastery,g.gameState.heat,opp);
      const accessLabel=location.requiredItems?.length?`Requires ${location.requiredItems.map((id)=>getItem(id)?.name??id).join(" + ")}`:location.masteryRequired>1?`Mastery ${location.masteryRequired}`:"Open";
      const key=`scavenge:${location.id}`;
      return <article key={location.id} className={`scavenge-card ${locked?"locked":""}`}>
        <header><div><small>{location.district}</small><h4>{location.name}</h4></div><div className="scavenge-opportunity-readout"><strong>{opp}%</strong><small>{opportunityLabel} · {trend}</small></div></header>
        <p>{location.description}</p><div className="opportunity-meter" aria-label={`${location.name} opportunity ${opp}%`}><span style={{left:`${opp}%`}}/><i style={{width:`${opp}%`}}/></div>
        <div className="scavenge-schedule-line"><span>Best window <b>{location.peakLabel}</b></span><span>Access <b>{accessLabel}</b></span><span>Lucky find <b>{outcomeRates.luckyChance.toFixed(1)}%</b></span><span>Bust risk <b>{outcomeRates.bustChance.toFixed(1)}%</b></span></div>
        <div className="crime-mini-metrics"><span>{location.nerve} Nerve</span><span>{money(location.minReward)}–{money(location.maxReward)}</span><span>{location.lootHint}</span></div>
        <CrimeRequiredItems ids={location.requiredItems} inventory={g.gameState.inventory}/>
        <Button disabled={locked||incapacitated||g.gameState.nerve<location.nerve||feedbackBusy} onClick={()=>withCrimeFeedback({key,crimeId:"scavenging",subject:location.name,actionLabel:"Search area",district:location.district,label:"SEARCHING…"},()=>g.resolveScavenging(location.id))}>{masteryLocked?`Mastery ${location.masteryRequired} Required`:itemLocked?`Need ${missingItems.map((id)=>getItem(id)?.name??id).join(" + ")}`:`Search · ${opportunityLabel}`}</Button>
        {renderFeedback(key)}
      </article>;
    })}</div>
  </div>;
}
