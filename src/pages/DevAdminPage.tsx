import React, { useCallback, useState } from "react";

import { DEV_TOOLS } from "../config/devTools";

export default function DevAdminPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const returnToCity = useCallback(() => {
    window.location.assign("/city");
  }, []);

  if (!DEV_TOOLS.enabled) {
    return (
      <main className="dev-admin-disabled">
        <div className="dev-admin-disabled-card">
          <span>RIFTCITY</span>
          <h1>Developer tools disabled</h1>
          <p>This build does not expose the in-game development workspace.</p>
          <button type="button" onClick={returnToCity}>Return to City</button>
        </div>
      </main>
    );
  }

  return (
    <main className="dev-admin-root">
      <header className="dev-admin-bar">
        <div className="dev-admin-title">
          <span className="dev-admin-kicker">RIFTCITY INTERNAL</span>
          <strong>Developer Console</strong>
        </div>

        <div className="dev-admin-actions">
          <button type="button" onClick={() => setShowInfo((open) => !open)}>
            {showInfo ? "Hide Info" : "Info"}
          </button>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Reload Editor
          </button>
          <button type="button" className="dev-admin-exit" onClick={returnToCity}>
            Exit to City
          </button>
        </div>
      </header>

      {showInfo && (
        <section className="dev-admin-notice">
          <strong>Development-only workspace.</strong>
          <span>
            GitHub credentials entered in the editor are stored in this browser's local storage.
            The React route switch is not a security boundary; protect or remove this tool at the
            Cloudflare/server layer before public launch.
          </span>
        </section>
      )}

      <section className="dev-admin-frame-shell">
        <iframe
          key={reloadKey}
          className="dev-admin-frame"
          src={DEV_TOOLS.editorPath}
          title="RiftCity developer workspace"
          allow="clipboard-read; clipboard-write"
        />
      </section>
    </main>
  );
}
