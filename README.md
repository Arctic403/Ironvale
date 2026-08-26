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

## JavaScript + React hybrid architecture

RiftCity remains JavaScript end to end, but the browser UI now uses a deliberate hybrid architecture. React is introduced as UI islands while the timing-sensitive 2.5D runtime remains plain JavaScript:

- Cloudflare Worker/API: `src/*.js`
- Browser game/runtime: plain ES-module JavaScript under `public/`
- React UI islands: JavaScript/JSX under `client/react/`, bundled to `public/react-ui.js`
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


## Phase 11.6 — RiftAssets building-art importer

The temporary Block Editor can now import `riftcity-asset-pack` JSON files exported from RiftAssets. Imported transparent building art can be assigned to any selected Commerce Street building and previewed directly in the playable block. Per-building art scale, X/Y offset and contain/cover fit are editable without changing collision or interaction-door geometry. Imported image bytes stay in the current browser/editor session; exported block JSON stores only lightweight asset IDs and placement metadata, avoiding multi-megabyte image blobs in workspace patches.


## Phase 11.7 — persistent RiftAssets city art

- Authored building art can now live in `public/block-assets.js` and load automatically with the city.
- Corner Mart's `building.corner-mart.a` art is integrated into the source registry and assigned in `public/block1.js`.
- RiftAssets imports now prefer stable `assetId` values over temporary pack ids.
- `building.<building-id>.*` assets auto-assign to the matching authored building on import.
- Editor-imported assets are cached locally so a refresh no longer immediately loses them.
- Source-integrated assets remain available after refresh and deployment without re-importing the JSON.


## Phase 11.8 — Asset Lab-compatible runtime library

- RiftCity now keeps imported `riftcity-asset-pack` entries as complete Asset Lab objects instead of stripping them down to a source URL.
- The stable `assetId` is used by buildings, while the Asset Lab internal `id`, embedded image data, source dimensions, X/Y/scale/rotation/opacity, baseline and shadow metadata are preserved.
- Imported packs are persisted in the browser asset library and restored on reload, matching the Asset Lab workflow.
- Runtime building placement stays separate from the Asset Lab metadata so collision and door geometry remain untouched.
- The previous Corner Mart-only baked source blob was removed; the same importer path now works for every storefront asset pack.


## Phase 11.9 — Asset Lab-native storefront runtime

- Asset Lab is now the sole visual source for Commerce Street storefront buildings.
- Removed the legacy procedural storefront markup (roof/cornice/windows/awnings/signs/facade decoration).
- RiftCity imports `riftcity-asset-pack` objects intact and renders their embedded image source directly.
- PNG, JPEG, WebP and SVG data-image sources are accepted through the Asset Lab data-URL pipeline.
- Asset Lab-authored source dimensions, X/Y, scale, rotation and opacity drive rendering; the duplicate RiftCity art-scale/X/Y/fit controls were removed.
- Building rectangles remain only as invisible gameplay geometry for collision, door interaction and routing.
- Buildings without an assigned Asset Lab asset no longer fall back to the old generated storefront.


## Phase 12 — Commerce Street panoramic scene plate

- Commerce Street now uses the supplied full-block panoramic artwork as one authored visual scene plate.
- The scene plate is presentation only; building collision, interaction doors, routes and player movement remain separate data in `public/block1.js`.
- The previous generated skyline, road, sidewalks, storefront art and decorative street props are suppressed while the scene plate is active, preventing duplicate visuals.
- Invisible gameplay geometry was realigned to the visible Corner Mart, Northside Warehouse, Auto Repair, apartments, Pawn Shop and Apartment Rentals entrances.
- The block keeps horizontal camera travel, 2-axis walk-up movement, mobile controls, fullscreen behavior and the live block editor.
- Future blocks can use the same pattern and be preloaded/streamed as neighboring scene plates rather than building one giant city raster.


## Phase 12.1 — wide scene plate + mobile-first Block Editor

