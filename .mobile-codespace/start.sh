#!/usr/bin/env bash
set -u
cd "${CODESPACE_VSCODE_FOLDER:-$(pwd)}"

# Keep the bridge behind GitHub's private Codespaces port authentication.
# Public visibility is intentionally NOT required.
if ! pgrep -f "node .mobile-codespace/server.mjs" >/dev/null 2>&1; then
  nohup node .mobile-codespace/server.mjs > /tmp/mobile-codespace-bridge.log 2>&1 &
fi

exit 0
