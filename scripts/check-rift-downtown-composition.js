import fs from 'node:fs';
import { composeRiftBuildingProgramIntoCityBlock, RIFT_DOWNTOWN_BANK_REPLACEMENT } from '../public/rift-world-composer.js';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';

const base = JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/downtown-block-001.json', import.meta.url), 'utf8'));
const bank = JSON.parse(fs.readFileSync(new URL('../public/riftcity-buildings/riftcity-bank-001.json', import.meta.url), 'utf8'));
const failures = [];

try {
  const result = composeRiftBuildingProgramIntoCityBlock(base, bank, RIFT_DOWNTOWN_BANK_REPLACEMENT);
  if (!result.overlay.report.ok) failures.push('Bank BuildingProgram report is not clean.');
  if (result.stats.removedOperations !== RIFT_DOWNTOWN_BANK_REPLACEMENT.removeNames.length) {
    failures.push(`removed ${result.stats.removedOperations} legacy bank op(s); expected ${RIFT_DOWNTOWN_BANK_REPLACEMENT.removeNames.length}`);
  }
  if (result.stats.overlayOperations < 120) failures.push(`Bank generated only ${result.stats.overlayOperations} ops; expanded MMO benchmark unexpectedly collapsed.`);
  if (!result.document.ops.some(op => op._worldOverlayId === 'riftcity-bank-001')) failures.push('Composed district contains no tagged Bank overlay operations.');
  if (result.document.ops.some(op => RIFT_DOWNTOWN_BANK_REPLACEMENT.removeNames.includes(String(op?.name || '')))) failures.push('Legacy Bank operations remain after composition.');

  const semantics = result.overlay.semantics;
  const lotMin = [181, -5, 21], lotMax = [234, 24, 77];
  const boundsInside = semantics.worldBounds.min.every((v, i) => v >= lotMin[i]) && semantics.worldBounds.max.every((v, i) => v <= lotMax[i]);
  if (!boundsInside) failures.push(`Bank world bounds ${semantics.worldBounds.min.join(',')} -> ${semantics.worldBounds.max.join(',')} escape the expanded NE bank lot.`);
  if (semantics.floors.length !== 4) failures.push(`Bank level metadata ${semantics.floors.length} != 4 (B1 + F1-F3).`);
  if (bank.building?.ground_floor !== 2) failures.push('Bank ground_floor must be level 2 so B1 remains physically below street grade.');
  if (bank.building?.occupancy_target < 250) failures.push(`Bank occupancy target ${bank.building?.occupancy_target || 0} < 250.`);
  if (bank.building?.design_rules?.min_public_corridor_width < 8) failures.push('Bank public circulation rule must remain at least 8m wide.');
  if (bank.building?.design_rules?.main_stair_width < 8) failures.push('Bank grand stair rule must remain at least 8m wide.');
  if (bank.building?.design_rules?.grand_lobby_clear_height < 10) failures.push('Bank lobby clear height must remain at least 10m.');

  const origin = bank.building?.origin || [0,0,0];
  const masses = bank.building?.masses || [];
  const minX = Math.min(...masses.map(m => origin[0] + m.origin[0]));
  const maxX = Math.max(...masses.map(m => origin[0] + m.origin[0] + m.size[0] - 1));
  const minZ = Math.min(...masses.map(m => origin[2] + m.origin[2]));
  const maxZ = Math.max(...masses.map(m => origin[2] + m.origin[2] + m.size[1] - 1));
  const footprintWidth = maxX - minX + 1;
  const footprintDepth = maxZ - minZ + 1;
  if (footprintWidth < 50 || footprintDepth < 46) failures.push(`Bank physical footprint ${footprintWidth}x${footprintDepth}m is below the MMO minimum 50x46m.`);

  const interior = semantics.interior;
  if (!interior) failures.push('Bank has no compiled Interior Architecture semantics.');
  const atrium = interior?.voids?.find(item => item.id === 'grand-lobby-atrium');
  if (!atrium) failures.push('Grand lobby atrium structural void is missing.');
  else {
    const atriumWidth = atrium.max[0] - atrium.min[0] + 1;
    const atriumDepth = atrium.max[1] - atrium.min[1] + 1;
    if (atriumWidth < 24 || atriumDepth < 14) failures.push(`Lobby atrium ${atriumWidth}x${atriumDepth}m is too small for the MMO benchmark.`);
    if (atrium.removedCells < atriumWidth * atriumDepth) failures.push(`Lobby atrium removed only ${atrium.removedCells} floor cells; expected at least ${atriumWidth * atriumDepth}.`);
  }
  if ((interior?.spaces?.length || 0) < 15) failures.push(`Bank interior spaces ${interior?.spaces?.length || 0} < 15.`);
  if ((interior?.portals?.length || 0) < 10) failures.push(`Bank interior portals ${interior?.portals?.length || 0} < 10.`);
  if ((interior?.verticalCores?.length || 0) !== 3) failures.push(`Bank vertical cores ${interior?.verticalCores?.length || 0} != 3.`);
  if (interior?.graph?.unreachable?.length) failures.push(`Bank has unreachable interior spaces: ${interior.graph.unreachable.join(', ')}.`);
  if (result.overlay.report.stats.invalidVerticalCores) failures.push(`Bank has ${result.overlay.report.stats.invalidVerticalCores} invalid vertical core(s).`);
  if (result.overlay.report.stats.blockedPortals) failures.push(`Bank has ${result.overlay.report.stats.blockedPortals} blocked interior portal(s).`);
  for (const core of interior?.verticalCores || []) {
    if (core.removedFloorCells < core.width) failures.push(`${core.id} reserved only ${core.removedFloorCells} floor-opening cells for width ${core.width}.`);
    if (core.topLandings !== core.width || core.bottomLandings !== core.width) failures.push(`${core.id} landing support is incomplete.`);
    if (core.blockedHeadroom || core.missingStairs) failures.push(`${core.id} has blocked headroom or missing stairs.`);
  }

  if (semantics.entrances.length < 3) failures.push(`Bank entrances ${semantics.entrances.length} < 3.`);
  if (semantics.rooms.length < 15) failures.push(`Bank rooms/spaces ${semantics.rooms.length} < 15.`);
  if (!semantics.anchors.some(anchor => anchor.id === 'bank-teller-counter')) failures.push('Bank teller gameplay anchor is missing.');
  if (!semantics.anchors.some(anchor => anchor.id === 'bank-vault-door')) failures.push('Bank vault anchor is missing.');
  if (!semantics.anchors.some(anchor => anchor.id === 'bank-main-stairs')) failures.push('Bank main-stair circulation anchor is missing.');

  if (result.document.bounds.min[1] !== -5) failures.push(`Composed Downtown basement bound ${result.document.bounds.min[1]} != -5.`);
  if (result.stats.boundsVolume > 2_000_000) failures.push(`Composed bounds volume ${result.stats.boundsVolume} exceeds importer safety limit.`);

  const compiled = compileRiftCityBlock(result.document);
  if (compiled.stats.cells < 85000) failures.push(`Composed Downtown cell count ${compiled.stats.cells} is unexpectedly low.`);
  if (compiled.stats.triangles < 300000) failures.push(`Composed Downtown triangle count ${compiled.stats.triangles} is unexpectedly low.`);
  if (!result.document.metadata?.world_composition?.overlays?.some(item => item.id === 'riftcity-bank-001')) failures.push('Bank composition metadata is missing.');

  if (!failures.length) {
    console.log(`[downtown-composition] PASS · bank ${result.overlay.report.stats.structuralCells.toLocaleString()} structural cells / ${result.stats.overlayOperations} ops · footprint ${footprintWidth}x${footprintDepth}m · B1 + 3 floors · 250-player target · H1.90 interior graph clean · Downtown ${compiled.stats.cells.toLocaleString()} cells / ${compiled.stats.triangles.toLocaleString()} tris · bounds volume ${result.stats.boundsVolume.toLocaleString()}.`);
  }
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[downtown-composition] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