- Commerce Street now uses the latest supplied wide panoramic background while preserving the artwork's native 2:1 proportions instead of squeezing it into the older scene ratio.
- Gameplay geometry remains independent from the artwork and has been re-aligned to the panorama.
- The Block Editor is now designed for iPhone first: a compact bottom sheet that can be minimized without leaving edit mode.
- Landscape and larger screens automatically use a narrow right-side inspector so the scene remains visible.
- Touch, Apple mouse/trackpad and normal desktop pointer input all use the same direct-selection/drag path.
- Keyboard editing supports `E` to toggle edit mode, arrow-key nudging, Shift for larger nudges, Delete/Backspace for removable objects, Ctrl/Cmd+Z undo and Ctrl/Cmd+Y redo.
- Editor targets now include buildings, props, player spawn, west/east block exits, the walkable area and the panoramic scene plate. Legacy Asset Lab controls remain available in a collapsed compatibility section.
- Block Editor JSON schema is now version 2.


## Phase 12.2 — mobile camera/control repair

- Restored Commerce Street's playable world to 3600 × 1440 units; the 3600 × 1800 panoramic plate is visual-only.
- Mobile and fullscreen camera fitting now uses gameplay dimensions rather than the panorama bitmap height.
- Touch controls are explicitly layered above scene/editor guides in play mode and use pointer capture/preventDefault for Safari reliability.
- The Block Editor remains minimizable and continues to disable gameplay controls only while edit mode is active.


## Phase 12.3 — unobstructed mobile Block Editor

- EDIT BLOCK remains a compact top control and becomes DONE while editing.
- Entering edit mode no longer opens an inspector over the scene.
- Tapping/selecting an editable scene object opens the inspector only when needed.
- Minimize now fully hides the inspector instead of leaving a bottom bar over gameplay.
- Selecting another object reopens the inspector, keeping touch and mouse/keyboard workflows intact.


## Phase 12.4 — top-mounted mobile editor

- `EDIT BLOCK` is a permanent compact top control.
- Entering edit mode opens a wide inspector near the top of the game instead of a bottom sheet.
- Minimize hides the inspector completely while keeping edit mode active, so buildings/zones/props can be dragged with the full scene unobstructed.
- The top control becomes `OPEN EDITOR` while minimized and `HIDE EDITOR` while the inspector is open.
- Selecting or dragging an object no longer forces a minimized inspector to reopen.
- Portrait mobile uses a wide shallow top inspector; landscape/fullscreen mobile uses a shorter wide top inspector.
- Touch, mouse/trackpad and keyboard editing remain supported. The inspector X exits edit mode completely.


## Hybrid H1 — React UI foundation + Block Editor

RiftCity now uses a hybrid JavaScript/React frontend rather than planning a full React rewrite.

- React owns the Block Editor's component/UI shell.
- The existing plain-JavaScript Block World continues to own movement, camera, collision,
  fullscreen/orientation, touch input, world-space dragging and the animation loop.
- The first migration deliberately preserves the Block Editor's existing DOM IDs so the
  proven runtime behavior can attach to React-rendered controls without simultaneously
  rewriting game logic.
- `esbuild` bundles `client/react/index.jsx` to `public/react-ui.js` before the normal JS checks.
- Wrangler still serves `./public`; Cloudflare Worker/D1 architecture is unchanged.
- TypeScript is not introduced.
- Future React migration order and hard ownership boundaries live in
  `docs/HYBRID-REACT-ROADMAP.md`.

This is an incremental migration: React takes over UI-heavy surfaces one feature at a time,
while real-time city/gameplay code stays direct JavaScript.


## Hybrid H1.1 — mobile Block Editor runtime repair

- Fixed the editor state crash introduced during the H1 React island migration: the runtime now
  explicitly initializes `editorCollapsed`.
- Restored reliable EDIT BLOCK open/minimize/reopen/close behavior.
- Editor guides and boundaries render immediately when edit mode starts.
- Touch dragging is hardened for iPhone Safari with scene-level pointer capture and gesture suppression.
- Building geometry, spawn, exits and walkable boundaries remain draggable while the inspector is hidden.
- The fix preserves the hybrid boundary: React owns the inspector UI; plain JavaScript owns world-space
  selection, dragging, camera, collision and fullscreen.


