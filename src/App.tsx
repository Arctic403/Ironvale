import React, { useEffect, useMemo, useState } from "react";

type Screen =
  | "city"
  | "job"
  | "crimes"
  | "missions"
  | "character";

type Job = {
  id: string;
  name: string;
  description: string;
  salary: number;
  minLevel: number;
  stat: keyof WorkStats;
};

type WorkStats = {
  labor: number;
  technical: number;
  security: number;
  business: number;
};

type Crime = {
  id: string;
  name: string;
  description: string;
  type: keyof CrimeStats;
  difficulty: number;
  minLevel: number;
  minStat: number;
  minEnergy: number;
  minReward: number;
  maxReward: number;
  xp: number;
};

type CrimeStats = {
  theft: number;
  burglary: number;
  robbery: number;
  cyber: number;
};

type SaveData = {
  cash: number;
  xp: number;
  energy: number;
  reputation: number;

  currentJob: string | null;
  jobRank: number;
  workDays: number;

  workStats: WorkStats;
  crimeStats: CrimeStats;

  crimesCompleted: number;
  crimesFailed: number;

  lastPayday: number;
  crimeCooldowns: Record<string, number>;
};

const SAVE_KEY = "riftcity-v2-save";

const defaultSave: SaveData = {
  cash: 1000,
  xp: 0,
  energy: 100,
  reputation: 0,

  currentJob: null,
  jobRank: 0,
  workDays: 0,

  workStats: {
    labor: 0,
    technical: 0,
    security: 0,
    business: 0,
  },

  crimeStats: {
    theft: 0,
    burglary: 0,
    robbery: 0,
    cyber: 0,
  },

  crimesCompleted: 0,
  crimesFailed: 0,

  lastPayday: Date.now(),
  crimeCooldowns: {},
};

const JOBS: Job[] = [
  {
    id: "street-cleaner",
    name: "Street Cleaner",
    description:
      "A basic city job. Low pay, but a reliable way to build your work record.",
    salary: 75,
    minLevel: 1,
    stat: "labor",
  },
  {
    id: "delivery",
    name: "Delivery Rider",
    description:
      "Deliver packages around RiftCity and improve your street knowledge.",
    salary: 100,
    minLevel: 2,
    stat: "labor",
  },
  {
    id: "construction",
    name: "Construction Worker",
    description:
      "Hard physical work with better pay and strong labor progression.",
    salary: 150,
    minLevel: 3,
    stat: "labor",
  },
  {
    id: "security",
    name: "Security Guard",
    description:
      "Protect businesses and develop security experience.",
    salary: 325,
    minLevel: 8,
    stat: "security",
  },
  {
    id: "technician",
    name: "IT Technician",
    description:
      "Maintain systems and develop valuable technical skills.",
    salary: 450,
    minLevel: 12,
    stat: "technical",
  },
  {
    id: "analyst",
    name: "Financial Analyst",
    description:
      "Analyze money flows and develop advanced business knowledge.",
    salary: 650,
    minLevel: 16,
    stat: "business",
  },
  {
    id: "executive",
    name: "Corporate Executive",
    description:
      "A high-level career for established players.",
    salary: 1000,
    minLevel: 22,
    stat: "business",
  },
];

const CRIMES: Crime[] = [
  {
    id: "pickpocket",
    name: "Pickpocket",
    description:
      "Target an unsuspecting pedestrian. Low reward, low difficulty.",
    type: "theft",
    difficulty: 10,
    minLevel: 1,
    minStat: 0,
    minEnergy: 5,
    minReward: 30,
    maxReward: 100,
    xp: 8,
  },
  {
    id: "shoplift",
    name: "Shoplifting",
    description:
      "Steal merchandise from a small local store.",
    type: "theft",
    difficulty: 25,
    minLevel: 2,
    minStat: 10,
    minEnergy: 8,
    minReward: 75,
    maxReward: 200,
    xp: 12,
  },
  {
    id: "burglary",
    name: "Residential Burglary",
    description:
      "Break into a residence and search for valuables.",
    type: "burglary",
    difficulty: 45,
    minLevel: 4,
    minStat: 15,
    minEnergy: 12,
    minReward: 150,
    maxReward: 450,
    xp: 20,
  },
  {
    id: "store-robbery",
    name: "Store Robbery",
    description:
      "A dangerous crime with a significantly higher payout.",
    type: "robbery",
    difficulty: 70,
    minLevel: 7,
    minStat: 25,
    minEnergy: 18,
    minReward: 400,
    maxReward: 1200,
    xp: 35,
  },
  {
    id: "cyber",
    name: "System Intrusion",
    description:
      "Attempt to compromise a poorly secured computer system.",
    type: "cyber",
    difficulty: 75,
    minLevel: 10,
    minStat: 25,
    minEnergy: 15,
    minReward: 600,
    maxReward: 1800,
    xp: 40,
  },
  {
    id: "major-robbery",
    name: "Major Robbery",
    description:
      "A serious operation with a major potential payout.",
    type: "robbery",
    difficulty: 110,
    minLevel: 15,
    minStat: 50,
    minEnergy: 25,
    minReward: 1500,
    maxReward: 5000,
    xp: 65,
  },
];

