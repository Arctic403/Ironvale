import React, {
  useEffect,
  useState,
} from "react";

import { useRiftCity } from "../hooks/useRiftCity";

import {
  ENERGY_REGEN_INTERVAL,
  MAX_ENERGY,
  NERVE_REGEN_INTERVAL,
  HAPPINESS_TICK,
  formatTime,
  timeLeft,
} from "../core/gameCore";

import { getProperty } from "../data/gameData";

import type {
  ActiveModal,
} from "../types/riftCity";

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

  const [
    activeModal,
    setActiveModal,
  ] = useState<ActiveModal>(null);

  const [now, setNow] =
    useState(Date.now());

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(Date.now());
        },
        1000
      );

    return () =>
      window.clearInterval(timer);
  }, []);

  const maxHappy =
    getProperty(
      g.gameState.ownedProperty
    )?.maxHappiness ?? 100;

  const energyNextTick =
    g.gameState.energy >=
    MAX_ENERGY
      ? 0
      : Math.max(
          0,
          ENERGY_REGEN_INTERVAL -
            (
              (
                now -
                g.gameState
                  .lastEnergyUpdate
              ) %
              ENERGY_REGEN_INTERVAL
            )
        );

  const nerveNextTick =
    g.gameState.nerve >=
    g.maxNerve
      ? 0
      : Math.max(
          0,
          NERVE_REGEN_INTERVAL -
            (
              (
                now -
                g.gameState
                  .lastNerveUpdate
              ) %
              NERVE_REGEN_INTERVAL
            )
        );

  const happyNextTick =
    g.gameState.happiness >=
    maxHappy
      ? 0
      : Math.max(
          0,
          HAPPINESS_TICK -
            (
              (
                now -
                g.gameState
                  .lastHappinessUpdate
              ) %
              HAPPINESS_TICK
            )
        );

  const title =
    getScreenTitle(
      g.currentScreen
    );

  return (
    <div className="layout-root">

      {/* Navigation */}
      <Navigation currentScreen={g.currentScreen} onNavigate={g.setCurrentScreen} onExplore={() => g.setCurrentScreen("city")} onReset={g.resetGame} />

      <div className="main-wrapper">

        {/* Player status */}
        <StatusBar
          g={g}
          setActiveModal={
            setActiveModal
          }
        />

        {/* Resource information */}
        <ResourceModal
          g={g}
          activeModal={
            activeModal
          }
          setActiveModal={
            setActiveModal
          }
          energyNextTick={
            energyNextTick
          }
          nerveNextTick={
            nerveNextTick
          }
          happyNextTick={
            happyNextTick
          }
          maxHappy={
            maxHappy
          }
        />

        <main className="screen-container">

          {/* Page header */}
          <div className="screen-header">

            <span className="location-tag">
              LOCATION:{" "}
              {g.gameState.currentLocation.toUpperCase()}
            </span>

            <h1>{title}</h1>

          </div>

          {/* Jail status */}
          {g.gameState.jailUntil && (
            <div className="status-alert jail">
              🔒 JAILED ·{" "}
              {formatTime(
                timeLeft(
                  g.gameState.jailUntil
                )
              )}{" "}
              remaining
            </div>
          )}

          {/* Hospital status */}
          {g.gameState.hospitalUntil && (
            <div className="status-alert hospital">
              🏥 HOSPITAL ·{" "}
              {formatTime(
                timeLeft(
                  g.gameState.hospitalUntil
                )
              )}{" "}
              remaining
            </div>
          )}

          {/* Current screen */}
          <ScreenContent g={g} />

          {/* Activity */}
          <ActivityLog g={g} />

        </main>
      </div>

      {/* Random encounters */}
      <EncounterModal g={g} />

    </div>
  );
}

export default App;
