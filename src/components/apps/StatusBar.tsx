import React from "react";
import type { ActiveModal } from "../../types/riftCity";
import type { useRiftCity } from "../../hooks/useRiftCity";
import { GameIcon } from "../GameIcon";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type StatusBarProps = {
  g: RiftCityGame;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
};

function compactNumber(value: number) {
  const amount = Math.max(0, value);
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(amount >= 10_000_000_000 ? 0 : 1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (amount >= 10_000) return `${(amount / 1_000).toFixed(amount >= 100_000 ? 0 : 1)}K`;
  return Math.floor(amount).toLocaleString();
}

function compactMoney(value: number) {
  return `$${compactNumber(value)}`;
}

export function StatusBar({ g, setActiveModal }: StatusBarProps) {
  return (
    <header className="top-status-bar floating-status-panel compact-hud-v4" aria-label="Player status">
      <div className="hud-line hud-line-primary">
        <span className="hud-metric hud-level"><b>LV</b> {g.level}</span>
        <span className="hud-metric"><b>XP</b> {compactNumber(g.gameState.xp)}</span>
        <button type="button" className="hud-metric hud-vital" onClick={() => setActiveModal("health")} aria-label="Health"><GameIcon name="health" size={14} /><strong>{Math.floor(g.gameState.health)}/{g.maxHealth}</strong></button>
        <button type="button" className="hud-metric hud-vital" onClick={() => setActiveModal("energy")} aria-label="Energy"><GameIcon name="energy" size={14} /><strong>{g.gameState.energy}/{g.maxEnergy}</strong></button>
        <button type="button" className="hud-metric hud-vital" onClick={() => setActiveModal("nerve")} aria-label="Nerve"><GameIcon name="nerve" size={14} /><strong>{g.gameState.nerve}/{g.maxNerve}</strong></button>
        <span className="hud-metric hud-cash"><b>CASH</b> {compactMoney(g.gameState.cash)}</span>
      </div>

      <div className="hud-line hud-line-secondary">
        <span className="hud-mini"><GameIcon name="bank" size={11} className="hud-mini-icon" /><b>BANK</b> {compactMoney(g.gameState.bank)}</span>
        <button type="button" className="hud-mini" onClick={() => setActiveModal("happy")} aria-label="Happiness"><GameIcon name="happy" size={11} className="hud-mini-icon" /><b>HAP</b> {Math.floor(g.gameState.happiness)}</button>
        <span className="hud-mini hud-heat"><GameIcon name="heat" size={11} className="hud-mini-icon" /><b>HEAT</b> {g.gameState.heat}</span>
        <span className="hud-mini"><GameIcon name="points" size={11} className="hud-mini-icon" /><b>PTS</b> {g.gameState.points}</span>
        <span className="hud-mini"><GameIcon name="merit" size={11} className="hud-mini-icon" /><b>MERIT</b> {g.gameState.merits}</span>
        <span className="hud-mini"><b>STR</b> {g.gameState.stats.strength.toFixed(1)}</span>
        <span className="hud-mini"><b>DEF</b> {g.gameState.stats.defense.toFixed(1)}</span>
        <span className="hud-mini"><b>SPD</b> {g.gameState.stats.speed.toFixed(1)}</span>
        <span className="hud-mini"><b>DEX</b> {g.gameState.stats.dexterity.toFixed(1)}</span>
      </div>
    </header>
  );
}
