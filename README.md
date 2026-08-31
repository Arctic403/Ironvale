# Ironvale

Ironvale is intentionally a small browser game-engine core.

## Runtime split

- **RiftCore (C++ → WebAssembly, player-side):** terrain heightfield storage, sculpt brushes, height/normal/slope sampling, walkability, chunk mesh generation and terrain raycasting.
- **Rift Web bridge (JavaScript):** touch/editor UI, PWA/browser integration, WebGL2 rendering and networking glue.
- **Cloudflare Worker:** authentication, sessions, character persistence and future authoritative validation/sync. It does not run the real-time terrain engine.

The committed `public/rift-core.wasm.gz` is what players download. C++ is compiled ahead of time; players do not receive a compiler. Rebuild the native artifact with `npm run build:native` when changing `native/` sources.

The active world is a blank 640×640 continuous heightfield with 1 m authoring samples. Terrain is organized into 128 m components containing 2×2 64 m sections. Sections select adaptive LOD independently (1/2/4/8/16 m render steps), neighboring sections are constrained to one LOD level of difference, and RiftCore morphs fine edges onto coarser neighbor edges to prevent cracks. Components/sections are rendering and streaming partitions, not Minecraft-style cells. Negative world Y is valid.

Sculpting marks only overlapping/adjacent terrain sections dirty, so edits rebuild localized meshes instead of the whole world. Collision continues to query the full native heightfield near gameplay while exposing distance-based collision-LOD hooks for future broad-phase/streaming work.

The former RiftBlock/RiftSection voxel world, Downtown tile worlds, Blueprint/building pipelines, legacy editors/builders, AI Builder, combat, inventory, quests, codex and other old gameplay systems are not part of this branch.
