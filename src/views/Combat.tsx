import React, { useState } from "react";
import {
  DynamicFighter,
  TurnLog,
  WeaponOption,
  UNARMED_WEAPON,
  resolveEquippedWeapon,
  executeCombatTurn,
} from "../systems/combatSystem";

interface InteractiveCombatViewProps {
  player: DynamicFighter;
  enemy: DynamicFighter;
  onFinish: (
    outcome: "leave" | "hospitalize" | "mug",
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
  const [pState, setPState] =
    useState<DynamicFighter>(player);

  const [eState, setEState] =
    useState<DynamicFighter>(enemy);

  const [combatLogs, setCombatLogs] =
    useState<TurnLog[]>([]);

  const [turn, setTurn] =
    useState<"player" | "enemy">("player");

  const [winner, setWinner] =
    useState<"player" | "enemy" | null>(null);

  /*
   * ==========================================================
   * PLAYER EQUIPMENT
   * ==========================================================
   *
   * The combat UI does NOT invent weapons.
   *
   * If the player has no equipped weapon:
   *
   *     👊 Unarmed
   *
   * If they have an equipped weapon:
   *
   *     🔫 Equipped Weapon
   *
   * Weapons sitting in inventory but NOT equipped are
   * intentionally NOT displayed as attack options.
   */

  const equippedWeapon =
    resolveEquippedWeapon(pState);

  const playerAttackOptions: WeaponOption[] = [
    UNARMED_WEAPON,
  ];

  /*
   * Only add the equipped weapon.
   *
   * Do not add the entire weapons[] inventory.
   */
  if (
    equippedWeapon.id !==
    UNARMED_WEAPON.id
  ) {
    playerAttackOptions.push(
      equippedWeapon
    );
  }

  /*
   * Prevent duplicate Unarmed buttons.
   */
  const uniqueAttackOptions =
    playerAttackOptions.filter(
      (
        weapon,
        index,
        array
      ) =>
        array.findIndex(
          (other) =>
            other.id ===
            weapon.id
        ) === index
    );

  /*
   * ==========================================================
   * PLAYER ATTACK
   * ==========================================================
   */

  const handlePlayerAttack = (
    weapon: WeaponOption
  ) => {
    /*
     * Ignore input while it isn't the player's turn.
     */
    if (
      turn !== "player" ||
      winner
    ) {
      return;
    }

    /*
     * ========================================================
     * WEAPON VALIDATION
     * ========================================================
     *
     * Unarmed is always allowed.
     *
     * Any real weapon must be the weapon currently equipped
     * by the player.
     */

    let selectedWeapon: WeaponOption;

    if (
      weapon.id ===
      UNARMED_WEAPON.id
    ) {
      selectedWeapon =
        UNARMED_WEAPON;
    } else {
      /*
       * Verify that the requested weapon is actually the
       * currently equipped weapon.
       */
      const currentEquipped =
        resolveEquippedWeapon(
          pState
        );

      if (
        currentEquipped.id !==
        weapon.id
      ) {
        /*
         * Stale UI / invalid request.
         *
         * Safely fall back to Unarmed.
         */
        selectedWeapon =
          UNARMED_WEAPON;
      } else {
        selectedWeapon =
          currentEquipped;
      }
    }

    /*
     * ========================================================
     * PLAYER TURN
     * ========================================================
     */

    const playerResult =
      executeCombatTurn(
        pState,
        eState,
        selectedWeapon
      );

    setEState(
      playerResult.updatedDefender
    );

    setCombatLogs(
      (prev) => [
        playerResult.log,
        ...prev,
      ]
    );

    /*
     * Enemy defeated.
     */
    if (
      playerResult
        .updatedDefender
        .health <= 0
    ) {
      setWinner("player");
      return;
    }

    /*
     * ========================================================
     * ENEMY TURN
     * ========================================================
     */

    setTurn("enemy");

    setTimeout(() => {
      /*
       * The combat system independently resolves the enemy's
       * equipped weapon.
       *
       * No weapon is passed from the UI.
       *
       * Therefore:
       *
       * enemy equipped weapon -> weapon
       * no equipped weapon     -> unarmed
       */
      const aiResult =
        executeCombatTurn(
          playerResult.updatedDefender,
          pState
        );

      setPState(
        aiResult.updatedDefender
      );

      setCombatLogs(
        (prev) => [
          aiResult.log,
          ...prev,
        ]
      );

      /*
       * Player defeated.
       */
      if (
        aiResult
          .updatedDefender
          .health <= 0
      ) {
        setWinner("enemy");

        onDefeat(
          aiResult
            .updatedDefender
            .health
        );
      } else {
        /*
         * Back to player's turn.
         */
        setTurn("player");
      }
    }, 600);
  };

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
          VITALS DISPLAY
          ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: "12px",
        }}
      >
        {/* PLAYER */}
        <div
          className="card"
          style={{
            padding: "12px",
          }}
        >
          <h3>
            {pState.name} (LV{" "}
            {pState.level})
          </h3>

          <p>
            Health:{" "}
            {pState.health} /{" "}
            {pState.maxHealth}
          </p>

          <div
            style={{
              height: "8px",
              background: "#333",
              borderRadius:
                "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    (pState.health /
                      pState.maxHealth) *
                      100
                  )
                )}%`,
                height: "100%",
                background:
                  "#22c55e",
                transition:
                  "width 0.3s",
              }}
            />
          </div>
        </div>

        {/* ENEMY */}
        <div
          className="card"
          style={{
            padding: "12px",
          }}
        >
          <h3>
            {eState.name} (LV{" "}
            {eState.level})
          </h3>

          <p>
            Health:{" "}
            {eState.health} /{" "}
            {eState.maxHealth}
          </p>

          <div
            style={{
              height: "8px",
              background: "#333",
              borderRadius:
                "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    (eState.health /
                      eState.maxHealth) *
                      100
                  )
                )}%`,
                height: "100%",
                background:
                  "#ef4444",
                transition:
                  "width 0.3s",
              }}
            />
          </div>
        </div>
      </div>

      {/* ======================================================
          PLAYER ACTION CONTROLS
          ====================================================== */}

      {!winner &&
        turn ===
          "player" && (
          <div
            className="card"
            style={{
              padding: "12px",
            }}
          >
            <p
              style={{
                marginBottom:
                  "8px",
                fontWeight:
                  "bold",
              }}
            >
              Select Attack:
            </p>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap:
                  "wrap",
              }}
            >
              {uniqueAttackOptions.map(
                (weapon) => {
                  const isUnarmed =
                    weapon.id ===
                    UNARMED_WEAPON.id;

                  return (
                    <button
                      key={
                        weapon.id
                      }
                      className="btn-primary"
                      onClick={() =>
                        handlePlayerAttack(
                          weapon
                        )
                      }
                    >
                      {weapon.icon ||
                        (isUnarmed
                          ? "👊"
                          : "⚔️")}{" "}
                      {weapon.name}{" "}
                      (
                      {
                        weapon.baseDamage
                      }{" "}
                      Dmg)
                    </button>
                  );
                }
              )}
            </div>

            {/* Current equipment indicator */}
            <div
              style={{
                marginTop:
                  "10px",
                fontSize:
                  "12px",
                color:
                  "#a1a1aa",
              }}
            >
              Equipped:{" "}
              <strong
                style={{
                  color:
                    "#f4f4f5",
                }}
              >
                {equippedWeapon.name}
              </strong>
            </div>
          </div>
        )}

      {/* ======================================================
          ENEMY TURN
          ====================================================== */}

      {turn ===
        "enemy" &&
        !winner && (
          <div
            className="card"
            style={{
              padding: "12px",
              textAlign:
                "center",
              color:
                "#a1a1aa",
            }}
          >
            {eState.name} is
            making a move...
          </div>
        )}

      {/* ======================================================
          VICTORY
          ====================================================== */}

      {winner ===
        "player" && (
        <div
          className="card"
          style={{
            padding: "16px",
            border:
              "1px solid #22c55e",
            textAlign:
              "center",
          }}
        >
          <h2
            style={{
              color:
                "#22c55e",
            }}
          >
            VICTORY!
          </h2>

          <p
            style={{
              margin:
                "8px 0 16px",
            }}
          >
            Select Finishing
            Outcome:
          </p>

          <div
            style={{
              display:
                "flex",
              gap: "8px",
              justifyContent:
                "center",
              flexWrap:
                "wrap",
            }}
          >
            <button
              className="btn-primary"
              onClick={() =>
                onFinish(
                  "leave",
                  eState,
                  pState.health
                )
              }
            >
              🚶 Leave ( Max
              EXP Bonus )
            </button>

            <button
              className="btn-primary"
              style={{
                background:
                  "#dc2626",
              }}
              onClick={() =>
                onFinish(
                  "hospitalize",
                  eState,
                  pState.health
                )
              }
            >
              🏥 Hospitalize (
              Extended Hospital
              Time )
            </button>

            <button
              className="btn-primary"
              style={{
                background:
                  "#eab308",
                color: "#000",
              }}
              onClick={() =>
                onFinish(
                  "mug",
                  eState,
                  pState.health
                )
              }
            >
              💵 Mug ( Steal
              Cash )
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          DEFEAT
          ====================================================== */}

      {winner ===
        "enemy" && (
        <div
          className="card"
          style={{
            padding: "16px",
            border:
              "1px solid #ef4444",
            textAlign:
              "center",
          }}
        >
          <h2
            style={{
              color:
                "#ef4444",
            }}
          >
            DEFEATED
          </h2>

          <p>
            You were knocked
            out and admitted
            to the hospital.
          </p>
        </div>
      )}

      {/* ======================================================
          COMBAT LOG
          ====================================================== */}

      <div
        className="card"
        style={{
          padding: "12px",
          maxHeight:
            "200px",
          overflowY:
            "auto",
          background:
            "#09090b",
        }}
      >
        <p
          style={{
            fontSize:
              "12px",
            color:
              "#a1a1aa",
            marginBottom:
              "8px",
          }}
        >
          COMBAT LOG
        </p>

        {combatLogs.map(
          (log) => (
            <div
              key={log.id}
              style={{
                fontSize:
                  "13px",
                marginBottom:
                  "4px",
                color:
                  log.isCrit
                    ? "#f59e0b"
                    : log.isMiss
                    ? "#71717a"
                    : "#f4f4f5",
              }}
            >
              {
                log.actionText
              }
            </div>
          )
        )}
      </div>
    </div>
  );
}
