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
