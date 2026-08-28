# RiftCity BuildingProgram H1.85

BuildingProgram is the AI authoring layer for deterministic, editable buildings. It is **not** a new runtime world format. The compiler produces the existing `riftcity-city-block` v2 document consumed by the normal RiftBlock importer, renderer, physics, Build Mode, and inspection pipeline.

## Pipeline

`AI request -> BuildingProgram -> deterministic compile -> diagnostics/repair manifest -> canonical Rift block -> normal engine`

This keeps generated architecture semantic and editable while preserving the stable runtime.

## Coordinate hierarchy

All dimensions are meters.

- `world_origin`: absolute world coordinate of the BuildingProgram lot/block.
- `lot.bounds`: local authoring bounds inside that world origin.
- `building.origin`: local placement inside the lot.
- mass/room/opening/stair coordinates are building-local.
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

## Vertical connectors

`stair_runs` place Rift stair states, clear immediate headroom, record semantic floor connectors, and preserve final N/E/S/W orientation after whole-building rotation.

## Rooms and anchors

Rooms are semantic floor regions used for validation and later gameplay/AI authoring. Named anchors are retained in the diagnostic report with local/world/chunk coordinates.

## Asset hooks

`asset_instances` are retained as semantic instances for future GLB/PBR assets. H1.85 deliberately does not bake opaque neural meshes into the structural block document. This lets later asset generation plug into the building without making the structural architecture uneditable.

## Diagnostics and automatic repair contract

Every compile emits a `riftcity-building-report` containing errors/warnings/notices, source paths, local/world positions when relevant, the building id, machine-readable repair suggestions, and building/floor/anchor/room/connector/chunk semantics. A strict compile refuses to pass with errors. This is the contract for future AI generate -> render -> diagnose -> repair loops.

## Diagnostic inspector

Open `building-inspection.html` with an optional local source path:

`building-inspection.html?program=./riftcity-buildings/my-building.json`

It provides a 1m grid, floor isolation, all-floor X-ray, wireframe mode, semantic rooms/anchors, live local/world/chunk coordinate readout, and validation/repair diagnostics.

## Verification

`npm run verify:building-programs` compiles every source file in `public/riftcity-buildings`, runs the generated canonical document through the real Rift city-block compiler, and verifies committed generated block/report files are not stale.
