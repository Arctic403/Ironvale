import React from "react";
import type { useRiftCity } from "../hooks/useRiftCity";
import { Panel, Button } from "../components/ui";
import { GameIcon } from "../components/GameIcon";
import {
  TRAINING_STATS,
  TRAINING_PROGRAMS,
  programUnlocked,
  trainingEnergyCost,
  projectedTrainingGain,
} from "../systems/gymSystem";

type Game = ReturnType<typeof useRiftCity>;

export function GymView({ g }: { g: Game }) {
  const incapacitated = Boolean(g.gameState.jailUntil || g.gameState.hospitalUntil);
  const program = g.trainingProgram;
  const energyCost = trainingEnergyCost(g.gym, program);

  return (
    <div className="gym-v2">
      <section className="card gym-program-shell">
        <div className="gym-program-header">
          <div>
            <span className="card-tag">RIFT PERFORMANCE LAB</span>
            <h2>Training Programs</h2>
            <p>No gym ladder. Unlock specialized programs through training experience and build a consistency streak.</p>
          </div>
          <div className="gym-streak-badge"><span>Current Streak</span><strong>{g.gameState.trainingStreak}</strong><small>max bonus at 10</small></div>
        </div>

        <div className="gym-program-grid">
          {TRAINING_PROGRAMS.map((candidate) => {
            const unlocked = programUnlocked(candidate, g.gameState.gymExperience);
            const active = candidate.id === program.id;
            return (
              <button
                type="button"
                key={candidate.id}
                className={`gym-program-card ${active ? "active" : ""}`}
                disabled={!unlocked || incapacitated}
                onClick={() => g.selectTrainingProgram(candidate.id)}
              >
                <div><strong>{candidate.name}</strong><small>{candidate.description}</small></div>
                <span>{unlocked ? `${Math.round(candidate.energyModifier*100)}% energy profile` : `Unlock ${candidate.unlockGymExp} Gym XP`}</span>
              </button>
            );
          })}
        </div>
      </section>

      <Panel title={`${program.name} · ${energyCost} Energy per session`}>
        <div className="gym-stat-summary">
          <span>Gym XP <b>{g.gameState.gymExperience}</b></span>
          <span>Program <b>{program.name}</b></span>
          <span>Streak <b>{g.gameState.trainingStreak}/10</b></span>
        </div>

        <div className="ui-grid four-col training-stat-grid">
          {TRAINING_STATS.map((stat) => {
            const current = g.gameState.stats[stat.id];
            const projected = projectedTrainingGain(g.gym, stat.id, program, g.gameState.happiness, Math.max(1,g.gameState.trainingStreak));
            const enoughEnergy = g.gameState.energy >= energyCost;
            return (
              <div className="card train-card train-card-v2" key={stat.id}>
                <div className="train-stat-top"><span className="train-icon"><GameIcon name={stat.id === "strength" ? "gym" : stat.id === "defense" ? "shield" : stat.id === "speed" ? "energy" : "target"} size={24} /></span><span className="training-current-stat">{current.toFixed(2)}</span></div>
                <h3>{stat.name}</h3>
                <p>{stat.description}</p>
                <div className="data-list">
                  <div className="data-row"><span>Current stat</span><b>{current.toFixed(2)}</b></div>
                  <div className="data-row"><span>Estimated gain</span><b>+{projected.toFixed(2)}</b></div>
                  <div className="data-row"><span>Program modifier</span><b>×{program.statMultipliers[stat.id].toFixed(2)}</b></div>
                </div>
                <Button disabled={!enoughEnergy || incapacitated} onClick={() => g.train(stat.id)}>
                  {!enoughEnergy ? `Need ${energyCost} Energy` : incapacitated ? "Unavailable" : `Train ${stat.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
