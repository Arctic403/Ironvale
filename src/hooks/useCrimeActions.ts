/**
 * Crime System Hook
 * Handles crime execution, outcomes, and rewards
 */

import { SaveData } from "@/types/game";
import { Crime, crimeSuccessChance, crimeUnlocked, getCrimeStatBonus, randomReward } from "@/systems/crimeSystem";
import { useActivitySystem } from "./useActivitySystem";
import { money } from "@/utils/helpers";
import { GAME_CONFIG } from "@/constants/gameConfig";

export function useCrimeSystem(
  gameState: SaveData,
  setGameState: (fn: (prev: SaveData) => SaveData) => void,
  log: (text: string, type: any) => void
) {
  const { appendActivity } = useActivitySystem();

  const blocked = () =>
    Boolean(gameState.jailUntil || gameState.hospitalUntil);

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

    if (!crimeUnlocked(crime, gameState.crimeExperience)) {
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

      const criticalSuccessChance = chance * 0.08;

      let outcome:
        | "critical"
        | "success"
        | "jailed"
        | "critical-fail"
        | "spooked";

      if (roll < criticalSuccessChance) {
        outcome = "critical";
      } else if (roll < chance) {
        outcome = "success";
      } else if (roll >= 99.5) {
        outcome = "critical-fail";
      } else if (roll < chance + crime.risk * 0.55) {
        outcome = "jailed";
      } else {
        outcome = "spooked";
      }

      let next: SaveData = {
        ...prev,
        nerve: Math.max(0, prev.nerve - crime.nerve),
      };

      if (outcome === "critical") {
        const reward = Math.floor(randomReward(crime) * 1.75);

        next = {
          ...next,
          cash: prev.cash + reward,
          xp: prev.xp + crime.xp * 2,
          crimeExperience: prev.crimeExperience + crime.crimeExperience * 2,
          crimesCompleted: prev.crimesCompleted + 1,
          crimesCritical: prev.crimesCritical + 1,
        };

        return appendActivity(
          next,
          `CRITICAL SUCCESS: ${crime.name} paid ${money(reward)}.`,
          "critical"
        );
      }

      if (outcome === "success") {
        const reward = randomReward(crime);

        next = {
          ...next,
          cash: prev.cash + reward,
          xp: prev.xp + crime.xp,
          crimeExperience: prev.crimeExperience + crime.crimeExperience,
          crimesCompleted: prev.crimesCompleted + 1,
        };

        return appendActivity(
          next,
          `SUCCESS: ${crime.name} paid ${money(reward)}.`,
          "success"
        );
      }

      if (outcome === "jailed") {
        next = {
          ...next,
          crimesFailed: prev.crimesFailed + 1,
          timesJailed: prev.timesJailed + 1,
          jailUntil: Date.now() + GAME_CONFIG.JAIL_MINUTES * 60000,
        };

        return appendActivity(
          next,
          `FAILED: ${crime.name}. You were jailed.`,
          "jailed"
        );
      }

      if (outcome === "critical-fail") {
        next = {
          ...next,
          crimesFailed: prev.crimesFailed + 1,
          health: Math.max(1, prev.health - 12),
        };

        return appendActivity(
          next,
          `CRITICAL FAIL: ${crime.name}. You escaped, barely.`,
          "critical"
        );
      }

      next = {
        ...next,
        crimesSpooked: prev.crimesSpooked + 1,
      };

      return appendActivity(
        next,
        `SPOOKED: ${crime.name} failed without further consequences.`,
        "spooked"
      );
    });
  };

  return {
    commitCrime,
  };
}
