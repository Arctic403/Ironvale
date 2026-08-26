// RiftCity authored fallback — Downtown / Commerce Street.
// Source synced from the Block Editor D1 export on 2026-08-26.
// Gameplay/runtime code may hydrate a newer published D1 layout at runtime.
// The alley target/label below are repo-only routing metadata preserved for the sub-area runtime.
export const BLOCK1 = Object.freeze({
  id: "downtown-commercial-01",
  name: "Downtown — Commerce Street",
  width: 3600,
  height: 1440,
  scenePlate: {
    src: "/assets/blocks/commerce-street.svg",
    x: 0,
    y: 0,
    width: 3600,
    height: 1800,
    scale: 1
  },
  spawn: {
    x: 340,
    y: 1320
  },
  walkable: {
    x: -10,
    y: 1120,
    width: 3600,
    height: 470,
    locked: true
  },
  road: {
    x: 0,
    y: 1080,
    width: 3600,
    height: 360
  },
  sidewalks: [
    {
      x: 0,
      y: 1250,
      width: 3600,
      height: 100
    }
  ],
  buildings: [
    {
      id: "corner-mart",
      name: "Corner Mart",
      locationId: "cornerstone-market",
      x: 570,
      y: 980,
      w: 130,
      h: 140,
      tone: "shop",
      sign: "CORNER MART",
      doorX: 638.0232558139535,
      doorY: 1120,
      style: "mart",
      detail: "24/7 • GROCERIES"
    },
    {
      id: "northside-warehouse",
      name: "Northside Warehouse",
      locationId: "warehouse-district",
      x: 1510,
      y: 910,
      w: 270,
      h: 220,
      tone: "industrial",
      sign: "NORTHSIDE WAREHOUSE CO.",
      doorX: 1690,
      doorY: 1130,
      style: "warehouse",
      detail: "WAREHOUSE DISTRICT"
    },
    {
      id: "redline-garage",
      name: "Redline Garage",
      locationId: "redline-garage",
      x: 1030,
      y: 920,
      w: 180,
      h: 210,
      tone: "garage",
      sign: "AUTO REPAIR",
      doorX: 1149.423076923077,
      doorY: 1130,
      style: "garage",
      detail: "BRAKES • TIRES • SERVICE"
    },
    {
      id: "commerce-apartments",
      name: "Commerce Apartments",
      locationId: "keystone-realty",
      x: 2190,
      y: 940,
      w: 90,
      h: 190,
      tone: "apartment",
      sign: "APARTMENTS",
      doorX: 2251.2295081967213,
      doorY: 1130,
      style: "apartments",
      detail: "RESIDENTIAL"
    },
    {
      id: "pawn-exchange",
      name: "Second Chance Exchange",
      locationId: "second-chance-exchange",
      x: 2630,
      y: 990,
      w: 80,
      h: 140,
      tone: "pawn",
      sign: "PAWN SHOP",
      doorX: 2671.9047619047615,
      doorY: 1130,
      style: "pawn",
      detail: "BUY • SELL"
    },
    {
      id: "apartment-rentals",
      name: "Apartment Rentals",
      locationId: "keystone-realty",
      x: 2970,
      y: 870,
      w: 230,
      h: 260,
      tone: "apartment",
      sign: "APARTMENT RENTALS",
      doorX: 3103.2954545454545,
      doorY: 1130,
      style: "apartments",
      detail: "RENTALS"
    }
  ],
  props: [
    {
      id: "prop-tree-mtakdk68-1",
      kind: "tree",
      x: 410,
      y: 1320,
      active: true
    }
  ],
  alley: {
    x: 1310,
    y: 860,
    width: 120,
    height: 270,
    details: [],
    active: true,
    target: "alley-commerce-01",
    label: "Commerce Alley"
  },
  exits: [
    {
      id: "west",
      x: 0,
      y: 1010,
      w: 110,
      h: 430,
      label: "West Downtown — future block"
    },
    {
      id: "east",
      x: 3490,
      y: 1010,
      w: 110,
      h: 430,
      label: "East Downtown — future block"
    }
  ]
});

export const BLOCK_EDITOR_SCHEMA_VERSION = 2;
