import fs from 'node:fs';

function replaceOnce(path, before, after, label) {
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes(after)) return false;
  if (!source.includes(before)) throw new Error(`Integrity patch missing target ${label} in ${path}`);
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
  return true;
}

function replaceAllText(path, before, after) {
  let source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) return false;
  source = source.split(before).join(after);
  fs.writeFileSync(path, source);
  return true;
}

replaceOnce(
  'public/app.js',
  "import { loadRiggedCharacterAsset } from './rift-character.js?v=20260901-run-animation-r1';",
  "import { loadRiggedCharacterAsset } from './rift-character.js?v=20260901-run-animation-r1';\nimport { IronvaleIntegrity } from './rift-integrity.js?v=20260902-integrity-v1';",
  'app integrity import'
);
replaceOnce(
  'public/app.js',
  "const APP_DIAGNOSTIC_BUILD = '20260902-dirty-region-r1';",
  "const APP_DIAGNOSTIC_BUILD = '20260902-integrity-v1';",
  'app diagnostic build'
);
replaceOnce(
  'public/app.js',
  "    const data = await api('/api/bootstrap');\n    if (!data.ok || !data.authenticated) { showAuth(); return; }\n    characterName.textContent = data.character.displayName || data.user.username;",
  "    const data = await api('/api/bootstrap');\n    if (!data.ok || !data.authenticated) { showAuth(); return; }\n    const integrity = await IronvaleIntegrity.ensureSession();\n    if (!integrity?.ok) {\n      showAuth();\n      setAuthStatus('Integrity check failed: ' + String(integrity?.reason || integrity?.status?.lastError || 'critical client files did not match the approved build'), true);\n      return;\n    }\n    characterName.textContent = data.character.displayName || data.user.username;",
  'world boot integrity gate'
);
replaceOnce(
  'public/app.js',
  "refreshDiagnosticButtons();\nbootSession();",
  "refreshDiagnosticButtons();\nwindow.addEventListener('ironvale:integrity-failed', event => {\n  try { stopWorld(); } catch (_) {}\n  showAuth();\n  setAuthStatus('Integrity access denied: ' + String(event?.detail?.reason || 'runtime integrity failure'), true);\n});\nbootSession();",
  'runtime integrity deny handler'
);

replaceOnce(
  'public/rift-realtime.js',
  "export const RIFT_REALTIME_FORMAT = 'ironvale-realtime-client-v2';",
  "import { IronvaleIntegrity } from './rift-integrity.js?v=20260902-integrity-v1';\n\nexport const RIFT_REALTIME_FORMAT = 'ironvale-realtime-client-v2';",
  'realtime integrity import'
);
replaceOnce(
  'public/rift-realtime.js',
  "function socketUrl() {\n  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';\n  return `${protocol}//${location.host}${SOCKET_PATH}`;\n}",
  "function socketUrl() {\n  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';\n  const url = new URL(`${protocol}//${location.host}${SOCKET_PATH}`);\n  const integrity = IronvaleIntegrity.transportParams();\n  if (integrity) for (const [key, value] of Object.entries(integrity)) url.searchParams.set(key, value);\n  return url.href;\n}",
  'realtime socket integrity params'
);
replaceOnce(
  'public/rift-realtime.js',
  "function shouldConnect() {\n  return navigator.onLine !== false && worldScreen?.hidden === false;\n}",
  "function shouldConnect() {\n  return navigator.onLine !== false && worldScreen?.hidden === false && IronvaleIntegrity.status().attested === true;\n}",
  'realtime integrity connection gate'
);
replaceOnce(
  'public/rift-realtime.js',
  "      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify(packet),\n      keepalive",
  "      headers: { 'Content-Type': 'application/json', ...IronvaleIntegrity.transportHeaders() },\n      body: JSON.stringify(packet),\n      keepalive",
  'fallback integrity headers'
);
replaceOnce(
  'public/rift-realtime.js',
  "      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ reason: label }),\n      keepalive: options?.keepalive === true",
  "      headers: { 'Content-Type': 'application/json', ...IronvaleIntegrity.transportHeaders() },\n      body: JSON.stringify({ reason: label }),\n      keepalive: options?.keepalive === true",
  'checkpoint integrity headers'
);
replaceOnce(
  'public/rift-realtime.js',
  "  const response = await baseFetch(input, init);\n  if (url?.origin === location.origin && url.pathname === '/api/bootstrap' && response.ok) queueMicrotask(connect);\n  return response;",
  "  let nextInput = input;\n  let nextInit = init;\n  if (url?.origin === location.origin && url.pathname.startsWith('/api/') && !['/api/integrity/challenge', '/api/integrity/attest'].includes(url.pathname)) {\n    const integrityHeaders = IronvaleIntegrity.transportHeaders();\n    if (Object.keys(integrityHeaders).length) {\n      if (input instanceof Request) {\n        const headers = new Headers(input.headers);\n        for (const [key, value] of Object.entries(integrityHeaders)) headers.set(key, value);\n        nextInput = new Request(input, { headers });\n      } else {\n        const headers = new Headers(init?.headers || {});\n        for (const [key, value] of Object.entries(integrityHeaders)) headers.set(key, value);\n        nextInit = { ...(init || {}), headers };\n      }\n    }\n  }\n  const response = await baseFetch(nextInput, nextInit);\n  if (url?.origin === location.origin && url.pathname === '/api/bootstrap' && response.ok) queueMicrotask(connect);\n  return response;",
  'generic API integrity headers'
);
replaceOnce(
  'public/rift-realtime.js',
  "    checkpointPolicy: {",
  "    integrity: IronvaleIntegrity.status(),\n    checkpointPolicy: {",
  'realtime integrity telemetry'
);
replaceOnce(
  'public/rift-realtime.js',
  "window.addEventListener('online', connect);",
  "window.addEventListener('ironvale:integrity-ready', connect);\nwindow.addEventListener('ironvale:integrity-refreshed', () => { closeSocket('integrity-refresh'); queueMicrotask(connect); });\nwindow.addEventListener('ironvale:integrity-failed', () => closeSocket('integrity-failed'));\nwindow.addEventListener('online', connect);",
  'realtime integrity event hooks'
);

