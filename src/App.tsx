import React, { useEffect, useMemo, useState } from "react";

import {
  CRIMES,
  Crime,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
  randomReward,
} from "./systems/crimeSystem";

import {
  CombatStats,
  getLevel,
  getMaxHealth,
} from "./systems/progressionSystem";

import {
  ENERGY_REGEN_INTERVAL,
  MAX_ENERGY,
  NERVE_REGEN_INTERVAL,
} from "./systems/resourceSystem";

import {
  GYMS,
  TRAINING_STATS,
  TrainingStat,
  applyTraining,
  canTrainStat,
  getGymExperienceGain,
  gymUnlocked,
} from "./systems/gymSystem";

import {
  DEFAULT_WEAPONS,
  PlayerProfile,
  calculateWinChance,
} from "./systems/combatSystem";

import { InteractiveCombatView } from "./views/Combat";

import {
  EDUCATION,
  ITEMS,
  JOBS,
  PLAYER_PROFILES,
  MISSIONS,
  PROPERTIES,
  getItem,
  getJob,
  getProperty,
} from "./data/gameData";

type Screen =
  | "city"
  | "crimes"
  | "combat"
  | "gym"
  | "jobs"
  | "items"
  | "missions"
  | "education"
  | "property"
  | "character"
  | "market"
  | "faction"
  | "awards";

type ActivityType =
  | "success"
  | "failure"
  | "critical"
  | "spooked"
  | "jailed"
  | "combat"
  | "gym"
  | "job"
  | "system";

type Activity = {
  id: number;
  text: string;
  type: ActivityType;
  time: number;
};

type EncounterChoice = {
  label: string;
  cash?: number;
  xp?: number;
  health?: number;
  energy?: number;
  nerve?: number;
  text: string;
};

type Encounter = {
  id: string;
  title: string;
  text: string;
  choices: EncounterChoice[];
  locations?: string[];
};

type SaveData = {
  cash: number;
  bank: number;

  xp: number;

  bankInterest: number;
  lastBankInterest: number;

  merits: number;
  points: number;

  energy: number;
  lastEnergyUpdate: number;

  nerve: number;
  lastNerveUpdate: number;

  health: number;

  crimeExperience: number;
  stats: CombatStats;

  gymExperience: number;
  gymMemberships: string[];
  activeGym: string;

  happiness: number;
  lastHappinessUpdate: number;

  currentJob: string | null;
  jobStartedAt: number;
  lastJobPayment: number;

  jailUntil: number | null;
  hospitalUntil: number | null;

  inventory: Record<string, number>;

  equippedWeapon: string | null;
  equippedArmor: string | null;

  ownedProperty: string;

  educationCompleted: string[];
  educationActive: string | null;
  educationStartedAt: number | null;

  completedMissions: string[];

  crimesCompleted: number;
  crimesFailed: number;
  crimesSpooked: number;
  crimesCritical: number;

  timesJailed: number;

  fightsWon: number;
  fightsLost: number;

  gymSessions: number;
  attacks: number;

  locationsVisited: string[];
  currentLocation: string;

  travelCooldownUntil: number | null;

  faction: string | null;
  factionReputation: number;

  company: string | null;
  companyReputation: number;

  market: Record<string, number>;

  lastDailyClaim: number | null;
  dailyStreak: number;

  achievements: string[];

  activities: Activity[];
};

type ActiveModal =
  | "energy"
  | "nerve"
  | "happy"
  | "health"
  | null;

const SAVE_KEY = "riftcity-core-v6";

const JOB_PAY_INTERVAL = 60 * 60 * 1000;

const HAPPINESS_TICK = 15 * 60 * 1000;

const HEALTH_REGEN_INTERVAL = 60 * 1000;

const JAIL_MINUTES = 2;

const HOSPITAL_MINUTES = 2;

const BASE_HAPPINESS = 100;

const BANK_INTEREST_INTERVAL = 24 * 60 * 60 * 1000;

const DAILY_INTERVAL = 24 * 60 * 60 * 1000;

const TRAVEL_COOLDOWN = 30 * 1000;

const TRAVEL_COST = 25;

const MARKET_UPDATE_INTERVAL = 5 * 60 * 1000;

const LOCATIONS = [
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

const ENCOUNTERS: Encounter[] = [
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

const DEFAULT_MARKET_PRICES: Record<string, number> = {
  food: 100,
  electronics: 250,
  scrap: 60,
  medical: 180,
};

function freshSave(): SaveData {
  const now = Date.now();

  return {
    cash: 1000,
    bank: 0,

    xp: 0,

    bankInterest: 0,
    lastBankInterest: now,

    merits: 0,
    points: 0,

    energy: 100,
    lastEnergyUpdate: now,

    nerve: 10,
    lastNerveUpdate: now,

    health: 100,

    crimeExperience: 0,

    stats: {
      strength: 5,
      defense: 5,
      speed: 5,
      dexterity: 5,
    },

    gymExperience: 0,
    gymMemberships: ["premier-fitness"],
    activeGym: "premier-fitness",

    happiness: BASE_HAPPINESS,
    lastHappinessUpdate: now,

    currentJob: null,
    jobStartedAt: now,
    lastJobPayment: now,

    jailUntil: null,
    hospitalUntil: null,

    inventory: {},

    equippedWeapon: null,
    equippedArmor: null,

    ownedProperty: "shack",

    educationCompleted: [],
    educationActive: null,
    educationStartedAt: null,

    completedMissions: [],

    crimesCompleted: 0,
    crimesFailed: 0,
    crimesSpooked: 0,
    crimesCritical: 0,

    timesJailed: 0,

    fightsWon: 0,
    fightsLost: 0,

    gymSessions: 0,
    attacks: 0,

    locationsVisited: ["city-center"],
    currentLocation: "city-center",

    travelCooldownUntil: null,

    faction: null,
    factionReputation: 0,

    company: null,
    companyReputation: 0,

    market: {
      ...DEFAULT_MARKET_PRICES,
    },

    lastDailyClaim: null,
    dailyStreak: 0,

    achievements: [],

    activities: [
      {
        id: now,
        text: "Welcome to RiftCity.",
        type: "system",
        time: now,
      },
    ],
  };
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);

    if (!raw) {
      return freshSave();
    }

    const base = freshSave();

    const parsed = JSON.parse(raw);

    return {
      ...base,
      ...parsed,

      stats: {
        ...base.stats,
        ...(parsed.stats || {}),
      },

      inventory: {
        ...(parsed.inventory || {}),
      },

      activities:
        Array.isArray(parsed.activities) && parsed.activities.length
          ? parsed.activities
          : base.activities,

      gymMemberships:
        Array.isArray(parsed.gymMemberships)
          ? parsed.gymMemberships
          : base.gymMemberships,

      educationCompleted:
        Array.isArray(parsed.educationCompleted)
          ? parsed.educationCompleted
          : [],

      completedMissions:
        Array.isArray(parsed.completedMissions)
          ? parsed.completedMissions
          : [],

      locationsVisited:
        Array.isArray(parsed.locationsVisited)
          ? parsed.locationsVisited
          : ["city-center"],

      achievements:
        Array.isArray(parsed.achievements)
          ? parsed.achievements
          : [],

      market: {
        ...DEFAULT_MARKET_PRICES,
        ...(parsed.market || {}),
      },

      lastBankInterest:
        typeof parsed.lastBankInterest === "number"
          ? parsed.lastBankInterest
          : base.lastBankInterest,

      lastEnergyUpdate:
        typeof parsed.lastEnergyUpdate === "number"
          ? parsed.lastEnergyUpdate
          : base.lastEnergyUpdate,

      lastNerveUpdate:
        typeof parsed.lastNerveUpdate === "number"
          ? parsed.lastNerveUpdate
          : base.lastNerveUpdate,

      lastHappinessUpdate:
        typeof parsed.lastHappinessUpdate === "number"
          ? parsed.lastHappinessUpdate
          : base.lastHappinessUpdate,

      lastJobPayment:
        typeof parsed.lastJobPayment === "number"
          ? parsed.lastJobPayment
          : base.lastJobPayment,
    };
  } catch {
    return freshSave();
  }
}

function money(n: number) {
  return `$${Math.max(0, Math.floor(n)).toLocaleString()}`;
}

function timeLeft(until: number | null) {
  return until ? Math.max(0, until - Date.now()) : 0;
}

