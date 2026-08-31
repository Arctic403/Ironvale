# RiftCity Blueprint JSON authoring system

RiftCity Blueprint JSON is the high-level authoring layer above the existing RiftSection/full/slab/stair renderer pipeline. It does not replace RiftBlocks. A version 2 `riftcity-city-block` document expands Blueprint objects into the same compact block operations the existing importer already understands.

## Core document shape

Use `format: "riftcity-city-block"`, `version: 2`, and `blueprint_version: 1`. Keep the normal meter grid, palette, origin and bounds. Add `prefabs`, `layout`, optional named `anchors`, optional `groups`, optional `connections`, and optional `validation`.

## Prefabs

A prefab has declared local `bounds`, optional block `ops`, optional named `anchors`, tags/group metadata, and optional nested `instances`. Nested instances let a larger reusable prefab be composed from smaller reusable pieces.

Nested object ids are namespaced. For example, a root instance `block-a` containing `shop-west`, which contains `stoop`, exposes the nested object as `block-a/shop-west/stoop` and an anchor named `door` as `block-a/shop-west/stoop.door`.

Prefab recursion is capped and cycles such as `A -> B -> A` are rejected before import.

## Placement and rotation

Instances use `origin: [x,y,z]` and `rotation: north|east|south|west` (90-degree increments also work). Coordinates inside a prefab remain local to that prefab. Parent and child rotations compose automatically.

Stair palette states rotate with the accumulated prefab rotation, so reusable entrances/stairs do not need four separate prefab definitions.

## Anchors, groups and connections

Prefab anchors rotate and move with their instance. Top-level anchors stay in document-local coordinates. Optional `groups` can explicitly name object/anchor members; bad member references are rejected.

`connections` link two named anchors. A connection can set `tolerance` in meters and `require_opposite_facing: true`. Missing anchors, excessive gaps and bad facing pairs are validation errors.

## Roads and intersections

Road and intersection layout objects remain first-class Blueprint objects. Roads support surface state, width, optional sidewalk width/state and optional curb width/state. Intersections support rectangular sizes plus the same sidewalk/curb vocabulary.

Transport objects intentionally default to overlap-permitted placement so a road can meet an intersection without being treated as a building collision.

## Cell-accurate validation

Validation expands Blueprint-generated operations and evaluates the actual affected 1m cells. It does not rely only on prefab bounding boxes.

- different root instances writing different states into the same cell are conflicts;
- same-state overlaps are recorded separately;
- road/intersection overlaps are treated as transport overlaps;
- `allow_overlap: true` can explicitly permit a placement;
- nested pieces inside the same root prefab composition are treated as one authored assembly;
- out-of-bounds placements, unknown prefabs, cycles, bad groups and bad anchor connections are rejected.

`validation.overlap_policy` supports `error`, `warn`, or `allow`. The default is `error`. `max_validation_cells` can lower the validation budget, but cannot exceed the engine safety cap.

## Renderer compatibility

After expansion, Blueprint ops still pass through `compileRiftCityBlock()`, `RiftSectionGrid`, encoded RiftBlock states and the existing full/slab/stair mesh builder. Blueprint is an authoring/compiler layer, not a second renderer.

See `public/rift-world-blocks/blueprint-example-downtown-cross.json` for a working nested-prefab, road, curb, group and anchor-connection example.
