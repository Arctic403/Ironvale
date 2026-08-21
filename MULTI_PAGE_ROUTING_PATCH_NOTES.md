# RiftCity Multi-Page Routing Refactor

## What changed
- Every major game destination now has a canonical browser URL instead of behaving like one giant hidden-panel page.
- Browser Back/Forward now changes RiftCity screens correctly.
- Direct links such as `/combat`, `/bank`, `/black-market`, `/airport`, and `/property` resolve to the matching game page.
- The shared HUD, resource status, navigation drawer, activity drawer, save state, timers, and encounter layer remain mounted as the persistent app shell.
- Feature content is now loaded through dedicated page modules under `src/pages/`.
- Page modules are lazy-loaded so the browser does not need to initialize every feature page immediately.
- Existing game systems and `setCurrentScreen(...)` calls continue to work; navigation now updates browser history automatically.

## Architecture
- `src/components/AppShell.tsx`: persistent MMO shell/HUD.
- `src/routing/routes.ts`: canonical route registry and screen/path mapping.
- `src/pages/*Page.tsx`: route-level feature page boundaries.
- `src/components/apps/ScreenContent.tsx`: lazy route-to-page outlet.
- `src/hooks/useRiftCity.ts`: shared game state plus URL/history synchronization.

## Canonical routes
`/city`, `/character`, `/crimes`, `/combat`, `/gym`, `/jobs`, `/inventory`, `/shops`, `/missions`, `/education`, `/property`, `/market`, `/faction`, `/awards`, `/progression`, `/bank`, `/hospital`, `/jail`, `/police`, `/pharmacy`, `/casino`, `/nightclub`, `/black-market`, `/park`, `/downtown`, `/airport`.

## Hosting note
RiftCity is still a Vite single-page application with real client-side routes. Production hosting must use an SPA fallback/rewrite so direct requests such as `/combat` serve `index.html`.
