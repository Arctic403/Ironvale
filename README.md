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

## Pure JavaScript architecture

RiftCity is JavaScript end to end. The browser UI, private Block Editor and timing-sensitive 2.5D runtime all use plain ES-module JavaScript:

- Cloudflare Worker/API: `src/*.js`
- Browser game/runtime: plain ES-module JavaScript under `public/`
- Private Block Editor UI: plain JavaScript under `public/editor/`, composed through the static `public/editor/block-editor-entry.js` entry with no JSX/bundle step
- Wrangler entry point: `src/index.js`
- No TypeScript source files, declaration files, `tsconfig`, TypeScript compiler, `ts-node`, `tsx`, or `@types/*` packages are required.
- `npm run build` runs the pure-JavaScript guard first and fails if TypeScript, JSX, or the removed UI framework dependencies are introduced later.

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

Phase 8 rebuilds the browser client around the server-authoritative backend instead of reviving the original V1 framework/TypeScript/local-simulation architecture.

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


## Hybrid H1 — Block Editor UI foundation

RiftCity now uses one plain-JavaScript frontend for both game runtime and editor UI.

- Plain JavaScript owns the Block Editor UI shell.
- The existing plain-JavaScript Block World continues to own movement, camera, collision,
  fullscreen/orientation, touch input, world-space dragging and the animation loop.
- The first migration deliberately preserves the Block Editor's existing DOM IDs so the
  proven runtime behavior can attach to editor-rendered controls without simultaneously
  rewriting game logic.
- The Block Editor page loads `public/editor/block-editor-entry.js`, which statically imports both the shared Block World runtime and `public/editor/block-editor-ui.js`; no JSX/browser bundle step or runtime editor `import()` is required.
- Wrangler still serves `./public`; Cloudflare Worker/D1 architecture is unchanged.
- TypeScript is not introduced.
- Current editor/runtime ownership boundaries live in
  `docs/PURE-JS-EDITOR-ARCHITECTURE.md`.

The private editor and real-time city/gameplay code now share the same direct-JavaScript model and DOM/event boundary.


## Hybrid H1.1 — mobile Block Editor runtime repair

- Fixed the editor state crash introduced during the H1 editor-shell migration: the runtime now
  explicitly initializes `editorCollapsed`.
- Restored reliable EDIT BLOCK open/minimize/reopen/close behavior.
- Editor guides and boundaries render immediately when edit mode starts.
- Touch dragging is hardened for iPhone Safari with scene-level pointer capture and gesture suppression.
- Building geometry, spawn, exits and walkable boundaries remain draggable while the inspector is hidden.
- The fix preserves the editor/runtime boundary: inspector UI, world-space selection, dragging, camera, collision and fullscreen all remain plain JavaScript.


## Hybrid H1.2 — compact mobile editor + resize gizmos

- Block Editor inspector controls are compressed for iPhone portrait and landscape/fullscreen.
- Undo/redo/save remain one-tap controls while secondary tools stay in collapsible sections.
- Selected rectangular editor targets now expose eight touch-friendly resize gizmos.
- Edge gizmos resize only that edge; corner gizmos resize two axes; dragging the body still moves the object.
- Gizmos share one pointer path across iPhone touch, Apple mouse/trackpad and desktop pointers.
- Building interaction doors remain aligned while building geometry is moved or resized.
- Plain JavaScript owns both world-space manipulation and the inspector UI.


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
- Direct scene dragging/resizing and the inspector shell both remain plain JavaScript.


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
- Existing touch/mouse/keyboard world manipulation and the studio UI chrome remain plain JavaScript.
- Mobile editor gizmos have larger visible handles and touch targets on the private editor page.
- Fullscreen uses the entire dynamic viewport and preserves the existing iPhone CSS-rotation fallback when Safari cannot orientation-lock.


## Hybrid H1.11 — private reference studio + player/editor separation

- The normal City / Commerce Street page no longer renders or mounts the private Block Editor UI.
- The editor UI module is dynamically imported only by the server-gated `/dev/block-editor` workspace.
- Player-facing Commerce Street keeps gameplay controls + Fullscreen only, and keyboard `E` is restored to Enter/interact.
- `/dev/block-editor` remains restricted to `developer` / `admin` accounts and is the only authoring surface.
- The private UI now follows the approved reference much more closely: project/status header, Play/Hide/Publish/Fullscreen/Exit controls, Object + ID/Label + X/Y/W/H + Rotation + Z-index + Snap strip, left Add Object palette, right Properties inspector, center zoom controls and bottom Tools/View/Settings/Status tray.
- Resizable/collapsible dock panels and locally persisted editor layout are preserved.
- Lightweight label/target/requires/active/rotation/z-index metadata now round-trip in the draft where applicable.
- The private iPhone fullscreen fallback now rotates the dedicated developer root itself so the editor truly fills the landscape viewport.


## Hybrid H1.12 — developer navigation + editor recovery/precision tools

- The normal left RiftCity drawer now shows **Developer → Block Editor** only when the signed-in account role is `developer` or `admin`.
- The private `/dev/block-editor` server gate remains the security boundary; ordinary players cannot open it by typing the URL.
- Added mobile precision nudge controls for the selected object; each tap uses the current Snap step.
- Added **Focus** to center horizontal editor attention on the selected object without changing authored spawn data.
- Added **Reset UI** to restore default dock sizes/collapse state if a mobile layout becomes awkward.
- Added published **Version History** to the private editor.
- A historical published revision can be loaded back into the current D1 draft without publishing automatically.
- History restores are server-validated, developer/admin-gated and written to the audit trail.


## Hybrid H1.13 — outer-chrome Block Editor layout

- The private Block Editor now uses a real CSS grid instead of absolute/floating editor panels.
- The Commerce Street viewport is physically the center grid cell; normal Edit Mode has zero editor panels layered over the scene.
- The top project/action header and precision transform strip occupy dedicated rows above the scene.
- Add Object is a dedicated left column, viewport zoom controls use a narrow dedicated rail, Properties is a dedicated right column, and Tools/View/Precision/Status spans the bottom row.
- Resizing the left/right/bottom docks now changes the grid tracks instead of moving floating panels over the city.
- Panel sizing is clamped so the center scene keeps a usable minimum width; saved old oversized dock values can no longer crush the viewport.
- Collapsing a dock shrinks its grid track. HIDE PANEL / Play Mode deliberately expands the scene to the whole developer page.
- The editor camera now fits the authored block to the actual center viewport by default, with zoom still available afterward.
- Compact iPhone landscape keeps the same outside-chrome architecture with smaller controls and scrollable panel contents.
- Fullscreen remains the same grid layout and the fullscreen action reads WINDOW while active so it is not confused with the red page EXIT action.

## Hybrid H1.14 — clear-canvas editor + alley authoring repair

- The private Block Editor now opens with the canvas mostly clear instead of reserving permanent left/right/bottom/transform docks.
- Add Object, Properties, Transform and Tools are compact floating menus opened from a small quick dock and closed with one tap.
- Play and Publish stay visible; panel visibility, fullscreen and editor exit move into one secondary action menu so the header no longer crowds the viewport.
- No editor functions were removed: object creation, transform precision, properties, view toggles, nudge/focus, history, export, reset and status remain available in the popovers.
- Fixed Alley Entrance creation when the authored fallback alley starts at `0 × 0`: placing an alley now assigns a usable default size and clamps it into the block bounds.
- Fixed the Phase 12 scene-plate rule that hid `.bw-alley` even in Edit Mode. The alley now renders as a clear editable authoring zone while remaining visually suppressed in Play Mode, where the panoramic scene plate owns presentation.
- Fixed mirrored precision/property fields so W/H, label and z-index changes made in either editor surface no longer overwrite each other.


## Hybrid H1.15 — editor locking, repeatable props + iPhone popover scrolling

- Added **LOCK SELECTED / UNLOCK SELECTED** to Block Editor Tools. Lock state is authored metadata, persists through draft/publish JSON, and prevents accidental scene selection, dragging, resizing, nudging, property edits, duplication and deletion until deliberately unlocked from the object selector.
- Locked objects remain visible and are marked `LOCKED` in the object selector so they are always recoverable.
- Props are explicitly multi-instance. Repeated adds of the same type now create unique prop IDs and stagger their initial placement instead of stacking every new copy at exactly the same coordinates. Duplicated props also receive a fresh ID.
- Fixed private Block Editor popover scrolling on iPhone/Safari: Properties, Add Object and Tools use bounded independent scroll bodies, Transform can pan/scroll instead of clipping, and gameplay `touch-action:none` is limited back to the actual world viewport rather than blocking menu scrolling.


## Hybrid H1.16 — Commerce Alley sub-area foundation

- Commerce Street's authored Alley Entrance now targets `alley-commerce-01`.
- Added a reusable 2.5D sub-area registry so alleys can be followed later by shop, apartment, warehouse and other interiors without creating a second 3D runtime.
- Walking into the authored alley entrance range now exposes **ENTER** and swaps the Block World into the Commerce Alley scene without routing away from the 2.5D runtime.
- The alley uses its own scene plate, logical world size, spawn point, walkable bounds and collision obstacles.
- Alley scene art remains presentation-only; gameplay geometry is separate from the image.
- The alley exit returns the player to the exact Commerce Street position they entered from.
- Editor Play Mode can test the transition; entering Edit Mode while inside a sub-area returns to Commerce Street before editing.
- Scavenging is intentionally not wired in this pass. The alley config contains an empty interaction registry ready for the existing server-authoritative scavenging crime in the next pass.

## Hybrid H1.17 — Commerce Alley scene/camera repair

- Commerce Alley now owns a dedicated scene-plate element instead of reusing the Commerce Street image element. This prevents Safari from continuing to paint the previously decoded Commerce Street frame while the alley asset changes.
- Entering the alley now switches the runtime to the alley's native `1672 × 941` world context, including its own scene dimensions, walkable bounds, collision data and camera profile.
- The alley camera uses viewport-cover framing and player tracking rather than Commerce Street's tall-world fit, so the alley reads as its own room/sub-area in both normal mobile play and fullscreen.
- The alley spawn is moved clear of the left-side joystick and starts just outside the exit trigger radius.
- Scene framing is recalculated immediately on enter/leave, viewport changes and fullscreen transitions, including the iPhone CSS-rotated fullscreen fallback.
- The block label now switches explicitly to **Commerce Alley** while inside and back to **Commerce Street** on exit.
- If the alley art fails to load, the old street image is never shown as a false fallback; the sub-area remains active over a dark diagnostic-safe background.
- Scavenging remains intentionally deferred until enter → move → exit behavior is verified on mobile.

## Hybrid H1.18 — cryptographically verified custom assets

RiftCity custom image assets now use a server-approved content-addressed pipeline instead of trusting browser-local image data.

- The browser computes SHA-256 with Web Crypto before an Asset Lab image is registered.
- `/api/admin/assets/register` is restricted to `developer` / `admin` accounts and independently hashes the actual uploaded bytes in the Worker. A client-supplied hash is never trusted by itself.
- Approved asset metadata is stored in D1 (`approved_assets`); image bytes are stored in the `RIFT_ASSETS` R2 bucket.
- Approved asset IDs are immutable: changing image bytes requires a new/versioned `assetId`.
- Only PNG, JPEG and WebP uploads are accepted. SVG uploads are intentionally rejected rather than trying to sanitize active SVG content.
- Block layout JSON stores only lightweight `assetId` + `assetHash` strings. Embedded `asset`, `dataUrl`, `imageData` and image byte fields are stripped from the authoritative layout.
- Draft saves validate every referenced custom asset against the approved D1 registry.
- Publish repeats the full approved-registry validation and writes the canonical layout to both the published row and history snapshot.
- Static scene-plate paths must remain under `/assets/`; arbitrary external scene URLs are rejected by layout validation.
- Runtime asset downloads use `/api/assets/:assetId?sha256=<hash>`. The browser verifies downloaded/cached bytes against SHA-256 before creating an object URL for rendering.
- Cache Storage is keyed by SHA-256, so a local cached file with the wrong bytes is ignored instead of being trusted.
- Asset Lab pack import still works in the private Block Editor, but each embedded image is registered/verified before it can be assigned to a building.

### R2 setup

H1.18 adds this Wrangler binding:

```toml
[[r2_buckets]]
binding = "RIFT_ASSETS"
bucket_name = "riftcityassets"
```

Create the bucket once before deploying this build:

```sh
npx wrangler r2 bucket create riftcityassets
```

The normal D1 schema migration also creates `approved_assets`. The Worker keeps the same `CREATE TABLE IF NOT EXISTS` guard for development deployments.



## Hybrid H1.19 — true Commerce Alley scene isolation

- Commerce Alley is now a separate DOM/camera scene instead of reusing and resizing the Commerce Street scene node.
- Entering the authored alley hides Commerce Street completely, mounts the dedicated alley scene, moves the player/prompt into that scene context, and applies the alley's own world/camera dimensions.
- Leaving the alley restores the player/prompt to Commerce Street and returns to the exact saved street position.
- Alley camera framing is ground-aligned on short landscape/iPhone fullscreen viewports so the camera cannot drift upward into mostly sky/ceiling.
- The existing `commerce-alley.webp` scene plate remains the primary art. If that file fails to load, RiftCity shows a dark Commerce Alley diagnostic fallback instead of ever showing a stale Commerce Street frame.
- R2/D1 asset verification from H1.18 is unchanged. Scavenging remains deferred until the alley enter → move → exit loop is visually verified.


## Hybrid H1.20 — reusable room Scene Manager + Commerce Alley reset

