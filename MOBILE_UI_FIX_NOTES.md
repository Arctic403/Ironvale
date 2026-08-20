# RiftCity Mobile UI Fix

## Fixed from the iPhone screenshot
- Legacy mobile `.nav-rail`, `.nav-list`, `.nav-item`, and `.brand` rules no longer override the new drawer UI.
- Mobile menu is now a true vertical slide-out drawer.
- Drawer shortcuts and navigation stay inside the viewport and scroll vertically when needed.
- The compact top HUD now stays a single row instead of expanding into a giant panel.
- Bank balance is hidden from the always-visible phone HUD to keep the row compact; it remains available in Stats.
- On very narrow devices cash also collapses from the always-visible HUD.
- Stats details now open as a mobile bottom sheet instead of expanding the fixed header.
- Menu / Stats / Log controls are compact floating buttons at the lower-right.
- Activity Log is a bottom sheet on mobile.
- Main content has correct top/bottom spacing so it is not covered by the HUD or floating controls.
- Added `viewport-fit=cover` and safe-area handling for iPhone/Safari.
- Improved city quick-access and map sizing on phones.
- Removed malformed duplicate source leftovers again.

## Validation
- 0 missing relative imports.
- CSS brace check clean.
