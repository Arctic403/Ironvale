import React, { useEffect, useMemo, useRef, useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";
import type { Activity } from "../types/riftCity";
import { Button } from "../components/ui";
import { GameIcon } from "../components/GameIcon";
import { ItemImage } from "../components/ItemImage";
import { formatTime, money } from "../core/gameCore";
import { getItem } from "../data/items";
import {
  CRIMES, Crime, CrimeRunModifiers, applyCrimeEventOption, crimeSuccessChance,
  getCrimeStatBonus, emptyCrimeRunModifiers, generateCrimeEvents,
} from "../systems/crimeSystem";
import { getCrimeTool, recommendedCrimeTools } from "../systems/crimeTools";
import {
  CRIME_FAMILY_LABELS, CRIME_OPERATIONS, GRAFFITI_SPOTS, CrimeFamily,
  buildCrimeTargets, crimeFamilyLevel, crimeFamilyProgress, crimeTargetBoardSeed,
  graffitiRank, graffitiSuccessChance, targetSuccessChance,
} from "../systems/crimeActivities";
import {
  CRIME_CAREERS, SCAVENGE_LOCATIONS, SHOPLIFT_STORES, CrimeCareerDefinition,
  careerActionSuccessChance, crimeCareerMasteryLevel, crimeCareerMasteryProgress,
  crimeCityConditions, formatRiftCityTime, getShopliftingConditions, masteryRank, scavengingOpportunity,
  scavengingOpportunityLabel, scavengingOpportunityTrend, scavengingOutcomeRates, shopliftingSuspicion,
} from "../systems/crimeCareerSystem";
import {
  CRIME_SIGNATURES, getCrimeContextPulse, spawnLivePickpocket, type LivePickpocketNpc,
} from "../systems/crimeV5";
import { buildCrimeDialogue, type CrimeDialogue } from "../systems/crimeDialogue";

type Game = ReturnType<typeof useRiftCity>;
type ActiveRun={crime:Crime;choiceId:string;toolId:string|null;events:ReturnType<typeof generateCrimeEvents>;stage:number;mods:CrimeRunModifiers};
type CrimeFeedbackSnapshot={cash:number;nerve:number;heat:number;xp:number;crimeExperience:number;streetReputation:number;health:number;jailUntil:number|null;inventory:Record<string,number>;masteryXp:number};
type CrimeFeedbackDelta={label:string;value:string;tone:"good"|"bad"|"neutral";itemId?:string};
type CrimeFeedback={
  key:string;crimeId:string;subject:string;actionLabel:string;district?:string;
  phase:"loading"|"awaiting"|"result";label:string;baseline:number|null;snapshot:CrimeFeedbackSnapshot;
  activity?:Activity;dialogue?:CrimeDialogue;deltas?:CrimeFeedbackDelta[];onResolved?:()=>void;
};

const operationById=(id:string)=>CRIME_OPERATIONS.find((item)=>item.id===id)??null;
const legacyById=(id:string)=>CRIMES.find((item)=>item.id===id)??null;
const riskClass=(risk:string)=>`risk-${risk.toLowerCase()}`;
const severityRoman=["","I","II","III","IV","V"] as const;

export function Crimes({ g }: { g: Game }) {
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [now,setNow]=useState(()=>Date.now());
  const [targetTool,setTargetTool]=useState("");
  const [shopBaskets,setShopBaskets]=useState<Record<string,string[]>>({});
  const [choices,setChoices]=useState<Record<string,string>>({});
  const [majorTools,setMajorTools]=useState<Record<string,string>>({});
  const [run,setRun]=useState<ActiveRun|null>(null);
  const [feedback,setFeedback]=useState<CrimeFeedback|null>(null);
  const [pickpocketNpc,setPickpocketNpc]=useState<LivePickpocketNpc>(()=>spawnLivePickpocket(Date.now(),0));
  const pickpocketSequence=useRef(0);
  const feedbackTimer=useRef<number|null>(null);
  const listScrollRef=useRef(0);
  const incapacitated=Boolean(g.gameState.jailUntil||g.gameState.hospitalUntil);

  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),250);return()=>window.clearInterval(timer);},[]);

  const makeFeedbackSnapshot=(crimeId:string):CrimeFeedbackSnapshot=>({
    cash:g.gameState.cash,nerve:g.gameState.nerve,heat:g.gameState.heat,xp:g.gameState.xp,crimeExperience:g.gameState.crimeExperience,
    streetReputation:g.gameState.streetReputation,health:g.gameState.health,jailUntil:g.gameState.jailUntil,
    inventory:{...g.gameState.inventory},masteryXp:g.gameState.crimeMastery[crimeId]??0,
  });

  const buildFeedbackDeltas=(before:CrimeFeedbackSnapshot,crimeId:string):CrimeFeedbackDelta[]=>{
    const out:CrimeFeedbackDelta[]=[];
    const signed=(value:number)=>`${value>0?"+":""}${value}`;
    const add=(label:string,value:string,tone:CrimeFeedbackDelta["tone"],itemId?:string)=>out.push({label,value,tone,itemId});
    const cash=g.gameState.cash-before.cash;if(cash)add("Cash",`${cash>0?"+":"-"}${money(Math.abs(cash))}`,cash>0?"good":"bad");
    const nerve=g.gameState.nerve-before.nerve;if(nerve)add("Nerve",signed(nerve),nerve>0?"good":"neutral");
    const heat=g.gameState.heat-before.heat;if(heat)add("Heat",signed(heat),heat<=0?"good":"bad");
    const xp=g.gameState.xp-before.xp;if(xp)add("XP",signed(xp),"good");
    const cxp=g.gameState.crimeExperience-before.crimeExperience;if(cxp)add("Crime XP",signed(cxp),"good");
    const rep=g.gameState.streetReputation-before.streetReputation;if(rep)add("Street Rep",signed(rep),rep>0?"good":"bad");
    const health=g.gameState.health-before.health;if(health)add("Health",signed(health),health>0?"good":"bad");
    const mastery=(g.gameState.crimeMastery[crimeId]??0)-before.masteryXp;if(mastery)add("Mastery XP",signed(mastery),"good");
    const itemIds=new Set([...Object.keys(before.inventory),...Object.keys(g.gameState.inventory)]);
    for(const id of itemIds){const diff=(g.gameState.inventory[id]||0)-(before.inventory[id]||0);if(!diff)continue;const item=getItem(id);add(item?.name??id,signed(diff),diff>0?"good":"neutral",id);if(out.length>=10)break;}
    if(g.gameState.jailUntil&&(!before.jailUntil||g.gameState.jailUntil>before.jailUntil))add("Status","JAILED","bad");
    return out;
  };

  useEffect(()=>{
    if(feedback?.phase!=="awaiting")return;
    const activity=g.gameState.activities[0];
    if(activity&&activity.id!==feedback.baseline){
      const deltas=buildFeedbackDeltas(feedback.snapshot,feedback.crimeId);
      const dialogue=buildCrimeDialogue({crimeId:feedback.crimeId,actionLabel:feedback.actionLabel,subject:feedback.subject,district:feedback.district,activityType:activity.type,activityId:activity.id,activityText:activity.text});
      const resolved=feedback.onResolved;
      setFeedback({...feedback,phase:"result",activity,dialogue,deltas,onResolved:undefined});
      resolved?.();
    }
  },[g.gameState.activities]);

  useEffect(()=>()=>{if(feedbackTimer.current)window.clearTimeout(feedbackTimer.current);},[]);

  const closeFeedback=()=>{
    if(feedbackTimer.current){window.clearTimeout(feedbackTimer.current);feedbackTimer.current=null;}
    setFeedback(null);
  };

  const spawnNextPedestrian=()=>{pickpocketSequence.current+=1;setPickpocketNpc(spawnLivePickpocket(Date.now(),pickpocketSequence.current));};

  useEffect(()=>{
    if(selectedId!=="pickpocket")return;
    if(feedback&&(feedback.phase==="loading"||feedback.phase==="awaiting"))return;
    if(now>=pickpocketNpc.expiresAt)spawnNextPedestrian();
  },[now,selectedId,pickpocketNpc.expiresAt,feedback]);

  const withCrimeFeedback=(meta:{key:string;crimeId:string;subject:string;actionLabel:string;district?:string;label:string},action:()=>void,onResolved?:()=>void)=>{
    if(feedback&&(feedback.phase==="loading"||feedback.phase==="awaiting"))return;
    if(feedbackTimer.current)window.clearTimeout(feedbackTimer.current);
    const baseline=g.gameState.activities[0]?.id??null;
    const snapshot=makeFeedbackSnapshot(meta.crimeId);
    setFeedback({...meta,phase:"loading",baseline,snapshot,onResolved});
    feedbackTimer.current=window.setTimeout(()=>{
      setFeedback((current:CrimeFeedback|null)=>current?.key===meta.key?{...current,phase:"awaiting"}:current);
      action();
    },620);
  };

  const feedbackTitle=(activity:Activity,current:CrimeFeedback)=>{
    if(activity.type==="jailed")return "BUSTED";
    if(activity.type==="critical")return /^CRITICAL FAIL/i.test(activity.text)?"CRITICAL FAILURE":activity.text.startsWith("LUCKY FIND")?"LUCKY FIND":"BIG SUCCESS";
    if(activity.type==="success")return "SUCCESS";
    if(activity.type==="spooked")return "FAILED — GOT OUT";
    if(activity.type==="failure")return activity.text.startsWith("BUSTED")?"BUSTED":"FAILED";
    if(current.actionLabel.toLowerCase().includes("scout"))return "INTEL UPDATED";
    if(current.actionLabel.toLowerCase().includes("launch")||current.actionLabel.toLowerCase().includes("setup"))return "OPERATION STARTED";
    return "UPDATE";
  };

  const feedbackTone=(activity?:Activity)=>activity&&activity.type==="critical"&&/^CRITICAL FAIL/i.test(activity.text)?"failure":activity?.type??"";

  const renderFeedback=(key:string)=>{
    if(!feedback||feedback.key!==key)return null;
    const activity=feedback.activity;
    const tone=feedbackTone(activity);
    return <section className={`crime-result-dialog ${feedback.phase} ${tone}`} role="status" aria-live="polite">
      <button type="button" className="crime-result-close" aria-label="Close result" onClick={closeFeedback}>×</button>
      {feedback.phase!=="result"?<div className="crime-result-loading"><span className="crime-feedback-spinner"><i/><i/><i/></span><div><small>LIVE ACTION</small><strong>{feedback.label}</strong><p>The result is resolving in the city simulation…</p></div></div>:<>
        <header className="crime-result-dialog-head"><span className="crime-feedback-result-icon"><GameIcon name={tone==="jailed"||tone==="failure"||tone==="spooked"?"warning":tone==="critical"?"crown":"awards"} size={20}/></span><div><small>{feedback.dialogue?.kicker??"The moment resolves."}</small><strong>{activity?feedbackTitle(activity,feedback):"RESULT"}</strong><span>{feedback.subject}</span></div></header>
        {feedback.dialogue?<div className="crime-result-story"><h4>{feedback.dialogue.headline}</h4><p>{feedback.dialogue.body}</p></div>:null}
        {feedback.deltas?.length?<div className="crime-result-ledger">{feedback.deltas.map((delta:CrimeFeedbackDelta,index:number)=><span key={`${delta.label}-${index}`} className={`${delta.tone} ${delta.itemId?"with-item-art":""}`}>{delta.itemId?<ItemImage itemId={delta.itemId} size={34}/>:null}<small>{delta.label}</small><strong>{delta.value}</strong></span>)}</div>:null}
        {activity?<div className="crime-result-logline"><small>RESULT DETAILS</small><p>{activity.text}</p></div>:null}
      </>}
    </section>;
  };

  const openCrime=(id:string)=>{listScrollRef.current=window.scrollY;setSelectedId(id);window.requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"auto"}));};
  const backToCrimes=()=>{setSelectedId(null);setRun(null);setTargetTool("");closeFeedback();window.requestAnimationFrame(()=>window.scrollTo({top:listScrollRef.current,behavior:"auto"}));};

  const selected=CRIME_CAREERS.find((crime)=>crime.id===selectedId)??null;
  const conditions=crimeCityConditions(now);
  const boardSeed=crimeTargetBoardSeed(now);
  const boardRefreshRemaining=5*60*1000-(now%(5*60*1000));

  const beginMajor=(crime:Crime,choiceId:string,toolId:string|null)=>{
    const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery[crime.id]??0);
    setRun({crime,choiceId,toolId,events:generateCrimeEvents(crime,mastery),stage:0,mods:emptyCrimeRunModifiers()});
  };

  const chooseEvent=(option:ActiveRun["events"][number]["options"][number])=>{
    if(!run)return;
    const mods=applyCrimeEventOption(run.mods,option);
    const stage=run.stage+1;
    if(stage>=run.events.length){const crime=run.crime;withCrimeFeedback({key:`major:${crime.id}`,crimeId:crime.id,subject:crime.name,actionLabel:"Resolve major job",label:"RESOLVING THE JOB…"},()=>g.commitCrime(crime,run.choiceId,mods,run.toolId));setRun(null);return;}
    setRun({...run,stage,mods});
  };

  const projectedMajorChance=useMemo(()=>{
    if(!run)return 0;
    const masteryXp=g.gameState.crimeMastery[run.crime.id]??0;
    const selectedChoice=run.crime.choices.find((choice)=>choice.id===run.choiceId)??run.crime.choices[1]??run.crime.choices[0];
    const tool=getCrimeTool(run.toolId);
    const toolBonus=tool&&(g.gameState.inventory[tool.id]||0)>0?(tool.modifiers.chanceModifier??0):0;
    const familyLevel=crimeFamilyLevel(g.gameState.crimeSkillXp.organized??0);
    return Math.max(2,Math.min(97,crimeSuccessChance(run.crime,g.gameState.crimeExperience,1,getCrimeStatBonus(g.combatStats)+(g.gameState.meritUpgrades["crime-edge"]??0)*2-Math.floor(g.gameState.heat/25)+familyLevel*.65,masteryXp,selectedChoice)+run.mods.chanceModifier+toolBonus));
  },[run,g.gameState.crimeExperience,g.gameState.crimeMastery,g.gameState.crimeSkillXp,g.gameState.meritUpgrades,g.gameState.heat,g.gameState.inventory,g.combatStats]);

  const renderRequirement=(ids:string[]|undefined)=>{
    if(!ids?.length)return null;
    return <div className="crime-required-items">{ids.map((id)=>{const item=getItem(id);const owned=g.gameState.inventory[id]||0;return <span key={id} className={owned>0?"owned":"missing"}><ItemImage itemId={id} size={28}/><span>{item?.name??id} · {owned}</span>{owned<=0?<GameIcon name="lock" size={11}/>:null}</span>;})}</div>;
  };

  const renderPickpocket=(career:CrimeCareerDefinition)=>{
    const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery[career.id]??0);
    const tool=getCrimeTool(targetTool); const ownedTool=tool?(g.gameState.inventory[tool.id]||0):0;
    const tools=recommendedCrimeTools("pickpocket");
    const chance=Math.max(4,Math.min(97,targetSuccessChance(pickpocketNpc.target,g.gameState.crimeSkillXp.theft??0,g.combatStats.dexterity,g.gameState.heat,false,g.gameState.streetReputation)+(ownedTool>0&&tool?(tool.modifiers.chanceModifier??0):0)));
    const remaining=Math.max(0,pickpocketNpc.expiresAt-now); const progress=Math.max(0,Math.min(100,remaining/pickpocketNpc.windowMs*100));
    const revealWealth=mastery>=10, revealAwareness=mastery>=25, revealNumbers=mastery>=50, revealDanger=mastery>=75;
    return <div className="crime-detail-stack pickpocket-live-system">
      <div className="crime-mechanic-note"><GameIcon name="character" size={16}/><div><strong>LIVE PEDESTRIAN STREAM</strong><span>No scouting and no Nerve cost for waiting. People pass through the city in real time; movement changes how long you have to decide, and the population mix changes with the actual time of day.</span></div></div>
      <div className="pedestrian-stage">
        <div className="pedestrian-stage-top"><span>LIVE STREET FEED</span><strong>{formatRiftCityTime(now)}</strong></div>
        <div className="pedestrian-lane"><div key={pickpocketNpc.id} className={`pedestrian-figure move-${pickpocketNpc.movement.toLowerCase()}`} style={{["--walk-duration" as string]:`${pickpocketNpc.windowMs}ms`}}><span className="pedestrian-avatar"><GameIcon name={pickpocketNpc.rare?"crown":"character"} size={34}/></span><span className="pedestrian-shadow"/></div></div>
        <div className="pedestrian-timer"><i style={{width:`${progress}%`}}/><span>{(remaining/1000).toFixed(1)}s</span></div>
      </div>
      <article className={`live-pedestrian-card ${pickpocketNpc.rare?"rare":""}`}>
        <header><div><small>{pickpocketNpc.area} · {pickpocketNpc.movement}</small><h3>{pickpocketNpc.name}</h3></div><span className="target-state">{pickpocketNpc.rare?"RARE":"PASSING"}</span></header>
        <p>{mastery>=5?pickpocketNpc.description:"You only have a moment to size them up."}</p>
        <div className="pedestrian-intel-grid">
          <span><small>Wealth</small><strong>{revealWealth?pickpocketNpc.wealth:"???"}</strong></span>
          <span><small>Awareness</small><strong>{revealAwareness?pickpocketNpc.awareness:"???"}</strong></span>
          <span><small>Success</small><strong>{revealNumbers?`${chance.toFixed(0)}%`:"???"}</strong></span>
          <span><small>Possible cash</small><strong>{revealNumbers?`${money(pickpocketNpc.target.minReward)}–${money(pickpocketNpc.target.maxReward)}`:"???"}</strong></span>
        </div>
        {revealDanger&&pickpocketNpc.dangerNote?<div className="pedestrian-warning"><GameIcon name="warning" size={13}/>{pickpocketNpc.dangerNote}</div>:null}
        {tools.length>0&&<div className="crime-prep-line"><label>Optional one-use prep<select value={targetTool} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setTargetTool(e.target.value)}><option value="">No tool</option>{tools.map((entry)=><option key={entry.id} value={entry.id} disabled={(g.gameState.inventory[entry.id]||0)<=0}>{entry.name} · owned {g.gameState.inventory[entry.id]||0}</option>)}</select></label>{tool&&<small>{tool.description}</small>}</div>}
        <div className="target-actions"><Button disabled={Boolean(feedback&&feedback.phase!=="result")} onClick={spawnNextPedestrian}>Let Them Pass</Button><Button disabled={incapacitated||g.gameState.nerve<pickpocketNpc.target.nerve||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>withCrimeFeedback({key:"pickpocket:live",crimeId:"pickpocket",subject:pickpocketNpc.name,actionLabel:"Pickpocket attempt",district:pickpocketNpc.area,label:"MAKING YOUR MOVE…"},()=>g.resolveCrimeTarget(pickpocketNpc.target,ownedTool>0?targetTool:null),spawnNextPedestrian)}>Attempt · {pickpocketNpc.target.nerve} Nerve</Button></div>
        <small className="pedestrian-mastery-hint">Mastery reveals more: M10 wealth · M25 awareness · M50 odds/value · M75 danger intel.</small>
      </article>
      {renderFeedback("pickpocket:live")}
    </div>;
  };

  const renderTargetCrime=(career:CrimeCareerDefinition)=>{
    if(!career.targetKind)return null;
    const targets=buildCrimeTargets(career.targetKind,boardSeed);
    const legacyId=career.targetKind==="vehicle"?"vehicle-theft":career.targetKind;
    const tools=recommendedCrimeTools(legacyId);
    const tool=getCrimeTool(targetTool);
    const ownedTool=tool?(g.gameState.inventory[tool.id]||0):0;
    const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery[career.id]??0);
    return <div className="crime-detail-stack">
      <div className="crime-live-row"><span><GameIcon name="clock" size={13}/>Targets refresh in <b>{formatTime(boardRefreshRemaining)}</b></span><span>Scout = <b>1 Nerve</b> + clearer intel + success bonus</span></div>
      {tools.length>0&&<div className="crime-prep-line"><label>Optional one-use prep<select value={targetTool} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setTargetTool(e.target.value)}><option value="">No tool</option>{tools.map((entry)=><option key={entry.id} value={entry.id} disabled={(g.gameState.inventory[entry.id]||0)<=0}>{entry.name} · owned {g.gameState.inventory[entry.id]||0}</option>)}</select></label>{tool&&<small>{tool.description} {ownedTool>0?"Consumed on attempt.":"Not owned."}</small>}</div>}
      <div className="crime-target-grid career-target-grid">{targets.map((target)=>{
        const scouted=g.gameState.scoutedCrimeTargets.includes(target.id);
        const resolved=g.gameState.resolvedCrimeTargets.includes(target.id);
        const chance=targetSuccessChance(target,g.gameState.crimeSkillXp[target.family]??0,g.combatStats.dexterity,g.gameState.heat,scouted,g.gameState.streetReputation)+(ownedTool>0&&tool?(tool.modifiers.chanceModifier??0):0);
        const feedbackKey=`target:${target.id}`;
        return <article key={target.id} className={`crime-target-card ${scouted?"scouted":""} ${resolved?"resolved":""}`}>
          <header><span className="target-icon"><GameIcon name={career.icon} size={18}/></span><div><small>{target.area}</small><h4>{target.name}</h4></div><span className="target-state">{resolved?"GONE":scouted?"SCOUTED":"LIVE"}</span></header>
          <p>{scouted?target.hint:"Scout this target to reveal the full payout, Heat and difficulty profile."}</p>
          <div className="target-intel-grid"><span><small>Mastery</small><strong>{mastery}</strong></span><span><small>Chance</small><strong>{scouted?`${Math.max(4,Math.min(97,chance)).toFixed(0)}%`:"???"}</strong></span><span><small>Reward</small><strong>{scouted?`${money(target.minReward)}–${money(target.maxReward)}`:"???"}</strong></span><span><small>Heat</small><strong>{scouted?`+${target.heat}`:"???"}</strong></span></div>
          <div className="target-actions">
            <Button disabled={resolved||scouted||incapacitated||g.gameState.nerve<1||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>withCrimeFeedback({key:feedbackKey,crimeId:career.id,subject:target.name,actionLabel:"Scout target",district:target.area,label:"SCOUTING THE TARGET…"},()=>g.scoutCrimeTarget(target.id))}>Scout</Button>
            <Button disabled={resolved||incapacitated||g.gameState.nerve<target.nerve||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>withCrimeFeedback({key:feedbackKey,crimeId:career.id,subject:target.name,actionLabel:`Attempt ${career.name}`,district:target.area,label:"MAKING THE ATTEMPT…"},()=>g.resolveCrimeTarget(target,ownedTool>0?targetTool:null))}>Attempt · {target.nerve} Nerve</Button>
          </div>
          {renderFeedback(feedbackKey)}
        </article>;
      })}</div>
    </div>;
  };

  const renderScavenging=(career:CrimeCareerDefinition)=>{
    const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery[career.id]??0);
    const clock=formatRiftCityTime(now);
    return <div className="crime-detail-stack">
      <div className="crime-mechanic-note"><GameIcon name="clock" size={16}/><div><strong>REAL-TIME OPPORTUNITY</strong><span>Opportunity follows the real clock instead of bouncing randomly. Commuter, nightlife, harbor, casino and premium areas rise and fall on different daily schedules, with small weekday/weekend changes.</span></div></div>
      <div className="crime-live-row"><span><GameIcon name="clock" size={13}/>Current city time <b>{clock}</b></span><span>Scavenging Mastery <b>{mastery}/100</b></span></div>
      <div className="scavenge-grid">
        {SCAVENGE_LOCATIONS.map((location)=>{
          const opp=scavengingOpportunity(location,now);
          const trend=scavengingOpportunityTrend(location,now);
          const opportunityLabel=scavengingOpportunityLabel(opp);
          const masteryLocked=mastery<location.masteryRequired;
          const missingItems=(location.requiredItems??[]).filter((id)=>(g.gameState.inventory[id]||0)<=0);
          const itemLocked=missingItems.length>0;
          const locked=masteryLocked||itemLocked;
          const outcomeRates=scavengingOutcomeRates(location,mastery,g.gameState.heat,opp);
          const accessLabel=location.requiredItems?.length
            ? `Requires ${location.requiredItems.map((id)=>getItem(id)?.name??id).join(" + ")}`
            : location.masteryRequired>1 ? `Mastery ${location.masteryRequired}` : "Open";
          return <article key={location.id} className={`scavenge-card ${locked?"locked":""}`}>
            <header><div><small>{location.district}</small><h4>{location.name}</h4></div><div className="scavenge-opportunity-readout"><strong>{opp}%</strong><small>{opportunityLabel} · {trend}</small></div></header>
            <p>{location.description}</p>
            <div className="opportunity-meter" aria-label={`${location.name} opportunity ${opp}%`}><span style={{left:`${opp}%`}}/><i style={{width:`${opp}%`}}/></div>
            <div className="scavenge-schedule-line"><span>Best window <b>{location.peakLabel}</b></span><span>Access <b>{accessLabel}</b></span><span>Lucky find <b>{outcomeRates.luckyChance.toFixed(1)}%</b></span><span>Bust risk <b>{outcomeRates.bustChance.toFixed(1)}%</b></span></div>
            <div className="crime-mini-metrics"><span>{location.nerve} Nerve</span><span>{money(location.minReward)}–{money(location.maxReward)}</span><span>{location.lootHint}</span></div>
            {renderRequirement(location.requiredItems)}
            <Button disabled={locked||incapacitated||g.gameState.nerve<location.nerve||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>withCrimeFeedback({key:`scavenge:${location.id}`,crimeId:"scavenging",subject:location.name,actionLabel:"Search area",district:location.district,label:"SEARCHING…"},()=>g.resolveScavenging(location.id))}>{masteryLocked?`Mastery ${location.masteryRequired} Required`:itemLocked?`Need ${missingItems.map((id)=>getItem(id)?.name??id).join(" + ")}`:`Search · ${opportunityLabel}`}</Button>
            {renderFeedback(`scavenge:${location.id}`)}
          </article>;
        })}
      </div>
    </div>;
  };

  const renderShoplifting=()=>{
    const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery.shoplift??0);
    return <div className="crime-detail-stack"><div className="crime-mechanic-note"><GameIcon name="shops" size={16}/><div><strong>LIVE STORE CONDITIONS + GREED</strong><span>Crowd, cameras and staffing rotate every few minutes. Add merchandise to your basket; value rises, but so does suspicion. Severity IV–V targets often require two prep items.</span></div></div><div className="shoplift-store-grid">{SHOPLIFT_STORES.map((store)=>{const live=getShopliftingConditions(store,now);const basketIds=shopBaskets[store.id]??[];const basket=store.items.filter((item)=>basketIds.includes(item.id));const suspicion=shopliftingSuspicion(store,basket,live);const basketValue=basket.reduce((sum,item)=>sum+item.value,0);const locked=mastery<store.masteryRequired;const required=Array.from(new Set(basket.flatMap((item)=>item.requiredItems??[])));const missing=required.filter((id)=>(g.gameState.inventory[id]||0)<=0);const toggle=(id:string)=>setShopBaskets((prev)=>({...prev,[store.id]:(prev[store.id]??[]).includes(id)?(prev[store.id]??[]).filter((x)=>x!==id):[...(prev[store.id]??[]),id]}));return <article key={store.id} className={`shoplift-store ${locked?"locked":""}`}><header><div><small>{store.district}</small><h3>{store.name}</h3></div><span className={`shop-opportunity ${live.opportunity>68?"good":live.opportunity<35?"bad":""}`}>{live.opportunity}% OPPORTUNITY</span></header><p>{store.description}</p><div className="store-condition-row"><span>Crowd <b>{live.crowd}</b></span><span>Security <b>{live.security}</b></span><span>Staff <b>{live.staffing}</b></span></div><div className="shop-items">{store.items.map((item)=>{const itemLocked=mastery<item.masteryRequired;const selected=basketIds.includes(item.id);return <button type="button" key={item.id} className={`${selected?"selected":""} ${itemLocked?"locked":""}`} disabled={locked||itemLocked} onClick={()=>toggle(item.id)}><span className="severity">SEVERITY {severityRoman[item.severity]}</span><strong>{item.name}</strong><small>{money(item.value)} · Mastery {item.masteryRequired}+</small>{item.requiredItems?.length?<em>{item.requiredItems.length} required item{item.requiredItems.length===1?"":"s"}</em>:null}</button>;})}</div><div className="shoplift-risk-panel"><div><small>BASKET</small><strong>{basket.length} items · {money(basketValue)}</strong></div><div><small>SUSPICION</small><strong className={suspicion>=70?"danger":suspicion>=45?"warn":""}>{basket.length?suspicion:0}%</strong></div></div>{renderRequirement(required)}<div className="target-actions"><Button disabled={!basket.length} onClick={()=>setShopBaskets((prev)=>({...prev,[store.id]:[]}))}>Clear Basket</Button><Button disabled={locked||!basket.length||missing.length>0||incapacitated||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>withCrimeFeedback({key:`shoplift:${store.id}`,crimeId:"shoplift",subject:store.name,actionLabel:`Leave with ${basketIds.length} item${basketIds.length===1?"":"s"}`,district:store.district,label:"SLIPPING OUT…"},()=>g.resolveShoplifting(store.id,basketIds),()=>setShopBaskets((prev)=>({...prev,[store.id]:[]})))}>Leave With Basket</Button></div>{renderFeedback(`shoplift:${store.id}`)}{locked&&<small className="crime-lock-line"><GameIcon name="lock" size={12}/>Requires Shoplifting Mastery {store.masteryRequired}</small>}</article>;})}</div></div>;
  };

  const renderGraffiti=()=> <div className="crime-detail-stack"><div className="graffiti-rep-banner"><div><GameIcon name="spray" size={28}/><div><span>STREET REPUTATION</span><strong>{g.gameState.streetReputation}</strong><small>{graffitiRank(g.gameState.streetReputation)}</small></div></div><p>Graffiti is a reputation career. Higher-profile walls create more Heat but build your name much faster.</p><div><span>Total tags</span><strong>{g.gameState.graffitiTotalTags}</strong></div></div><div className="graffiti-spot-grid">{GRAFFITI_SPOTS.map((spot)=>{const repLocked=g.gameState.streetReputation<spot.reputationRequired;const cooldown=Math.max(0,(g.gameState.graffitiCooldowns[spot.id]||0)-now);const chance=graffitiSuccessChance(spot,g.gameState.crimeSkillXp.street??0,g.combatStats.dexterity,g.gameState.heat,g.gameState.streetReputation);return <article key={spot.id} className={`graffiti-spot-card ${repLocked?"locked":""}`}><header><span className="graffiti-mark"><GameIcon name="spray" size={18}/></span><div><small>{spot.district}</small><h4>{spot.name}</h4></div><span className="graffiti-rep-reward">+{spot.reputationGain} REP</span></header><p>{spot.description}</p><div className="graffiti-metrics"><span>{spot.nerve} Nerve</span><span>1 Street Paint Pack</span><span>{money(spot.paintCost)} setup</span><span>{chance.toFixed(0)}% success</span><span>Heat +{spot.heat}</span></div>{renderRequirement(["spray-can"])}<Button disabled={repLocked||cooldown>0||incapacitated||g.gameState.nerve<spot.nerve||g.gameState.cash<spot.paintCost||(g.gameState.inventory["spray-can"]||0)<=0||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>withCrimeFeedback({key:`graffiti:${spot.id}`,crimeId:"graffiti",subject:spot.name,actionLabel:"Leave your mark",district:spot.district,label:"LEAVING YOUR MARK…"},()=>g.tagGraffiti(spot.id))}>{repLocked?`Rep ${spot.reputationRequired} Required`:cooldown>0?`Hot · ${formatTime(cooldown)}`:(g.gameState.inventory["spray-can"]||0)<=0?"Need Street Paint Pack":"Leave Your Mark"}</Button>{renderFeedback(`graffiti:${spot.id}`)}</article>;})}</div></div>;

  const renderOperations=(career:CrimeCareerDefinition)=>{
    const operations=(career.operationIds??[]).map(operationById).filter((item):item is NonNullable<typeof item>=>Boolean(item));
    return <div className="crime-detail-stack"><div className="crime-mechanic-note"><GameIcon name="clock" size={16}/><div><strong>PASSIVE OPERATION</strong><span>These keep running while you leave the page. Some have fixed completion timers; risk-build operations let you cash out early while value and detection pressure climb together.</span></div></div>{operations.map((operation)=>{const active=g.gameState.activeCrimeOperations.find((job)=>job.operationId===operation.id);const remaining=active?Math.max(0,active.finishesAt-now):0;const progress=active?Math.max(0,Math.min(1,(now-active.startedAt)/Math.max(1,active.finishesAt-active.startedAt))):0;const ready=Boolean(active&&remaining<=0);const riskBuild=operation.cashoutMode==="risk-build";const canCash=Boolean(active&&riskBuild&&progress>=(operation.minCashoutProgress??.15));const liveDetection=Math.max(1,Math.round(operation.detectionRisk*(riskBuild?(.35+progress*.9):1)));const accruedMin=Math.round(operation.minReward*(riskBuild?(.22+progress*.78):1));const accruedMax=Math.round(operation.maxReward*(riskBuild?(.22+progress*.78):1));const missing=(operation.requiredItems??[]).filter((id)=>(g.gameState.inventory[id]||0)<=0);return <article key={operation.id} className={`crime-operation-card career-operation ${ready?"ready":""}`}><header><span><GameIcon name={operation.icon} size={19}/></span><div><small>{CRIME_FAMILY_LABELS[operation.family]}</small><h4>{operation.name}</h4></div></header><p>{operation.description}</p><div className="operation-metrics"><span><small>Setup</small><strong>{money(operation.setupCost)}</strong></span><span><small>{riskBuild?"Value built":"Timer"}</small><strong>{active&&riskBuild?`${Math.round(progress*100)}%`:formatTime(operation.durationMs)}</strong></span><span><small>{active&&riskBuild?"Accrued range":"Payout"}</small><strong>{money(active&&riskBuild?accruedMin:operation.minReward)}–{money(active&&riskBuild?accruedMax:operation.maxReward)}</strong></span><span><small>Detection</small><strong>{active&&riskBuild?`${liveDetection}% live`:`${operation.detectionRisk}% base`}</strong></span></div>{active&&riskBuild?<div className="operation-risk-build"><div><i style={{width:`${progress*100}%`}}/></div><small>Waiting longer increases the possible payout, but detection pressure also grows.</small></div>:null}{renderRequirement(operation.requiredItems)}{active?<Button disabled={(riskBuild?!canCash:!ready)||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>withCrimeFeedback({key:`operation:${operation.id}`,crimeId:career.id,subject:operation.name,actionLabel:riskBuild&&remaining>0?"Cash out operation":"Collect operation",label:riskBuild&&remaining>0?"CASHING OUT…":"COLLECTING RESULT…"},()=>g.claimCrimeOperation(active.id))}>{riskBuild?(canCash?(remaining>0?"Cash Out Now":"Collect Full Run"):`Building Value · ${Math.round(progress*100)}%`):(ready?"Collect Result":`Running · ${formatTime(remaining)}`)}</Button>:<Button disabled={missing.length>0||incapacitated||g.gameState.cash<operation.setupCost||g.gameState.nerve<operation.nerve||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>withCrimeFeedback({key:`operation:${operation.id}`,crimeId:career.id,subject:operation.name,actionLabel:"Launch operation",label:"SETTING UP OPERATION…"},()=>g.startCrimeOperation(operation.id))}>Launch Operation</Button>}{renderFeedback(`operation:${operation.id}`)}</article>;})}</div>;
  };

  const renderActions=(career:CrimeCareerDefinition)=>{
    const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery[career.id]??0);const familyLevel=crimeFamilyLevel(g.gameState.crimeSkillXp[career.family]??0);
    const live=getCrimeContextPulse(career.id,now,g.gameState.heat); const signature=CRIME_SIGNATURES[career.id];
    return <div className="crime-detail-stack">
      {signature&&<div className="crime-mechanic-note"><GameIcon name="spark" size={16}/><div><strong>{signature.title}</strong><span>{signature.description}</span></div></div>}
      {live&&<section className="crime-context-pulse"><header><div><small>{live.label}</small><strong>{live.status}</strong></div><b>{live.value}%</b></header><div className="crime-context-meter"><i style={{width:`${live.value}%`}}/></div><p>{live.detail}</p><div className="crime-context-mods"><span>Chance {live.chanceModifier>=0?"+":""}{live.chanceModifier.toFixed(1)}%</span><span>Value ×{live.rewardMultiplier.toFixed(2)}</span>{live.heatModifier?<span>Heat +{live.heatModifier}</span>:null}</div></section>}
      <div className="crime-action-grid">{(career.actions??[]).map((action)=>{const locked=mastery<(action.masteryRequired??1)||g.gameState.streetReputation<(action.streetRepRequired??0);const missing=(action.requiredItems??[]).filter((id)=>(g.gameState.inventory[id]||0)<=0);const chance=Math.max(4,Math.min(97,careerActionSuccessChance(action,familyLevel,mastery,g.combatStats.dexterity,g.gameState.heat)+(live?.chanceModifier??0)));const minReward=Math.round(action.minReward*(live?.rewardMultiplier??1));const maxReward=Math.round(action.maxReward*(live?.rewardMultiplier??1));return <article key={action.id} className={`career-action-card ${locked?"locked":""}`}><header><div><small>{career.risk} RISK</small><h4>{action.name}</h4></div><strong>{chance.toFixed(0)}%</strong></header><p>{action.description}</p><div className="crime-mini-metrics"><span>{action.nerve} Nerve</span><span>{action.rewardType==="heat-reduction"?`Heat -${minReward}–${maxReward}`:`${money(minReward)}–${money(maxReward)}`}</span><span>Heat +{Math.max(0,action.heat+(live?.heatModifier??0))}</span><span>Mastery {action.masteryRequired??1}+</span></div>{renderRequirement(action.requiredItems)}{action.recommendedItems?.length?<small className="recommended-line">Recommended: {action.recommendedItems.map((id)=>getItem(id)?.name??id).join(", ")}</small>:null}<Button disabled={locked||missing.length>0||incapacitated||g.gameState.nerve<action.nerve||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>withCrimeFeedback({key:`action:${career.id}:${action.id}`,crimeId:career.id,subject:action.name,actionLabel:action.name,label:career.id==="safecracking"?"LISTENING FOR THE SYNC…":"WORKING THE OPPORTUNITY…"},()=>g.runCrimeCareerAction(career.id,action.id,live?{chanceModifier:live.chanceModifier,rewardMultiplier:live.rewardMultiplier,heatModifier:live.heatModifier}:undefined))}>{locked?"Mastery / Rep Locked":missing.length?"Missing Required Items":`Attempt · ${chance.toFixed(0)}%`}</Button>{renderFeedback(`action:${career.id}:${action.id}`)}</article>;})}</div>
    </div>;
  };

  const renderMajor=(career:CrimeCareerDefinition)=>{
    const crime=legacyById(career.legacyCrimeId??career.id);if(!crime)return null;
    if(run){const event=run.events[run.stage];if(!event)return null;return <section className={`crime-run-panel ${riskClass(run.mods.riskLabel)}`}><div className="crime-run-top"><div><span className="card-tag">LIVE JOB · STEP {run.stage+1}/{run.events.length}</span><h2>{run.crime.name}</h2></div><button type="button" className="crime-run-abort" onClick={()=>setRun(null)}>Abort</button></div><div className="crime-live-stats"><span>Projected success <strong>{projectedMajorChance.toFixed(0)}%</strong></span><span>Reward <strong>×{run.mods.rewardMultiplier.toFixed(2)}</strong></span><span>Loot <strong>×{run.mods.lootMultiplier.toFixed(2)}</strong></span><span>Risk <strong>{run.mods.riskLabel}</strong></span></div><div className={`crime-event-card ${event.rare?"rare":""}`}><span className="crime-event-kicker">{event.rare?"RARE OPPORTUNITY":"SITUATION CHANGED"}</span><h3>{event.title}</h3><p>{event.text}</p><div className="crime-event-options">{event.options.map((option:ActiveRun["events"][number]["options"][number])=>{const statValue=option.requiredStat?g.combatStats[option.requiredStat.stat]:0;const statLocked=Boolean(option.requiredStat&&statValue<option.requiredStat.value);return <button type="button" key={option.id} disabled={statLocked} className={`crime-event-option ${riskClass(option.risk)} ${option.rare?"rare":""}`} onClick={()=>chooseEvent(option)}><div><strong>{option.label}</strong><span>{option.risk}</span></div><p>{option.description}</p><small>{option.requiredStat?`${option.requiredStat.stat.toUpperCase()} ${statValue.toFixed(0)}/${option.requiredStat.value}`:"Decision changes chance, reward, Heat and escape risk."}</small></button>;})}</div></div></section>;}
    const selectedChoiceId=choices[crime.id]??"balanced";const selectedChoice=crime.choices.find((choice)=>choice.id===selectedChoiceId)??crime.choices[1]??crime.choices[0];const tools=recommendedCrimeTools(crime.id);const selectedToolId=majorTools[crime.id]||"";const tool=getCrimeTool(selectedToolId);const owned=tool?(g.gameState.inventory[tool.id]||0):0;return <div className="crime-detail-stack"><div className="crime-mechanic-note"><GameIcon name="warning" size={16}/><div><strong>BRANCHING MAJOR JOB</strong><span>The old decision system stays here on purpose: major robberies are where changing situations are worth slowing down for.</span></div></div><div className="major-choice-grid">{crime.choices.map((choice)=><button type="button" key={choice.id} className={choice.id===selectedChoiceId?"active":""} onClick={()=>setChoices((prev)=>({...prev,[crime.id]:choice.id}))}><strong>{choice.label}</strong><small>{choice.description}</small><span>{choice.chanceModifier>=0?"+":""}{choice.chanceModifier}% chance · ×{choice.rewardMultiplier.toFixed(2)} payout</span></button>)}</div>{tools.length>0&&<div className="crime-prep-line"><label>Optional prep<select value={selectedToolId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setMajorTools((prev)=>({...prev,[crime.id]:e.target.value}))}><option value="">No tool</option>{tools.map((entry)=><option key={entry.id} value={entry.id} disabled={(g.gameState.inventory[entry.id]||0)<=0}>{entry.name} · owned {g.gameState.inventory[entry.id]||0}</option>)}</select></label></div>}<Button disabled={incapacitated||g.gameState.nerve<crime.nerve||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>beginMajor(crime,selectedChoiceId,owned>0?selectedToolId:null)}>Begin Job · {crime.nerve} Nerve</Button>{renderFeedback(`major:${crime.id}`)}</div>;
  };

  const renderSelected=()=>{
    if(!selected)return null;
    if(selected.mode==="scavenge")return renderScavenging(selected);
    if(selected.id==="pickpocket")return renderPickpocket(selected);
    if(selected.mode==="target")return renderTargetCrime(selected);
    if(selected.mode==="shoplift")return renderShoplifting();
    if(selected.mode==="graffiti")return renderGraffiti();
    if(selected.mode==="operation")return renderOperations(selected);
    if(selected.mode==="actions")return renderActions(selected);
    return renderMajor(selected);
  };

  if(selected){const masteryXp=g.gameState.crimeMastery[selected.id]??0;const mastery=crimeCareerMasteryLevel(masteryXp);const familyLevel=crimeFamilyLevel(g.gameState.crimeSkillXp[selected.family]??0);const careerLocked=g.gameState.crimeExperience<selected.unlockCrimeExperience;return <div className="crime-career-v4"><button type="button" className="crime-back-button" onClick={backToCrimes}>‹ All Crimes</button><section className={`crime-career-header ${riskClass(selected.risk)}`}><span className="crime-career-icon"><GameIcon name={selected.icon} size={25}/></span><div><small>{CRIME_FAMILY_LABELS[selected.family]} · {selected.risk} RISK</small><h2>{selected.name}</h2><p>{selected.description}</p></div><div className="crime-career-level"><span>MASTERY</span><strong>{mastery}</strong><small>{masteryRank(mastery)}</small></div></section><div className="career-progress-wide"><span>Mastery {mastery} / 100</span><div className="bar-track"><div className="bar-fill crime" style={{width:`${crimeCareerMasteryProgress(masteryXp)}%`}}/></div><span>{CRIME_FAMILY_LABELS[selected.family]} Lv {familyLevel}</span></div>{careerLocked?<section className="crime-career-locked"><GameIcon name="lock" size={28}/><div><strong>Crime locked</strong><span>Requires {selected.unlockCrimeExperience} Crime Experience · you have {g.gameState.crimeExperience}.</span></div></section>:renderSelected()}</div>;}

  return <div className="crime-career-v4">
    <section className="crime-career-overview"><div><span className="card-tag">CRIMES</span><h2>One list. Different criminal careers.</h2><p>Every crime has Mastery 1–100. Open one to see its own targets, timing, scouting, store conditions, passive operation or major-job decisions.</p></div><div className="crime-overview-stats"><span>Nerve <b>{g.gameState.nerve}/{g.maxNerve}</b></span><span>Heat <b>{g.gameState.heat}/100</b></span><span>Street Rep <b>{g.gameState.streetReputation}</b></span><span>Crime XP <b>{g.gameState.crimeExperience}</b></span></div></section>
    <section className="city-crime-conditions"><span><small>POLICE</small><b>{conditions.policeLabel}</b></span><span><small>NIGHTLIFE</small><b>{conditions.nightlifeLabel}</b></span><span><small>RETAIL</small><b>{conditions.retailLabel}</b></span><span><small>INDUSTRIAL</small><b>{conditions.industrialLabel}</b></span><em>City conditions rotate every few minutes and individual crime screens react to their own live conditions.</em></section>
    <section className="crime-family-strip">{(Object.entries(CRIME_FAMILY_LABELS) as Array<[CrimeFamily,string]>).map(([family,label])=>{const xp=g.gameState.crimeSkillXp[family]??0;return <div key={family}><span>{label}</span><strong>Lv {crimeFamilyLevel(xp)}</strong><div className="bar-track compact"><div className="bar-fill crime" style={{width:`${crimeFamilyProgress(xp)}%`}}/></div></div>;})}</section>
    <div className="single-crime-list">{CRIME_CAREERS.map((crime)=>{const masteryXp=g.gameState.crimeMastery[crime.id]??0;const mastery=crimeCareerMasteryLevel(masteryXp);const locked=g.gameState.crimeExperience<crime.unlockCrimeExperience;const activeCount=(crime.operationIds??[]).filter((id)=>g.gameState.activeCrimeOperations.some((job)=>job.operationId===id)).length;return <button type="button" key={crime.id} className={`single-crime-row ${locked?"locked":""}`} onClick={()=>openCrime(crime.id)}><span className="single-crime-icon"><GameIcon name={crime.icon} size={21}/></span><span className="single-crime-main"><span><strong>{crime.name}</strong><small>{crime.description}</small></span><span className="single-crime-progress"><i><b style={{width:`${crimeCareerMasteryProgress(masteryXp)}%`}}/></i><small>Mastery {mastery} · {masteryRank(mastery)}</small></span></span><span className="single-crime-meta"><small>{crime.baseNerve} Nerve+</small><b className={riskClass(crime.risk)}>{crime.risk}</b>{activeCount>0?<em>{activeCount} ACTIVE</em>:null}</span><span className="single-crime-open">{locked?<><GameIcon name="lock" size={14}/><small>CE {crime.unlockCrimeExperience}</small></>:"›"}</span></button>;})}</div>
  </div>;
}
