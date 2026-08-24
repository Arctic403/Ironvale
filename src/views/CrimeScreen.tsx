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
  crimeFamilyLevel, crimeFamilyProgress, crimeTargetBoardSeed,
  graffitiRank, graffitiSuccessChance,
} from "../systems/crimeActivities";
import {
  CRIME_PLUGINS, CrimeCareerDefinition,
  careerActionSuccessChance, crimeCareerMasteryLevel, crimeCareerMasteryProgress,
  crimeCityConditions, getCrimePlugin, masteryRank,
} from "../systems/crimeCareerSystem";
import { CRIME_SIGNATURES, getCrimeContextPulse } from "../systems/crimeV5";
import { buildCrimeDialogue, type CrimeDialogue } from "../systems/crimeDialogue";
import { ScavengingCrime } from "../crimes/ui/ScavengingCrime";
import { PickpocketCrime } from "../crimes/ui/PickpocketCrime";
import { TargetCrime } from "../crimes/ui/TargetCrime";
import { ShopliftingCrime } from "../crimes/ui/ShopliftingCrime";
import { GraffitiCrime } from "../crimes/ui/GraffitiCrime";
import { OperationsCrime } from "../crimes/ui/OperationsCrime";

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
  const [choices,setChoices]=useState<Record<string,string>>({});
  const [majorTools,setMajorTools]=useState<Record<string,string>>({});
  const [run,setRun]=useState<ActiveRun|null>(null);
  const [feedback,setFeedback]=useState<CrimeFeedback|null>(null);
  const [miniAction,setMiniAction]=useState<{crimeId:string;actionId:string}|null>(null);
  const [memorySequence,setMemorySequence]=useState<number[]>([]);
  const [memoryInput,setMemoryInput]=useState<number[]>([]);
  const [memoryShowing,setMemoryShowing]=useState(false);
  const dialNeedleRef=useRef<HTMLSpanElement|null>(null);
  const feedbackTimer=useRef<number|null>(null);
  const listScrollRef=useRef(0);
  const incapacitated=Boolean(g.gameState.jailUntil||g.gameState.hospitalUntil);

  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);

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

  const startMemoryGame=(crimeId:string,actionId:string,difficulty:number)=>{
    const len=difficulty>=58?5:difficulty>=45?4:3;
    const seq=Array.from({length:len},()=>Math.floor(Math.random()*4));
    setMiniAction({crimeId,actionId});setMemorySequence(seq);setMemoryInput([]);setMemoryShowing(true);
    window.setTimeout(()=>setMemoryShowing(false),Math.max(1500,len*430));
  };

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

  const selectedPlugin=selectedId?getCrimePlugin(selectedId)??null:null;
  const selected=selectedPlugin?.definition??null;
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

  const renderActions=(career:CrimeCareerDefinition)=>{
    const mastery=crimeCareerMasteryLevel(g.gameState.crimeMastery[career.id]??0);const familyLevel=crimeFamilyLevel(g.gameState.crimeSkillXp[career.family]??0);
    const live=getCrimeContextPulse(career.id,now,g.gameState.heat); const signature=CRIME_SIGNATURES[career.id];
    const runAction=(action:any,bonus?:{chanceModifier:number;rewardMultiplier:number;heatModifier:number},label="WORKING THE OPPORTUNITY…")=>withCrimeFeedback({key:`action:${career.id}:${action.id}`,crimeId:career.id,subject:action.name,actionLabel:action.name,label},()=>g.runCrimeCareerAction(career.id,action.id,{chanceModifier:(live?.chanceModifier??0)+(bonus?.chanceModifier??0),rewardMultiplier:(live?.rewardMultiplier??1)*(bonus?.rewardMultiplier??1),heatModifier:(live?.heatModifier??0)+(bonus?.heatModifier??0)}),()=>setMiniAction(null));
    const memoryTap=(action:any,index:number)=>{
      if(memoryShowing)return;const next=[...memoryInput,index];setMemoryInput(next);
      const wrong=next.some((v,i)=>v!==memorySequence[i]);
      if(wrong){runAction(action,{chanceModifier:-10,rewardMultiplier:.9,heatModifier:2},"MEMORY TRACE BROKE…");return;}
      if(next.length===memorySequence.length)runAction(action,{chanceModifier:12,rewardMultiplier:1.15,heatModifier:-1},"MEMORY TRACE LOCKED…");
    };
    const lockDial=(action:any)=>{
      const pos=pointerPercent(dialNeedleRef as React.RefObject<HTMLSpanElement|null>);const d=Math.abs(pos-50);
      if(d<=8)runAction(action,{chanceModifier:13,rewardMultiplier:1.16,heatModifier:0},"PERFECT DIAL SYNC…");
      else if(d<=18)runAction(action,{chanceModifier:5,rewardMultiplier:1.04,heatModifier:0},"DIAL SYNC…");
      else runAction(action,{chanceModifier:-11,rewardMultiplier:.9,heatModifier:1},"DIAL SLIPPED…");
    };
    return <div className="crime-detail-stack">
      {signature&&<div className="crime-mechanic-note"><GameIcon name="spark" size={16}/><div><strong>{signature.title}</strong><span>{signature.description}</span></div></div>}
      {career.id==="data-breach"?<div className="crime-mechanic-note"><GameIcon name="chip" size={16}/><div><strong>MEMORY TRACE</strong><span>Cyber jobs use an abstract symbol-memory challenge. Memorize the sequence, then repeat it correctly for a strong attempt bonus.</span></div></div>:null}
      {career.id==="safecracking"?<div className="crime-mechanic-note"><GameIcon name="lock" size={16}/><div><strong>PRECISION DIAL</strong><span>Safe jobs use a fictional timing dial. Lock the moving marker near the center sync zone for the cleanest attempt.</span></div></div>:null}
      {live&&<section className="crime-context-pulse"><header><div><small>{live.label}</small><strong>{live.status}</strong></div><b>{live.value}%</b></header><div className="crime-context-meter"><i style={{width:`${live.value}%`}}/></div><p>{live.detail}</p></section>}
      <div className="crime-action-grid">{(career.actions??[]).map((action)=>{const locked=mastery<(action.masteryRequired??1)||g.gameState.streetReputation<(action.streetRepRequired??0);const missing=(action.requiredItems??[]).filter((id)=>(g.gameState.inventory[id]||0)<=0);const chance=Math.max(4,Math.min(97,careerActionSuccessChance(action,familyLevel,mastery,g.combatStats.dexterity,g.gameState.heat)+(live?.chanceModifier??0)));const active=miniAction?.crimeId===career.id&&miniAction?.actionId===action.id;return <article key={action.id} className={`career-action-card ${locked?"locked":""}`}><header><div><small>{career.risk} RISK</small><h4>{action.name}</h4></div><strong>{chance.toFixed(0)}%</strong></header><p>{action.description}</p><div className="crime-mini-metrics"><span>{action.nerve} Nerve</span><span>{money(action.minReward)}–{money(action.maxReward)}</span><span>Heat +{Math.max(0,action.heat+(live?.heatModifier??0))}</span></div>{renderRequirement(action.requiredItems)}
      {career.id==="data-breach"&&active?<div className="memory-minigame"><small>{memoryShowing?"MEMORIZE":"REPEAT"}</small><div className="memory-display">{memoryShowing?memorySequence.map((v,i)=><b key={i}>{["◆","●","▲","■"][v]}</b>):memorySequence.map((_,i)=><b key={i}>{memoryInput[i]!==undefined?["◆","●","▲","■"][memoryInput[i]]:"?"}</b>)}</div>{!memoryShowing?<div className="memory-pad">{["◆","●","▲","■"].map((sym,i)=><button type="button" key={sym} onClick={()=>memoryTap(action,i)}>{sym}</button>)}</div>:null}</div>:career.id==="safecracking"&&active?<div className="safe-dial-minigame"><div className="safe-dial-track"><i/><span ref={dialNeedleRef}/></div><Button onClick={()=>lockDial(action)}>LOCK IN</Button></div>:<Button disabled={locked||missing.length>0||incapacitated||g.gameState.nerve<action.nerve||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>{if(career.id==="data-breach")startMemoryGame(career.id,action.id,action.difficulty);else if(career.id==="safecracking")setMiniAction({crimeId:career.id,actionId:action.id});else runAction(action,undefined,"WORKING THE OPPORTUNITY…");}}>{locked?"Mastery / Rep Locked":missing.length?"Missing Required Items":career.id==="data-breach"?"Start Memory Trace":career.id==="safecracking"?"Start Precision Dial":`Attempt · ${chance.toFixed(0)}%`}</Button>}{renderFeedback(`action:${career.id}:${action.id}`)}</article>;})}</div>
    </div>;
  };

  const renderMajor=(career:CrimeCareerDefinition)=>{
    const crime=legacyById(career.legacyCrimeId??career.id);if(!crime)return null;
    if(run){const event=run.events[run.stage];if(!event)return null;return <section className={`crime-run-panel ${riskClass(run.mods.riskLabel)}`}><div className="crime-run-top"><div><span className="card-tag">LIVE JOB · STEP {run.stage+1}/{run.events.length}</span><h2>{run.crime.name}</h2></div><button type="button" className="crime-run-abort" onClick={()=>setRun(null)}>Abort</button></div><div className="crime-live-stats"><span>Projected success <strong>{projectedMajorChance.toFixed(0)}%</strong></span><span>Reward <strong>×{run.mods.rewardMultiplier.toFixed(2)}</strong></span><span>Loot <strong>×{run.mods.lootMultiplier.toFixed(2)}</strong></span><span>Risk <strong>{run.mods.riskLabel}</strong></span></div><div className={`crime-event-card ${event.rare?"rare":""}`}><span className="crime-event-kicker">{event.rare?"RARE OPPORTUNITY":"SITUATION CHANGED"}</span><h3>{event.title}</h3><p>{event.text}</p><div className="crime-event-options">{event.options.map((option:ActiveRun["events"][number]["options"][number])=>{const statValue=option.requiredStat?g.combatStats[option.requiredStat.stat]:0;const statLocked=Boolean(option.requiredStat&&statValue<option.requiredStat.value);return <button type="button" key={option.id} disabled={statLocked} className={`crime-event-option ${riskClass(option.risk)} ${option.rare?"rare":""}`} onClick={()=>chooseEvent(option)}><div><strong>{option.label}</strong><span>{option.risk}</span></div><p>{option.description}</p><small>{option.requiredStat?`${option.requiredStat.stat.toUpperCase()} ${statValue.toFixed(0)}/${option.requiredStat.value}`:"Decision changes chance, reward, Heat and escape risk."}</small></button>;})}</div></div></section>;}
    const selectedChoiceId=choices[crime.id]??"balanced";const selectedChoice=crime.choices.find((choice)=>choice.id===selectedChoiceId)??crime.choices[1]??crime.choices[0];const tools=recommendedCrimeTools(crime.id);const selectedToolId=majorTools[crime.id]||"";const tool=getCrimeTool(selectedToolId);const owned=tool?(g.gameState.inventory[tool.id]||0):0;return <div className="crime-detail-stack"><div className="crime-mechanic-note"><GameIcon name="warning" size={16}/><div><strong>BRANCHING MAJOR JOB</strong><span>The old decision system stays here on purpose: major robberies are where changing situations are worth slowing down for.</span></div></div><div className="major-choice-grid">{crime.choices.map((choice)=><button type="button" key={choice.id} className={choice.id===selectedChoiceId?"active":""} onClick={()=>setChoices((prev)=>({...prev,[crime.id]:choice.id}))}><strong>{choice.label}</strong><small>{choice.description}</small><span>{choice.chanceModifier>=0?"+":""}{choice.chanceModifier}% chance · ×{choice.rewardMultiplier.toFixed(2)} payout</span></button>)}</div>{tools.length>0&&<div className="crime-prep-line"><label>Optional prep<select value={selectedToolId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setMajorTools((prev)=>({...prev,[crime.id]:e.target.value}))}><option value="">No tool</option>{tools.map((entry)=><option key={entry.id} value={entry.id} disabled={(g.gameState.inventory[entry.id]||0)<=0}>{entry.name} · owned {g.gameState.inventory[entry.id]||0}</option>)}</select></label></div>}<Button disabled={incapacitated||g.gameState.nerve<crime.nerve||Boolean(feedback&&feedback.phase!=="result")} onClick={()=>beginMajor(crime,selectedChoiceId,owned>0?selectedToolId:null)}>Begin Job · {crime.nerve} Nerve</Button>{renderFeedback(`major:${crime.id}`)}</div>;
  };

  const renderSelected=()=>{
    if(!selected)return null;
    const uiKind=selectedPlugin?.uiKind??selected.mode;
    const renderers={
      scavenge:()=> <ScavengingCrime g={g} career={selected} now={now} incapacitated={incapacitated} feedbackBusy={Boolean(feedback&&feedback.phase!=="result")} withCrimeFeedback={withCrimeFeedback} renderFeedback={renderFeedback}/>,
      pickpocket:()=> <PickpocketCrime g={g} career={selected} now={now} incapacitated={incapacitated} feedbackBusy={Boolean(feedback&&feedback.phase!=="result")} withCrimeFeedback={withCrimeFeedback} renderFeedback={renderFeedback}/>,
      target:()=> <TargetCrime g={g} career={selected} boardSeed={boardSeed} boardRefreshRemaining={boardRefreshRemaining} incapacitated={incapacitated} feedbackBusy={Boolean(feedback&&feedback.phase!=="result")} withCrimeFeedback={withCrimeFeedback} renderFeedback={renderFeedback}/>,
      shoplift:()=> <ShopliftingCrime g={g} now={now} incapacitated={incapacitated} feedbackBusy={Boolean(feedback&&feedback.phase!=="result")} withCrimeFeedback={withCrimeFeedback} renderFeedback={renderFeedback}/> ,
      graffiti:()=> <GraffitiCrime g={g} now={now} incapacitated={incapacitated} feedbackBusy={Boolean(feedback&&feedback.phase!=="result")} withCrimeFeedback={withCrimeFeedback} renderFeedback={renderFeedback}/>,
      operation:()=> <OperationsCrime g={g} career={selected} now={now} incapacitated={incapacitated} feedbackBusy={Boolean(feedback&&feedback.phase!=="result")} withCrimeFeedback={withCrimeFeedback} renderFeedback={renderFeedback}/>,
      actions:()=>renderActions(selected),
      major:()=>renderMajor(selected),
    } as const;
    return renderers[uiKind]();
  };

  if(selected){const masteryXp=g.gameState.crimeMastery[selected.id]??0;const mastery=crimeCareerMasteryLevel(masteryXp);const familyLevel=crimeFamilyLevel(g.gameState.crimeSkillXp[selected.family]??0);const careerLocked=g.gameState.crimeExperience<selected.unlockCrimeExperience;return <div className="crime-career-v4"><button type="button" className="crime-back-button" onClick={backToCrimes}>‹ All Crimes</button><section className={`crime-career-header ${riskClass(selected.risk)}`}><span className="crime-career-icon"><GameIcon name={selected.icon} size={25}/></span><div><small>{CRIME_FAMILY_LABELS[selected.family]} · {selected.risk} RISK</small><h2>{selected.name}</h2><p>{selected.description}</p></div><div className="crime-career-level"><span>MASTERY</span><strong>{mastery}</strong><small>{masteryRank(mastery)}</small></div></section><div className="career-progress-wide"><span>Mastery {mastery} / 100</span><div className="bar-track"><div className="bar-fill crime" style={{width:`${crimeCareerMasteryProgress(masteryXp)}%`}}/></div><span>{CRIME_FAMILY_LABELS[selected.family]} Lv {familyLevel}</span></div>{careerLocked?<section className="crime-career-locked"><GameIcon name="lock" size={28}/><div><strong>Crime locked</strong><span>Requires {selected.unlockCrimeExperience} Crime Experience · you have {g.gameState.crimeExperience}.</span></div></section>:renderSelected()}</div>;}

  return <div className="crime-career-v4">
    <section className="crime-career-overview"><div><span className="card-tag">CRIMES</span><h2>One list. Different criminal careers.</h2><p>Every crime has Mastery 1–100. Open one to see its own targets, timing, scouting, store conditions, passive operation or major-job decisions.</p></div><div className="crime-overview-stats"><span>Nerve <b>{g.gameState.nerve}/{g.maxNerve}</b></span><span>Heat <b>{g.gameState.heat}/100</b></span><span>Street Rep <b>{g.gameState.streetReputation}</b></span><span>Crime XP <b>{g.gameState.crimeExperience}</b></span></div></section>
    <section className="city-crime-conditions"><span><small>POLICE</small><b>{conditions.policeLabel}</b></span><span><small>NIGHTLIFE</small><b>{conditions.nightlifeLabel}</b></span><span><small>RETAIL</small><b>{conditions.retailLabel}</b></span><span><small>INDUSTRIAL</small><b>{conditions.industrialLabel}</b></span><em>City conditions rotate every few minutes and individual crime screens react to their own live conditions.</em></section>
    <section className="crime-family-strip">{(Object.entries(CRIME_FAMILY_LABELS) as Array<[CrimeFamily,string]>).map(([family,label])=>{const xp=g.gameState.crimeSkillXp[family]??0;return <div key={family}><span>{label}</span><strong>Lv {crimeFamilyLevel(xp)}</strong><div className="bar-track compact"><div className="bar-fill crime" style={{width:`${crimeFamilyProgress(xp)}%`}}/></div></div>;})}</section>
    <div className="single-crime-list">{CRIME_PLUGINS.map((plugin)=>{const crime=plugin.definition;const masteryXp=g.gameState.crimeMastery[crime.id]??0;const mastery=crimeCareerMasteryLevel(masteryXp);const locked=g.gameState.crimeExperience<crime.unlockCrimeExperience;const activeCount=(crime.operationIds??[]).filter((id)=>g.gameState.activeCrimeOperations.some((job)=>job.operationId===id)).length;return <button type="button" key={crime.id} className={`single-crime-row ${locked?"locked":""}`} onClick={()=>openCrime(crime.id)}><span className="single-crime-icon"><GameIcon name={crime.icon} size={21}/></span><span className="single-crime-main"><span><strong>{crime.name}</strong><small>{crime.description}</small></span><span className="single-crime-progress"><i><b style={{width:`${crimeCareerMasteryProgress(masteryXp)}%`}}/></i><small>Mastery {mastery} · {masteryRank(mastery)}</small></span></span><span className="single-crime-meta"><small>{crime.baseNerve} Nerve+</small><b className={riskClass(crime.risk)}>{crime.risk}</b>{activeCount>0?<em>{activeCount} ACTIVE</em>:null}</span><span className="single-crime-open">{locked?<><GameIcon name="lock" size={14}/><small>CE {crime.unlockCrimeExperience}</small></>:"›"}</span></button>;})}</div>
  </div>;
}
