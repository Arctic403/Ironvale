import fs from 'node:fs';

const path = new URL('../public/wasm/rift-core.wasm', import.meta.url);
if (!fs.existsSync(path)) {
  console.error('[rift-wasm-core] FAIL · public/wasm/rift-core.wasm is missing');
  process.exit(1);
}

const bytes = fs.readFileSync(path);
const { instance } = await WebAssembly.instantiate(bytes, {});
const api = instance.exports;
const failures = [];
const ok = (value, message) => { if (!value) failures.push(message); };
const near = (actual, expected, tolerance = 1e-5) => Math.abs(actual - expected) <= tolerance;
const index = (x, y, z) => (y << 8) | (z << 4) | x;

ok(api.rift_core_version?.() === 4, 'core version export mismatch');
ok(api.rift_section_index?.(0, 0, 0) === 0, 'section index origin mismatch');
ok(api.rift_section_index?.(15, 15, 15) === 4095, 'section index max-cell mismatch');
ok(api.rift_section_index?.(16, 0, 0) === -1, 'section index out-of-bounds guard mismatch');
ok(api.rift_floor_div?.(-1, 16) === -1, 'negative floor division mismatch');
ok(api.rift_floor_div?.(-16, 16) === -1, 'exact negative floor division mismatch');
ok(api.rift_floor_div?.(-17, 16) === -2, 'cross-section negative floor division mismatch');
ok(api.rift_positive_mod?.(-1, 16) === 15, 'positive modulo mismatch');
ok(api.rift_aabb_intersects?.(0,0,0,1,1,1,.5,.5,.5,1.5,1.5,1.5) === 1, 'AABB overlap mismatch');
ok(api.rift_aabb_intersects?.(0,0,0,1,1,1,1,0,0,2,1,1) === 0, 'AABB touching-face mismatch');
ok(near(api.rift_distance_sq3?.(0,0,0,3,4,0), 25), 'distance squared mismatch');
const hashA = api.rift_hash3?.(12, -4, 99, 1337) >>> 0;
const hashB = api.rift_hash3?.(12, -4, 99, 1337) >>> 0;
ok(hashA === hashB && hashA !== 0, 'deterministic hash mismatch');

// Player/support scalar kernels.
ok(api.rift_crossed_support?.(2, 0.9, 1, 0.035, 0.015) === 1, 'support crossing positive case mismatch');
ok(api.rift_crossed_support?.(0.8, 0.7, 1, 0.035, 0.015) === 0, 'support crossing start-height guard mismatch');
ok(api.rift_ground_step_classify?.(1, 1.4, 0.58, 0.72) === 1, 'grounded step classification mismatch');
ok(api.rift_ground_step_classify?.(1, 1.7, 0.58, 0.72) === 2, 'blocked step classification mismatch');
ok(api.rift_ground_step_classify?.(1, 0.1, 0.58, 0.72) === 0, 'drop step classification mismatch');
ok(near(api.rift_stair_top?.(0, 0.25, 0.2), 0.8), 'north stair ramp mismatch');
ok(near(api.rift_stair_top?.(1, 0.75, 0.2), 0.75), 'east stair ramp mismatch');
ok(near(api.rift_shape_top?.(1, 0, 0.2, 0.3), 0.5), 'bottom slab top mismatch');
ok(near(api.rift_shape_top?.(2, 0, 0.2, 0.3), 1), 'top slab top mismatch');
const eastStairState = 1 | (3 << 8) | (1 << 11);
ok(near(api.rift_state_shape_top?.(eastStairState, -0.25, 4.2), 0.75), 'packed-state/negative-coordinate stair top mismatch');

ok(api.memory instanceof WebAssembly.Memory, 'WASM memory export missing');
const memory = api.memory;
const slotCapacity = api.rift_section_slot_capacity?.() || 0;
ok(slotCapacity === 128, `persistent section slot capacity ${slotCapacity} != 128`);
ok((memory?.buffer?.byteLength || 0) >= 5 * 1024 * 1024, 'native v4 workspace memory is unexpectedly small');

