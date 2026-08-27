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
  if (compiled.visibility?.structures?.length !== 4) failures.push(`Commerce Block 01 building metadata count ${compiled.visibility?.structures?.length || 0} != 4`);
  if ((compiled.stats.visibilityLayers || 0) !== 0) failures.push(`compiled world still reports ${compiled.stats.visibilityLayers} hideable visibility layers`);

  for (const mesh of compiled.meshes) {
    if ((mesh.visibilityLayers || []).length) failures.push(`section ${mesh.section.join(',')} still contains camera-hideable render layers`);
  }

  const mercer = compiled.visibility.structures.find(structure => structure.name === 'Mercer Apartments');
  if (!mercer) {
    failures.push('Mercer Apartments building metadata missing');
  } else {
    if (!mercer.roofAttachments?.some(entry => entry.name === 'Mercer rooftop utility box')) {
      failures.push('Mercer rooftop utility-box ownership metadata was lost');
    }
    const insidePlayer = [
      (mercer.interior.minX + mercer.interior.maxX) * 0.5,
      mercer.floorY + 1,
      (mercer.interior.minZ + mercer.interior.maxZ) * 0.5
    ];
    const inside = resolveRiftBuildingVisibility({
      structures: compiled.visibility.structures, playerPosition: insidePlayer, cameraPosition: [-24, 10, -24]
    });
    if (!inside.insideStructures.includes(mercer.id)) failures.push('inside containment metadata missing');
    if (inside.hiddenLayers.size || inside.suppressedStructures.length) failures.push('inside view hides roof/wall/floor geometry');

    const outsidePlayer = [mercer.bounds.max[0] + 3, mercer.floorY + 1, (mercer.bounds.min[2] + mercer.bounds.max[2] + 1) * 0.5];
    const outside = resolveRiftBuildingVisibility({
      structures: compiled.visibility.structures, playerPosition: outsidePlayer, cameraPosition: [mercer.bounds.min[0] - 24, mercer.roofY + 4, outsidePlayer[2]]
    });
    if (!outside.blockingStructures.includes(mercer.id)) failures.push('exterior blocker metadata missing');
    if (outside.hiddenLayers.size || outside.suppressedStructures.length) failures.push('outside view hides roof/wall/floor geometry');

    const overview = resolveRiftBuildingVisibility({
      structures: compiled.visibility.structures, playerPosition: insidePlayer, cameraPosition: [-24, 30, -24], overview: true
    });
    if (overview.hiddenLayers.size || overview.suppressedStructures.length) failures.push('overview hides geometry');
  }

  if ((compiled.stats.visibilityRoofAttachments || 0) < 2) {
    failures.push(`Commerce Block 01 detected only ${compiled.stats.visibilityRoofAttachments || 0} rooftop metadata attachments; expected Mercer and Warehouse utility boxes`);
  }
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[building-visibility-check] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[building-visibility-check] metadata retained; roofs, walls and stacked floors are never camera-hidden: PASS');
