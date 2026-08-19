import type {
  DynamicFighter,
  PlayerProfile,
  TurnLog,
} from "./combatTypes";

import {
  calculateWinChance,
} from "./combatStats";

import {
  executeCombatTurn,
} from "./combatTurn";

/*
 * ============================================================
 * SIMULATE COMBAT
 * ============================================================
 *
 * Both fighters use their own actual equipment.
 *
 * No weapon equipped = Unarmed.
 */

export function simulateCombat(
  attacker: PlayerProfile,
  defender: PlayerProfile
) {
  const winChance =
    calculateWinChance(
      attacker.stats,
      defender.stats
    );

  let currentAttacker:
    DynamicFighter = {
      ...attacker,
      zone:
        attacker.zone ??
        "Mid",
    };

  let currentDefender:
    DynamicFighter = {
      ...defender,
      zone:
        defender.zone ??
        "Mid",
    };

  const logs: TurnLog[] = [];

  let rounds = 0;

  /*
   * Hard safety limit.
   */
  const MAX_ROUNDS = 20;

  while (
    currentAttacker.health >
      0 &&
    currentDefender.health >
      0 &&
    rounds <
      MAX_ROUNDS
  ) {
    rounds++;

    /*
     * ========================================================
     * ATTACKER TURN
     * ========================================================
     */

    const attackResult =
      executeCombatTurn(
        currentAttacker,
        currentDefender
      );

    currentDefender =
      attackResult.updatedDefender;

    logs.push(
      attackResult.log
    );

    /*
     * Defender defeated.
     */
    if (
      currentDefender.health <=
      0
    ) {
      break;
    }

    /*
     * ========================================================
     * DEFENDER COUNTERATTACK
     * ========================================================
     */

    const counterResult =
      executeCombatTurn(
        currentDefender,
        currentAttacker
      );

    currentAttacker =
      counterResult.updatedDefender;

    logs.push(
      counterResult.log
    );
  }

  /*
   * ==========================================================
   * DETERMINE RESULT
   * ==========================================================
   */

  const attackerAlive =
    currentAttacker.health >
    0;

  const defenderAlive =
    currentDefender.health >
    0;

  let winner:
    DynamicFighter;

  let loser:
    DynamicFighter;

  /*
   * Attacker wins.
   */
  if (
    attackerAlive &&
    !defenderAlive
  ) {
    winner =
      currentAttacker;

    loser =
      currentDefender;
  }

  /*
   * Defender wins.
   */
  else if (
    defenderAlive &&
    !attackerAlive
  ) {
    winner =
      currentDefender;

    loser =
      currentAttacker;
  }

  /*
   * Draw / round limit.
   *
   * Higher remaining health wins.
   */
  else {
    if (
      currentAttacker.health >=
      currentDefender.health
    ) {
      winner =
        currentAttacker;

      loser =
        currentDefender;
    } else {
      winner =
        currentDefender;

      loser =
        currentAttacker;
    }
  }

  const isWin =
    winner.id ===
    attacker.id;

  return {
    isWin,
    winChance,
    logs,
    winner,
    loser,
  };
}
