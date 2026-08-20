import { useEffect, useState } from "react";
import { tickGameState } from "../systems/gameTickSystem";
import { getJobPosition } from "../data/jobs";
import {
  CRIMES, Crime, crimeSuccessChance, crimeUnlocked, getCrimeStatBonus, randomReward,
} from "../systems/crimeSystem";
import { CombatStats, getLevel, getMaxHealth } from "../systems/progressionSystem";
import {
  ENERGY_REGEN_INTERVAL, MAX_ENERGY, NERVE_REGEN_INTERVAL, HAPPINESS_TICK,
  HEALTH_REGEN_INTERVAL, JAIL_MINUTES, BANK_INTEREST_INTERVAL, DAILY_INTERVAL,
  TRAVEL_COOLDOWN, TRAVEL_COST, MARKET_UPDATE_INTERVAL, JOB_PAY_INTERVAL,
  loadSave, freshSave, money, formatTime, getLocationName, randomMarketPrice,
  getAvailableEncounter, ENCOUNTERS, SAVE_KEY, DEFAULT_MARKET_PRICES,
} from "../core/gameCore";
import {
  GYMS, TRAINING_STATS, TrainingStat, applyTraining, canTrainStat,
  getGymExperienceGain, gymUnlocked,
} from "../systems/gymSystem";
import { PlayerProfile } from "../systems/combatSystem";
import {
  EDUCATION, ITEMS, JOBS, MISSIONS, PROPERTIES,
  getItem, getJob, getProperty,
} from "../data/gameData";
import type { Screen, SaveData, ActivityType, Activity } from "../types/riftCity";
import type { Encounter, EncounterChoice } from "../constants/encounters";
import { PLAYER_PROFILES } from "../data/playerProfiles";
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

  const jobPosition = job
    ? getJobPosition(job, gameState.jobSkills)
    : undefined;

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
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(gameState)
      );
    } catch {
      // Storage can be unavailable or quota-restricted in some browser modes.
    }
  }, [gameState]);

  /*
   * Main game clock.
   *
   * Keep all passive progression in the centralized tick system so
   * health, jobs, market updates, and resource regeneration cannot
   * drift apart across duplicate implementations.
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const maxHappiness = property?.maxHappiness ?? 100;

      setGameState((prev) =>
        tickGameState(prev, now, {
          maxHealth,
          maxNerve,
          maxHappiness,
        })
      );
    }, 1000);

    return () => window.clearInterval(id);
  }, [maxNerve, maxHealth, property?.maxHappiness]);

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
   * WORLD TRAVEL (FOUNDATION)
   *
   * Kept as a game-state primitive for the future world map.
   * Local city navigation is handled by City.tsx and does not
   * consume travel cooldown or travel cash.
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
              getJobPosition(previousJob, prev.jobSkills).salary *
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
      next.lastJobSkillUpdate = Date.now();
      next.jobPositionTiers = {
        ...next.jobPositionTiers,
        [id]: getJobPosition(newJob, next.jobSkills).tier,
      };

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
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // Keep reset functional even when browser storage is unavailable.
    }

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
    jobPosition,
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
    appendActivity,

    resetGame,
  };
}
