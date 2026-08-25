// RiftCity crime plugins.
// Crime definitions are server-owned config. The generic crime engine in src/index.js
// resolves attempts, persists progress/history, spends resources, and grants rewards.

export const CRIME_REGISTRY = Object.freeze([
  {
    id: 'street_scavenging',
    name: 'Street Scavenging',
    category: 'Scavenging',
    description: 'Search overlooked corners of RiftCity for loose cash and useful items.',
    nerveCost: 1,
    baseChance: 0.86,
    cashMin: 2,
    cashMax: 12,
    xpMin: 4,
    xpMax: 8,
    requiredItemId: null,
    requiredLocationId: null,
    itemChance: 0.34,
    itemPool: [
      { itemId: 'candy_bar', weight: 40, quantity: 1 },
      { itemId: 'cheap_watch', weight: 26, quantity: 1 },
      { itemId: 'energy_drink', weight: 20, quantity: 1 },
      { itemId: 'screwdriver', weight: 10, quantity: 1 },
      { itemId: 'first_aid_kit', weight: 4, quantity: 1 }
    ],
    failure: { jailChance: 0.02, hospitalChance: 0.01, minSeconds: 30, maxSeconds: 60 }
  },
  {
    id: 'parcel_theft',
    name: 'Parcel Theft',
    category: 'Theft',
    description: 'Grab an unattended delivery before anyone notices it is gone.',
    nerveCost: 2,
    baseChance: 0.69,
    cashMin: 8,
    cashMax: 30,
    xpMin: 8,
    xpMax: 14,
    requiredItemId: null,
    requiredLocationId: null,
    itemChance: 0.58,
    itemPool: [
      { itemId: 'candy_bar', weight: 28, quantity: 1 },
      { itemId: 'energy_drink', weight: 24, quantity: 1 },
      { itemId: 'cheap_watch', weight: 24, quantity: 1 },
      { itemId: 'ticket', weight: 14, quantity: 1 },
      { itemId: 'first_aid_kit', weight: 10, quantity: 1 }
    ],
    failure: { jailChance: 0.10, hospitalChance: 0.02, minSeconds: 45, maxSeconds: 100 }
  },
  {
    id: 'service_alley_breakin',
    name: 'Service Alley Break-In',
    category: 'Burglary',
    description: 'Work a locked service entrance for a shot at better loot.',
    nerveCost: 3,
    baseChance: 0.55,
    cashMin: 18,
    cashMax: 58,
    xpMin: 12,
    xpMax: 22,
    requiredItemId: 'screwdriver',
    requiredLocationId: null,
    itemChance: 0.70,
    itemPool: [
      { itemId: 'cheap_watch', weight: 35, quantity: 1 },
      { itemId: 'first_aid_kit', weight: 25, quantity: 1 },
      { itemId: 'energy_drink', weight: 18, quantity: 1 },
      { itemId: 'key', weight: 12, quantity: 1 },
      { itemId: 'ticket', weight: 10, quantity: 1 }
    ],
    failure: { jailChance: 0.18, hospitalChance: 0.04, minSeconds: 60, maxSeconds: 150 }
  }
]);

const CRIME_LOOKUP = new Map(CRIME_REGISTRY.map(crime => [crime.id, crime]));

export function getCrimeDefinition(crimeId) {
  return CRIME_LOOKUP.get(crimeId) || null;
}