- Commerce Alley now uses a real scene-transition manager instead of directly mutating the active Commerce Street camera state.
- ENTER preloads the alley scene plate before ownership changes, briefly fades the viewport, then atomically hides Commerce Street and activates the alley.
- The sub-area has a fixed viewport clipping surface plus its own authored world stage. Camera transforms apply only to that stage, so Commerce Street transforms cannot leak into the alley.
- Compact sub-areas use `room` framing: the complete alley scene is centered/letterboxed on different iPhone aspect ratios instead of tracking into skyline/ceiling space.
- The player and interaction prompt are moved into the alley's own world layer while inside and restored to the street scene on exit.
- EXIT restores the exact Commerce Street position captured when the player entered.
- If the alley image fails to preload, the dedicated alley scene still opens with a dark diagnostic fallback; the Commerce Street panorama is never substituted.
- The new `public/scene-manager.js` is intentionally generic so future shop, apartment, warehouse, garage and other interior scenes can reuse the same enter/leave/preload path.
- Existing server-authoritative gameplay, Block Editor draft/publish behavior, and H1.18 D1/R2 asset verification are unchanged.


## Hybrid H1.21 — Downtown D1 layout synced to source fallback

- Synced the exported `riftcity-block-edit` v2 layout for `downtown-commercial-01` into `public/block1.js`.
- The repo fallback now matches the authored Commerce Street D1 geometry for world size, scene plate, spawn, walkable region, road/sidewalk, all six building rectangles and door positions, the authored tree prop, alley bounds and west/east exits.
- Preserved the repo-only Commerce Alley `target` / `label` routing metadata so the existing `alley-commerce-01` sub-area transition continues to work even though those fields were not present in the exported edit JSON.
- This changes only the source fallback. Runtime D1 publish/hydration behavior and server-authoritative gameplay remain unchanged.


## Hybrid H1.22 — Commerce Alley ownership rollback + guaranteed fallback scene

- Fixed the failed-transition behavior that could move the player to Commerce Alley spawn coordinates and then restore Commerce Street, which appeared as a jump to the far-left side of the street.
- Alley entry is now transactional: if scene ownership cannot be established, player coordinates and scene state are fully restored to the exact street entry position.
- Added runtime ownership assertions requiring Commerce Street to be hidden, the alley viewport to be visible, and the player/prompt to actually belong to the alley world before the transition is committed.
- Added a source-controlled `commerce-alley-fallback.svg`. The preferred `commerce-alley.webp` is still used when available; if that binary asset is unavailable in Local Test or a deployment, the dedicated alley fallback loads instead of showing Commerce Street.
- Added final CSS ownership rules making Commerce Street and sub-area rendering mutually exclusive.


## Hybrid H1.23 — bounded alley preload + fallback handoff

- Fixed the Local Test hang where `LOADING ALLEY…` could remain forever if Safari never fired `load` or `error` for an `Image()` preload.
- Scene preloading now has a hard 1.1-second bound per candidate.
- Commerce Alley tries the preferred `commerce-alley.webp` first, then the source-controlled `commerce-alley-fallback.svg`.
- If neither image reports completion, scene entry still resolves instead of hanging forever; the existing dedicated alley diagnostic background remains available.
- Successful preload results record the actual loaded source for diagnostics.
- The transition timeout is generic in `SceneManager`, so future rooms/interiors cannot deadlock the game on a missing image either.


## Hybrid H1.24 — non-blocking Commerce Alley transition

- Room ownership no longer waits for scene artwork. `SceneManager.enter()` commits the sub-area immediately and probes image assets only in the background.
- Removed the eager Commerce Alley warm-preload so an old pending image Promise cannot be cached before the player presses ENTER.
- H1.23's bounded WebP/SVG probes remain, but timed-out probe Promises are removed from the preload cache instead of being reused indefinitely.
- The mounted alley image has its own Safari watchdog. If `commerce-alley.webp` emits neither `load` nor `error`, it is replaced by `commerce-alley-fallback.svg` without blocking gameplay.
- `enterSubarea()` now clears `LOADING ALLEY…` in `finally` for success, cancellation and failure. `requestAnimationFrame()` is no longer responsible for ending the transition.
- Added a three-second overlay fail-safe so a future lifecycle regression cannot permanently cover the game.
- Existing H1.22 scene-ownership assertions and exact Commerce Street rollback remain intact.


## Hybrid H1.25 — full Commerce Alley audit + deterministic room reset

A full current-snapshot audit was performed before this patch.

Audit findings:
- All 71 JavaScript files pass syntax validation.
- The Commerce Alley entrance target, dimensions, spawn, walkable bounds, exit and collision data are internally consistent.
- The only unresolved source-controlled `/assets/*` reference in the workspace was `/assets/blocks/commerce-alley.webp`.
- The patch pipeline/workspace is text-oriented, while the alley art was binary WebP, so the runtime had been repeatedly trying to enter a room whose preferred static asset was not actually present in the workspace.
- Five generations of sub-area CSS (H1.16, H1.17, H1.19, H1.20 and H1.22) were stacked together with overlapping scene rules.
- H1.24 fixed ENTER cleanup, but EXIT still depended on nested `requestAnimationFrame()` callbacks to release its transition overlay.
- Transition failures were console-only, which is not useful when testing from iPhone.

H1.25 repairs:
- The exact 1672 × 941 Commerce Alley WebP is embedded inside the already-existing `public/assets/blocks/commerce-alley-fallback.svg` path. This keeps the real art inside the text patch/workspace path without creating a new filename that the Editor's fuzzy-path correction can mistake for `commerce-alley.webp`.
- Commerce Alley now uses that existing source-controlled SVG path as its scene plate, removing the missing-WebP dependency in Local Test.
- `SceneManager.enter()` is synchronous scene-state ownership. It no longer starts or waits on artwork at all.
- ENTER and EXIT both use bounded visual beats and `finally` cleanup; neither image events nor `requestAnimationFrame()` can own the gameplay transition lifecycle.
- All historical H1.16–H1.22 sub-area CSS at the end of `styles.css` is replaced by one authoritative room-scene block.
- Failed room ownership now produces a temporary on-screen `ALLEY ERROR` message instead of silently snapping back.
- Existing exact Commerce Street return-position behavior remains intact.


### H1.25.1 — Editor fuzzy-path conflict compatibility

The first H1.25 patch intentionally created `public/assets/blocks/commerce-alley.svg`, but the Editor correctly surfaced its close-name fuzzy-path safety prompt against the existing `commerce-alley.webp` workspace path. Applying only the other five operations would leave the new scene reference unresolved.

H1.25.1 avoids partial-apply risk entirely:
- no new alley filename is created;
- the exact alley artwork is written into the existing `commerce-alley-fallback.svg`;
- every patch operation is now a modification of an existing workspace file.


## Hybrid H1.25.2 — joystick symbol runtime repair

A full current-snapshot audit was run before this patch.

Audit results:
- all 71 JavaScript files pass syntax validation;
- the JavaScript-only policy passes;
- all static `/assets/*` references resolve;
- the H1.25 room CSS is now a single authoritative sub-area ruleset;
- Commerce Alley target, room geometry and source-controlled scene art are present;
- the visible Safari error was traced to one concrete runtime symbol bug: `#bw-knob` existed in the Block World DOM, but the runtime never queried it into a `knob` variable before using `knob.style.transform` during ENTER, rollback, EXIT and joystick movement.

Repair:
- bind `#bw-knob` explicitly beside `#bw-stick`;
- route all joystick visual movement/reset through `setJoystickKnob()`;
- make the knob visual optional so a missing visual element can never abort a gameplay scene transition.

## Hybrid H1.26 — scene-aware Commerce Alley Block Editor

A full audit of snapshot `e21f1cb976ee28aaddb762f73e250565ca75bbb813250e72eaef7497b7c5b824` was completed before this patch.

Audit findings:
- all 71 JavaScript files pass syntax validation and the JavaScript-only policy passes;
- all static `/assets/*` references resolve;
- H1.25.2 is present and Commerce Alley now enters successfully;
- the existing Block Editor is street-only by design: `setEditMode(true)` forcibly leaves an active sub-area;
- all editable-object enumeration and guide rendering are bound to Commerce Street's `working.buildings`, `working.props`, `working.alley` and `blockworld-scene`;
- direct manipulation pointer events are registered only on the street scene;
- D1's existing generic `/api/admin/blocks/:id/*` draft/publish/history routes can persist a room layout as long as it carries the normal `id`, `width`, `height`, `buildings`, `props`, `spawn` and `walkable` fields;
- Local Frontend Test may reject authoritative mutations, so room editing needs a per-scene in-memory draft rather than depending on D1 to switch scenes safely.

H1.26 changes:
- Commerce Alley becomes a first-class Block Editor scene instead of being forced back to Commerce Street when Edit Mode is entered.
- The editor can be opened inside the alley after entering it in Play Mode, or directly from Add Object with **Edit Commerce Alley**.
- **Back to Street** switches authoring context without leaving the private editor.
- Alley editing exposes the scene plate, player spawn, walkable zone, street exit, all collision/obstacle boxes and authored props through the existing object selector, X/Y/W/H controls, drag, resize gizmos, nudge, lock, undo/redo and focus workflow.
- Added **Collision Box** creation for room collision authoring; room collisions can also be duplicated and deleted.
- Street-only Add Object controls are hidden while authoring a room; room-only controls are hidden on Commerce Street.
- Published Commerce Alley data is loaded through the same public block-layout endpoint as Commerce Street and used by normal gameplay when available, with `public/subareas.js` remaining the authored fallback.
- Alley drafts/publish/history/revert now use `alley-commerce-01` as their own D1 document and do not overwrite `downtown-commercial-01`.
- Server validation now checks optional room obstacle and exit geometry before a room draft can be stored or published.
- Local Frontend Test keeps independent in-memory street/alley drafts when server mutations are unavailable, so switching editor scenes does not discard current authoring work.

## Hybrid H1.28 — stable drag math + direct diagonal zone handles

A full audit of the H1.27 workspace was run before this patch.

Audit findings:
- all 71 JavaScript files pass the repository syntax checker;
- the JS-only policy passes;
- the H1.27 runaway drag was confirmed in `onEditorPointerMove()`: pointer deltas were measured from the original pointer-down position but then added to geometry that had already moved on previous pointer events, compounding the movement until objects appeared to fly off-screen;
- polygon zones still received the legacy rectangular resize gizmos, so the bounding box remained the dominant editing UI;
- polygon visualization used a clipped rectangular element, which did not give a clear authored diagonal outline;
- polygon corner handles were only rendered after the scene had already been re-rendered with that object selected, so a first tap could select a zone without immediately exposing shape controls.

H1.28 repairs:
- every drag frame restores the exact pointer-down object snapshot and applies the total pointer delta once, eliminating cumulative/runaway movement in Window and Fullscreen modes;
- Walkable, Exit, Room Exit and Collision zones no longer receive rectangular resize gizmos;
- selecting one of those zones immediately shows four large touch-friendly corner handles even while it is still a rectangle;
- dragging any rectangle corner automatically converts that zone into a four-point polygon and moves only that vertex, producing diagonal sides directly;
- polygon outlines are rendered with a real SVG `<polygon>` so diagonal edges are visually explicit rather than appearing as a box;
- ADD POINT and DELETE POINT remain available for more complex concave/angled shapes, while MAKE BOX resets a polygon to its current bounding rectangle;
- polygon movement, collision, walkable bounds, exits and D1 validation remain compatible with H1.27 data;
- block-level `exits[]` now receive the same rectangle/polygon server validation as room exits.


## Hybrid H1.29 — free point insertion for authored zones

- Full current-snapshot audit completed before patching: all 71 JavaScript files passed syntax checks, JS-only policy passed, and all source-controlled `/assets/*` references resolved.
- `ADD POINT` is now a persistent tap-to-insert mode for Walkable, Collision, Block Exit and Room Exit geometry.
- Tap directly on an edge to insert at that exact edge position (respecting the current SNAP setting).
- Tap anywhere inside the selected shape to insert on the nearest edge, then continue the same pointer gesture to drag the new point inward/outward immediately.
- Edge selection is calculated from the visible vertex handles in screen space, so the same gesture works in normal Window mode, scaled editor views and iPhone fullscreen/rotated layouts.
- Point insertion stays active for rapid multi-point tracing until `TAP SHAPE…` is pressed again or another object is selected.
- `DELETE POINT` now requires an explicitly selected vertex and never reduces a polygon below three points.
- Polygon authoring is capped at 64 points, matching the server layout validator.

## Hybrid H1.30 — polygon-true player movement + diagonal boundary sliding

A full audit was run against the current `391b6cf6…` workspace before this patch.

The H1.29 editor polygon itself was valid, but gameplay still mixed polygon geometry with legacy rectangle-style movement rules:
- walkability only checked the player's anchor/center point instead of the full collision radius;
- movement resolved X and Y independently, which creates invisible-feeling barriers around diagonal and concave polygon edges;
- invalid positions were projected directly onto the polygon boundary, leaving the player on a point that could immediately fail the next movement check;
- depth scaling still read `walkable.x/y/width/height` directly instead of the actual polygon bounds.

H1.30 makes authored polygon zones authoritative for movement:
- the player uses an 18-unit circular gameplay radius for walkable and obstacle checks;
- the entire player circle must fit inside the authored walkable polygon;
- polygon and rectangular obstacles use circle-vs-shape distance rather than bounding-box-only collision;
- movement is sub-stepped and, when blocked, projected onto the actual nearest polygon edge tangent so the player slides naturally along diagonal walls and concave boundaries;
- invalid spawn/return positions are repaired to the nearest actually occupiable point instead of being snapped onto the boundary;
- player depth scaling uses the real walkable geometry bounds, so irregular polygons no longer inherit stale rectangle assumptions.

