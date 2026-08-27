# RiftCity Pure JavaScript Editor Architecture

## Decision

RiftCity uses plain ES-module JavaScript for both the real-time game runtime and the private Block Editor UI. The editor no longer requires a component framework, JSX, or a browser bundling step.

## Ownership

### Game/runtime owns

- movement and player state
- camera and fullscreen/orientation handling
- collision and walkable geometry
- scene/subarea transitions
- touch/keyboard/pointer input
- animation-frame work
- runtime scene configuration

### Block Editor UI owns

- static authoring controls and panels
- inspector fields
- palette and tool buttons
- scene-config inputs
- publish/draft/history controls
- layout chrome for the private developer workspace

The editor UI markup lives in `public/editor/block-editor-ui.js`, while `public/editor/block-editor-entry.js` statically composes that UI with `public/views/block-world.js`. The shared gameplay runtime receives the editor mount function explicitly and never lazy-imports private editor code. This preserves the existing DOM ID/data-attribute contract while keeping the game entry path editor-free and making the editor module graph deterministic in iOS standalone/Home Screen mode.

## State boundary

There is one scene/editor state model in `public/views/block-world.js`. UI controls do not maintain a second framework state tree. They read/write the current working scene through explicit event handlers and the same runtime objects used by direct manipulation.

Authoring flow:

1. source fallback config/layout is loaded
2. private editor loads the current draft when available
3. direct manipulation and inspector controls mutate the current working scene
4. autosave persists draft state
5. Publish validates and promotes the draft to the authoritative published revision
6. Play mode hydrates from the published scene

## Build/deploy

`npm run build` now performs only the pure-JavaScript policy check and JavaScript syntax check. There is no JSX transpilation or editor UI bundle generation.

Cloudflare continues to serve `public/` directly and Wrangler continues to bundle the Worker entry point under `src/`.

## Local Test

The Editor Local Test environment can serve RiftCity directly from the current browser workspace. The private Block Editor has a dedicated static entry module at `public/editor/block-editor-entry.js`, so Local Test can load that entry from inside its `/__riftcity_local__/` prefix and let relative imports stay inside the sandbox. No in-browser JSX build or runtime lazy editor import is required.

## Rules going forward

1. Keep frame-by-frame state outside UI controls.
2. Keep the Block Editor UI split into small ES modules as it grows; do not turn `block-world.js` into a monolithic UI renderer.
3. Preserve server authority for published layouts/configs and gameplay outcomes.
4. Prefer direct DOM/event ownership for editor tools that manipulate the game scene.
5. Keep source config as a safe fallback and verified D1 published state as the live authority.
6. Do not reintroduce JSX or the removed UI framework dependencies. `npm run verify:js-only` enforces this policy.
