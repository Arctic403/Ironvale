# RiftCity V1 — Refactor Patch

This build keeps the original RiftCity prototype and refactors its foundation instead of replacing it.

## Refactored
- Split `src/data/gameData.ts` into `dataTypes.ts`, `jobs.ts`, `items.ts`, `missions.ts`, `education.ts`, and `properties.ts`; `gameData.ts` is now a compatibility barrel.
- Renamed the malformed `src/    types/` directory to `src/types/`.
- Split `gameCore.ts` into `saveSystem.ts`, `gameClock.ts`, `economy.ts`, and `world.ts`; `gameCore.ts` remains a compatibility barrel.
- Extracted the recurring game clock into `src/systems/gameTickSystem.ts`.
- Added explicit `lastHealthUpdate` and `lastMarketUpdate` save fields.
- Added safe migration defaults for older saves.
- Consolidated combat profile typing into `systems/combat/combatTypes.ts`; `data/playerProfiles.ts` is now the sole profile dataset.
- Fixed broken `AppShell` imports from `./app/*` to the actual `./apps/*` directory and fixed its Navigation prop contract.

## Job system
- Removed player-level job locks.
- Each company/job has 3 skills and 3 positions.
- Skills gain +1 once per real 24 hours worked, including offline progress.
- Skills are capped at 10 for V1.
- Promotion automatically occurs at skill level 5 and 10.
- Each position increases pay and grants small stat bonuses.
- Skill levels also provide small stat bonuses.
- Job skills and position tiers persist in localStorage saves.
- Switching companies does not erase previous company progress.

## Bug fix
- Health regeneration now has its own timestamp instead of incorrectly using the energy regeneration timestamp.

## Validation
- TypeScript source validation was run. The remaining compiler errors in this environment are caused by missing installed npm packages (`react`, `react-dom`, Vite typings), not the refactored data/core/system modules.
- `npm install` could not complete within the available environment, so a Vite production build could not be executed here.
