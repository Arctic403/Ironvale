export const RIFT_SURVIVAL_INTEGRITY_FORMAT = 'rift-survival-integrity-chain-v1';
export const RIFT_SURVIVAL_INTEGRITY_MANIFEST_FORMAT = 'rift-survival-integrity-manifest-v1';

const MANIFEST_PATH = '/rift-survival-integrity-manifest.json';
const CHALLENGE_PATH = '/api/integrity/challenge';
const ATTEST_PATH = '/api/integrity/attest';
const RUNTIME_PROBE_MS = 30_000;
const FILE_RECHECK_MS = 10 * 60 * 1000;
const TICKET_RENEW_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_CONCURRENCY = 4;
const nativeFetch = window.fetch.bind(window);

const state = {
  format: RIFT_SURVIVAL_INTEGRITY_FORMAT,
  policy: {
    clientTrusted: false,
    launchFileIntegrityTripwire: true,
    runtimeTripwire: true,
    serverChallenge: true,
    serverAttestationTicket: true,
    mutatingApiRequiresIntegrity: true,
    realtimeRequiresIntegrity: true,
    serverAuthorityFinal: true,
    nativePlatformAttestation: 'future-native-only'
  },
  launchStatus: 'idle',
  runtimeStatus: 'idle',
  attested: false,
  buildId: null,
  manifestDigest: null,
  manifestFileCount: 0,
  filesChecked: 0,
  filesMatched: 0,
  mismatches: [],
  runtimeMismatches: [],
  runtimeProbeCount: 0,
  fullVerificationCount: 0,
  challengeAt: null,
  attestedAt: null,
  ticketExpiresAt: null,
  lastVerifiedAt: null,
  lastRuntimeProbeAt: null,
  lastError: null
};

let manifest = null;
let ticket = null;
let ticketChallenge = null;
let ensurePromise = null;
let providerRegistered = false;
let runtimeTimer = 0;
let fileTimer = 0;
const runtimeReferences = new Map();

function hex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Buffer(buffer) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)));
}

async function sha256Text(value) {
  return sha256Buffer(new TextEncoder().encode(String(value || '')));
}

function canonicalManifestPayload(value) {
  const files = Array.isArray(value?.files)
    ? value.files.map(file => ({ path: String(file.path), sha256: String(file.sha256), size: Number(file.size) || 0 }))
    : [];
  return {
    format: String(value?.format || ''),
    algorithm: String(value?.algorithm || ''),
    files
  };
}

function publicStatus() {
  return {
    ...state,
    mismatches: state.mismatches.map(entry => ({ ...entry })),
    runtimeMismatches: state.runtimeMismatches.map(entry => ({ ...entry })),
    ticketPresent: Boolean(ticket),
    ticketRemainingMs: state.ticketExpiresAt ? Math.max(0, Number(state.ticketExpiresAt) - Date.now()) : 0
  };
}

function record(message, data = null, severity = 'info') {
  try { window.RiftSurvivalDiagnostics?.record?.('integrity', message, data, severity); } catch (_) {}
}

function emit(name, detail = {}) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
}

function clearTicket() {
  ticket = null;
  ticketChallenge = null;
  state.attested = false;
  state.ticketExpiresAt = null;
}

function failIntegrity(reason, details = null, { runtime = false } = {}) {
  const message = String(reason || 'integrity-failed').slice(0, 160);
  state.lastError = message;
  if (runtime) state.runtimeStatus = 'failed';
  else state.launchStatus = 'failed';
  clearTicket();
  record('Integrity chain failed', { reason: message, details }, 'error');
  emit('rift-survival:integrity-failed', { reason: message, details });
  return { ok: false, reason: message, status: publicStatus() };
}

async function fetchJson(path, options = {}) {
  const response = await nativeFetch(path, { cache: 'no-store', credentials: 'same-origin', ...options });
  let data = {};
  try { data = await response.clone().json(); } catch (_) {}
  if (!response.ok) throw new Error(data?.error || `Integrity request failed (${response.status})`);
  return data;
}

async function fetchChallenge() {
  const data = await fetchJson(CHALLENGE_PATH);
  if (!data?.ok || !data.challenge || !data.challengeProof || !data.buildId || !data.manifestDigest) {
    throw new Error('Integrity challenge payload is incomplete');
  }
  state.challengeAt = new Date().toISOString();
  return data;
}

