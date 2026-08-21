import type { DistanceZone } from "../../data/dataTypes";

export type BodyPart = "head" | "chest" | "stomach" | "arms" | "legs";
export type WeaponClass = "unarmed" | "blade" | "blunt" | "handgun" | "smg" | "shotgun" | "rifle";

export interface WeaponOption {
  id: string;
  name: string;
  type: "primary" | "secondary" | "melee" | "temporary";
  weaponClass: WeaponClass;
  baseDamage: number;
  /** Base handling chance before fighter stats, weapon skill, range and cover. */
  accuracy: number;
  critChance: number;
  icon?: string;
  optimalZone?: DistanceZone;
  coverPenetration?: number;
}

export interface CombatStats { strength: number; defense: number; speed: number; dexterity: number; }

export interface PlayerProfile {
  id: string;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  stats: CombatStats;
  title?: string;
  status?: "Online" | "Idle" | "Offline";
  location?: string;
  weapons?: WeaponOption[];
  equippedWeaponId?: string | null;
  weaponSkills?: Partial<Record<WeaponClass, number>>;
  weapon?: string;
  armor?: string;
  armorProtection?: number;
  bounty?: number;
  faction?: string;
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
  weaponId: string;
  weaponClass: WeaponClass;
  hitChance: number;
  hitPart?: BodyPart;
}
