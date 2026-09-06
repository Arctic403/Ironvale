import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const compressed = fs.readFileSync('public/rift-core.wasm.gz');
const wasm = gunzipSync(compressed);
const { instance } = await WebAssembly.instantiate(wasm, {});
const e = instance.exports;

for (const name of ['rift_terrain_init','rift_terrain_generate_island','rift_terrain_sample_height','rift_terrain_apply_brush','rift_terrain_rebuild_from_delta','rift_terrain_build_section']) {
  if (typeof e[name] !== 'function') throw new Error(`island-v1 missing native export ${name}`);
}
if (e.rift_terrain_init(641, 641, 1, 0, 0, 0, 0.82) !== 1) throw new Error('island-v1 terrain init failed');

const generate = seed => {
  if (e.rift_terrain_generate_island(seed, 0, 30, 13, 12, 18, 0.85) !== 1) throw new Error(`island-v1 generation failed for seed ${seed}`);
  const count = e.rift_terrain_sample_count();
  const view = new Float32Array(e.memory.buffer, e.rift_terrain_heights_ptr(), count);
  const bytes = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  let min = Infinity, max = -Infinity, nearWater = 0, landSamples = 0, perimeterMax = -Infinity;
  for (let i = 0; i < view.length; i += 1) {
    const value = view[i];
    if (value < min) min = value;
    if (value > max) max = value;
    if (value > -0.5 && value < 2.5) nearWater += 1;
    if (value > 0) landSamples += 1;
    const x = i % 641, z = Math.floor(i / 641);
    if (x === 0 || z === 0 || x === 640 || z === 640) perimeterMax = Math.max(perimeterMax, value);
  }
  return { sha256, min, max, nearWater, landFraction: landSamples / view.length, perimeterMax, center: e.rift_terrain_sample_height(320, 320), edge: e.rift_terrain_sample_height(2, 2) };
};

const a = generate(4032026);
const b = generate(4032026);
const c = generate(4032027);
if (a.sha256 !== b.sha256) throw new Error('same island-v1 seed did not reproduce identical height bytes');
if (a.sha256 === c.sha256) throw new Error('different island-v1 seeds produced identical terrain');
if (!(a.edge < 0)) throw new Error(`island-v1 edge must be ocean floor, got ${a.edge}`);
if (!(a.center > 5)) throw new Error(`island-v1 center must be raised land, got ${a.center}`);
if (!(a.max > 20 && a.min < -4)) throw new Error(`island-v1 relief is too weak: min=${a.min}, max=${a.max}`);
if (!(a.nearWater > 1000)) throw new Error('island-v1 did not produce a meaningful shoreline band');


for (const seed of [1, 7, 42, 403, 1337, 20260906, 0x1234567, 0x7fffffff]) {
  const sample = generate(seed);
  if (!(sample.perimeterMax < 0)) throw new Error(`island-v1 seed ${seed} touches the world boundary at ${sample.perimeterMax}`);
  if (!(sample.center > 4)) throw new Error(`island-v1 seed ${seed} lost central land: ${sample.center}`);
  if (!(sample.landFraction > 0.38 && sample.landFraction < 0.70)) throw new Error(`island-v1 seed ${seed} land coverage out of range: ${sample.landFraction}`);
}

const before = e.rift_terrain_sample_height(320, 320);
if (e.rift_terrain_apply_brush(0, 320, 320, 8, 1, 0) !== 1) throw new Error('manual sculpt failed on generated terrain');
const raised = e.rift_terrain_sample_height(320, 320);
if (!(raised > before)) throw new Error('manual sculpt did not modify generated terrain');
e.rift_terrain_rebuild_from_delta();
const rebuilt = e.rift_terrain_sample_height(320, 320);
if (Math.abs(rebuilt - raised) > 0.0001) throw new Error('generated base was lost when rebuilding manual delta');
if (e.rift_terrain_build_section(0, 0, 64, 2, 2, 2, 2, 2) !== 1 || e.rift_mesh_index_count() <= 0) throw new Error('generated island section mesh failed');

console.log(`island-v1 verified: deterministic seed ${a.sha256.slice(0,12)} · height ${a.min.toFixed(2)}..${a.max.toFixed(2)}m · center ${a.center.toFixed(2)}m · shoreline samples ${a.nearWater}`);
