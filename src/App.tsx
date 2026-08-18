import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  MAX_ENERGY,
  NERVE_REGEN_INTERVAL,
  regenerateResources,
  getEnergyTimeRemaining,
  getNerveTimeRemaining,
} from "./systems/resourceSystem";

import {
  CRIMES,
  Crime,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
  randomReward,
  rollCrimeOutcome,
} from "./systems/crimeSystem";

import {
  OPPONENTS,
  Opponent,
  resolveCombat,
} from "./systems/combatSystem";

import {
  GYMS,
  Gym,
} from "./systems/gymSystem";

import {
  CombatStats,
  getLevel,
  getMaxHealth,
  getNaturalNerveMax,
} from "./systems/progressionSystem";

import {
  EDUCATION,
  ITEMS,
  JOBS,
  MISSIONS,
  PROPERTIES,
  EducationCourse,
  Item,
  Job,
  Mission,
  Property,
  getProperty,
} from "./data/gameData";

type Screen =
  | "city"
  | "crimes"
  | "combat"
  | "gym"
  | "jobs"
  | "items"
  | "missions"
  | "education"
  | "property"
  | "character";

type ActivityType =
  | "success"
  | "failure"
  | "spooked"
  | "jailed"
  | "combat"
  | "gym"
  | "job"
  | "system";

type Activity = {
  id: number;
  text: string;
  type: ActivityType;
  time: number;
};

type SaveData = {
  cash: number;
  xp: number;

  energy: number;
  lastEnergyUpdate: number;

  nerve: number;
  lastNerveUpdate: number;

  health: number;

  crimeExperience: number;

  stats: CombatStats;

  currentJob: string | null;
  jobStartedAt: number;
  lastJobPayment: number;

  jailUntil: number | null;

  inventory: Record<string, number>;

  equippedWeapon: string | null;
  equippedArmor: string | null;

  ownedProperty: string | null;

  educationCompleted: string[];
  educationActive: string | null;
  educationStartedAt: number | null;

  completedMissions: string[];

  crimesCompleted: number;
  crimesFailed: number;
  crimesSpooked: number;
  timesJailed: number;

  fightsWon: number;
  fightsLost: number;

  gymSessions: number;

  activities: Activity[];
};

const SAVE_KEY =
  "riftcity-core-v2";

const JOB_PAY_INTERVAL =
  60 * 60 * 1000;

const JAIL_BASE_MINUTES = 2;

function freshSave(): SaveData {
  const now =
    Date.now();

  return {
    cash: 1000,

    xp: 0,

    energy: 100,

    lastEnergyUpdate: now,

    nerve: 10,

    lastNerveUpdate: now,

    health: 100,

    crimeExperience: 0,

    stats: {
      strength: 1,
      defense: 1,
      speed: 1,
      dexterity: 1,
    },

    currentJob: null,

    jobStartedAt: now,

    lastJobPayment: now,

    jailUntil: null,

    inventory: {},

    equippedWeapon: null,

    equippedArmor: null,

    ownedProperty: "shack",

    educationCompleted: [],

    educationActive: null,

    educationStartedAt: null,

    completedMissions: [],

    crimesCompleted: 0,

    crimesFailed: 0,

    crimesSpooked: 0,

    timesJailed: 0,

    fightsWon: 0,

    fightsLost: 0,

    gymSessions: 0,

    activities: [
      {
        id: 1,
        text:
          "Welcome to RiftCity.",
        type: "system",
        time: now,
      },
    ],
  };
}

function loadSave(): SaveData {
  try {
    const current =
      localStorage.getItem(
        SAVE_KEY
      );

    if (current) {
      const parsed =
        JSON.parse(current);

      const fresh =
        freshSave();

      return {
        ...fresh,
        ...parsed,

        /*
         * Resource timer migration.
         *
         * Older saves only had
         * lastNerveUpdate.
         */
        lastEnergyUpdate:
          typeof parsed.lastEnergyUpdate ===
          "number"
            ? parsed.lastEnergyUpdate
            : typeof parsed.lastNerveUpdate ===
              "number"
            ? parsed.lastNerveUpdate
            : fresh.lastEnergyUpdate,

        lastNerveUpdate:
          typeof parsed.lastNerveUpdate ===
          "number"
            ? parsed.lastNerveUpdate
            : fresh.lastNerveUpdate,
      };
    }

    /*
     * Migration from the old
     * RiftCity save.
     */
    const old =
      localStorage.getItem(
        "riftcity-unified-v1"
      );

    if (old) {
      const oldSave =
        JSON.parse(old);

      const migrated =
        freshSave();

      return {
        ...migrated,

        cash:
          typeof oldSave.cash ===
          "number"
            ? oldSave.cash
            : 1000,

        xp:
          typeof oldSave.xp ===
          "number"
            ? oldSave.xp
            : 0,

        energy:
          typeof oldSave.energy ===
          "number"
            ? oldSave.energy
            : 100,

        lastEnergyUpdate:
          Date.now(),

        lastNerveUpdate:
          Date.now(),

        currentJob:
          oldSave.currentJob ||
          null,

        stats: {
          strength:
            1 +
            (oldSave.skills?.strength ||
              0) /
              10,

          defense:
            1 +
            (oldSave.skills?.defense ||
              0) /
              10,

          speed:
            1 +
            (oldSave.skills?.speed ||
              0) /
              10,

          dexterity:
            1 +
            (oldSave.skills?.dexterity ||
              0) /
              10,
        },
      };
    }

    return freshSave();
  } catch {
    return freshSave();
  }
}

function money(
  value: number
) {
  return `$${Math.floor(
    value
  ).toLocaleString()}`;
}

function duration(
  ms: number
) {
  const seconds =
    Math.max(
      0,
      Math.ceil(ms / 1000)
    );

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remaining =
    seconds % 60;

  if (minutes > 60) {
    const hours =
      Math.floor(
        minutes / 60
      );

    return `${hours}h ${
      minutes % 60
    }m`;
  }

  return `${minutes}m ${remaining}s`;
}

function addActivity(
  data: SaveData,
  text: string,
  type: ActivityType
): SaveData {
  return {
    ...data,

    activities: [
      {
        id:
          Date.now() +
          Math.random(),

        text,

        type,

        time: Date.now(),
      },

      ...data.activities,
    ].slice(0, 50),
  };
}

