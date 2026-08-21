# Static Header, Effects Strip & Wiki Patch

## UI shell
- Converted the player stats/HUD from fixed/sticky viewport chrome into a normal static page header.
- The header now scrolls away naturally with the page instead of following the player.
- Moved Menu and Log controls into the static header row so they no longer float independently over feature pages.
- Removed extra top-padding that was only needed to make room for the old fixed HUD.

## Effects strip
- Added a compact Effects strip directly beneath the player stats.
- Displays active jail/hospital restrictions, bank freezes, offshore breach protection, travel cooldowns, world events, running/ready production batches, and Production Attention.
- Timed effects update every second and show remaining time.

## In-game Wiki
- Added a real `/wiki` routed page and navigation entry.
- Added search, category filtering, a contents index, mobile layout, and custom RiftCity vector icons.
- Covers the current core loop, resources, effects, city/travel, crimes, crime tools, combat/PvP, weapon skills, inventory, gym, jobs, banking, offshore, properties/rentals, Black Market beta economy, production, casino/nightclub, education/missions, factions/merits/challenges, jail/hospital/enforcement, world events, and beta-vs-multiplayer notes.
- Reference tables pull from current game constants wherever practical so balance changes are reflected automatically.
- Clearly distinguishes implemented behavior from planned behavior (including the not-yet-enforced airport-first offshore flow).

## Scope
- City map assets and map interaction code were not modified by this patch.