function loadSave(): SaveData {
  try {
    const saved = localStorage.getItem(SAVE_KEY);

    if (!saved) return defaultSave;

    return {
      ...defaultSave,
      ...JSON.parse(saved),
    };
  } catch {
    return defaultSave;
  }
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function App() {
  const [entered, setEntered] = useState(false);
  const [screen, setScreen] = useState<Screen>("city");

  const [save, setSave] = useState<SaveData>(loadSave);

  const [message, setMessage] = useState(
    "Welcome to RiftCity. Build your life. Take your chances."
  );

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [save]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const level = Math.floor(save.xp / 100) + 1;
  const xpIntoLevel = save.xp % 100;

  const currentJob = JOBS.find(
    job => job.id === save.currentJob
  );

  const paydayReady =
    now - save.lastPayday >= 24 * 60 * 60 * 1000;

  const nextPayday = Math.max(
    0,
    24 * 60 * 60 * 1000 - (now - save.lastPayday)
  );

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.ceil(milliseconds / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const chooseJob = (job: Job) => {
    if (level < job.minLevel) {
      setMessage(
        `${job.name} requires Level ${job.minLevel}.`
      );
      return;
    }

    if (save.currentJob === job.id) {
      setMessage(`You already work as a ${job.name}.`);
      return;
    }

    setSave(current => ({
      ...current,
      currentJob: job.id,
      jobRank: 1,
    }));

    setMessage(
      `You are now employed as a ${job.name}.`
    );
  };

  const workShift = () => {
    if (!currentJob) {
      setMessage("You need a job first.");
      setScreen("job");
      return;
    }

    if (save.energy < 20) {
      setMessage(
        "You're too exhausted to work. Rest first."
      );
      return;
    }

    const stat = currentJob.stat;

    setSave(current => {
      const oldStat = current.workStats[stat];

      return {
        ...current,
        energy: current.energy - 20,
        xp: current.xp + 15,
        workDays: current.workDays + 1,
        workStats: {
          ...current.workStats,
          [stat]: Math.min(100, oldStat + 1),
        },
      };
    });

    setMessage(
      `You completed a ${currentJob.name} shift. Work experience increased.`
    );
  };

  const collectPaycheck = () => {
    if (!currentJob) {
      setMessage("You don't currently have a job.");
      return;
    }

    if (!paydayReady) {
      setMessage(
        `Your next paycheck arrives in ${formatTime(nextPayday)}.`
      );
      return;
    }

    const rankBonus =
      1 + Math.max(0, save.jobRank - 1) * 0.08;

    const salary = Math.floor(
      currentJob.salary * rankBonus
    );

    setSave(current => ({
      ...current,
      cash: current.cash + salary,
      xp: current.xp + 20,
      lastPayday: Date.now(),
    }));

    setMessage(
      `Payday! You received $${salary.toLocaleString()}.`
    );
  };

  const quitJob = () => {
    if (!currentJob) return;

    setSave(current => ({
      ...current,
      currentJob: null,
      jobRank: 0,
    }));

    setMessage(
      `You quit your job as a ${currentJob.name}.`
    );
  };

  const commitCrime = (crime: Crime) => {
    const stat = save.crimeStats[crime.type];

    if (level < crime.minLevel) {
      setMessage(
        `${crime.name} requires Level ${crime.minLevel}.`
      );
      return;
    }

    if (stat < crime.minStat) {
      setMessage(
        `${crime.name} requires ${crime.minStat} ${crime.type} skill.`
      );
      return;
    }

    if (save.energy < crime.minEnergy) {
      setMessage(
        `You need ${crime.minEnergy} energy for this crime.`
      );
      return;
    }

    const cooldown =
      save.crimeCooldowns[crime.id] || 0;

    if (cooldown > now) {
      setMessage(
        `${crime.name} is on cooldown for ${formatTime(
          cooldown - now
        )}.`
      );
      return;
    }

    /*
      Success chance is intentionally conservative.

      Character level helps.
      Crime-specific skill helps.
      Difficulty pulls the chance down.

      This keeps progression meaningful without
      letting players instantly become unstoppable.
    */

    const successChance = Math.max(
      12,
      Math.min(
        92,
        55 +
          stat * 0.45 +
          level * 0.75 -
          crime.difficulty
      )
    );

    const roll = Math.random() * 100;

    const succeeded = roll <= successChance;

    const cooldownLength =
      crime.type === "robbery"
        ? 45 * 60 * 1000
        : 20 * 60 * 1000;

    if (succeeded) {
      const reward = randomBetween(
        crime.minReward,
        crime.maxReward
      );

      const statIncrease =
        Math.random() < 0.65 ? 1 : 0;

      setSave(current => ({
        ...current,
        cash: current.cash + reward,
        xp: current.xp + crime.xp,
        energy: current.energy - crime.minEnergy,
        reputation: current.reputation + 1,
        crimesCompleted: current.crimesCompleted + 1,
        crimeCooldowns: {
          ...current.crimeCooldowns,
          [crime.id]: now + cooldownLength,
        },
        crimeStats: {
          ...current.crimeStats,
          [crime.type]: Math.min(
            100,
            current.crimeStats[crime.type] + statIncrease
          ),
        },
      }));

      setMessage(
        `SUCCESS — ${crime.name} earned you $${reward.toLocaleString()}.`
      );
    } else {
      setSave(current => ({
        ...current,
        xp: current.xp + Math.floor(crime.xp / 3),
        energy: current.energy - crime.minEnergy,
        crimesFailed: current.crimesFailed + 1,
        crimeCooldowns: {
          ...current.crimeCooldowns,
          [crime.id]: now + cooldownLength,
        },
        crimeStats: {
          ...current.crimeStats,
          [crime.type]: Math.min(
            100,
            current.crimeStats[crime.type] +
              (Math.random() < 0.35 ? 1 : 0)
          ),
        },
      }));

      setMessage(
        `FAILED — You failed the ${crime.name}. No money earned.`
      );
    }
  };

  const rest = () => {
    if (save.energy >= 100) {
      setMessage("You already have full energy.");
      return;
    }

    setSave(current => ({
      ...current,
      energy: 100,
    }));

    setMessage("You rested. Energy restored.");
  };

  const completeMission = () => {
    if (save.energy < 30) {
      setMessage(
        "You need at least 30 energy."
      );
      return;
    }

    setSave(current => ({
      ...current,
      cash: current.cash + 400,
      xp: current.xp + 50,
      energy: current.energy - 30,
      reputation: current.reputation + 5,
    }));

    setMessage(
      "Mission complete. +$400, +50 XP and +5 reputation."
    );
  };

  const resetGame = () => {
    if (!confirm("Reset your RiftCity progress?")) {
      return;
    }

    localStorage.removeItem(SAVE_KEY);

    setSave({
      ...defaultSave,
      lastPayday: Date.now(),
    });

    setMessage("RiftCity progress reset.");
  };

  const crimeSuccessEstimate = (crime: Crime) => {
    const stat = save.crimeStats[crime.type];

    return Math.max(
      12,
      Math.min(
        92,
        Math.round(
          55 +
            stat * 0.45 +
            level * 0.75 -
            crime.difficulty
        )
      )
    );
  };

  const totalCrimeSkill = useMemo(() => {
    return Object.values(save.crimeStats).reduce(
      (a, b) => a + b,
      0
    );
  }, [save.crimeStats]);

  if (!entered) {
    return (
      <main className="app landing">
        <header className="topbar">
          <div className="logo">
            <span className="logo-mark">R</span>
            <span>
              RIFT<span>CITY</span>
            </span>
          </div>

          <div className="status">
            <span className="status-dot" />
            V1 ONLINE
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
              <span>YOUR RULES.</span>
            </h1>

            <p className="intro">
              Work. Build your skills. Take risks.
              Make your place in RiftCity.
            </p>

            <button
              className="play-button"
              onClick={() => setEntered(true)}
            >
              ENTER RIFTCITY <span>→</span>
            </button>
          </div>

          <div className="city-card">
            <div className="city-glow" />
            <div className="city-grid" />

            <div className="city-info">
              <span>CITY STATUS</span>
              <strong>AWAITING PLAYER</strong>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app game-shell">
      <header className="game-header">
        <div className="logo">
          <span className="logo-mark">R</span>
          <span>
            RIFT<span>CITY</span>
          </span>
        </div>

        <div className="wallet">
          <span>CASH</span>
          <strong>
            ${save.cash.toLocaleString()}
          </strong>
        </div>

        <button
          className="small-button"
          onClick={rest}
        >
          REST
        </button>
      </header>

      <section className="player-bar">
        <div>
          <span>PLAYER</span>
          <strong>PlayerOne</strong>
        </div>

        <div>
          <span>LEVEL</span>
          <strong>{level}</strong>
        </div>

        <div>
          <span>XP</span>
          <strong>{xpIntoLevel}/100</strong>
        </div>

        <div>
          <span>ENERGY</span>
          <strong>{save.energy}/100</strong>
        </div>

        <div>
          <span>REPUTATION</span>
          <strong>{save.reputation}</strong>
        </div>
      </section>

      <div className="game-layout">
        <nav className="nav-card">
          <p className="eyebrow">
            CITY MENU
          </p>

          {(
            [
              "city",
              "job",
              "crimes",
              "missions",
              "character",
            ] as Screen[]
          ).map(item => (
            <button
              key={item}
              className={
                screen === item
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={() => setScreen(item)}
            >
              {item === "city"
                ? "🏙️ City"
                : item === "job"
                ? "💼 Job"
                : item === "crimes"
                ? "🔪 Crimes"
                : item === "missions"
                ? "🎯 Missions"
                : "👤 Character"}
            </button>
          ))}

          <button
            className="nav-button reset-button"
            onClick={resetGame}
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
                {screen === "city"
                  ? "THE CITY"
                  : screen === "job"
                  ? "YOUR CAREER"
                  : screen === "crimes"
                  ? "CRIMES"
                  : screen.toUpperCase()}
              </h2>
            </div>

            <span className="level">
              LVL {level}
            </span>
          </div>

          {screen === "city" && (
            <>
              <div className="city-dashboard">
                <div>
                  <span>CURRENT JOB</span>
                  <strong>
                    {currentJob
                      ? currentJob.name
                      : "UNEMPLOYED"}
                  </strong>
                </div>

                <div>
                  <span>DAILY PAY</span>
                  <strong>
                    {currentJob
                      ? `$${Math.floor(
                          currentJob.salary *
                            (1 +
                              Math.max(
                                0,
                                save.jobRank - 1
                              ) *
                                0.08)
                        ).toLocaleString()}`
                      : "$0"}
                  </strong>
                </div>

                <div>
                  <span>CRIME SKILL</span>
                  <strong>
                    {totalCrimeSkill}
                  </strong>
                </div>
              </div>

              <div className="action-grid">
                <button
                  className="action-card"
                  onClick={() =>
                    setScreen("job")
                  }
                >
                  <span>💼</span>
                  <strong>
                    Work
                  </strong>
                  <small>
                    Build your career and
                    collect your daily pay.
                  </small>
                </button>

                <button
                  className="action-card"
                  onClick={() =>
                    setScreen("crimes")
                  }
                >
                  <span>🔪</span>
                  <strong>
                    Commit a Crime
                  </strong>
                  <small>
                    Risk energy for potential
                    cash and crime XP.
                  </small>
                </button>

                <button
                  className="action-card"
                  onClick={
                    completeMission
                  }
                >
                  <span>🎯</span>
                  <strong>
                    Mission
                  </strong>
                  <small>
                    Complete structured
                    objectives for rewards.
                  </small>
                </button>

                <button
                  className="action-card"
                  onClick={rest}
                >
                  <span>🏠</span>
                  <strong>
                    Rest
                  </strong>
                  <small>
                    Restore your energy.
                  </small>
                </button>
              </div>
            </>
          )}

          {screen === "job" && (
            <>
              {!currentJob ? (
                <div className="panel">
                  <p className="job-tag">
                    UNEMPLOYED
                  </p>

                  <h3>
                    Choose your career
                  </h3>

                  <p>
                    You can only hold one job
                    at a time. Work shifts to
                    slowly improve the skill
                    associated with your career.
                  </p>

                  <div className="jobs-list">
                    {JOBS.map(job => (
                      <div
                        className={
                          level >= job.minLevel
                            ? "job-card"
                            : "job-card locked"
                        }
                        key={job.id}
                      >
                        <div className="job-main">
                          <div>
                            <p className="job-tag">
                              {level >=
                              job.minLevel
                                ? "AVAILABLE"
                                : `🔒 LEVEL ${job.minLevel}`}
                            </p>

                            <h3>
                              {job.name}
                            </h3>

                            <p>
                              {job.description}
                            </p>
                          </div>

                          <button
                            className="job-button"
                            disabled={
                              level <
                              job.minLevel
                            }
                            onClick={() =>
                              chooseJob(
                                job
                              )
                            }
                          >
                            TAKE JOB
                          </button>
                        </div>

                        <div className="job-rewards">
                          <div>
                            <span>
                              DAILY PAY
                            </span>
                            <strong>
                              $
                              {job.salary.toLocaleString()}
                            </strong>
                          </div>

                          <div>
                            <span>
                              SKILL
                            </span>
                            <strong>
                              {job.stat}
                            </strong>
                          </div>

                          <div>
                            <span>
                              REQUIRED
                            </span>
                            <strong>
                              LVL{" "}
                              {job.minLevel}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="income-summary">
                    <div>
                      <span>
                        CURRENT JOB
                      </span>

                      <strong>
                        {currentJob.name}
                      </strong>

                      <small>
                        Rank {save.jobRank} • $
                        {Math.floor(
                          currentJob.salary *
                            (1 +
                              Math.max(
                                0,
                                save.jobRank -
                                  1
                              ) *
                                0.08)
                        ).toLocaleString()}
                        /day
                      </small>
                    </div>

                    <button
                      className="collect-all-button"
                      onClick={
                        collectPaycheck
                      }
                    >
                      {paydayReady
                        ? "COLLECT PAY"
                        : formatTime(
                            nextPayday
                          )}
                    </button>
                  </div>

                  <div className="job-card owned">
                    <p className="job-tag">
                      EMPLOYED
                    </p>

                    <h3>
                      {currentJob.name}
                    </h3>

                    <p>
                      {currentJob.description}
                    </p>

                    <div className="job-rewards">
                      <div>
                        <span>
                          RANK
                        </span>
                        <strong>
                          {save.jobRank}
                        </strong>
                      </div>

                      <div>
                        <span>
                          WORK DAYS
                        </span>
                        <strong>
                          {save.workDays}
                        </strong>
                      </div>

                      <div>
                        <span>
                          SKILL
                        </span>
                        <strong>
                          {
                            save.workStats[
                              currentJob.stat
                            ]
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          ENERGY
                        </span>
                        <strong>
                          -20 / shift
                        </strong>
                      </div>
                    </div>

                    <button
                      className="upgrade-button"
                      onClick={
                        workShift
                      }
                    >
                      WORK SHIFT
                    </button>

                    <button
                      className="quit-button"
                      onClick={
                        quitJob
                      }
                    >
                      QUIT JOB
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {screen === "crimes" && (
            <>
              <div className="crime-summary">
                <div>
                  <span>
                    CRIMES COMPLETED
                  </span>
                  <strong>
                    {save.crimesCompleted}
                  </strong>
                </div>

                <div>
                  <span>
                    CRIMES FAILED
                  </span>
                  <strong>
                    {save.crimesFailed}
                  </strong>
                </div>

                <div>
                  <span>
                    TOTAL CRIME SKILL
                  </span>
                  <strong>
                    {totalCrimeSkill}
                  </strong>
                </div>
              </div>

              <div className="crime-stats-mini">
                {Object.entries(
                  save.crimeStats
                ).map(([type, value]) => (
                  <div key={type}>
                    <span>
                      {type.toUpperCase()}
                    </span>
                    <strong>
                      {value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="jobs-list">
                {CRIMES.map(crime => {
                  const stat =
                    save.crimeStats[
                      crime.type
                    ];

                  const cooldown =
                    save.crimeCooldowns[
                      crime.id
                    ] || 0;

                  const onCooldown =
                    cooldown > now;

                  const locked =
                    level <
                      crime.minLevel ||
                    stat <
                      crime.minStat;

                  return (
                    <div
                      className={
                        locked
                          ? "job-card locked"
                          : "job-card crime-card"
                      }
                      key={crime.id}
                    >
                      <div className="job-main">
                        <div>
                          <p className="job-tag">
                            {level <
                            crime.minLevel
                              ? `🔒 LEVEL ${crime.minLevel}`
                              : stat <
                                crime.minStat
                              ? `🔒 ${crime.type.toUpperCase()} ${crime.minStat}`
                              : onCooldown
                              ? "COOLDOWN"
                              : "AVAILABLE"}
                          </p>

                          <h3>
                            {crime.name}
                          </h3>

                          <p>
                            {crime.description}
                          </p>
                        </div>

                        <button
                          className="crime-button"
                          disabled={
                            locked ||
                            onCooldown
                          }
                          onClick={() =>
                            commitCrime(
                              crime
                            )
                          }
                        >
                          {onCooldown
                            ? formatTime(
                                cooldown -
                                  now
                              )
                            : "COMMIT"}
                        </button>
                      </div>

                      <div className="job-rewards">
                        <div>
                          <span>
                            SUCCESS
                          </span>
                          <strong>
                            {
                              crimeSuccessEstimate(
                                crime
                              )
                            }
                            %
                          </strong>
                        </div>

                        <div>
                          <span>
                            REWARD
                          </span>
                          <strong>
                            $
                            {crime.minReward.toLocaleString()}
                            -
                            $
                            {crime.maxReward.toLocaleString()}
                          </strong>
                        </div>

                        <div>
                          <span>
                            ENERGY
                          </span>
                          <strong>
                            -{crime.minEnergy}
                          </strong>
                        </div>

                        <div>
                          <span>
                            SKILL
                          </span>
                          <strong>
                            {crime.type}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {screen === "missions" && (
            <div className="panel">
              <p className="job-tag">
                ACTIVE MISSION
              </p>

              <h3>
                First Steps
              </h3>

              <p>
                Establish yourself in
                RiftCity. Complete the
                mission while your job and
                crime progression develop
                separately.
              </p>

              <div className="mission-objectives">
                <div>
                  ✓ Build your character
                </div>
                <div>
                  ✓ Earn money
                </div>
                <div>
                  ✓ Develop your skills
                </div>
              </div>

              <button
                className="play-button"
                onClick={
                  completeMission
                }
              >
                COMPLETE MISSION{" "}
                <span>→</span>
              </button>
            </div>
          )}

          {screen === "character" && (
            <div className="stats">
              <div className="stat">
                <span>
                  CHARACTER
                </span>
                <strong>
                  PlayerOne
                </strong>
              </div>

              <div className="stat">
                <span>
                  LEVEL
                </span>
                <strong>
                  {level}
                </strong>
              </div>

              <div className="stat">
                <span>
                  CASH
                </span>
                <strong>
                  $
                  {save.cash.toLocaleString()}
                </strong>
              </div>

              <div className="stat">
                <span>
                  XP
                </span>
                <strong>
                  {save.xp}
                </strong>
              </div>

              <div className="stat">
                <span>
                  WORK DAYS
                </span>
                <strong>
                  {save.workDays}
                </strong>
              </div>

              <div className="stat">
                <span>
                  CRIMES
                </span>
                <strong>
                  {save.crimesCompleted}
                </strong>
              </div>

              <div className="stat">
                <span>
                  CRIMES FAILED
                </span>
                <strong>
                  {save.crimesFailed}
                </strong>
              </div>

              <div className="stat">
                <span>
                  REPUTATION
                </span>
                <strong>
                  {save.reputation}
                </strong>
              </div>

              <div className="stat-wide">
                <h3>
                  WORK STATS
                </h3>

                {Object.entries(
                  save.workStats
                ).map(([stat, value]) => (
                  <div
                    className="progress-stat"
                    key={stat}
                  >
                    <span>
                      {stat.toUpperCase()}
                    </span>

                    <strong>
                      {value}/100
                    </strong>

                    <div className="progress-bar">
                      <div
                        style={{
                          width: `${value}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="stat-wide">
                <h3>
                  CRIME STATS
                </h3>

                {Object.entries(
                  save.crimeStats
                ).map(([stat, value]) => (
                  <div
                    className="progress-stat"
                    key={stat}
                  >
                    <span>
                      {stat.toUpperCase()}
                    </span>

                    <strong>
                      {value}/100
                    </strong>

                    <div className="progress-bar">
                      <div
                        style={{
                          width: `${value}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="message">
            {message}
          </div>
        </section>
      </div>
    </main>
  );
}