function App() {
  const [
    entered,
    setEntered,
  ] = useState(false);

  const [
    screen,
    setScreen,
  ] = useState<Screen>(
    "city"
  );

  const [
    save,
    setSave,
  ] = useState<SaveData>(
    loadSave
  );

  const [
    now,
    setNow,
  ] = useState(
    Date.now()
  );

  const [
    message,
    setMessage,
  ] = useState(
    "Welcome to RiftCity."
  );

  const levelInfo =
    useMemo(
      () => getLevel(save.xp),
      [save.xp]
    );

  const property =
    getProperty(
      save.ownedProperty
    );

  const propertyHealth =
    property?.maxHealthBonus ||
    0;

  const propertyGym =
    property?.gymBonus || 0;

  const propertyNerve =
    property?.nerveBonus || 0;

  const maxHealth =
    getMaxHealth(
      propertyHealth
    );

  const naturalNerve =
    getNaturalNerveMax(
      save.crimeExperience
    );

  const maxNerve =
    naturalNerve +
    propertyNerve;

  const jailed =
    save.jailUntil !== null &&
    save.jailUntil > now;

  const currentJob =
    JOBS.find(
      (job) =>
        job.id ===
        save.currentJob
    ) || null;

  const activeEducation =
    EDUCATION.find(
      (course) =>
        course.id ===
        save.educationActive
    ) || null;

  /*
   * Clock.
   */
  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  /*
   * Passive regeneration,
   * jobs, jail and education.
   */
  useEffect(() => {
    setSave(
      (current) => {
        let updated = {
          ...current,
        };

        /*
         * ENERGY + NERVE
         *
         * These now use completely
         * independent regeneration
         * timers.
         */
        const resources =
          regenerateResources(
            {
              energy:
                current.energy,

              nerve:
                current.nerve,

              lastEnergyUpdate:
                current.lastEnergyUpdate,

              lastNerveUpdate:
                current.lastNerveUpdate,
            },
            now,
            maxNerve
          );

        updated.energy =
          resources.energy;

        updated.lastEnergyUpdate =
          resources.lastEnergyUpdate;

        updated.nerve =
          resources.nerve;

        updated.lastNerveUpdate =
          resources.lastNerveUpdate;

        /*
         * JOB PAY
         */
        if (
          current.currentJob
        ) {
          const job =
            JOBS.find(
              (item) =>
                item.id ===
                current.currentJob
            );

          if (job) {
            const payments =
              Math.floor(
                (now -
                  current.lastJobPayment) /
                  JOB_PAY_INTERVAL
              );

            if (
              payments > 0
            ) {
              updated.cash +=
                payments *
                job.salary;

              updated.xp +=
                payments * 5;

              updated.lastJobPayment =
                current.lastJobPayment +
                payments *
                  JOB_PAY_INTERVAL;
            }
          }
        }

        /*
         * JAIL RELEASE
         */
        if (
          updated.jailUntil &&
          updated.jailUntil <=
            now
        ) {
          updated.jailUntil =
            null;

          updated =
            addActivity(
              updated,
              "You were released from jail.",
              "system"
            );
        }

        /*
         * EDUCATION
         */
        if (
          current.educationActive &&
          current.educationStartedAt
        ) {
          const course =
            EDUCATION.find(
              (item) =>
                item.id ===
                current.educationActive
            );

          if (course) {
            const finish =
              current.educationStartedAt +
              course.durationHours *
                60 *
                60 *
                1000;

            if (
              now >= finish
            ) {
              updated.educationCompleted =
                Array.from(
                  new Set([
                    ...current.educationCompleted,
                    course.id,
                  ])
                );

              updated.educationActive =
                null;

              updated.educationStartedAt =
                null;

              updated =
                addActivity(
                  updated,
                  `Education complete: ${course.name}.`,
                  "system"
                );
            }
          }
        }

        return updated;
      }
    );
  }, [
    now,
    maxNerve,
  ]);

  /*
   * Save.
   */
  useEffect(() => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(save)
    );
  }, [save]);

  function update(
    updater: (
      current: SaveData
    ) => SaveData
  ) {
    setSave(
      (current) =>
        updater(current)
    );
  }

  function runCrime(
    crime: Crime
  ) {
    if (
      jailed
    ) {
      setMessage(
        "You're in jail."
      );

      return;
    }

    if (
      !crimeUnlocked(
        crime,
        levelInfo.level
      )
    ) {
      return;
    }

    if (
      save.nerve <
      crime.nerve
    ) {
      setMessage(
        "You don't have enough Nerve."
      );

      return;
    }

    const successChance =
      crimeSuccessChance(
        crime,
        save.crimeExperience,
        save.stats
          .intelligence,
        getCrimeStatBonus(
          save.stats
        )
      );

    const outcome =
      rollCrimeOutcome(
        crime,
        successChance
      );

    update(
      (current) => {
        let result: SaveData = {
          ...current,

          nerve:
            current.nerve -
            crime.nerve,
        };

        if (
          outcome ===
          "success"
        ) {
          const reward =
            randomReward(
              crime
            );

          result.cash +=
            reward;

          result.xp +=
            crime.xp;

          result.crimeExperience +=
            crime.crimeExperience;

          result.crimesCompleted++;

          result =
            addActivity(
              result,
              `${crime.name} succeeded. +${money(
                reward
              )} / +${crime.xp} XP`,
              "success"
            );

          setMessage(
            `SUCCESS — ${money(
              reward
            )} earned.`
          );
        }

        if (
          outcome ===
          "failed"
        ) {
          result.xp +=
            Math.floor(
              crime.xp / 4
            );

          result.crimesFailed++;

          result =
            addActivity(
              result,
              `${crime.name} failed. You got nothing.`,
              "failure"
            );

          setMessage(
            "FAILED — You got away, but empty-handed."
          );
        }

        if (
          outcome ===
          "spooked"
        ) {
          result.crimesSpooked++;

          result =
            addActivity(
              result,
              `You were spooked during ${crime.name} and escaped.`,
              "spooked"
            );

          setMessage(
            "SPOOKED — Someone noticed you. You got out."
          );
        }

        if (
          outcome ===
          "jailed"
        ) {
          const jailMinutes =
            JAIL_BASE_MINUTES +
            Math.ceil(
              crime.risk /
                15
            );

          result.jailUntil =
            Date.now() +
            jailMinutes *
              60 *
              1000;

          result.timesJailed++;

          result.crimeExperience =
            Math.max(
              0,
              result.crimeExperience -
                Math.ceil(
                  crime.crimeExperience *
                    0.2
                )
            );

          result =
            addActivity(
              result,
              `BUSTED — You were jailed for ${jailMinutes} minutes.`,
              "jailed"
            );

          setMessage(
            `BUSTED — Jail time: ${jailMinutes} minutes.`
          );
        }

        return result;
      }
    );
  }

  function train(
    gym: Gym
  ) {
    if (
      jailed
    ) {
      setMessage(
        "You can't train here while jailed."
      );

      return;
    }

    if (
      levelInfo.level <
      gym.levelRequired
    ) {
      return;
    }

    if (
      save.energy <
      gym.energyCost
    ) {
      setMessage(
        "You don't have enough Energy."
      );

      return;
    }

    update(
      (current) => {
        const gain =
          1 +
          propertyGym /
            100;

        return addActivity(
          {
            ...current,

            energy:
              current.energy -
              gym.energyCost,

            gymSessions:
              current.gymSessions +
              1,

            stats: {
              strength:
                current.stats
                  .strength +
                (gym.gains
                  .strength ||
                  0) *
                  gain,

              defense:
                current.stats
                  .defense +
                (gym.gains
                  .defense ||
                  0) *
                  gain,

              speed:
                current.stats
                  .speed +
                (gym.gains
                  .speed ||
                  0) *
                  gain,

              dexterity:
                current.stats
                  .dexterity +
                (gym.gains
                  .dexterity ||
                  0) *
                  gain,
            },

            xp:
              current.xp +
              5,
          },

          `${gym.name} training complete. +5 XP.`,
          "gym"
        );
      }
    );
  }

  function fight(
    opponent: Opponent
  ) {
    if (
      jailed
    ) {
      setMessage(
        "You can't fight while jailed."
      );

      return;
    }

    const result =
      resolveCombat(
        save.stats,
        opponent.stats
      );

    if (
      result ===
      "victory"
    ) {
      update(
        (current) =>
          addActivity(
            {
              ...current,

              cash:
                current.cash +
                opponent.rewardCash,

              xp:
                current.xp +
                opponent.rewardXp,

              health:
                Math.max(
                  1,
                  current.health -
                    Math.floor(
                      opponent.health /
                        12
                    )
                ),

              fightsWon:
                current.fightsWon +
                1,
            },

            `You defeated ${opponent.name}. +${money(
              opponent.rewardCash
            )}.`,
            "combat"
          )
      );

      setMessage(
        `VICTORY — ${opponent.name} defeated.`
      );
    } else {
      update(
        (current) =>
          addActivity(
            {
              ...current,

              health: 1,

              fightsLost:
                current.fightsLost +
                1,

              xp:
                current.xp +
                Math.floor(
                  opponent.rewardXp /
                    3
                ),
            },

            `You lost to ${opponent.name} and were rushed to the hospital.`,
            "combat"
          )
      );

      setMessage(
        "DEFEAT — You were hospitalized."
      );
    }
  }

  function buyItem(
    item: Item
  ) {
    if (
      save.cash <
      item.price
    ) {
      setMessage(
        "You don't have enough cash."
      );

      return;
    }

    update(
      (current) => ({
        ...current,

        cash:
          current.cash -
          item.price,

        inventory: {
          ...current.inventory,

          [item.id]:
            (current
              .inventory[
              item.id
            ] || 0) + 1,
        },
      })
    );

    setMessage(
      `${item.name} purchased.`
    );
  }

  function useItem(
    item: Item
  ) {
    const count =
      save.inventory[
        item.id
      ] || 0;

    if (
      count <= 0
    ) {
      return;
    }

    update(
      (current) => {
        let result = {
          ...current,

          inventory: {
            ...current.inventory,

            [item.id]:
              Math.max(
                0,
                count - 1
              ),
          },
        };

        if (
          item.type ===
          "medical"
        ) {
          result.health =
            Math.min(
              maxHealth,
              result.health +
                (item.effect ||
                  0)
            );
        }

        if (
          item.type ===
          "energy"
        ) {
          result.energy =
            Math.min(
              MAX_ENERGY,
              result.energy +
                (item.effect ||
                  0)
            );
        }

        if (
          item.type ===
          "nerve"
        ) {
          result.nerve =
            Math.min(
              maxNerve,
              result.nerve +
                (item.effect ||
                  0)
            );
        }

        return result;
      }
    );

    setMessage(
      `${item.name} used.`
    );
  }

  function equipItem(
    item: Item
  ) {
    if (
      !save.inventory[
        item.id
      ]
    ) {
      return;
    }

    update(
      (current) => ({
        ...current,

        equippedWeapon:
          item.type ===
          "weapon"
            ? item.id
            : current.equippedWeapon,

        equippedArmor:
          item.type ===
          "armor"
            ? item.id
            : current.equippedArmor,
      })
    );

    setMessage(
      `${item.name} equipped.`
    );
  }

  function takeJob(
    job: Job
  ) {
    if (
      levelInfo.level <
      job.levelRequired
    ) {
      return;
    }

    update(
      (current) => ({
        ...current,

        currentJob:
          job.id,

        jobStartedAt:
          Date.now(),

        lastJobPayment:
          Date.now(),
      })
    );

    setMessage(
      `You are now working as a ${job.title}.`
    );
  }

  function quitJob() {
    update(
      (current) => ({
        ...current,

        currentJob: null,
      })
    );

    setMessage(
      "You quit your job."
    );
  }

  function startEducation(
    course: EducationCourse
  ) {
    if (
      save.educationActive
    ) {
      return;
    }

    if (
      save.educationCompleted.includes(
        course.id
      )
    ) {
      return;
    }

    if (
      levelInfo.level <
      course.levelRequired
    ) {
      return;
    }

    if (
      save.cash <
      course.cost
    ) {
      setMessage(
        "You can't afford this course."
      );

      return;
    }

    update(
      (current) => ({
        ...current,

        cash:
          current.cash -
          course.cost,

        educationActive:
          course.id,

        educationStartedAt:
          Date.now(),
      })
    );

    setMessage(
      `You enrolled in ${course.name}.`
    );
  }

  function buyProperty(
    propertyToBuy: Property
  ) {
    if (
      save.cash <
      propertyToBuy.price
    ) {
      setMessage(
        "You can't afford this property."
      );

      return;
    }

    update(
      (current) => ({
        ...current,

        cash:
          current.cash -
          propertyToBuy.price,

        ownedProperty:
          propertyToBuy.id,
      })
    );

    setMessage(
      `You moved into ${propertyToBuy.name}.`
    );
  }

  function claimMission(
    mission: Mission
  ) {
    if (
      save.completedMissions.includes(
        mission.id
      )
    ) {
      return;
    }

    let progress = 0;

    if (
      mission.requirement ===
      "crime"
    ) {
      progress =
        save.crimesCompleted;
    }

    if (
      mission.requirement ===
      "combat"
    ) {
      progress =
        save.fightsWon;
    }

    if (
      mission.requirement ===
      "gym"
    ) {
      progress =
        save.gymSessions;
    }

    if (
      mission.requirement ===
      "cash"
    ) {
      progress =
        save.cash;
    }

    if (
      progress <
      mission.target
    ) {
      return;
    }

    update(
      (current) => ({
        ...current,

        cash:
          current.cash +
          mission.rewardCash,

        xp:
          current.xp +
          mission.rewardXp,

        completedMissions: [
          ...current.completedMissions,
          mission.id,
        ],
      })
    );

    setMessage(
      `Mission complete — +${money(
        mission.rewardCash
      )}.`
    );
  }

  function resetGame() {
    if (
      !window.confirm(
        "Reset RiftCity? This cannot be undone."
      )
    ) {
      return;
    }

    const fresh =
      freshSave();

    localStorage.removeItem(
      SAVE_KEY
    );

    setSave(fresh);

    setScreen(
      "city"
    );

    setMessage(
      "RiftCity reset."
    );
  }

  if (!entered) {
    return (
      <main className="app landing">
        <header className="topbar">
          <div className="logo">
            <span className="logo-mark">
              R
            </span>

            <span>
              RIFT
              <span>
                CITY
              </span>
            </span>
          </div>

          <div className="status">
            <span className="status-dot" />
            V2 FOUNDATION
          </div>
        </header>

        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">
              WELCOME TO THE RIFT
            </p>

            <h1>
              YOUR CITY.
              <br />
              <span>
                YOUR RULES.
              </span>
            </h1>

            <p className="intro">
              Work. Train. Commit crimes.
              Fight. Build your character.
              Climb RiftCity one decision
              at a time.
            </p>

            <button
              className="play-button"
              onClick={() =>
                setEntered(
                  true
                )
              }
            >
              ENTER RIFTCITY
              <span>
                →
              </span>
            </button>
          </div>

          <div className="city-card">
            <div className="city-glow" />

            <div className="city-info">
              <span>
                CITY STATUS
              </span>

              <strong>
                WAITING FOR YOU
              </strong>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const nervePercent =
    Math.round(
      (save.nerve /
        maxNerve) *
        100
    );

  const healthPercent =
    Math.round(
      (save.health /
        maxHealth) *
        100
    );

  const energyPercent =
    Math.round(
      (save.energy /
        MAX_ENERGY) *
        100
    );

  const energyTimeRemaining =
    getEnergyTimeRemaining(
      save.energy,
      now,
      save.lastEnergyUpdate
    );

  const nerveTimeRemaining =
    getNerveTimeRemaining(
      save.nerve,
      maxNerve,
      now,
      save.lastNerveUpdate
    );

  const nextNerveAt =
    save.nerve <
    maxNerve
      ? save.lastNerveUpdate +
        NERVE_REGEN_INTERVAL
      : null;

  return (
    <main className="app game-shell">
      <header className="game-header">
        <div className="logo">
          <span className="logo-mark">
            R
          </span>

          <span>
            RIFT
            <span>
              CITY
            </span>
          </span>
        </div>

        <div className="wallet">
          <span>
            CASH
          </span>

          <strong>
            {money(
              save.cash
            )}
          </strong>
        </div>

        <button
          className="small-button"
          onClick={() =>
            setScreen(
              "character"
            )
          }
        >
          LVL{" "}
          {
            levelInfo.level
          }
        </button>
      </header>

      <section className="player-bar">
        <div>
          <span>
            PLAYER
          </span>

          <strong>
            Street Rat
          </strong>
        </div>

        <div>
          <span>
            LEVEL
          </span>

          <strong>
            {
              levelInfo.level
            }
          </strong>
        </div>

        <div>
          <span>
            ENERGY
          </span>

          <strong>
            {Math.floor(
              save.energy
            )}
            /
            {MAX_ENERGY}
          </strong>

          <div className="resource-bar">
            <div
              className="energy-fill"
              style={{
                width: `${energyPercent}%`,
              }}
            />
          </div>

          {save.energy <
            MAX_ENERGY && (
            <small>
              +1 in{" "}
              {duration(
                energyTimeRemaining
              )}
            </small>
          )}
        </div>

        <div>
          <span>
            NERVE
          </span>

          <strong>
            {save.nerve}/
            {maxNerve}
          </strong>

          <div className="resource-bar">
            <div
              className="nerve-fill"
              style={{
                width: `${nervePercent}%`,
              }}
            />
          </div>

          {save.nerve <
            maxNerve && (
            <small>
              +1 in{" "}
              {duration(
                nerveTimeRemaining
              )}
            </small>
          )}
        </div>

        <div>
          <span>
            HEALTH
          </span>

          <strong>
            {Math.floor(
              save.health
            )}
            /
            {maxHealth}
          </strong>

          <div className="resource-bar">
            <div
              className="health-fill"
              style={{
                width: `${healthPercent}%`,
              }}
            />
          </div>
        </div>

        <div>
          <span>
            STATUS
          </span>

          <strong>
            {jailed
              ? "🔒 Jailed"
              : "🟢 Free"}
          </strong>
        </div>
      </section>

      <div className="game-layout">
        <nav className="nav-card">
          <p className="eyebrow">
            CITY MENU
          </p>

          {(
            [
              [
                "city",
                "🏙️ City",
              ],
              [
                "crimes",
                "🔪 Crimes",
              ],
              [
                "combat",
                "⚔️ Combat",
              ],
              [
                "gym",
                "🏋️ Gym",
              ],
              [
                "jobs",
                "💼 Jobs",
              ],
              [
                "items",
                "🎒 Items",
              ],
              [
                "missions",
                "🎯 Missions",
              ],
              [
                "education",
                "🎓 Education",
              ],
              [
                "property",
                "🏠 Property",
              ],
              [
                "character",
                "👤 Character",
              ],
            ] as [
              Screen,
              string
            ][]
          ).map(
            ([id, label]) => (
              <button
                key={id}
                className={`nav-button ${
                  screen === id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setScreen(
                    id
                  )
                }
              >
                {label}
              </button>
            )
          )}

          <button
            className="nav-button reset-button"
            onClick={
              resetGame
            }
          >
            ↻ Reset Game
          </button>
        </nav>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                RIFTCITY
              </p>

              <h2>
                {screen ===
                "city"
                  ? "THE CITY"
                  : screen
                      .charAt(0)
                      .toUpperCase() +
                    screen.slice(
                      1
                    )}
              </h2>
            </div>

            <span className="level">
              LVL{" "}
              {
                levelInfo.level
              }
            </span>
          </div>

          {screen ===
            "city" && (
            <CityScreen
              save={save}
              currentJob={
                currentJob
              }
              maxNerve={
                maxNerve
              }
              maxHealth={
                maxHealth
              }
              nextNerveAt={
                nextNerveAt
              }
              now={now}
              setScreen={
                setScreen
              }
            />
          )}

          {screen ===
            "crimes" && (
            <CrimeScreen
              save={save}
              level={
                levelInfo.level
              }
              maxNerve={
                maxNerve
              }
              jailed={
                jailed
              }
              now={now}
              onCrime={
                runCrime
              }
            />
          )}

          {screen ===
            "combat" && (
            <CombatScreen
              save={save}
              level={
                levelInfo.level
              }
              jailed={
                jailed
              }
              onFight={
                fight
              }
            />
          )}

          {screen ===
            "gym" && (
            <GymScreen
              save={save}
              level={
                levelInfo.level
              }
              jailed={
                jailed
              }
              onTrain={
                train
              }
            />
          )}

          {screen ===
            "jobs" && (
            <JobsScreen
              save={save}
              level={
                levelInfo.level
              }
              currentJob={
                currentJob
              }
              onTakeJob={
                takeJob
              }
              onQuitJob={
                quitJob
              }
            />
          )}

          {screen ===
            "items" && (
            <ItemsScreen
              save={save}
              onBuy={
                buyItem
              }
              onUse={
                useItem
              }
              onEquip={
                equipItem
              }
            />
          )}

          {screen ===
            "missions" && (
            <MissionScreen
              save={save}
              onClaim={
                claimMission
              }
            />
          )}

          {screen ===
            "education" && (
            <EducationScreen
              save={save}
              level={
                levelInfo.level
              }
              active={
                activeEducation
              }
              now={now}
              onStart={
                startEducation
              }
            />
          )}

          {screen ===
            "property" && (
            <PropertyScreen
              save={save}
              onBuy={
                buyProperty
              }
            />
          )}

          {screen ===
            "character" && (
            <CharacterScreen
              save={save}
              maxNerve={
                maxNerve
              }
              maxHealth={
                maxHealth
              }
            />
          )}

          {message && (
            <div className="system-message">
              {message}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================
   CITY
========================= */

function CityScreen({
  save,
  currentJob,
  maxNerve,
  maxHealth,
  nextNerveAt,
  now,
  setScreen,
}: {
  save: SaveData;
  currentJob: Job | null;
  maxNerve: number;
  maxHealth: number;
  nextNerveAt: number | null;
  now: number;
  setScreen: (
    screen: Screen
  ) => void;
}) {
  const nerveTime =
    save.nerve <
    maxNerve
      ? getNerveTimeRemaining(
          save.nerve,
          maxNerve,
          now,
          save.lastNerveUpdate
        )
      : 0;

  return (
    <>
      <div className="city-dashboard">
        <div>
          <span>
            CASH
          </span>

          <strong>
            {money(
              save.cash
            )}
          </strong>
        </div>

        <div>
          <span>
            NERVE
          </span>

          <strong>
            {save.nerve}/
            {maxNerve}
          </strong>

          {nextNerveAt && (
            <small>
              +1 in{" "}
              {duration(
                nerveTime
              )}
            </small>
          )}
        </div>

        <div>
          <span>
            HEALTH
          </span>

          <strong>
            {Math.floor(
              save.health
            )}
            /
            {maxHealth}
          </strong>
        </div>
      </div>

      <div className="action-grid">
        <ActionCard
          icon="🔪"
          title="Commit a Crime"
          description="Spend Nerve and take your chances."
          onClick={() =>
            setScreen(
              "crimes"
            )
          }
        />

        <ActionCard
          icon="⚔️"
          title="Find a Fight"
          description="Test your combat stats."
          onClick={() =>
            setScreen(
              "combat"
            )
          }
        />

        <ActionCard
          icon="🏋️"
          title="Train"
          description="Spend Energy to improve your stats."
          onClick={() =>
            setScreen("gym")
          }
        />

        <ActionCard
          icon="💼"
          title="Find Work"
          description={
            currentJob
              ? `Working as ${currentJob.title}.`
              : "Get a job and earn passive income."
          }
          onClick={() =>
            setScreen(
              "jobs"
            )
          }
        />
      </div>

      <div className="panel">
        <p className="eyebrow">
          RECENT ACTIVITY
        </p>

        <ActivityFeed
          activities={
            save.activities
          }
        />
      </div>
    </>
  );
}

/* =========================
   CRIMES
========================= */

function CrimeScreen({
  save,
  level,
  maxNerve,
  jailed,
  now,
  onCrime,
}: {
  save: SaveData;
  level: number;
  maxNerve: number;
  jailed: boolean;
  now: number;
  onCrime: (
    crime: Crime
  ) => void;
}) {
  const nextNerve =
    save.nerve <
    maxNerve
      ? save.lastNerveUpdate +
        NERVE_REGEN_INTERVAL
      : null;

  const nerveTime =
    save.nerve <
    maxNerve
      ? getNerveTimeRemaining(
          save.nerve,
          maxNerve,
          now,
          save.lastNerveUpdate
        )
      : 0;

  return (
    <>
      <div className="resource-heading">
        <div>
          <p className="eyebrow">
            CRIMINAL ACTIVITY
          </p>

          <h3>
            Nerve{" "}
            {save.nerve}/
            {maxNerve}
          </h3>
        </div>

        {nextNerve && (
          <small>
            Next nerve in{" "}
            {duration(
              nerveTime
            )}
          </small>
        )}
      </div>

      <div className="crime-summary">
        <div>
          <span>
            SUCCESS
          </span>

          <strong>
            {
              save.crimesCompleted
            }
          </strong>
        </div>

        <div>
          <span>
            FAILED
          </span>

          <strong>
            {
              save.crimesFailed
            }
          </strong>
        </div>

        <div>
          <span>
            SPOOKED
          </span>

          <strong>
            {
              save.crimesSpooked
            }
          </strong>
        </div>

        <div>
          <span>
            JAILED
          </span>

          <strong>
            {
              save.timesJailed
            }
          </strong>
        </div>
      </div>

      <div className="crime-list">
        {CRIMES.map(
          (crime) => {
            const unlocked =
              crimeUnlocked(
                crime,
                level
              );

            const enoughNerve =
              save.nerve >=
              crime.nerve;

            const chance =
              crimeSuccessChance(
                crime,
                save.crimeExperience,
                save.stats
                  .intelligence,
                0
              );

            return (
              <div
                className={`crime-card ${
                  !unlocked
                    ? "locked"
                    : ""
                }`}
                key={
                  crime.id
                }
              >
                <div className="crime-main">
                  <div>
                    <span className="crime-tag">
                      {crime.risk >=
                      70
                        ? "EXTREME RISK"
                        : crime.risk >=
                          45
                        ? "HIGH RISK"
                        : "RISK"}
                    </span>

                    <h3>
                      {
                        crime.name
                      }
                    </h3>

                    <p>
                      {
                        crime.description
                      }
                    </p>
                  </div>

                  <button
                    className="crime-button"
                    disabled={
                      !unlocked ||
                      !enoughNerve ||
                      jailed
                    }
                    onClick={() =>
                      onCrime(
                        crime
                      )
                    }
                  >
                    {!unlocked
                      ? `LEVEL ${crime.levelRequired}`
                      : jailed
                      ? "JAILED"
                      : !enoughNerve
                      ? "LOW NERVE"
                      : "COMMIT"}
                  </button>
                </div>

                <div className="crime-stats">
                  <div>
                    <span>
                      NERVE
                    </span>

                    <strong>
                      {crime.nerve}
                    </strong>
                  </div>

                  <div>
                    <span>
                      SUCCESS
                    </span>

                    <strong>
                      {Math.floor(
                        chance
                      )}
                      %
                    </strong>
                  </div>

                  <div>
                    <span>
                      REWARD
                    </span>

                    <strong>
                      {money(
                        crime.minReward
                      )}
                      –
                      {money(
                        crime.maxReward
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      XP
                    </span>

                    <strong>
                      +{crime.xp}
                    </strong>
                  </div>

                  <div>
                    <span>
                      CE
                    </span>

                    <strong>
                      +{
                        crime.crimeExperience
                      }
                    </strong>
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>
    </>
  );
}

/* =========================
   COMBAT
========================= */

function CombatScreen({
  save,
  level,
  jailed,
  onFight,
}: {
  save: SaveData;
  level: number;
  jailed: boolean;
  onFight: (
    opponent: Opponent
  ) => void;
}) {
  return (
    <div className="list">
      <div className="panel">
        <p className="eyebrow">
          COMBAT STATS
        </p>

        <div className="stats-grid">
          <Stat
            label="Strength"
            value={
              save.stats
                .strength
            }
          />

          <Stat
            label="Defense"
            value={
              save.stats
                .defense
            }
          />

          <Stat
            label="Speed"
            value={
              save.stats.speed
            }
          />

          <Stat
            label="Dexterity"
            value={
              save.stats
                .dexterity
            }
          />
        </div>
      </div>

      {OPPONENTS.map(
        (opponent) => {
          const locked =
            level <
            opponent.level;

          return (
            <div
              className="list-card"
              key={
                opponent.id
              }
            >
              <div>
                <span className="job-tag">
                  LEVEL{" "}
                  {
                    opponent.level
                  }
                </span>

                <h3>
                  {
                    opponent.name
                  }
                </h3>

                <p>
                  Health:{" "}
                  {
                    opponent.health
                  }
                </p>
              </div>

              <button
                className="job-button"
                disabled={
                  locked ||
                  jailed
                }
                onClick={() =>
                  onFight(
                    opponent
                  )
                }
              >
                {locked
                  ? `LEVEL ${opponent.level}`
                  : jailed
                  ? "JAILED"
                  : "ATTACK"}
              </button>
            </div>
          );
        }
      )}
    </div>
  );
}

/* =========================
   GYM
========================= */

function GymScreen({
  save,
  level,
  jailed,
  onTrain,
}: {
  save: SaveData;
  level: number;
  jailed: boolean;
  onTrain: (
    gym: Gym
  ) => void;
}) {
  const energyTime =
    save.energy <
    MAX_ENERGY
      ? getEnergyTimeRemaining(
          save.energy,
          Date.now(),
          save.lastEnergyUpdate
        )
      : 0;

  return (
    <div className="list">
      <div className="panel">
        <p className="eyebrow">
          TRAINING
        </p>

        <h3>
          Energy:{" "}
          {Math.floor(
            save.energy
          )}
          /100
        </h3>

        {save.energy <
          MAX_ENERGY && (
          <small>
            +1 in{" "}
            {duration(
              energyTime
            )}
          </small>
        )}

        <p>
          Energy regenerates automatically.
          Spend it to permanently improve
          your combat stats.
        </p>
      </div>

      {GYMS.map(
        (gym) => {
          const locked =
            level <
            gym.levelRequired;

          return (
            <div
              className="list-card"
              key={
                gym.id
              }
            >
              <div>
                <span className="job-tag">
                  LEVEL{" "}
                  {
                    gym.levelRequired
                  }
                </span>

                <h3>
                  {gym.name}
                </h3>

                <p>
                  {
                    gym.description
                  }
                </p>

                <small>
                  Energy:{" "}
                  {
                    gym.energyCost
                  }
                  {" • "}
                  STR +
                  {
                    gym.gains
                      .strength ||
                    0
                  }
                  {" • "}
                  DEF +
                  {
                    gym.gains
                      .defense ||
                    0
                  }
                  {" • "}
                  SPD +
                  {
                    gym.gains
                      .speed ||
                    0
                  }
                  {" • "}
                  DEX +
                  {
                    gym.gains
                      .dexterity ||
                    0
                  }
                </small>
              </div>

              <button
                className="job-button"
                disabled={
                  locked ||
                  jailed ||
                  save.energy <
                    gym.energyCost
                }
                onClick={() =>
                  onTrain(
                    gym
                  )
                }
              >
                {locked
                  ? `LEVEL ${gym.levelRequired}`
                  : "TRAIN"}
              </button>
            </div>
          );
        }
      )}
    </div>
  );
}

/* =========================
   JOBS
========================= */

function JobsScreen({
  save,
  level,
  currentJob,
  onTakeJob,
  onQuitJob,
}: {
  save: SaveData;
  level: number;
  currentJob: Job | null;
  onTakeJob: (
    job: Job
  ) => void;
  onQuitJob: () => void;
}) {
  return (
    <>
      {currentJob && (
        <div className="income-summary">
          <div>
            <span>
              CURRENT JOB
            </span>

            <strong>
              {
                currentJob.title
              }
            </strong>

            <small>
              {
                currentJob.company
              }
              {" • "}
              {money(
                currentJob.salary
              )}
              / hour
            </small>
          </div>

          <button
            className="quit-button"
            onClick={
              onQuitJob
            }
          >
            QUIT
          </button>
        </div>
      )}

      <div className="list">
        {JOBS.map(
          (job) => {
            const locked =
              level <
              job.levelRequired;

            const active =
              save.currentJob ===
              job.id;

            return (
              <div
                className={`list-card ${
                  active
                    ? "owned"
                    : ""
                }`}
                key={
                  job.id
                }
              >
                <div>
                  <span className="job-tag">
                    {
                      job.company
                    }
                  </span>

                  <h3>
                    {
                      job.title
                    }
                  </h3>

                  <p>
                    {
                      job.description
                    }
                  </p>

                  <small>
                    {money(
                      job.salary
                    )}
                    /hour
                  </small>
                </div>

                <button
                  className="job-button"
                  disabled={
                    locked ||
                    active
                  }
                  onClick={() =>
                    onTakeJob(
                      job
                    )
                  }
                >
                  {active
                    ? "CURRENT"
                    : locked
                    ? `LEVEL ${job.levelRequired}`
                    : "TAKE JOB"}
                </button>
              </div>
            );
          }
        )}
      </div>
    </>
  );
}

/* =========================
   ITEMS
========================= */

function ItemsScreen({
  save,
  onBuy,
  onUse,
  onEquip,
}: {
  save: SaveData;
  onBuy: (
    item: Item
  ) => void;
  onUse: (
    item: Item
  ) => void;
  onEquip: (
    item: Item
  ) => void;
}) {
  return (
    <div className="list">
      {ITEMS.map(
        (item) => {
          const count =
            save.inventory[
              item.id
            ] || 0;

          const equipped =
            save.equippedWeapon ===
              item.id ||
            save.equippedArmor ===
              item.id;

          return (
            <div
              className="list-card"
              key={
                item.id
              }
            >
              <div>
                <span className="job-tag">
                  {
                    item.type.toUpperCase()
                  }
                </span>

                <h3>
                  {item.name}
                </h3>

                <p>
                  {
                    item.description
                  }
                </p>

                <small>
                  Owned:{" "}
                  {count}
                  {" • "}
                  {money(
                    item.price
                  )}
                </small>
              </div>

              <div className="button-row">
                <button
                  className="job-button"
                  onClick={() =>
                    onBuy(
                      item
                    )
                  }
                >
                  BUY
                </button>

                {count >
                  0 &&
                  (item.type ===
                    "medical" ||
                    item.type ===
                      "energy" ||
                    item.type ===
                      "nerve") && (
                    <button
                      className="small-button"
                      onClick={() =>
                        onUse(
                          item
                        )
                      }
                    >
                      USE
                    </button>
                  )}

                {count >
                  0 &&
                  (item.type ===
                    "weapon" ||
                    item.type ===
                      "armor") && (
                    <button
                      className="small-button"
                      onClick={() =>
                        onEquip(
                          item
                        )
                      }
                    >
                      {equipped
                        ? "EQUIPPED"
                        : "EQUIP"}
                    </button>
                  )}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

/* =========================
   MISSIONS
========================= */

function MissionScreen({
  save,
  onClaim,
}: {
  save: SaveData;
  onClaim: (
    mission: Mission
  ) => void;
}) {
  return (
    <div className="list">
      {MISSIONS.map(
        (mission) => {
          let progress = 0;

          if (
            mission.requirement ===
            "crime"
          ) {
            progress =
              save.crimesCompleted;
          }

          if (
            mission.requirement ===
            "combat"
          ) {
            progress =
              save.fightsWon;
          }

          if (
            mission.requirement ===
            "gym"
          ) {
            progress =
              save.gymSessions;
          }

          if (
            mission.requirement ===
            "cash"
          ) {
            progress =
              save.cash;
          }

          const complete =
            progress >=
            mission.target;

          const claimed =
            save.completedMissions.includes(
              mission.id
            );

          return (
            <div
              className="list-card"
              key={
                mission.id
              }
            >
              <div>
                <span className="job-tag">
                  MISSION
                </span>

                <h3>
                  {
                    mission.name
                  }
                </h3>

                <p>
                  {
                    mission.description
                  }
                </p>

                <small>
                  Progress:{" "}
                  {Math.min(
                    progress,
                    mission.target
                  )}
                  /
                  {
                    mission.target
                  }
                  {" • Reward "}
                  {money(
                    mission.rewardCash
                  )}
                  {" + "}
                  {
                    mission.rewardXp
                  }{" "}
                  XP
                </small>
              </div>

              <button
                className="job-button"
                disabled={
                  !complete ||
                  claimed
                }
                onClick={() =>
                  onClaim(
                    mission
                  )
                }
              >
                {claimed
                  ? "CLAIMED"
                  : complete
                  ? "CLAIM"
                  : "IN PROGRESS"}
              </button>
            </div>
          );
        }
      )}
    </div>
  );
}

/* =========================
   EDUCATION
========================= */

function EducationScreen({
  save,
  level,
  active,
  now,
  onStart,
}: {
  save: SaveData;
  level: number;
  active: EducationCourse | null;
  now: number;
  onStart: (
    course: EducationCourse
  ) => void;
}) {
  return (
    <div className="list">
      {active && (
        <div className="panel">
          <p className="eyebrow">
            CURRENT COURSE
          </p>

          <h3>
            {active.name}
          </h3>

          {save.educationStartedAt && (
            <p>
              Finishes in{" "}
              {duration(
                Math.max(
                  0,
                  save.educationStartedAt +
                    active.durationHours *
                      60 *
                      60 *
                      1000 -
                    now
                )
              )}
            </p>
          )}
        </div>
      )}

      {EDUCATION.map(
        (course) => {
          const completed =
            save.educationCompleted.includes(
              course.id
            );

          const locked =
            level <
            course.levelRequired;

          return (
            <div
              className="list-card"
              key={
                course.id
              }
            >
              <div>
                <span className="job-tag">
                  LEVEL{" "}
                  {
                    course.levelRequired
                  }
                </span>

                <h3>
                  {
                    course.name
                  }
                </h3>

                <p>
                  {
                    course.description
                  }
                </p>

                <small>
                  Cost:{" "}
                  {money(
                    course.cost
                  )}
                  {" • "}
                  {
                    course.durationHours
                  }
                  h
                  {" • "}
                  +{
                    course.bonusAmount
                  }{" "}
                  {
                    course.bonus
                  }
                </small>
              </div>

              <button
                className="job-button"
                disabled={
                  locked ||
                  completed ||
                  !!active
                }
                onClick={() =>
                  onStart(
                    course
                  )
                }
              >
                {completed
                  ? "COMPLETE"
                  : locked
                  ? `LEVEL ${course.levelRequired}`
                  : active
                  ? "STUDYING"
                  : "ENROLL"}
              </button>
            </div>
          );
        }
      )}
    </div>
  );
}

/* =========================
   PROPERTY
========================= */

function PropertyScreen({
  save,
  onBuy,
}: {
  save: SaveData;
  onBuy: (
    property: Property
  ) => void;
}) {
  return (
    <div className="list">
      {PROPERTIES.map(
        (property) => {
          const owned =
            save.ownedProperty ===
            property.id;

          return (
            <div
              className={`list-card ${
                owned
                  ? "owned"
                  : ""
              }`}
              key={
                property.id
              }
            >
              <div>
                <span className="job-tag">
                  PROPERTY
                </span>

                <h3>
                  {
                    property.name
                  }
                </h3>

                <p>
                  {
                    property.description
                  }
                </p>

                <small>
                  Health +{
                    property.maxHealthBonus
                  }
                  {" • "}
                  Gym +
                  {
                    property.gymBonus
                  }%
                  {" • "}
                  Nerve +
                  {
                    property.nerveBonus
                  }
                </small>
              </div>

              <button
                className="job-button"
                disabled={
                  owned
                }
                onClick={() =>
                  onBuy(
                    property
                  )
                }
              >
                {owned
                  ? "OWNED"
                  : money(
                      property.price
                    )}
              </button>
            </div>
          );
        }
      )}
    </div>
  );
}

/* =========================
   CHARACTER
========================= */

function CharacterScreen({
  save,
  maxNerve,
  maxHealth,
}: {
  save: SaveData;
  maxNerve: number;
  maxHealth: number;
}) {
  return (
    <>
      <div className="city-dashboard">
        <div>
          <span>
            LEVEL
          </span>

          <strong>
            {
              getLevel(
                save.xp
              ).level
            }
          </strong>
        </div>

        <div>
          <span>
            CRIME EXPERIENCE
          </span>

          <strong>
            {
              save.crimeExperience
            }
          </strong>
        </div>

        <div>
          <span>
            NERVE BAR
          </span>

          <strong>
            {save.nerve}/
            {maxNerve}
          </strong>
        </div>

        <div>
          <span>
            HEALTH
          </span>

          <strong>
            {Math.floor(
              save.health
            )}
            /
            {maxHealth}
          </strong>
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">
          COMBAT STATS
        </p>

        <div className="stats-grid">
          <Stat
            label="Strength"
            value={
              save.stats
                .strength
            }
          />

          <Stat
            label="Defense"
            value={
              save.stats
                .defense
            }
          />

          <Stat
            label="Speed"
            value={
              save.stats.speed
            }
          />

          <Stat
            label="Dexterity"
            value={
              save.stats
                .dexterity
            }
          />
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">
          RECORD
        </p>

        <div className="record-grid">
          <div>
            <span>
              CRIMES
            </span>

            <strong>
              {
                save.crimesCompleted
              }
            </strong>
          </div>

          <div>
            <span>
              FIGHTS WON
            </span>

            <strong>
              {
                save.fightsWon
              }
            </strong>
          </div>

          <div>
            <span>
              GYM SESSIONS
            </span>

            <strong>
              {
                save.gymSessions
              }
            </strong>
          </div>

          <div>
            <span>
              JAILED
            </span>

            <strong>
              {
                save.timesJailed
              }
            </strong>
          </div>
        </div>
      </div>
    </>
  );
}

/* =========================
   COMPONENTS
========================= */

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className="action-card"
      onClick={
        onClick
      }
    >
      <span>
        {icon}
      </span>

      <strong>
        {title}
      </strong>

      <small>
        {description}
      </small>
    </button>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="stat-card">
      <span>
        {label}
      </span>

      <strong>
        {value.toFixed(
          1
        )}
      </strong>
    </div>
  );
}

function ActivityFeed({
  activities,
}: {
  activities: Activity[];
}) {
  return (
    <div className="activity-feed">
      {activities
        .slice(0, 12)
        .map(
          (activity) => (
            <div
              className={`activity ${
                activity.type
              }`}
              key={
                activity.id
              }
            >
              <span>
                {new Date(
                  activity.time
                ).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute:
                      "2-digit",
                  }
                )}
              </span>

              <strong>
                {
                  activity.text
                }
              </strong>
            </div>
          )
        )}
    </div>
  );
}

export default App;