async function loadManifest(force = false) {
  if (manifest && !force) return manifest;
  const response = await nativeFetch(`${MANIFEST_PATH}?iv=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Integrity manifest HTTP ${response.status}`);
  const value = await response.json();
  if (value?.format !== RIFT_SURVIVAL_INTEGRITY_MANIFEST_FORMAT || value?.algorithm !== 'SHA-256') {
    throw new Error('Integrity manifest format mismatch');
  }
  const canonical = canonicalManifestPayload(value);
  const digest = await sha256Text(JSON.stringify(canonical));
  if (digest !== String(value.digest || '')) throw new Error('Integrity manifest self-digest mismatch');
  if (!Array.isArray(value.files) || Number(value.fileCount) !== value.files.length) throw new Error('Integrity manifest file count mismatch');
  manifest = value;
  state.buildId = String(value.buildId || '');
  state.manifestDigest = String(value.digest || '');
  state.manifestFileCount = value.files.length;
  return manifest;
}

async function verifyOneFile(file, expectedBuildId) {
  const url = new URL(String(file.path), location.origin);
  url.searchParams.set('__rift_survival_integrity', expectedBuildId);
  const response = await nativeFetch(url.href, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) {
    return { path: file.path, ok: false, reason: `http-${response.status}`, expected: file.sha256, actual: null, size: 0 };
  }
  const bytes = await response.arrayBuffer();
  const actual = await sha256Buffer(bytes);
  const size = bytes.byteLength;
  return {
    path: file.path,
    ok: actual === file.sha256 && size === Number(file.size),
    reason: actual !== file.sha256 ? 'sha256-mismatch' : size !== Number(file.size) ? 'size-mismatch' : null,
    expected: file.sha256,
    actual,
    expectedSize: Number(file.size),
    size
  };
}

async function verifyFiles(files, expectedBuildId) {
  const queue = [...files];
  const results = [];
  const workers = Array.from({ length: Math.min(VERIFY_CONCURRENCY, Math.max(1, queue.length)) }, async () => {
    while (queue.length) {
      const file = queue.shift();
      if (!file) break;
      results.push(await verifyOneFile(file, expectedBuildId));
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => String(a.path).localeCompare(String(b.path)));
  return results;
}

async function attest(challenge, verification) {
  const body = {
    challenge: challenge.challenge,
    challengeExpiresAt: challenge.expiresAt,
    challengeProof: challenge.challengeProof,
    buildId: manifest.buildId,
    manifestDigest: manifest.digest,
    verified: verification.every(entry => entry.ok),
    fileCount: manifest.files.length,
    filesChecked: verification.length,
    mismatches: verification.filter(entry => !entry.ok).map(entry => ({ path: entry.path, reason: entry.reason }))
  };
  const data = await fetchJson(ATTEST_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!data?.ok || !data.ticket || !data.ticketExpiresAt) throw new Error(data?.error || 'Integrity attestation rejected');
  const hadTicket = Boolean(ticket);
  ticket = String(data.ticket);
  ticketChallenge = String(challenge.challenge);
  state.attested = true;
  state.attestedAt = new Date().toISOString();
  state.ticketExpiresAt = Number(data.ticketExpiresAt);
  state.launchStatus = 'verified';
  state.lastError = null;
  record('Integrity session attested', { buildId: state.buildId, filesChecked: state.filesChecked, ticketExpiresAt: state.ticketExpiresAt });
  emit(hadTicket ? 'rift-survival:integrity-refreshed' : 'rift-survival:integrity-ready', { buildId: state.buildId, ticketExpiresAt: state.ticketExpiresAt });
  return { ok: true, status: publicStatus() };
}

async function runFullVerification(challenge) {
  state.launchStatus = 'verifying';
  const currentManifest = await loadManifest(true);
  if (String(challenge.buildId) !== String(currentManifest.buildId) || String(challenge.manifestDigest) !== String(currentManifest.digest)) {
    return failIntegrity('server-build-manifest-mismatch', {
      serverBuildId: challenge.buildId,
      localBuildId: currentManifest.buildId,
      serverDigest: challenge.manifestDigest,
      localDigest: currentManifest.digest
    });
  }
  const verification = await verifyFiles(currentManifest.files, currentManifest.buildId);
  const mismatches = verification.filter(entry => !entry.ok);
  state.filesChecked = verification.length;
  state.filesMatched = verification.length - mismatches.length;
  state.mismatches = mismatches.slice(0, 32).map(entry => ({ path: entry.path, reason: entry.reason, expected: entry.expected, actual: entry.actual }));
  state.fullVerificationCount += 1;
  state.lastVerifiedAt = new Date().toISOString();
  if (mismatches.length) return failIntegrity('critical-client-file-mismatch', state.mismatches);
  return attest(challenge, verification);
}

async function ensureSession(options = {}) {
  const force = options?.force === true;
  const remaining = state.ticketExpiresAt ? Number(state.ticketExpiresAt) - Date.now() : 0;
  if (!force && state.attested && ticket && remaining > TICKET_RENEW_WINDOW_MS) return { ok: true, status: publicStatus() };
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    try {
      const challenge = await fetchChallenge();
      return await runFullVerification(challenge);
    } catch (error) {
      return failIntegrity(String(error?.message || error || 'integrity-session-failed'));
    } finally {
      ensurePromise = null;
    }
  })();
  return ensurePromise;
}

