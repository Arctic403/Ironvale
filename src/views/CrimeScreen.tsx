import React, { useMemo, useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";
import { Button } from "../components/ui";
import { GameIcon } from "../components/GameIcon";
import { formatTime, money } from "../core/gameCore";
import {
  CRIMES, Crime, CrimeRunModifiers, applyCrimeEventOption, crimeSuccessChance, crimeUnlocked,
  getCrimeStatBonus, crimeMasteryLevel, emptyCrimeRunModifiers, generateCrimeEvents,
} from "../systems/crimeSystem";
import { getCrimeTool, recommendedCrimeTools } from "../systems/crimeTools";
import {
  CRIME_FAMILY_LABELS, CRIME_OPERATIONS, GRAFFITI_SPOTS, CrimeFamily, TargetCrimeKind,
  buildCrimeTargets, crimeFamilyForLegacyCrime, crimeFamilyLevel, crimeFamilyProgress,
  crimeTargetBoardSeed, graffitiRank, graffitiSuccessChance, targetSuccessChance,
} from "../systems/crimeActivities";

type Game = ReturnType<typeof useRiftCity>;
type ActiveRun={crime:Crime;choiceId:string;toolId:string|null;events:ReturnType<typeof generateCrimeEvents>;stage:number;mods:CrimeRunModifiers};
type CrimeTab = "targets" | "operations" | "graffiti" | "heists";

const HEIST_IDS = new Set(["robbery", "warehouse-job", "bank-job", "major-heist"]);
const QUICK_IDS = new Set(["shoplift", "package-swipe", "cargo-theft"]);
const HEIST_CRIMES = CRIMES.filter((crime) => HEIST_IDS.has(crime.id));
const QUICK_CRIMES = CRIMES.filter((crime) => QUICK_IDS.has(crime.id));

function crimeIcon(kind: TargetCrimeKind) {
  if (kind === "vehicle") return "car" as const;
  if (kind === "burglary") return "building" as const;
  return "target" as const;
}

export function Crimes({ g }: { g: Game }) {
  const [tab, setTab] = useState<CrimeTab>("targets");
  const [targetKind, setTargetKind] = useState<TargetCrimeKind>("pickpocket");
  const [choices, setChoices] = useState<Record<string,string>>({});
  const [run,setRun]=useState<ActiveRun|null>(null);
  const [tools,setTools]=useState<Record<string,string>>({});
  const [targetTools,setTargetTools]=useState<Record<TargetCrimeKind,string>>({pickpocket:"",burglary:"",vehicle:""});
  const incapacitated = Boolean(g.gameState.jailUntil || g.gameState.hospitalUntil);
  const now = Date.now();
  const boardSeed = crimeTargetBoardSeed(now);
  const boardRefreshRemaining = 5 * 60 * 1000 - (now % (5 * 60 * 1000));
  const targets = useMemo(() => buildCrimeTargets(targetKind, boardSeed), [targetKind, boardSeed]);
  const targetLegacyCrimeId = targetKind === "vehicle" ? "vehicle-theft" : targetKind;
  const targetRecommendedTools = recommendedCrimeTools(targetLegacyCrimeId);
  const selectedTargetToolId = targetTools[targetKind] || "";
  const selectedTargetTool = getCrimeTool(selectedTargetToolId);
  const selectedTargetToolOwned = selectedTargetTool ? (g.gameState.inventory[selectedTargetTool.id] || 0) : 0;

  const beginCrime=(crime:Crime,choiceId:string,toolId:string|null)=>{
    const mastery=crimeMasteryLevel(g.gameState.crimeMastery[crime.id]??0);
    const events=generateCrimeEvents(crime,mastery);
    setRun({crime,choiceId,toolId,events,stage:0,mods:emptyCrimeRunModifiers()});
  };

  const chooseEvent=(option:ActiveRun["events"][number]["options"][number])=>{
    if(!run)return;
    const mods=applyCrimeEventOption(run.mods,option);
    const nextStage=run.stage+1;
    if(nextStage>=run.events.length){
      g.commitCrime(run.crime,run.choiceId,mods,run.toolId);
      setRun(null);
      return;
    }
    setRun({...run,stage:nextStage,mods});
  };

  const currentEvent=run?.events[run.stage]??null;
  const projectedChance=useMemo(()=>{
    if(!run)return 0;
    const masteryXp=g.gameState.crimeMastery[run.crime.id]??0;
    const selected=run.crime.choices.find(x=>x.id===run.choiceId)??run.crime.choices[1]??run.crime.choices[0];
    const tool=getCrimeTool(run.toolId);
    const toolBonus=tool&&(g.gameState.inventory[tool.id]||0)>0?(tool.modifiers.chanceModifier??0):0;
    const family = crimeFamilyForLegacyCrime(run.crime.id);
    const skillBonus = crimeFamilyLevel(g.gameState.crimeSkillXp[family] ?? 0) * 0.65;
    const repBonus = Math.min(5, Math.floor(g.gameState.streetReputation / 25));
    return Math.max(2,Math.min(97,crimeSuccessChance(run.crime,g.gameState.crimeExperience,1,getCrimeStatBonus(g.combatStats)+(g.gameState.meritUpgrades["crime-edge"]??0)*2+((g.gameState.npcReputation.mara??0)>=25?2:0)+(g.gameState.currentLocation==="crime"?2:0)-Math.floor(g.gameState.heat/25)+skillBonus+repBonus,masteryXp,selected)+run.mods.chanceModifier+toolBonus));
  },[run,g.gameState.crimeExperience,g.gameState.crimeMastery,g.gameState.crimeSkillXp,g.gameState.streetReputation,g.gameState.meritUpgrades,g.gameState.npcReputation,g.gameState.currentLocation,g.gameState.heat,g.gameState.inventory,g.combatStats]);

  const quickChance=(crime:Crime)=>{
    const choice=crime.choices.find((item)=>item.id==="balanced")??crime.choices[0];
    const family=crimeFamilyForLegacyCrime(crime.id);
    return Math.max(2,Math.min(97,crimeSuccessChance(crime,g.gameState.crimeExperience,1,getCrimeStatBonus(g.combatStats)+(g.gameState.meritUpgrades["crime-edge"]??0)*2+((g.gameState.npcReputation.mara??0)>=25?2:0)+(g.gameState.currentLocation==="crime"?2:0)-Math.floor(g.gameState.heat/25)+crimeFamilyLevel(g.gameState.crimeSkillXp[family]??0)*.65+Math.min(5,Math.floor(g.gameState.streetReputation/25)),g.gameState.crimeMastery[crime.id]??0,choice)));
  };

  return (
    <div className="crime-hub-v3">
      <section className="crime-hub-hero">
        <div>
          <span className="card-tag">CRIMINAL ACTIVITY HUB</span>
          <h2>Build a criminal career, not one repeating button.</h2>
          <p>Targets refresh, passive operations run on timers, graffiti builds Street Rep, and branching decisions are reserved for major jobs where they actually matter.</p>
        </div>
        <div className="crime-hero-rank">
          <GameIcon name="spray" size={24} />
          <span>Street Rep</span>
          <strong>{g.gameState.streetReputation}</strong>
          <small>{graffitiRank(g.gameState.streetReputation)}</small>
        </div>
      </section>

      <div className="crime-summary-strip crime-summary-v3">
        <div><span>Crime Experience</span><strong>{g.gameState.crimeExperience}</strong></div>
        <div><span>Nerve</span><strong>{g.gameState.nerve}/{g.maxNerve}</strong></div>
        <div><span>Heat</span><strong>{g.gameState.heat}/100</strong></div>
        <div><span>Street Rep</span><strong>{g.gameState.streetReputation}</strong></div>
        <div><span>Bounty</span><strong>{money(g.gameState.playerBounty)}</strong></div>
        <div><span>Passive Ops</span><strong>{g.gameState.activeCrimeOperations.length}/3</strong></div>
      </div>

      <section className="crime-skill-rack" aria-label="Crime family skills">
        {(Object.entries(CRIME_FAMILY_LABELS) as Array<[CrimeFamily,string]>).map(([family,label])=>{
          const xp=g.gameState.crimeSkillXp[family]??0;
          const level=crimeFamilyLevel(xp);
          return <div key={family} className="crime-skill-chip"><span>{label}</span><strong>Lv {level}</strong><div className="bar-track compact"><div className="bar-fill crime" style={{width:`${crimeFamilyProgress(xp)}%`}} /></div></div>;
        })}
      </section>

      <nav className="crime-hub-tabs" aria-label="Crime categories">
        <button type="button" className={tab==="targets"?"active":""} onClick={()=>{setTab("targets");setRun(null);}}><GameIcon name="target" size={15}/>Targets</button>
        <button type="button" className={tab==="operations"?"active":""} onClick={()=>{setTab("operations");setRun(null);}}><GameIcon name="clock" size={15}/>Operations</button>
        <button type="button" className={tab==="graffiti"?"active":""} onClick={()=>{setTab("graffiti");setRun(null);}}><GameIcon name="spray" size={15}/>Graffiti</button>
        <button type="button" className={tab==="heists"?"active":""} onClick={()=>setTab("heists")}><GameIcon name="crimes" size={15}/>Major Jobs</button>
      </nav>

      {tab==="targets"&&<section className="crime-tab-panel">
        <div className="crime-section-heading">
          <div><span className="card-tag">ACTIVE CRIME</span><h3>Scout & Choose Targets</h3><p>Boards rotate every five minutes. Scout first for a clearer read and a real success bonus, or take the risk without scouting.</p></div>
          <span className="crime-refresh-pill">New board in {formatTime(boardRefreshRemaining)}</span>
        </div>

        <div className="target-kind-tabs">
          <button type="button" className={targetKind==="pickpocket"?"active":""} onClick={()=>setTargetKind("pickpocket")}><GameIcon name="target" size={14}/>Pickpocket</button>
          <button type="button" className={targetKind==="burglary"?"active":""} onClick={()=>setTargetKind("burglary")}><GameIcon name="building" size={14}/>Burglary</button>
          <button type="button" className={targetKind==="vehicle"?"active":""} onClick={()=>setTargetKind("vehicle")}><GameIcon name="car" size={14}/>Vehicle Theft</button>
        </div>

        {targetRecommendedTools.length>0&&<div className="target-board-prep"><div><GameIcon name="tools" size={15}/><span>Optional one-use prep</span></div><select value={selectedTargetToolId} onChange={(event: React.ChangeEvent<HTMLSelectElement>)=>setTargetTools(prev=>({...prev,[targetKind]:event.target.value}))}><option value="">No tool</option>{targetRecommendedTools.map(tool=><option key={tool.id} value={tool.id} disabled={(g.gameState.inventory[tool.id]||0)<=0}>{tool.name} · owned {g.gameState.inventory[tool.id]||0} · {(tool.modifiers.chanceModifier??0)>=0?"+":""}{tool.modifiers.chanceModifier??0}% success</option>)}</select>{selectedTargetTool&&<small>{selectedTargetTool.description} {selectedTargetToolOwned>0?"It will be consumed when you attempt a target.":"Buy one at the Black Market first."}</small>}</div>}

        <div className="crime-target-grid">
          {targets.map((target)=>{
            const scouted=g.gameState.scoutedCrimeTargets.includes(target.id);
            const resolved=g.gameState.resolvedCrimeTargets.includes(target.id);
            const skill=g.gameState.crimeSkillXp[target.family]??0;
            const chance=Math.max(4,Math.min(97,targetSuccessChance(target,skill,g.combatStats.dexterity,g.gameState.heat,scouted,g.gameState.streetReputation)+(selectedTargetTool&&selectedTargetToolOwned>0?(selectedTargetTool.modifiers.chanceModifier??0):0)));
            const canAttempt=!incapacitated&&!resolved&&g.gameState.nerve>=target.nerve;
            return <article key={target.id} className={`crime-target-card ${scouted?"scouted":""} ${resolved?"resolved":""}`}>
              <header><span className="target-icon"><GameIcon name={crimeIcon(target.kind)} size={18}/></span><div><small>{target.area}</small><h4>{target.name}</h4></div><span className="target-state">{resolved?"GONE":scouted?`${chance.toFixed(0)}%`:"UNSCOUTED"}</span></header>
              <p>{target.profile}</p>
              <div className="target-intel-grid">
                <span><small>Nerve</small><strong>{target.nerve}</strong></span>
                <span><small>Skill</small><strong>Lv {crimeFamilyLevel(skill)}</strong></span>
                <span><small>Reward</small><strong>{scouted?`${money(target.minReward)}–${money(target.maxReward)}`:"Unknown"}</strong></span>
                <span><small>Heat</small><strong>{scouted?`+${target.heat}`:"Unknown"}</strong></span>
              </div>
              <div className="target-scout-note"><GameIcon name="info" size={13}/><span>{scouted?target.hint:"Spend 1 Nerve to scout this target. Scouting reveals the payout/risk estimate and gives +9% success."}</span></div>
              <div className="target-actions">
                <Button disabled={resolved||scouted||incapacitated||g.gameState.nerve<1} onClick={()=>g.scoutCrimeTarget(target.id)}>{scouted?"Scouted":"Scout · 1 Nerve"}</Button>
                <Button disabled={!canAttempt} onClick={()=>g.resolveCrimeTarget(target,selectedTargetToolOwned>0?selectedTargetToolId:null)}>{resolved?"Target Gone":`Attempt · ${target.nerve} Nerve`}</Button>
              </div>
            </article>;
          })}
        </div>

        <div className="crime-section-heading compact"><div><span className="card-tag">QUICK CRIMES</span><h3>Fast Scores</h3><p>No three-choice sequence here—these resolve immediately and are useful for building early crime-family skill.</p></div></div>
        <div className="quick-crime-row">
          {QUICK_CRIMES.map((crime)=>{
            const unlocked=crimeUnlocked(crime,g.gameState.crimeExperience);
            const can=unlocked&&g.gameState.nerve>=crime.nerve&&!incapacitated;
            const family=crimeFamilyForLegacyCrime(crime.id);
            return <article key={crime.id} className={`quick-crime-card ${unlocked?"":"locked"}`}><div><small>{CRIME_FAMILY_LABELS[family]}</small><h4>{crime.name}</h4><p>{crime.description}</p></div><div className="quick-crime-stats"><span>{crime.nerve} Nerve</span><span>{unlocked?`${quickChance(crime).toFixed(0)}% hit`:`CE ${crime.crimeExperienceRequired}`}</span><span>{money(crime.minReward)}–{money(crime.maxReward)}</span></div><Button disabled={!can} onClick={()=>g.commitCrime(crime,"balanced")}>{unlocked?"Run Crime":"Locked"}</Button></article>;
          })}
        </div>
      </section>}

      {tab==="operations"&&<section className="crime-tab-panel">
        <div className="crime-section-heading"><div><span className="card-tag">PASSIVE / SEMI-PASSIVE</span><h3>Crime Operations</h3><p>Fund an operation, let its timer run while you do other things, then collect the result. Detection risk rises with Heat and falls as the matching skill improves.</p></div><span className="crime-refresh-pill">{g.gameState.activeCrimeOperations.length}/3 running</span></div>

        {g.gameState.activeCrimeOperations.length>0&&<div className="active-crime-operations">
          {g.gameState.activeCrimeOperations.map((job)=>{
            const def=CRIME_OPERATIONS.find((item)=>item.id===job.operationId);
            if(!def)return null;
            const done=job.finishesAt<=now;
            return <div key={job.id} className={`active-op-row ${done?"ready":""}`}><GameIcon name={def.icon} size={18}/><div><strong>{def.name}</strong><small>{done?"Ready to collect":"Running in background"}</small></div><span>{done?"READY":formatTime(job.finishesAt-now)}</span><Button disabled={!done} onClick={()=>g.claimCrimeOperation(job.id)}>{done?"Collect":"Running"}</Button></div>;
          })}
        </div>}

        <div className="crime-operation-grid">
          {CRIME_OPERATIONS.map((operation)=>{
            const unlocked=g.gameState.crimeExperience>=operation.crimeExperienceRequired;
            const running=g.gameState.activeCrimeOperations.some((job)=>job.operationId===operation.id);
            const skill=crimeFamilyLevel(g.gameState.crimeSkillXp[operation.family]??0);
            const detection=Math.max(4,Math.min(65,operation.detectionRisk+g.gameState.heat*.12-skill*.55-Math.min(5,g.gameState.streetReputation*.015)));
            const can=unlocked&&!running&&!incapacitated&&g.gameState.cash>=operation.setupCost&&g.gameState.nerve>=operation.nerve&&g.gameState.activeCrimeOperations.length<3;
            return <article key={operation.id} className={`crime-operation-card ${unlocked?"":"locked"}`}><header><span><GameIcon name={operation.icon} size={19}/></span><div><small>{CRIME_FAMILY_LABELS[operation.family]} · Lv {skill}</small><h4>{operation.name}</h4></div></header><p>{operation.description}</p><div className="operation-metrics"><span><small>Setup</small><strong>{money(operation.setupCost)}</strong></span><span><small>Timer</small><strong>{formatTime(operation.durationMs)}</strong></span><span><small>Payout</small><strong>{money(operation.minReward)}–{money(operation.maxReward)}</strong></span><span><small>Detection</small><strong>{unlocked?`${detection.toFixed(0)}%`:`CE ${operation.crimeExperienceRequired}`}</strong></span></div><Button disabled={!can} onClick={()=>g.startCrimeOperation(operation.id)}>{running?"Already Running":unlocked?`Start · ${operation.nerve} Nerve`:"Locked"}</Button></article>;
          })}
        </div>
      </section>}

      {tab==="graffiti"&&<section className="crime-tab-panel graffiti-panel">
        <div className="graffiti-rep-banner"><div><GameIcon name="spray" size={30}/><div><span>STREET REPUTATION</span><strong>{g.gameState.streetReputation}</strong><small>{graffitiRank(g.gameState.streetReputation)}</small></div></div><p>Graffiti is mainly a reputation activity, not a cash farm. Better-known tags unlock more visible spots. Successful tags also train Street Art skill and can add a small amount of faction visibility if you belong to one.</p><div><span>Total tags</span><strong>{g.gameState.graffitiTotalTags}</strong></div></div>
        <div className="graffiti-spot-grid">
          {GRAFFITI_SPOTS.map((spot)=>{
            const repLocked=g.gameState.streetReputation<spot.reputationRequired;
            const cooldown=Math.max(0,(g.gameState.graffitiCooldowns[spot.id]||0)-now);
            const chance=graffitiSuccessChance(spot,g.gameState.crimeSkillXp.street??0,g.combatStats.dexterity,g.gameState.heat,g.gameState.streetReputation);
            const can=!repLocked&&!incapacitated&&cooldown<=0&&g.gameState.nerve>=spot.nerve&&g.gameState.cash>=spot.paintCost;
            return <article key={spot.id} className={`graffiti-spot-card ${repLocked?"locked":""}`}><header><span className="graffiti-mark"><GameIcon name="spray" size={19}/></span><div><small>{spot.district}</small><h4>{spot.name}</h4></div><span className="graffiti-rep-reward">+{spot.reputationGain} REP</span></header><p>{spot.description}</p><div className="graffiti-metrics"><span>{spot.nerve} Nerve</span><span>{money(spot.paintCost)} supplies</span><span>{chance.toFixed(0)}% success</span><span>Heat +{spot.heat}</span><span>Tagged {g.gameState.graffitiTags[spot.id]||0}×</span></div>{repLocked?<div className="graffiti-lock"><GameIcon name="lock" size={13}/>Requires {spot.reputationRequired} Street Rep</div>:cooldown>0?<div className="graffiti-lock"><GameIcon name="clock" size={13}/>Spot cools down in {formatTime(cooldown)}</div>:null}<Button disabled={!can} onClick={()=>g.tagGraffiti(spot.id)}>{repLocked?"Reputation Locked":cooldown>0?"Spot Too Hot":"Leave Your Mark"}</Button></article>;
          })}
        </div>
      </section>}

      {tab==="heists"&&<section className="crime-tab-panel">
        {!run&&<div className="crime-intro-card"><strong>Branching choices are now reserved for major jobs.</strong><span>Robberies, warehouse jobs, bank jobs and major heists can still roll live situations because those decisions carry enough weight to stay interesting.</span></div>}

        {run&&currentEvent&&(
          <section className={`crime-run-panel risk-${run.mods.riskLabel.toLowerCase()}`}>
            <div className="crime-run-top"><div><span className="card-tag">LIVE JOB · STEP {run.stage+1}/{run.events.length}</span><h2>{run.crime.name}</h2></div><button type="button" className="crime-run-abort" onClick={()=>setRun(null)}>Abort</button></div>
            <div className="crime-live-stats"><span>Projected success <strong>{projectedChance.toFixed(0)}%</strong></span><span>Reward <strong>×{run.mods.rewardMultiplier.toFixed(2)}</strong></span><span>Loot <strong>×{run.mods.lootMultiplier.toFixed(2)}</strong></span><span>Risk <strong>{run.mods.riskLabel}</strong></span></div>
            <div className={`crime-event-card ${currentEvent.rare?"rare":""}`}><span className="crime-event-kicker">{currentEvent.rare?"RARE OPPORTUNITY":"SITUATION CHANGED"}</span><h3>{currentEvent.title}</h3><p>{currentEvent.text}</p><div className="crime-event-options">{currentEvent.options.map(option=>{const statValue=option.requiredStat?g.combatStats[option.requiredStat.stat]:0;const statLocked=Boolean(option.requiredStat&&statValue<option.requiredStat.value);return <button type="button" key={option.id} disabled={statLocked} className={`crime-event-option risk-${option.risk.toLowerCase()} ${option.rare?"rare":""} ${statLocked?"locked":""}`} onClick={()=>chooseEvent(option)}><div><strong>{option.label}</strong><span>{option.risk}</span></div><p>{option.description}</p><small>{option.requiredStat?`${option.requiredStat.stat.toUpperCase()} ${statValue.toFixed(0)}/${option.requiredStat.value} · `:""}{(option.modifiers.chanceModifier??0)!==0?`${(option.modifiers.chanceModifier??0)>0?"+":""}${option.modifiers.chanceModifier}% success · `:""}{(option.modifiers.rewardMultiplier??1)!==1?`×${(option.modifiers.rewardMultiplier??1).toFixed(2)} reward · `:""}{(option.modifiers.lootMultiplier??1)!==1?`×${(option.modifiers.lootMultiplier??1).toFixed(2)} loot`:""}</small></button>;})}</div></div>
            {run.mods.story.length>0&&<div className="crime-run-story"><strong>So far</strong>{run.mods.story.map((story,index)=><span key={index}>• {story}</span>)}</div>}
          </section>
        )}

        {!run&&<div className="ui-grid two-col crime-grid-v2">
          {HEIST_CRIMES.map((crime) => {
            const selectedChoiceId = choices[crime.id] ?? "balanced";
            const selectedChoice = crime.choices.find((choice) => choice.id === selectedChoiceId) ?? crime.choices[1] ?? crime.choices[0];
            const recommendedTools = recommendedCrimeTools(crime.id);
            const selectedToolId = tools[crime.id] || "";
            const selectedTool = getCrimeTool(selectedToolId);
            const selectedToolOwned = selectedTool ? (g.gameState.inventory[selectedTool.id] || 0) : 0;
            const masteryXp = g.gameState.crimeMastery[crime.id] ?? 0;
            const masteryLevel = crimeMasteryLevel(masteryXp);
            const family=crimeFamilyForLegacyCrime(crime.id);
            const chance = Math.min(97, crimeSuccessChance(crime,g.gameState.crimeExperience,1,getCrimeStatBonus(g.combatStats)+(g.gameState.meritUpgrades["crime-edge"]??0)*2+((g.gameState.npcReputation.mara??0)>=25?2:0)+(g.gameState.currentLocation==="crime"?2:0)-Math.floor(g.gameState.heat/25)+crimeFamilyLevel(g.gameState.crimeSkillXp[family]??0)*.65+Math.min(5,Math.floor(g.gameState.streetReputation/25)),masteryXp,selectedChoice) + (selectedTool && selectedToolOwned>0 ? (selectedTool.modifiers.chanceModifier??0) : 0));
            const unlocked = crimeUnlocked(crime, g.gameState.crimeExperience);
            const enoughNerve = g.gameState.nerve >= crime.nerve;
            const hasIntel = !crime.requiredIntel || g.gameState.crimeIntel.includes(crime.requiredIntel);
            const canCommit = unlocked && hasIntel && enoughNerve && !incapacitated && !run;
            const masteryPercent = Math.min(100, ((masteryXp % 50) / 50) * 100);
            return <article className={`card crime-card crime-card-v2 ${unlocked ? "" : "disabled"}`} key={crime.id}><div className="card-header-split"><div><span className="card-tag">MASTERY {masteryLevel} · {CRIME_FAMILY_LABELS[family]} LV {crimeFamilyLevel(g.gameState.crimeSkillXp[family]??0)}</span><h3>{crime.name}</h3></div><span className="chance-badge">{unlocked ? `${chance.toFixed(0)}%` : `CE ${crime.crimeExperienceRequired}`}</span></div><p>{crime.description}</p><div className="crime-meta-row"><span><GameIcon name="nerve" size={13} /> {crime.nerve} Nerve</span><span><GameIcon name="cash" size={13} /> ${crime.minReward}–${crime.maxReward}</span><span><GameIcon name="warning" size={13} /> Risk {crime.risk}</span><span><GameIcon name="gift" size={13} /> Item drops</span></div><div className="crime-mastery-line"><span>Mastery XP {masteryXp}</span><div className="bar-track compact"><div className="bar-fill crime" style={{width:`${masteryPercent}%`}} /></div></div>{unlocked && <div className="crime-choice-grid">{crime.choices.map((choice) => <button type="button" key={choice.id} className={`crime-choice ${choice.id === selectedChoiceId ? "active" : ""}`} onClick={() => setChoices((prev) => ({...prev,[crime.id]:choice.id}))}><strong>{choice.label}</strong><small>{choice.description}</small><span>{choice.chanceModifier >= 0 ? "+" : ""}{choice.chanceModifier}% chance · ×{choice.rewardMultiplier.toFixed(2)} payout</span></button>)}</div>}{unlocked && recommendedTools.length>0 && <div className="crime-tool-picker"><label><span>Recommended one-use tool</span><select value={selectedToolId} onChange={(event: React.ChangeEvent<HTMLSelectElement>)=>setTools(prev=>({...prev,[crime.id]:event.target.value}))}><option value="">No tool</option>{recommendedTools.map(tool=><option key={tool.id} value={tool.id} disabled={(g.gameState.inventory[tool.id]||0)<=0}>{tool.name} · owned {g.gameState.inventory[tool.id]||0} · {(tool.modifiers.chanceModifier??0)>=0?"+":""}{tool.modifiers.chanceModifier??0}%</option>)}</select></label>{selectedTool&&<small>{selectedTool.description} {selectedToolOwned>0?"Consumed when this attempt runs.":"Buy it at the Black Market first."}</small>}</div>}{crime.requiredIntel && unlocked && !hasIntel && <p className="status-text">Requires intel: {crime.requiredIntel.replace(/-/g," ")}</p>}{!enoughNerve && unlocked && <p className="status-text">Requires {crime.nerve} nerve.</p>}<Button disabled={!canCommit} onClick={() => beginCrime(crime,selectedChoiceId,selectedToolOwned>0?selectedToolId:null)}>{unlocked ? `Begin · ${selectedChoice.label}${selectedToolOwned>0&&selectedTool ? ` + ${selectedTool.name}` : ""}` : "Locked"}</Button></article>;
          })}
        </div>}
      </section>}
    </div>
  );
}
