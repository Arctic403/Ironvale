import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'rift-survival-integrity-manifest.json');
const SERVER_PATH = path.join(ROOT, 'src', 'integrity-build.js');
const FORMAT = 'rift-survival-integrity-manifest-v1';
const ALGORITHM = 'SHA-256';
const CRITICAL_FILES = [
  'public/index.html',
  'public/app.js',
  'public/rift-integrity.js',
  'public/rift-realtime.js',
  'public/rift-validator-guard.js',
  'public/rift-diagnostics.js',
  'public/rift-diagnostic-hooks.js',
  'public/rift-architecture-guard.js',
  'public/rift-gl-tripwire.js',
  'public/rift-geometry-guard.js',
  'public/rift-history-bridge.js',
  'public/rift-auto-validation.js',
  'public/rift-auto-validation-ui-hotfix.js',
  'public/rift-engine.js',
  'public/rift-core.js',
  'public/rift-core.wasm.gz',
  'public/rift-terrain.js',
  'public/rift-landscape.js',
  'public/rift-terrain-materials.js',
  'public/rift-character.js',
  'public/rift-scale.js'
].sort();

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildOutputs() {
  const files = CRITICAL_FILES.map(relative => {
    const absolute = path.join(ROOT, relative);
    if (!fs.existsSync(absolute)) throw new Error(`Integrity critical file missing: ${relative}`);
    const bytes = fs.readFileSync(absolute);
    return {
      path: '/' + relative.replace(/^public\//, '').replaceAll('\\', '/'),
      sha256: sha256(bytes),
      size: bytes.byteLength
    };
  });
  const canonical = { format: FORMAT, algorithm: ALGORITHM, files };
  const digest = sha256(Buffer.from(JSON.stringify(canonical)));
  const buildId = `rs-${digest.slice(0, 24)}`;
  const manifest = { ...canonical, buildId, digest, fileCount: files.length };
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const serverText = [
    `export const EXPECTED_INTEGRITY_FORMAT = '${FORMAT}';`,
    `export const EXPECTED_INTEGRITY_BUILD_ID = '${buildId}';`,
    `export const EXPECTED_INTEGRITY_MANIFEST_DIGEST = '${digest}';`,
    `export const EXPECTED_INTEGRITY_FILE_COUNT = ${files.length};`,
    ''
  ].join('\n');
  return { manifestText, serverText, buildId, digest, fileCount: files.length };
}

function checkFile(filePath, expected, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} missing; run node scripts/generate-integrity-manifest.mjs`);
  const actual = fs.readFileSync(filePath, 'utf8');
  if (actual !== expected) throw new Error(`${label} is stale; run node scripts/generate-integrity-manifest.mjs`);
}

const outputs = buildOutputs();
if (process.argv.includes('--check')) {
  checkFile(MANIFEST_PATH, outputs.manifestText, 'Integrity manifest');
  checkFile(SERVER_PATH, outputs.serverText, 'Integrity server build constants');
  console.log(`Rift Survival integrity manifest verified: ${outputs.buildId} · ${outputs.fileCount} critical files.`);
} else {
  fs.writeFileSync(MANIFEST_PATH, outputs.manifestText);
  fs.writeFileSync(SERVER_PATH, outputs.serverText);
  console.log(`Rift Survival integrity manifest generated: ${outputs.buildId} · ${outputs.fileCount} critical files.`);
}
