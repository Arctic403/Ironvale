# RiftCity V1 Audit & Fine-Tune Patch

## Purpose

This patch audits the current RiftCity V1 foundation while keeping the playable scope focused on the home city.
The city is a home hub, not the eventual world-travel map.

## Fixed

- Restored a canonical `src/types/riftCity.ts` path and removed the malformed `src/    types/` path.
- Kept all existing type imports pointed at the canonical path.
- Removed the duplicate `money` import in `City.tsx`.
- Reframed the City screen as a **Home City Hub** rather than local travel.
- Clarified that future destination travel belongs to a separate World/Travel system.
- Preserved the existing job skill/progression architecture.
- Added an original RiftCity lore foundation and faction seeds.
- Added a world-bible document establishing the setting, Rift mystery, and design rules.
- Added README pointers to the lore foundation.

## Design decisions

### City
RiftCity is the player's permanent home base. The city map is a UI/navigation surface for local services and activities.

### World travel
World travel is deliberately not implemented as city-to-city movement yet. The existing travel state primitive remains available for a future data-driven World/Travel system.

### Lore
The Rift is the long-term mystery. V1 should begin with everyday life—work, crime, training, money, property, education—and gradually expose the wider world.

### Originality
The project can take inspiration from the persistent browser-life/crime genre while maintaining original names, lore, characters, artwork, UI, dialogue, code, and worldbuilding.

## Validation

A static relative-import audit was run across the TypeScript/TSX source and found no missing relative modules after the patch.

A full production build could not be completed in this environment because dependency installation did not finish within the available execution window. The previous deployment reached 0 build errors after the AppShell path fix.
