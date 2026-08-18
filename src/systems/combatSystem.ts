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
   * Weapons the fighter actually owns.
   *
   * IMPORTANT:
   * Owning a weapon does NOT automatically equip it.
   */
  weapons?: WeaponOption[];

  /*
   * The ID of the weapon currently equipped.
   *
   * If undefined/null, the fighter is UNARMED.
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
 * ============================================================
 * UNARMED COMBAT
 * ============================================================
 *
 * Unarmed is NOT an inventory item.
 *
 * It is always available to every player.
 *
 * There are intentionally NO DEFAULT WEAPONS here.
 *
 * The player does NOT automatically receive:
 *
 * - AK-47
 * - Pistol
 * - Knife
 * - Bat
 * - Pepper Spray
 *
 * A weapon must actually exist in the fighter's inventory
 * and be equipped before combat can use it.
 */

const UNARMED_WEAPON: WeaponOption = {
  id: "unarmed",
  name: "Unarmed",
  type: "melee",
  baseDamage: 8,
  accuracy: 65,
  critChance: 8,
  optimalZone: "Close",
  coverPenetration: 0,
};

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
 * ITEM → COMBAT WEAPON
 * ============================================================
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
    optimalZone:
      item.optimalRange,
    coverPenetration:
      item.coverPenetration ?? 0,
  };
}

/*
 * ============================================================
 * RESOLVE EQUIPPED WEAPON
 * ============================================================
 *
 * This function is deliberately strict.
 *
 * A fighter gets a weapon ONLY if:
 *
 * 1. They have equippedWeaponId
 * 2. They actually own that weapon
 *
 * Otherwise:
 *
 * UNARMED.
 *
 * We do NOT fall back to:
 *
 * - DEFAULT_WEAPONS
 * - random weapons
 * - the first weapon in inventory
 * - a global weapon catalog
 */

function resolveEquippedWeapon(
  fighter: DynamicFighter
): WeaponOption | null {
  if (!fighter.equippedWeaponId) {
    return null;
  }

  /*
   * The weapon must exist in the fighter's inventory.
   */
  const ownedWeapon =
    fighter.weapons?.find(
      (weapon) =>
        weapon.id ===
        fighter.equippedWeaponId
    );

  if (ownedWeapon) {
    return ownedWeapon;
  }

  /*
   * If the inventory stores only IDs rather than full
   * WeaponOption objects, we can resolve the item from
   * gameData.
   *
   * BUT we still require that the ID was present in
   * fighter.weapons.
   *
   * Therefore this catalog lookup does NOT grant ownership.
   */

  const item =
    getItem(
      fighter.equippedWeaponId
    );

  if (!item) {
    return null;
  }

  /*
   * The fighter claimed an equipped ID but does not have
   * a matching owned weapon object.
   *
   * Do NOT grant it.
   */
  return null;
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

  if (pSum + oSum <= 0) {
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
   * ==========================================================
   * WEAPON SELECTION
   * ==========================================================
   *
   * Priority:
   *
   * 1. Explicit weapon passed by the combat UI
   * 2. Currently equipped weapon
   * 3. UNARMED
   *
   * There is NO DEFAULT WEAPON.
   */

  let activeWeapon: WeaponOption;

  if (weapon) {
    /*
     * If a weapon is explicitly supplied, make sure the
     * attacker actually owns it unless it is Unarmed.
     */

    if (weapon.id === "unarmed") {
      activeWeapon =
        UNARMED_WEAPON;
    } else {
      const ownsWeapon =
        attacker.weapons?.some(
          (owned) =>
            owned.id === weapon.id
        );

      if (ownsWeapon) {
        activeWeapon =
          weapon;
      } else {
        /*
         * Security/integrity fallback:
         *
         * Player attempted to attack with a weapon they
         * don't own.
         *
         * They fight unarmed instead.
         */
        activeWeapon =
          UNARMED_WEAPON;
      }
    }
  } else {
    activeWeapon =
      resolveEquippedWeapon(
        attacker
      ) ??
      UNARMED_WEAPON;
  }

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
      (1 -
        coverPenetration);

    accuracy -=
      coverPenalty;
  }

  /*
   * Unarmed-specific range handling.
   */

  if (isUnarmed) {
    accuracy =
      65 +
      (
        attacker.stats.dexterity -
        defender.stats.speed
      ) *
        2;

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

    if (
      defender.inCover
    ) {
      accuracy -=
        15;
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
          Math.random().toString(),

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
      : 1.0;

  /*
   * ==========================================================
   * DAMAGE
   * ==========================================================
   */

  let rawDamage: number;

  if (isUnarmed) {
    /*
     * Unarmed attack:
     *
     * Strength is the main offensive stat.
     * Defense reduces incoming damage.
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
     * Armed attack:
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
   * Final damage.
   */

  const finalDamage =
    Math.max(
      isUnarmed
        ? 2
        : 4,
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

  return {
    updatedDefender: {
      ...defender,
      health: newHealth,
    },

    log: {
      id:
        Math.random().toString(),

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

  let currentAttacker: DynamicFighter =
    {
      ...attacker,
      zone:
        attacker.zone ??
        "Mid",
    };

  let currentDefender: DynamicFighter =
    {
      ...defender,
      zone:
        defender.zone ??
        "Mid",
    };

  const logs: TurnLog[] = [];

  let rounds = 0;

  /*
   * Actual combat simulation.
   *
   * We do NOT use a pre-rolled win result.
   */

  while (
    currentAttacker.health >
      0 &&
    currentDefender.health >
      0 &&
    rounds < 20
  ) {
    rounds++;

    /*
     * Attacker uses:
     *
     * equipped weapon
     * OR unarmed
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
      currentDefender.health <=
      0
    ) {
      break;
    }

    /*
     * Defender uses THEIR OWN equipment.
     *
     * If they have no weapon:
     * UNARMED.
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
   * Determine winner from actual combat state.
   */

  const actualWin =
    currentAttacker.health >
    0;

  return {
    isWin: actualWin,

    winChance,

    logs,

    winner:
      actualWin
        ? currentAttacker
        : currentDefender,

    loser:
      actualWin
        ? currentDefender
        : currentAttacker,
  };
}
