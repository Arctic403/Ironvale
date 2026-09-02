import coreWorker from './index.js';
import { DurableObject } from 'cloudflare:workers';
import { EXPECTED_INTEGRITY_BUILD_ID, EXPECTED_INTEGRITY_MANIFEST_DIGEST, EXPECTED_INTEGRITY_FILE_COUNT } from './integrity-build.js';
import { ANTICHEAT_SCHEMA, antiCheatEvidence, antiCheatSummary, createAntiCheatState, markAntiCheatCasePersisted, observeAcceptedMovement, observeRejectedMovement, shouldPersistAntiCheatCase } from './anticheat.js';
import { verifyGitHubAntiCheatOidc } from './github-oidc.js';

const SESSION_COOKIE = 'ironvale_session';
const DEFAULT_SPAWN = Object.freeze({ x: 320, y: 0.9, z: 320, yaw: 0 });
const WORLD_MIN_X = 0;
const WORLD_MAX_X = 640;
const WORLD_MIN_Z = 0;
const WORLD_MAX_Z = 640;
const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000;
const MAX_HORIZONTAL_SPEED_MPS = 12;
const HORIZONTAL_LAG_ALLOWANCE_METERS = 3.5;
const MAX_VERTICAL_SPEED_MPS = 60;
const VERTICAL_LAG_ALLOWANCE_METERS = 20;
const MAX_Y_ABS = 10000;
const REALTIME_FORMAT = 'ironvale-realtime-authority-v2';
const ANTICHEAT_POLICY = Object.freeze({ automaticBan: false, aiAuthority: 'recommendation-only', ramAuthority: 'final', ordinaryMovementWritesToD1: false, suspiciousCaseWritesOnly: true });
const INTEGRITY_CHALLENGE_TTL_MS = 2 * 60 * 1000;
const INTEGRITY_TICKET_TTL_MS = 60 * 60 * 1000;

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return diff === 0;
}

async function hmacSha256(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(secret || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(value || '')));
  return bytesToBase64Url(new Uint8Array(signature));
}

function challengeMessage(challenge, expiresAt) {
  return ['challenge', challenge, expiresAt, EXPECTED_INTEGRITY_BUILD_ID, EXPECTED_INTEGRITY_MANIFEST_DIGEST].join('|');
}

function ticketMessage(challenge, expiresAt) {
  return ['ticket', challenge, expiresAt, EXPECTED_INTEGRITY_BUILD_ID, EXPECTED_INTEGRITY_MANIFEST_DIGEST].join('|');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return bytesToBase64(new Uint8Array(digest));
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function loadSessionState(request, env) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const row = await env.DB.prepare(`
    SELECT s.id AS session_id, s.expires_at,
           u.id AS user_id, u.username, u.role, u.is_banned,
           c.position_x, c.position_y, c.position_z, c.yaw, c.updated_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN rift_characters c ON c.user_id = u.id
    WHERE s.token_hash = ?
  `).bind(tokenHash).first();
  if (!row || Number(row.is_banned) || Number(row.expires_at) <= Date.now()) return null;
  return {
    userId: String(row.user_id),
    username: String(row.username || 'Player').slice(0, 24),
    role: String(row.role || 'player'),
    sessionId: String(row.session_id || ''),
    sessionExpiresAt: Number(row.expires_at),
    position: {
      x: finite(row.position_x, DEFAULT_SPAWN.x),
      y: finite(row.position_y, DEFAULT_SPAWN.y),
      z: finite(row.position_z, DEFAULT_SPAWN.z),
      yaw: finite(row.yaw, DEFAULT_SPAWN.yaw)
    },
    updatedAt: finite(row.updated_at, Date.now()),
    rawSessionToken: rawToken
  };
}

function playerStateStub(env, userId) {
  const id = env.PLAYER_STATE.idFromName(String(userId));
  return env.PLAYER_STATE.get(id);
}