## Hybrid H1.33 — versioned scene runtime config + D1 integrity envelopes

- Camera/player/gameplay tuning is now stored as per-scene `runtimeConfig` data instead of requiring hardcoded runtime edits for every scene.
- The private Block Editor exposes scene controls for camera zoom, player visual scale, look-ahead, interaction radius, walk/run speed and player depth min/max. Street and room/sub-area values are independent and publish with that scene's normal D1 document.
- Commerce Street starts from a less aggressive `0.60` play camera scale and a `1.42` player base scale; Commerce Alley keeps room framing and starts at `1.85` player base scale. These are defaults only and can now be tuned in the editor.
- Runtime config schema v1 is Worker-validated with strict field/range checks before a draft can publish. Movement speed, camera, player presentation and interaction tuning are data; executable behavior, auth and player-owned state remain server code/state.
- Published block/scene JSON now has a companion SHA-256 integrity record in D1. Every public published read recalculates and verifies that hash before gameplay receives the config. A failed check returns no D1 block so the client uses the source-controlled fallback.
- Published revision history receives the same integrity envelope and is verified before a historical revision can be restored to draft.
- Legacy published rows without integrity metadata are schema/asset-validated once and backfilled so existing authored D1 layouts are not discarded during migration.
- Optional HMAC-SHA256 authenticity is supported through the Worker secret `CONFIG_SIGNING_SECRET`. When configured, publishing stores an HMAC signature and every read verifies it; existing SHA-only records automatically upgrade to HMAC on their next verified read.

Set the signing secret once for each Cloudflare environment (use a long random value, at least 32 characters):

```sh
npx wrangler secret put CONFIG_SIGNING_SECRET
```

The secret is never stored in D1 or sent to the browser. D1 stores only the config JSON, revision, SHA-256, signature and algorithm metadata. Without the secret the system still rejects accidental/corrupt SHA-256 mismatches, but HMAC is required to prevent a party with direct D1 write access from forging a replacement config.

## Hybrid H1.35 — source-controlled scene runtime config

- `public/config/scene-runtime.json` is now the canonical source-controlled fallback for per-scene runtime tuning such as camera zoom, player visual scale, movement speeds, depth scaling and interaction radii.
- Runtime precedence is: verified published D1 scene config → source-controlled `scene-runtime.json` → legacy JS scene defaults → hard runtime defaults.
- The game loads the source config before constructing Commerce Street or Commerce Alley, so values saved by the Editor's **SAVE PUBLISHED CONFIG TO WORKSPACE** flow survive a normal Local Test rebuild and become the repo fallback after the normal GitHub push.
- Older D1 scene revisions without `runtimeConfig` inherit the repo source config automatically; newer verified D1 revisions keep authority over the source fallback.
- The JS `runtimeConfig`, `camera` and `character` values in `block1.js` / `subareas.js` remain compatibility fallbacks during migration, but source tuning should be written to `public/config/scene-runtime.json` going forward.

## H1.36 — pure-JavaScript Block Editor purge

- Removed the old component-framework island and its JSX entry point from RiftCity.
- Replaced the private Block Editor shell with `public/editor/block-editor-ui.js`, a synchronous plain-ES-module UI mount that preserves every existing control ID, class and data attribute used by the runtime.
- `public/views/block-world.js` now dynamically imports the plain-JavaScript editor UI only inside the private developer workspace; player-facing Commerce Street does not load editor UI code.
- Removed the browser UI bundling step and its framework/build dependencies from `package.json`; `npm run build` is now policy verification plus direct JavaScript syntax checks.
- The pure-JavaScript policy now rejects JSX and the removed framework dependencies if they are accidentally reintroduced.
- Replaced the old hybrid migration roadmap with `docs/PURE-JS-EDITOR-ARCHITECTURE.md`.
- Cloudflare Worker/D1/R2 behavior, draft/publish/history APIs, scene config, polygon authoring, movement/collision, camera, fullscreen and Local Test contracts are otherwise unchanged.


## H1.37 — deterministic pure-JS Block Editor entry

- Added `public/editor/block-editor-entry.js` as the only composition point between the private Block Editor UI and the shared Block World runtime.
- Removed the editor-only runtime `import()` from `public/views/block-world.js`; gameplay no longer needs to resolve private editor modules.
- The private Worker Block Editor page now imports the dedicated editor entry module directly.
- The static relative import graph is safe to mount under the normal site root or the Editor Local Test `/__riftcity_local__/` prefix, which avoids iOS standalone/Home Screen failures caused by resolving an editor-only lazy module through a different service-worker client context.
- The pure-JavaScript guard now rejects any future direct `block-editor-ui.js` import from the shared Block World runtime.

## H1.39 — Downtown 3D empty street foundation

RiftCity's player-facing City route now starts the district-by-district 3D rebuild with one deliberately empty Downtown street segment. This milestone establishes the master physical scale before any buildings are added.

- Added a real Babylon/WebGL Downtown foundation with a `120 m` street segment, `14 m` road, `4 m` sidewalks, raised curbs and reserved buildable strips on both sides.
- World dimensions are authored in meters through `public/downtown3d-config.js`; future buildings, alleys, intersections and props can share the same scale instead of guessing from raster artwork.
- Asphalt, concrete and lot surfaces are generated as lightweight procedural textures at runtime, so the foundation does not add large scene-image downloads.
- Added a human-scale placeholder player (`1.75 m`) with camera-relative WASD/arrow and iPhone joystick movement, walk/run speeds, camera orbit/pinch zoom and smooth third-person follow.
- Added iPhone-friendly CSS fullscreen mode, camera reset and a small live FPS/scale readout so the street can be performance-tested on the target device before adding Building 01.
- Mobile rendering caps effective pixel density and uses a smaller shadow map to protect GPU budget from the first 3D milestone.
- The existing 2.5D Block World and private Block Editor are intentionally retained as rollback/reference tools while the 3D city direction is proven. No building meshes are loaded in this phase.
- Babylon loads only when the City route is opened; non-City screens do not pay the 3D engine cost.

Next intended milestone: lock road/sidewalk/player/camera proportions on iPhone, then add exactly one Downtown building to the reserved frontage.

## H1.40 — Rift Engine 0.1 raw WebGL2 foundation

The H1.39 Downtown scale test no longer depends on Babylon.js. The active City route now renders the same empty 120 m Commerce Avenue foundation through RiftCity's own small WebGL2 renderer.

- Added `public/rift-engine.js` as the first Rift Engine rendering core: WebGL2 context ownership, shader compilation, GPU geometry buffers, materials/colors, fog, directional lighting, draw submission, camera projection/view matrices and pixel-ratio-aware resizing.
- Added `public/rift-engine-math.js` for the engine-owned camera/matrix/vector math and `public/rift-engine-geometry.js` for reusable box, low-poly cylinder and low-poly sphere meshes.
- Rebuilt `public/downtown3d-foundation.js` on the Rift Engine API. There is no Babylon CDN request, no global `BABYLON`, no Three.js import and no external 3D-engine startup dependency on the active City route.
- Preserved the H1.39 master city scale: 120 m street, 14 m road, 4 m sidewalks, curbs, buildable frontage and a 1.75 m scale player.
- Preserved camera-relative WASD/arrow + joystick movement, run input, third-person orbit, pinch/wheel zoom, smooth camera follow, camera reset and fullscreen behavior.
- Replaced general-engine shadow/material systems with one intentionally narrow RiftCity shader path. The first renderer uses directional/ambient lighting, distance fog and cheap world-position surface noise; the player uses a lightweight ground shadow rather than a shadow-map pass.
- Static road geometry shares a few reusable GPU meshes instead of creating a unique mesh buffer for every road marking. The live HUD reports FPS and current draw count for device testing.
- The pure-JavaScript guard now rejects Babylon.js/Three.js references inside the active Rift Engine boundary so the custom renderer cannot silently drift back onto a third-party 3D engine.
- Existing older/inactive 3D experiment files remain in the repository as reference/rollback material, but `public/views/city.js` continues to enter only the new Downtown foundation.

Next milestone remains intentionally small: validate road/sidewalk/player/camera scale and FPS on the target iPhone, then add exactly one building using Rift Engine geometry/assets.

## H1.41 — Rift Engine 0.2 stable surfaces + unrestricted Road Painter

The first custom-renderer road test is now promoted into the beginning of a real RiftCity World Editor. This pass deliberately keeps the editor unrestricted while the toolchain is still being built/tested; there is no developer/admin role gate on the new Road Painter yet.

### Renderer cleanup

- Replaced the high-frequency world-position hash noise that made asphalt/ground shimmer and read like TV static while the camera moved.
- Rift Engine now uses smooth, low-frequency world-space material variation that stays spatially stable instead of aliasing across distant pixels.
- WebGL2 MSAA remains requested and the HUD now reports whether the browser actually granted antialiasing.
- Mobile render density is raised modestly from `1.35` to `1.45` while keeping the existing device-pixel-ratio cap.
- Canvas resizing is event-driven instead of re-running every animation frame.
- Rift Engine now exposes current draw statistics and can remove groups of generated drawables, which is required for live procedural road rebuilding.

### Rift World Editor 0.1 — Road Painter

- The active Downtown City route now exposes **WORLD EDITOR** to everyone during development; no role/auth restriction is applied in this phase.
- **PAINT** draws road centerlines directly on the 3D ground with touch/mouse input.
- **ERASE** removes road segments by swiping across them.
- **CAMERA** keeps orbit/pinch/wheel controls and lets a quick ground tap move editor focus to another part of the district.
- Road strokes support meter-grid snapping and optional `45°` angle snapping for clean city-block layouts.
- Endpoints snap onto nearby road nodes/segments automatically.
- When a newly painted road crosses an existing road, the graph splits both roads at the crossing and creates one shared intersection node automatically.
- T-junctions and four-way junctions therefore come from the road graph itself instead of manually placing intersection meshes.
- Generated asphalt, curbs, sidewalks and markings rebuild from the semantic road graph. Sidewalks/curbs are trimmed back at junction nodes so the crossing reads as an intersection rather than two sidewalks painted through each other.
- Erasing a branch prunes unused nodes and merges straight degree-two nodes, so a no-longer-needed intersection collapses back into a continuous road.
- Undo/redo is included from the first road-authoring pass.
- Road drafts autosave to browser `localStorage`, restore on reload, and can be exported as `riftcity-road-network` JSON for source integration later.
- **RESET SOURCE** returns to the original 120 m Commerce Avenue seed.

### World scale

- The authored ground canvas expands to `260 × 260 m`, giving the Road Painter enough room to draw several connected Downtown blocks before buildings are introduced.
- The original `120 m × 14 m` Commerce Avenue remains the source seed and preserves the previously approved road/sidewalk proportions.
- A lightweight 20 m editor grid appears only while World Editor mode is active.

The road graph is intentionally stored as nodes + segments + road profiles rather than thousands of baked vertices. Rift Engine generates the visual road geometry from that small semantic graph, establishing the path for future road profiles, city-block detection, streaming chunks, procedural sidewalks and building placement.

## H1.42 — Continuous curved roads + junction mesh repair

The Road Painter renderer now treats authored centerline chains as continuous procedural paths instead of rendering every graph segment as an isolated box. This directly targets the broken/gapped geometry seen on bends and at multi-road junctions.

- Added Rift Engine custom mesh support with automatic 16/32-bit index buffers and owned GPU-buffer cleanup when generated road geometry is rebuilt.
- Same-profile degree-two road nodes are collected into logical render chains. Gentle turns are filleted into smooth quadratic path samples while deliberate sharp city corners remain sharp.
- Asphalt is generated as a continuous mitered ribbon along the complete path, eliminating cracks/overlaps between the old straight box pieces on curves.
- Sidewalks and curbs are generated from the same offset path, so their width remains stable through bends instead of separating into triangular slabs.
- Center dashes and roadside transverse markings now follow local curve tangents rather than keeping the orientation of an individual straight segment.
- Junction branches are trimmed by real path distance. A raised semantic junction hull masks coplanar road overlap, while generated sidewalk/curb corner wedges close the gaps around T-junctions and four-way intersections.
- Road painting now samples touch/mouse strokes at roughly 2.2 m instead of 7 m, giving curves enough control points to stay smooth without increasing render draw calls per segment.
- Road Painter now defaults to 0.5 m grid snapping with free-angle drawing. Optional 45-degree snapping remains available for rigid city-grid streets.
- Existing saved `riftcity-road-network` drafts remain schema-compatible and are rebuilt with the new geometry automatically.

The network is still semantic nodes + segments; the patch changes how that compact graph is converted into GPU geometry. Curved roads therefore remain editable, splittable at crossings, erasable, undoable and exportable rather than becoming baked meshes.


## H1.43 — locked meter scale + road weld pass + automatic editor freecam

This pass locks the physical world contract before larger district generation starts and gives the current Road Painter one more reliability pass.

