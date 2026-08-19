/**
 * Random Encounter Definitions
 */

export type EncounterChoice = {
  label: string;
  cash?: number;
  xp?: number;
  health?: number;
  energy?: number;
  nerve?: number;
  text: string;
};

export type Encounter = {
  id: string;
  title: string;
  text: string;
  choices: EncounterChoice[];
  locations?: string[];
};

export const ENCOUNTERS: Encounter[] = [
  {
    id: "lost-wallet",
    title: "A Wallet on the Pavement",
    text:
      "You notice a wallet sitting beside a bench. Humanity has apparently invented another tiny moral exam.",
    locations: ["city-center", "suburbs"],
    choices: [
      {
        label: "Return it",
        xp: 12,
        text:
          "You return the wallet. The owner rewards your honesty.",
      },
      {
        label: "Keep the cash",
        cash: 180,
        nerve: 1,
        text:
          "You pocket the cash and leave before anyone notices.",
      },
    ],
  },

  {
    id: "street-deal",
    title: "A Quiet Offer",
    text:
      "A stranger offers a quick deal that could pay well, assuming your luck has decided to cooperate.",
    locations: ["city-center", "industrial", "docks"],
    choices: [
      {
        label: "Take the deal",
        cash: 450,
        xp: 18,
        health: -8,
        text:
          "The deal works, although it leaves you nursing a bruise.",
      },
      {
        label: "Walk away",
        xp: 5,
        text:
          "You decide that mysterious strangers are rarely an investment strategy.",
      },
    ],
  },

  {
    id: "runner",
    title: "Courier Wanted",
    text:
      "Someone needs a package moved across town. No questions, apparently, because questions are inconvenient.",
    locations: ["industrial", "docks"],
    choices: [
      {
        label: "Take the run",
        cash: 240,
        energy: -10,
        xp: 10,
        text:
          "You deliver the package and collect the fee.",
      },
      {
        label: "Decline",
        text:
          "You keep walking.",
      },
    ],
  },

  {
    id: "warehouse-job",
    title: "A Warehouse Door",
    text:
      "A warehouse supervisor is looking for someone willing to move a few crates before the night shift ends.",
    locations: ["industrial"],
    choices: [
      {
        label: "Help out",
        cash: 175,
        energy: -15,
        xp: 8,
        text:
          "You finish the work and get paid immediately.",
      },
      {
        label: "Keep moving",
        text:
          "You decide that spontaneous manual labour is not today's calling.",
      },
    ],
  },

  {
    id: "dock-watch",
    title: "Someone Is Watching",
    text:
      "Near the docks, you notice someone following you from a distance.",
    locations: ["docks"],
    choices: [
      {
        label: "Confront them",
        nerve: 2,
        xp: 20,
        health: -5,
        text:
          "You confront the stranger. They back off after a tense exchange.",
      },
      {
        label: "Lose them",
        energy: -5,
        xp: 8,
        text:
          "You take a few turns through the alleys and eventually shake them.",
      },
    ],
  },
];

export function getAvailableEncounter(location: string): Encounter {
  const available = ENCOUNTERS.filter(
    (encounter) =>
      !encounter.locations ||
      encounter.locations.includes(location)
  );

  const pool = available.length ? available : ENCOUNTERS;

  return pool[Math.floor(Math.random() * pool.length)];
}