function internalStateHeaders(auth, request, integrity = null) {
  const headers = new Headers();
  headers.set('x-ironvale-user-id', auth.userId);
  headers.set('x-ironvale-username', auth.username);
  headers.set('x-ironvale-session-id', auth.sessionId || '');
  headers.set('x-ironvale-session-expires', String(auth.sessionExpiresAt));
  headers.set('x-ironvale-x', String(auth.position.x));
  headers.set('x-ironvale-y', String(auth.position.y));
  headers.set('x-ironvale-z', String(auth.position.z));
  headers.set('x-ironvale-yaw', String(auth.position.yaw));
  headers.set('x-ironvale-updated-at', String(auth.updatedAt));
  if (integrity?.ok) {
    headers.set('x-ironvale-integrity-status', 'attested');
    headers.set('x-ironvale-integrity-build', EXPECTED_INTEGRITY_BUILD_ID);
    headers.set('x-ironvale-integrity-digest', EXPECTED_INTEGRITY_MANIFEST_DIGEST);
    headers.set('x-ironvale-integrity-expires', String(integrity.expiresAt));
  }
  if (request.headers.get('Upgrade') === 'websocket') headers.set('Upgrade', 'websocket');
  return headers;
}

function readIntegrityTransport(request) {
  const url = new URL(request.url);
  const read = (header, query) => request.headers.get(header) || url.searchParams.get(query) || '';
  return {
    buildId: read('x-ironvale-integrity-build', 'iv_build'),
    manifestDigest: read('x-ironvale-integrity-digest', 'iv_digest'),
    challenge: read('x-ironvale-integrity-challenge', 'iv_challenge'),
    expiresAt: finite(read('x-ironvale-integrity-expires', 'iv_expires')),
    ticket: read('x-ironvale-integrity-ticket', 'iv_ticket')
  };
}

async function verifyIntegrityTransport(request, auth) {
  const transport = readIntegrityTransport(request);
  const now = Date.now();
  if (!transport.ticket || !transport.challenge || !transport.expiresAt) return { ok: false, reason: 'integrity-required' };
  if (transport.buildId !== EXPECTED_INTEGRITY_BUILD_ID || transport.manifestDigest !== EXPECTED_INTEGRITY_MANIFEST_DIGEST) return { ok: false, reason: 'integrity-build-mismatch' };
  if (transport.expiresAt <= now) return { ok: false, reason: 'integrity-expired' };
  const expected = await hmacSha256(auth.rawSessionToken, ticketMessage(transport.challenge, transport.expiresAt));
  if (!constantTimeEqual(expected, transport.ticket)) return { ok: false, reason: 'integrity-ticket-invalid' };
  return { ok: true, status: 'attested', buildId: transport.buildId, manifestDigest: transport.manifestDigest, expiresAt: transport.expiresAt };
}

async function routeIntegrityChallenge(request, env) {
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const challenge = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const expiresAt = Date.now() + INTEGRITY_CHALLENGE_TTL_MS;
  const challengeProof = await hmacSha256(auth.rawSessionToken, challengeMessage(challenge, expiresAt));
  return json({ ok: true, challenge, expiresAt, challengeProof, buildId: EXPECTED_INTEGRITY_BUILD_ID, manifestDigest: EXPECTED_INTEGRITY_MANIFEST_DIGEST, fileCount: EXPECTED_INTEGRITY_FILE_COUNT });
}