replaceOnce(
  'src/realtime-entry.js',
  "import { DurableObject } from 'cloudflare:workers';",
  "import { DurableObject } from 'cloudflare:workers';\nimport { EXPECTED_INTEGRITY_BUILD_ID, EXPECTED_INTEGRITY_MANIFEST_DIGEST, EXPECTED_INTEGRITY_FILE_COUNT } from './integrity-build.js';",
  'worker integrity constants import'
);
replaceOnce(
  'src/realtime-entry.js',
  "const REALTIME_FORMAT = 'ironvale-realtime-authority-v2';",
  "const REALTIME_FORMAT = 'ironvale-realtime-authority-v2';\nconst INTEGRITY_CHALLENGE_TTL_MS = 2 * 60 * 1000;\nconst INTEGRITY_TICKET_TTL_MS = 60 * 60 * 1000;",
  'worker integrity ttl'
);
replaceOnce(
  'src/realtime-entry.js',
  "function bytesToBase64(bytes) {\n  let binary = '';\n  for (const byte of bytes) binary += String.fromCharCode(byte);\n  return btoa(binary);\n}",
  "function bytesToBase64(bytes) {\n  let binary = '';\n  for (const byte of bytes) binary += String.fromCharCode(byte);\n  return btoa(binary);\n}\n\nfunction bytesToBase64Url(bytes) {\n  return bytesToBase64(bytes).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');\n}\n\nfunction constantTimeEqual(left, right) {\n  const a = String(left || '');\n  const b = String(right || '');\n  let diff = a.length ^ b.length;\n  const length = Math.max(a.length, b.length);\n  for (let index = 0; index < length; index += 1) diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);\n  return diff === 0;\n}\n\nasync function hmacSha256(secret, value) {\n  const encoder = new TextEncoder();\n  const key = await crypto.subtle.importKey('raw', encoder.encode(String(secret || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);\n  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(value || '')));\n  return bytesToBase64Url(new Uint8Array(signature));\n}\n\nfunction challengeMessage(challenge, expiresAt) {\n  return ['challenge', challenge, expiresAt, EXPECTED_INTEGRITY_BUILD_ID, EXPECTED_INTEGRITY_MANIFEST_DIGEST].join('|');\n}\n\nfunction ticketMessage(challenge, expiresAt) {\n  return ['ticket', challenge, expiresAt, EXPECTED_INTEGRITY_BUILD_ID, EXPECTED_INTEGRITY_MANIFEST_DIGEST].join('|');\n}",
  'worker hmac helpers'
);
replaceOnce(
  'src/realtime-entry.js',
  "    updatedAt: finite(row.updated_at, Date.now())\n  };",
  "    updatedAt: finite(row.updated_at, Date.now()),\n    rawSessionToken: rawToken\n  };",
  'session secret material'
);
replaceOnce(
  'src/realtime-entry.js',
  "function internalStateHeaders(auth, request) {",
  "function internalStateHeaders(auth, request, integrity = null) {",
  'internal headers integrity signature'
);
replaceOnce(
  'src/realtime-entry.js',
  "  headers.set('x-ironvale-updated-at', String(auth.updatedAt));\n  if (request.headers.get('Upgrade') === 'websocket') headers.set('Upgrade', 'websocket');",
  "  headers.set('x-ironvale-updated-at', String(auth.updatedAt));\n  if (integrity?.ok) {\n    headers.set('x-ironvale-integrity-status', 'attested');\n    headers.set('x-ironvale-integrity-build', EXPECTED_INTEGRITY_BUILD_ID);\n    headers.set('x-ironvale-integrity-digest', EXPECTED_INTEGRITY_MANIFEST_DIGEST);\n    headers.set('x-ironvale-integrity-expires', String(integrity.expiresAt));\n  }\n  if (request.headers.get('Upgrade') === 'websocket') headers.set('Upgrade', 'websocket');",
  'internal integrity headers'
);
replaceOnce(
  'src/realtime-entry.js',
  "async function routeRealtimeSocket(request, env) {",
  "function readIntegrityTransport(request) {\n  const url = new URL(request.url);\n  const read = (header, query) => request.headers.get(header) || url.searchParams.get(query) || '';\n  return {\n    buildId: read('x-ironvale-integrity-build', 'iv_build'),\n    manifestDigest: read('x-ironvale-integrity-digest', 'iv_digest'),\n    challenge: read('x-ironvale-integrity-challenge', 'iv_challenge'),\n    expiresAt: finite(read('x-ironvale-integrity-expires', 'iv_expires')),\n    ticket: read('x-ironvale-integrity-ticket', 'iv_ticket')\n  };\n}\n\nasync function verifyIntegrityTransport(request, auth) {\n  const transport = readIntegrityTransport(request);\n  const now = Date.now();\n  if (!transport.ticket || !transport.challenge || !transport.expiresAt) return { ok: false, reason: 'integrity-required' };\n  if (transport.buildId !== EXPECTED_INTEGRITY_BUILD_ID || transport.manifestDigest !== EXPECTED_INTEGRITY_MANIFEST_DIGEST) return { ok: false, reason: 'integrity-build-mismatch' };\n  if (transport.expiresAt <= now) return { ok: false, reason: 'integrity-expired' };\n  const expected = await hmacSha256(auth.rawSessionToken, ticketMessage(transport.challenge, transport.expiresAt));\n  if (!constantTimeEqual(expected, transport.ticket)) return { ok: false, reason: 'integrity-ticket-invalid' };\n  return { ok: true, status: 'attested', buildId: transport.buildId, manifestDigest: transport.manifestDigest, expiresAt: transport.expiresAt };\n}\n\nasync function routeIntegrityChallenge(request, env) {\n  const auth = await loadSessionState(request, env);\n  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n  const challenge = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));\n  const expiresAt = Date.now() + INTEGRITY_CHALLENGE_TTL_MS;\n  const challengeProof = await hmacSha256(auth.rawSessionToken, challengeMessage(challenge, expiresAt));\n  return json({ ok: true, challenge, expiresAt, challengeProof, buildId: EXPECTED_INTEGRITY_BUILD_ID, manifestDigest: EXPECTED_INTEGRITY_MANIFEST_DIGEST, fileCount: EXPECTED_INTEGRITY_FILE_COUNT });\n}\n\nasync function routeIntegrityAttest(request, env) {\n  const auth = await loadSessionState(request, env);\n  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n  const body = await readJson(request);\n  const challenge = String(body?.challenge || '');\n  const challengeExpiresAt = finite(body?.challengeExpiresAt);\n  const challengeProof = String(body?.challengeProof || '');\n  if (!challenge || !challengeExpiresAt || challengeExpiresAt <= Date.now()) return json({ ok: false, error: 'Integrity challenge expired' }, 409);\n  const expectedProof = await hmacSha256(auth.rawSessionToken, challengeMessage(challenge, challengeExpiresAt));\n  if (!constantTimeEqual(expectedProof, challengeProof)) return json({ ok: false, error: 'Integrity challenge invalid' }, 409);\n  const mismatches = Array.isArray(body?.mismatches) ? body.mismatches : [];\n  const approved = body?.verified === true &&\n    String(body?.buildId || '') === EXPECTED_INTEGRITY_BUILD_ID &&\n    String(body?.manifestDigest || '') === EXPECTED_INTEGRITY_MANIFEST_DIGEST &&\n    Number(body?.fileCount) === EXPECTED_INTEGRITY_FILE_COUNT &&\n    Number(body?.filesChecked) === EXPECTED_INTEGRITY_FILE_COUNT &&\n    mismatches.length === 0;\n  if (!approved) return json({ ok: false, error: 'Client build integrity denied' }, 409);\n  const ticketExpiresAt = Date.now() + INTEGRITY_TICKET_TTL_MS;\n  const ticket = await hmacSha256(auth.rawSessionToken, ticketMessage(challenge, ticketExpiresAt));\n  return json({ ok: true, status: 'attested', buildId: EXPECTED_INTEGRITY_BUILD_ID, manifestDigest: EXPECTED_INTEGRITY_MANIFEST_DIGEST, ticket, ticketExpiresAt });\n}\n\nfunction mutatingApiRequiresIntegrity(method, pathname) {\n  if (!pathname.startsWith('/api/')) return false;\n  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return false;\n  if (pathname.startsWith('/api/auth/')) return false;\n  if (pathname.startsWith('/api/integrity/')) return false;\n  if (pathname === '/api/realtime/checkpoint' || pathname === '/api/character/position') return false;\n  return true;\n}\n\nasync function routeRealtimeSocket(request, env) {",
  'integrity routes and verification'
);
replaceOnce(
  'src/realtime-entry.js',
  "  const auth = await loadSessionState(request, env);\n  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n  const stub = playerStateStub(env, auth.userId);\n  const internal = new Request('https://player-state/connect', {\n    method: 'GET',\n    headers: internalStateHeaders(auth, request)\n  });",
  "  const auth = await loadSessionState(request, env);\n  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n  const integrity = await verifyIntegrityTransport(request, auth);\n  if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);\n  const stub = playerStateStub(env, auth.userId);\n  const internal = new Request('https://player-state/connect', {\n    method: 'GET',\n    headers: internalStateHeaders(auth, request, integrity)\n  });",
  'socket integrity enforcement'
);
replaceOnce(
  'src/realtime-entry.js',
  "async function routePositionFallback(request, env) {\n  const auth = await loadSessionState(request, env);\n  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n  const body = await readJson(request);",
  "async function routePositionFallback(request, env) {\n  const auth = await loadSessionState(request, env);\n  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n  const integrity = await verifyIntegrityTransport(request, auth);\n  if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);\n  const body = await readJson(request);",
  'fallback integrity enforcement'
);
replaceOnce(
  'src/realtime-entry.js',
  "      ...Object.fromEntries(internalStateHeaders(auth, request)),",
  "      ...Object.fromEntries(internalStateHeaders(auth, request, integrity)),",
  'fallback internal integrity'
);
replaceOnce(
  'src/realtime-entry.js',
  "async function routeRealtimeCheckpoint(request, env) {\n  const auth = await loadSessionState(request, env);\n  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n  const body = await readJson(request);",
  "async function routeRealtimeCheckpoint(request, env) {\n  const auth = await loadSessionState(request, env);\n  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n  const integrity = await verifyIntegrityTransport(request, auth);\n  if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);\n  const body = await readJson(request);",
  'checkpoint integrity enforcement'
);
replaceOnce(
  'src/realtime-entry.js',
  "  const headers = internalStateHeaders(auth, request);\n  headers.set('x-ironvale-checkpoint-reason', reason);",
  "  const headers = internalStateHeaders(auth, request, integrity);\n  headers.set('x-ironvale-checkpoint-reason', reason);",
  'checkpoint internal integrity'
);
replaceOnce(
  'src/realtime-entry.js',
  "    if (url.pathname === '/api/realtime/movement') {",
  "    if (method === 'GET' && url.pathname === '/api/integrity/challenge') return routeIntegrityChallenge(request, env);\n    if (method === 'POST' && url.pathname === '/api/integrity/attest') return routeIntegrityAttest(request, env);\n\n    if (url.pathname === '/api/realtime/movement') {",
  'integrity api routes'
);
replaceOnce(
  'src/realtime-entry.js',
  "    if (method === 'POST' && url.pathname === '/api/auth/logout') {\n      await checkpointBeforeLogout(request, env);\n    }\n\n    return coreWorker.fetch(request, env, ctx);",
  "    if (method === 'POST' && url.pathname === '/api/auth/logout') {\n      await checkpointBeforeLogout(request, env);\n    }\n\n    if (mutatingApiRequiresIntegrity(method, url.pathname)) {\n      const auth = await loadSessionState(request, env);\n      if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n      const integrity = await verifyIntegrityTransport(request, auth);\n      if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);\n    }\n\n    return coreWorker.fetch(request, env, ctx);",
  'generic mutating API integrity guard'
);
replaceOnce(
  'src/realtime-entry.js',
  "      lastRejectReason: null\n    };",
  "      lastRejectReason: null,\n      integrityStatus: String(request.headers.get('x-ironvale-integrity-status') || 'missing'),\n      integrityBuildId: String(request.headers.get('x-ironvale-integrity-build') || ''),\n      integrityManifestDigest: String(request.headers.get('x-ironvale-integrity-digest') || ''),\n      integrityExpiresAt: finite(request.headers.get('x-ironvale-integrity-expires'), 0)\n    };",
  'authority integrity attachment'
);
replaceOnce(
  'src/realtime-entry.js',
  "        username: initial.username,\n        sessionExpiresAt: initial.sessionExpiresAt,\n        superseded: false,",
  "        username: initial.username,\n        sessionExpiresAt: initial.sessionExpiresAt,\n        integrityStatus: initial.integrityStatus,\n        integrityBuildId: initial.integrityBuildId,\n        integrityManifestDigest: initial.integrityManifestDigest,\n        integrityExpiresAt: initial.integrityExpiresAt,\n        superseded: false,",
  'reconnect refresh integrity attachment'
);
replaceOnce(
  'src/realtime-entry.js',
  "      checkpointIntervalMs: CHECKPOINT_INTERVAL_MS,\n      validator: 'server-authoritative'",
  "      checkpointIntervalMs: CHECKPOINT_INTERVAL_MS,\n      validator: 'server-authoritative',\n      integrity: { status: initial.integrityStatus, buildId: initial.integrityBuildId, expiresAt: initial.integrityExpiresAt }",
  'hello integrity status'
);
replaceOnce(
  'src/realtime-entry.js',
  "  validateMovement(state, packet) {\n    const now = Date.now();\n    if (state.sessionExpiresAt <= now) return { ok: false, reason: 'session-expired', close: true };",
  "  validateMovement(state, packet) {\n    const now = Date.now();\n    if (state.sessionExpiresAt <= now) return { ok: false, reason: 'session-expired', close: true };\n    if (state.integrityStatus !== 'attested' || state.integrityBuildId !== EXPECTED_INTEGRITY_BUILD_ID || state.integrityManifestDigest !== EXPECTED_INTEGRITY_MANIFEST_DIGEST) return { ok: false, reason: 'integrity-required', close: true };\n    if (Number(state.integrityExpiresAt) <= now) return { ok: false, reason: 'integrity-expired', close: true };",
  'movement final integrity gate'
);

