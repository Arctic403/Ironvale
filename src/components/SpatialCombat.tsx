import React, { useState } from "react";
import { getItem, Item, DistanceZone } from "./gameData";

interface Combatant {
  name: string;
  hp: number;
  maxHp: number;
  zone: DistanceZone;
  inCover: boolean;
  equippedWeaponId: string;
}

export function SpatialCombat() {
  const [player, setPlayer] = useState<Combatant>({
    name: "Operative",
    hp: 100,
    maxHp: 100,
    zone: "Mid",
    inCover: false,
    equippedWeaponId: "pistol",
  });

  const [enemy, setEnemy] = useState<Combatant>({
    name: "Enforcer",
    hp: 120,
    maxHp: 120,
    zone: "Long",
    inCover: true,
    equippedWeaponId: "bat",
  });

  const [logs, setLogs] = useState<string[]>([
    "Encounter initiated. Enemy detected at Long Range behind Cover.",
  ]);

  const addLog = (msg: string) =>
    setLogs((prev) => [msg, ...prev].slice(0, 5));

  // --- CALCULATE ACCURACY & DAMAGE FROM GAMEDATA WEAPON ---
  const calculateHit = (attacker: Combatant, defender: Combatant) => {
    const weapon: Item | null = getItem(attacker.equippedWeaponId);

    // Fallback defaults if item isn't found or not a weapon
    const baseAccuracy = weapon?.accuracy ? weapon.accuracy / 100 : 0.7;
    const baseDamage = weapon?.effect || 10;
    const optimalZone = weapon?.optimalRange || "Close";
    const penetration = weapon?.coverPenetration || 0.0;

    let finalAccuracy = baseAccuracy;

    // Penalty for fighting outside optimal range
    if (optimalZone !== defender.zone) {
      finalAccuracy -= 0.35;
    }

    // Cover penalty (mitigated by weapon's coverPenetration attribute)
    if (defender.inCover) {
      const coverPenalty = 0.25 * (1 - penetration);
      finalAccuracy -= coverPenalty;
    }

    const hitSuccess = Math.random() < Math.max(0.15, finalAccuracy);
    let damage = 0;

    if (hitSuccess) {
      damage = baseDamage * (optimalZone === defender.zone ? 1.2 : 0.7);
      if (defender.inCover) {
        // Cover damage reduction factored by weapon penetration
        damage *= 0.5 + penetration * 0.3;
      }
      damage = Math.floor(damage);
    }

    return { hitSuccess, damage, weaponName: weapon?.name || "Unarmed" };
  };

  // --- PLAYER ACTIONS ---
  const handleAttack = () => {
    const { hitSuccess, damage, weaponName } = calculateHit(player, enemy);

    if (hitSuccess) {
      setEnemy((prev) => ({ ...prev, hp: Math.max(0, prev.hp - damage) }));
      addLog(`🎯 ${weaponName} hit ${enemy.name} for ${damage} damage!`);
    } else {
      addLog(`❌ ${weaponName} shot missed! Range penalty or cover absorbed the hit.`);
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

    const enemyWeapon = getItem(enemy.equippedWeaponId);
    const optimalZone = enemyWeapon?.optimalRange || "Close";

    // Enemy AI: Move closer if weapon is out of range, otherwise shoot
    if (optimalZone !== player.zone && Math.random() > 0.5) {
      setEnemy((prev) => ({ ...prev, zone: player.zone, inCover: false }));
      addLog(`⚠️ ${enemy.name} advanced to ${player.zone} Range!`);
    } else {
      const { hitSuccess, damage, weaponName } = calculateHit(enemy, player);
      if (hitSuccess) {
        setPlayer((prev) => ({ ...prev, hp: Math.max(0, prev.hp - damage) }));
        addLog(`💥 ${enemy.name} fired ${weaponName} and hit you for ${damage} damage!`);
      } else {
        addLog(`💨 ${enemy.name}'s ${weaponName} attack missed you!`);
      }
    }
  };

  const playerWeapon = getItem(player.equippedWeaponId);
  const enemyWeapon = getItem(enemy.equippedWeaponId);

  return (
    <div
      style={{
        background: "#121212",
        color: "#fff",
        padding: "20px",
        borderRadius: "8px",
        fontFamily: "sans-serif",
      }}
    >
      {/* GRID VISUALIZER */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          textAlign: "center",
          marginBottom: "20px",
        }}
      >
        {(["Close", "Mid", "Long"] as DistanceZone[]).map((zone) => (
          <div
            key={zone}
            style={{
              border: "2px solid #333",
              padding: "15px",
              borderRadius: "6px",
              background:
                player.zone === zone || enemy.zone === zone ? "#222" : "#111",
            }}
          >
            <strong style={{ color: "#888" }}>{zone.toUpperCase()} RANGE</strong>
            <div style={{ marginTop: "10px" }}>
              {player.zone === zone && (
                <div style={{ color: "#4ade80" }}>
                  👤 YOU {player.inCover && "(Cover)"}
                </div>
              )}
              {enemy.zone === zone && (
                <div style={{ color: "#f87171" }}>
                  🎯 {enemy.name} {enemy.inCover && "(Cover)"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* STATS */}
      <div
        style={{
          display: "flex",
          justify: "space-between",
          marginBottom: "15px",
        }}
      >
        <div>
          <p>
            <strong>You:</strong> {player.hp}/{player.maxHp} HP | Weapon:{" "}
            {playerWeapon?.name} ({playerWeapon?.optimalRange || "N/A"})
          </p>
        </div>
        <div>
          <p>
            <strong>{enemy.name}:</strong> {enemy.hp}/{enemy.maxHp} HP | Weapon:{" "}
            {enemyWeapon?.name} ({enemyWeapon?.optimalRange || "N/A"})
          </p>
        </div>
      </div>

      {/* ACTION CONTROLS */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={handleAttack} style={btnStyle}>
          Fire Weapon
        </button>
        <button
          onClick={handleTakeCover}
          disabled={player.inCover}
          style={btnStyle}
        >
          Take Cover
        </button>
        {(["Close", "Mid", "Long"] as DistanceZone[]).map((zone) => (
          <button
            key={zone}
            onClick={() => handleMove(zone)}
            disabled={player.zone === zone}
            style={btnStyle}
          >
            Move to {zone}
          </button>
        ))}
      </div>

      {/* LOGS */}
      <div
        style={{
          background: "#000",
          padding: "10px",
          borderRadius: "4px",
          minHeight: "80px",
          fontSize: "13px",
        }}
      >
        {logs.map((log, index) => (
          <div key={index} style={{ opacity: index === 0 ? 1 : 0.5 }}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: "8px 12px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
};
