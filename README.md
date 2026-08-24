# RiftCity V2 — Phase 2

Phase 2 builds persistent player state on top of the working Phase 1 authentication/session foundation.

## Phase 1 foundation retained

- Cloudflare Worker backend
- Cloudflare D1
- Register / login / logout
- 7-day HttpOnly sessions
- Player IDs and roles
- PBKDF2-SHA256 password hashing using Cloudflare-supported iterations
- Audit logging
- Built-in RiftCity developer/error logs at `/admin/logs`

## Phase 2 added

Each player now has a persistent `player_state` record containing:

- Health: 100 / 100
- Nerve: 10 / 10
- Energy: 100 / 100
- Cash: $0
- Level: 1
- XP: 0
- Strength: 1
- Defense: 1
- Speed: 1
- Dexterity: 1
- Status: `active`
- Optional status end time/reason fields for future jail, hospital, travel, and combat systems

Existing accounts are supported. On the first authenticated request after Phase 2 deploys, RiftCity automatically creates the `player_state` table if needed and creates the missing state row for that user. No manual D1 SQL migration is required for the existing deployment.

`schema.sql` is also updated so fresh databases get the full Phase 1 + Phase 2 schema.

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me` — now returns both account and player state
- `GET /api/player/state` — authenticated player-state endpoint
- `GET /api/health`
- `GET /api/admin/logs` — temporarily public during development

## Cloudflare Git deployment

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

The Worker name is set to `riftcityv1` to match the currently connected Cloudflare build project. The existing D1 binding is preserved.

## Development note

The developer log viewer is still intentionally public while RiftCity is private development-only. Lock `/admin/logs` back to admin/developer roles before giving other people access to the game.

## Phase boundary

Phase 2 only establishes player state. It does not yet add regeneration timers, training, crimes, inventory, banking, combat actions, or economy transactions. Those systems can now build against one consistent persistent player model.
