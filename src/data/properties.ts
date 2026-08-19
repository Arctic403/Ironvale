import type { DistanceZone, Item, Mission, EducationCourse, Property } from "./dataTypes";

export const PROPERTIES: Property[] = [
  {
    id: "shack",
    name: "Shack",
    description:
      "A tiny place to start your life in RiftCity.",
    price: 0,
    maxHealthBonus: 0,
    gymBonus: 0,
    nerveBonus: 0,
    maxHappiness: 100,
  },

  {
    id: "apartment",
    name: "Small Apartment",
    description:
      "A basic place to call home.",
    price: 5000,
    maxHealthBonus: 5,
    gymBonus: 0,
    nerveBonus: 0,
    maxHappiness: 110,
  },

  {
    id: "house",
    name: "Suburban House",
    description:
      "More space and a better environment.",
    price: 25000,
    maxHealthBonus: 10,
    gymBonus: 0,
    nerveBonus: 0,
    maxHappiness: 120,
  },

  {
    id: "townhouse",
    name: "Luxury Townhouse",
    description:
      "A comfortable home for someone climbing the ladder.",
    price: 100000,
    maxHealthBonus: 20,
    gymBonus: 0,
    nerveBonus: 1,
    maxHappiness: 135,
  },

  {
    id: "mansion",
    name: "City Mansion",
    description:
      "A serious statement of success.",
    price: 500000,
    maxHealthBonus: 40,
    gymBonus: 0,
    nerveBonus: 2,
    maxHappiness: 150,
  },
];



export function getProperty(id:string|null){ return id ? (PROPERTIES.find(property=>property.id===id) ?? null) : null; }
