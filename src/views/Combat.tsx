import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DynamicFighter,
  TurnLog,
  WeaponOption,
  UNARMED_WEAPON,
  resolveEquippedWeapon,
  executeCombatTurn,
} from "../systems/combatSystem";

type FinishOutcome = "leave" | "hospitalize" | "mug";

interface InteractiveCombatViewProps {
  player: DynamicFighter;
  enemy: DynamicFighter;

  onFinish: (
    outcome: FinishOutcome,
    enemy: DynamicFighter,
    finalPlayerHealth: number
  ) => void;

  onDefeat: (finalPlayerHealth: number) => void;
}

export function InteractiveCombatView({
  player,
  enemy,
  onFinish,
  onDefeat,
}: InteractiveCombatViewProps) {
  const [pState, setPState] = useState<DynamicFighter>(player);
  const [eState, setEState] = useState<DynamicFighter>(enemy);

  const [combatLogs, setCombatLogs] = useState<TurnLog[]>([]);
  const [turn, setTurn] = useState<"player" | "enemy">("player");

  const [winner, setWinner] = useState<"player" | "enemy" | null>(null);

  const [processing, setProcessing] = useState(false);
  const [finishSelected, setFinishSelected] = useState(false);

  const enemyTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  /*
   * ------------------------------------------------------------
   * LIFECYCLE SAFETY
   * ------------------------------------------------------------
   */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (enemyTimerRef.current !== null) {
        window.clearTimeout(enemyTimerRef.current);
        enemyTimerRef.current = null;
      }
    };
  }, []);

  /*
   * ------------------------------------------------------------
   * PLAYER EQUIPMENT
   * ------------------------------------------------------------
   *
   * Combat only exposes:
   *
   *   1. Unarmed
   *   2. The weapon actually equipped
   *
   * Inventory ownership alone does not create attack buttons.
   */

  const equippedWeapon = useMemo(
    () => resolveEquippedWeapon(pState),
    [pState]
  );

  const attackOptions = useMemo<WeaponOption[]>(() => {
    const options: WeaponOption[] = [UNARMED_WEAPON];

    if (equippedWeapon.id !== UNARMED_WEAPON.id) {
      options.push(equippedWeapon);
    }

    return options.filter(
      (weapon, index, array) =>
        array.findIndex((other) => other.id === weapon.id) === index
    );
  }, [equippedWeapon]);

  /*
   * ------------------------------------------------------------
   * HEALTH HELPERS
   * ------------------------------------------------------------
   */

  const playerHealthPercent =
    pState.maxHealth > 0
      ? Math.max(
          0,
          Math.min(100, (pState.health / pState.maxHealth) * 100)
        )
      : 0;

  const enemyHealthPercent =
    eState.maxHealth > 0
      ? Math.max(
          0,
          Math.min(100, (eState.health / eState.maxHealth) * 100)
        )
      : 0;

  /*
   * ------------------------------------------------------------
   * LOGGING
   * ------------------------------------------------------------
   */

  const appendLog = (log: TurnLog) => {
    setCombatLogs((prev) => [log, ...prev].slice(0, 50));
  };

  /*
   * ------------------------------------------------------------
   * PLAYER ATTACK
   * ------------------------------------------------------------
   */

  const handlePlayerAttack = (requestedWeapon: WeaponOption) => {
    if (turn !== "player") {
      return;
    }

    if (winner) {
      return;
    }

    if (processing) {
      return;
    }

    /*
     * Validate the requested weapon against actual equipment.
     *
     * The combat system performs its own validation too, so this
     * UI layer cannot accidentally create/use an arbitrary weapon.
     */

    let selectedWeapon = UNARMED_WEAPON;

    if (requestedWeapon.id === UNARMED_WEAPON.id) {
      selectedWeapon = UNARMED_WEAPON;
    } else {
      const currentEquipped = resolveEquippedWeapon(pState);

      if (currentEquipped.id === requestedWeapon.id) {
        selectedWeapon = currentEquipped;
      }
    }

    setProcessing(true);

    /*
     * PLAYER TURN
     */

    const playerResult = executeCombatTurn(
      pState,
      eState,
      selectedWeapon
    );

    const updatedEnemy = playerResult.updatedDefender;

    setEState(updatedEnemy);
    appendLog(playerResult.log);

    /*
     * Enemy defeated.
     */

    if (updatedEnemy.health <= 0) {
      setWinner("player");
      setTurn("player");
      setProcessing(false);
      return;
    }

    /*
     * ----------------------------------------------------------
     * ENEMY TURN
     * ----------------------------------------------------------
     */

    setTurn("enemy");

    enemyTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      /*
       * Enemy does not receive a weapon from the UI.
       *
       * executeCombatTurn resolves the enemy's own equipped
       * weapon or falls back to Unarmed.
       */

      const enemyResult = executeCombatTurn(
        updatedEnemy,
        pState
      );

      const updatedPlayer = enemyResult.updatedDefender;

      setPState(updatedPlayer);
      appendLog(enemyResult.log);

      if (updatedPlayer.health <= 0) {
        setWinner("enemy");
        setTurn("enemy");
        setProcessing(false);

        onDefeat(updatedPlayer.health);
        return;
      }

      setTurn("player");
      setProcessing(false);
      enemyTimerRef.current = null;
    }, 700);
  };

  /*
   * ------------------------------------------------------------
   * FINISHING OUTCOME
   * ------------------------------------------------------------
   */

  const handleFinish = (outcome: FinishOutcome) => {
    if (winner !== "player") {
      return;
    }

    if (finishSelected) {
      return;
    }

    setFinishSelected(true);

    onFinish(
      outcome,
      eState,
      Math.max(1, pState.health)
    );
  };

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <div
      className="combat-container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* ======================================================
          COMBAT HEADER
          ====================================================== */}

      <div
        className="card"
        style={{
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <span
              className="card-tag"
              style={{
                display: "inline-block",
                marginBottom: "5px",
              }}
            >
              LIVE COMBAT
            </span>

            <h2 style={{ margin: 0 }}>
              {pState.name} vs {eState.name}
            </h2>
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "#a1a1aa",
              textAlign: "right",
            }}
          >
            {winner
              ? winner === "player"
                ? "COMBAT WON"
                : "COMBAT LOST"
              : turn === "player"
              ? "YOUR TURN"
              : "ENEMY TURN"}
          </div>
        </div>
      </div>

      {/* ======================================================
          FIGHTER VITALS
          ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        }}
      >
        {/* PLAYER */}

        <div
          className="card"
          style={{
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0 }}>
              {pState.name}
            </h3>

            <span className="card-tag">
              LV {pState.level}
            </span>
          </div>

          <p
            style={{
              margin: "10px 0 6px",
              fontSize: "13px",
            }}
          >
            ❤️ Health{" "}
            <strong>
              {Math.max(0, Math.floor(pState.health))} /{" "}
              {pState.maxHealth}
            </strong>
          </p>

          <div
            style={{
              height: "9px",
              background: "#27272a",
              borderRadius: "5px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${playerHealthPercent}%`,
                height: "100%",
                background: "#22c55e",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: "#a1a1aa",
            }}
          >
            Equipped:{" "}
            <strong style={{ color: "#f4f4f5" }}>
              {equippedWeapon.name}
            </strong>
          </div>
        </div>

        {/* ENEMY */}

        <div
          className="card"
          style={{
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0 }}>
              {eState.name}
            </h3>

            <span className="card-tag">
              LV {eState.level}
            </span>
          </div>

          <p
            style={{
              margin: "10px 0 6px",
              fontSize: "13px",
            }}
          >
            ❤️ Health{" "}
            <strong>
              {Math.max(0, Math.floor(eState.health))} /{" "}
              {eState.maxHealth}
            </strong>
          </p>

          <div
            style={{
              height: "9px",
              background: "#27272a",
              borderRadius: "5px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${enemyHealthPercent}%`,
                height: "100%",
                background: "#ef4444",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: "#a1a1aa",
            }}
          >
            Status:{" "}
            <strong style={{ color: "#f4f4f5" }}>
              {eState.health <= 0
                ? "Defeated"
                : eState.inCover
                ? "In Cover"
                : "Exposed"}
            </strong>
          </div>
        </div>
      </div>

      {/* ======================================================
          TURN STATUS
          ====================================================== */}

      {!winner && (
        <div
          className="card"
          style={{
            padding: "12px 14px",
            textAlign: "center",
          }}
        >
          {turn === "player" ? (
            <strong>
              ⚔️ Your turn. Choose your attack.
            </strong>
          ) : (
            <span style={{ color: "#a1a1aa" }}>
              {eState.name} is deciding what to do...
            </span>
          )}
        </div>
      )}

      {/* ======================================================
          PLAYER ACTIONS
          ====================================================== */}

      {!winner && turn === "player" && (
        <div
          className="card"
          style={{
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
              gap: "10px",
            }}
          >
            <h3 style={{ margin: 0 }}>
              Attack
            </h3>

            <span
              style={{
                fontSize: "12px",
                color: "#a1a1aa",
              }}
            >
              Select weapon
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "8px",
            }}
          >
            {attackOptions.map((weapon) => {
              const isUnarmed =
                weapon.id === UNARMED_WEAPON.id;

              return (
                <button
                  key={weapon.id}
                  className="btn-primary"
                  disabled={processing}
                  onClick={() =>
                    handlePlayerAttack(weapon)
                  }
                  style={{
                    minHeight: "52px",
                    opacity: processing ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontWeight: "bold",
                    }}
                  >
                    {weapon.icon ||
                      (isUnarmed ? "👊" : "⚔️")}{" "}
                    {weapon.name}
                  </span>

                  <span
                    style={{
                      display: "block",
                      fontSize: "11px",
                      marginTop: "3px",
                      opacity: 0.8,
                    }}
                  >
                    {weapon.baseDamage} base damage
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid #27272a",
              fontSize: "12px",
              color: "#a1a1aa",
            }}
          >
            Equipped weapon:{" "}
            <strong style={{ color: "#f4f4f5" }}>
              {equippedWeapon.name}
            </strong>
          </div>
        </div>
      )}

      {/* ======================================================
          VICTORY
          ====================================================== */}

      {winner === "player" && (
        <div
          className="card"
          style={{
            padding: "18px",
            border: "1px solid #22c55e",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "34px",
              marginBottom: "4px",
            }}
          >
            🏆
          </div>

          <h2
            style={{
              margin: "0 0 6px",
              color: "#22c55e",
            }}
          >
            VICTORY
          </h2>

          <p
            style={{
              margin: "0 0 16px",
              color: "#a1a1aa",
            }}
          >
            {eState.name} has been defeated.
          </p>

          {!finishSelected ? (
            <>
              <p
                style={{
                  fontSize: "13px",
                  marginBottom: "10px",
                }}
              >
                Choose what happens next:
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "8px",
                }}
              >
                <button
                  className="btn-primary"
                  onClick={() =>
                    handleFinish("leave")
                  }
                >
                  🚶 Leave
                  <span
                    style={{
                      display: "block",
                      fontSize: "11px",
                      marginTop: "3px",
                      opacity: 0.8,
                    }}
                  >
                    Maximum XP bonus
                  </span>
                </button>

                <button
                  className="btn-primary"
                  onClick={() =>
                    handleFinish("mug")
                  }
                  style={{
                    background: "#eab308",
                    color: "#000",
                  }}
                >
                  💵 Mug
                  <span
                    style={{
                      display: "block",
                      fontSize: "11px",
                      marginTop: "3px",
                      opacity: 0.75,
                    }}
                  >
                    Steal some cash
                  </span>
                </button>

                <button
                  className="btn-primary"
                  onClick={() =>
                    handleFinish("hospitalize")
                  }
                  style={{
                    background: "#dc2626",
                  }}
                >
                  🏥 Hospitalize
                  <span
                    style={{
                      display: "block",
                      fontSize: "11px",
                      marginTop: "3px",
                      opacity: 0.8,
                    }}
                  >
                    Longer hospital time
                  </span>
                </button>
              </div>
            </>
          ) : (
            <p
              style={{
                margin: 0,
                color: "#a1a1aa",
              }}
            >
              Resolving combat rewards...
            </p>
          )}
        </div>
      )}

      {/* ======================================================
          DEFEAT
          ====================================================== */}

      {winner === "enemy" && (
        <div
          className="card"
          style={{
            padding: "18px",
            border: "1px solid #ef4444",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "34px",
              marginBottom: "4px",
            }}
          >
            🏥
          </div>

          <h2
            style={{
              margin: "0 0 6px",
              color: "#ef4444",
            }}
          >
            DEFEATED
          </h2>

          <p
            style={{
              margin: 0,
              color: "#a1a1aa",
            }}
          >
            You were knocked out and sent to the hospital.
          </p>
        </div>
      )}

      {/* ======================================================
          COMBAT LOG
          ====================================================== */}

      <div
        className="card"
        style={{
          padding: "14px",
          maxHeight: "260px",
          overflowY: "auto",
          background: "#09090b",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <h3 style={{ margin: 0 }}>
            Combat Log
          </h3>

          <span
            style={{
              fontSize: "11px",
              color: "#71717a",
            }}
          >
            {combatLogs.length} events
          </span>
        </div>

        {combatLogs.length === 0 ? (
          <div
            style={{
              color: "#71717a",
              fontSize: "13px",
              padding: "8px 0",
            }}
          >
            Combat has not started yet.
          </div>
        ) : (
          combatLogs.map((log) => (
            <div
              key={log.id}
              style={{
                padding: "8px 0",
                borderBottom:
                  "1px solid #18181b",
                fontSize: "13px",
                color: log.isCrit
                  ? "#f59e0b"
                  : log.isMiss
                  ? "#71717a"
                  : "#f4f4f5",
              }}
            >
              <div>
                {log.actionText}
              </div>

              {log.damage > 0 && (
                <div
                  style={{
                    marginTop: "2px",
                    fontSize: "11px",
                    color: "#71717a",
                  }}
                >
                  {log.damage} damage
                  {log.hitPart
                    ? ` · ${log.hitPart}`
                    : ""}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
