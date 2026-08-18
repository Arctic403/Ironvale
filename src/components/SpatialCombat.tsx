import React, { useState } from "react";

type DistanceZone = "Close" | "Mid" | "Long";

interface Weapon {
  name: string;
  optimalZone: DistanceZone;
  baseDamage: number;
  accuracy: number; // 0.0 to 1.0
}

interface Combatant {
  name: string;
  hp: number;
  maxHp: number;
  zone: DistanceZone;
  inCover: boolean;
  weapon: Weapon;
}

export function SpatialCombat() {
  const [player, setPlayer] = useState<Combatant>({
    name: "Operative",
    hp: 100,
    maxHp: 100,
    zone: "Mid",
    inCover: false,
    weapon: { name: "SMG", optimalZone: "Mid", baseDamage: 22, accuracy: 0.85 },
  });

  const [enemy, setEnemy] = useState<Combatant>({
    name: "Enforcer",
    hp: 120,
    maxHp: 120,
    zone: "Long",
    inCover: true,
    weapon: { name: "Sniper Rifle", optimalZone: "Long", baseDamage: 40, accuracy: 0.75 },
  });

  const [logs, setLogs] = useState<string[]>(["Encounter initiated. Enemy detected at Long Range behind Cover."]);

  const addLog = (msg: string) => setLogs((prev) => [msg, ...prev].slice(0, 5));

  // --- CALCULATE ACCURACY & DAMAGE BASED ON RANGE ---
  const calculateHit = (attacker: Combatant, defender: Combatant) => {
    let accuracy = attacker.weapon.accuracy;

    // Penalty for fighting outside optimal range
    if (attacker.weapon.optimalZone !== defender.zone) {
      accuracy -= 0.35;
    }

    // Cover penalty
    if (defender.inCover) {
      accuracy -= 0.25;
    }

    const hitSuccess = Math.random() < Math.max(0.15, accuracy);
    let damage = 0;

    if (hitSuccess) {
      damage = attacker.weapon.baseDamage * (attacker.weapon.optimalZone === defender.zone ? 1.2 : 0.7);
      if (defender.inCover) damage *= 0.5; // 50% damage reduction from cover
      damage = Math.floor(damage);
    }

    return { hitSuccess, damage };
  };

  // --- PLAYER ACTIONS ---
  const handleAttack = () => {
    const { hitSuccess, damage } = calculateHit(player, enemy);

    if (hitSuccess) {
      setEnemy((prev) => ({ ...prev, hp: Math.max(0, prev.hp - damage) }));
      addLog(`🎯 Shot hit ${enemy.name} for ${damage} damage!`);
    } else {
      addLog(`❌ Shot missed! Range penalty or cover absorbed the hit.`);
    }

    triggerEnemyTurn();
  };

  const handleMove = (newZone: DistanceZone) => {
    setPlayer((prev) => ({ ...prev, zone: newZone, inCover: false }));
    addLog(`🏃 Repositioned to ${newZone} Range.`);
    triggerEnemyTurn();
  };

  const handleTakeCover = () => {
    setPlayer((prev) => ({ ...prev, inCover: true }));
    addLog(`🛡️ Took cover in current position.`);
    triggerEnemyTurn();
  };

  // --- SIMPLE ENEMY AI TURN ---
  const triggerEnemyTurn = () => {
    if (enemy.hp <= 0) return;

    // Enemy AI: Move closer if weapon is out of range, otherwise shoot
    if (enemy.weapon.optimalZone !== player.zone && Math.random() > 0.5) {
      setEnemy((prev) => ({ ...prev, zone: player.zone, inCover: false }));
      addLog(`⚠️ ${enemy.name} advanced to ${player.zone} Range!`);
    } else {
      const { hitSuccess, damage } = calculateHit(enemy, player);
      if (hitSuccess) {
        setPlayer((prev) => ({ ...prev, hp: Math.max(0, prev.hp - damage) }));
        addLog(`💥 ${enemy.name} fired and hit you for ${damage} damage!`);
      } else {
        addLog(`💨 ${enemy.name}'s shot missed you!`);
      }
    }
  };

  return (
    <div style={{ background: "#121212", color: "#fff", padding: "20px", borderRadius: "8px", fontFamily: "sans-serif" }}>
      {/* GRID VISUALIZER */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", textAlign: "center", marginBottom: "20px" }}>
        {(["Close", "Mid", "Long"] as DistanceZone[]).map((zone) => (
          <div
            key={zone}
            style={{
              border: "2px solid #333",
              padding: "15px",
              borderRadius: "6px",
              background: player.zone === zone || enemy.zone === zone ? "#222" : "#111",
            }}
          >
            <strong style={{ color: "#888" }}>{zone.toUpperCase()} RANGE</strong>
            <div style={{ marginTop: "10px" }}>
              {player.zone === zone && <div style={{ color: "#4ade80" }}>👤 YOU {player.inCover && "(Cover)"}</div>}
              {enemy.zone === zone && <div style={{ color: "#f87171" }}>🎯 {enemy.name} {enemy.inCover && "(Cover)"}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* STATS */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
        <div>
          <p><strong>You:</strong> {player.hp}/{player.maxHp} HP | Weapon: {player.weapon.name} ({player.weapon.optimalZone})</p>
        </div>
        <div>
          <p><strong>{enemy.name}:</strong> {enemy.hp}/{enemy.maxHp} HP | Weapon: {enemy.weapon.name} ({enemy.weapon.optimalZone})</p>
        </div>
      </div>

      {/* ACTION CONTROLS */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={handleAttack} style={btnStyle}>Fire Weapon</button>
        <button onClick={handleTakeCover} disabled={player.inCover} style={btnStyle}>Take Cover</button>
        {(["Close", "Mid", "Long"] as DistanceZone[]).map((zone) => (
          <button key={zone} onClick={() => handleMove(zone)} disabled={player.zone === zone} style={btnStyle}>
            Move to {zone}
          </button>
        ))}
      </div>

      {/* LOGS */}
      <div style={{ background: "#000", padding: "10px", borderRadius: "4px", minHeight: "80px", fontSize: "13px" }}>
        {logs.map((log, index) => (
          <div key={index} style={{ opacity: index === 0 ? 1 : 0.5 }}>{log}</div>
        ))}
      </div>
    </div>
  );
}

const btnStyle = { padding: "8px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" };