function formatTime(ms: number) {
  const s = Math.ceil(ms / 1000);

  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function getLocationName(id: string) {
  return LOCATIONS.find((location) => location[0] === id)?.[1] || id;
}

function randomMarketPrice(current: number) {
  const volatility = 0.92 + Math.random() * 0.16;

  return Math.max(1, Math.floor(current * volatility));
}

function getAvailableEncounter(location: string) {
  const available = ENCOUNTERS.filter(
    (encounter) =>
      !encounter.locations ||
      encounter.locations.includes(location)
  );

  const pool = available.length ? available : ENCOUNTERS;

  return pool[Math.floor(Math.random() * pool.length)];
}

export function useRiftCity() {
  const [gameState, setGameState] = useState<SaveData>(() =>
    loadSave()
  );

  const [currentScreen, setCurrentScreen] =
    useState<Screen>("character");

  const [encounter, setEncounter] =
    useState<Encounter | null>(null);

  const [combatOpponent, setCombatOpponent] =
    useState<PlayerProfile | null>(null);

  const [combatStarted, setCombatStarted] =
    useState(false);

  const [combatMessage, setCombatMessage] =
    useState("Choose an opponent.");

  const property = getProperty(gameState.ownedProperty);

  const maxHealth = getMaxHealth(
    property?.maxHealthBonus ?? 0
  );

  const level = getLevel(gameState.xp).level;

  const maxNerve =
    10 +
    Math.min(
      50,
      Math.floor(gameState.crimeExperience / 100) * 5
    ) +
    (property?.nerveBonus ?? 0);

  const gym =
    GYMS.find((g) => g.id === gameState.activeGym) ??
    GYMS[0];

  const job = getJob(gameState.currentJob);

  const education =
    EDUCATION.find(
      (e) => e.id === gameState.educationActive
    ) ?? null;

  const travelLocked = Boolean(
    gameState.travelCooldownUntil &&
      gameState.travelCooldownUntil > Date.now()
  );

  /*
   * Centralized activity writer.
   *
   * This avoids nested setState calls such as:
   *
   * setGameState(...)
   *   -> log(...)
   *      -> setGameState(...)
   *
   * React is happier. Humanity remains questionable.
   */
  const appendActivity = (
    state: SaveData,
    text: string,
    type: ActivityType = "system"
  ): SaveData => {
    const activity: Activity = {
      id: Date.now() + Math.random(),
      text,
      type,
      time: Date.now(),
    };

    return {
      ...state,
      activities: [
        activity,
        ...state.activities,
      ].slice(0, 60),
    };
  };

  const log = (
    text: string,
    type: ActivityType = "system"
  ) => {
    setGameState((prev) =>
      appendActivity(prev, text, type)
    );
  };

  useEffect(() => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(gameState)
    );
  }, [gameState]);

  /*
   * Main game clock.
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();

      setGameState((prev) => {
        let changed = false;

        const updates: Partial<SaveData> = {};

        /*
         * ENERGY
         */
        if (prev.energy < MAX_ENERGY) {
          const ticks = Math.floor(
            (now - prev.lastEnergyUpdate) /
              ENERGY_REGEN_INTERVAL
          );

          if (ticks > 0) {
            updates.energy = Math.min(
              MAX_ENERGY,
              prev.energy + ticks
            );

            updates.lastEnergyUpdate =
              prev.lastEnergyUpdate +
              ticks * ENERGY_REGEN_INTERVAL;

            changed = true;
          }
        } else {
          updates.lastEnergyUpdate = now;
        }

        /*
         * NERVE
         */
        if (prev.nerve < maxNerve) {
          const ticks = Math.floor(
            (now - prev.lastNerveUpdate) /
              NERVE_REGEN_INTERVAL
          );

          if (ticks > 0) {
            updates.nerve = Math.min(
              maxNerve,
              prev.nerve + ticks
            );

            updates.lastNerveUpdate =
              prev.lastNerveUpdate +
              ticks * NERVE_REGEN_INTERVAL;

            changed = true;
          }
        } else {
          updates.lastNerveUpdate = now;
        }

        /*
         * HAPPINESS
         */
        const maxHappiness =
          property?.maxHappiness ?? 100;

        if (prev.happiness < maxHappiness) {
          const ticks = Math.floor(
            (now - prev.lastHappinessUpdate) /
              HAPPINESS_TICK
          );

          if (ticks > 0) {
            updates.happiness = Math.min(
              maxHappiness,
              prev.happiness + ticks * 5
            );

            updates.lastHappinessUpdate =
              prev.lastHappinessUpdate +
              ticks * HAPPINESS_TICK;

            changed = true;
          }
        } else {
          updates.lastHappinessUpdate = now;
        }

        /*
         * HEALTH
         */
        if (
          prev.health < maxHealth &&
          !prev.hospitalUntil &&
          !prev.jailUntil
        ) {
          const ticks = Math.floor(
            (now - prev.lastEnergyUpdate) /
              HEALTH_REGEN_INTERVAL
          );

          if (ticks > 0) {
            updates.health = Math.min(
              maxHealth,
              prev.health + ticks
            );

            changed = true;
          }
        }

        /*
         * JAIL
         */
        if (
          prev.jailUntil &&
          now >= prev.jailUntil
        ) {
          updates.jailUntil = null;

          changed = true;
        }

        /*
         * HOSPITAL
         */
        if (
          prev.hospitalUntil &&
          now >= prev.hospitalUntil
        ) {
          updates.hospitalUntil = null;
          updates.health = maxHealth;

          changed = true;
        }

        /*
         * BANK INTEREST
         */
        if (
          prev.bank > 0 &&
          now - prev.lastBankInterest >=
            BANK_INTEREST_INTERVAL
        ) {
          const days = Math.floor(
            (now - prev.lastBankInterest) /
              BANK_INTEREST_INTERVAL
          );

          if (days > 0) {
            const interest = Math.floor(
              prev.bank * 0.01 * days
            );

            updates.bank =
              prev.bank + interest;

            updates.bankInterest =
              prev.bankInterest + interest;

            updates.lastBankInterest =
              prev.lastBankInterest +
              days * BANK_INTEREST_INTERVAL;

            changed = true;
          }
        }

        /*
         * JOB PAYMENT
         */
        if (
          prev.currentJob &&
          now - prev.lastJobPayment >=
            JOB_PAY_INTERVAL
        ) {
          const currentJob =
            getJob(prev.currentJob);

          if (currentJob) {
            const ticks = Math.floor(
              (now - prev.lastJobPayment) /
                JOB_PAY_INTERVAL
            );

            if (ticks > 0) {
              const earned =
                currentJob.salary * ticks;

              updates.cash =
                (updates.cash ?? prev.cash) +
                earned;

              updates.lastJobPayment =
                prev.lastJobPayment +
                ticks * JOB_PAY_INTERVAL;

              changed = true;
            }
          }
        }

        /*
         * MARKET UPDATE
         *
         * Market prices move periodically instead of
         * changing every time someone presses Buy/Sell.
         */
        const lastMarketUpdate =
          typeof (
            prev as SaveData & {
              lastMarketUpdate?: number;
            }
          ).lastMarketUpdate === "number"
            ? (
                prev as SaveData & {
                  lastMarketUpdate?: number;
                }
              ).lastMarketUpdate!
            : now;

        if (
          now - lastMarketUpdate >=
          MARKET_UPDATE_INTERVAL
        ) {
          const updatedMarket = {
            ...prev.market,
          };

          Object.keys(DEFAULT_MARKET_PRICES).forEach(
            (id) => {
              const current =
                updatedMarket[id] ??
                DEFAULT_MARKET_PRICES[id];

              updatedMarket[id] =
                randomMarketPrice(current);
            }
          );

          (
            updates as Partial<
              SaveData & {
                lastMarketUpdate: number;
              }
            >
          ).market = updatedMarket;

          (
            updates as Partial<
              SaveData & {
                lastMarketUpdate: number;
              }
            >
          ).lastMarketUpdate = now;

          changed = true;
        }

        return changed
          ? {
              ...prev,
              ...updates,
            }
          : prev;
      });
    }, 1000);

    return () =>
      window.clearInterval(id);
  }, [
    maxNerve,
    maxHealth,
    property?.maxHappiness,
  ]);

  const blocked = () =>
    Boolean(
      gameState.jailUntil ||
        gameState.hospitalUntil
    );

  /*
   * CRIME SYSTEM
   */
  const commitCrime = (crime: Crime) => {
    if (blocked()) {
      log(
        gameState.jailUntil
          ? "You are in jail."
          : "You are in hospital.",
        "failure"
      );

      return;
    }

    if (
      !crimeUnlocked(
        crime,
        gameState.crimeExperience
      )
    ) {
      log(
        "That crime is locked until your crime experience is high enough.",
        "failure"
      );

      return;
    }

    if (gameState.nerve < crime.nerve) {
      log("Not enough nerve.", "failure");

      return;
    }

    setGameState((prev) => {
      const chance = Math.max(
        0,
        Math.min(
          100,
          crimeSuccessChance(
            crime,
            prev.crimeExperience,
            1,
            getCrimeStatBonus(prev.stats)
          )
        )
      );

      const roll = Math.random() * 100;

      /*
       * Explicit outcome bands.
       *
       * Critical success:
       * 8% of the successful range.
       *
       * Critical failure:
       * final 0.5% of the roll.
       */
      const criticalSuccessChance =
        chance * 0.08;

      let outcome:
        | "critical"
        | "success"
        | "jailed"
        | "critical-fail"
        | "spooked";

      if (
        roll < criticalSuccessChance
      ) {
        outcome = "critical";
      } else if (
        roll < chance
      ) {
        outcome = "success";
      } else if (
        roll >= 99.5
      ) {
        outcome = "critical-fail";
      } else if (
        roll <
        chance + crime.risk * 0.55
      ) {
        outcome = "jailed";
      } else {
        outcome = "spooked";
      }

      let next: SaveData = {
        ...prev,

        nerve: Math.max(
          0,
          prev.nerve - crime.nerve
        ),
      };

      if (outcome === "critical") {
        const reward = Math.floor(
          randomReward(crime) * 1.75
        );

        next = {
          ...next,
          cash: prev.cash + reward,
          xp: prev.xp + crime.xp * 2,
          crimeExperience:
            prev.crimeExperience +
            crime.crimeExperience * 2,
          crimesCompleted:
            prev.crimesCompleted + 1,
          crimesCritical:
            prev.crimesCritical + 1,
        };

        return appendActivity(
          next,
          `CRITICAL SUCCESS: ${crime.name} paid ${money(
            reward
          )}.`,
          "critical"
        );
      }

      if (outcome === "success") {
        const reward =
          randomReward(crime);

        next = {
          ...next,
          cash: prev.cash + reward,
          xp: prev.xp + crime.xp,
          crimeExperience:
            prev.crimeExperience +
            crime.crimeExperience,
          crimesCompleted:
            prev.crimesCompleted + 1,
        };

        return appendActivity(
          next,
          `SUCCESS: ${crime.name} paid ${money(
            reward
          )}.`,
          "success"
        );
      }

      if (outcome === "jailed") {
        next = {
          ...next,
          crimesFailed:
            prev.crimesFailed + 1,
          timesJailed:
            prev.timesJailed + 1,
          jailUntil:
            Date.now() +
            JAIL_MINUTES * 60000,
        };

        return appendActivity(
          next,
          `FAILED: ${crime.name}. You were jailed.`,
          "jailed"
        );
      }

      if (
        outcome === "critical-fail"
      ) {
        next = {
          ...next,
          crimesFailed:
            prev.crimesFailed + 1,
          health: Math.max(
            1,
            prev.health - 12
          ),
        };

        return appendActivity(
          next,
          `CRITICAL FAIL: ${crime.name}. You escaped, barely.`,
          "critical"
        );
      }

      next = {
        ...next,
        crimesSpooked:
          prev.crimesSpooked + 1,
      };

      return appendActivity(
        next,
        `SPOOKED: ${crime.name} failed without further consequences.`,
        "spooked"
      );
    });
  };

  /*
   * GYM
   */
  const train = (stat: TrainingStat) => {
    if (blocked()) {
      log(
        "You cannot train right now.",
        "failure"
      );

      return;
    }

    if (!canTrainStat(gym, stat)) {
      log(
        "This gym cannot train that stat.",
        "failure"
      );

      return;
    }

    if (
      gameState.energy <
      gym.energyCost
    ) {
      log(
        `You need ${gym.energyCost} energy.`,
        "failure"
      );

      return;
    }

    setGameState((prev) => {
      const currentGym =
        GYMS.find(
          (g) => g.id === prev.activeGym
        ) ?? GYMS[0];

      const educationMultiplier =
        prev.educationCompleted.some(
          (id) =>
            id === "fitness-basics" ||
            id === "advanced-fitness"
        )
          ? 1.05
          : 1;

      const result = applyTraining(
        prev.stats,
        currentGym,
        stat,
        prev.happiness,
        educationMultiplier
      );

      const next: SaveData = {
        ...prev,

        energy:
          prev.energy -
          currentGym.energyCost,

        stats: result.stats,

        gymExperience:
          prev.gymExperience +
          getGymExperienceGain(
            currentGym.energyCost
          ),

        gymSessions:
          prev.gymSessions + 1,

        happiness: Math.max(
          0,
          prev.happiness -
            currentGym.energyCost * 0.5
        ),
      };

      return appendActivity(
        next,
        `TRAINED ${stat.toUpperCase()}: +${result.gain.toFixed(
          2
        )} gain.`,
        "gym"
      );
    });
  };

  const buyGym = (id: string) =>
    setGameState((prev) => {
      const g = GYMS.find(
        (x) => x.id === id
      );

      if (
        !g ||
        g.jailOnly ||
        !gymUnlocked(
          g,
          prev.gymExperience
        )
      ) {
        return prev;
      }

      if (
        prev.gymMemberships.includes(id)
      ) {
        return {
          ...prev,
          activeGym: id,
        };
      }

      if (
        prev.cash <
        g.membershipCost
      ) {
        return appendActivity(
          prev,
          "Not enough cash for membership.",
          "failure"
        );
      }

      const next: SaveData = {
        ...prev,
        cash:
          prev.cash -
          g.membershipCost,
        gymMemberships: [
          ...prev.gymMemberships,
          id,
        ],
        activeGym: id,
      };

      return appendActivity(
        next,
        `Joined ${g.name}.`,
        "success"
      );
    });

  /*
   * COMBAT
   *
   * This is now the only combat entry point.
   */
  const attack = (
    opponent: PlayerProfile
  ) => {
    if (blocked()) {
      log(
        "You cannot attack right now.",
        "failure"
      );

      return;
    }

    if (combatOpponent) {
      log(
        "You are already in combat.",
        "failure"
      );

      return;
    }

    if (gameState.energy < 10) {
      log(
        "You need at least 10 energy to attack.",
        "failure"
      );

      return;
    }

    /*
     * Do not deduct energy here.
     *
     * The combat screen is responsible for starting
     * the actual encounter. This prevents paying for a
     * fight that never happened.
     */
    setCombatOpponent(opponent);
    setCombatStarted(false);

    setCombatMessage(
      `Target acquired: ${opponent.name}.`
    );

    setCurrentScreen("combat");
  };

  /*
   * Called by Combat when the actual fight begins.
   */
  const beginCombat = () => {
    if (!combatOpponent) {
      return false;
    }

    if (blocked()) {
      log(
        "You cannot begin combat right now.",
        "failure"
      );

      return false;
    }

    if (combatStarted) {
      return true;
    }

    if (gameState.energy < 10) {
      log(
        "You need at least 10 energy to attack.",
        "failure"
      );

      return false;
    }

    setGameState((prev) => ({
      ...prev,
      energy: Math.max(
        0,
        prev.energy - 10
      ),
      attacks: prev.attacks + 1,
    }));

    setCombatStarted(true);

    return true;
  };

  /*
   * Legacy compatibility function.
   *
   * Existing code that imports/calls resolveAttack won't
   * break, but combat itself no longer uses this path.
   */
  const resolveAttack = () => {
    if (!combatOpponent) {
      return;
    }

    setCombatMessage(
      `Combat with ${combatOpponent.name} is handled by the interactive combat system.`
    );
  };

  /*
   * ITEM SYSTEM
   */
  const buyItem = (id: string) =>
    setGameState((prev) => {
      const item = getItem(id);

      if (
        !item ||
        prev.cash < item.price
      ) {
        return appendActivity(
          prev,
          "Not enough cash.",
          "failure"
        );
      }

      const next: SaveData = {
        ...prev,

        cash:
          prev.cash -
          item.price,

        inventory: {
          ...prev.inventory,

          [id]:
            (prev.inventory[id] || 0) +
            1,
        },
      };

      return appendActivity(
        next,
        `Bought ${item.name}.`,
        "success"
      );
    });

  const useItem = (id: string) =>
    setGameState((prev) => {
      const item = getItem(id);

      const count =
        prev.inventory[id] || 0;

      if (!item || count <= 0) {
        return prev;
      }

      const next: SaveData = {
        ...prev,

        inventory: {
          ...prev.inventory,

          [id]: count - 1,
        },
      };

      if (item.type === "medical") {
        next.health = Math.min(
          maxHealth,
          prev.health +
            (item.effect || 0)
        );
      }

      if (item.type === "energy") {
        next.energy = Math.min(
          MAX_ENERGY,
          prev.energy +
            (item.effect || 0)
        );
      }

      if (item.type === "nerve") {
        next.nerve = Math.min(
          maxNerve,
          prev.nerve +
            (item.effect || 0)
        );
      }

      return appendActivity(
        next,
        `Used ${item.name}.`,
        "success"
      );
    });

  const equip = (id: string) =>
    setGameState((prev) => {
      const item = getItem(id);

      if (
        !item ||
        (prev.inventory[id] || 0) <= 0
      ) {
        return prev;
      }

      if (
        item.type !== "weapon" &&
        item.type !== "armor"
      ) {
        return prev;
      }

      return item.type === "weapon"
        ? {
            ...prev,
            equippedWeapon: id,
          }
        : {
            ...prev,
            equippedArmor: id,
          };
    });

  /*
   * RANDOM ENCOUNTERS
   */
  const chooseEncounter = (
    choice: EncounterChoice
  ) => {
    setGameState((prev) => {
      const next: SaveData = {
        ...prev,

        cash: Math.max(
          0,
          prev.cash +
            (choice.cash || 0)
        ),

        xp: Math.max(
          0,
          prev.xp +
            (choice.xp || 0)
        ),

        health: Math.max(
          1,
          Math.min(
            maxHealth,
            prev.health +
              (choice.health || 0)
          )
        ),

        energy: Math.max(
          0,
          Math.min(
            MAX_ENERGY,
            prev.energy +
              (choice.energy || 0)
          )
        ),

        nerve: Math.max(
          0,
          Math.min(
            maxNerve,
            prev.nerve +
              (choice.nerve || 0)
          )
        ),
      };

      return appendActivity(
        next,
        choice.text,
        "system"
      );
    });

    setEncounter(null);
  };

  const randomEncounter = () => {
    if (blocked()) {
      log(
        "You cannot explore right now.",
        "failure"
      );

      return;
    }

    setEncounter(
      getAvailableEncounter(
        gameState.currentLocation
      )
    );
  };

  /*
   * TRAVEL
   */
  const travel = (id: string) =>
    setGameState((prev) => {
      if (
        prev.currentLocation === id
      ) {
        return appendActivity(
          prev,
          `You are already in ${getLocationName(
            id
          )}.`,
          "system"
        );
      }

      if (
        prev.cash < TRAVEL_COST
      ) {
        return appendActivity(
          prev,
          `Travel requires ${money(
            TRAVEL_COST
          )}.`,
          "failure"
        );
      }

      if (
        prev.travelCooldownUntil &&
        prev.travelCooldownUntil >
          Date.now()
      ) {
        return appendActivity(
          prev,
          `Travel is on cooldown for ${formatTime(
            prev.travelCooldownUntil -
              Date.now()
          )}.`,
          "failure"
        );
      }

      const locationName =
        getLocationName(id);

      const next: SaveData = {
        ...prev,

        cash:
          prev.cash -
          TRAVEL_COST,

        currentLocation: id,

        travelCooldownUntil:
          Date.now() +
          TRAVEL_COOLDOWN,

        locationsVisited:
          prev.locationsVisited.includes(id)
            ? prev.locationsVisited
            : [
                ...prev.locationsVisited,
                id,
              ],
      };

      return appendActivity(
        next,
        `Travelled to ${locationName}.`,
        "system"
      );
    });

  /*
   * JOB SYSTEM
   */
  const joinJob = (id: string) =>
    setGameState((prev) => {
      const newJob = getJob(id);

      if (!newJob) {
        return prev;
      }

      /*
       * Pay outstanding salary before changing jobs.
       */
      let next = {
        ...prev,
      };

      if (prev.currentJob) {
        const previousJob =
          getJob(prev.currentJob);

        if (previousJob) {
          const now = Date.now();

          const ticks = Math.floor(
            (now -
              prev.lastJobPayment) /
              JOB_PAY_INTERVAL
          );

          if (ticks > 0) {
            next.cash =
              prev.cash +
              previousJob.salary *
                ticks;

            next.lastJobPayment =
              prev.lastJobPayment +
              ticks *
                JOB_PAY_INTERVAL;
          }
        }
      }

      if (
        prev.currentJob === id
      ) {
        return appendActivity(
          next,
          `You are already employed as ${newJob.title}.`,
          "job"
        );
      }

      next.currentJob = id;
      next.jobStartedAt = Date.now();
      next.lastJobPayment = Date.now();

      return appendActivity(
        next,
        `Started work as ${newJob.title}.`,
        "job"
      );
    });

  /*
   * PROPERTY
   */
  const buyProperty = (id: string) =>
    setGameState((prev) => {
      const p = getProperty(id);

      const currentProperty =
        getProperty(
          prev.ownedProperty
        );

      if (!p) {
        return prev;
      }

      if (
        p.price <
        (currentProperty?.price || 0)
      ) {
        return appendActivity(
          prev,
          "You cannot downgrade your property.",
          "failure"
        );
      }

      if (
        prev.cash < p.price
      ) {
        return appendActivity(
          prev,
          "Not enough cash.",
          "failure"
        );
      }

      const next: SaveData = {
        ...prev,

        cash:
          prev.cash -
          p.price,

        ownedProperty: id,

        happiness: Math.min(
          p.maxHappiness,
          prev.happiness + 10
        ),
      };

      return appendActivity(
        next,
        `Moved into ${p.name}.`,
        "success"
      );
    });

  /*
   * BANK
   */
  const bankDeposit = (
    amount: number
  ) =>
    setGameState((prev) => {
      const n = Math.min(
        prev.cash,
        Math.max(0, amount)
      );

      if (n <= 0) {
        return prev;
      }

      return {
        ...prev,

        cash:
          prev.cash - n,

        bank:
          prev.bank + n,
      };
    });

  const bankWithdraw = (
    amount: number
  ) =>
    setGameState((prev) => {
      const n = Math.min(
        prev.bank,
        Math.max(0, amount)
      );

      if (n <= 0) {
        return prev;
      }

      return {
        ...prev,

        cash:
          prev.cash + n,

        bank:
          prev.bank - n,
      };
    });

  /*
   * EDUCATION
   */
  const startEducation = (
    id: string
  ) =>
    setGameState((prev) => {
      const course =
        EDUCATION.find(
          (x) => x.id === id
        );

      if (
        !course ||
        prev.educationActive ||
        prev.educationCompleted.includes(
          id
        ) ||
        prev.cash < course.cost
      ) {
        return prev;
      }

      const next: SaveData = {
        ...prev,

        cash:
          prev.cash -
          course.cost,

        educationActive: id,

        educationStartedAt:
          Date.now(),
      };

      return appendActivity(
        next,
        `Started ${course.name}.`,
        "system"
      );
    });

  const finishEducation = () =>
    setGameState((prev) => {
      const course =
        EDUCATION.find(
          (x) =>
            x.id ===
            prev.educationActive
        );

      if (
        !course ||
        !prev.educationStartedAt ||
        Date.now() -
          prev.educationStartedAt <
          course.durationHours *
            3600000
      ) {
        return appendActivity(
          prev,
          "That course is not finished yet.",
          "failure"
        );
      }

      const next: SaveData = {
        ...prev,

        educationActive: null,

        educationStartedAt: null,

        educationCompleted: [
          ...prev.educationCompleted,
          course.id,
        ],
      };

      return appendActivity(
        next,
        `Completed ${course.name}.`,
        "success"
      );
    });

  /*
   * MISSIONS
   */
  const missionProgress = (
    mission: (typeof MISSIONS)[number]
  ) => {
    switch (mission.requirement) {
      case "crime":
        return gameState.crimesCompleted;

      case "combat":
        return gameState.fightsWon;

      case "gym":
        return gameState.gymSessions;

      default:
        return gameState.cash;
    }
  };

  const claimMission = (
    id: string
  ) =>
    setGameState((prev) => {
      const mission =
        MISSIONS.find(
          (x) => x.id === id
        );

      if (
        !mission ||
        prev.completedMissions.includes(
          id
        )
      ) {
        return prev;
      }

      let progress = 0;

      switch (mission.requirement) {
        case "crime":
          progress =
            prev.crimesCompleted;
          break;

        case "combat":
          progress =
            prev.fightsWon;
          break;

        case "gym":
          progress =
            prev.gymSessions;
          break;

        default:
          progress =
            prev.cash;
      }

      if (
        progress <
        mission.target
      ) {
        return appendActivity(
          prev,
          "Mission requirements have not been met.",
          "failure"
        );
      }

      const next: SaveData = {
        ...prev,

        cash:
          prev.cash +
          mission.rewardCash,

        xp:
          prev.xp +
          mission.rewardXp,

        completedMissions: [
          ...prev.completedMissions,
          id,
        ],
      };

      return appendActivity(
        next,
        `Mission complete: ${mission.name}.`,
        "success"
      );
    });

  /*
   * DAILY REWARD
   */
  const claimDaily = () =>
    setGameState((prev) => {
      const now = Date.now();

      if (
        prev.lastDailyClaim &&
        now - prev.lastDailyClaim <
          DAILY_INTERVAL
      ) {
        return appendActivity(
          prev,
          "Daily reward is not ready yet.",
          "failure"
        );
      }

      const streak =
        prev.lastDailyClaim &&
        now -
          prev.lastDailyClaim <
          DAILY_INTERVAL * 2
          ? prev.dailyStreak + 1
          : 1;

      const reward =
        500 +
        Math.min(
          5000,
          streak * 250
        );

      const next: SaveData = {
        ...prev,

        cash:
          prev.cash + reward,

        merits:
          prev.merits + 1,

        points:
          prev.points + 10,

        dailyStreak: streak,

        lastDailyClaim: now,
      };

      return appendActivity(
        next,
        `Daily reward claimed: ${money(
          reward
        )} and 1 merit point.`,
        "success"
      );
    });

  /*
   * FACTIONS
   */
  const joinFaction = (
    id: string
  ) =>
    setGameState((prev) => {
      const cost =
        prev.faction ? 0 : 500;

      if (
        prev.faction === id
      ) {
        return prev;
      }

      if (
        prev.faction &&
        prev.faction !== id
      ) {
        return appendActivity(
          prev,
          "You must leave your current faction before joining another.",
          "failure"
        );
      }

      if (
        prev.cash < cost
      ) {
        return appendActivity(
          prev,
          "You need $500 to join a faction.",
          "failure"
        );
      }

      const next: SaveData = {
        ...prev,

        cash:
          prev.cash - cost,

        faction: id,

        factionReputation: 0,
      };

      return appendActivity(
        next,
        `Joined ${id}.`,
        "success"
      );
    });

  const workFaction = () =>
    setGameState((prev) => {
      if (!prev.faction) {
        return appendActivity(
          prev,
          "Join a faction first.",
          "failure"
        );
      }

      if (prev.energy < 10) {
        return appendActivity(
          prev,
          "You need 10 energy.",
          "failure"
        );
      }

      const gain =
        5 +
        Math.floor(
          Math.random() * 10
        );

      const next: SaveData = {
        ...prev,

        energy:
          prev.energy - 10,

        factionReputation:
          prev.factionReputation +
          gain,

        points:
          prev.points + 2,
      };

      return appendActivity(
        next,
        `Faction work completed: +${gain} reputation.`,
        "success"
      );
    });

  /*
   * MARKET
   */
  const tradeMarket = (
    id: string,
    buy: boolean
  ) =>
    setGameState((prev) => {
      const basePrice =
        DEFAULT_MARKET_PRICES[id] ??
        100;

      const price =
        prev.market[id] ??
        basePrice;

      const owned =
        prev.inventory[id] || 0;

      if (buy) {
        if (
          prev.cash < price
        ) {
          return appendActivity(
            prev,
            "Not enough cash.",
            "failure"
          );
        }

        const next: SaveData = {
          ...prev,

          cash:
            prev.cash - price,

          inventory: {
            ...prev.inventory,

            [id]:
              owned + 1,
          },
        };

        return appendActivity(
          next,
          `Bought ${id} for ${money(
            price
          )}.`,
          "success"
        );
      }

      if (owned <= 0) {
        return appendActivity(
          prev,
          `You don't own any ${id}.`,
          "failure"
        );
      }

      /*
       * Sell at a slight market spread.
       * No random price generation here.
       */
      const sellPrice = Math.max(
        1,
        Math.floor(price * 0.95)
      );

      const next: SaveData = {
        ...prev,

        cash:
          prev.cash + sellPrice,

        inventory: {
          ...prev.inventory,

          [id]:
            owned - 1,
        },
      };

      return appendActivity(
        next,
        `Sold ${id} for ${money(
          sellPrice
        )}.`,
        "success"
      );
    });

  /*
   * ACHIEVEMENTS
   */
  const earnMerit = (
    reason: string
  ) =>
    setGameState((prev) => {
      if (
        prev.achievements.includes(
          reason
        )
      ) {
        return prev;
      }

      const next: SaveData = {
        ...prev,

        achievements: [
          ...prev.achievements,
          reason,
        ],

        merits:
          prev.merits + 1,
      };

      return appendActivity(
        next,
        `Achievement unlocked: ${reason}.`,
        "critical"
      );
    });

  /*
   * Finish combat cleanly.
   */
  const finishCombat = () => {
    setCombatOpponent(null);
    setCombatStarted(false);
    setCombatMessage(
      "Choose an opponent."
    );
    setCurrentScreen("combat");
  };

  /*
   * Reset
   */
  const resetGame = () => {
    localStorage.removeItem(
      SAVE_KEY
    );

    setGameState(freshSave());

    setCombatOpponent(null);
    setCombatStarted(false);
    setEncounter(null);
    setCurrentScreen("character");
  };

  return {
    gameState,
    setGameState,

    currentScreen,
    setCurrentScreen,

    level,

    maxHealth,
    maxNerve,

    gym,
    job,
    education,

    encounter,
    setEncounter,

    combatOpponent,
    setCombatOpponent,

    combatStarted,
    setCombatStarted,

    combatMessage,

    commitCrime,

    train,
    buyGym,

    attack,
    beginCombat,
    resolveAttack,
    finishCombat,

    buyItem,
    useItem,
    equip,

    randomEncounter,
    chooseEncounter,

    travel,
    joinJob,

    buyProperty,

    bankDeposit,
    bankWithdraw,

    startEducation,
    finishEducation,

    missionProgress,
    claimMission,

    claimDaily,

    joinFaction,
    workFaction,

    tradeMarket,

    earnMerit,

    travelLocked,

    log,

    resetGame,
  };
}