async function routeIntegrityAttest(request, env) {
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const body = await readJson(request);
  const challenge = String(body?.challenge || '');
  const challengeExpiresAt = finite(body?.challengeExpiresAt);
  const challengeProof = String(body?.challengeProof || '');
  if (!challenge || !challengeExpiresAt || challengeExpiresAt <= Date.now()) return json({ ok: false, error: 'Integrity challenge expired' }, 409);
  const expectedProof = await hmacSha256(auth.rawSessionToken, challengeMessage(challenge, challengeExpiresAt));
  if (!constantTimeEqual(expectedProof, challengeProof)) return json({ ok: false, error: 'Integrity challenge invalid' }, 409);
  const mismatches = Array.isArray(body?.mismatches) ? body.mismatches : [];
  const approved = body?.verified === true &&
    String(body?.buildId || '') === EXPECTED_INTEGRITY_BUILD_ID &&
    String(body?.manifestDigest || '') === EXPECTED_INTEGRITY_MANIFEST_DIGEST &&
    Number(body?.fileCount) === EXPECTED_INTEGRITY_FILE_COUNT &&
    Number(body?.filesChecked) === EXPECTED_INTEGRITY_FILE_COUNT &&
    mismatches.length === 0;
  if (!approved) return json({ ok: false, error: 'Client build integrity denied' }, 409);
  const ticketExpiresAt = Date.now() + INTEGRITY_TICKET_TTL_MS;
  const ticket = await hmacSha256(auth.rawSessionToken, ticketMessage(challenge, ticketExpiresAt));
  return json({ ok: true, status: 'attested', buildId: EXPECTED_INTEGRITY_BUILD_ID, manifestDigest: EXPECTED_INTEGRITY_MANIFEST_DIGEST, ticket, ticketExpiresAt });
}

async function routeAntiCheatSessionStatus(request, env) {
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const integrity = await verifyIntegrityTransport(request, auth);
  if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);
  const stub = playerStateStub(env, auth.userId);
  const headers = internalStateHeaders(auth, request, integrity);
  return stub.fetch(new Request('https://player-state/anticheat-status', { method: 'GET', headers }));
}

