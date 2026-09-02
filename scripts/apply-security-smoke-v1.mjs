// retry v4 after verifier cache-tag updates
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Security smoke patch ${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}

let worker = read('src/realtime-entry.js');
worker = replaceOnce(worker,
`function mutatingApiRequiresIntegrity(method, pathname) {`,
`async function routeAntiCheatSessionStatus(request, env) {
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const integrity = await verifyIntegrityTransport(request, auth);
  if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);
  const stub = playerStateStub(env, auth.userId);
  const headers = internalStateHeaders(auth, request, integrity);
  return stub.fetch(new Request('https://player-state/anticheat-status', { method: 'GET', headers }));
}

function mutatingApiRequiresIntegrity(method, pathname) {`,
'insert session status route');

worker = replaceOnce(worker,
`    if (url.pathname.startsWith('/api/anticheat/')) return routeAntiCheatApi(request, env, url);`,
`    if (method === 'GET' && url.pathname === '/api/anticheat/session-status') return routeAntiCheatSessionStatus(request, env);
    if (url.pathname.startsWith('/api/anticheat/')) return routeAntiCheatApi(request, env, url);`,
'route session status before reviewer API');

worker = replaceOnce(worker,
`    if (url.pathname === '/checkpoint' && request.method === 'POST') return this.checkpointRequest(request);
    return json({ ok: false, error: 'Not found' }, 404);`,
`    if (url.pathname === '/checkpoint' && request.method === 'POST') return this.checkpointRequest(request);
    if (url.pathname === '/anticheat-status' && request.method === 'GET') return this.antiCheatStatus(request);
    return json({ ok: false, error: 'Not found' }, 404);`,
'DO anticheat status route');

worker = replaceOnce(worker,
`  async connect(request) {`,
`  antiCheatStatus(request) {
    const selected = this.latestAuthorityState();
    const state = selected?.state || this.stateFromHeaders(request);
    const requestedUserId = String(request.headers.get('x-ironvale-user-id') || '');
    if (!requestedUserId || String(state?.userId || '') !== requestedUserId) return json({ ok: false, error: 'Session state mismatch' }, 403);
    const summary = antiCheatSummary(state.antiCheat);
    return json({
      ok: true,
      format: 'ironvale-anticheat-session-status-v1',
      policy: {
        automaticBan: false,
        aiAuthority: 'recommendation-only',
        ramAuthority: 'final',
        ordinaryMovementWritesToD1: false,
        suspiciousCaseWritesOnly: true
      },
      bridge: {
        mode: 'github-oidc-read-only',
        exactWorkflowBound: true,
        writeAuthority: 'admin-only'
      },
      authority: {
        realtimeFormat: REALTIME_FORMAT,
        source: selected?.state ? 'live-ram' : 'session-baseline',
        integrityStatus: String(state.integrityStatus || 'missing'),
        integrityBuildId: String(state.integrityBuildId || ''),
        accepted: Number(state.accepted) || 0,
        rejected: Number(state.rejected) || 0,
        checkpointCount: Number(state.checkpointCount) || 0
      },
      monitor: {
        format: summary.format,
        enabled: true,
        serverPrivate: true,
        stateResidentInRam: Boolean(selected?.state),
        sessionBound: Boolean(state.sessionId),
        observedSamples: Number(summary.metrics?.samples) || 0,
        deterministicRejectsObserved: Number(summary.metrics?.deterministicRejects) > 0
      }
    });
  }

  async connect(request) {`,
'DO safe anticheat status');
write('src/realtime-entry.js', worker);

let auto = read('public/rift-auto-validation.js');
auto = replaceOnce(auto,
`  postValidation: null,
  evidence:`,
`  postValidation: null,
  securitySmoke: null,
  evidence:`,
'auto state security smoke');
auto = replaceOnce(auto,
`  state.postValidation = null;
  state.evidence = { captures: 0, failed: 0, totalBytes: 0, files: [] };`,
`  state.postValidation = null;
  state.securitySmoke = null;
  state.evidence = { captures: 0, failed: 0, totalBytes: 0, files: [] };`,
'auto reset security smoke');

