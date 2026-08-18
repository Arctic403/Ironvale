import {
  getItem,
  Item,
  DistanceZone,
} from "../data/gameData";

export type BodyPart =
  | "head"
  | "chest"
  | "stomach"
  | "arms"
  | "legs";

export interface WeaponOption {
  id: string;
  name: string;
  type:
    | "primary"
    | "secondary"
    | "melee"
    | "temporary";
  baseDamage: number;
  accuracy: number;
  critChance: number;
  icon?: string;
  optimalZone?: DistanceZone;
  coverPenetration?: number;
}

export interface CombatStats {
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  stats: CombatStats;

  /*
   * weapons = weapons the player owns.
   *
   * IMPORTANT:
   * Having a weapon here does NOT mean it is equipped.
   */
  weapons?: WeaponOption[];

  /*
   * Only this determines the currently equipped weapon
   * when no explicit weapon is supplied to executeCombatTurn().
   */
  equippedWeaponId?: string;

  cashReward?: number;
  xpReward?: number;
  zone?: DistanceZone;
  inCover?: boolean;
}

export type DynamicFighter = PlayerProfile;

export interface TurnLog {
  id: string;
  attacker: string;
  defender: string;
  actionText: string;
  damage: number;
  isCrit: boolean;
  isMiss: boolean;
  hitPart?: BodyPart;
}

/*
 * These are weapon definitions available to the combat system.
 *
 * IMPORTANT:
 * They are NOT automatically equipped.
 *
 * A player must explicitly have the corresponding weapon
 * equipped or have it explicitly passed into executeCombatTurn().
 */
export const DEFAULT_WEAPONS: WeaponOption[] = [
  {
    id: "primary",
    name: "AK-47",
    type: "primary",
    baseDamage: 32,
    accuracy: 75,
    critChance: 18,
    icon: "🔫",
    optimalZone: "Mid",
    coverPenetration: 0.4,
  },

  {
    id: "secondary",
    name: "9mm Pistol",
    type: "secondary",
    baseDamage: 22,
    accuracy: 85,
    critChance: 12,
    icon: "🔫",
    optimalZone: "Mid",
    coverPenetration: 0.2,
  },

  {
    id: "melee",
    name: "Combat Knife",
    type: "melee",
    baseDamage: 18,
    accuracy: 92,
    critChance: 25,
    icon: "🔪",
    optimalZone: "Close",
    coverPenetration: 0.1,
  },

  {
    id: "temporary",
    name: "Pepper Spray",
    type: "temporary",
    baseDamage: 10,
    accuracy: 98,
    critChance: 5,
    icon: "🌶️",
    optimalZone: "Close",
    coverPenetration: 0.0,
  },
];

const BODY_PARTS: {
  part: BodyPart;
  multiplier: number;
  label: string;
}[] = [
  {
    part: "head",
    multiplier: 1.8,
    label: "Head",
  },
  {
    part: "chest",
    multiplier: 1.2,
    label: "Chest",
  },
  {
    part: "stomach",
    multiplier: 1.1,
    label: "Stomach",
  },
  {
    part: "arms",
    multiplier: 0.8,
    label: "Arm",
  },
  {
    part: "legs",
    multiplier: 0.9,
    label: "Leg",
  },
];

const ZONE_DISTANCE_MAP: Record<
  DistanceZone,
  number
> = {
  Close: 1,
  Mid: 2,
  Long: 3,
};

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Converts an Item from gameData into the combat system's
 * WeaponOption format.
 */
function itemToWeapon(
  item: Item
): WeaponOption | null {
  if (item.type !== "weapon") {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    type: "temporary",
    baseDamage: item.effect ?? 1,
    accuracy: item.accuracy ?? 70,
    critChance: 10,
    optimalZone: item.optimalRange,
    coverPenetration:
      item.coverPenetration ?? 0,
  };
}

/**
 * Resolves ONLY an explicitly equipped weapon.
 *
 * No equipped weapon means null.
 *
 * This is intentionally separate from the player's owned
 * weapons list. Owning a weapon does not automatically equip it.
 */
function resolveEquippedWeapon(
  fighter: DynamicFighter
): WeaponOption | null {
  if (!fighter.equippedWeaponId) {
    return null;
  }

  /*
   * First check the fighter's owned weapons.
   *
   * This ensures the player actually owns the weapon
   * they claim to have equipped.
   */
  const ownedWeapon =
    fighter.weapons?.find(
      (owned) =>
        owned.id ===
        fighter.equippedWeaponId
    );

  if (ownedWeapon) {
    return ownedWeapon;
  }

  /*
   * Then check the global item catalog.
   *
   * This supports the current RiftCity player profile
   * structure where equippedWeaponId can point directly
   * to an ITEM such as "knife", "bat", or "pistol".
   */
  const item = getItem(
    fighter.equippedWeaponId
  );

  if (!item) {
    return null;
  }

  return itemToWeapon(item);
}

