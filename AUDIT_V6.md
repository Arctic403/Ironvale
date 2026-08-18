# RiftCity V6 Audit

## Findings from the supplied build

The previous core was not empty, but it was a prototype with several systems represented only as minimal state fields. The largest gaps were:

- Resource handling was duplicated in `App.tsx` instead of consistently using the resource engine.
- Offline regeneration was not centralized.
- Happiness was only passively restored and had limited gameplay interaction.
- Bank balances had no persistent interest cycle.
- No daily reward/streak loop.
- No per-crime statistics.
- No net-worth tracking.
- No points/merit progression surface.
- No market/vendor resale system.
- No dedicated bank UI.
- Travel had no resource cost.
- There was no rest/recovery interaction.
- Jobs had no resignation control.
- The item catalog and progression content were very small.
- Combat opponent content was small.
- Crime content was small.
- Mission content was small.
- The Vercel build previously failed because `App.tsx` lacked a default export in the deployed revision.

## V6 implementation

### Resources
- Health and max health
- Energy and offline regeneration
- Nerve and dynamic nerve maximum
- Happiness and property-specific happiness ceiling
- Timestamp-based resource calculations
- Offline recovery after closing the browser

### Crime
- 11 level-gated crimes
- Nerve costs
- Crime XP
- Per-crime completion counters
- Success
- Critical success
- Spooked
- Jail
- Critical failure
- Rewards and XP

### Combat
- Four battle stats
- Weapons and armor
- 9 opponents
- Win chance calculation
- Energy costs
- Rewards
- Hospital state
- Fight statistics

### Economy
- Cash
- Bank
- Persistent interest
- Interest lifetime total
- Daily rewards
- Daily streak
- Points
- Merits
- Net-worth tracking
- Peak net-worth tracking
- Market buy/sell loop

### Progression
- Levels
- XP
- Crime experience
- Gym experience
- Jobs
- Education
- Property progression
- Missions
- Equipment
- Inventory

### City
- Four locations
- Travel costs
- Location discovery
- Random encounters
- Rest/recovery

### Reliability
- Save migration defaults
- Timestamp-based timers
- Vercel-compatible Vite structure
- `export default App`
- TypeScript syntax was checked with the globally available TypeScript compiler. The local dependency tree was not available in the execution environment, so the only reported compiler errors were missing installed React/ReactDOM type packages.

## Scope

RiftCity is an original browser crime/RPG implementation. It can reproduce the broad systems and gameplay loops associated with this genre, but it does not copy Torn's proprietary source code, copyrighted writing, artwork, or other protected assets.
