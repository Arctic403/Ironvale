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


## RiftCity Core Audit / V6

This build was audited for missing core-loop systems and expanded beyond the earlier prototype.

### Core resources
- Health and maximum health
- Energy and offline regeneration
- Nerve, dynamic nerve maximum and offline regeneration
- Happiness, property maximum and passive recovery
- XP, level progression and combat/crime progression
- Persistent timestamps for all timed resources

### Economy
- Cash and bank balances
- Persistent offline bank interest
- Lifetime interest tracking
- Net-worth and peak net-worth tracking
- Daily reward and streak system
- Item purchasing and vendor resale
- Points and merit counters

### Crime
- Level-gated crimes
- Nerve costs
- Crime experience
- Success / critical success / spooked / jail / critical-fail outcomes
- Per-crime completion counters
- Rewards and XP

### Combat
- Four combat stats
- Weapons and armor
- Opponent difficulty and win chance
- Energy costs
- Victory rewards
- Defeat and hospital state
- Fight statistics

### Character progression
- Level / XP
- Crime experience
- Gym experience
- Combat stats
- Points / merits
- Job state
- Property
- Equipment
- Inventory
- Net worth

### City
- Multiple locations
- Travel energy cost
- Location discovery tracking
- Random interactive encounters
- Rest / recovery interaction

### Timed systems
All timers are timestamp-based instead of depending on the browser remaining open. Closing the page and returning later will correctly calculate elapsed resource regeneration, salary payments, hospital/jail completion and bank-interest cycles.

### Important scope
RiftCity is an original game inspired by the browser crime/RPG genre. It does not include Torn's proprietary source code, copyrighted text, artwork, branding, or a literal 1:1 implementation of Torn.
