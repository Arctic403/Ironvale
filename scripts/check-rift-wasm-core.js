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

ok(api.rift_core_version?.() === 2, 'core version export mismatch');
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

// Native section workspace + full-block face culling.
ok(api.memory instanceof WebAssembly.Memory, 'WASM memory export missing');
const statesPtr = api.rift_section_states_ptr?.() >>> 0;
const masksPtr = api.rift_section_face_masks_ptr?.() >>> 0;
ok(Number.isInteger(statesPtr) && statesPtr >= 0, 'section state pointer missing');
ok(Number.isInteger(masksPtr) && masksPtr >= 0, 'section face-mask pointer missing');

if (api.memory instanceof WebAssembly.Memory && Number.isInteger(statesPtr) && Number.isInteger(masksPtr)) {
  const states = () => new Uint16Array(api.memory.buffer, statesPtr, 4096);
  const masks = () => new Uint8Array(api.memory.buffer, masksPtr, 4096);
  const index = (x, y, z) => (y << 8) | (z << 4) | x;
  const unpack = packed => ({
    partial: Boolean((packed >>> 31) & 1),
    blocks: (packed >>> 16) & 0x7fff,
    faces: packed & 0xffff
  });

  states().fill(0);
  states()[index(1, 1, 1)] = 1;
  let result = unpack(api.rift_build_section_face_masks?.() >>> 0);
  ok(!result.partial && result.blocks === 1 && result.faces === 6, `single-block section summary mismatch ${JSON.stringify(result)}`);
  ok(masks()[index(1, 1, 1)] === 0b111111, 'single-block face mask mismatch');

  states().fill(0);
  states()[index(1, 1, 1)] = 1;
  states()[index(2, 1, 1)] = 1;
  result = unpack(api.rift_build_section_face_masks?.() >>> 0);
  ok(!result.partial && result.blocks === 2 && result.faces === 10, `adjacent-block section summary mismatch ${JSON.stringify(result)}`);
  ok(masks()[index(1, 1, 1)] === 0b111110, 'adjacent west block face mask mismatch');
  ok(masks()[index(2, 1, 1)] === 0b111101, 'adjacent east block face mask mismatch');

  states().fill(1);
  result = unpack(api.rift_build_section_face_masks?.() >>> 0);
  ok(!result.partial && result.blocks === 4096 && result.faces === 1536, `dense section summary mismatch ${JSON.stringify(result)}`);
  ok(masks()[index(1, 1, 1)] === 0, 'dense section interior face mask mismatch');
  ok(masks()[index(0, 0, 0)] === 0b101010, 'dense section boundary-corner face mask mismatch');

  states().fill(0);
  states()[index(4, 4, 4)] = 1 | (1 << 8);
  result = unpack(api.rift_build_section_face_masks?.() >>> 0);
  ok(result.partial && result.blocks === 1 && result.faces === 0, `partial-shape section guard mismatch ${JSON.stringify(result)}`);
}

if (failures.length) {
  console.error('[rift-wasm-core] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`[rift-wasm-core] PASS · ${bytes.length} bytes · C++ core v${api.rift_core_version()} · section culling + world/physics kernels verified.`);
