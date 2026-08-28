# RiftCity BuildingProgram H1.90

BuildingProgram is the AI authoring layer for deterministic, editable buildings. It is **not** a new runtime world format. The compiler produces the existing `riftcity-city-block` v2 document consumed by the normal RiftBlock importer, renderer, physics, Build Mode, and inspection pipeline.

## Pipeline

`AI request -> BuildingProgram -> massing -> Interior Architecture -> deterministic compile -> diagnostics/repair manifest -> canonical Rift block -> normal engine`

This keeps generated architecture semantic and editable while preserving the stable runtime.

## Coordinate hierarchy

All dimensions are meters.

- `world_origin`: absolute world coordinate of the BuildingProgram lot/block.
- `lot.bounds`: local authoring bounds inside that world origin.
- `building.origin`: local placement inside the lot.
- mass/space/portal/void/vertical-core coordinates are building-local.
- the compiler records final local, world, chunk and chunk-local positions for semantic anchors.
- default world chunk size is 128m.

## Main source fields

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
    "floor_height": 4,
    "masses": [],
    "window_runs": [],
    "entrances": [],
    "stair_runs": [],
    "interior": {
      "version": 1,
      "entry_space": "lobby",
      "spaces": [],
      "walls": [],
      "portals": [],
      "voids": [],
      "vertical_cores": []
    },
    "rooms": [],
    "anchors": [],
    "asset_instances": []
  }
}
```

## Massing

A building is the union of one or more rectangular masses. Overlapping masses are resolved as one exterior shell, so internal overlap faces do not become duplicate exterior walls. Different mass heights create stepped roofs automatically.

Each mass supports local origin, width/depth, floors, floor height, wall/floor/roof material overrides, and tags. The compiler generates exterior walls, intermediate floor plates and roofs from the union volume, then compresses the result into canonical `fill_box` operations.

## Facades and openings

`window_runs` create repeated windows from semantic facade rules. Runs that land on a facade made internal by another mass are automatically culled and reported as notices rather than generating invalid windows.

`entrances` carve real openings and generate named semantic entrance anchors with local/world/chunk coordinates and facing.

## H1.90 Interior Architecture

`building.interior` is the first structural interior-authoring layer. It is additive and backward-compatible: older BuildingPrograms may continue using legacy `stair_runs` and metadata-only `rooms`, while explorable interiors should use the H1.90 architecture grammar.

The interior compile order is deliberately **void-first**:

1. exterior massing creates the union shell and candidate floor plates;
2. authored atriums/floor voids are reserved;
3. interior partition walls are generated;
4. portals physically carve those partitions;
5. vertical cores reserve destination-floor stairwell openings;
6. stairs are generated inside those reserved openings;
7. the compiler validates head clearance, top/bottom landings, portals, walkable spaces and semantic reachability;
8. only then is geometry compressed into canonical Rift block operations.

This fixes the old failure mode where a valid-looking stair definition could terminate into an automatically generated floor slab.

### Spaces

`interior.spaces` are first-class usable regions rather than decorative labels. Each space has a floor, rectangular footprint, optional capacity and tags. The compiler verifies that every space contains usable floor with standing clearance.

```json
{
  "id": "grand-lobby",
  "name": "Grand Banking Lobby",
  "floor": 2,
  "min": [8, 29],
  "max": [43, 46],
  "capacity": 150,
  "tags": ["public", "high-capacity", "double-height"]
}
```

When H1.90 spaces are present they also populate the legacy `semantics.rooms` surface so existing diagnostics remain compatible.

### Interior walls

`interior.walls` generate real partition geometry. Their footprint is an inclusive `[x,z]` rectangle, so a one-cell-thick wall is expressed by keeping one axis equal.

```json
{
  "id": "lobby-divider",
  "floor": 2,
  "min": [8, 28],
  "max": [43, 28],
  "height": 4,
  "state": "warm_stone"
}
```

Partitions fail validation if they collide with the exterior shell or stand on unsupported floor.

### Portals

`interior.portals` are physical wall openings and graph edges between two spaces. A portal that does not hit its intended partition, or remains blocked after compilation, is an error.

```json
{
  "id": "lobby-to-hall",
  "floor": 2,
  "between": ["grand-lobby", "main-hall"],
  "at": [26, 28],
  "axis": "x",
  "width": 12,
  "height": 4
}
```

### Voids / atriums

`interior.voids` remove authored floor plates **before** stairs and interior geometry are finalized.

```json
{
  "id": "grand-atrium",
  "kind": "atrium",
  "floors": [3],
  "min": [14, 31],
  "max": [39, 46]
}
```

A void that removes no floor cells is an error rather than a silent no-op.

### Vertical cores

`interior.vertical_cores` represent one semantic stair connection, regardless of stair width. The compiler expands one core into the required parallel Rift stair lanes.

```json
{
  "id": "grand-stair-f1-f2",
  "kind": "stair",
  "from_floor": 2,
  "to_floor": 3,
  "from_space": "main-hall",
  "to_space": "mezzanine",
  "at": [16, 20],
  "direction": "east",
  "width": 8,
  "steps": 5,
  "head_clearance": 3,
  "state": "bank_stair"
}
```

Before those stair cells are emitted, H1.90 calculates every destination-floor slab cell that would violate the requested head clearance and reserves it as air. After stair generation it verifies:

- every stair lane exists;
- the required slab opening exists;
- requested head clearance remains empty;
- every lane has supported lower and upper landings;
- the connected spaces participate in the interior reachability graph.

### Reachability graph

Portals create same-floor edges. Vertical cores create cross-floor edges through `from_space` / `to_space`. With `require_all_spaces_reachable` enabled (the default), every space must be reachable from `entry_space` or the build fails.

This is a semantic architecture guard, not a full NPC navmesh. It prevents isolated rooms/floors before later navigation systems are layered on.

## Legacy vertical connectors and rooms

Legacy `stair_runs` remain supported for old sources. They now accept `head_clearance`; however, new explorable buildings should use `interior.vertical_cores` so slab openings and landing validation are automatic.

Legacy `rooms` remain metadata-only. H1.90 `interior.spaces` are the preferred source for authored interiors. Named anchors are retained in the diagnostic report with local/world/chunk coordinates.

## Asset hooks

`asset_instances` are retained as semantic instances for future GLB/PBR assets. H1.85 deliberately does not bake opaque neural meshes into the structural block document. This lets later asset generation plug into the building without making the structural architecture uneditable.

## Diagnostics and automatic repair contract

Every compile emits a `riftcity-building-report` containing errors/warnings/notices, source paths, local/world positions when relevant, the building id, machine-readable repair suggestions, and building/floor/anchor/room/connector/chunk semantics. A strict compile refuses to pass with errors. This is the contract for future AI generate -> render -> diagnose -> repair loops.

## Diagnostic inspector

Open `building-inspection.html` with an optional local source path:

`building-inspection.html?program=./riftcity-buildings/my-building.json`

It provides a 1m grid, floor isolation, all-floor X-ray, wireframe mode, structural spaces, partition walls, portals, atrium/floor voids, generated stair-core openings, anchors, live local/world/chunk coordinate readout, and validation/repair diagnostics. The GitHub `Rift Building Interior Preview` workflow automatically captures B1/F1/F2/F3 + X-ray plans for the Bank whenever interior-source files change.

## Verification

`npm run verify:building-programs` compiles every source file in `public/riftcity-buildings`, runs the generated canonical document through the real Rift city-block compiler, and verifies committed generated block/report files are not stale.

`npm run verify:interiors` runs dedicated H1.90 regressions for structural stair openings, physical portals, atrium voids, full space connectivity and rejected bad landings/disconnected layouts.