function transportParams() {
  if (!state.attested || !ticket || !ticketChallenge || !state.ticketExpiresAt || Number(state.ticketExpiresAt) <= Date.now()) return null;
  return {
    iv_build: String(state.buildId || ''),
    iv_digest: String(state.manifestDigest || ''),
    iv_challenge: ticketChallenge,
    iv_expires: String(state.ticketExpiresAt),
    iv_ticket: ticket
  };
}

function transportHeaders() {
  const params = transportParams();
  if (!params) return {};
  return {
    'x-rift-survival-integrity-build': params.iv_build,
    'x-rift-survival-integrity-digest': params.iv_digest,
    'x-rift-survival-integrity-challenge': params.iv_challenge,
    'x-rift-survival-integrity-expires': params.iv_expires,
    'x-rift-survival-integrity-ticket': params.iv_ticket
  };
}

function runtimeContractEntries() {
  return [
    ['integrity', window.RiftSurvivalIntegrity, RIFT_SURVIVAL_INTEGRITY_FORMAT],
    ['realtime', window.RiftSurvivalRealtimeMovement, 'rift-survival-realtime-client-v2'],
    ['validator', window.RiftSurvivalValidatorGuard, 'rift-survival-validator-guard-v1'],
    ['history', window.RiftSurvivalEditorHistory, 'rift-survival-editor-history-runtime-v1'],
    ['player-state', window.RiftSurvivalPlayerState, 'rift-survival-player-state-runtime-v1'],
    ['movement-mode', window.RiftSurvivalMovementMode, 'rift-survival-movement-mode-v1']
  ];
}

function runtimeProbe() {
  const mismatches = [];
  for (const [name, object, expectedFormat] of runtimeContractEntries()) {
    if (!object) continue;
    if (!Object.isFrozen(object)) mismatches.push({ name, reason: 'api-not-frozen' });
    if (String(object.format || '') !== expectedFormat) mismatches.push({ name, reason: 'format-mismatch', expected: expectedFormat, actual: object.format || null });
    if (!runtimeReferences.has(name)) runtimeReferences.set(name, object);
    else if (runtimeReferences.get(name) !== object) mismatches.push({ name, reason: 'api-reference-replaced' });
  }
  state.runtimeProbeCount += 1;
  state.lastRuntimeProbeAt = new Date().toISOString();
  state.runtimeMismatches = mismatches.slice(0, 32);
  state.runtimeStatus = mismatches.length ? 'failed' : 'verified';
  if (mismatches.length) return failIntegrity('runtime-integrity-contract-mismatch', mismatches, { runtime: true });
  return { ok: true, mismatches: [] };
}

async function recheckCriticalFiles() {
  if (!manifest || state.launchStatus !== 'verified') return;
  const paths = new Set(['/app.js', '/rift-integrity.js', '/rift-realtime.js', '/rift-core.wasm.gz']);
  const critical = manifest.files.filter(file => paths.has(file.path));
  try {
    const results = await verifyFiles(critical, manifest.buildId);
    const mismatches = results.filter(entry => !entry.ok);
    if (mismatches.length) {
      failIntegrity('runtime-critical-file-mismatch', mismatches, { runtime: true });
      return;
    }
    if (state.ticketExpiresAt && Number(state.ticketExpiresAt) - Date.now() <= TICKET_RENEW_WINDOW_MS) await ensureSession({ force: true });
  } catch (error) {
    record('Runtime integrity recheck failed', { error: String(error?.message || error) }, 'warn');
  }
}

function armWatchdog() {
  clearInterval(runtimeTimer);
  clearInterval(fileTimer);
  runtimeTimer = setInterval(runtimeProbe, RUNTIME_PROBE_MS);
  fileTimer = setInterval(() => { void recheckCriticalFiles(); }, FILE_RECHECK_MS);
  setTimeout(runtimeProbe, 1500);
}

function registerDiagnosticsProvider() {
  if (providerRegistered) return;
  const diagnostics = window.RiftSurvivalDiagnostics;
  if (!diagnostics?.registerProvider) {
    setTimeout(registerDiagnosticsProvider, 100);
    return;
  }
  diagnostics.registerProvider('integrity-chain', () => publicStatus());
  providerRegistered = true;
}

const api = Object.freeze({
  format: RIFT_SURVIVAL_INTEGRITY_FORMAT,
  ensureSession,
  status: publicStatus,
  runtimeProbe,
  transportParams,
  transportHeaders
});

window.RiftSurvivalIntegrity = api;
registerDiagnosticsProvider();
armWatchdog();

export const RiftSurvivalIntegrity = api;
