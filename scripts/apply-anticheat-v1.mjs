import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Anti-cheat patch ${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}

let worker = read('src/realtime-entry.js');
worker = replaceOnce(worker,
  "import { EXPECTED_INTEGRITY_BUILD_ID, EXPECTED_INTEGRITY_MANIFEST_DIGEST, EXPECTED_INTEGRITY_FILE_COUNT } from './integrity-build.js';",
  "import { EXPECTED_INTEGRITY_BUILD_ID, EXPECTED_INTEGRITY_MANIFEST_DIGEST, EXPECTED_INTEGRITY_FILE_COUNT } from './integrity-build.js';\nimport { ANTICHEAT_SCHEMA, antiCheatEvidence, antiCheatSummary, createAntiCheatState, markAntiCheatCasePersisted, observeAcceptedMovement, observeRejectedMovement, shouldPersistAntiCheatCase } from './anticheat.js';",
  'import');

worker = replaceOnce(worker,
  "    SELECT s.expires_at,\n           u.id AS user_id, u.username, u.is_banned,",
  "    SELECT s.id AS session_id, s.expires_at,\n           u.id AS user_id, u.username, u.role, u.is_banned,",
  'session query');
worker = replaceOnce(worker,
  "    userId: String(row.user_id),\n    username: String(row.username || 'Player').slice(0, 24),\n    sessionExpiresAt: Number(row.expires_at),",
  "    userId: String(row.user_id),\n    username: String(row.username || 'Player').slice(0, 24),\n    role: String(row.role || 'player'),\n    sessionId: String(row.session_id || ''),\n    sessionExpiresAt: Number(row.expires_at),",
  'session return');
worker = replaceOnce(worker,
  "  headers.set('x-ironvale-username', auth.username);\n  headers.set('x-ironvale-session-expires', String(auth.sessionExpiresAt));",
  "  headers.set('x-ironvale-username', auth.username);\n  headers.set('x-ironvale-session-id', auth.sessionId || '');\n  headers.set('x-ironvale-session-expires', String(auth.sessionExpiresAt));",
  'internal session header');

