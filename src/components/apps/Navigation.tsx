import React from "react";
import type { Screen } from "../../types/riftCity";

type NavigationItem = {
  id: Screen;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavigationItem[] = [
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
    id: "inventory",
    label: "Inventory",
    icon: "🎒",
  },
  {
    id: "shops",
    label: "Shops",
    icon: "🛒",
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
  {
    id: "progression",
    label: "Progression",
    icon: "🧬",
  },
];

type NavigationProps = {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onExplore: () => void;
  onReset: () => void;
};

export function Navigation({
  currentScreen,
  onNavigate,
  onExplore,
  onReset,
}: NavigationProps) {
  return (
    <aside className="nav-rail">
      <div className="brand">
        <h2>RIFTCITY</h2>

        <span className="badge">
          v2.5
        </span>
      </div>

      <nav className="nav-list">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${
              currentScreen === item.id
                ? "active"
                : ""
            }`}
            aria-current={currentScreen === item.id ? "page" : undefined}
            onClick={() =>
              onNavigate(item.id)
            }
          >
            <span className="nav-icon">
              {item.icon}
            </span>

            <span className="nav-label">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="nav-footer">
        <button
          className="btn-secondary"
          onClick={onExplore}
        >
          🎲 Explore
        </button>

        <button
          className="btn-danger-ghost"
          onClick={() => {
            if (window.confirm("Reset RiftCity and erase this local save?")) {
              onReset();
            }
          }}
        >
          ↻ Reset
        </button>
      </div>
    </aside>
  );
}

export function getScreenTitle(
  screen: Screen
) {
  return (
    NAV_ITEMS.find(
      (item) => item.id === screen
    )?.label || "RiftCity"
  );
}
