import type { DistanceZone } from "../../data/gameData";

import type {
  BodyPart,
  DynamicFighter,
  WeaponOption,
} from "./combatTypes";

/*
 * ============================================================
 * BODY PARTS
 * ============================================================
 */

export const BODY_PARTS: {
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
 * DISTANCE
 * ============================================================
 */

export const ZONE_DISTANCE_MAP: Record<
  DistanceZone,
  number
> = {
  Close: 1,
  Mid: 2,
  Long: 3,
};

/*
 * ============================================================
 * ACCURACY
 * ============================================================
 */

export function calculateAccuracy(
  attacker: DynamicFighter,
  defender: DynamicFighter,
  weapon: WeaponOption
): number {
  const isUnarmed =
    weapon.id === "unarmed";

  const defenderZone =
    defender.zone ?? "Mid";

  const optimalZone =
    weapon.optimalZone ?? "Close";

  const coverPenetration =
    weapon.coverPenetration ?? 0;

  let accuracy =
    weapon.accuracy +
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
   * Special unarmed rules.
   */
  if (isUnarmed) {
    accuracy =
      weapon.accuracy +
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
      accuracy -= 15;
    }
  }

  return accuracy;
}

/*
 * ============================================================
 * HIT CHANCE
 * ============================================================
 */

export function calculateHitChance(
  accuracy: number
): number {
  return Math.min(
    95,
    Math.max(
      15,
      accuracy
    )
  );
}

/*
 * ============================================================
 * BODY PART
 * ============================================================
 */

export function randomBodyPart() {
  return BODY_PARTS[
    Math.floor(
      Math.random() *
        BODY_PARTS.length
    )
  ];
}

/*
 * ============================================================
 * CRITICAL HIT
 * ============================================================
 */

export function rollCritical(
  weapon: WeaponOption
): boolean {
  return (
    Math.random() * 100 <
    weapon.critChance
  );
}

/*
 * ============================================================
 * DAMAGE
 * ============================================================
 */

export function calculateDamage(
  attacker: DynamicFighter,
  defender: DynamicFighter,
  weapon: WeaponOption,
  target: {
    multiplier: number;
  },
  isCrit: boolean
): number {
  const isUnarmed =
    weapon.id === "unarmed";

  const defenderZone =
    defender.zone ?? "Mid";

  const optimalZone =
    weapon.optimalZone ?? "Close";

  const coverPenetration =
    weapon.coverPenetration ?? 0;

  const critMultiplier =
    isCrit
      ? 1.75
      : 1;

  let rawDamage: number;

  if (isUnarmed) {
    rawDamage =
      (
        weapon.baseDamage +
        attacker.stats.strength *
          0.9 -
        defender.stats.defense *
          0.45
      ) *
      target.multiplier *
      critMultiplier;
  } else {
    rawDamage =
      (
        weapon.baseDamage +
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
   * Cover reduction.
   */
  if (
    defender.inCover
  ) {
    rawDamage *=
      0.5 +
      coverPenetration *
        0.3;
  }

  const minimumDamage =
    isUnarmed
      ? 2
      : 4;

  return Math.max(
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
}
