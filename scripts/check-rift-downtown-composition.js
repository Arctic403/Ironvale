import fs from 'node:fs';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';
import { RIFT_SHARED_PALETTE } from '../public/rift-material-library.js';

const base = JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/downtown-block-001.json', import.meta.url), 'utf8'));
const worldIndex = JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/world-index.json', import.meta.url), 'utf8'));
const runtimeSource = fs.readFileSync(new URL('../public/rift-world-composition-runtime.js', import.meta.url), 'utf8');
const atlasSource = fs.readFileSync(new URL('../public/rift-texture-atlas.js', import.meta.url), 'utf8');
const failures = [];
const ok = (value, message) => { if (!value) failures.push(message); };

try {
  ok(base.id === 'riftcity-base-world-001', `Active block id ${base.id} is not the base-world reset.`);
  ok(base.name === 'RiftCity Base World', 'Base world name drifted.');
  ok(Array.isArray(base.ops) && base.ops.length === 2, `Base world should contain exactly two terrain ops, found ${base.ops?.length}.`);
  ok(base.ops.every(op => op.op === 'fill_box'), 'Base world contains authored non-terrain operations.');
  ok(base.ops.some(op => op.state === 'dirt'), 'Base world dirt foundation is missing.');
  ok(base.ops.some(op => op.state === 'grass_block'), 'Base world grass surface is missing.');
  ok(!JSON.stringify(base).match(/road|building|bank|parking|sidewalk|commerce/i), 'Old city authoring leaked back into the base-world JSON.');

  const expectedTextures = [
    'grass_block', 'dirt', 'dirt_dark', 'dirt_dry',
    'stone', 'stone_light', 'stone_dark', 'cobblestone', 'mossy_stone',
    'oak_wood', 'pine_wood', 'aged_wood', 'sand', 'gravel', 'clay', 'mud'
  ];
  for (const name of expectedTextures) ok(RIFT_SHARED_PALETTE[name], `Shared material '${name}' is missing.`);

  ok(atlasSource.includes("'grass', 'dirt', 'dirt_dark', 'dirt_dry'"), 'Texture atlas natural-material tiles are missing.');
  ok(atlasSource.includes("'mossy_stone', 'oak_wood', 'pine_wood', 'aged_wood'"), 'Texture atlas stone/wood variations are missing.');
  ok(atlasSource.includes('No third-party texture art is bundled.'), 'Atlas copyright/provenance guard comment is missing.');
  ok(!runtimeSource.includes('window.fetch ='), 'World composition runtime is intercepting fetch again.');
  ok(runtimeSource.includes("disabled: true"), 'World composition runtime is not explicitly disabled for the reset.');

  const activeEntry = worldIndex.blocks.find(entry => entry.id === worldIndex.activeBlockId);
  ok(worldIndex.activeBlockId === 'riftcity-base-world-001', `World index activeBlockId ${worldIndex.activeBlockId} != riftcity-base-world-001.`);
  ok(activeEntry?.path === './downtown-block-001.json', 'Base world index path drifted.');
  ok(!activeEntry?.runtime_overlays?.length, 'Base world must not advertise runtime building overlays.');

  const compiled = compileRiftCityBlock(base);
  ok(compiled.stats.operations === 2, `Compiled base world operations ${compiled.stats.operations} != 2.`);
  ok(compiled.stats.cells === 18432, `Compiled base world cells ${compiled.stats.cells} != 18,432.`);
  ok(compiled.stats.blueprintObjects === 0, `Compiled base world unexpectedly contains ${compiled.stats.blueprintObjects} blueprint objects.`);
  ok(compiled.stats.roads === 0 && compiled.stats.intersections === 0, 'Compiled base world contains road/intersection objects.');
  ok(compiled.worldBounds.min[0] === 0 && compiled.worldBounds.max[0] === 95, 'Base world X bounds drifted.');
  ok(compiled.worldBounds.min[2] === 0 && compiled.worldBounds.max[2] === 95, 'Base world Z bounds drifted.');

  if (!failures.length) {
    console.log(`[downtown-composition] PASS · base-world reset · ${compiled.stats.cells.toLocaleString()} terrain cells · ${expectedTextures.length} original atlas-backed natural materials · runtime city overlays disabled.`);
  }
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[downtown-composition] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
