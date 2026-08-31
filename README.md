# Ironvale

Ironvale is now intentionally small.

The active runtime contains only:
- the Rift WebGL mesh engine;
- Rift Terrain v1 (continuous heightfield terrain, chunked rendering, sculpt data, visibility holes and 3D cave meshes);
- a minimal world/player runtime;
- Cloudflare Worker authentication, sessions and character persistence.

The former RiftBlock/RiftSection voxel world, Downtown tile worlds, Blueprint/building pipelines, editors/builders, AI Builder, WASM/native cube collision, combat, inventory, quests, codex and other legacy gameplay systems are not part of this branch.

Terrain chunks are render/streaming partitions only. They are not Minecraft-style cells.
