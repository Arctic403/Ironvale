/**
 * Location Definitions
 */

export const LOCATIONS = [
  [
    "city-center",
    "City Center",
    "Banks, shops, jobs and the busiest streets.",
  ],
  [
    "industrial",
    "Industrial District",
    "Factories, warehouses and rougher encounters.",
  ],
  [
    "suburbs",
    "Suburbs",
    "Quiet streets and expensive property.",
  ],
  [
    "docks",
    "The Docks",
    "Black-market deals and high-risk opportunities.",
  ],
] as const;

export type LocationId = typeof LOCATIONS[number][0];

export function getLocationName(id: string): string {
  return LOCATIONS.find((location) => location[0] === id)?.[1] || id;
}
