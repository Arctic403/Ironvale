import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`[native-v2-patch] ${label}: expected source block not found`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`[native-v2-patch] ${label}: source block is ambiguous`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function patchSectionModule() {
  const path = 'public/rift-block-section.js';
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes('nativeFaceCulling: nativeSectionAnalysis.native')) {
    console.log('[native-v2-patch] section module already integrated');
    return;
  }

  source = replaceOnce(source,
`import { RIFT_BLOCK_FACE_DEFS } from './rift-block-world.js';
import { buildRiftPartialShapeGeometry, riftBlockStateHasPartialShape } from './rift-block-shapes.js';
`,
`import { RIFT_BLOCK_FACE_DEFS } from './rift-block-world.js';
import { buildRiftPartialShapeGeometry, riftBlockStateHasPartialShape } from './rift-block-shapes.js';
import {
  buildRiftNativeSectionFaceMasks,
  riftNativeSectionIndex,
  riftNativeWorldCellToSection
} from './rift-wasm-core.js';
`, 'section native import');

  source = replaceOnce(source,
`export function riftSectionIndex(x, y, z) {
  x = Math.trunc(x); y = Math.trunc(y); z = Math.trunc(z);
  if (x < 0 || x >= RIFT_SECTION_SIZE || y < 0 || y >= RIFT_SECTION_SIZE || z < 0 || z >= RIFT_SECTION_SIZE) {
    return -1;
  }
  return (y << 8) | (z << 4) | x;
}
`,
`export function riftSectionIndex(x, y, z) {
  return riftNativeSectionIndex(x, y, z);
}
`, 'section index kernel');

  source = replaceOnce(source,
`    let containsPartialShape = false;
    for (let i = 0; i < this.states.length; i += 1) {
      if (riftBlockStateHasPartialShape(this.states[i])) {
        containsPartialShape = true;
        break;
      }
    }
`,
`    // Native Core v2 copies this section's compact 8 KiB state array once and
    // returns both partial-shape detection and full-block visibility masks. This
    // replaces up to 24,576 JS neighbor checks per dirty full-block section.
    const nativeSectionAnalysis = buildRiftNativeSectionFaceMasks(this.states);
    const containsPartialShape = nativeSectionAnalysis.partial;
`, 'partial-shape analysis');

  source = replaceOnce(source,
`    const buffer = { vertices: [], indices: [] };
    const layerBuffers = typeof classifyBlockFace === 'function' ? new Map() : null;
    let blocks = 0;
    let visibleFaces = 0;
    let culledFaces = 0;
`,
`    const buffer = { vertices: [], indices: [] };
    const layerBuffers = typeof classifyBlockFace === 'function' ? new Map() : null;
    let blocks = nativeSectionAnalysis.blocks;
    let visibleFaces = 0;
    let culledFaces = 0;
`, 'full-block geometry counters');

  source = replaceOnce(source,
`          const state = this.getBlock(x, y, z);
          if (state === RIFT_SECTION_AIR) continue;
          blocks += 1;

          for (const face of RIFT_BLOCK_FACE_DEFS) {
            const nx = x + face.d[0];
            const ny = y + face.d[1];
            const nz = z + face.d[2];
            let neighbor = RIFT_SECTION_AIR;

            if (this.inBounds(nx, ny, nz)) {
              neighbor = this.getBlock(nx, ny, nz);
            } else if (typeof getOutsideBlock === 'function') {
              neighbor = Math.trunc(Number(getOutsideBlock(
                origin.x + nx,
                origin.y + ny,
                origin.z + nz,
                face
              )) || 0);
            }

            if (neighbor !== RIFT_SECTION_AIR) {
              culledFaces += 1;
              continue;
            }
`,
`          const index = riftSectionIndex(x, y, z);
          const state = this.states[index];
          if (state === RIFT_SECTION_AIR) continue;
          const faceMask = nativeSectionAnalysis.masks[index];

          for (let faceIndex = 0; faceIndex < RIFT_BLOCK_FACE_DEFS.length; faceIndex += 1) {
            if ((faceMask & (1 << faceIndex)) === 0) continue;
            const face = RIFT_BLOCK_FACE_DEFS[faceIndex];
            const nx = x + face.d[0];
            const ny = y + face.d[1];
            const nz = z + face.d[2];

            // C++ owns every in-section neighbor test. Cross-section visibility
            // remains a JS grid callback so streamed/loading neighbor semantics
            // stay byte-for-byte compatible with the existing world pipeline.
            if (!this.inBounds(nx, ny, nz) && typeof getOutsideBlock === 'function') {
              const neighbor = Math.trunc(Number(getOutsideBlock(
                origin.x + nx,
                origin.y + ny,
                origin.z + nz,
                face
              )) || 0);
              if (neighbor !== RIFT_SECTION_AIR) continue;
            }
`, 'full-block native face-mask loop');

  source = replaceOnce(source,
`    const vertexCount = visibleFaces * 4;
`,
`    culledFaces = blocks * 6 - visibleFaces;
    const vertexCount = visibleFaces * 4;
`, 'culled-face accounting');

  source = replaceOnce(source,
`      stateBytes: this.states.byteLength,
      visibilityLayers: finalizeSectionVisibilityLayers(layerBuffers)
`,
`      stateBytes: this.states.byteLength,
      visibilityLayers: finalizeSectionVisibilityLayers(layerBuffers),
      nativeFaceCulling: nativeSectionAnalysis.native
`, 'native geometry diagnostics');

  source = replaceOnce(source,
`export function riftWorldCellToSection(value = 0) {
  const cell = Math.trunc(Number(value) || 0);
  const section = Math.floor(cell / RIFT_SECTION_SIZE);
  return {
    section,
    local: cell - section * RIFT_SECTION_SIZE
  };
}
`,
`export function riftWorldCellToSection(value = 0) {
  return riftNativeWorldCellToSection(value, RIFT_SECTION_SIZE);
}
`, 'world-to-section kernel');

  fs.writeFileSync(path, source);
  console.log('[native-v2-patch] patched public/rift-block-section.js');
}

