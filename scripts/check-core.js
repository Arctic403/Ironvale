import fs from 'node:fs';

const forbidden = [
  'public/wasm','src/wasm','public/builder','public/editor','public/rift-world-blocks',
  'public/rift-block-world.js','public/rift-block-section.js','public/rift-block-shapes.js',
  'public/rift-city-block-importer.js','public/rift-city-blueprints.js','public/rift-world-editor.js',
  'public/rift-ai-builder.js','src/ai-builder-mcp.js'
];
const failures = forbidden.filter(path => fs.existsSync(path));

const nativeRequired = ['native/include/rift/terrain.hpp','native/src/terrain.cpp','public/rift-core.js','public/rift-core.wasm.gz'];
for (const path of nativeRequired) if (!fs.existsSync(path)) failures.push(`missing ${path}`);

const characterRequired = ['public/rift-character.js','public/assets/characters/quaternius/universal-base-male.glb','public/assets/characters/quaternius/universal-animation-library.glb','public/assets/characters/quaternius/LICENSE-BASE-CHARACTERS.txt','public/assets/characters/quaternius/LICENSE-ANIMATIONS.txt'];
for (const path of characterRequired) if (!fs.existsSync(path)) failures.push(`missing ${path}`);
if (fs.existsSync('public/assets/characters/quaternius/universal-base-male.glb') && fs.statSync('public/assets/characters/quaternius/universal-base-male.glb').size !== 6465208) failures.push('rigged character asset size');
if (fs.existsSync('public/assets/characters/quaternius/universal-animation-library.glb') && fs.statSync('public/assets/characters/quaternius/universal-animation-library.glb').size !== 2714756) failures.push('character animation asset size');
if (fs.existsSync('public/assets/characters/quaternius/LICENSE-BASE-CHARACTERS.txt') && !fs.readFileSync('public/assets/characters/quaternius/LICENSE-BASE-CHARACTERS.txt','utf8').includes('CC0 1.0')) failures.push('character CC0 license');

const world = JSON.parse(fs.readFileSync('public/world/ironvale-terrain.json', 'utf8'));
if (world.format !== 'rift-world-v1') failures.push('world format');
if (world.terrain?.format !== 'rift-terrain-v1') failures.push('terrain format');
if (world.metadata?.legacyBlocks !== false || world.metadata?.voxelGrid !== false) failures.push('terrain metadata');
if (world.metadata?.blankCanvas !== true) failures.push('terrain must boot as blank canvas');
if (world.metadata?.negativeWorldY !== true || world.metadata?.lowerBarrier !== false) failures.push('negative Y/lower barrier contract');
if (world.terrain?.size?.[0] !== 640 || world.terrain?.size?.[1] !== 640) failures.push('terrain must be 640x640');
if (world.terrain?.sampleSpacing !== 1) failures.push('terrain editing must retain 1m samples');
if (world.terrain?.chunkSize !== 64 || world.terrain?.sectionSize !== 64) failures.push('terrain sections must be 64m');
if (world.terrain?.componentSize !== 128) failures.push('terrain components must be 128m');
if (JSON.stringify(world.terrain?.lod?.steps) !== JSON.stringify([1,2,4,8,16])) failures.push('adaptive terrain LOD steps');
if (world.terrain?.lod?.neighborMaxLevelDelta !== 1 || world.terrain?.lod?.seamMode !== 'edge-morph') failures.push('terrain LOD seam contract');
if (!Array.isArray(world.terrain?.layers) || world.terrain.layers.length !== 0) failures.push('generated terrain layers still present');
if (!Array.isArray(world.terrain?.caves) || world.terrain.caves.length !== 0) failures.push('generated caves still present');
if (!Array.isArray(world.objects) || world.objects.length !== 0) failures.push('generated world objects still present');

const app = fs.readFileSync('public/app.js', 'utf8');
if (!app.includes('function updateTerrainLod(') || !app.includes('terrain.planSectionLods(')) failures.push('adaptive terrain LOD controller');
if (!app.includes('function rebuildDirtyTerrainSections(')) failures.push('dirty terrain section rebuilds');
if (!app.includes('function setFreecam(')) failures.push('freecam mode');
if (!app.includes('function updateReticleTarget(')) failures.push('reticle targeting');
if (!app.includes('function applyBrushAtReticle(')) failures.push('reticle sculpt action');
if (!app.includes('function applyCameraLookDelta(') || !app.includes('function cameraForward(') || !app.includes('function cameraAnglesFromDirection(')) failures.push('shared camera math');
if (!app.includes("import { loadRiggedCharacterAsset } from './rift-character.js'") || !app.includes('function installRiggedPlayerVisual(') || !app.includes('function updatePlayerVisualTransform(') || !app.includes('function updatePlayerCharacterAnimation(')) failures.push('animated textured humanoid controller hookup');
if (!app.includes('createCapsuleGeometry()')) failures.push('character visual fallback');
if (!app.includes('const THIRD_PERSON_FOCUS_HEIGHT = 1.20') || !app.includes('player.y + THIRD_PERSON_FOCUS_HEIGHT')) failures.push('third-person RPG focus');
if (!app.includes('function currentViewRay(') || !app.includes('terrain.raycast(ray.origin, ray.direction, 1800, .5)')) failures.push('center-view interaction ray');
if (app.includes('reticleScreen') || app.includes('moveReticleToClient(') || app.includes('raycastTerrainAtScreen(')) failures.push('movable pointer reticle returned');
if (!app.includes('reticle.hidden = false;')) failures.push('world reticle is not persistent');
if (/orbitCamera\.yaw\s*[-+]=\s*dx\s*\*\s*\.005/.test(app) || /freecam\.yaw\s*[-+]=\s*dx\s*\*\s*\.005/.test(app)) failures.push('fixed-pixel camera yaw math returned');
if (/orbitCamera\.pitch\s*=\s*clamp\([^\n]*dy\s*\*\s*\.004/.test(app) || /freecam\.pitch\s*=\s*clamp\([^\n]*dy\s*\*\s*\.004/.test(app)) failures.push('fixed-pixel camera pitch math returned');
if (/player\.y\s*<\s*-\d+/.test(app)) failures.push('client lower/death barrier still present');

const characterRuntime = fs.readFileSync('public/rift-character.js', 'utf8');
if (!characterRuntime.includes('loadRiggedCharacterAsset(') || !characterRuntime.includes('buildAnimationClips(') || !characterRuntime.includes('baseColorImage') || !characterRuntime.includes('getSkinMatrices(')) failures.push('character texture/animation runtime');
const renderer = fs.readFileSync('public/rift-engine.js', 'utf8');
if (!renderer.includes('uJointMatrices') || !renderer.includes('uBaseColorTexture') || !renderer.includes('createSkin(') || !renderer.includes('createTexture(')) failures.push('GPU character skinning/texturing');

const terrain = fs.readFileSync('public/rift-terrain.js', 'utf8');
if (!terrain.includes("import { RiftCore } from './rift-core.js'")) failures.push('terrain is not backed by RiftCore WASM');
if (!terrain.includes('NATIVE.rift_terrain_apply_brush')) failures.push('terrain brush not native');
if (!terrain.includes('NATIVE.rift_terrain_build_section')) failures.push('section meshing/stitching not native');
if (!terrain.includes('planSectionLods(')) failures.push('terrain LOD planner missing');
if (!terrain.includes('markDirtyRegion(')) failures.push('terrain dirty region tracking missing');
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
console.log('Ironvale core verified: textured animated humanoid + centered-reticle RPG camera + adaptive stitched terrain LOD + C++/WASM terrain core.');
