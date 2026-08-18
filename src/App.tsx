import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  JOBS,
  getJob,
  getCurrentPosition,
  getNextPromotion,
  formatSkillName,
  Job,
} from "./jobSystem";

import {
  EMPTY_SKILLS,
  Skill,
  Skills,
  skillLabel,
  meetsSkillRequirements,
} from "./skills";

import {
  CRIMES,
  Crime,
  crimeUnlocked,
  crimeSuccessChance,
  formatCrimeSkills,
} from "./crimeSystem";

type Screen =
  | "city"
  | "job"
  | "crimes"
  | "missions"
  | "character";

type SaveData = {
  cash: number;

  xp: number;

  energy: number;

  reputation: number;

  skills: Skills;

  currentJob: string | null;

  jobPosition: number;

  jobPerformance: number;

  employmentStarted: number;

  lastProcessedAt: number;

  crimeCooldowns: Record<
    string,
    number
  >;

  crimesCompleted: number;

  crimesFailed: number;
};

const SAVE_KEY =
  "riftcity-unified-v1";

const DAY =
  86400000;

const HOUR =
  3600000;

function newSave(): SaveData {
  const now = Date.now();

  return {
    cash: 1000,

    xp: 0,

    energy: 100,

    reputation: 0,

    skills: {
      ...EMPTY_SKILLS,
    },

    currentJob: null,

    jobPosition: 0,

    jobPerformance: 75,

    employmentStarted: now,

    lastProcessedAt: now,

    crimeCooldowns: {},

    crimesCompleted: 0,

    crimesFailed: 0,
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

      skills: {
        ...EMPTY_SKILLS,
        ...(parsed.skills ||
          parsed.jobSkills ||
          {}),
      },

      crimeCooldowns:
        parsed.crimeCooldowns ||
        {},
    };
  } catch {
    return newSave();
  }
}

function random(
  min: number,
  max: number
) {
  return Math.floor(
    Math.random() *
      (max - min + 1)
  ) + min;
}

function formatMoney(
  value: number
) {
  return `$${Math.floor(
    value
  ).toLocaleString()}`;
}

function formatDuration(
  ms: number
) {
  const seconds = Math.max(
    0,
    Math.ceil(ms / 1000)
  );

  const hours =
    Math.floor(
      seconds / 3600
    );

  const minutes =
    Math.floor(
      (seconds % 3600) / 60
    );

  return `${hours}h ${minutes}m`;
}

