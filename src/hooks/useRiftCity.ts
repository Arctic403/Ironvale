import { useEffect, useState } from "react";

import {
  DynamicFighter,
  TurnLog,
  WeaponOption,
  DEFAULT_WEAPONS,
  executeCombatTurn,
  calculateWinChance,
} from "../systems/combatSystem";

/*
 * ============================================================
 * RiftCity Combat Hook
 * ============================================================
 *
 * This hook owns the ACTIVE combat session.
 *
 * App.tsx should eventually become responsible for:
 *   - navigation
 *   - layout
 *   - screen rendering
 *
 * This hook is responsible for:
 *   - starting fights
 *   - tracking fighters
 *   - executing turns
 *   - combat logs
 *   - victory / defeat state
 *   - fleeing
 *
 * IMPORTANT:
 * SaveData / Screen / ActivityType / game helpers currently
 * live elsewhere in the existing RiftCity codebase.
 *
 * We are deliberately not duplicating those definitions here
 * until App.tsx has been fully extracted.
 * ============================================================
 */

export function useRiftCity() {
  /*
   * ------------------------------------------------------------
   * EXISTING GAME STATE
   * ------------------------------------------------------------
   *
   * These values are intentionally retained from the current
   * RiftCity architecture.
   */

  const [gameState, setGameState] = useState<SaveData>(() =>
    loadSave()
  );

  const [currentScreen, setCurrentScreen] =
    useState<Screen>("character");

  /*
   * ------------------------------------------------------------
   * COMBAT STATE
   * ------------------------------------------------------------
   */

  const [playerFighter, setPlayerFighter] =
    useState<DynamicFighter | null>(null);

  const [enemyFighter, setEnemyFighter] =
    useState<DynamicFighter | null>(null);

  const [combatLogs, setCombatLogs] =
    useState<TurnLog[]>([]);

  const [combatStatus, setCombatStatus] =
    useState<
      "idle" |
      "fighting" |
      "won" |
      "lost"
    >("idle");

  /*
   * ------------------------------------------------------------
   * DERIVED PLAYER DATA
   * ------------------------------------------------------------
   */

  const level = getLevel(gameState.xp).level;

  const property = getProperty(
    gameState.ownedProperty
  );

  const maxHealth = getMaxHealth(
    property?.maxHealthBonus ?? 0
  );

  const maxNerve =
    10 +
    Math.min(
      50,
      Math.floor(gameState.crimeExperience / 100) * 5
    ) +
    (property?.nerveBonus ?? 0);

  const gym =
    GYMS.find(
      (g) => g.id === gameState.activeGym
    ) ?? GYMS[0];

  const job = getJob(
    gameState.currentJob
  );

  /*
   * ------------------------------------------------------------
   * ACTIVITY LOG
   * ------------------------------------------------------------
   */

  const log = (
    text: string,
    type: ActivityType = "system"
  ) => {
    setGameState((state) => ({
      ...state,

      activities: [
        {
          id:
            Date.now() +
            Math.random(),

          text,

          type,

          time: Date.now(),
        },

        ...state.activities,
      ].slice(0, 60),
    }));
  };

  /*
   * ------------------------------------------------------------
   * SAVE GAME
   * ------------------------------------------------------------
   */

  useEffect(() => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(gameState)
    );
  }, [gameState]);

  /*
   * ------------------------------------------------------------
   * MAIN GAME TICK
   * ------------------------------------------------------------
   *
   * Handles:
   *
   *   Energy regeneration
   *   Health regeneration
   *   Hospital expiration
   *
   * This will eventually move into a dedicated
   * progression/tick system.
   * ------------------------------------------------------------
   */

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();

      setGameState((previous) => {
        let changed = false;

        const updates: Partial<SaveData> = {};

        /*
         * ENERGY
         */

        if (
          previous.energy <
          MAX_ENERGY
        ) {
          const ticks = Math.floor(
            (
              now -
              previous.lastEnergyUpdate
            ) /
              ENERGY_REGEN_INTERVAL
          );

          if (ticks > 0) {
            updates.energy = Math.min(
              MAX_ENERGY,
              previous.energy + ticks
            );

            updates.lastEnergyUpdate =
              previous.lastEnergyUpdate +
              ticks *
                ENERGY_REGEN_INTERVAL;

            changed = true;
          }
        }

        /*
         * HEALTH
         */

        if (
          previous.health <
            maxHealth &&
          !previous.hospitalUntil &&
          !previous.jailUntil
        ) {
          updates.health = Math.min(
            maxHealth,
            previous.health + 1
          );

          changed = true;
        }

        /*
         * HOSPITAL
         */

        if (
          previous.hospitalUntil &&
          now >= previous.hospitalUntil
        ) {
          updates.hospitalUntil = null;

          updates.health =
            maxHealth;

          changed = true;
        }

        if (!changed) {
          return previous;
        }

        return {
          ...previous,
          ...updates,
        };
      });
    }, 1000);

    return () =>
      window.clearInterval(interval);
  }, [maxHealth]);

  /*
   * ------------------------------------------------------------
   * BLOCKED STATE
   * ------------------------------------------------------------
   */

  const blocked = () =>
    Boolean(
      gameState.jailUntil ||
      gameState.hospitalUntil
    );

  /*
   * ============================================================
   * START COMBAT
   * ============================================================
   */

  const startCombat = (
    opponent: {
      id: string;
      name: string;
      level: number;
      stats: any;
    }
  ) => {
    /*
     * Cannot fight while jailed/hospitalized.
     */

    if (blocked()) {
      log(
        "Cannot fight while in hospital/jail."
      );

      return;
    }

    /*
     * Combat costs 10 energy.
     */

    if (gameState.energy < 10) {
      log(
        "Requires 10 Energy to start a fight."
      );

      return;
    }

    /*
     * Consume combat energy.
     */

    setGameState((previous) => ({
      ...previous,
      energy:
        previous.energy - 10,
    }));

    /*
     * ----------------------------------------------------------
     * PLAYER FIGHTER
     * ----------------------------------------------------------
     */

    const player: DynamicFighter = {
      id: "player",

      name: gameState.name ?? "You",

      level,

      health: gameState.health,

      maxHealth,

      stats: gameState.stats,

      weapons:
        DEFAULT_WEAPONS,
    };

    /*
     * ----------------------------------------------------------
     * ENEMY FIGHTER
     * ----------------------------------------------------------
     */

    const enemyMaxHealth =
      100 +
      opponent.level * 15;

    const enemy: DynamicFighter = {
      id: opponent.id,

      name: opponent.name,

      level: opponent.level,

      health: enemyMaxHealth,

      maxHealth:
        enemyMaxHealth,

      stats: opponent.stats,

      weapons: [
        DEFAULT_WEAPONS[1],
        DEFAULT_WEAPONS[2],
      ],

      cashReward:
        opponent.level * 45,

      xpReward:
        opponent.level * 20,
    };

    /*
     * ----------------------------------------------------------
     * INITIALIZE COMBAT
     * ----------------------------------------------------------
     */

    setPlayerFighter(player);

    setEnemyFighter(enemy);

    setCombatLogs([]);

    setCombatStatus(
      "fighting"
    );

    setCurrentScreen(
      "combat"
    );
  };

  /*
   * ============================================================
   * PLAYER TURN
   * ============================================================
   */

  const executePlayerTurn = (
    selectedWeapon?: WeaponOption
  ) => {
    /*
     * Validate active combat.
     */

    if (
      !playerFighter ||
      !enemyFighter ||
      combatStatus !==
        "fighting"
    ) {
      return;
    }

    /*
     * ----------------------------------------------------------
     * PLAYER ATTACKS
     * ----------------------------------------------------------
     */

    const playerTurn =
      executeCombatTurn(
        playerFighter,
        enemyFighter,
        selectedWeapon
      );

    const updatedEnemy =
      playerTurn.updatedDefender;

    /*
     * Record player's action.
     */

    setCombatLogs(
      (previous) => [
        playerTurn.log,
        ...previous,
      ].slice(0, 100)
    );

    /*
     * ----------------------------------------------------------
     * VICTORY
     * ----------------------------------------------------------
     */

    if (
      updatedEnemy.health <= 0
    ) {
      setEnemyFighter(
        updatedEnemy
      );

      setCombatStatus(
        "won"
      );

      const cashGained =
        enemyFighter.cashReward ??
        50;

      const xpGained =
        enemyFighter.xpReward ??
        25;

      log(
        `Victory over ${enemyFighter.name}! Won ${money(
          cashGained
        )} and ${xpGained} XP.`,
        "success"
      );

      setGameState(
        (previous) => ({
          ...previous,

          cash:
            previous.cash +
            cashGained,

          xp:
            previous.xp +
            xpGained,

          fightsWon:
            (previous.fightsWon ?? 0) +
            1,
        })
      );

      return;
    }

    /*
     * ----------------------------------------------------------
     * ENEMY COUNTER ATTACK
     * ----------------------------------------------------------
     */

    const enemyTurn =
      executeCombatTurn(
        updatedEnemy,
        playerFighter
      );

    const updatedPlayer =
      enemyTurn.updatedDefender;

    /*
     * Update combat state.
     */

    setEnemyFighter(
      updatedEnemy
    );

    setPlayerFighter(
      updatedPlayer
    );

    /*
     * Put enemy action above
     * previous combat entries.
     */

    setCombatLogs(
      (previous) => [
        enemyTurn.log,
        playerTurn.log,
        ...previous,
      ].slice(0, 100)
    );

    /*
     * Keep global health synchronized
     * with combat health.
     */

    setGameState(
      (previous) => ({
        ...previous,
        health:
          Math.max(
            0,
            updatedPlayer.health
          ),
      })
    );

    /*
     * ----------------------------------------------------------
     * DEFEAT
     * ----------------------------------------------------------
     */

    if (
      updatedPlayer.health <= 0
    ) {
      setCombatStatus(
        "lost"
      );

      const hospitalTime =
        15 * 60 * 1000;

      log(
        `Defeated by ${enemyFighter.name}! Sent to hospital.`,
        "jailed"
      );

      setGameState(
        (previous) => ({
          ...previous,

          health: 0,

          hospitalUntil:
            Date.now() +
            hospitalTime,

          fightsLost:
            (previous.fightsLost ?? 0) +
            1,
        })
      );
    }
  };

  /*
   * ============================================================
   * FLEE
   * ============================================================
   */

  const fleeCombat = () => {
    if (
      !playerFighter ||
      !enemyFighter ||
      combatStatus !==
        "fighting"
    ) {
      return;
    }

    const chance =
      calculateWinChance(
        playerFighter.stats,
        enemyFighter.stats
      );

    /*
     * Flee receives a +20% modifier.
     */

    const fleeChance =
      Math.min(
        95,
        Math.max(
          5,
          chance + 20
        )
      );

    if (
      Math.random() * 100 <
      fleeChance
    ) {
      log(
        `Successfully fled from ${enemyFighter.name}.`,
        "success"
      );

      setCombatStatus(
        "idle"
      );

      setPlayerFighter(
        null
      );

      setEnemyFighter(
        null
      );

      setCombatLogs([]);

      setCurrentScreen(
        "character"
      );

      return;
    }

    /*
     * Failed escape.
     *
     * Enemy gets a free attack.
     */

    log(
      `Failed to escape! ${enemyFighter.name} hit you as you ran.`,
      "failure"
    );

    executePlayerTurn();
  };

  /*
   * ============================================================
   * EXIT / RESET COMBAT
   * ============================================================
   */

  const clearCombat = () => {
    setPlayerFighter(
      null
    );

    setEnemyFighter(
      null
    );

    setCombatLogs([]);

    setCombatStatus(
      "idle"
    );
  };

  /*
   * ============================================================
   * PUBLIC API
   * ============================================================
   */

  return {
    /*
     * Core state
     */

    gameState,

    setGameState,

    currentScreen,

    setCurrentScreen,

    level,

    maxHealth,

    maxNerve,

    gym,

    job,

    /*
     * Combat state
     */

    playerFighter,

    enemyFighter,

    combatLogs,

    combatStatus,

    /*
     * Combat actions
     */

    startCombat,

    executePlayerTurn,

    fleeCombat,

    clearCombat,

    /*
     * Activity
     */

    log,
  };
}
