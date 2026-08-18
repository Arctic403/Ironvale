# RiftCity Core v4

A standalone original browser crime/RPG core inspired by the broad genre of persistent text-based city RPGs.

## Patched in this build

- Replaced the incomplete `App.tsx` with a working React game shell.
- Fixed the missing `jobSystem` dependency by moving job logic into the core state layer.
- Added persistent localStorage saves with backwards-safe defaults.
- Added passive Energy, Nerve, Happiness, health, jail and hospital timers.
- Added City locations and random interactive encounters with branching outcomes.
- Added explicit crime outcomes: success, failure, spooked, jail, critical success and critical failure.
- Added crime progression, crime XP, rewards and stat influence.
- Added combat opponent selection, estimated win chance, weapon/armor effects, victory/defeat outcomes and hospital state.
- Added gym memberships, gym EXP, stat-specific training and happiness-based gains.
- Added jobs and timed salary payments.
- Added inventory, buying, using, equipping and item effects.
- Added missions with tracked progress and claimable rewards.
- Added education courses and completion tracking.
- Added property progression with health, nerve and happiness effects.
- Added bank deposit/withdrawal mechanics.
- Added responsive desktop/mobile UI and a dedicated activity feed.
- Removed broken `print()` usage and stale imports.

## Scope

RiftCity is an original project. This package does not copy Torn's proprietary source code, assets, text, branding, or private server logic. It implements original systems with similar high-level genre concepts rather than a 1:1 reproduction.

## Run

```bash
npm install
npm run dev
```

Then open the Vite development URL.
