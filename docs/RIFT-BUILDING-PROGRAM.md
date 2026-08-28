# RiftCity BuildingProgram H2.00

BuildingProgram remains the semantic AI authoring format, but H2.00 **replaces the former monolithic compiler** with one authoritative dependency-driven building compiler.

The runtime output is still the canonical `riftcity-city-block` v2 document consumed by RiftBlock rendering, physics, Build Mode, world composition and inspection. The source JSON did not become a second runtime format.

## Core rule

**Plan globally. Build locally. Validate between dependency stages.**

AI is responsible for architectural intent and decisions. Deterministic RiftCity subsystems enforce relationships, construct geometry and reject invalid states.

A building request is still one user operation. Internally it becomes a staged compile rather than one giant coordinate-generation pass.

```text
AI request
  -> BuildingProgram source
  -> BuildingPlan IR
  -> semantic topology
  -> global architecture
  -> structure
  -> core/void reservation
  -> circulation
  -> interior
  -> facade + global roof envelope
  -> detail/gameplay
  -> RiftBlock game geometry
  -> visual inspection
```

## Authoritative H2.00 stages

1. **design-contract** — building purpose, scale, floors, height, occupancy target, style/design rules.
2. **semantic-topology** — spaces and the portal/core graph are normalized and connectivity is checked before geometry is generated.
3. **global-architecture** — lot, footprint/massing, floor stack, core positions, void positions, facade intent and roof intent are locked together.
4. **structure** — deterministic structural shell and floor plates are materialized from the approved architecture plan.
5. **core-reservation** — authored atria/voids and vertical-core openings are cut from the structural plates.
6. **circulation** — stairs and other supported connectors are realized inside their already-reserved volumes.
7. **interior** — partitions and portals are realized after circulation so partitions cannot silently overwrite stairs/cores.
8. **envelope** — windows, entrances and the globally coordinated roof are realized; final interior clearance/core geometry is revalidated against the envelope.
9. **detail-gameplay** — named anchors, asset hooks, service points and authored site details are attached without changing locked structural decisions.
10. **game-geometry** — local geometry is rotated/placed, compressed into RiftBlock operations and operation limits are checked.
11. **visual-inspection** — post-compile review stage. Cheap deterministic checks run continuously; expensive screenshots remain a milestone review rather than a requirement after every small pass.

The stage graph is code-defined in `public/rift-building-pipeline.js` and emitted into generated block metadata as `build_pipeline`.

## BuildingPlan intermediate representation

Every compile creates a `riftcity-building-plan` v2 IR before physical generation. It records:

- design contract
- semantic space graph
- lot, origin and rotation
- floor stack
- normalized massing
- core and void reservations
- facade intent
- global roof intent
- detail/gameplay intent
- a fingerprint for each dependency stage

The compiler also records `building_plan_fingerprint` in generated block metadata.

The plan is intentionally more abstract than RiftBlocks. AI should describe *what the architecture is*; deterministic compilers decide how that intent becomes cells and operations.

## Hard gates and soft issues

A stage may not run until its dependency has passed.

### Hard constraints

Errors stop strict compilation at the stage where they are discovered. Examples:

- unreachable required spaces
- building outside its lot
- invalid/missing destination-floor core opening
- partition intersecting protected circulation
- portal that fails to cut its intended wall
- blocked stair headroom
- insufficient room clearance
- operation limit exceeded

This prevents an early design error from contaminating every downstream pass.

### Soft constraints

Warnings produce a `soft-pass` and allow downstream work. Examples include non-fatal space overlap or a multi-floor legacy source with no declared connector where the source is still inspectable.

Notices record useful information such as metadata-only asset hooks.

## Topology before geometry

Explorable buildings should use `building.interior`:

```json
{
  "interior": {
    "version": 1,
    "entry_space": "lobby",
    "require_all_spaces_reachable": true,
    "spaces": [],
    "walls": [],
    "portals": [],
    "voids": [],
    "vertical_cores": []
  }
}
```

Source interior version 1 remains valid input, but it is compiled by the H2 staged interior engine (`RIFT_INTERIOR_ARCHITECTURE_VERSION = 2`).

The space graph is checked before structural cells are built. A disconnected required room therefore fails at `semantic-topology`, not after an otherwise-finished building has already been generated.