function patchPlayerModule() {
  const path = 'public/rift-player.js';
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes('riftNativeGroundStepClassify')) {
    console.log('[native-v2-patch] player module already integrated');
    return;
  }

  source = replaceOnce(source,
`import { decodeRiftBlockState, RIFT_BLOCK_SHAPES, RIFT_BLOCK_ROTATIONS } from './rift-block-shapes.js';
`,
`import { decodeRiftBlockState, RIFT_BLOCK_SHAPES, RIFT_BLOCK_ROTATIONS } from './rift-block-shapes.js';
import {
  riftNativeCrossedSupport,
  riftNativeGroundStepClassify,
  riftNativeStairTop,
  riftNativeStateShapeTop
} from './rift-wasm-core.js';
`, 'player native import');

  source = replaceOnce(source,
`export function riftPlayerCrossedSupport(previousY, candidateY, supportY, tolerance = 0.055, previousTolerance = 0.015) {
  if (![previousY, candidateY, supportY].every(Number.isFinite)) return false;
  const contactTolerance = Math.max(0, Number(tolerance) || 0);
  const startTolerance = Math.max(0, Number(previousTolerance) || 0);
  return candidateY <= supportY + contactTolerance && previousY >= supportY - startTolerance;
}
`,
`export function riftPlayerCrossedSupport(previousY, candidateY, supportY, tolerance = 0.055, previousTolerance = 0.015) {
  if (![previousY, candidateY, supportY].every(Number.isFinite)) return false;
  const contactTolerance = Math.max(0, Number(tolerance) || 0);
  const startTolerance = Math.max(0, Number(previousTolerance) || 0);
  return riftNativeCrossedSupport(previousY, candidateY, supportY, contactTolerance, startTolerance);
}
`, 'support-crossing kernel');

  source = replaceOnce(source,
`export function riftPlayerStairTop(decoded, localX, localZ) {
  let t = 0;
  switch (decoded.rotation) {
    case RIFT_BLOCK_ROTATIONS.north: t = 1 - localZ; break;
    case RIFT_BLOCK_ROTATIONS.east: t = localX; break;
    case RIFT_BLOCK_ROTATIONS.south: t = localZ; break;
    case RIFT_BLOCK_ROTATIONS.west: t = 1 - localX; break;
    default: t = 0;
  }
  // H1.71: rendering keeps the authored two-step stair mesh, but player
  // collision/support rides an invisible full-cell ramp. That makes a stair
  // connect continuously from the floor at its low edge (0 m) to the next
  // full-block level at its high edge (1 m), independent of the visual treads.
  return clamp(t, 0, 1);
}
`,
`export function riftPlayerStairTop(decoded, localX, localZ) {
  // H1.71's smooth collision ramp now runs through the shared C++ kernel. The
  // authored two-tread visual mesh is unchanged.
  return riftNativeStairTop(decoded?.rotation ?? RIFT_BLOCK_ROTATIONS.north, localX, localZ);
}
`, 'stair ramp kernel');

  source = replaceOnce(source,
`export function riftPlayerShapeTopAt(state, worldX, worldZ) {
  if (!state) return 0;
  const decoded = decodeRiftBlockState(state);
  const localX = worldX - Math.floor(worldX);
  const localZ = worldZ - Math.floor(worldZ);
  switch (decoded.shape) {
    case RIFT_BLOCK_SHAPES.bottomSlab: return 0.5;
    case RIFT_BLOCK_SHAPES.topSlab: return 1;
    case RIFT_BLOCK_SHAPES.stair: return riftPlayerStairTop(decoded, localX, localZ);
    case RIFT_BLOCK_SHAPES.full:
    default: return 1;
  }
}
`,
`export function riftPlayerShapeTopAt(state, worldX, worldZ) {
  if (!state) return 0;
  // Packed state decode + negative-coordinate fractional math is native here;
  // this helper sits in the deepest support/body-probe loops.
  return riftNativeStateShapeTop(state, worldX, worldZ);
}
`, 'packed shape-top kernel');

  source = replaceOnce(source,
`export function classifyRiftPlayerGroundStep(currentY, targetSupportY, options = {}) {
  const stepUp = Number(options.stepUp ?? RIFT_PLAYER_STEP_UP);
  const snapDown = Number(options.snapDown ?? RIFT_PLAYER_GROUND_SNAP_DOWN);
  if (targetSupportY == null || !Number.isFinite(targetSupportY)) return 'drop';
  const delta = targetSupportY - currentY;
  if (delta > stepUp + 0.0001) return 'blocked';
  if (delta < -snapDown - 0.0001) return 'drop';
  return 'grounded';
}
`,
`export function classifyRiftPlayerGroundStep(currentY, targetSupportY, options = {}) {
  const stepUp = Number(options.stepUp ?? RIFT_PLAYER_STEP_UP);
  const snapDown = Number(options.snapDown ?? RIFT_PLAYER_GROUND_SNAP_DOWN);
  if (targetSupportY == null || !Number.isFinite(targetSupportY)) return 'drop';
  const code = riftNativeGroundStepClassify(currentY, targetSupportY, stepUp, snapDown);
  return code === 2 ? 'blocked' : code === 1 ? 'grounded' : 'drop';
}
`, 'ground-step kernel');

  fs.writeFileSync(path, source);
  console.log('[native-v2-patch] patched public/rift-player.js');
}

function patchPackage() {
  const path = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.scripts ||= {};
  if (!String(pkg.scripts.build || '').includes('verify:native-integration')) {
    pkg.scripts.build = String(pkg.scripts.build || '').replace(
      'npm run verify:wasm &&',
      'npm run verify:wasm && npm run verify:native-integration &&'
    );
  }
  pkg.scripts['verify:native-integration'] = 'node scripts/check-rift-native-integration.js';
  fs.writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('[native-v2-patch] patched package.json');
}

patchSectionModule();
patchPlayerModule();
patchPackage();
console.log('[native-v2-patch] integration patch staged successfully');
