import React from "react";
import type { useRiftCity } from "../hooks/useRiftCity";

import { Button } from "../components/ui";

import {
  CRIMES,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
} from "../systems/crimeSystem";

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
          g.gameState.nerve >=
          crime.nerve;

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
