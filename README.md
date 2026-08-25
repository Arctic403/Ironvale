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


## Phase 8.2 — Living City + V1 gameplay parity

Phase 8.2 fills the largest remaining gameplay gaps from the original RiftCity V1 while preserving the new server-authoritative Worker/D1 architecture. This pass intentionally does **not** rebuild the old master map, does **not** add an NPC relationship system, and does **not** add cemetery-key or beach metal-detector activities.

### Crime careers and Heat
- Twelve immediate crime definitions across Street, Theft, Burglary, Vehicle, Fraud, Cyber and Organized careers.
- UI-mode metadata for scavenging, pickpocket, shoplifting, graffiti, memory, target, choice and operation presentations.
- Quiet / Balanced / Bold approaches alter success chance, reward and Heat server-side.
- Persistent Heat, wanted tiers, fines, automatic Heat decay, laying low and law history.
- Heat applies a real crime-success penalty at higher wanted tiers.
- Passive multi-minute crime operations add Street Reputation and persistent operation history.

### Living city systems
- Afterdark nightclub reputation, rank tiers, rotating events and server-timed activities.
- Merit points plus permanent Energy/Nerve cap, crime, gym, job and market upgrades.
- Property upgrade records and a separate rental-unit portfolio with rent/upkeep collection.
- Job workplace events with variable pay and skill XP.
- Faction leave cooldown plus a faction-points reward shop.
- Persistent activity feed for crime, combat, travel, casino, production, law and progression events.
- RiftCity-specific Park, Downtown, Transit, Harbour, Warehouse, Safehouse, Mall, Courthouse, Company Plaza and dealership side activities.

### Casino
The Meridian now has server-resolved fictional in-game-chip rounds for Blackjack, Roulette, Baccarat, Craps, Casino War, Slots, Horse Racing and a Hold’em table foundation. Results and chip movements are persisted in D1; no real-money wagering exists.

### Economy risk
High Heat now contributes to bank exposure and can trigger a temporary server-side security review. Home Security upgrades reduce that risk. Bank risk status is visible instead of being hidden.


## Phase 10 — 2D Downtown world foundation

RiftCity's active City route is now a mobile-first 2D world using the exact supplied Downtown artwork as a static ground layer. Babylon/3D is no longer loaded by `public/index.html`, and the City route no longer imports or mounts the 3D runtime.

The 2D client now uses:
- logical world coordinates independent of source image resolution (`6400 × 5697` world units),
- a fixed gameplay camera with movement look-ahead and edge clamping,
- analog touch joystick plus WASD/arrow controls and Shift/run,
- authored location coordinates layered over the world,
- collision primitives with a spatial chunk index,
- nearby-location interaction detection,
- mobile fullscreen support,
- existing server-authoritative location/service routes unchanged.

The Downtown image remains static presentation. Collision, location placement, interactions and future building/prop sprites are separate data layers, so gameplay logic never depends on reading pixels from the ground image.


## Phase 10.1 — crisp streamed Downtown ground

The original 1329×1183 Downtown artwork is no longer stretched as one giant DOM image. It is rendered into a 4096×3646 sharpened master and split into a 4×4 tile set.

The active City view mounts only tiles intersecting the camera viewport plus a prefetch margin, and removes off-screen tiles as the player moves. Logical world coordinates remain 6400×5697, so collision, locations, camera movement and traversal timing do not need to be rebuilt.

This removes the worst browser interpolation blur and establishes a real tile-streaming path for future native high-resolution district artwork. The current tiles are enhanced from the supplied source; replacing them later with native high-resolution art requires no gameplay-coordinate changes.


## Phase 11 — 2.5D block-world vertical slice

The active City route now starts with Downtown Block 01, Commerce Street, rather than the giant Downtown raster map. The block is an authored side-on/2.5D street scene with six spaced destinations, road, sidewalks, an alley, street furniture, depth-layered storefronts, keyboard/touch movement, run input, nearby-building interaction and future west/east block exits.

This is the new city-world scaling model: individual blocks are authored and later streamed/preloaded as neighbors rather than rendering the entire district simultaneously. Existing location/service routes and server-authoritative systems remain intact.


## Phase 11.1 — mobile fit + landscape fullscreen

Block 01 now scales its authored 2.5D scene to the available mobile viewport in normal portrait play instead of cropping the street. Horizontal camera travel remains world-space based.

Fullscreen behavior is device-aware:
- Samsung/Android requests native Fullscreen API mode and attempts `screen.orientation.lock('landscape')`.
- iPhone/iPad attempts native fullscreen when Safari exposes it; because Safari does not reliably permit webpage orientation locking, portrait iPhones use a CSS-rotated edge-to-edge landscape game canvas.
- Leaving fullscreen restores RiftCity's normal portrait shell/navigation.


## Phase 11.2 — walk-up storefronts

Commerce Street now uses a real two-axis walkable street plane. The player can walk from the foreground sidewalk, across the road, onto the north sidewalk and directly to each storefront door. Building rectangles are solid collision geometry, door interactions use authored threshold coordinates with a tighter activation radius, and the player subtly depth-scales by Y position to reinforce the 2.5D approach.


## Phase 11.3 — Commerce Street visual-life pass

Block 01 now gives each destination its own visual language rather than reusing one storefront treatment. The mart, pharmacy, realty office, noodle shop, exchange and apartments receive distinct facade details, signage, window/awning treatments and proportions. Downtown now has a layered skyline and utility wires behind the playable block, while Commerce Street gains parked vehicles, benches, a hydrant, utility/news boxes and a dressed alley with fire escape, dumpster, bins, graffiti and puddle. These additions are presentation-only and preserve Phase 11.2 movement, collision, door thresholds and server routes.


## Phase 11.4 — live Block Editor + JSON handoff

Commerce Street now includes a temporary in-game developer editor. `EDIT BLOCK` switches the active block from play controls to direct scene editing without changing server-authoritative gameplay.

Editor capabilities:
- select buildings, authored props and the alley directly in the scene or inspector;
- drag objects live and edit X/Y plus building/alley width and height;
- configurable coordinate snapping;
- visible storefront interaction-door markers;
- add common props at the player's current position;
- duplicate/delete supported objects;
- undo/redo and reset to the authored Block 01 source;
- export the complete working block as a versioned `riftcity-block-edit` JSON file.

The export is intentionally source-neutral: it can be sent with the newest RiftCity workspace and integrated back into `public/block1.js`. The editor changes only its browser working copy until an exported layout is deliberately integrated into source.


## Phase 11.5 — Commerce Street mid-detail art direction

Commerce Street received a visual-only art pass based on the approved stylized mobile/indie target. The block layout, movement, collision geometry, storefront door coordinates, location routing, fullscreen behavior and live editor are unchanged.

Visual changes:
- Corner Mart is now a low, worn neighborhood convenience store with green striped awning, cluttered glazing and neon/open details.
- Rift Pharmacy uses a clean pale facade, blue medical identity and projecting cross sign.
- Keystone Realty reads as a taller brick-and-glass professional office.
- Noodle House uses warm brick, a striped restaurant awning, vertical sign, menu board and neon.
- Rift Exchange is darker old masonry with gold signage and visible security grilles.
- Mercer Apartments reads as residential with a taller silhouette, balconies and an exterior fire escape.
- The block background now has layered distant buildings, rooftop equipment, haze, utility wires and a water tank rather than a few identical flat rectangles.
- The alley gains pipes, lighting, crates and subtle steam; the street gains additional small props.

This remains deliberately mid-detail rather than photorealistic so Block 01 stays lightweight on mobile and can serve as the art baseline for future streamed blocks.
