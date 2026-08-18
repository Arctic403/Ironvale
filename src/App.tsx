import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  JOBS,
  EMPTY_JOB_SKILLS,
  JobSkill,
  JobSkills,
  getJob,
  getCurrentPosition,
  formatSkillName,
  meetsRequirements,
} from "./jobSystem";

type Screen =
  | "city"
  | "job"
  | "crimes"
  | "missions"
  | "character";

type CrimeType =
  | "theft"
  | "burglary"
  | "robbery"
  | "cyber";

type Crime = {
  id: string;
  name: string;
  description: string;
  type: CrimeType;
  difficulty: number;
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

  jobPosition: number;

  workDays: number;

  employmentStarted: number;

  jobPerformance: number;

  jobSkills: JobSkills;

  crimeStats: CrimeStats;

  crimesCompleted: number;

  crimesFailed: number;

  lastPayday: number;

  crimeCooldowns: Record<
    string,
    number
  >;
};

const SAVE_KEY =
  "riftcity-v3-save";

const DAY =
  24 * 60 * 60 * 1000;

const defaultSave: SaveData = {
  cash: 1000,

  xp: 0,

  energy: 100,

  reputation: 0,

  currentJob: null,

  jobPosition: 0,

  workDays: 0,

  employmentStarted: Date.now(),

  jobPerformance: 75,

  jobSkills: {
    ...EMPTY_JOB_SKILLS,
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

const CRIMES: Crime[] = [
  {
    id: "pickpocket",
    name: "Pickpocket",
    description:
      "Target an unsuspecting pedestrian. Low reward and low risk.",
    type: "theft",
    difficulty: 10,
    minStat: 0,
    minEnergy: 5,
    minReward: 30,
    maxReward: 85,
    xp: 8,
  },

  {
    id: "shoplift",
    name: "Shoplifting",
    description:
      "Steal merchandise from a small local store.",
    type: "theft",
    difficulty: 25,
    minStat: 10,
    minEnergy: 8,
    minReward: 65,
    maxReward: 180,
    xp: 12,
  },

  {
    id: "burglary",
    name: "Residential Burglary",
    description:
      "Break into a residence and search for valuables.",
    type: "burglary",
    difficulty: 45,
    minStat: 15,
    minEnergy: 12,
    minReward: 140,
    maxReward: 400,
    xp: 20,
  },

  {
    id: "store-robbery",
    name: "Store Robbery",
    description:
      "A dangerous crime with a significantly larger payout.",
    type: "robbery",
    difficulty: 70,
    minStat: 25,
    minEnergy: 18,
    minReward: 350,
    maxReward: 950,
    xp: 35,
  },

  {
    id: "cyber",
    name: "System Intrusion",
    description:
      "Attempt to compromise a poorly secured computer system.",
    type: "cyber",
    difficulty: 75,
    minStat: 25,
    minEnergy: 15,
    minReward: 500,
    maxReward: 1400,
    xp: 40,
  },

  {
    id: "major-robbery",
    name: "Major Robbery",
    description:
      "A serious operation with a major potential payout.",
    type: "robbery",
    difficulty: 110,
    minStat: 50,
    minEnergy: 25,
    minReward: 1200,
    maxReward: 3500,
    xp: 65,
  },
];

function loadSave(): SaveData {
  try {
    const raw =
      localStorage.getItem(
        SAVE_KEY
      );

    if (!raw) {
      return {
        ...defaultSave,
        jobSkills: {
          ...EMPTY_JOB_SKILLS,
        },
      };
    }

    const parsed =
      JSON.parse(raw);

    return {
      ...defaultSave,
      ...parsed,

      jobSkills: {
        ...EMPTY_JOB_SKILLS,
        ...(parsed.jobSkills || {}),
      },

      crimeStats: {
        ...defaultSave.crimeStats,
        ...(parsed.crimeStats || {}),
      },
    };
  } catch {
    return {
      ...defaultSave,
      jobSkills: {
        ...EMPTY_JOB_SKILLS,
      },
    };
  }
}

function randomBetween(
  min: number,
  max: number
) {
  return Math.floor(
    Math.random() *
      (max - min + 1)
  ) + min;
}

function formatTime(
  milliseconds: number
) {
  const seconds = Math.max(
    0,
    Math.ceil(
      milliseconds / 1000
    )
  );

  const hours =
    Math.floor(
      seconds / 3600
    );

  const minutes =
    Math.floor(
      (seconds % 3600) / 60
    );

  const secs =
    seconds % 60;

  return `${hours}h ${minutes}m ${secs}s`;
}

export default function App() {
  const [entered, setEntered] =
    useState(false);

  const [screen, setScreen] =
    useState<Screen>("city");

  const [save, setSave] =
    useState<SaveData>(
      loadSave
    );

  const [message, setMessage] =
    useState(
      "Welcome to RiftCity. Build your life. Take your chances."
    );

  const [now, setNow] =
    useState(Date.now());

  useEffect(() => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(save)
    );
  }, [save]);

  useEffect(() => {
    const timer =
      setInterval(
        () =>
          setNow(
            Date.now()
          ),
        1000
      );

    return () =>
      clearInterval(timer);
  }, []);

  const level =
    Math.floor(
      save.xp / 100
    ) + 1;

  const xpIntoLevel =
    save.xp % 100;

  const currentJob =
    getJob(
      save.currentJob
    );

  const currentPosition =
    getCurrentPosition(
      currentJob,
      save.jobPosition
    );

  const nextPosition =
    currentJob &&
    save.jobPosition <
      currentJob.positions
        .length - 1
      ? currentJob.positions[
          save.jobPosition + 1
        ]
      : undefined;

  const paydayReady =
    now -
      save.lastPayday >=
    DAY;

  const paydayRemaining =
    Math.max(
      0,
      DAY -
        (now -
          save.lastPayday)
    );

  const totalCrimeSkill =
    Object.values(
      save.crimeStats
    ).reduce(
      (a, b) => a + b,
      0
    );

  const loyaltyDays =
    currentJob
      ? Math.floor(
          (now -
            save.employmentStarted) /
            DAY
        )
      : 0;

  const totalJobSkill =
    currentJob
      ? currentJob.skills.reduce(
          (total, skill) =>
            total +
            save.jobSkills[
              skill
            ],
          0
        )
      : 0;

  const nextPromotionReady =
    !!nextPosition &&
    meetsRequirements(
      save.jobSkills,
      nextPosition.requirements
    );

  const chooseJob = (
    jobId: string
  ) => {
    const job =
      getJob(jobId);

    if (!job) return;

    if (
      save.currentJob ===
      job.id
    ) {
      setMessage(
        "You're already employed here."
      );

      return;
    }

    setSave(
      current => ({
        ...current,

        currentJob:
          job.id,

        jobPosition: 0,

        employmentStarted:
          Date.now(),

        jobPerformance: 75,
      })
    );

    setMessage(
      `You joined ${job.company} as a ${job.positions[0].title}.`
    );
  };

  const workShift = () => {
    if (
      !currentJob ||
      !currentPosition
    ) {
      setScreen("job");

      setMessage(
        "You need a job before you can work."
      );

      return;
    }

    if (
      save.energy < 20
    ) {
      setMessage(
        "You're too exhausted to work. Rest first."
      );

      return;
    }

    const primary =
      currentJob.primarySkill;

    const secondary =
      currentJob.skills.filter(
        skill =>
          skill !== primary
      );

    const primaryGain =
      Math.random() <
      0.85
        ? 1
        : 0;

    const secondaryGain =
      Math.random() <
      0.25
        ? 1
        : 0;

    setSave(
      current => ({
        ...current,

        energy:
          current.energy -
          20,

        xp:
          current.xp + 5,

        workDays:
          current.workDays + 1,

        jobPerformance:
          Math.min(
            100,
            current.jobPerformance +
              1
          ),

        jobSkills: {
          ...current.jobSkills,

          [primary]:
            Math.min(
              100,
              current.jobSkills[
                primary
              ] +
                primaryGain
            ),

          [secondary[0]]:
            Math.min(
              100,
              current.jobSkills[
                secondary[0]
              ] +
                secondaryGain
            ),
        },
      })
    );

    setMessage(
      `Shift completed. ${formatSkillName(primary)} is improving.`
    );
  };

  const promote = () => {
    if (
      !currentJob ||
      !nextPosition
    ) {
      setMessage(
        "There are no further promotions available."
      );

      return;
    }

    if (
      !meetsRequirements(
        save.jobSkills,
        nextPosition.requirements
      )
    ) {
      setMessage(
        "You haven't developed the required skills yet."
      );

      return;
    }

    setSave(
      current => ({
        ...current,

        jobPosition:
          current.jobPosition +
          1,

        jobPerformance:
          Math.min(
            100,
            current.jobPerformance +
              5
          ),
      })
    );

    setMessage(
      `PROMOTED — You are now ${nextPosition.title}.`
    );
  };

  const collectPaycheck =
    () => {
      if (
        !currentJob ||
        !currentPosition
      ) {
        setMessage(
          "You don't currently have a job."
        );

        return;
      }

      if (!paydayReady) {
        setMessage(
          `Your paycheck arrives in ${formatTime(
            paydayRemaining
          )}.`
        );

        return;
      }

      const performanceMultiplier =
        0.9 +
        save.jobPerformance /
          1000;

      const loyaltyBonus =
        Math.min(
          0.10,
          loyaltyDays *
            0.001
        );

      const salary =
        Math.floor(
          currentPosition.salary *
            performanceMultiplier *
            (1 +
              loyaltyBonus)
        );

      setSave(
        current => ({
          ...current,

          cash:
            current.cash +
            salary,

          xp:
            current.xp + 10,

          lastPayday:
            Date.now(),

          jobPerformance:
            Math.max(
              60,
              current.jobPerformance -
                2
            ),
        })
      );

      setMessage(
        `PAYDAY — $${salary.toLocaleString()} deposited.`
      );
    };

  const quitJob = () => {
    if (!currentJob) return;

    setSave(
      current => ({
        ...current,

        currentJob: null,

        jobPosition: 0,

        employmentStarted:
          Date.now(),

        jobPerformance: 75,
      })
    );

    setMessage(
      `You left ${currentJob.company}. Your skills remain with you.`
    );
  };

  const commitCrime = (
    crime: Crime
  ) => {
    const stat =
      save.crimeStats[
        crime.type
      ];

    if (
      stat <
      crime.minStat
    ) {
      setMessage(
        `${crime.name} requires ${crime.minStat} ${crime.type} skill.`
      );

      return;
    }

    if (
      save.energy <
      crime.minEnergy
    ) {
      setMessage(
        `You need ${crime.minEnergy} energy.`
      );

      return;
    }

    const cooldown =
      save.crimeCooldowns[
        crime.id
      ] || 0;

    if (
      cooldown > now
    ) {
      setMessage(
        `${crime.name} is cooling down for ${formatTime(
          cooldown - now
        )}.`
      );

      return;
    }

    const jobBonus =
      currentJob?.skills.includes(
        "cybersecurity"
      ) &&
      crime.type ===
        "cyber"
        ? 3
        : currentJob?.skills.includes(
              "awareness"
            ) &&
            crime.type !==
              "cyber"
          ? 1
          : 0;

    const successChance =
      Math.max(
        12,
        Math.min(
          92,
          55 +
            stat * 0.45 +
            level * 0.5 +
            jobBonus -
            crime.difficulty
        )
      );

    const success =
      Math.random() * 100 <=
      successChance;

    const cooldownLength =
      crime.type ===
      "robbery"
        ? 45 *
          60 *
          1000
        : 20 *
          60 *
          1000;

    if (success) {
      const reward =
        randomBetween(
          crime.minReward,
          crime.maxReward
        );

      setSave(
        current => ({
          ...current,

          cash:
            current.cash +
            reward,

          xp:
            current.xp +
            crime.xp,

          energy:
            current.energy -
            crime.minEnergy,

          reputation:
            current.reputation +
            1,

          crimesCompleted:
            current.crimesCompleted +
            1,

          crimeCooldowns: {
            ...current.crimeCooldowns,

            [crime.id]:
              now +
              cooldownLength,
          },

          crimeStats: {
            ...current.crimeStats,

            [crime.type]:
              Math.min(
                100,
                current.crimeStats[
                  crime.type
                ] +
                  (Math.random() <
                  0.65
                    ? 1
                    : 0)
              ),
          },
        })
      );

      setMessage(
        `SUCCESS — $${reward.toLocaleString()} earned.`
      );
    } else {
      setSave(
        current => ({
          ...current,

          xp:
            current.xp +
            Math.floor(
              crime.xp / 3
            ),

          energy:
            current.energy -
            crime.minEnergy,

          crimesFailed:
            current.crimesFailed +
            1,

          crimeCooldowns: {
            ...current.crimeCooldowns,

            [crime.id]:
              now +
              cooldownLength,
          },

          crimeStats: {
            ...current.crimeStats,

            [crime.type]:
              Math.min(
                100,
                current.crimeStats[
                  crime.type
                ] +
                  (Math.random() <
                  0.35
                    ? 1
                    : 0)
              ),
          },
        })
      );

      setMessage(
        `FAILED — The ${crime.name} went wrong.`
      );
    }
  };

  const crimeSuccessEstimate =
    (crime: Crime) => {
      const stat =
        save.crimeStats[
          crime.type
        ];

      return Math.max(
        12,
        Math.min(
          92,
          Math.round(
            55 +
              stat * 0.45 +
              level * 0.5 -
              crime.difficulty
          )
        )
      );
    };

  const rest = () => {
    if (
      save.energy >= 100
    ) {
      setMessage(
        "You already have full energy."
      );

      return;
    }

    setSave(
      current => ({
        ...current,
        energy: 100,
      })
    );

    setMessage(
      "Energy restored."
    );
  };

  const completeMission =
    () => {
      if (
        save.energy < 30
      ) {
        setMessage(
          "You need at least 30 energy."
        );

        return;
      }

      setSave(
        current => ({
          ...current,

          cash:
            current.cash +
            250,

          xp:
            current.xp + 30,

          energy:
            current.energy -
            30,

          reputation:
            current.reputation +
            3,
        })
      );

      setMessage(
        "Mission complete. +$250 and +30 XP."
      );
    };

  const resetGame = () => {
    if (
      !confirm(
        "Reset your RiftCity progress?"
      )
    ) {
      return;
    }

    const fresh = {
      ...defaultSave,

      lastPayday:
        Date.now(),

      employmentStarted:
        Date.now(),

      jobSkills: {
        ...EMPTY_JOB_SKILLS,
      },
    };

    localStorage.removeItem(
      SAVE_KEY
    );

    setSave(fresh);

    setMessage(
      "RiftCity progress reset."
    );
  };

  if (!entered) {
    return (
      <main className="app landing">
        <header className="topbar">
          <div className="logo">
            <span className="logo-mark">
              R
            </span>

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
              <span>
                YOUR RULES.
              </span>
            </h1>

            <p className="intro">
              Work. Build your skills.
              Take risks. Make your
              place in RiftCity.
            </p>

            <button
              className="play-button"
              onClick={() =>
                setEntered(true)
              }
            >
              ENTER RIFTCITY
              <span>→</span>
            </button>
          </div>

          <div className="city-card">
            <div className="city-glow" />

            <div className="city-info">
              <span>
                CITY STATUS
              </span>

              <strong>
                AWAITING PLAYER
              </strong>
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
          <span className="logo-mark">
            R
          </span>

          <span>
            RIFT<span>CITY</span>
          </span>
        </div>

        <div className="wallet">
          <span>CASH</span>

          <strong>
            $
            {save.cash.toLocaleString()}
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
          <strong>
            PlayerOne
          </strong>
        </div>

        <div>
          <span>LEVEL</span>
          <strong>
            {level}
          </strong>
        </div>

        <div>
          <span>XP</span>
          <strong>
            {xpIntoLevel}/100
          </strong>
        </div>

        <div>
          <span>ENERGY</span>
          <strong>
            {save.energy}/100
          </strong>
        </div>

        <div>
          <span>REPUTATION</span>
          <strong>
            {save.reputation}
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
              onClick={() =>
                setScreen(item)
              }
            >
              {item ===
              "city"
                ? "🏙️ City"
                : item === "job"
                ? "💼 Job"
                : item === "crimes"
                ? "🔪 Crimes"
                : item ===
                  "missions"
                ? "🎯 Missions"
                : "👤 Character"}
            </button>
          ))}

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
                  : screen ===
                    "job"
                  ? "YOUR CAREER"
                  : screen ===
                    "crimes"
                  ? "CRIMES"
                  : screen.toUpperCase()}
              </h2>
            </div>

            <span className="level">
              LVL {level}
            </span>
          </div>

          {screen ===
            "city" && (
            <>
              <div className="city-dashboard">
                <div>
                  <span>
                    CURRENT JOB
                  </span>

                  <strong>
                    {currentJob
                      ? currentPosition?.title
                      : "UNEMPLOYED"}
                  </strong>
                </div>

                <div>
                  <span>
                    DAILY PAY
                  </span>

                  <strong>
                    {currentPosition
                      ? `$${currentPosition.salary}`
                      : "$0"}
                  </strong>
                </div>

                <div>
                  <span>
                    JOB SKILL
                  </span>

                  <strong>
                    {totalJobSkill}
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
                  <span>
                    💼
                  </span>

                  <strong>
                    Work
                  </strong>

                  <small>
                    Build your career,
                    skills and
                    promotions.
                  </small>
                </button>

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
                    Risk energy for
                    potential cash
                    and crime XP.
                  </small>
                </button>

                <button
                  className="action-card"
                  onClick={
                    completeMission
                  }
                >
                  <span>
                    🎯
                  </span>

                  <strong>
                    Mission
                  </strong>

                  <small>
                    Complete structured
                    objectives.
                  </small>
                </button>

                <button
                  className="action-card"
                  onClick={rest}
                >
                  <span>
                    🏠
                  </span>

                  <strong>
                    Rest
                  </strong>

                  <small>
                    Restore your
                    energy.
                  </small>
                </button>
              </div>
            </>
          )}

          {screen ===
            "job" && (
            <>
              {!currentJob ? (
                <div className="panel">
                  <p className="job-tag">
                    UNEMPLOYED
                  </p>

                  <h3>
                    Choose your
                    career
                  </h3>

                  <p>
                    Jobs are never
                    level locked.
                    Your skills are
                    what determine
                    how far you can
                    climb.
                  </p>

                  <div className="jobs-list">
                    {JOBS.map(
                      job => (
                        <div
                          className="job-card"
                          key={job.id}
                        >
                          <div className="job-main">
                            <div>
                              <p className="job-tag">
                                {job.company}
                              </p>

                              <h3>
                                {job.title}
                              </h3>

                              <p>
                                {
                                  job.description
                                }
                              </p>
                            </div>

                            <button
                              className="job-button"
                              onClick={() =>
                                chooseJob(
                                  job.id
                                )
                              }
                            >
                              APPLY
                            </button>
                          </div>

                          <div className="job-rewards">
                            <div>
                              <span>
                                SKILLS
                              </span>

                              <strong>
                                {job.skills
                                  .map(
                                    formatSkillName
                                  )
                                  .join(
                                    " • "
                                  )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                START PAY
                              </span>

                              <strong>
                                $
                                {
                                  job
                                    .positions[0]
                                    .salary
                                }
                                /day
                              </strong>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="income-summary">
                    <div>
                      <span>
                        CURRENT EMPLOYMENT
                      </span>

                      <strong>
                        {
                          currentPosition?.title
                        }
                      </strong>

                      <small>
                        {
                          currentJob.company
                        }{" "}
                        • $
                        {
                          currentPosition?.salary
                        }
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
                            paydayRemaining
                          )}
                    </button>
                  </div>

                  <div className="job-card owned">
                    <p className="job-tag">
                      {
                        currentJob.company
                      }
                    </p>

                    <h3>
                      {
                        currentPosition?.title
                      }
                    </h3>

                    <p>
                      {
                        currentPosition?.description
                      }
                    </p>

                    <div className="job-rewards">
                      <div>
                        <span>
                          POSITION
                        </span>

                        <strong>
                          {save.jobPosition +
                            1}
                          /
                          {
                            currentJob
                              .positions
                              .length
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          LOYALTY
                        </span>

                        <strong>
                          {loyaltyDays} days
                        </strong>
                      </div>

                      <div>
                        <span>
                          PERFORMANCE
                        </span>

                        <strong>
                          {
                            save.jobPerformance
                          }%
                        </strong>
                      </div>

                      <div>
                        <span>
                          SHIFTS
                        </span>

                        <strong>
                          {
                            save.workDays
                          }
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

                    {nextPosition && (
                      <div className="panel" style={{ marginTop: 14 }}>
                        <p className="job-tag">
                          NEXT PROMOTION
                        </p>

                        <h3>
                          {
                            nextPosition.title
                          }
                        </h3>

                        <p>
                          Requires:
                        </p>

                        {Object.entries(
                          nextPosition.requirements
                        ).map(
                          ([
                            skill,
                            required,
                          ]) => (
                            <div
                              className="progress-stat"
                              key={skill}
                            >
                              <span>
                                {formatSkillName(
                                  skill as JobSkill
                                )}
                              </span>

                              <strong>
                                {
                                  save
                                    .jobSkills[
                                      skill as JobSkill
                                    ]
                                }
                                /
                                {
                                  required
                                }
                              </strong>

                              <div className="progress-bar">
                                <div
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (save
                                        .jobSkills[
                                          skill as JobSkill
                                        ] /
                                        (required ||
                                          1)) *
                                        100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )
                        )}

                        <button
                          className="upgrade-button"
                          disabled={
                            !nextPromotionReady
                          }
                          onClick={
                            promote
                          }
                          style={{
                            marginTop: 14,
                          }}
                        >
                          {nextPromotionReady
                            ? "CLAIM PROMOTION"
                            : "KEEP WORKING"}
                        </button>
                      </div>
                    )}

                    <div className="panel" style={{ marginTop: 14 }}>
                      <p className="job-tag">
                        CAREER SKILLS
                      </p>

                      {currentJob.skills.map(
                        skill => (
                          <div
                            className="progress-stat"
                            key={skill}
                          >
                            <span>
                              {formatSkillName(
                                skill
                              )}
                            </span>

                            <strong>
                              {
                                save
                                  .jobSkills[
                                    skill
                                  ]
                              }
                              /100
                            </strong>

                            <div className="progress-bar">
                              <div
                                style={{
                                  width: `${
                                    save
                                      .jobSkills[
                                        skill
                                      ]
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <div className="panel" style={{ marginTop: 14 }}>
                      <p className="job-tag">
                        POSITION PERKS
                      </p>

                      {currentPosition?.perks.map(
                        perk => (
                          <div
                            key={
                              perk.name
                            }
                            style={{
                              padding:
                                "9px 0",
                              borderBottom:
                                "1px solid rgba(255,255,255,.05)",
                            }}
                          >
                            <strong>
                              {perk.name}
                            </strong>

                            <p
                              style={{
                                margin:
                                  "4px 0 0",
                              }}
                            >
                              {
                                perk.description
                              }
                            </p>
                          </div>
                        )
                      )}
                    </div>

                    <button
                      className="quit-button"
                      onClick={
                        quitJob
                      }
                    >
                      LEAVE COMPANY
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {screen ===
            "crimes" && (
            <>
              <div className="crime-summary">
                <div>
                  <span>
                    COMPLETED
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
                    CRIME SKILL
                  </span>

                  <strong>
                    {totalCrimeSkill}
                  </strong>
                </div>
              </div>

              <div className="crime-stats-mini">
                {Object.entries(
                  save.crimeStats
                ).map(
                  ([
                    type,
                    value,
                  ]) => (
                    <div
                      key={type}
                    >
                      <span>
                        {type.toUpperCase()}
                      </span>

                      <strong>
                        {value}
                      </strong>
                    </div>
                  )
                )}
              </div>

              <div className="jobs-list">
                {CRIMES.map(
                  crime => {
                    const stat =
                      save
                        .crimeStats[
                        crime.type
                      ];

                    const cooldown =
                      save
                        .crimeCooldowns[
                        crime.id
                      ] || 0;

                    const locked =
                      stat <
                      crime.minStat;

                    const onCooldown =
                      cooldown >
                      now;

                    return (
                      <div
                        className={
                          locked
                            ? "job-card locked"
                            : "job-card crime-card"
                        }
                        key={
                          crime.id
                        }
                      >
                        <div className="job-main">
                          <div>
                            <p className="job-tag">
                              {locked
                                ? `🔒 ${crime.type.toUpperCase()} ${crime.minStat}`
                                : onCooldown
                                ? "COOLDOWN"
                                : "AVAILABLE"}
                            </p>

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
                              {
                                crime.minReward
                              }
                              -
                              $
                              {
                                crime.maxReward
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              ENERGY
                            </span>

                            <strong>
                              -
                              {
                                crime.minEnergy
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              SKILL
                            </span>

                            <strong>
                              {
                                crime.type
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
          )}

          {screen ===
            "missions" && (
            <div className="panel">
              <p className="job-tag">
                ACTIVE MISSION
              </p>

              <h3>
                First Steps
              </h3>

              <p>
                Establish yourself in
                RiftCity. Build your
                career, develop your
                skills and make your
                first money.
              </p>

              <div className="mission-objectives">
                <div>
                  ✓ Find a career
                </div>

                <div>
                  ✓ Work a shift
                </div>

                <div>
                  ✓ Develop a skill
                </div>

                <div>
                  ✓ Take your first risk
                </div>
              </div>

              <button
                className="play-button"
                onClick={
                  completeMission
                }
              >
                COMPLETE MISSION
                <span>
                  →
                </span>
              </button>
            </div>
          )}

          {screen ===
            "character" && (
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
                  REPUTATION
                </span>

                <strong>
                  {save.reputation}
                </strong>
              </div>

              <div className="stat-wide">
                <h3>
                  CAREER SKILLS
                </h3>

                {currentJob ? (
                  currentJob.skills.map(
                    skill => (
                      <div
                        className="progress-stat"
                        key={skill}
                      >
                        <span>
                          {formatSkillName(
                            skill
                          )}
                        </span>

                        <strong>
                          {
                            save
                              .jobSkills[
                                skill
                              ]
                          }
                          /100
                        </strong>

                        <div className="progress-bar">
                          <div
                            style={{
                              width: `${
                                save
                                  .jobSkills[
                                    skill
                                  ]
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <p>
                    Find a job to begin
                    developing career
                    skills.
                  </p>
                )}
              </div>

              <div className="stat-wide">
                <h3>
                  CRIME STATS
                </h3>

                {Object.entries(
                  save.crimeStats
                ).map(
                  ([
                    stat,
                    value,
                  ]) => (
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
                  )
                )}
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