const apiBlock = `
let antiCheatSchemaPromise = null;

async function ensureAntiCheatTables(env) {
  if (!antiCheatSchemaPromise) {
    antiCheatSchemaPromise = env.DB.batch(ANTICHEAT_SCHEMA.map(sql => env.DB.prepare(sql))).catch(error => {
      antiCheatSchemaPromise = null;
      throw error;
    });
  }
  return antiCheatSchemaPromise;
}

async function authorizeAntiCheatReviewer(request, env, { write = false } = {}) {
  const configured = String(env.ANTICHEAT_SERVICE_KEY || '');
  const supplied = String(request.headers.get('x-ironvale-anticheat-key') || '');
  if (!write && configured && supplied && constantTimeEqual(configured, supplied)) {
    return { kind: 'service', reviewer: 'ai-anticheat-service', auth: null };
  }
  const auth = await loadSessionState(request, env);
  if (auth?.role === 'admin') return { kind: 'admin', reviewer: auth.username || 'admin', auth };
  return null;
}

function antiCheatCaseRow(row, deep = false) {
  const parse = value => { try { return JSON.parse(String(value || 'null')); } catch { return null; } };
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    sessionId: String(row.session_id || ''),
    username: String(row.username || ''),
    status: String(row.status || 'open'),
    riskScore: Number(row.risk_score) || 0,
    riskBand: String(row.risk_band || 'normal'),
    watchLevel: String(row.watch_level || 'summary'),
    primarySignal: row.primary_signal ? String(row.primary_signal) : null,
    summary: parse(row.summary_json),
    ...(deep ? { evidence: parse(row.evidence_json) } : {}),
    firstSeenAt: Number(row.first_seen_at) || 0,
    lastSeenAt: Number(row.last_seen_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
    reviewer: row.reviewer ? String(row.reviewer) : null,
    reviewNote: row.review_note ? String(row.review_note) : null,
    aiRecommendation: row.ai_recommendation ? String(row.ai_recommendation) : null
  };
}

async function routeAntiCheatApi(request, env, url) {
  const method = request.method.toUpperCase();
  const reviewer = await authorizeAntiCheatReviewer(request, env, { write: method !== 'GET' });
  if (!reviewer) return json({ ok: false, error: 'Anti-cheat reviewer access required' }, 403);
  await ensureAntiCheatTables(env);

  if (method === 'GET' && url.pathname === '/api/anticheat/summary') {
    const grouped = await env.DB.prepare(\`SELECT status, risk_band, COUNT(*) AS count, MAX(risk_score) AS max_risk FROM anti_cheat_cases GROUP BY status, risk_band ORDER BY max_risk DESC\`).all();
    return json({
      ok: true,
      format: 'ironvale-anticheat-review-summary-v1',
      policy: { automaticBan: false, aiAuthority: 'recommendation-only', ramAuthority: 'final', ordinaryMovementWritesToD1: false, suspiciousCaseWritesOnly: true },
      groups: grouped?.results || []
    });
  }

  if (method === 'GET' && url.pathname === '/api/anticheat/cases') {
    const minRisk = Math.max(0, Math.min(100, Math.trunc(Number(url.searchParams.get('minRisk')) || 0)));
    const limit = Math.max(1, Math.min(100, Math.trunc(Number(url.searchParams.get('limit')) || 25)));
    const requestedStatus = String(url.searchParams.get('status') || 'open');
    const status = ['open', 'watch', 'cleared', 'confirmed', 'all'].includes(requestedStatus) ? requestedStatus : 'open';
    const result = await env.DB.prepare(\`
      SELECT id, user_id, session_id, username, status, risk_score, risk_band, watch_level, primary_signal,
             summary_json, first_seen_at, last_seen_at, updated_at, reviewer, review_note, ai_recommendation
      FROM anti_cheat_cases
      WHERE risk_score >= ? AND (? = 'all' OR status = ?)
      ORDER BY risk_score DESC, last_seen_at DESC
      LIMIT ?
    \`).bind(minRisk, status, status, limit).all();
    return json({
      ok: true,
      format: 'ironvale-anticheat-case-list-v1',
      policy: { automaticBan: false, aiAuthority: 'recommendation-only', ramAuthority: 'final' },
      cases: (result?.results || []).map(row => antiCheatCaseRow(row, false))
    });
  }

  const detail = /^\\/api\\/anticheat\\/cases\\/([^/]+)$/.exec(url.pathname);
  if (method === 'GET' && detail) {
    const row = await env.DB.prepare('SELECT * FROM anti_cheat_cases WHERE id = ?').bind(decodeURIComponent(detail[1])).first();
    if (!row) return json({ ok: false, error: 'Anti-cheat case not found' }, 404);
    return json({
      ok: true,
      format: 'ironvale-anticheat-ai-review-v1',
      policy: { automaticBan: false, aiAuthority: 'recommendation-only', humanReviewPreferred: true, ramAuthority: 'final' },
      case: antiCheatCaseRow(row, true)
    });
  }

  const review = /^\\/api\\/anticheat\\/cases\\/([^/]+)\\/review$/.exec(url.pathname);
  if (method === 'POST' && review) {
    if (reviewer.kind !== 'admin' || !reviewer.auth) return json({ ok: false, error: 'Admin session required for case changes' }, 403);
    const integrity = await verifyIntegrityTransport(request, reviewer.auth);
    if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);
    const body = await readJson(request);
    const status = ['open', 'watch', 'cleared', 'confirmed'].includes(String(body?.status || '')) ? String(body.status) : 'open';
    const note = String(body?.note || '').slice(0, 2000);
    const aiRecommendation = String(body?.aiRecommendation || '').slice(0, 1000);
    const result = await env.DB.prepare(\`
      UPDATE anti_cheat_cases
      SET status = ?, reviewer = ?, review_note = ?, ai_recommendation = ?, updated_at = ?
      WHERE id = ?
    \`).bind(status, reviewer.reviewer, note, aiRecommendation, Date.now(), decodeURIComponent(review[1])).run();
    return json({ ok: true, updated: Number(result?.meta?.changes) > 0, status });
  }

  return json({ ok: false, error: 'Anti-cheat endpoint not found' }, 404);
}
`;
worker = replaceOnce(worker,
  "async function routeRealtimeSocket(request, env) {",
  apiBlock + "\nasync function routeRealtimeSocket(request, env) {",
  'anti-cheat API block');
worker = replaceOnce(worker,
  "    if (method === 'GET' && url.pathname === '/api/integrity/challenge') return routeIntegrityChallenge(request, env);",
  "    if (url.pathname.startsWith('/api/anticheat/')) return routeAntiCheatApi(request, env, url);\n\n    if (method === 'GET' && url.pathname === '/api/integrity/challenge') return routeIntegrityChallenge(request, env);",
  'anti-cheat route');

