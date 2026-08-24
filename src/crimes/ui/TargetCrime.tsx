import React, { useState } from "react";
import { Button } from "../../components/ui";
import { GameIcon } from "../../components/GameIcon";
import { formatTime, money } from "../../core/gameCore";
import type { CrimeCareerDefinition } from "../core/types";
import { buildCrimeTargets, targetSuccessChance } from "../../systems/crimeActivities";
import { crimeCareerMasteryLevel } from "../../systems/crimeCareerSystem";
import { getCrimeTool, recommendedCrimeTools } from "../../systems/crimeTools";
import type { CrimeGame, FeedbackRenderer, WithCrimeFeedback } from "./types";

export function TargetCrime({g,career,boardSeed,boardRefreshRemaining,incapacitated,feedbackBusy,withCrimeFeedback,renderFeedback}:{g:CrimeGame;career:CrimeCareerDefinition;boardSeed:number;boardRefreshRemaining:number;incapacitated:boolean;feedbackBusy:boolean;withCrimeFeedback:WithCrimeFeedback;renderFeedback:FeedbackRenderer}) {
  const [targetTool,setTargetTool]=useState(""); if(!career.targetKind)return null;
  const targets=buildCrimeTargets(career.targetKind,boardSeed); const legacyId=career.targetKind==="vehicle"?"vehicle-theft":career.targetKind; const tools=recommendedCrimeTools(legacyId); const tool=getCrimeTool(targetTool); const ownedTool=tool?(g.gameState.inventory[tool.id]||0):0; const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery[career.id]??0);
  return <div className="crime-detail-stack"><div className="crime-live-row"><span><GameIcon name="clock" size={13}/>Targets refresh in <b>{formatTime(boardRefreshRemaining)}</b></span><span>Scout = <b>1 Nerve</b> + clearer intel + success bonus</span></div>
    {tools.length>0&&<div className="crime-prep-line"><label>Optional one-use prep<select value={targetTool} onChange={(e)=>setTargetTool(e.target.value)}><option value="">No tool</option>{tools.map((entry)=><option key={entry.id} value={entry.id} disabled={(g.gameState.inventory[entry.id]||0)<=0}>{entry.name} · owned {g.gameState.inventory[entry.id]||0}</option>)}</select></label>{tool&&<small>{tool.description} {ownedTool>0?"Consumed on attempt.":"Not owned."}</small>}</div>}
    <div className="crime-target-grid career-target-grid">{targets.map((target)=>{const scouted=g.gameState.scoutedCrimeTargets.includes(target.id);const resolved=g.gameState.resolvedCrimeTargets.includes(target.id);const chance=targetSuccessChance(target,g.gameState.crimeSkillXp[target.family]??0,g.combatStats.dexterity,g.gameState.heat,scouted,g.gameState.streetReputation)+(ownedTool>0&&tool?(tool.modifiers.chanceModifier??0):0);const key=`target:${target.id}`;return <article key={target.id} className={`crime-target-card ${scouted?"scouted":""} ${resolved?"resolved":""}`}>
      <header><span className="target-icon"><GameIcon name={career.icon} size={18}/></span><div><small>{target.area}</small><h4>{target.name}</h4></div><span className="target-state">{resolved?"GONE":scouted?"SCOUTED":"LIVE"}</span></header><p>{scouted?target.hint:"Scout this target to reveal the full payout, Heat and difficulty profile."}</p>
      <div className="target-intel-grid"><span><small>Mastery</small><strong>{mastery}</strong></span><span><small>Chance</small><strong>{scouted?`${Math.max(4,Math.min(97,chance)).toFixed(0)}%`:"???"}</strong></span><span><small>Reward</small><strong>{scouted?`${money(target.minReward)}–${money(target.maxReward)}`:"???"}</strong></span><span><small>Heat</small><strong>{scouted?`+${target.heat}`:"???"}</strong></span></div>
      <div className="target-actions"><Button disabled={resolved||scouted||incapacitated||g.gameState.nerve<1||feedbackBusy} onClick={()=>withCrimeFeedback({key,crimeId:career.id,subject:target.name,actionLabel:"Scout target",district:target.area,label:"SCOUTING THE TARGET…"},()=>g.scoutCrimeTarget(target.id))}>Scout</Button><Button disabled={resolved||incapacitated||g.gameState.nerve<target.nerve||feedbackBusy} onClick={()=>withCrimeFeedback({key,crimeId:career.id,subject:target.name,actionLabel:`Attempt ${career.name}`,district:target.area,label:"MAKING THE ATTEMPT…"},()=>g.resolveCrimeTarget(target,ownedTool>0?targetTool:null))}>Attempt · {target.nerve} Nerve</Button></div>{renderFeedback(key)}
    </article>;})}</div>
  </div>;
}
