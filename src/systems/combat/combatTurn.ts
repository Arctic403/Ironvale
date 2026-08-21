import type {
  DynamicFighter,
  TurnLog,
  WeaponOption,
} from "./combatTypes";

import {
  resolveAttackWeapon,
} from "./combatWeapons";

import {
  calculateAccuracy,
  calculateHitChance,
  calculateDamage,
  randomBodyPart,
  rollCritical,
} from "./combatDamage";

/*
 * ============================================================
 * EXECUTE ONE COMBAT TURN
 * ============================================================
 */

export function executeCombatTurn(
  attacker: DynamicFighter,
  defender: DynamicFighter,
  weapon?: WeaponOption
): {
  updatedDefender: DynamicFighter;
  log: TurnLog;
} {
  /*
   * Always resolve the weapon through
   * the attacker's real inventory.
   */
  const activeWeapon =
    resolveAttackWeapon(
      attacker,
      weapon
    );

  const isUnarmed =
    activeWeapon.id ===
    "unarmed";

  /*
   * ==========================================================
   * ACCURACY
   * ==========================================================
   */

  const accuracy =
    calculateAccuracy(
      attacker,
      defender,
      activeWeapon
    );

  const hitChance =
    calculateHitChance(
      accuracy
    );

  /*
   * ==========================================================
   * MISS
   * ==========================================================
   */

  if (
    Math.random() * 100 >
    hitChance
  ) {
    return {
      updatedDefender:
        defender,

      log: {
        id:
          `${Date.now()}-${Math.random()}`,

        attacker:
          attacker.name,

        defender:
          defender.name,

        actionText:
          isUnarmed
            ? `${attacker.name} attacked ${defender.name} unarmed but MISSED!`
            : `${attacker.name} attacked with ${activeWeapon.name} but MISSED!`,

        damage: 0,

        isCrit: false,

        isMiss: true,
        weaponId: activeWeapon.id,
        weaponClass: activeWeapon.weaponClass,
        hitChance: Math.round(hitChance),
      },
    };
  }

  /*
   * ==========================================================
   * HIT
   * ==========================================================
   */

  const target =
    randomBodyPart();

  const isCrit =
    rollCritical(
      activeWeapon,
      attacker
    );

  /*
   * ==========================================================
   * DAMAGE
   * ==========================================================
   */

  const finalDamage =
    calculateDamage(
      attacker,
      defender,
      activeWeapon,
      target,
      isCrit
    );

  const newHealth =
    Math.max(
      0,
      defender.health -
        finalDamage
    );

  /*
   * ==========================================================
   * COMBAT TEXT
   * ==========================================================
   */

  const actionText =
    isUnarmed
      ? `${attacker.name} hit ${defender.name} in the ${target.label} unarmed for ${finalDamage} damage!${
          isCrit
            ? " 👊 CRITICAL HIT!"
            : ""
        }`
      : `${attacker.name} hit ${defender.name} in the ${target.label} with ${activeWeapon.name} for ${finalDamage} damage!${
          isCrit
            ? " 🎯 CRITICAL HIT!"
            : ""
        }`;

  /*
   * ==========================================================
   * RESULT
   * ==========================================================
   */

  return {
    updatedDefender: {
      ...defender,
      health:
        newHealth,
    },

    log: {
      id:
        `${Date.now()}-${Math.random()}`,

      attacker:
        attacker.name,

      defender:
        defender.name,

      actionText,

      damage:
        finalDamage,

      isCrit,

      isMiss: false,
      weaponId: activeWeapon.id,
      weaponClass: activeWeapon.weaponClass,
      hitChance: Math.round(hitChance),

      hitPart:
        target.part,
    },
  };
}
