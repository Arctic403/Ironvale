import {
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
   * Weapons the fighter ACTUALLY OWNS.
   *
   * This list is inventory ownership.
   *
   * Owning a weapon does NOT automatically equip it.
   */
  weapons?: WeaponOption[];

  /*
   * ID of the weapon currently equipped.
   *
   * undefined/null = UNARMED.
   */
  equippedWeaponId?: string | null;

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
 * ============================================================
 * UNARMED
 * ============================================================
 *
 * Every player has this automatically.
 *
 * It is NOT an inventory item.
 *
 * It is NOT purchasable.
 *
 * It is NOT stored in weapons[].
 *
 * It is the fallback whenever the player does not have a
 * legitimate equipped weapon.
 */
export const UNARMED_WEAPON: WeaponOption = {
  id: "unarmed",
  name: "Unarmed",
  type: "melee",
  baseDamage: 8,
  accuracy: 65,
  critChance: 8,
  optimalZone: "Close",
  coverPenetration: 0,
};

/*
 * ============================================================
 * BODY PARTS
 * ============================================================
 */

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

/*
 * ============================================================
 * DISTANCE ZONES
 * ============================================================
 */

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
 * Returns true if the fighter actually owns the specified
 * weapon.
 */
export function ownsWeapon(
  fighter: DynamicFighter,
  weaponId: string
): boolean {
  if (!weaponId) {
    return false;
  }

  if (weaponId === "unarmed") {
    return true;
  }

  return (
    fighter.weapons?.some(
      (weapon) =>
        weapon.id === weaponId
    ) ?? false
  );
}

/**
 * Finds a weapon in the fighter's actual inventory.
 *
 * IMPORTANT:
 *
 * This searches ONLY the player's weapons[].
 *
 * It does not search gameData.
 * It does not search DEFAULT_WEAPONS.
 * It does not create weapons.
 */
export function getOwnedWeapon(
  fighter: DynamicFighter,
  weaponId: string
): WeaponOption | null {
  if (!weaponId) {
    return null;
  }

  if (weaponId === "unarmed") {
    return UNARMED_WEAPON;
  }

  return (
    fighter.weapons?.find(
      (weapon) =>
        weapon.id === weaponId
    ) ?? null
  );
}

/**
 * Resolves the weapon the player is ACTUALLY equipped with.
 *
 * Rules:
 *
 * 1. No equippedWeaponId = Unarmed.
 * 2. equippedWeaponId must exist in weapons[].
 * 3. If it doesn't exist in weapons[], Unarmed.
 *
 * This prevents hacked/stale UI state from creating weapons.
 */
export function resolveEquippedWeapon(
  fighter: DynamicFighter
): WeaponOption {
  if (!fighter.equippedWeaponId) {
    return UNARMED_WEAPON;
  }

  const equippedWeapon =
    getOwnedWeapon(
      fighter,
      fighter.equippedWeaponId
    );

  if (!equippedWeapon) {
    return UNARMED_WEAPON;
  }

  return equippedWeapon;
}

/**
 * Resolves an explicitly requested attack weapon.
 *
 * This is used when the combat UI sends a weapon choice.
 *
 * The requested weapon MUST:
 *
 * - be Unarmed
 *
 * OR
 *
 * - exist in the player's weapons[]
 *
 * Otherwise the attack becomes Unarmed.
 */
export function resolveAttackWeapon(
  fighter: DynamicFighter,
  requestedWeapon?: WeaponOption
): WeaponOption {
  /*
   * No weapon explicitly selected.
   *
   * Use equipped weapon.
   */
  if (!requestedWeapon) {
    return resolveEquippedWeapon(
      fighter
    );
  }

  /*
   * Unarmed is always legal.
   */
  if (
    requestedWeapon.id ===
    "unarmed"
  ) {
    return UNARMED_WEAPON;
  }

  /*
   * Verify the weapon exists in the
   * fighter's actual inventory.
   */
  const ownedWeapon =
    getOwnedWeapon(
      fighter,
      requestedWeapon.id
    );

  /*
   * Player does not own it.
   *
   * They fight unarmed.
   */
  if (!ownedWeapon) {
    return UNARMED_WEAPON;
  }

  /*
   * Use the inventory copy rather than blindly trusting
   * whatever the UI supplied.
   */
  return ownedWeapon;
}

/*
 * ============================================================
 * WIN CHANCE
 * ============================================================
 */

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
   * Protect against malformed profiles.
   */
  if (
    pSum + oSum <=
    0
  ) {
    return 50;
  }

  const chance =
    (pSum /
      (pSum + oSum)) *
    100;

  return Math.min(
    95,
    Math.max(
      5,
      Math.round(chance)
    )
  );
}

