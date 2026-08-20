import React from "react";
import type { ActiveModal } from "../../types/riftCity";
import type { useRiftCity } from "../../hooks/useRiftCity";
import { money } from "../../core/gameCore";
import { getLevel } from "../../systems/progressionSystem";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type StatusBarProps = {
  g: RiftCityGame;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function StatusBar({
  g,
  setActiveModal,
  expanded,
  onToggleExpanded,
}: StatusBarProps) {
  const levelInfo = getLevel(g.gameState.xp);

  return (
    <header className={`top-status-bar floating-status-panel ${expanded ? "expanded" : "collapsed"}`}>
      <div className="status-panel-header">
        <div className="status-primary-cluster">
          <div className="user-level compact-level">
            <span className="level-badge">LV {g.level}</span>
            <div className="status-player-meta">
              <strong>Rift Operative</strong>
              <small>{g.gameState.currentLocation.toUpperCase()}</small>
            </div>
          </div>

          <div className="status-currency-pills">
            <button type="button" className="status-chip currency" onClick={() => setActiveModal("energy")}>
              ⚡ {g.gameState.energy}/{g.maxEnergy}
            </button>
            <button type="button" className="status-chip currency" onClick={() => setActiveModal("health")}>
              ❤️ {Math.floor(g.gameState.health)}/{g.maxHealth}
            </button>
            <span className="status-chip money">💵 {money(g.gameState.cash)}</span>
            <span className="status-chip bank">🏦 {money(g.gameState.bank)}</span>
          </div>
        </div>

        <button type="button" className="floating-panel-toggle" onClick={onToggleExpanded}>
          {expanded ? "Hide" : "Show"} Details
        </button>
      </div>

      <div className="status-detail-grid">
        <div className="status-detail-card">
          <span>XP Progress</span>
          <strong>{levelInfo.currentXp}/100 XP</strong>
          <div className="bar-track compact">
            <div className="bar-fill xp" style={{ width: `${Math.min(100, Math.max(0, levelInfo.currentXp))}%` }} />
          </div>
        </div>

        <div className="status-detail-card clickable" role="button" tabIndex={0} onClick={() => setActiveModal("energy")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveModal("energy"); } }}>
          <span>Energy</span>
          <strong>{g.gameState.energy} / {g.maxEnergy}</strong>
          <small>Tap to open resource details</small>
        </div>

        <div className="status-detail-card clickable" role="button" tabIndex={0} onClick={() => setActiveModal("nerve")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveModal("nerve"); } }}>
          <span>Nerve</span>
          <strong>{g.gameState.nerve} / {g.maxNerve}</strong>
          <small>High-risk actions consume nerve</small>
        </div>

        <div className="status-detail-card clickable" role="button" tabIndex={0} onClick={() => setActiveModal("happy")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveModal("happy"); } }}>
          <span>Happiness</span>
          <strong>{Math.floor(g.gameState.happiness)}</strong>
          <small>Influences your general efficiency</small>
        </div>

        <div className="status-detail-card clickable" role="button" tabIndex={0} onClick={() => setActiveModal("health")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveModal("health"); } }}>
          <span>Health</span>
          <strong>{Math.floor(g.gameState.health)} / {g.maxHealth}</strong>
          <small>Recover over time or use city services</small>
        </div>

        <div className="status-detail-card">
          <span>Points & Merits</span>
          <strong>{g.gameState.points} points</strong>
          <small>Spend points in progression upgrades</small>
        </div>
      </div>
    </header>
  );
}
