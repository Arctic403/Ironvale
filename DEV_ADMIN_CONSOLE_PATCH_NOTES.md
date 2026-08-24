# RiftCity Developer/Admin Console Patch

## What was added

- Hidden development route: `/admin-dev`
- The existing custom Mobile Workspace editor is embedded into RiftCity as the internal developer console.
- The editor is intentionally NOT added to normal player navigation.
- Existing editor GitHub repo/branch/pull/push, workspace, tabs, history, search and file-management code is preserved.
- Added an editor reload control and a clean Exit to City control.
- Added a single development kill switch in `src/config/devTools.ts`.

## Files added

- `src/config/devTools.ts`
- `src/pages/DevAdminPage.tsx`
- `public/dev-editor/index.html`
- `public/dev-editor/style.css`
- `public/dev-editor/app-safari-v11.js`
- `public/dev-editor/ide-v11.js`

## Files changed

- `src/App.tsx`
- `src/styles.css`

## Disabling later

Set `DEV_TOOLS.enabled` to `false` in `src/config/devTools.ts` to disable the React admin route.

That switch is a convenience feature flag, NOT authentication. The static editor files still exist at `/dev-editor/` in the built site. Before RiftCity is publicly launched, protect/remove `/admin-dev` and `/dev-editor/*` at the Cloudflare/server layer (or remove the files entirely). Cloudflare Access is a suitable way to make the dev area actually private.

## Credential note

The imported editor keeps its existing behavior and stores the GitHub PAT in browser localStorage. Do not use the admin console on an untrusted/shared device. For a production-grade admin system, move GitHub write credentials server-side behind authenticated Worker endpoints rather than exposing a PAT to browser JavaScript.