replaceOnce(
  'public/rift-validator-guard.js',
  "  const [engine, native, realtime] = await Promise.all([\n    provider(instance, 'engine', 2), provider(instance, 'native', 2), provider(instance, 'realtime-movement', 2)\n  ]);",
  "  const [engine, native, realtime, integrity] = await Promise.all([\n    provider(instance, 'engine', 2), provider(instance, 'native', 2), provider(instance, 'realtime-movement', 2), provider(instance, 'integrity-chain', 2)\n  ]);",
  'validator integrity provider'
);
replaceOnce(
  'public/rift-validator-guard.js',
  "  const nativeFailures = Number(native?.failureCount) || 0;\n  checks.push(statusCheck('native.failures', nativeFailures ? 'fail' : 'pass', nativeFailures ? `${nativeFailures} native/WASM failure(s); last=${native?.lastFailure?.message || native?.lastFailure || 'unknown'}` : 'No native/WASM failures'));\n\n  if (!realtime) {",
  "  const nativeFailures = Number(native?.failureCount) || 0;\n  checks.push(statusCheck('native.failures', nativeFailures ? 'fail' : 'pass', nativeFailures ? `${nativeFailures} native/WASM failure(s); last=${native?.lastFailure?.message || native?.lastFailure || 'unknown'}` : 'No native/WASM failures'));\n\n  if (!integrity) {\n    checks.push(statusCheck('integrity.launch', 'fail', 'Integrity diagnostics provider unavailable'));\n    checks.push(statusCheck('integrity.server-attestation', 'fail', 'Integrity server attestation unavailable'));\n    checks.push(statusCheck('integrity.runtime-watchdog', 'fail', 'Integrity runtime watchdog unavailable'));\n  } else {\n    const launchOk = integrity.launchStatus === 'verified' && Number(integrity.filesChecked) === Number(integrity.manifestFileCount) && Number(integrity.filesChecked) > 0 && (integrity.mismatches?.length || 0) === 0;\n    checks.push(passFail('integrity.launch', launchOk, launchOk ? `${integrity.filesChecked}/${integrity.manifestFileCount} critical files match ${integrity.buildId}` : `launch=${integrity.launchStatus} · matched=${integrity.filesMatched || 0}/${integrity.manifestFileCount || 0} · mismatches=${integrity.mismatches?.length || 0}`));\n    const attested = integrity.attested === true && Number(integrity.ticketRemainingMs) > 0;\n    checks.push(passFail('integrity.server-attestation', attested, attested ? `Server challenge attested · ticket ${(Number(integrity.ticketRemainingMs) / 60000).toFixed(1)}m remaining` : 'Server integrity ticket missing or expired'));\n    const runtimeOk = integrity.runtimeStatus !== 'failed' && (integrity.runtimeMismatches?.length || 0) === 0;\n    checks.push(passFail('integrity.runtime-watchdog', runtimeOk, runtimeOk ? `Runtime tripwire clean · ${integrity.runtimeProbeCount || 0} probe(s)` : `${integrity.runtimeMismatches?.length || 0} runtime mismatch(es)`));\n  }\n\n  if (!realtime) {",
  'validator integrity checks'
);

