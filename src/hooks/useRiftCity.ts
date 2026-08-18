import { useEffect, useState } from "react";
import {
  DynamicFighter,
  TurnLog,
  WeaponOption,
  DEFAULT_WEAPONS,
  executeCombatTurn,
  calculateWinChance,
  resolveEquippedWeapon,
} from "../systems/combatSystem";

export function useRiftCity() {
  const [gameState, setGameState] = useState<SaveData>(() => loadSave());
  const [currentScreen, setCurrentScreen] =
    useState<Screen>("character");

  /*
   * ============================================================
   * COMBAT STATE
   * ============================================================
   *
   * The hook owns the persistent/game-level combat state.
   *
   * The actual turn calculation remains inside combatSystem.ts.
   * This prevents App.tsx from becoming another 5,000-line
   * archaeological excavation.
   */

  const [playerFighter, setPlayerFighter] =
    useState<DynamicFighter | null>(null);

  const [enemyFighter, setEnemyFighter] =
    useState<DynamicFighter | null>(null);

  const [combatLogs, setCombatLogs] =
    useState<TurnLog[]>([]);

  const [combatStatus, setCombatStatus] =
    useState<"idle" | "fighting" | "won" | "lost">("idle");

  /*
   * ============================================================
   * DERIVED GAME STATE
   * ============================================================
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
      Math.floor(
        gameState.crimeExperience / 100
      ) * 5
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
   * ============================================================
   * ACTIVITY LOG
   * ============================================================
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
   * ============================================================
   * SAVE GAME
   * ============================================================
   */

  useEffect(() => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(gameState)
    );
  }, [gameState]);

  /*
   * ============================================================
   * MAIN GAME TICK
   * ============================================================
   *
   * Handles:
   *
   * - Energy regeneration
   * - Health regeneration
   * - Hospital expiration
   *
   * Uses elapsed time rather than assuming the browser remained
   * open the entire time.
   */

  useEffect(() => {
    const intervalId =
      window.setInterval(() => {
        const now = Date.now();

        setGameState((previous) => {
          let changed = false;

          const updates: Partial<SaveData> =
            {};

          /*
           * ------------------------------------------------------
           * ENERGY
           * ------------------------------------------------------
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
              updates.energy =
                Math.min(
                  MAX_ENERGY,
                  previous.energy +
                    ticks
                );

              updates.lastEnergyUpdate =
                previous.lastEnergyUpdate +
                ticks *
                  ENERGY_REGEN_INTERVAL;

              changed = true;
            }
          }

          /*
           * ------------------------------------------------------
           * HEALTH
           * ------------------------------------------------------
           */

          if (
            previous.health <
              maxHealth &&
            !previous.hospitalUntil &&
            !previous.jailUntil
          ) {
            updates.health =
              Math.min(
                maxHealth,
                previous.health + 1
              );

            changed = true;
          }

          /*
           * ------------------------------------------------------
           * HOSPITAL EXPIRATION
           * ------------------------------------------------------
           */

          if (
            previous.hospitalUntil &&
            now >=
              previous.hospitalUntil
          ) {
            updates.hospitalUntil =
              null;

            updates.health =
              maxHealth;

            changed = true;
          }

          return changed
            ? {
                ...previous,
                ...updates,
              }
            : previous;
        });
      }, 1000);

    return () =>
      window.clearInterval(
        intervalId
      );
  }, [maxHealth]);

  /*
   * ============================================================
   * BLOCKED STATE
   * ============================================================
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

  const startCombat = (opponent: {
    id: string;
    name: string;
    level: number;
    stats: any;
  }) => {
    /*
     * Cannot fight while jailed/hospitalized.
     */

    if (blocked()) {
      log(
        "Cannot fight while in hospital or jail."
      );
      return;
    }

    /*
     * Combat entry cost.
     */

    if (gameState.energy < 10) {
      log(
        "Requires 10 Energy to start a fight."
      );
      return;
    }

    /*
     * ----------------------------------------------------------
     * PLAYER EQUIPMENT
     * ----------------------------------------------------------
     *
     * IMPORTANT:
     *
     * DEFAULT_WEAPONS represents weapons available to the
     * current prototype player.
     *
     * equippedWeaponId explicitly determines what is used.
     *
     * If no equipped weapon exists, combatSystem correctly
     * falls back to Unarmed.
     */

    const playerWeapons =
      DEFAULT_WEAPONS;

    const playerEquippedWeapon =
      playerWeapons[0];

    /*
     * ----------------------------------------------------------
     * PLAYER FIGHTER
     * ----------------------------------------------------------
     */

    const pFighter: DynamicFighter = {
      id: "player",

      name:
        gameState.name ??
        "You",

      level,

      health:
        Math.max(
          0,
          Math.min(
            gameState.health,
            maxHealth
          )
        ),

      maxHealth,

      stats: gameState.stats,

      weapons:
        playerWeapons,

      /*
       * Explicitly equip the prototype's first weapon.
       *
       * If the player's actual persistent inventory/equipment
       * system later supplies a different ID, this is the field
       * we replace rather than rewriting combatSystem.
       */

      equippedWeaponId:
        playerEquippedWeapon?.id ??
        null,
    };

    /*
     * ----------------------------------------------------------
     * ENEMY EQUIPMENT
     * ----------------------------------------------------------
     */

    const enemyWeapons =
      DEFAULT_WEAPONS.slice(
        1,
        3
      );

    const enemyEquippedWeapon =
      enemyWeapons[0] ??
      null;

    /*
     * ----------------------------------------------------------
     * ENEMY HEALTH
     * ----------------------------------------------------------
     */

    const enemyMaxHealth =
      100 +
      opponent.level * 15;

    /*
     * ----------------------------------------------------------
     * ENEMY FIGHTER
     * ----------------------------------------------------------
     */

    const eFighter: DynamicFighter = {
      id:
        opponent.id,

      name:
        opponent.name,

      level:
        opponent.level,

      health:
        enemyMaxHealth,

      maxHealth:
        enemyMaxHealth,

      stats:
        opponent.stats,

      weapons:
        enemyWeapons,

      equippedWeaponId:
        enemyEquippedWeapon?.id ??
        null,

      cashReward:
        opponent.level * 45,

      xpReward:
        opponent.level * 20,
    };

    /*
     * ----------------------------------------------------------
     * COMMIT COMBAT
     * ----------------------------------------------------------
     */

    setGameState((previous) => ({
      ...previous,
      energy:
        Math.max(
          0,
          previous.energy - 10
        ),
    }));

    setPlayerFighter(
      pFighter
    );

    setEnemyFighter(
      eFighter
    );

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
   *
   * This function remains available for older combat UI.
   *
   * InteractiveCombatView can also own the live turn state
   * directly using executeCombatTurn().
   */

  const executePlayerTurn = (
    selectedWeapon?: WeaponOption
  ) => {
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
     * PLAYER ATTACK
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
     * Add player log immediately.
     */

    setCombatLogs(
      (previous) => [
        playerTurn.log,
        ...previous,
      ]
    );

    /*
     * ----------------------------------------------------------
     * PLAYER WINS
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
        })
      );

      return;
    }

    /*
     * ----------------------------------------------------------
     * ENEMY COUNTERATTACK
     * ----------------------------------------------------------
     *
     * No weapon is passed intentionally.
     *
     * combatSystem resolves the enemy's actual equipped weapon.
     */

    const enemyTurn =
      executeCombatTurn(
        updatedEnemy,
        playerFighter
      );

    const updatedPlayer =
      enemyTurn.updatedDefender;

    /*
     * Enemy state does not change from attacking.
     *
     * Player health does.
     */

    setEnemyFighter(
      updatedEnemy
    );

    setPlayerFighter(
      updatedPlayer
    );

    setCombatLogs(
      (previous) => [
        enemyTurn.log,
        playerTurn.log,
        ...previous,
      ]
    );

    /*
     * Keep global player health synchronized.
     */

    setGameState(
      (previous) => ({
        ...previous,
        health:
          updatedPlayer.health,
      })
    );

    /*
     * ----------------------------------------------------------
     * PLAYER DEFEATED
     * ----------------------------------------------------------
     */

    if (
      updatedPlayer.health <= 0
    ) {
      const hospitalUntil =
        Date.now() +
        15 * 60 * 1000;

      setCombatStatus(
        "lost"
      );

      log(
        `Defeated by ${enemyFighter.name}! Sent to hospital.`,
        "jailed"
      );

      setGameState(
        (previous) => ({
          ...previous,

          health: 0,

          hospitalUntil,
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
     * Flee receives a modest bonus.
     *
     * Hard-cap at 95% so escape isn't guaranteed.
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
        `Successfully fled from ${enemyFighter.name}.`
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
     * Enemy gets the counterattack.
     */

    log(
      `Failed to escape! ${enemyFighter.name} hit you as you ran.`
    );

    executePlayerTurn();
  };

  /*
   * ============================================================
   * RETURN API
   * ============================================================
   */

  return {
    gameState,

    setGameState,

    currentScreen,

    setCurrentScreen,

    level,

    property,

    gym,

    job,

    maxHealth,

    maxNerve,

    blocked,

    playerFighter,

    enemyFighter,

    combatLogs,

    combatStatus,

    startCombat,

    executePlayerTurn,

    fleeCombat,
  };
}