/**
 * Creates an unarmed combat weapon.
 *
 * This is NOT an inventory item.
 * It represents the player's natural physical attack.
 */
function createUnarmedWeapon(): WeaponOption {
  return {
    id: "unarmed",
    name: "Unarmed",
    type: "melee",
    baseDamage: 8,
    accuracy: 65,
    critChance: 8,
    optimalZone: "Close",
    coverPenetration: 0,
  };
}

export function calculateWinChance(
  playerStats: CombatStats,
  opponentStats: CombatStats
): number {
  const pSum =
    playerStats.strength +
    playerStats.defense +
    playerStats.speed +
    playerStats.dexterity;

  const oSum =
    opponentStats.strength +
    opponentStats.defense +
    opponentStats.speed +
    opponentStats.dexterity;

  /*
   * Prevent division by zero if a malformed profile
   * somehow reaches combat.
   */
  if (pSum + oSum <= 0) {
    return 50;
  }

  const chance =
    (pSum / (pSum + oSum)) * 100;

  return Math.min(
    95,
    Math.max(5, Math.round(chance))
  );
}

export function executeCombatTurn(
  attacker: DynamicFighter,
  defender: DynamicFighter,
  weapon?: WeaponOption
): {
  updatedDefender: DynamicFighter;
  log: TurnLog;
} {
  /*
   * ============================================================
   * WEAPON RESOLUTION
   * ============================================================
   *
   * Priority:
   *
   * 1. Explicit weapon passed to this turn.
   * 2. Attacker's equippedWeaponId.
   * 3. Unarmed.
   *
   * NEVER:
   *
   * - randomly select from weapons[]
   * - automatically give DEFAULT_WEAPONS
   * - give the player a weapon they don't have equipped
   */

  const activeWeapon =
    weapon ??
    resolveEquippedWeapon(attacker) ??
    createUnarmedWeapon();

  const isUnarmed =
    activeWeapon.id === "unarmed";

  const defenderZone: DistanceZone =
    defender.zone || "Mid";

  const optimalZone: DistanceZone =
    activeWeapon.optimalZone ||
    "Close";

  const coverPenetration =
    activeWeapon.coverPenetration ?? 0;

  /*
   * ============================================================
   * ACCURACY
   * ============================================================
   */

  let accuracy =
    activeWeapon.accuracy +
    (
      attacker.stats.dexterity -
      defender.stats.speed
    ) *
      2;

  /*
   * Spatial penalty.
   */
  if (
    optimalZone !==
    defenderZone
  ) {
    const zoneDelta =
      Math.abs(
        ZONE_DISTANCE_MAP[
          optimalZone
        ] -
          ZONE_DISTANCE_MAP[
            defenderZone
          ]
      );

    accuracy -=
      zoneDelta * 25;
  }

  /*
   * Cover penalty.
   */
  if (defender.inCover) {
    const coverPenalty =
      20 *
      (1 - coverPenetration);

    accuracy -= coverPenalty;
  }

  /*
   * Unarmed combat gets a slightly different accuracy
   * baseline because its weapon definition is deliberately
   * generic.
   */
  if (isUnarmed) {
    accuracy =
      65 +
      (
        attacker.stats.dexterity -
        defender.stats.speed
      ) *
        2;

    /*
     * Unarmed attacks are primarily close-range.
     */
    if (
      defenderZone !== "Close"
    ) {
      const zoneDelta =
        Math.abs(
          ZONE_DISTANCE_MAP[
            "Close"
          ] -
            ZONE_DISTANCE_MAP[
              defenderZone
            ]
        );

      accuracy -=
        zoneDelta * 20;
    }

    /*
     * Cover makes unarmed attacks harder.
     */
    if (defender.inCover) {
      accuracy -= 15;
    }
  }

  const hitChance = Math.min(
    95,
    Math.max(15, accuracy)
  );

  /*
   * ============================================================
   * MISS
   * ============================================================
   */

  if (
    Math.random() * 100 >
    hitChance
  ) {
    return {
      updatedDefender: defender,

      log: {
        id: Math.random().toString(),

        attacker:
          attacker.name,

        defender:
          defender.name,

        actionText: isUnarmed
          ? `${attacker.name} attacked ${defender.name} unarmed but MISSED!`
          : `${attacker.name} attacked with ${activeWeapon.name} but MISSED!`,

        damage: 0,

        isCrit: false,

        isMiss: true,
      },
    };
  }

  /*
   * ============================================================
   * HIT
   * ============================================================
   */

  const target =
    BODY_PARTS[
      Math.floor(
        Math.random() *
          BODY_PARTS.length
      )
    ];

  const isCrit =
    Math.random() * 100 <
    activeWeapon.critChance;

  const critMultiplier =
    isCrit ? 1.75 : 1.0;

  /*
   * ============================================================
   * DAMAGE
   * ============================================================
   */

  let rawDamage: number;

  if (isUnarmed) {
    /*
     * Unarmed damage scales primarily from strength.
     *
     * Defense still mitigates damage.
     */
    rawDamage =
      (
        activeWeapon.baseDamage +
        attacker.stats.strength *
          0.9 -
        defender.stats.defense *
          0.45
      ) *
      target.multiplier *
      critMultiplier;
  } else {
    /*
     * Armed damage.
     */
    rawDamage =
      (
        activeWeapon.baseDamage +
        attacker.stats.strength *
          1.2 -
        defender.stats.defense *
          0.6
      ) *
      target.multiplier *
      critMultiplier;
  }

  /*
   * Optimal zone modifier.
   *
   * Unarmed attacks are naturally strongest at Close range.
   */
  rawDamage *=
    optimalZone ===
    defenderZone
      ? 1.2
      : 0.8;

  /*
   * Cover damage absorption.
   */
  if (defender.inCover) {
    rawDamage *=
      0.5 +
      coverPenetration * 0.3;
  }

  /*
   * Never allow negative or zero damage.
   */
  const finalDamage = Math.max(
    isUnarmed ? 2 : 4,
    Math.floor(
      rawDamage +
        (Math.random() * 6 - 3)
    )
  );

  const newHealth = Math.max(
    0,
    defender.health -
      finalDamage
  );

  /*
   * ============================================================
   * COMBAT LOG
   * ============================================================
   */

  let actionText: string;

  if (isUnarmed) {
    actionText =
      `${attacker.name} hit ${defender.name} in the ${target.label} unarmed for ${finalDamage} damage!${
        isCrit
          ? " 👊 CRITICAL HIT!"
          : ""
      }`;
  } else {
    actionText =
      `${attacker.name} hit ${defender.name} in the ${target.label} with ${activeWeapon.name} for ${finalDamage} damage!${
        isCrit
          ? " 🎯 CRITICAL HIT!"
          : ""
      }`;
  }

  return {
    updatedDefender: {
      ...defender,
      health: newHealth,
    },

    log: {
      id: Math.random().toString(),

      attacker:
        attacker.name,

      defender:
        defender.name,

      actionText,

      damage:
        finalDamage,

      isCrit,

      isMiss: false,

      hitPart:
        target.part,
    },
  };
}

