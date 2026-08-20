import React, { useMemo, useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";
import { Button } from "../components/ui";
import {
  CRIMES, Crime, CrimeRunModifiers, applyCrimeEventOption, crimeSuccessChance, crimeUnlocked,
  getCrimeStatBonus, crimeMasteryLevel, emptyCrimeRunModifiers, generateCrimeEvents,
} from "../systems/crimeSystem";
import { getCrimeTool, recommendedCrimeTools } from "../systems/crimeTools";

type Game = ReturnType<typeof useRiftCity>;
type ActiveRun={crime:Crime;choiceId:string;toolId:string|null;events:ReturnType<typeof generateCrimeEvents>;stage:number;mods:CrimeRunModifiers};

export function Crimes({ g }: { g: Game }) {
  const [choices, setChoices] = useState<Record<string,string>>({});
  const [run,setRun]=useState<ActiveRun|null>(null);
  const [tools,setTools]=useState<Record<string,string>>({});
  const incapacitated = Boolean(g.gameState.jailUntil || g.gameState.hospitalUntil);

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
    const tool=getCrimeTool(run.toolId); const toolBonus=tool&&(g.gameState.inventory[tool.id]||0)>0?(tool.modifiers.chanceModifier??0):0; return Math.max(2,Math.min(97,crimeSuccessChance(run.crime,g.gameState.crimeExperience,1,getCrimeStatBonus(g.combatStats)+(g.gameState.meritUpgrades["crime-edge"]??0)*2+((g.gameState.npcReputation.mara??0)>=25?2:0)+(g.gameState.currentLocation==="crime"?2:0)-Math.floor(g.gameState.heat/25),masteryXp,selected)+run.mods.chanceModifier+toolBonus));
  },[run,g.gameState.crimeExperience,g.gameState.crimeMastery,g.gameState.meritUpgrades,g.gameState.npcReputation,g.gameState.currentLocation,g.gameState.heat,g.gameState.inventory,g.combatStats]);

  return (
    <div className="crime-screen-v2">
      <div className="crime-summary-strip">
        <div><span>Crime Experience</span><strong>{g.gameState.crimeExperience}</strong></div>
        <div><span>Nerve</span><strong>{g.gameState.nerve}/{g.maxNerve}</strong></div>
        <div><span>Heat</span><strong>{g.gameState.heat}/100</strong></div>
        <div><span>Bounty</span><strong>${g.gameState.playerBounty.toLocaleString()}</strong></div>
      </div>

      {run&&currentEvent&&(
        <section className={`crime-run-panel risk-${run.mods.riskLabel.toLowerCase()}`}>
          <div className="crime-run-top">
            <div>
              <span className="card-tag">LIVE CRIME · STEP {run.stage+1}/{run.events.length}</span>
              <h2>{run.crime.name}</h2>
            </div>
            <button type="button" className="crime-run-abort" onClick={()=>setRun(null)}>Abort</button>
          </div>
          <div className="crime-live-stats">
            <span>Projected success <strong>{projectedChance.toFixed(0)}%</strong></span>
            <span>Reward <strong>×{run.mods.rewardMultiplier.toFixed(2)}</strong></span>
            <span>Loot <strong>×{run.mods.lootMultiplier.toFixed(2)}</strong></span>
            <span>Risk <strong>{run.mods.riskLabel}</strong></span>
          </div>
          <div className={`crime-event-card ${currentEvent.rare?"rare":""}`}>
            <span className="crime-event-kicker">{currentEvent.rare?"◆ RARE OPPORTUNITY":"SITUATION CHANGED"}</span>
            <h3>{currentEvent.title}</h3>
            <p>{currentEvent.text}</p>
            <div className="crime-event-options">
              {currentEvent.options.map(option=>{
                const statValue=option.requiredStat?g.combatStats[option.requiredStat.stat]:0;
                const statLocked=Boolean(option.requiredStat&&statValue<option.requiredStat.value);
                return <button type="button" key={option.id} disabled={statLocked} className={`crime-event-option risk-${option.risk.toLowerCase()} ${option.rare?"rare":""} ${statLocked?"locked":""}`} onClick={()=>chooseEvent(option)}>
                  <div><strong>{option.label}</strong><span>{option.risk}</span></div>
                  <p>{option.description}</p>
                  <small>
                    {option.requiredStat?`${option.requiredStat.stat.toUpperCase()} ${statValue.toFixed(0)}/${option.requiredStat.value} · `:""}
                    {(option.modifiers.chanceModifier??0)!==0?`${(option.modifiers.chanceModifier??0)>0?"+":""}${option.modifiers.chanceModifier}% success · `:""}
                    {(option.modifiers.rewardMultiplier??1)!==1?`×${(option.modifiers.rewardMultiplier??1).toFixed(2)} reward · `:""}
                    {(option.modifiers.lootMultiplier??1)!==1?`×${(option.modifiers.lootMultiplier??1).toFixed(2)} loot`:""}
                  </small>
                </button>;
              })}
            </div>
          </div>
          {run.mods.story.length>0&&<div className="crime-run-story"><strong>So far</strong>{run.mods.story.map((s,i)=><span key={i}>• {s}</span>)}</div>}
        </section>
      )}

      {!run&&<div className="crime-intro-card">
        <strong>Branching Crime System</strong>
        <span>Every attempt can roll 1–3 live situations. Rare opportunities can turn a normal score into a jackpot—or add serious consequences.</span>
      </div>}

      <div className="ui-grid two-col crime-grid-v2">
        {CRIMES.map((crime) => {
          const selectedChoiceId = choices[crime.id] ?? "balanced";
          const selectedChoice = crime.choices.find((choice) => choice.id === selectedChoiceId) ?? crime.choices[1] ?? crime.choices[0];
          const recommendedTools = recommendedCrimeTools(crime.id);
          const selectedToolId = tools[crime.id] || "";
          const selectedTool = getCrimeTool(selectedToolId);
          const selectedToolOwned = selectedTool ? (g.gameState.inventory[selectedTool.id] || 0) : 0;
          const masteryXp = g.gameState.crimeMastery[crime.id] ?? 0;
          const masteryLevel = crimeMasteryLevel(masteryXp);
          const chance = Math.min(97, crimeSuccessChance(crime,g.gameState.crimeExperience,1,getCrimeStatBonus(g.combatStats)+(g.gameState.meritUpgrades["crime-edge"]??0)*2+((g.gameState.npcReputation.mara??0)>=25?2:0)+(g.gameState.currentLocation==="crime"?2:0)-Math.floor(g.gameState.heat/25),masteryXp,selectedChoice) + (selectedTool && selectedToolOwned>0 ? (selectedTool.modifiers.chanceModifier??0) : 0));
          const unlocked = crimeUnlocked(crime, g.gameState.crimeExperience);
          const enoughNerve = g.gameState.nerve >= crime.nerve;
          const hasIntel = !crime.requiredIntel || g.gameState.crimeIntel.includes(crime.requiredIntel);
          const canCommit = unlocked && hasIntel && enoughNerve && !incapacitated && !run;
          const masteryPercent = Math.min(100, ((masteryXp % 50) / 50) * 100);

          return (
            <article className={`card crime-card crime-card-v2 ${unlocked ? "" : "disabled"}`} key={crime.id}>
              <div className="card-header-split"><div><span className="card-tag">MASTERY {masteryLevel}</span><h3>{crime.name}</h3></div><span className="chance-badge">{unlocked ? `${chance.toFixed(0)}%` : `CE ${crime.crimeExperienceRequired}`}</span></div>
              <p>{crime.description}</p>
              <div className="crime-meta-row"><span>🔥 {crime.nerve} Nerve</span><span>💵 ${crime.minReward}–${crime.maxReward}</span><span>⚠ Risk {crime.risk}</span><span>🎁 Item drops</span></div>
              <div className="crime-mastery-line"><span>Mastery XP {masteryXp}</span><div className="bar-track compact"><div className="bar-fill crime" style={{width:`${masteryPercent}%`}} /></div></div>
              {unlocked && <div className="crime-choice-grid">{crime.choices.map((choice) => <button type="button" key={choice.id} className={`crime-choice ${choice.id === selectedChoiceId ? "active" : ""}`} onClick={() => setChoices((prev) => ({...prev,[crime.id]:choice.id}))}><strong>{choice.label}</strong><small>{choice.description}</small><span>{choice.chanceModifier >= 0 ? "+" : ""}{choice.chanceModifier}% chance · ×{choice.rewardMultiplier.toFixed(2)} payout</span></button>)}</div>}
              {unlocked && recommendedTools.length>0 && <div className="crime-tool-picker"><label><span>Recommended one-use tool</span><select value={selectedToolId} onChange={(e)=>setTools(prev=>({...prev,[crime.id]:e.target.value}))}><option value="">No tool</option>{recommendedTools.map(tool=><option key={tool.id} value={tool.id} disabled={(g.gameState.inventory[tool.id]||0)<=0}>{tool.name} · owned {g.gameState.inventory[tool.id]||0} · {(tool.modifiers.chanceModifier??0)>=0?"+":""}{tool.modifiers.chanceModifier??0}%</option>)}</select></label>{selectedTool&&<small>{selectedTool.description} {selectedToolOwned>0?"Consumed when this attempt runs.":"Buy it at the Black Market first."}</small>}</div>}
              {crime.requiredIntel && unlocked && !hasIntel && <p className="status-text">Requires intel: {crime.requiredIntel.replace(/-/g," ")}</p>}
              {!enoughNerve && unlocked && <p className="status-text">Requires {crime.nerve} nerve.</p>}
              <Button disabled={!canCommit} onClick={() => beginCrime(crime,selectedChoiceId,selectedToolOwned>0?selectedToolId:null)}>{unlocked ? `Begin · ${selectedChoice.label}${selectedToolOwned>0&&selectedTool ? ` + ${selectedTool.name}` : ""}` : "Locked"}</Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
