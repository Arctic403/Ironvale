import coreWorker from './index.js';
import { DurableObject } from 'cloudflare:workers';

const SESSION_COOKIE = 'ironvale_session';
const DEFAULT_SPAWN = Object.freeze({ x: 320, y: 0.9, z: 320, yaw: 0 });
const WORLD_MIN_X = 0;
const WORLD_MAX_X = 640;
const WORLD_MIN_Z = 0;
const WORLD_MAX_Z = 640;
const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000;
const MAX_HORIZONTAL_SPEED_MPS = 7.2;
const HORIZONTAL_LAG_ALLOWANCE_METERS = 3.5;
const MAX_VERTICAL_SPEED_MPS = 60;
const VERTICAL_LAG_ALLOWANCE_METERS = 20;
const MAX_Y_ABS = 10000;
const REALTIME_FORMAT = 'ironvale-realtime-authority-v2';

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
    SELECT s.expires_at,
           u.id AS user_id, u.username, u.is_banned,
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
    sessionExpiresAt: Number(row.expires_at),
    position: {
      x: finite(row.position_x, DEFAULT_SPAWN.x),
      y: finite(row.position_y, DEFAULT_SPAWN.y),
      z: finite(row.position_z, DEFAULT_SPAWN.z),
      yaw: finite(row.yaw, DEFAULT_SPAWN.yaw)
    },
    updatedAt: finite(row.updated_at, Date.now())
  };
}

function playerStateStub(env, userId) {
  const id = env.PLAYER_STATE.idFromName(String(userId));
  return env.PLAYER_STATE.get(id);
}

function internalStateHeaders(auth, request) {
  const headers = new Headers();
  headers.set('x-ironvale-user-id', auth.userId);
  headers.set('x-ironvale-username', auth.username);
  headers.set('x-ironvale-session-expires', String(auth.sessionExpiresAt));
  headers.set('x-ironvale-x', String(auth.position.x));
  headers.set('x-ironvale-y', String(auth.position.y));
  headers.set('x-ironvale-z', String(auth.position.z));
  headers.set('x-ironvale-yaw', String(auth.position.yaw));
  headers.set('x-ironvale-updated-at', String(auth.updatedAt));
  if (request.headers.get('Upgrade') === 'websocket') headers.set('Upgrade', 'websocket');
  return headers;
}

async function routeRealtimeSocket(request, env) {
  if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'WebSocket upgrade required' }, 426);
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const stub = playerStateStub(env, auth.userId);
  const internal = new Request('https://player-state/connect', {
    method: 'GET',
    headers: internalStateHeaders(auth, request)
  });
  return stub.fetch(internal);
}

async function routePositionFallback(request, env) {
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const body = await readJson(request);
  const stub = playerStateStub(env, auth.userId);
  const internal = new Request('https://player-state/position', {
    method: 'POST',
    headers: {
      ...Object.fromEntries(internalStateHeaders(auth, request)),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body || {})
  });
  return stub.fetch(internal);
}

async function routeRealtimeCheckpoint(request, env) {
  const auth = await loadSessionState(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const body = await readJson(request);
  const reason = String(body?.reason || 'explicit-http').slice(0, 32);
  const stub = playerStateStub(env, auth.userId);
  const headers = internalStateHeaders(auth, request);
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
      lastRejectReason: null
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
    return json({ ok: false, error: 'Not found' }, 404);
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
      initial = {
        ...carried.state,
        username: initial.username,
        sessionExpiresAt: initial.sessionExpiresAt,
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
      validator: 'server-authoritative'
    }));
    return new Response(null, { status: 101, webSocket: client });
  }

  validateMovement(state, packet) {
    const now = Date.now();
    if (state.sessionExpiresAt <= now) return { ok: false, reason: 'session-expired', close: true };

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
    return {
      type: 'correction',
      ok: false,
      reason: validation.reason,
      seq: state.seq,
      position: { x: state.x, y: state.y, z: state.z, yaw: state.yaw },
      clientSentAt: validation?.clientSentAt ?? null
    };
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
      ws.serializeAttachment(state);
      ws.send(JSON.stringify(reply));
      if (validation.close) ws.close(4003, validation.reason);
      return;
    }

    this.applyAccepted(state, validation);
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
      return json(correction, validation.close ? 401 : 409);
    }

    this.applyAccepted(this.httpState, validation);
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
