import { useCallback, useEffect, useRef, useState } from "react";
import { tickGameState } from "../systems/gameTickSystem";
import { getJobPosition, getJobStatBonuses } from "../data/jobs";
import {
  Crime, CrimeRunModifiers, crimeSuccessChance, crimeUnlocked, getCrimeStatBonus, randomReward,
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
import { pathToScreen, screenToPath } from "../routing/routes";
import { PLAYER_PROFILES } from "../data/playerProfiles";
import { ALL_NPC_LISTINGS, betaNpcAutoBuyCeiling, betaNpcQuickSellPrice, listingFee } from "../systems/auctionSystem";
import { getCrimeTool } from "../systems/crimeTools";
import {
  CRIME_OPERATIONS, GRAFFITI_SPOTS, CrimeTarget, crimeFamilyForLegacyCrime, crimeFamilyLevel,
  targetSuccessChance, graffitiSuccessChance, randomCrimeReward,
} from "../systems/crimeActivities";
import { PRODUCTION_FACILITIES, PRODUCTION_RECIPES, PRODUCTION_SUPPLIES, canFacilityRun } from "../systems/contrabandSystem";
import { CRIME_CAREERS, SCAVENGE_LOCATIONS, SHOPLIFT_STORES, careerActionSuccessChance, crimeCareerIdForOperation, crimeCareerMasteryLevel, getShopliftingConditions, scavengingOpportunity, scavengingOutcomeRates, shopliftingSuspicion } from "../systems/crimeCareerSystem";
import { OFFSHORE_TIERS, getOffshoreTier } from "../data/wealthRisk";
import { DAILY_CHALLENGES, WEEKLY_CHALLENGES, MERIT_UPGRADES, PROPERTY_UPGRADES, WORLD_EVENTS, getFaction, getFactionRank, challengeProgress } from "../data/expansion";
export function useRiftCity() {
  const [gameState, setGameState] = useState<SaveData>(() =>
    loadSave()
  );

  const [currentScreen, setCurrentScreenState] =
    useState<Screen>(() => pathToScreen(window.location.pathname));

  const setCurrentScreen = useCallback((screen: Screen) => {
    setCurrentScreenState(screen);

    const nextPath = screenToPath(screen);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ screen }, "", nextPath);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentScreenState(pathToScreen(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const normalizedScreen = pathToScreen(window.location.pathname);
    const canonicalPath = screenToPath(normalizedScreen);
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({ screen: normalizedScreen }, "", canonicalPath);
    }
  }, []);

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

  const maxHappiness =
    (property?.maxHappiness ?? 100) +
    (gameState.propertyUpgrades["bedroom"] ?? 0) * 10;

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
  }, [maxNerve, maxHealth, maxHappiness, maxEnergy]);

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
  const commitCrime = (crime: Crime, choiceId = "balanced", run?: CrimeRunModifiers, crimeToolId?: string | null) => {
    if (blocked()) { log("You cannot commit crimes right now.", "failure"); return; }
    if (!crimeUnlocked(crime, gameState.crimeExperience)) { log("That crime is locked until your crime experience is high enough.", "failure"); return; }
    if (gameState.nerve < crime.nerve) { log("Not enough nerve.", "failure"); return; }
    if (crime.requiredIntel && !gameState.crimeIntel.includes(crime.requiredIntel)) { log("You are missing the intel needed to attempt this crime chain step.", "failure"); return; }

    const selectedChoice = crime.choices.find((choice) => choice.id === choiceId) ?? crime.choices[1] ?? crime.choices[0];
    const baseRun: CrimeRunModifiers = run ?? { chanceModifier:0,rewardMultiplier:1,heatModifier:0,arrestModifier:0,injuryChance:0,bountyChance:0,bountyMultiplier:1,lootMultiplier:1,masteryMultiplier:1,extraXpMultiplier:1,riskLabel:"BASE",story:[] };
    const selectedTool = getCrimeTool(crimeToolId);
    const toolUsable = Boolean(selectedTool && (gameState.inventory[selectedTool.id] || 0) > 0);
    const tm = toolUsable ? selectedTool!.modifiers : {};
    const runMod: CrimeRunModifiers = {
      ...baseRun,
      chanceModifier: baseRun.chanceModifier + (tm.chanceModifier ?? 0),
      rewardMultiplier: baseRun.rewardMultiplier * (tm.rewardMultiplier ?? 1),
      heatModifier: baseRun.heatModifier + (tm.heatModifier ?? 0),
      arrestModifier: baseRun.arrestModifier + (tm.arrestModifier ?? 0),
      injuryChance: baseRun.injuryChance + (tm.injuryChance ?? 0),
      bountyChance: baseRun.bountyChance + (tm.bountyChance ?? 0),
      bountyMultiplier: baseRun.bountyMultiplier * (tm.bountyMultiplier ?? 1),
      lootMultiplier: baseRun.lootMultiplier * (tm.lootMultiplier ?? 1),
      masteryMultiplier: baseRun.masteryMultiplier * (tm.masteryMultiplier ?? 1),
      extraXpMultiplier: baseRun.extraXpMultiplier * (tm.extraXpMultiplier ?? 1),
      story: toolUsable ? [...baseRun.story, `${selectedTool!.name} used for this attempt.`] : baseRun.story,
    };
    const crimeFamily = crimeFamilyForLegacyCrime(crime.id);

    setGameState((prev) => {
      const masteryXp = prev.crimeMastery[crime.id] ?? 0;
      const chance = Math.max(2, Math.min(97,
        crimeSuccessChance(
          crime, prev.crimeExperience, 1,
          getCrimeStatBonus((() => {
            const j=getJob(prev.currentJob); const b=getJobStatBonuses(j, prev.jobSkills);
            return { strength: prev.stats.strength+(b.strength??0), defense: prev.stats.defense+(b.defense??0), speed: prev.stats.speed+(b.speed??0), dexterity: prev.stats.dexterity+(b.dexterity??0) };
          })()) + (prev.meritUpgrades["crime-edge"] ?? 0) * 2 + ((prev.npcReputation.mara ?? 0) >= 25 ? 2 : 0) + (prev.currentLocation === "crime" ? 2 : 0) - Math.floor(prev.heat / 25) + crimeFamilyLevel(prev.crimeSkillXp[crimeFamily] ?? 0) * 0.65 + Math.min(5, Math.floor(prev.streetReputation / 25)),
          masteryXp, selectedChoice,
        ) + runMod.chanceModifier
      ));

      const roll = Math.random() * 100;
      const criticalSuccessChance = Math.max(1, chance * 0.08);
      const jailWindow = Math.max(2, crime.risk * .55 + runMod.arrestModifier);
      let outcome: "critical" | "success" | "jailed" | "critical-fail" | "spooked";
      if (roll < criticalSuccessChance) outcome = "critical";
      else if (roll < chance) outcome = "success";
      else if (roll >= 99.5) outcome = "critical-fail";
      else if (roll < chance + jailWindow) outcome = "jailed";
      else outcome = "spooked";

      const masteryGain = Math.max(1, Math.round(crime.crimeExperience * selectedChoice.masteryMultiplier * runMod.masteryMultiplier));
      const familySkillGain = Math.max(1, Math.round(crime.crimeExperience * 0.7 * runMod.masteryMultiplier));
      let nextInventory = prev.inventory;
      if (toolUsable && selectedTool) nextInventory = { ...prev.inventory, [selectedTool.id]: Math.max(0, (prev.inventory[selectedTool.id] || 0) - 1) };
      let next: SaveData = { ...prev, inventory: nextInventory, nerve: Math.max(0, prev.nerve - crime.nerve), crimeMastery: { ...prev.crimeMastery, [crime.id]: masteryXp + masteryGain }, crimeSkillXp: { ...prev.crimeSkillXp, [crimeFamily]: (prev.crimeSkillXp[crimeFamily] ?? 0) + familySkillGain } };

      const maybeDropLoot = (state: SaveData, critical: boolean) => {
        // Every successful crime can produce ordinary finds. Rare item definitions still control the true jackpot rates.
        const guaranteedPool = ["sugar-rush","moon-chews","black-envelope"];
        const found:string[]=[];
        const lootBoost=Math.max(.35,runMod.lootMultiplier)*(critical?2.25:1);
        if(Math.random()<Math.min(.58,.12*lootBoost)){
          const id=guaranteedPool[Math.floor(Math.random()*guaranteedPool.length)];
          const item=ITEMS.find(x=>x.id===id);
          if(item){ state={...state,inventory:{...state.inventory,[id]:(state.inventory[id]||0)+1}}; found.push(item.name); }
        }
        const candidates = ITEMS.filter((item) => item.dropChance && item.dropChance > 0);
        for (const item of candidates) {
          if (Math.random() < Math.min(.42, (item.dropChance ?? 0) * lootBoost)) {
            state = { ...state, inventory: { ...state.inventory, [item.id]: (state.inventory[item.id] || 0) + 1 } };
            found.push(item.name);
            if(found.length>=2) break;
          }
        }
        return { state, loot: found };
      };

      const storySuffix=runMod.story.length?` Decisions: ${runMod.story.join(" ")}`:"";
      if (outcome === "critical" || outcome === "success") {
        const critical = outcome === "critical";
        const reward = Math.floor(randomReward(crime) * selectedChoice.rewardMultiplier * runMod.rewardMultiplier * (critical ? 1.75 : 1));
        const bountyHit=Math.random()<runMod.bountyChance;
        const bountyGain=bountyHit?Math.max(50,Math.round((crime.risk*18+reward*.08)*runMod.bountyMultiplier)):0;
        const injured=Math.random()<runMod.injuryChance;
        const injuryDamage=injured?Math.max(2,Math.round(3+crime.risk*.22+Math.random()*8)):0;
        next = {
          ...next,
          cash: prev.cash + reward,
          xp: prev.xp + Math.round(crime.xp * runMod.extraXpMultiplier * (critical ? 2 : 1)),
          crimeExperience: prev.crimeExperience + Math.round(crime.crimeExperience * runMod.extraXpMultiplier * (critical ? 2 : 1)),
          crimesCompleted: prev.crimesCompleted + 1,
          crimesCritical: prev.crimesCritical + (critical ? 1 : 0),
          streetReputation: prev.streetReputation + Math.max(1, Math.round(crime.risk / (critical ? 8 : 13))),
          crimeIntel: crime.grantsIntel && !prev.crimeIntel.includes(crime.grantsIntel) ? [...prev.crimeIntel, crime.grantsIntel] : prev.crimeIntel,
          heat: Math.min(100, Math.max(0, prev.heat + Math.ceil(crime.risk / (critical ? 8 : 10)) + selectedChoice.heatModifier + runMod.heatModifier + (prev.activeWorldEvent === "guard-crackdown" ? 2 : 0) - (prev.activeWorldEvent === "quiet-night" ? 2 : 0) - (prev.propertyUpgrades.security ?? 0) * 2)),
          playerBounty: prev.playerBounty+bountyGain,
          health: Math.max(1,prev.health-injuryDamage),
        };
        const dropped = maybeDropLoot(next, critical); next = dropped.state;
        const extras=[dropped.loot.length?`loot: ${dropped.loot.join(", ")}`:"",bountyGain?`bounty +${money(bountyGain)}`:"",injured?`injured -${injuryDamage} HP`:""].filter(Boolean).join(" · ");
        return appendActivity(next, `${critical ? "CRITICAL SUCCESS" : "SUCCESS"}: ${crime.name} · ${selectedChoice.label} paid ${money(reward)}${extras?` · ${extras}`:""}.${storySuffix}`, critical ? "critical" : "success");
      }

      if (outcome === "jailed") {
        const contraband=ITEMS.filter(i=>i.contraband&&(prev.inventory[i.id]||0)>0);
        const charges=[crime.name, ...(contraband.length?["Contraband Possession"]:[])];
        const sentenceMultiplier=1+Math.min(.8,Math.max(0,runMod.arrestModifier)/30);
        const sentence=Math.round(JAIL_MINUTES*60000*sentenceMultiplier);
        const carriedLoss=Math.min(prev.cash,Math.floor(prev.cash*(0.03+Math.random()*0.05)));
        next = { ...next, cash:Math.max(0,prev.cash-carriedLoss), crimesFailed: prev.crimesFailed + 1, timesJailed: prev.timesJailed + 1, jailUntil: Date.now()+sentence, jailStartedAt: Date.now(), jailReason: charges.join(" + "), jailSentenceMs: sentence, activeCharges:charges, currentLocation:"jail", locationsVisited:prev.locationsVisited.includes("jail")?prev.locationsVisited:[...prev.locationsVisited,"jail"], heat:Math.max(0,prev.heat-15) };
        return appendActivity(next, `ARRESTED: ${crime.name}. Charges: ${charges.join(", ")}.${carriedLoss?` Lost ${money(carriedLoss)} carried cash.`:""}${storySuffix}`, "jailed");
      }

      if (outcome === "critical-fail") {
        const damage=Math.max(10,Math.round(12+crime.risk*.2));
        const carriedLoss=Math.min(prev.cash,Math.floor(prev.cash*(0.02+Math.random()*0.04)));
        next = { ...next, cash:Math.max(0,prev.cash-carriedLoss), crimesFailed: prev.crimesFailed + 1, health: Math.max(1, prev.health - damage), heat:Math.min(100,prev.heat+Math.max(2,runMod.heatModifier)) };
        return appendActivity(next, `CRITICAL FAIL: ${crime.name}. You escape hurt (-${damage} HP)${carriedLoss?` and lose ${money(carriedLoss)} carried cash`:""}.${storySuffix}`, "critical");
      }

      const spookInjury=Math.random()<runMod.injuryChance*.35;
      const spookDamage=spookInjury?Math.max(2,Math.round(4+Math.random()*6)):0;
      const carriedLoss=Math.min(prev.cash,Math.floor(prev.cash*(Math.random()*0.015)));
      next = { ...next, cash:Math.max(0,prev.cash-carriedLoss), crimesSpooked: prev.crimesSpooked + 1, health:Math.max(1,prev.health-spookDamage), heat:Math.min(100,Math.max(0,prev.heat+Math.max(0,Math.round(runMod.heatModifier*.35)))) };
      return appendActivity(next, `SPOOKED: ${crime.name} · ${selectedChoice.label}. You got out before the score collapsed${spookDamage?` but lost ${spookDamage} HP`:""}${carriedLoss?` · dropped ${money(carriedLoss)} cash`:""}.${storySuffix}`, "spooked");
    });
  };

  /*
   * TARGET-BASED / PASSIVE CRIME ACTIVITIES
   *
   * These are intentionally game abstractions. They model target selection,
   * timers, skill checks, Heat and consequences without real-world procedures.
   */
  const scoutCrimeTarget = (targetId: string) => {
    if (blocked()) { log("You cannot scout targets right now.", "failure"); return; }
    setGameState((prev) => {
      if (prev.scoutedCrimeTargets.includes(targetId)) return prev;
      if (prev.nerve < 1) return appendActivity(prev, "You need 1 Nerve to scout that target.", "failure");
      const next: SaveData = {
        ...prev,
        nerve: Math.max(0, prev.nerve - 1),
        scoutedCrimeTargets: [...prev.scoutedCrimeTargets.slice(-119), targetId],
      };
      return appendActivity(next, "Target scouted. The risk and payout estimate are clearer now.", "system");
    });
  };

  const resolveCrimeTarget = (target: CrimeTarget, crimeToolId?: string | null, attemptModifiers?: {chanceModifier?:number;rewardMultiplier?:number;heatModifier?:number;arrestModifier?:number;story?:string}) => {
    if (blocked()) { log("You cannot attempt a target right now.", "failure"); return; }
    setGameState((prev) => {
      if (prev.resolvedCrimeTargets.includes(target.id)) return appendActivity(prev, "That target is already gone from the board.", "failure");
      if (prev.nerve < target.nerve) return appendActivity(prev, `You need ${target.nerve} Nerve for that target.`, "failure");

      const scouted = prev.scoutedCrimeTargets.includes(target.id);
      const j = getJob(prev.currentJob);
      const bonuses = getJobStatBonuses(j, prev.jobSkills);
      const dexterity = prev.stats.dexterity + (bonuses.dexterity ?? 0);
      const skillXp = prev.crimeSkillXp[target.family] ?? 0;
      const selectedTool = getCrimeTool(crimeToolId);
      const toolUsable = Boolean(selectedTool && (prev.inventory[selectedTool.id] || 0) > 0);
      const toolModifiers = toolUsable ? selectedTool!.modifiers : {};
      const chance = Math.max(4, Math.min(97, targetSuccessChance(target, skillXp, dexterity, prev.heat, scouted, prev.streetReputation) + (toolModifiers.chanceModifier ?? 0) + (attemptModifiers?.chanceModifier ?? 0)));
      const roll = Math.random() * 100;
      const arrestWindow = Math.max(3, Math.min(28, 5 + target.difficulty * 0.14 + prev.heat * 0.05 + (toolModifiers.arrestModifier ?? 0) + (attemptModifiers?.arrestModifier ?? 0)));
      const skillGain = Math.max(5, Math.round(7 + target.difficulty * 0.32));
      const crimeXpGain = Math.max(4, Math.round(4 + target.difficulty * 0.17));
      const careerId = target.kind === "vehicle" ? "vehicle-theft" : target.kind;
      const masteryGain = Math.max(8, Math.round(8 + target.difficulty * 0.28));
      const resolved = [...prev.resolvedCrimeTargets.slice(-119), target.id];
      let next: SaveData = {
        ...prev,
        nerve: Math.max(0, prev.nerve - target.nerve),
        inventory: toolUsable && selectedTool ? { ...prev.inventory, [selectedTool.id]: Math.max(0, (prev.inventory[selectedTool.id] || 0) - 1) } : prev.inventory,
        resolvedCrimeTargets: resolved,
        crimeMastery: { ...prev.crimeMastery, [careerId]: (prev.crimeMastery[careerId] ?? 0) + masteryGain },
        crimeSkillXp: { ...prev.crimeSkillXp, [target.family]: skillXp + skillGain },
      };

      if (roll < chance) {
        const critical = roll < Math.max(1.5, chance * 0.06);
        const reward = Math.round(randomCrimeReward(target.minReward, target.maxReward) * (toolModifiers.rewardMultiplier ?? 1) * (attemptModifiers?.rewardMultiplier ?? 1) * (critical ? 1.55 : 1));
        const repGain = Math.max(1, Math.round(target.difficulty / (critical ? 12 : 18)));
        let intel = prev.crimeIntel;
        if (target.kind === "pickpocket" && !intel.includes("access-card") && Math.random() < 0.45) intel = [...intel, "access-card"];
        if (target.kind === "burglary" && !intel.includes("vehicle-code") && Math.random() < 0.4) intel = [...intel, "vehicle-code"];
        let specialFind = "";
        if (target.specialLootIds?.length && Math.random() < Math.min(.35, (target.specialLootChance ?? .04) * (critical ? 1.8 : 1))) {
          const lootId = target.specialLootIds[Math.floor(Math.random() * target.specialLootIds.length)];
          const loot = getItem(lootId);
          if (loot) {
            next = { ...next, inventory:{ ...next.inventory, [loot.id]:(next.inventory[loot.id] || 0) + 1 } };
            specialFind = ` · lifted ${loot.name}`;
          }
        }
        next = {
          ...next,
          cash: prev.cash + reward,
          xp: prev.xp + Math.round(8 + target.difficulty * 0.45) * (critical ? 2 : 1),
          crimeExperience: prev.crimeExperience + crimeXpGain * (critical ? 2 : 1),
          crimesCompleted: prev.crimesCompleted + 1,
          crimesCritical: prev.crimesCritical + (critical ? 1 : 0),
          streetReputation: prev.streetReputation + repGain,
          crimeIntel: intel,
          heat: Math.min(100, Math.max(0, prev.heat + target.heat + (critical ? 0 : 1) + (toolModifiers.heatModifier ?? 0) + (attemptModifiers?.heatModifier ?? 0))),
        };
        return appendActivity(next, `${critical ? "CRITICAL TARGET" : "TARGET COMPLETE"}: ${target.name} paid ${money(reward)}${specialFind} · ${target.family} skill +${skillGain} XP · Street Rep +${repGain}${attemptModifiers?.story ? ` · ${attemptModifiers.story}` : ""}${toolUsable && selectedTool ? ` · ${selectedTool.name} consumed` : ""}.`, critical ? "critical" : "success");
      }

      if (roll < chance + arrestWindow) {
        const contraband = ITEMS.filter((item) => item.contraband && (prev.inventory[item.id] || 0) > 0);
        const charges = [`${target.kind.replace(/-/g, " ")} attempt`, ...(contraband.length ? ["Contraband Possession"] : [])];
        const sentence = Math.round(JAIL_MINUTES * 60000 * (1 + target.difficulty / 170));
        const carriedLoss = Math.min(prev.cash, Math.floor(prev.cash * (0.025 + Math.random() * 0.045)));
        next = {
          ...next,
          cash: Math.max(0, prev.cash - carriedLoss),
          crimesFailed: prev.crimesFailed + 1,
          timesJailed: prev.timesJailed + 1,
          jailUntil: Date.now() + sentence,
          jailStartedAt: Date.now(),
          jailReason: charges.join(" + "),
          jailSentenceMs: sentence,
          activeCharges: charges,
          currentLocation: "jail",
          locationsVisited: prev.locationsVisited.includes("jail") ? prev.locationsVisited : [...prev.locationsVisited, "jail"],
          heat: Math.max(0, prev.heat - 12),
        };
        return appendActivity(next, `ARRESTED: ${target.name}.${carriedLoss ? ` Lost ${money(carriedLoss)} carried cash.` : ""}`, "jailed");
      }

      next = {
        ...next,
        crimesSpooked: prev.crimesSpooked + 1,
        heat: Math.min(100, prev.heat + Math.max(1, Math.ceil(target.heat / 2))),
      };
      return appendActivity(next, `SPOOKED: ${target.name}. The target disappears from the board, but ${target.family} skill still gained ${skillGain} XP.`, "spooked");
    });
  };

  const startCrimeOperation = (operationId: string) => {
    if (blocked()) { log("You cannot start an operation right now.", "failure"); return; }
    setGameState((prev) => {
      const operation = CRIME_OPERATIONS.find((item) => item.id === operationId);
      if (!operation) return prev;
      if (prev.crimeExperience < operation.crimeExperienceRequired) return appendActivity(prev, `Requires ${operation.crimeExperienceRequired} Crime Experience.`, "failure");
      if (prev.cash < operation.setupCost) return appendActivity(prev, `You need ${money(operation.setupCost)} for the setup.`, "failure");
      if (prev.nerve < operation.nerve) return appendActivity(prev, `You need ${operation.nerve} Nerve to launch that operation.`, "failure");
      const missingRequired = (operation.requiredItems ?? []).filter((id) => (prev.inventory[id] || 0) <= 0);
      if (missingRequired.length) return appendActivity(prev, `Missing required setup: ${missingRequired.map((id) => getItem(id)?.name ?? id).join(", ")}.`, "failure");
      if (prev.activeCrimeOperations.length >= 3) return appendActivity(prev, "You can only run 3 passive crime operations at once during beta.", "failure");
      if (prev.activeCrimeOperations.some((job) => job.operationId === operation.id)) return appendActivity(prev, "That operation is already running.", "failure");
      const now = Date.now();
      const job = { id: `${operation.id}-${now}-${Math.floor(Math.random() * 100000)}`, operationId: operation.id, startedAt: now, finishesAt: now + operation.durationMs };
      const nextInventory = { ...prev.inventory };
      for (const id of operation.requiredItems ?? []) nextInventory[id] = Math.max(0, (nextInventory[id] || 0) - 1);
      const next: SaveData = {
        ...prev,
        inventory: nextInventory,
        cash: prev.cash - operation.setupCost,
        nerve: Math.max(0, prev.nerve - operation.nerve),
        heat: Math.min(100, prev.heat + Math.max(1, Math.ceil(operation.heat * 0.35))),
        activeCrimeOperations: [...prev.activeCrimeOperations, job],
      };
      return appendActivity(next, `${operation.name} started. It will continue in the background until the timer finishes.`, "system");
    });
  };

  const claimCrimeOperation = (operationInstanceId: string) => {
    setGameState((prev) => {
      const active = prev.activeCrimeOperations.find((job) => job.id === operationInstanceId);
      if (!active) return prev;
      const operation = CRIME_OPERATIONS.find((item) => item.id === active.operationId);
      if (!operation) return { ...prev, activeCrimeOperations: prev.activeCrimeOperations.filter((job) => job.id !== active.id) };
      const now = Date.now();
      const duration = Math.max(1, active.finishesAt - active.startedAt);
      const progress = Math.max(0, Math.min(1, (now - active.startedAt) / duration));
      const riskBuild = operation.cashoutMode === "risk-build";
      if (!riskBuild && active.finishesAt > now) return appendActivity(prev, "That operation is still running.", "failure");
      if (riskBuild && progress < (operation.minCashoutProgress ?? .15)) return appendActivity(prev, "The operation has not built enough value to cash out yet.", "failure");
      const skillXp = prev.crimeSkillXp[operation.family] ?? 0;
      const skill = crimeFamilyLevel(skillXp);
      const progressRisk = riskBuild ? (.35 + progress * .9) : 1;
      const detection = Math.max(3, Math.min(72, operation.detectionRisk * progressRisk + prev.heat * 0.12 - skill * 0.55 - Math.min(5, prev.streetReputation * 0.015)));
      const detected = Math.random() * 100 < detection;
      const baseReward = randomCrimeReward(operation.minReward, operation.maxReward);
      const valueProgress = riskBuild ? (.22 + progress * .78) : 1;
      const reward = Math.round(baseReward * valueProgress * (1 + Math.min(0.55, skill * 0.008)) * (detected ? 0.22 : 1));
      const skillGain = Math.max(6, Math.round((12 + operation.crimeExperienceRequired * 0.06) * (riskBuild ? .45 + progress * .55 : 1)));
      const remaining = prev.activeCrimeOperations.filter((job) => job.id !== active.id);
      let next: SaveData = {
        ...prev,
        activeCrimeOperations: remaining,
        crimeSkillXp: { ...prev.crimeSkillXp, [operation.family]: skillXp + skillGain },
        crimeMastery: { ...prev.crimeMastery, [crimeCareerIdForOperation(operation.id)]: (prev.crimeMastery[crimeCareerIdForOperation(operation.id)] ?? 0) + Math.max(10, Math.round(10 + operation.crimeExperienceRequired * 0.035)) },
        crimeOperationsCompleted: prev.crimeOperationsCompleted + 1,
        crimeExperience: prev.crimeExperience + Math.max(8, Math.round(operation.crimeExperienceRequired * 0.055)),
        xp: prev.xp + Math.max(12, Math.round(operation.crimeExperienceRequired * 0.08)),
      };

      if (!detected) {
        const repGain = Math.max(1, Math.round(operation.crimeExperienceRequired / 85));
        next = {
          ...next,
          cash: prev.cash + reward,
          crimesCompleted: prev.crimesCompleted + 1,
          streetReputation: prev.streetReputation + repGain,
          heat: Math.min(100, prev.heat + operation.heat),
        };
        return appendActivity(next, `${riskBuild && progress < .995 ? "CASHED OUT" : "OPERATION COMPLETE"}: ${operation.name} paid ${money(reward)} · detection ${detection.toFixed(0)}% · ${operation.family} skill +${skillGain} XP · Street Rep +${repGain}.`, "success");
      }

      const busted = prev.heat >= 60 && Math.random() < Math.min(0.28, 0.06 + (prev.heat - 60) / 180);
      if (busted) {
        const sentence = Math.round(JAIL_MINUTES * 60000 * 1.35);
        next = {
          ...next,
          cash: prev.cash + reward,
          crimesFailed: prev.crimesFailed + 1,
          timesJailed: prev.timesJailed + 1,
          jailUntil: Date.now() + sentence,
          jailStartedAt: Date.now(),
          jailReason: `${operation.name} investigation`,
          jailSentenceMs: sentence,
          activeCharges: [operation.name],
          currentLocation: "jail",
          locationsVisited: prev.locationsVisited.includes("jail") ? prev.locationsVisited : [...prev.locationsVisited, "jail"],
          heat: Math.max(0, prev.heat - 10),
        };
        return appendActivity(next, `OPERATION BUSTED: ${operation.name}. Only ${money(reward)} was recovered before arrest.`, "jailed");
      }

      next = {
        ...next,
        cash: prev.cash + reward,
        crimesSpooked: prev.crimesSpooked + 1,
        heat: Math.min(100, prev.heat + operation.heat + 5),
      };
      return appendActivity(next, `OPERATION EXPOSED: ${operation.name}. You salvaged ${money(reward)}, but Heat jumped and the full payout was lost.`, "spooked");
    });
  };

  const tagGraffiti = (spotId: string) => {
    if (blocked()) { log("You cannot tag a spot right now.", "failure"); return; }
    setGameState((prev) => {
      const spot = GRAFFITI_SPOTS.find((item) => item.id === spotId);
      if (!spot) return prev;
      const now = Date.now();
      if (prev.streetReputation < spot.reputationRequired) return appendActivity(prev, `That spot requires ${spot.reputationRequired} Street Rep.`, "failure");
      if ((prev.graffitiCooldowns[spot.id] || 0) > now) return appendActivity(prev, "That wall is too hot right now. Try it again after the cooldown.", "failure");
      if (prev.nerve < spot.nerve) return appendActivity(prev, `You need ${spot.nerve} Nerve.`, "failure");
      if ((prev.inventory["spray-can"] || 0) <= 0) return appendActivity(prev, "You need a Street Paint Pack from the Black Market crime-prep section.", "failure");
      if (prev.cash < spot.paintCost) return appendActivity(prev, `You need ${money(spot.paintCost)} for extra setup supplies.`, "failure");
      const j = getJob(prev.currentJob);
      const bonuses = getJobStatBonuses(j, prev.jobSkills);
      const dexterity = prev.stats.dexterity + (bonuses.dexterity ?? 0);
      const streetXp = prev.crimeSkillXp.street ?? 0;
      const chance = graffitiSuccessChance(spot, streetXp, dexterity, prev.heat, prev.streetReputation);
      const success = Math.random() * 100 < chance;
      const cooldowns = { ...prev.graffitiCooldowns, [spot.id]: now + spot.cooldownMs };
      const base: SaveData = {
        ...prev,
        cash: prev.cash - spot.paintCost,
        inventory: { ...prev.inventory, "spray-can": Math.max(0, (prev.inventory["spray-can"] || 0) - 1) },
        nerve: Math.max(0, prev.nerve - spot.nerve),
        graffitiCooldowns: cooldowns,
        crimeSkillXp: { ...prev.crimeSkillXp, street: streetXp + Math.max(6, spot.reputationGain * 4) },
        crimeMastery: { ...prev.crimeMastery, graffiti: (prev.crimeMastery.graffiti ?? 0) + Math.max(8, spot.reputationGain * 3) },
      };
      if (success) {
        const factionRep = prev.faction ? prev.factionReputation + Math.max(1, Math.floor(spot.reputationGain / 5)) : prev.factionReputation;
        const next: SaveData = {
          ...base,
          streetReputation: prev.streetReputation + spot.reputationGain,
          graffitiTags: { ...prev.graffitiTags, [spot.id]: (prev.graffitiTags[spot.id] || 0) + 1 },
          graffitiTotalTags: prev.graffitiTotalTags + 1,
          factionReputation: factionRep,
          crimeExperience: prev.crimeExperience + Math.max(2, Math.ceil(spot.reputationGain / 2)),
          xp: prev.xp + spot.reputationGain * 2,
          crimesCompleted: prev.crimesCompleted + 1,
          heat: Math.min(100, prev.heat + spot.heat),
        };
        return appendActivity(next, `GRAFFITI: ${spot.name} tagged · Street Rep +${spot.reputationGain}${prev.faction ? " · faction visibility increased" : ""}.`, "success");
      }
      const next: SaveData = {
        ...base,
        crimesSpooked: prev.crimesSpooked + 1,
        heat: Math.min(100, prev.heat + spot.heat + 2),
      };
      return appendActivity(next, `GRAFFITI SPOOKED: ${spot.name}. No reputation gained and Heat increased.`, "spooked");
    });
  };

  const resolveScavenging = (locationId: string) => {
    if (blocked()) { log("You cannot scavenge right now.", "failure"); return; }
    setGameState((prev) => {
      const location = SCAVENGE_LOCATIONS.find((item) => item.id === locationId);
      if (!location) return prev;
      const masteryXp = prev.crimeMastery.scavenging ?? 0;
      const mastery = crimeCareerMasteryLevel(masteryXp);
      if (mastery < location.masteryRequired) return appendActivity(prev, `Requires Scavenging Mastery ${location.masteryRequired}.`, "failure");
      const missingAccessItems = (location.requiredItems ?? []).filter((id) => (prev.inventory[id] || 0) <= 0);
      if (missingAccessItems.length) return appendActivity(prev, `Scavenging access locked: ${missingAccessItems.map((id) => getItem(id)?.name ?? id).join(", ")} required.`, "failure");
      if (prev.nerve < location.nerve) return appendActivity(prev, `You need ${location.nerve} Nerve.`, "failure");

      const opportunity = scavengingOpportunity(location, Date.now());
      const theftLevel = crimeFamilyLevel(prev.crimeSkillXp.theft ?? 0);
      const chance = Math.max(12, Math.min(97, 50 + opportunity * 0.34 + theftLevel * 0.5 + mastery * 0.16 - location.difficulty * 0.42 - prev.heat * 0.08));
      const success = Math.random() * 100 < chance;
      const masteryGain = success ? Math.max(9, Math.round(8 + location.difficulty * 0.25)) : 4;
      const skillGain = success ? Math.max(5, Math.round(5 + location.difficulty * 0.18)) : 2;
      const restricted = Boolean(location.requiredItems?.length) || location.masteryRequired >= 50;
      const { bustChance, luckyChance, jailOnBust } = scavengingOutcomeRates(location, mastery, prev.heat, opportunity);

      let next: SaveData = {
        ...prev,
        nerve: Math.max(0, prev.nerve - location.nerve),
        crimeMastery: { ...prev.crimeMastery, scavenging: masteryXp + masteryGain },
        crimeSkillXp: { ...prev.crimeSkillXp, theft: (prev.crimeSkillXp.theft ?? 0) + skillGain },
      };

      if (!success) {
        if (Math.random() * 100 < bustChance) {
          const fine = Math.min(prev.cash, Math.round(90 + location.difficulty * (18 + Math.random() * 24) + prev.heat * 8));
          if (Math.random() * 100 < jailOnBust) {
            const sentence = Math.round(JAIL_MINUTES * 60000 * (.55 + location.difficulty / 130));
            next = {
              ...next,
              cash: Math.max(0, prev.cash - fine),
              crimesFailed: prev.crimesFailed + 1,
              timesJailed: prev.timesJailed + 1,
              jailUntil: Date.now() + sentence,
              jailStartedAt: Date.now(),
              jailReason: "Restricted-area scavenging",
              jailSentenceMs: sentence,
              activeCharges:["Trespass / Scavenging"],
              currentLocation:"jail",
              locationsVisited:prev.locationsVisited.includes("jail")?prev.locationsVisited:[...prev.locationsVisited,"jail"],
              heat:Math.max(0,prev.heat-6),
            };
            return appendActivity(next, `BUSTED: ${location.name}. Security turns the search into an arrest · fine ${money(fine)}.`, "jailed");
          }
          next = { ...next, cash:Math.max(0,prev.cash-fine), crimesFailed:prev.crimesFailed+1, heat:Math.min(100,prev.heat+location.heat+5) };
          return appendActivity(next, `BUSTED: ${location.name}. Security runs you off and fines you ${money(fine)} · Heat +${location.heat+5}.`, "failure");
        }
        next = { ...next, crimesSpooked: prev.crimesSpooked + 1, heat: Math.min(100, prev.heat + Math.max(0, Math.floor(location.heat / 2))) };
        return appendActivity(next, `SCAVENGING FAILED: ${location.name} came up empty at ${opportunity}% opportunity.`, "spooked");
      }

      const lucky = Math.random() * 100 < luckyChance;
      const reward = Math.round(randomCrimeReward(location.minReward, location.maxReward) * (0.65 + opportunity / 125) * (lucky ? 2.15 : 1));
      const lootPool = location.lootIds?.length ? location.lootIds : ["black-envelope","old-city-token","encrypted-chip","sugar-rush","moon-chews"];
      let foundName = "";
      let inventory = prev.inventory;

      if (lucky) {
        const jackpotPool = mastery >= 75
          ? ["prototype-key","old-city-token","encrypted-chip","ghost-serum","rift-tabs","neon-dust"]
          : mastery >= 35
            ? ["old-city-token","encrypted-chip","rift-tabs","neon-dust","black-envelope"]
            : ["encrypted-chip","rift-tabs","neon-dust","black-envelope","moon-chews"];
        const jackpotId = jackpotPool[Math.floor(Math.random() * jackpotPool.length)];
        const jackpot = getItem(jackpotId);
        if (jackpot) {
          const quantity = ["neon-dust","rift-tabs"].includes(jackpot.id) && Math.random() < .45 ? 2 : 1;
          inventory = { ...inventory, [jackpot.id]:(inventory[jackpot.id] || 0) + quantity };
          foundName = `${quantity > 1 ? `${quantity}× ` : ""}${jackpot.name}`;
        }
      } else if (Math.random() < Math.min(0.62, 0.08 + opportunity / 260 + (location.lootChanceBonus ?? 0))) {
        const weighted = lootPool
          .map((id) => getItem(id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((item) => ({ item, weight: Math.max(0.002, item.dropChance ?? 0.04) }));
        const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
        let lootRoll = Math.random() * Math.max(0.001, totalWeight);
        const selected = weighted.find((entry) => ((lootRoll -= entry.weight) <= 0))?.item ?? weighted[weighted.length - 1]?.item;
        if (selected) { inventory = { ...inventory, [selected.id]:(inventory[selected.id] || 0) + 1 }; foundName = selected.name; }
      }

      next = {
        ...next,
        inventory,
        cash: prev.cash + reward,
        xp: prev.xp + 8 + Math.round(location.difficulty * 0.2) + (lucky ? 12 : 0),
        crimeExperience: prev.crimeExperience + 4 + Math.round(location.difficulty * 0.12) + (lucky ? 6 : 0),
        crimesCompleted: prev.crimesCompleted + 1,
        crimesCritical: prev.crimesCritical + (lucky ? 1 : 0),
        heat: Math.min(100, prev.heat + location.heat + (lucky && restricted ? 1 : 0)),
      };
      return appendActivity(next, `${lucky ? "LUCKY FIND" : "SCAVENGING SUCCESS"}: ${location.name} · ${money(reward)}${foundName ? ` · ${foundName}` : ""} · ${opportunity}% opportunity.`, lucky ? "critical" : "success");
    });
  };

  const resolveShoplifting = (storeId: string, selectedItemIds: string[]) => {
    if (blocked()) { log("You cannot shoplift right now.", "failure"); return; }
    setGameState((prev) => {
      const store = SHOPLIFT_STORES.find((item) => item.id === storeId);
      if (!store || selectedItemIds.length === 0) return appendActivity(prev, "Choose at least one item before leaving the store.", "failure");
      const masteryXp = prev.crimeMastery.shoplift ?? 0;
      const mastery = crimeCareerMasteryLevel(masteryXp);
      if (mastery < store.masteryRequired) return appendActivity(prev, `Requires Shoplifting Mastery ${store.masteryRequired}.`, "failure");
      const selected = selectedItemIds.map((id) => store.items.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (!selected.length) return prev;
      const locked = selected.find((item) => mastery < item.masteryRequired);
      if (locked) return appendActivity(prev, `${locked.name} requires Shoplifting Mastery ${locked.masteryRequired}.`, "failure");
      const required = Array.from(new Set(selected.flatMap((item) => item.requiredItems ?? [])));
      const missing = required.filter((id) => (prev.inventory[id] || 0) <= 0);
      if (missing.length) return appendActivity(prev, `Missing required prep: ${missing.map((id) => getItem(id)?.name ?? id).join(", ")}.`, "failure");
      const nerveCost = Math.max(2, Math.min(8, 1 + Math.ceil(selected.reduce((sum, item) => sum + item.severity, 0) / 2)));
      if (prev.nerve < nerveCost) return appendActivity(prev, `You need ${nerveCost} Nerve for that basket.`, "failure");
      const conditions = getShopliftingConditions(store, Date.now());
      const suspicion = shopliftingSuspicion(store, selected, conditions, 0);
      const theftLevel = crimeFamilyLevel(prev.crimeSkillXp.theft ?? 0);
      const j = getJob(prev.currentJob); const b = getJobStatBonuses(j, prev.jobSkills);
      const dexterity = prev.stats.dexterity + (b.dexterity ?? 0);
      const chance = Math.max(4, Math.min(97, 98 - suspicion + theftLevel * 0.72 + mastery * 0.12 + Math.min(12, dexterity * 0.28) - prev.heat * 0.1));
      const roll = Math.random() * 100;
      const severityTotal = selected.reduce((sum, item) => sum + item.severity, 0);
      const masteryGain = Math.max(8, 7 + severityTotal * 4);
      const skillGain = Math.max(6, 5 + severityTotal * 3);
      const nextInventory = { ...prev.inventory };
      for (const id of required) nextInventory[id] = Math.max(0, (nextInventory[id] || 0) - 1);
      let next: SaveData = {
        ...prev,
        inventory: nextInventory,
        nerve: Math.max(0, prev.nerve - nerveCost),
        crimeMastery: { ...prev.crimeMastery, shoplift: masteryXp + masteryGain },
        crimeSkillXp: { ...prev.crimeSkillXp, theft: (prev.crimeSkillXp.theft ?? 0) + skillGain },
      };
      if (roll < chance) {
        const critical = roll < Math.max(1.5, chance * 0.055);
        const baseValue = selected.reduce((sum, item) => sum + item.value, 0);
        const payout = Math.round(baseValue * conditions.payoutMultiplier * (0.86 + Math.random() * 0.28) * (critical ? 1.35 : 1));
        next = {
          ...next,
          cash: prev.cash + payout,
          xp: prev.xp + 8 + severityTotal * 4,
          crimeExperience: prev.crimeExperience + 5 + severityTotal * 3,
          crimesCompleted: prev.crimesCompleted + 1,
          crimesCritical: prev.crimesCritical + (critical ? 1 : 0),
          heat: Math.min(100, prev.heat + Math.max(1, Math.ceil(severityTotal / 2))),
        };
        return appendActivity(next, `${critical ? "CRITICAL SHOPLIFT" : "SHOPLIFT"}: ${store.name} · ${selected.length} item${selected.length === 1 ? "" : "s"} · ${suspicion}% suspicion · ${money(payout)}.`, critical ? "critical" : "success");
      }
      const arrestWindow = Math.min(25, 4 + suspicion * 0.18 + prev.heat * 0.04);
      if (roll < chance + arrestWindow) {
        const sentence = Math.round(JAIL_MINUTES * 60000 * (1 + severityTotal * 0.06));
        next = { ...next, crimesFailed:prev.crimesFailed+1, timesJailed:prev.timesJailed+1, jailUntil:Date.now()+sentence, jailStartedAt:Date.now(), jailReason:"Retail theft", jailSentenceMs:sentence, activeCharges:["Retail Theft"], currentLocation:"jail", locationsVisited:prev.locationsVisited.includes("jail")?prev.locationsVisited:[...prev.locationsVisited,"jail"], heat:Math.max(0, prev.heat-8) };
        return appendActivity(next, `ARRESTED: ${store.name}. Your ${suspicion}% suspicion basket drew too much attention.`, "jailed");
      }
      next = { ...next, crimesSpooked:prev.crimesSpooked+1, heat:Math.min(100,prev.heat+Math.max(2,Math.ceil(severityTotal/2))) };
      return appendActivity(next, `SPOOKED: ${store.name}. You leave the basket behind before the situation gets worse.`, "spooked");
    });
  };

  const runCrimeCareerAction = (crimeId: string, actionId: string, liveContext?: { chanceModifier:number; rewardMultiplier:number; heatModifier:number }) => {
    if (blocked()) { log("You cannot commit crimes right now.", "failure"); return; }
    setGameState((prev) => {
      const career = CRIME_CAREERS.find((item) => item.id === crimeId);
      const action = career?.actions?.find((item) => item.id === actionId);
      if (!career || !action) return prev;
      if (prev.crimeExperience < career.unlockCrimeExperience) return appendActivity(prev, `Requires ${career.unlockCrimeExperience} Crime Experience.`, "failure");
      const masteryXp = prev.crimeMastery[career.id] ?? 0;
      const mastery = crimeCareerMasteryLevel(masteryXp);
      if (mastery < (action.masteryRequired ?? 1)) return appendActivity(prev, `Requires ${career.name} Mastery ${action.masteryRequired}.`, "failure");
      if (prev.streetReputation < (action.streetRepRequired ?? 0)) return appendActivity(prev, `Requires ${action.streetRepRequired} Street Reputation.`, "failure");
      if (prev.nerve < action.nerve) return appendActivity(prev, `You need ${action.nerve} Nerve.`, "failure");
      const required = Array.from(new Set(action.requiredItems ?? []));
      const missing = required.filter((id) => (prev.inventory[id] || 0) <= 0);
      if (missing.length) return appendActivity(prev, `Missing required items: ${missing.map((id) => getItem(id)?.name ?? id).join(", ")}.`, "failure");
      const familyLevel = crimeFamilyLevel(prev.crimeSkillXp[career.family] ?? 0);
      const j = getJob(prev.currentJob); const b = getJobStatBonuses(j, prev.jobSkills);
      const dexterity = prev.stats.dexterity + (b.dexterity ?? 0);
      const chance = Math.max(4, Math.min(97, careerActionSuccessChance(action, familyLevel, mastery, dexterity, prev.heat) + (liveContext?.chanceModifier ?? 0)));
      const roll = Math.random() * 100;
      const masteryGain = Math.max(8, Math.round(8 + action.difficulty * 0.28));
      const skillGain = Math.max(6, Math.round(6 + action.difficulty * 0.22));
      const nextInventory = { ...prev.inventory };
      for (const id of required) nextInventory[id] = Math.max(0, (nextInventory[id] || 0) - 1);
      let next: SaveData = { ...prev, inventory:nextInventory, nerve:Math.max(0,prev.nerve-action.nerve), crimeMastery:{...prev.crimeMastery,[career.id]:masteryXp+masteryGain}, crimeSkillXp:{...prev.crimeSkillXp,[career.family]:(prev.crimeSkillXp[career.family]??0)+skillGain} };
      if (roll < chance) {
        const critical = roll < Math.max(1.2, chance * 0.05);
        const reward = randomCrimeReward(action.minReward, action.maxReward) * (liveContext?.rewardMultiplier ?? 1) * (critical ? 1.45 : 1);
        next = { ...next, xp:prev.xp+Math.round(8+action.difficulty*.35)*(critical?2:1), crimeExperience:prev.crimeExperience+Math.round(5+action.difficulty*.18)*(critical?2:1), crimesCompleted:prev.crimesCompleted+1, crimesCritical:prev.crimesCritical+(critical?1:0) };
        if (action.rewardType === "heat-reduction") {
          next = { ...next, heat:Math.max(0,prev.heat-Math.round(reward)) };
          return appendActivity(next, `${critical ? "CRITICAL CLEANUP" : "CLEANUP"}: ${action.name} reduced Heat by ${Math.round(reward)}.`, critical?"critical":"success");
        }
        if (action.rewardType === "street-rep") {
          next = { ...next, streetReputation:prev.streetReputation+Math.round(reward), heat:Math.min(100,prev.heat+action.heat+(liveContext?.heatModifier ?? 0)) };
          return appendActivity(next, `${action.name} added ${Math.round(reward)} Street Rep.`, critical?"critical":"success");
        }
        next = { ...next, cash:prev.cash+Math.round(reward), heat:Math.min(100,prev.heat+action.heat+(liveContext?.heatModifier ?? 0)) };
        return appendActivity(next, `${critical ? "CRITICAL SUCCESS" : "SUCCESS"}: ${career.name} · ${action.name} paid ${money(Math.round(reward))}.`, critical?"critical":"success");
      }
      const arrestWindow = Math.min(24, 4 + action.difficulty * .16 + prev.heat * .04);
      if (roll < chance + arrestWindow) {
        const sentence = Math.round(JAIL_MINUTES * 60000 * (1 + action.difficulty / 180));
        next = { ...next, crimesFailed:prev.crimesFailed+1, timesJailed:prev.timesJailed+1, jailUntil:Date.now()+sentence, jailStartedAt:Date.now(), jailReason:career.name, jailSentenceMs:sentence, activeCharges:[career.name], currentLocation:"jail", locationsVisited:prev.locationsVisited.includes("jail")?prev.locationsVisited:[...prev.locationsVisited,"jail"], heat:Math.max(0,prev.heat-10) };
        return appendActivity(next, `ARRESTED: ${career.name} · ${action.name}.`, "jailed");
      }
      next = { ...next, crimesSpooked:prev.crimesSpooked+1, heat:Math.min(100,prev.heat+Math.max(1,Math.ceil(action.heat/2))) };
      return appendActivity(next, `SPOOKED: ${career.name} · ${action.name}.`, "spooked");
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

      const remaining = owned - qty;
      const inventory = { ...prev.inventory, [itemId]: remaining };
      const equippedWeapon = prev.equippedWeapon === itemId && remaining <= 0 ? null : prev.equippedWeapon;
      const equippedArmor = prev.equippedArmor === itemId && remaining <= 0 ? null : prev.equippedArmor;
      const autoBuyCeiling = betaNpcAutoBuyCeiling(itemId);

      // BETA TESTING: simulated buyers instantly clear reasonably priced player listings.
      // Keeping this in the market action (instead of spawning money elsewhere) makes it easy to remove for live multiplayer.
      if (unitPrice <= autoBuyCeiling) {
        const gross = unitPrice * qty;
        const next: SaveData = {
          ...prev,
          cash: prev.cash - fee + gross,
          inventory,
          equippedWeapon,
          equippedArmor,
        };
        return appendActivity(next, `BETA NPC buyer instantly bought ${qty}× ${item.name} for ${money(gross)}. Listing fee ${money(fee)}.`, "success");
      }

      const listing: AuctionListing = { id:`listing-${Date.now()}-${Math.random()}`, itemId, seller:"You", price:unitPrice, quantity:qty, createdAt:Date.now() };
      const next: SaveData = {
        ...prev,
        cash: prev.cash - fee,
        inventory,
        equippedWeapon,
        equippedArmor,
        auctionListings: [listing, ...prev.auctionListings],
      };
      return appendActivity(next, `Listed ${qty}× ${item.name} for ${money(unitPrice)} each. Price is above the current beta NPC auto-buy ceiling, so it remains listed. Fee ${money(fee)}.`, "success");
    });

  const betaQuickSellBlackMarket = (itemId: string, quantity = 1) =>
    setGameState((prev) => {
      const item = getItem(itemId);
      const qty = Math.max(1, Math.floor(quantity));
      const owned = prev.inventory[itemId] || 0;
      if (!item || owned < qty) return appendActivity(prev, "You do not own enough of that item.", "failure");
      const unitPrice = betaNpcQuickSellPrice(itemId);
      const total = unitPrice * qty;
      const remaining = owned - qty;
      const next: SaveData = {
        ...prev,
        cash: prev.cash + total,
        inventory: { ...prev.inventory, [itemId]: remaining },
        equippedWeapon: prev.equippedWeapon === itemId && remaining <= 0 ? null : prev.equippedWeapon,
        equippedArmor: prev.equippedArmor === itemId && remaining <= 0 ? null : prev.equippedArmor,
      };
      return appendActivity(next, `BETA quick sale: NPC broker bought ${qty}× ${item.name} for ${money(total)} (${money(unitPrice)} each).`, "success");
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
      const all = [...prev.auctionListings, ...ALL_NPC_LISTINGS.filter((x) => !prev.auctionRemovedListingIds.includes(x.id))];
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
        auctionRemovedListingIds: listing.seller !== "You" ? [...prev.auctionRemovedListingIds, listing.id] : prev.auctionRemovedListingIds,
      };
      return appendActivity(next, `Bought ${listing.quantity}× ${getItem(listing.itemId)?.name ?? listing.itemId} from ${listing.seller} for ${money(total)}.`, "success");
    });

  const buyBlackMarketItem = (itemId: string, quantity = 1) => setGameState((prev) => {
    const item = getItem(itemId);
    const qty = Math.max(1, Math.floor(quantity));
    if (!item || item.store !== "blackmarket") return prev;
    const cost = Math.max(1, item.price) * qty;
    if (prev.cash < cost) return appendActivity(prev, "Not enough cash.", "failure");
    const next = { ...prev, cash: prev.cash - cost, inventory: { ...prev.inventory, [itemId]: (prev.inventory[itemId] || 0) + qty } };
    return appendActivity(next, `Bought ${qty}× ${item.name} from an underground supplier.`, "success");
  });

  const buyProductionFacility = (facilityId: string) => setGameState((prev) => {
    const facility = PRODUCTION_FACILITIES.find(x => x.id === facilityId);
    if (!facility || prev.productionFacilities.includes(facilityId)) return prev;
    if (prev.crimeExperience < facility.requiredCrimeExperience) return appendActivity(prev, `You need ${facility.requiredCrimeExperience} crime experience for that setup.`, "failure");
    if (prev.cash < facility.setupCost) return appendActivity(prev, "Not enough cash for that production setup.", "failure");
    const next = { ...prev, cash: prev.cash - facility.setupCost, productionFacilities: [...prev.productionFacilities, facilityId] };
    return appendActivity(next, `${facility.name} established. Production risk is now tied to your Heat and attention.`, "success");
  });

  const startProduction = (recipeId: string) => setGameState((prev) => {
    const recipe = PRODUCTION_RECIPES.find(x => x.id === recipeId);
    if (!recipe) return prev;
    if (prev.crimeExperience < recipe.requiredCrimeExperience) return appendActivity(prev, "Your crime operation is not experienced enough for that batch.", "failure");
    if (!canFacilityRun(prev.productionFacilities, recipe.facilityId)) return appendActivity(prev, "You do not own a capable production setup.", "failure");
    const facility = PRODUCTION_FACILITIES.filter(f => prev.productionFacilities.includes(f.id)).sort((a,b)=>b.capacity-a.capacity)[0];
    const activeCount = prev.activeProductions.filter(x=>x.finishesAt>Date.now()).length;
    if (!facility || activeCount >= facility.capacity) return appendActivity(prev, "All production slots are busy.", "failure");
    for (const [id, qty] of Object.entries(recipe.inputs)) if ((prev.inventory[id] || 0) < qty) return appendActivity(prev, `Missing production supplies for ${recipe.name}.`, "failure");
    const inventory = { ...prev.inventory };
    for (const [id, qty] of Object.entries(recipe.inputs)) inventory[id] = Math.max(0, (inventory[id] || 0) - qty);
    const now = Date.now();
    const attention = Math.min(100, prev.productionAttention + recipe.attention);
    const heatGain = Math.max(1, recipe.heat - (facility.heatShield || 0));
    const raidChance = Math.max(0, (attention - 35) * .0025 + Math.max(0, prev.heat - 50) * .0015);
    if (Math.random() < raidChance) {
      const seized = Object.fromEntries(Object.entries(inventory).map(([id,qty]) => [id, getItem(id)?.contraband ? 0 : qty]));
      const sentence = 45 * 1000 + Math.min(120000, attention * 1000);
      const next: SaveData = { ...prev, inventory: seized, heat: Math.max(15, prev.heat - 10), productionAttention: Math.max(10, attention - 25), productionRaids: prev.productionRaids + 1, timesJailed: prev.timesJailed + 1, jailUntil: now + sentence, jailStartedAt: now, jailReason: "Production raid", jailSentenceMs: sentence, activeCharges: [...prev.activeCharges, "Illegal production"], currentLocation: "jail" };
      return appendActivity(next, "Your production site was raided. Contraband was seized and you were arrested.", "jailed");
    }
    const job = { id:`batch-${now}-${Math.random()}`, recipeId, startedAt:now, finishesAt:now+recipe.durationMs, quantity:recipe.output };
    const next = { ...prev, inventory, heat: Math.min(100, prev.heat + heatGain), productionAttention: attention, activeProductions: [...prev.activeProductions, job], productionBatches: prev.productionBatches + 1 };
    return appendActivity(next, `${recipe.name} started. Production attention is now ${attention}/100.`, "system");
  });

  const claimProduction = (productionId: string) => setGameState((prev) => {
    const job = prev.activeProductions.find(x => x.id === productionId);
    if (!job || job.finishesAt > Date.now()) return prev;
    const recipe = PRODUCTION_RECIPES.find(x => x.id === job.recipeId);
    if (!recipe) return { ...prev, activeProductions: prev.activeProductions.filter(x=>x.id!==productionId) };
    const next = { ...prev, inventory: { ...prev.inventory, [recipe.productId]: (prev.inventory[recipe.productId] || 0) + job.quantity }, activeProductions: prev.activeProductions.filter(x=>x.id!==productionId) };
    return appendActivity(next, `${recipe.name} finished: ${job.quantity} units moved into your inventory.`, "success");
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
      if (prev.bankFrozenUntil && prev.bankFrozenUntil > Date.now()) {
        return appendActivity(prev, "Your domestic bank account is temporarily frozen.", "failure");
      }
      const n = Math.min(
        prev.cash,
        Math.max(0, amount)
      );

      if (n <= 0) {
        return prev;
      }

      const nextBank = prev.bank + n;
      return {
        ...prev,
        cash: prev.cash - n,
        bank: nextBank,
        bankLifetimeDeposits: prev.bankLifetimeDeposits + n,
        bankHistory: [...prev.bankHistory, nextBank + prev.bankSavings].slice(-40),
        bankTransactions: [{ id: `dep-${Date.now()}`, type: "deposit", amount: n, time: Date.now(), note: "Cash deposit" }, ...prev.bankTransactions].slice(0, 60),
      };
    });

  const bankWithdraw = (
    amount: number
  ) =>
    setGameState((prev) => {
      if (prev.bankFrozenUntil && prev.bankFrozenUntil > Date.now()) {
        return appendActivity(prev, "Your domestic bank account is temporarily frozen.", "failure");
      }
      const n = Math.min(
        prev.bank,
        Math.max(0, amount)
      );

      if (n <= 0) {
        return prev;
      }

      const nextBank = prev.bank - n;
      return {
        ...prev,
        cash: prev.cash + n,
        bank: nextBank,
        bankHistory: [...prev.bankHistory, nextBank + prev.bankSavings].slice(-40),
        bankTransactions: [{ id: `wd-${Date.now()}`, type: "withdrawal", amount: -n, time: Date.now(), note: "Cash withdrawal" }, ...prev.bankTransactions].slice(0, 60),
      };
    });



  const unlockOffshoreTier = (tierId: string) =>
    setGameState((prev) => {
      const tier = OFFSHORE_TIERS.find(t => t.id === tierId);
      if (!tier) return prev;
      const netWorth = prev.cash + prev.bank + prev.bankSavings + prev.offshoreBalance + Object.entries(prev.propertyHoldings).reduce((sum,[id,count]) => sum + ((PROPERTIES.find(p=>p.id===id)?.price || 0) * (Number(count)||0)), 0);
      const currentIndex = OFFSHORE_TIERS.findIndex(t => t.id === prev.offshoreTier);
      const nextIndex = OFFSHORE_TIERS.findIndex(t => t.id === tierId);
      if (netWorth < tier.unlockNetWorth || nextIndex < 0 || nextIndex > currentIndex + 1) return appendActivity(prev, `Offshore tier locked. Requires ${money(tier.unlockNetWorth)} net worth.`, "failure");
      if (currentIndex >= nextIndex) return prev;
      return appendActivity({ ...prev, offshoreTier:tierId }, `${tier.name} unlocked.`, "success");
    });

  const offshoreDeposit = (amount:number) =>
    setGameState((prev) => {
      const tier = getOffshoreTier(prev.offshoreTier);
      if (!tier) return appendActivity(prev, "Unlock an offshore account tier first.", "failure");
      const gross = Math.min(prev.cash, Math.max(0, Math.floor(amount)), Math.max(0, tier.cap-prev.offshoreBalance));
      if (gross <= 0) return prev;
      const fee = Math.max(1, Math.floor(gross*tier.depositFeeRate));
      const credited = Math.max(0, gross-fee);
      const next:SaveData = { ...prev, cash:prev.cash-gross, offshoreBalance:prev.offshoreBalance+credited, offshoreLosses:prev.offshoreLosses+fee, bankTransactions:[{id:`offshore-dep-${Date.now()}`,type:"offshore",amount:credited,time:Date.now(),note:`Offshore deposit (${money(fee)} routing fee)`},...prev.bankTransactions].slice(0,60) };
      return appendActivity(next, `${money(credited)} moved offshore after fees.`, "success");
    });

  const offshoreWithdraw = (amount:number) =>
    setGameState((prev) => {
      const tier = getOffshoreTier(prev.offshoreTier);
      if (!tier) return prev;
      const gross = Math.min(prev.offshoreBalance, Math.max(0, Math.floor(amount)));
      if (gross <= 0) return prev;
      const fee = Math.max(1, Math.floor(gross*tier.withdrawFeeRate));
      const credited = Math.max(0, gross-fee);
      const next:SaveData = { ...prev, cash:prev.cash+credited, offshoreBalance:prev.offshoreBalance-gross, offshoreLosses:prev.offshoreLosses+fee, bankTransactions:[{id:`offshore-wd-${Date.now()}`,type:"offshore",amount:-gross,time:Date.now(),note:`Offshore withdrawal (${money(fee)} routing fee)`},...prev.bankTransactions].slice(0,60) };
      return appendActivity(next, `${money(credited)} withdrawn from offshore storage.`, "success");
    });

  const buyRentalProperty = (id:string) =>
    setGameState((prev) => {
      const p = PROPERTIES.find(x=>x.id===id);
      if (!p || p.price<=0 || prev.cash<p.price) return appendActivity(prev, "You cannot afford that rental property.", "failure");
      const holdings = { ...prev.propertyHoldings, [id]:(prev.propertyHoldings[id]||0)+1 };
      const rental = { ...prev.propertyRentalEnabled, [id]:true };
      return appendActivity({ ...prev, cash:prev.cash-p.price, propertyHoldings:holdings, propertyRentalEnabled:rental }, `Purchased a ${p.name} rental unit.`, "success");
    });

  const togglePropertyRental = (id:string) =>
    setGameState((prev) => ({ ...prev, propertyRentalEnabled:{ ...prev.propertyRentalEnabled, [id]:!prev.propertyRentalEnabled[id] } }));


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
    const next = { ...prev, energy: prev.energy - 5, heat: Math.max(0, prev.heat - reduction), productionAttention: Math.max(0, prev.productionAttention - 8) };
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
    maxHappiness,

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
    scoutCrimeTarget,
    resolveCrimeTarget,
    startCrimeOperation,
    claimCrimeOperation,
    tagGraffiti,
    resolveScavenging,
    resolveShoplifting,
    runCrimeCareerAction,

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
    betaQuickSellBlackMarket,
    cancelAuctionListing,
    buyAuctionListing,
    buyBlackMarketItem,
    buyProductionFacility,
    startProduction,
    claimProduction,
    seededAuctionListings: ALL_NPC_LISTINGS,

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
    unlockOffshoreTier,
    offshoreDeposit,
    offshoreWithdraw,
    buyRentalProperty,
    togglePropertyRental,

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