worker = replaceOnce(worker,
  "      userId: String(request.headers.get('x-ironvale-user-id') || ''),\n      username: String(request.headers.get('x-ironvale-username') || 'Player').slice(0, 24),\n      sessionExpiresAt: finite(request.headers.get('x-ironvale-session-expires'), now),",
  "      userId: String(request.headers.get('x-ironvale-user-id') || ''),\n      username: String(request.headers.get('x-ironvale-username') || 'Player').slice(0, 24),\n      sessionId: String(request.headers.get('x-ironvale-session-id') || ''),\n      sessionExpiresAt: finite(request.headers.get('x-ironvale-session-expires'), now),",
  'DO session id');
worker = replaceOnce(worker,
  "      integrityManifestDigest: String(request.headers.get('x-ironvale-integrity-digest') || ''),\n      integrityExpiresAt: finite(request.headers.get('x-ironvale-integrity-expires'), 0)",
  "      integrityManifestDigest: String(request.headers.get('x-ironvale-integrity-digest') || ''),\n      integrityExpiresAt: finite(request.headers.get('x-ironvale-integrity-expires'), 0),\n      antiCheat: createAntiCheatState(now)",
  'DO anti-cheat state');

worker = replaceOnce(worker,
  "    if (carried?.state?.userId === initial.userId) {\n      initial = {\n        ...carried.state,\n        username: initial.username,\n        sessionExpiresAt: initial.sessionExpiresAt,",
  "    if (carried?.state?.userId === initial.userId) {\n      const sameSession = carried.state.sessionId === initial.sessionId;\n      initial = {\n        ...carried.state,\n        username: initial.username,\n        sessionId: initial.sessionId,\n        sessionExpiresAt: initial.sessionExpiresAt,\n        antiCheat: sameSession ? carried.state.antiCheat : initial.antiCheat,",
  'reconnect anti-cheat isolation');

worker = replaceOnce(worker,
  "  applyAccepted(state, accepted) {\n    const moved = Math.hypot(accepted.x - state.x, accepted.y - state.y, accepted.z - state.z) > 0.01 || Math.abs(accepted.yaw - state.yaw) > 0.001;\n    state.x = accepted.x;",
  "  applyAccepted(state, accepted) {\n    const moved = Math.hypot(accepted.x - state.x, accepted.y - state.y, accepted.z - state.z) > 0.01 || Math.abs(accepted.yaw - state.yaw) > 0.001;\n    state.antiCheat = observeAcceptedMovement(state.antiCheat, { x: state.x, y: state.y, z: state.z, yaw: state.yaw, lastAcceptedAt: state.lastAcceptedAt }, accepted);\n    state.x = accepted.x;",
  'accepted observation');
worker = replaceOnce(worker,
  "  correction(state, validation) {\n    state.rejected += 1;\n    state.lastRejectReason = validation.reason;",
  "  correction(state, validation) {\n    state.rejected += 1;\n    state.lastRejectReason = validation.reason;\n    state.antiCheat = observeRejectedMovement(state.antiCheat, validation.reason, Date.now());",
  'rejection observation');

const persistMethod = `
  async persistAntiCheatCaseIfNeeded(state) {
    if (!state?.userId || !shouldPersistAntiCheatCase(state.antiCheat)) return false;
    await ensureAntiCheatTables(this.env);
    const now = Date.now();
    const caseId = state.antiCheat?.caseId || \`ac-\${state.sessionId || state.userId}\`;
    const summary = antiCheatSummary(state.antiCheat);
    const evidence = antiCheatEvidence(state.antiCheat);
    const firstSeen = Number(state.antiCheat?.firstCaseAt) || now;
    await this.env.DB.prepare(\`
      INSERT INTO anti_cheat_cases
        (id, user_id, session_id, username, status, risk_score, risk_band, watch_level, primary_signal,
         summary_json, evidence_json, first_seen_at, last_seen_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        risk_score = excluded.risk_score,
        risk_band = excluded.risk_band,
        watch_level = excluded.watch_level,
        primary_signal = excluded.primary_signal,
        summary_json = excluded.summary_json,
        evidence_json = excluded.evidence_json,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at
    \`).bind(
      caseId,
      state.userId,
      state.sessionId || null,
      state.username || 'Player',
      summary.score,
      summary.riskBand,
      summary.watchLevel,
      summary.primarySignal,
      JSON.stringify(summary),
      JSON.stringify(evidence),
      firstSeen,
      now,
      now
    ).run();
    state.antiCheat = markAntiCheatCasePersisted(state.antiCheat, caseId, now);
    return true;
  }
`;
worker = replaceOnce(worker,
  "  async checkpointState(state, reason = 'checkpoint') {",
  persistMethod + "\n  async checkpointState(state, reason = 'checkpoint') {",
  'case persistence method');

