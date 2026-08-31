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

ok(api.rift_core_version?.() === 1, 'core version export mismatch');
ok(api.rift_section_index?.(0, 0, 0) === 0, 'section index origin mismatch');
ok(api.rift_section_index?.(15, 15, 15) === 4095, 'section index max-cell mismatch');
ok(api.rift_section_index?.(16, 0, 0) === -1, 'section index out-of-bounds guard mismatch');
ok(api.rift_floor_div?.(-1, 16) === -1, 'negative floor division mismatch');
ok(api.rift_floor_div?.(-16, 16) === -1, 'exact negative floor division mismatch');
ok(api.rift_floor_div?.(-17, 16) === -2, 'cross-section negative floor division mismatch');
ok(api.rift_positive_mod?.(-1, 16) === 15, 'positive modulo mismatch');
ok(api.rift_aabb_intersects?.(0,0,0,1,1,1,.5,.5,.5,1.5,1.5,1.5) === 1, 'AABB overlap mismatch');
ok(api.rift_aabb_intersects?.(0,0,0,1,1,1,1,0,0,2,1,1) === 0, 'AABB touching-face mismatch');
ok(Math.abs(api.rift_distance_sq3?.(0,0,0,3,4,0) - 25) < 1e-6, 'distance squared mismatch');
const hashA = api.rift_hash3?.(12, -4, 99, 1337) >>> 0;
const hashB = api.rift_hash3?.(12, -4, 99, 1337) >>> 0;
ok(hashA === hashB && hashA !== 0, 'deterministic hash mismatch');

if (failures.length) {
  console.error('[rift-wasm-core] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`[rift-wasm-core] PASS · ${bytes.length} bytes · C++ core v${api.rift_core_version()} · deterministic section/physics math verified.`);
