import fs from 'node:fs';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';
import { resolveRiftBuildingVisibility, validateRiftBuildingVisibility } from '../public/rift-building-visibility.js';

const failures = [];
const unit = validateRiftBuildingVisibility();
if (!unit.ok) failures.push(...unit.failures);

try {
  const document = JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/downtown-block-001.json', import.meta.url), 'utf8'));
  const compiled = compileRiftCityBlock(document);
  if (compiled.visibility?.mode !== 'metadata-only-no-cutaway') failures.push(`visibility mode ${compiled.visibility?.mode || 'missing'} is not metadata-only-no-cutaway`);
  if ((compiled.stats.visibilityLayers || 0) !== 0) failures.push(`compiled world still reports ${compiled.stats.visibilityLayers} hideable visibility layers`);

  for (const mesh of compiled.meshes) {
    if ((mesh.visibilityLayers || []).length) failures.push(`section ${mesh.section.join(',')} still contains camera-hideable render layers`);
  }

  const structures = compiled.visibility?.structures || [];
  if (!structures.length) {
    failures.push('active Downtown source produced no building visibility metadata');
  } else {
    const sample = structures.find(structure => structure?.interior && structure?.bounds && Number.isFinite(structure?.floorY) && Number.isFinite(structure?.roofY));
    if (!sample) {
      failures.push('active Downtown building metadata has no structure suitable for containment/blocker validation');
    } else {
      const insidePlayer = [
        (sample.interior.minX + sample.interior.maxX) * 0.5,
        sample.floorY + 1,
        (sample.interior.minZ + sample.interior.maxZ) * 0.5
      ];
      const inside = resolveRiftBuildingVisibility({
        structures, playerPosition: insidePlayer, cameraPosition: [sample.bounds.min[0] - 24, sample.roofY + 4, sample.bounds.min[2] - 24]
      });
      if (!inside.insideStructures.includes(sample.id)) failures.push(`${sample.name || sample.id} inside containment metadata missing`);
      if (inside.hiddenLayers.size || inside.suppressedStructures.length) failures.push('inside view hides roof/wall/floor geometry');

      const outsidePlayer = [sample.bounds.max[0] + 3, sample.floorY + 1, (sample.bounds.min[2] + sample.bounds.max[2] + 1) * 0.5];
      const outside = resolveRiftBuildingVisibility({
        structures, playerPosition: outsidePlayer, cameraPosition: [sample.bounds.min[0] - 24, sample.roofY + 4, outsidePlayer[2]]
      });
      if (!outside.blockingStructures.includes(sample.id)) failures.push(`${sample.name || sample.id} exterior blocker metadata missing`);
      if (outside.hiddenLayers.size || outside.suppressedStructures.length) failures.push('outside view hides roof/wall/floor geometry');

      const overview = resolveRiftBuildingVisibility({
        structures, playerPosition: insidePlayer, cameraPosition: [sample.bounds.min[0] - 24, sample.roofY + 24, sample.bounds.min[2] - 24], overview: true
      });
      if (overview.hiddenLayers.size || overview.suppressedStructures.length) failures.push('overview hides geometry');
    }
  }
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[building-visibility-check] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[building-visibility-check] current Downtown metadata retained; roofs, walls and stacked floors are never camera-hidden: PASS');