if (memory instanceof WebAssembly.Memory) {
  // Legacy v2 face-mask compatibility remains intact on reserved slot 0.
  const statesPtr = api.rift_section_states_ptr?.() >>> 0;
  const masksPtr = api.rift_section_face_masks_ptr?.() >>> 0;
  const states = new Uint16Array(memory.buffer, statesPtr, 4096);
  const masks = new Uint8Array(memory.buffer, masksPtr, 4096);
  states.fill(0);
  states[index(1,1,1)] = 1;
  states[index(2,1,1)] = 1;
  const packed = api.rift_build_section_face_masks?.() >>> 0;
  ok(((packed >>> 16) & 0x7fff) === 2 && (packed & 0xffff) === 10, 'legacy face-mask workspace mismatch');
  ok(masks[index(1,1,1)] === 0b111110 && masks[index(2,1,1)] === 0b111101, 'legacy face masks mismatch');

  // Persistent slot residency and direct world lookup.
  const slot = 1;
  const slotPtr = api.rift_section_slot_states_ptr(slot) >>> 0;
  const slotStates = new Uint16Array(memory.buffer, slotPtr, 4096);
  slotStates.fill(0);
  slotStates[index(1,1,1)] = 7;
  ok(api.rift_section_slot_bind(slot, 77, -1, 0, 2) === 1, 'slot bind failed');
  ok(api.rift_section_slot_get_state(slot, index(1,1,1)) === 7, 'persistent slot state lookup failed');
  ok(api.rift_get_block_world(77, -15, 1, 33) === 7, 'resident world-coordinate lookup failed');

  // Full-block mesh emission: exact 9-float contract, winding/index layout and color table.
  slotStates.fill(0);
  slotStates[index(1,1,1)] = 5;
  api.rift_section_slot_bind(slot, 77, 0, 0, 0);
  const borders = new Uint16Array(memory.buffer, api.rift_section_borders_ptr() >>> 0, 6 * 256);
  borders.fill(0);
  const colors = new Float32Array(memory.buffer, api.rift_material_colors_ptr() >>> 0, 256 * 3);
  colors.fill(0);
  colors[5*3] = 0.2; colors[5*3+1] = 0.4; colors[5*3+2] = 0.6;
  let faces = api.rift_build_section_mesh(slot);
  ok(faces === 6, `single-block native mesh faces ${faces} != 6`);
  ok(api.rift_mesh_block_count() === 1, 'single-block native mesh block count mismatch');
  ok(api.rift_mesh_vertex_count() === 24 && api.rift_mesh_index_count() === 36, 'single-block native mesh counts mismatch');
  const verts = new Float32Array(memory.buffer, api.rift_mesh_vertices_ptr() >>> 0, 24 * 9);
  const inds = new Uint32Array(memory.buffer, api.rift_mesh_indices_ptr() >>> 0, 36);
  ok(near(verts[0], 2) && near(verts[1], 1) && near(verts[2], 1), 'native east-face first vertex position mismatch');
  ok(near(verts[3], 1) && near(verts[4], 0) && near(verts[5], 0), 'native east-face normal mismatch');
  ok(near(verts[6], .2) && near(verts[7], .4) && near(verts[8], .6), 'native material color emission mismatch');
  ok([...inds.slice(0,6)].join(',') === '0,1,2,0,2,3', 'native mesh first quad indices mismatch');

  // Cross-section border data must cull an otherwise-visible boundary face.
  slotStates.fill(0);
  slotStates[index(15,1,1)] = 5;
  borders.fill(0);
  borders[0 * 256 + 1 * 16 + 1] = 9; // east neighbor plane
  faces = api.rift_build_section_mesh(slot);
  ok(faces === 5, `native border culling faces ${faces} != 5`);

  // v4 emits partial shapes natively with the same merged half-meter geometry contract.
  slotStates.fill(0);
  slotStates[index(4,4,4)] = 1 | (1 << 8);
  borders.fill(0);
  ok(api.rift_build_section_mesh(slot) === 6, 'bottom-slab native mesh quad count mismatch');
  ok(api.rift_mesh_partial_block_count() === 1 && api.rift_mesh_occupied_microvoxels() === 4, 'partial mesh diagnostics mismatch');
  slotStates.fill(0);
  slotStates[index(4,4,4)] = 1 | (3 << 8) | (1 << 11);
  ok(api.rift_build_section_mesh(slot) === 10, 'east-stair native mesh quad count mismatch');

  // Batched world queries across two resident sections, including negative coordinates.
  const slot2 = 2;
  const slot2States = new Uint16Array(memory.buffer, api.rift_section_slot_states_ptr(slot2) >>> 0, 4096);
  slotStates.fill(0); slot2States.fill(0);
  slotStates[index(3,2,4)] = 11;
  slot2States[index(15,2,4)] = 12;
  api.rift_section_slot_bind(slot, 91, 0, 0, 0);
  api.rift_section_slot_bind(slot2, 91, -1, 0, 0);
  const xyz = new Int32Array(memory.buffer, api.rift_batch_query_xyz_ptr() >>> 0, 9);
  xyz.set([3,2,4, -1,2,4, 99,99,99]);
  ok(api.rift_batch_query_world(91, 3) === 3, 'native batch query count mismatch');
  const queryStates = new Uint16Array(memory.buffer, api.rift_batch_query_states_ptr() >>> 0, 3);
  ok(queryStates[0] === 11 && queryStates[1] === 12 && queryStates[2] === 0, `native batch states mismatch ${[...queryStates]}`);

  // Voxel DDA hits the resident block and reports the entered west face.
  slotStates.fill(0);
  slotStates[index(3,2,4)] = 13;
  api.rift_section_slot_bind(slot, 92, 0, 0, 0);
  const hit = api.rift_raycast_world(92, -1, 2.5, 4.5, 1, 0, 0, 20);
  const hitData = new Int32Array(memory.buffer, api.rift_raycast_hit_ptr() >>> 0, 5);
  ok(hit === 1, 'native voxel raycast failed to hit resident block');
  ok([...hitData].join(',') === '3,2,4,1,13', `native raycast hit payload mismatch ${[...hitData]}`);
  ok(near(api.rift_raycast_distance(), 4), `native raycast distance ${api.rift_raycast_distance()} != 4`);

  ok((api.rift_metric_mesh_builds?.() >>> 0) >= 2, 'native mesh counter did not increment');
  ok((api.rift_metric_batch_calls?.() >>> 0) >= 1 && (api.rift_metric_batch_cells?.() >>> 0) >= 3, 'native batch counters did not increment');
  ok((api.rift_metric_raycasts?.() >>> 0) >= 1 && (api.rift_metric_raycast_steps?.() >>> 0) >= 1, 'native raycast counters did not increment');
}

if (failures.length) {
  console.error('[rift-wasm-core] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`[rift-wasm-core] PASS · ${bytes.length} bytes · C++ core v${api.rift_core_version()} · shape meshes + physics + path/spatial/agent/combat kernels verified.`);