function App() {
  const g = useRiftCity();

  const levelInfo =
    getLevel(g.gameState.xp);

  const maxHappy =
    getProperty(
      g.gameState.ownedProperty
    )?.maxHappiness ?? 100;

  const [
    activeModal,
    setActiveModal,
  ] = useState<ActiveModal>(null);

  const [now, setNow] =
    useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () =>
      window.clearInterval(timer);
  }, []);

  const energyNextTick =
    g.gameState.energy >= MAX_ENERGY
      ? 0
      : Math.max(
          0,
          ENERGY_REGEN_INTERVAL -
            ((now -
              g.gameState
                .lastEnergyUpdate) %
              ENERGY_REGEN_INTERVAL)
        );

  const nerveNextTick =
    g.gameState.nerve >=
    g.maxNerve
      ? 0
      : Math.max(
          0,
          NERVE_REGEN_INTERVAL -
            ((now -
              g.gameState
                .lastNerveUpdate) %
              NERVE_REGEN_INTERVAL)
        );

  const happyNextTick =
    g.gameState.happiness >=
    maxHappy
      ? 0
      : Math.max(
          0,
          HAPPINESS_TICK -
            ((now -
              g.gameState
                .lastHappinessUpdate) %
              HAPPINESS_TICK)
        );

  const nav: {
    id: Screen;
    label: string;
    icon: string;
  }[] = [
    {
      id: "character",
      label: "Character",
      icon: "👤",
    },
    {
      id: "city",
      label: "City",
      icon: "🏙️",
    },
    {
      id: "crimes",
      label: "Crimes",
      icon: "🕵️",
    },
    {
      id: "combat",
      label: "Combat",
      icon: "⚔️",
    },
    {
      id: "gym",
      label: "Gym",
      icon: "🏋️",
    },
    {
      id: "jobs",
      label: "Jobs",
      icon: "💼",
    },
    {
      id: "items",
      label: "Items",
      icon: "🎒",
    },
    {
      id: "missions",
      label: "Missions",
      icon: "📜",
    },
    {
      id: "education",
      label: "Education",
      icon: "🎓",
    },
    {
      id: "property",
      label: "Property",
      icon: "🏠",
    },
    {
      id: "market",
      label: "Market",
      icon: "📈",
    },
    {
      id: "faction",
      label: "Faction",
      icon: "🛡️",
    },
    {
      id: "awards",
      label: "Awards",
      icon: "🏆",
    },
  ];

  const title =
    nav.find(
      (n) =>
        n.id === g.currentScreen
    )?.label || "RiftCity";

  return (
    <div className="layout-root">
      <aside className="nav-rail">
        <div className="brand">
          <h2>RIFTCITY</h2>

          <span className="badge">
            v2.1
          </span>
        </div>

        <nav className="nav-list">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${
                g.currentScreen === n.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                g.setCurrentScreen(
                  n.id
                )
              }
            >
              <span className="nav-icon">
                {n.icon}
              </span>

              <span className="nav-label">
                {n.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="nav-footer">
          <button
            className="btn-secondary"
            onClick={
              g.randomEncounter
            }
          >
            🎲 Explore
          </button>

          <button
            className="btn-danger-ghost"
            onClick={() => {
              if (
                window.confirm(
                  "Reset save data?"
                )
              ) {
                g.resetGame();
              }
            }}
          >
            ↻ Reset
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header
          className="top-status-bar"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
            }}
          >
            <div
              className="user-level"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                className="level-badge"
                style={{
                  whiteSpace:
                    "nowrap",
                }}
              >
                LV {g.level}
              </span>

              <div
                className="xp-container"
                style={{
                  minWidth: "80px",
                }}
              >
                <div
                  className="xp-text"
                  style={{
                    fontSize: "10px",
                  }}
                >
                  XP{" "}
                  {
                    levelInfo.currentXp
                  }
                  /100
                </div>

                <div
                  className="bar-track compact"
                  style={{
                    height: "4px",
                    background:
                      "#222",
                  }}
                >
                  <div
                    className="bar-fill xp"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          levelInfo.currentXp
                        )
                      )}%`,
                      height: "100%",
                      background:
                        "#3b82f6",
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              className="compact-vitals"
              style={{
                display: "flex",
                flexDirection:
                  "row",
                alignItems:
                  "center",
                gap: "12px",
              }}
            >
              <button
                onClick={() =>
                  setActiveModal(
                    "energy"
                  )
                }
                style={{
                  background:
                    "none",
                  border: "none",
                  color:
                    "inherit",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "2px",
                  padding:
                    "2px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "16px",
                  }}
                >
                  ⚡
                </span>

                <span
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {
                    g.gameState
                      .energy
                  }
                </span>
              </button>

              <button
                onClick={() =>
                  setActiveModal(
                    "nerve"
                  )
                }
                style={{
                  background:
                    "none",
                  border: "none",
                  color:
                    "inherit",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "2px",
                  padding:
                    "2px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "16px",
                  }}
                >
                  🔥
                </span>

                <span
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {
                    g.gameState
                      .nerve
                  }
                </span>
              </button>

              <button
                onClick={() =>
                  setActiveModal(
                    "happy"
                  )
                }
                style={{
                  background:
                    "none",
                  border: "none",
                  color:
                    "inherit",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "2px",
                  padding:
                    "2px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "16px",
                  }}
                >
                  😊
                </span>

                <span
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {Math.floor(
                    g.gameState
                      .happiness
                  )}
                </span>
              </button>

              <button
                onClick={() =>
                  setActiveModal(
                    "health"
                  )
                }
                style={{
                  background:
                    "none",
                  border: "none",
                  color:
                    "inherit",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "2px",
                  padding:
                    "2px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "16px",
                  }}
                >
                  ❤️
                </span>

                <span
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {Math.floor(
                    g.gameState
                      .health
                  )}
                </span>
              </button>
            </div>
          </div>

          <div
            className="currency-bar"
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "12px",
            }}
          >
            <div>
              💵{" "}
              {money(
                g.gameState
                  .cash
              )}
            </div>

            <div>
              🏦{" "}
              {money(
                g.gameState
                  .bank
              )}
            </div>

            <div>
              💎{" "}
              {
                g.gameState
                  .points
              }{" "}
              Pts
            </div>
          </div>
        </header>

        {activeModal && (
          <div
            className="modal-overlay"
            style={{
              position:
                "fixed",
              inset: 0,
              backgroundColor:
                "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              zIndex: 1000,
            }}
            onClick={() =>
              setActiveModal(null)
            }
          >
            <div
              className="modal-card"
              style={{
                background:
                  "#18181b",
                padding:
                  "20px",
                borderRadius:
                  "8px",
                minWidth:
                  "240px",
                border:
                  "1px solid #3f3f46",
                textAlign:
                  "center",
              }}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              {activeModal ===
                "energy" && (
                <>
                  <h2>
                    ⚡ Energy
                  </h2>

                  <p
                    style={{
                      fontSize:
                        "20px",
                      fontWeight:
                        "bold",
                      margin:
                        "12px 0",
                    }}
                  >
                    {
                      g.gameState
                        .energy
                    }{" "}
                    /{" "}
                    {MAX_ENERGY}
                  </p>

                  <p
                    style={{
                      color:
                        "#a1a1aa",
                    }}
                  >
                    {g.gameState
                      .energy >=
                    MAX_ENERGY
                      ? "Fully charged"
                      : `Next +1 tick in: ${formatTime(
                          energyNextTick
                        )}`}
                  </p>
                </>
              )}

              {activeModal ===
                "nerve" && (
                <>
                  <h2>
                    🔥 Nerve
                  </h2>

                  <p
                    style={{
                      fontSize:
                        "20px",
                      fontWeight:
                        "bold",
                      margin:
                        "12px 0",
                    }}
                  >
                    {
                      g.gameState
                        .nerve
                    }{" "}
                    /{" "}
                    {
                      g.maxNerve
                    }
                  </p>

                  <p
                    style={{
                      color:
                        "#a1a1aa",
                    }}
                  >
                    {g.gameState
                      .nerve >=
                    g.maxNerve
                      ? "At capacity"
                      : `Next +1 tick in: ${formatTime(
                          nerveNextTick
                        )}`}
                  </p>
                </>
              )}

              {activeModal ===
                "happy" && (
                <>
                  <h2>
                    😊 Happiness
                  </h2>

                  <p
                    style={{
                      fontSize:
                        "20px",
                      fontWeight:
                        "bold",
                      margin:
                        "12px 0",
                    }}
                  >
                    {Math.floor(
                      g.gameState
                        .happiness
                    )}{" "}
                    /{" "}
                    {maxHappy}
                  </p>

                  <p
                    style={{
                      color:
                        "#a1a1aa",
                    }}
                  >
                    {g.gameState
                      .happiness >=
                    maxHappy
                      ? "Max happiness"
                      : `Next +5 tick in: ${formatTime(
                          happyNextTick
                        )}`}
                  </p>
                </>
              )}

              {activeModal ===
                "health" && (
                <>
                  <h2>
                    ❤️ Health
                  </h2>

                  <p
                    style={{
                      fontSize:
                        "20px",
                      fontWeight:
                        "bold",
                      margin:
                        "12px 0",
                    }}
                  >
                    {Math.floor(
                      g.gameState
                        .health
                    )}{" "}
                    /{" "}
                    {
                      g.maxHealth
                    }
                  </p>

                  <p
                    style={{
                      color:
                        "#a1a1aa",
                    }}
                  >
                    {g.gameState
                      .health >=
                    g.maxHealth
                      ? "Full health"
                      : "Regenerates over time"}
                  </p>
                </>
              )}

              <button
                className="btn-primary"
                style={{
                  marginTop:
                    "16px",
                  width:
                    "100%",
                }}
                onClick={() =>
                  setActiveModal(
                    null
                  )
                }
              >
                Close
              </button>
            </div>
          </div>
        )}

        <main className="screen-container">
          <div className="screen-header">
            <span className="location-tag">
              LOCATION:{" "}
              {g.gameState.currentLocation.toUpperCase()}
            </span>

            <h1>{title}</h1>
          </div>

          {g.gameState
            .jailUntil && (
            <div className="status-alert jail">
              🔒 JAILED ·{" "}
              {formatTime(
                timeLeft(
                  g.gameState
                    .jailUntil
                )
              )}{" "}
              remaining
            </div>
          )}

          {g.gameState
            .hospitalUntil && (
            <div className="status-alert hospital">
              🏥 HOSPITAL ·{" "}
              {formatTime(
                timeLeft(
                  g.gameState
                    .hospitalUntil
                )
              )}{" "}
              remaining
            </div>
          )}

          {g.currentScreen ===
            "character" && (
            <Character g={g} />
          )}

          {g.currentScreen ===
            "city" && (
            <City g={g} />
          )}

          {g.currentScreen ===
            "crimes" && (
            <Crimes g={g} />
          )}

          {g.currentScreen ===
            "combat" && (
            <Combat g={g} />
          )}

          {g.currentScreen ===
            "gym" && (
            <GymView g={g} />
          )}

          {g.currentScreen ===
            "jobs" && (
            <Jobs g={g} />
          )}

          {g.currentScreen ===
            "items" && (
            <Items g={g} />
          )}

          {g.currentScreen ===
            "missions" && (
            <Missions g={g} />
          )}

          {g.currentScreen ===
            "education" && (
            <Education g={g} />
          )}

          {g.currentScreen ===
            "property" && (
            <PropertyView
              g={g}
            />
          )}

          {g.currentScreen ===
            "market" && (
            <Market g={g} />
          )}

          {g.currentScreen ===
            "faction" && (
            <Faction g={g} />
          )}

          {g.currentScreen ===
            "awards" && (
            <Awards g={g} />
          )}

          <section className="card activity-card">
            <div className="card-header">
              <h3>
                Activity Log
              </h3>
            </div>

            <div className="activity-list">
              {g.gameState.activities
                .slice(0, 8)
                .map((a) => (
                  <div
                    className={`activity-item ${a.type}`}
                    key={a.id}
                  >
                    <span className="time">
                      {new Date(
                        a.time
                      ).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute:
                            "2-digit",
                        }
                      )}
                    </span>

                    <span className="type-tag">
                      {a.type.toUpperCase()}
                    </span>

                    <p className="desc">
                      {a.text}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        </main>
      </div>

      {g.encounter && (
        <div className="modal-overlay">
          <div className="modal-card">
            <span className="modal-tag">
              RANDOM ENCOUNTER
            </span>

            <h2>
              {
                g.encounter
                  .title
              }
            </h2>

            <p>
              {
                g.encounter
                  .text
              }
            </p>

            <div className="modal-actions">
              {g.encounter.choices.map(
                (choice, i) => (
                  <button
                    className="btn-primary"
                    key={i}
                    onClick={() =>
                      g.chooseEncounter(
                        choice
                      )
                    }
                  >
                    {
                      choice.label
                    }
                  </button>
                )
              )}

              <button
                className="btn-secondary"
                onClick={() =>
                  g.setEncounter(
                    null
                  )
                }
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`card ${className}`}
    >
      <div className="card-header">
        <h3>{title}</h3>
      </div>

      <div className="card-body">
        {children}
      </div>
    </section>
  );
}

function Button({
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`btn-primary ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Character({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const [amount, setAmount] =
    useState("100");

  const n = Math.max(
    0,
    Number(amount) || 0
  );

  return (
    <div className="ui-grid two-col">
      <Panel title="Combat Stats">
        <div className="stats-list">
          {Object.entries(
            g.gameState.stats
          ).map(([k, v]) => (
            <div
              className="stat-row"
              key={k}
            >
              <span className="stat-name">
                {k}
              </span>

              <strong className="stat-val">
                {(
                  v as number
                ).toFixed(2)}
              </strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Core Resources">
        <div className="data-list">
          <div className="data-row">
            <span>
              ❤️ Health
            </span>

            <b>
              {Math.floor(
                g.gameState
                  .health
              )}{" "}
              /{" "}
              {
                g.maxHealth
              }
            </b>
          </div>

          <div className="data-row">
            <span>
              ⚡ Energy
            </span>

            <b>
              {
                g.gameState
                  .energy
              }{" "}
              /{" "}
              {MAX_ENERGY}
            </b>
          </div>

          <div className="data-row">
            <span>
              🧠 Nerve
            </span>

            <b>
              {
                g.gameState
                  .nerve
              }{" "}
              /{" "}
              {
                g.maxNerve
              }
            </b>
          </div>

          <div className="data-row">
            <span>
              😊 Happiness
            </span>

            <b>
              {Math.floor(
                g.gameState
                  .happiness
              )}{" "}
              /{" "}
              {getProperty(
                g.gameState
                  .ownedProperty
              )?.maxHappiness ??
                100}
            </b>
          </div>
        </div>
      </Panel>

      <Panel title="Progress Overview">
        <div className="data-list">
          <div className="data-row">
            <span>
              Crime Experience
            </span>

            <b>
              {
                g.gameState
                  .crimeExperience
              }
            </b>
          </div>

          <div className="data-row">
            <span>
              Gym Experience
            </span>

            <b>
              {
                g.gameState
                  .gymExperience
              }
            </b>
          </div>

          <div className="data-row">
            <span>
              Crimes Completed
            </span>

            <b>
              {
                g.gameState
                  .crimesCompleted
              }{" "}
              /{" "}
              {
                g.gameState
                  .crimesFailed
              }{" "}
              failed
            </b>
          </div>

          <div className="data-row">
            <span>
              Fight Record
            </span>

            <b>
              {
                g.gameState
                  .fightsWon
              }
              W /{" "}
              {
                g.gameState
                  .fightsLost
              }
              L
            </b>
          </div>

          <div className="data-row">
            <span>
              Attacks
            </span>

            <b>
              {
                g.gameState
                  .attacks
              }
            </b>
          </div>
        </div>
      </Panel>

      <Panel title="Bank Vault">
        <div className="bank-control">
          <h2 className="bank-balance">
            {money(
              g.gameState
                .bank
            )}
          </h2>

          <div className="input-group">
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
            />

            <div className="btn-group">
              <Button
                onClick={() =>
                  g.bankDeposit(
                    n
                  )
                }
              >
                Deposit
              </Button>

              <Button
                onClick={() =>
                  g.bankWithdraw(
                    n
                  )
                }
              >
                Withdraw
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function City({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <>
      <div className="ui-grid four-col">
        {LOCATIONS.map(
          ([
            id,
            name,
            desc,
          ]) => (
            <div
              className="card location-card"
              key={id}
            >
              <span className="card-tag">
                DISTRICT
              </span>

              <h3>{name}</h3>

              <p>{desc}</p>

              <Button
                onClick={() =>
                  g.travel(id)
                }
              >
                {g.gameState
                  .currentLocation ===
                id
                  ? "Current Location"
                  : "Travel"}
              </Button>
            </div>
          )
        )}
      </div>

      <Panel title="District Actions">
        <div className="ui-grid three-col">
          <Button
            onClick={
              g.randomEncounter
            }
          >
            🎲 Explore Area
          </Button>

          <Button
            onClick={() =>
              g.setCurrentScreen(
                "crimes"
              )
            }
          >
            🕵️ Street Hustles
          </Button>

          <Button
            onClick={() =>
              g.setCurrentScreen(
                "combat"
              )
            }
          >
            ⚔️ Arena Fights
          </Button>
        </div>
      </Panel>
    </>
  );
}

function Crimes({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <div className="ui-grid two-col">
      {CRIMES.map((c) => {
        const chance =
          crimeSuccessChance(
            c,
            g.gameState
              .crimeExperience,
            1,
            getCrimeStatBonus(
              g.gameState
                .stats
            )
          );

        const unlocked =
          crimeUnlocked(
            c,
            g.gameState
              .crimeExperience
          );

        return (
          <div
            className={`card crime-card ${
              unlocked
                ? ""
                : "disabled"
            }`}
            key={c.id}
          >
            <div className="card-header-split">
              <span className="card-tag">
                NERVE {c.nerve}
              </span>

              <span className="chance-badge">
                {unlocked
                  ? `${chance.toFixed(
                      0
                    )}% Success`
                  : `Requires CE ${c.crimeExperienceRequired}`}
              </span>
            </div>

            <h3>{c.name}</h3>

            <p>
              {
                c.description
              }
            </p>

            <div className="bar-track">
              <div
                className="bar-fill crime"
                style={{
                  width: `${
                    unlocked
                      ? Math.min(
                          100,
                          chance
                        )
                      : 0
                  }%`,
                }}
              />
            </div>

            <Button
              disabled={
                !unlocked ||
                g.gameState
                  .nerve <
                  c.nerve
              }
              onClick={() =>
                g.commitCrime(
                  c
                )
              }
            >
              Commit Crime
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function Combat({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  if (g.combatOpponent) {
    return (
      <InteractiveCombatView
        player={{
          id: "player",
          name: "You",
          level: g.level,
          health:
            g.gameState
              .health,
          maxHealth:
            g.maxHealth,
          stats:
            g.gameState
              .stats,
          weapons:
            DEFAULT_WEAPONS,
        }}
        enemy={{
          id:
            g.combatOpponent
              .id,

          name:
            g.combatOpponent
              .name,

          level:
            g.combatOpponent
              .level,

          health:
            g.combatOpponent
              .health,

          maxHealth:
            g.combatOpponent
              .maxHealth,

          stats:
            g.combatOpponent
              .stats,

          weapons:
            g.combatOpponent
              .weapons ||
            DEFAULT_WEAPONS,

          cashReward:
            g.combatOpponent
              .cashReward,

          xpReward:
            g.combatOpponent
              .level * 25,
        }}
        onFinish={(
          outcome,
          enemy,
          finalPlayerHealth
        ) => {
          /*
           * If the combat component provides a real
           * attack start callback in the future, this
           * remains the point where the energy cost
           * should occur.
           *
           * For the current component contract, attack()
           * reserves the encounter and the actual fight
           * resolution occurs here.
           */

          let cashEarned = 0;

          let xpEarned =
            enemy.xpReward ||
            50;

          /*
           * IMPORTANT:
           *
           * "leave" is NOT a combat victory.
           */
          const isVictory =
            outcome === "mug";

          if (
            outcome === "mug"
          ) {
            cashEarned =
              Math.floor(
                (enemy.cashReward ||
                  100) *
                  (0.4 +
                    Math.random() *
                      0.4)
              );

            xpEarned =
              Math.floor(
                xpEarned * 0.25
              );
          } else if (
            outcome === "leave"
          ) {
            /*
             * Leaving gives a small participation XP reward,
             * but does not alter the win/loss record.
             */
            xpEarned =
              Math.floor(
                xpEarned * 0.25
              );
          }

          setGameState(
            (prev) => {
              const next: SaveData =
                {
                  ...prev,

                  cash:
                    prev.cash +
                    cashEarned,

                  xp:
                    prev.xp +
                    xpEarned,

                  health:
                    Math.max(
                      1,
                      Math.min(
                        g.maxHealth,
                        finalPlayerHealth
                      )
                    ),

                  fightsWon:
                    isVictory
                      ? prev.fightsWon +
                        1
                      : prev.fightsWon,
                };

              const description =
                isVictory
                  ? `COMBAT VICTORY: Defeated ${enemy.name}. Earned ${money(
                      cashEarned
                    )} and ${xpEarned} XP.`
                  : `COMBAT ENDED: You left the encounter with ${xpEarned} XP.`;

              return appendActivity(
                next,
                description,
                isVictory
                  ? "combat"
                  : "system"
              );
            }
          );

          g.setCombatOpponent(
            null
          );

          g.setCombatStarted(
            false
          );

          g.setCurrentScreen(
            "combat"
          );
        }}
        onDefeat={() => {
          setGameStateForCombatDefeat(
            g
          );
        }}
      />
    );
  }

  return (
    <Panel title="Available Targets">
      <div className="ui-grid two-col">
        {PLAYER_PROFILES.map(
          (o) => (
            <div
              className="card target-card"
              key={o.id}
            >
              <div className="card-header-split">
                <span className="card-tag">
                  LV {o.level}
                </span>

                <span className="status-badge">
                  {o.status}
                </span>
              </div>

              <h3>{o.name}</h3>

              <p>
                {o.title} ·{" "}
                {o.location}
              </p>

              <div className="data-list">
                <div className="data-row">
                  <span>
                    Health
                  </span>

                  <b>
                    {o.health}/
                    {
                      o.maxHealth
                    }
                  </b>
                </div>

                <div className="data-row">
                  <span>
                    Reward
                  </span>

                  <b>
                    {money(
                      o.cashReward
                    )}
                  </b>
                </div>

                <div className="data-row">
                  <span>
                    Win Chance
                  </span>

                  <b>
                    {calculateWinChance(
                      g.gameState
                        .stats,
                      o.stats
                    )}
                    %
                  </b>
                </div>
              </div>

              <Button
                onClick={() =>
                  g.attack(o)
                }
                disabled={
                  Boolean(
                    g.gameState
                      .jailUntil ||
                      g.gameState
                        .hospitalUntil
                  ) ||
                  g.gameState
                    .energy < 10
                }
              >
                Attack (10 ⚡)
              </Button>
            </div>
          )
        )}
      </div>
    </Panel>
  );
}

/*
 * Separate helper keeps Combat readable while still using
 * the hook's existing state management.
 */
function setGameStateForCombatDefeat(
  g: ReturnType<
    typeof useRiftCity
  >
) {
  g.setGameState(
    (prev) => ({
      ...prev,

      health: 0,

      fightsLost:
        prev.fightsLost + 1,

      hospitalUntil:
        Date.now() +
        HOSPITAL_MINUTES *
          60000,

      activities: [
        {
          id:
            Date.now() +
            Math.random(),

          text:
            "COMBAT LOSS: Knocked out and hospitalized.",

          type: "failure",

          time: Date.now(),
        },

        ...prev.activities,
      ].slice(0, 60),
    })
  );

  g.setCombatOpponent(
    null
  );

  g.setCombatStarted(
    false
  );

  g.setCurrentScreen(
    "city"
  );
}

function GymView({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <>
      <div className="gym-selector">
        {GYMS.filter(
          (x) => !x.jailOnly
        ).map((x) => (
          <button
            key={x.id}
            className={`gym-btn ${
              g.gym.id === x.id
                ? "active"
                : ""
            }`}
            disabled={
              !gymUnlocked(
                x,
                g.gameState
                  .gymExperience
              )
            }
            onClick={() =>
              g.buyGym(x.id)
            }
          >
            <span>
              {x.name}
            </span>

            <small>
              {gymUnlocked(
                x,
                g.gameState
                  .gymExperience
              )
                ? money(
                    x.membershipCost
                  )
                : `EXP ${x.gymExpRequired}`}
            </small>
          </button>
        ))}
      </div>

      <Panel
        title={`${g.gym.name} · (${g.gym.energyCost} Energy per set)`}
      >
        <div className="ui-grid four-col">
          {TRAINING_STATS.map(
            (stat) => (
              <div
                className="card train-card"
                key={stat.id}
              >
                <span className="train-icon">
                  {stat.icon}
                </span>

                <h3>
                  {stat.name}
                </h3>

                <p>
                  {
                    stat.description
                  }
                </p>

                <Button
                  disabled={
                    !canTrainStat(
                      g.gym,
                      stat.id
                    ) ||
                    g.gameState
                      .energy <
                      g.gym
                        .energyCost
                  }
                  onClick={() =>
                    g.train(
                      stat.id
                    )
                  }
                >
                  Train
                </Button>
              </div>
            )
          )}
        </div>
      </Panel>
    </>
  );
}

function Jobs({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <div className="ui-grid two-col">
      {JOBS.map((job) => (
        <div
          className="card job-card"
          key={job.id}
        >
          <span className="card-tag">
            {job.company}
          </span>

          <h3>
            {job.title}
          </h3>

          <p>
            {job.description}
          </p>

          <div className="data-row">
            <span>
              Hourly Salary
            </span>

            <b>
              {money(
                job.salary
              )}
            </b>
          </div>

          <Button
            onClick={() =>
              g.joinJob(job.id)
            }
          >
            {g.gameState
              .currentJob ===
            job.id
              ? "Current Position"
              : "Apply Now"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function Items({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <div className="ui-grid three-col">
      {ITEMS.map((item) => (
        <div
          className="card item-card"
          key={item.id}
        >
          <span className="card-tag">
            {item.type.toUpperCase()}
          </span>

          <h3>
            {item.name}
          </h3>

          <p>
            {item.description}
          </p>

          <strong className="item-price">
            {money(item.price)}
          </strong>

          <div className="btn-group">
            <Button
              onClick={() =>
                g.buyItem(
                  item.id
                )
              }
            >
              Buy
            </Button>

            {(g.gameState
              .inventory[
              item.id
            ] || 0) > 0 && (
              <Button
                onClick={() =>
                  item.type ===
                    "weapon" ||
                  item.type ===
                    "armor"
                    ? g.equip(
                        item.id
                      )
                    : g.useItem(
                        item.id
                      )
                }
              >
                {item.type ===
                    "weapon" ||
                  item.type ===
                    "armor"
                  ? "Equip"
                  : "Use"}
              </Button>
            )}
          </div>

          <span className="item-count">
            Owned:{" "}
            {g.gameState
              .inventory[
              item.id
            ] || 0}
          </span>
        </div>
      ))}
    </div>
  );
}

function Missions({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <div className="ui-grid two-col">
      {MISSIONS.map(
        (mission) => {
          const progress =
            g.missionProgress(
              mission
            );

          const done =
            g.gameState
              .completedMissions.includes(
                mission.id
              );

          return (
            <div
              className="card mission-card"
              key={mission.id}
            >
              <span className="card-tag">
                MISSION
              </span>

              <h3>
                {mission.name}
              </h3>

              <p>
                {
                  mission.description
                }
              </p>

              <div className="bar-track">
                <div
                  className="bar-fill mission"
                  style={{
                    width: `${Math.min(
                      100,
                      (progress /
                        mission.target) *
                        100
                    )}%`,
                  }}
                />
              </div>

              <div className="data-row">
                <span>
                  Progress
                </span>

                <b>
                  {Math.min(
                    progress,
                    mission.target
                  ).toLocaleString()}{" "}
                  /{" "}
                  {mission.target.toLocaleString()}
                </b>
              </div>

              <Button
                disabled={
                  done ||
                  progress <
                    mission.target
                }
                onClick={() =>
                  g.claimMission(
                    mission.id
                  )
                }
              >
                {done
                  ? "Claimed"
                  : "Claim Reward"}
              </Button>
            </div>
          );
        }
      )}
    </div>
  );
}

function Education({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  return (
    <>
      <Panel title="Active Course Status">
        {g.education ? (
          <div className="course-active">
            <h3>
              {
                g.education
                  .name
              }
            </h3>

            <p>
              Duration:{" "}
              {
                g.education
                  .durationHours
              }{" "}
              hours
            </p>

            <Button
              onClick={
                g.finishEducation
              }
            >
              Check Completion
            </Button>
          </div>
        ) : (
          <p>
            No course currently
            active.
          </p>
        )}
      </Panel>

      <div className="ui-grid two-col">
        {EDUCATION.map(
          (course) => (
            <div
              className="card course-card"
              key={course.id}
            >
              <h3>
                {course.name}
              </h3>

              <p>
                {
                  course.description
                }
              </p>

              <div className="data-list">
                <div className="data-row">
                  <span>
                    Cost
                  </span>

                  <b>
                    {money(
                      course.cost
                    )}
                  </b>
                </div>

                <div className="data-row">
                  <span>
                    Time
                  </span>

                  <b>
                    {
                      course.durationHours
                    }
                    h
                  </b>
                </div>
              </div>

              <Button
                disabled={
                  g.gameState
                    .educationCompleted.includes(
                      course.id
                    ) ||
                  Boolean(
                    g.education
                  ) ||
                  g.gameState
                    .cash <
                    course.cost
                }
                onClick={() =>
                  g.startEducation(
                    course.id
                  )
                }
              >
                {g.gameState
                  .educationCompleted.includes(
                    course.id
                  )
                  ? "Completed"
                  : "Enroll"}
              </Button>
            </div>
          )
        )}
      </div>
    </>
  );
}

function PropertyView({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const current =
    getProperty(
      g.gameState
        .ownedProperty
    )?.price || 0;

  return (
    <div className="ui-grid two-col">
      {PROPERTIES.map(
        (property) => (
          <div
            className={`card property-card ${
              property.price <
              current
                ? "disabled"
                : ""
            }`}
            key={property.id}
          >
            <span className="card-tag">
              REAL ESTATE
            </span>

            <h3>
              {property.name}
            </h3>

            <p>
              {
                property.description
              }
            </p>

            <div className="data-list">
              <div className="data-row">
                <span>
                  Price
                </span>

                <b>
                  {money(
                    property.price
                  )}
                </b>
              </div>

              <div className="data-row">
                <span>
                  Health Bonus
                </span>

                <b>
                  +
                  {
                    property.maxHealthBonus
                  }
                </b>
              </div>

              <div className="data-row">
                <span>
                  Nerve Bonus
                </span>

                <b>
                  +
                  {
                    property.nerveBonus
                  }
                </b>
              </div>

              <div className="data-row">
                <span>
                  Happiness
                </span>

                <b>
                  {property.maxHappiness}
                </b>
              </div>
            </div>

            <Button
              disabled={
                property.price <
                  current ||
                g.gameState
                  .cash <
                  property.price
              }
              onClick={() =>
                g.buyProperty(
                  property.id
                )
              }
            >
              {g.gameState
                .ownedProperty ===
              property.id
                ? "Current Residence"
                : "Purchase"}
            </Button>
          </div>
        )
      )}
    </div>
  );
}

function Market({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const goods =
    Object.keys(
      g.gameState.market
    );

  return (
    <Panel title="Dynamic Commodities Market">
      <div className="ui-grid four-col">
        {goods.map((id) => (
          <div
            className="card market-card"
            key={id}
          >
            <span className="card-tag">
              COMMODITY
            </span>

            <h3>
              {id.toUpperCase()}
            </h3>

            <p>
              Unit Price:{" "}
              {money(
                g.gameState
                  .market[id]
              )}
            </p>

            <span className="item-count">
              Owned:{" "}
              {g.gameState
                .inventory[id] ||
                0}
            </span>

            <div className="btn-group">
              <Button
                onClick={() =>
                  g.tradeMarket(
                    id,
                    true
                  )
                }
              >
                Buy
              </Button>

              <Button
                onClick={() =>
                  g.tradeMarket(
                    id,
                    false
                  )
                }
                disabled={
                  !g.gameState
                    .inventory[
                    id
                  ]
                }
              >
                Sell
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Faction({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const factions = [
    "Iron Syndicate",
    "Rift Guard",
    "Dock Union",
  ];

  return (
    <Panel title="Faction Headquarters">
      <div className="ui-grid three-col">
        {factions.map(
          (faction) => (
            <div
              className={`card faction-card ${
                g.gameState
                  .faction &&
                g.gameState
                  .faction !==
                  faction
                  ? "disabled"
                  : ""
              }`}
              key={faction}
            >
              <h3>
                {faction}
              </h3>

              <p>
                {g.gameState
                  .faction ===
                faction
                  ? `Reputation: ${g.gameState.factionReputation}`
                  : "Entry Fee: $500"}
              </p>

              <Button
                disabled={
                  Boolean(
                    g.gameState
                      .faction
                  ) &&
                  g.gameState
                    .faction !==
                    faction
                }
                onClick={() =>
                  g.joinFaction(
                    faction
                  )
                }
              >
                {g.gameState
                  .faction ===
                faction
                  ? "Member"
                  : "Join Faction"}
              </Button>
            </div>
          )
        )}
      </div>

      {g.gameState
        .faction && (
        <div
          style={{
            marginTop:
              "16px",
          }}
        >
          <Button
            onClick={
              g.workFaction
            }
          >
            Complete Faction Work
            (10 ⚡)
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Awards({
  g,
}: {
  g: ReturnType<
    typeof useRiftCity
  >;
}) {
  const awards: [
    string,
    boolean
  ][] = [
    [
      "First Crime",
      g.gameState
        .crimesCompleted >=
        1,
    ],

    [
      "Ten Crimes",
      g.gameState
        .crimesCompleted >=
        10,
    ],

    [
      "First Victory",
      g.gameState
        .fightsWon >= 1,
    ],

    [
      "Gym Rat",
      g.gameState
        .gymSessions >=
        10,
    ],

    [
      "Five Figures",
      g.gameState
        .cash >= 100000,
    ],

    [
      "Level 10",
      g.level >= 10,
    ],
  ];

  return (
    <>
      <Panel title="Milestones & Achievements">
        <div className="ui-grid three-col">
          {awards.map(
            ([name, done]) => (
              <div
                className={`card achievement-card ${
                  done
                    ? "unlocked"
                    : "locked"
                }`}
                key={name}
              >
                <h3>
                  {name}
                </h3>

                <span className="status-text">
                  {done
                    ? "Unlocked"
                    : "Locked"}
                </span>

                {done &&
                  !g.gameState
                    .achievements.includes(
                      name
                    ) && (
                    <Button
                      onClick={() =>
                        g.earnMerit(
                          name
                        )
                      }
                    >
                      Claim Merit
                    </Button>
                  )}
              </div>
            )
          )}
        </div>
      </Panel>

      <Panel title="Daily Rewards">
        <Button
          onClick={
            g.claimDaily
          }
        >
          Claim Daily Bonus
        </Button>
      </Panel>
    </>
  );
}

export default App;
