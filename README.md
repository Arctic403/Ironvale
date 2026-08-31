# Ironvale

Ironvale is intentionally a small browser game-engine core.

## Runtime split

- **RiftCore (C++ → WebAssembly, player-side):** terrain heightfield storage, sculpt brushes, height/normal/slope sampling, walkability, chunk mesh generation and terrain raycasting.
- **Rift Web bridge (JavaScript):** touch/editor UI, PWA/browser integration, WebGL2 rendering and networking glue.
- **Cloudflare Worker:** authentication, sessions, character persistence and future authoritative validation/sync. It does not run the real-time terrain engine.

The committed `public/rift-core.wasm` is what players download. C++ is compiled ahead of time; players do not receive a compiler. Rebuild the native artifact with `npm run build:native` when changing `native/` sources.

The active world is a blank 640×640 continuous heightfield with 1 m authoring samples and 64 m render/streaming chunks. Terrain chunks are rendering partitions, not Minecraft-style cells. Negative world Y is valid.

The former RiftBlock/RiftSection voxel world, Downtown tile worlds, Blueprint/building pipelines, legacy editors/builders, AI Builder, combat, inventory, quests, codex and other old gameplay systems are not part of this branch.
