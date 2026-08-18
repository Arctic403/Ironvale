import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CRIMES,
  Crime,
  CrimeOutcome,
  calculateSuccessChance,
  crimeUnlocked,
  randomReward,
  rollCrimeOutcome,
} from "./crimeSystem";

type Screen =
  | "city"
  | "crimes"
  | "job"
  | "character";

type Activity = {
  id: number;
  text: string;
  type:
    | "success"
    | "failure"
    | "spooked"
    | "jailed"
    | "job"
    | "system";
  time: number;
};

type Stats = {
  strength: number;
  defense: number;
  speed: number;
  intelligence: number;
};

type Job = {
  id: string;
  company: string;
  title: string;
  salary: number;
  levelRequired: number;
  description: string;
};

type SaveData = {
  cash: number;
  xp: number;
  energy: number;

  stats: Stats;

  currentJob: string | null;

  crimeCooldowns: Record<
    string,
    number
  >;

  jailUntil: number | null;

  crimesCompleted: number;
  crimesFailed: number;
  crimesSpooked: number;
  timesJailed: number;

  activities: Activity[];

  lastEnergyUpdate: number;
  lastJobUpdate: number;
};

const SAVE_KEY =
  "riftcity-simple-v2";

const MAX_ENERGY = 100;

const ENERGY_REGEN_MS =
  60 * 1000;

const JOB_PAY_INTERVAL =
  60 * 60 * 1000;

const JOBS: Job[] = [
  {
    id: "delivery",
    company: "RiftExpress",
    title: "Courier",
    salary: 100,
    levelRequired: 1,
    description:
      "Deliver packages across RiftCity.",
  },

  {
    id: "security",
    company: "RiftShield",
    title: "Security Guard",
    salary: 180,
    levelRequired: 5,
    description:
      "Protect businesses around the city.",
  },

  {
    id: "construction",
    company: "Ironworks",
    title: "Construction Worker",
    salary: 300,
    levelRequired: 10,
    description:
      "Build the city while building your wallet.",
  },

  {
    id: "technician",
    company: "RiftTech",
    title: "Technician",
    salary: 500,
    levelRequired: 15,
    description:
      "Keep RiftCity's systems running.",
  },

  {
    id: "finance",
    company: "Rift Capital",
    title: "Finance Associate",
    salary: 800,
    levelRequired: 25,
    description:
      "Move money for people who have too much of it.",
  },
];

function newSave(): SaveData {
  const now = Date.now();

  return {
    cash: 1000,

    xp: 0,

    energy: 100,

    stats: {
      strength: 1,
      defense: 1,
      speed: 1,
      intelligence: 1,
    },

    currentJob: null,

    crimeCooldowns: {},

    jailUntil: null,

    crimesCompleted: 0,

    crimesFailed: 0,

    crimesSpooked: 0,

    timesJailed: 0,

    activities: [
      {
        id: 1,
        text:
          "Welcome to RiftCity. Keep your head down.",
        type: "system",
        time: now,
      },
    ],

    lastEnergyUpdate: now,

    lastJobUpdate: now,
  };
}

function loadSave(): SaveData {
  try {
    const raw =
      localStorage.getItem(
        SAVE_KEY
      );

    if (!raw) {
      return newSave();
    }

    const parsed =
      JSON.parse(raw);

    return {
      ...newSave(),
      ...parsed,

      stats: {
        ...newSave().stats,
        ...(parsed.stats || {}),
      },

      crimeCooldowns:
        parsed.crimeCooldowns || {},

      activities:
        parsed.activities || [],
    };
  } catch {
    return newSave();
  }
}

function formatMoney(
  amount: number
) {
  return `$${Math.floor(
    amount
  ).toLocaleString()}`;
}

