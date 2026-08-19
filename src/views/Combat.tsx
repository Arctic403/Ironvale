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

  /*
   * ------------------------------------------------------------
   * VISUAL COMBAT STATE
   * ------------------------------------------------------------
   *
   * These states are purely presentation.
   * They do NOT affect combat calculations.
   */

  const [impactTarget, setImpactTarget] = useState<
    "player" | "enemy" | null
  >(null);

  const [impactType, setImpactType] = useState<
    "hit" | "crit" | "miss" | null
  >(null);

  const [lastEventId, setLastEventId] = useState<string | null>(null);

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
   * HEALTH
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
   * VISUAL IMPACT
   * ------------------------------------------------------------
   */

  const triggerImpact = (
    target: "player" | "enemy",
    log: TurnLog
  ) => {
    if (!mountedRef.current) {
      return;
    }

    const type = log.isCrit
      ? "crit"
      : log.isMiss
      ? "miss"
      : "hit";

    setImpactTarget(null);
    setImpactType(null);

    /*
     * Force a new animation cycle.
     */
    window.requestAnimationFrame(() => {
      if (!mountedRef.current) {
        return;
      }

      setImpactTarget(target);
      setImpactType(type);

      window.setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }

        setImpactTarget(null);
        setImpactType(null);
      }, 520);
    });
  };

  /*
   * ------------------------------------------------------------
   * LOGGING
   * ------------------------------------------------------------
   */

  const appendLog = (log: TurnLog) => {
    setCombatLogs((prev) => [log, ...prev].slice(0, 50));
    setLastEventId(log.id);
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
     * Visual feedback only.
     */
    triggerImpact("enemy", playerResult.log);

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
     * ENEMY TURN
     */

    setTurn("enemy");

    enemyTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      const enemyResult = executeCombatTurn(
        updatedEnemy,
        pState
      );

      const updatedPlayer = enemyResult.updatedDefender;

      setPState(updatedPlayer);
      appendLog(enemyResult.log);

      /*
       * Visual feedback only.
       */
      triggerImpact("player", enemyResult.log);

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
   * FIGHTER VISUAL CLASSES
   * ------------------------------------------------------------
   */

  const playerFighterClass = [
    "combat-fighter",
    "combat-fighter-player",
    turn === "player" && !winner
      ? "combat-fighter-active"
      : "",
    impactTarget === "player"
      ? `combat-impact-${impactType}`
      : "",
    pState.health <= 0
      ? "combat-fighter-defeated"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const enemyFighterClass = [
    "combat-fighter",
    "combat-fighter-enemy",
    turn === "enemy" && !winner
      ? "combat-fighter-active"
      : "",
    impactTarget === "enemy"
      ? `combat-impact-${impactType}`
      : "",
    eState.health <= 0
      ? "combat-fighter-defeated"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <div className="combat-container">
      {/* ======================================================
          COMBAT HEADER
          ====================================================== */}

      <div className="combat-header card">
        <div className="combat-header-content">
          <div>
            <span className="combat-live-badge">
              <span className="combat-live-dot" />
              LIVE COMBAT
            </span>

            <h2 className="combat-title">
              {pState.name}
              <span className="combat-vs">VS</span>
              {eState.name}
            </h2>
          </div>

          <div
            className={`combat-turn-indicator ${
              winner
                ? winner === "player"
                  ? "combat-result-win"
                  : "combat-result-loss"
                : turn === "player"
                ? "combat-your-turn"
                : "combat-enemy-turn"
            }`}
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
          FIGHT ARENA
          ====================================================== */}

      <div className="combat-arena">
        {/* PLAYER */}

        <div className={playerFighterClass}>
          <div className="combat-fighter-top">
            <div>
              <div className="combat-fighter-label">
                YOU
              </div>

              <h3>{pState.name}</h3>
            </div>

            <span className="combat-level">
              LV {pState.level}
            </span>
          </div>

          <div className="combat-avatar combat-avatar-player">
            <span>🧍</span>

            {impactTarget === "player" && (
              <div className="combat-impact-text">
                {impactType === "crit"
                  ? "CRITICAL!"
                  : impactType === "miss"
                  ? "MISS"
                  : `-${combatLogs[0]?.damage ?? 0}`}
              </div>
            )}
          </div>

          <div className="combat-health-section">
            <div className="combat-health-label">
              <span>❤️ HEALTH</span>

              <strong>
                {Math.max(
                  0,
                  Math.floor(pState.health)
                )}{" "}
                / {pState.maxHealth}
              </strong>
            </div>

            <div className="combat-health-bar">
              <div
                className="combat-health-fill combat-health-player"
                style={{
                  width: `${playerHealthPercent}%`,
                }}
              />
            </div>
          </div>

          <div className="combat-fighter-status">
            <span>WEAPON</span>

            <strong>
              {equippedWeapon.icon || "⚔️"}{" "}
              {equippedWeapon.name}
            </strong>
          </div>
        </div>

        {/* CENTER VS */}

        <div className="combat-center">
          <div className="combat-center-line" />

          <div className="combat-vs-badge">
            VS
          </div>

          <div className="combat-center-line" />
        </div>

        {/* ENEMY */}

        <div className={enemyFighterClass}>
          <div className="combat-fighter-top">
            <div>
              <div className="combat-fighter-label enemy-label">
                OPPONENT
              </div>

              <h3>{eState.name}</h3>
            </div>

            <span className="combat-level">
              LV {eState.level}
            </span>
          </div>

          <div className="combat-avatar combat-avatar-enemy">
            <span>👤</span>

            {impactTarget === "enemy" && (
              <div className="combat-impact-text">
                {impactType === "crit"
                  ? "CRITICAL!"
                  : impactType === "miss"
                  ? "MISS"
                  : `-${combatLogs[0]?.damage ?? 0}`}
              </div>
            )}
          </div>

          <div className="combat-health-section">
            <div className="combat-health-label">
              <span>❤️ HEALTH</span>

              <strong>
                {Math.max(
                  0,
                  Math.floor(eState.health)
                )}{" "}
                / {eState.maxHealth}
              </strong>
            </div>

            <div className="combat-health-bar">
              <div
                className="combat-health-fill combat-health-enemy"
                style={{
                  width: `${enemyHealthPercent}%`,
                }}
              />
            </div>
          </div>

          <div className="combat-fighter-status">
            <span>STATUS</span>

            <strong>
              {eState.health <= 0
                ? "💀 Defeated"
                : eState.inCover
                ? "🛡️ In Cover"
                : "⚠️ Exposed"}
            </strong>
          </div>
        </div>
      </div>

      {/* ======================================================
          TURN STATUS
          ====================================================== */}

      {!winner && (
        <div
          className={`combat-status-banner ${
            turn === "player"
              ? "combat-status-player"
              : "combat-status-enemy"
          }`}
        >
          <div className="combat-status-icon">
            {turn === "player" ? "⚔️" : "👁️"}
          </div>

          <div>
            <strong>
              {turn === "player"
                ? "Your turn"
                : `${eState.name} is deciding...`}
            </strong>

            <span>
              {turn === "player"
                ? "Choose your attack."
                : "Prepare for the next attack."}
            </span>
          </div>
        </div>
      )}

      {/* ======================================================
          PLAYER ACTIONS
          ====================================================== */}

      {!winner && turn === "player" && (
        <div className="combat-actions card">
          <div className="combat-actions-header">
            <div>
              <div className="combat-section-label">
                ATTACK
              </div>

              <h3>Choose your attack</h3>
            </div>

            <span className="combat-action-hint">
              {attackOptions.length} available
            </span>
          </div>

          <div className="combat-attack-grid">
            {attackOptions.map((weapon) => {
              const isUnarmed =
                weapon.id === UNARMED_WEAPON.id;

              return (
                <button
                  key={weapon.id}
                  className="combat-attack-button"
                  disabled={processing}
                  onClick={() =>
                    handlePlayerAttack(weapon)
                  }
                >
                  <span className="combat-attack-icon">
                    {weapon.icon ||
                      (isUnarmed ? "👊" : "⚔️")}
                  </span>

                  <span className="combat-attack-info">
                    <strong>{weapon.name}</strong>

                    <small>
                      {weapon.baseDamage} base damage
                    </small>
                  </span>

                  <span className="combat-attack-arrow">
                    →
                  </span>
                </button>
              );
            })}
          </div>

          <div className="combat-equipped">
            <span>Currently equipped</span>

            <strong>
              {equippedWeapon.icon || "⚔️"}{" "}
              {equippedWeapon.name}
            </strong>
          </div>
        </div>
      )}

      {/* ======================================================
          VICTORY
          ====================================================== */}

      {winner === "player" && (
        <div className="combat-result combat-result-victory">
          <div className="combat-result-icon">
            🏆
          </div>

          <div className="combat-result-label">
            VICTORY
          </div>

          <h2>{eState.name} has been defeated.</h2>

          {!finishSelected ? (
            <>
              <p>
                Choose what happens next.
              </p>

              <div className="combat-finish-grid">
                <button
                  className="combat-finish-button combat-finish-leave"
                  onClick={() =>
                    handleFinish("leave")
                  }
                >
                  <span>🚶</span>

                  <strong>Leave</strong>

                  <small>
                    Maximum XP bonus
                  </small>
                </button>

                <button
                  className="combat-finish-button combat-finish-mug"
                  onClick={() =>
                    handleFinish("mug")
                  }
                >
                  <span>💵</span>

                  <strong>Mug</strong>

                  <small>
                    Steal some cash
                  </small>
                </button>

                <button
                  className="combat-finish-button combat-finish-hospitalize"
                  onClick={() =>
                    handleFinish("hospitalize")
                  }
                >
                  <span>🏥</span>

                  <strong>Hospitalize</strong>

                  <small>
                    Longer hospital time
                  </small>
                </button>
              </div>
            </>
          ) : (
            <p>
              Resolving combat rewards...
            </p>
          )}
        </div>
      )}

      {/* ======================================================
          DEFEAT
          ====================================================== */}

      {winner === "enemy" && (
        <div className="combat-result combat-result-defeat">
          <div className="combat-result-icon">
            🏥
          </div>

          <div className="combat-result-label">
            DEFEATED
          </div>

          <h2>You were knocked out.</h2>

          <p>
            You were defeated and sent to the hospital.
          </p>
        </div>
      )}

      {/* ======================================================
          COMBAT LOG
          ====================================================== */}

      <div className="combat-log card">
        <div className="combat-log-header">
          <div>
            <div className="combat-section-label">
              BATTLE FEED
            </div>

            <h3>Combat Log</h3>
          </div>

          <span>
            {combatLogs.length} events
          </span>
        </div>

        {combatLogs.length === 0 ? (
          <div className="combat-log-empty">
            <span>⚔️</span>

            <p>
              Combat has not started yet.
            </p>
          </div>
        ) : (
          <div className="combat-log-list">
            {combatLogs.map((log, index) => (
              <div
                key={log.id}
                className={[
                  "combat-log-entry",
                  index === 0
                    ? "combat-log-entry-new"
                    : "",
                  log.isCrit
                    ? "combat-log-critical"
                    : "",
                  log.isMiss
                    ? "combat-log-miss"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="combat-log-marker">
                  {log.isCrit
                    ? "💥"
                    : log.isMiss
                    ? "〰️"
                    : "⚔️"}
                </div>

                <div className="combat-log-content">
                  <div>
                    {log.actionText}
                  </div>

                  {log.damage > 0 && (
                    <small>
                      {log.damage} damage
                      {log.hitPart
                        ? ` · ${log.hitPart}`
                        : ""}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
