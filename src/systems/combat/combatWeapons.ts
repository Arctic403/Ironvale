import type {
  DynamicFighter,
  WeaponOption,
} from "./combatTypes";

/*
 * ============================================================
 * UNARMED
 * ============================================================
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
 * DEFAULT WEAPONS
 * ============================================================
 *
 * These are starter/test weapons.
 *
 * IMPORTANT:
 * They are NOT automatically equipped.
 */

export const DEFAULT_WEAPONS: WeaponOption[] = [
  UNARMED_WEAPON,

  {
    id: "knife",
    name: "Street Knife",
    type: "melee",
    baseDamage: 8,
    accuracy: 85,
    critChance: 10,
    optimalZone: "Close",
    coverPenetration: 0.1,
  },

  {
    id: "bat",
    name: "Baseball Bat",
    type: "melee",
    baseDamage: 15,
    accuracy: 75,
    critChance: 8,
    optimalZone: "Close",
    coverPenetration: 0.2,
  },

  {
    id: "pistol",
    name: "9mm Pistol",
    type: "primary",
    baseDamage: 35,
    accuracy: 70,
    critChance: 12,
    optimalZone: "Mid",
    coverPenetration: 0.4,
  },
];

/*
 * ============================================================
 * OWNERSHIP
 * ============================================================
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

/*
 * ============================================================
 * GET OWNED WEAPON
 * ============================================================
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

/*
 * ============================================================
 * RESOLVE EQUIPPED WEAPON
 * ============================================================
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

/*
 * ============================================================
 * RESOLVE ATTACK WEAPON
 * ============================================================
 */

export function resolveAttackWeapon(
  fighter: DynamicFighter,
  requestedWeapon?: WeaponOption
): WeaponOption {
  if (!requestedWeapon) {
    return resolveEquippedWeapon(
      fighter
    );
  }

  if (
    requestedWeapon.id ===
    "unarmed"
  ) {
    return UNARMED_WEAPON;
  }

  const ownedWeapon =
    getOwnedWeapon(
      fighter,
      requestedWeapon.id
    );

  if (!ownedWeapon) {
    return UNARMED_WEAPON;
  }

  return ownedWeapon;
}
