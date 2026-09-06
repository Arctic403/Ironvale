# Android Survival Core

This repository is the clean foundation for an **Android-first multiplayer survival sandbox**. The final game name is intentionally not baked into the runtime yet.

## Direction

The target is a Rust-style survival sandbox designed around Android from the start:

- the phone runs rendering, terrain, character movement, input, camera and nearby simulation locally;
- the backend remains authoritative for identity, persistence, accepted movement/state transitions, integrity checks and anti-cheat evidence;
- world systems are streamed/partitioned instead of assuming the whole map is simulated at full detail on every phone;
- gameplay systems are added only after this foundation stays clean and verifiable.

The current browser/Codespace page is a **development harness**, not the final Android shell. An APK/local runtime host can replace that shell without replacing the RiftCore terrain foundation.

## What survived the cleanup

- **RiftCore (C++ → WebAssembly):** heightfield storage, sculpt brushes, height/normal/slope sampling, walkability, section mesh generation and terrain raycasting.
- **RiftLandscape:** 128 m components, 64 m sections, adaptive 1/2/4/8/16 m render LOD, stitched neighbor edges, non-destructive edit layers, weightmaps and spline deformation.
- **WebGL2 renderer:** terrain splat material path, frustum culling, adaptive mobile pixel-ratio controls and GPU diagnostics.
- **Character foundation:** rigged Quaternius humanoid, animation playback, capsule fallback, third-person camera, joystick movement, sprint and auto-run.
- **Realtime authority:** 10 Hz player transform publishing, Durable Object RAM authority, movement validation, 128 m zone authority and bounded nearby-interest queries.
- **Backend foundation:** accounts, sessions, character persistence, integrity attestation, sparse anti-cheat case persistence and admin/service-key reviewer boundaries.
- **Diagnostics:** three-layer runtime dumps, render/WASM/network telemetry, validator guards and automated regression checks.

## Deliberately removed

The cleanup removes the old project identity and old game-specific behavior. There is no city/crime/casino/banking/quest/codex content, no legacy builders or voxel world, and no RPG target-lock / Attack / Ability 1–3 client system.

The old repository-bound GitHub OIDC anti-cheat review workflow was also removed. It was tied to the previous repository identity; anti-cheat authority itself remains intact and reviewer writes are still admin-only.

## Terrain baseline

The active world is a deterministic **5120 × 5120 m `island-v3`** survival island. A compact 1025 × 1025 native RiftCore heightfield uses 5 m authoritative samples (about 1.05 million samples rather than 26+ million at 1 m), while nearby 80 m sections stream into renderer/GPU memory through 160 m components. The v3 generator scales its macro noise wavelengths with world size so the 5 km island forms broad coastal regions, lowlands, hills, ridges, valleys, highlands, cliffier coasts and flatter build-friendly areas instead of repeating the old 640 m terrain pattern. Negative world Y remains valid.

World identity is `seed + generator version + world size`. The default development seed is `4032026`; the backend owns the active seed through the `WORLD_SEED` Worker variable and returns the 5120 m `island-v3` generation contract in `/api/bootstrap`. The client generates the exact heightfield locally. The same seed with `island-v3` reproduces byte-identical terrain; a different seed produces a different island. Server creation can therefore allocate a seed without storing a full heightmap.

`island-v3` also derives initial material weights from generated height/slope: sand around the shoreline, grass as the base layer, and dirt/rock/gravel/mud transitions where appropriate. These are only starting masks—RiftLandscape manual sculpt and material edit layers remain additive and persistent on top. The runtime draws a simple development water plane at the configured water level so the generated coastline reads as an island before a final water system exists.

Terrain material slots still boot entirely from local fallback color, flat-normal and roughness layers. Proper bundled local terrain textures can be added later without changing the terrain schema.

## Verification

```sh
npm run build
```

The build verifies JavaScript syntax, RiftCore WASM/source synchronization, terrain/character contracts, diagnostics, realtime RAM authority, integrity, anti-cheat boundaries, zone authority and terrain material packing.

When changing the C++ terrain core:

```sh
npm run build:native
npm run build
```

## Current boundary

This milestone adds only deterministic seeded island generation and its initial terrain/material presentation. It does **not** add trees, rocks/resource nodes, roads, rivers, monuments, loot, harvesting, inventory, crafting, building, weapons or survival meters. Those systems should consume the generated world contract later instead of being baked into `island-v3`.