## Vertical circulation and slab reservations

Vertical cores are architectural decisions, so their location belongs to the global architecture plan.

Physical build order is deliberately:

```text
plan core position
-> build structural plates
-> reserve/cut core opening
-> realize stair geometry
-> realize partitions around protected circulation
```

Moving a core invalidates global architecture and all dependent structural stages because the floor openings may need to move too.

Interior walls are later-stage geometry. Moving only a partition does **not** rebuild the slabs or circulation system.

## Roof strategy

Roof intent is planned together with massing and facade intent, not invented after the building is finished.

`building.design_rules.roof_profile`, `flat_roof_forbidden`, optional `building.roof_plan`, and roof-tagged masses feed the global `roofIntent` object in the BuildingPlan.

The physical roof is deliberately realized during the **envelope** stage after structural/interior dependencies are established. Roof facets/details therefore belong to one global roof system rather than independent AI-generated pieces.

The current mass-envelope roof compiler remains deterministic; H2 provides the dependency boundary for increasingly sophisticated ridge/valley/facet topology without changing the rest of the building pipeline.

## Selective invalidation

`getRiftBuildingAffectedStages(changedPaths)` and BuildingPlan fingerprints define dependency locks.

Examples:

- change massing/core/void -> rebuild global architecture and every affected downstream stage
- change a partition -> rebuild interior, envelope, details and game geometry only
- change windows -> rebuild envelope and downstream only
- move an interaction anchor -> rebuild detail/gameplay and game geometry only

`diffRiftBuildingPlans(previousPlan, nextPlan)` compares stage fingerprints and returns changed + downstream-dirty stages.

This is the basis for future incremental AI repair: regenerate the smallest valid dependency subtree instead of rebuilding an entire building or district for one doorway.

## Main source shape

```json
{
  "format": "riftcity-building-program",
  "version": 1,
  "id": "rift-bank-001",
  "world_origin": [2048, 0, 1024],
  "lot": {
    "bounds": { "min": [0,0,0], "max": [63,31,63] }
  },
  "palette": {},
  "building": {
    "origin": [8,0,8],
    "rotation": "north",
    "floors": 3,
    "floor_height": 6,
    "occupancy_target": 250,
    "design_rules": {
      "roof_profile": "multi-tier-crown",
      "flat_roof_forbidden": true
    },
    "masses": [],
    "window_runs": [],
    "entrances": [],
    "interior": {
      "version": 1,
      "entry_space": "lobby",
      "spaces": [],
      "walls": [],
      "portals": [],
      "voids": [],
      "vertical_cores": []
    },
    "anchors": [],
    "asset_instances": []
  },
  "site_ops": []
}
```

## Coordinates

All dimensions are meters.

- `world_origin`: absolute world coordinate of the BuildingProgram lot/block
- `lot.bounds`: local authoring bounds
- `building.origin`: placement inside the lot
- mass/space/portal/void/core coordinates: building-local
- final semantic metadata records local/world/chunk positions
- default world chunk size: 128m

## Public API

`window.RiftCityBuildingPipeline` now identifies itself as `H2.00-dependency-driven-building-compiler` and exposes:

- `plan(program)`
- `compile(program, options)`
- `compileJson(program, options)`
- `diagnose(program)`
- `diffPlans(previousPlan, nextPlan)`
- `affectedStages(changedPaths)`

`compile()` returns the original program, BuildingPlan, pipeline trace, generated city-block document, report, semantic metadata and diagnostics.

## Regression requirements

H2.00 is gated by `scripts/check-rift-building-stage-pipeline.js` plus the existing BuildingProgram, interior, inspection, Downtown composition and full build checks.

The regression specifically asserts:

- one authoritative staged compiler path
- topology fails before geometry when disconnected
- stage dependency order cannot regress
- core changes invalidate slabs/circulation
- partition/facade/detail edits preserve unaffected upstream stages
- generated Bank metadata carries the H2 pipeline + plan fingerprint
- existing RiftBlock output still passes the normal runtime/compiler/inspection pipeline

The end goal remains unchanged: a human or AI can request one entire building, block or eventually district in one command, while RiftCity internally plans, constructs, verifies and selectively repairs it through controlled dependency stages.
