import {
  buildRiftNativeSectionFaceMasks,
  buildRiftNativeSectionMesh,
  createRiftNativeGridAccelerator,
  getRiftNativeCoreStatus,
  resetRiftNativeCoreMetrics,
  riftNativeStateShapeTop
} from '../public/rift-wasm-core.js';
import {
  RiftBlockSection,
  RiftSectionGrid,
  RIFT_SECTION_SOLID,
  riftWorldCellToSection,
  validateRiftBlockSectionStorage,
  validateRiftSectionGrid,
  validateRiftSectionPersistence,
  validateRiftSectionStreaming
} from '../public/rift-block-section.js';
import {
  encodeRiftBlockState,
  RIFT_BLOCK_ROTATIONS,
  RIFT_BLOCK_SHAPES
} from '../public/rift-block-shapes.js';
import {
  classifyRiftPlayerGroundStep,
  riftPlayerCrossedSupport,
  riftPlayerShapeTopAt,
  riftPlayerStairTop
} from '../public/rift-player.js';
import fs from 'node:fs';

const failures = [];
const ok = (value, message) => { if (!value) failures.push(message); };
const near = (actual, expected, tolerance = 1e-5) => Math.abs(actual - expected) <= tolerance;
resetRiftNativeCoreMetrics();

const status = getRiftNativeCoreStatus();
ok(status.wasm && status.version === 4, `Node engine bridge is not using native v4: ${JSON.stringify(status)}`);
ok(status.residentSlotCapacity >= 64, `native resident slot capacity too small: ${status.residentSlotCapacity}`);

// v2 compatibility mask API is still present for partial/dynamic fallbacks.
const directStates = new Uint16Array(4096);
directStates[(1 << 8) | (1 << 4) | 1] = 1;
directStates[(1 << 8) | (1 << 4) | 2] = 1;
const directMask = buildRiftNativeSectionFaceMasks(directStates);
ok(directMask.native && !directMask.partial && directMask.blocks === 2 && directMask.candidateFaces === 10,
  `native section face-mask compatibility mismatch: ${JSON.stringify({ ...directMask, masks: undefined })}`);

// v3 emits the entire full-block section geometry in C++.
const section = new RiftBlockSection();
section.setBlock(1, 1, 1, RIFT_SECTION_SOLID);
section.setBlock(2, 1, 1, RIFT_SECTION_SOLID);
const geometry = section.buildGeometry();
ok(geometry.blocks === 2 && geometry.visibleFaces === 10 && geometry.culledFaces === 2,
  `native mesh section geometry mismatch: ${JSON.stringify({ blocks: geometry.blocks, visibleFaces: geometry.visibleFaces, culledFaces: geometry.culledFaces })}`);
ok(geometry.nativeFaceCulling === true && geometry.nativeMesh === true && geometry.nativeResident === true,
  'full-block section did not report resident native mesh generation');
ok(geometry.vertexStride === 9 && geometry.vertices.length === geometry.vertexCount * 9 && geometry.indices.length === geometry.triangles * 3,
  'native mesh lost the Rift 9-float/index contract');

// Material callbacks that are state-only can be collapsed to the native 256-entry palette.
const colored = new RiftBlockSection();
colored.setBlock(1, 1, 1, 5);
const coloredMesh = buildRiftNativeSectionMesh(colored, { getBlockColor: ({ state }) => state === 5 ? [0.25, 0.5, 0.75] : [1,1,1] });
ok(coloredMesh?.nativeMesh === true, 'state-only material resolver failed to use native mesh path');
ok(near(coloredMesh?.vertices?.[6], 0.25) && near(coloredMesh?.vertices?.[7], 0.5) && near(coloredMesh?.vertices?.[8], 0.75),
  'native material palette did not reach emitted vertices');

// World/face-dependent colors intentionally reject v3 and preserve JavaScript geometry semantics.
const dynamicColor = ({ worldX = 0 }) => worldX & 1 ? [1,0,0] : [0,1,0];
ok(buildRiftNativeSectionMesh(colored, { getBlockColor: dynamicColor }) === null,
  'dynamic material resolver should not be flattened into native state-only palette');

// Cross-section border planes are copied from actual neighbor sections and culled natively.
const grid = new RiftSectionGrid();
const left = grid.addSection(new RiftBlockSection({ sx: 0, sy: 0, sz: 0 }));
const right = grid.addSection(new RiftBlockSection({ sx: 1, sy: 0, sz: 0 }));
left.setBlock(15, 1, 1, RIFT_SECTION_SOLID);
right.setBlock(0, 1, 1, RIFT_SECTION_SOLID);
const leftGeometry = grid.buildGeometryForSection(left);
const rightGeometry = grid.buildGeometryForSection(right);
ok(leftGeometry.visibleFaces === 5 && rightGeometry.visibleFaces === 5,
  `native cross-section border culling mismatch: ${leftGeometry.visibleFaces}/${rightGeometry.visibleFaces}`);
