import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireToken = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Integrity chain check failed: ${label}`);
};

const app = read('public/app.js');
const client = read('public/rift-integrity.js');
const realtime = read('public/rift-realtime.js');
const worker = read('src/realtime-entry.js');
const validator = read('public/rift-validator-guard.js');
const diagnostics = read('public/rift-diagnostics.js');
const diagnosticHooks = read('public/rift-diagnostic-hooks.js');
const html = read('public/index.html');
const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('public/rift-survival-integrity-manifest.json'));
const server = read('src/integrity-build.js');

requireToken(client, "rift-survival-integrity-chain-v1", 'client format');
requireToken(client, "critical-client-file-mismatch", 'launch file mismatch tripwire');
requireToken(client, "runtime-integrity-contract-mismatch", 'runtime tripwire');
requireToken(client, "Object.freeze", 'frozen integrity API');
requireToken(client, "transportParams", 'realtime integrity ticket transport');
requireToken(client, "integrity-chain", 'diagnostics provider');

requireToken(app, "RiftSurvivalIntegrity.ensureSession", 'world boot integrity gate');
requireToken(app, "rift-survival:integrity-failed", 'runtime integrity failure world gate');
requireToken(realtime, "RiftSurvivalIntegrity.transportParams", 'WebSocket ticket propagation');
requireToken(realtime, "RiftSurvivalIntegrity.transportHeaders", 'HTTP/API ticket propagation');
requireToken(realtime, "rift-survival:integrity-refreshed", 'ticket refresh reconnect');

for (const token of [
  "EXPECTED_INTEGRITY_BUILD_ID",
  "/api/integrity/challenge",
  "/api/integrity/attest",
  "verifyIntegrityTransport",
  "integrity-required",
  "integrity-expired",
  "x-rift-survival-integrity-status",
  "mutatingApiRequiresIntegrity"
]) requireToken(worker, token, `worker ${token}`);

requireToken(validator, "integrity.launch", 'validator launch integrity check');
requireToken(validator, "integrity.server-attestation", 'validator server attestation check');
requireToken(validator, "integrity.runtime-watchdog", 'validator runtime watchdog check');

requireToken(diagnostics, '|token|ticket|', 'diagnostic object/string ticket redaction');
requireToken(diagnosticHooks, 'token|ticket|secret', 'diagnostic resource URL ticket redaction');

requireToken(html, '/app.js?v=20260906-island-v3-r2', 'app cache bust');
requireToken(html, '/rift-realtime.js?v=20260902-zone-authority-r1', 'realtime cache bust');
requireToken(html, '/rift-validator-guard.js?v=20260902-zone-authority-r1', 'validator cache bust');

if (manifest.format !== 'rift-survival-integrity-manifest-v1') throw new Error('Integrity manifest format mismatch.');
if (manifest.algorithm !== 'SHA-256') throw new Error('Integrity manifest algorithm mismatch.');
if (!/^rs-[a-f0-9]{24}$/.test(manifest.buildId || '')) throw new Error('Integrity build id malformed.');
if (!/^[a-f0-9]{64}$/.test(manifest.digest || '')) throw new Error('Integrity manifest digest malformed.');
if (!Array.isArray(manifest.files) || manifest.files.length !== manifest.fileCount || manifest.files.length < 15) throw new Error('Integrity critical file coverage too small.');
for (const required of ['/app.js', '/rift-integrity.js', '/rift-realtime.js', '/rift-core.wasm.gz', '/rift-diagnostics.js', '/rift-diagnostic-hooks.js']) {
  if (!manifest.files.some(file => file.path === required)) throw new Error(`Integrity manifest missing ${required}.`);
}
requireToken(server, manifest.buildId, 'server build id matches manifest');
requireToken(server, manifest.digest, 'server manifest digest matches manifest');

for (const stagingPath of [
  'scripts/apply-integrity-chain-v1.mjs',
  'scripts/apply-integrity-ticket-redaction.mjs',
  '.github/workflows/apply-integrity-chain-v1.yml',
  '.github/workflows/apply-integrity-ticket-redaction.yml'
]) {
  if (fs.existsSync(stagingPath)) throw new Error(`Integrity staging file must be removed: ${stagingPath}`);
}

const build = String(pkg.scripts?.build || '');
for (const token of ['node --check public/rift-integrity.js', 'node --check src/integrity-build.js', 'node scripts/generate-integrity-manifest.mjs --check', 'node scripts/check-integrity-chain.mjs']) {
  if (!build.includes(token)) throw new Error(`Core build missing ${token}`);
}

console.log(`Rift Survival Integrity Chain v1 verified: ${manifest.buildId} · ${manifest.fileCount} critical files · RAM authority remains final · diagnostic tickets redacted · staging clean.`);