/*
 * ============================================================
 * EXECUTE COMBAT TURN
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
   * Resolve the weapon through the attacker's REAL
   * inventory/equipment state.
   *
   * There is NO default firearm.
   */
  const activeWeapon =
    resolveAttackWeapon(
      attacker,
      weapon
    );

  const isUnarmed =
    activeWeapon.id ===
    "unarmed";

  const defenderZone: DistanceZone =
    defender.zone ??
    "Mid";

  const optimalZone: DistanceZone =
    activeWeapon.optimalZone ??
    "Close";

  const coverPenetration =
    activeWeapon.coverPenetration ??
    0;

  /*
   * ==========================================================
   * ACCURACY
   * ==========================================================
   */

  let accuracy =
    activeWeapon.accuracy +
    (
      attacker.stats.dexterity -
      defender.stats.speed
    ) *
      2;

  /*
   * Range penalty.
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
  if (
    defender.inCover
  ) {
    const coverPenalty =
      20 *
      (
        1 -
        coverPenetration
      );

    accuracy -=
      coverPenalty;
  }

  /*
   * Unarmed-specific range rules.
   */
  if (isUnarmed) {
    accuracy =
      UNARMED_WEAPON.accuracy +
      (
        attacker.stats.dexterity -
        defender.stats.speed
      ) *
        2;

    /*
     * Unarmed attacks are strongest at Close range.
     */
    if (
      defenderZone !==
      "Close"
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
     * Cover is particularly useful against an
     * unarmed attacker.
     */
    if (
      defender.inCover
    ) {
      accuracy -= 15;
    }
  }

  const hitChance =
    Math.min(
      95,
      Math.max(
        15,
        accuracy
      )
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
      },
    };
  }

  /*
   * ==========================================================
   * HIT
   * ==========================================================
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
    isCrit
      ? 1.75
      : 1;

  /*
   * ==========================================================
   * DAMAGE
   * ==========================================================
   */

  let rawDamage: number;

  if (isUnarmed) {
    /*
     * Unarmed:
     *
     * Strength provides the majority of damage.
     * Defense reduces the incoming damage.
     */
    rawDamage =
      (
        UNARMED_WEAPON.baseDamage +
        attacker.stats.strength *
          0.9 -
        defender.stats.defense *
          0.45
      ) *
      target.multiplier *
      critMultiplier;
  } else {
    /*
     * Armed:
     *
     * Weapon damage + strength.
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
   * Optimal range modifier.
   */
  rawDamage *=
    optimalZone ===
    defenderZone
      ? 1.2
      : 0.8;

  /*
   * Cover damage reduction.
   */
  if (
    defender.inCover
  ) {
    rawDamage *=
      0.5 +
      coverPenetration *
        0.3;
  }

  /*
   * Prevent negative/zero damage.
   */
  const minimumDamage =
    isUnarmed
      ? 2
      : 4;

  const finalDamage =
    Math.max(
      minimumDamage,
      Math.floor(
        rawDamage +
          (
            Math.random() *
              6 -
            3
          )
      )
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

      hitPart:
        target.part,
    },
  };
}

/*
 * ============================================================
 * SIMULATE COMBAT
 * ============================================================
 *
 * Both fighters independently use their own equipment.
 *
 * Attacker:
 *   equipped weapon -> weapon
 *   no equipped weapon -> unarmed
 *
 * Defender:
 *   equipped weapon -> weapon
 *   no equipped weapon -> unarmed
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
   * Maximum 20 rounds prevents an accidental infinite
   * combat loop.
   */
  while (
    currentAttacker.health >
      0 &&
    currentDefender.health >
      0 &&
    rounds <
      20
  ) {
    rounds++;

    /*
     * ATTACKER TURN
     *
     * Uses their equipped weapon.
     * Otherwise unarmed.
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

    /*
     * Defender died.
     */
    if (
      currentDefender.health <=
      0
    ) {
      break;
    }

    /*
     * DEFENDER COUNTERATTACK
     *
     * Uses THEIR equipment.
     * Otherwise unarmed.
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
   * ACTUAL RESULT
   * ==========================================================
   *
   * The winner is determined from the actual combat state.
   *
   * We do NOT use the old pre-rolled isWin value.
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
   * Attacker alive and defender dead.
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
   * Defender alive and attacker dead.
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
   * 20-round limit or unusual draw state.
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

    /*
     * Keep this for UI information.
     */
    winChance,

    logs,

    winner,

    loser,
  };
}
