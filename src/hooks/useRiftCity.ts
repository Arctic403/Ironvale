import { useEffect, useRef, useState } from "react";
import { tickGameState } from "../systems/gameTickSystem";
import { getJobPosition, getJobStatBonuses } from "../data/jobs";
import {
  CRIMES, Crime, CrimeChoice, crimeSuccessChance, crimeUnlocked, getCrimeStatBonus, randomReward,
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
  GYMS, TRAINING_STATS, TRAINING_PROGRAMS, TrainingStat, applyTraining, canTrainStat,
  getGymExperienceGain, gymUnlocked, getTrainingProgram, programUnlocked, trainingEnergyCost,
} from "../systems/gymSystem";
import { PlayerProfile } from "../systems/combatSystem";
import {
  EDUCATION, ITEMS, JOBS, MISSIONS, PROPERTIES,
  getItem, getJob, getProperty,
} from "../data/gameData";
import type { Screen, SaveData, ActivityType, Activity, AuctionListing } from "../types/riftCity";
import type { Encounter, EncounterChoice } from "../constants/encounters";
import { PLAYER_PROFILES } from "../data/playerProfiles";
import { SEEDED_LISTINGS, listingFee } from "../systems/auctionSystem";
import { DAILY_CHALLENGES, WEEKLY_CHALLENGES, MERIT_UPGRADES, PROPERTY_UPGRADES, WORLD_EVENTS, getFaction, getFactionRank, challengeProgress } from "../data/expansion";
export function useRiftCity() {
  const [gameState, setGameState] = useState<SaveData>(() =>
    loadSave()
  );

  const [currentScreen, setCurrentScreen] =
    useState<Screen>("character");

  const lastRestrictionRef = useRef<{ jail: number | null; hospital: number | null }>({
    jail: null,
    hospital: null,
  });

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
    (property?.maxHealthBonus ?? 0) + (gameState.propertyUpgrades["medical-room"] ?? 0) * 5
  );

  const maxEnergy = MAX_ENERGY + (gameState.meritUpgrades["energy-cap"] ?? 0) * 5;

  const level = getLevel(gameState.xp).level;

  const maxNerve =
    10 +
    Math.min(
      50,
      Math.floor(gameState.crimeExperience / 100) * 5
    ) +
    (property?.nerveBonus ?? 0) +
    (gameState.meritUpgrades["nerve-cap"] ?? 0);

  const gym =
    (gameState.jailUntil ? GYMS.find((g) => g.jailOnly) : GYMS.find((g) => !g.jailOnly)) ??
    GYMS[0];

  const trainingProgram = getTrainingProgram(gameState.activeTrainingProgram);

  const job = getJob(gameState.currentJob);

  const jobPosition = job
    ? getJobPosition(job, gameState.jobSkills)
    : undefined;

  const jobBonuses = getJobStatBonuses(job, gameState.jobSkills);
  const combatStats: CombatStats = {
    strength: gameState.stats.strength + (jobBonuses.strength ?? 0),
    defense: gameState.stats.defense + (jobBonuses.defense ?? 0),
    speed: gameState.stats.speed + (jobBonuses.speed ?? 0),
    dexterity: gameState.stats.dexterity + (jobBonuses.dexterity ?? 0),
  };

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
      const maxHappiness = (property?.maxHappiness ?? 100) + (gameState.propertyUpgrades["bedroom"] ?? 0) * 10;

      setGameState((prev) =>
        tickGameState(prev, now, {
          maxHealth,
          maxNerve,
          maxHappiness,
          maxEnergy,
        })
      );
    }, 1000);

    return () => window.clearInterval(id);
  }, [maxNerve, maxHealth, maxEnergy, property?.maxHappiness, gameState.propertyUpgrades]);

  useEffect(() => {
    const jailStarted = Boolean(
      gameState.jailUntil &&
      gameState.jailUntil > Date.now() &&
      gameState.jailUntil !== lastRestrictionRef.current.jail
    );

    const hospitalStarted = Boolean(
      gameState.hospitalUntil &&
      gameState.hospitalUntil > Date.now() &&
      gameState.hospitalUntil !== lastRestrictionRef.current.hospital
    );

    if (jailStarted) {
      setCurrentScreen("jail");
    } else if (hospitalStarted) {
      setCurrentScreen("hospital");
    }

    lastRestrictionRef.current = {
      jail: gameState.jailUntil,
      hospital: gameState.hospitalUntil,
    };
  }, [gameState.jailUntil, gameState.hospitalUntil]);

  const blocked = () =>
    Boolean(
      gameState.jailUntil ||
        gameState.hospitalUntil
    );

  /*
   * CRIME SYSTEM
   */
  const commitCrime = (crime: Crime, choiceId = "balanced") => {
    if (blocked()) {
      log("You cannot commit crimes right now.", "failure");
      return;
    }

    if (!crimeUnlocked(crime, gameState.crimeExperience)) {
      log("That crime is locked until your crime experience is high enough.", "failure");
      return;
    }

    if (gameState.nerve < crime.nerve) {
      log("Not enough nerve.", "failure");
      return;
    }

    if (crime.requiredIntel && !gameState.crimeIntel.includes(crime.requiredIntel)) {
      log("You are missing the intel needed to attempt this crime chain step.", "failure");
      return;
    }

    const selectedChoice = crime.choices.find((choice) => choice.id === choiceId) ?? crime.choices[1] ?? crime.choices[0];

    setGameState((prev) => {
      const masteryXp = prev.crimeMastery[crime.id] ?? 0;
      const chance = Math.max(0, Math.min(100,
        crimeSuccessChance(
          crime,
          prev.crimeExperience,
          1,
          getCrimeStatBonus((() => {
            const j=getJob(prev.currentJob);
            const b=getJobStatBonuses(j, prev.jobSkills);
            return { strength: prev.stats.strength+(b.strength??0), defense: prev.stats.defense+(b.defense??0), speed: prev.stats.speed+(b.speed??0), dexterity: prev.stats.dexterity+(b.dexterity??0) };
          })()) + (prev.meritUpgrades["crime-edge"] ?? 0) * 2 + ((prev.npcReputation.mara ?? 0) >= 25 ? 2 : 0) + (prev.currentLocation === "crime" ? 2 : 0) - Math.floor(prev.heat / 25),
          masteryXp,
          selectedChoice,
        )
      ));

      const roll = Math.random() * 100;
      const criticalSuccessChance = chance * 0.08;
      let outcome: "critical" | "success" | "jailed" | "critical-fail" | "spooked";

      if (roll < criticalSuccessChance) outcome = "critical";
      else if (roll < chance) outcome = "success";
      else if (roll >= 99.5) outcome = "critical-fail";
      else if (roll < chance + crime.risk * 0.55) outcome = "jailed";
      else outcome = "spooked";

      const masteryGain = Math.max(1, Math.round(crime.crimeExperience * selectedChoice.masteryMultiplier));
      let next: SaveData = {
        ...prev,
        nerve: Math.max(0, prev.nerve - crime.nerve),
        crimeMastery: { ...prev.crimeMastery, [crime.id]: masteryXp + masteryGain },
      };

      const maybeDropLoot = (state: SaveData, critical: boolean) => {
        const candidates = ITEMS.filter((item) => item.dropChance && item.dropChance > 0);
        const multiplier = critical ? 2.5 : 1;
        for (const item of candidates) {
          if (Math.random() < Math.min(.35, (item.dropChance ?? 0) * multiplier)) {
            state = { ...state, inventory: { ...state.inventory, [item.id]: (state.inventory[item.id] || 0) + 1 } };
            return { state, loot: item.name };
          }
        }
        return { state, loot: null as string | null };
      };

      if (outcome === "critical" || outcome === "success") {
        const critical = outcome === "critical";
        const reward = Math.floor(randomReward(crime) * selectedChoice.rewardMultiplier * (critical ? 1.75 : 1));
        next = {
          ...next,
          cash: prev.cash + reward,
          xp: prev.xp + crime.xp * (critical ? 2 : 1),
          crimeExperience: prev.crimeExperience + crime.crimeExperience * (critical ? 2 : 1),
          crimesCompleted: prev.crimesCompleted + 1,
          crimesCritical: prev.crimesCritical + (critical ? 1 : 0),
          crimeIntel: crime.grantsIntel && !prev.crimeIntel.includes(crime.grantsIntel) ? [...prev.crimeIntel, crime.grantsIntel] : prev.crimeIntel,
          heat: Math.min(100, Math.max(0, prev.heat + Math.ceil(crime.risk / (critical ? 8 : 10)) + selectedChoice.heatModifier + (prev.activeWorldEvent === "guard-crackdown" ? 2 : 0) - (prev.activeWorldEvent === "quiet-night" ? 2 : 0) - (prev.propertyUpgrades.security ?? 0) * 2)),
        };
        const dropped = maybeDropLoot(next, critical);
        next = dropped.state;
        return appendActivity(next, `${critical ? "CRITICAL SUCCESS" : "SUCCESS"}: ${crime.name} · ${selectedChoice.label} paid ${money(reward)}${dropped.loot ? ` and dropped ${dropped.loot}` : ""}.`, critical ? "critical" : "success");
      }

      if (outcome === "jailed") {
        next = {
          ...next,
          crimesFailed: prev.crimesFailed + 1,
          timesJailed: prev.timesJailed + 1,
          jailUntil: Date.now() + JAIL_MINUTES * 60000,
          jailStartedAt: Date.now(),
          jailReason: crime.name,
          jailSentenceMs: JAIL_MINUTES * 60000,
          currentLocation: "jail",
          locationsVisited: prev.locationsVisited.includes("jail") ? prev.locationsVisited : [...prev.locationsVisited, "jail"],
          heat: Math.max(0, prev.heat - 15),
        };
        return appendActivity(next, `FAILED: ${crime.name} · ${selectedChoice.label}. You were jailed.`, "jailed");
      }

      if (outcome === "critical-fail") {
        next = { ...next, crimesFailed: prev.crimesFailed + 1, health: Math.max(1, prev.health - 12) };
        return appendActivity(next, `CRITICAL FAIL: ${crime.name}. You escaped, barely.`, "critical");
      }

      next = { ...next, crimesSpooked: prev.crimesSpooked + 1 };
      return appendActivity(next, `SPOOKED: ${crime.name} · ${selectedChoice.label} failed without further consequences.`, "spooked");
    });
  };

  /*
   * GYM
   */
  const train = (stat: TrainingStat) => {
    if (blocked()) {
      log("You cannot train right now.", "failure");
      return;
    }

    const activeProgram = getTrainingProgram(gameState.activeTrainingProgram);
    if (!programUnlocked(activeProgram, gameState.gymExperience)) {
      log("That training program is still locked.", "failure");
      return;
    }

    const cost = trainingEnergyCost(gym, activeProgram);
    if (gameState.energy < cost) {
      log(`You need ${cost} energy.`, "failure");
      return;
    }

    setGameState((prev) => {
      const currentGym = (prev.jailUntil ? GYMS.find((x) => x.jailOnly) : GYMS.find((x) => !x.jailOnly)) ?? GYMS[0];
      const program = getTrainingProgram(prev.activeTrainingProgram);
      const currentCost = trainingEnergyCost(currentGym, program);
      const educationMultiplier = prev.educationCompleted.some((id) => id === "fitness-basics" || id === "advanced-fitness") ? 1.05 : 1;
      const eventMultiplier = prev.activeWorldEvent === "gym-rush" ? 1.1 : 1;
      const meritMultiplier = 1 + (prev.meritUpgrades["gym-focus"] ?? 0) * 0.03;
      const homeGymMultiplier = 1 + (prev.propertyUpgrades["home-gym"] ?? 0) * 0.02;
      const contactMultiplier = (prev.npcReputation.dax ?? 0) >= 25 ? 1.05 : 1;
      const locationMultiplier = prev.currentLocation === "gym" ? 1.03 : 1;
      const now = Date.now();
      const continuedStreak = prev.lastTrainingAt && now - prev.lastTrainingAt <= 36 * 60 * 60 * 1000;
      const streak = continuedStreak ? Math.min(10, prev.trainingStreak + 1) : 1;
      const result = applyTraining(prev.stats, currentGym, stat, prev.happiness, educationMultiplier * eventMultiplier * meritMultiplier * homeGymMultiplier * contactMultiplier * locationMultiplier, program, streak);

      const next: SaveData = {
        ...prev,
        energy: prev.energy - currentCost,
        stats: result.stats,
        gymExperience: prev.gymExperience + getGymExperienceGain(currentCost),
        gymSessions: prev.gymSessions + 1,
        trainingStreak: streak,
        lastTrainingAt: now,
        happiness: Math.max(0, prev.happiness - currentCost * 0.4),
      };
      return appendActivity(next, `${program.name}: ${stat.toUpperCase()} +${result.gain.toFixed(2)} · streak ${streak}.`, "gym");
    });
  };

  const selectTrainingProgram = (id: string) =>
    setGameState((prev) => {
      const program = TRAINING_PROGRAMS.find((x) => x.id === id);
      if (!program || !programUnlocked(program, prev.gymExperience)) return appendActivity(prev, "That training program is locked.", "failure");
      return appendActivity({ ...prev, activeTrainingProgram: id }, `Training program changed to ${program.name}.`, "gym");
    });

  /* Kept as a compatibility alias for older UI code. */
  const buyGym = (_id: string) => undefined;

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
          maxEnergy,
          prev.energy +
            (item.effect || 0)
        );
      }

      if (item.type === "nerve") {
        next.nerve = Math.min(maxNerve, prev.nerve + (item.effect || 0));
      }

      if (item.id === "sugar-rush") {
        next.energy = Math.min(maxEnergy, prev.energy + 6);
        next.happiness = prev.happiness + 3;
      } else if (item.id === "moon-chews") {
        next.happiness = prev.happiness + 12;
        if (Math.random() < .25) next.nerve = Math.min(maxNerve, prev.nerve + 1);
      } else if (item.id === "neon-dust") {
        next.energy = Math.min(maxEnergy, prev.energy + 18);
        next.nerve = Math.min(maxNerve, prev.nerve + 2);
        next.heat = Math.min(100, prev.heat + 8);
      } else if (item.id === "rift-tabs") {
        const roll = Math.random();
        if (roll < .34) next.xp = prev.xp + 60;
        else if (roll < .67) next.nerve = Math.min(maxNerve, prev.nerve + 5);
        else next.happiness = prev.happiness + 25;
        next.heat = Math.min(100, prev.heat + 5);
      } else if (item.id === "ghost-serum") {
        const roll = Math.random();
        if (roll < .45) { next.xp = prev.xp + 250; next.energy = Math.min(maxEnergy, prev.energy + 30); }
        else if (roll < .8) { next.cash = prev.cash + 3500; next.nerve = Math.min(maxNerve, prev.nerve + 6); }
        else { next.health = Math.max(1, prev.health - 25); next.happiness = Math.max(0, prev.happiness - 20); }
        next.heat = Math.min(100, prev.heat + 15);
      } else if (item.id === "black-envelope") {
        const payout = Math.floor(Math.random() * 1401);
        next.cash = prev.cash + payout;
        if (Math.random() < .18 && !prev.crimeIntel.includes("vault-intel")) next.crimeIntel = [...prev.crimeIntel, "vault-intel"];
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

  const createAuctionListing = (itemId: string, price: number, quantity = 1) =>
    setGameState((prev) => {
      const item = getItem(itemId);
      const qty = Math.max(1, Math.floor(quantity));
      const unitPrice = Math.max(1, Math.floor(price));
      const owned = prev.inventory[itemId] || 0;
      if (!item || owned < qty) return appendActivity(prev, "You do not own enough of that item.", "failure");
      const fee = listingFee(unitPrice, qty);
      if (prev.cash < fee) return appendActivity(prev, `You need ${money(fee)} for the listing fee.`, "failure");
      const listing: AuctionListing = { id:`listing-${Date.now()}-${Math.random()}`, itemId, seller:"You", price:unitPrice, quantity:qty, createdAt:Date.now() };
      const next: SaveData = {
        ...prev,
        cash: prev.cash - fee,
        inventory: { ...prev.inventory, [itemId]: owned - qty },
        auctionListings: [listing, ...prev.auctionListings],
      };
      return appendActivity(next, `Listed ${qty}× ${item.name} for ${money(unitPrice)} each. Fee ${money(fee)}.`, "success");
    });

  const cancelAuctionListing = (listingId: string) =>
    setGameState((prev) => {
      const listing = prev.auctionListings.find((x) => x.id === listingId && x.seller === "You");
      if (!listing) return prev;
      const next: SaveData = {
        ...prev,
        inventory: { ...prev.inventory, [listing.itemId]: (prev.inventory[listing.itemId] || 0) + listing.quantity },
        auctionListings: prev.auctionListings.filter((x) => x.id !== listingId),
      };
      return appendActivity(next, "Auction listing cancelled and items returned.", "system");
    });

  const buyAuctionListing = (listingId: string) =>
    setGameState((prev) => {
      const all = [...prev.auctionListings, ...SEEDED_LISTINGS.filter((x) => !prev.auctionRemovedListingIds.includes(x.id))];
      const listing = all.find((x) => x.id === listingId);
      if (!listing || listing.seller === "You") return prev;
      const total = listing.price * listing.quantity;
      if (prev.cash < total) return appendActivity(prev, "Not enough cash for that listing.", "failure");
      const nextListings = prev.auctionListings.filter((x) => x.id !== listingId);
      const next: SaveData = {
        ...prev,
        cash: prev.cash - total,
        inventory: { ...prev.inventory, [listing.itemId]: (prev.inventory[listing.itemId] || 0) + listing.quantity },
        auctionListings: nextListings,
        auctionRemovedListingIds: listing.id.startsWith("seed-") ? [...prev.auctionRemovedListingIds, listing.id] : prev.auctionRemovedListingIds,
      };
      return appendActivity(next, `Bought ${listing.quantity}× ${getItem(listing.itemId)?.name ?? listing.itemId} from ${listing.seller} for ${money(total)}.`, "success");
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
            maxEnergy,
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

  const visitLocation = (id: string) =>
    setGameState((prev) => ({
      ...prev,
      currentLocation: id,
      locationsVisited: prev.locationsVisited.includes(id)
        ? prev.locationsVisited
        : [...prev.locationsVisited, id],
    }));

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
      case "travel": return gameState.locationsVisited.length;
      case "faction": return gameState.factionReputation;
      case "job": return gameState.jobActions;
      case "heat": return gameState.heat;

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

      if (mission.prerequisite && !prev.completedMissions.includes(mission.prerequisite)) {
        return appendActivity(prev, "Complete the previous mission in this chain first.", "failure");
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
        case "travel": progress = prev.locationsVisited.length; break;
        case "faction": progress = prev.factionReputation; break;
        case "job": progress = prev.jobActions; break;
        case "heat": progress = prev.heat; break;

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
        merits: prev.merits + (mission.rewardMerits ?? 0),
        points: prev.points + (mission.rewardPoints ?? 0),

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

      if (prev.factionLeftAt && Date.now() - prev.factionLeftAt < 15 * 60 * 1000) {
        return appendActivity(prev, "Faction rejoin cooldown is still active.", "failure");
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


  const runFactionMission = () =>
    setGameState((prev) => {
      if (!prev.faction) return appendActivity(prev, "Join a faction first.", "failure");
      if (prev.energy < 15) return appendActivity(prev, "You need 15 energy for a faction mission.", "failure");

      const gain = 18 + Math.floor(Math.random() * 13);
      let next: SaveData = {
        ...prev,
        energy: prev.energy - 15,
        factionReputation: prev.factionReputation + gain,
        points: prev.points + 5,
      };

      if (prev.faction === "Iron Syndicate") {
        const payout = 700 + Math.floor(Math.random() * 501);
        next.cash += payout;
        next.heat = Math.min(100, next.heat + 8);
        return appendActivity(next, `Syndicate contract completed: ${money(payout)}, +${gain} reputation, +8 Heat.`, "success");
      }

      if (prev.faction === "Rift Guard") {
        next.cash += 550;
        next.heat = Math.max(0, next.heat - 12);
        return appendActivity(next, `Guard patrol completed: ${money(550)}, +${gain} reputation, -12 Heat.`, "success");
      }

      const commodities = Object.keys(DEFAULT_MARKET_PRICES);
      const item = commodities[Math.floor(Math.random() * commodities.length)];
      next.inventory = { ...prev.inventory, [item]: (prev.inventory[item] || 0) + 2 };
      next.cash += 450;
      return appendActivity(next, `Union cargo run completed: ${money(450)}, 2 ${item}, +${gain} reputation.`, "success");
    });

  /*
   * MARKET
   */
  const tradeMarket = (
    id: string,
    buy: boolean,
    quantity = 1
  ) =>
    setGameState((prev) => {
      const qty = Math.max(1, Math.floor(quantity));
      const basePrice = DEFAULT_MARKET_PRICES[id] ?? 100;
      const price = prev.market[id] ?? basePrice;
      const owned = prev.inventory[id] || 0;

      if (buy) {
        const total = price * qty;
        if (prev.cash < total) return appendActivity(prev, "Not enough cash.", "failure");
        const next: SaveData = {
          ...prev,
          cash: prev.cash - total,
          inventory: { ...prev.inventory, [id]: owned + qty },
          points: prev.points + (prev.activeWorldEvent === "dock-strike" ? qty : 0),
        };
        return appendActivity(next, `Bought ${qty} ${id} for ${money(total)}.`, "success");
      }

      if (owned < qty) return appendActivity(prev, `You only own ${owned} ${id}.`, "failure");
      const brokerSpread = prev.npcReputation.lena >= 25 ? 0.98 : 0.95;
      const sellPrice = Math.max(1, Math.floor(price * brokerSpread));
      const total = sellPrice * qty;
      const next: SaveData = {
        ...prev,
        cash: prev.cash + total,
        inventory: { ...prev.inventory, [id]: owned - qty },
        points: prev.points + (prev.activeWorldEvent === "dock-strike" ? qty : 0),
      };
      return appendActivity(next, `Sold ${qty} ${id} for ${money(total)}.`, "success");
    });


  /*
   * PROGRESSION EXPANSION
   */
  const quitJob = () => setGameState((prev) => {
    if (!prev.currentJob) return prev;
    const old = getJob(prev.currentJob);
    const next = { ...prev, currentJob: null };
    return appendActivity(next, `Left ${old?.company ?? "your job"}.`, "job");
  });

  const workShift = () => setGameState((prev) => {
    if (!prev.currentJob) return appendActivity(prev, "Get a job before working a shift.", "failure");
    if (prev.energy < 8) return appendActivity(prev, "You need 8 energy for a work shift.", "failure");
    const activeJob = getJob(prev.currentJob);
    if (!activeJob) return prev;
    const position = getJobPosition(activeJob, prev.jobSkills);
    const eventBoost = prev.activeWorldEvent === "hiring-boom" ? 1.25 : 1;
    const contactBoost = prev.npcReputation.brick >= 25 ? 1.1 : 1;
    const locationBoost = prev.currentLocation === "jobs" ? 1.1 : 1;
    const workplaceRoll = Math.random();
    const workplaceBonus = workplaceRoll < 0.12 ? 1.5 : workplaceRoll > 0.94 ? 0.75 : 1;
    const payout = Math.floor(position.salary * 0.35 * eventBoost * contactBoost * locationBoost * workplaceBonus);
    const skillBoost = 0.35 * (1 + (prev.meritUpgrades["job-drive"] ?? 0) * 0.1) * (workplaceRoll < 0.12 ? 1.25 : 1);
    const skills = { ...prev.jobSkills };
    for (const skill of activeJob.skills) {
      const key = `${activeJob.id}:${skill.id}`;
      skills[key] = Math.min(10, Number(((skills[key] ?? 0) + skillBoost).toFixed(2)));
    }
    const next: SaveData = { ...prev, cash: prev.cash + payout, energy: prev.energy - 8, jobSkills: skills, jobActions: prev.jobActions + 1 };
    const eventText = workplaceRoll < 0.12 ? " A surprise rush earned you a bonus." : workplaceRoll > 0.94 ? " A rough shift cut the payout." : "";
    return appendActivity(next, `Worked a shift for ${money(payout)}.${eventText}`, "job");
  });

  const buyPropertyUpgrade = (id: string) => setGameState((prev) => {
    const upgrade = PROPERTY_UPGRADES.find((x) => x.id === id);
    if (!upgrade) return prev;
    const rank = prev.propertyUpgrades[id] ?? 0;
    if (rank >= upgrade.maxRank) return prev;
    const cost = upgrade.basePrice * (rank + 1);
    if (prev.cash < cost) return appendActivity(prev, "Not enough cash for that property upgrade.", "failure");
    const next = { ...prev, cash: prev.cash - cost, propertyUpgrades: { ...prev.propertyUpgrades, [id]: rank + 1 } };
    return appendActivity(next, `${upgrade.name} upgraded to rank ${rank + 1}.`, "success");
  });

  const leaveFaction = () => setGameState((prev) => {
    if (!prev.faction) return prev;
    const name = prev.faction;
    const next = { ...prev, faction: null, factionReputation: Math.floor(prev.factionReputation * 0.75), factionLeftAt: Date.now() };
    return appendActivity(next, `Left ${name}. Some reputation was lost.`, "system");
  });

  const buyFactionReward = (rewardId: string) => setGameState((prev) => {
    const faction = getFaction(prev.faction);
    if (!faction) return prev;
    const reward = faction.rewards.find((x) => x.id === rewardId);
    if (!reward || prev.factionRewardsClaimed.includes(rewardId)) return prev;
    if (prev.factionReputation < reward.reputation || prev.points < reward.points) return appendActivity(prev, "You do not meet that faction reward requirement.", "failure");
    const inventory = { ...prev.inventory };
    if (reward.itemId) inventory[reward.itemId] = (inventory[reward.itemId] || 0) + 1;
    let heat = prev.heat;
    if (reward.id === "guard-clearance") heat = Math.max(0, heat - 30);
    const next: SaveData = { ...prev, points: prev.points - reward.points, cash: prev.cash + (reward.cash ?? 0), inventory, heat, factionRewardsClaimed: [...prev.factionRewardsClaimed, rewardId] };
    return appendActivity(next, `Faction reward claimed: ${reward.name}.`, "critical");
  });

  const buyMeritUpgrade = (id: string) => setGameState((prev) => {
    const upgrade = MERIT_UPGRADES.find((x) => x.id === id);
    if (!upgrade) return prev;
    const rank = prev.meritUpgrades[id] ?? 0;
    if (rank >= upgrade.maxRank) return prev;
    const cost = upgrade.baseCost + rank;
    if (prev.merits < cost) return appendActivity(prev, `You need ${cost} merits.`, "failure");
    const next = { ...prev, merits: prev.merits - cost, meritUpgrades: { ...prev.meritUpgrades, [id]: rank + 1 } };
    return appendActivity(next, `${upgrade.name} upgraded to rank ${rank + 1}.`, "critical");
  });

  const challengePeriod = (id: string) => {
    const d = new Date();
    if (id.startsWith("daily")) return d.toISOString().slice(0, 10);
    const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - first.getTime()) / 86400000) + first.getUTCDay() + 1) / 7);
    return `${d.getUTCFullYear()}-W${week}`;
  };
  const challengeClaimKey = (id: string) => `${id}:${challengePeriod(id)}`;

  const getChallengeProgress = (challenge: (typeof DAILY_CHALLENGES)[number] | (typeof WEEKLY_CHALLENGES)[number]) => {
    const raw = challengeProgress(challenge.metric, gameState);
    const baseline = gameState.challengeBaselines[challenge.id] ?? 0;
    return Math.max(0, raw - baseline);
  };

  const isChallengeClaimed = (id: string) => gameState.challengesClaimed.includes(challengeClaimKey(id));

  const claimChallenge = (id: string) => setGameState((prev) => {
    const challenge = [...DAILY_CHALLENGES, ...WEEKLY_CHALLENGES].find((x) => x.id === id);
    const claimKey = challengeClaimKey(id);
    if (!challenge || prev.challengesClaimed.includes(claimKey)) return prev;
    const raw = challengeProgress(challenge.metric, prev);
    const baseline = prev.challengeBaselines[id] ?? 0;
    if (raw - baseline < challenge.target) return appendActivity(prev, "Challenge is still in progress.", "failure");
    const next: SaveData = {
      ...prev,
      cash: prev.cash + challenge.rewardCash,
      points: prev.points + challenge.rewardPoints,
      merits: prev.merits + (challenge.rewardMerits ?? 0),
      challengesClaimed: [...prev.challengesClaimed.slice(-60), claimKey],
      challengeBaselines: { ...prev.challengeBaselines, [id]: raw },
    };
    return appendActivity(next, `Challenge complete: ${challenge.name}.`, "critical");
  });

  const npcInteract = (npcId: string, positive = true) => setGameState((prev) => {
    if (prev.energy < 3) return appendActivity(prev, "You need 3 energy to spend time building contacts.", "failure");
    const current = prev.npcReputation[npcId] ?? 0;
    const change = positive ? 5 : -5;
    const next = { ...prev, energy: prev.energy - 3, npcReputation: { ...prev.npcReputation, [npcId]: Math.max(-100, Math.min(100, current + change)) } };
    return appendActivity(next, positive ? "Contact relationship improved." : "You pushed that contact away.", "system");
  });

  const refreshWorldEvent = () => setGameState((prev) => {
    const now = Date.now();
    if (prev.activeWorldEvent && prev.worldEventUntil && prev.worldEventUntil > now) return appendActivity(prev, "A world event is already active.", "failure");
    if (now - prev.lastWorldEventRefresh < 10 * 60 * 1000) return appendActivity(prev, "World event scanner is on cooldown.", "failure");
    const event = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
    const next = { ...prev, activeWorldEvent: event.id, worldEventUntil: now + event.durationMinutes * 60000, lastWorldEventRefresh: now };
    return appendActivity(next, `WORLD EVENT: ${event.name} — ${event.description}`, "critical");
  });

  const coolHeat = () => setGameState((prev) => {
    if (prev.heat <= 0) return prev;
    if (prev.energy < 5) return appendActivity(prev, "You need 5 energy to lay low.", "failure");
    const reduction = 10 + (prev.npcReputation.torres >= 25 ? 5 : 0) + (prev.currentLocation === "police" ? 5 : 0);
    const next = { ...prev, energy: prev.energy - 5, heat: Math.max(0, prev.heat - reduction) };
    return appendActivity(next, `You laid low and reduced your Heat by ${reduction}.`, "system");
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
    maxEnergy,

    gym,
    job,
    jobPosition,
    combatStats,
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
    trainingProgram,
    selectTrainingProgram,

    attack,
    beginCombat,
    resolveAttack,
    finishCombat,

    buyItem,
    useItem,
    equip,
    createAuctionListing,
    cancelAuctionListing,
    buyAuctionListing,
    seededAuctionListings: SEEDED_LISTINGS,

    randomEncounter,
    chooseEncounter,

    travel,
    visitLocation,
    joinJob,
    quitJob,
    workShift,

    buyProperty,
    buyPropertyUpgrade,

    bankDeposit,
    bankWithdraw,

    startEducation,
    finishEducation,

    missionProgress,
    claimMission,

    claimDaily,

    joinFaction,
    workFaction,
    runFactionMission,
    leaveFaction,
    buyFactionReward,

    tradeMarket,

    buyMeritUpgrade,
    getChallengeProgress,
    isChallengeClaimed,
    claimChallenge,
    npcInteract,
    refreshWorldEvent,
    coolHeat,

    earnMerit,

    travelLocked,

    log,
    appendActivity,

    resetGame,
  };
}
