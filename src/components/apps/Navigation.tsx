import React from "react";
import type { Screen } from "../../types/riftCity";
import { getNavigationRoutes, getRouteTitle, screenToPath } from "../../routing/routes";

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
  const navItems = getNavigationRoutes();

  return (
    <aside className={`nav-rail drawer-nav ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
      <div className="brand drawer-brand">
        <div>
          <h2>RIFTCITY</h2>
          <p className="drawer-subtitle">Quick navigation and shortcuts</p>
        </div>

        <div className="drawer-brand-actions">
          <span className="badge">v2.7</span>
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
        {navItems.map((item) => (
          <a
            key={item.screen}
            href={screenToPath(item.screen)}
            className={`nav-item ${currentScreen === item.screen ? "active" : ""}`}
            aria-current={currentScreen === item.screen ? "page" : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate(item.screen);
              onClose();
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-copy">
              <span className="nav-label">{item.navLabel}</span>
              <small>Open {item.navLabel}</small>
            </span>
          </a>
        ))}
      </nav>
    </aside>
  );
}

export function getScreenTitle(screen: Screen) {
  return getRouteTitle(screen);
}
