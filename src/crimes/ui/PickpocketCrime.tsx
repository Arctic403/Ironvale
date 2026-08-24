import React, { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui";
import { GameIcon } from "../../components/GameIcon";
import type { CrimeCareerDefinition } from "../core/types";
import { crimeCareerMasteryLevel } from "../../systems/crimeCareerSystem";
import { targetSuccessChance } from "../../systems/crimeActivities";
import { getCrimeTool, recommendedCrimeTools } from "../../systems/crimeTools";
import { spawnLivePickpocket, type LivePickpocketNpc } from "../../systems/crimeV5";
import type { CrimeGame, FeedbackRenderer, WithCrimeFeedback } from "./types";

export function PickpocketCrime({g,career,now,incapacitated,feedbackBusy,withCrimeFeedback,renderFeedback}:{g:CrimeGame;career:CrimeCareerDefinition;now:number;incapacitated:boolean;feedbackBusy:boolean;withCrimeFeedback:WithCrimeFeedback;renderFeedback:FeedbackRenderer}) {
  const [targetTool,setTargetTool]=useState("");
  const [targets,setTargets]=useState<LivePickpocketNpc[]>(()=>[0,1,2].map((i)=>spawnLivePickpocket(Date.now(),i)));
  const [index,setIndex]=useState(0); const [crowdUntil,setCrowdUntil]=useState(()=>Date.now()+18000); const sequence=useRef(3); const needleRef=useRef<HTMLSpanElement|null>(null);
  const refresh=()=>{const base=Date.now();const crowd=[0,1,2].map(()=>{sequence.current+=1;return spawnLivePickpocket(base,sequence.current);});setTargets(crowd);setIndex(0);setCrowdUntil(base+18000);};
  useEffect(()=>{if(!feedbackBusy&&now>=crowdUntil)refresh();},[now,crowdUntil,feedbackBusy]);
  const pointerPercent=()=>{const needle=needleRef.current;const track=needle?.parentElement;if(!needle||!track)return 50;const nr=needle.getBoundingClientRect(),tr=track.getBoundingClientRect();return Math.max(0,Math.min(100,((nr.left+nr.width/2-tr.left)/Math.max(1,tr.width))*100));};
  const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery[career.id]??0); const npc=targets[index]??targets[0]; if(!npc)return null;
  const tool=getCrimeTool(targetTool); const ownedTool=tool?(g.gameState.inventory[tool.id]||0):0; const tools=recommendedCrimeTools("pickpocket"); const crackdown=g.gameState.activeWorldEvent==="guard-crackdown"; const remaining=Math.max(0,crowdUntil-now);
  const baseChance=targetSuccessChance(npc.target,g.gameState.crimeSkillXp.theft??0,g.combatStats.dexterity,g.gameState.heat,false,g.gameState.streetReputation);
  const revealWealth=mastery>=10,revealAwareness=mastery>=25,revealNumbers=mastery>=50,revealDanger=mastery>=75;
  const grab=()=>{const pos=pointerPercent();let label="EMPTY POCKET",chanceModifier=-7,rewardMultiplier=.82,heatModifier=0,arrestModifier=1;if(pos>=39&&pos<=61){label="CLEAN LIFT";chanceModifier=13;rewardMultiplier=1.2;arrestModifier=-2;}else if(pos>=29&&pos<=71){label="EDGE GRAB";chanceModifier=4;rewardMultiplier=1.03;heatModifier=1;}else if(pos<15||pos>85){label="DANGER ZONE";chanceModifier=-18;rewardMultiplier=.82;heatModifier=3;arrestModifier=8;}if(crackdown){chanceModifier-=6;heatModifier+=2;arrestModifier+=4;}withCrimeFeedback({key:"pickpocket:live",crimeId:"pickpocket",subject:npc.name,actionLabel:"Pocket grab",district:npc.area,label:`${label}…`},()=>g.resolveCrimeTarget(npc.target,ownedTool>0?targetTool:null,{chanceModifier,rewardMultiplier,heatModifier,arrestModifier,story:`Minigame: ${label}`}),refresh);};
  return <div className="crime-detail-stack pickpocket-chain-system">
    <div className="crime-mechanic-note"><GameIcon name="target" size={16}/><div><strong>TARGET CHAIN · POCKET ZONE</strong><span>Pick one of three people, then hit GRAB while the marker crosses the pocket zone. The center is safest and most valuable; the red edges are dangerous.</span></div></div>
    {crackdown?<div className="pickpocket-crackdown"><GameIcon name="warning" size={14}/><div><strong>GUARD CRACKDOWN ACTIVE</strong><span>Street pressure makes every grab harder and adds extra Heat.</span></div></div>:null}
    <div className="pickpocket-crowd-head"><span>CROWD REFRESH</span><strong>{Math.ceil(remaining/1000)}s</strong></div>
    <div className="pickpocket-target-chain">{targets.map((target,i)=><button type="button" key={target.id} className={`${i===index?"active":""} ${target.rare?"rare":""}`} onClick={()=>setIndex(i)}><span><GameIcon name={target.rare?"crown":"character"} size={20}/></span><strong>{target.name}</strong><small>{target.area}</small><em>{revealWealth?target.wealth:"Unknown value"}</em></button>)}</div>
    <article className="pickpocket-focus-card"><header><div><small>{npc.area} · {npc.movement}</small><h3>{npc.name}</h3></div><span>{npc.rare?"RARE TARGET":"SELECTED"}</span></header>
      <div className="pickpocket-focus-meta"><span>Wealth <b>{revealWealth?npc.wealth:"???"}</b></span><span>Awareness <b>{revealAwareness?npc.awareness:"???"}</b></span><span>Nerve <b>{npc.target.nerve}</b></span>{revealNumbers?<span>Base odds <b>{baseChance.toFixed(0)}%</b></span>:null}</div>
      <div className="pickpocket-clues compact"><div>{npc.clues.slice(0,2).map((clue)=><span key={clue}>{clue}</span>)}</div></div>{revealDanger&&npc.dangerNote?<div className="pedestrian-warning"><GameIcon name="warning" size={13}/>{npc.dangerNote}</div>:null}
      <div className="pocket-minigame"><div className="pocket-zone-track"><i className="zone danger left"/><i className="zone pocket"/><i className="zone danger right"/><span ref={needleRef} className={`pocket-needle difficulty-${npc.target.difficulty>=55?"hard":npc.target.difficulty>=38?"medium":"easy"}`}/></div><div className="pocket-zone-legend"><span>Danger</span><b>POCKET</b><span>Danger</span></div></div>
      {tools.length>0&&<div className="crime-prep-line compact"><label>Prep<select value={targetTool} onChange={(e)=>setTargetTool(e.target.value)}><option value="">None</option>{tools.map((entry)=><option key={entry.id} value={entry.id} disabled={(g.gameState.inventory[entry.id]||0)<=0}>{entry.name} · {g.gameState.inventory[entry.id]||0}</option>)}</select></label></div>}
      <Button disabled={incapacitated||g.gameState.nerve<npc.target.nerve||feedbackBusy} onClick={grab}>GRAB · {npc.target.nerve} Nerve</Button><small className="pedestrian-mastery-hint">No Let Pass button: the crowd rotates automatically. Mastery reveals more target intel.</small>
    </article>{renderFeedback("pickpocket:live")}
  </div>;
}