- Added `public/rift-world-scale.js` as the canonical physical-scale contract: **1 Rift world unit = 1 meter**. The reference catalog includes a 1 m cube, 1.75 m human, 0.9 × 2.05 m doorway, 4.5 m reference car, 2.5 × 5.5 m parking stall, 3.25 m traffic lane, 0.15 m curb and 3.4 m building-floor height.
- Downtown config now consumes the shared scale contract instead of independently hardcoding player/curb measurements. The live HUD shows the 1:1 unit rule and player reference height.
- World Editor adds a **REFERENCE** kit that can be spawned beside the current editor focus with the calibration cube, human, doorway, car/parking stall and floor-height marker.
- World Editor adds a **MEASURE** tool; ground-to-ground measurements report true meters using the same 1:1 world scale.
- Entering World Editor now starts in **FREECAM** automatically. The player freezes in place; WASD/arrows pan the detached editor camera, Shift accelerates, and orbit/pinch/wheel/tap-focus remain available. Returning to **PLAY MODE** restores the gameplay camera onto the unchanged player position.
- Road cleanup now welds near-identical nodes, removes microscopic/duplicate edges and runs the same repair path after imports, drawing and erasing.
- Curved road paths are uniformly resampled before mesh generation, sharp offset miters are clamped more aggressively, and road/sidewalk/curb strips use shared indexed vertex pairs so adjacent triangles physically share the same edge.
- Junction asphalt now owns the intersection center while branch ribbons are trimmed back with only a very small overlap, reducing the raised/overlapping artifacts that remained after H1.42.
- Existing `riftcity-road-network` JSON remains compatible.

This is still the pre-district-generator foundation: scale, roads and editor navigation are being made deterministic before chunk/block generation is layered on top.

## H1.44 — true 1m visible Block World pivot

RiftCity's active Downtown foundation is now a literal visible block world rather than a smooth procedural-road scene. The previous road graph/renderer files are retained as rollback/reference code, but the active City route no longer depends on them.

- The permanent physical contract is now **1 world unit = 1 meter = one 1 × 1 × 1 m block**.
- Added `public/rift-block-world.js`, a sparse chunked block-world runtime with one-meter cells, material registry, source snapshots, block collision queries, local editing, chunk rebuilds and streamed chunk visibility.
- Downtown uses `32 × 32 m` X/Z chunks and loads only a configurable radius around the player or editor freecam instead of keeping the entire district rendered.
- Chunk geometry culls hidden block faces and groups visible faces by material into custom Rift Engine meshes, so thousands of logical blocks are not thousands of WebGL draw objects.
- Rift Engine adds an optional world-space one-meter seam shader. Block-world meshes visibly read as individual cubes even when adjacent exposed faces are batched into one GPU mesh.
- Added `public/downtown-block-world.js` as the first source-controlled block district seed: Commerce Avenue, a cross street, sidewalks, one-meter road-marking cells, parking/service surfaces and four deliberately block-built Downtown structures.
- The player now collides with structure blocks while preserving camera-relative movement, joystick controls, run input and the 1.75 m physical reference.
- The temporary player/reference silhouettes are made more block-like so the active foundation visually commits to the new art direction.
- The old Road Painter UI is replaced on the active Downtown route by **RIFT BLOCK WORLD 0.1 / 1M BLOCK EDITOR**.
- Editor tools: **BRUSH**, **ERASE**, **LINE**, **RECT**, **MEASURE** and automatic **FREECAM**. Lines intentionally staircase on diagonals instead of generating smooth geometry.
- Editor Y-level controls author the surface layer (`Y -1`) or stack real building blocks upward. Brush sizes cycle through 1×1, 3×3 and 5×5 cells.
- Ground-layer erase restores the implicit default ground cell; structure-layer erase removes the block entirely.
- Undo/redo, local draft restore, scale reference kit and JSON export now operate on the `riftcity-block-world` snapshot instead of road-network JSON.
- Exiting Edit Mode still snaps the camera back to the unchanged player position.

The next architecture layer can now be a block stamp/prefab system and district generator: roads, lots and buildings can be authored as reusable arrangements of the same one-meter cells instead of introducing another geometry system.


## H1.45 — single production RiftBlock diagnostic

Before scaling the visible block world beyond one cell, the active City route is intentionally reduced to one exact `1 × 1 × 1 m` RiftBlock. This is a renderer-validation milestone, not a city-content pass.

- The block uses the same six face definitions that `RiftBlockWorld` chunk meshing uses; there is no separate test-only cube implementation.
- Corrected the block-world face winding so every emitted triangle is CCW when viewed from outside, matching Rift Engine's `gl.frontFace(gl.CCW)` + back-face culling contract.
- Added a runtime face-winding validator. Startup fails loudly if any of the six production faces points inward.
- The diagnostic block is exactly 24 vertices / 12 triangles / 6 quads and occupies world coordinates `0..1` on X/Y/Z.
- The test camera can orbit almost completely over and under the block, zoom close/far, and works with touch, mouse, wheel and pinch.
- The HUD identifies the dominant viewed face (`±X`, `±Y`, `±Z`) and reports FPS, draw count and MSAA state.
- Back-face culling is ON by default and can be toggled for comparison; optional auto-spin helps expose angle-dependent defects.
- Fullscreen remains available for direct iPhone/Safari verification.
- Roads, buildings, chunk streaming, player movement and the World Editor are intentionally absent from this active test scene until the one-block renderer is visually verified.

Next validation sequence after this block is confirmed clean: two touching blocks → 2×2 floor → tiny wall/room → chunk meshing.

## H1.46 — two touching production RiftBlocks

The active City diagnostic advances by exactly one step: two adjacent `1 × 1 × 1 m` production RiftBlocks and nothing else.

- The pair is authored at `(0,0,0)` and `(1,0,0)`, so the blocks share one complete X-axis face.
- Added a reusable `createRiftBlockSetGeometry()` helper that compiles arbitrary occupied cells with the same six production face definitions used by the block-world renderer.
- Neighbor occupancy is checked before face emission. The east face of block 1 and west face of block 2 are therefore not sent to the GPU at all.
- The diagnostic asserts the exact expected result at startup: **2 blocks → 10 visible faces → 40 vertices → 20 triangles**. A mismatch fails loudly instead of rendering a questionable mesh.
- Both blocks are uploaded as one custom Rift Engine mesh and one draw call, preserving the production direction of compiling block cells into GPU geometry rather than creating one WebGL object per block.
- Back-face culling remains ON by default, with the existing culling toggle, full over/under orbit, pinch/wheel zoom, spin, FPS, draw-count and MSAA diagnostics.
- The camera now targets the center of the two-block pair.
- Roads, player, chunks, buildings and the editor remain intentionally absent while this neighbor-culling stage is verified visually.

Next validation step after this pair is confirmed clean: `2 × 2` floor → tiny wall/room → chunk section compilation.

## H1.47 — 2 × 2 production RiftBlock floor

The active City diagnostic advances one controlled step beyond the verified touching pair: four production `1 × 1 × 1 m` RiftBlocks arranged as a flat `2 × 2` X/Z floor.

- Cells are authored at `(0,0,0)`, `(1,0,0)`, `(0,0,1)` and `(1,0,1)`.
- The same `createRiftBlockSetGeometry()` production helper compiles the set; no test-only cube or alternate mesh path is introduced.
- The layout creates four internal block adjacencies: two along X and two along Z. Neighbor culling must remove both faces for every shared boundary.
- The diagnostic asserts the exact production result at startup: **4 blocks → 16 visible faces → 64 vertices → 32 triangles**. Any mismatch fails loudly.
- All four blocks are uploaded as one Rift Engine mesh / one draw object, proving neighbor culling across two horizontal axes while retaining the same deterministic CCW face winding.
- Back-face culling remains ON by default. Full over/under orbit, pinch/wheel zoom, optional spin, FPS, draw count, MSAA and fullscreen diagnostics remain available.
- The camera now targets the exact center of the `2 × 2` floor. Roads, player, buildings, editor and chunk streaming remain absent so this test stays isolated.

Next validation step after the `2 × 2` floor is visually confirmed: `2 × 2 × 2` vertical block volume → tiny wall/room → chunk section compilation.



## H1.48 — 2 × 2 × 2 production RiftBlock volume

The isolated City diagnostic now adds the first vertical block layer: eight production `1 × 1 × 1 m` RiftBlocks arranged as one solid `2 × 2 × 2` volume.

- The bottom layer remains the verified H1.47 `2 × 2` X/Z floor; an identical four-block layer is stacked directly above it at `Y = 1`.
- Before the full volume is uploaded, startup separately validates a two-block vertical pair: **2 blocks → 10 visible faces → 40 vertices → 20 triangles**. This directly proves that the production neighbor lookup removes a shared `+Y / -Y` face pair.
- The full volume contains 48 theoretical block faces and 12 shared adjacencies: four along X, four along Y and four along Z.
- The production mesher must therefore emit exactly **8 blocks → 24 exterior faces → 96 vertices → 48 triangles**. Any mismatch fails loudly before the diagnostic is considered ready.
- All eight logical blocks still compile into one Rift Engine mesh / one draw object; this is not eight WebGL cube objects.
- The same deterministic outward normals, CCW winding, back-face culling, over/under orbit, pinch/wheel zoom, optional spin, FPS, draw-count, MSAA and fullscreen diagnostics remain active.
- The camera target moves to the geometric center of the solid volume at `(1,1,1)` so the top and bottom layers can be inspected evenly from every angle.
- Roads, player, buildings, editor and chunk streaming remain intentionally absent. This milestone tests vertical-neighbor culling only.

Next validation step after the `2 × 2 × 2` volume is visually confirmed: a tiny hollow room that tests interior-facing surfaces before real chunk-section compilation.


## H1.49 — first tiny hollow RiftBlock room

The isolated renderer diagnostic now moves from solid test volumes to the first structure with a real interior cavity. Textures, chunk streaming and gameplay remain deliberately deferred so interior block geometry can be validated on its own.

- The room uses a solid `5 × 5` one-block floor at `Y = 0` and a three-block-high perimeter wall at `Y = 1..3`.
- A centered south-wall doorway removes exactly two wall cells at `Y = 1` and `Y = 2`, while retaining the floor beneath it and the `Y = 3` lintel block above it.
- There is intentionally **no roof** in this milestone, making the cavity easy to inspect before fully enclosed-room rendering is tested.
- The room contains exactly **71 logical 1 m blocks**. The production neighbor-culling mesher must emit **168 exposed faces → 672 vertices → 336 triangles**. Startup fails loudly if those values or the doorway occupancy contract do not match.
- Interior-facing wall/floor surfaces and exterior-facing surfaces are compiled by the same `createRiftBlockSetGeometry()` path into **one Rift Engine mesh / one draw object**; there is no special interior mesh.
- Added **VIEW INSIDE / VIEW OUTSIDE** camera presets. The inside preset places the production orbit camera inside the empty cavity with a short near plane so interior wall faces, corners and the doorway can be inspected directly on iPhone/Safari.
- The outside preset keeps the full over/under orbit used by earlier diagnostics. Back-face culling remains ON by default with the same culling toggle, optional spin, pinch/wheel zoom, FPS, draw-count, MSAA and fullscreen diagnostics.
- No texture atlas is introduced yet. The room remains a flat diagnostic material until geometry/interior behavior is proven.

Next validation step after the open-roof room is visually confirmed: add a block roof and test a completely enclosed interior before moving on to real chunk-section compilation.

## H1.50 — roofed hollow RiftBlock room

The renderer diagnostic keeps the verified H1.49 room layout and adds only one production block roof so ceiling rendering can be checked before chunk/section work begins.

- The existing `5 × 5` floor remains at `Y = 0`, with the same three-block-high perimeter walls at `Y = 1..3`.
- The centered south doorway still removes the `Y = 1` and `Y = 2` wall cells and keeps its `Y = 3` lintel.
- A complete `5 × 5` one-block-thick roof is added at `Y = 4`, creating 25 roof blocks without filling the `3 × 3 × 3` interior air cavity.
- Startup validates the roof cell-by-cell, confirms the doorway stays open, confirms the cavity center stays empty and re-runs the production face-winding validator.
- The complete structure is exactly **96 logical blocks → 206 exposed faces → 824 vertices → 412 triangles**.
- All floor, wall, doorway, ceiling and outside-roof faces are compiled by the existing `createRiftBlockSetGeometry()` production path into **one Rift Engine mesh / one draw object**.
- **VIEW INSIDE** keeps the orbit camera inside the air cavity and allows both upward ceiling inspection and downward floor inspection with the short `0.02 m` near plane.
- **VIEW OUTSIDE** keeps full over/under orbit so the roof top, outer walls and doorway can be checked from every side.
- Back-face culling stays ON by default with the existing toggle, spin, pinch/wheel zoom, FPS, draw-count, MSAA and fullscreen diagnostics.
- Textures, texture atlases, gameplay, roads, buildings and chunk streaming remain deliberately deferred.

Next validation step after the roofed room is visually confirmed: move from isolated structures to the first production block section/chunk compilation test.

## H1.50.1 — deterministic RiftBlock face-light diagnostic

The verified H1.50 roofed-room geometry is intentionally unchanged. This micro-pass isolates the reported visual case where a roof/ceiling corner could appear smooth from one viewing direction even though the block normals and geometry were valid.

- Rift Engine now has an **optional per-drawable block-face shading mode**. It is disabled by default, so existing non-block rendering and future materials keep the previous directional-light path unless they opt in.
- The block-face mode uses the already-authored flat face normal to choose deterministic axis brightness: upward faces are brightest, downward faces darkest, X-facing walls medium-dark and Z-facing walls medium-light. This guarantees visible contrast across a 90-degree block corner without beveling or changing geometry.
- The H1.50 room enables this mode by default and adds **SHADE ON / SHADE OFF** so the same camera angle can be compared immediately against the old directional-only lighting.
- The room remains exactly **96 logical blocks → 206 exposed faces → 824 vertices → 412 triangles**, compiled into the same one Rift Engine mesh. No blocks, normals, winding, culling rules or camera collision geometry are changed.
- Back-face culling remains independently toggleable. The new face shading is not a culling workaround and does not make meshes double-sided.
- Texture work and the one-meter block-grid seam shader remain off. This pass tests only whether hard 90-degree block edges read clearly before section/chunk compilation begins.

