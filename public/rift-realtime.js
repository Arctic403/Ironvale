export const RIFT_REALTIME_FORMAT = 'ironvale-realtime-client-v2';

const MOVEMENT_PATH = '/api/character/position';
const SOCKET_PATH = '/api/realtime/movement';
const CHECKPOINT_PATH = '/api/realtime/checkpoint';
const RECONNECT_MIN_MS = 1200;
const RECONNECT_MAX_MS = 8000;
const PUBLISH_INTERVAL_MS = 100;
const POSITION_EPSILON_METERS = 0.02;
const YAW_EPSILON_RADIANS = 0.005;
const FALLBACK_GRACE_MS = 1500;
const FALLBACK_MIN_INTERVAL_MS = 500;
const MAX_PENDING_ACKS = 64;

const baseFetch = window.fetch.bind(window);
const worldScreen = document.querySelector('#world-screen');
const state = {
  format: RIFT_REALTIME_FORMAT,
  transport: 'websocket',
  authority: 'server-durable-object',
  d1Policy: 'load-checkpoint-only',
  publisherMode: 'direct-meaningful-10hz',
  socketState: 'idle',
  connectedAt: null,
  disconnectedAt: null,
  lastMessageAt: null,
  lastPublishAt: null,
  lastError: null,
  sequence: 0,
  publishAttempts: 0,
  published: 0,
  directPublished: 0,
  legacyIntercepts: 0,
  skippedThrottle: 0,
  skippedUnchanged: 0,
  queuedWhileDisconnected: 0,
  sent: 0,
  accepted: 0,
  rejected: 0,
  corrections: 0,
  checkpoints: 0,
  checkpointRequests: 0,
  fallbackHttp: 0,
  fallbackPublished: 0,
  reconnects: 0,
  lastRttMs: null,
  averageRttMs: null,
  rttSamples: 0,
  lastAck: null,
  lastPublishedPosition: null,
  pendingPosition: null
};

let socket = null;
let reconnectTimer = 0;
let reconnectDelay = RECONNECT_MIN_MS;
let providerRegistered = false;
let lastDispatchPerf = 0;
let disconnectedSincePerf = 0;
let lastFallbackPerf = 0;
let fallbackInFlight = false;
let pendingPosition = null;
let lastPublishedPosition = null;
const pendingAcks = new Map();

function record(message, data = null, severity = 'info') {
  try { window.IronvaleDiagnostics?.record?.('realtime', message, data, severity); } catch (_) {}
}

function socketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}${SOCKET_PATH}`;
}

function shouldConnect() {
  return navigator.onLine !== false && worldScreen?.hidden === false;
}

function socketOpen() {
  return socket?.readyState === WebSocket.OPEN;
}

function finitePosition(position) {
  const normalized = {
    x: Number(position?.x),
    y: Number(position?.y),
    z: Number(position?.z),
    yaw: Number(position?.yaw)
  };
  return Object.values(normalized).every(Number.isFinite) ? normalized : null;
}

function angularDelta(a, b) {
  let delta = Math.abs(Number(a) - Number(b)) % (Math.PI * 2);
  if (delta > Math.PI) delta = Math.PI * 2 - delta;
  return delta;
}

function meaningfullyChanged(position, reference) {
  if (!reference) return true;
  return Math.hypot(position.x - reference.x, position.y - reference.y, position.z - reference.z) >= POSITION_EPSILON_METERS ||
    angularDelta(position.yaw, reference.yaw) >= YAW_EPSILON_RADIANS;
}

function rememberPending(position) {
  pendingPosition = { ...position };
  state.pendingPosition = { ...position };
}

function clearPending() {
  pendingPosition = null;
  state.pendingPosition = null;
}

function rememberPublished(position) {
  lastPublishedPosition = { ...position };
  state.lastPublishedPosition = { ...position };
  state.lastPublishAt = new Date().toISOString();
}

function trimPendingAcks() {
  while (pendingAcks.size > MAX_PENDING_ACKS) pendingAcks.delete(pendingAcks.keys().next().value);
}

function makePacket(position) {
  const seq = ++state.sequence;
  return {
    type: 'move',
    seq,
    x: position.x,
    y: position.y,
    z: position.z,
    yaw: position.yaw,
    clientSentAt: Date.now()
  };
}

function trackDispatch(packet, position, source) {
  lastDispatchPerf = performance.now();
  rememberPublished(position);
  clearPending();
  state.sent += 1;
  state.published += 1;
  if (source === 'direct') state.directPublished += 1;
  pendingAcks.set(packet.seq, performance.now());
  trimPendingAcks();
}

function updateRtt(message) {
  const seq = Number(message?.seq);
  const started = pendingAcks.get(seq);
  if (started == null) return;
  pendingAcks.delete(seq);
  const rtt = Math.max(0, performance.now() - started);
  state.lastRttMs = Math.round(rtt * 10) / 10;
  state.rttSamples += 1;
  state.averageRttMs = state.averageRttMs == null
    ? state.lastRttMs
    : Math.round((state.averageRttMs * 0.85 + state.lastRttMs * 0.15) * 10) / 10;
}

function applyCorrection(message) {
  updateRtt(message);
  state.rejected += 1;
  state.corrections += 1;
  if (message?.position) rememberPublished(message.position);
  record('Server rejected impossible movement', { reason: message?.reason, seq: message?.seq }, 'warn');
  window.dispatchEvent(new CustomEvent('ironvale:movement-correction', {
    detail: { reason: message?.reason, seq: message?.seq, position: message?.position || null }
  }));
}

function dispatchSocketPosition(position, source = 'direct') {
  if (!socketOpen()) return false;
  const packet = makePacket(position);
  try {
    socket.send(JSON.stringify(packet));
    trackDispatch(packet, position, source);
    return true;
  } catch (error) {
    state.lastError = String(error?.message || error || 'Movement send failed').slice(0, 160);
    rememberPending(position);
    return false;
  }
}

async function dispatchFallbackPosition(position, source = 'direct', keepalive = false) {
  if (fallbackInFlight) {
    rememberPending(position);
    return false;
  }
  fallbackInFlight = true;
  const packet = makePacket(position);
  lastFallbackPerf = performance.now();
  state.fallbackHttp += 1;
  state.fallbackPublished += 1;
  trackDispatch(packet, position, source);
  try {
    const response = await baseFetch(MOVEMENT_PATH, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packet),
      keepalive
    });
    const body = await response.clone().json().catch(() => ({}));
    if (response.ok && body?.accepted !== false) {
      state.accepted += 1;
      updateRtt({ seq: body?.seq ?? packet.seq });
      state.lastAck = {
        type: 'accepted-http',
        seq: Number(body?.seq ?? packet.seq),
        checkpointed: Boolean(body?.checkpointed),
        reason: null
      };
      if (body?.checkpointed) state.checkpoints += 1;
      return true;
    }
    if (body?.type === 'correction' || response.status === 409) applyCorrection({ ...body, seq: body?.seq ?? packet.seq });
    else state.lastError = `Movement fallback HTTP ${response.status}`;
    return false;
  } catch (error) {
    state.lastError = String(error?.message || error || 'Movement fallback failed').slice(0, 160);
    rememberPending(position);
    return false;
  } finally {
    fallbackInFlight = false;
    if (socketOpen() && pendingPosition) queueMicrotask(() => flushPending(true));
  }
}

function flushPending(force = false) {
  if (!pendingPosition) return false;
  const position = { ...pendingPosition };
  if (socketOpen()) return dispatchSocketPosition(position, 'direct');
  const now = performance.now();
  if (!force && disconnectedSincePerf && now - disconnectedSincePerf < FALLBACK_GRACE_MS) return false;
  if (!force && now - lastFallbackPerf < FALLBACK_MIN_INTERVAL_MS) return false;
  void dispatchFallbackPosition(position, 'direct', false);
  return true;
}

function publishMovement(position, options = {}) {
  state.publishAttempts += 1;
  const normalized = finitePosition(position);
  if (!normalized) {
    state.lastError = 'Rejected non-finite client movement before transport';
    return { ok: false, reason: 'non-finite-position' };
  }

  const force = options?.force === true;
  const source = options?.source === 'legacy-fetch' ? 'legacy' : 'direct';
  const reference = pendingPosition || lastPublishedPosition;
  if (!force && !meaningfullyChanged(normalized, reference)) {
    state.skippedUnchanged += 1;
    return { ok: true, sent: false, reason: 'unchanged' };
  }

  const now = performance.now();
  if (!force && now - lastDispatchPerf < PUBLISH_INTERVAL_MS) {
    rememberPending(normalized);
    state.skippedThrottle += 1;
    return { ok: true, sent: false, queued: true, reason: 'throttled' };
  }

  if (socketOpen()) {
    const sent = dispatchSocketPosition(normalized, source === 'legacy' ? 'legacy' : 'direct');
    return { ok: sent, sent, transport: 'websocket', seq: state.sequence };
  }

  rememberPending(normalized);
  state.queuedWhileDisconnected += 1;
  const disconnectedFor = disconnectedSincePerf ? now - disconnectedSincePerf : 0;
  if (force || disconnectedFor >= FALLBACK_GRACE_MS) {
    if (force || now - lastFallbackPerf >= FALLBACK_MIN_INTERVAL_MS) {
      void dispatchFallbackPosition(normalized, source === 'legacy' ? 'legacy' : 'direct', options?.keepalive === true);
      return { ok: true, sent: true, transport: 'http-fallback', seq: state.sequence };
    }
  }
  return { ok: true, sent: false, queued: true, transport: 'pending' };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  if (!shouldConnect()) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(RECONNECT_MAX_MS, Math.round(reconnectDelay * 1.7));
  reconnectTimer = setTimeout(() => {
    state.reconnects += 1;
    connect();
  }, delay);
}

function connect() {
  if (!shouldConnect()) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  state.socketState = 'connecting';
  try {
    socket = new WebSocket(socketUrl());
  } catch (error) {
    state.socketState = 'error';
    state.lastError = String(error?.message || error || 'WebSocket construction failed').slice(0, 160);
    if (!disconnectedSincePerf) disconnectedSincePerf = performance.now();
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', () => {
    state.socketState = 'open';
    state.connectedAt = new Date().toISOString();
    state.disconnectedAt = null;
    state.lastError = null;
    disconnectedSincePerf = 0;
    reconnectDelay = RECONNECT_MIN_MS;
    record('Realtime movement authority connected', { transport: 'websocket', d1Policy: state.d1Policy, publisherMode: state.publisherMode });
    if (pendingPosition) queueMicrotask(() => flushPending(true));
  });

  socket.addEventListener('message', event => {
    state.lastMessageAt = new Date().toISOString();
    if (event.data === 'pong') return;
    let message;
    try { message = JSON.parse(String(event.data || '')); } catch { return; }

    state.lastAck = {
      type: String(message?.type || 'unknown').slice(0, 32),
      seq: Number.isFinite(Number(message?.seq)) ? Number(message.seq) : null,
      checkpointed: Boolean(message?.checkpointed),
      reason: message?.reason ? String(message.reason).slice(0, 64) : null
    };

    if (message?.type === 'accepted') {
      state.accepted += 1;
      updateRtt(message);
      if (message.checkpointed) state.checkpoints += 1;
      return;
    }
    if (message?.type === 'checkpoint') {
      if (message.saved) state.checkpoints += 1;
      return;
    }
    if (message?.type === 'correction') applyCorrection(message);
  });

  socket.addEventListener('error', () => {
    state.socketState = 'error';
    state.lastError = 'WebSocket transport error';
    if (!disconnectedSincePerf) disconnectedSincePerf = performance.now();
  });

  socket.addEventListener('close', event => {
    const wasOpen = state.socketState === 'open';
    state.socketState = 'closed';
    state.disconnectedAt = new Date().toISOString();
    if (!disconnectedSincePerf) disconnectedSincePerf = performance.now();
    socket = null;
    if (wasOpen) record('Realtime movement authority disconnected', { code: event.code, clean: event.wasClean }, event.wasClean ? 'info' : 'warn');
    scheduleReconnect();
  });
}

function closeSocket(reason = 'client-close') {
  clearTimeout(reconnectTimer);
  reconnectTimer = 0;
  if (!socket) return;
  try { socket.close(1000, String(reason).slice(0, 64)); } catch (_) {}
  socket = null;
  state.socketState = 'closed';
  state.disconnectedAt = new Date().toISOString();
  if (!disconnectedSincePerf) disconnectedSincePerf = performance.now();
}

function sendCheckpointSocket(reason) {
  if (!socketOpen()) return false;
  if (pendingPosition) flushPending(true);
  try {
    socket.send(JSON.stringify({ type: 'checkpoint', reason: String(reason || 'client').slice(0, 32) }));
    state.checkpointRequests += 1;
    return true;
  } catch {
    return false;
  }
}

async function checkpoint(reason = 'client', options = {}) {
  const label = String(reason || 'client').slice(0, 32);
  if (socketOpen() && sendCheckpointSocket(label)) return { ok: true, transport: 'websocket' };

  if (pendingPosition) await dispatchFallbackPosition({ ...pendingPosition }, 'direct', options?.keepalive === true).catch(() => false);
  try {
    state.checkpointRequests += 1;
    const response = await baseFetch(CHECKPOINT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: label }),
      keepalive: options?.keepalive === true
    });
    const body = await response.clone().json().catch(() => ({}));
    if (response.ok && body?.saved) state.checkpoints += 1;
    return { ok: response.ok, transport: 'http', saved: Boolean(body?.saved), status: response.status };
  } catch (error) {
    state.lastError = String(error?.message || error || 'Checkpoint fallback failed').slice(0, 160);
    return { ok: false, transport: 'http', error: state.lastError };
  }
}

function requestUrl(input) {
  try {
    if (input instanceof Request) return new URL(input.url, location.href);
    return new URL(String(input), location.href);
  } catch {
    return null;
  }
}

function requestMethod(input, init) {
  return String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

async function requestJson(input, init) {
  if (typeof init?.body === 'string') {
    try { return JSON.parse(init.body); } catch { return {}; }
  }
  if (input instanceof Request) {
    try { return await input.clone().json(); } catch { return {}; }
  }
  return {};
}

window.fetch = async function ironvaleRealtimeFetch(input, init = undefined) {
  const url = requestUrl(input);
  const method = requestMethod(input, init);

  if (url?.origin === location.origin && url.pathname === MOVEMENT_PATH && method === 'PUT') {
    state.legacyIntercepts += 1;
    const body = await requestJson(input, init);
    const result = publishMovement(body, { force: true, source: 'legacy-fetch', keepalive: init?.keepalive === true });
    return new Response(JSON.stringify({ ok: result.ok !== false, realtime: true, queued: result.sent !== true, legacyBridge: true, seq: state.sequence }), {
      status: result.ok === false ? 400 : 202,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  if (url?.origin === location.origin && url.pathname === '/api/auth/logout' && method === 'POST') {
    await checkpoint('logout', { keepalive: true }).catch(() => null);
    const response = await baseFetch(input, init);
    closeSocket('logout');
    return response;
  }

  const response = await baseFetch(input, init);
  if (url?.origin === location.origin && url.pathname === '/api/bootstrap' && response.ok) queueMicrotask(connect);
  return response;
};

function realtimeStatus() {
  const now = Date.now();
  return {
    ...state,
    socketState: socket?.readyState === WebSocket.OPEN ? 'open' : state.socketState,
    lastAckAgeMs: state.lastMessageAt ? Math.max(0, now - Date.parse(state.lastMessageAt)) : null,
    pendingPosition: pendingPosition ? { ...pendingPosition } : null,
    lastPublishedPosition: lastPublishedPosition ? { ...lastPublishedPosition } : null,
    publishPolicy: {
      mode: 'direct-meaningful-10hz',
      intervalMs: PUBLISH_INTERVAL_MS,
      maxHz: 1000 / PUBLISH_INTERVAL_MS,
      positionEpsilonMeters: POSITION_EPSILON_METERS,
      yawEpsilonRadians: YAW_EPSILON_RADIANS,
      fallbackGraceMs: FALLBACK_GRACE_MS,
      fallbackMaxHz: 1000 / FALLBACK_MIN_INTERVAL_MS,
      legacyFetchBridgeCompatibilityOnly: true,
      appLegacyHeartbeatRemoved: true
    },
    checkpointPolicy: {
      periodicSafetyMs: 5 * 60 * 1000,
      durableObjectAlarm: true,
      pagehide: true,
      visibilityHidden: true,
      disconnect: true,
      socketError: true,
      logout: true,
      ordinaryMovementWritesToD1: false
    }
  };
}

function registerDiagnosticsProvider() {
  if (providerRegistered) return;
  const diagnostics = window.IronvaleDiagnostics;
  if (!diagnostics?.registerProvider) {
    setTimeout(registerDiagnosticsProvider, 100);
    return;
  }
  diagnostics.registerProvider('realtime-movement', () => realtimeStatus());
  providerRegistered = true;
}

const observer = new MutationObserver(() => {
  if (shouldConnect()) connect();
  else if (worldScreen?.hidden !== false) closeSocket('world-hidden');
});
if (worldScreen) observer.observe(worldScreen, { attributes: true, attributeFilter: ['hidden'] });

window.IronvaleRealtimeMovement = Object.freeze({
  format: RIFT_REALTIME_FORMAT,
  publish: publishMovement,
  checkpoint,
  connect,
  status: realtimeStatus
});

window.addEventListener('online', connect);
window.addEventListener('offline', () => {
  state.socketState = 'offline';
  state.disconnectedAt = new Date().toISOString();
  if (!disconnectedSincePerf) disconnectedSincePerf = performance.now();
});
window.addEventListener('pagehide', () => { void checkpoint('pagehide', { keepalive: true }); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void checkpoint('visibility-hidden', { keepalive: true });
  else connect();
});

registerDiagnosticsProvider();
queueMicrotask(connect);
