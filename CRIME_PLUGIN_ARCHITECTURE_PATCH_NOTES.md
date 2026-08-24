# RiftCity Crime Plugin Architecture Patch

This patch reorganizes the existing crime career catalog into a plugin-style registry without changing the current gameplay formulas or save-data shape.

## New structure

- `src/crimes/core/types.ts` — shared crime/plugin contracts.
- `src/crimes/core/registry.ts` — composes every module, validates unique IDs, and exposes plugin lookup.
- `src/crimes/modules/*.ts` — crime definitions split by family: theft, street, burglary, vehicle, fraud, cyber, organized.
- `src/crimes/index.ts` — public barrel for future crime code.
- `src/systems/crimeCareerSystem.ts` — remains as a compatibility facade so existing imports in hooks/wiki/UI keep working.

## Plugin behavior

Every crime now becomes a `CrimePlugin` with:

- stable `id`
- existing `definition`
- `uiKind` telling the Crime screen which interaction renderer to use
- `version` for future migrations
- searchable `tags`

`CrimeScreen` now resolves the selected crime through the plugin registry instead of hard-coding its mode/id branching directly.

## Adding a new crime

Add a definition to the appropriate family module. It is automatically included in `CRIME_CAREERS` and becomes available through `getCrimePlugin(id)`. Existing hooks and wiki code continue to consume the compatibility exports.

This is intentionally a refactor-first patch: current progression, mastery, Nerve, Heat, rewards, operations, targets, minigames and save fields are left intact. Future patches can move individual crime UI/logic into dedicated plugins one at a time.