replaceAllText('public/index.html', '/app.js?v=20260902-dirty-region-r1', '/app.js?v=20260902-integrity-v1');
replaceAllText('public/index.html', '/rift-realtime.js?v=20260901-reconnect-grace-r1', '/rift-realtime.js?v=20260902-integrity-v1');
replaceAllText('public/index.html', '/rift-validator-guard.js?v=20260901-terrain-profiler-r1', '/rift-validator-guard.js?v=20260902-integrity-v1');
replaceAllText('scripts/check-realtime-state.mjs', 'rift-realtime\\.js\\?v=20260901-reconnect-grace-r1', 'rift-realtime\\.js\\?v=20260902-integrity-v1');
replaceAllText('scripts/check-realtime-state.mjs', 'rift-validator-guard\\.js\\?v=20260901-terrain-profiler-r1', 'rift-validator-guard\\.js\\?v=20260902-integrity-v1');
replaceAllText('scripts/check-terrain-edit-profiler.mjs', "index.includes('/app.js?v=20260902-dirty-region-r1') || index.includes('/app.js?v=20260901-terrain-profiler-r1')", "index.includes('/app.js?v=20260902-integrity-v1') || index.includes('/app.js?v=20260902-dirty-region-r1') || index.includes('/app.js?v=20260901-terrain-profiler-r1')");

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
let build = String(pkg.scripts?.build || '');
if (!build.includes('node --check public/rift-integrity.js')) build = build.replace('node --check public/rift-realtime.js', 'node --check public/rift-integrity.js && node --check public/rift-realtime.js');
if (!build.includes('node --check src/integrity-build.js')) build = build.replace('node --check src/realtime-entry.js', 'node --check src/realtime-entry.js && node --check src/integrity-build.js');
if (!build.includes('node scripts/generate-integrity-manifest.mjs --check')) build += ' && node scripts/generate-integrity-manifest.mjs --check';
if (!build.includes('node scripts/check-integrity-chain.mjs')) build += ' && node scripts/check-integrity-chain.mjs';
pkg.scripts.build = build;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log('Ironvale Integrity Chain v1 source patch applied.');
