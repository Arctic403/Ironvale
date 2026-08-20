import React from "react";
import type { Screen } from "../../types/riftCity";

type NavigationItem = {
  id: Screen;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavigationItem[] = [
  { id: "character", label: "Character", icon: "👤" },
  { id: "city", label: "City", icon: "🏙️" },
  { id: "crimes", label: "Crimes", icon: "🕵️" },
  { id: "combat", label: "Combat", icon: "⚔️" },
  { id: "gym", label: "Gym", icon: "🏋️" },
  { id: "jobs", label: "Jobs", icon: "💼" },
  { id: "inventory", label: "Inventory", icon: "🎒" },
  { id: "shops", label: "Shops", icon: "🛒" },
  { id: "missions", label: "Missions", icon: "📜" },
  { id: "education", label: "Education", icon: "🎓" },
  { id: "property", label: "Property", icon: "🏠" },
  { id: "market", label: "Market", icon: "📈" },
  { id: "faction", label: "Faction", icon: "🛡️" },
  { id: "awards", label: "Awards", icon: "🏆" },
  { id: "progression", label: "Progression", icon: "🧬" },
];

type NavigationProps = {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onExplore: () => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
};

export function Navigation({
  currentScreen,
  onNavigate,
  onExplore,
  onReset,
  isOpen,
  onClose,
}: NavigationProps) {
  return (
    <aside className={`nav-rail drawer-nav ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
      <div className="brand drawer-brand">
        <div>
          <h2>RIFTCITY</h2>
          <p className="drawer-subtitle">Quick navigation and shortcuts</p>
        </div>

        <div className="drawer-brand-actions">
          <span className="badge">v2.6</span>
          <button type="button" className="drawer-close" aria-label="Close menu" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div className="drawer-section drawer-shortcuts">
        <button className="btn-secondary drawer-shortcut-btn" onClick={onExplore}>
          🗺 Open City Map
        </button>

        <button
          className="btn-danger-ghost drawer-shortcut-btn"
          onClick={() => {
            if (window.confirm("Reset RiftCity and erase this local save?")) {
              onReset();
              onClose();
            }
          }}
        >
          ↻ Reset Save
        </button>
      </div>

      <nav className="nav-list drawer-nav-list">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentScreen === item.id ? "active" : ""}`}
            aria-current={currentScreen === item.id ? "page" : undefined}
            onClick={() => {
              onNavigate(item.id);
              onClose();
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-copy">
              <span className="nav-label">{item.label}</span>
              <small>Open {item.label}</small>
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

const LOCATION_TITLES: Partial<Record<Screen, string>> = {
  bank: "RiftCity Bank",
  hospital: "RiftCity Hospital",
  jail: "RiftCity Jail",
  police: "Police Department",
  pharmacy: "RiftCare Pharmacy",
  casino: "The Rift Casino",
  nightclub: "Pulse Nightclub",
  blackmarket: "Black Market",
  park: "Central Park",
  downtown: "Downtown",
  airport: "RiftCity Airport",
};

export function getScreenTitle(screen: Screen) {
  return NAV_ITEMS.find((item) => item.id === screen)?.label || LOCATION_TITLES[screen] || "RiftCity";
}
