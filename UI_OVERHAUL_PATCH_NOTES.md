# RiftCity UI Overhaul Patch Notes

## Main UX overhaul
- Replaced the always-present left navigation rail with a floating **Menu** button and slide-out navigation drawer.
- Added floating **Stats** and **Log** buttons for cleaner access to important panels without permanent clutter.
- Converted the activity log into a closable right-side drawer instead of always rendering it under every screen.
- Reworked the top HUD into a floating status panel with collapsed and expanded modes.
- Simplified the main screen header and moved custody timers into compact quick alerts.

## Navigation improvements
- Drawer menu now includes quick shortcuts and cleaner menu item layout.
- Navigation automatically closes after selecting a screen.
- Reset action remains available from the drawer with confirmation.

## City screen improvements
- Reworked the city header to show useful information (current district, visited count, heat level).
- Added a **quick access bar** for common destinations like Bank, Downtown, Shops, Missions, Hospital, and Jail.
- Map view now remembers zoom/pan/selection during the session.
- Selected location defaults more intelligently to your current location state.
- City map title and location panel copy were updated to feel more like a hub and less like a placeholder.

## City map visual overhaul
- Shifted the city map toward a darker, more tactical look.
- Added subtle grid overlay, cleaner glow treatment, and more restrained color usage.
- Removed the floating generic YOU marker from the center of the map.
- Replaced cartoony landmark emoji markers with cleaner district-style labels.
- Updated marker styling and selected/current/visited state styling.
- Improved the location info panel and map hint presentation.

## Cleanup
- Removed malformed duplicate `src/    types` folder if present.
- Removed stray `T` leftovers under `src/lore` and `src/styles` if present.
- Verified **0 missing relative imports** after patching.

## Notes
- A full dependency-backed build could not be verified in this environment because React/Vite dependencies were not installed here.