function processPassiveIncome(
  data: SaveData
): SaveData {
  if (!data.currentJob) {
    return data;
  }

  const job =
    getJob(
      data.currentJob
    );

  if (!job) {
    return data;
  }

  const position =
    getCurrentPosition(
      job,
      data.jobPosition
    );

  if (!position) {
    return data;
  }

  const now =
    Date.now();

  const elapsed =
    now -
    data.lastProcessedAt;

  const days =
    Math.floor(
      elapsed / DAY
    );

  const hours =
    Math.floor(
      elapsed / HOUR
    );

  if (
    days <= 0 &&
    hours <= 0
  ) {
    return data;
  }

  const updated: SaveData = {
    ...data,

    lastProcessedAt: now,

    energy: Math.min(
      100,
      data.energy +
        hours * 4
    ),
  };

  if (days <= 0) {
    return updated;
  }

  const salary =
    position.salary *
    days;

  updated.cash += salary;

  updated.xp +=
    days * 5;

  /*
   * Primary career skill:
   * +1 per day.
   *
   * Secondary skills:
   * +0.5 per day.
   *
   * This deliberately moves
   * slowly so promotions feel
   * earned.
   */

  updated.skills = {
    ...updated.skills,
  };

  const primary =
    job.primarySkill;

  updated.skills[
    primary
  ] = Math.min(
    100,
    updated.skills[
      primary
    ] + days
  );

  for (const skill of job.secondarySkills) {
    updated.skills[
      skill
    ] = Math.min(
      100,
      updated.skills[
        skill
      ] +
        days * 0.5
    );
  }

  /*
   * Performance gently moves
   * toward 90 while employed.
   */

  updated.jobPerformance =
    Math.min(
      100,
      updated.jobPerformance +
        days
    );

  /*
   * Automatic promotions.
   */

  let positionIndex =
    updated.jobPosition;

  while (
    positionIndex <
    job.positions.length - 1
  ) {
    const next =
      job.positions[
        positionIndex + 1
      ];

    if (
      !meetsSkillRequirements(
        updated.skills,
        next.requirements
      )
    ) {
      break;
    }

    positionIndex++;
  }

  updated.jobPosition =
    positionIndex;

  return updated;
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
      "Welcome to RiftCity."
    );

  const [now, setNow] =
    useState(Date.now());

  const [
    interviewJob,
    setInterviewJob,
  ] = useState<Job | null>(
    null
  );

  const [
    interviewStep,
    setInterviewStep,
  ] = useState(0);

  const [
    interviewScore,
    setInterviewScore,
  ] = useState(0);

  useEffect(() => {
    const timer =
      setInterval(() => {
        setNow(
          Date.now()
        );
      }, 5000);

    return () =>
      clearInterval(timer);
  }, []);

  useEffect(() => {
    setSave(current => {
      const processed =
        processPassiveIncome(
          current
        );

      if (
        processed !== current
      ) {
        return processed;
      }

      return current;
    });
  }, [now]);

  useEffect(() => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(save)
    );
  }, [save]);

  const level =
    Math.floor(
      save.xp / 100
    ) + 1;

  const xp =
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
    currentJob
      ? currentJob.positions[
          save.jobPosition + 1
        ]
      : undefined;

  const loyaltyDays =
    currentJob
      ? Math.floor(
          (now -
            save.employmentStarted) /
            DAY
        )
      : 0;

  const totalSkills =
    Object.values(
      save.skills
    ).reduce(
      (sum, value) =>
        sum + value,
      0
    );

  const startInterview = (
    job: Job
  ) => {
    if (
      currentJob
    ) {
      setMessage(
        "You already have a job. Quit your current job before applying elsewhere."
      );

      return;
    }

    setInterviewJob(
      job
    );

    setInterviewStep(0);

    setInterviewScore(0);
  };

  const answerInterview = (
    answer: number
  ) => {
    if (!interviewJob) {
      return;
    }

    const question =
      interviewJob.interview[
        interviewStep
      ];

    const correct =
      answer ===
      question.correct;

    const newScore =
      interviewScore +
      (correct ? 1 : 0);

    if (
      interviewStep <
      interviewJob.interview.length -
        1
    ) {
      setInterviewScore(
        newScore
      );

      setInterviewStep(
        interviewStep + 1
      );

      return;
    }

    setInterviewJob(
      null
    );

    const percentage =
      (newScore /
        interviewJob.interview.length) *
      100;

    const accepted =
      percentage >= 50;

    if (!accepted) {
      setMessage(
        `Application denied. You scored ${newScore}/${interviewJob.interview.length}.`
      );

      return;
    }

    setSave(current => ({
      ...current,

      currentJob:
        interviewJob.id,

      jobPosition: 0,

      employmentStarted:
        Date.now(),

      lastProcessedAt:
        Date.now(),

      jobPerformance:
        percentage === 100
          ? 95
          : 80,
    }));

    setMessage(
      `HIRED — ${interviewJob.company} has accepted you as a ${interviewJob.positions[0].title}.`
    );
  };

  const quitJob = () => {
    if (!currentJob) {
      return;
    }

    setSave(current => ({
      ...current,

      currentJob: null,

      jobPosition: 0,

      jobPerformance: 75,

      employmentStarted:
        Date.now(),

      lastProcessedAt:
        Date.now(),
    }));

    setMessage(
      `You left ${currentJob.company}. Your skills remain permanently.`
    );
  };

  const commitCrime = (
    crime: Crime
  ) => {
    if (
      !crimeUnlocked(
        crime,
        save.skills
      )
    ) {
      setMessage(
        "Your current skills are not high enough for this crime."
      );

      return;
    }

    if (
      save.energy <
      crime.energy
    ) {
      setMessage(
        "You don't have enough energy."
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
        `${crime.name} is unavailable for ${formatDuration(
          cooldown - now
        )}.`
      );

      return;
    }

    const chance =
      crimeSuccessChance(
        crime,
        save.skills
      );

    const success =
      Math.random() * 100 <
      chance;

    if (success) {
      const reward =
        random(
          crime.minReward,
          crime.maxReward
        );

      setSave(current => ({
        ...current,

        cash:
          current.cash +
          reward,

        xp:
          current.xp +
          crime.xp,

        energy:
          current.energy -
          crime.energy,

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
            crime.cooldownMinutes *
              60000,
        },

        /*
         * Crimes also train the
         * same core skills.
         *
         * Slowly.
         */

        skills: {
          ...current.skills,

          [crime.skills[0]]:
            Math.min(
              100,
              current.skills[
                crime.skills[0]
              ] + 0.25
            ),
        },
      }));

      setMessage(
        `SUCCESS — ${formatMoney(
          reward
        )} earned.`
      );
    } else {
      setSave(current => ({
        ...current,

        xp:
          current.xp +
          Math.floor(
            crime.xp / 3
          ),

        energy:
          current.energy -
          crime.energy,

        crimesFailed:
          current.crimesFailed +
          1,

        crimeCooldowns: {
          ...current.crimeCooldowns,

          [crime.id]:
            now +
            crime.cooldownMinutes *
              60000,
        },

        skills: {
          ...current.skills,

          [crime.skills[0]]:
            Math.min(
              100,
              current.skills[
                crime.skills[0]
              ] + 0.1
            ),
        },
      }));

      setMessage(
        `FAILED — ${crime.name} went wrong.`
      );
    }
  };

  const rest = () => {
    setSave(current => ({
      ...current,

      energy: 100,
    }));

    setMessage(
      "Energy restored."
    );
  };

  const completeMission =
    () => {
      if (
        save.energy <
        20
      ) {
        setMessage(
          "You need at least 20 energy."
        );

        return;
      }

      setSave(current => ({
        ...current,

        cash:
          current.cash +
          200,

        xp:
          current.xp +
          25,

        energy:
          current.energy -
          20,

        reputation:
          current.reputation +
          2,
      }));

      setMessage(
        "Mission complete — $200 earned."
      );
    };

  const resetGame = () => {
    if (
      !confirm(
        "Reset RiftCity progress?"
      )
    ) {
      return;
    }

    const fresh =
      newSave();

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
          <span>
            CASH
          </span>

          <strong>
            {formatMoney(
              save.cash
            )}
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
          <span>
            PLAYER
          </span>

          <strong>
            PlayerOne
          </strong>
        </div>

        <div>
          <span>
            LEVEL
          </span>

          <strong>
            {level}
          </strong>
        </div>

        <div>
          <span>
            XP
          </span>

          <strong>
            {xp}/100
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
            /100
          </strong>
        </div>

        <div>
          <span>
            SKILL POINTS
          </span>

          <strong>
            {Math.floor(
              totalSkills
            )}
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
              {item === "city"
                ? "🏙️ City"
                : item === "job"
                ? "💼 Career"
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
                {screen === "city"
                  ? "THE CITY"
                  : screen === "job"
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

          {screen === "city" && (
            <>
              <div className="city-dashboard">
                <div>
                  <span>
                    EMPLOYMENT
                  </span>

                  <strong>
                    {currentJob
                      ? currentPosition?.title
                      : "UNEMPLOYED"}
                  </strong>
                </div>

                <div>
                  <span>
                    INCOME
                  </span>

                  <strong>
                    {currentPosition
                      ? `${formatMoney(
                          currentPosition.salary
                        )}/day`
                      : "$0/day"}
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
              </div>

              <div className="action-grid">
                <button
                  className="action-card"
                  onClick={() =>
                    setScreen(
                      "job"
                    )
                  }
                >
                  <span>
                    💼
                  </span>

                  <strong>
                    Career
                  </strong>

                  <small>
                    Apply, interview
                    and build skills
                    automatically.
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
                    Crimes
                  </strong>

                  <small>
                    Use your actual
                    skills to take
                    bigger risks.
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
                    Complete active
                    objectives.
                  </small>
                </button>

                <button
                  className="action-card"
                  onClick={() =>
                    setScreen(
                      "character"
                    )
                  }
                >
                  <span>
                    👤
                  </span>

                  <strong>
                    Character
                  </strong>

                  <small>
                    View your complete
                    skill profile.
                  </small>
                </button>
              </div>
            </>
          )}

          {screen === "job" && (
            <>
              {!currentJob ? (
                <div>
                  <div className="panel">
                    <p className="job-tag">
                      CAREER SYSTEM
                    </p>

                    <h3>
                      Choose your career
                    </h3>

                    <p>
                      Jobs are passive.
                      Apply, complete a
                      short interview,
                      then your career
                      progresses while
                      you play the rest
                      of RiftCity.
                    </p>
                  </div>

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
                                {
                                  job.company
                                }
                              </p>

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
                              onClick={() =>
                                startInterview(
                                  job
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
                                    skillLabel
                                  )
                                  .join(
                                    " • "
                                  )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                STARTING PAY
                              </span>

                              <strong>
                                {formatMoney(
                                  job.positions[0]
                                    .salary
                                )}
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
                <div>
                  <div className="income-summary">
                    <div>
                      <span>
                        CURRENT CAREER
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
                        •{" "}
                        {formatMoney(
                          currentPosition?.salary ||
                            0
                        )}
                        /day
                      </small>
                    </div>

                    <div>
                      <span>
                        STATUS
                      </span>

                      <strong>
                        PASSIVE
                      </strong>

                      <small>
                        Income and skills
                        update automatically.
                      </small>
                    </div>
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
                          DAILY INCOME
                        </span>

                        <strong>
                          {formatMoney(
                            currentPosition?.salary ||
                              0
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          PERFORMANCE
                        </span>

                        <strong>
                          {
                            Math.floor(
                              save.jobPerformance
                            )
                          }
                          %
                        </strong>
                      </div>

                      <div>
                        <span>
                          LOYALTY
                        </span>

                        <strong>
                          {loyaltyDays}d
                        </strong>
                      </div>
                    </div>

                    <div
                      className="panel"
                      style={{
                        marginTop: 15,
                      }}
                    >
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
                              {Math.floor(
                                save.skills[
                                  skill
                                ]
                              )}
                              /100
                            </strong>

                            <div className="progress-bar">
                              <div
                                style={{
                                  width: `${Math.min(
                                    100,
                                    save.skills[
                                      skill
                                    ]
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {nextPosition && (
                      <div
                        className="panel"
                        style={{
                          marginTop: 15,
                        }}
                      >
                        <p className="job-tag">
                          NEXT PROMOTION
                        </p>

                        <h3>
                          {
                            nextPosition.title
                          }
                        </h3>

                        <p>
                          Promotion happens
                          automatically when
                          the requirements
                          are reached.
                        </p>

                        {Object.entries(
                          nextPosition.requirements
                        ).map(
                          ([
                            skill,
                            required,
                          ]) => {
                            const current =
                              save.skills[
                                skill as Skill
                              ];

                            return (
                              <div
                                className="progress-stat"
                                key={
                                  skill
                                }
                              >
                                <span>
                                  {skillLabel(
                                    skill as Skill
                                  )}
                                </span>

                                <strong>
                                  {Math.floor(
                                    current
                                  )}
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
                                        (current /
                                          Number(
                                            required
                                          )) *
                                          100
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}

                    <div
                      className="panel"
                      style={{
                        marginTop: 15,
                      }}
                    >
                      <p className="job-tag">
                        CURRENT PERKS
                      </p>

                      {currentPosition?.perks.map(
                        perk => (
                          <div
                            key={
                              perk.name
                            }
                            style={{
                              padding:
                                "8px 0",
                              borderBottom:
                                "1px solid rgba(255,255,255,.05)",
                            }}
                          >
                            <strong>
                              {
                                perk.name
                              }
                            </strong>

                            <p>
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
                </div>
              )}
            </>
          )}

          {screen === "crimes" && (
            <div className="jobs-list">
              <div className="panel">
                <p className="job-tag">
                  UNIFIED SKILL SYSTEM
                </p>

                <h3>
                  Your skills determine
                  what you can do.
                </h3>

                <p>
                  Your career develops
                  skills. Crimes develop
                  skills. Missions will
                  develop skills. Everything
                  feeds the same character
                  progression system.
                </p>

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
                      TOTAL SKILL
                    </span>

                    <strong>
                      {Math.floor(
                        totalSkills
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              {CRIMES.map(
                crime => {
                  const unlocked =
                    crimeUnlocked(
                      crime,
                      save.skills
                    );

                  const cooldown =
                    save
                      .crimeCooldowns[
                      crime.id
                    ] || 0;

                  const success =
                    crimeSuccessChance(
                      crime,
                      save.skills
                    );

                  return (
                    <div
                      className={
                        unlocked
                          ? "job-card crime-card"
                          : "job-card locked"
                      }
                      key={crime.id}
                    >
                      <div className="job-main">
                        <div>
                          <p className="job-tag">
                            {unlocked
                              ? "AVAILABLE"
                              : "LOCKED"}
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
                            !unlocked ||
                            cooldown >
                              now
                          }
                          onClick={() =>
                            commitCrime(
                              crime
                            )
                          }
                        >
                          {cooldown >
                          now
                            ? formatDuration(
                                cooldown -
                                  now
                              )
                            : unlocked
                            ? "COMMIT"
                            : "LOCKED"}
                        </button>
                      </div>

                      <div className="job-rewards">
                        <div>
                          <span>
                            SKILLS
                          </span>

                          <strong>
                            {formatCrimeSkills(
                              crime
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            SUCCESS
                          </span>

                          <strong>
                            {Math.floor(
                              success
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
                            -
                            {formatMoney(
                              crime.maxReward
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            ENERGY
                          </span>

                          <strong>
                            -
                            {
                              crime.energy
                            }
                          </strong>
                        </div>
                      </div>

                      {!unlocked && (
                        <p
                          style={{
                            marginTop: 12,
                            color:
                              "#ff789f",
                          }}
                        >
                          Requirements:{" "}
                          {Object.entries(
                            crime.requirements
                          )
                            .map(
                              ([
                                skill,
                                value,
                              ]) =>
                                `${skillLabel(
                                  skill as Skill
                                )} ${value}`
                            )
                            .join(
                              " • "
                            )}
                        </p>
                      )}
                    </div>
                  );
                }
              )}
            </div>
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
                RiftCity. Find employment,
                develop your skills and
                start taking risks.
              </p>

              <button
                className="play-button"
                onClick={
                  completeMission
                }
              >
                COMPLETE MISSION
                <span>→</span>
              </button>
            </div>
          )}

          {screen === "character" && (
            <div>
              <div className="stats">
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
                    {formatMoney(
                      save.cash
                    )}
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
              </div>

              <div
                className="panel"
                style={{
                  marginTop: 15,
                }}
              >
                <p className="job-tag">
                  CORE SKILLS
                </p>

                {Object.entries(
                  save.skills
                ).map(
                  ([
                    skill,
                    value,
                  ]) => (
                    <div
                      className="progress-stat"
                      key={skill}
                    >
                      <span>
                        {skillLabel(
                          skill as Skill
                        )}
                      </span>

                      <strong>
                        {Math.floor(
                          value
                        )}
                        /100
                      </strong>

                      <div className="progress-bar">
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              value
                            )}%`,
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

      {interviewJob && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            zIndex: 50,
            display: "grid",
            placeItems:
              "center",
            padding: 20,
            background:
              "rgba(3,3,8,.78)",
            backdropFilter:
              "blur(14px)",
          }}
        >
          <div
            style={{
              width:
                "min(620px, 100%)",
              padding: 25,
              border:
                "1px solid rgba(139,92,255,.35)",
              borderRadius: 18,
              background:
                "linear-gradient(145deg, rgba(22,18,40,.98), rgba(7,7,15,.98))",
              boxShadow:
                "0 0 60px rgba(139,92,255,.22)",
            }}
          >
            <p className="eyebrow">
              JOB INTERVIEW
            </p>

            <h2
              style={{
                marginTop: 0,
              }}
            >
              {
                interviewJob.company
              }
            </h2>

            <p>
              Interview question{" "}
              {interviewStep +
                1}{" "}
              of{" "}
              {
                interviewJob
                  .interview
                  .length
              }
            </p>

            <h3>
              {
                interviewJob
                  .interview[
                  interviewStep
                ].question
              }
            </h3>

            <div
              style={{
                display:
                  "grid",
                gap: 10,
                marginTop: 20,
              }}
            >
              {interviewJob.interview[
                interviewStep
              ].answers.map(
                (
                  answer,
                  index
                ) => (
                  <button
                    key={
                      answer
                    }
                    className="nav-button"
                    style={{
                      border:
                        "1px solid rgba(139,92,255,.18)",
                      background:
                        "rgba(139,92,255,.07)",
                    }}
                    onClick={() =>
                      answerInterview(
                        index
                      )
                    }
                  >
                    {String.fromCharCode(
                      65 +
                        index
                    )}
                    . {answer}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
