import React, { useState } from 'react';

type Screen = 'city' | 'jobs' | 'missions' | 'character';

type Job = {
  id: string;
  name: string;
  description: string;
  payout: number;
  xp: number;
  energy: number;
  reputation: number;
  minLevel: number;
};

const JOBS: Job[] = [
  {
    id: 'delivery',
    name: 'Street Delivery',
    description: 'Make quick deliveries around the neighborhood.',
    payout: 250,
    xp: 20,
    energy: 15,
    reputation: 2,
    minLevel: 1,
  },
  {
    id: 'construction',
    name: 'Construction Crew',
    description: 'Hard work, better money. Put in a shift downtown.',
    payout: 500,
    xp: 40,
    energy: 25,
    reputation: 4,
    minLevel: 2,
  },
  {
    id: 'security',
    name: 'Private Security',
    description: 'Protect a local business from trouble.',
    payout: 850,
    xp: 65,
    energy: 35,
    reputation: 7,
    minLevel: 4,
  },
  {
    id: 'courier',
    name: 'Night Courier',
    description: 'High-risk deliveries after dark. Big rewards.',
    payout: 1400,
    xp: 100,
    energy: 45,
    reputation: 12,
    minLevel: 7,
  },
];

export default function App() {
  const [entered, setEntered] = useState(false);
  const [screen, setScreen] = useState<Screen>('city');

  const [cash, setCash] = useState(5000);
  const [xp, setXp] = useState(0);
  const [energy, setEnergy] = useState(100);
  const [reputation, setReputation] = useState(0);

  const [message, setMessage] = useState(
    'Welcome to RiftCity. Your story starts now.'
  );

  const level = Math.floor(xp / 100) + 1;
  const xpIntoLevel = xp % 100;

  const doJob = (job: Job) => {
    if (level < job.minLevel) {
      setMessage(
        `${job.name} is locked. Reach level ${job.minLevel} to unlock it.`
      );
      return;
    }

    if (energy < job.energy) {
      setMessage(
        `You need ${job.energy} energy for this job. Rest before working again.`
      );
      return;
    }

    const oldLevel = level;

    setCash(value => value + job.payout);
    setXp(value => value + job.xp);
    setEnergy(value => value - job.energy);
    setReputation(value => value + job.reputation);

    const newLevel = Math.floor((xp + job.xp) / 100) + 1;

    if (newLevel > oldLevel) {
      setMessage(
        `LEVEL UP! You reached Level ${newLevel}. ${job.name} paid $${job.payout.toLocaleString()}.`
      );
    } else {
      setMessage(
        `${job.name} completed. +$${job.payout.toLocaleString()} cash, +${job.xp} XP, +${job.reputation} reputation.`
      );
    }
  };

  const completeMission = () => {
    if (energy < 30) {
      setMessage('You need at least 30 energy to complete this mission.');
      return;
    }

    setCash(value => value + 750);
    setXp(value => value + 60);
    setEnergy(value => value - 30);
    setReputation(value => value + 10);

    setMessage(
      'Mission complete. +$750 cash, +60 XP and +10 reputation.'
    );
  };

  const rest = () => {
    if (energy === 100) {
      setMessage('You already have full energy.');
      return;
    }

    setEnergy(100);
    setMessage('You rested at your apartment. Energy restored to 100.');
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
              Build your character. Make money. Build your reputation.
              Take over RiftCity one move at a time.
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
          <strong>${cash.toLocaleString()}</strong>
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
          <strong>{energy}/100</strong>
        </div>

        <div>
          <span>REPUTATION</span>
          <strong>{reputation}</strong>
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
                  ? '💼 Jobs'
                  : item === 'missions'
                  ? '🎯 Missions'
                  : '👤 Character'}
              </button>
            )
          )}
        </nav>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RIFTCITY</p>

              <h2>
                {screen === 'city'
                  ? 'THE CITY'
                  : screen.toUpperCase()}
              </h2>
            </div>

            <span className="level">LVL {level}</span>
          </div>

          {screen === 'city' && (
            <div className="action-grid">
              <button
                className="action-card"
                onClick={() => setScreen('jobs')}
              >
                <span>💼</span>
                <strong>Find Work</strong>
                <small>Earn cash, XP and reputation</small>
              </button>

              <button
                className="action-card"
                onClick={() => setScreen('missions')}
              >
                <span>🎯</span>
                <strong>Take a Mission</strong>
                <small>Higher risk, higher reward</small>
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
          )}

          {screen === 'jobs' && (
            <div className="jobs-list">
              {JOBS.map(job => {
                const locked = level < job.minLevel;

                return (
                  <div
                    className={
                      locked
                        ? 'job-card locked'
                        : 'job-card'
                    }
                    key={job.id}
                  >
                    <div className="job-main">
                      <div>
                        <p className="job-tag">
                          {locked
                            ? `🔒 LEVEL ${job.minLevel}`
                            : 'AVAILABLE'}
                        </p>

                        <h3>{job.name}</h3>

                        <p>{job.description}</p>
                      </div>

                      <button
                        className="job-button"
                        disabled={locked}
                        onClick={() => doJob(job)}
                      >
                        {locked ? 'LOCKED' : 'WORK'}
                      </button>
                    </div>

                    <div className="job-rewards">
                      <div>
                        <span>PAY</span>
                        <strong>
                          ${job.payout.toLocaleString()}
                        </strong>
                      </div>

                      <div>
                        <span>XP</span>
                        <strong>+{job.xp}</strong>
                      </div>

                      <div>
                        <span>ENERGY</span>
                        <strong>-{job.energy}</strong>
                      </div>

                      <div>
                        <span>REP</span>
                        <strong>+{job.reputation}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {screen === 'missions' && (
            <div className="panel">
              <p className="job-tag">MISSION AVAILABLE</p>

              <h3>First Steps</h3>

              <p>
                Make your first real move in RiftCity. Complete
                the job and prove you can survive in the city.
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
                <strong>${cash.toLocaleString()}</strong>
              </div>

              <div className="stat">
                <span>TOTAL XP</span>
                <strong>{xp}</strong>
              </div>

              <div className="stat">
                <span>ENERGY</span>
                <strong>{energy}/100</strong>
              </div>

              <div className="stat">
                <span>REPUTATION</span>
                <strong>{reputation}</strong>
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