function mutatingApiRequiresIntegrity(method, pathname) {
  if (!pathname.startsWith('/api/')) return false;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return false;
  if (pathname.startsWith('/api/auth/')) return false;
  if (pathname.startsWith('/api/integrity/')) return false;
  if (pathname === '/api/realtime/checkpoint' || pathname === '/api/character/position') return false;
  return true;
}


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
  if (!write) {
    const configured = String(env.ANTICHEAT_SERVICE_KEY || '');
    const supplied = String(request.headers.get('x-ironvale-anticheat-key') || '');
    if (configured && supplied && constantTimeEqual(configured, supplied)) {
      return { kind: 'service', reviewer: 'ai-anticheat-service', auth: null };
    }

    const authorization = String(request.headers.get('authorization') || '');
    const bearer = authorization.replace(/^Bearer\s+/i, '').trim();
    if (bearer && bearer !== authorization) {
      const oidc = await verifyGitHubAntiCheatOidc(bearer);
      if (oidc.ok) {
        return {
          kind: 'github-oidc',
          reviewer: 'ai-anticheat-github-oidc',
          auth: null,
          oidc: { runId: oidc.runId, runAttempt: oidc.runAttempt, actor: oidc.actor, expiresAt: oidc.expiresAt }
        };
      }
    }
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
    const grouped = await env.DB.prepare(`SELECT status, risk_band, COUNT(*) AS count, MAX(risk_score) AS max_risk FROM anti_cheat_cases GROUP BY status, risk_band ORDER BY max_risk DESC`).all();
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
    const result = await env.DB.prepare(`
      SELECT id, user_id, session_id, username, status, risk_score, risk_band, watch_level, primary_signal,
             summary_json, first_seen_at, last_seen_at, updated_at, reviewer, review_note, ai_recommendation
      FROM anti_cheat_cases
      WHERE risk_score >= ? AND (? = 'all' OR status = ?)
      ORDER BY risk_score DESC, last_seen_at DESC
      LIMIT ?
    `).bind(minRisk, status, status, limit).all();
    return json({
      ok: true,
      format: 'ironvale-anticheat-case-list-v1',
      policy: { automaticBan: false, aiAuthority: 'recommendation-only', ramAuthority: 'final' },
      cases: (result?.results || []).map(row => antiCheatCaseRow(row, false))
    });
  }

  const detail = /^\/api\/anticheat\/cases\/([^/]+)$/.exec(url.pathname);
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

  const review = /^\/api\/anticheat\/cases\/([^/]+)\/review$/.exec(url.pathname);
  if (method === 'POST' && review) {
    if (reviewer.kind !== 'admin' || !reviewer.auth) return json({ ok: false, error: 'Admin session required for case changes' }, 403);
    const integrity = await verifyIntegrityTransport(request, reviewer.auth);
    if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);
    const body = await readJson(request);
    const status = ['open', 'watch', 'cleared', 'confirmed'].includes(String(body?.status || '')) ? String(body.status) : 'open';
    const note = String(body?.note || '').slice(0, 2000);
    const aiRecommendation = String(body?.aiRecommendation || '').slice(0, 1000);
    const result = await env.DB.prepare(`
      UPDATE anti_cheat_cases
      SET status = ?, reviewer = ?, review_note = ?, ai_recommendation = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, reviewer.reviewer, note, aiRecommendation, Date.now(), decodeURIComponent(review[1])).run();
    return json({ ok: true, updated: Number(result?.meta?.changes) > 0, status });
  }

  return json({ ok: false, error: 'Anti-cheat endpoint not found' }, 404);
}

async function routeRealtimeSocket(request, env) {
  if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'WebSocket upgrade required' }, 426);
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const integrity = await verifyIntegrityTransport(request, auth);
  if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);
  const stub = playerStateStub(env, auth.userId);
  const internal = new Request('https://player-state/connect', {
    method: 'GET',
    headers: internalStateHeaders(auth, request, integrity)
  });
  return stub.fetch(internal);
}

async function routePositionFallback(request, env) {
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const integrity = await verifyIntegrityTransport(request, auth);
  if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);
  const body = await readJson(request);
  const stub = playerStateStub(env, auth.userId);
  const internal = new Request('https://player-state/position', {
    method: 'POST',
    headers: {
      ...Object.fromEntries(internalStateHeaders(auth, request, integrity)),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body || {})
  });
  return stub.fetch(internal);
}

async function routeRealtimeCheckpoint(request, env) {
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const integrity = await verifyIntegrityTransport(request, auth);
  if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);
  const body = await readJson(request);
  const reason = String(body?.reason || 'explicit-http').slice(0, 32);
  const stub = playerStateStub(env, auth.userId);
  const headers = internalStateHeaders(auth, request, integrity);
  headers.set('x-ironvale-checkpoint-reason', reason);
  return stub.fetch(new Request('https://player-state/checkpoint', { method: 'POST', headers }));
}

async function checkpointBeforeLogout(request, env) {
  const auth = await loadSessionState(request, env);
  if (!auth) return;
  const stub = playerStateStub(env, auth.userId);
  const headers = internalStateHeaders(auth, request);
  headers.set('x-ironvale-checkpoint-reason', 'logout');
  await stub.fetch(new Request('https://player-state/checkpoint', {
    method: 'POST',
    headers
  })).catch(() => null);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === 'GET' && url.pathname === '/api/anticheat/session-status') return routeAntiCheatSessionStatus(request, env);
    if (url.pathname.startsWith('/api/anticheat/')) return routeAntiCheatApi(request, env, url);

    if (method === 'GET' && url.pathname === '/api/integrity/challenge') return routeIntegrityChallenge(request, env);
    if (method === 'POST' && url.pathname === '/api/integrity/attest') return routeIntegrityAttest(request, env);

    if (url.pathname === '/api/realtime/movement') {
      return routeRealtimeSocket(request, env);
    }

    if (method === 'POST' && url.pathname === '/api/realtime/checkpoint') {
      return routeRealtimeCheckpoint(request, env);
    }

    // Compatibility bridge: the legacy 5-second position heartbeat is intercepted
    // and routed into the RAM authority instead of writing to D1.
    if (method === 'PUT' && url.pathname === '/api/character/position') {
      return routePositionFallback(request, env);
    }

    if (method === 'POST' && url.pathname === '/api/auth/logout') {
      await checkpointBeforeLogout(request, env);
    }

    if (mutatingApiRequiresIntegrity(method, url.pathname)) {
      const auth = await loadSessionState(request, env);
      if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
      const integrity = await verifyIntegrityTransport(request, auth);
      if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);
    }

    return coreWorker.fetch(request, env, ctx);
  }
};

export class PlayerState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.httpState = null;
    try {
      this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    } catch (_) {}
  }

  stateFromHeaders(request) {
    const now = Date.now();
    return {
      format: REALTIME_FORMAT,
      userId: String(request.headers.get('x-ironvale-user-id') || ''),
      username: String(request.headers.get('x-ironvale-username') || 'Player').slice(0, 24),
      sessionId: String(request.headers.get('x-ironvale-session-id') || ''),
      sessionExpiresAt: finite(request.headers.get('x-ironvale-session-expires'), now),
      x: finite(request.headers.get('x-ironvale-x'), DEFAULT_SPAWN.x),
      y: finite(request.headers.get('x-ironvale-y'), DEFAULT_SPAWN.y),
      z: finite(request.headers.get('x-ironvale-z'), DEFAULT_SPAWN.z),
      yaw: finite(request.headers.get('x-ironvale-yaw'), DEFAULT_SPAWN.yaw),
      seq: 0,
      connectedAt: now,
      lastAcceptedAt: now,
      lastCheckpointAt: now,
      sourceUpdatedAt: finite(request.headers.get('x-ironvale-updated-at'), now),
      dirty: false,
      superseded: false,
      accepted: 0,
      rejected: 0,
      checkpointCount: 0,
      lastRejectReason: null,
      integrityStatus: String(request.headers.get('x-ironvale-integrity-status') || 'missing'),
      integrityBuildId: String(request.headers.get('x-ironvale-integrity-build') || ''),
      integrityManifestDigest: String(request.headers.get('x-ironvale-integrity-digest') || ''),
      integrityExpiresAt: finite(request.headers.get('x-ironvale-integrity-expires'), 0),
      antiCheat: createAntiCheatState(now)
    };
  }

  async ensureCheckpointAlarm() {
    const current = await this.ctx.storage.getAlarm();
    if (current == null) await this.ctx.storage.setAlarm(Date.now() + CHECKPOINT_INTERVAL_MS);
  }

  latestAuthorityState() {
    let best = this.httpState && !this.httpState.superseded ? { state: this.httpState, socket: null } : null;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const candidate = ws.deserializeAttachment();
        if (!candidate || candidate.superseded) continue;
        if (!best || Number(candidate.lastAcceptedAt || candidate.sourceUpdatedAt || 0) > Number(best.state.lastAcceptedAt || best.state.sourceUpdatedAt || 0)) {
          best = { state: candidate, socket: ws };
        }
      } catch (_) {}
    }
    return best;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/connect') return this.connect(request);
    if (url.pathname === '/position' && request.method === 'POST') return this.position(request);
    if (url.pathname === '/checkpoint' && request.method === 'POST') return this.checkpointRequest(request);
    if (url.pathname === '/anticheat-status' && request.method === 'GET') return this.antiCheatStatus(request);
    return json({ ok: false, error: 'Not found' }, 404);
  }

  antiCheatStatus(request) {
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

  async connect(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'WebSocket upgrade required' }, 426);
    let initial = this.stateFromHeaders(request);
    if (!initial.userId || initial.sessionExpiresAt <= Date.now()) return json({ ok: false, error: 'Session expired' }, 401);

    // Carry the freshest RAM authority into the replacement socket before older
    // sockets are superseded. This prevents a reconnect from reverting to the
    // last D1 checkpoint after an HTTP-fallback movement window.
    const carried = this.latestAuthorityState();
    if (carried?.state?.userId === initial.userId) {
      const sameSession = carried.state.sessionId === initial.sessionId;
      initial = {
        ...carried.state,
        username: initial.username,
        sessionId: initial.sessionId,
        sessionExpiresAt: initial.sessionExpiresAt,
        antiCheat: sameSession ? carried.state.antiCheat : initial.antiCheat,
        integrityStatus: initial.integrityStatus,
        integrityBuildId: initial.integrityBuildId,
        integrityManifestDigest: initial.integrityManifestDigest,
        integrityExpiresAt: initial.integrityExpiresAt,
        superseded: false,
        connectedAt: Date.now()
      };
    }

    for (const existing of this.ctx.getWebSockets()) {
      try {
        const previous = existing.deserializeAttachment() || {};
        previous.superseded = true;
        existing.serializeAttachment(previous);
        existing.close(4001, 'superseded');
      } catch (_) {}
    }
    this.httpState = null;

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, ['player']);
    server.serializeAttachment(initial);
    if (initial.dirty) await this.ensureCheckpointAlarm();
    server.send(JSON.stringify({
      type: 'hello',
      format: REALTIME_FORMAT,
      position: { x: initial.x, y: initial.y, z: initial.z, yaw: initial.yaw },
      checkpointIntervalMs: CHECKPOINT_INTERVAL_MS,
      validator: 'server-authoritative',
      antiCheatPolicy: { enabled: true, serverPrivate: true, automaticBan: ANTICHEAT_POLICY.automaticBan },
      integrity: { status: initial.integrityStatus, buildId: initial.integrityBuildId, expiresAt: initial.integrityExpiresAt }
    }));
    return new Response(null, { status: 101, webSocket: client });
  }

  validateMovement(state, packet) {
    const now = Date.now();
    if (state.sessionExpiresAt <= now) return { ok: false, reason: 'session-expired', close: true };
    if (state.integrityStatus !== 'attested' || state.integrityBuildId !== EXPECTED_INTEGRITY_BUILD_ID || state.integrityManifestDigest !== EXPECTED_INTEGRITY_MANIFEST_DIGEST) return { ok: false, reason: 'integrity-required', close: true };
    if (Number(state.integrityExpiresAt) <= now) return { ok: false, reason: 'integrity-expired', close: true };

    const x = finite(packet?.x);
    const y = finite(packet?.y);
    const z = finite(packet?.z);
    const yaw = finite(packet?.yaw);
    if ([x, y, z, yaw].some(value => value === null)) return { ok: false, reason: 'non-finite-position' };
    if (x < WORLD_MIN_X || x > WORLD_MAX_X || z < WORLD_MIN_Z || z > WORLD_MAX_Z || Math.abs(y) > MAX_Y_ABS) {
      return { ok: false, reason: 'world-bounds' };
    }

    const nextSeq = Number.isFinite(Number(packet?.seq)) ? Math.trunc(Number(packet.seq)) : state.seq + 1;
    if (nextSeq <= state.seq) return { ok: false, reason: 'stale-sequence' };

    const elapsedSeconds = Math.max(0.1, Math.min(30, (now - Number(state.lastAcceptedAt || now)) / 1000));
    const horizontalDistance = Math.hypot(x - state.x, z - state.z);
    const verticalDistance = Math.abs(y - state.y);
    const horizontalLimit = MAX_HORIZONTAL_SPEED_MPS * elapsedSeconds + HORIZONTAL_LAG_ALLOWANCE_METERS;
    const verticalLimit = MAX_VERTICAL_SPEED_MPS * elapsedSeconds + VERTICAL_LAG_ALLOWANCE_METERS;

    if (horizontalDistance > horizontalLimit) {
      return { ok: false, reason: 'horizontal-speed', horizontalDistance, horizontalLimit };
    }
    if (verticalDistance > verticalLimit) {
      return { ok: false, reason: 'vertical-speed', verticalDistance, verticalLimit };
    }

    return { ok: true, now, x, y, z, yaw, seq: nextSeq, clientSentAt: finite(packet?.clientSentAt) };
  }

  applyAccepted(state, accepted) {
    const moved = Math.hypot(accepted.x - state.x, accepted.y - state.y, accepted.z - state.z) > 0.01 || Math.abs(accepted.yaw - state.yaw) > 0.001;
    state.antiCheat = observeAcceptedMovement(state.antiCheat, { x: state.x, y: state.y, z: state.z, yaw: state.yaw, lastAcceptedAt: state.lastAcceptedAt }, accepted);
    state.x = accepted.x;
    state.y = accepted.y;
    state.z = accepted.z;
    state.yaw = accepted.yaw;
    state.seq = accepted.seq;
    state.lastAcceptedAt = accepted.now;
    state.accepted += 1;
    state.lastRejectReason = null;
    if (moved) state.dirty = true;
    return moved;
  }

  correction(state, validation) {
    state.rejected += 1;
    state.lastRejectReason = validation.reason;
    state.antiCheat = observeRejectedMovement(state.antiCheat, validation.reason, Date.now());
    return {
      type: 'correction',
      ok: false,
      reason: validation.reason,
      seq: state.seq,
      position: { x: state.x, y: state.y, z: state.z, yaw: state.yaw },
      clientSentAt: validation?.clientSentAt ?? null
    };
  }


  async persistAntiCheatCaseIfNeeded(state) {
    if (!state?.userId || !shouldPersistAntiCheatCase(state.antiCheat)) return false;
    await ensureAntiCheatTables(this.env);
    const now = Date.now();
    const caseId = state.antiCheat?.caseId || `ac-${state.sessionId || state.userId}`;
    const summary = antiCheatSummary(state.antiCheat);
    const evidence = antiCheatEvidence(state.antiCheat);
    const firstSeen = Number(state.antiCheat?.firstCaseAt) || now;
    await this.env.DB.prepare(`
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
    `).bind(
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

  async checkpointState(state, reason = 'checkpoint') {
    if (!state?.userId || !state.dirty) return false;
    const now = Date.now();
    await this.env.DB.prepare(`
      INSERT INTO rift_characters
        (user_id, display_name, position_x, position_y, position_z, yaw, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        position_x = excluded.position_x,
        position_y = excluded.position_y,
        position_z = excluded.position_z,
        yaw = excluded.yaw,
        updated_at = excluded.updated_at
    `).bind(
      state.userId,
      state.username || 'Player',
      state.x,
      state.y,
      state.z,
      state.yaw,
      now,
      now
    ).run();
    state.dirty = false;
    state.lastCheckpointAt = now;
    state.checkpointCount += 1;
    state.lastCheckpointReason = reason;
    return true;
  }

  async webSocketMessage(ws, message) {
    let packet;
    try {
      packet = typeof message === 'string' ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'invalid-message' }));
      return;
    }

    const state = ws.deserializeAttachment();
    if (!state || state.superseded) return;

    if (packet?.type === 'checkpoint') {
      const saved = await this.checkpointState(state, String(packet.reason || 'client-checkpoint').slice(0, 32));
      ws.serializeAttachment(state);
      ws.send(JSON.stringify({ type: 'checkpoint', ok: true, saved, checkpointCount: state.checkpointCount }));
      return;
    }

    if (packet?.type !== 'move') return;
    const validation = this.validateMovement(state, packet);
    if (!validation.ok) {
      const reply = this.correction(state, validation);
      await this.persistAntiCheatCaseIfNeeded(state);
      ws.serializeAttachment(state);
      ws.send(JSON.stringify(reply));
      if (validation.close) ws.close(4003, validation.reason);
      return;
    }

    this.applyAccepted(state, validation);
    await this.persistAntiCheatCaseIfNeeded(state);
    if (state.dirty) await this.ensureCheckpointAlarm();
    let checkpointed = false;
    if (state.dirty && validation.now - state.lastCheckpointAt >= CHECKPOINT_INTERVAL_MS) {
      checkpointed = await this.checkpointState(state, 'periodic-safety');
    }
    ws.serializeAttachment(state);
    ws.send(JSON.stringify({
      type: 'accepted',
      ok: true,
      seq: state.seq,
      checkpointed,
      checkpointCount: state.checkpointCount,
      position: { x: state.x, y: state.y, z: state.z, yaw: state.yaw },
      clientSentAt: validation.clientSentAt ?? null
    }));
  }

  async position(request) {
    if (!this.httpState) this.httpState = this.stateFromHeaders(request);
    const packet = await readJson(request);
    const validation = this.validateMovement(this.httpState, packet);
    if (!validation.ok) {
      const correction = this.correction(this.httpState, validation);
      await this.persistAntiCheatCaseIfNeeded(this.httpState);
      return json(correction, validation.close ? 401 : 409);
    }

    this.applyAccepted(this.httpState, validation);
    await this.persistAntiCheatCaseIfNeeded(this.httpState);
    await this.ensureCheckpointAlarm();
    let checkpointed = false;
    if (this.httpState.dirty && validation.now - this.httpState.lastCheckpointAt >= CHECKPOINT_INTERVAL_MS) {
      checkpointed = await this.checkpointState(this.httpState, 'periodic-http-fallback');
    }
    return json({
      ok: true,
      realtime: true,
      accepted: true,
      seq: this.httpState.seq,
      checkpointed,
      position: { x: this.httpState.x, y: this.httpState.y, z: this.httpState.z, yaw: this.httpState.yaw },
      clientSentAt: validation.clientSentAt ?? null
    }, 202);
  }

  async checkpointRequest(request) {
    const selected = this.latestAuthorityState();
    const best = selected?.state || this.stateFromHeaders(request);
    const checkpointReason = String(request.headers.get('x-ironvale-checkpoint-reason') || 'explicit-http').slice(0, 32);
    const saved = await this.checkpointState(best, checkpointReason);
    if (selected?.socket) {
      try { selected.socket.serializeAttachment(best); } catch (_) {}
    } else {
      this.httpState = best;
    }
    return json({ ok: true, saved, checkpointCount: best.checkpointCount || 0 });
  }

  async alarm() {
    const best = this.latestAuthorityState();
    if (best?.state) {
      await this.checkpointState(best.state, 'periodic-alarm');
      if (best.socket) {
        try { best.socket.serializeAttachment(best.state); } catch (_) {}
      } else {
        this.httpState = best.state;
      }
    }
    const remaining = this.latestAuthorityState();
    if (remaining?.state?.dirty) await this.ctx.storage.setAlarm(Date.now() + CHECKPOINT_INTERVAL_MS);
  }

  async webSocketClose(ws, code, reason) {
    try {
      const closing = ws.deserializeAttachment();
      if (closing && !closing.superseded) {
        const fallback = this.httpState && Number(this.httpState.lastAcceptedAt || 0) > Number(closing.lastAcceptedAt || 0) ? this.httpState : closing;
        await this.checkpointState(fallback, 'disconnect');
        if (fallback === this.httpState) this.httpState = fallback;
      }
    } catch (error) {
      console.error('Ironvale realtime disconnect checkpoint failed', error);
    }
    try { ws.close(code, reason); } catch (_) {}
  }

  async webSocketError(ws, error) {
    try {
      const socketState = ws.deserializeAttachment();
      if (socketState && !socketState.superseded) {
        const fallback = this.httpState && Number(this.httpState.lastAcceptedAt || 0) > Number(socketState.lastAcceptedAt || 0) ? this.httpState : socketState;
        await this.checkpointState(fallback, 'socket-error');
        if (fallback === this.httpState) this.httpState = fallback;
      }
    } catch (checkpointError) {
      console.error('Ironvale realtime socket checkpoint failed', checkpointError);
    }
    console.error('Ironvale realtime WebSocket error', error);
  }
}