ok(leftGeometry.nativeMesh && rightGeometry.nativeMesh, 'cross-section mesh did not stay on native path');

// Persistent section cache must observe revisions instead of freezing stale states.
const accelerator = createRiftNativeGridAccelerator(() => grid);
ok(accelerator.getBlockWorld(15,1,1) === 1 && accelerator.getBlockWorld(16,1,1) === 1,
  'persistent native grid lookup failed across section boundary');
left.setBlock(15,1,1,9);
ok(accelerator.getBlockWorld(15,1,1) === 9, 'native resident section did not resync after JS revision change');
const batch = accelerator.batchGetBlockWorld([[15,1,1],[16,1,1],[80,1,1]]);
ok([...batch].join(',') === '9,1,0', `native batch world query mismatch: ${[...batch]}`);
const ray = accelerator.raycast([14,1.5,1.5],[1,0,0],10);
ok(ray.native && ray.hit?.join(',') === '15,1,1' && ray.face === 1 && ray.state === 9,
  `native DDA raycast mismatch: ${JSON.stringify(ray)}`);
accelerator.dispose();

// v4 routes static-color slabs/stairs through native shape-aware micro-occlusion.
const slab = new RiftBlockSection();
slab.setBlock(2, 2, 2, encodeRiftBlockState({ material: 1, shape: RIFT_BLOCK_SHAPES.bottomSlab }));
const slabGeometry = slab.buildGeometry();
ok(slabGeometry.shapeAware === true && slabGeometry.nativeMesh === true && slabGeometry.visibleFaces === 6,
  'partial-shape section did not use native shape-aware mesh path');

const negative = riftWorldCellToSection(-17);
ok(negative.section === -2 && negative.local === 15,
  `native negative world-to-section mapping mismatch: ${JSON.stringify(negative)}`);

ok(riftPlayerCrossedSupport(2, 0.9, 1, 0.035, 0.015) === true, 'player support crossing is not routed correctly');
ok(classifyRiftPlayerGroundStep(1, 1.7) === 'blocked', 'player blocked-step classification mismatch');
ok(classifyRiftPlayerGroundStep(1, 0.1) === 'drop', 'player drop classification mismatch');
ok(classifyRiftPlayerGroundStep(1, 1.4) === 'grounded', 'player grounded-step classification mismatch');
ok(near(riftPlayerStairTop({ rotation: RIFT_BLOCK_ROTATIONS.north }, 0.4, 0.2), 0.8), 'native north stair ramp mismatch');
const eastStair = encodeRiftBlockState({ material: 1, shape: RIFT_BLOCK_SHAPES.stair, rotation: RIFT_BLOCK_ROTATIONS.east });
ok(near(riftPlayerShapeTopAt(eastStair, -0.25, 4.2), 0.75), 'player packed-state stair top mismatch');
ok(near(riftNativeStateShapeTop(eastStair, -0.25, 4.2), 0.75), 'direct packed-state native stair top mismatch');

const creativeSource = fs.readFileSync(new URL('../public/rift-creative-mode.js', import.meta.url), 'utf8');
ok(creativeSource.includes('nativeGrid.raycast(') && creativeSource.includes('raycastFallback'),
  'creative-mode picker is not wired to native DDA with a JS fallback');
const playerSource = fs.readFileSync(new URL('../public/rift-player.js', import.meta.url), 'utf8');
ok(playerSource.includes('createRiftNativeGridAccelerator') && playerSource.includes('nativeGrid.getBlockWorld'),
  'player hot state probes are not routed through persistent native section residency');

for (const [name, result] of [
  ['section storage', validateRiftBlockSectionStorage()],
  ['section grid', validateRiftSectionGrid()],
  ['section streaming', validateRiftSectionStreaming()],
  ['section persistence', validateRiftSectionPersistence()]
]) {
  if (!result.ok) failures.push(`${name}: ${result.failures.join('; ')}`);
}

const finalStatus = getRiftNativeCoreStatus();
ok(finalStatus.metrics.sectionSyncs >= 1 && finalStatus.metrics.sectionBytesCopied >= 8192,
  `persistent-section metrics did not move: ${JSON.stringify(finalStatus.metrics)}`);
ok(finalStatus.metrics.nativeMeshBuilds >= 1 && finalStatus.metrics.native.meshBuilds >= 1,
  `native mesh metrics did not move: ${JSON.stringify(finalStatus.metrics)}`);
ok(finalStatus.metrics.batchCalls >= 1 && finalStatus.metrics.native.batchCalls >= 1,
  'native batch-query counters did not move');
ok(finalStatus.metrics.raycasts >= 1 && finalStatus.metrics.native.raycasts >= 1,
  'native raycast counters did not move');

if (failures.length) {
  console.error('[rift-native-integration] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('[rift-native-integration] PASS · C++ v4 owns resident RiftSections, full/slab/stair mesh emission, world queries, player-step/path/spatial gameplay kernels and creative DDA; dynamic face-classified rendering remains safely in JS.');
