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
if (world.terrain?.landscape?.format !== 'rift-landscape-v2') failures.push('RiftLandscape v2 config');
if (!Array.isArray(world.terrain?.landscape?.editLayers) || world.terrain.landscape.editLayers[0]?.id !== 'sculpt') failures.push('landscape edit layers');
if (!Array.isArray(world.terrain?.landscape?.materialLayers) || world.terrain.landscape.materialLayers.length < 4) failures.push('landscape material weight layers');
if (!(Number(world.terrain?.landscape?.lodHysteresis) > 0)) failures.push('landscape LOD hysteresis');
if (!Array.isArray(world.terrain?.layers) || world.terrain.layers.length !== 0) failures.push('generated terrain layers still present');
if (!Array.isArray(world.terrain?.caves) || world.terrain.caves.length !== 0) failures.push('generated caves still present');
if (!Array.isArray(world.objects) || world.objects.length !== 0) failures.push('generated world objects still present');

const app = fs.readFileSync('public/app.js', 'utf8');
if (!app.includes('function updateTerrainLod(') || !app.includes('terrain.planSectionLods(')) failures.push('adaptive terrain LOD controller');
if (!app.includes("import { RiftLandscape } from './rift-landscape.js?v=") || !app.includes('new RiftLandscape(worldDocument.terrain)')) failures.push('RiftLandscape runtime integration');
if (!app.includes("ironvale:terrain:draft:v3") || !app.includes('serializeLandscapeEdits') || !app.includes('captureEditState')) failures.push('layer-aware terrain persistence/undo');
if (!app.includes('refreshTerrainLayerControls') || !app.includes("$('#terrain-edit-layer')")) failures.push('terrain edit layer controls');
if (!app.includes('function rebuildDirtyTerrainSections(')) failures.push('dirty terrain section rebuilds');
if (!app.includes('function setFreecam(')) failures.push('freecam mode');
if (!app.includes('function updateReticleTarget(')) failures.push('reticle targeting');
if (!app.includes('function applyBrushAtReticle(')) failures.push('reticle sculpt action');
if (!app.includes('function applyCameraLookDelta(') || !app.includes('function cameraForward(') || !app.includes('function cameraAnglesFromDirection(')) failures.push('shared camera math');
if (!/import \{ loadRiggedCharacterAsset \} from '\.\/rift-character\.js\?v=/.test(app) || !app.includes('function installRiggedPlayerVisual(') || !app.includes('function updatePlayerVisualTransform(') || !app.includes('function updatePlayerCharacterAnimation(')) failures.push('animated textured humanoid controller hookup');
if (!app.includes('createCapsuleGeometry()')) failures.push('character visual fallback');
if (!app.includes('const CHARACTER_MODEL_URL = new URL(') || !app.includes('const CHARACTER_ANIMATION_URL = new URL(')) failures.push('versioned character asset URLs');
if (!app.includes('if (next && preserveCamera && !freecamEnabled) updateOrbitCamera();') || !app.includes('// Make the mode switch atomic: camera, center ray and reticle all agree immediately.')) failures.push('freecam atomic camera refresh');
if (!app.includes('character fallback: ${characterError}')) failures.push('visible character fallback diagnostics');
if (!app.includes('const THIRD_PERSON_FOCUS_HEIGHT = 1.20') || !app.includes('player.y + THIRD_PERSON_FOCUS_HEIGHT')) failures.push('third-person RPG focus');
if (!app.includes('const MOBILE_LANDSCAPE_DISTANCE = 6.2') || !app.includes('function applyViewportCameraProfile(') || !app.includes('isMobileLandscapeGameplay()')) failures.push('mobile landscape camera profile');
if (!app.includes('const ORBIT_MIN_DISTANCE = 1.0') || !app.includes('const ORBIT_MAX_DISTANCE = 10.0') || !app.includes('const orbitTouches = new Map()') || !app.includes('beginPinchZoom') || !app.includes('updatePinchZoom') || !app.includes('ORBIT_PINCH_EXPONENT')) failures.push('third-person pinch zoom');
if (!app.includes('function selectCombatTargetAtScreen(') || !app.includes('function performBasicAttack(') || !app.includes('window.IronvaleTargeting')) failures.push('tap-target RPG combat controls');
if (!app.includes('function currentViewRay(') || !app.includes('terrain.raycast(ray.origin, ray.direction, 1800, .5)')) failures.push('center-view interaction ray');
if (app.includes('reticleScreen') || app.includes('moveReticleToClient(') || app.includes('raycastTerrainAtScreen(')) failures.push('movable pointer reticle returned');
if (!app.includes('reticle.hidden = true;') || !app.includes('reticle.hidden = !freecamEnabled;')) failures.push('reticle must be Freecam-only during normal RPG gameplay');
if (/orbitCamera\.yaw\s*[-+]=\s*dx\s*\*\s*\.005/.test(app) || /freecam\.yaw\s*[-+]=\s*dx\s*\*\s*\.005/.test(app)) failures.push('fixed-pixel camera yaw math returned');
if (/orbitCamera\.pitch\s*=\s*clamp\([^\n]*dy\s*\*\s*\.004/.test(app) || /freecam\.pitch\s*=\s*clamp\([^\n]*dy\s*\*\s*\.004/.test(app)) failures.push('fixed-pixel camera pitch math returned');
if (/player\.y\s*<\s*-\d+/.test(app)) failures.push('client lower/death barrier still present');

const indexHtml = fs.readFileSync('public/index.html', 'utf8');
const styles = fs.readFileSync('public/styles.css', 'utf8');
if (!indexHtml.includes('id="combat-hud"') || !indexHtml.includes('id="rotate-device"') || !indexHtml.includes('data-ability-slot="1"')) failures.push('landscape RPG HUD markup');
if (!indexHtml.includes('id="terrain-edit-layer"') || !indexHtml.includes('id="add-terrain-edit-layer"')) failures.push('RiftLandscape edit-layer UI');
if (!styles.includes('@media (orientation:portrait) and (pointer:coarse)') || !styles.includes('.combat-hud')) failures.push('landscape-only mobile presentation');

const characterRuntime = fs.readFileSync('public/rift-character.js', 'utf8');
if (!characterRuntime.includes('loadRiggedCharacterAsset(') || !characterRuntime.includes('buildAnimationClips(') || !characterRuntime.includes('baseColorImage') || !characterRuntime.includes('getSkinMatrices(')) failures.push('character texture/animation runtime');
if (!characterRuntime.includes('DEFAULT_CHARACTER_MODEL_URL') || !characterRuntime.includes("cache: 'no-cache'")) failures.push('character cache-safe loading');
if (!characterRuntime.includes('accessor.bufferView != null') || !characterRuntime.includes('if (accessor.sparse)') || !characterRuntime.includes('sparse.indices') || !characterRuntime.includes('sparse.values')) failures.push('glTF zero-base/sparse accessor support');
const renderer = fs.readFileSync('public/rift-engine.js', 'utf8');
if (!renderer.includes('uJointMatrices') || !renderer.includes('uBaseColorTexture') || !renderer.includes('createSkin(') || !renderer.includes('createTexture(')) failures.push('GPU character skinning/texturing');

const terrain = fs.readFileSync('public/rift-terrain.js', 'utf8');
const landscape = fs.readFileSync('public/rift-landscape.js', 'utf8');
if (!landscape.includes('class RiftLandscape extends RiftTerrain') || !landscape.includes('recomposeEditLayers(') || !landscape.includes('paintMaterial(')) failures.push('RiftLandscape edit/weight architecture');
if (!landscape.includes('captureEditState(') || !landscape.includes('serializeLandscapeEdits(') || !landscape.includes('importLegacyManualEdits(')) failures.push('RiftLandscape persistence architecture');
if (!landscape.includes('planSectionLods(cameraX, cameraZ, previousPlan') || !landscape.includes('lodHysteresis')) failures.push('RiftLandscape LOD hysteresis');
if (!landscape.includes('consumeDirtyComponents(') || !landscape.includes('streamKey')) failures.push('RiftLandscape component streaming hooks');
if (!landscape.includes('setSpline(') || !landscape.includes('removeSpline(')) failures.push('RiftLandscape spline data hooks');
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
console.log('Ironvale core verified: RiftLandscape v2 edit layers + material weights + component LOD hysteresis/streaming hooks + C++/WASM terrain + mobile RPG camera/character runtime.');
