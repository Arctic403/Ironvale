import fs from 'node:fs';

const path = 'public/rift-wasm-core.js';
let source = fs.readFileSync(path, 'utf8');
const search = `export function riftNativeStateShapeTop(state, worldX, worldZ) {
  return getRiftNativeCore().rift_state_shape_top(Math.trunc(Number(state) || 0) >>> 0, worldX, worldZ);
}
`;
const replacement = `export function riftNativeStateShapeTop(state, worldX, worldZ) {
  const packed = Math.trunc(Number(state) || 0) >>> 0;
  if (!packed) return 0;
  const shape = (packed >> 8) & 7;
  const rotation = (packed >> 11) & 3;
  // Preserve the browser's f64 cell ownership before crossing the WASM f32
  // boundary. Values such as 3.999999... must remain local≈1 instead of being
  // rounded to worldX=4 and wrapped to local=0 on west/north stair edges.
  const localX = fraction(worldX);
  const localZ = fraction(worldZ);
  return getRiftNativeCore().rift_shape_top(shape, rotation, localX, localZ);
}
`;

if (source.includes('Preserve the browser\'s f64 cell ownership')) {
  console.log('[native-v2-precision] bridge already precision-safe');
  process.exit(0);
}
const first = source.indexOf(search);
if (first < 0 || source.indexOf(search, first + search.length) >= 0) {
  throw new Error('[native-v2-precision] expected riftNativeStateShapeTop bridge block not found uniquely');
}
source = source.slice(0, first) + replacement + source.slice(first + search.length);
fs.writeFileSync(path, source);
console.log('[native-v2-precision] patched local-coordinate handoff for stair precision');
