/**
 * Resource System Hook
 * Manages passive regeneration of energy, nerve, happiness, health
 * Also handles jail, hospital, bank interest, job payments, market updates
 */

import { useEffect } from "react";
import { SaveData } from "@/types/game";
import {
  GAME_CONFIG,
  DEFAULT_MARKET_PRICES,
} from "@/constants/gameConfig";
import { randomMarketPrice } from "@/utils/helpers";
import { getProperty } from "@/data/gameData";

export function useResourceSystem(
  gameState: SaveData,
  setGameState: (fn: (prev: SaveData) => SaveData) => void,
  maxHealth: number
) {
  const maxNerve =
    10 +
    Math.min(50, Math.floor(gameState.crimeExperience / 100) * 5) +
    (getProperty(gameState.ownedProperty)?.nerveBonus ?? 0);

  const property = getProperty(gameState.ownedProperty);
  const maxHappiness = property?.maxHappiness ?? 100;

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();

      setGameState((prev) => {
        let changed = false;
        const updates: Partial<SaveData> = {};

        // ENERGY
        if (prev.energy < GAME_CONFIG.MAX_ENERGY) {
          const ticks = Math.floor(
            (now - prev.lastEnergyUpdate) / GAME_CONFIG.ENERGY_REGEN_INTERVAL
          );

          if (ticks > 0) {
            updates.energy = Math.min(
              GAME_CONFIG.MAX_ENERGY,
              prev.energy + ticks
            );
            updates.lastEnergyUpdate =
              prev.lastEnergyUpdate +
              ticks * GAME_CONFIG.ENERGY_REGEN_INTERVAL;
            changed = true;
          }
        } else {
          updates.lastEnergyUpdate = now;
        }

        // NERVE
        if (prev.nerve < maxNerve) {
          const ticks = Math.floor(
            (now - prev.lastNerveUpdate) / GAME_CONFIG.NERVE_REGEN_INTERVAL
          );

          if (ticks > 0) {
            updates.nerve = Math.min(maxNerve, prev.nerve + ticks);
            updates.lastNerveUpdate =
              prev.lastNerveUpdate +
              ticks * GAME_CONFIG.NERVE_REGEN_INTERVAL;
            changed = true;
          }
        } else {
          updates.lastNerveUpdate = now;
        }

        // HAPPINESS
        if (prev.happiness < maxHappiness) {
          const ticks = Math.floor(
            (now - prev.lastHappinessUpdate) / GAME_CONFIG.HAPPINESS_TICK
          );

          if (ticks > 0) {
            updates.happiness = Math.min(
              maxHappiness,
              prev.happiness + ticks * 5
            );
            updates.lastHappinessUpdate =
              prev.lastHappinessUpdate + ticks * GAME_CONFIG.HAPPINESS_TICK;
            changed = true;
          }
        } else {
          updates.lastHappinessUpdate = now;
        }

        // HEALTH
        if (
          prev.health < maxHealth &&
          !prev.hospitalUntil &&
          !prev.jailUntil
        ) {
          const ticks = Math.floor(
            (now - prev.lastEnergyUpdate) / GAME_CONFIG.HEALTH_REGEN_INTERVAL
          );

          if (ticks > 0) {
            updates.health = Math.min(maxHealth, prev.health + ticks);
            changed = true;
          }
        }

        // JAIL
        if (prev.jailUntil && now >= prev.jailUntil) {
          updates.jailUntil = null;
          changed = true;
        }

        // HOSPITAL
        if (prev.hospitalUntil && now >= prev.hospitalUntil) {
          updates.hospitalUntil = null;
          updates.health = maxHealth;
          changed = true;
        }

        // BANK INTEREST
        if (
          prev.bank > 0 &&
          now - prev.lastBankInterest >= GAME_CONFIG.BANK_INTEREST_INTERVAL
        ) {
          const days = Math.floor(
            (now - prev.lastBankInterest) / GAME_CONFIG.BANK_INTEREST_INTERVAL
          );

          if (days > 0) {
            const interest = Math.floor(prev.bank * 0.01 * days);
            updates.bank = prev.bank + interest;
            updates.bankInterest = prev.bankInterest + interest;
            updates.lastBankInterest =
              prev.lastBankInterest +
              days * GAME_CONFIG.BANK_INTEREST_INTERVAL;
            changed = true;
          }
        }

        // JOB PAYMENT
        if (
          prev.currentJob &&
          now - prev.lastJobPayment >= GAME_CONFIG.JOB_PAY_INTERVAL
        ) {
          const { getJob } = require("@/data/gameData");
          const currentJob = getJob(prev.currentJob);

          if (currentJob) {
            const ticks = Math.floor(
              (now - prev.lastJobPayment) / GAME_CONFIG.JOB_PAY_INTERVAL
            );

            if (ticks > 0) {
              const earned = currentJob.salary * ticks;
              updates.cash =
                (updates.cash ?? prev.cash) + earned;
              updates.lastJobPayment =
                prev.lastJobPayment +
                ticks * GAME_CONFIG.JOB_PAY_INTERVAL;
              changed = true;
            }
          }
        }

        // MARKET UPDATE
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

        if (now - lastMarketUpdate >= GAME_CONFIG.MARKET_UPDATE_INTERVAL) {
          const updatedMarket = {
            ...prev.market,
          };

          Object.keys(DEFAULT_MARKET_PRICES).forEach((id) => {
            const current =
              updatedMarket[id] ?? DEFAULT_MARKET_PRICES[id];
            updatedMarket[id] = randomMarketPrice(current);
          });

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

    return () => window.clearInterval(id);
  }, [maxNerve, maxHealth, maxHappiness, setGameState]);
}
