import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const replaceOnce = (text, needle, replacement, label) => {
  if (!text.includes(needle)) throw new Error(`[rift-terrain-v1] missing ${label}`);
  return text.replace(needle, replacement);
};

// World foundation: render terrain as a separate smooth layer while RiftSections
// remain the structure/object layer. Both share the same player controller.
let foundation = read('public/downtown3d-foundation.js');
foundation = replaceOnce(
  foundation,
  "import { compileRiftCityBlock, validateRiftCityBlockImporter } from './rift-city-block-importer.js';",
  "import { compileRiftCityBlock, validateRiftCityBlockImporter } from './rift-city-block-importer.js';\nimport { createRiftTerrainFromDocument } from './rift-terrain.js';",
  'terrain foundation import'
);
foundation = replaceOnce(
  foundation,
  "  let ironvaleGameplay = null;\n",
  "  let ironvaleGameplay = null;\n  let terrain = null;\n",
  'terrain runtime slot'
);
foundation = replaceOnce(
  foundation,
  "    getGrid: () => imported?.grid || null,\n    getWorldBounds: () => imported?.worldBounds || null\n",
  "    getGrid: () => imported?.grid || null,\n    getWorldBounds: () => imported?.worldBounds || null,\n    getTerrain: () => terrain\n",
  'terrain player bridge'
);
foundation = replaceOnce(
  foundation,
  "    const nextDrawables = [];\n    try {\n      for (const mesh of compiled.meshes) {",
  `    const nextTerrain = createRiftTerrainFromDocument(compiled.document);\n    const nextDrawables = [];\n    try {\n      if (nextTerrain) {\n        const terrainMeshOptions = { color: '#ffffff', noise: 0.025, blockGrid: 0, blockFaceShade: 0.15, blockElevationCue: 0, doubleSided: false };\n        for (const chunk of nextTerrain.buildSurfaceGeometries(1)) {\n          const drawable = engine.addMesh(chunk.geometry, terrainMeshOptions);\n          drawable.doubleSided = false;\n          drawable.visible = true;\n          nextDrawables.push(drawable);\n        }\n        const caveMeshOptions = { color: '#ffffff', noise: 0.035, blockGrid: 0, blockFaceShade: 0, blockElevationCue: 0, doubleSided: true };\n        for (const cave of nextTerrain.buildCaveGeometries()) {\n          const drawable = engine.addMesh(cave.geometry, caveMeshOptions);\n          drawable.doubleSided = true;\n          drawable.visible = true;\n          nextDrawables.push(drawable);\n        }\n      }\n      for (const mesh of compiled.meshes) {`,
  'terrain drawable compilation'
);
foundation = replaceOnce(
  foundation,
  "    blockDrawables = nextDrawables;\n    imported = compiled;",
  "    blockDrawables = nextDrawables;\n    terrain = nextTerrain;\n    imported = compiled;",
  'terrain activation'
);
foundation = replaceOnce(
  foundation,
  "      const preferred = preferredAnchor?.at || [compiled.center[0], compiled.worldBounds.min[1] + 2, compiled.center[2]];\n      playerController.teleport(preferred);",
  "      const preferred = preferredAnchor?.at || [compiled.center[0], compiled.worldBounds.min[1] + 2, compiled.center[2]];\n      const terrainHeight = terrain?.sampleHeight?.(preferred[0], preferred[2]);\n      const spawn = terrainHeight == null ? preferred : [preferred[0], terrainHeight + 0.015, preferred[2]];\n      playerController.teleport(spawn);",
  'terrain-aware spawn'
);
write('public/downtown3d-foundation.js', foundation);