## Hybrid H1.2 — compact mobile editor + resize gizmos

- Block Editor inspector controls are compressed for iPhone portrait and landscape/fullscreen.
- Undo/redo/save remain one-tap controls while secondary tools stay in collapsible sections.
- Selected rectangular editor targets now expose eight touch-friendly resize gizmos.
- Edge gizmos resize only that edge; corner gizmos resize two axes; dragging the body still moves the object.
- Gizmos share one pointer path across iPhone touch, Apple mouse/trackpad and desktop pointers.
- Building interaction doors remain aligned while building geometry is moved or resized.
- Plain JavaScript continues to own world-space manipulation; React continues to own the inspector UI.


## Hybrid H1.3 — compact iPhone editor toolbar

- The Block Editor is now a shallow top toolbar instead of a large mobile form.
- Object selection and X/Y/W/H precision controls are kept immediately accessible.
- Undo, redo, snap and save are compressed into one small quick bar.
- Secondary object/prop/legacy controls remain collapsed and scroll only when explicitly opened.
- Landscape/fullscreen uses an extra-short toolbar so the playable scene stays visible.
- Resize gizmos and direct dragging remain the primary touch/mouse editing workflow.
- Existing editor DOM IDs and the plain-JavaScript world manipulation runtime are preserved.


## Hybrid H1.4 — mobile direct-manipulation editor + restored Play Mode

This pass follows current iPhone/game-control guidance: keep secondary menus at the top, minimize
controls covering game content, use direct touch manipulation for scene objects, and preserve
large enough hit regions for fingers while allowing pointer/keyboard precision.

- `EDIT BLOCK` now enters edit mode and the top control becomes `PLAY MODE`.
- `PLAY MODE` exits editing completely: inspector, boundaries and gizmos are removed and
  joystick/RUN/ENTER controls are restored.
- The editor minimize button only hides/reopens the inspector while edit mode remains active.
- Landscape/fullscreen uses a single compact toolbar row around 90px tall instead of a large panel.
- Portrait uses a shallow precision inspector; secondary tools are hidden/collapsed.
- Resize gizmos keep a 44px touch hit region but use a small visible dot so geometry stays readable.
- Direct scene dragging/resizing remains plain JavaScript; React owns only the inspector shell.


## Hybrid H1.5 — server-persistent world authoring

The Block Editor is now a real development authoring tool rather than a browser-only scratchpad.

- Play Mode loads the published block layout from D1, falling back to `public/block1.js` when no server layout has been published.
- Edit Mode loads the current server draft for admin/developer accounts.
- Geometry changes autosave to a D1 draft after a short debounce and again every few seconds while dirty.
- `PUBLISH` promotes the saved draft to the live server-wide layout and creates a version-history row.
- Leaving Edit Mode returns the local scene to the currently published layout, so unpublished drafts do not leak into Play Mode.
- Draft and publish writes are protected by the existing admin/developer authorization gate.
- Block layout JSON is validated and size-capped server-side; images/assets remain outside D1.
- The compact mobile editor row scrolls horizontally instead of clipping controls.
- Resize gizmos have larger touch targets on coarse-pointer mobile devices.


## Hybrid H1.6 — iPhone fullscreen input-axis repair

- Fixed the CSS-rotated iPhone fullscreen fallback so touch input is converted from screen-space back into the unrotated game-world axes.
- Joystick movement now follows the direction shown on screen while the joystick knob still follows the finger directly.
- Block Editor move and resize drags use the same coordinate conversion, including the correct scene scale while the game root is rotated.
- Native landscape/Android fullscreen and normal non-fullscreen controls keep their existing unrotated input path.
- Mobile resize gizmos now use substantially larger coarse-pointer hit targets and larger visible handles for easier iPhone editing.


## Hybrid H1.7 — editor state/publish repair

