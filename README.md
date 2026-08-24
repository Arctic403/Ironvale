# RiftCity V2 — Phase 4: Direct-Open City Locations

This build keeps the Phase 4.1 direct city hub and removes the extra location preview/enter step.

## Phase 4 behavior

- City locations are displayed directly in the City directory.
- Tapping/clicking any location immediately moves the player there and opens its location page.
- No inspector panel.
- No second **Open location** / **Enter location** button.
- Location routes use `#city/<location-id>` so browser back/forward and refresh work correctly.
- Directly opening a location route also syncs the player's persistent D1 location.
- Each location page has a **← City** link and an area ready for that location's future gameplay module.
- Existing world data, authentication, player state, D1 persistence, and developer logs are preserved.

## D1 setup

No new database migration is required for Phase 4.

## Cloudflare build settings

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

## Current world scope

The location pages are navigation shells for now. Hospital, jail, shops, bank, casino, education, gym and other gameplay modules will be plugged into these pages in later phases.


## Phase 4: Item + Inventory Engine

Phase 4 adds a server-authoritative, generic inventory engine. Individual item definitions live in `src/items.js` as registry/config data so future items can be added without rewriting inventory mechanics.

Starter registry:
- First Aid Kit
- Knife
- Energy Drink
- Candy Bar
- Cheap Watch
- Screwdriver
- Key
- Ticket

New API routes:
- `GET /api/items`
- `GET /api/items/:id`
- `GET /api/inventory`
- `POST /api/inventory/use`
- `POST /api/inventory/equip`
- `POST /api/inventory/unequip`

The `player_inventory` D1 table self-creates on the first inventory request. `schema.sql` also contains the table for clean deployments.

The backend includes generic `addItemToInventory()` and `removeItemFromInventory()` helpers for future shops, crimes, rewards, drops and admin tools. They are intentionally not exposed as public grant endpoints.

## JavaScript-only architecture

This repository is intentionally JavaScript-only end to end:

- Cloudflare Worker/API: `src/*.js`
- Browser client: `public/*.js`
- Wrangler entry point: `src/index.js`
- No TypeScript source files, declaration files, `tsconfig`, TypeScript compiler, `ts-node`, `tsx`, or `@types/*` packages are required.
- `npm run build` runs a JS-only guard first and fails if TypeScript is introduced later.

Wrangler still bundles the Worker for Cloudflare deployment, but RiftCity's source code and project configuration remain JavaScript-only.

## Phase 5 — Server-authoritative crime engine

- Persistent D1 player crime mastery and attempt history.
- `GET /api/crimes` returns server-calculated availability/chances.
- `POST /api/crimes/execute` spends nerve and resolves success/failure entirely in the Worker.
- Cash, XP/level progress, item drops and jail/hospital consequences are committed server-side.
- Crime rewards write directly into the existing D1 inventory engine.
- Client JavaScript only renders the server result; it does not choose outcomes or reward amounts.

