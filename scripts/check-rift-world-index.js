import { readFile, access } from 'node:fs/promises';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRiftBuildingProgram } from '../public/rift-building-program.js';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = join(root, 'public');
const blockRoot = join(publicRoot, 'rift-world-blocks');
const buildingRoot = join(publicRoot, 'rift-buildings');
const indexPath = join(blockRoot, 'world-index.json');
const index = JSON.parse(await readFile(indexPath, 'utf8'));

function fail(message) {
  console.error(`Rift world index FAIL: ${message}`);
  process.exitCode = 1;
}

function staysInside(rootPath, filePath) {
  const rel = relative(rootPath, filePath);
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`);
}

if (index?.format !== 'riftcity-world-index') fail('format must be riftcity-world-index.');
if (Number(index?.version) !== 1) fail('version must be 1.');
if (!Array.isArray(index?.blocks) || index.blocks.length === 0) fail('blocks must contain at least one entry.');

const ids = new Set();
for (const entry of index.blocks || []) {
  const id = String(entry?.id || '');
  const sourcePath = String(entry?.path || '');
  const sourceType = String(entry?.source_type || entry?.sourceType || 'city-block').toLowerCase();
  const isBuildingProgram = sourceType === 'building-program';
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)) { fail(`invalid block id ${id || '(empty)'}.`); continue; }
  if (ids.has(id)) fail(`duplicate block id ${id}.`);
  ids.add(id);
  if (!sourcePath || /^(?:[a-z]+:)?\/\//i.test(sourcePath) || sourcePath.startsWith('/')) { fail(`${id} must use a relative JSON path.`); continue; }
  if (!['city-block', 'building-program'].includes(sourceType)) { fail(`${id} uses unsupported source_type '${sourceType}'.`); continue; }

  const filePath = normalize(join(dirname(indexPath), sourcePath));
  const allowedRoot = isBuildingProgram ? buildingRoot : blockRoot;
  if (!staysInside(allowedRoot, filePath)) { fail(`${id} path escapes ${relative(root, allowedRoot)}.`); continue; }
  try { await access(filePath); }
  catch { fail(`${id} path does not exist: ${sourcePath}`); continue; }

  try {
    const source = JSON.parse(await readFile(filePath, 'utf8'));
    if (isBuildingProgram) {
      if (source?.format !== 'riftcity-building-program') { fail(`${id} target is not a riftcity-building-program.`); continue; }
      const authored = compileRiftBuildingProgram(source, { strict: true });
      if (String(authored.document?.id || '') !== id) fail(`${id} does not match compiled BuildingProgram block id ${authored.document?.id || '(empty)'}.`);
      const runtime = compileRiftCityBlock(authored.document);
      if (!runtime?.stats?.cells || !runtime?.stats?.triangles) fail(`${id} BuildingProgram compiles to empty runtime geometry.`);
      console.log(`Rift BuildingProgram source PASS: ${id} · ${authored.report.stats.operations} ops · ${runtime.stats.cells} cells · chunk ${authored.report.semantics.chunk.id}.`);
    } else {
      if (source?.format !== 'riftcity-city-block') fail(`${id} target is not a riftcity-city-block.`);
      if (String(source?.id || '') !== id) fail(`${id} does not match target block id ${source?.id || '(empty)'}.`);
    }
  } catch (error) {
    fail(`${id} target JSON/compiler validation failed: ${error.message}`);
  }
}

if (!ids.has(String(index?.activeBlockId || ''))) fail(`activeBlockId ${index?.activeBlockId || '(empty)'} is not listed.`);

if (!process.exitCode) console.log(`Rift world index PASS: ${index.blocks.length} source(s), active ${index.activeBlockId}.`);