import { useState, useEffect } from "react";
import { executeCombatTurn, DynamicFighter } from "./CombatSystem";
import { DistanceZone } from "./gameData";

export function useRiftCity() {
  const [gameState, setGameState] = useState<SaveData>(() => loadSave());
  const [currentScreen, setCurrentScreen] = useState<Screen>("character");
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [combatOpponent, setCombatOpponent] = useState<PlayerProfile | null>(null);
  const [combatMessage, setCombatMessage] = useState<string>("Choose an opponent.");

  const level = getLevel(gameState.xp).level;
  const property = getProperty(gameState.ownedProperty);
  const maxHealth = getMaxHealth(property?.maxHealthBonus ?? 0);
  const maxNerve =
    10 +
    Math.min(50, Math.floor(gameState.crimeExperience / 100) * 5) +
    (property?.nerveBonus ?? 0);
  const gym = GYMS.find((g) => g.id === gameState.activeGym) ?? GYMS[0];
  const job = getJob(gameState.currentJob);
  const education =
    EDUCATION.find((e) => e.id === gameState.educationActive) ?? null;
  const travelLocked = Boolean(
    gameState.travelCooldownUntil && gameState.travelCooldownUntil > Date.now()
  );

  const log = (text: string, type: ActivityType = "system") =>
    setGameState((s) => ({
      ...s,
      activities: [
        { id: Date.now() + Math.random(), text, type, time: Date.now() },
        ...s.activities,
      ].slice(0, 60),
    }));

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Main game tick loop
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setGameState((prev) => {
        let changed = false;
        const updates: Partial<SaveData> = {};

        // Energy
        if (prev.energy < MAX_ENERGY) {
          const ticks = Math.floor(
            (now - prev.lastEnergyUpdate) / ENERGY_REGEN_INTERVAL
          );
          if (ticks > 0) {
            updates.energy = Math.min(MAX_ENERGY, prev.energy + ticks);
            updates.lastEnergyUpdate =
              prev.lastEnergyUpdate + ticks * ENERGY_REGEN_INTERVAL;
            changed = true;
          }
        } else {
          updates.lastEnergyUpdate = now;
        }

        // Nerve
        if (prev.nerve < maxNerve) {
          const ticks = Math.floor(
            (now - prev.lastNerveUpdate) / NERVE_REGEN_INTERVAL
          );
          if (ticks > 0) {
            updates.nerve = Math.min(maxNerve, prev.nerve + ticks);
            updates.lastNerveUpdate =
              prev.lastNerveUpdate + ticks * NERVE_REGEN_INTERVAL;
            changed = true;
          }
        } else {
          updates.lastNerveUpdate = now;
        }

        // Happiness
        const maxHap = property?.maxHappiness ?? 100;
        if (prev.happiness < maxHap) {
          const ticks = Math.floor(
            (now - prev.lastHappinessUpdate) / HAPPINESS_TICK
          );
          if (ticks > 0) {
            updates.happiness = Math.min(
              maxHap,
              prev.happiness + ticks * 5
            );
            updates.lastHappinessUpdate =
              prev.lastHappinessUpdate + ticks * HAPPINESS_TICK;
            changed = true;
          }
        }

        // Health
        if (
          prev.health < maxHealth &&
          !prev.hospitalUntil &&
          !prev.jailUntil
        ) {
          updates.health = Math.min(maxHealth, prev.health + 1);
          changed = true;
        }

        // Jail / Hospital
        if (prev.jailUntil && now >= prev.jailUntil) {
          updates.jailUntil = null;
          changed = true;
        }
        if (prev.hospitalUntil && now >= prev.hospitalUntil) {
          updates.hospitalUntil = null;
          updates.health = maxHealth;
          changed = true;
        }

        // Bank Interest
        if (
          prev.bank > 0 &&
          now - (prev.lastBankInterest || now) >= BANK_INTEREST_INTERVAL
        ) {
          const days = Math.floor(
            (now - (prev.lastBankInterest || now)) / BANK_INTEREST_INTERVAL
          );
          if (days > 0) {
            const interest = Math.floor(prev.bank * 0.01 * days);
            updates.bank = prev.bank + interest;
            updates.bankInterest = (prev.bankInterest || 0) + interest;
            updates.lastBankInterest =
              (prev.lastBankInterest || now) + days * BANK_INTEREST_INTERVAL;
            changed = true;
          }
        }

        // Job Salary
        if (
          prev.currentJob &&
          now - prev.lastJobPayment >= JOB_PAY_INTERVAL &&
          job
        ) {
          const ticks = Math.floor(
            (now - prev.lastJobPayment) / JOB_PAY_INTERVAL
          );
          if (ticks > 0) {
            updates.cash = (updates.cash ?? prev.cash) + job.salary * ticks;
            updates.lastJobPayment =
              prev.lastJobPayment + ticks * JOB_PAY_INTERVAL;
            changed = true;
          }
        }

        return changed ? { ...prev, ...updates } : prev;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [maxNerve, maxHealth, property?.maxHappiness, job]);

  const blocked = () => Boolean(gameState.jailUntil || gameState.hospitalUntil);

  // Crimes Logic
  const commitCrime = (crime: Crime) => {
    if (blocked())
      return log(
        gameState.jailUntil ? "You are in jail." : "You are in hospital."
      );
    if (!crimeUnlocked(crime, gameState.crimeExperience))
      return log("Crime experience is too low.");
    if (gameState.nerve < crime.nerve) return log("Not enough nerve.");

    setGameState((prev) => {
      const chance = crimeSuccessChance(
        crime,
        prev.crimeExperience,
        1,
        getCrimeStatBonus(prev.stats)
      );
      const roll = Math.random() * 100;
      const outcome =
        roll < chance * 0.08
          ? "critical"
          : roll > 99.5
          ? "critical-fail"
          : roll < chance
          ? "success"
          : roll < chance + crime.risk * 0.55
          ? "jailed"
          : "spooked";

      const nextNerve = prev.nerve - crime.nerve;

      if (outcome === "critical") {
        const reward = Math.floor(randomReward(crime) * 1.75);
        log(
          `CRITICAL SUCCESS: ${crime.name} paid ${money(reward)}.`,
          "critical"
        );
        return {
          ...prev,
          nerve: nextNerve,
          cash: prev.cash + reward,
          xp: prev.xp + crime.xp * 2,
          crimeExperience: prev.crimeExperience + crime.crimeExperience * 2,
          crimesCompleted: prev.crimesCompleted + 1,
          crimesCritical: prev.crimesCritical + 1,
        };
      }

      if (outcome === "success") {
        const reward = randomReward(crime);
        log(`SUCCESS: ${crime.name} paid ${money(reward)}.`, "success");
        return {
          ...prev,
          nerve: nextNerve,
          cash: prev.cash + reward,
          xp: prev.xp + crime.xp,
          crimeExperience: prev.crimeExperience + crime.crimeExperience,
          crimesCompleted: prev.crimesCompleted + 1,
        };
      }

      if (outcome === "jailed") {
        log(`FAILED: ${crime.name}. You were jailed.`, "jailed");
        return {
          ...prev,
          nerve: nextNerve,
          crimesFailed: prev.crimesFailed + 1,
          timesJailed: prev.timesJailed + 1,
          jailUntil: Date.now() + JAIL_MINUTES * 60000,
        };
      }

      if (outcome === "critical-fail") {
        log(
          `CRITICAL FAIL: ${crime.name}. You barely escaped.`,
          "critical"
        );
        return {
          ...prev,
          nerve: nextNerve,
          crimesFailed: prev.crimesFailed + 1,
          health: Math.max(1, prev.health - 12),
        };
      }

      log(`SPOOKED: ${crime.name} failed without consequences.`, "spooked");
      return {
        ...prev,
        nerve: nextNerve,
        crimesSpooked: prev.crimesSpooked + 1,
      };
    });
  };

  // Gym Training
  const trainStat = (stat: StatType, amount = 1) => {
    if (blocked()) return log("Cannot train while jailed/hospitalized.");
    const cost = gym.energyCost * amount;
    if (gameState.energy < cost) return log("Not enough energy to train.");

    setGameState((prev) => {
      const gained =
        amount * gym.multiplier * (1 + prev.happiness / 200);
      log(`Trained ${stat} +${gained.toFixed(2)}.`);
      return {
        ...prev,
        energy: prev.energy - cost,
        happiness: Math.max(0, prev.happiness - 2 * amount),
        stats: {
          ...prev.stats,
          [stat]: prev.stats[stat] + gained,
        },
      };
    });
  };

  // --- SPATIAL COMBAT SYSTEM METHODS ---
  const startCombat = (opponent: PlayerProfile) => {
    if (blocked()) return log("Cannot fight right now.");
    if (gameState.energy < 10) return log("Requires 10 Energy to attack.");

    const preparedOpponent: PlayerProfile = {
      ...opponent,
      zone: opponent.zone || "Long",
      inCover: opponent.inCover ?? true,
    };

    setCombatOpponent(preparedOpponent);
    setCombatMessage(
      `Initiated attack on ${opponent.name}. Distance: ${preparedOpponent.zone}.`
    );
  };

  const moveZone = (newZone: DistanceZone) => {
    if (!combatOpponent) return;
    setGameState((s) => ({ ...s, combatZone: newZone, combatInCover: false }));
    setCombatMessage(`Repositioned to ${newZone} Range.`);
    executeEnemyCounterTurn();
  };

  const toggleCover = () => {
    if (!combatOpponent) return;
    setGameState((s) => ({ ...s, combatInCover: !s.combatInCover }));
    setCombatMessage(
      !gameState.combatInCover
        ? "Took cover behind local terrain."
        : "Stepped out of cover."
    );
    executeEnemyCounterTurn();
  };

  const executeEnemyCounterTurn = () => {
    if (!combatOpponent || combatOpponent.health <= 0) return;

    const playerFighter: DynamicFighter = {
      id: "player",
      name: "Operative",
      level,
      health: gameState.health,
      maxHealth,
      stats: gameState.stats,
      zone: gameState.combatZone || "Mid",
      inCover: gameState.combatInCover || false,
      equippedWeaponId: gameState.equippedWeaponId || "pistol",
    };

    const counter = executeCombatTurn(combatOpponent, playerFighter);

    setGameState((prev) => {
      const nextHealth = counter.updatedDefender.health;
      if (nextHealth <= 0) {
        setCombatMessage(`Defeat! ${combatOpponent.name} knocked you out.`);
        setCombatOpponent(null);
        log(
          `Defeated in combat by ${combatOpponent.name}. Sent to hospital.`,
          "jailed"
        );
        return {
          ...prev,
          health: 0,
          hospitalUntil: Date.now() + 15 * 60000,
        };
      }

      setCombatMessage((msg) => `${msg} | ${counter.log.actionText}`);
      return { ...prev, health: nextHealth };
    });
  };

  const executeCombatRound = (action: "attack" | "defend" | "flee") => {
    if (!combatOpponent) return;

    if (action === "flee") {
      const escape = Math.random() > 0.4;
      if (escape) {
        setCombatMessage("You successfully escaped the fight.");
        setCombatOpponent(null);
        setGameState((s) => ({ ...s, energy: Math.max(0, s.energy - 10) }));
        return;
      }
      setCombatMessage("Escape failed! Opponent took advantage.");
      executeEnemyCounterTurn();
      return;
    }

    if (action === "defend") {
      toggleCover();
      return;
    }

    const playerFighter: DynamicFighter = {
      id: "player",
      name: "Operative",
      level,
      health: gameState.health,
      maxHealth,
      stats: gameState.stats,
      zone: gameState.combatZone || "Mid",
      inCover: gameState.combatInCover || false,
      equippedWeaponId: gameState.equippedWeaponId || "pistol",
    };

    const turnResult = executeCombatTurn(playerFighter, combatOpponent);
    const updatedEnemy = turnResult.updatedDefender;

    if (updatedEnemy.health <= 0) {
      const rewardXp = Math.floor(combatOpponent.level * 15);
      const rewardCash = Math.floor(
        combatOpponent.level * 40 * (Math.random() + 0.5)
      );
      setCombatMessage(
        `Victory! Defeated ${combatOpponent.name}. Looted ${money(
          rewardCash
        )} and earned ${rewardXp} XP.`
      );
      setCombatOpponent(null);
      log(`Won combat against ${combatOpponent.name}.`, "success");

      setGameState((prev) => ({
        ...prev,
        energy: Math.max(0, prev.energy - 10),
        cash: prev.cash + rewardCash,
        xp: prev.xp + rewardXp,
        health: Math.min(maxHealth, prev.health + 5),
      }));
      return;
    }

    setCombatOpponent(updatedEnemy);
    setCombatMessage(turnResult.log.actionText);

    // Trigger enemy response after player attack
    executeEnemyCounterTurn();

    setGameState((prev) => ({
      ...prev,
      energy: Math.max(0, prev.energy - 10),
    }));
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
    travelLocked,
    encounter,
    setEncounter,
    combatOpponent,
    setCombatOpponent,
    combatMessage,
    commitCrime,
    trainStat,
    startCombat,
    moveZone,
    toggleCover,
    executeCombatRound,
  };
}
