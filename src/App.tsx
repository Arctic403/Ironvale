import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  MAX_ENERGY,
  ENERGY_REGEN_INTERVAL,
  NERVE_REGEN_INTERVAL,
} from "./systems/resourceSystem";

import {
  CRIMES,
  Crime,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
  randomReward,
  rollCrimeOutcome,
} from "./systems/crimeSystem";

import {
  OPPONENTS,
  Opponent,
  resolveCombat,
  calculateWinChance,
  calculateCombatPower,
  getCombatDifficulty,
  getCombatDifficultyLabel,
} from "./systems/combatSystem";

import {
  GYMS,
  Gym,
  TrainingStat,
  TRAINING_STATS,
  applyTraining,
  canTrainStat,
  getGymExperienceGain,
  getNextGym,
  gymUnlocked,
  isJailGym,
} from "./systems/gymSystem";

import {
  CombatStats,
  getLevel,
  getMaxHealth,
  getNaturalNerveMax,
} from "./systems/progressionSystem";

import {
  EDUCATION,
  ITEMS,
  JOBS,
  MISSIONS,
  PROPERTIES,
  EducationCourse,
  Item,
  Job,
  Mission,
  Property,
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
  | "character";

type ActivityType =
  | "success"
  | "failure"
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

type SaveData = {
  cash: number;
  xp: number;

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

  inventory: Record<string, number>;

  equippedWeapon: string | null;
  equippedArmor: string | null;

  ownedProperty: string | null;

  educationCompleted: string[];
  educationActive: string | null;
  educationStartedAt: number | null;

  completedMissions: string[];

  crimesCompleted: number;
  crimesFailed: number;
  crimesSpooked: number;
  timesJailed: number;

  fightsWon: number;
  fightsLost: number;

  gymSessions: number;

  activities: Activity[];
};

const SAVE_KEY = "riftcity-core-v3";
const JOB_PAY_INTERVAL = 60 * 60 * 1000;
const JAIL_BASE_MINUTES = 2;
const BASE_HAPPINESS = 100;

function getTrainingHappinessLoss(energyCost: number): number {
  const low = energyCost * 0.4;
  const high = energyCost * 0.6;
  return low + Math.random() * (high - low);
}

function freshSave(): SaveData {
  const now = Date.now();
  return {
    cash: 1000,
    xp: 0,
    energy: 100,
    lastEnergyUpdate: now,
    nerve: 10,
    lastNerveUpdate: now,
    health: 100,
    crimeExperience: 0,
    stats: {
      strength: 1,
      defense: 1,
      speed: 1,
      dexterity: 1,
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
    timesJailed: 0,
    fightsWon: 0,
    fightsLost: 0,
    gymSessions: 0,
    activities: [
      {
        id: 1,
        text: "Welcome to RiftCity.",
        type: "system",
        time: now,
      },
    ],
  };
}

function loadSave(): SaveData {
  try {
    const current = localStorage.getItem(SAVE_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      const fresh = freshSave();
      return {
        ...fresh,
        ...parsed,
        stats: { ...fresh.stats, ...(parsed.stats || {}) },
        inventory: parsed.inventory || {},
        activities: parsed.activities || fresh.activities,
        educationCompleted: parsed.educationCompleted || [],
        completedMissions: parsed.completedMissions || [],
        gymExperience: typeof parsed.gymExperience === "number" ? parsed.gymExperience : 0,
        gymMemberships: Array.isArray(parsed.gymMemberships) ? parsed.gymMemberships : ["premier-fitness"],
        activeGym: parsed.activeGym || "premier-fitness",
        happiness: typeof parsed.happiness === "number" ? parsed.happiness : BASE_HAPPINESS,
        lastHappinessUpdate: typeof parsed.lastHappinessUpdate === "number" ? parsed.lastHappinessUpdate : Date.now(),
      };
    }

    const old = localStorage.getItem("riftcity-core-v2");
    if (old) {
      const oldSave = JSON.parse(old);
      const fresh = freshSave();
      return {
        ...fresh,
        cash: typeof oldSave.cash === "number" ? oldSave.cash : fresh.cash,
        xp: typeof oldSave.xp === "number" ? oldSave.xp : fresh.xp,
        energy: typeof oldSave.energy === "number" ? oldSave.energy : fresh.energy,
        nerve: typeof oldSave.nerve === "number" ? oldSave.nerve : fresh.nerve,
        health: typeof oldSave.health === "number" ? oldSave.health : fresh.health,
        crimeExperience: typeof oldSave.crimeExperience === "number" ? oldSave.crimeExperience : 0,
        stats: { ...fresh.stats, ...(oldSave.stats || {}) },
        currentJob: oldSave.currentJob || null,
        inventory: oldSave.inventory || {},
        equippedWeapon: oldSave.equippedWeapon || null,
        equippedArmor: oldSave.equippedArmor || null,
        ownedProperty: oldSave.ownedProperty || "shack",
        educationCompleted: oldSave.educationCompleted || [],
        completedMissions: oldSave.completedMissions || [],
        crimesCompleted: oldSave.crimesCompleted || 0,
        crimesFailed: oldSave.crimesFailed || 0,
        crimesSpooked: oldSave.crimesSpooked || 0,
        timesJailed: oldSave.timesJailed || 0,
        fightsWon: oldSave.fightsWon || 0,
        fightsLost: oldSave.fightsLost || 0,
      };
    }
  } catch (e) {
    console.error("Failed to parse save data", e);
  }
  return freshSave();
}

export default function App() {
  const [gameState, setGameState] = useState<SaveData>(() => loadSave());
  const [currentScreen, setCurrentScreen] = useState<Screen>("city");

  // Save game automatically when data modifications occur
  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Core background mechanics tick loop
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setGameState((prev) => {
        let updateMade = false;
        const next = { ...prev };

        // Jail Check Timer
        if (next.jailUntil && now >= next.jailUntil) {
          next.jailUntil = null;
          next.activities = [
            {
              id: Date.now(),
              text: "You served your time and have been released from jail!",
              type: "system",
              time: now,
            },
            ...next.activities,
          ];
          updateMade = true;
        }

        // Energy Payout Generation
        if (now - next.lastEnergyUpdate >= ENERGY_REGEN_INTERVAL) {
          if (next.energy < MAX_ENERGY) {
            next.energy = Math.min(MAX_ENERGY, next.energy + 5);
            next.lastEnergyUpdate = now;
            updateMade = true;
          }
        }

        // Nerve Payout Generation
        const maxNerve = getNaturalNerveMax(getLevel(next.xp));
        if (now - next.lastNerveUpdate >= NERVE_REGEN_INTERVAL) {
          if (next.nerve < maxNerve) {
            next.nerve = Math.min(maxNerve, next.nerve + 1);
            next.lastNerveUpdate = now;
            updateMade = true;
          }
        }

        // Active Employment Payroll Checks
        if (next.currentJob && now - next.lastJobPayment >= JOB_PAY_INTERVAL) {
          const job = JOBS.find((j: Job) => j.id === next.currentJob);
          if (job) {
            next.cash += job.pay;
            next.lastJobPayment = now;
            next.activities = [
              {
                id: Date.now(),
                text: `Payday! Earned $${job.pay} working as a ${job.name}.`,
                type: "job",
                time: now,
              },
              ...next.activities,
            ];
            updateMade = true;
          }
        }

        return updateMade ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Performance Computations
  const playerLevel = useMemo(() => getLevel(gameState.xp), [gameState.xp]);
  const maxHealth = useMemo(() => getMaxHealth(playerLevel), [playerLevel]);
  const maxNerve = useMemo(() => getNaturalNerveMax(playerLevel), [playerLevel]);
  const currentProperty = useMemo(() => getProperty(gameState.ownedProperty || "shack"), [gameState.ownedProperty]);

  const addLog = (text: string, type: ActivityType) => {
    setGameState((prev) => ({
      ...prev,
      activities: [
        { id: Date.now(), text, type, time: Date.now() },
        ...prev.activities.slice(0, 49),
      ],
    }));
  };

  // Gym Training Logic Actions
  const handleTrain = (stat: TrainingStat) => {
    const gym = GYMS.find((g: Gym) => g.id === gameState.activeGym);
    if (!gym) return;

    if (gameState.jailUntil) {
      alert("You cannot train while inside jail bounds!");
      return;
    }

    if (gameState.energy < gym.energyCost) {
      alert("Insufficient energy reserves!");
      return;
    }

    const happyLoss = getTrainingHappinessLoss(gym.energyCost);
    setGameState((prev) => {
      const updatedStats = applyTraining(prev.stats, stat, gym);
      const expGained = getGymExperienceGain(gym);
      
      return {
        ...prev,
        energy: prev.energy - gym.energyCost,
        happiness: Math.max(0, prev.happiness - happyLoss),
        stats: updatedStats,
        gymExperience: prev.gymExperience + expGained,
        gymSessions: prev.gymSessions + 1,
      };
    });

    addLog(`Trained ${stat} in ${gym.name}. Used ${gym.energyCost} Energy.`, "gym");
  };

  // Crime Logic Execution Actions
  const handleCommitCrime = (crime: Crime) => {
    if (gameState.jailUntil) {
      alert("You can't commit crimes from behind bars!");
      return;
    }
    if (gameState.nerve < crime.nerveCost) {
      alert("Not enough nerve remaining!");
      return;
    }

    const successChance = crimeSuccessChance(gameState.crimeExperience, crime);
    const outcome = rollCrimeOutcome(successChance);

    setGameState((prev) => {
      const next = { ...prev };
      next.nerve -= crime.nerveCost;

      if (outcome === "success") {
        const rewards = randomReward(crime);
        next.cash += rewards.cash;
        next.xp += rewards.xp;
        next.crimeExperience += crime.nerveCost; 
        next.crimesCompleted += 1;
        
        // Add random items to inventory if dropped
        if (rewards.items) {
          Object.entries(rewards.items).forEach(([itemId, qty]) => {
            next.inventory[itemId] = (next.inventory[itemId] || 0) + qty;
          });
        }

        setTimeout(() => addLog(`Success: ${crime.successMessage || `You completed ${crime.name}.`} Earned $${rewards.cash}.`, "success"), 10);
      } else if (outcome === "failed") {
        next.crimesFailed += 1;
        setTimeout(() => addLog(`Failed: ${crime.failMessage || `You messed up while executing ${crime.name}.`}`, "failure"), 10);
      } else if (outcome === "jailed") {
        next.timesJailed += 1;
        next.jailUntil = Date.now() + JAIL_BASE_MINUTES * 60 * 1000;
        setTimeout(() => addLog(`Arrested! ${crime.jailMessage || `Busted during ${crime.name}. Placed in holding jail.`}`, "jailed"), 10);
      }

      return next;
    });
  };

  // Combat Execution Logic Action
  const handleAttackOpponent = (opponent: Opponent) => {
    if (gameState.jailUntil) {
      alert("You cannot initiate a street fight while incarcerated!");
      return;
    }
    if (gameState.energy < 25) {
      alert("You need at least 25 energy to strike targets!");
      return;
    }

    const playerPower = calculateCombatPower(gameState.stats);
    const opponentPower = calculateCombatPower(opponent.stats);
    const combatResult = resolveCombat(playerPower, opponentPower);

    setGameState((prev) => {
      const next = { ...prev };
      next.energy -= 25;

      if (combatResult === "win") {
        next.fightsWon += 1;
        const prizeMoney = Math.floor(opponent.level * 150 + Math.random() * 100);
        next.cash += prizeMoney;
        next.xp += opponent.level * 40;
        setTimeout(() => addLog(`Combat Win: You defeated ${opponent.name} and stole $${prizeMoney}!`, "combat"), 10);
      } else {
        next.fightsLost += 1;
        next.health = Math.max(1, Math.floor(prev.health * 0.2)); // Drops health down
        setTimeout(() => addLog(`Combat Loss: ${opponent.name} left you in bad shape.`, "combat"), 10);
      }

      return next;
    });
  };

  return (
    <div style={{ fontFamily: "'Courier New', monospace", background: "#0b0c10", color: "#c5c6c7", minHeight: "100vh", padding: "20px" }}>
      {/* Game Header HUD Dashboard */}
      <header style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", background: "#1f2833", padding: "20px", borderRadius: "6px", border: "1px solid #45a29e", marginBottom: "20px" }}>
        <div>
          <h1 style={{ color: "#66fcf1", margin: "0 0 10px 0" }}>RIFT CITY</h1>
          <p style={{ margin: 0 }}>Level: <strong>{playerLevel}</strong> | Cash: <strong style={{ color: "#4caf50" }}>${gameState.cash}</strong></p>
        </div>
        <div style={{ display: "flex", gap: "25px", alignItems: "center", fontWeight: "bold" }}>
          <div title="Used for gym training and attacking">â¡ Energy: <span style={{ color: "#66fcf1" }}>{gameState.energy}</span>/{MAX_ENERGY}</div>
          <div title="Used for executing crimes">ð§  Nerve: <span style={{ color: "#66fcf1" }}>{gameState.nerve}</span>/{maxNerve}</div>
          <div title="Your status health tracker">â¤ï¸ HP: <span style={{ color: "#ef5350" }}>{gameState.health}</span>/{maxHealth}</div>
          <div title="Affects stat growth rates inside gym cells">ð Happy: <span style={{ color: "#ffca28" }}>{Math.round(gameState.happiness)}</span></div>
        </div>
      </header>

      {/* Screen Frame Divider Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "20px" }}>
        {/* Main Sector Side Controls */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(["city", "crimes", "gym", "combat", "jobs", "character"] as Screen[]).map((screen) => (
            <button
              key={screen}
              onClick={() => setCurrentScreen(screen)}
              style={{
                padding: "12px",
                background: currentScreen === screen ? "#45a29e" : "#1f2833",
                color: currentScreen === screen ? "#0b0c10" : "#fff",
                border: "1px solid #45a29e",
                borderRadius: "4px",
                cursor: "pointer",
                textAlign: "left",
                textTransform: "uppercase",
                fontWeight: "bold",
                letterSpacing: "1px",
                transition: "0.2s"
              }}
            >
              {screen === "city" ? "ð The City" : screen === "crimes" ? "ð« Crimes" : screen === "gym" ? "ðï¸ Gym Training" : screen === "combat" ? "âï¸ Street Fights" : screen === "jobs" ? "ð¼ Employment" : "ð¤ Character"}
            </button>
          ))}
        </nav>

        {/* Core Frame Wrapper Content Display Panels */}
        <main style={{ background: "#1f2833", padding: "25px", borderRadius: "6px", border: "1px solid #45a29e", minHeight: "400px" }}>
          {gameState.jailUntil && (
            <div style={{ background: "#721c24", color: "#f8d7da", padding: "15px", borderLeft: "5px solid #dc3545", borderRadius: "4px", marginBottom: "20px", fontWeight: "bold" }}>
              ð¨ INCARCERATED: You are locked down in City Jail. Remaining time: {Math.max(0, Math.ceil((gameState.jailUntil - Date.now()) / 1000))}s.
            </div>
          )}

          {currentScreen === "city" && (
            <div>
              <h3 style={{ color: "#66fcf1" }}>The Dark Alleys</h3>
              <p>Residence Base tier: <strong>{currentProperty?.name || "Shack"}</strong></p>
              <p style={{ lineHeight: "1.6" }}>
                Welcome back to RiftCity. The district streets are live. Build muscle mass at the gym facilities, execute operations on target storefronts to secure cash flows, or fight rival factions to make a name for yourself.
              </p>
            </div>
          )}

          {currentScreen === "gym" && (
            <div>
              <h3 style={{ color: "#66fcf1" }}>Gym Center Hub</h3>
              <p>Active Complex Facility membership: <strong style={{ color: "#66fcf1" }}>{gameState.activeGym.replace("-", " ").toUpperCase()}</strong></p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: "20px" }}>
                {TRAINING_STATS.map((stat) => (
                  <div key={stat} style={{ background: "#0b0c10", padding: "15px", borderRadius: "4px", border: "1px solid #45a29e", textAlign: "center" }}>
                    <h4 style={{ textTransform: "uppercase", margin: "0 0 10px 0" }}>{stat}</h4>
                    <p style={{ fontSize: "20px", margin: "10px 0", color: "#fff" }}>{gameState.stats[stat as TrainingStat]}</p>
                    <button
                      onClick={() => handleTrain(stat as TrainingStat)}
                      disabled={!!gameState.jailUntil}
                      style={{ padding: "8px 16px", background: "#45a29e", color: "#0b0c10", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer", width: "100%" }}
                    >
                      Train Stat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentScreen === "crimes" && (
            <div>
              <h3 style={{ color: "#66fcf1" }}>Criminal Blueprint Registry</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "15px" }}>
                {CRIMES.map((crime) => {
                  const unlocked = crimeUnlocked(playerLevel, crime);
                  const odds = Math.floor(crimeSuccessChance(gameState.crimeExperience, crime) * 100);
                  
                  return (
                    <div key={crime.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0b0c10", padding: "15px", borderRadius: "4px", border: unlocked ? "1px solid #45a29e" : "1px solid #333", opacity: unlocked ? 1 : 0.5 }}>
                      <div>
                        <h4 style={{ margin: "0 0 5px 0" }}>{crime.name}</h4>
                        <small style={{ color: "#888" }}>Nerve Cost: {crime.nerveCost} | Approx Success Chance: {unlocked ? `${odds}%` : "Locked"}</small>
                      </div>
                      <button
                        onClick={() => handleCommitCrime(crime)}
                        disabled={!unlocked || !!gameState.jailUntil}
                        style={{ padding: "8px 16px", background: unlocked ? "#2e7d32" : "#333", color: "#fff", border: "none", borderRadius: "4px", cursor: unlocked ? "pointer" : "not-allowed", fontWeight: "bold" }}
                      >
                        Execute
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentScreen === "combat" && (
            <div>
              <h3 style={{ color: "#66fcf1" }}>Street Target Board</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "15px" }}>
                {OPPONENTS.map((opp) => {
                  const winChance = Math.floor(calculateWinChance(calculateCombatPower(gameState.stats), calculateCombatPower(opp.stats)) * 100);
                  return (
                    <div key={opp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0b0c10", padding: "15px", borderRadius: "4px", border: "1px solid #45a29e" }}>
                      <div>
                        <h4 style={{ margin: "0 0 5px 0" }}>{opp.name} <span style={{ color: "#66fcf1" }}>(Lv. {opp.level})</span></h4>
                        <small style={{ color: "#888" }}>Est Win Likelihood: {winChance}% | Power Index: {calculateCombatPower(opp.stats)}</small>
                      </div>
                      <button
                        onClick={() => handleAttackOpponent(opp)}
                        disabled={!!gameState.jailUntil}
                        style={{ padding: "8px 16px", background: "#c62828", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        Attack Target
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentScreen === "jobs" && (
            <div>
              <h3 style={{ color: "#66fcf1" }}>Job Applications Desk</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "15px" }}>
                {JOBS.map((job) => {
                  const isCurrent = gameState.currentJob === job.id;
                  return (
                    <div key={job.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0b0c10", padding: "15px", borderRadius: "4px", border: isCurrent ? "2px solid #45a29e" : "1px solid #222" }}>
                      <div>
                        <h4 style={{ margin: "0 0 5px 0" }}>{job.name} {isCurrent && <span style={{ color: "#4caf50", fontSize: "12px" }}>(CURRENT ROLE)</span>}</h4>
                        <small style={{ color: "#888" }}>Payout Cycle Salary: ${job.pay} / hr</small>
                      </div>
                      <button
                        onClick={() => setGameState(p => ({ ...p, currentJob: job.id, lastJobPayment: Date.now() }))}
                        disabled={isCurrent}
                        style={{ padding: "8px 16px", background: isCurrent ? "#333" : "#45a29e", color: isCurrent ? "#888" : "#0b0c10", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: isCurrent ? "default" : "pointer" }}
                      >
                        {isCurrent ? "Employed" : "Apply"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentScreen === "character" && (
            <div>
              <h3 style={{ color: "#66fcf1" }}>Criminal Ledger Record</h3>
              <div style={{ background: "#0b0c10", padding: "20px", borderRadius: "4px", border: "1px solid #45a29e" }}>
                <p>ð« Successful Crimes Logged: <strong>{gameState.crimesCompleted}</strong></p>
                <p>ðï¸ Total Gym Sets Finished: <strong>{gameState.gymSessions}</strong></p>
                <p>ð Street Fights Won: <strong>{gameState.fightsWon}</strong></p>
                <p>ð Street Fights Lost: <strong>{gameState.fightsLost}</strong></p>
                <p>ð Total Prison Bookings: <strong>{gameState.timesJailed}</strong></p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Live Action Ticker Output Terminal Panel Footer */}
      <footer style={{ marginTop: "20px", background: "#1f2833", padding: "20px", borderRadius: "6px", border: "1px solid #45a29e" }}>
        <h4 style={{ color: "#66fcf1", margin: "0 0 15px 0", letterSpacing: "1px" }}>CENTRAL OPERATIONS LOG FEED</h4>
        <div style={{ maxHeight: "150px", overflowY: "auto", background: "#0b0c10", padding: "15px", borderRadius: "4px", fontSize: "13px", lineHeight: "1.5" }}>
          {gameState.activities.map((act) => (
            <div key={act.id} style={{ borderBottom: "1px solid #1f2833", padding: "6px 0", color: act.type === "success" ? "#4caf50" : act.type === "jailed" || act.type === "failure" ? "#f44336" : act.type === "combat" ? "#ff9800" : "#c5c6c7" }}>
              [{new Date(act.time).toLocaleTimeString()}] {act.text}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
