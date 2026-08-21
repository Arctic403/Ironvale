import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DynamicFighter,
  TurnLog,
  WeaponClass,
  WeaponOption,
  UNARMED_WEAPON,
  resolveEquippedWeapon,
  executeCombatTurn,
  calculateAccuracy,
  calculateHitChance,
  WEAPON_SKILL_LABELS,
} from "../systems/combatSystem";

type FinishOutcome =
  | "leave"
  | "hospitalize"
  | "mug";

type FighterSide = "player" | "enemy";
type ImpactKind = "hit" | "crit" | "miss";

type ImpactState = {
  target: FighterSide;
  kind: ImpactKind;
  damage: number;
} | null;

interface InteractiveCombatViewProps {
  player: DynamicFighter;
  enemy: DynamicFighter;

  onStart?: () => boolean;

  onFinish: (
    outcome: FinishOutcome,
    enemy: DynamicFighter,
    finalPlayerHealth: number
  ) => void;

  onDefeat: (
    finalPlayerHealth: number
  ) => void;

  onWeaponSkillUse?: (
    weaponClass: string,
    hit: boolean
  ) => void;
}

function clampHealthPercent(
  health: number,
  maxHealth: number
) {
  if (maxHealth <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      (health / maxHealth) * 100
    )
  );
}

function impactKindFromLog(
  log: TurnLog
): ImpactKind {
  if (log.isCrit) {
    return "crit";
  }

  if (log.isMiss) {
    return "miss";
  }

  return "hit";
}

function weaponMotionClass(
  weaponClass: WeaponClass | null
) {
  return weaponClass
    ? `combat-motion-${weaponClass}`
    : "combat-motion-idle";
}

function isFirearmClass(
  weaponClass: WeaponClass | null
) {
  return (
    weaponClass === "handgun" ||
    weaponClass === "smg" ||
    weaponClass === "shotgun" ||
    weaponClass === "rifle"
  );
}

function CombatHud({
  side,
  fighter,
  healthPercent,
  weapon,
}: {
  side: FighterSide;
  fighter: DynamicFighter;
  healthPercent: number;
  weapon: WeaponOption;
}) {
  return (
    <div
      className={`combat-stage-hud combat-stage-hud-${side}`}
    >
      <div className="combat-stage-hud-top">
        <div>
          <span className="combat-stage-hud-label">
            {side === "player"
              ? "YOU"
              : "OPPONENT"}
          </span>

          <strong>
            {fighter.name}
          </strong>
        </div>

        <span className="combat-stage-level">
          LV {fighter.level}
        </span>
      </div>

      <div className="combat-stage-health-row">
        <span>
          ❤️ {Math.max(0, Math.floor(fighter.health))}
          /{fighter.maxHealth}
        </span>

        <span className="combat-stage-weapon-name">
          {weapon.icon || "⚔️"} {weapon.name}
        </span>
      </div>

      <div className="combat-stage-health-track">
        <div
          className={`combat-stage-health-fill combat-stage-health-fill-${side}`}
          style={{
            width: `${healthPercent}%`,
          }}
        />
      </div>
    </div>
  );
}

function CombatCharacter({
  side,
  fighter,
  weapon,
  active,
  attacking,
  weaponClass,
  impact,
}: {
  side: FighterSide;
  fighter: DynamicFighter;
  weapon: WeaponOption;
  active: boolean;
  attacking: boolean;
  weaponClass: WeaponClass | null;
  impact: ImpactState;
}) {
  const defeated = fighter.health <= 0;
  const isImpactTarget = impact?.target === side;
  const firearm = isFirearmClass(
    attacking ? weaponClass : null
  );

  const className = [
    "combat-stage-fighter",
    `combat-stage-fighter-${side}`,
    active ? "combat-stage-fighter-active" : "",
    attacking ? "combat-stage-fighter-attacking" : "",
    attacking
      ? weaponMotionClass(weaponClass)
      : "",
    isImpactTarget
      ? `combat-stage-impact-${impact?.kind}`
      : "",
    defeated
      ? "combat-stage-fighter-defeated"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="combat-stage-shadow" />

      <div className="combat-character-rig">
        <div className="combat-rig-head" />
        <div className="combat-rig-neck" />
        <div className="combat-rig-torso" />
        <div className="combat-rig-arm combat-rig-arm-back" />
        <div className="combat-rig-arm combat-rig-arm-front">
          <span className="combat-rig-weapon">
            {weapon.icon || "⚔️"}
          </span>

          {firearm && (
            <span className="combat-muzzle-flash" />
          )}
        </div>
        <div className="combat-rig-leg combat-rig-leg-back" />
        <div className="combat-rig-leg combat-rig-leg-front" />
      </div>

      <div className="combat-stage-weapon-caption">
        {weapon.name}
      </div>

      {isImpactTarget && impact && (
        <>
          <div
            className={`combat-stage-impact-burst combat-stage-impact-burst-${impact.kind}`}
          />

          <div
            className={`combat-stage-impact-text combat-stage-impact-text-${impact.kind}`}
          >
            {impact.kind === "miss"
              ? "MISS"
              : impact.kind === "crit"
              ? `CRIT -${impact.damage}`
              : `-${impact.damage}`}
          </div>
        </>
      )}
    </div>
  );
}

