import fs from 'node:fs';

const forbidden = [
  'native','public/wasm','src/wasm','public/builder','public/editor','public/rift-world-blocks',
  'public/rift-block-world.js','public/rift-block-section.js','public/rift-block-shapes.js',
  'public/rift-city-block-importer.js','public/rift-city-blueprints.js','public/rift-world-editor.js',
  'public/rift-ai-builder.js','src/ai-builder-mcp.js'
];
const failures = forbidden.filter(path => fs.existsSync(path));

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
if (!app.includes('TERRAIN_RENDER_LOD=2')) failures.push('mobile terrain LOD 2');
if (!app.includes('function setFreecam(')) failures.push('freecam mode');
if (!app.includes('function updateReticleTarget(')) failures.push('reticle targeting');
if (!app.includes('function applyReticleBrush(')) failures.push('reticle sculpt action');
if (/player\.y\s*<\s*-\d+/.test(app)) failures.push('client lower/death barrier still present');

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
console.log('Ironvale core verified: 640m blank terrain + freecam reticle editor + unrestricted negative Y + auth/session/character only.');