// Player collision: union RiftBlock solids with smooth terrain earth, and subtract
// cave tunnel volumes. The existing mature JS sweep solver handles both; the
// block-only native whole-step is bypassed only while Rift Terrain is active.
let player = read('public/rift-player.js');
const samplerPattern = /export function createRiftPlayerSurfaceSampler\(\{ getState, getWorldBounds \}\) \{[\s\S]*?\n\}\n\nexport function createRiftPlayerController/;
if (!samplerPattern.test(player)) throw new Error('[rift-terrain-v1] missing player surface sampler');
player = player.replace(samplerPattern, `export function createRiftPlayerSurfaceSampler({ getState, getWorldBounds, getTerrain }) {\n  function pointSolidAt(x, y, z) {\n    const bounds = getWorldBounds?.();\n    if (bounds && (x < bounds.min[0] || x >= bounds.max[0] + 1 || z < bounds.min[2] || z >= bounds.max[2] + 1)) return false;\n    const terrainSolid = getTerrain?.()?.isSolidPoint?.(x, y, z) === true;\n    const cy = Math.floor(y);\n    const state = getState(x, cy, z);\n    if (!state) return terrainSolid;\n    const localY = y - cy;\n    const decoded = decodeRiftBlockState(state);\n    const blockSolid = decoded.shape === RIFT_BLOCK_SHAPES.topSlab\n      ? localY >= 0.5 && localY < 1\n      : localY >= 0 && localY < riftPlayerShapeTopAt(state, x, z) - 0.001;\n    return blockSolid || terrainSolid;\n  }\n\n  function supportCandidatesAtPoint(x, z, aroundY, options = {}) {\n    const bounds = getWorldBounds?.();\n    if (!bounds) return [];\n    if (x < bounds.min[0] || x >= bounds.max[0] + 1 || z < bounds.min[2] || z >= bounds.max[2] + 1) return [];\n    const maxRise = Math.max(0, Number(options.maxRise ?? RIFT_PLAYER_STEP_UP));\n    const maxDrop = Math.max(0, Number(options.maxDrop ?? 4));\n    const upperSurface = aroundY + maxRise;\n    const lowerSurface = aroundY - maxDrop;\n    const topCell = Math.min(bounds.max[1], Math.floor(upperSurface));\n    const bottomCell = Math.max(bounds.min[1], Math.floor(lowerSurface) - 1);\n    const candidates = [];\n\n    const terrainCandidates = getTerrain?.()?.supportCandidatesAt?.(x, z, aroundY, { maxRise, maxDrop }) || [];\n    for (const supportY of terrainCandidates) if (!candidates.some(value => Math.abs(value - supportY) <= 0.001)) candidates.push(supportY);\n\n    for (let cy = topCell; cy >= bottomCell; cy -= 1) {\n      const state = getState(x, cy, z);\n      if (!state) continue;\n      const topY = cy + riftPlayerShapeTopAt(state, x, z);\n      if (topY > upperSurface + 0.001 || topY < lowerSurface - 0.001) continue;\n      if (!candidates.some(value => Math.abs(value - topY) <= 0.001)) candidates.push(topY);\n    }\n    candidates.sort((a, b) => b - a);\n    return candidates;\n  }\n\n  function supportAtPoint(x, z, aroundY, options = {}) {\n    return supportCandidatesAtPoint(x, z, aroundY, options)[0] ?? null;\n  }\n\n  function supportCrossings(x, z, previousY, candidateY, options = {}) {\n    if (![previousY, candidateY].every(Number.isFinite) || candidateY > previousY) return [];\n    const maxDrop = Math.max(0.3, previousY - candidateY + Math.max(0.18, Number(options.extraDrop) || 0));\n    const candidates = supportCandidatesAtPoint(x, z, previousY, {\n      maxRise: Math.max(0.02, Number(options.maxRise) || 0),\n      maxDrop\n    });\n    return candidates.filter(supportY => riftPlayerCrossedSupport(\n      previousY, candidateY, supportY, options.tolerance ?? 0.035, options.previousTolerance ?? 0.015\n    ));\n  }\n\n  function supportBelow(x, z, ceilingY, maxDrop = 5) {\n    return supportAtPoint(x, z, ceilingY, { maxRise: 0.035, maxDrop });\n  }\n\n  return { pointSolidAt, supportCandidatesAtPoint, supportAtPoint, supportCrossings, supportBelow };\n}\n\nexport function createRiftPlayerController`);
player = replaceOnce(
  player,
  "export function createRiftPlayerController({ canvas, camera, getGrid, getWorldBounds, player, touchRoot = document }) {",
  "export function createRiftPlayerController({ canvas, camera, getGrid, getWorldBounds, getTerrain = null, player, touchRoot = document }) {",
  'terrain controller parameter'
);
player = replaceOnce(
  player,
  "  const surfaces = createRiftPlayerSurfaceSampler({ getState, getWorldBounds });",
  "  const surfaces = createRiftPlayerSurfaceSampler({ getState, getWorldBounds, getTerrain });",
  'terrain sampler bridge'
);
player = replaceOnce(
  player,
  "  const stairFootClearance = Math.max(0.32, player.radius + 0.04);",
  "  const stairFootClearance = Math.max(0.32, player.radius + 0.04);\n  const terrainFootClearance = Math.max(0.38, player.radius * 1.6);",
  'terrain slope clearance'
);
player = replaceOnce(
  player,
  "    const state = getState(px, cy, pz);\n    if (!state) return false;\n    const decoded = decodeRiftBlockState(state);",
  "    const state = getState(px, cy, pz);\n    if (!state) {\n      const activeTerrain = getTerrain?.();\n      if (!activeTerrain?.isSolidPoint?.(px, py, pz)) return false;\n      const terrainSupport = activeTerrain.supportAtPoint?.(px, pz, floorY + terrainFootClearance, { maxRise: terrainFootClearance + 0.05, maxDrop: 0.12 });\n      if (h <= terrainFootClearance && terrainSupport != null && terrainSupport <= floorY + terrainFootClearance + RIFT_PLAYER_COLLISION_SKIN) return false;\n      return true;\n    }\n    const decoded = decodeRiftBlockState(state);",
  'terrain body collision'
);
player = replaceOnce(
  player,
  "      const state = getState(px, cellY, pz);\n      if (!state) continue;\n      if (decodeRiftBlockState(state).shape === RIFT_BLOCK_SHAPES.stair) continue;\n      count += 1;",
  "      const state = getState(px, cellY, pz);\n      if (!state) {\n        const terrainSupport = getTerrain?.()?.supportAtPoint?.(px, pz, supportY + 0.025, { maxRise: 0.055, maxDrop: 0.08 });\n        if (terrainSupport != null && Math.abs(terrainSupport - supportY) <= tolerance) count += 1;\n        continue;\n      }\n      if (decodeRiftBlockState(state).shape === RIFT_BLOCK_SHAPES.stair) continue;\n      count += 1;",
  'terrain support ownership'
);
player = replaceOnce(
  player,
  "    if (!(creative && flying)) {\n      const bounds = getWorldBounds?.();\n      const nativeStep = nativeGrid.playerStep({",
  "    if (!(creative && flying) && !getTerrain?.()) {\n      const bounds = getWorldBounds?.();\n      const nativeStep = nativeGrid.playerStep({",
  'block-only native step guard'
);
write('public/rift-player.js', player);

