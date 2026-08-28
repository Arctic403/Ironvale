import { readFile, access } from 'node:fs/promises';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const indexPath = join(root, 'public', 'riftcity-blocks', 'world-index.json');
const index = JSON.parse(await readFile(indexPath, 'utf8'));

function fail(message) {
  console.error(`Rift world index FAIL: ${message}`);
  process.exitCode = 1;
}

if (index?.format !== 'riftcity-world-index') fail('format must be riftcity-world-index.');
if (Number(index?.version) !== 1) fail('version must be 1.');
if (!Array.isArray(index?.blocks) || index.blocks.length === 0) fail('blocks must contain at least one entry.');

const ids = new Set();
for (const entry of index.blocks || []) {
  const id = String(entry?.id || '');
  const path = String(entry?.path || '');
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)) { fail(`invalid block id ${id || '(empty)'}.`); continue; }
  if (ids.has(id)) fail(`duplicate block id ${id}.`);
  ids.add(id);
  if (!path || /^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('/')) { fail(`${id} must use a relative JSON path.`); continue; }

  const filePath = normalize(join(dirname(indexPath), path));
  const rel = relative(join(root, 'public', 'riftcity-blocks'), filePath);
  if (rel.startsWith('..') || rel === '') { fail(`${id} path escapes public/riftcity-blocks.`); continue; }
  try { await access(filePath); }
  catch { fail(`${id} path does not exist: ${path}`); continue; }

  try {
    const block = JSON.parse(await readFile(filePath, 'utf8'));
    if (block?.format !== 'riftcity-city-block') fail(`${id} target is not a riftcity-city-block.`);
    if (String(block?.id || '') !== id) fail(`${id} does not match target block id ${block?.id || '(empty)'}.`);
  } catch (error) {
    fail(`${id} target JSON is invalid: ${error.message}`);
  }
}

if (!ids.has(String(index?.activeBlockId || ''))) fail(`activeBlockId ${index?.activeBlockId || '(empty)'} is not listed.`);

if (!process.exitCode) console.log(`Rift world index PASS: ${index.blocks.length} block(s), active ${index.activeBlockId}.`);