If the previously smooth-looking roof/ceiling corner stays visually hard with **SHADE ON** from the same inside angle, the geometry diagnosis is complete and the next milestone can move to the first production block section/chunk test.



## H1.51 — first production 16×16×16 RiftSection

The isolated geometry tests are now promoted into the first real logical block section. This milestone keeps the visual scene deliberately small while introducing the storage and rebuild boundary the city will scale on later.

- Added `public/rift-block-section.js` with a true **16 × 16 × 16** logical section containing exactly **4096 cells**.
- Block state is stored in one compact `Uint16Array(4096)`, consuming **8192 bytes (8 KB)** for the complete section instead of allocating one JavaScript object per cell.
- Section indexing follows `y << 8 | z << 4 | x`, with runtime checks for the first/last cells and all three axes.
- `RiftBlockSection` owns block reads/writes, AIR/SOLID states, box fills, dirty state, logical revision and mesh revision.
- Editing a cell marks only the section dirty. Compiling its mesh clears the dirty flag and records the exact logical revision used to produce the GPU geometry.
- The production section mesher walks logical cells, tests the same six proven RiftBlock face directions and emits a quad only when the neighboring cell is AIR.
- Neighbor faces between touching solid cells therefore remain logical data but are **not uploaded as GPU geometry**.
- The controlled base pattern contains an `8 × 8` floor plus a centered `4 × 4 × 4` tower: **128 solid cells → 224 visible faces + 544 hidden touching faces → 896 vertices → 448 triangles**.
- The **MUTATE** test performs both edit directions: four rooftop cells change AIR→SOLID and one wall cell changes SOLID→AIR. The section must become dirty and rebuild to exactly **131 solid cells → 236 visible faces + 550 hidden faces → 944 vertices → 472 triangles**.
- The entire section still uploads as **one Rift Engine mesh / one draw object**. Mutation replaces that one compiled mesh rather than creating WebGL objects per block.
- The deterministic hard block-face shading proven in H1.50.1 remains enabled so 90-degree edges stay readable.
- Textures, atlas UVs, neighboring sections, section streaming and a full city remain intentionally deferred until this single section's storage/edit/rebuild behavior is visually confirmed.

Next validation after H1.51: prove **neighbor-aware meshing across two adjacent 16³ sections**, especially a solid block pair touching across the section boundary, then introduce section streaming/reuse around the camera.

## H1.52 — neighboring 16×16×16 RiftSections

The first production section is now paired with a second independently stored section so RiftCity can prove that section boundaries do not become visible seams or duplicate hidden geometry.

- Added `RiftSectionGrid`, a lightweight loaded-section registry keyed by section coordinates. It resolves world block coordinates into the correct 16³ section/local cell and supplies neighbor state to the existing section mesher.
- Two adjacent sections are loaded at `(0,0,0)` and `(1,0,0)`, giving **8192 logical cells** in two independent `Uint16Array(4096)` buffers for **16 KB total block-state storage**.
- The H1.51 `8 × 8` floor + `4 × 4 × 4` tower is deliberately split across the X boundary: section A ends at local `X=15`, while section B begins at local `X=0` / world `X=16`.
- Each section still owns and uploads its own GPU mesh. The test therefore renders exactly **two section draw objects**, not one object per block.
- Neighbor-aware meshing checks the loaded adjacent section whenever a face reaches the local section edge. A solid cell on A's `X=15` touching a solid cell on B's `X=0` suppresses both hidden faces exactly like two blocks inside one section.
- The base pattern contains **24 solid block pairs touching across the section boundary**. If each section were meshed in isolation it would upload 272 visible faces; neighbor-aware meshing uploads only **224**, proving that **48 hidden cross-section faces are removed**.
- Exact base totals remain the same continuous shape as H1.51: **128 solid cells → 224 visible faces + 544 hidden faces → 896 vertices → 448 triangles**. Each section contributes exactly 64 blocks / 112 visible faces / 272 hidden faces.
- `RiftSectionGrid.setBlockWorld()` now invalidates the edited section and any loaded neighboring section whose boundary visibility can change. Interior edits do not unnecessarily dirty unrelated sections.
- **CUT BOUNDARY** removes the visible world cell `(16,2,6)` from section B's local `X=0` edge. The edit must dirty both B and neighboring A before either mesh is rebuilt.
- The cut state is exactly **127 solid cells → 228 visible faces + 534 hidden faces → 912 vertices → 456 triangles**. Boundary contacts drop from 24 to 23, and 46 otherwise-hidden cross-section faces remain suppressed.
- **RESTORE** writes that boundary block back and again invalidates/rebuilds both dependent section meshes, returning to the exact base totals.
- Grid validation also checks world→local mapping at `X=16`, conservative neighbor invalidation on section load/unload, and that a non-boundary edit dirties only its owning section.
- Deterministic hard RiftBlock face shading, CCW winding, back-face culling, orbit/pinch controls, fullscreen, FPS and MSAA diagnostics remain unchanged. Textures are still deferred.

Next validation after H1.52: introduce a small camera-centered loaded-section window and prove section load/unload/reuse without changing the logical block or meshing contracts.

## H1.53 — camera-centered 3×3 RiftSection streaming window

The verified cross-section meshing contract now becomes a small loaded-world window around the camera. This milestone proves that RiftCity can keep a fixed amount of logical/GPU section state resident while the camera crosses section boundaries.

- Added `RiftSectionStreamWindow`, a deterministic horizontal loaded-section manager built on the existing `RiftSectionGrid`.
- The first streaming radius is `1`, so exactly **3 × 3 = 9** horizontal `16 × 16 × 16` sections stay loaded around the current center section.
- Nine sections represent **36,864 logical block cells** while using only **73,728 bytes (72 KB)** of `Uint16` block-state memory.
- Each diagnostic section contains a full `16 × 16` one-block floor plus a small interior `2 × 2 × 3` pillar. The pillar quadrant is derived from section coordinates so the streamed world visibly changes while every section keeps the same geometry budget.
- The loaded 3×3 window contains exactly **2,412 solid blocks → 5,016 visible faces + 9,456 hidden faces → 20,064 vertices → 10,032 triangles**.
- If those nine sections were meshed independently they would upload 5,400 visible faces. The loaded grid has **192 touching block pairs across section boundaries**, so neighbor-aware meshing removes **384 duplicate hidden cross-section faces**.
- WEST / EAST / NORTH / SOUTH shift the stream center by exactly one full 16 m section. A one-section move retains six sections, unloads three and loads three.
- Section add/remove still invalidates only meshes whose loaded-neighbor exposure can change. In this deliberately edge-to-edge floor test, all nine meshes become dirty after a one-section shift because both the old window edge and the new interior/window edge change.
- Rift Engine now exposes `updateMesh()` so a streamed section can replace vertex/index contents **inside an existing custom mesh buffer/VAO** instead of deleting and creating a new draw object every time.
- The first nine section drawables become a fixed GPU slot pool. On every one-section shift, the three slots released by unloaded sections are reassigned to the three newly loaded sections while retained dirty sections update their existing buffers.
- The diagnostic asserts that the engine remains at exactly **9 section draw objects** while the stream moves. GPU slot creation stays at nine; the reuse counter increases by exactly three for every one-section shift.
- Camera target moves to the center of the active section. Touch orbit/pinch, mouse orbit/wheel, fullscreen and keyboard `WASD`/arrow section stepping remain available.
- Runtime validation also checks negative world coordinates so crossing west/north of world zero still maps to the correct negative section coordinates.
- Textures remain deferred. The streamed sections keep the proven hard RiftBlock face shading and exposed-face meshing path.

Next validation after H1.53: introduce a larger logical world/source behind the fixed loaded window, preserve edited section data across unload/reload, and then separate logical-world persistence from the nine resident render sections.


## H1.54 — persistent logical world source behind streamed RiftSections

H1.53 proved that RiftCity can keep only a fixed `3 × 3` render window resident. H1.54 separates that resident render state from a larger logical world source so unloading a section no longer means forgetting edits made to it.

- Added `RiftSectionWorldSource`, a deterministic base-world + sparse-override layer independent from `RiftSectionGrid` and the nine resident GPU meshes.
- Unmodified sections are regenerated from the deterministic section source on demand. Changed cells are stored as sparse `(section, cell index, state)` overrides instead of keeping an 8 KB state buffer for every section ever visited.
- `RiftSectionStreamWindow` can now be backed by a world source. Loading a section hydrates a fresh `RiftBlockSection` from generated base data plus any stored overrides; unloading removes only the resident section object.
- World edits can be written even when their target section is currently unloaded. If the section is resident, the same write updates its local state and dirties only the required mesh/neighbor set.
- Returning a cell to its generated base state removes the sparse override entirely instead of storing redundant data.
- The diagnostic target is world cell `(8,1,8)` in section `(0,0)`. **PLACE MARKER** changes that generated AIR cell to SOLID and creates exactly one persistent override.
- With the marker resident, the exact loaded-window geometry becomes **2,413 blocks → 5,020 visible faces → 9,458 hidden faces → 20,080 vertices → 10,040 triangles**.
- Move two section steps far enough that section `(0,0)` leaves the `3 × 3` window. The resident geometry returns to the unchanged H1.53 baseline, but the logical source still reports the marker as SOLID.
- Return until section `(0,0)` is loaded again. The runtime requires a **new section object** and verifies that the marker is rehydrated from the logical source before declaring the round trip passed.
- **CLEAR MARKER** restores generated AIR and deletes the override. The loaded geometry returns exactly to **2,412 blocks / 5,016 visible faces / 9,456 hidden faces / 20,064 vertices / 10,032 triangles**.
- The loaded render budget remains fixed at **9 sections / 36,864 cells / 72 KB logical state / 9 GPU mesh slots** throughout streaming and persistence tests.
- Cross-section culling remains unchanged at **192 touching boundary pairs / 384 suppressed GPU faces** for the diagnostic floor.
- `exportOverrides()` exposes deterministic sparse records for a later save/database layer, but H1.54 persistence is intentionally **runtime logical persistence across section unload/reload**, not yet permanent storage across a browser refresh or server restart.
- Textures remain deferred; all tests continue using the proven hard RiftBlock face shading and exposed-face meshing path.

Next validation after H1.54: replace the repeated diagnostic section generator with the first actual RiftCity world source/grid (ground, road/sidewalk/buildable block patterns) while keeping the same fixed resident window, sparse edits and GPU-slot reuse contract.

## H1.54.1 — steep-angle RiftBlock face readability

H1.54's persistent 3 × 3 section stream is unchanged. This micro-pass fixes the last diagnostic readability defect found from a near top-down iPhone camera angle: an elevated block's top/rear silhouette could visually merge into the lower +Y ground because both surfaces shared the same flat top-face tone.

- RiftBlock geometry, face winding, culling, section storage, sparse world overrides, streaming and GPU-slot reuse are unchanged.
- The deterministic block-face shader now distinguishes all four horizontal face directions instead of giving both X directions one value and both Z directions one value. This keeps opposite/rear faces from collapsing to identical tones as the camera rotates.
- +Y faces get a small opt-in elevation cue: `2.8%` per meter above the configured block-ground reference, capped at `12%`. The H1.54 diagnostic uses a `1 m` top-surface baseline, so the streamed ground remains unchanged while raised pillar tops separate subtly from it.
- The elevation cue applies only to upward RiftBlock faces and only on drawables that opt in. Non-block Rift Engine drawables and underside faces are unaffected.
- There are still no bevels, outlines, texture seams or shadow-map costs. The fix is a few scalar operations in the existing fragment shader and does not add draw calls.
- H1.54's exact resident-state, cross-section culling, persistence round-trip and nine-GPU-slot contracts remain the validation baseline.

Next validation: revisit the steep top-down view that produced the V-shaped silhouette. If the raised block now keeps a readable top/rear edge while H1.54 persistence still passes, proceed to H1.55's first actual RiftCity street/world grid.

## H1.55 — first actual RiftCity block-built street slice

The renderer/section diagnostics now give way to the first authored RiftCity world surface. Commerce Avenue is generated from the same exact `1 m × 1 m × 1 m` logical RiftBlocks, the same `16 × 16 × 16` sections, the same 3 × 3 streaming window and the same sparse logical-world source proven in H1.45–H1.54.1.

### Locked first-slice dimensions

- East/west Commerce Avenue road: **14 m** wide.
- North/south cross street: **14 m** wide.
- Intersection: **14 × 14 m**.
- Sidewalk band on each road edge: **4 m** total.
- The road-adjacent **1 m** of that sidewalk band is authored as a distinct curb material cell.
- Service alley opening: **4 m** wide, cut through the north sidewalk into the buildable lot.
- Everything outside road/sidewalk/alley cells in this slice is a buildable-lot surface.

A physically raised curb is intentionally **not** faked with a full RiftBlock. Because every logical RiftBlock is exactly one meter tall, raising the sidewalk by one cell would create a one-meter curb. H1.55 therefore preserves the exact one-meter voxel contract and represents the curb as a one-cell material band at road height. Fractional slab/micro-geometry can be introduced later without changing these road/sidewalk measurements.

### One streamed mesh per section with temporary material colors

H1.55 adds optional per-vertex RGB to Rift Engine geometry. Old six-float position/normal geometry remains valid and is expanded internally with white vertex color, while RiftSection geometry now emits a nine-float position/normal/color stream.

This lets road, sidewalk, curb, lot and alley states appear as distinct temporary colors **inside the same section mesh**. The 3 × 3 resident window therefore remains:

