import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRiftBuildingProgram } from '../public/rift-building-program.js';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';
import { decodeRiftBlockState, RIFT_BLOCK_SHAPES } from '../public/rift-block-shapes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'public', 'riftcity-buildings');
const failures = [];
const summaries = [];

function stable(value) { return JSON.stringify(value); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

if (!fs.existsSync(sourceDir)) {
  console.error('Missing public/riftcity-buildings directory.');
  process.exit(1);
}

const files = fs.readdirSync(sourceDir)
  .filter(name => name.endsWith('.json') && !name.endsWith('.report.json'))
  .sort();

if (!files.length) failures.push('No BuildingProgram sources found.');

for (const name of files) {
  const sourcePath = path.join(sourceDir, name);
  try {
    const source = readJson(sourcePath);
    const result = compileRiftBuildingProgram(source, { strict: true });
    const runtime = compileRiftCityBlock(result.document);
    if (!runtime?.stats?.triangles || !runtime?.stats?.cells) failures.push(`${name}: generated runtime block produced no geometry.`);
    if (!result.report.ok) failures.push(`${name}: report is not ok.`);
    if (!result.report.semantics?.worldBounds || !result.report.semantics?.chunk?.id) failures.push(`${name}: missing world-coordinate/chunk semantics.`);
    if (!result.report.stats?.entrances) failures.push(`${name}: building has no compiled entrance anchors.`);
    if (source.building?.interior) {
      const interior = result.report.semantics?.interior;
      if (!interior) failures.push(`${name}: interior source produced no interior semantics.`);
      if (result.report.stats.unreachableSpaces) failures.push(`${name}: ${result.report.stats.unreachableSpaces} interior space(s) are unreachable.`);
      if (result.report.stats.blockedPortals) failures.push(`${name}: ${result.report.stats.blockedPortals} interior portal(s) are blocked.`);
      if (result.report.stats.invalidVerticalCores) failures.push(`${name}: ${result.report.stats.invalidVerticalCores} vertical core(s) are invalid.`);
      for (const portal of interior?.portals || []) {
        const blocked = (portal.openingCellsWorld || []).filter(cell => runtime.grid.getBlockWorld(...cell)).length;
        if (blocked) failures.push(`${name}: portal ${portal.id} is re-blocked by ${blocked} final runtime cell(s).`);
      }
      for (const core of interior?.verticalCores || []) {
        for (const cell of core.openingCellsWorld || []) {
          const state = runtime.grid.getBlockWorld(...cell);
          if (!state) continue;
          if (decodeRiftBlockState(state).shape !== RIFT_BLOCK_SHAPES.stair) {
            failures.push(`${name}: vertical core ${core.id} is re-capped at ${cell.join(',')}.`);
            break;
          }
        }
      }
    }

    const reportPath = source.output?.report_path ? path.resolve(root, source.output.report_path) : null;
    if (reportPath) {
      if (!fs.existsSync(reportPath)) failures.push(`${name}: missing report ${path.relative(root, reportPath)}.`);
      else if (stable(readJson(reportPath)) !== stable(result.report)) failures.push(`${name}: diagnostic report is stale; recompile BuildingProgram.`);
    }

    summaries.push({
      id: result.report.sourceProgramId,
      ops: result.report.stats.operations,
      cells: result.report.stats.structuralCells,
      tris: runtime.stats.triangles,
      anchors: result.report.stats.anchors,
      chunks: result.report.semantics.chunk.id,
      notices: result.report.stats.notices,
      spaces: result.report.stats.spaces || 0,
      portals: result.report.stats.portals || 0,
      cores: result.report.stats.verticalCores || 0
    });
  } catch (error) {
    failures.push(`${name}: ${error?.message || error}`);
  }
}

if (failures.length) {
  console.error('Rift BuildingProgram verification failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Rift BuildingProgram verification passed.');
for (const item of summaries) {
  const interior = item.spaces ? ` · ${item.spaces} spaces · ${item.portals} portals · ${item.cores} vertical cores` : '';
  console.log(`- ${item.id}: ${item.ops} ops · ${item.cells} structural cells · ${item.tris} tris · ${item.anchors} anchors${interior} · chunk ${item.chunks} · ${item.notices} notice(s)`);
}