function formatTime(
  milliseconds: number
) {
  const totalSeconds =
    Math.max(
      0,
      Math.ceil(
        milliseconds / 1000
      )
    );

  const hours =
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getLevel(xp: number) {
  let level = 1;

  let required = 100;

  let remaining = xp;

  while (
    remaining >= required
  ) {
    remaining -= required;

    level++;

    required =
      Math.floor(
        100 *
          Math.pow(
            1.16,
            level - 1
          )
      );
  }

  return {
    level,
    currentXp: remaining,
    requiredXp: required,
  };
}

function addActivity(
  data: SaveData,
  text: string,
  type: Activity["type"]
) {
  return {
    ...data,

    activities: [
      {
        id: Date.now(),
        text,
        type,
        time: Date.now(),
      },
      ...data.activities,
    ].slice(0, 50),
  };
}

function processOfflineState(
  data: SaveData
) {
  const now = Date.now();

  let updated = {
    ...data,
  };

  /*
   * Energy regeneration.
   */
  const elapsedEnergy =
    now -
    data.lastEnergyUpdate;

  const energyTicks =
    Math.floor(
      elapsedEnergy /
        ENERGY_REGEN_MS
    );

  if (energyTicks > 0) {
    updated.energy =
      Math.min(
        MAX_ENERGY,
        data.energy + energyTicks
      );

    updated.lastEnergyUpdate =
      now;
  }

  /*
   * Job income.
   */
  if (data.currentJob) {
    const job =
      JOBS.find(
        (item) =>
          item.id ===
          data.currentJob
      );

    if (job) {
      const elapsedJob =
        now -
        data.lastJobUpdate;

      const payments =
        Math.floor(
          elapsedJob /
            JOB_PAY_INTERVAL
        );

      if (payments > 0) {
        const income =
          payments *
          job.salary;

        updated.cash += income;

        updated.lastJobUpdate =
          now;

        updated =
          addActivity(
            updated,
            `${job.title} shift complete. +${formatMoney(
              income
            )}`,
            "job"
          );
      }
    }
  }

  /*
   * Automatically clear expired jail.
   */
  if (
    updated.jailUntil &&
    updated.jailUntil <= now
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

  return updated;
}

function App() {
  const [
    data,
    setData,
  ] = useState<SaveData>(
    () =>
      processOfflineState(
        loadSave()
      )
  );

  const [
    screen,
    setScreen,
  ] = useState<Screen>(
    "city"
  );

  const [
    now,
    setNow,
  ] = useState(Date.now());

  const levelInfo =
    useMemo(
      () => getLevel(data.xp),
      [data.xp]
    );

  const currentJob =
    JOBS.find(
      (job) =>
        job.id ===
        data.currentJob
    ) || null;

  const jailed =
    data.jailUntil !== null &&
    data.jailUntil > now;

  /*
   * Save whenever state changes.
   */
  useEffect(() => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(data)
    );
  }, [data]);

  /*
   * One-second game clock.
   */
  useEffect(() => {
    const interval =
      window.setInterval(() => {
        setNow(Date.now());
      }, 1000);

    return () =>
      window.clearInterval(
        interval
      );
  }, []);

  /*
   * Process passive systems.
   */
  useEffect(() => {
    const interval =
      window.setInterval(() => {
        setData((current) =>
          processOfflineState(
            current
          )
        );
      }, 5000);

    return () =>
      window.clearInterval(
        interval
      );
  }, []);

  function runCrime(
    crime: Crime
  ) {
    const level =
      levelInfo.level;

    if (
      !crimeUnlocked(
        crime,
        level
      )
    ) {
      return;
    }

    if (jailed) {
      return;
    }

    const cooldown =
      data.crimeCooldowns[
        crime.id
      ] || 0;

    if (cooldown > now) {
      return;
    }

    if (
      data.energy <
      crime.energy
    ) {
      return;
    }

    const successChance =
      calculateSuccessChance(
        crime,
        data.stats
      );

    const outcome =
      rollCrimeOutcome(
        crime,
        successChance
      );

    let updated: SaveData = {
      ...data,

      energy:
        data.energy -
        crime.energy,

      crimeCooldowns: {
        ...data.crimeCooldowns,

        [crime.id]:
          now +
          crime.cooldownMinutes *
            60 *
            1000,
      },
    };

    if (
      outcome ===
      "success"
    ) {
      const reward =
        randomReward(
          crime
        );

      updated.cash +=
        reward;

      updated.xp +=
        crime.xp;

      updated.crimesCompleted++;

      updated =
        addActivity(
          updated,
          `${crime.name} succeeded. +${formatMoney(
            reward
          )} / +${crime.xp} XP`,
          "success"
        );
    }

    if (
      outcome ===
      "failed"
    ) {
      updated.crimesFailed++;

      updated.xp +=
        Math.floor(
          crime.xp * 0.25
        );

      updated =
        addActivity(
          updated,
          `${crime.name} failed. You got nothing.`,
          "failure"
        );
    }

    if (
      outcome ===
      "spooked"
    ) {
      updated.crimesSpooked++;

      /*
       * Getting spooked costs a little
       * extra energy.
       */
      updated.energy =
        Math.max(
          0,
          updated.energy - 2
        );

      updated =
        addActivity(
          updated,
          `You were spooked during ${crime.name} and barely escaped.`,
          "spooked"
        );
    }

    if (
      outcome ===
      "jailed"
    ) {
      /*
       * Jail time scales with crime risk.
       * Roughly 1–8 minutes.
       */
      const jailMinutes =
        Math.max(
          1,
          Math.round(
            crime.risk / 12
          )
        );

      updated.jailUntil =
        now +
        jailMinutes *
          60 *
          1000;

      updated.timesJailed++;

      updated =
        addActivity(
          updated,
          `BUSTED! You were arrested after ${crime.name}. Jail: ${jailMinutes}m.`,
          "jailed"
        );
    }

    setData(
      processOfflineState(
        updated
      )
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

    const now =
      Date.now();

    let updated = {
      ...data,

      currentJob: job.id,

      lastJobUpdate: now,
    };

    updated =
      addActivity(
        updated,
        `You started working for ${job.company} as a ${job.title}.`,
        "job"
      );

    setData(updated);
  }

  function quitJob() {
    if (!data.currentJob) {
      return;
    }

    const updated =
      addActivity(
        {
          ...data,
          currentJob: null,
          lastJobUpdate:
            Date.now(),
        },
        "You quit your job.",
        "job"
      );

    setData(updated);
  }

  function resetGame() {
    const confirmed =
      window.confirm(
        "Reset your RiftCity character? This cannot be undone."
      );

    if (!confirmed) {
      return;
    }

    const fresh =
      newSave();

    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(
        fresh
      )
    );

    setData(fresh);

    setScreen(
      "city"
    );
  }

  const xpPercent =
    Math.min(
      100,
      Math.round(
        (levelInfo.currentXp /
          levelInfo.requiredXp) *
          100
      )
    );

  return (
    <div className="app">
      <header className="game-header">
        <div className="logo">
          <div className="logo-mark">
            R
          </div>

          <span>
            Rift<span>City</span>
          </span>
        </div>

        <div className="wallet">
          <span>
            CASH
          </span>

          <strong>
            {formatMoney(
              data.cash
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
          {levelInfo.level}
        </button>
      </header>

      <div className="player-bar">
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
            {levelInfo.level}
          </strong>
        </div>

        <div>
          <span>
            XP
          </span>

          <strong>
            {levelInfo.currentXp} /{" "}
            {levelInfo.requiredXp}
          </strong>
        </div>

        <div>
          <span>
            ENERGY
          </span>

          <strong>
            {data.energy} /{" "}
            {MAX_ENERGY}
          </strong>
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
      </div>

      <main className="game-layout">
        <aside className="nav-card">
          <div className="eyebrow">
            RIFT CITY
          </div>

          <button
            className={`nav-button ${
              screen === "city"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setScreen("city")
            }
          >
            🏙️ City
          </button>

          <button
            className={`nav-button ${
              screen ===
              "crimes"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setScreen(
                "crimes"
              )
            }
          >
            🔪 Crimes
          </button>

          <button
            className={`nav-button ${
              screen === "job"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setScreen("job")
            }
          >
            💼 Jobs
          </button>

          <button
            className={`nav-button ${
              screen ===
              "character"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setScreen(
                "character"
              )
            }
          >
            👤 Character
          </button>

          <button
            className="nav-button reset-button"
            onClick={
              resetGame
            }
          >
            Reset Game
          </button>
        </aside>

        <section className="content-card">
          {screen ===
            "city" && (
            <CityScreen
              data={data}
              levelInfo={
                levelInfo
              }
              currentJob={
                currentJob
              }
              jailed={jailed}
              jailUntil={
                data.jailUntil
              }
              now={now}
              xpPercent={
                xpPercent
              }
              setScreen={
                setScreen
              }
            />
          )}

          {screen ===
            "crimes" && (
            <CrimeScreen
              data={data}
              level={
                levelInfo.level
              }
              jailed={jailed}
              jailUntil={
                data.jailUntil
              }
              now={now}
              onCrime={
                runCrime
              }
            />
          )}

          {screen ===
            "job" && (
            <JobScreen
              data={data}
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
            "character" && (
            <CharacterScreen
              data={data}
              levelInfo={
                levelInfo
              }
            />
          )}
        </section>
      </main>
    </div>
  );
}

function CityScreen({
  data,
  levelInfo,
  currentJob,
  jailed,
  jailUntil,
  now,
  xpPercent,
  setScreen,
}: {
  data: SaveData;
  levelInfo: ReturnType<
    typeof getLevel
  >;
  currentJob: Job | null;
  jailed: boolean;
  jailUntil: number | null;
  now: number;
  xpPercent: number;
  setScreen: (
    screen: Screen
  ) => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <div className="eyebrow">
            WELCOME TO
          </div>

          <h2>
            RiftCity
          </h2>

          <p className="intro">
            A city where everyone wants
            something and nobody asks too
            many questions.
          </p>
        </div>

        <div className="level">
          LEVEL{" "}
          {levelInfo.level}
        </div>
      </div>

      {jailed &&
        jailUntil && (
          <div className="panel jail-panel">
            <div className="eyebrow">
              🚨 ARRESTED
            </div>

            <h3>
              You're in jail.
            </h3>

            <p>
              Keep your head down. You'll
              be released in{" "}
              <strong>
                {formatTime(
                  jailUntil -
                    now
                )}
              </strong>
              .
            </p>
          </div>
        )}

      <div className="city-dashboard">
        <div>
          <span>
            CASH
          </span>

          <strong>
            {formatMoney(
              data.cash
            )}
          </strong>
        </div>

        <div>
          <span>
            ENERGY
          </span>

          <strong>
            {data.energy}/100
          </strong>
        </div>

        <div>
          <span>
            JOB
          </span>

          <strong>
            {currentJob
              ? currentJob.title
              : "Unemployed"}
          </strong>
        </div>
      </div>

      <div className="panel">
        <div className="eyebrow">
          EXPERIENCE
        </div>

        <div className="xp-bar">
          <div
            style={{
              width: `${xpPercent}%`,
            }}
          />
        </div>

        <p>
          {levelInfo.currentXp} /{" "}
          {levelInfo.requiredXp} XP
          until Level{" "}
          {levelInfo.level +
            1}
        </p>
      </div>

      <div className="action-grid">
        <button
          className="action-card"
          onClick={() =>
            setScreen(
              "crimes"
            )
          }
        >
          <span>
            🔪
          </span>

          <strong>
            Commit a Crime
          </strong>

          <small>
            Make money. Take risks.
            Try not to get caught.
          </small>
        </button>

        <button
          className="action-card"
          onClick={() =>
            setScreen("job")
          }
        >
          <span>
            💼
          </span>

          <strong>
            Find Work
          </strong>

          <small>
            Earn passive income while
            you're away.
          </small>
        </button>
      </div>

      <div className="panel activity-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              CITY FEED
            </div>

            <h3>
              Recent Activity
            </h3>
          </div>
        </div>

        <ActivityFeed
          activities={
            data.activities
          }
        />
      </div>
    </>
  );
}

function CrimeScreen({
  data,
  level,
  jailed,
  jailUntil,
  now,
  onCrime,
}: {
  data: SaveData;
  level: number;
  jailed: boolean;
  jailUntil: number | null;
  now: number;
  onCrime: (
    crime: Crime
  ) => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <div className="eyebrow">
            CRIMINAL ACTIVITY
          </div>

          <h2>
            Crimes
          </h2>

          <p className="intro">
            Every score has a price. The
            question is whether you're
            willing to pay it.
          </p>
        </div>
      </div>

      {jailed &&
        jailUntil && (
          <div className="panel jail-panel">
            <div className="eyebrow">
              🔒 YOU ARE JAILED
            </div>

            <h3>
              Come back later.
            </h3>

            <p>
              Release in{" "}
              <strong>
                {formatTime(
                  jailUntil -
                    now
                )}
              </strong>
              .
            </p>
          </div>
        )}

      <div className="crime-summary">
        <div>
          <span>
            COMPLETED
          </span>

          <strong>
            {
              data.crimesCompleted
            }
          </strong>
        </div>

        <div>
          <span>
            FAILED
          </span>

          <strong>
            {
              data.crimesFailed
            }
          </strong>
        </div>

        <div>
          <span>
            JAILED
          </span>

          <strong>
            {data.timesJailed}
          </strong>
        </div>
      </div>

      <div className="crime-list">
        {CRIMES.map(
          (crime) => (
            <CrimeCard
              key={
                crime.id
              }
              crime={
                crime
              }
              data={
                data
              }
              level={
                level
              }
              jailed={
                jailed
              }
              now={
                now
              }
              onCrime={
                onCrime
              }
            />
          )
        )}
      </div>
    </>
  );
}

function CrimeCard({
  crime,
  data,
  level,
  jailed,
  now,
  onCrime,
}: {
  crime: Crime;
  data: SaveData;
  level: number;
  jailed: boolean;
  now: number;
  onCrime: (
    crime: Crime
  ) => void;
}) {
  const unlocked =
    crimeUnlocked(
      crime,
      level
    );

  const cooldown =
    data.crimeCooldowns[
      crime.id
    ] || 0;

  const onCooldown =
    cooldown > now;

  const insufficientEnergy =
    data.energy <
    crime.energy;

  const disabled =
    !unlocked ||
    jailed ||
    onCooldown ||
    insufficientEnergy;

  const successChance =
    calculateSuccessChance(
      crime,
      data.stats
    );

  return (
    <div
      className={`crime-card ${
        !unlocked
          ? "locked"
          : ""
      }`}
    >
      <div className="crime-main">
        <div>
          <div className="crime-tag">
            {crime.risk >=
            70
              ? "EXTREME RISK"
              : crime.risk >=
                45
              ? "HIGH RISK"
              : crime.risk >=
                25
              ? "MEDIUM RISK"
              : "LOW RISK"}
          </div>

          <h3>
            {crime.name}
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
            disabled
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
            : onCooldown
            ? formatTime(
                cooldown -
                  now
              )
            : insufficientEnergy
            ? "LOW ENERGY"
            : "COMMIT"}
        </button>
      </div>

      <div className="crime-stats">
        <div>
          <span>
            ENERGY
          </span>

          <strong>
            ⚡{" "}
            {crime.energy}
          </strong>
        </div>

        <div>
          <span>
            SUCCESS
          </span>

          <strong>
            {Math.round(
              successChance
            )}
            %
          </strong>
        </div>

        <div>
          <span>
            REWARD
          </span>

          <strong>
            {formatMoney(
              crime.minReward
            )}
            –
            {formatMoney(
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
            COOLDOWN
          </span>

          <strong>
            {crime.cooldownMinutes}m
          </strong>
        </div>

        <div>
          <span>
            JAIL RISK
          </span>

          <strong>
            {crime.risk}%
          </strong>
        </div>
      </div>

      {!unlocked && (
        <div className="locked-message">
          Reach Level{" "}
          {
            crime.levelRequired
          }{" "}
          to unlock this crime.
        </div>
      )}
    </div>
  );
}

function JobScreen({
  data,
  level,
  currentJob,
  onTakeJob,
  onQuitJob,
}: {
  data: SaveData;
  level: number;
  currentJob: Job | null;
  onTakeJob: (
    job: Job
  ) => void;
  onQuitJob: () => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <div className="eyebrow">
            EMPLOYMENT
          </div>

          <h2>
            Jobs
          </h2>

          <p className="intro">
            Work quietly. Get paid. Use the
            money for things your employer
            definitely wouldn't approve of.
          </p>
        </div>
      </div>

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
              {formatMoney(
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
            Quit Job
          </button>
        </div>
      )}

      <div className="jobs-list">
        {JOBS.map(
          (job) => {
            const unlocked =
              level >=
              job.levelRequired;

            const selected =
              data.currentJob ===
              job.id;

            return (
              <div
                key={
                  job.id
                }
                className={`job-card ${
                  !unlocked
                    ? "locked"
                    : ""
                } ${
                  selected
                    ? "owned"
                    : ""
                }`}
              >
                <div className="job-main">
                  <div>
                    <div className="job-tag">
                      {
                        job.company
                      }
                    </div>

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
                  </div>

                  <button
                    className="job-button"
                    disabled={
                      !unlocked ||
                      selected
                    }
                    onClick={() =>
                      onTakeJob(
                        job
                      )
                    }
                  >
                    {selected
                      ? "CURRENT"
                      : !unlocked
                      ? `LEVEL ${job.levelRequired}`
                      : "TAKE JOB"}
                  </button>
                </div>

                <div className="job-rewards">
                  <div>
                    <span>
                      PAY
                    </span>

                    <strong>
                      {formatMoney(
                        job.salary
                      )}
                      /hr
                    </strong>
                  </div>

                  <div>
                    <span>
                      REQUIREMENT
                    </span>

                    <strong>
                      Level{" "}
                      {
                        job.levelRequired
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

function CharacterScreen({
  data,
  levelInfo,
}: {
  data: SaveData;
  levelInfo: ReturnType<
    typeof getLevel
  >;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <div className="eyebrow">
            CHARACTER
          </div>

          <h2>
            Your Criminal Record
          </h2>
        </div>

        <div className="level">
          LEVEL{" "}
          {levelInfo.level}
        </div>
      </div>

      <div className="city-dashboard">
        <div>
          <span>
            CASH
          </span>

          <strong>
            {formatMoney(
              data.cash
            )}
          </strong>
        </div>

        <div>
          <span>
            CRIMES
          </span>

          <strong>
            {
              data.crimesCompleted
            }
          </strong>
        </div>

        <div>
          <span>
            TIMES JAILED
          </span>

          <strong>
            {data.timesJailed}
          </strong>
        </div>
      </div>

      <div className="panel">
        <div className="eyebrow">
          STATS
        </div>

        <div className="stats-grid">
          <Stat
            label="Strength"
            value={
              data.stats
                .strength
            }
          />

          <Stat
            label="Defense"
            value={
              data.stats
                .defense
            }
          />

          <Stat
            label="Speed"
            value={
              data.stats.speed
            }
          />

          <Stat
            label="Intelligence"
            value={
              data.stats
                .intelligence
            }
          />
        </div>
      </div>

      <div className="panel">
        <div className="eyebrow">
          RECORD
        </div>

        <div className="record-grid">
          <div>
            <span>
              SUCCESSFUL CRIMES
            </span>

            <strong>
              {
                data.crimesCompleted
              }
            </strong>
          </div>

          <div>
            <span>
              FAILED CRIMES
            </span>

            <strong>
              {
                data.crimesFailed
              }
            </strong>
          </div>

          <div>
            <span>
              SPOOKED
            </span>

            <strong>
              {
                data.crimesSpooked
              }
            </strong>
          </div>

          <div>
            <span>
              JAILED
            </span>

            <strong>
              {
                data.timesJailed
              }
            </strong>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="eyebrow">
          HISTORY
        </div>

        <ActivityFeed
          activities={
            data.activities
          }
        />
      </div>
    </>
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
        {value}
      </strong>
    </div>
  );
}

function ActivityFeed({
  activities,
}: {
  activities: Activity[];
}) {
  if (
    activities.length ===
    0
  ) {
    return (
      <p>
        Nothing has happened yet.
      </p>
    );
  }

  return (
    <div className="activity-feed">
      {activities
        .slice(0, 15)
        .map(
          (activity) => (
            <div
              key={
                activity.id
              }
              className={`activity ${
                activity.type
              }`}
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
                {activity.text}
              </strong>
            </div>
          )
        )}
    </div>
  );
}

export default App;
