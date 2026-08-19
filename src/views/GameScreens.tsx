import React, { useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";

import { InteractiveCombatView } from "./Combat";

import {
  CRIMES,
  crimeSuccessChance,
  crimeUnlocked,
  getCrimeStatBonus,
} from "../systems/crimeSystem";

import {
  DEFAULT_WEAPONS,
  calculateWinChance,
} from "../systems/combatSystem";

import {
  GYMS,
  TRAINING_STATS,
  gymUnlocked,
  canTrainStat,
} from "../systems/gymSystem";

import {
  EDUCATION,
  ITEMS,
  JOBS,
  MISSIONS,
  PROPERTIES,
  getProperty,
} from "../data/gameData";

import { PLAYER_PROFILES } from "../data/playerProfiles";

import {
  money,
  MAX_ENERGY,
  HOSPITAL_MINUTES,
} from "../core/gameCore";

import type { SaveData } from "../types/riftCity";

type Game = ReturnType<typeof useRiftCity>;

/* =========================================================
   SHARED UI
========================================================= */

export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="card-header">
        <h3>{title}</h3>
      </div>

      <div className="card-body">
        {children}
      </div>
    </section>
  );
}

export function Button({
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
      type="button"
      className={`btn-primary ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* =========================================================
   CHARACTER
========================================================= */

export function Character({
  g,
}: {
  g: Game;
}) {
  const [amount, setAmount] = useState("100");

  const n = Math.max(0, Number(amount) || 0);

  const happinessMax =
    getProperty(g.gameState.ownedProperty)?.maxHappiness ??
    100;

  return (
    <div className="ui-grid two-col">
      <Panel title="Combat Stats">
        <div className="stats-list">
          {Object.entries(g.gameState.stats).map(
            ([key, value]) => (
              <div
                className="stat-row"
                key={key}
              >
                <span className="stat-name">
                  {key}
                </span>

                <strong className="stat-val">
                  {(value as number).toFixed(2)}
                </strong>
              </div>
            )
          )}
        </div>
      </Panel>

      <Panel title="Core Resources">
        <div className="data-list">
          <div className="data-row">
            <span>❤️ Health</span>
            <b>
              {Math.floor(g.gameState.health)} /{" "}
              {g.maxHealth}
            </b>
          </div>

          <div className="data-row">
            <span>⚡ Energy</span>
            <b>
              {g.gameState.energy} / {MAX_ENERGY}
            </b>
          </div>

          <div className="data-row">
            <span>🧠 Nerve</span>
            <b>
              {g.gameState.nerve} / {g.maxNerve}
            </b>
          </div>

          <div className="data-row">
            <span>😊 Happiness</span>
            <b>
              {Math.floor(g.gameState.happiness)} /{" "}
              {happinessMax}
            </b>
          </div>
        </div>
      </Panel>

      <Panel title="Progress Overview">
        <div className="data-list">
          <div className="data-row">
            <span>Crime Experience</span>
            <b>
              {g.gameState.crimeExperience}
            </b>
          </div>

          <div className="data-row">
            <span>Gym Experience</span>
            <b>
              {g.gameState.gymExperience}
            </b>
          </div>

          <div className="data-row">
            <span>Crimes Completed</span>
            <b>
              {g.gameState.crimesCompleted} /{" "}
              {g.gameState.crimesFailed} failed
            </b>
          </div>

          <div className="data-row">
            <span>Fight Record</span>
            <b>
              {g.gameState.fightsWon}W /{" "}
              {g.gameState.fightsLost}L
            </b>
          </div>

          <div className="data-row">
            <span>Attacks</span>
            <b>
              {g.gameState.attacks}
            </b>
          </div>
        </div>
      </Panel>

      <Panel title="Bank Vault">
        <div className="bank-control">
          <h2 className="bank-balance">
            {money(g.gameState.bank)}
          </h2>

          <div className="input-group">
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
            />

            <div className="btn-group">
              <Button
                disabled={n <= 0}
                onClick={() =>
                  g.bankDeposit(n)
                }
              >
                Deposit
              </Button>

              <Button
                disabled={n <= 0}
                onClick={() =>
                  g.bankWithdraw(n)
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

/* =========================================================
   CITY
   RIFTCITY — TRUE CITY GRID
========================================================= */

type CityLocation = {
  id: string;
  name: string;
  icon: string;
  description: string;
  district: string;
  screen:
    | "character"
    | "gym"
    | "items"
    | "jobs"
    | "education"
    | "crimes"
    | "combat"
    | "missions"
    | "property"
    | "market";
  x: string;
  y: string;
};

/*
 * The city is intentionally arranged as a simple street grid.
 *
 * NORTH
 * ─────────────────────────────────
 * Hospital       Bank        University
 *
 * ─────────────────────────────────
 * Homes          Central Park      Jobs
 *
 * ─────────────────────────────────
 * Gym            Downtown          Shops
 *
 * ─────────────────────────────────
 * Underground    Combat            Market
 *
 * ─────────────────────────────────
 *             Rift River
 *
 * This makes navigation intuitive while still looking
 * like a real city rather than a collection of buttons.
 */

const CITY_LOCATIONS: CityLocation[] = [
  {
    id: "hospital",
    name: "RiftCity Hospital",
    icon: "🏥",
    description:
      "Medical treatment and recovery after serious injuries.",
    district: "Medical District",
    screen: "character",
    x: "17%",
    y: "18%",
  },

  {
    id: "bank",
    name: "RiftCity Bank",
    icon: "🏦",
    description:
      "Store your cash safely and manage your bank balance.",
    district: "Financial District",
    screen: "character",
    x: "50%",
    y: "18%",
  },

  {
    id: "university",
    name: "Rift University",
    icon: "🎓",
    description:
      "Take courses and improve your character.",
    district: "University District",
    screen: "education",
    x: "83%",
    y: "18%",
  },

  {
    id: "property",
    name: "RiftCity Homes",
    icon: "🏠",
    description:
      "Browse properties and purchase a better home.",
    district: "Residential District",
    screen: "property",
    x: "17%",
    y: "39%",
  },

  {
    id: "park",
    name: "Central Park",
    icon: "🌳",
    description:
      "The central green space of RiftCity.",
    district: "Central District",
    screen: "character",
    x: "50%",
    y: "39%",
  },

  {
    id: "jobs",
    name: "Employment Center",
    icon: "💼",
    description:
      "Find work and build your career.",
    district: "Business District",
    screen: "jobs",
    x: "83%",
    y: "39%",
  },

  {
    id: "gym",
    name: "Rift Fitness",
    icon: "🏋️",
    description:
      "Train your physical combat statistics.",
    district: "Industrial District",
    screen: "gym",
    x: "17%",
    y: "62%",
  },

  {
    id: "downtown",
    name: "Downtown",
    icon: "📍",
    description:
      "The heart of RiftCity.",
    district: "Downtown",
    screen: "character",
    x: "50%",
    y: "62%",
  },

  {
    id: "shops",
    name: "RiftCity Shops",
    icon: "🛒",
    description:
      "Weapons, equipment, consumables and supplies.",
    district: "Commercial District",
    screen: "items",
    x: "83%",
    y: "62%",
  },

  {
    id: "crime",
    name: "The Underground",
    icon: "🕵️",
    description:
      "Commit crimes and build criminal experience.",
    district: "Underground District",
    screen: "crimes",
    x: "17%",
    y: "82%",
  },

  {
    id: "combat",
    name: "Combat District",
    icon: "⚔️",
    description:
      "Challenge other players to combat.",
    district: "Combat District",
    screen: "combat",
    x: "50%",
    y: "82%",
  },

  {
    id: "market",
    name: "RiftCity Market",
    icon: "📈",
    description:
      "Trade commodities at dynamic prices.",
    district: "Market District",
    screen: "market",
    x: "83%",
    y: "82%",
  },
];

export function City({
  g,
}: {
  g: Game;
}) {
  const incapacitated =
    Boolean(
      g.gameState.jailUntil ||
      g.gameState.hospitalUntil
    );

  const hospitalized =
    Boolean(g.gameState.hospitalUntil);

  const jailed =
    Boolean(g.gameState.jailUntil);

  const goTo = (
    screen: CityLocation["screen"]
  ) => {
    if (incapacitated) {
      return;
    }

    g.setCurrentScreen(screen);
  };

  return (
    <div className="city-page">

      {/* =====================================================
          CITY HEADER
      ===================================================== */}

      <div className="city-header card">
        <div>
          <span className="card-tag">
            RIFTCITY
          </span>

          <h2>
            The City
          </h2>

          <p>
            Navigate RiftCity by district. Every major
            service has its own place in the city.
          </p>
        </div>

        <div className="city-status">
          <div className="city-status-item">
            <span>💵 Cash</span>
            <strong>
              {money(g.gameState.cash)}
            </strong>
          </div>

          <div className="city-status-item">
            <span>🏦 Bank</span>
            <strong>
              {money(g.gameState.bank)}
            </strong>
          </div>

          <div className="city-status-item">
            <span>⚡ Energy</span>
            <strong>
              {g.gameState.energy}/{MAX_ENERGY}
            </strong>
          </div>
        </div>
      </div>

      {/* =====================================================
          INCAPACITATED NOTICE
      ===================================================== */}

      {incapacitated && (
        <div
          className={`city-incapacitated ${
            hospitalized
              ? "hospitalized"
              : jailed
              ? "jailed"
              : ""
          }`}
        >
          <span>
            {hospitalized
              ? "🏥"
              : "🚔"}
          </span>

          <div>
            <strong>
              {hospitalized
                ? "You are hospitalized"
                : "You are in jail"}
            </strong>

            <p>
              You cannot access city activities
              until your current timer expires.
            </p>
          </div>
        </div>
      )}

      {/* =====================================================
          CITY MAP
      ===================================================== */}

      <section className="city-map-panel card">

        <div className="city-map-header">
          <div>
            <span className="card-tag">
              CITY MAP
            </span>

            <h3>
              RiftCity
            </h3>

            <p className="city-map-subtitle">
              Northside · Downtown · Southside
            </p>
          </div>

          <span className="city-map-live">
            ● LIVE CITY
          </span>
        </div>

        <div className="riftcity-map">

          {/* =================================================
              WATER / RIVER
          ================================================= */}

          <div className="city-river">
            <span>
              RIFT RIVER
            </span>
          </div>

          {/* =================================================
              CITY BLOCKS
          ================================================= */}

          <div className="city-block city-block-1" />
          <div className="city-block city-block-2" />
          <div className="city-block city-block-3" />
          <div className="city-block city-block-4" />
          <div className="city-block city-block-5" />
          <div className="city-block city-block-6" />
          <div className="city-block city-block-7" />
          <div className="city-block city-block-8" />
          <div className="city-block city-block-9" />

          {/* =================================================
              ROADS
          ================================================= */}

          <div className="city-road city-road-horizontal city-road-1">
            <span>1ST AVENUE</span>
          </div>

          <div className="city-road city-road-horizontal city-road-2">
            <span>CENTRAL AVENUE</span>
          </div>

          <div className="city-road city-road-horizontal city-road-3">
            <span>RIVERSIDE AVENUE</span>
          </div>

          <div className="city-road city-road-vertical city-road-v1">
            <span>NORTH STREET</span>
          </div>

          <div className="city-road city-road-vertical city-road-v2">
            <span>MAIN STREET</span>
          </div>

          <div className="city-road city-road-vertical city-road-v3">
            <span>EAST STREET</span>
          </div>

          {/* =================================================
              CENTRAL PARK
          ================================================= */}

          <div className="city-park">
            <div className="city-park-trees">
              🌳 🌲 🌳
            </div>

            <strong>
              CENTRAL PARK
            </strong>

            <small>
              RIFTCITY
            </small>
          </div>

          {/* =================================================
              BUILDINGS / LOCATIONS
          ================================================= */}

          {CITY_LOCATIONS.map(
            (location) => (
              <button
                key={location.id}
                type="button"
                className={`city-map-location city-map-location-${location.id}`}
                style={{
                  left: location.x,
                  top: location.y,
                }}
                disabled={incapacitated}
                onClick={() =>
                  goTo(location.screen)
                }
              >
                <span className="city-map-icon">
                  {location.icon}
                </span>

                <span className="city-map-name">
                  {location.name}
                </span>

                <span className="city-map-district">
                  {location.district}
                </span>
              </button>
            )
          )}

          {/* =================================================
              CITY CENTER
          ================================================= */}

          <div className="city-center-marker">
            <span>📍</span>

            <strong>
              RIFTCITY
            </strong>

            <small>
              DOWNTOWN
            </small>
          </div>

          {/* =================================================
              NORTH / SOUTH LABELS
          ================================================= */}

          <div className="city-map-direction city-map-north">
            N
          </div>

          <div className="city-map-direction city-map-south">
            S
          </div>

          <div className="city-map-direction city-map-west">
            W
          </div>

          <div className="city-map-direction city-map-east">
            E
          </div>
        </div>

        {/* =================================================
            MAP LEGEND
        ================================================= */}

        <div className="city-map-legend">

          <div className="city-map-legend-item">
            <span>🏦</span>
            <small>Financial</small>
          </div>

          <div className="city-map-legend-item">
            <span>🏥</span>
            <small>Medical</small>
          </div>

          <div className="city-map-legend-item">
            <span>🛒</span>
            <small>Shopping</small>
          </div>

          <div className="city-map-legend-item">
            <span>💼</span>
            <small>Business</small>
          </div>

          <div className="city-map-legend-item">
            <span>🏋️</span>
            <small>Fitness</small>
          </div>

          <div className="city-map-legend-item">
            <span>🕵️</span>
            <small>Underground</small>
          </div>

          <div className="city-map-legend-item">
            <span>⚔️</span>
            <small>Combat</small>
          </div>

        </div>
      </section>

      {/* =====================================================
          DISTRICTS
      ===================================================== */}

      <section className="city-districts">

        <div className="city-section-heading">
          <div>
            <span className="card-tag">
              DISTRICTS
            </span>

            <h3>
              Explore RiftCity
            </h3>
          </div>
        </div>

        <div className="city-district-grid">

          <button
            type="button"
            className="city-district-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("character")
            }
          >
            <span className="city-district-icon">
              🏦
            </span>

            <div>
              <strong>
                Financial District
              </strong>

              <p>
                Bank and financial services.
              </p>
            </div>

            <span>→</span>
          </button>

          <button
            type="button"
            className="city-district-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("education")
            }
          >
            <span className="city-district-icon">
              🎓
            </span>

            <div>
              <strong>
                University District
              </strong>

              <p>
                Education and training.
              </p>
            </div>

            <span>→</span>
          </button>

          <button
            type="button"
            className="city-district-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("items")
            }
          >
            <span className="city-district-icon">
              🛒
            </span>

            <div>
              <strong>
                Commercial District
              </strong>

              <p>
                Shops, weapons and equipment.
              </p>
            </div>

            <span>→</span>
          </button>

          <button
            type="button"
            className="city-district-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("jobs")
            }
          >
            <span className="city-district-icon">
              💼
            </span>

            <div>
              <strong>
                Business District
              </strong>

              <p>
                Employment and careers.
              </p>
            </div>

            <span>→</span>
          </button>

          <button
            type="button"
            className="city-district-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("gym")
            }
          >
            <span className="city-district-icon">
              🏋️
            </span>

            <div>
              <strong>
                Industrial District
              </strong>

              <p>
                Fitness and physical training.
              </p>
            </div>

            <span>→</span>
          </button>

          <button
            type="button"
            className="city-district-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("combat")
            }
          >
            <span className="city-district-icon">
              ⚔️
            </span>

            <div>
              <strong>
                Combat District
              </strong>

              <p>
                Find opponents and fight.
              </p>
            </div>

            <span>→</span>
          </button>

          <button
            type="button"
            className="city-district-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("crimes")
            }
          >
            <span className="city-district-icon">
              🕵️
            </span>

            <div>
              <strong>
                Underground District
              </strong>

              <p>
                Crime and criminal activity.
              </p>
            </div>

            <span>→</span>
          </button>

          <button
            type="button"
            className="city-district-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("market")
            }
          >
            <span className="city-district-icon">
              📈
            </span>

            <div>
              <strong>
                Market District
              </strong>

              <p>
                Trade commodities and goods.
              </p>
            </div>

            <span>→</span>
          </button>

        </div>
      </section>

      {/* =====================================================
          CITY SERVICES
      ===================================================== */}

      <section className="city-services">

        <div className="city-section-heading">
          <div>
            <span className="card-tag">
              CITY SERVICES
            </span>

            <h3>
              What do you want to do?
            </h3>
          </div>
        </div>

        <div className="city-service-grid">

          {/* BANK */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("character")
            }
          >
            <span className="city-service-icon">
              🏦
            </span>

            <div>
              <strong>
                Bank
              </strong>

              <p>
                Manage your bank account.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* HOSPITAL */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("character")
            }
          >
            <span className="city-service-icon">
              🏥
            </span>

            <div>
              <strong>
                Hospital
              </strong>

              <p>
                Medical treatment and recovery.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* GYM */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("gym")
            }
          >
            <span className="city-service-icon">
              🏋️
            </span>

            <div>
              <strong>
                Gym
              </strong>

              <p>
                Train your combat statistics.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* SHOPS */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("items")
            }
          >
            <span className="city-service-icon">
              🛒
            </span>

            <div>
              <strong>
                Shops
              </strong>

              <p>
                Weapons, equipment and supplies.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* JOBS */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("jobs")
            }
          >
            <span className="city-service-icon">
              💼
            </span>

            <div>
              <strong>
                Jobs
              </strong>

              <p>
                Find employment and earn money.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* EDUCATION */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("education")
            }
          >
            <span className="city-service-icon">
              🎓
            </span>

            <div>
              <strong>
                University
              </strong>

              <p>
                Study courses and improve yourself.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* CRIMES */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("crimes")
            }
          >
            <span className="city-service-icon">
              🕵️
            </span>

            <div>
              <strong>
                Underground
              </strong>

              <p>
                Commit crimes and build experience.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* COMBAT */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("combat")
            }
          >
            <span className="city-service-icon">
              ⚔️
            </span>

            <div>
              <strong>
                Combat
              </strong>

              <p>
                Attack another player.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* MARKET */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("market")
            }
          >
            <span className="city-service-icon">
              📈
            </span>

            <div>
              <strong>
                Market
              </strong>

              <p>
                Buy and sell commodities.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* PROPERTY */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("property")
            }
          >
            <span className="city-service-icon">
              🏠
            </span>

            <div>
              <strong>
                Real Estate
              </strong>

              <p>
                Buy a better property.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>

          {/* MISSIONS */}

          <button
            type="button"
            className="city-service-card"
            disabled={incapacitated}
            onClick={() =>
              goTo("missions")
            }
          >
            <span className="city-service-icon">
              📋
            </span>

            <div>
              <strong>
                Missions
              </strong>

              <p>
                Complete objectives and collect rewards.
              </p>
            </div>

            <span className="city-service-arrow">
              →
            </span>
          </button>
        </div>
      </section>

      {/* =====================================================
          QUICK ACTIONS
      ===================================================== */}

      <Panel title="Quick Actions">
        <div className="ui-grid three-col">

          <Button
            disabled={incapacitated}
            onClick={() =>
              goTo("character")
            }
          >
            👤 Character
          </Button>

          <Button
            disabled={incapacitated}
            onClick={() =>
              goTo("combat")
            }
          >
            ⚔️ Find a Fight
          </Button>

          <Button
            disabled={incapacitated}
            onClick={() =>
              goTo("crimes")
            }
          >
            🕵️ Commit a Crime
          </Button>

        </div>
      </Panel>
    </div>
  );
}

/* =========================================================
   CRIMES
========================================================= */

export function Crimes({
  g,
}: {
  g: Game;
}) {
  const incapacitated =
    Boolean(
      g.gameState.jailUntil ||
      g.gameState.hospitalUntil
    );

  return (
    <div className="ui-grid two-col">
      {CRIMES.map((crime) => {
        const chance = crimeSuccessChance(
          crime,
          g.gameState.crimeExperience,
          1,
          getCrimeStatBonus(
            g.gameState.stats
          )
        );

        const unlocked = crimeUnlocked(
          crime,
          g.gameState.crimeExperience
        );

        const enoughNerve =
          g.gameState.nerve >= crime.nerve;

        const canCommit =
          unlocked &&
          enoughNerve &&
          !incapacitated;

        return (
          <div
            className={`card crime-card ${
              unlocked ? "" : "disabled"
            }`}
            key={crime.id}
          >
            <div className="card-header-split">
              <span className="card-tag">
                NERVE {crime.nerve}
              </span>

              <span className="chance-badge">
                {unlocked
                  ? `${chance.toFixed(0)}% Success`
                  : `Requires CE ${crime.crimeExperienceRequired}`}
              </span>
            </div>

            <h3>{crime.name}</h3>

            <p>{crime.description}</p>

            <div className="bar-track">
              <div
                className="bar-fill crime"
                style={{
                  width: `${
                    unlocked
                      ? Math.min(100, chance)
                      : 0
                  }%`,
                }}
              />
            </div>

            {!enoughNerve && unlocked && (
              <p className="status-text">
                Requires {crime.nerve} nerve.
              </p>
            )}

            <Button
              disabled={!canCommit}
              onClick={() =>
                g.commitCrime(crime)
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

/* =========================================================
   COMBAT
========================================================= */

export function Combat({
  g,
}: {
  g: Game;
}) {
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
          stats: g.gameState.stats,
          weapons: DEFAULT_WEAPONS,
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
          } else if (outcome === "leave") {
            xpEarned = Math.floor(
              baseXp * 0.25
            );
          }

          g.setGameState((previous) => {
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

            const description = isVictory
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
          });

          g.setCombatOpponent(null);
          g.setCombatStarted(false);
          g.setCurrentScreen("combat");
        }}
        onDefeat={() =>
          setGameStateForCombatDefeat(g)
        }
      />
    );
  }

  const incapacitated =
    Boolean(
      g.gameState.jailUntil ||
      g.gameState.hospitalUntil
    );

  const noEnergy =
    g.gameState.energy < 10;

  return (
    <Panel title="Available Targets">
      <div className="ui-grid two-col">
        {PLAYER_PROFILES.map((opponent) => {
          const winChance =
            calculateWinChance(
              g.gameState.stats,
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

              <h3>{opponent.name}</h3>

              <p>
                {opponent.title} ·{" "}
                {opponent.location}
              </p>

              <div className="data-list">
                <div className="data-row">
                  <span>Health</span>

                  <b>
                    {opponent.health}/
                    {opponent.maxHealth}
                  </b>
                </div>

                <div className="data-row">
                  <span>Reward</span>

                  <b>
                    {money(
                      opponent.cashReward
                    )}
                  </b>
                </div>

                <div className="data-row">
                  <span>Win Chance</span>

                  <b>{winChance}%</b>
                </div>
              </div>

              <Button
                disabled={
                  incapacitated ||
                  noEnergy
                }
                onClick={() =>
                  g.attack(opponent)
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
        })}
      </div>
    </Panel>
  );
}

/* =========================================================
   COMBAT DEFEAT
========================================================= */

function setGameStateForCombatDefeat(
  g: Game
) {
  const hospitalUntil =
    Date.now() +
    HOSPITAL_MINUTES * 60_000;

  g.setGameState((previous) => {
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

      activities: [
        activity,
        ...previous.activities,
      ].slice(0, 60),
    };
  });

  g.setCombatOpponent(null);
  g.setCombatStarted(false);
  g.setCurrentScreen("city");
}

/* =========================================================
   GYM
========================================================= */

export function GymView({
  g,
}: {
  g: Game;
}) {
  const availableGyms = GYMS.filter(
    (gym) => !gym.jailOnly
  );

  const incapacitated =
    Boolean(
      g.gameState.jailUntil ||
      g.gameState.hospitalUntil
    );

  return (
    <>
      <div className="gym-selector">
        {availableGyms.map((gym) => {
          const unlocked =
            gymUnlocked(
              gym,
              g.gameState.gymExperience
            );

          const active =
            g.gym.id === gym.id;

          return (
            <button
              type="button"
              key={gym.id}
              className={`gym-btn ${
                active ? "active" : ""
              }`}
              disabled={
                !unlocked ||
                incapacitated
              }
              onClick={() =>
                g.buyGym(gym.id)
              }
            >
              <span>
                {gym.name}
              </span>

              <small>
                {unlocked
                  ? money(
                      gym.membershipCost
                    )
                  : `EXP ${gym.gymExpRequired}`}
              </small>
            </button>
          );
        })}
      </div>

      <Panel
        title={`${g.gym.name} · (${g.gym.energyCost} Energy per set)`}
      >
        <div className="ui-grid four-col">
          {TRAINING_STATS.map((stat) => {
            const allowed =
              canTrainStat(
                g.gym,
                stat.id
              );

            const enoughEnergy =
              g.gameState.energy >=
              g.gym.energyCost;

            const canTrain =
              allowed &&
              enoughEnergy &&
              !incapacitated;

            return (
              <div
                className="card train-card"
                key={stat.id}
              >
                <span className="train-icon">
                  {stat.icon}
                </span>

                <h3>{stat.name}</h3>

                <p>
                  {stat.description}
                </p>

                <Button
                  disabled={!canTrain}
                  onClick={() =>
                    g.train(stat.id)
                  }
                >
                  {!allowed
                    ? "Not Available"
                    : !enoughEnergy
                    ? `Need ${g.gym.energyCost} ⚡`
                    : incapacitated
                    ? "Unavailable"
                    : "Train"}
                </Button>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

/* =========================================================
   JOBS
========================================================= */

export function Jobs({
  g,
}: {
  g: Game;
}) {
  return (
    <div className="ui-grid two-col">
      {JOBS.map((job) => {
        const current =
          g.gameState.currentJob ===
          job.id;

        return (
          <div
            className="card job-card"
            key={job.id}
          >
            <span className="card-tag">
              {job.company}
            </span>

            <h3>{job.title}</h3>

            <p>
              {job.description}
            </p>

            <div className="data-row">
              <span>
                Hourly Salary
              </span>

              <b>
                {money(job.salary)}
              </b>
            </div>

            <Button
              disabled={current}
              onClick={() =>
                g.joinJob(job.id)
              }
            >
              {current
                ? "Current Position"
                : "Apply Now"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   ITEMS
========================================================= */

export function Items({
  g,
}: {
  g: Game;
}) {
  return (
    <div className="ui-grid three-col">
      {ITEMS.map((item) => {
        const owned =
          g.gameState.inventory[
            item.id
          ] || 0;

        const equippable =
          item.type === "weapon" ||
          item.type === "armor";

        return (
          <div
            className="card item-card"
            key={item.id}
          >
            <span className="card-tag">
              {item.type.toUpperCase()}
            </span>

            <h3>{item.name}</h3>

            <p>
              {item.description}
            </p>

            <strong className="item-price">
              {money(item.price)}
            </strong>

            <div className="btn-group">
              <Button
                onClick={() =>
                  g.buyItem(item.id)
                }
              >
                Buy
              </Button>

              {owned > 0 && (
                <Button
                  onClick={() => {
                    if (equippable) {
                      g.equip(item.id);
                    } else {
                      g.useItem(item.id);
                    }
                  }}
                >
                  {equippable
                    ? "Equip"
                    : "Use"}
                </Button>
              )}
            </div>

            <span className="item-count">
              Owned: {owned}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   MISSIONS
========================================================= */

export function Missions({
  g,
}: {
  g: Game;
}) {
  return (
    <div className="ui-grid two-col">
      {MISSIONS.map((mission) => {
        const progress =
          g.missionProgress(
            mission
          );

        const completed =
          g.gameState.completedMissions.includes(
            mission.id
          );

        const percent =
          mission.target > 0
            ? Math.min(
                100,
                (progress /
                  mission.target) *
                  100
              )
            : 100;

        const canClaim =
          !completed &&
          progress >= mission.target;

        return (
          <div
            className="card mission-card"
            key={mission.id}
          >
            <span className="card-tag">
              MISSION
            </span>

            <h3>{mission.name}</h3>

            <p>
              {mission.description}
            </p>

            <div className="bar-track">
              <div
                className="bar-fill mission"
                style={{
                  width: `${percent}%`,
                }}
              />
            </div>

            <div className="data-row">
              <span>Progress</span>

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
              disabled={!canClaim}
              onClick={() =>
                g.claimMission(
                  mission.id
                )
              }
            >
              {completed
                ? "Claimed"
                : canClaim
                ? "Claim Reward"
                : "In Progress"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   EDUCATION
========================================================= */

export function Education({
  g,
}: {
  g: Game;
}) {
  return (
    <>
      <Panel title="Active Course Status">
        {g.education ? (
          <div className="course-active">
            <h3>
              {g.education.name}
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
            No course currently active.
          </p>
        )}
      </Panel>

      <div className="ui-grid two-col">
        {EDUCATION.map((course) => {
          const completed =
            g.gameState.educationCompleted.includes(
              course.id
            );

          const active =
            Boolean(g.education);

          const affordable =
            g.gameState.cash >=
            course.cost;

          return (
            <div
              className="card course-card"
              key={course.id}
            >
              <h3>{course.name}</h3>

              <p>
                {course.description}
              </p>

              <div className="data-list">
                <div className="data-row">
                  <span>Cost</span>

                  <b>
                    {money(course.cost)}
                  </b>
                </div>

                <div className="data-row">
                  <span>Time</span>

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
                  completed ||
                  active ||
                  !affordable
                }
                onClick={() =>
                  g.startEducation(
                    course.id
                  )
                }
              >
                {completed
                  ? "Completed"
                  : active
                  ? "Course Active"
                  : !affordable
                  ? "Not Enough Cash"
                  : "Enroll"}
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* =========================================================
   PROPERTY
========================================================= */

export function PropertyView({
  g,
}: {
  g: Game;
}) {
  const currentProperty =
    getProperty(
      g.gameState.ownedProperty
    );

  const currentPrice =
    currentProperty?.price || 0;

  return (
    <div className="ui-grid two-col">
      {PROPERTIES.map((property) => {
        const current =
          g.gameState.ownedProperty ===
          property.id;

        const cheaper =
          property.price <
          currentPrice;

        const affordable =
          g.gameState.cash >=
          property.price;

        const unavailable =
          cheaper ||
          current ||
          !affordable;

        return (
          <div
            className={`card property-card ${
              cheaper ? "disabled" : ""
            }`}
            key={property.id}
          >
            <span className="card-tag">
              REAL ESTATE
            </span>

            <h3>{property.name}</h3>

            <p>
              {property.description}
            </p>

            <div className="data-list">
              <div className="data-row">
                <span>Price</span>

                <b>
                  {money(property.price)}
                </b>
              </div>

              <div className="data-row">
                <span>Health Bonus</span>

                <b>
                  +{property.maxHealthBonus}
                </b>
              </div>

              <div className="data-row">
                <span>Nerve Bonus</span>

                <b>
                  +{property.nerveBonus}
                </b>
              </div>

              <div className="data-row">
                <span>Happiness</span>

                <b>
                  {property.maxHappiness}
                </b>
              </div>
            </div>

            <Button
              disabled={unavailable}
              onClick={() =>
                g.buyProperty(
                  property.id
                )
              }
            >
              {current
                ? "Current Residence"
                : cheaper
                ? "Already Owned"
                : !affordable
                ? "Not Enough Cash"
                : "Purchase"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   MARKET
========================================================= */

export function Market({
  g,
}: {
  g: Game;
}) {
  const goods = Object.keys(
    g.gameState.market
  );

  return (
    <Panel title="Dynamic Commodities Market">
      <div className="ui-grid four-col">
        {goods.map((id) => {
          const price =
            g.gameState.market[id];

          const owned =
            g.gameState.inventory[id] ||
            0;

          return (
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
                {money(price)}
              </p>

              <span className="item-count">
                Owned: {owned}
              </span>

              <div className="btn-group">
                <Button
                  disabled={
                    g.gameState.cash <
                    price
                  }
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
                  disabled={owned <= 0}
                  onClick={() =>
                    g.tradeMarket(
                      id,
                      false
                    )
                  }
                >
                  Sell
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* =========================================================
   FACTIONS
========================================================= */

export function Faction({
  g,
}: {
  g: Game;
}) {
  const factions = [
    "Iron Syndicate",
    "Rift Guard",
    "Dock Union",
  ];

  const currentFaction =
    g.gameState.faction;

  return (
    <Panel title="Faction Headquarters">
      <div className="ui-grid three-col">
        {factions.map((faction) => {
          const member =
            currentFaction === faction;

          const otherFaction =
            Boolean(currentFaction) &&
            currentFaction !==
              faction;

          return (
            <div
              className={`card faction-card ${
                otherFaction
                  ? "disabled"
                  : ""
              }`}
              key={faction}
            >
              <h3>{faction}</h3>

              <p>
                {member
                  ? `Reputation: ${g.gameState.factionReputation}`
                  : "Entry Fee: $500"}
              </p>

              <Button
                disabled={
                  otherFaction ||
                  member
                }
                onClick={() =>
                  g.joinFaction(
                    faction
                  )
                }
              >
                {member
                  ? "Member"
                  : "Join Faction"}
              </Button>
            </div>
          );
        })}
      </div>

      {currentFaction && (
        <div
          style={{
            marginTop: "16px",
          }}
        >
          <Button
            disabled={
              g.gameState.energy < 10
            }
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

/* =========================================================
   AWARDS
========================================================= */

export function Awards({
  g,
}: {
  g: Game;
}) {
  const awards: [string, boolean][] = [
    [
      "First Crime",
      g.gameState.crimesCompleted >= 1,
    ],

    [
      "Ten Crimes",
      g.gameState.crimesCompleted >= 10,
    ],

    [
      "First Victory",
      g.gameState.fightsWon >= 1,
    ],

    [
      "Gym Rat",
      g.gameState.gymSessions >= 10,
    ],

    [
      "Five Figures",
      g.gameState.cash >= 100000,
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
          {awards.map(([name, unlocked]) => {
            const claimed =
              g.gameState.achievements.includes(
                name
              );

            return (
              <div
                className={`card achievement-card ${
                  unlocked
                    ? "unlocked"
                    : "locked"
                }`}
                key={name}
              >
                <h3>{name}</h3>

                <span className="status-text">
                  {claimed
                    ? "Claimed"
                    : unlocked
                    ? "Unlocked"
                    : "Locked"}
                </span>

                {unlocked &&
                  !claimed && (
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
            );
          })}
        </div>
      </Panel>

      <Panel title="Daily Rewards">
        <Button
          onClick={g.claimDaily}
        >
          Claim Daily Bonus
        </Button>
      </Panel>
    </>
  );
}
