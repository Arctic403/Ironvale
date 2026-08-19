import React, { useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";
import { InteractiveCombatView } from "./Combat";
import { CRIMES, crimeSuccessChance, crimeUnlocked, getCrimeStatBonus } from "../systems/crimeSystem";
import { DEFAULT_WEAPONS, calculateWinChance } from "../systems/combatSystem";
import { GYMS, TRAINING_STATS, gymUnlocked, canTrainStat } from "../systems/gymSystem";
import {
  EDUCATION, ITEMS, JOBS, MISSIONS, PROPERTIES, getItem, getJob, getProperty,
} from "../data/gameData";
import { LOCATIONS } from "../constants/locations";
import { PLAYER_PROFILES } from "../data/playerProfiles";
import { money, formatTime, getLocationName, MAX_ENERGY, HOSPITAL_MINUTES } from "../core/gameCore";
import type { SaveData } from "../types/riftCity";

type Game = ReturnType<typeof useRiftCity>;
export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`card ${className}`}
    >
      <div className="card-header">
        <h3>{title}</h3>
      </div>

      <div className="card-body">
        {children}
      </div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`btn-primary ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Character({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const [amount, setAmount] =
    useState("100");

  const n = Math.max(
    0,
    Number(amount) || 0
  );

  return (
    <div className="ui-grid two-col">
      <Panel title="Combat Stats">
        <div className="stats-list">
          {Object.entries(
            g.gameState.stats
          ).map(([k, v]) => (
            <div
              className="stat-row"
              key={k}
            >
              <span className="stat-name">
                {k}
              </span>

              <strong className="stat-val">
                {(
                  v as number
                ).toFixed(2)}
              </strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Core Resources">
        <div className="data-list">
          <div className="data-row">
            <span>
              ❤️ Health
            </span>

            <b>
              {Math.floor(
                g.gameState
                  .health
              )}{" "}
              /{" "}
              {
                g.maxHealth
              }
            </b>
          </div>

          <div className="data-row">
            <span>
              ⚡ Energy
            </span>

            <b>
              {
                g.gameState
                  .energy
              }{" "}
              /{" "}
              {MAX_ENERGY}
            </b>
          </div>

          <div className="data-row">
            <span>
              🧠 Nerve
            </span>

            <b>
              {
                g.gameState
                  .nerve
              }{" "}
              /{" "}
              {
                g.maxNerve
              }
            </b>
          </div>

          <div className="data-row">
            <span>
              😊 Happiness
            </span>

            <b>
              {Math.floor(
                g.gameState
                  .happiness
              )}{" "}
              /{" "}
              {getProperty(
                g.gameState
                  .ownedProperty
              )?.maxHappiness ??
                100}
            </b>
          </div>
        </div>
      </Panel>

      <Panel title="Progress Overview">
        <div className="data-list">
          <div className="data-row">
            <span>
              Crime Experience
            </span>

            <b>
              {
                g.gameState
                  .crimeExperience
              }
            </b>
          </div>

          <div className="data-row">
            <span>
              Gym Experience
            </span>

            <b>
              {
                g.gameState
                  .gymExperience
              }
            </b>
          </div>

          <div className="data-row">
            <span>
              Crimes Completed
            </span>

            <b>
              {
                g.gameState
                  .crimesCompleted
              }{" "}
              /{" "}
              {
                g.gameState
                  .crimesFailed
              }{" "}
              failed
            </b>
          </div>

          <div className="data-row">
            <span>
              Fight Record
            </span>

            <b>
              {
                g.gameState
                  .fightsWon
              }
              W /{" "}
              {
                g.gameState
                  .fightsLost
              }
              L
            </b>
          </div>

          <div className="data-row">
            <span>
              Attacks
            </span>

            <b>
              {
                g.gameState
                  .attacks
              }
            </b>
          </div>
        </div>
      </Panel>

      <Panel title="Bank Vault">
        <div className="bank-control">
          <h2 className="bank-balance">
            {money(
              g.gameState
                .bank
            )}
          </h2>

          <div className="input-group">
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
            />

            <div className="btn-group">
              <Button
                onClick={() =>
                  g.bankDeposit(
                    n
                  )
                }
              >
                Deposit
              </Button>

              <Button
                onClick={() =>
                  g.bankWithdraw(
                    n
                  )
                }
              >
                Withdraw
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function City({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <>
      <div className="ui-grid four-col">
        {LOCATIONS.map(
          ([
            id,
            name,
            desc,
          ]) => (
            <div
              className="card location-card"
              key={id}
            >
              <span className="card-tag">
                DISTRICT
              </span>

              <h3>{name}</h3>

              <p>{desc}</p>

              <Button
                onClick={() =>
                  g.travel(id)
                }
              >
                {g.gameState
                  .currentLocation ===
                id
                  ? "Current Location"
                  : "Travel"}
              </Button>
            </div>
          )
        )}
      </div>

      <Panel title="District Actions">
        <div className="ui-grid three-col">
          <Button
            onClick={
              g.randomEncounter
            }
          >
            🎲 Explore Area
          </Button>

          <Button
            onClick={() =>
              g.setCurrentScreen(
                "crimes"
              )
            }
          >
            🕵️ Street Hustles
          </Button>

          <Button
            onClick={() =>
              g.setCurrentScreen(
                "combat"
              )
            }
          >
            ⚔️ Arena Fights
          </Button>
        </div>
      </Panel>
    </>
  );
}

export function Crimes({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <div className="ui-grid two-col">
      {CRIMES.map((c) => {
        const chance =
          crimeSuccessChance(
            c,
            g.gameState
              .crimeExperience,
            1,
            getCrimeStatBonus(
              g.gameState
                .stats
            )
          );

        const unlocked =
          crimeUnlocked(
            c,
            g.gameState
              .crimeExperience
          );

        return (
          <div
            className={`card crime-card ${
              unlocked
                ? ""
                : "disabled"
            }`}
            key={c.id}
          >
            <div className="card-header-split">
              <span className="card-tag">
                NERVE {c.nerve}
              </span>

              <span className="chance-badge">
                {unlocked
                  ? `${chance.toFixed(
                      0
                    )}% Success`
                  : `Requires CE ${c.crimeExperienceRequired}`}
              </span>
            </div>

            <h3>{c.name}</h3>

            <p>
              {
                c.description
              }
            </p>

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

            <Button
              disabled={
                !unlocked ||
                g.gameState
                  .nerve <
                  c.nerve
              }
              onClick={() =>
                g.commitCrime(
                  c
                )
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

export function Combat({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  if (g.combatOpponent) {
    return (
      <InteractiveCombatView
        player={{
          id: "player",
          name: "You",
          level: g.level,
          health:
            g.gameState
              .health,
          maxHealth:
            g.maxHealth,
          stats:
            g.gameState
              .stats,
          weapons:
            DEFAULT_WEAPONS,
        }}
        enemy={{
          id:
            g.combatOpponent
              .id,

          name:
            g.combatOpponent
              .name,

          level:
            g.combatOpponent
              .level,

          health:
            g.combatOpponent
              .health,

          maxHealth:
            g.combatOpponent
              .maxHealth,

          stats:
            g.combatOpponent
              .stats,

          weapons:
            g.combatOpponent
              .weapons ||
            DEFAULT_WEAPONS,

          cashReward:
            g.combatOpponent
              .cashReward,

          xpReward:
            g.combatOpponent
              .level * 25,
        }}
        onFinish={(
          outcome,
          enemy,
          finalPlayerHealth
        ) => {
          /*
           * If the combat component provides a real
           * attack start callback in the future, this
           * remains the point where the energy cost
           * should occur.
           *
           * For the current component contract, attack()
           * reserves the encounter and the actual fight
           * resolution occurs here.
           */

          let cashEarned = 0;

          let xpEarned =
            enemy.xpReward ||
            50;

          /*
           * IMPORTANT:
           *
           * "leave" is NOT a combat victory.
           */
          const isVictory =
            outcome === "mug";

          if (
            outcome === "mug"
          ) {
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
                xpEarned * 0.25
              );
          } else if (
            outcome === "leave"
          ) {
            /*
             * Leaving gives a small participation XP reward,
             * but does not alter the win/loss record.
             */
            xpEarned =
              Math.floor(
                xpEarned * 0.25
              );
          }

          g.setGameState(
            (prev) => {
              const next: SaveData =
                {
                  ...prev,

                  cash:
                    prev.cash +
                    cashEarned,

                  xp:
                    prev.xp +
                    xpEarned,

                  health:
                    Math.max(
                      1,
                      Math.min(
                        g.maxHealth,
                        finalPlayerHealth
                      )
                    ),

                  fightsWon:
                    isVictory
                      ? prev.fightsWon +
                        1
                      : prev.fightsWon,
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

          g.setCombatOpponent(
            null
          );

          g.setCombatStarted(
            false
          );

          g.setCurrentScreen(
            "combat"
          );
        }}
        onDefeat={() => {
          setGameStateForCombatDefeat(
            g
          );
        }}
      />
    );
  }

  return (
    <Panel title="Available Targets">
      <div className="ui-grid two-col">
        {PLAYER_PROFILES.map(
          (o) => (
            <div
              className="card target-card"
              key={o.id}
            >
              <div className="card-header-split">
                <span className="card-tag">
                  LV {o.level}
                </span>

                <span className="status-badge">
                  {o.status}
                </span>
              </div>

              <h3>{o.name}</h3>

              <p>
                {o.title} ·{" "}
                {o.location}
              </p>

              <div className="data-list">
                <div className="data-row">
                  <span>
                    Health
                  </span>

                  <b>
                    {o.health}/
                    {
                      o.maxHealth
                    }
                  </b>
                </div>

                <div className="data-row">
                  <span>
                    Reward
                  </span>

                  <b>
                    {money(
                      o.cashReward
                    )}
                  </b>
                </div>

                <div className="data-row">
                  <span>
                    Win Chance
                  </span>

                  <b>
                    {calculateWinChance(
                      g.gameState
                        .stats,
                      o.stats
                    )}
                    %
                  </b>
                </div>
              </div>

              <Button
                onClick={() =>
                  g.attack(o)
                }
                disabled={
                  Boolean(
                    g.gameState
                      .jailUntil ||
                      g.gameState
                        .hospitalUntil
                  ) ||
                  g.gameState
                    .energy < 10
                }
              >
                Attack (10 ⚡)
              </Button>
            </div>
          )
        )}
      </div>
    </Panel>
  );
}

/*
 * Separate helper keeps Combat readable while still using
 * the hook's existing state management.
 */
function setGameStateForCombatDefeat(
  g: ReturnType<
    typeof useRiftCity
  >
) {
  g.setGameState(
    (prev) => ({
      ...prev,

      health: 0,

      fightsLost:
        prev.fightsLost + 1,

      hospitalUntil:
        Date.now() +
        HOSPITAL_MINUTES *
          60000,

      activities: [
        {
          id:
            Date.now() +
            Math.random(),

          text:
            "COMBAT LOSS: Knocked out and hospitalized.",

          type: "failure" as const,

          time: Date.now(),
        },

        ...prev.activities,
      ].slice(0, 60),
    })
  );

  g.setCombatOpponent(
    null
  );

  g.setCombatStarted(
    false
  );

  g.setCurrentScreen(
    "city"
  );
}

export function GymView({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <>
      <div className="gym-selector">
        {GYMS.filter(
          (x) => !x.jailOnly
        ).map((x) => (
          <button
            key={x.id}
            className={`gym-btn ${
              g.gym.id === x.id
                ? "active"
                : ""
            }`}
            disabled={
              !gymUnlocked(
                x,
                g.gameState
                  .gymExperience
              )
            }
            onClick={() =>
              g.buyGym(x.id)
            }
          >
            <span>
              {x.name}
            </span>

            <small>
              {gymUnlocked(
                x,
                g.gameState
                  .gymExperience
              )
                ? money(
                    x.membershipCost
                  )
                : `EXP ${x.gymExpRequired}`}
            </small>
          </button>
        ))}
      </div>

      <Panel
        title={`${g.gym.name} · (${g.gym.energyCost} Energy per set)`}
      >
        <div className="ui-grid four-col">
          {TRAINING_STATS.map(
            (stat) => (
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
                    !canTrainStat(
                      g.gym,
                      stat.id
                    ) ||
                    g.gameState
                      .energy <
                      g.gym
                        .energyCost
                  }
                  onClick={() =>
                    g.train(
                      stat.id
                    )
                  }
                >
                  Train
                </Button>
              </div>
            )
          )}
        </div>
      </Panel>
    </>
  );
}

export function Jobs({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <div className="ui-grid two-col">
      {JOBS.map((job) => (
        <div
          className="card job-card"
          key={job.id}
        >
          <span className="card-tag">
            {job.company}
          </span>

          <h3>
            {job.title}
          </h3>

          <p>
            {job.description}
          </p>

          <div className="data-row">
            <span>
              Hourly Salary
            </span>

            <b>
              {money(
                job.salary
              )}
            </b>
          </div>

          <Button
            onClick={() =>
              g.joinJob(job.id)
            }
          >
            {g.gameState
              .currentJob ===
            job.id
              ? "Current Position"
              : "Apply Now"}
          </Button>
        </div>
      ))}
    </div>
  );
}

export function Items({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <div className="ui-grid three-col">
      {ITEMS.map((item) => (
        <div
          className="card item-card"
          key={item.id}
        >
          <span className="card-tag">
            {item.type.toUpperCase()}
          </span>

          <h3>
            {item.name}
          </h3>

          <p>
            {item.description}
          </p>

          <strong className="item-price">
            {money(item.price)}
          </strong>

          <div className="btn-group">
            <Button
              onClick={() =>
                g.buyItem(
                  item.id
                )
              }
            >
              Buy
            </Button>

            {(g.gameState
              .inventory[
              item.id
            ] || 0) > 0 && (
              <Button
                onClick={() =>
                  item.type ===
                    "weapon" ||
                  item.type ===
                    "armor"
                    ? g.equip(
                        item.id
                      )
                    : g.useItem(
                        item.id
                      )
                }
              >
                {item.type ===
                    "weapon" ||
                  item.type ===
                    "armor"
                  ? "Equip"
                  : "Use"}
              </Button>
            )}
          </div>

          <span className="item-count">
            Owned:{" "}
            {g.gameState
              .inventory[
              item.id
            ] || 0}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Missions({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <div className="ui-grid two-col">
      {MISSIONS.map(
        (mission) => {
          const progress =
            g.missionProgress(
              mission
            );

          const done =
            g.gameState
              .completedMissions.includes(
                mission.id
              );

          return (
            <div
              className="card mission-card"
              key={mission.id}
            >
              <span className="card-tag">
                MISSION
              </span>

              <h3>
                {mission.name}
              </h3>

              <p>
                {
                  mission.description
                }
              </p>

              <div className="bar-track">
                <div
                  className="bar-fill mission"
                  style={{
                    width: `${Math.min(
                      100,
                      (progress /
                        mission.target) *
                        100
                    )}%`,
                  }}
                />
              </div>

              <div className="data-row">
                <span>
                  Progress
                </span>

                <b>
                  {Math.min(
                    progress,
                    mission.target
                  ).toLocaleString()}{" "}
                  /{" "}
                  {mission.target.toLocaleString()}
                </b>
              </div>

              <Button
                disabled={
                  done ||
                  progress <
                    mission.target
                }
                onClick={() =>
                  g.claimMission(
                    mission.id
                  )
                }
              >
                {done
                  ? "Claimed"
                  : "Claim Reward"}
              </Button>
            </div>
          );
        }
      )}
    </div>
  );
}

export function Education({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <>
      <Panel title="Active Course Status">
        {g.education ? (
          <div className="course-active">
            <h3>
              {
                g.education
                  .name
              }
            </h3>

            <p>
              Duration:{" "}
              {
                g.education
                  .durationHours
              }{" "}
              hours
            </p>

            <Button
              onClick={
                g.finishEducation
              }
            >
              Check Completion
            </Button>
          </div>
        ) : (
          <p>
            No course currently
            active.
          </p>
        )}
      </Panel>

      <div className="ui-grid two-col">
        {EDUCATION.map(
          (course) => (
            <div
              className="card course-card"
              key={course.id}
            >
              <h3>
                {course.name}
              </h3>

              <p>
                {
                  course.description
                }
              </p>

              <div className="data-list">
                <div className="data-row">
                  <span>
                    Cost
                  </span>

                  <b>
                    {money(
                      course.cost
                    )}
                  </b>
                </div>

                <div className="data-row">
                  <span>
                    Time
                  </span>

                  <b>
                    {
                      course.durationHours
                    }
                    h
                  </b>
                </div>
              </div>

              <Button
                disabled={
                  g.gameState
                    .educationCompleted.includes(
                      course.id
                    ) ||
                  Boolean(
                    g.education
                  ) ||
                  g.gameState
                    .cash <
                    course.cost
                }
                onClick={() =>
                  g.startEducation(
                    course.id
                  )
                }
              >
                {g.gameState
                  .educationCompleted.includes(
                    course.id
                  )
                  ? "Completed"
                  : "Enroll"}
              </Button>
            </div>
          )
        )}
      </div>
    </>
  );
}

export function PropertyView({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const current =
    getProperty(
      g.gameState
        .ownedProperty
    )?.price || 0;

  return (
    <div className="ui-grid two-col">
      {PROPERTIES.map(
        (property) => (
          <div
            className={`card property-card ${
              property.price <
              current
                ? "disabled"
                : ""
            }`}
            key={property.id}
          >
            <span className="card-tag">
              REAL ESTATE
            </span>

            <h3>
              {property.name}
            </h3>

            <p>
              {
                property.description
              }
            </p>

            <div className="data-list">
              <div className="data-row">
                <span>
                  Price
                </span>

                <b>
                  {money(
                    property.price
                  )}
                </b>
              </div>

              <div className="data-row">
                <span>
                  Health Bonus
                </span>

                <b>
                  +
                  {
                    property.maxHealthBonus
                  }
                </b>
              </div>

              <div className="data-row">
                <span>
                  Nerve Bonus
                </span>

                <b>
                  +
                  {
                    property.nerveBonus
                  }
                </b>
              </div>

              <div className="data-row">
                <span>
                  Happiness
                </span>

                <b>
                  {property.maxHappiness}
                </b>
              </div>
            </div>

            <Button
              disabled={
                property.price <
                  current ||
                g.gameState
                  .cash <
                  property.price
              }
              onClick={() =>
                g.buyProperty(
                  property.id
                )
              }
            >
              {g.gameState
                .ownedProperty ===
              property.id
                ? "Current Residence"
                : "Purchase"}
            </Button>
          </div>
        )
      )}
    </div>
  );
}

export function Market({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const goods =
    Object.keys(
      g.gameState.market
    );

  return (
    <Panel title="Dynamic Commodities Market">
      <div className="ui-grid four-col">
        {goods.map((id) => (
          <div
            className="card market-card"
            key={id}
          >
            <span className="card-tag">
              COMMODITY
            </span>

            <h3>
              {id.toUpperCase()}
            </h3>

            <p>
              Unit Price:{" "}
              {money(
                g.gameState
                  .market[id]
              )}
            </p>

            <span className="item-count">
              Owned:{" "}
              {g.gameState
                .inventory[id] ||
                0}
            </span>

            <div className="btn-group">
              <Button
                onClick={() =>
                  g.tradeMarket(
                    id,
                    true
                  )
                }
              >
                Buy
              </Button>

              <Button
                onClick={() =>
                  g.tradeMarket(
                    id,
                    false
                  )
                }
                disabled={
                  !g.gameState
                    .inventory[
                    id
                  ]
                }
              >
                Sell
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function Faction({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const factions = [
    "Iron Syndicate",
    "Rift Guard",
    "Dock Union",
  ];

  return (
    <Panel title="Faction Headquarters">
      <div className="ui-grid three-col">
        {factions.map(
          (faction) => (
            <div
              className={`card faction-card ${
                g.gameState
                  .faction &&
                g.gameState
                  .faction !==
                  faction
                  ? "disabled"
                  : ""
              }`}
              key={faction}
            >
              <h3>
                {faction}
              </h3>

              <p>
                {g.gameState
                  .faction ===
                faction
                  ? `Reputation: ${g.gameState.factionReputation}`
                  : "Entry Fee: $500"}
              </p>

              <Button
                disabled={
                  Boolean(
                    g.gameState
                      .faction
                  ) &&
                  g.gameState
                    .faction !==
                    faction
                }
                onClick={() =>
                  g.joinFaction(
                    faction
                  )
                }
              >
                {g.gameState
                  .faction ===
                faction
                  ? "Member"
                  : "Join Faction"}
              </Button>
            </div>
          )
        )}
      </div>

      {g.gameState
        .faction && (
        <div
          style={{
            marginTop:
              "16px",
          }}
        >
          <Button
            onClick={
              g.workFaction
            }
          >
            Complete Faction Work
            (10 ⚡)
          </Button>
        </div>
      )}
    </Panel>
  );
}

export function Awards({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const awards: [
    string,
    boolean
  ][] = [
    [
      "First Crime",
      g.gameState
        .crimesCompleted >=
        1,
    ],

    [
      "Ten Crimes",
      g.gameState
        .crimesCompleted >=
        10,
    ],

    [
      "First Victory",
      g.gameState
        .fightsWon >= 1,
    ],

    [
      "Gym Rat",
      g.gameState
        .gymSessions >=
        10,
    ],

    [
      "Five Figures",
      g.gameState
        .cash >= 100000,
    ],

    [
      "Level 10",
      g.level >= 10,
    ],
  ];

  return (
    <>
      <Panel title="Milestones & Achievements">
        <div className="ui-grid three-col">
          {awards.map(
            ([name, done]) => (
              <div
                className={`card achievement-card ${
                  done
                    ? "unlocked"
                    : "locked"
                }`}
                key={name}
              >
                <h3>
                  {name}
                </h3>

                <span className="status-text">
                  {done
                    ? "Unlocked"
                    : "Locked"}
                </span>

                {done &&
                  !g.gameState
                    .achievements.includes(
                      name
                    ) && (
                    <Button
                      onClick={() =>
                        g.earnMerit(
                          name
                        )
                      }
                    >
                      Claim Merit
                    </Button>
                  )}
              </div>
            )
          )}
        </div>
      </Panel>

      <Panel title="Daily Rewards">
        <Button
          onClick={
            g.claimDaily
          }
        >
          Claim Daily Bonus
        </Button>
      </Panel>
    </>
  );
}

