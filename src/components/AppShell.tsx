import React, { useEffect, useState } from "react";

import { useRiftCity } from "../hooks/useRiftCity";

import {
  ENERGY_REGEN_INTERVAL,
  NERVE_REGEN_INTERVAL,
  HAPPINESS_TICK,
  formatTime,
  timeLeft,
} from "../core/gameCore";

import { getProperty } from "../data/gameData";

import type { ActiveModal } from "../types/riftCity";

import {
  Navigation,
  getScreenTitle,
} from "./apps/Navigation";

import { StatusBar } from "./apps/StatusBar";
import { ResourceModal } from "./apps/ResourceModal";
import { ScreenContent } from "./apps/ScreenContent";
import { ActivityLog } from "./apps/ActivityLog";
import { EncounterModal } from "./apps/EncounterModal";

function App() {
  const g = useRiftCity();

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [now, setNow] = useState(Date.now());
  const [navOpen, setNavOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setNavOpen(false);
    setActivityOpen(false);
  }, [g.currentScreen]);

  const maxHappy = getProperty(g.gameState.ownedProperty)?.maxHappiness ?? 100;
  const effectiveMaxHappy = maxHappy + (g.gameState.propertyUpgrades["bedroom"] ?? 0) * 10;

  const energyNextTick =
    g.gameState.energy >= g.maxEnergy
      ? 0
      : Math.max(
          0,
          ENERGY_REGEN_INTERVAL - ((now - g.gameState.lastEnergyUpdate) % ENERGY_REGEN_INTERVAL),
        );

  const nerveNextTick =
    g.gameState.nerve >= g.maxNerve
      ? 0
      : Math.max(
          0,
          NERVE_REGEN_INTERVAL - ((now - g.gameState.lastNerveUpdate) % NERVE_REGEN_INTERVAL),
        );

  const happyNextTick =
    g.gameState.happiness >= effectiveMaxHappy
      ? 0
      : Math.max(
          0,
          HAPPINESS_TICK - ((now - g.gameState.lastHappinessUpdate) % HAPPINESS_TICK),
        );

  const title = getScreenTitle(g.currentScreen);

  return (
    <div
      className={`layout-root ui-shell ${navOpen ? "nav-open" : ""} ${activityOpen ? "activity-open" : ""}`}
    >
      {(navOpen || activityOpen) && (
        <button
          type="button"
          className="shell-backdrop"
          aria-label="Close open panels"
          onClick={() => {
            setNavOpen(false);
            setActivityOpen(false);
          }}
        />
      )}

      <Navigation
        currentScreen={g.currentScreen}
        onNavigate={g.setCurrentScreen}
        onExplore={() => g.setCurrentScreen("city")}
        onReset={g.resetGame}
        isOpen={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="floating-ui-stack" aria-label="Interface controls">
        <button
          type="button"
          className={`floating-ui-btn ${navOpen ? "active" : ""}`}
          onClick={() => {
            setNavOpen((open) => !open);
            setActivityOpen(false);
          }}
        >
          <span>☰</span>
          <strong>Menu</strong>
        </button>

        <button
          type="button"
          className={`floating-ui-btn ${activityOpen ? "active" : ""}`}
          onClick={() => {
            setActivityOpen((open) => !open);
            setNavOpen(false);
          }}
        >
          <span>📝</span>
          <strong>Log</strong>
        </button>
      </div>

      <div className="main-wrapper">
        <StatusBar g={g} setActiveModal={setActiveModal} />

        <ResourceModal
          g={g}
          activeModal={activeModal}
          setActiveModal={setActiveModal}
          energyNextTick={energyNextTick}
          nerveNextTick={nerveNextTick}
          happyNextTick={happyNextTick}
          maxHappy={effectiveMaxHappy}
        />

        <main className="screen-container">
          <div className="screen-header shell-screen-header">
            <div>
              <span className="location-tag">{g.gameState.currentLocation.toUpperCase()}</span>
              <h1>{title}</h1>
            </div>

            <div className="header-quick-status">
              {g.gameState.jailUntil && (
                <div className="status-alert jail compact">
                  🔒 {formatTime(timeLeft(g.gameState.jailUntil))}
                </div>
              )}

              {g.gameState.hospitalUntil && (
                <div className="status-alert hospital compact">
                  🏥 {formatTime(timeLeft(g.gameState.hospitalUntil))}
                </div>
              )}
            </div>
          </div>

          <ScreenContent g={g} />
        </main>
      </div>

      <aside className={`activity-drawer ${activityOpen ? "open" : ""}`} aria-hidden={!activityOpen}>
        <div className="activity-drawer-header">
          <div>
            <span className="card-tag">RECENT</span>
            <h3>Activity</h3>
          </div>
          <button type="button" className="activity-drawer-close" onClick={() => setActivityOpen(false)}>
            ×
          </button>
        </div>
        <ActivityLog g={g} embedded />
      </aside>

      <EncounterModal g={g} />
    </div>
  );
}

export default App;
