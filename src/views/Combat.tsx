import React, { useState } from "react";
import {
  DynamicFighter,
  TurnLog,
  WeaponOption,
  executeCombatTurn,
} from "../systems/combatSystem";

const DEFAULT_WEAPONS: WeaponOption[] = [
  { id: "primary", name: "Heavy Pistol", type: "primary", baseDamage: 25, accuracy: 80, critChance: 15 },
  { id: "secondary", name: "Knife", type: "melee", baseDamage: 15, accuracy: 90, critChance: 25 },
  { id: "temp", name: "Pepper Spray", type: "temporary", baseDamage: 8, accuracy: 95, critChance: 5 },
];

export function InteractiveCombatView({ player, enemy, onFinish }: { 
  player: DynamicFighter; 
  enemy: DynamicFighter; 
  onFinish: (outcome: "leave" | "hospitalize" | "mug", enemy: DynamicFighter) => void;
}) {
  const [pState, setPState] = useState<DynamicFighter>(player);
  const [eState, setEState] = useState<DynamicFighter>(enemy);
  const [combatLogs, setCombatLogs] = useState<TurnLog[]>([]);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [winner, setWinner] = useState<"player" | "enemy" | null>(null);

  const handlePlayerAttack = (weapon: WeaponOption) => {
    if (turn !== "player" || winner) return;

    // Player Turn
    const { updatedDefender, log } = executeCombatTurn(pState, eState, weapon);
    setEState(updatedDefender);
    setCombatLogs((prev) => [log, ...prev]);

    if (updatedDefender.health <= 0) {
      setWinner("player");
      return;
    }

    // AI Turn (Delayed slightly for combat feedback)
    setTurn("enemy");
    setTimeout(() => {
      const aiTurn = executeCombatTurn(eState, pState);
      setPState(aiTurn.updatedDefender);
      setCombatLogs((prev) => [aiTurn.log, ...prev]);

      if (aiTurn.updatedDefender.health <= 0) {
        setWinner("enemy");
      } else {
        setTurn("player");
      }
    }, 600);
  };

  return (
    <div className="combat-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* FIGHTERS STATUS BARS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {/* PLAYER */}
        <div className="card" style={{ padding: "12px" }}>
          <h3>{pState.name} (LV {pState.level})</h3>
          <p>Health: {pState.health} / {pState.maxHealth}</p>
          <div style={{ height: "8px", background: "#333", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ width: `${(pState.health / pState.maxHealth) * 100}%`, height: "100%", background: "#22c55e" }} />
          </div>
        </div>

        {/* ENEMY */}
        <div className="card" style={{ padding: "12px" }}>
          <h3>{eState.name} (LV {eState.level})</h3>
          <p>Health: {eState.health} / {eState.maxHealth}</p>
          <div style={{ height: "8px", background: "#333", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ width: `${(eState.health / eState.maxHealth) * 100}%`, height: "100%", background: "#ef4444" }} />
          </div>
        </div>
      </div>

      {/* WEAPON SELECTION & ACTIONS */}
      {!winner && turn === "player" && (
        <div className="card" style={{ padding: "12px" }}>
          <p style={{ marginBottom: "8px", fontWeight: "bold" }}>Select Attack Type:</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {DEFAULT_WEAPONS.map((w) => (
              <button key={w.id} className="btn-primary" onClick={() => handlePlayerAttack(w)}>
                {w.name} ({w.baseDamage} Dmg)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TORN-STYLE FINISHING OPTIONS */}
      {winner === "player" && (
        <div className="card" style={{ padding: "16px", border: "1px solid #22c55e", textAlign: "center" }}>
          <h2 style={{ color: "#22c55e" }}>VICTORY!</h2>
          <p style={{ margin: "8px 0 16px" }}>Choose how to finish your target:</p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button className="btn-primary" onClick={() => onFinish("leave", eState)}>
              🚶 Leave ( +EXP Bonus )
            </button>
            <button className="btn-primary" style={{ background: "#dc2626" }} onClick={() => onFinish("hospitalize", eState)}>
              🏥 Hospitalize ( Max Hospital Time )
            </button>
            <button className="btn-primary" style={{ background: "#eab308", color: "#000" }} onClick={() => onFinish("mug", eState)}>
              💵 Mug ( Steal Cash )
            </button>
          </div>
        </div>
      )}

      {winner === "enemy" && (
        <div className="card" style={{ padding: "16px", border: "1px solid #ef4444", textAlign: "center" }}>
          <h2 style={{ color: "#ef4444" }}>DEFEATED</h2>
          <p>You were knocked out and taken to the hospital.</p>
        </div>
      )}

      {/* TURN LOG CONSOLE */}
      <div className="card" style={{ padding: "12px", maxHeight: "200px", overflowY: "auto", background: "#09090b" }}>
        <p style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "8px" }}>COMBAT LOG</p>
        {combatLogs.map((log, idx) => (
          <div key={idx} style={{ fontSize: "13px", marginBottom: "4px", color: log.isCrit ? "#f59e0b" : log.isMiss ? "#71717a" : "#f4f4f5" }}>
            {log.actionText}
          </div>
        ))}
      </div>
    </div>
  );
}
