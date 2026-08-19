import React, { useEffect, useState } from "react";
import { useRiftCity } from "../hooks/useRiftCity";
import {
  ENERGY_REGEN_INTERVAL, MAX_ENERGY, NERVE_REGEN_INTERVAL, HAPPINESS_TICK, money, formatTime, timeLeft,
} from "../core/gameCore";
import { getLevel } from "../systems/progressionSystem";
import { getProperty } from "../data/gameData";
import type { ActiveModal, Screen } from "../types/riftCity";
import {
  Panel, Button, Character, City, Crimes, Combat, GymView, Jobs, Items,
  Missions, Education, PropertyView, Market, Faction, Awards,
} from "../views/GameScreens";
function App() {
  const g = useRiftCity();

  const levelInfo =
    getLevel(g.gameState.xp);

  const maxHappy =
    getProperty(
      g.gameState.ownedProperty
    )?.maxHappiness ?? 100;

  const [
    activeModal,
    setActiveModal,
  ] = useState<ActiveModal>(null);

  const [now, setNow] =
    useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () =>
      window.clearInterval(timer);
  }, []);

  const energyNextTick =
    g.gameState.energy >= MAX_ENERGY
      ? 0
      : Math.max(
          0,
          ENERGY_REGEN_INTERVAL -
            ((now -
              g.gameState
                .lastEnergyUpdate) %
              ENERGY_REGEN_INTERVAL)
        );

  const nerveNextTick =
    g.gameState.nerve >=
    g.maxNerve
      ? 0
      : Math.max(
          0,
          NERVE_REGEN_INTERVAL -
            ((now -
              g.gameState
                .lastNerveUpdate) %
              NERVE_REGEN_INTERVAL)
        );

  const happyNextTick =
    g.gameState.happiness >=
    maxHappy
      ? 0
      : Math.max(
          0,
          HAPPINESS_TICK -
            ((now -
              g.gameState
                .lastHappinessUpdate) %
              HAPPINESS_TICK)
        );

  const nav: {
    id: Screen;
    label: string;
    icon: string;
  }[] = [
    {
      id: "character",
      label: "Character",
      icon: "👤",
    },
    {
      id: "city",
      label: "City",
      icon: "🏙️",
    },
    {
      id: "crimes",
      label: "Crimes",
      icon: "🕵️",
    },
    {
      id: "combat",
      label: "Combat",
      icon: "⚔️",
    },
    {
      id: "gym",
      label: "Gym",
      icon: "🏋️",
    },
    {
      id: "jobs",
      label: "Jobs",
      icon: "💼",
    },
    {
      id: "items",
      label: "Items",
      icon: "🎒",
    },
    {
      id: "missions",
      label: "Missions",
      icon: "📜",
    },
    {
      id: "education",
      label: "Education",
      icon: "🎓",
    },
    {
      id: "property",
      label: "Property",
      icon: "🏠",
    },
    {
      id: "market",
      label: "Market",
      icon: "📈",
    },
    {
      id: "faction",
      label: "Faction",
      icon: "🛡️",
    },
    {
      id: "awards",
      label: "Awards",
      icon: "🏆",
    },
  ];

  const title =
    nav.find(
      (n) =>
        n.id === g.currentScreen
    )?.label || "RiftCity";

  return (
    <div className="layout-root">
      <aside className="nav-rail">
        <div className="brand">
          <h2>RIFTCITY</h2>

          <span className="badge">
            v2.1
          </span>
        </div>

        <nav className="nav-list">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${
                g.currentScreen === n.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                g.setCurrentScreen(
                  n.id
                )
              }
            >
              <span className="nav-icon">
                {n.icon}
              </span>

              <span className="nav-label">
                {n.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="nav-footer">
          <button
            className="btn-secondary"
            onClick={
              g.randomEncounter
            }
          >
            🎲 Explore
          </button>

          <button
            className="btn-danger-ghost"
            onClick={() => {
              if (
                window.confirm(
                  "Reset save data?"
                )
              ) {
                g.resetGame();
              }
            }}
          >
            ↻ Reset
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header
          className="top-status-bar"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
            }}
          >
            <div
              className="user-level"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                className="level-badge"
                style={{
                  whiteSpace:
                    "nowrap",
                }}
              >
                LV {g.level}
              </span>

              <div
                className="xp-container"
                style={{
                  minWidth: "80px",
                }}
              >
                <div
                  className="xp-text"
                  style={{
                    fontSize: "10px",
                  }}
                >
                  XP{" "}
                  {
                    levelInfo.currentXp
                  }
                  /100
                </div>

                <div
                  className="bar-track compact"
                  style={{
                    height: "4px",
                    background:
                      "#222",
                  }}
                >
                  <div
                    className="bar-fill xp"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          levelInfo.currentXp
                        )
                      )}%`,
                      height: "100%",
                      background:
                        "#3b82f6",
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              className="compact-vitals"
              style={{
                display: "flex",
                flexDirection:
                  "row",
                alignItems:
                  "center",
                gap: "12px",
              }}
            >
              <button
                onClick={() =>
                  setActiveModal(
                    "energy"
                  )
                }
                style={{
                  background:
                    "none",
                  border: "none",
                  color:
                    "inherit",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "2px",
                  padding:
                    "2px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "16px",
                  }}
                >
                  ⚡
                </span>

                <span
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {
                    g.gameState
                      .energy
                  }
                </span>
              </button>

              <button
                onClick={() =>
                  setActiveModal(
                    "nerve"
                  )
                }
                style={{
                  background:
                    "none",
                  border: "none",
                  color:
                    "inherit",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "2px",
                  padding:
                    "2px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "16px",
                  }}
                >
                  🔥
                </span>

                <span
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {
                    g.gameState
                      .nerve
                  }
                </span>
              </button>

              <button
                onClick={() =>
                  setActiveModal(
                    "happy"
                  )
                }
                style={{
                  background:
                    "none",
                  border: "none",
                  color:
                    "inherit",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "2px",
                  padding:
                    "2px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "16px",
                  }}
                >
                  😊
                </span>

                <span
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {Math.floor(
                    g.gameState
                      .happiness
                  )}
                </span>
              </button>

              <button
                onClick={() =>
                  setActiveModal(
                    "health"
                  )
                }
                style={{
                  background:
                    "none",
                  border: "none",
                  color:
                    "inherit",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "2px",
                  padding:
                    "2px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "16px",
                  }}
                >
                  ❤️
                </span>

                <span
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {Math.floor(
                    g.gameState
                      .health
                  )}
                </span>
              </button>
            </div>
          </div>

          <div
            className="currency-bar"
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "12px",
            }}
          >
            <div>
              💵{" "}
              {money(
                g.gameState
                  .cash
              )}
            </div>

            <div>
              🏦{" "}
              {money(
                g.gameState
                  .bank
              )}
            </div>

            <div>
              💎{" "}
              {
                g.gameState
                  .points
              }{" "}
              Pts
            </div>
          </div>
        </header>

        {activeModal && (
          <div
            className="modal-overlay"
            style={{
              position:
                "fixed",
              inset: 0,
              backgroundColor:
                "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              zIndex: 1000,
            }}
            onClick={() =>
              setActiveModal(null)
            }
          >
            <div
              className="modal-card"
              style={{
                background:
                  "#18181b",
                padding:
                  "20px",
                borderRadius:
                  "8px",
                minWidth:
                  "240px",
                border:
                  "1px solid #3f3f46",
                textAlign:
                  "center",
              }}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              {activeModal ===
                "energy" && (
                <>
                  <h2>
                    ⚡ Energy
                  </h2>

                  <p
                    style={{
                      fontSize:
                        "20px",
                      fontWeight:
                        "bold",
                      margin:
                        "12px 0",
                    }}
                  >
                    {
                      g.gameState
                        .energy
                    }{" "}
                    /{" "}
                    {MAX_ENERGY}
                  </p>

                  <p
                    style={{
                      color:
                        "#a1a1aa",
                    }}
                  >
                    {g.gameState
                      .energy >=
                    MAX_ENERGY
                      ? "Fully charged"
                      : `Next +1 tick in: ${formatTime(
                          energyNextTick
                        )}`}
                  </p>
                </>
              )}

              {activeModal ===
                "nerve" && (
                <>
                  <h2>
                    🔥 Nerve
                  </h2>

                  <p
                    style={{
                      fontSize:
                        "20px",
                      fontWeight:
                        "bold",
                      margin:
                        "12px 0",
                    }}
                  >
                    {
                      g.gameState
                        .nerve
                    }{" "}
                    /{" "}
                    {
                      g.maxNerve
                    }
                  </p>

                  <p
                    style={{
                      color:
                        "#a1a1aa",
                    }}
                  >
                    {g.gameState
                      .nerve >=
                    g.maxNerve
                      ? "At capacity"
                      : `Next +1 tick in: ${formatTime(
                          nerveNextTick
                        )}`}
                  </p>
                </>
              )}

              {activeModal ===
                "happy" && (
                <>
                  <h2>
                    😊 Happiness
                  </h2>

                  <p
                    style={{
                      fontSize:
                        "20px",
                      fontWeight:
                        "bold",
                      margin:
                        "12px 0",
                    }}
                  >
                    {Math.floor(
                      g.gameState
                        .happiness
                    )}{" "}
                    /{" "}
                    {maxHappy}
                  </p>

                  <p
                    style={{
                      color:
                        "#a1a1aa",
                    }}
                  >
                    {g.gameState
                      .happiness >=
                    maxHappy
                      ? "Max happiness"
                      : `Next +5 tick in: ${formatTime(
                          happyNextTick
                        )}`}
                  </p>
                </>
              )}

              {activeModal ===
                "health" && (
                <>
                  <h2>
                    ❤️ Health
                  </h2>

                  <p
                    style={{
                      fontSize:
                        "20px",
                      fontWeight:
                        "bold",
                      margin:
                        "12px 0",
                    }}
                  >
                    {Math.floor(
                      g.gameState
                        .health
                    )}{" "}
                    /{" "}
                    {
                      g.maxHealth
                    }
                  </p>

                  <p
                    style={{
                      color:
                        "#a1a1aa",
                    }}
                  >
                    {g.gameState
                      .health >=
                    g.maxHealth
                      ? "Full health"
                      : "Regenerates over time"}
                  </p>
                </>
              )}

              <button
                className="btn-primary"
                style={{
                  marginTop:
                    "16px",
                  width:
                    "100%",
                }}
                onClick={() =>
                  setActiveModal(
                    null
                  )
                }
              >
                Close
              </button>
            </div>
          </div>
        )}

        <main className="screen-container">
          <div className="screen-header">
            <span className="location-tag">
              LOCATION:{" "}
              {g.gameState.currentLocation.toUpperCase()}
            </span>

            <h1>{title}</h1>
          </div>

          {g.gameState
            .jailUntil && (
            <div className="status-alert jail">
              🔒 JAILED ·{" "}
              {formatTime(
                timeLeft(
                  g.gameState
                    .jailUntil
                )
              )}{" "}
              remaining
            </div>
          )}

          {g.gameState
            .hospitalUntil && (
            <div className="status-alert hospital">
              🏥 HOSPITAL ·{" "}
              {formatTime(
                timeLeft(
                  g.gameState
                    .hospitalUntil
                )
              )}{" "}
              remaining
            </div>
          )}

          {g.currentScreen ===
            "character" && (
            <Character g={g} />
          )}

          {g.currentScreen ===
            "city" && (
            <City g={g} />
          )}

          {g.currentScreen ===
            "crimes" && (
            <Crimes g={g} />
          )}

          {g.currentScreen ===
            "combat" && (
            <Combat g={g} />
          )}

          {g.currentScreen ===
            "gym" && (
            <GymView g={g} />
          )}

          {g.currentScreen ===
            "jobs" && (
            <Jobs g={g} />
          )}

          {g.currentScreen ===
            "items" && (
            <Items g={g} />
          )}

          {g.currentScreen ===
            "missions" && (
            <Missions g={g} />
          )}

          {g.currentScreen ===
            "education" && (
            <Education g={g} />
          )}

          {g.currentScreen ===
            "property" && (
            <PropertyView
              g={g}
            />
          )}

          {g.currentScreen ===
            "market" && (
            <Market g={g} />
          )}

          {g.currentScreen ===
            "faction" && (
            <Faction g={g} />
          )}

          {g.currentScreen ===
            "awards" && (
            <Awards g={g} />
          )}

          <section className="card activity-card">
            <div className="card-header">
              <h3>
                Activity Log
              </h3>
            </div>

            <div className="activity-list">
              {g.gameState.activities
                .slice(0, 8)
                .map((a) => (
                  <div
                    className={`activity-item ${a.type}`}
                    key={a.id}
                  >
                    <span className="time">
                      {new Date(
                        a.time
                      ).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute:
                            "2-digit",
                        }
                      )}
                    </span>

                    <span className="type-tag">
                      {a.type.toUpperCase()}
                    </span>

                    <p className="desc">
                      {a.text}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        </main>
      </div>

      {g.encounter && (
        <div className="modal-overlay">
          <div className="modal-card">
            <span className="modal-tag">
              RANDOM ENCOUNTER
            </span>

            <h2>
              {
                g.encounter
                  .title
              }
            </h2>

            <p>
              {
                g.encounter
                  .text
              }
            </p>

            <div className="modal-actions">
              {g.encounter.choices.map(
                (choice, i) => (
                  <button
                    className="btn-primary"
                    key={i}
                    onClick={() =>
                      g.chooseEncounter(
                        choice
                      )
                    }
                  >
                    {
                      choice.label
                    }
                  </button>
                )
              )}

              <button
                className="btn-secondary"
                onClick={() =>
                  g.setEncounter(
                    null
                  )
                }
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default App;