- **9 loaded sections**
- **36,864 logical cells**
- **72 KB resident block-state memory**
- **9 GPU mesh slots / 9 draw objects**
- GPU slots are reused when streaming shifts instead of growing over time.

The temporary colors are not the final texture system. The future atlas can replace the color lookup at mesh-build time without changing logical city geometry or section streaming.

### H1.55 geometry contract

Every loaded section in this first slice contains one complete ground layer, regardless of its material state. Across the resident 3 × 3 window that produces:

- **2,304 solid RiftBlocks**
- **4,800 visible faces**
- **9,024 hidden/internal faces removed**
- **19,200 vertices**
- **9,600 triangles**
- **192 touching cross-section block pairs**
- **384 cross-section faces suppressed**

At initial center `0,0`, the visible 48 × 48 m window contains exactly:

- **1,148 road cells**
- **336 sidewalk cells**
- **128 curb-band cells**
- **624 buildable-lot cells**
- **68 alley cells**

The existing H1.54 persistent-world regression test still runs during startup, and H1.55 adds its own city-world validation for exact dimensions, material classification, per-vertex color stride, cross-section culling, 3/3/6 stream churn and sparse edit unload/reload hydration.

Next milestone: turn the locked street/intersection/alley measurements into reusable city stamps/prefabs so the same authored patterns can generate multiple connected RiftCity blocks without hardcoding every cell.


## H1.56 — switchable RiftBlock Shape Lab

RiftCity's block renderer now supports a first-generation partial-shape vocabulary without abandoning the exact 1 m logical cell grid.

- Existing material-only block states remain full `1 × 1 × 1 m` RiftBlocks and keep the original fast six-face meshing path.
- Added compact shape/rotation bits inside the existing `Uint16` block state:
  - full block;
  - bottom half slab (`0.5 m` high);
  - top half slab (`0.5 m` high);
  - stair with two `0.5 m` steps;
  - stair rotation north/east/south/west.
- Partial shapes use an internal `2 × 2 × 2` half-meter occupancy mask. This is meshing metadata inside one logical 1 m cell, not a change to RiftCity's world grid.
- Shape-aware meshing evaluates the actual occupied half-meter regions on both sides of a contact. A full block touching a slab therefore culls only the covered half of the shared face instead of deleting the whole face.
- Exposed half-meter surface tiles are merged back into larger axis-aligned quads inside each logical cell before upload, keeping full faces compact while still supporting stair risers, slab tops and partial neighbor coverage.
- Sections that contain no slabs/stairs continue to use the proven H1.55 full-block fast path, so the current Commerce Avenue street slice and its exact geometry/performance contract are unchanged underneath the lab.

The active City route is temporarily a switchable validation lab with these scenes:

- **ALL** — representative full block, both slab types, all stair rotations, mixed contacts and a staircase in one shape mesh;
- **FULL** — two touching legacy full blocks, still exactly 10 visible quads / 20 triangles;
- **SLABS** — isolated top/bottom slabs, touching bottom slabs and vertically touching top/bottom slabs;
- **STAIRS** — north/east/south/west stair orientation validation;
- **STAIRCASE** — three stair cells forming six continuous `0.5 m` steps over a 3 m rise;
- **MIXED** — full↔slab, full↔stair, slab↔stair and stair↔stair contacts;
- **OCCLUSION** — focused partial shared-face coverage test.

Every scene has locked expected counts for occupied logical cells, occupied half-cells, exposed/hidden half-meter surface tiles, merged GPU quads, vertices and triangles. The lab can switch scenes without reloading the page and keeps orbit, pinch/wheel zoom, top-view, spin, culling and fullscreen diagnostics.

`npm run build` remains Pure-JavaScript only and now syntax-checks 88 JavaScript files.

Next intended step after visual validation: return the new full/slab/stair vocabulary to the real Commerce Avenue world, then use it for realistic sidewalk/entrance transitions before city stamp/prefab work.

## H1.57 — JSON city-block importer + Commerce Block 01

H1.56 proved the first-generation full/slab/stair vocabulary. H1.57 stops hardcoding each city test directly into the active renderer and introduces a compact authored JSON asset contract so complete city blocks can be generated, swapped and tested without changing the engine code for every visual iteration.

### Compact block asset contract

- Added `riftcity-city-block` JSON format version 1.
- The logical world remains exactly **1 m per cell**. The current JSON contract explicitly requires `cell_size: 1` and `shape_increment: 0.5`.
- Palette entries resolve to the existing compact `Uint16` RiftBlock state: material ID + full/slab/stair shape + stair rotation.
- Supported authored operations are intentionally small and deterministic:
  - `set` for one logical cell;
  - `fill_box` for an inclusive block region;
  - `cut_box` for an inclusive AIR region;
  - `hollow_box` for block-built walls/floor/roof with integer wall thickness.
- A JSON block is expanded into normal `RiftBlockSection` objects, then meshed through the same cross-section neighbor culling and shape-aware partial-occlusion path already proven in H1.51–H1.56.
- The importer rejects wrong formats/versions, non-meter grids, unsupported shapes/rotations, writes outside declared bounds, oversized imports and operation bombs before touching the active preview.
- Local `.json` files can be selected from the City preview with **IMPORT JSON**. A failed local import leaves the currently rendered block intact.
- **BLOCK 001** reloads the bundled authored asset at any time, so generated JSON iterations can be compared without modifying renderer code.

### First authored block: Commerce Block 01

The bundled `public/riftcity-blocks/downtown-block-001.json` is a **64 × 64 m** block with a maximum authored height of 16 m. It intentionally uses only the block shapes already validated in H1.56—full blocks, top/bottom slabs and directional stairs—and keeps the visual language block-built with no curves, bevels, smooth wedges or arbitrary scaled detail.

The first block contains four coarse building masses:

- **Mercer Apartments** — red-brick mid-rise with two front window groups, block entrance landing/stairs and a rooftop utility box.
- **Commerce Shops** — lower dark-brick storefront row with placeholder glazing, three entrances and a blocky slab awning.
- **Rift Offices** — stone office shell with front glazing groups and a stair entrance.
- **Warehouse Lofts** — tallest dark-brick shell with loading entrance, upper windows and rooftop utility mass.

A **4 m service alley** crosses the block between the north/south building pairs, with additional 4 m service/pedestrian gaps separating the east/west buildings.

### Locked Block 001 import totals

The bundled JSON has 34 compact operations and must compile to exactly:

- **12,533 occupied logical cells**
- **166 partial slab/stair cells**
- **16 RiftSections**
- **128 KB logical `Uint16` section state**
- **19,642 rendered quads**
- **78,568 vertices**
- **39,284 triangles**
- **12 shape-aware sections**

These totals are stored as an optional JSON validation oracle. If the authored asset or importer semantics drift, Block 001 is rejected rather than silently rendering a different city block.

The active City preview now renders the imported block as one mesh per non-empty RiftSection and keeps the proven hard block-face readability, block grid, culling toggle, orbit/pinch zoom, top view, spin and fullscreen controls. H1.56 shape validation still runs during startup before the JSON asset is accepted.

Next step after visual Block 001 validation: iterate the city-block JSON itself (building proportions, frontage, alley, entrances and interior shell layout), then add reusable/stamped street placement around imported blocks before scaling to several connected blocks and the first full district slice.


### H1.57.1 — active imported block survives local-preview refresh

The JSON importer now treats an accepted local block as the active test asset instead of a one-frame file-picker preview:

- accepted import JSON is saved under a versioned RiftCity browser-storage key after it compiles and its GPU meshes are created successfully;
- `localStorage` is preferred, with `sessionStorage` as a fallback when the local editor preview restricts persistent storage;
- reopening/reloading the City preview restores the saved JSON first instead of unconditionally fetching Commerce Block 01;
- the HUD explicitly reports `ACTIVE <block-id> · PERSISTED`, `SESSION SAVED`, `PREVIEW ONLY`, or `BUNDLED`;
- **RESET DEFAULT** clears both storage locations and reloads bundled Block 001;
- corrupt/stale saved JSON is cleared automatically and falls back to Block 001 with a visible explanation;
- importing the same filename twice is supported by clearing the hidden file input before each picker open;
- rejected imports leave the current block rendered and now say which active block was preserved.

The saved JSON remains capped at 2 MB so a generated test asset cannot consume an excessive amount of iPhone browser storage. This persistence is intentionally local to the browser/editor-preview origin; it is not server/D1 world persistence.

### H1.57.2 — JSON file-picker lifecycle fix

The city-block importer pipeline was traced end to end after imported Block 002 appeared to leave Commerce Block 01 on screen. Block 001 is intentionally hardcoded only as the bundled startup/fallback asset (`public/riftcity-blocks/downtown-block-001.json`); a successful local import does replace the active compiled meshes.

The actual failure was the app-wide window-focus handler. Opening a native JSON file picker blurs the page, and Safari/iOS can fire `focus` again before the hidden file input delivers its `change` event. The old focus handler called the full route renderer, which destroyed the City/importer DOM and re-created it from the bundled/saved startup source before the selected JSON reached `compileRiftCityBlock()`.

Focus now refreshes only authentication/player HUD state with `refreshSession({ navigate:false })`; it no longer destroys/rebuilds the active route. This keeps the file input alive through native picker return, lets the selected JSON reach parse/compile/GPU replacement/persistence, and also avoids wiping other temporary City UI state whenever the browser returns from a system dialog.


## H1.58 — RiftCity Blueprint JSON authoring layer

The working H1.57 JSON importer now has a higher-level blueprint layer so whole Downtown districts can be authored by named city objects instead of manually tracking hundreds of absolute `fill_box` / `cut_box` coordinates.

### Backward compatibility

- Existing `riftcity-city-block` **version 1** assets remain valid and compile through the original raw-op path unchanged. Commerce Block 01 and the previously generated Block 002 keep their locked geometry totals.
- New blueprint assets use the same `format: "riftcity-city-block"` with **version 2** and `blueprint_version: 1`.
- The blueprint layer expands first; the resulting operations then enter the exact same 1 m `RiftSectionGrid`, compact `Uint16` block state, full/slab/stair shape system and section mesher. No renderer fork was introduced.

### Prefabs + placement

Version 2 adds a top-level `prefabs` object. A prefab owns local bounds, local raw block operations, optional tags/group metadata and named anchors. `layout` can then place that prefab repeatedly:

```json
{
  "type": "instance",
  "id": "bank-01",
  "prefab": "stone-bank",
  "origin": [82, 1, 12],
  "rotation": "east",
  "group": "buildings",
  "tags": ["bank", "commercial", "enterable"]
}
```

- `origin` is the minimum corner of the **rotated** prefab footprint in document-local coordinates.
- Rotation is limited to the block-safe cardinal set `north`, `east`, `south`, `west` (numeric 0/90/180/270 is also accepted).
- Every local `set`, `fill_box`, `cut_box` and `hollow_box` is rotated/translated automatically.
- Directional stair states rotate with the prefab, so a north-facing stair in a reusable entrance prefab becomes east/south/west when the instance rotates.
- Prefab instance bounds must remain inside the document bounds. Unknown prefab references, duplicate object IDs and invalid rotations are rejected before the active city is replaced.

### Named anchors

Prefabs can expose semantic points such as `main_entrance`, `loading_dock`, `roof_access`, `alley_exit` or future gameplay interaction points:

```json
"anchors": {
  "main_entrance": {
    "at": [10, 1, 0],
    "facing": "south",
    "tags": ["entrance", "public"]
  }
}
```

Placed anchors inherit prefab/instance tags, rotate with the instance and are returned by the compiler as world-space coordinates. The original document-local coordinate is retained as `localAt`. Anchor IDs are namespaced by instance (for example `bank-01.main_entrance`) so later gameplay systems can reference one exact doorway without reverse-engineering geometry.

Top-level district anchors are also supported for things like spawn points, district exits or mission staging locations.

### First-class roads and intersections

`layout` also understands block-native `road` and `intersection` objects. Roads are axis-aligned, use integer widths and can generate sidewalk and curb bands from one compact declaration:

```json
{
  "type": "road",
  "id": "commerce-ave",
  "from": [0, 0, 80],
  "to": [161, 0, 80],
  "width": 14,
  "state": "asphalt",
  "sidewalk": { "width": 4, "state": "sidewalk" },
  "curb": { "width": 1, "state": "curb" }
}
```

Intersections use a center + integer 2D size and can generate the surrounding sidewalk/curb square. Roads/intersections intentionally allow one another to overlap because connected street surfaces need that behavior; authored prefab-instance volume overlaps are reported as non-fatal validation warnings unless an instance explicitly uses `allow_overlap: true`.

### Groups, tags and diagnostics

Blueprint objects preserve `group`, `tags`, prefab kind, placed bounds and rotation as compiler metadata. The importer now reports blueprint object, instance, road, intersection, anchor and warning counts alongside the normal occupied-cell/section/triangle totals. Generated-operation errors include their source blueprint object ID, so a bad district no longer fails with only an anonymous absolute operation index.

Safety limits remain in place for world volume, touched cells and imported JSON size, with additional limits on prefab count, prefab operations, layout objects, expanded operations and anchors. Raw top-level `ops` are still allowed in version 2 and execute after the blueprint layout, providing a deliberate final override/detail layer when a one-off block edit is easier than creating another prefab.

`npm run build` remains Pure-JavaScript only and now syntax-checks 90 JavaScript files.

Next intended authoring step: generate the first production-style Downtown district as a version-2 blueprint asset using reusable storefront/building prefabs, named entrances/loading points and first-class street/intersection objects, then iterate the JSON rather than patching the engine for visual layout changes.


## H1.59 — composable Blueprint JSON + cell-accurate validation

