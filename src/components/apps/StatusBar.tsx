import React from "react";
import type { ActiveModal } from "../../types/riftCity";
import type { useRiftCity } from "../../hooks/useRiftCity";
import { money } from "../../core/gameCore";
import { getLevel } from "../../systems/progressionSystem";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type StatusBarProps = {
  g: RiftCityGame;
  setActiveModal: React.Dispatch<
    React.SetStateAction<ActiveModal>
  >;
};

export function StatusBar({
  g,
  setActiveModal,
}: StatusBarProps) {
  const levelInfo = getLevel(g.gameState.xp);

  return (
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
          justifyContent: "space-between",
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
              whiteSpace: "nowrap",
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
              XP {levelInfo.currentXp}/100
            </div>

            <div
              className="bar-track compact"
              style={{
                height: "4px",
                background: "#222",
              }}
            >
              <div
                className="bar-fill xp"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, levelInfo.currentXp)
                  )}%`,
                  height: "100%",
                  background: "#3b82f6",
                }}
              />
            </div>
          </div>
        </div>

        <div
          className="compact-vitals"
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <VitalButton
            icon="⚡"
            value={g.gameState.energy}
            onClick={() => setActiveModal("energy")}
          />

          <VitalButton
            icon="🔥"
            value={g.gameState.nerve}
            onClick={() => setActiveModal("nerve")}
          />

          <VitalButton
            icon="😊"
            value={Math.floor(g.gameState.happiness)}
            onClick={() => setActiveModal("happy")}
          />

          <VitalButton
            icon="❤️"
            value={Math.floor(g.gameState.health)}
            onClick={() => setActiveModal("health")}
          />
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
          💵 {money(g.gameState.cash)}
        </div>

        <div>
          🏦 {money(g.gameState.bank)}
        </div>

        <div>
          💎 {g.gameState.points} Pts
        </div>
      </div>
    </header>
  );
}

type VitalButtonProps = {
  icon: string;
  value: number;
  onClick: () => void;
};

function VitalButton({
  icon,
  value,
  onClick,
}: VitalButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: "inherit",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "2px",
      }}
    >
      <span
        style={{
          fontSize: "16px",
        }}
      >
        {icon}
      </span>

      <span
        style={{
          fontSize: "12px",
          fontWeight: "bold",
        }}
      >
        {value}
      </span>
    </button>
  );
}