export function simulateCombat(
  attacker: PlayerProfile,
  defender: PlayerProfile
) {
  const winChance =
    calculateWinChance(
      attacker.stats,
      defender.stats
    );

  /*
   * This determines the final combat outcome for
   * the simulation while the actual turn-by-turn
   * combat generates the logs.
   */
  const isWin =
    Math.random() * 100 <
    winChance;

  let currentAttacker = {
    ...attacker,
    zone:
      attacker.zone || "Mid",
  };

  let currentDefender = {
    ...defender,
    zone:
      defender.zone || "Mid",
  };

  const logs: TurnLog[] = [];

  let rounds = 0;

  while (
    currentAttacker.health > 0 &&
    currentDefender.health > 0 &&
    rounds < 20
  ) {
    rounds++;

    /*
     * Attacker's equipped weapon is resolved automatically.
     */
    const turnResult =
      executeCombatTurn(
        currentAttacker,
        currentDefender
      );

    currentDefender =
      turnResult.updatedDefender;

    logs.push(
      turnResult.log
    );

    if (
      currentDefender.health <= 0
    ) {
      break;
    }

    /*
     * Defender counter-attacks using THEIR OWN
     * equipped weapon.
     *
     * If they have no weapon, they fight unarmed.
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
   * Determine the actual winner from health.
   *
   * This is more trustworthy than the initial winChance,
   * because the combat log represents what actually happened.
   */
  const actualWin =
    currentAttacker.health >
    0;

  return {
    isWin: actualWin,

    /*
     * Keep the calculated chance available for UI/debugging.
     */
    winChance,

    logs,

    winner: actualWin
      ? currentAttacker
      : currentDefender,

    loser: actualWin
      ? currentDefender
      : currentAttacker,
  };
}