- Extended the existing H1.58 `riftcity-city-block` v2 Blueprint layer instead of introducing a competing map format.
- Prefabs can now contain nested prefab instances, allowing district → block → building → entrance composition with inherited N/E/S/W rotation.
- Nested stair states and named-anchor facings inherit the full parent rotation chain automatically.
- Recursive prefab cycles and excessive nesting are rejected before block import.
- Added explicit Blueprint `groups` with object/anchor member reference validation.
- Added anchor-to-anchor `connections` with missing-reference checks, optional meter tolerance and optional opposite-facing validation.
- Replaced bounding-box-only prefab overlap warnings with cell-accurate validation over the actual expanded full/slab/stair operations. Conflicting states can error/warn/allow by policy while internal nested composition and road/intersection joins remain intentional.
- Preserved H1.58 road/intersection sidewalk + curb authoring and the existing RiftSection/full/slab/stair renderer pipeline.
- Added `public/riftcity-blocks/blueprint-example-downtown-cross.json` as a reusable nested-prefab authoring example.
- Added a build-time Blueprint regression check covering nested expansion, rotations, anchors, references, overlap rejection, cycle rejection and legacy importer compatibility.


## H1.60 — RiftPlayer + Blueprint Creative Mode

- Added RiftPlayer v1: a RiftCity-owned 1.8 m block-humanoid built from lightweight Rift Engine box drawables. Head, torso, arms, legs and feet share the master meter scale instead of introducing a separate character renderer.
- Player movement is camera-relative with WASD/arrows, touch joystick, walk/run, jump, simple block-character motion, world-bound clamping and collision/ground resolution against the currently compiled RiftSection grid.
- The third-person camera follows the player in Play Mode while retaining orbit/pinch/wheel control.
- Added Creative Mode for version-2 Blueprint JSON documents. Entering Creative freezes player control and turns the current camera into a freecam; exiting snaps control/camera back to the existing player position.
- Creative freecam supports WASD/arrows, Q/E vertical travel and Shift boost.
- Blueprint layout objects can be selected and live-edited without touching raw RiftSections: 1 m X/Y/Z nudges, cardinal prefab rotation, duplicate, delete, undo/redo and Blueprint JSON export.
- Every accepted edit recompiles through the existing H1.59 Blueprint → raw ops → RiftSection/full/slab/stair pipeline, so validation failures block the edit instead of corrupting the live preview.
- Creative Mode currently targets Blueprint `layout` objects (instances/prefabs, roads and intersections). Fine-grained individual RiftBlock painting remains a separate future Detail Mode.
- `npm run build` passes with the Pure-JS guard, syntax checks and Blueprint regression suite.

## H1.61 — voxel RiftPlayer + player-driven Creative block editing

- Rebuilt RiftPlayer as six independently animated voxel-mesh body parts: head, torso, left/right arms and left/right legs. There are no separate feet; each larger body part is visibly composed from many small voxel cubes while remaining one draw call per limb/body part.
- Corrected the camera-relative horizontal movement basis so right input moves screen-right and left input moves screen-left in both normal Window mode and Fullscreen, including touch joystick input.
- Creative Mode no longer disables the player or becomes a freecam. The player keeps walking/running with the normal third-person camera while Creative tools are layered onto gameplay.
- Tap/click a rendered RiftBlock to break it, or switch to PLACE and tap/click a block face to add the selected palette state in the adjacent cell. Full blocks, slabs and stairs use the same existing palette/state/importer pipeline.
- Stair placement can be rotated through north/east/south/west; missing directional palette variants are generated into the working JSON automatically.
- Creative edits are appended as raw override/detail ops after Blueprint expansion, so a reusable building/district prefab is preserved while individual blocks can be corrected by hand.
- The selected target cell is outlined in-world, undo/redo covers block and Blueprint edits, and the edited world can be exported back to JSON.
- Creative flight keeps the player/camera: F or the FLY button toggles flight, Space/JUMP moves up and Q/DOWN moves down. Run/Shift boosts movement.
- Existing Blueprint object move/rotate/duplicate/delete tools remain available in a collapsed advanced section.

## H1.62 — first-person reticle + shape-aware stairs

- Player gameplay now uses a true first-person eye camera with one fixed center-screen reticle in Window and Fullscreen modes.
- Creative break/place targeting is driven only by that reticle. A tap/click acts on the block under the center aim ray; placement uses the adjacent cell on the struck face.
- RiftPlayer presentation is six clean cuboids (head, torso, two arms, two legs) instead of subdividing each body part into hundreds of visible micro-cubes. The local avatar is hidden from its own first-person camera while the rig remains available for future third-person/remote-player rendering.
- Player ground/collision now decodes full, bottom-slab, top-slab and directional stair states. Stairs expose a continuous 0.5m-to-1.0m support ramp by facing direction and grounded movement adheres to changing support height instead of assuming every occupied block is 1m tall.
- Stair step-up is capped at 0.62m, descending ground adhesion is smoothed, and body obstruction probes use actual partial-shape occupancy rather than raw nonzero cell checks.
- Existing Blueprint authoring, raw detail overrides, Creative flight, undo/redo and the RiftSection/full-slab-stair render pipeline remain unchanged.


## H1.63 — 2.5D overhead RiftBlock city pivot

RiftCity keeps the useful block-built world technology from H1.51–H1.62 but stops treating the player-facing City as a first-person voxel sandbox. The active Rift Engine city view is now a locked, elevated **2.5D overhead** presentation designed around RiftCity's crime-MMO gameplay and district-scale world rather than Minecraft-style first-person play.

- The 1 m `RiftBlock` grid remains the physical authoring foundation. Full blocks, bottom/top half slabs and directional stairs still compile through the same `RiftSectionGrid`, compact block state and shape-aware mesher.
- Blueprint JSON remains the high-level construction language for buildings, roads, intersections, anchors, groups and future district generation. No Blueprint or importer fork was introduced.
- Rift Engine now supports an orthographic camera projection in addition to the existing perspective path. The City uses orthographic projection with a fixed diagonal overhead angle, preserving real 3D height while reading like a 2.5D city diorama.
- The six-cuboid RiftPlayer is visible again. Movement remains camera-relative and continues to use the shape-aware full/slab/stair support-height solver, so stairs and half slabs are still real traversal geometry.
- The overhead camera softly follows the player's actual world position with a small facing look-ahead instead of replacing the player's movement with a first-person camera transform.
- **CITY OVERVIEW** temporarily frames the authored block from above; returning to **FOLLOW PLAYER** restores the normal 2.5D tracking camera. Pinch/wheel adjusts orthographic zoom without rotating the gameplay view.
- The old center-reticle editing flow is removed from the active City. **BUILD MODE** edits the exact visible cell that is tapped/clicked from overhead, while the existing Blueprint object move/rotate/duplicate/delete tools remain available for large-scale authoring.
- Manual block edits still append detail override operations after Blueprint expansion, so a generated police station or district can be refined cell-by-cell without destroying its reusable Blueprint source.

This keeps the engine work that helps RiftCity scale—meter-consistent construction, reusable prefabs, block/slab/stair geometry and compact section meshes—while moving the player experience back toward an overhead living-city RPG. Future city scaling should build on streamed district/chunk ownership and floor/interior visibility rather than first-person voxel mechanics.

## H1.64 — 2.5D cutaway visibility + deterministic stair/ledge movement

RiftCity keeps the H1.63 overhead orthographic presentation and the same RiftBlock/full-slab-stair construction language, but this pass fixes the two problems that make an overhead city difficult to play inside.

### Camera/player cutaway

- Rift Engine drawables can now opt into a player-visibility cutaway shader.
- Imported RiftSection meshes enable that cutaway; the player, editor helpers and non-world drawables do not.
- In normal follow-player play, block fragments above the player's floor are removed inside a small local bubble and inside the camera-to-player corridor.
- This reveals the player and nearby interior floor/furnishings when roofs, upper walls or camera-facing building geometry would otherwise cover them.
- Collision and authored block state are untouched; this is render-only visibility.
- City Overview disables the player cutaway so the full authored block can still be inspected.

### Ground/support solver

- Player support is sampled from the center of the player's footprint instead of taking the highest of several corner probes. This removes the old stair-hover effect where the uphill edge of the collision radius forced the whole character upward.
- A missing center support returns `null`; it is no longer replaced with the world minimum floor. Walking beyond a ledge therefore releases the grounded state immediately and gravity takes over.
- Legal rises up to `0.58 m` auto-step at walking speed. Sprinting no longer changes whether a normal Rift stair can be climbed.
- Ground movement is sub-stepped at a fixed spatial resolution, so collision/step behavior is independent of frame rate and walk/run distance per frame.
- Directional stair support remains continuous from `0.5 m` to `1.0 m`, giving smooth ascent/descent while preserving the block-built stair mesh.
- Low body-collision probes ignore only geometry that is within the legal step height, preventing the supporting stair from becoming an invisible wall while still blocking full-height walls.
- Ground snap is limited to nearby legitimate steps/slopes; larger downward gaps become falls instead of sticky ledges.

`npm run build` now includes `scripts/check-rift-player-physics.js`, which locks the slab/stair support heights, normal-speed half-meter step behavior and immediate no-support ledge classification.


## H1.65 — structured 2.5D building visibility

H1.64's player cutaway experiment is replaced rather than tuned. The circular/camera-corridor fragment discard could slice any geometry in its path, which made stairs/slabs flicker and exposed the clear buffer as a black ring around the player. H1.65 moves visibility decisions out of the fragment shader and into semantic whole-piece render layers.

- Removed the H1.64 `discard`-based cutaway uniforms/shader path from Rift Engine. World geometry is never punched out pixel-by-pixel around the player.
- `hollow_box` operations now produce lightweight visibility-shell metadata at compile time. Existing Commerce Block 01 automatically resolves into four building shells; Blueprint prefab `hollow_box` operations use the same path after expansion/rotation.
- RiftSection geometry remains one-meter/full-slab-stair authored geometry, but visible faces are additionally partitioned into render layers: global base, per-structure floor/base, interior, whole partial-shape, directional wall and roof layers. The partition exactly covers the original mesh triangles; it does not alter collision or block state.
- Partial shapes are never fragment-clipped. Stairs and half slabs remain whole render pieces, so H1.64's fixed traversal geometry no longer develops circular holes or black wedges.
- When the player is inside a shell, that shell's roof and the two camera-facing upper wall sides are hidden as complete authored layers. A one-meter wall stub remains so room boundaries still read from the overhead camera.
- When a building lies between the overhead camera and the player, the same directional roof/wall rule reveals the player without deleting unrelated ground or nearby geometry.
- Stacked floor shells are floor-aware. If the player is inside a lower shell, overlapping shells above it are suppressed as complete layers (floor, interior contents, partial pieces, walls and roof), preventing an upper office floor/furniture from covering the active ground floor. The current floor's geometry remains visible.
- **CITY OVERVIEW** restores every building layer so the complete authored city can still be inspected.
- The H1.64 support/step/ledge solver is unchanged: normal walking still climbs legal stairs/slabs, descent follows support height and unsupported ledges immediately become falls.

`npm run build` now includes `verify:building-visibility`, which checks semantic shell extraction, triangle-complete render-layer partitioning, intact whole-piece stair/slab classification, directional inside cutaways, stacked-floor suppression and full overview restoration.

## H1.66 — correct interior/exterior 2.5D cutaway ownership

H1.65 proved that semantic whole-piece visibility layers are the correct replacement for fragment-level circular cutouts, but its resolver still treated two different situations as the same event: **the player being inside a structure** and **a structure merely blocking the overhead camera**. That made exterior camera blockers hide their roof even when the player was outside, while the actual blocking wall could remain in view.

H1.66 separates those paths:

- **Inside a structure:** hide that structure's roof, roof-owned attachments and only the camera-facing upper wall layers. Floors, active-floor interior geometry, stairs and slabs remain intact.
- **Outside but occluded:** keep the blocker roof visible and remove only the exact wall face where the camera-to-player line enters that building. Unrelated/nearby building roofs are never hidden by that exterior test.
- Exterior blocking now requires a real 3D camera-to-player segment intersection with the authored building prism instead of a footprint-only proximity-style decision.
- The wall cutaway uses the segment's 2D entry side, so a west-facing blocker removes its west wall rather than simply hiding every wall broadly facing the camera.
- Rooftop `set` / `fill_box` geometry that physically sits above a detected roof and does not belong to another authored floor is assigned to that roof's visibility layer. Utility boxes, vents, signs and similar roof pieces now disappear with the roof when the player is actually inside.
- Stacked-floor suppression from H1.65 is preserved. Geometry already inside an upper authored shell is not misclassified as a lower roof attachment.
- City Overview continues to restore every semantic layer.

The regression suite now locks the two Commerce Block rooftop utility boxes to their owning roofs and explicitly verifies that an exterior blocker hides its camera-entry wall **without** hiding its roof or any unrelated nearby roof.


## H1.67 — smart outdoor 2.5D camera

The overhead city camera now helps preserve player visibility outdoors before asking the structured cutaway system to hide geometry.

