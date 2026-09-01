# Ironvale

Ironvale is intentionally a small browser game-engine core.

## Runtime split

- **RiftCore (C++ → WebAssembly, player-side):** terrain heightfield storage, sculpt brushes, height/normal/slope sampling, walkability, chunk mesh generation and terrain raycasting.
- **Rift Web bridge (JavaScript):** touch/editor UI, PWA/browser integration, WebGL2 rendering and networking glue.
- **Cloudflare Worker:** authentication, sessions, character persistence and future authoritative validation/sync. It does not run the real-time terrain engine.

The committed `public/rift-core.wasm.gz` is what players download. C++ is compiled ahead of time; players do not receive a compiler. Rebuild the native artifact with `npm run build:native` when changing `native/` sources.

The active world is a blank 640×640 continuous heightfield with 1 m authoring samples. Terrain is organized into 128 m components containing 2×2 64 m sections. Sections select adaptive LOD independently (1/2/4/8/16 m render steps), neighboring sections are constrained to one LOD level of difference, and RiftCore morphs fine edges onto coarser neighbor edges to prevent cracks. Components/sections are rendering and streaming partitions, not Minecraft-style cells. Negative world Y is valid.

Sculpting marks only overlapping/adjacent terrain sections dirty, so edits rebuild localized meshes instead of the whole world. Collision continues to query the full native heightfield near gameplay while exposing distance-based collision-LOD hooks for future broad-phase/streaming work.

RiftLandscape now exposes visible weight-blended terrain materials and Freecam-authored landscape splines. Material paint/erase edits are stored with the landscape draft and immediately recolor rebuilt terrain sections. Spline control points flatten/deform the heightfield through the non-destructive landscape composition pass, with editable width and falloff. The mobile Terrain Tools panel is vertically scrollable so all controls remain reachable in landscape orientation.

The former RiftBlock/RiftSection voxel world, Downtown tile worlds, Blueprint/building pipelines, legacy editors/builders, AI Builder, combat, inventory, quests, codex and other old gameplay systems are not part of this branch.


## RiftLandscape v2

Ironvale's terrain management layer is now `RiftLandscape`, an Unreal-Landscape-inspired architecture over the existing RiftCore native heightfield. The native C++/WASM core still owns height sampling, sculpt math, collision queries, raycasts, section mesh generation and stitched LOD edges; RiftLandscape adds higher-level authoring and streaming state without moving hot terrain math back into JavaScript.

RiftLandscape organizes the world as **128 m components → 64 m render sections → 1 m source samples**. Sculpting writes into an active non-destructive edit layer, and enabled layers are composited back into the native heightfield. Layer enable/disable, ordering, locking, undo/redo snapshots and sparse draft serialization are first-class. Legacy `rift-terrain-edit-v2` drafts migrate into the default Sculpt layer.

The landscape also owns sparse material weightmaps (grass/dirt/rock/gravel/mud/path slots), spline metadata hooks for future roads/rivers, dirty-component tracking, component streaming keys, collision-LOD policy hooks, and LOD hysteresis so section detail does not flap at distance thresholds. Material weight data and splines are foundation data in this milestone; terrain shader blending and spline deformation come on top of this architecture rather than replacing it.
