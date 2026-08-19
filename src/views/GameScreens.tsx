import React from "react";
import type { useRiftCity } from "../hooks/useRiftCity";

import { Panel, Button } from "../components/ui";
import { InteractiveCombatView } from "./Combat";

import {
  CRIMES,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
} from "../systems/crimeSystem";

import {
  DEFAULT_WEAPONS,
  calculateWinChance,
} from "../systems/combatSystem";

import {
  GYMS,
  TRAINING_STATS,
  gymUnlocked,
  canTrainStat,
} from "../systems/gymSystem";

import { PLAYER_PROFILES } from "../data/playerProfiles";

import {
  money,
  HOSPITAL_MINUTES,
  MAX_ENERGY,
} from "../core/gameCore";

import type { SaveData } from "../types/riftCity";

/*
 * Management screens were moved to their own module.
 *
 * These re-exports are intentional.
 * They allow the rest of the application to keep importing
 * Character, Jobs, Items, etc. from GameScreens without
 * requiring another giant import refactor right now.
 */
export {
  Character,
  Jobs,
  Items,
  Missions,
  Education,
  PropertyView,
  Market,
  Faction,
  Awards,
} from "./ManagementScreens";

type Game = ReturnType<typeof useRiftCity>;

/* =========================================================
   CRIMES
========================================================= */

