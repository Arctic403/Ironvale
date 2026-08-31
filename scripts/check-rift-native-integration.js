import {
  buildRiftNativeSectionFaceMasks,
  getRiftNativeCoreStatus,
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

const failures = [];
const ok = (value, message) => { if (!value) failures.push(message); };
const near = (actual, expected, tolerance = 1e-5) => Math.abs(actual - expected) <= tolerance;

const status = getRiftNativeCoreStatus();
ok(status.wasm && status.version === 2, `Node engine bridge is not using native v2: ${JSON.stringify(status)}`);

const directStates = new Uint16Array(4096);
directStates[(1 << 8) | (1 << 4) | 1] = 1;
directStates[(1 << 8) | (1 << 4) | 2] = 1;
const directMask = buildRiftNativeSectionFaceMasks(directStates);
ok(directMask.native && !directMask.partial && directMask.blocks === 2 && directMask.candidateFaces === 10,
  `native section face-mask bridge mismatch: ${JSON.stringify({ ...directMask, masks: undefined })}`);

const section = new RiftBlockSection();
section.setBlock(1, 1, 1, RIFT_SECTION_SOLID);
section.setBlock(2, 1, 1, RIFT_SECTION_SOLID);
const geometry = section.buildGeometry();
ok(geometry.blocks === 2 && geometry.visibleFaces === 10 && geometry.culledFaces === 2,
  `accelerated section geometry mismatch: ${JSON.stringify({ blocks: geometry.blocks, visibleFaces: geometry.visibleFaces, culledFaces: geometry.culledFaces })}`);
ok(geometry.nativeFaceCulling === true, 'full-block section did not report native face culling');

const grid = new RiftSectionGrid();
const left = grid.addSection(new RiftBlockSection({ sx: 0, sy: 0, sz: 0 }));
const right = grid.addSection(new RiftBlockSection({ sx: 1, sy: 0, sz: 0 }));
left.setBlock(15, 1, 1, RIFT_SECTION_SOLID);
right.setBlock(0, 1, 1, RIFT_SECTION_SOLID);
const leftGeometry = grid.buildGeometryForSection(left);
const rightGeometry = grid.buildGeometryForSection(right);
ok(leftGeometry.visibleFaces === 5 && rightGeometry.visibleFaces === 5,
  `cross-section native boundary culling mismatch: ${leftGeometry.visibleFaces}/${rightGeometry.visibleFaces}`);

const slab = new RiftBlockSection();
slab.setBlock(2, 2, 2, encodeRiftBlockState({ material: 1, shape: RIFT_BLOCK_SHAPES.bottomSlab }));
const slabGeometry = slab.buildGeometry();
ok(slabGeometry.shapeAware === true && slabGeometry.nativeFaceCulling !== true,
  'partial-shape section failed to preserve shape-aware JS geometry path');

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

for (const [name, result] of [
  ['section storage', validateRiftBlockSectionStorage()],
  ['section grid', validateRiftSectionGrid()],
  ['section streaming', validateRiftSectionStreaming()],
  ['section persistence', validateRiftSectionPersistence()]
]) {
  if (!result.ok) failures.push(`${name}: ${result.failures.join('; ')}`);
}

if (failures.length) {
  console.error('[rift-native-integration] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('[rift-native-integration] PASS · C++ v2 drives full-block culling, section coordinates and player surface kernels while partial shapes retain the proven JS path.');
