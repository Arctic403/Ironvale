export const RIFT_REALTIME_FORMAT = 'ironvale-realtime-client-v1';

const MOVEMENT_PATH = '/api/character/position';
const SOCKET_PATH = '/api/realtime/movement';
const RECONNECT_MIN_MS = 1200;
const RECONNECT_MAX_MS = 8000;

const baseFetch = window.fetch.bind(window);
const worldScreen = document.querySelector('#world-screen');
const state = {
  format: RIFT_REALTIME_FORMAT,
  transport: 'websocket',
  authority: 'server-durable-object',
  d1Policy: 'load-checkpoint-only',
  socketState: 'idle',
  connectedAt: null,
  lastMessageAt: null,
  lastError: null,
  sequence: 0,
  sent: 0,
  accepted: 0,
  rejected: 0,
  corrections: 0,
  checkpoints: 0,
  fallbackHttp: 0,
  reconnects: 0,
  lastAck: null
};

let socket = null;
let reconnectTimer = 0;
let reconnectDelay = RECONNECT_MIN_MS;
let providerRegistered = false;

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
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', () => {
    state.socketState = 'open';
    state.connectedAt = new Date().toISOString();
    state.lastError = null;
    reconnectDelay = RECONNECT_MIN_MS;
    record('Realtime movement authority connected', { transport: 'websocket', d1Policy: state.d1Policy });
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
      if (message.checkpointed) state.checkpoints += 1;
      return;
    }
    if (message?.type === 'checkpoint') {
      if (message.saved) state.checkpoints += 1;
      return;
    }
    if (message?.type === 'correction') {
      state.rejected += 1;
      state.corrections += 1;
      record('Server rejected impossible movement', { reason: message.reason, seq: message.seq }, 'warn');
      window.dispatchEvent(new CustomEvent('ironvale:movement-correction', {
        detail: { reason: message.reason, seq: message.seq, position: message.position || null }
      }));
    }
  });

  socket.addEventListener('error', () => {
    state.socketState = 'error';
    state.lastError = 'WebSocket transport error';
  });

  socket.addEventListener('close', event => {
    const wasOpen = state.socketState === 'open';
    state.socketState = 'closed';
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
}

function sendCheckpoint(reason) {
  if (!socketOpen()) return false;
  try {
    socket.send(JSON.stringify({ type: 'checkpoint', reason: String(reason || 'client').slice(0, 32) }));
    return true;
  } catch {
    return false;
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
    const body = await requestJson(input, init);
    const packet = {
      type: 'move',
      seq: ++state.sequence,
      x: Number(body?.x),
      y: Number(body?.y),
      z: Number(body?.z),
      yaw: Number(body?.yaw)
    };

    if (socketOpen()) {
      try {
        socket.send(JSON.stringify(packet));
        state.sent += 1;
        return new Response(JSON.stringify({ ok: true, realtime: true, queued: true, seq: packet.seq }), {
          status: 202,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      } catch (error) {
        state.lastError = String(error?.message || error || 'Movement send failed').slice(0, 160);
      }
    }

    // If the socket has not connected yet, preserve movement through the Worker ->
    // Durable Object HTTP fallback. That path still does not persist every move to D1.
    state.fallbackHttp += 1;
    return baseFetch(input, init);
  }

  if (url?.origin === location.origin && url.pathname === '/api/auth/logout' && method === 'POST') {
    sendCheckpoint('logout');
    const response = await baseFetch(input, init);
    closeSocket('logout');
    return response;
  }

  const response = await baseFetch(input, init);
  if (url?.origin === location.origin && url.pathname === '/api/bootstrap' && response.ok) {
    queueMicrotask(connect);
  }
  return response;
};

function registerDiagnosticsProvider() {
  if (providerRegistered) return;
  const diagnostics = window.IronvaleDiagnostics;
  if (!diagnostics?.registerProvider) {
    setTimeout(registerDiagnosticsProvider, 100);
    return;
  }
  diagnostics.registerProvider('realtime-movement', () => ({
    ...state,
    socketState: socket?.readyState === WebSocket.OPEN ? 'open' : state.socketState,
    checkpointPolicy: {
      periodicSafetyMs: 5 * 60 * 1000,
      disconnect: true,
      logout: true,
      ordinaryMovementWritesToD1: false
    }
  }));
  providerRegistered = true;
}

const observer = new MutationObserver(() => {
  if (shouldConnect()) connect();
  else if (worldScreen?.hidden !== false) closeSocket('world-hidden');
});
if (worldScreen) observer.observe(worldScreen, { attributes: true, attributeFilter: ['hidden'] });

window.addEventListener('online', connect);
window.addEventListener('offline', () => { state.socketState = 'offline'; });
window.addEventListener('pagehide', () => { sendCheckpoint('pagehide'); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sendCheckpoint('visibility-hidden');
  else connect();
});

registerDiagnosticsProvider();
queueMicrotask(connect);
