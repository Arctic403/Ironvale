import { useState, useEffect } from "react";
import {
  DynamicFighter,
  TurnLog,
  WeaponOption,
  DEFAULT_WEAPONS,
  executeCombatTurn,
  calculateWinChance,
} from "./systems/combatSystem";

export function useRiftCity() {
  const [gameState, setGameState] = useState<SaveData>(() => loadSave());
  const [currentScreen, setCurrentScreen] = useState<Screen>("character");
  
  // New Combat State using your updated systems
  const [playerFighter, setPlayerFighter] = useState<DynamicFighter | null>(null);
  const [enemyFighter, setEnemyFighter] = useState<DynamicFighter | null>(null);
  const [combatLogs, setCombatLogs] = useState<TurnLog[]>([]);
  const [combatStatus, setCombatStatus] = useState<"idle" | "fighting" | "won" | "lost">("idle");

  const level = getLevel(gameState.xp).level;
  const property = getProperty(gameState.ownedProperty);
  const maxHealth = getMaxHealth(property?.maxHealthBonus ?? 0);
  const maxNerve = 10 + Math.min(50, Math.floor(gameState.crimeExperience / 100) * 5) + (property?.nerveBonus ?? 0);
  const gym = GYMS.find((g) => g.id === gameState.activeGym) ?? GYMS[0];
  const job = getJob(gameState.currentJob);

  const log = (text: string, type: ActivityType = "system") =>
    setGameState((s) => ({
      ...s,
      activities: [{ id: Date.now() + Math.random(), text, type, time: Date.now() }, ...s.activities].slice(0, 60),
    }));

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Main tick loop
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setGameState((prev) => {
        let changed = false;
        const updates: Partial<SaveData> = {};

        if (prev.energy < MAX_ENERGY) {
          const ticks = Math.floor((now - prev.lastEnergyUpdate) / ENERGY_REGEN_INTERVAL);
          if (ticks > 0) {
            updates.energy = Math.min(MAX_ENERGY, prev.energy + ticks);
            updates.lastEnergyUpdate = prev.lastEnergyUpdate + ticks * ENERGY_REGEN_INTERVAL;
            changed = true;
          }
        }

        if (prev.health < maxHealth && !prev.hospitalUntil && !prev.jailUntil) {
          updates.health = Math.min(maxHealth, prev.health + 1);
          changed = true;
        }

        if (prev.hospitalUntil && now >= prev.hospitalUntil) {
          updates.hospitalUntil = null;
          updates.health = maxHealth;
          changed = true;
        }

        return changed ? { ...prev, ...updates } : prev;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [maxHealth]);

  const blocked = () => Boolean(gameState.jailUntil || gameState.hospitalUntil);

  // --- NEW TURN-BASED COMBAT SYSTEM ---

  const startCombat = (opponent: { id: string; name: string; level: number; stats: any }) => {
    if (blocked()) return log("Cannot fight while in hospital/jail.");
    if (gameState.energy < 10) return log("Requires 10 Energy to start a fight.");

    // Consume energy to engage
    setGameState((prev) => ({ ...prev, energy: prev.energy - 10 }));

    // Construct full DynamicFighter objects
    const pFighter: DynamicFighter = {
      id: "player",
      name: "You",
      level: level,
      health: gameState.health,
      maxHealth: maxHealth,
      stats: gameState.stats,
      weapons: DEFAULT_WEAPONS,
    };

    const eFighter: DynamicFighter = {
      id: opponent.id,
      name: opponent.name,
      level: opponent.level,
      health: 100 + opponent.level * 15,
      maxHealth: 100 + opponent.level * 15,
      stats: opponent.stats,
      weapons: [DEFAULT_WEAPONS[1], DEFAULT_WEAPONS[2]],
      cashReward: opponent.level * 45,
      xpReward: opponent.level * 20,
    };

    setPlayerFighter(pFighter);
    setEnemyFighter(eFighter);
    setCombatLogs([]);
    setCombatStatus("fighting");
    setCurrentScreen("combat");
  };

  const executePlayerTurn = (selectedWeapon?: WeaponOption) => {
    if (!playerFighter || !enemyFighter || combatStatus !== "fighting") return;

    // 1. Player Attacks Enemy
    const playerTurn = executeCombatTurn(playerFighter, enemyFighter, selectedWeapon);
    const updatedEnemy = playerTurn.updatedDefender;
    const logs = [playerTurn.log];

    // Check Victory
    if (updatedEnemy.health <= 0) {
      setEnemyFighter(updatedEnemy);
      setCombatLogs((prev) => [playerTurn.log, ...prev]);
      setCombatStatus("won");

      const cashGained = enemyFighter.cashReward ?? 50;
      const xpGained = enemyFighter.xpReward ?? 25;

      log(`Victory over ${enemyFighter.name}! Won ${money(cashGained)} and ${xpGained} XP.`, "success");
      setGameState((prev) => ({
        ...prev,
        cash: prev.cash + cashGained,
        xp: prev.xp + xpGained,
      }));
      return;
    }

    // 2. Enemy Counter-Attacks
    const enemyTurn = executeCombatTurn(updatedEnemy, playerFighter);
    const updatedPlayer = enemyTurn.updatedDefender;
    logs.unshift(enemyTurn.log);

    setEnemyFighter(updatedEnemy);
    setPlayerFighter(updatedPlayer);
    setCombatLogs((prev) => [...logs, ...prev]);

    // Update global state health
    setGameState((prev) => ({ ...prev, health: updatedPlayer.health }));

    // Check Defeat
    if (updatedPlayer.health <= 0) {
      setCombatStatus("lost");
      log(`Defeated by ${enemyFighter.name}! Sent to hospital.`, "jailed");
      setGameState((prev) => ({
        ...prev,
        health: 0,
        hospitalUntil: Date.now() + 15 * 60000,
      }));
    }
  };

  const fleeCombat = () => {
    if (!playerFighter || !enemyFighter) return;
    const chance = calculateWinChance(playerFighter.stats, enemyFighter.stats);
    
    if (Math.random() * 100 < chance + 20) {
      log(`Successfully fled from ${enemyFighter.name}.`);
      setCombatStatus("idle");
      setCurrentScreen("character");
    } else {
      log(`Failed to escape! ${enemyFighter.name} hit you as you ran.`);
      executePlayerTurn(); // Free turn for enemy on fail
    }
  };

  return {
    gameState,
    setGameState,
    currentScreen,
    setCurrentScreen,
    level,
    maxHealth,
    maxNerve,
    playerFighter,
    enemyFighter,
    combatLogs,
    combatStatus,
    startCombat,
    executePlayerTurn,
    fleeCombat,
  };
}
