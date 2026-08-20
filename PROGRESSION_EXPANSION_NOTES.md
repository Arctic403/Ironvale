# RiftCity Progression Expansion v2.5

This patch expands existing RiftCity systems instead of replacing the game architecture.

## Added / upgraded
- Progression Hub screen in navigation.
- Merit upgrade tree with max Energy, max Nerve, crime, gym, banking, and job upgrades.
- Heat / Wanted system tied into crimes, jail, property security, contacts, factions, and world events.
- Repeatable daily / weekly challenges with period-aware claiming and progression baselines.
- Faction ranks, descriptions, faction-specific missions, leave cooldown, and reward shops.
- Manual work shifts, promotion progress, workplace events, and actual job stat bonuses in combat/crime.
- Property upgrade system: bedroom, home gym, medical room, security, and storage.
- Item rarity, combat/item stats, durability metadata, sell values, and faction-exclusive gear.
- Dynamic market history, short trend/range display, portfolio value, and quantity trades (1/5).
- Chained crimes using abstract intel unlocks between crime tiers.
- Chained story missions with chapter/prerequisite gates and merit/point rewards.
- NPC relationship system with mechanical bonuses at trusted reputation.
- Timed world events that modify crime, gym, work, and market behavior.
- Expanded achievement categories and lifetime statistics.
- City-map location visits now update current/visited location state; key districts provide local mechanical bonuses.
- Save migration preserves existing saves while initializing all new fields.

## Cleanup
- Removed malformed `src/    types/riftCity.ts` duplicate.
- Removed stray `src/styles/T` and `src/lore/T` files.

## Validation
- TypeScript static pass was run. In this environment React packages could not be installed before timeout, so diagnostics caused only by missing React/JSX type packages were excluded. No additional project-specific TypeScript diagnostics remained after that filter.