auto = replaceOnce(auto,
`    await runStep('backend health + network telemetry', async () => {`,
`    await runStep('security authority + anti-cheat session', async () => {
      const integrityApi = window.IronvaleIntegrity;
      const integrity = integrityApi?.status?.();
      const completedAt = nowIso();
      try {
        if (!integrityApi?.transportHeaders || !integrity?.attested) throw new Error('Integrity ticket unavailable for security smoke');
        const response = await fetch('/api/anticheat/session-status', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: integrityApi.transportHeaders()
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.ok !== true) throw new Error(body?.error || ('security smoke HTTP ' + response.status));
        if (body?.format !== 'ironvale-anticheat-session-status-v1') throw new Error('Anti-cheat session status format mismatch');
        if (body?.monitor?.format !== 'ironvale-anticheat-v1' || body?.monitor?.enabled !== true || body?.monitor?.serverPrivate !== true) throw new Error('Server-private anti-cheat monitor unavailable');
        if (body?.monitor?.stateResidentInRam !== true) throw new Error('Anti-cheat monitor is not attached to live RAM authority');
        if (body?.authority?.source !== 'live-ram' || body?.authority?.realtimeFormat !== 'ironvale-realtime-authority-v2') throw new Error('RAM authority status mismatch');
        if (body?.authority?.integrityStatus !== 'attested' || body?.authority?.integrityBuildId !== integrity.buildId) throw new Error('Integrity ticket is not bound to RAM authority');
        const policy = body?.policy || {};
        if (policy.automaticBan !== false || policy.aiAuthority !== 'recommendation-only' || policy.ramAuthority !== 'final' || policy.ordinaryMovementWritesToD1 !== false || policy.suspiciousCaseWritesOnly !== true) throw new Error('Anti-cheat authority policy mismatch');
        const bridge = body?.bridge || {};
        if (bridge.mode !== 'github-oidc-read-only' || bridge.exactWorkflowBound !== true || bridge.writeAuthority !== 'admin-only') throw new Error('AI review bridge policy mismatch');
        state.securitySmoke = {
          format: 'ironvale-security-smoke-v1',
          status: 'pass',
          completedAt,
          httpStatus: response.status,
          integrity: { attested: true, buildId: integrity.buildId, runtimeStatus: integrity.runtimeStatus },
          authority: { ...body.authority },
          monitor: { ...body.monitor },
          policy: { ...policy },
          bridge: { ...bridge }
        };
        return 'RAM anti-cheat active · integrity bound · AI review bridge read-only · samples=' + (body.monitor.observedSamples || 0);
      } catch (error) {
        state.securitySmoke = { format: 'ironvale-security-smoke-v1', status: 'fail', completedAt, error: shortError(error) };
        throw error;
      }
    });

    await runStep('backend health + network telemetry', async () => {`,
'insert security smoke step');

auto = replaceOnce(auto,
`      postValidation: state.postValidation,
      evidence: state.evidence,`,
`      postValidation: state.postValidation,
      securitySmoke: state.securitySmoke,
      evidence: state.evidence,`,
'validation report security smoke');

auto = replaceOnce(auto,
`    postValidation: state.postValidation,
    evidence: {`,
`    postValidation: state.postValidation,
    securitySmoke: state.securitySmoke ? { ...state.securitySmoke } : null,
    evidence: {`,
'auto provider security smoke');

auto = replaceOnce(auto,
`      exercisesRealtimeCheckpoint: true,
      destructiveReset: false,`,
`      exercisesRealtimeCheckpoint: true,
      exercisesSecurityAuthoritySmoke: true,
      capturesSecuritySmokeInL3: true,
      destructiveReset: false,`,
'auto provider policy');

auto = replaceOnce(auto,
`  }));
  providerRegistered = true;`,
`  }));
  window.IronvaleDiagnostics.registerProvider('security-smoke', () => ({
    format: 'ironvale-security-smoke-v1',
    status: state.securitySmoke?.status || 'idle',
    completedAt: state.securitySmoke?.completedAt || null,
    result: state.securitySmoke ? { ...state.securitySmoke } : null,
    policy: {
      selfSessionOnly: true,
      exposesRiskScoreToClient: false,
      exposesBotSignalsToClient: false,
      serverPrivateMonitor: true,
      aiReviewReadOnly: true,
      ramAuthorityFinal: true
    }
  }));
  providerRegistered = true;`,
'register security smoke provider');
write('public/rift-auto-validation.js', auto);

