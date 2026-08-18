import { CombatStats } from "../systems/progressionSystem";

export interface PlayerProfile {
  id: string;
  name: string;
  level: number;
  title: string;
  status: "Online" | "Idle" | "Offline";
  location: string;
  health: number;
  maxHealth: number;
  stats: CombatStats;
  weapon: string;
  armor: string;
  bounty: number;
  cashReward: number;
  xpReward: number;
  faction: string;
}

export const PLAYER_PROFILES: PlayerProfile[] = [
  {
    id: "piper",
    name: "Piper",
    level: 2,
    title: "Street Runner",
    status: "Online",
    location: "City Center",
    health: 105,
    maxHealth: 105,
    stats: { strength: 7, defense: 6, speed: 9, dexterity: 8 },
    weapon: "Compact Bat",
    armor: "Street Jacket",
    bounty: 75,
    cashReward: 120,
    xpReward: 18,
    faction: "Unaffiliated",
  },
  {
    id: "mako",
    name: "Mako",
    level: 4,
    title: "Dock Hustler",
    status: "Idle",
    location: "The Docks",
    health: 125,
    maxHealth: 125,
    stats: { strength: 11, defense: 10, speed: 12, dexterity: 11 },
    weapon: "Heavy Bat",
    armor: "Reinforced Jacket",
    bounty: 150,
    cashReward: 220,
    xpReward: 28,
    faction: "Dock Union",
  },
  {
    id: "rhea",
    name: "Rhea",
    level: 6,
    title: "Street Fighter",
    status: "Online",
    location: "Industrial District",
    health: 145,
    maxHealth: 145,
    stats: { strength: 16, defense: 14, speed: 15, dexterity: 16 },
    weapon: "Combat Blade",
    armor: "Tactical Vest",
    bounty: 250,
    cashReward: 360,
    xpReward: 40,
    faction: "Iron Syndicate",
  },
  {
    id: "vex",
    name: "Vex",
    level: 9,
    title: "Veteran",
    status: "Idle",
    location: "Suburbs",
    health: 175,
    maxHealth: 175,
    stats: { strength: 23, defense: 22, speed: 20, dexterity: 24 },
    weapon: "Heavy Pistol",
    armor: "Tactical Vest",
    bounty: 500,
    cashReward: 700,
    xpReward: 65,
    faction: "Rift Guard",
  },
  {
    id: "onyx",
    name: "Onyx",
    level: 13,
    title: "Enforcer",
    status: "Offline",
    location: "The Docks",
    health: 215,
    maxHealth: 215,
    stats: { strength: 32, defense: 29, speed: 27, dexterity: 31 },
    weapon: "Carbine",
    armor: "Heavy Vest",
    bounty: 900,
    cashReward: 1200,
    xpReward: 95,
    faction: "Iron Syndicate",
  },
  {
    id: "nova",
    name: "Nova",
    level: 18,
    title: "Elite Fighter",
    status: "Online",
    location: "City Center",
    health: 270,
    maxHealth: 270,
    stats: { strength: 44, defense: 41, speed: 39, dexterity: 45 },
    weapon: "Rift Rifle",
    armor: "Elite Armor",
    bounty: 1500,
    cashReward: 2200,
    xpReward: 140,
    faction: "Rift Guard",
  },
];
