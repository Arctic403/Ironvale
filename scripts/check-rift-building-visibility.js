import fs from 'node:fs';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';
import { resolveRiftBuildingVisibility, validateRiftBuildingVisibility } from '../public/rift-building-visibility.js';

const failures = [];
const unit = validateRiftBuildingVisibility();
if (!unit.ok) failures.push(...unit.failures);

function verifyNoCameraCutaway(compiled, label) {
  if (compiled.visibility?.mode !== 'metadata-only-no-cutaway') {
    failures.push(`${label} visibility mode ${compiled.visibility?.mode || 'missing'} is not metadata-only-no-cutaway`);
  }
  if ((compiled.stats.visibilityLayers || 0) !== 0) {
    failures.push(`${label} still reports ${compiled.stats.visibilityLayers} hideable visibility layers`);
  }
  for (const mesh of compiled.meshes) {
    if ((mesh.visibilityLayers || []).length) {
      failures.push(`${label} section ${mesh.section.join(',')} still contains camera-hideable render layers`);
    }
  }
}

function verifyStructureMetadata(compiled, label) {
  const structures = compiled.visibility?.structures || [];
  if (!structures.length) {
    failures.push(`${label} produced no building visibility metadata`);
    return;
  }

  const sample = structures.find(structure =>
    structure?.interior && structure?.bounds && Number.isFinite(structure?.floorY) && Number.isFinite(structure?.roofY)
  );
  if (!sample) {
    failures.push(`${label} building metadata has no structure suitable for containment/blocker validation`);
    return;
  }

  const insidePlayer = [
    (sample.interior.minX + sample.interior.maxX) * 0.5,
    sample.floorY + 1,
    (sample.interior.minZ + sample.interior.maxZ) * 0.5
  ];
  const inside = resolveRiftBuildingVisibility({
    structures,
    playerPosition: insidePlayer,
    cameraPosition: [sample.bounds.min[0] - 24, sample.roofY + 4, sample.bounds.min[2] - 24]
  });
  if (!inside.insideStructures.includes(sample.id)) failures.push(`${label} ${sample.name || sample.id} inside containment metadata missing`);
  if (inside.hiddenLayers.size || inside.suppressedStructures.length) failures.push(`${label} inside view hides roof/wall/floor geometry`);

  const outsidePlayer = [sample.bounds.max[0] + 3, sample.floorY + 1, (sample.bounds.min[2] + sample.bounds.max[2] + 1) * 0.5];
  const outside = resolveRiftBuildingVisibility({
    structures,
    playerPosition: outsidePlayer,
    cameraPosition: [sample.bounds.min[0] - 24, sample.roofY + 4, outsidePlayer[2]]
  });
  if (!outside.blockingStructures.includes(sample.id)) failures.push(`${label} ${sample.name || sample.id} exterior blocker metadata missing`);
  if (outside.hiddenLayers.size || outside.suppressedStructures.length) failures.push(`${label} outside view hides roof/wall/floor geometry`);

  const overview = resolveRiftBuildingVisibility({
    structures,
    playerPosition: insidePlayer,
    cameraPosition: [sample.bounds.min[0] - 24, sample.roofY + 24, sample.bounds.min[2] - 24],
    overview: true
  });
  if (overview.hiddenLayers.size || overview.suppressedStructures.length) failures.push(`${label} overview hides geometry`);
}

try {
  const activeDocument = JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/downtown-block-001.json', import.meta.url), 'utf8'));
  const active = compileRiftCityBlock(activeDocument);
  verifyNoCameraCutaway(active, 'active base world');

  const activeStructures = active.visibility?.structures || [];
  if (activeDocument.id === 'riftcity-base-world-001') {
    if (activeStructures.length) failures.push(`base-world reset unexpectedly produced ${activeStructures.length} building visibility structure(s)`);
  } else {
    verifyStructureMetadata(active, 'active world');
  }

  // The reset world intentionally has no buildings, so keep a source-controlled
  // building fixture as the integration test for containment/blocker metadata.
  const fixtureDocument = JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/blueprint-example-downtown-cross.json', import.meta.url), 'utf8'));
  const fixture = compileRiftCityBlock(fixtureDocument);
  verifyNoCameraCutaway(fixture, 'building fixture');
  verifyStructureMetadata(fixture, 'building fixture');
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[building-visibility-check] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('[building-visibility-check] base world may be empty; building fixture metadata retained; roofs, walls and stacked floors are never camera-hidden: PASS');
