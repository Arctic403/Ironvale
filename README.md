# Ironvale

Ironvale is a grounded medieval online RPG built on the **Rift Engine**. The repository began as RiftCity; the complete pre-conversion game is preserved on the `riftcity-backup-2026-08-31` branch.

## Current foundation

The active game path is now Ironvale-first: a persistent character, a world/codex model, quest journal, medieval inventory/equipment, starter NPCs/factions/creatures, and the Blackstone Road story foundation. The playable 3D world continues to use the proven Rift Engine renderer, Native Core v3 WebAssembly, RiftSection streaming/storage, collision/raycasting, third-person camera, mobile controls, world/building authoring and Cloudflare-efficient networking.

## Engine vs game naming

`rift-*` modules, RiftSection, Rift Native and Rift Engine terminology are intentional engine names. Game-facing UI, PWA metadata, account/session namespace and new persistence/API domains use **Ironvale**.

The internal `riftcity-city-block` / `riftcity-world-index` JSON format strings remain compatibility identifiers for the current Rift authoring format. They are not Ironvale branding and can be version-migrated later without breaking existing authored fixtures.

## Cloudflare

`wrangler.toml` currently preserves the existing Worker/D1/R2 resource names so the proven deployment bindings are not accidentally disconnected during the game conversion. Those infrastructure resource names can be migrated separately after the Ironvale runtime is stable.

## Active routes

- `#world` — Rift Engine 3D world
- `#character` — persistent Ironvale character
- `#journal` — quest chains
- `#inventory` — gear and supplies
- `#codex` — regions, settlements, factions, NPCs, creatures and dungeons

## Development

```bash
npm run build
npm run dev
```

The build runs the Ironvale foundation verifier plus the existing Rift Engine/native/WASM/world/building/camera regression suite.
