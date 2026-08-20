import React from "react";
import type { ActiveModal } from "../../types/riftCity";
import type { useRiftCity } from "../../hooks/useRiftCity";
import { money } from "../../core/gameCore";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type StatusBarProps = {
  g: RiftCityGame;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
};

export function StatusBar({ g, setActiveModal }: StatusBarProps) {
  return (
    <header className="top-status-bar floating-status-panel compact-hud-v3">
      <div className="compact-hud-row">
        <span className="compact-hud-item level">LV {g.level}</span>
        <span className="compact-hud-item">XP {g.gameState.xp}</span>
        <button type="button" className="compact-hud-item" onClick={() => setActiveModal("health")} aria-label="Health">❤️ {Math.floor(g.gameState.health)}/{g.maxHealth}</button>
        <button type="button" className="compact-hud-item" onClick={() => setActiveModal("energy")} aria-label="Energy">⚡ {g.gameState.energy}/{g.maxEnergy}</button>
        <button type="button" className="compact-hud-item" onClick={() => setActiveModal("nerve")} aria-label="Nerve">🔥 {g.gameState.nerve}/{g.maxNerve}</button>
        <button type="button" className="compact-hud-item" onClick={() => setActiveModal("happy")} aria-label="Happiness">😊 {Math.floor(g.gameState.happiness)}</button>
        <span className="compact-hud-item cash">💵 {money(g.gameState.cash)}</span>
        <span className="compact-hud-item bank">🏦 {money(g.gameState.bank)}</span>
        <span className="compact-hud-item">🌡 {g.gameState.heat}</span>
        <span className="compact-hud-item">💎 {g.gameState.points}</span>
        <span className="compact-hud-item">🏅 {g.gameState.merits}</span>
        <span className="compact-hud-item">STR {g.gameState.stats.strength.toFixed(1)}</span>
        <span className="compact-hud-item">DEF {g.gameState.stats.defense.toFixed(1)}</span>
        <span className="compact-hud-item">SPD {g.gameState.stats.speed.toFixed(1)}</span>
        <span className="compact-hud-item">DEX {g.gameState.stats.dexterity.toFixed(1)}</span>
      </div>
    </header>
  );
}