function CombatLog({
  logs,
}: {
  logs: TurnLog[];
}) {
  return (
    <details className="combat-log card combat-log-collapsible">
      <summary className="combat-log-summary">
        <div>
          <div className="combat-section-label">
            BATTLE FEED
          </div>
          <strong>Combat Log</strong>
        </div>
        <span>{logs.length} events</span>
      </summary>

      {logs.length === 0 ? (
        <div className="combat-log-empty">
          <span>⚔️</span>
          <p>
            Combat has not started yet.
          </p>
        </div>
      ) : (
        <div className="combat-log-list">
          {logs.map((log, index) => (
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
                <div>{log.actionText}</div>

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
    </details>
  );
}

export function InteractiveCombatView({
  player,
  enemy,
  onStart,
  onFinish,
  onDefeat,
  onWeaponSkillUse,
}: InteractiveCombatViewProps) {
  const [pState, setPState] =
    useState<DynamicFighter>(player);

  const [eState, setEState] =
    useState<DynamicFighter>(enemy);

  const [combatLogs, setCombatLogs] =
    useState<TurnLog[]>([]);

  const [turn, setTurn] =
    useState<FighterSide>("player");

  const [winner, setWinner] =
    useState<FighterSide | null>(null);

  const [processing, setProcessing] =
    useState(false);

  const [actingFighter, setActingFighter] =
    useState<FighterSide | null>(null);

  const [activeWeaponClass, setActiveWeaponClass] =
    useState<WeaponClass | null>(null);

  const [impact, setImpact] =
    useState<ImpactState>(null);

  const [finishSelected, setFinishSelected] =
    useState(false);

  const mountedRef = useRef(true);
  const combatStartedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      timersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });

      timersRef.current = [];
    };
  }, []);

  const schedule = (
    callback: () => void,
    delay: number
  ) => {
    const timer = window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      callback();
    }, delay);

    timersRef.current.push(timer);
    return timer;
  };

  const equippedWeapon = useMemo(
    () => resolveEquippedWeapon(pState),
    [pState]
  );

  const enemyWeapon = useMemo(
    () => resolveEquippedWeapon(eState),
    [eState]
  );

  const attackOptions =
    useMemo<WeaponOption[]>(() => {
      const options: WeaponOption[] = [
        UNARMED_WEAPON,
      ];

      if (
        equippedWeapon.id !==
        UNARMED_WEAPON.id
      ) {
        options.push(equippedWeapon);
      }

      return options.filter(
        (weapon, index, array) =>
          array.findIndex(
            (other) =>
              other.id === weapon.id
          ) === index
      );
    }, [equippedWeapon]);

  const playerHealthPercent =
    clampHealthPercent(
      pState.health,
      pState.maxHealth
    );

  const enemyHealthPercent =
    clampHealthPercent(
      eState.health,
      eState.maxHealth
    );

  const appendLog = (log: TurnLog) => {
    setCombatLogs((previous) =>
      [log, ...previous].slice(0, 50)
    );
  };

  const showImpact = (
    target: FighterSide,
    log: TurnLog
  ) => {
    setImpact({
      target,
      kind: impactKindFromLog(log),
      damage: log.damage,
    });

    schedule(() => {
      setImpact(null);
    }, 640);
  };

  const finishAttackAnimation = () => {
    setActingFighter(null);
    setActiveWeaponClass(null);
  };

  const runEnemyTurn = (
    enemySnapshot: DynamicFighter,
    playerSnapshot: DynamicFighter
  ) => {
    setTurn("enemy");

    schedule(() => {
      const enemyResult = executeCombatTurn(
        enemySnapshot,
        playerSnapshot
      );

      setActingFighter("enemy");
      setActiveWeaponClass(
        enemyResult.log.weaponClass
      );

      schedule(() => {
        setPState(
          enemyResult.updatedDefender
        );

        appendLog(enemyResult.log);
        showImpact(
          "player",
          enemyResult.log
        );
      }, 360);

      schedule(() => {
        finishAttackAnimation();

        if (
          enemyResult.updatedDefender.health <=
          0
        ) {
          setWinner("enemy");
          setTurn("enemy");
          setProcessing(false);

          onDefeat(
            enemyResult.updatedDefender.health
          );

          return;
        }

        setTurn("player");
        setProcessing(false);
      }, 880);
    }, 520);
  };

  const handlePlayerAttack = (
    requestedWeapon: WeaponOption
  ) => {
    if (
      turn !== "player" ||
      winner ||
      processing
    ) {
      return;
    }

    if (
      !combatStartedRef.current &&
      onStart
    ) {
      const started = onStart();

      if (!started) {
        return;
      }

      combatStartedRef.current = true;
    }

    let selectedWeapon = UNARMED_WEAPON;

    if (
      requestedWeapon.id !==
      UNARMED_WEAPON.id
    ) {
      const currentEquipped =
        resolveEquippedWeapon(pState);

      if (
        currentEquipped.id ===
        requestedWeapon.id
      ) {
        selectedWeapon =
          currentEquipped;
      }
    }

    const playerSnapshot = pState;
    const enemySnapshot = eState;

    const playerResult = executeCombatTurn(
      playerSnapshot,
      enemySnapshot,
      selectedWeapon
    );

    setProcessing(true);
    setActingFighter("player");
    setActiveWeaponClass(
      playerResult.log.weaponClass
    );

    schedule(() => {
      setEState(
        playerResult.updatedDefender
      );

      appendLog(playerResult.log);
      showImpact(
        "enemy",
        playerResult.log
      );

      onWeaponSkillUse?.(
        playerResult.log.weaponClass,
        !playerResult.log.isMiss
      );
    }, 360);

    schedule(() => {
      finishAttackAnimation();

      if (
        playerResult.updatedDefender.health <=
        0
      ) {
        setWinner("player");
        setTurn("player");
        setProcessing(false);
        return;
      }

      runEnemyTurn(
        playerResult.updatedDefender,
        playerSnapshot
      );
    }, 880);
  };

  const handleFinish = (
    outcome: FinishOutcome
  ) => {
    if (
      winner !== "player" ||
      finishSelected
    ) {
      return;
    }

    setFinishSelected(true);

    onFinish(
      outcome,
      eState,
      Math.max(1, pState.health)
    );
  };

  const turnMessage = winner
    ? winner === "player"
      ? "COMBAT WON"
      : "COMBAT LOST"
    : actingFighter === "player"
    ? `${pState.name} attacks`
    : actingFighter === "enemy"
    ? `${eState.name} attacks`
    : turn === "player"
    ? "YOUR TURN"
    : "ENEMY TURN";

  return (
    <div className="combat-container combat-container-live">
      <div className="combat-panel">
        <div className="combat-header card combat-header-live">
          <div className="combat-header-content">
            <div>
              <span className="combat-live-badge">
                <span className="combat-live-dot" />
                TURN-BASED PVP · ANIMATED
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
              {turnMessage}
            </div>
          </div>
        </div>

        <div className="combat-main-grid combat-main-grid-live">
          <div className="combat-fight-column combat-fight-column-live">
            <div
              className={[
                "combat-arena",
                "combat-stage",
                actingFighter
                  ? `combat-stage-acting-${actingFighter}`
                  : "",
                activeWeaponClass
                  ? weaponMotionClass(
                      activeWeaponClass
                    )
                  : "",
                impact
                  ? `combat-stage-has-impact combat-stage-has-impact-${impact.kind}`
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="combat-stage-skyline" />
              <div className="combat-stage-light combat-stage-light-left" />
              <div className="combat-stage-light combat-stage-light-right" />
              <div className="combat-stage-floor" />
              <div className="combat-stage-floor-grid" />

              <div className="combat-stage-location-chip">
                STREET ENCOUNTER
              </div>

              <CombatHud
                side="player"
                fighter={pState}
                healthPercent={
                  playerHealthPercent
                }
                weapon={equippedWeapon}
              />

              <CombatHud
                side="enemy"
                fighter={eState}
                healthPercent={
                  enemyHealthPercent
                }
                weapon={enemyWeapon}
              />

              <div className="combat-stage-center-mark">
                <span>VS</span>
              </div>

              {actingFighter && activeWeaponClass && (
                isFirearmClass(activeWeaponClass) ? (
                  <span
                    className={`combat-stage-projectile combat-stage-projectile-${actingFighter} combat-stage-projectile-${activeWeaponClass}`}
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className={`combat-stage-melee-swipe combat-stage-melee-swipe-${actingFighter} combat-stage-melee-swipe-${activeWeaponClass}`}
                    aria-hidden="true"
                  />
                )
              )}

              <div className="combat-stage-fighter-slot combat-stage-fighter-slot-player">
                <CombatCharacter
                  side="player"
                  fighter={pState}
                  weapon={equippedWeapon}
                  active={
                    turn === "player" &&
                    !winner
                  }
                  attacking={
                    actingFighter === "player"
                  }
                  weaponClass={
                    actingFighter === "player"
                      ? activeWeaponClass
                      : null
                  }
                  impact={impact}
                />
              </div>

              <div className="combat-stage-fighter-slot combat-stage-fighter-slot-enemy">
                <CombatCharacter
                  side="enemy"
                  fighter={eState}
                  weapon={enemyWeapon}
                  active={
                    turn === "enemy" &&
                    !winner
                  }
                  attacking={
                    actingFighter === "enemy"
                  }
                  weaponClass={
                    actingFighter === "enemy"
                      ? activeWeaponClass
                      : null
                  }
                  impact={impact}
                />
              </div>

              <div className="combat-stage-status-strip">
                <strong>{turnMessage}</strong>
                <span>
                  {winner
                    ? winner === "player"
                      ? `${eState.name} is down.`
                      : "You were defeated."
                    : processing
                    ? "Resolving the turn..."
                    : "Choose an attack to continue."}
                </span>
              </div>
            </div>

            {!winner && (
              <div
                className={`combat-status-banner ${
                  turn === "player"
                    ? "combat-status-player"
                    : "combat-status-enemy"
                }`}
              >
                <div className="combat-status-icon">
                  {processing
                    ? "⚡"
                    : turn === "player"
                    ? "⚔️"
                    : "👁️"}
                </div>

                <div>
                  <strong>
                    {processing
                      ? "Action in progress"
                      : turn === "player"
                      ? "Your turn"
                      : `${eState.name}'s turn`}
                  </strong>

                  <span>
                    {processing
                      ? "The animation is showing the resolved turn."
                      : turn === "player"
                      ? "Choose your attack."
                      : "Waiting for the opponent action."}
                  </span>
                </div>
              </div>
            )}

            {!winner && turn === "player" && (
              <div className="combat-actions card combat-actions-live">
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
                    const skillLevel =
                      pState.weaponSkills?.[
                        weapon.weaponClass
                      ] ?? 1;

                    const hitChance = Math.round(
                      calculateHitChance(
                        calculateAccuracy(
                          pState,
                          eState,
                          weapon
                        )
                      )
                    );

                    return (
                      <button
                        key={weapon.id}
                        type="button"
                        className={`combat-attack-button combat-attack-button-${weapon.weaponClass}`}
                        disabled={processing}
                        onClick={() =>
                          handlePlayerAttack(weapon)
                        }
                      >
                        <span className="combat-attack-icon">
                          {weapon.icon || "⚔️"}
                        </span>

                        <span className="combat-attack-info">
                          <strong>{weapon.name}</strong>
                          <small>
                            {weapon.baseDamage} dmg · {hitChance}% hit · {WEAPON_SKILL_LABELS[weapon.weaponClass]} Lv {skillLevel}
                          </small>
                        </span>

                        <span className="combat-attack-arrow">
                          {processing ? "…" : "→"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="combat-equipped">
                  <span>Currently equipped</span>
                  <strong>
                    {equippedWeapon.icon || "⚔️"} {equippedWeapon.name}
                  </strong>
                </div>
              </div>
            )}

            {winner === "player" && (
              <div className="combat-result combat-result-victory">
                <div className="combat-result-icon">🏆</div>
                <div className="combat-result-label">
                  VICTORY
                </div>
                <h2>{eState.name} has been defeated.</h2>

                {!finishSelected ? (
                  <>
                    <p>Choose what happens next.</p>

                    <div className="combat-finish-grid">
                      <button
                        type="button"
                        className="combat-finish-button combat-finish-leave"
                        onClick={() =>
                          handleFinish("leave")
                        }
                      >
                        <span>🚶</span>
                        <strong>Leave</strong>
                        <small>Take the XP and walk away</small>
                      </button>

                      <button
                        type="button"
                        className="combat-finish-button combat-finish-mug"
                        onClick={() =>
                          handleFinish("mug")
                        }
                      >
                        <span>💵</span>
                        <strong>Mug</strong>
                        <small>Steal some cash on hand</small>
                      </button>

                      <button
                        type="button"
                        className="combat-finish-button combat-finish-hospitalize"
                        onClick={() =>
                          handleFinish("hospitalize")
                        }
                      >
                        <span>🏥</span>
                        <strong>Hospitalize</strong>
                        <small>Send them to the hospital longer</small>
                      </button>
                    </div>
                  </>
                ) : (
                  <p>Resolving combat rewards...</p>
                )}
              </div>
            )}

            {winner === "enemy" && (
              <div className="combat-result combat-result-defeat">
                <div className="combat-result-icon">🏥</div>
                <div className="combat-result-label">
                  DEFEATED
                </div>
                <h2>You were knocked out.</h2>
                <p>
                  You were defeated and sent to the hospital.
                </p>
              </div>
            )}
          </div>

          <CombatLog logs={combatLogs} />
        </div>
      </div>
    </div>
  );
}
