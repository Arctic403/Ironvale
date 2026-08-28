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

  const atrium = bank.site_ops?.find(op => op.name === 'Bank huge double-height lobby atrium void');
  if (!atrium || atrium.op !== 'cut_box') failures.push('Huge double-height lobby atrium cut is missing.');
  else {
    const atriumWidth = atrium.max[0] - atrium.min[0] + 1;
    const atriumDepth = atrium.max[2] - atrium.min[2] + 1;
    if (atriumWidth < 24 || atriumDepth < 14) failures.push(`Lobby atrium ${atriumWidth}x${atriumDepth}m is too small for the MMO benchmark.`);
  }

  if (semantics.entrances.length < 3) failures.push(`Bank entrances ${semantics.entrances.length} < 3.`);
  if (semantics.rooms.length < 12) failures.push(`Bank rooms ${semantics.rooms.length} < 12.`);
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
    console.log(`[downtown-composition] PASS · bank ${result.overlay.report.stats.structuralCells.toLocaleString()} structural cells / ${result.stats.overlayOperations} ops · footprint ${footprintWidth}x${footprintDepth}m · B1 + 3 floors · 250-player target · Downtown ${compiled.stats.cells.toLocaleString()} cells / ${compiled.stats.triangles.toLocaleString()} tris · bounds volume ${result.stats.boundsVolume.toLocaleString()}.`);
  }
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[downtown-composition] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
