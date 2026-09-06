import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (ok, message) => { if (!ok) throw new Error(`Security smoke v1 check failed: ${message}`); };

const worker = read('src/realtime-entry.js');
const auto = read('public/rift-auto-validation.js');
const guard = read('public/rift-validator-guard.js');
const html = read('public/index.html');
const app = read('public/app.js');
const integrityCheck = read('scripts/check-integrity-chain.mjs');
const pkg = JSON.parse(read('package.json'));

for (const token of [
  '/api/anticheat/session-status',
  "https://player-state/anticheat-status",
  "url.pathname === '/anticheat-status'",
  'rift-survival-anticheat-session-status-v1',
  "mode: 'service-key-read-only'",
  'repositoryBound: false',
  "writeAuthority: 'admin-only'",
  'serverPrivate: true',
  'stateResidentInRam: Boolean(selected?.state)'
]) assert(worker.includes(token), `server missing ${token}`);

assert(worker.indexOf("url.pathname === '/api/anticheat/session-status'") < worker.indexOf("url.pathname.startsWith('/api/anticheat/')"), 'self-only session status must route before reviewer API');
assert(worker.includes('verifyIntegrityTransport(request, auth)'), 'session status must require integrity ticket');
assert(!/riskScore\s*:/.test(worker.match(/antiCheatStatus\(request\)[\s\S]*?\n\s*async connect\(request\)/)?.[0] || ''), 'self-session status must not expose bot risk score');
assert(!/signals\s*:/.test(worker.match(/antiCheatStatus\(request\)[\s\S]*?\n\s*async connect\(request\)/)?.[0] || ''), 'self-session status must not expose bot signals');

for (const token of [
  "'security authority + anti-cheat session'",
  "'/api/anticheat/session-status'",
  'integrityApi.transportHeaders',
  "registerProvider('security-smoke'",
  'securitySmoke: state.securitySmoke',
  'exercisesSecurityAuthoritySmoke: true',
  'capturesSecuritySmokeInL3: true',
  'exposesRiskScoreToClient: false',
  'exposesBotSignalsToClient: false'
]) assert(auto.includes(token), `auto validation missing ${token}`);

for (const id of [
  'security.anticheat-session',
  'security.authority-policy',
  'security.reviewer-boundary',
  'security.integrity-binding'
]) assert(guard.includes(`'${id}'`), `validator missing ${id}`);
assert(guard.includes("provider(instance, 'security-smoke', 2)"), 'validator must read security-smoke provider');

for (const token of [
  '/app.js?v=20260906-island-v3-r2',
  '/rift-validator-guard.js?v=20260902-zone-authority-r1',
  '/rift-auto-validation.js?v=20260902-zone-authority-r1'
]) assert(html.includes(token), `cache bust missing ${token}`);
assert(app.includes("APP_DIAGNOSTIC_BUILD = '20260906-island-v3-r2'"), 'diagnostic build tag not bumped');
assert(integrityCheck.includes('/app.js?v=20260906-island-v3-r2'), 'integrity verifier app cache contract stale');
assert(integrityCheck.includes('/rift-validator-guard.js?v=20260902-zone-authority-r1'), 'integrity verifier validator cache contract stale');

const build = String(pkg.scripts?.build || '');
assert(build.includes('node scripts/check-security-smoke-v1.mjs'), 'core build missing security smoke verifier');
assert(!fs.existsSync('scripts/apply-security-smoke-v1.mjs'), 'temporary security smoke patcher must be removed');
assert(!fs.existsSync('.github/workflows/apply-security-smoke-v1.yml'), 'temporary security smoke workflow must be removed');

console.log('RiftSurvival Security Smoke v1 verified: validator + full auto smoke + L3 provider + self-only dynamic RAM anti-cheat health + repository-independent reviewer boundary + client privacy boundary.');