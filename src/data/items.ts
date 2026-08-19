import type { DistanceZone, Item, Mission, EducationCourse, Property } from "./dataTypes";

export const ITEMS: Item[] = [
  {
    id: "knife",
    name: "Street Knife",
    description:
      "A cheap weapon carried by people who expect trouble.",
    type: "weapon",
    price: 250,
    effect: 8,
    optimalRange: "Close",
    accuracy: 85,
    moveCost: 1,
    coverPenetration: 0.1,
  },

  {
    id: "bat",
    name: "Baseball Bat",
    description:
      "Simple, effective and easy to find.",
    type: "weapon",
    price: 600,
    effect: 15,
    optimalRange: "Close",
    accuracy: 75,
    moveCost: 1,
    coverPenetration: 0.2,
  },

  {
    id: "pistol",
    name: "9mm Pistol",
    description:
      "A basic firearm for serious situations.",
    type: "weapon",
    price: 2500,
    effect: 35,
    optimalRange: "Mid",
    accuracy: 70,
    moveCost: 2,
    coverPenetration: 0.4,
  },

  {
    id: "jacket",
    name: "Reinforced Jacket",
    description:
      "Offers a little protection in a fight.",
    type: "armor",
    price: 500,
    effect: 5,
  },

  {
    id: "vest",
    name: "Tactical Vest",
    description:
      "A proper piece of protective equipment.",
    type: "armor",
    price: 3000,
    effect: 15,
  },

  {
    id: "medkit",
    name: "Small Medkit",
    description:
      "Restore 25 health.",
    type: "medical",
    price: 300,
    effect: 25,
  },

  {
    id: "energy-drink",
    name: "Energy Drink",
    description:
      "Restore 25 Energy.",
    type: "energy",
    price: 400,
    effect: 25,
  },

  {
    id: "nerve-tonic",
    name: "Nerve Tonic",
    description:
      "Restore 3 Nerve.",
    type: "nerve",
    price: 700,
    effect: 3,
  },
];



export function getItem(id:string){ return ITEMS.find(item=>item.id===id) ?? null; }
