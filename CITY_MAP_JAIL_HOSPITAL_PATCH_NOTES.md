# RiftCity City Map / Jail / Hospital Patch

## City map
- Every one of the 19 city map locations now has a working destination.
- Added dedicated location screens for Bank, Hospital, Jail, Police Department, Pharmacy, Casino, Black Market, Central Park, Downtown, and Airport.
- Existing locations continue to route to their established systems: University, Property, Jobs, Shops, Market, Gym, Crimes, Combat, and Missions.
- Keyboard Enter on a focused map marker now enters the location; Space selects it.
- Current and previously visited locations receive distinct marker state/classes and status chips.
- While incapacitated, only the appropriate Hospital/Jail destination remains enterable, with a direct record button in the city status banner.

## Jail
- Added real Jail screen with active detention roster.
- Stores and displays player, offense/crime, total sentence, live remaining timer, Heat, and times jailed.
- Crime failures that result in jail now record the offense, sentence start/duration, current location, and visited state.
- New jail sentences automatically route to the Jail screen.

## Hospital
- Added real Hospital screen with active patient board.
- Stores and displays player, hospitalization reason/opponent, total stay, live remaining timer, and health.
- Combat defeats now record hospitalization metadata and move the player to the hospital location/screen.
- Added optional walk-in full-health treatment when not actively hospitalized.

## Other location pages
- Bank: dedicated deposit/withdraw and account summary.
- Police: Heat/wanted status, custody record, and lay-low action.
- Pharmacy: medical/recovery item purchases.
- Black Market: dedicated underground equipment storefront using existing item system.
- Park: rest/walk interaction affecting happiness/Heat.
- Downtown: hub links to nearby city systems.
- Casino: enterable entertainment/encounter page (no wagering mechanics).
- Airport: operational terminal/status page ready for future inter-city travel.

## Cleanup / validation
- Removed duplicate malformed `src/    types` directory.
- Removed stray `src/lore/T` and `src/styles/T` files.
- Relative import scan: 0 missing imports.
- Full dependency-backed Vite build could not be completed because `npm install` timed out in the execution environment.
