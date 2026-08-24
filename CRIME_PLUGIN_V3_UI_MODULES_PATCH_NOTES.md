# RiftCity Crime Plugin V3 — UI Modules

This pass continues the crime plug-in refactor without changing crime IDs or save-data keys.

## What moved out of CrimeScreen

The following crime interaction systems now live in `src/crimes/ui/` instead of being embedded directly inside `src/views/CrimeScreen.tsx`:

- Scavenging
- Pickpocketing
- Generic rotating target crimes
- Shoplifting
- Graffiti
- Passive crime operations

Each module owns its local interaction state where practical. Pickpocket crowd state/tool selection and shoplifting basket state no longer live in the main crime screen.

## Shared plug-in UI support

Added:

- `src/crimes/ui/types.ts`
- `src/crimes/ui/CrimeRequiredItems.tsx`
- `src/crimes/ui/ScavengingCrime.tsx`
- `src/crimes/ui/PickpocketCrime.tsx`
- `src/crimes/ui/TargetCrime.tsx`
- `src/crimes/ui/ShopliftingCrime.tsx`
- `src/crimes/ui/GraffitiCrime.tsx`
- `src/crimes/ui/OperationsCrime.tsx`

The existing crime registry and module definitions remain the source of crime identity/order/configuration. `CrimeScreen` now delegates these interaction types to dedicated modules.

## Compatibility

Existing crime IDs, unlocks, mastery keys, Nerve/Heat/reward calls, target resolution, scouting, graffiti state, operations and save-data shape were preserved.

`crimeCareerSystem.ts` remains a compatibility layer for existing imports while the refactor proceeds.

## Still centralized

The generic `actions` interaction and branching `major` job interaction remain in `CrimeScreen` for the next migration pass because they share the memory/dial and legacy branching-run state. They were intentionally not rewritten in the same pass to reduce regression risk.

## Validation

All newly created/changed TSX files were syntax-transpiled with TypeScript successfully. A full project type/build check cannot complete from this source ZIP because installed React packages/types are not included and dependency installation timed out in the patch environment.
