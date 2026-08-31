import fs from 'node:fs';

const required = [
  'native/include/rift/terrain.hpp',
  'native/src/terrain.cpp',
  'public/rift-core.js',
  'public/rift-core.wasm'
];
for (const path of required) {
  if (!fs.existsSync(path)) throw new Error(`Missing native RiftCore artifact: ${path}`);
}
const wasm = fs.readFileSync('public/rift-core.wasm');
if (wasm.length < 8 || wasm[0] !== 0x00 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6d) {
  throw new Error('public/rift-core.wasm is not a valid WebAssembly module.');
}
const module = await WebAssembly.compile(wasm);
const exports = WebAssembly.Module.exports(module).map(entry => entry.name);
for (const name of [
  'memory',
  'rift_core_version',
  'rift_terrain_init',
  'rift_terrain_sample_height',
  'rift_terrain_apply_brush',
  'rift_terrain_build_chunk',
  'rift_terrain_raycast'
]) {
  if (!exports.includes(name)) throw new Error(`RiftCore WASM missing export ${name}`);
}
console.log(`RiftCore WASM verified (${wasm.length} bytes, ABI exports present).`);
