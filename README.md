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

The active world is a blank **640 × 640 m** continuous heightfield with 1 m authoring samples. Components and sections are rendering/streaming partitions, not Minecraft-style cells. Negative world Y remains valid.

Terrain material slots now boot entirely from the runtime's local fallback color, flat-normal and roughness layers. The previous remote project-specific terrain texture URLs were disconnected so this baseline does not depend on the old game's asset namespace. Proper bundled local terrain textures can be added later without changing the terrain schema.

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

This cleanup intentionally does **not** add harvesting, inventory, crafting, building, weapons, loot, survival meters or new world content. The next milestone should begin only from this verified foundation.
