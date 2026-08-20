import React, { useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";
import { Button } from "../components/ui";
import {
  CRIMES,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
  crimeMasteryLevel,
} from "../systems/crimeSystem";

type Game = ReturnType<typeof useRiftCity>;

export function Crimes({ g }: { g: Game }) {
  const [choices, setChoices] = useState<Record<string,string>>({});
  const incapacitated = Boolean(g.gameState.jailUntil || g.gameState.hospitalUntil);

  return (
    <div className="crime-screen-v2">
      <div className="crime-summary-strip">
        <div><span>Crime Experience</span><strong>{g.gameState.crimeExperience}</strong></div>
        <div><span>Nerve</span><strong>{g.gameState.nerve}/{g.maxNerve}</strong></div>
        <div><span>Heat</span><strong>{g.gameState.heat}/100</strong></div>
        <div><span>Completed</span><strong>{g.gameState.crimesCompleted}</strong></div>
      </div>

      <div className="ui-grid two-col crime-grid-v2">
        {CRIMES.map((crime) => {
          const selectedChoiceId = choices[crime.id] ?? "balanced";
          const selectedChoice = crime.choices.find((choice) => choice.id === selectedChoiceId) ?? crime.choices[1] ?? crime.choices[0];
          const masteryXp = g.gameState.crimeMastery[crime.id] ?? 0;
          const masteryLevel = crimeMasteryLevel(masteryXp);
          const chance = crimeSuccessChance(
            crime,
            g.gameState.crimeExperience,
            1,
            getCrimeStatBonus(g.combatStats) +
              (g.gameState.meritUpgrades["crime-edge"] ?? 0) * 2 +
              ((g.gameState.npcReputation.mara ?? 0) >= 25 ? 2 : 0) +
              (g.gameState.currentLocation === "crime" ? 2 : 0) -
              Math.floor(g.gameState.heat / 25),
            masteryXp,
            selectedChoice,
          );
          const unlocked = crimeUnlocked(crime, g.gameState.crimeExperience);
          const enoughNerve = g.gameState.nerve >= crime.nerve;
          const hasIntel = !crime.requiredIntel || g.gameState.crimeIntel.includes(crime.requiredIntel);
          const canCommit = unlocked && hasIntel && enoughNerve && !incapacitated;
          const masteryPercent = Math.min(100, ((masteryXp % 50) / 50) * 100);

          return (
            <article className={`card crime-card crime-card-v2 ${unlocked ? "" : "disabled"}`} key={crime.id}>
              <div className="card-header-split">
                <div>
                  <span className="card-tag">MASTERY {masteryLevel}</span>
                  <h3>{crime.name}</h3>
                </div>
                <span className="chance-badge">{unlocked ? `${chance.toFixed(0)}%` : `CE ${crime.crimeExperienceRequired}`}</span>
              </div>

              <p>{crime.description}</p>

              <div className="crime-meta-row">
                <span>🔥 {crime.nerve} Nerve</span>
                <span>💵 ${crime.minReward}–${crime.maxReward}</span>
                <span>⚠ Risk {crime.risk}</span>
              </div>

              <div className="crime-mastery-line">
                <span>Mastery XP {masteryXp}</span>
                <div className="bar-track compact"><div className="bar-fill crime" style={{width:`${masteryPercent}%`}} /></div>
              </div>

              {unlocked && (
                <div className="crime-choice-grid">
                  {crime.choices.map((choice) => (
                    <button
                      type="button"
                      key={choice.id}
                      className={`crime-choice ${choice.id === selectedChoiceId ? "active" : ""}`}
                      onClick={() => setChoices((prev) => ({...prev,[crime.id]:choice.id}))}
                    >
                      <strong>{choice.label}</strong>
                      <small>{choice.description}</small>
                      <span>{choice.chanceModifier >= 0 ? "+" : ""}{choice.chanceModifier}% chance · ×{choice.rewardMultiplier.toFixed(2)} payout</span>
                    </button>
                  ))}
                </div>
              )}

              {crime.requiredIntel && unlocked && !hasIntel && <p className="status-text">Requires intel: {crime.requiredIntel.replace(/-/g," ")}</p>}
              {!enoughNerve && unlocked && <p className="status-text">Requires {crime.nerve} nerve.</p>}

              <Button disabled={!canCommit} onClick={() => g.commitCrime(crime, selectedChoiceId)}>
                {unlocked ? `Attempt · ${selectedChoice.label}` : "Locked"}
              </Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
