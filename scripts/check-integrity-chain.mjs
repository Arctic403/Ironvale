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
const html = read('public/index.html');
const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('public/ironvale-integrity-manifest.json'));
const server = read('src/integrity-build.js');

requireToken(client, "ironvale-integrity-chain-v1", 'client format');
requireToken(client, "critical-client-file-mismatch", 'launch file mismatch tripwire');
requireToken(client, "runtime-integrity-contract-mismatch", 'runtime tripwire');
requireToken(client, "Object.freeze", 'frozen integrity API');
requireToken(client, "transportParams", 'realtime integrity ticket transport');
requireToken(client, "integrity-chain", 'diagnostics provider');

requireToken(app, "IronvaleIntegrity.ensureSession", 'world boot integrity gate');
requireToken(app, "ironvale:integrity-failed", 'runtime integrity failure world gate');
requireToken(realtime, "IronvaleIntegrity.transportParams", 'WebSocket ticket propagation');
requireToken(realtime, "IronvaleIntegrity.transportHeaders", 'HTTP/API ticket propagation');
requireToken(realtime, "ironvale:integrity-refreshed", 'ticket refresh reconnect');

for (const token of [
  "EXPECTED_INTEGRITY_BUILD_ID",
  "/api/integrity/challenge",
  "/api/integrity/attest",
  "verifyIntegrityTransport",
  "integrity-required",
  "integrity-expired",
  "x-ironvale-integrity-status",
  "mutatingApiRequiresIntegrity"
]) requireToken(worker, token, `worker ${token}`);

requireToken(validator, "integrity.launch", 'validator launch integrity check');
requireToken(validator, "integrity.server-attestation", 'validator server attestation check');
requireToken(validator, "integrity.runtime-watchdog", 'validator runtime watchdog check');

requireToken(html, '/app.js?v=20260902-integrity-v1', 'app cache bust');
requireToken(html, '/rift-realtime.js?v=20260902-integrity-v1', 'realtime cache bust');
requireToken(html, '/rift-validator-guard.js?v=20260902-integrity-v1', 'validator cache bust');

if (manifest.format !== 'ironvale-integrity-manifest-v1') throw new Error('Integrity manifest format mismatch.');
if (manifest.algorithm !== 'SHA-256') throw new Error('Integrity manifest algorithm mismatch.');
if (!/^iv-[a-f0-9]{24}$/.test(manifest.buildId || '')) throw new Error('Integrity build id malformed.');
if (!/^[a-f0-9]{64}$/.test(manifest.digest || '')) throw new Error('Integrity manifest digest malformed.');
if (!Array.isArray(manifest.files) || manifest.files.length !== manifest.fileCount || manifest.files.length < 15) throw new Error('Integrity critical file coverage too small.');
for (const required of ['/app.js', '/rift-integrity.js', '/rift-realtime.js', '/rift-core.wasm.gz']) {
  if (!manifest.files.some(file => file.path === required)) throw new Error(`Integrity manifest missing ${required}.`);
}
requireToken(server, manifest.buildId, 'server build id matches manifest');
requireToken(server, manifest.digest, 'server manifest digest matches manifest');

const build = String(pkg.scripts?.build || '');
for (const token of ['node --check public/rift-integrity.js', 'node --check src/integrity-build.js', 'node scripts/generate-integrity-manifest.mjs --check', 'node scripts/check-integrity-chain.mjs']) {
  if (!build.includes(token)) throw new Error(`Core build missing ${token}`);
}

console.log(`Ironvale Integrity Chain v1 verified: ${manifest.buildId} · ${manifest.fileCount} critical files · RAM authority remains final.`);
