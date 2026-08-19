import type { DistanceZone } from "../../data/gameData";

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

  title?: string;
  status?: "Online" | "Idle" | "Offline";
  location?: string;

  weapons?: WeaponOption[];

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
