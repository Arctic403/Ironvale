import React, { useState } from "react";
import {
  DynamicFighter,
  TurnLog,
  WeaponOption,
  executeCombatTurn,
} from "../systems/combatSystem";

interface InteractiveCombatViewProps {
  player: DynamicFighter;
  enemy: DynamicFighter;
  onFinish: (
    outcome: "leave" | "hospitalize" | "mug",
    enemy: DynamicFighter,
    finalPlayerHealth: number
  ) => void;
  onDefeat: (finalPlayerHealth: number) => void;
}

export function InteractiveCombatView({
  player,
  enemy,
  onFinish,
  onDefeat,
}: InteractiveCombatViewProps) {
  const [pState, setPState] = useState<DynamicFighter>(player);
  const [eState, setEState] = useState<DynamicFighter>(enemy);
  const [combatLogs, setCombatLogs] = useState<TurnLog[]>([]);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [winner, setWinner] = useState<"player" | "enemy" | null>(null);

  const handlePlayerAttack = (weapon: WeaponOption) => {
    if (turn !== "player" || winner) return;

    // Player Turn Execution
    const playerResult = executeCombatTurn(pState, eState, weapon);
    setEState(playerResult.updatedDefender);
    setCombatLogs((prev) => [playerResult.log, ...prev]);

    if (playerResult.updatedDefender.health <= 0) {
      setWinner("player");
      return;
    }

    // AI Opponent Counter-Attack
    setTurn("enemy");
    setTimeout(() => {
      const aiResult = executeCombatTurn(playerResult.updatedDefender, pState);
      setPState(aiResult.updatedDefender);
      setCombatLogs((prev) => [aiResult.log, ...prev]);

      if (aiResult.updatedDefender.health <= 0) {
        setWinner("enemy");
        onDefeat(aiResult.updatedDefender.health);
      } else {
        setTurn("player");
      }
    }, 600);
  };

  return (
    <div className="combat-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Vitals Display */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="card" style={{ padding: "12px" }}>
          <h3>{pState.name} (LV {pState.level})</h3>
          <p>Health: {pState.health} / {pState.maxHealth}</p>
          <div style={{ height: "8px", background: "#333", borderRadius: "4px", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(0, (pState.health / pState.maxHealth) * 100)}%`,
                height: "100%",
                background: "#22c55e",
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>

        <div className="card" style={{ padding: "12px" }}>
          <h3>{eState.name} (LV {eState.level})</h3>
          <p>Health: {eState.health} / {eState.maxHealth}</p>
          <div style={{ height: "8px", background: "#333", borderRadius: "4px", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(0, (eState.health / eState.maxHealth) * 100)}%`,
                height: "100%",
                background: "#ef4444",
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      </div>

      {/* Player Action Controls */}
      {!winner && turn === "player" && (
        <div className="card" style={{ padding: "12px" }}>
          <p style={{ marginBottom: "8px", fontWeight: "bold" }}>Select Attack:</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {pState.weapons.map((w) => (
              <button key={w.id} className="btn-primary" onClick={() => handlePlayerAttack(w)}>
                {w.icon || "⚔️"} {w.name} ({w.baseDamage} Dmg)
              </button>
            ))}
          </div>
        </div>
      )}

      {turn === "enemy" && !winner && (
        <div className="card" style={{ padding: "12px", textAlign: "center", color: "#a1a1aa" }}>
          {eState.name} is making a move...
        </div>
      )}

      {/* Torn-Style Finishing Actions */}
      {winner === "player" && (
        <div className="card" style={{ padding: "16px", border: "1px solid #22c55e", textAlign: "center" }}>
          <h2 style={{ color: "#22c55e" }}>VICTORY!</h2>
          <p style={{ margin: "8px 0 16px" }}>Select Finishing Outcome:</p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button className="btn-primary" onClick={() => onFinish("leave", eState, pState.health)}>
              🚶 Leave ( Max EXP Bonus )
            </button>
            <button
              className="btn-primary"
              style={{ background: "#dc2626" }}
              onClick={() => onFinish("hospitalize", eState, pState.health)}
            >
              🏥 Hospitalize ( Extended Hospital Time )
            </button>
            <button
              className="btn-primary"
              style={{ background: "#eab308", color: "#000" }}
              onClick={() => onFinish("mug", eState, pState.health)}
            >
              💵 Mug ( Steal Cash )
            </button>
          </div>
        </div>
      )}

      {winner === "enemy" && (
        <div className="card" style={{ padding: "16px", border: "1px solid #ef4444", textAlign: "center" }}>
          <h2 style={{ color: "#ef4444" }}>DEFEATED</h2>
          <p>You were knocked out and admitted to the hospital.</p>
        </div>
      )}

      {/* Combat Log */}
      <div className="card" style={{ padding: "12px", maxHeight: "200px", overflowY: "auto", background: "#09090b" }}>
        <p style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "8px" }}>COMBAT LOG</p>
        {combatLogs.map((log) => (
          <div
            key={log.id}
            style={{
              fontSize: "13px",
              marginBottom: "4px",
              color: log.isCrit ? "#f59e0b" : log.isMiss ? "#71717a" : "#f4f4f5",
            }}
          >
            {log.actionText}
          </div>
        ))}
      </div>
    </div>
  );
}