export function Crimes({ g }: { g: Game }) {
  const incapacitated = Boolean(
    g.gameState.jailUntil ||
      g.gameState.hospitalUntil
  );

  return (
    <div className="ui-grid two-col">
      {CRIMES.map((crime) => {
        const chance = crimeSuccessChance(
          crime,
          g.gameState.crimeExperience,
          1,
          getCrimeStatBonus(
            g.gameState.stats
          )
        );

        const unlocked = crimeUnlocked(
          crime,
          g.gameState.crimeExperience
        );

        const enoughNerve =
          g.gameState.nerve >= crime.nerve;

        const canCommit =
          unlocked &&
          enoughNerve &&
          !incapacitated;

        return (
          <div
            className={`card crime-card ${
              unlocked ? "" : "disabled"
            }`}
            key={crime.id}
          >
            <div className="card-header-split">
              <span className="card-tag">
                NERVE {crime.nerve}
              </span>

              <span className="chance-badge">
                {unlocked
                  ? `${chance.toFixed(
                      0
                    )}% Success`
                  : `Requires CE ${crime.crimeExperienceRequired}`}
              </span>
            </div>

            <h3>{crime.name}</h3>

            <p>{crime.description}</p>

            <div className="bar-track">
              <div
                className="bar-fill crime"
                style={{
                  width: `${
                    unlocked
                      ? Math.min(
                          100,
                          chance
                        )
                      : 0
                  }%`,
                }}
              />
            </div>

            {!enoughNerve &&
              unlocked && (
                <p className="status-text">
                  Requires {crime.nerve} nerve.
                </p>
              )}

            <Button
              disabled={!canCommit}
              onClick={() =>
                g.commitCrime(crime)
              }
            >
              Commit Crime
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   COMBAT
========================================================= */

export function Combat({ g }: { g: Game }) {
  if (g.combatOpponent) {
    const opponent = g.combatOpponent;

    return (
      <InteractiveCombatView
        player={{
          id: "player",
          name: "You",
          level: g.level,
          health: g.gameState.health,
          maxHealth: g.maxHealth,
          stats: g.gameState.stats,
          weapons: DEFAULT_WEAPONS,
        }}
        enemy={{
          id: opponent.id,
          name: opponent.name,
          level: opponent.level,
          health: opponent.health,
          maxHealth: opponent.maxHealth,
          stats: opponent.stats,
          weapons:
            opponent.weapons ||
            DEFAULT_WEAPONS,
          cashReward:
            opponent.cashReward,
          xpReward:
            opponent.level * 25,
        }}
        onFinish={(
          outcome,
          enemy,
          finalPlayerHealth
        ) => {
          let cashEarned = 0;

          const baseXp =
            enemy.xpReward || 50;

          let xpEarned = baseXp;

          const isVictory =
            outcome === "mug";

          if (outcome === "mug") {
            cashEarned =
              Math.floor(
                (enemy.cashReward ||
                  100) *
                  (0.4 +
                    Math.random() *
                      0.4)
              );

            xpEarned =
              Math.floor(
                baseXp * 0.25
              );
          } else if (
            outcome === "leave"
          ) {
            xpEarned =
              Math.floor(
                baseXp * 0.25
              );
          }

          g.setGameState(
            (previous) => {
              const next: SaveData = {
                ...previous,

                cash:
                  previous.cash +
                  cashEarned,

                xp:
                  previous.xp +
                  xpEarned,

                health: Math.max(
                  1,
                  Math.min(
                    g.maxHealth,
                    finalPlayerHealth
                  )
                ),

                fightsWon: isVictory
                  ? previous.fightsWon +
                    1
                  : previous.fightsWon,
              };

              const description =
                isVictory
                  ? `COMBAT VICTORY: Defeated ${enemy.name}. Earned ${money(
                      cashEarned
                    )} and ${xpEarned} XP.`
                  : `COMBAT ENDED: You left the encounter with ${xpEarned} XP.`;

              return g.appendActivity(
                next,
                description,
                isVictory
                  ? "combat"
                  : "system"
              );
            }
          );

          g.setCombatOpponent(null);
          g.setCombatStarted(false);
          g.setCurrentScreen("combat");
        }}
        onDefeat={() =>
          setGameStateForCombatDefeat(g)
        }
      />
    );
  }

  const incapacitated = Boolean(
    g.gameState.jailUntil ||
      g.gameState.hospitalUntil
  );

  const noEnergy =
    g.gameState.energy < 10;

  return (
    <Panel title="Available Targets">
      <div className="ui-grid two-col">
        {PLAYER_PROFILES.map(
          (opponent) => {
            const winChance =
              calculateWinChance(
                g.gameState.stats,
                opponent.stats
              );

            return (
              <div
                className="card target-card"
                key={opponent.id}
              >
                <div className="card-header-split">
                  <span className="card-tag">
                    LV {opponent.level}
                  </span>

                  <span className="status-badge">
                    {opponent.status}
                  </span>
                </div>

                <h3>
                  {opponent.name}
                </h3>

                <p>
                  {opponent.title} ·{" "}
                  {opponent.location}
                </p>

                <div className="data-list">
                  <div className="data-row">
                    <span>
                      Health
                    </span>

                    <b>
                      {
                        opponent.health
                      }
                      /
                      {
                        opponent.maxHealth
                      }
                    </b>
                  </div>

                  <div className="data-row">
                    <span>
                      Reward
                    </span>

                    <b>
                      {money(
                        opponent.cashReward
                      )}
                    </b>
                  </div>

                  <div className="data-row">
                    <span>
                      Win Chance
                    </span>

                    <b>
                      {winChance}%
                    </b>
                  </div>
                </div>

                <Button
                  disabled={
                    incapacitated ||
                    noEnergy
                  }
                  onClick={() =>
                    g.attack(
                      opponent
                    )
                  }
                >
                  {incapacitated
                    ? "Unavailable"
                    : noEnergy
                    ? "Need 10 ⚡"
                    : "Attack (10 ⚡)"}
                </Button>
              </div>
            );
          }
        )}
      </div>
    </Panel>
  );
}

/* =========================================================
   COMBAT DEFEAT
========================================================= */

function setGameStateForCombatDefeat(
  g: Game
) {
  const hospitalUntil =
    Date.now() +
    HOSPITAL_MINUTES * 60_000;

  g.setGameState((previous) => {
    const activity = {
      id:
        Date.now() +
        Math.random(),

      text:
        "COMBAT LOSS: Knocked out and hospitalized.",

      type: "failure" as const,

      time: Date.now(),
    };

    return {
      ...previous,

      health: 0,

      fightsLost:
        previous.fightsLost + 1,

      hospitalUntil,

      activities: [
        activity,
        ...previous.activities,
      ].slice(0, 60),
    };
  });

  g.setCombatOpponent(null);
  g.setCombatStarted(false);
  g.setCurrentScreen("city");
}

/* =========================================================
   GYM
========================================================= */

export function GymView({
  g,
}: {
  g: Game;
}) {
  const availableGyms =
    GYMS.filter(
      (gym) => !gym.jailOnly
    );

  const incapacitated =
    Boolean(
      g.gameState.jailUntil ||
        g.gameState.hospitalUntil
    );

  return (
    <>
      <div className="gym-selector">
        {availableGyms.map(
          (gym) => {
            const unlocked =
              gymUnlocked(
                gym,
                g.gameState
                  .gymExperience
              );

            const active =
              g.gym.id === gym.id;

            return (
              <button
                type="button"
                key={gym.id}
                className={`gym-btn ${
                  active
                    ? "active"
                    : ""
                }`}
                disabled={
                  !unlocked ||
                  incapacitated
                }
                onClick={() =>
                  g.buyGym(
                    gym.id
                  )
                }
              >
                <span>
                  {gym.name}
                </span>

                <small>
                  {unlocked
                    ? money(
                        gym.membershipCost
                      )
                    : `EXP ${gym.gymExpRequired}`}
                </small>
              </button>
            );
          }
        )}
      </div>

      <Panel
        title={`${g.gym.name} · (${g.gym.energyCost} Energy per set)`}
      >
        <div className="ui-grid four-col">
          {TRAINING_STATS.map(
            (stat) => {
              const allowed =
                canTrainStat(
                  g.gym,
                  stat.id
                );

              const enoughEnergy =
                g.gameState.energy >=
                g.gym.energyCost;

              const canTrain =
                allowed &&
                enoughEnergy &&
                !incapacitated;

              return (
                <div
                  className="card train-card"
                  key={stat.id}
                >
                  <span className="train-icon">
                    {stat.icon}
                  </span>

                  <h3>
                    {stat.name}
                  </h3>

                  <p>
                    {
                      stat.description
                    }
                  </p>

                  <Button
                    disabled={
                      !canTrain
                    }
                    onClick={() =>
                      g.train(
                        stat.id
                      )
                    }
                  >
                    {!allowed
                      ? "Not Available"
                      : !enoughEnergy
                      ? `Need ${g.gym.energyCost} ⚡`
                      : incapacitated
                      ? "Unavailable"
                      : "Train"}
                  </Button>
                </div>
              );
            }
          )}
        </div>
      </Panel>
    </>
  );
}