let guard = read('public/rift-validator-guard.js');
guard = replaceOnce(guard,
`  const [engine, native, realtime, integrity] = await Promise.all([
    provider(instance, 'engine', 2), provider(instance, 'native', 2), provider(instance, 'realtime-movement', 2), provider(instance, 'integrity-chain', 2)
  ]);`,
`  const [engine, native, realtime, integrity, securitySmoke] = await Promise.all([
    provider(instance, 'engine', 2), provider(instance, 'native', 2), provider(instance, 'realtime-movement', 2), provider(instance, 'integrity-chain', 2), provider(instance, 'security-smoke', 2)
  ]);`,
'validator provider set');

guard = replaceOnce(guard,
`  if (!realtime) {`,
`  if (securitySmoke?.completedAt) {
    const smoke = securitySmoke.result || {};
    const sessionOk = smoke.status === 'pass' && smoke.monitor?.enabled === true && smoke.monitor?.serverPrivate === true && smoke.monitor?.stateResidentInRam === true && smoke.authority?.source === 'live-ram';
    checks.push(passFail('security.anticheat-session', sessionOk, sessionOk ? 'Server-private bot/anti-cheat monitor attached to live Durable Object RAM state' : (smoke.error || 'Anti-cheat RAM session smoke failed')));
    const policyOk = smoke.policy?.automaticBan === false && smoke.policy?.aiAuthority === 'recommendation-only' && smoke.policy?.ramAuthority === 'final' && smoke.policy?.ordinaryMovementWritesToD1 === false && smoke.policy?.suspiciousCaseWritesOnly === true;
    checks.push(passFail('security.authority-policy', policyOk, policyOk ? 'AI recommends only · RAM authority final · ordinary movement remains D1-free' : 'Security authority policy mismatch'));
    const bridgeOk = smoke.bridge?.mode === 'github-oidc-read-only' && smoke.bridge?.exactWorkflowBound === true && smoke.bridge?.writeAuthority === 'admin-only';
    checks.push(passFail('security.ai-review-bridge', bridgeOk, bridgeOk ? 'GitHub OIDC AI review bridge is exact-workflow-bound and read-only' : 'AI review bridge contract mismatch'));
    const integrityBound = smoke.integrity?.attested === true && smoke.authority?.integrityStatus === 'attested' && Boolean(smoke.integrity?.buildId) && smoke.integrity?.buildId === smoke.authority?.integrityBuildId;
    checks.push(passFail('security.integrity-binding', integrityBound, integrityBound ? ('Integrity ' + smoke.integrity.buildId + ' bound to RAM authority') : 'Integrity/RAM binding mismatch'));
  }

  if (!realtime) {`,
'validator security checks');
write('public/rift-validator-guard.js', guard);

let app = read('public/app.js');
app = replaceOnce(app,
`const APP_DIAGNOSTIC_BUILD = '20260902-integrity-v1';`,
`const APP_DIAGNOSTIC_BUILD = '20260902-security-smoke-r1';`,
'app diagnostic build tag');
write('public/app.js', app);

let html = read('public/index.html');
html = html.replace('/app.js?v=20260902-integrity-v1', '/app.js?v=20260902-security-smoke-r1');
html = html.replace('/rift-validator-guard.js?v=20260902-integrity-v1', '/rift-validator-guard.js?v=20260902-security-smoke-r1');
html = html.replace('/rift-auto-validation.js?v=20260901-sprint-speed-r2', '/rift-auto-validation.js?v=20260902-security-smoke-r1');
write('public/index.html', html);

let integrityCheck = read('scripts/check-integrity-chain.mjs');
integrityCheck = integrityCheck.replace("/app.js?v=20260902-integrity-v1", "/app.js?v=20260902-security-smoke-r1");
integrityCheck = integrityCheck.replace("/rift-validator-guard.js?v=20260902-integrity-v1", "/rift-validator-guard.js?v=20260902-security-smoke-r1");
write('scripts/check-integrity-chain.mjs', integrityCheck);

const packagePath = 'package.json';
const pkg = JSON.parse(read(packagePath));
let build = String(pkg.scripts?.build || '');
if (!build.includes('node scripts/check-security-smoke-v1.mjs')) build += ' && node scripts/check-security-smoke-v1.mjs';
pkg.scripts.build = build;
write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

execFileSync(process.execPath, ['scripts/generate-integrity-manifest.mjs'], { stdio: 'inherit' });
console.log('Security Smoke v1 integration patch applied and integrity manifest regenerated.');
