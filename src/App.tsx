import React, { useEffect, useMemo, useState } from 'react';

type Screen = 'city' | 'jobs' | 'missions' | 'character';

type Job = {
  id: string;
  name: string;
  icon: string;
  description: string;
  startupCost: number;
  incomePerHour: number;
  minLevel: number;
  upgradeBase: number;
};

type OwnedJob = {
  level: number;
  startedAt: number;
  collectedAt: number;
};

const JOBS: Job[] = [
  {
    id: 'delivery',
    name: 'Delivery Rider',
    icon: '🛵',
    description: 'Make deliveries across the city. A simple way to start building passive income.',
    startupCost: 500,
    incomePerHour: 100,
    minLevel: 1,
    upgradeBase: 750,
  },
  {
    id: 'construction',
    name: 'Construction Crew',
    icon: '🔨',
    description: 'Put a crew to work on construction projects around RiftCity.',
    startupCost: 2000,
    incomePerHour: 300,
    minLevel: 2,
    upgradeBase: 2500,
  },
  {
    id: 'security',
    name: 'Private Security',
    icon: '🛡️',
    description: 'Protect businesses and high-value locations throughout the city.',
    startupCost: 7500,
    incomePerHour: 750,
    minLevel: 4,
    upgradeBase: 9000,
  },
  {
    id: 'logistics',
    name: 'Logistics Driver',
    icon: '🚚',
    description: 'Move valuable cargo throughout RiftCity for serious passive income.',
    startupCost: 20000,
    incomePerHour: 1800,
    minLevel: 7,
    upgradeBase: 25000,
  },
  {
    id: 'night',
    name: 'Night Operations',
    icon: '🌃',
    description: 'A mysterious high-profit operation that only opens to established players.',
    startupCost: 75000,
    incomePerHour: 6000,
    minLevel: 12,
    upgradeBase: 85000,
  },
];

const STORAGE_KEY = 'riftcity-v1-save';

type SaveData = {
  cash: number;
  xp: number;
  energy: number;
  reputation: number;
  ownedJobs: Record<string, OwnedJob>;
};

const defaultSave: SaveData = {
  cash: 5000,
  xp: 0,
  energy: 100,
  reputation: 0,
  ownedJobs: {},
};

function loadSave(): SaveData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return defaultSave;

    return {
      ...defaultSave,
      ...JSON.parse(saved),
    };
  } catch {
    return defaultSave;
  }
}

