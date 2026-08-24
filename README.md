# RiftCity V2 — Phase 1

Fresh-start Phase 1 foundation for RiftCity.

## Included

- Cloudflare Worker backend
- Cloudflare D1 database schema
- Register
- Login
- Logout
- Persistent 7-day HttpOnly sessions
- Player IDs
- Username validation
- Password hashing using PBKDF2-SHA256 via Web Crypto
- Roles: player / moderator / admin / developer
- Created date
- Last active tracking
- Online session state
- Ban fields ready for later admin tooling
- Audit log table
- Minimal responsive test UI

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Sign in to Cloudflare with `npx wrangler login`.
4. Create the database:
   `npx wrangler d1 create riftcity-v2`
5. Copy the returned database ID into `wrangler.toml` in place of `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
6. Apply the schema:
   `npm run db:migrate:remote`
7. Deploy:
   `npm run deploy`

For local development after configuring D1:

- `npm run db:migrate:local`
- `npm run dev`

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/health`

## Phase boundary

This ZIP intentionally does NOT add stats, inventory, crimes, money, city map, casino, combat, market, or other gameplay systems. Those belong to later phases so the authentication/account foundation stays clean.
