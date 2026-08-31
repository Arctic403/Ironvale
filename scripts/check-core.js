import fs from 'node:fs';

const forbidden = [
  'public/wasm','src/wasm','public/builder','public/editor','public/rift-world-blocks',
  'public/rift-block-world.js','public/rift-block-section.js','public/rift-block-shapes.js',
  'public/rift-city-block-importer.js','public/rift-city-blueprints.js','public/rift-world-editor.js',
  'public/rift-ai-builder.js','src/ai-builder-mcp.js'
];
const failures = forbidden.filter(path => fs.existsSync(path));

const nativeRequired = ['native/include/rift/terrain.hpp','native/src/terrain.cpp','public/rift-core.js','public/rift-core.wasm'];
for (const path of nativeRequired) if (!fs.existsSync(path)) failures.push(`missing ${path}`);

const world = JSON.parse(fs.readFileSync('public/world/ironvale-terrain.json', 'utf8'));
if (world.format !== 'rift-world-v1') failures.push('world format');
if (world.terrain?.format !== 'rift-terrain-v1') failures.push('terrain format');
if (world.metadata?.legacyBlocks !== false || world.metadata?.voxelGrid !== false) failures.push('terrain metadata');
if (world.metadata?.blankCanvas !== true) failures.push('terrain must boot as blank canvas');
if (world.metadata?.negativeWorldY !== true || world.metadata?.lowerBarrier !== false) failures.push('negative Y/lower barrier contract');
if (world.terrain?.size?.[0] !== 640 || world.terrain?.size?.[1] !== 640) failures.push('terrain must be 640x640');
if (world.terrain?.sampleSpacing !== 1) failures.push('terrain editing must retain 1m samples');
if (world.terrain?.chunkSize !== 64) failures.push('terrain render chunk size must be 64m');
if (!Array.isArray(world.terrain?.layers) || world.terrain.layers.length !== 0) failures.push('generated terrain layers still present');
if (!Array.isArray(world.terrain?.caves) || world.terrain.caves.length !== 0) failures.push('generated caves still present');
if (!Array.isArray(world.objects) || world.objects.length !== 0) failures.push('generated world objects still present');

const app = fs.readFileSync('public/app.js', 'utf8');
if (!/TERRAIN_RENDER_LOD\s*=\s*2/.test(app)) failures.push('mobile terrain LOD 2');
if (!app.includes('function setFreecam(')) failures.push('freecam mode');
if (!app.includes('function updateReticleTarget(')) failures.push('reticle targeting');
if (!app.includes('function applyReticleBrush(')) failures.push('reticle sculpt action');
if (/player\.y\s*<\s*-\d+/.test(app)) failures.push('client lower/death barrier still present');

const terrain = fs.readFileSync('public/rift-terrain.js', 'utf8');
if (!terrain.includes("import { RiftCore } from './rift-core.js'")) failures.push('terrain is not backed by RiftCore WASM');
if (!terrain.includes('NATIVE.rift_terrain_apply_brush')) failures.push('terrain brush not native');
if (!terrain.includes('NATIVE.rift_terrain_build_chunk')) failures.push('terrain meshing not native');
if (!terrain.includes('NATIVE.rift_terrain_sample_height')) failures.push('terrain sampling not native');
if (!terrain.includes('NATIVE.rift_terrain_raycast')) failures.push('native terrain raycast missing');

const worker = fs.readFileSync('src/index.js', 'utf8');
const workerLower = worker.toLowerCase();
const forbiddenPatterns = [[/\bcombat\b/,'combat'],[/\binventory\b/,'inventory'],[/\bquest(s|_progress)?\b/,'quest'],[/ai-builder/,'ai-builder'],[/block_layout/,'block_layout'],[/riftblock/,'riftblock']];
for (const [pattern,label] of forbiddenPatterns) if (pattern.test(workerLower)) failures.push(`worker contains ${label}`);
if (!worker.includes('WORLD_MAX_X = 640') || !worker.includes('WORLD_MAX_Z = 640')) failures.push('backend terrain bounds');
if (!worker.includes('negative world space is valid')) failures.push('backend negative Y contract');
if (/y\s*<\s*-\d+/.test(worker)) failures.push('backend lower Y barrier still present');

if (failures.length) {
  console.error('Ironvale core verification failed:', failures.join(', '));
  process.exit(1);
}
console.log('Ironvale core verified: C++/WASM terrain core + WebGL/browser shell + 640m blank world + thin auth/character backend.');
