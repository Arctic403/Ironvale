import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRiftBuildingProgram } from '../public/rift-building-program.js';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';

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
      notices: result.report.stats.notices
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
for (const item of summaries) console.log(`- ${item.id}: ${item.ops} ops · ${item.cells} structural cells · ${item.tris} tris · ${item.anchors} anchors · chunk ${item.chunks} · ${item.notices} notice(s)`);