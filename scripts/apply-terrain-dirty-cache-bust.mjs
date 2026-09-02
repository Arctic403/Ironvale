import fs from 'node:fs';

// One-shot cache refresh for the dirty-region optimization.
function replace(path, before, after) {
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes(after)) return false;
  if (!source.includes(before)) throw new Error(`Missing cache-bust target in ${path}`);
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
  return true;
}

replace('public/rift-landscape.js', "import { RiftTerrain } from './rift-terrain.js?v=20260901-terrain-profiler-r1';", "import { RiftTerrain } from './rift-terrain.js?v=20260902-dirty-region-r1';");
replace('public/app.js', "import { RiftLandscape } from './rift-landscape.js?v=20260901-terrain-profiler-r1';", "import { RiftLandscape } from './rift-landscape.js?v=20260902-dirty-region-r1';");
replace('public/app.js', "const APP_DIAGNOSTIC_BUILD = '20260901-terrain-profiler-r1';", "const APP_DIAGNOSTIC_BUILD = '20260902-dirty-region-r1';");
replace('public/index.html', '/app.js?v=20260901-terrain-profiler-r1', '/app.js?v=20260902-dirty-region-r1');

console.log('Terrain dirty-region cache refresh applied.');
