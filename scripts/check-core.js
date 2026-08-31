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
if (!Array.isArray(world.terrain?.layers) || world.terrain.layers.length !== 0) failures.push('generated terrain layers still present');
if (!Array.isArray(world.terrain?.caves) || world.terrain.caves.length !== 0) failures.push('generated caves still present');
if (!Array.isArray(world.objects) || world.objects.length !== 0) failures.push('generated world objects still present');
const worker = fs.readFileSync('src/index.js', 'utf8').toLowerCase();
const forbiddenPatterns = [[/\bcombat\b/,'combat'],[/\binventory\b/,'inventory'],[/\bquest(s|_progress)?\b/,'quest'],[/ai-builder/,'ai-builder'],[/block_layout/,'block_layout'],[/riftblock/,'riftblock']];
for (const [pattern,label] of forbiddenPatterns) if (pattern.test(worker)) failures.push(`worker contains ${label}`);
if (failures.length) { console.error('Ironvale core verification failed:', failures.join(', ')); process.exit(1); }
console.log('Ironvale core verified: blank terrain editor + auth/session/character only.');