// Starter gameplay positions now sit on the new terrain rather than the retired
// y=1 compatibility plane. Runtime spawn is still snapped to sampled terrain.
let content = read('src/ironvale/content.js');
content = replaceOnce(content, "spawn: { id: 'valeborn-training-yard', position: [160, 2, 160], facing: 0 },", "spawn: { id: 'valeborn-training-yard', position: [160, 10, 160], facing: 0 },", 'terrain starter spawn');
content = content.replace("{ id: 'blackstone-barrow-mouth', name: 'Blackstone Barrow', zoneId: 'brackenford-lowlands', kind: 'future-dungeon-entrance', position: [130, 2, 35], interactRange: 4 }", "{ id: 'blackstone-barrow-mouth', name: 'Blackstone Barrow', zoneId: 'brackenford-lowlands', kind: 'future-dungeon-entrance', position: [228, 6, 154], interactRange: 4 }");
write('src/ironvale/content.js', content);

// Build gate: terrain verification becomes part of every normal build.
const packagePath = 'package.json';
const pkg = JSON.parse(read(packagePath));
pkg.scripts['verify:terrain'] = 'node scripts/check-rift-terrain.js';
if (!pkg.scripts.build.includes('verify:terrain')) pkg.scripts.build = pkg.scripts.build.replace('npm run verify:starter', 'npm run verify:terrain && npm run verify:starter');
write(packagePath, JSON.stringify(pkg, null, 2) + '\n');

// Retire the temporary reset assertions and lock the starter verifier onto the
// real terrain authority while preserving the deep safety bedrock contract.
let starter = read('scripts/check-ironvale-starter-game.js');
starter = starter.replace("expect(world.id==='ironvale-terrain-bootstrap'&&world.metadata?.terrain_reset===true,'terrain reset bootstrap metadata missing');", "expect(world.id==='ironvale-terrain-bootstrap'&&world.terrain?.format==='rift-terrain-v1','Rift Terrain v1 bootstrap metadata missing');");
starter = starter.replace("expect(world.metadata?.terrain_authority==='rift-terrain-native-pending'&&world.metadata?.legacy_island===false,'legacy island must not remain terrain authority');", "expect(world.metadata?.terrain_authority==='rift-terrain-v1'&&world.metadata?.legacy_island===false,'Rift Terrain v1 must be terrain authority');");
starter = starter.replace("expect(world.ops?.length===1&&JSON.stringify(world.ops[0]).includes('Temporary flat compatibility floor'),'bootstrap must contain only the temporary flat compatibility floor');", "expect(world.ops?.length===1&&JSON.stringify(world.ops[0]).includes('Deep safety bedrock'),'bootstrap must retain only deep emergency bedrock beneath terrain');");
starter = starter.replace("expect(foundation.includes('blockGrid: 0'),'bootstrap surface must not render the old Minecraft-style grid');", "expect(foundation.includes('createRiftTerrainFromDocument')&&foundation.includes('buildSurfaceGeometries'),'world foundation must render Rift Terrain v1');\nexpect(foundation.includes('blockGrid: 0'),'terrain and structure meshes must not render the old Minecraft-style grid');");
starter = starter.replace("console.log('[ironvale-starter-game] PASS · legacy terrain retired; neutral 320x320 bootstrap + Rift Native/gameplay/glTF foundations retained.');", "console.log('[ironvale-starter-game] PASS · Rift Terrain v1 owns the landscape; legacy terrain remains retired and Rift Native/gameplay/glTF foundations are retained.');");
write('scripts/check-ironvale-starter-game.js', starter);

console.log('[rift-terrain-v1] terrain renderer, layered data, cave geometry and terrain-aware player collision wired.');
