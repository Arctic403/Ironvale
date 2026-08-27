import fs from 'node:fs';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';
import { resolveRiftBuildingVisibility, validateRiftBuildingVisibility } from '../public/rift-building-visibility.js';

const failures = [];
const unit = validateRiftBuildingVisibility();
if (!unit.ok) failures.push(...unit.failures);

try {
  const document = JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/downtown-block-001.json', import.meta.url), 'utf8'));
  const compiled = compileRiftCityBlock(document);
  if (compiled.visibility?.mode !== 'structured-building-layers') failures.push('compiled block lost structured visibility mode');
  if (compiled.visibility?.structures?.length !== 4) failures.push(`Commerce Block 01 visibility shell count ${compiled.visibility?.structures?.length || 0} != 4`);

  let aggregateTriangles = 0;
  let layeredTriangles = 0;
  let layeredMeshes = 0;
  for (const mesh of compiled.meshes) {
    aggregateTriangles += mesh.geometry?.triangles || 0;
    for (const layer of mesh.visibilityLayers || []) {
      layeredTriangles += layer.geometry?.triangles || 0;
      layeredMeshes += 1;
    }
  }
  if (aggregateTriangles !== layeredTriangles) failures.push(`visibility layers cover ${layeredTriangles} triangles but aggregate mesh has ${aggregateTriangles}`);
  if (layeredMeshes <= compiled.meshes.length) failures.push('structured visibility did not partition any section into semantic render layers');

  const mercer = compiled.visibility.structures.find(structure => structure.name === 'Mercer Apartments');
  if (!mercer) {
    failures.push('Mercer Apartments visibility shell missing');
  } else {
    if (!mercer.roofAttachments?.some(entry => entry.name === 'Mercer rooftop utility box')) {
      failures.push('Mercer rooftop utility box is not owned by the Mercer roof layer');
    }

    const insidePlayer = [
      (mercer.interior.minX + mercer.interior.maxX) * 0.5,
      mercer.floorY + 1,
      (mercer.interior.minZ + mercer.interior.maxZ) * 0.5
    ];
    const inside = resolveRiftBuildingVisibility({
      structures: compiled.visibility.structures,
      playerPosition: insidePlayer,
      cameraPosition: [-24, 30, -24]
    });
    if (!inside.hiddenLayers.has(mercer.layers.roof)) failures.push('player inside Mercer does not hide Mercer roof/attachments');
    if (!inside.hiddenLayers.has(mercer.layers.walls.west) || !inside.hiddenLayers.has(mercer.layers.walls.north)) failures.push('camera-facing Mercer walls are not hidden');
    if (inside.hiddenLayers.has('base')) failures.push('base geometry can never be hidden');

    const outsidePlayer = [
      mercer.bounds.max[0] + 3,
      mercer.floorY + 1,
      (mercer.bounds.min[2] + mercer.bounds.max[2] + 1) * 0.5
    ];
    const outsideCamera = [
      mercer.bounds.min[0] - 24,
      mercer.roofY + 18,
      outsidePlayer[2]
    ];
    const outside = resolveRiftBuildingVisibility({
      structures: compiled.visibility.structures,
      playerPosition: outsidePlayer,
      cameraPosition: outsideCamera
    });
    if (!outside.blockingStructures.includes(mercer.id)) failures.push('Mercer was not detected as the actual exterior camera blocker');
    if (outside.hiddenLayers.has(mercer.layers.roof)) failures.push('Mercer roof disappeared while player was outside');
    if (!outside.hiddenLayers.has(mercer.layers.walls.west)) failures.push('Mercer camera-entry wall did not cut away for an outside player');
    if (outside.hiddenLayers.has(mercer.layers.walls.east)) failures.push('Mercer far wall was hidden during exterior occlusion');

    const unrelated = compiled.visibility.structures.filter(structure => structure.id !== mercer.id);
    for (const structure of unrelated) {
      if (outside.hiddenLayers.has(structure.layers.roof)) {
        failures.push(`nearby ${structure.name} roof disappeared even though Mercer was the blocker`);
      }
    }

    const overview = resolveRiftBuildingVisibility({
      structures: compiled.visibility.structures,
      playerPosition: insidePlayer,
      cameraPosition: [-24, 30, -24],
      overview: true
    });
    if (overview.hiddenLayers.size) failures.push('city overview does not restore full building geometry');
  }

  if ((compiled.stats.visibilityRoofAttachments || 0) < 2) {
    failures.push(`Commerce Block 01 detected only ${compiled.stats.visibilityRoofAttachments || 0} rooftop attachments; expected Mercer and Warehouse utility boxes`);
  }
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[building-visibility-check] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[building-visibility-check] inside roofs + roof props, outside exact-wall cutaway, nearby-roof isolation and overview restore: PASS');