worker = replaceOnce(worker,
  "      const reply = this.correction(state, validation);\n      ws.serializeAttachment(state);",
  "      const reply = this.correction(state, validation);\n      await this.persistAntiCheatCaseIfNeeded(state);\n      ws.serializeAttachment(state);",
  'socket rejection persistence');
worker = replaceOnce(worker,
  "    this.applyAccepted(state, validation);\n    if (state.dirty) await this.ensureCheckpointAlarm();",
  "    this.applyAccepted(state, validation);\n    await this.persistAntiCheatCaseIfNeeded(state);\n    if (state.dirty) await this.ensureCheckpointAlarm();",
  'socket accepted persistence');
worker = replaceOnce(worker,
  "      const correction = this.correction(this.httpState, validation);\n      return json(correction, validation.close ? 401 : 409);",
  "      const correction = this.correction(this.httpState, validation);\n      await this.persistAntiCheatCaseIfNeeded(this.httpState);\n      return json(correction, validation.close ? 401 : 409);",
  'HTTP rejection persistence');
worker = replaceOnce(worker,
  "    this.applyAccepted(this.httpState, validation);\n    await this.ensureCheckpointAlarm();",
  "    this.applyAccepted(this.httpState, validation);\n    await this.persistAntiCheatCaseIfNeeded(this.httpState);\n    await this.ensureCheckpointAlarm();",
  'HTTP accepted persistence');

// Explicit policy marker used by regression checks and future server diagnostics.
worker = replaceOnce(worker,
  "const REALTIME_FORMAT = 'ironvale-realtime-authority-v2';",
  "const REALTIME_FORMAT = 'ironvale-realtime-authority-v2';\nconst ANTICHEAT_POLICY = Object.freeze({ automaticBan: false, aiAuthority: 'recommendation-only', ramAuthority: 'final', ordinaryMovementWritesToD1: false, suspiciousCaseWritesOnly: true });",
  'policy marker');
worker = replaceOnce(worker,
  "      validator: 'server-authoritative',\n      integrity:",
  "      validator: 'server-authoritative',\n      antiCheatPolicy: { enabled: true, serverPrivate: true, automaticBan: ANTICHEAT_POLICY.automaticBan },\n      integrity:",
  'hello policy');

write('src/realtime-entry.js', worker);

let schema = read('schema.sql');
if (!schema.includes('CREATE TABLE IF NOT EXISTS anti_cheat_cases')) {
  schema += `\n\n-- Sparse server-side anti-cheat cases. Ordinary movement remains RAM-only; only suspicious sessions are promoted here.\nCREATE TABLE IF NOT EXISTS anti_cheat_cases (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  session_id TEXT,\n  username TEXT,\n  status TEXT NOT NULL DEFAULT 'open',\n  risk_score INTEGER NOT NULL DEFAULT 0,\n  risk_band TEXT NOT NULL DEFAULT 'normal',\n  watch_level TEXT NOT NULL DEFAULT 'summary',\n  primary_signal TEXT,\n  summary_json TEXT NOT NULL,\n  evidence_json TEXT,\n  first_seen_at INTEGER NOT NULL,\n  last_seen_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL,\n  reviewer TEXT,\n  review_note TEXT,\n  ai_recommendation TEXT\n);\nCREATE INDEX IF NOT EXISTS idx_anti_cheat_cases_risk ON anti_cheat_cases(risk_score DESC, last_seen_at DESC);\nCREATE INDEX IF NOT EXISTS idx_anti_cheat_cases_user ON anti_cheat_cases(user_id, last_seen_at DESC);\nCREATE INDEX IF NOT EXISTS idx_anti_cheat_cases_status ON anti_cheat_cases(status, risk_score DESC);\n`;
}
write('schema.sql', schema);

const pkg = JSON.parse(read('package.json'));
let build = String(pkg.scripts.build || '');
if (!build.includes('node --check src/anticheat.js')) build = build.replace('node --check src/realtime-entry.js', 'node --check src/realtime-entry.js && node --check src/anticheat.js');
if (!build.includes('node scripts/check-anticheat-v1.mjs')) build += ' && node scripts/check-anticheat-v1.mjs';
pkg.scripts.build = build;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

console.log('Anti-Cheat v1 integration patch applied.');
