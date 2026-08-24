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
3. `npm run build` can be used by Cloudflare as the build command. It validates the Worker and browser JavaScript without producing a separate frontend bundle.
4. Sign in to Cloudflare with `npx wrangler login`.
5. Create the database:
   `npx wrangler d1 create riftcity-v2`
6. Copy the returned database ID into `wrangler.toml` in place of `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
7. Apply the schema:
   `npm run db:migrate:remote`
8. Deploy:
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

## Cloudflare Git build settings

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

Before the first deploy, create the D1 database and replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml` with the real database ID.

## Built-in RiftCity system logs

Phase 1 now stores backend events/errors in D1 and exposes an admin/developer-only viewer at:

`/admin/logs`

Unhandled API errors return a short ID such as `RC-8F2A91C0`. Search the log viewer for the matching entry to see the route, request ID, error message, context, and stack trace.

The logger creates its own `system_logs` table automatically on first use. Running `schema.sql` is still recommended for the full Phase 1 database schema.

### Give your account developer access

Accounts are intentionally created with the `player` role. In the Cloudflare D1 SQL console, run this once after creating your account (replace the username):

```sql
UPDATE users SET role = 'developer' WHERE username = 'YOUR_USERNAME';
```

Log out and back in afterward so the developer log viewer reflects the updated role.
