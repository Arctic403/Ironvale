import React from "react";
import type { ActiveModal } from "../../types/riftCity";
import type { useRiftCity } from "../../hooks/useRiftCity";
import {
  formatTime,
} from "../../core/gameCore";
import { GameIcon } from "../GameIcon";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type ResourceModalProps = {
  g: RiftCityGame;
  activeModal: ActiveModal;
  setActiveModal: React.Dispatch<
    React.SetStateAction<ActiveModal>
  >;
  energyNextTick: number;
  nerveNextTick: number;
  happyNextTick: number;
  maxHappy: number;
};

export function ResourceModal({
  g,
  activeModal,
  setActiveModal,
  energyNextTick,
  nerveNextTick,
  happyNextTick,
  maxHappy,
}: ResourceModalProps) {
  if (!activeModal) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={() => setActiveModal(null)}
    >
      <div
        className="modal-card"
        style={{
          background: "#18181b",
          padding: "20px",
          borderRadius: "8px",
          minWidth: "240px",
          border: "1px solid #3f3f46",
          textAlign: "center",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {activeModal === "energy" && (
          <>
            <h2 className="icon-title"><GameIcon name="energy" size={21} /> Energy</h2>

            <ResourceValue>
              {g.gameState.energy} / {g.maxEnergy}
            </ResourceValue>

            <ResourceDescription>
              {g.gameState.energy >= g.maxEnergy
                ? "Fully charged"
                : `Next +1 tick in: ${formatTime(
                    energyNextTick
                  )}`}
            </ResourceDescription>
          </>
        )}

        {activeModal === "nerve" && (
          <>
            <h2 className="icon-title"><GameIcon name="nerve" size={21} /> Nerve</h2>

            <ResourceValue>
              {g.gameState.nerve} / {g.maxNerve}
            </ResourceValue>

            <ResourceDescription>
              {g.gameState.nerve >= g.maxNerve
                ? "At capacity"
                : `Next +1 tick in: ${formatTime(
                    nerveNextTick
                  )}`}
            </ResourceDescription>
          </>
        )}

        {activeModal === "happy" && (
          <>
            <h2 className="icon-title"><GameIcon name="happy" size={21} /> Happiness</h2>

            <ResourceValue>
              {Math.floor(g.gameState.happiness)} / {maxHappy}
            </ResourceValue>

            <ResourceDescription>
              {g.gameState.happiness >= maxHappy
                ? "Max happiness"
                : `Next +5 tick in: ${formatTime(
                    happyNextTick
                  )}`}
            </ResourceDescription>
          </>
        )}

        {activeModal === "health" && (
          <>
            <h2 className="icon-title"><GameIcon name="health" size={21} /> Health</h2>

            <ResourceValue>
              {Math.floor(g.gameState.health)} / {g.maxHealth}
            </ResourceValue>

            <ResourceDescription>
              {g.gameState.health >= g.maxHealth
                ? "Full health"
                : "Regenerates over time"}
            </ResourceDescription>
          </>
        )}

        <button
          className="btn-primary"
          style={{
            marginTop: "16px",
            width: "100%",
          }}
          onClick={() => setActiveModal(null)}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ResourceValue({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p
      style={{
        fontSize: "20px",
        fontWeight: "bold",
        margin: "12px 0",
      }}
    >
      {children}
    </p>
  );
}

function ResourceDescription({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p
      style={{
        color: "#a1a1aa",
      }}
    >
      {children}
    </p>
  );
}