- `EDIT / PLAY` is now one shared mode toggle and does only mode switching.
- `SHOW PANEL / HIDE PANEL` is a separate control available while editing; hiding the inspector does not leave Edit Mode.
- The inspector minimize and close controls hide the panel instead of changing Play/Edit mode.
- `PUBLISH` saves the draft, publishes it server-side, then reads the public block endpoint back and adopts that verified live layout as the local published state.
- Exiting Edit Mode rebuilds gameplay geometry from that verified published state, preventing a successful publish from visually snapping back to the pre-publish layout.


## Hybrid H1.8 — authoritative Publish + deterministic block hydration

Research-driven state cleanup:

- Publish now adopts the exact validated block returned by the successful D1 publish transaction; it no longer performs a second public GET merely to rediscover what was just committed.
- A single `hydrateBlock(layout)` boundary now owns authoritative version transitions.
- Hydration reconstructs building gameplay DOM from the supplied layout rather than assuming the old DOM has the same buildings/order.
- Authored prop DOM is cleared/rebuilt from the supplied layout.
- Scene plate, alley, guides, collision-facing working data, doors and editor geometry are refreshed through the same render path.
- Play Mode always hydrates from `publishedWorking`; Edit Mode may continue using the server draft.
- Publishing does not teleport the player to spawn; the current position is preserved and clamped to the newly published walkable region.
- Autosave remains draft-only. Publish remains the only operation that changes the server-wide live block.


## Hybrid H1.9 — mobile authoring palette

- The Block Editor can now expand into a larger, scrollable authoring palette because the panel can be hidden independently from Edit Mode.
- Added direct creation controls for alley placement, entrances, block exits, player spawn, walkable zones and props.
- New objects are created at/around the player's current world position so mobile authoring does not require typing coordinates first.
- The compact transform row remains horizontally scrollable in portrait and landscape/fullscreen.
- Existing direct manipulation, large touch resize gizmos, draft autosave and authoritative Publish behavior are preserved.


## Hybrid H1.10 — private developer Block Editor studio

- Added `/dev/block-editor` as a dedicated Block Editor page served only after a server-side `admin` / `developer` role check.
- The private page does not use the normal RiftCity HUD, drawer or mobile navigation; the Block World owns the entire dynamic viewport.
- The editor now follows the approved mobile-landscape studio layout: top project/status bar, transform strip, left Add Object palette, right Properties panel, bottom Tools/Status tray and the playable scene in the center.
- Left, right and bottom panels are independently collapsible and resize with touch/mouse drag dividers. Panel sizes/collapse states persist locally on the device.
- Edit/Play mode, Show/Hide Panel and Fullscreen remain independent controls.
- The dedicated page starts in Edit Mode and reuses the existing D1 draft autosave, explicit Publish and authoritative block hydration path.
- Existing touch/mouse/keyboard world manipulation remains plain JavaScript; React owns the studio UI chrome.
- Mobile editor gizmos have larger visible handles and touch targets on the private editor page.
- Fullscreen uses the entire dynamic viewport and preserves the existing iPhone CSS-rotation fallback when Safari cannot orientation-lock.


## Hybrid H1.11 — private reference studio + player/editor separation

- The normal City / Commerce Street page no longer renders Block Editor UI or mounts the React editor.
- The editor React bundle is dynamically imported only by the server-gated `/dev/block-editor` workspace.
- Player-facing Commerce Street keeps gameplay controls + Fullscreen only, and keyboard `E` is restored to Enter/interact.
- `/dev/block-editor` remains restricted to `developer` / `admin` accounts and is the only authoring surface.
- The private UI now follows the approved reference much more closely: project/status header, Play/Hide/Publish/Fullscreen/Exit controls, Object + ID/Label + X/Y/W/H + Rotation + Z-index + Snap strip, left Add Object palette, right Properties inspector, center zoom controls and bottom Tools/View/Settings/Status tray.
- Resizable/collapsible dock panels and locally persisted editor layout are preserved.
- Lightweight label/target/requires/active/rotation/z-index metadata now round-trip in the draft where applicable.
- The private iPhone fullscreen fallback now rotates the dedicated developer root itself so the editor truly fills the landscape viewport.
