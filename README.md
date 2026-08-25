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

## Plugin architecture

Gameplay definitions now live under `src/plugins/` while `src/index.js` stays focused on generic server engines and persistence:

- `src/plugins/crimes.js` — crime definitions, requirements, reward pools, chances and consequence tuning.
- `src/plugins/items.js` — item definitions and item lookup/public-shape helpers.
- `src/plugins/world.js` — city categories, locations, tags, requirements and service descriptors.
- `src/plugins/index.js` — the single registry surface imported by the Worker.
- `src/items.js` remains as a compatibility re-export so older imports do not break.

This means content can be added/tuned without rewriting the generic crime, inventory, travel, D1, authentication or audit engines. Future systems such as shops, gyms, bank products, casino games, jobs and location services should follow the same plugin/config pattern when their engines are added.

### Crime result UI

Crime attempts now render their server result directly inside the crime card that was attempted. Successes, failures and blocked/error results stay attached to that crime and display reward/progression details without using the global toast as the result surface.



## Phase 6 — Massive server-authoritative backend foundation

The V1 feature build is now treated as a feature target, not as code to copy. Phase 6 rebuilds the reusable backend spine in JavaScript/Cloudflare/D1.

### New plugin families
- `jobs.js` — five career ladders and pay/skill tuning.
- `education.js` — timed courses, costs, level requirements and bonuses.
- `gym.js` — RiftCity's program-based gym progression.
- `banking.js` — checking/savings rules and investment tiers.
- `properties.js` — residence catalog and home bonuses.
- `factions.js` — faction identities and rank thresholds.
- `missions.js` — connected mission targets/rewards.
- `markets.js` — fictional RiftCity market assets/pricing.
- `events.js` — rotating world-event definitions.
- `shops.js` — location-aware store inventories and pricing.
- `casino.js` — in-game chip account/game catalog foundation; no real-money wagering.

### Persistent service engine
`src/services/gameplay.js` owns the generic D1-backed service engine. It creates/uses persistent tables for banking, investments, careers, education, gym progression, properties, factions, shared progression counters, missions, fictional market holdings, player auction listings and casino chips.

All service routes are authenticated:
- `GET /api/services` — installed service catalog.
- `GET /api/services/:service` — current catalog + player state for that system.
- `POST /api/services/:service` — execute a server-authoritative action.

Implemented service IDs:
`bank`, `jobs`, `education`, `gym`, `properties`, `factions`, `missions`, `market`, `shop`, `auction`, `status`, `events`, `casino`.

Important POST actions include:
- bank: `deposit`, `withdraw`, `to-savings`, `from-savings`, `invest`, `claim-investment`
- jobs: `join`, `work`
- education: `enroll`
- gym: `train`
- properties: `buy`, `set-home`
- factions: `join`, `work`, `leave`
- missions: `claim`
- market: `buy`, `sell`
- shop: `buy`, `sell`
- auction: `list`, `buy`, `cancel`
- casino: `claim-daily` (game implementations remain a later tuning pass)

Crime successes, city travel, job shifts, gym sessions, faction work and cash milestones now feed shared server-side progression counters used by missions. Existing crime/item/world engines remain intact.


## Phase 7 — Integrated backend engines

Phase 7 turns the Phase 6 service foundation into a connected game backend. This pass remains backend-first and keeps tunable content inside plugins.

### New server-authoritative systems
- `combat` — NPC encounters plus asynchronous player-vs-player resolution, equipped-weapon stats, XP, cooldowns, combat history and hospital consequences.
- `travel` — persistent international regions, fares, level gates, travel timers and arrival settlement.
- `offshore` — destination-gated offshore accounts with transfer fees and a bank-security state hook.
- `achievements` — persistent lifetime unlocks driven by shared progression counters.
- `challenges` — rotating daily/weekly challenges with period baselines so only progress made during the active period counts.
- `production` — purchasable facilities, concurrent slots, timed batches, inventory outputs and server-side claiming.
- property passive economy — upkeep/income values, hourly collection and a property ledger.

### Cross-system modifiers
Completed education and the active world event now feed a shared modifier layer:
- crime courses and crime events affect server crime success chance;
- fitness courses and training events affect gym stat gains;
- combat education/events affect combat power;
- job events can affect shift pay;
- market events scale fictional city-market volatility.