export default function App() {
  const [entered, setEntered] = useState(false);
  const [screen, setScreen] = useState<Screen>('city');

  const [save, setSave] = useState<SaveData>(loadSave);

  const [message, setMessage] = useState(
    'Welcome to RiftCity. Your story starts now.'
  );

  const level = Math.floor(save.xp / 100) + 1;
  const xpIntoLevel = save.xp % 100;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }, [save]);

  const calculateJobIncome = (job: Job, owned: OwnedJob) => {
    const hours =
      Math.max(0, Date.now() - owned.collectedAt) / 1000 / 60 / 60;

    const hourlyIncome =
      job.incomePerHour * owned.level;

    return Math.floor(hours * hourlyIncome);
  };

  const totalPendingIncome = useMemo(() => {
    return JOBS.reduce((total, job) => {
      const owned = save.ownedJobs[job.id];

      if (!owned) return total;

      return total + calculateJobIncome(job, owned);
    }, 0);
  }, [save]);

  const startJob = (job: Job) => {
    if (level < job.minLevel) {
      setMessage(
        `${job.name} unlocks at Level ${job.minLevel}.`
      );
      return;
    }

    if (save.ownedJobs[job.id]) {
      setMessage(`${job.name} is already active.`);
      return;
    }

    if (save.cash < job.startupCost) {
      setMessage(
        `You need $${job.startupCost.toLocaleString()} to start ${job.name}.`
      );
      return;
    }

    const now = Date.now();

    setSave(current => ({
      ...current,
      cash: current.cash - job.startupCost,
      reputation: current.reputation + 2,
      ownedJobs: {
        ...current.ownedJobs,
        [job.id]: {
          level: 1,
          startedAt: now,
          collectedAt: now,
        },
      },
    }));

    setMessage(
      `${job.name} is now active. It will begin generating passive income immediately.`
    );
  };

  const collectJob = (job: Job) => {
    const owned = save.ownedJobs[job.id];

    if (!owned) return;

    const income = calculateJobIncome(job, owned);

    if (income <= 0) {
      setMessage(`${job.name} hasn't generated any income yet.`);
      return;
    }

    const now = Date.now();

    setSave(current => ({
      ...current,
      cash: current.cash + income,
      xp: current.xp + Math.floor(income / 100),
      ownedJobs: {
        ...current.ownedJobs,
        [job.id]: {
          ...owned,
          collectedAt: now,
        },
      },
    }));

    setMessage(
      `Collected $${income.toLocaleString()} from ${job.name}.`
    );
  };

  const collectAll = () => {
    if (totalPendingIncome <= 0) {
      setMessage('Nothing to collect yet.');
      return;
    }

    const now = Date.now();

    setSave(current => ({
      ...current,
      cash: current.cash + totalPendingIncome,
      xp: current.xp + Math.floor(totalPendingIncome / 100),
      ownedJobs: Object.fromEntries(
        Object.entries(current.ownedJobs).map(([id, job]) => [
          id,
          {
            ...job,
            collectedAt: now,
          },
        ])
      ),
    }));

    setMessage(
      `Collected $${totalPendingIncome.toLocaleString()} from your businesses.`
    );
  };

  const upgradeJob = (job: Job) => {
    const owned = save.ownedJobs[job.id];

    if (!owned) return;

    const upgradeCost =
      job.upgradeBase * owned.level;

    if (save.cash < upgradeCost) {
      setMessage(
        `You need $${upgradeCost.toLocaleString()} to upgrade ${job.name}.`
      );
      return;
    }

    setSave(current => ({
      ...current,
      cash: current.cash - upgradeCost,
      ownedJobs: {
        ...current.ownedJobs,
        [job.id]: {
          ...owned,
          level: owned.level + 1,
        },
      },
    }));

    setMessage(
      `${job.name} upgraded to Level ${owned.level + 1}. Income increased.`
    );
  };

  const completeMission = () => {
    if (save.energy < 30) {
      setMessage('You need at least 30 energy to complete this mission.');
      return;
    }

    setSave(current => ({
      ...current,
      cash: current.cash + 750,
      xp: current.xp + 60,
      energy: current.energy - 30,
      reputation: current.reputation + 10,
    }));

    setMessage(
      'Mission complete. +$750 cash, +60 XP and +10 reputation.'
    );
  };

  const rest = () => {
    if (save.energy === 100) {
      setMessage('You already have full energy.');
      return;
    }

    setSave(current => ({
      ...current,
      energy: 100,
    }));

    setMessage('You rested. Energy restored to 100.');
  };

  const resetGame = () => {
    if (!confirm('Reset your RiftCity progress?')) return;

    localStorage.removeItem(STORAGE_KEY);
    setSave(defaultSave);
    setMessage('RiftCity has been reset.');
  };

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
            <span className="status-dot" /> V1 ONLINE
          </div>
        </header>

        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">WELCOME TO THE RIFT</p>

            <h1>
              YOUR CITY.
              <br />
              <span>YOUR RULES.</span>
            </h1>

            <p className="intro">
              Build your character. Build your income.
              Build your reputation. Take over RiftCity
              one move at a time.
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
          <strong>${save.cash.toLocaleString()}</strong>
        </div>

        <button className="small-button" onClick={rest}>
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
          <p className="eyebrow">CITY MENU</p>

          {(['city', 'jobs', 'missions', 'character'] as Screen[]).map(
            item => (
              <button
                key={item}
                className={
                  screen === item
                    ? 'nav-button active'
                    : 'nav-button'
                }
                onClick={() => setScreen(item)}
              >
                {item === 'city'
                  ? '🏙️ City'
                  : item === 'jobs'
                  ? '💼 Income'
                  : item === 'missions'
                  ? '🎯 Missions'
                  : '👤 Character'}
              </button>
            )
          )}

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
              <p className="eyebrow">RIFTCITY</p>

              <h2>
                {screen === 'city'
                  ? 'THE CITY'
                  : screen === 'jobs'
                  ? 'PASSIVE INCOME'
                  : screen.toUpperCase()}
              </h2>
            </div>

            <span className="level">LVL {level}</span>
          </div>

          {screen === 'city' && (
            <>
              <div className="income-summary">
                <div>
                  <span>PASSIVE INCOME WAITING</span>
                  <strong>
                    ${totalPendingIncome.toLocaleString()}
                  </strong>
                </div>

                <button
                  className="collect-all-button"
                  onClick={collectAll}
                >
                  COLLECT ALL
                </button>
              </div>

              <div className="action-grid">
                <button
                  className="action-card"
                  onClick={() => setScreen('jobs')}
                >
                  <span>💰</span>
                  <strong>Income</strong>
                  <small>
                    Build businesses that earn while you play
                  </small>
                </button>

                <button
                  className="action-card"
                  onClick={() => setScreen('missions')}
                >
                  <span>🎯</span>
                  <strong>Take a Mission</strong>
                  <small>
                    Play actively while your income grows
                  </small>
                </button>

                <button
                  className="action-card"
                  onClick={rest}
                >
                  <span>🏠</span>
                  <strong>Apartment</strong>
                  <small>Restore your energy</small>
                </button>

                <button
                  className="action-card"
                  onClick={() => setScreen('character')}
                >
                  <span>👤</span>
                  <strong>Your Character</strong>
                  <small>View your progress</small>
                </button>
              </div>
            </>
          )}

          {screen === 'jobs' && (
            <>
              <div className="income-summary">
                <div>
                  <span>READY TO COLLECT</span>
                  <strong>
                    ${totalPendingIncome.toLocaleString()}
                  </strong>
                </div>

                <button
                  className="collect-all-button"
                  onClick={collectAll}
                >
                  COLLECT ALL
                </button>
              </div>

              <div className="jobs-list">
                {JOBS.map(job => {
                  const owned = save.ownedJobs[job.id];
                  const locked = level < job.minLevel;

                  const currentIncome = owned
                    ? job.incomePerHour * owned.level
                    : job.incomePerHour;

                  const pending = owned
                    ? calculateJobIncome(job, owned)
                    : 0;

                  const upgradeCost = owned
                    ? job.upgradeBase * owned.level
                    : 0;

                  return (
                    <div
                      className={
                        locked
                          ? 'job-card locked'
                          : owned
                          ? 'job-card owned'
                          : 'job-card'
                      }
                      key={job.id}
                    >
                      <div className="job-main">
                        <div className="job-title-area">
                          <div className="job-icon">
                            {job.icon}
                          </div>

                          <div>
                            <p className="job-tag">
                              {locked
                                ? `🔒 LEVEL ${job.minLevel}`
                                : owned
                                ? `ACTIVE • LEVEL ${owned.level}`
                                : 'AVAILABLE'}
                            </p>

                            <h3>{job.name}</h3>

                            <p>{job.description}</p>
                          </div>
                        </div>

                        {!owned && !locked && (
                          <button
                            className="job-button"
                            onClick={() => startJob(job)}
                          >
                            START
                            <small>
                              ${job.startupCost.toLocaleString()}
                            </small>
                          </button>
                        )}

                        {owned && (
                          <button
                            className="job-button collect"
                            onClick={() => collectJob(job)}
                          >
                            COLLECT
                            <small>
                              ${pending.toLocaleString()}
                            </small>
                          </button>
                        )}

                        {locked && (
                          <button
                            className="job-button"
                            disabled
                          >
                            LOCKED
                          </button>
                        )}
                      </div>

                      <div className="job-rewards">
                        <div>
                          <span>INCOME</span>
                          <strong>
                            ${currentIncome.toLocaleString()}/hr
                          </strong>
                        </div>

                        <div>
                          <span>STARTUP</span>
                          <strong>
                            ${job.startupCost.toLocaleString()}
                          </strong>
                        </div>

                        <div>
                          <span>LEVEL</span>
                          <strong>
                            {owned ? owned.level : 1}
                          </strong>
                        </div>

                        <div>
                          <span>UPGRADE</span>
                          <strong>
                            {owned
                              ? `$${upgradeCost.toLocaleString()}`
                              : '—'}
                          </strong>
                        </div>
                      </div>

                      {owned && (
                        <button
                          className="upgrade-button"
                          onClick={() => upgradeJob(job)}
                        >
                          UPGRADE INCOME → ${upgradeCost.toLocaleString()}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {screen === 'missions' && (
            <div className="panel">
              <p className="job-tag">ACTIVE MISSION</p>

              <h3>First Steps</h3>

              <p>
                Make your first real move in RiftCity.
                Complete the mission while your businesses
                continue generating income in the background.
              </p>

              <div className="mission-objectives">
                <div>✓ Earn money</div>
                <div>✓ Build reputation</div>
                <div>✓ Gain experience</div>
              </div>

              <button
                className="play-button"
                onClick={completeMission}
              >
                COMPLETE MISSION <span>→</span>
              </button>
            </div>
          )}

          {screen === 'character' && (
            <div className="stats">
              <div className="stat">
                <span>CHARACTER</span>
                <strong>PlayerOne</strong>
              </div>

              <div className="stat">
                <span>LEVEL</span>
                <strong>{level}</strong>
              </div>

              <div className="stat">
                <span>CASH</span>
                <strong>${save.cash.toLocaleString()}</strong>
              </div>

              <div className="stat">
                <span>TOTAL XP</span>
                <strong>{save.xp}</strong>
              </div>

              <div className="stat">
                <span>ENERGY</span>
                <strong>{save.energy}/100</strong>
              </div>

              <div className="stat">
                <span>REPUTATION</span>
                <strong>{save.reputation}</strong>
              </div>

              <div className="stat">
                <span>PASSIVE INCOME</span>
                <strong>
                  ${JOBS.reduce((total, job) => {
                    const owned = save.ownedJobs[job.id];

                    return (
                      total +
                      (owned
                        ? job.incomePerHour * owned.level
                        : 0)
                    );
                  }, 0).toLocaleString()}
                  /hr
                </strong>
              </div>

              <div className="stat">
                <span>ACTIVE BUSINESSES</span>
                <strong>
                  {Object.keys(save.ownedJobs).length}
                </strong>
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
