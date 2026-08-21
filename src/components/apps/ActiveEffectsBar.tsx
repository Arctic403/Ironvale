import React from "react";
import type { useRiftCity } from "../../hooks/useRiftCity";
import { WORLD_EVENTS } from "../../data/expansion";
import { formatTime, timeLeft } from "../../core/gameCore";
import { CRIME_OPERATIONS } from "../../systems/crimeActivities";
import { GameIcon, type GameIconName } from "../GameIcon";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type EffectTone = "positive" | "warning" | "danger" | "neutral";

type ActiveEffect = {
  id: string;
  label: string;
  detail?: string;
  remaining?: number;
  icon: GameIconName;
  tone: EffectTone;
};

function remaining(until: number | null | undefined, now: number) {
  if (!until || until <= now) return 0;
  return timeLeft(until);
}

export function ActiveEffectsBar({ g, now }: { g: RiftCityGame; now: number }) {
  const effects: ActiveEffect[] = [];

  const jail = remaining(g.gameState.jailUntil, now);
  if (jail > 0) {
    effects.push({
      id: "jail",
      label: "Jailed",
      detail: g.gameState.jailReason || "Actions restricted",
      remaining: jail,
      icon: "lock",
      tone: "danger",
    });
  }

  const hospital = remaining(g.gameState.hospitalUntil, now);
  if (hospital > 0) {
    effects.push({
      id: "hospital",
      label: "Hospitalized",
      detail: g.gameState.hospitalReason || "Recovering",
      remaining: hospital,
      icon: "hospital",
      tone: "danger",
    });
  }

  const bankFrozen = remaining(g.gameState.bankFrozenUntil, now);
  if (bankFrozen > 0) {
    effects.push({
      id: "bank-frozen",
      label: "Bank Frozen",
      detail: "Domestic bank access restricted",
      remaining: bankFrozen,
      icon: "bank",
      tone: "danger",
    });
  }

  const offshoreProtected = remaining(g.gameState.offshoreProtectedUntil, now);
  if (offshoreProtected > 0) {
    effects.push({
      id: "offshore-protected",
      label: "Offshore Protection",
      detail: "Protected after a breach",
      remaining: offshoreProtected,
      icon: "shield",
      tone: "positive",
    });
  }

  const travel = remaining(g.gameState.travelCooldownUntil, now);
  if (travel > 0) {
    effects.push({
      id: "travel",
      label: "Travel Cooldown",
      detail: "Travel is temporarily unavailable",
      remaining: travel,
      icon: "airport",
      tone: "neutral",
    });
  }

  const worldEvent = WORLD_EVENTS.find((event) => event.id === g.gameState.activeWorldEvent);
  const worldEventRemaining = remaining(g.gameState.worldEventUntil, now);
  if (worldEvent && worldEventRemaining > 0) {
    effects.push({
      id: `world-${worldEvent.id}`,
      label: worldEvent.name,
      detail: worldEvent.effect,
      remaining: worldEventRemaining,
      icon: "spark",
      tone: worldEvent.id === "guard-crackdown" ? "warning" : "positive",
    });
  }

  const readyBatches = g.gameState.activeProductions.filter((batch) => batch.finishesAt <= now);
  if (readyBatches.length > 0) {
    effects.push({
      id: "production-ready",
      label: readyBatches.length === 1 ? "Production Ready" : `${readyBatches.length} Productions Ready`,
      detail: "Return to the Black Market to claim finished output",
      icon: "package",
      tone: "positive",
    });
  }

  const activeBatches = g.gameState.activeProductions.filter((batch) => batch.finishesAt > now);
  if (activeBatches.length > 0) {
    const soonest = Math.min(...activeBatches.map((batch) => batch.finishesAt));
    effects.push({
      id: "production",
      label: activeBatches.length === 1 ? "Production Running" : `${activeBatches.length} Productions Running`,
      detail: "Black Market production batch active",
      remaining: Math.max(0, soonest - now),
      icon: "lab",
      tone: "warning",
    });
  }

  if (g.gameState.productionAttention > 0) {
    effects.push({
      id: "production-attention",
      label: "Production Attention",
      detail: `${Math.floor(g.gameState.productionAttention)} attention from repeated production`,
      icon: "warning",
      tone: g.gameState.productionAttention >= 50 ? "danger" : "warning",
    });
  }

  const readyCrimeOps = g.gameState.activeCrimeOperations.filter((operation) => operation.finishesAt <= now);
  if (readyCrimeOps.length > 0) {
    effects.push({
      id: "crime-ops-ready",
      label: readyCrimeOps.length === 1 ? "Crime Operation Ready" : `${readyCrimeOps.length} Crime Operations Ready`,
      detail: "Return to Crimes → Operations to collect the result",
      icon: "crimes",
      tone: "positive",
    });
  }

  const runningCrimeOps = g.gameState.activeCrimeOperations.filter((operation) => operation.finishesAt > now);
  if (runningCrimeOps.length > 0) {
    const soonest = runningCrimeOps.reduce((best, operation) => operation.finishesAt < best.finishesAt ? operation : best, runningCrimeOps[0]);
    const definition = CRIME_OPERATIONS.find((operation) => operation.id === soonest.operationId);
    effects.push({
      id: "crime-ops-running",
      label: runningCrimeOps.length === 1 ? "Crime Operation Running" : `${runningCrimeOps.length} Crime Operations Running`,
      detail: definition?.name ?? "Passive criminal operation active",
      remaining: Math.max(0, soonest.finishesAt - now),
      icon: "clock",
      tone: "warning",
    });
  }

  return (
    <section className="active-effects-bar" aria-label="Active effects">
      <div className="active-effects-label">
        <GameIcon name="spark" size={13} />
        <span>EFFECTS</span>
      </div>
      <div className="active-effects-scroll">
        {effects.length === 0 ? (
          <span className="effect-empty">No active timed effects</span>
        ) : (
          effects.map((effect) => (
            <div key={effect.id} className={`effect-chip ${effect.tone}`} title={effect.detail}>
              <GameIcon name={effect.icon} size={13} />
              <span className="effect-chip-copy">
                <strong>{effect.label}</strong>
                {effect.detail && <small>{effect.detail}</small>}
              </span>
              {typeof effect.remaining === "number" && effect.remaining > 0 && (
                <time>{formatTime(effect.remaining)}</time>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
