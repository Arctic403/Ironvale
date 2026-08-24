# RiftCity V2 — Phase 3: City + Location Engine

Phase 3 builds the first persistent world layer on top of the working Phase 2.2 industrial UI.

## Added in Phase 3

- Data-driven city with five districts: Downtown, Harbour, Industrial, Residential, and Casino District
- Reusable district/location definitions served by the Worker API
- Persistent player location stored in D1
- Existing players automatically receive the default location `Downtown / Central Plaza`
- District → location navigation on desktop and mobile
- Working **Enter location** action that updates D1
- Location metadata, status, tags, requirements, and future feature actions
- Current position shown in the City interface
- New world endpoints: `/api/world`, `/api/world/districts/:id`, `/api/world/locations/:id`, `/api/world/travel`
- Existing authentication, sessions, player state, PBKDF2 fix, dev logger, and industrial UI preserved

## D1 setup

No manual migration is required for an already-running Phase 2 database. The Worker creates the `player_location` table and its indexes automatically the first time the world/location system is used.

`schema.sql` also contains the Phase 3 table for fresh databases.

## Cloudflare build settings

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

## Phase 3 scope

Locations are intentionally the world/navigation engine only. Crime, item, shop, casino, and NPC gameplay is represented as future-capable location actions but is not implemented here yet.