Active-home property bonuses are reconciled against stored applied bonuses so switching homes changes max health/nerve without stacking the same bonus repeatedly.

### Connected progression
Shared counters now cover combat wins, banking deposits, education completions, property ownership, market trades, international travel, casino visits and production completions in addition to the existing crime/job/gym/faction/cash counters. Missions, achievements and challenges reuse those counters instead of inventing separate progress systems.

### New plugin files
- `src/plugins/combat.js`
- `src/plugins/travel.js`
- `src/plugins/achievements.js`
- `src/plugins/challenges.js`
- `src/plugins/production.js`

`src/services/advanced.js` owns the new D1-backed engines while `src/services/gameplay.js` remains the service router and Phase 6 engine collection.

### New service IDs
`combat`, `travel`, `offshore`, `achievements`, `challenges`, `production`

The service contract remains:
- `GET /api/services/:service`
- `POST /api/services/:service`

The browser UI is intentionally not expanded in this backend pass; location/service UI can be wired after the backend behavior is tested.


## Phase 8 — Frontend restoration + full service integration

Phase 8 rebuilds the browser client around the server-authoritative backend instead of reviving the original V1 React/TypeScript/local-simulation architecture.

### Frontend architecture

The browser remains plain ES-module JavaScript:

- `public/ui/api.js` — authenticated API helper.
- `public/ui/state.js` — small shared render/session state.
- `public/ui/router.js` — hash routing and legacy route aliases.
- `public/ui/shell.js` — compact HUD, effects strip, drawer navigation, session/auth UI.
- `public/views/character.js` — player dashboard.
- `public/views/city.js` — city network, district map presentation and real location/service launching.
- `public/views/crimes.js` — server-authoritative crime careers with inline results.
- `public/views/inventory.js` — filterable inventory and item inspector.
- `public/views/service.js` — service-page dispatcher.
- `public/views/services/*.js` — finance, progression, world and combat service screens.
- `public/views/wiki.js` — RiftCity Field Manual.

`public/app.js` is now the bootstrap/router entry point instead of the entire frontend.

### Restored V1-style game coverage

The browser now has usable screens for:

- Character / progression overview
- City and individual locations
- Crimes and attempt history
- Inventory / item actions
- Combat / NPC and asynchronous player attacks
- Bank / savings / investments
- Offshore banking
- Jobs / careers
- Education
- Gym programs
- Properties
- Factions
- Missions
- Achievements
- Daily / weekly challenges
- Fictional city market
- Shops
- Player Exchange / Black Market
- International travel
- Production
- Hospital / jail status
- World events
- Casino chip account + game-floor catalog
- Field Manual

Nightclub, police, park and downtown route shells are restored without inventing client-side outcomes; they clearly remain locked until matching server engines are installed.

### UI rules

- Compact sticky HUD for level/resources/stats.
- Active server-timed effects strip.
- Mobile-first bottom navigation plus a full drawer.
- Inline action results where practical.
- Location actions route to real service pages.
- Browser back/forward and deep hash routes work.
- No frontend-generated crime/combat/economy outcomes.
- Casino UI does not fabricate games that the backend has not enabled.

### Build validation

`npm run build` now uses `scripts/check-js.js` to recursively syntax-check every JavaScript module under `src`, `public` and `scripts`, so future frontend modules are automatically included without manually extending the package script.


## Phase 8.1 — Full combat restoration + resource regeneration

- Health, Energy and Nerve now regenerate server-side on configurable timers.
- The HUD shows the next regeneration tick (`+X in mm:ss`) or `FULL`.
- Combat costs Energy once when a fight starts; turns inside the fight do not spend additional Energy.
- The V1 combat model has been ported into the Worker: alternating turns, body-part hits, misses, criticals, range, cover, defense/armor mitigation and weapon-class skill progression.
- Combat turn logs are persisted and returned for the animated/frontend battle feed.
- Seven weapon skill classes are supported: Unarmed, Blades, Blunt, Handguns, SMGs, Shotguns and Rifles.
- Additional V1 combat weapons are registered as normal RiftCity items/equipment.
- Inventory now displays only items the player actually owns; the item registry is no longer rendered as player inventory.
