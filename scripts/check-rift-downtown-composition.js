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
  if (result.stats.overlayOperations < 80) failures.push(`Bank generated only ${result.stats.overlayOperations} ops; detailed benchmark unexpectedly collapsed.`);
  if (!result.document.ops.some(op => op._worldOverlayId === 'riftcity-bank-001')) failures.push('Composed district contains no tagged Bank overlay operations.');
  if (result.document.ops.some(op => RIFT_DOWNTOWN_BANK_REPLACEMENT.removeNames.includes(String(op?.name || '')))) failures.push('Legacy Bank operations remain after composition.');

  const semantics = result.overlay.semantics;
  const lotMin = [186, 0, 26], lotMax = [229, 24, 69];
  const boundsInside = semantics.worldBounds.min.every((v, i) => v >= lotMin[i]) && semantics.worldBounds.max.every((v, i) => v <= lotMax[i]);
  if (!boundsInside) failures.push(`Bank world bounds ${semantics.worldBounds.min.join(',')} -> ${semantics.worldBounds.max.join(',')} escape the NE bank lot.`);
  if (semantics.floors.length !== 4) failures.push(`Bank floor metadata ${semantics.floors.length} != 4.`);
  if (semantics.entrances.length < 3) failures.push(`Bank entrances ${semantics.entrances.length} < 3.`);
  if (semantics.rooms.length < 10) failures.push(`Bank rooms ${semantics.rooms.length} < 10.`);
  if (!semantics.anchors.some(anchor => anchor.id === 'bank-teller-counter')) failures.push('Bank teller gameplay anchor is missing.');
  if (!semantics.anchors.some(anchor => anchor.id === 'bank-vault-door')) failures.push('Bank vault anchor is missing.');

  const compiled = compileRiftCityBlock(result.document);
  if (compiled.stats.cells < 85000) failures.push(`Composed Downtown cell count ${compiled.stats.cells} is unexpectedly low.`);
  if (compiled.stats.triangles < 300000) failures.push(`Composed Downtown triangle count ${compiled.stats.triangles} is unexpectedly low.`);
  if (!result.document.metadata?.world_composition?.overlays?.some(item => item.id === 'riftcity-bank-001')) failures.push('Bank composition metadata is missing.');

  if (!failures.length) {
    console.log(`[downtown-composition] PASS · bank ${result.overlay.report.stats.structuralCells.toLocaleString()} structural cells / ${result.stats.overlayOperations} ops · Downtown ${compiled.stats.cells.toLocaleString()} cells / ${compiled.stats.triangles.toLocaleString()} tris · ${semantics.rooms.length} rooms · ${semantics.anchors.length} anchors.`);
  }
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
}

if (failures.length) {
  console.error('[downtown-composition] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
