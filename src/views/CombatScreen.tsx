import React from "react";
import type { useRiftCity } from "../hooks/useRiftCity";

import { Panel, Button } from "../components/ui";
import { InteractiveCombatView } from "./Combat";

import {
  DEFAULT_WEAPONS,
  calculateWinChance,
  getWeaponSkillLevelFromXp,
} from "../systems/combatSystem";

import { PLAYER_PROFILES } from "../data/playerProfiles";
import { getItem } from "../data/items";

import {
  money,
  HOSPITAL_MINUTES,
} from "../core/gameCore";

import type { SaveData } from "../types/riftCity";

type Game = ReturnType<typeof useRiftCity>;

/* =========================================================
   COMBAT
========================================================= */

export function Combat({ g }: { g: Game }) {
  if (g.combatOpponent) {
    const opponent = g.combatOpponent;

    return (
      <InteractiveCombatView
        player={{
          id: "player",
          name: "You",
          level: g.level,
          health: g.gameState.health,
          maxHealth: g.maxHealth,
          stats: g.combatStats,
          weapons: DEFAULT_WEAPONS.filter((weapon) => weapon.id === "unarmed" || (g.gameState.inventory[weapon.id] || 0) > 0),
          equippedWeaponId: g.gameState.equippedWeapon,
          weaponSkills: Object.fromEntries(["unarmed","blade","blunt","handgun","smg","shotgun","rifle"].map((skill) => [skill, getWeaponSkillLevelFromXp(g.gameState.weaponSkillXp[skill] || 0)])),
          armor: g.gameState.equippedArmor ? getItem(g.gameState.equippedArmor)?.name : undefined,
          armorProtection: g.gameState.equippedArmor ? (getItem(g.gameState.equippedArmor)?.effect || 0) : 0,
        }}
        enemy={{
          id: opponent.id,
          name: opponent.name,
          level: opponent.level,
          health: opponent.health,
          maxHealth: opponent.maxHealth,
          stats: opponent.stats,
          weapons:
            opponent.weapons ||
            DEFAULT_WEAPONS,
          cashReward:
            opponent.cashReward,
          xpReward:
            opponent.level * 25,
        }}
        onStart={g.beginCombat}
        onWeaponSkillUse={(weaponClass, hit) => {
          g.setGameState((previous) => ({
            ...previous,
            weaponSkillXp: {
              ...previous.weaponSkillXp,
              [weaponClass]: (previous.weaponSkillXp[weaponClass] || 0) + (hit ? 3 : 1),
            },
          }));
        }}
        onFinish={(
          outcome,
          enemy,
          finalPlayerHealth
        ) => {
          let cashEarned = 0;

          const baseXp =
            enemy.xpReward || 50;

          let xpEarned = baseXp;

          const isVictory =
            outcome === "mug";

          if (outcome === "mug") {
            cashEarned = Math.floor(
              (enemy.cashReward || 100) *
                (0.4 + Math.random() * 0.4)
            );

            xpEarned = Math.floor(
              baseXp * 0.25
            );
          } else if (
            outcome === "leave"
          ) {
            xpEarned = Math.floor(
              baseXp * 0.25
            );
          }

          g.setGameState(
            (previous) => {
              const next: SaveData = {
                ...previous,

                cash:
                  previous.cash +
                  cashEarned,

                xp:
                  previous.xp +
                  xpEarned,

                health: Math.max(
                  1,
                  Math.min(
                    g.maxHealth,
                    finalPlayerHealth
                  )
                ),

                fightsWon: isVictory
                  ? previous.fightsWon + 1
                  : previous.fightsWon,
              };

              const description =
                isVictory
                  ? `COMBAT VICTORY: Defeated ${enemy.name}. Earned ${money(
                      cashEarned
                    )} and ${xpEarned} XP.`
                  : `COMBAT ENDED: You left the encounter with ${xpEarned} XP.`;

              return g.appendActivity(
                next,
                description,
                isVictory
                  ? "combat"
                  : "system"
              );
            }
          );

          g.setCombatOpponent(null);
          g.setCombatStarted(false);
          g.setCurrentScreen("combat");
        }}
        onDefeat={() =>
          setGameStateForCombatDefeat(g, opponent.name)
        }
      />
    );
  }

  const incapacitated = Boolean(
    g.gameState.jailUntil ||
      g.gameState.hospitalUntil
  );

  const noEnergy =
    g.gameState.energy < 10;

  return (
    <Panel title="Available Targets">
      <div className="ui-grid two-col">
        {PLAYER_PROFILES.map(
          (opponent) => {
            const winChance =
              calculateWinChance(
                g.combatStats,
                opponent.stats
              );

            return (
              <div
                className="card target-card"
                key={opponent.id}
              >
                <div className="card-header-split">
                  <span className="card-tag">
                    LV {opponent.level}
                  </span>

                  <span className="status-badge">
                    {opponent.status}
                  </span>
                </div>

                <h3>
                  {opponent.name}
                </h3>

                <p>
                  {opponent.title} ·{" "}
                  {opponent.location}
                </p>

                <div className="data-list">
                  <div className="data-row">
                    <span>
                      Health
                    </span>

                    <b>
                      {opponent.health}/
                      {opponent.maxHealth}
                    </b>
                  </div>

                  <div className="data-row">
                    <span>
                      Reward
                    </span>

                    <b>
                      {money(
                        opponent.cashReward ?? 0
                      )}
                    </b>
                  </div>

                  <div className="data-row">
                    <span>
                      Win Chance
                    </span>

                    <b>
                      {winChance}%
                    </b>
                  </div>
                </div>

                <Button
                  disabled={
                    incapacitated ||
                    noEnergy
                  }
                  onClick={() =>
                    g.attack(
                      opponent
                    )
                  }
                >
                  {incapacitated
                    ? "Unavailable"
                    : noEnergy
                    ? "Need 10 ⚡"
                    : "Attack (10 ⚡)"}
                </Button>
              </div>
            );
          }
        )}
      </div>
    </Panel>
  );
}

/* =========================================================
   COMBAT DEFEAT
========================================================= */

function setGameStateForCombatDefeat(
  g: Game,
  opponentName: string
) {
  const hospitalUntil =
    Date.now() +
    HOSPITAL_MINUTES * 60_000;

  g.setGameState(
    (previous) => {
      const activity = {
        id:
          Date.now() +
          Math.random(),

        text:
          "COMBAT LOSS: Knocked out and hospitalized.",

        type: "failure" as const,

        time: Date.now(),
      };

      return {
        ...previous,

        health: 0,

        fightsLost:
          previous.fightsLost + 1,

        hospitalUntil,
        hospitalStartedAt: Date.now(),
        hospitalReason: `Combat defeat vs ${opponentName}`,
        hospitalDurationMs: HOSPITAL_MINUTES * 60_000,
        currentLocation: "hospital",
        locationsVisited: previous.locationsVisited.includes("hospital")
          ? previous.locationsVisited
          : [...previous.locationsVisited, "hospital"],

        activities: [
          activity,
          ...previous.activities,
        ].slice(0, 60),
      };
    }
  );

  g.setCombatOpponent(null);
  g.setCombatStarted(false);
  g.setCurrentScreen("hospital");
}
