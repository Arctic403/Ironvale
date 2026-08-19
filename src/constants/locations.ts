/**
 * RiftCity — City Map Locations
 *
 * The city is no longer divided into travelable districts.
 * These are permanent locations/buildings on the city map.
 */

export type CityLocationId =
  | "bank"
  | "hospital"
  | "gym"
  | "general-store"
  | "market"
  | "dealership"
  | "auto-shop"
  | "properties"
  | "police"
  | "city-hall"
  | "jobs"
  | "crimes"
  | "combat";

export interface CityLocation {
  id: CityLocationId;
  name: string;
  description: string;
  icon: string;
  screen:
    | "character"
    | "city"
    | "crimes"
    | "combat"
    | "gym"
    | "market"
    | "jobs"
    | "properties"
    | "education"
    | "inventory"
    | "hospital";
  x: number;
  y: number;
  color?: "blue" | "green" | "red" | "yellow" | "purple" | "cyan";
}

export const CITY_LOCATIONS: CityLocation[] = [
  {
    id: "bank",
    name: "RiftCity Bank",
    description: "Manage your cash and bank balance.",
    icon: "🏦",
    screen: "character",
    x: 24,
    y: 22,
    color: "green",
  },

  {
    id: "hospital",
    name: "RiftCity Hospital",
    description: "Medical services and recovery.",
    icon: "🏥",
    screen: "hospital",
    x: 72,
    y: 20,
    color: "red",
  },

  {
    id: "gym",
    name: "RiftCity Gym",
    description: "Train your combat statistics.",
    icon: "🏋️",
    screen: "gym",
    x: 48,
    y: 28,
    color: "blue",
  },

  {
    id: "general-store",
    name: "General Store",
    description: "Everyday supplies and useful items.",
    icon: "🛒",
    screen: "inventory",
    x: 18,
    y: 48,
    color: "yellow",
  },

  {
    id: "market",
    name: "City Market",
    description: "Buy and sell items on the city market.",
    icon: "🏪",
    screen: "market",
    x: 78,
    y: 46,
    color: "purple",
  },

  {
    id: "dealership",
    name: "Dealership",
    description: "Browse vehicles and transportation.",
    icon: "🚗",
    screen: "properties",
    x: 20,
    y: 74,
    color: "cyan",
  },

  {
    id: "auto-shop",
    name: "Auto Shop",
    description: "Vehicle services and repairs.",
    icon: "🔧",
    screen: "properties",
    x: 44,
    y: 78,
    color: "yellow",
  },

  {
    id: "properties",
    name: "Property Office",
    description: "Manage your property and housing.",
    icon: "🏠",
    screen: "properties",
    x: 74,
    y: 76,
    color: "green",
  },

  {
    id: "police",
    name: "Police Department",
    description: "The city's law-enforcement headquarters.",
    icon: "🚓",
    screen: "city",
    x: 50,
    y: 56,
    color: "blue",
  },

  {
    id: "city-hall",
    name: "City Hall",
    description: "City administration and public services.",
    icon: "🏛️",
    screen: "education",
    x: 50,
    y: 12,
    color: "purple",
  },

  {
    id: "jobs",
    name: "Employment Center",
    description: "Find work and manage your career.",
    icon: "💼",
    screen: "jobs",
    x: 28,
    y: 60,
    color: "cyan",
  },

  {
    id: "crimes",
    name: "Back Streets",
    description: "High-risk street opportunities.",
    icon: "🕵️",
    screen: "crimes",
    x: 82,
    y: 62,
    color: "red",
  },

  {
    id: "combat",
    name: "Fight Club",
    description: "Challenge available opponents.",
    icon: "⚔️",
    screen: "combat",
    x: 12,
    y: 84,
    color: "red",
  },
];

export function getCityLocation(
  id: string
): CityLocation | undefined {
  return CITY_LOCATIONS.find(
    (location) => location.id === id
  );
}

export function getLocationName(
  id: string
): string {
  return (
    getCityLocation(id)?.name ||
    id
  );
}

/**
 * Compatibility export.
 *
 * Existing code that imports LOCATIONS will no longer
 * receive the old district/travel definitions.
 */
export const LOCATIONS = CITY_LOCATIONS;