- Outdoor gameplay uses four stable isometric-style camera directions, spaced by exact 90° quarter turns around the player. The camera does not free-orbit or constantly chase a mathematically perfect angle.
- The current camera direction is preferred. When the camera-to-player line is blocked, RiftCity first tests small screen-space follow offsets so a simple framing adjustment can keep the current direction.
- If the player remains blocked for a short grace period and panning cannot clear the view, the camera scores all four stable directions against the same authored building-visibility volumes used by H1.66 and smoothly rotates only when another direction is meaningfully clearer.
- Direction changes use hysteresis/cooldown. Once a clear direction is chosen, open streets do not immediately rotate the camera back, preventing left/right camera oscillation between nearby buildings.
- The H1.66 exterior wall cutaway remains a fallback while a rotation is in progress or when every stable view still has an occluder. Roofs still remain visible for exterior occlusion.
- Interior containment disables automatic outdoor rotation. When the player is actually inside a building, the current camera direction stays stable and the semantic roof/camera-facing-wall cutaway owns visibility.
- Build Mode also locks automatic rotation so the world cannot move underneath a touch/mouse selection gesture.
- City Overview remains explicit and bypasses all smart follow decisions. Reset View returns to the canonical default overhead direction.
- Player movement remains screen-relative because the controller derives forward/right from the live RiftCamera every frame. If the smart camera changes quadrant, joystick/WASD directions continue to mean the same directions on screen.
- `resolveRiftBuildingVisibility()` now exposes a lightweight `blockingScore` based on the actual 3D camera/player intersections. This gives the camera a better comparison than a simple blocked/not-blocked boolean without changing which semantic layers H1.66 hides.

`npm run build` now includes `verify:smart-camera`, covering pan-first framing, persistent-occlusion rotation, four-way camera spacing, hysteresis, interior lock, Build Mode lock and City Overview bypass.

## H1.68 — loaded-world containment + fall-through recovery

A full audit of the H1.67 player/world collision path found that the bundled Commerce block itself has a complete 64 × 64 ground plate; the intermittent fall-through was caused by the controller being allowed to leave the currently loaded RiftBlock document. Outside the declared X/Z bounds, `getBlockWorld()` correctly returns AIR, but ordinary Play movement previously had no loaded-world footprint constraint and no recovery path once the player fell below the lowest authored layer.

H1.68 hardens the player physics boundary without changing the smart camera, building cutaway or Blueprint systems:

- Ordinary grounded and airborne horizontal movement keeps the player's full collision radius inside the currently loaded document footprint. Until neighboring blocks are actually streamed, the edge of the loaded block behaves as a world boundary rather than an unmarked cliff into unloaded AIR.
- Surface sampling now explicitly rejects X/Z coordinates outside the declared block bounds instead of relying only on the grid's AIR response.
- The controller remembers a continuously revalidated **last safe grounded position**. Safe state is updated only when the player is genuinely supported, inside the loaded footprint and not embedded in collision geometry.
- Added a kill plane below the document's lowest authored Y. Falling below it restores the player to the last still-valid safe grounded position; if that position no longer exists after a world edit/import, the normal safe-spawn search is used instead.
- Falling uses a previous-Y → candidate-Y swept support crossing test. Combined with a semi-fixed maximum physics step of `1/120 s`, low or irregular frame times cannot skip through a floor merely because one render frame moved the player from above the surface to below it.
- Play physics is sub-stepped independently from character animation. Existing spatial horizontal substeps remain, while vertical gravity/landing now receives bounded temporal steps as well.
- Live Blueprint/Build Mode recompiles immediately revalidate the preserved player against the newly authoritative grid. Newly solid geometry cannot leave the body embedded, and removed support becomes a controlled fall rather than stale grounded state.
- Leaving Creative flight also revalidates the player before normal grounded movement resumes.

`verify:player-physics` now covers all four loaded-world edges, full-radius containment, support rejection outside the document, the real controller pushing into a 64 × 64 boundary for multiple simulated seconds, tall falls under frame-time jitter, swept floor landing and kill-plane recovery. The existing stair/slab/ledge regressions remain in the same suite.

## H1.69 — stacked-surface edge landing repair

H1.68 fixed leaving the loaded world and added kill-plane recovery, but a second fall-through path remained around stacked block edges. When the player slowly walked off or landed near the edge of an upper block, the player's horizontal body radius could still overlap the side of that upper block while the feet crossed a valid lower floor. The landing path evaluated only one support and then rejected the lower landing as body-blocked, allowing gravity to continue through the floor.

H1.69 hardens the local landing manifold without changing the H1.67 smart camera, H1.66 building visibility or H1.68 loaded-world safety:

- surface sampling can retain every stacked support height at one X/Z point instead of collapsing immediately to one highest value;
- descending landing checks evaluate the support surfaces actually crossed by the feet from highest to lowest, so a surface already above the feet cannot mask the next valid floor below;
- the previous-feet tolerance is tightened for downward crossing tests so a block top that the player has already dropped below is not treated as a new landing;
- if a legitimate lower landing still overlaps the side/corner of the block just left, the controller performs a bounded player-radius horizontal depenetration onto the same nearby support instead of rejecting the floor and continuing to fall;
- air/ground movement may move out of an existing overlap when the new position reduces penetration, preventing an edge contact from trapping the player in place;
- the landing depenetration follows slab/stair support height changes rather than assuming every lower surface is flat.

The player regression suite now reproduces the original slow-walk edge failure at multiple sub-block offsets, plus full→full, full→bottom-slab, full→stair and diagonal-corner landings. Those cases must settle on the first valid surface without invoking kill-plane recovery.

## H1.70 — zero-penetration RiftPlayer hardening

H1.70 hardens the H1.68/H1.69 player controller so collision correction happens before a player transform is committed to the renderer. The remaining playtest failure was not missing support data: the lower body probes started too high and a generic stepable-obstacle exception could briefly treat the side of a full block as legal while the player's feet were already inside solid geometry.

- Added a small collision skin and near-feet probes so full-block penetration is detected immediately instead of after roughly a quarter meter of sinking.
- Removed the generic low-body step exemption for full blocks. Only the small height variation across the same authored stair is allowed near the feet.
- Descending edge motion clears residual side overlap before lowering the player's feet, so creeping off a stacked block cannot render an embedded frame before H1.69's lower-surface landing resolves.
- Upward/jump motion uses the same pre-contact collision sweep, preventing the player from entering a full block side while jumping onto it and providing a conservative ceiling-contact path.
- Every non-flying physics substep now enforces a final invariant: a transform that still intersects solid RiftBlock volume is corrected horizontally, rolled back to the previous safe substep, or recovered to validated safe ground before rendering.
- The H1.69 stacked-support selection, H1.68 loaded-world bounds/kill-plane recovery, stair/slab support heights, Build Mode revalidation, structured building visibility and smart outdoor camera remain unchanged.
- Player regression coverage now records every committed transform during jump-on-block and slow-edge-drop torture cases and fails if any rendered position penetrates the upper full block.

## H1.71 — partial-shape transitions + invisible stair ramps

H1.70 made full-block collision deliberately strict, which removed visible penetration but also exposed a transition-order bug: the body sweep could see a legal half slab or stair approach as a wall before the support solver had raised/lowered the player's feet onto the partial shape.

H1.71 keeps the zero-penetration invariant while making partial shapes first-class movement surfaces:

- Ground → bottom slab and slab → full transitions resolve the legal vertical step before committing horizontal overlap, so normal walking no longer sticks on the 0.5 m riser.
- Full → slab transitions keep horizontal escape legal at the departing height, then use the existing swept fall/support manifold to settle cleanly onto the 0.5 m lower surface.
- Stair rendering is unchanged: authored stairs still look like two chunky RiftBlock steps.
- Stair player collision/support is now a separate invisible continuous ramp from 0 m at the low edge to 1 m at the high edge. North/East/South/West rotations all map their local travel axis onto the same ramp height field.
- The strict full-block side rule from H1.70 remains. Partial-shape movement is solved by finding a real walkable support height first, not by reintroducing a generic collision exemption.
- A short-lived step-assist retains the newly reached slab/ramp support while the player's radius crosses the riser boundary, preventing the controller from snapping down during the few centimeters before the center enters the next cell.
- Descending stairs follow the same continuous support plane, while H1.69 stacked-surface landing and H1.68 bounds/recovery remain active as safety layers.

`verify:player-physics` now covers ground↔slab and full↔slab transitions, four-way stair ascent with continuous in-ramp height samples, and full→stair→ground descent. The tests fail if a stair collapses back to two collision treads, if a legal partial-shape transition sticks, or if any of those transitions requires kill-plane recovery.

## H1.72 — stable edge support + partial-foot landing ownership

H1.72 fixes the final support-ownership jitter exposed by H1.71. Center-only ground selection could switch to a lower block as soon as the player's center crossed an edge even though a meaningful part of the circular foot was still resting on the upper top. The zero-penetration safety layer then correctly resolved the resulting side overlap, but visually that looked like the game shoved the player off the ledge.

- Ground support now has a small persistent contact manifold sampled across the circular player footprint instead of treating the center sample as the sole owner of flat support.
- A flat upper block/slab keeps support ownership while a meaningful set of foot contacts still touches that same top surface. Lower center samples cannot steal ownership early.
- The support hold is deliberately hysteretic rather than magnetic: once meaningful upper contact disappears, the controller releases normally and H1.69's stacked-surface fall/landing logic takes over.
- Descending stair ramps still follow their center ramp height continuously. Non-center stair samples are excluded from the flat support manifold so H1.71's invisible 0→1 m stair slope does not become a sticky ledge.
- Falling landing checks now gather crossed support contacts across the footprint. The highest valid contacted flat surface can own a landing even when the player's center is already just outside that block.
- Partial-foot jump landings no longer get depenetrated sideways onto a lower floor simply because center support points lower; if the upper top has a real support manifold, the player lands and remains there.
- H1.70's zero-penetration invariant remains unchanged: retaining edge support never permits the player body to occupy solid RiftBlock volume.

`verify:player-physics` now includes one-foot-on/one-foot-off idle standing, deliberate full walk-off after support loss, and a jump landing with the player's center outside the upper block while the foot still overlaps it. The suite also keeps all H1.68–H1.71 bounds, stacked-surface, zero-penetration, slab-transition and four-way invisible stair-ramp regressions.

## H1.74 — third-person no-cutaway cleanup

RiftCity's active City view now treats building geometry as authoritative at all times. The third-person camera solves obstruction by retracting toward the player instead of modifying the world render.

- Removed the active per-frame structured building cutaway call from `downtown3d-foundation.js`. Player position, camera position, interior containment and City Overview no longer toggle drawable visibility.
- RiftSections are rendered as complete meshes again. The importer no longer partitions section faces into hideable roof/wall/interior camera layers, reducing the active draw path and eliminating roof/wall pop-out behavior by construction.
- Building shell/roof-attachment metadata is retained as metadata only for future gameplay, streaming, location and diagnostic uses. `resolveRiftBuildingVisibility()` may still report containment and camera-line blockers, but its `hiddenLayers` set is always empty and it never suppresses stacked floors.
- Third-person camera collision/retraction remains the only gameplay visibility response. Outdoor walls/roofs, indoor roofs/ceilings and upper floors all remain rendered normally.
- City Overview also renders the exact same complete building geometry.
- The old smart-camera module remains diagnostic/legacy code only; its state labels no longer reference cutaway behavior and it cannot hide geometry through the metadata resolver.

`verify:building-visibility` and `verify:third-person-camera` now fail if any inside, outside or overview camera state produces hidden/suppressed building layers, or if the importer recreates camera-hideable render partitions.


## H1.75 — stair visual tread alignment and lower-slab exit hardening

- Stair collision remains the H1.71 smooth invisible 0→1 m ramp, so traversal physics do not regress to two discrete collision steps.
- The six-part player now has a render-only ground offset while centered on a stair. Physics Y remains on the continuous ramp, while the visible avatar is raised to the authored 0.5 m / 1.0 m stair tread beneath it. The collision transform is never changed by this visual correction.
- Leaving the high edge of a stair for a lower half slab/floor preserves legitimate partial stair-foot support until the circular foot really clears the ramp. This removes the reproducible stair→slab trap near the high edge without weakening H1.70 zero-penetration rules.
- The player regression suite now verifies continuous ramp physics, both rendered tread heights, stair→lower-slab creep traversal, all four stair rotations, and zero recovery/teleport during the transition.

## H1.76 — protected Rift Engine AI Builder foundation

RiftCity now has a developer/admin-only `/dev/ai-builder` workspace designed for browser agents and human developers to inspect and edit the live Rift Engine staging scene without relying on fragile WebGL clicking.

- The page is server-gated with the same `developer` / `admin` authorization boundary as the private Block Editor and is served `no-store`, `noindex`.
- The normal Rift Engine/Blueprint compiler remains authoritative. AI Builder edits recompile the same `riftcity-city-block` document and persist only to the existing browser staging import; there is no direct live-world publish action in this pass.
- Inspection cameras include bird's-eye, exact top, north, south, east, west and third-person. Focusing an object frames its real compiled Blueprint bounds.
- A deterministic command surface exposes scene, inspect, select, focus, camera, move, rotate, duplicate, delete, undo/redo, local named checkpoints, clean PNG capture and JSON export/import.
- Scene responses expose compiled object ids, bounds, origins, tags/groups, anchors, connections, world bounds, player/camera state and importer statistics so an agent can use exact geometry instead of guessing from pixels.
- Clean screenshots are captured directly from the WebGL framebuffer, excluding all editor chrome. The latest capture is shown on-page and can be downloaded as PNG.
- The same command backend is progressively exposed as WebMCP Site Tools when `document.modelContext.registerTool()` is available. Thirteen tools cover scene reading, object inspection/focus, camera control, Blueprint move/rotate/duplicate/delete, Blueprint import, undo/redo, checkpoints and clean captures.
- Browsers without WebMCP keep the same accessible command textarea/buttons, so the page remains agent-friendly through conventional browser automation.
- Gameplay cutaway behavior is not reintroduced. H1.74 full-building rendering and H1.75 player/stair behavior remain unchanged.
