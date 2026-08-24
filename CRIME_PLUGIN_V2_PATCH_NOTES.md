# RiftCity Crime Plugin V2 Refactor

This patch continues the crime-system cleanup by making the plugin registry the authoritative source used by the crime screen.

## What changed

- Added `src/crimes/core/plugin.ts` with reusable `defineCrimePlugin` / `defineCrimePlugins` helpers.
- Every crime family module now exports real `*_CRIME_PLUGINS` entries.
- `src/crimes/core/registry.ts` now aggregates plugins rather than rebuilding plugins from one giant definition list.
- `CRIME_CAREERS` remains as a compatibility projection derived from the plugin registry so existing game systems/save data keep working.
- `CrimeScreen.tsx` now reads its list and selected crime from `CRIME_PLUGINS` / `getCrimePlugin()` instead of treating the legacy career array as the source of truth.
- Added helpers to query plugins by UI type or family and a lightweight registry validator.
- Existing crime IDs, order, unlock thresholds, mastery data, Nerve costs, Heat, rewards, actions, target kinds, operations and save keys are preserved.

## Architecture going forward

To add a new crime, add it to the relevant file under `src/crimes/modules/`. The module exports it as a plugin and the rest of the crime hub discovers it through the registry.

The current shared UI renderers (target, actions, operation, etc.) intentionally remain reusable mechanic renderers. They are selected by each plugin's `uiKind`; this avoids duplicating the same UI code for every crime while still keeping individual crime definitions modular.

## Compatibility

`src/systems/crimeCareerSystem.ts` remains a compatibility facade for existing imports. No save-data migration is required by this patch.
