import React, { useState } from 'react';

type Screen = 'city' | 'jobs' | 'missions' | 'character';

export default function App() {
  const [entered, setEntered] = useState(false);
  const [screen, setScreen] = useState<Screen>('city');
  const [cash, setCash] = useState(5000);
  const [xp, setXp] = useState(0);
  const [energy, setEnergy] = useState(100);
  const [message, setMessage] = useState('Welcome to RiftCity.');

  const doJob = () => {
    if (energy < 20) {
      setMessage('You are too tired. Rest before working again.');
      return;
    }
    setCash(value => value + 350);
    setXp(value => value + 25);
    setEnergy(value => value - 20);
    setMessage('You completed a street job and earned $350.');
  };

  const mission = () => {
    if (energy < 30) {
      setMessage('You need at least 30 energy for this mission.');
      return;
    }
    setCash(value => value + 750);
    setXp(value => value + 60);
    setEnergy(value => value - 30);
    setMessage('Mission complete. Reputation rising.');
  };

  const rest = () => {
    setEnergy(100);
    setMessage('You rested at your apartment. Energy restored.');
  };

  if (!entered) {
    return (
      <main className="app landing">
        <header className="topbar">
          <div className="logo">
            <span className="logo-mark">R</span>
            <span>RIFT<span>CITY</span></span>
          </div>
          <div className="status"><span className="status-dot" /> V1 ONLINE</div>
        </header>

        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">WELCOME TO THE RIFT</p>
            <h1>YOUR CITY.<br /><span>YOUR RULES.</span></h1>
            <p className="intro">
              Build your character. Make money. Build your reputation.
              Take over RiftCity one move at a time.
            </p>
            <button className="play-button" onClick={() => setEntered(true)}>
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
          <span>RIFT<span>CITY</span></span>
        </div>

        <div className="wallet">
          <span>CASH</span>
          <strong>${cash.toLocaleString()}</strong>
        </div>

        <button className="small-button" onClick={rest}>REST</button>
      </header>

      <section className="player-bar">
        <div><span>PLAYER</span><strong>PlayerOne</strong></div>
        <div><span>LEVEL</span><strong>{Math.floor(xp / 100) + 1}</strong></div>
        <div><span>XP</span><strong>{xp}/100</strong></div>
        <div><span>ENERGY</span><strong>{energy}/100</strong></div>
      </section>

      <div className="game-layout">
        <nav className="nav-card">
          <p className="eyebrow">CITY MENU</p>

          {(['city', 'jobs', 'missions', 'character'] as Screen[]).map(item => (
            <button
              key={item}
              className={screen === item ? 'nav-button active' : 'nav-button'}
              onClick={() => setScreen(item)}
            >
              {item === 'city' ? '🏙️ City' :
               item === 'jobs' ? '💼 Jobs' :
               item === 'missions' ? '🎯 Missions' :
               '👤 Character'}
            </button>
          ))}
        </nav>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RIFTCITY</p>
              <h2>
                {screen === 'city' ? 'THE CITY' : screen.toUpperCase()}
              </h2>
            </div>
            <span className="level">V1</span>
          </div>

          {screen === 'city' && (
            <div className="action-grid">
              <button className="action-card" onClick={() => setScreen('jobs')}>
                <span>💼</span><strong>Find Work</strong><small>Earn cash and XP</small>
              </button>

              <button className="action-card" onClick={() => setScreen('missions')}>
                <span>🎯</span><strong>Take a Mission</strong><small>Higher risk, higher reward</small>
              </button>

              <button className="action-card" onClick={rest}>
                <span>🏠</span><strong>Apartment</strong><small>Restore your energy</small>
              </button>

              <button className="action-card" onClick={() => setScreen('character')}>
                <span>👤</span><strong>Your Character</strong><small>View your progress</small>
              </button>
            </div>
          )}

          {screen === 'jobs' && (
            <div className="panel">
              <h3>Street Work</h3>
              <p>Take a quick job around the city. It costs 20 energy and pays $350 plus 25 XP.</p>
              <button className="play-button" onClick={doJob}>WORK JOB <span>→</span></button>
            </div>
          )}

          {screen === 'missions' && (
            <div className="panel">
              <h3>First Mission</h3>
              <p>Make your first move in RiftCity. Spend 30 energy to earn $750 and 60 XP.</p>
              <button className="play-button" onClick={mission}>START MISSION <span>→</span></button>
            </div>
          )}

          {screen === 'character' && (
            <div className="stats">
              <div className="stat"><span>CHARACTER</span><strong>PlayerOne</strong></div>
              <div className="stat"><span>CASH</span><strong>${cash.toLocaleString()}</strong></div>
              <div className="stat"><span>XP</span><strong>{xp}</strong></div>
              <div className="stat"><span>ENERGY</span><strong>{energy}</strong></div>
            </div>
          )}

          <div className="message">{message}</div>
        </section>
      </div>
    </main>
  );
}