import React from "react";
import type { useRiftCity } from "../hooks/useRiftCity";

import { Panel, Button } from "../components/ui";

import {
  GYMS,
  TRAINING_STATS,
  gymUnlocked,
  canTrainStat,
} from "../systems/gymSystem";

import { money } from "../core/gameCore";

type Game = ReturnType<typeof useRiftCity>;

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
