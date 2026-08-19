import type {
  CombatStats,
} from "./combatTypes";

/*
 * ============================================================
 * WIN CHANCE
 * ============================================================
 */

export function calculateWinChance(
  playerStats: CombatStats,
  opponentStats: CombatStats
): number {
  const playerTotal =
    playerStats.strength +
    playerStats.defense +
    playerStats.speed +
    playerStats.dexterity;

  const opponentTotal =
    opponentStats.strength +
    opponentStats.defense +
    opponentStats.speed +
    opponentStats.dexterity;

  /*
   * Protect against malformed profiles.
   */
  if (
    playerTotal +
      opponentTotal <=
    0
  ) {
    return 50;
  }

  const chance =
    (playerTotal /
      (playerTotal +
        opponentTotal)) *
    100;

  return Math.min(
    95,
    Math.max(
      5,
      Math.round(chance)
    )
  );
}
