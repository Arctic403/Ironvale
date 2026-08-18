import React from 'react';

export default function App() {
  return (
    <main className="app">
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">R</span>
          <span>RIFT<span>CITY</span></span>
        </div>
        <div className="status">
          <span className="status-dot" />
          V1 ONLINE
        </div>
      </header>

      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">WELCOME TO THE RIFT</p>
          <h1>YOUR CITY.<br /><span>YOUR RULES.</span></h1>
          <p className="intro">
            Build your character. Make money. Build your reputation.
            Take over RiftCity one move at a time.
          </p>
          <button className="play-button">
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

      <section className="dashboard">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PLAYER DASHBOARD</p>
            <h2>RIFT PROFILE</h2>
          </div>
          <span className="level">LVL 1</span>
        </div>

        <div className="stats">
          <div className="stat"><span>CHARACTER</span><strong>PlayerOne</strong></div>
          <div className="stat"><span>XP</span><strong>0</strong></div>
          <div className="stat"><span>HEALTH</span><strong>100</strong></div>
          <div className="stat"><span>ENERGY</span><strong>100</strong></div>
        </div>
      </section>

      <footer>
        <span>RIFTCITY V1</span>
        <span>THE CITY IS YOURS.</span>
      </footer>
    </main>
  );
}