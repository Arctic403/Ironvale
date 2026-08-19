/**
 * Gym System Hook
 * Handles gym membership, training, and stat progression
 */

import { SaveData } from "@/types/game";
import {
  GYMS,
  TRAINING_STATS,
  TrainingStat,
  applyTraining,
  canTrainStat,
  getGymExperienceGain,
  gymUnlocked,
} from "@/systems/gymSystem";
import { useActivitySystem } from "./useActivitySystem";

export function useGymActions(
  gameState: SaveData,
  setGameState: (fn: (prev: SaveData) => SaveData) => void,
  log: (text: string, type: any) => void
) {
  const { appendActivity } = useActivitySystem();

  const blocked = () =>
    Boolean(gameState.jailUntil || gameState.hospitalUntil);

  const train = (stat: TrainingStat) => {
    if (blocked()) {
      log("You cannot train right now.", "failure");
      return;
    }

    const gym = GYMS.find((g) => g.id === gameState.activeGym) ?? GYMS[0];

    if (!canTrainStat(gym, stat)) {
      log("This gym cannot train that stat.", "failure");
      return;
    }

    if (gameState.energy < gym.energyCost) {
      log(`You need ${gym.energyCost} energy.`, "failure");
      return;
    }

    setGameState((prev) => {
      const currentGym = GYMS.find((g) => g.id === prev.activeGym) ?? GYMS[0];

      const educationMultiplier =
        prev.educationCompleted.some(
          (id) => id === "fitness-basics" || id === "advanced-fitness"
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
        energy: prev.energy - currentGym.energyCost,
        stats: result.stats,
        gymExperience: prev.gymExperience + getGymExperienceGain(currentGym.energyCost),
        gymSessions: prev.gymSessions + 1,
        happiness: Math.max(0, prev.happiness - currentGym.energyCost * 0.5),
      };

      return appendActivity(
        next,
        `TRAINED ${stat.toUpperCase()}: +${result.gain.toFixed(2)} gain.`,
        "gym"
      );
    });
  };

  const buyGym = (id: string) =>
    setGameState((prev) => {
      const g = GYMS.find((x) => x.id === id);

      if (!g || g.jailOnly || !gymUnlocked(g, prev.gymExperience)) {
        return prev;
      }

      if (prev.gymMemberships.includes(id)) {
        return {
          ...prev,
          activeGym: id,
        };
      }

      if (prev.cash < g.membershipCost) {
        return appendActivity(
          prev,
          "Not enough cash for membership.",
          "failure"
        );
      }

      const next: SaveData = {
        ...prev,
        cash: prev.cash - g.membershipCost,
        gymMemberships: [...prev.gymMemberships, id],
        activeGym: id,
      };

      return appendActivity(next, `Joined ${g.name}.`, "success");
    });

  return {
    train,
    buyGym,
  };
}
