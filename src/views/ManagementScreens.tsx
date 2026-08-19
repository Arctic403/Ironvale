import React, { useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";

import { Panel, Button } from "../components/ui";

import {
  EDUCATION,
  ITEMS,
  JOBS,
  MISSIONS,
  PROPERTIES,
  getProperty,
} from "../data/gameData";

import {
  money,
  MAX_ENERGY,
} from "../core/gameCore";

type Game = ReturnType<typeof useRiftCity>;

/* =========================================================
   CHARACTER
========================================================= */

export function Character({ g }: { g: Game }) {
  const [amount, setAmount] = useState("100");

  const n = Math.max(0, Number(amount) || 0);

  const happinessMax =
    getProperty(g.gameState.ownedProperty)?.maxHappiness ?? 100;

  return (
    <div className="ui-grid two-col">
      <Panel title="Combat Stats">
        <div className="stats-list">
          {Object.entries(g.gameState.stats).map(([key, value]) => (
            <div className="stat-row" key={key}>
              <span className="stat-name">{key}</span>

              <strong className="stat-val">
                {(value as number).toFixed(2)}
              </strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Core Resources">
        <div className="data-list">
          <div className="data-row">
            <span>❤️ Health</span>

            <b>
              {Math.floor(g.gameState.health)} / {g.maxHealth}
            </b>
          </div>

          <div className="data-row">
            <span>⚡ Energy</span>

            <b>
              {g.gameState.energy} / {MAX_ENERGY}
            </b>
          </div>

          <div className="data-row">
            <span>🧠 Nerve</span>

            <b>
              {g.gameState.nerve} / {g.maxNerve}
            </b>
          </div>

          <div className="data-row">
            <span>😊 Happiness</span>

            <b>
              {Math.floor(g.gameState.happiness)} / {happinessMax}
            </b>
          </div>
        </div>
      </Panel>

      <Panel title="Progress Overview">
        <div className="data-list">
          <div className="data-row">
            <span>Crime Experience</span>
            <b>{g.gameState.crimeExperience}</b>
          </div>

          <div className="data-row">
            <span>Gym Experience</span>
            <b>{g.gameState.gymExperience}</b>
          </div>

          <div className="data-row">
            <span>Crimes Completed</span>

            <b>
              {g.gameState.crimesCompleted} /{" "}
              {g.gameState.crimesFailed} failed
            </b>
          </div>

          <div className="data-row">
            <span>Fight Record</span>

            <b>
              {g.gameState.fightsWon}W / {g.gameState.fightsLost}L
            </b>
          </div>

          <div className="data-row">
            <span>Attacks</span>

            <b>{g.gameState.attacks}</b>
          </div>
        </div>
      </Panel>

      <Panel title="Bank Vault">
        <div className="bank-control">
          <h2 className="bank-balance">
            {money(g.gameState.bank)}
          </h2>

          <div className="input-group">
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
            />

            <div className="btn-group">
              <Button
                disabled={n <= 0}
                onClick={() => g.bankDeposit(n)}
              >
                Deposit
              </Button>

              <Button
                disabled={n <= 0}
                onClick={() => g.bankWithdraw(n)}
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

/* =========================================================
   JOBS
========================================================= */

export function Jobs({ g }: { g: Game }) {
  return (
    <div className="ui-grid two-col">
      {JOBS.map((job) => {
        const current =
          g.gameState.currentJob === job.id;

        return (
          <div
            className="card job-card"
            key={job.id}
          >
            <span className="card-tag">
              {job.company}
            </span>

            <h3>{job.title}</h3>

            <p>{job.description}</p>

            {(() => {
              const position = current && g.jobPosition ? g.jobPosition : job.positions[0];
              return (
                <>
                  <div className="data-row"><span>Current Pay</span><b>{money(position.salary)}/hr</b></div>
                  <div className="data-row"><span>Position</span><b>{position.title}</b></div>
                  <div className="job-skills">
                    {job.skills.map((skill) => {
                      const value = g.gameState.jobSkills[`${job.id}:${skill.id}`] ?? 0;
                      return <div className="data-row" key={skill.id}><span>{skill.name}</span><b>{value}/10</b></div>;
                    })}
                  </div>
                  <Button disabled={current} onClick={() => g.joinJob(job.id)}>{current ? "Current Position" : "Apply Now"}</Button>
                </>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   INVENTORY
========================================================= */

export function Inventory({ g }: { g: Game }) {
  const ownedItems = ITEMS.filter(
    (item) => (g.gameState.inventory[item.id] || 0) > 0
  );

  if (ownedItems.length === 0) {
    return (
      <Panel title="Inventory">
        <div className="empty-state">
          <span className="card-tag">EMPTY</span>
          <h3>Your inventory is empty.</h3>
          <p>Items you purchase from the shops will appear here.</p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="ui-grid three-col">
      {ownedItems.map((item) => {
        const owned = g.gameState.inventory[item.id] || 0;
        const equippable =
          item.type === "weapon" || item.type === "armor";
        const equipped =
          item.type === "weapon"
            ? g.gameState.equippedWeapon === item.id
            : item.type === "armor"
              ? g.gameState.equippedArmor === item.id
              : false;

        return (
          <div className="card item-card" key={item.id}>
            <span className="card-tag">
              {item.type.toUpperCase()}
            </span>

            <h3>{item.name}</h3>
            <p>{item.description}</p>

            <div className="data-list">
              <div className="data-row">
                <span>Owned</span>
                <b>{owned}</b>
              </div>

              {equippable && (
                <div className="data-row">
                  <span>Status</span>
                  <b>{equipped ? "Equipped" : "Not Equipped"}</b>
                </div>
              )}
            </div>

            <div className="btn-group">
              {equippable ? (
                <Button
                  disabled={equipped}
                  onClick={() => g.equip(item.id)}
                >
                  {equipped ? "Equipped" : "Equip"}
                </Button>
              ) : (
                <Button onClick={() => g.useItem(item.id)}>
                  Use
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   SHOPS
========================================================= */

export function Shops({ g }: { g: Game }) {
  const shopGroups = [
    {
      title: "Weapon Shop",
      tag: "WEAPONS",
      description: "Melee weapons and firearms for combat.",
      types: ["weapon"],
    },
    {
      title: "Equipment Shop",
      tag: "ARMOR",
      description: "Protective equipment for dangerous work.",
      types: ["armor"],
    },
    {
      title: "RiftCare Pharmacy",
      tag: "MEDICAL",
      description: "Medical, energy, and nerve supplies.",
      types: ["medical", "energy", "nerve"],
    },
  ] as const;

  return (
    <div className="shop-list">
      {shopGroups.map((shop) => {
        const items = ITEMS.filter((item) =>
          shop.types.some((type) => type === item.type)
        );

        return (
          <section className="shop-section" key={shop.title}>
            <Panel title={shop.title}>
              <p>{shop.description}</p>

              <div className="ui-grid three-col">
                {items.map((item) => {
                  const owned = g.gameState.inventory[item.id] || 0;
                  const affordable = g.gameState.cash >= item.price;

                  return (
                    <div className="card item-card" key={item.id}>
                      <span className="card-tag">{shop.tag}</span>

                      <h3>{item.name}</h3>
                      <p>{item.description}</p>

                      <div className="data-list">
                        <div className="data-row">
                          <span>Price</span>
                          <b>{money(item.price)}</b>
                        </div>

                        <div className="data-row">
                          <span>Owned</span>
                          <b>{owned}</b>
                        </div>
                      </div>

                      <Button
                        disabled={!affordable}
                        onClick={() => g.buyItem(item.id)}
                      >
                        {affordable ? "Buy" : "Not Enough Cash"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </section>
        );
      })}
    </div>
  );
}


/* =========================================================
   MISSIONS
========================================================= */

export function Missions({ g }: { g: Game }) {
  return (
    <div className="ui-grid two-col">
      {MISSIONS.map((mission) => {
        const progress =
          g.missionProgress(mission);

        const completed =
          g.gameState.completedMissions.includes(
            mission.id
          );

        const percent =
          mission.target > 0
            ? Math.min(
                100,
                (progress / mission.target) * 100
              )
            : 100;

        const canClaim =
          !completed &&
          progress >= mission.target;

        return (
          <div
            className="card mission-card"
            key={mission.id}
          >
            <span className="card-tag">
              MISSION
            </span>

            <h3>{mission.name}</h3>

            <p>{mission.description}</p>

            <div className="bar-track">
              <div
                className="bar-fill mission"
                style={{
                  width: `${percent}%`,
                }}
              />
            </div>

            <div className="data-row">
              <span>Progress</span>

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
              disabled={!canClaim}
              onClick={() =>
                g.claimMission(mission.id)
              }
            >
              {completed
                ? "Claimed"
                : canClaim
                ? "Claim Reward"
                : "In Progress"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   EDUCATION
========================================================= */

export function Education({ g }: { g: Game }) {
  return (
    <>
      <Panel title="Active Course Status">
        {g.education ? (
          <div className="course-active">
            <h3>{g.education.name}</h3>

            <p>
              Duration:{" "}
              {g.education.durationHours} hours
            </p>

            <Button onClick={g.finishEducation}>
              Check Completion
            </Button>
          </div>
        ) : (
          <p>No course currently active.</p>
        )}
      </Panel>

      <div className="ui-grid two-col">
        {EDUCATION.map((course) => {
          const completed =
            g.gameState.educationCompleted.includes(
              course.id
            );

          const active =
            Boolean(g.education);

          const affordable =
            g.gameState.cash >= course.cost;

          return (
            <div
              className="card course-card"
              key={course.id}
            >
              <h3>{course.name}</h3>

              <p>{course.description}</p>

              <div className="data-list">
                <div className="data-row">
                  <span>Cost</span>

                  <b>{money(course.cost)}</b>
                </div>

                <div className="data-row">
                  <span>Time</span>

                  <b>
                    {course.durationHours}h
                  </b>
                </div>
              </div>

              <Button
                disabled={
                  completed ||
                  active ||
                  !affordable
                }
                onClick={() =>
                  g.startEducation(course.id)
                }
              >
                {completed
                  ? "Completed"
                  : active
                  ? "Course Active"
                  : !affordable
                  ? "Not Enough Cash"
                  : "Enroll"}
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* =========================================================
   PROPERTY
========================================================= */

export function PropertyView({
  g,
}: {
  g: Game;
}) {
  const currentProperty =
    getProperty(
      g.gameState.ownedProperty
    );

  const currentPrice =
    currentProperty?.price || 0;

  return (
    <div className="ui-grid two-col">
      {PROPERTIES.map((property) => {
        const current =
          g.gameState.ownedProperty ===
          property.id;

        const cheaper =
          property.price < currentPrice;

        const affordable =
          g.gameState.cash >= property.price;

        const unavailable =
          cheaper ||
          current ||
          !affordable;

        return (
          <div
            className={`card property-card ${
              cheaper ? "disabled" : ""
            }`}
            key={property.id}
          >
            <span className="card-tag">
              REAL ESTATE
            </span>

            <h3>{property.name}</h3>

            <p>{property.description}</p>

            <div className="data-list">
              <div className="data-row">
                <span>Price</span>

                <b>
                  {money(property.price)}
                </b>
              </div>

              <div className="data-row">
                <span>Health Bonus</span>

                <b>
                  +{property.maxHealthBonus}
                </b>
              </div>

              <div className="data-row">
                <span>Nerve Bonus</span>

                <b>
                  +{property.nerveBonus}
                </b>
              </div>

              <div className="data-row">
                <span>Happiness</span>

                <b>
                  {property.maxHappiness}
                </b>
              </div>
            </div>

            <Button
              disabled={unavailable}
              onClick={() =>
                g.buyProperty(property.id)
              }
            >
              {current
                ? "Current Residence"
                : cheaper
                ? "Already Owned"
                : !affordable
                ? "Not Enough Cash"
                : "Purchase"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   MARKET
========================================================= */

export function Market({ g }: { g: Game }) {
  const goods = Object.keys(
    g.gameState.market
  );

  return (
    <Panel title="Dynamic Commodities Market">
      <div className="ui-grid four-col">
        {goods.map((id) => {
          const price =
            g.gameState.market[id];

          const owned =
            g.gameState.inventory[id] || 0;

          return (
            <div
              className="card market-card"
              key={id}
            >
              <span className="card-tag">
                COMMODITY
              </span>

              <h3>{id.toUpperCase()}</h3>

              <p>
                Unit Price: {money(price)}
              </p>

              <span className="item-count">
                Owned: {owned}
              </span>

              <div className="btn-group">
                <Button
                  disabled={
                    g.gameState.cash < price
                  }
                  onClick={() =>
                    g.tradeMarket(id, true)
                  }
                >
                  Buy
                </Button>

                <Button
                  disabled={owned <= 0}
                  onClick={() =>
                    g.tradeMarket(id, false)
                  }
                >
                  Sell
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* =========================================================
   FACTIONS
========================================================= */

export function Faction({ g }: { g: Game }) {
  const factions = [
    "Iron Syndicate",
    "Rift Guard",
    "Dock Union",
  ];

  const currentFaction =
    g.gameState.faction;

  return (
    <Panel title="Faction Headquarters">
      <div className="ui-grid three-col">
        {factions.map((faction) => {
          const member =
            currentFaction === faction;

          const otherFaction =
            Boolean(currentFaction) &&
            currentFaction !== faction;

          return (
            <div
              className={`card faction-card ${
                otherFaction
                  ? "disabled"
                  : ""
              }`}
              key={faction}
            >
              <h3>{faction}</h3>

              <p>
                {member
                  ? `Reputation: ${g.gameState.factionReputation}`
                  : "Entry Fee: $500"}
              </p>

              <Button
                disabled={
                  otherFaction ||
                  member
                }
                onClick={() =>
                  g.joinFaction(faction)
                }
              >
                {member
                  ? "Member"
                  : "Join Faction"}
              </Button>
            </div>
          );
        })}
      </div>

      {currentFaction && (
        <div style={{ marginTop: "16px" }}>
          <Button
            disabled={
              g.gameState.energy < 10
            }
            onClick={g.workFaction}
          >
            Complete Faction Work (10 ⚡)
          </Button>
        </div>
      )}
    </Panel>
  );
}

/* =========================================================
   AWARDS
========================================================= */

export function Awards({ g }: { g: Game }) {
  const awards: [string, boolean][] = [
    [
      "First Crime",
      g.gameState.crimesCompleted >= 1,
    ],
    [
      "Ten Crimes",
      g.gameState.crimesCompleted >= 10,
    ],
    [
      "First Victory",
      g.gameState.fightsWon >= 1,
    ],
    [
      "Gym Rat",
      g.gameState.gymSessions >= 10,
    ],
    [
      "Five Figures",
      g.gameState.cash >= 100000,
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
          {awards.map(([name, unlocked]) => {
            const claimed =
              g.gameState.achievements.includes(
                name
              );

            return (
              <div
                className={`card achievement-card ${
                  unlocked
                    ? "unlocked"
                    : "locked"
                }`}
                key={name}
              >
                <h3>{name}</h3>

                <span className="status-text">
                  {claimed
                    ? "Claimed"
                    : unlocked
                    ? "Unlocked"
                    : "Locked"}
                </span>

                {unlocked && !claimed && (
                  <Button
                    onClick={() =>
                      g.earnMerit(name)
                    }
                  >
                    Claim Merit
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Daily Rewards">
        <Button onClick={g.claimDaily}>
          Claim Daily Bonus
        </Button>
      </Panel>
    </>
  );
}
