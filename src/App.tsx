import React from "react";

import AppShell from "./components/AppShell";
import { DEV_TOOLS } from "./config/devTools";
import DevAdminPage from "./pages/DevAdminPage";
import { normalizePath } from "./routing/routes";

export default function App() {
  const path = normalizePath(window.location.pathname);

  if (path === DEV_TOOLS.route) {
    return <DevAdminPage />;
  }

  return <AppShell />;
}
