import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const lines = value => value.join('\n');
function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}
function replaceRegexOnce(source, regex, after, label) {
  const matches = source.match(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')) || [];
  if (matches.length !== 1) throw new Error(`${label}: expected 1 regex match, found ${matches.length}`);
  return source.replace(regex, after);
}

let worker = read('src/realtime-entry.js');
worker = replaceOnce(worker,
  "import { verifyGitHubAntiCheatOidc } from './github-oidc.js';",
  lines([
    "import { verifyGitHubAntiCheatOidc } from './github-oidc.js';",
    "import { ZONE_AUTHORITY_FORMAT, ZONE_NEARBY_FORMAT, ZONE_SIZE_METERS, ZONE_PRESENCE_TTL_MS, ZONE_MOVEMENT_SYNC_MS, ZONE_CLIENT_HEARTBEAT_MS, ZONE_DEFAULT_INTEREST_RADIUS_METERS, ZONE_MAX_NEARBY, normalizedInterestRadius, zoneIdForPosition, zoneIdsForInterest } from './zone-contract.js';",
    "export { ZoneState } from './zone-authority.js';"
  ]), 'zone imports');

worker = replaceOnce(worker,
  lines([
    'function playerStateStub(env, userId) {',
    '  const id = env.PLAYER_STATE.idFromName(String(userId));',
    '  return env.PLAYER_STATE.get(id);',
    '}'
  ]),
  lines([
    'function playerStateStub(env, userId) {',
    '  const id = env.PLAYER_STATE.idFromName(String(userId));',
    '  return env.PLAYER_STATE.get(id);',
    '}',
    '',
    'function zoneStateStub(env, zoneId) {',
    "  if (!env.ZONE_STATE) throw new Error('ZONE_STATE binding unavailable');",
    '  const id = env.ZONE_STATE.idFromName(String(zoneId));',
    '  return env.ZONE_STATE.get(id);',
    '}'
  ]), 'zone stub');

const nearbyRoute = lines([
  'async function routeRealtimeNearby(request, env) {',
  '  const auth = await loadSessionState(request, env);',
  "  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);",
  '  const integrity = await verifyIntegrityTransport(request, auth);',
  "  if (!integrity.ok) return json({ ok: false, error: integrity.reason }, 428);",
  '  const sourceUrl = new URL(request.url);',
  "  const internalUrl = new URL('https://player-state/nearby');",
  "  if (sourceUrl.searchParams.has('radius')) internalUrl.searchParams.set('radius', sourceUrl.searchParams.get('radius'));",
  "  if (sourceUrl.searchParams.has('limit')) internalUrl.searchParams.set('limit', sourceUrl.searchParams.get('limit'));",
  '  const headers = internalStateHeaders(auth, request, integrity);',
  '  return playerStateStub(env, auth.userId).fetch(new Request(internalUrl, { method: \'GET\', headers }));',
  '}',
  ''
]);
worker = replaceOnce(worker,
  '\nfunction mutatingApiRequiresIntegrity(method, pathname) {',
  '\n' + nearbyRoute + 'function mutatingApiRequiresIntegrity(method, pathname) {',
  'nearby route helper');

worker = replaceOnce(worker,
  "    if (url.pathname === '/api/realtime/movement') {\n      return routeRealtimeSocket(request, env);\n    }",
  "    if (method === 'GET' && url.pathname === '/api/realtime/nearby') return routeRealtimeNearby(request, env);\n\n    if (url.pathname === '/api/realtime/movement') {\n      return routeRealtimeSocket(request, env);\n    }",
  'public nearby route');

worker = replaceOnce(worker,
  '      integrityExpiresAt: finite(request.headers.get(\'x-ironvale-integrity-expires\'), 0),\n      antiCheat: createAntiCheatState(now)',
  lines([
    "      integrityExpiresAt: finite(request.headers.get('x-ironvale-integrity-expires'), 0),",
    '      zoneAuthority: {',
    '        format: ZONE_AUTHORITY_FORMAT,',
    '        zoneId: null,',
    '        lastSyncAt: 0,',
    '        syncCount: 0,',
    '        handoffCount: 0,',
    '        nearbyReads: 0,',
    '        lastReason: null,',
    '        lastError: null',
    '      },',
    '      antiCheat: createAntiCheatState(now)'
  ]), 'zone state fields');

worker = replaceOnce(worker,
  "    if (url.pathname === '/anticheat-status' && request.method === 'GET') return this.antiCheatStatus(request);",
  "    if (url.pathname === '/anticheat-status' && request.method === 'GET') return this.antiCheatStatus(request);\n    if (url.pathname === '/nearby' && request.method === 'GET') return this.nearbyInterest(request);",
  'player nearby endpoint');

const authorityMethods = lines([
  '  async leaveZone(state, zoneId = state?.zoneAuthority?.zoneId) {',
  '    if (!state?.userId || !state?.sessionId || !zoneId || !this.env.ZONE_STATE) return false;',
  '    try {',
  "      const response = await zoneStateStub(this.env, zoneId).fetch(new Request('https://zone-state/leave', {",
  "        method: 'POST',",
  "        headers: { 'Content-Type': 'application/json' },",
  '        body: JSON.stringify({ userId: state.userId, sessionId: state.sessionId })',
  '      }));',
  '      return response.ok;',
  '    } catch (_) { return false; }',
  '  }',
  '',
  "  async syncZoneMembership(state, { force = false, reason = 'movement' } = {}) {",
  '    if (!state?.userId || !state?.sessionId || !this.env.ZONE_STATE) return { ok: false, error: \'zone-binding-unavailable\' };',
  '    const now = Date.now();',
  '    const zone = state.zoneAuthority || { format: ZONE_AUTHORITY_FORMAT, zoneId: null, lastSyncAt: 0, syncCount: 0, handoffCount: 0, nearbyReads: 0, lastReason: null, lastError: null };',
  '    const nextZoneId = zoneIdForPosition(state.x, state.z);',
  '    const zoneChanged = Boolean(zone.zoneId && zone.zoneId !== nextZoneId);',
  '    const due = force || zoneChanged || !zone.zoneId || now - Number(zone.lastSyncAt || 0) >= ZONE_MOVEMENT_SYNC_MS;',
  '    if (!due) return { ok: true, skipped: true, zoneId: zone.zoneId, zoneChanged: false };',
  '    if (zoneChanged) await this.leaveZone(state, zone.zoneId);',
  '    try {',
  "      const response = await zoneStateStub(this.env, nextZoneId).fetch(new Request('https://zone-state/presence', {",
  "        method: 'POST',",
  "        headers: { 'Content-Type': 'application/json' },",
  '        body: JSON.stringify({',
  '          zoneId: nextZoneId,',
  '          userId: state.userId,',
  '          username: state.username,',
  '          sessionId: state.sessionId,',
  '          x: state.x, y: state.y, z: state.z, yaw: state.yaw,',
  '          seq: state.seq, acceptedAt: state.lastAcceptedAt',
  '        })',
  '      }));',
  '      const body = await response.json().catch(() => ({}));',
  "      if (!response.ok || body?.ok !== true) throw new Error(body?.error || ('zone-presence-http-' + response.status));",
  '      zone.zoneId = nextZoneId;',
  '      zone.lastSyncAt = now;',
  '      zone.syncCount = Number(zone.syncCount || 0) + 1;',
  '      if (zoneChanged) zone.handoffCount = Number(zone.handoffCount || 0) + 1;',
  '      zone.lastReason = String(reason || \'movement\').slice(0, 32);',
  '      zone.lastError = null;',
  '      state.zoneAuthority = zone;',
  '      return { ...body, zoneChanged };',
  '    } catch (error) {',
  '      zone.lastError = String(error?.message || error || \'zone-sync-failed\').slice(0, 160);',
  '      state.zoneAuthority = zone;',
  '      return { ok: false, error: zone.lastError, zoneId: nextZoneId, zoneChanged };',
  '    }',
  '  }',
  '',
  '  async zoneStatus(state) {',
  "    const synced = await this.syncZoneMembership(state, { force: true, reason: 'status' });",
  "    const zoneId = state?.zoneAuthority?.zoneId || zoneIdForPosition(state?.x, state?.z);",
  '    let live = null;',
  '    try {',
  "      const response = await zoneStateStub(this.env, zoneId).fetch(new Request('https://zone-state/status'));",
  '      live = response.ok ? await response.json().catch(() => null) : null;',
  '    } catch (_) {}',
  '    return {',
  '      format: ZONE_AUTHORITY_FORMAT,',
  '      enabled: Boolean(this.env.ZONE_STATE),',
  "      source: 'zone-durable-object-ram',",
  '      zoneId,',
  '      zoneSizeMeters: ZONE_SIZE_METERS,',
  '      presenceTtlMs: ZONE_PRESENCE_TTL_MS,',
  '      movementSyncMs: ZONE_MOVEMENT_SYNC_MS,',
  '      clientHeartbeatMs: ZONE_CLIENT_HEARTBEAT_MS,',
  '      defaultInterestRadiusMeters: ZONE_DEFAULT_INTEREST_RADIUS_METERS,',
  '      syncCount: Number(state?.zoneAuthority?.syncCount) || 0,',
  '      handoffCount: Number(state?.zoneAuthority?.handoffCount) || 0,',
  '      nearbyReads: Number(state?.zoneAuthority?.nearbyReads) || 0,',
  '      memberCount: Number(live?.memberCount) || 0,',
  "      storagePolicy: live?.storagePolicy || 'ram-only-ephemeral-presence',",
  '      d1Writes: false,',
  '      durableStorageWrites: false,',
  '      interestManagement: true,',
  '      lastSyncOk: synced?.ok === true,',
  '      lastError: state?.zoneAuthority?.lastError || null',
  '    };',
  '  }',
  '',
  '  async nearbyInterest(request) {',
  '    const selected = this.latestAuthorityState();',
  '    const state = selected?.state || this.stateFromHeaders(request);',
  "    const requestedUserId = String(request.headers.get('x-ironvale-user-id') || '');",
  "    if (!requestedUserId || String(state?.userId || '') !== requestedUserId) return json({ ok: false, error: 'Session state mismatch' }, 403);",
  "    await this.syncZoneMembership(state, { force: true, reason: 'nearby-query' });",
  '    const url = new URL(request.url);',
  "    const radius = normalizedInterestRadius(url.searchParams.get('radius'));",
  "    const limit = Math.max(1, Math.min(ZONE_MAX_NEARBY, Math.trunc(finite(url.searchParams.get('limit'), ZONE_MAX_NEARBY))));",
  '    const zoneIds = zoneIdsForInterest(state.x, state.z, radius);',
  '    const responses = await Promise.all(zoneIds.map(async zoneId => {',
  '      try {',
  "        const response = await zoneStateStub(this.env, zoneId).fetch(new Request('https://zone-state/nearby', {",
  "          method: 'POST',",
  "          headers: { 'Content-Type': 'application/json' },",
  '          body: JSON.stringify({ x: state.x, z: state.z, radius, limit, excludeUserId: state.userId })',
  '        }));',
  '        return response.ok ? await response.json().catch(() => null) : null;',
  '      } catch (_) { return null; }',
  '    }));',
  '    const nearest = new Map();',
  '    for (const result of responses) {',
  '      for (const member of Array.isArray(result?.nearby) ? result.nearby : []) {',
  '        const previous = nearest.get(member.userId);',
  '        if (!previous || Number(member.distanceMeters) < Number(previous.distanceMeters)) nearest.set(member.userId, member);',
  '      }',
  '    }',
  '    const nearby = [...nearest.values()].sort((a, b) => Number(a.distanceMeters) - Number(b.distanceMeters)).slice(0, limit);',
  '    state.zoneAuthority.nearbyReads = Number(state.zoneAuthority.nearbyReads || 0) + 1;',
  '    if (selected?.socket) { try { selected.socket.serializeAttachment(state); } catch (_) {} } else this.httpState = state;',
  '    return json({',
  '      ok: true,',
  '      format: ZONE_NEARBY_FORMAT,',
  '      authority: ZONE_AUTHORITY_FORMAT,',
  "      source: 'zone-durable-object-ram',",
  '      centerZoneId: state.zoneAuthority.zoneId,',
  '      scannedZones: zoneIds.length,',
  '      radiusMeters: radius,',
  '      limit,',
  '      nearby',
  '    });',
  '  }',
  '',
  '  async antiCheatStatus(request) {',
  '    const selected = this.latestAuthorityState();',
  '    const state = selected?.state || this.stateFromHeaders(request);',
  "    const requestedUserId = String(request.headers.get('x-ironvale-user-id') || '');",
  "    if (!requestedUserId || String(state?.userId || '') !== requestedUserId) return json({ ok: false, error: 'Session state mismatch' }, 403);",
  '    const summary = antiCheatSummary(state.antiCheat);',
  '    const zoneAuthority = await this.zoneStatus(state);',
  '    if (selected?.socket) { try { selected.socket.serializeAttachment(state); } catch (_) {} } else this.httpState = state;',
  '    return json({',
  '      ok: true,',
  "      format: 'ironvale-anticheat-session-status-v1',",
  '      policy: {',
  '        automaticBan: false,',
  "        aiAuthority: 'recommendation-only',",
  "        ramAuthority: 'final',",
  '        ordinaryMovementWritesToD1: false,',
  '        suspiciousCaseWritesOnly: true',
  '      },',
  '      bridge: {',
  "        mode: 'github-oidc-read-only',",
  '        exactWorkflowBound: true,',
  "        writeAuthority: 'admin-only'",
  '      },',
  '      authority: {',
  '        realtimeFormat: REALTIME_FORMAT,',
  "        source: selected?.state ? 'live-ram' : 'session-baseline',",
  "        integrityStatus: String(state.integrityStatus || 'missing'),",
  "        integrityBuildId: String(state.integrityBuildId || ''),",
  '        accepted: Number(state.accepted) || 0,',
  '        rejected: Number(state.rejected) || 0,',
  '        checkpointCount: Number(state.checkpointCount) || 0',
  '      },',
  '      zoneAuthority,',
  '      monitor: {',
  '        format: summary.format,',
  '        enabled: true,',
  '        serverPrivate: true,',
  '        stateResidentInRam: Boolean(selected?.state),',
  '        sessionBound: Boolean(state.sessionId),',
  '        observedSamples: Number(summary.metrics?.samples) || 0,',
  '        deterministicRejectsObserved: Number(summary.metrics?.deterministicRejects) > 0',
  '      }',
  '    });',
  '  }',
  '',
  '  async connect(request) {'
]);
worker = replaceRegexOnce(worker,
  /  antiCheatStatus\(request\) \{[\s\S]*?\n  \}\n\n  async connect\(request\) \{/,
  authorityMethods,
  'replace anti-cheat status with zone authority methods');

worker = replaceOnce(worker,
  '        antiCheat: sameSession ? carried.state.antiCheat : initial.antiCheat,\n        integrityStatus: initial.integrityStatus,',
  '        antiCheat: sameSession ? carried.state.antiCheat : initial.antiCheat,\n        zoneAuthority: sameSession ? carried.state.zoneAuthority : initial.zoneAuthority,\n        integrityStatus: initial.integrityStatus,',
  'carry zone state across reconnect');

worker = replaceOnce(worker,
  '    this.httpState = null;\n\n    const pair = new WebSocketPair();',
  "    this.httpState = null;\n    await this.syncZoneMembership(initial, { force: true, reason: 'connect' });\n\n    const pair = new WebSocketPair();",
  'register zone on connect');

worker = replaceOnce(worker,
  "      antiCheatPolicy: { enabled: true, serverPrivate: true, automaticBan: ANTICHEAT_POLICY.automaticBan },\n      integrity: { status: initial.integrityStatus, buildId: initial.integrityBuildId, expiresAt: initial.integrityExpiresAt }",
  "      antiCheatPolicy: { enabled: true, serverPrivate: true, automaticBan: ANTICHEAT_POLICY.automaticBan },\n      zoneAuthority: { format: ZONE_AUTHORITY_FORMAT, source: 'zone-durable-object-ram', zoneId: initial.zoneAuthority?.zoneId || null, zoneSizeMeters: ZONE_SIZE_METERS, presenceHeartbeatMs: ZONE_CLIENT_HEARTBEAT_MS, movementSyncMs: ZONE_MOVEMENT_SYNC_MS, d1Writes: false },\n      integrity: { status: initial.integrityStatus, buildId: initial.integrityBuildId, expiresAt: initial.integrityExpiresAt }",
  'zone hello');

worker = replaceOnce(worker,
  "    if (packet?.type === 'checkpoint') {",
  lines([
    "    if (packet?.type === 'presence') {",
    "      await this.syncZoneMembership(state, { force: true, reason: 'client-presence' });",
    '      ws.serializeAttachment(state);',
    "      ws.send(JSON.stringify({ type: 'presence', ok: true, zoneAuthority: { format: ZONE_AUTHORITY_FORMAT, zoneId: state.zoneAuthority?.zoneId || null, syncCount: Number(state.zoneAuthority?.syncCount) || 0, handoffCount: Number(state.zoneAuthority?.handoffCount) || 0 } }));",
    '      return;',
    '    }',
    '',
    "    if (packet?.type === 'checkpoint') {"
  ]), 'presence message path');

const acceptedNeedle = '    this.applyAccepted(state, validation);\n    await this.persistAntiCheatCaseIfNeeded(state);';
const acceptedReplacement = lines([
  '    this.applyAccepted(state, validation);',
  '    const nextZoneId = zoneIdForPosition(state.x, state.z);',
  '    const zoneChanged = state.zoneAuthority?.zoneId !== nextZoneId;',
  "    await this.syncZoneMembership(state, { force: zoneChanged, reason: zoneChanged ? 'zone-handoff' : 'movement' });",
  '    await this.persistAntiCheatCaseIfNeeded(state);'
]);
const acceptedCount = worker.split(acceptedNeedle).length - 1;
if (acceptedCount !== 1) throw new Error(`websocket accepted zone sync: expected 1 match, found ${acceptedCount}`);
worker = worker.replace(acceptedNeedle, acceptedReplacement);

const httpNeedle = '    this.applyAccepted(this.httpState, validation);\n    await this.persistAntiCheatCaseIfNeeded(this.httpState);';
const httpReplacement = lines([
  '    this.applyAccepted(this.httpState, validation);',
  '    const nextZoneId = zoneIdForPosition(this.httpState.x, this.httpState.z);',
  '    const zoneChanged = this.httpState.zoneAuthority?.zoneId !== nextZoneId;',
  "    await this.syncZoneMembership(this.httpState, { force: zoneChanged, reason: zoneChanged ? 'zone-handoff' : 'movement' });",
  '    await this.persistAntiCheatCaseIfNeeded(this.httpState);'
]);
worker = replaceOnce(worker, httpNeedle, httpReplacement, 'http accepted zone sync');

worker = replaceOnce(worker,
  "        await this.checkpointState(fallback, 'disconnect');\n        if (fallback === this.httpState) this.httpState = fallback;",
  "        await this.checkpointState(fallback, 'disconnect');\n        await this.leaveZone(fallback, fallback.zoneAuthority?.zoneId);\n        if (fallback?.zoneAuthority) fallback.zoneAuthority.zoneId = null;\n        if (fallback === this.httpState) this.httpState = fallback;",
  'leave zone on disconnect');
write('src/realtime-entry.js', worker);

let realtime = read('public/rift-realtime.js');
realtime = replaceOnce(realtime,
  'const MAX_PENDING_ACKS = 64;',
  'const MAX_PENDING_ACKS = 64;\nconst ZONE_PRESENCE_HEARTBEAT_MS = 15 * 1000;',
  'client zone heartbeat constant');
realtime = replaceOnce(realtime,
  '  pendingPosition: null\n};',
  lines([
    '  pendingPosition: null,',
    '  presenceHeartbeatsSent: 0,',
    '  presenceHeartbeatsAcked: 0,',
    '  lastPresenceHeartbeatAt: null,',
    '  zoneAuthority: null',
    '};'
  ]), 'client zone state');
realtime = replaceOnce(realtime,
  'let fallbackInFlight = false;\nlet pendingPosition = null;',
  'let fallbackInFlight = false;\nlet presenceTimer = 0;\nlet pendingPosition = null;',
  'presence timer state');

realtime = replaceOnce(realtime,
  lines([
    'function socketOpen() {',
    '  return socket?.readyState === WebSocket.OPEN;',
    '}'
  ]),
  lines([
    'function socketOpen() {',
    '  return socket?.readyState === WebSocket.OPEN;',
    '}',
    '',
    'function stopPresenceHeartbeat() {',
    '  clearInterval(presenceTimer);',
    '  presenceTimer = 0;',
    '}',
    '',
    'function sendPresenceHeartbeat() {',
    '  if (!socketOpen()) return false;',
    '  try {',
    "    socket.send(JSON.stringify({ type: 'presence', clientSentAt: Date.now() }));",
    '    state.presenceHeartbeatsSent += 1;',
    '    state.lastPresenceHeartbeatAt = new Date().toISOString();',
    '    return true;',
    '  } catch (_) { return false; }',
    '}',
    '',
    'function startPresenceHeartbeat() {',
    '  stopPresenceHeartbeat();',
    '  if (!socketOpen()) return;',
    '  presenceTimer = setInterval(sendPresenceHeartbeat, ZONE_PRESENCE_HEARTBEAT_MS);',
    '}'
  ]), 'presence heartbeat helpers');

realtime = replaceOnce(realtime,
  '  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;',
  '  if (socket?.readyState === WebSocket.OPEN) { startPresenceHeartbeat(); return; }\n  if (socket?.readyState === WebSocket.CONNECTING) return;',
  'restart heartbeat for open socket');
realtime = replaceOnce(realtime,
  "    record('Realtime movement authority connected', { transport: 'websocket', d1Policy: state.d1Policy, publisherMode: state.publisherMode });\n    if (pendingPosition) queueMicrotask(() => flushPending(true));",
  "    record('Realtime movement authority connected', { transport: 'websocket', d1Policy: state.d1Policy, publisherMode: state.publisherMode });\n    startPresenceHeartbeat();\n    queueMicrotask(sendPresenceHeartbeat);\n    if (pendingPosition) queueMicrotask(() => flushPending(true));",
  'start heartbeat on open');
realtime = replaceOnce(realtime,
  "    if (message?.type === 'accepted') {",
  lines([
    "    if ((message?.type === 'hello' || message?.type === 'presence') && message?.zoneAuthority) state.zoneAuthority = { ...(state.zoneAuthority || {}), ...message.zoneAuthority };",
    "    if (message?.type === 'presence') {",
    '      state.presenceHeartbeatsAcked += 1;',
    '      return;',
    '    }',
    '',
    "    if (message?.type === 'accepted') {"
  ]), 'handle zone heartbeat ack');
realtime = replaceOnce(realtime,
  "  socket.addEventListener('close', event => {\n    const wasOpen = state.socketState === 'open';",
  "  socket.addEventListener('close', event => {\n    stopPresenceHeartbeat();\n    const wasOpen = state.socketState === 'open';",
  'stop heartbeat on close');
realtime = replaceOnce(realtime,
  "function closeSocket(reason = 'client-close') {\n  clearTimeout(reconnectTimer);",
  "function closeSocket(reason = 'client-close') {\n  stopPresenceHeartbeat();\n  clearTimeout(reconnectTimer);",
  'stop heartbeat on explicit close');
realtime = replaceOnce(realtime,
  '    checkpointPolicy: {',
  lines([
    '    zoneAuthorityPolicy: {',
    "      format: 'ironvale-zone-authority-v1',",
    "      source: 'zone-durable-object-ram',",
    '      presenceHeartbeatMs: ZONE_PRESENCE_HEARTBEAT_MS,',
    '      movementPacketsDoNotFanOutAt10Hz: true,',
    '      immediateZoneHandoff: true,',
    '      nearbyInterestOnDemand: true,',
    '      d1Writes: false',
    '    },',
    '    checkpointPolicy: {'
  ]), 'zone policy diagnostics');
realtime = replaceOnce(realtime,
  "window.addEventListener('offline', () => {\n  state.socketState = 'offline';",
  "window.addEventListener('offline', () => {\n  stopPresenceHeartbeat();\n  state.socketState = 'offline';",
  'stop heartbeat offline');
write('public/rift-realtime.js', realtime);

let auto = read('public/rift-auto-validation.js');
auto = replaceOnce(auto,
  "        if (body?.authority?.integrityStatus !== 'attested' || body?.authority?.integrityBuildId !== integrity.buildId) throw new Error('Integrity ticket is not bound to RAM authority');",
  lines([
    "        if (body?.authority?.integrityStatus !== 'attested' || body?.authority?.integrityBuildId !== integrity.buildId) throw new Error('Integrity ticket is not bound to RAM authority');",
    '        const zoneAuthority = body?.zoneAuthority || {};',
    "        if (zoneAuthority?.format !== 'ironvale-zone-authority-v1' || zoneAuthority?.enabled !== true || zoneAuthority?.source !== 'zone-durable-object-ram') throw new Error('Zone RAM authority unavailable');",
    "        if (zoneAuthority?.storagePolicy !== 'ram-only-ephemeral-presence' || zoneAuthority?.d1Writes !== false || zoneAuthority?.durableStorageWrites !== false || zoneAuthority?.interestManagement !== true) throw new Error('Zone authority persistence policy mismatch');"
  ]), 'security smoke zone status');
auto = replaceOnce(auto,
  '        const bridge = body?.bridge || {};\n        if (bridge.mode !== \'github-oidc-read-only\' || bridge.exactWorkflowBound !== true || bridge.writeAuthority !== \'admin-only\') throw new Error(\'AI review bridge policy mismatch\');\n        state.securitySmoke = {',
  lines([
    '        const bridge = body?.bridge || {};',
    "        if (bridge.mode !== 'github-oidc-read-only' || bridge.exactWorkflowBound !== true || bridge.writeAuthority !== 'admin-only') throw new Error('AI review bridge policy mismatch');",
    "        const nearbyResponse = await fetch('/api/realtime/nearby?radius=96&limit=64', { method: 'GET', cache: 'no-store', credentials: 'same-origin', headers: integrityApi.transportHeaders() });",
    '        const nearby = await nearbyResponse.json().catch(() => ({}));',
    "        if (!nearbyResponse.ok || nearby?.ok !== true || nearby?.format !== 'ironvale-zone-nearby-v1' || nearby?.authority !== 'ironvale-zone-authority-v1' || nearby?.source !== 'zone-durable-object-ram') throw new Error(nearby?.error || 'Nearby interest-management smoke failed');",
    '        const nearbySummary = { ...nearby };',
    '        delete nearbySummary.nearby;',
    '        nearbySummary.nearbyCount = Array.isArray(nearby.nearby) ? nearby.nearby.length : 0;',
    '        state.securitySmoke = {'
  ]), 'security smoke nearby query');
auto = replaceOnce(auto,
  '          authority: { ...body.authority },\n          monitor: { ...body.monitor },',
  '          authority: { ...body.authority },\n          zoneAuthority: { ...body.zoneAuthority },\n          nearby: { ...nearbySummary },\n          monitor: { ...body.monitor },',
  'security smoke zone evidence');
auto = replaceOnce(auto,
  "        return 'RAM anti-cheat active · integrity bound · AI review bridge read-only · samples=' + (body.monitor.observedSamples || 0);",
  "        return 'RAM anti-cheat active · zone=' + zoneAuthority.zoneId + ' · nearby zones=' + nearby.scannedZones + ' · integrity bound · AI review read-only · samples=' + (body.monitor.observedSamples || 0);",
  'security smoke detail');
write('public/rift-auto-validation.js', auto);

let guard = read('public/rift-validator-guard.js');
guard = replaceOnce(guard,
  "    checks.push(passFail('security.integrity-binding', integrityBound, integrityBound ? ('Integrity ' + smoke.integrity.buildId + ' bound to RAM authority') : 'Integrity/RAM binding mismatch'));",
  lines([
    "    checks.push(passFail('security.integrity-binding', integrityBound, integrityBound ? ('Integrity ' + smoke.integrity.buildId + ' bound to RAM authority') : 'Integrity/RAM binding mismatch'));",
    '    const zone = smoke.zoneAuthority || {};',
    "    const zoneOk = zone.format === 'ironvale-zone-authority-v1' && zone.enabled === true && zone.source === 'zone-durable-object-ram' && zone.storagePolicy === 'ram-only-ephemeral-presence' && zone.d1Writes === false && zone.durableStorageWrites === false;",
    "    checks.push(passFail('architecture.zone-authority', zoneOk, zoneOk ? ('Zone ' + zone.zoneId + ' · ' + zone.zoneSizeMeters + 'm · RAM-only shared presence') : 'World/zone RAM authority unavailable or persistence policy mismatch'));",
    '    const interest = smoke.nearby || {};',
    "    const interestOk = interest.format === 'ironvale-zone-nearby-v1' && interest.authority === 'ironvale-zone-authority-v1' && interest.source === 'zone-durable-object-ram' && Number(interest.scannedZones) >= 1 && Number(interest.radiusMeters) > 0;",
    "    checks.push(passFail('architecture.interest-management', interestOk, interestOk ? (interest.scannedZones + ' zone(s) scanned within ' + interest.radiusMeters + 'm · nearby=' + (interest.nearbyCount || 0)) : 'Bounded nearby interest-management smoke unavailable'));"
  ]), 'validator zone checks');
write('public/rift-validator-guard.js', guard);

let wrangler = read('wrangler.toml');
wrangler = replaceOnce(wrangler,
  lines([
    '[[durable_objects.bindings]]',
    'name = "PLAYER_STATE"',
    'class_name = "PlayerState"'
  ]),
  lines([
    '[[durable_objects.bindings]]',
    'name = "PLAYER_STATE"',
    'class_name = "PlayerState"',
    '',
    '[[durable_objects.bindings]]',
    'name = "ZONE_STATE"',
    'class_name = "ZoneState"'
  ]), 'wrangler zone binding');
wrangler += '\n[[migrations]]\ntag = "zone-state-v1"\nnew_sqlite_classes = ["ZoneState"]\n';
write('wrangler.toml', wrangler);

let html = read('public/index.html');
html = html.replace('/rift-realtime.js?v=20260902-integrity-v1', '/rift-realtime.js?v=20260902-zone-authority-r1');
html = html.replace('/rift-validator-guard.js?v=20260902-security-smoke-r1', '/rift-validator-guard.js?v=20260902-zone-authority-r1');
html = html.replace('/rift-auto-validation.js?v=20260902-draft-restore-r1', '/rift-auto-validation.js?v=20260902-zone-authority-r1');
write('public/index.html', html);

for (const filename of fs.readdirSync('scripts').filter(name => name.endsWith('.mjs'))) {
  const path = `scripts/${filename}`;
  let value = read(path);
  value = value.replaceAll('/rift-realtime.js?v=20260902-integrity-v1', '/rift-realtime.js?v=20260902-zone-authority-r1');
  value = value.replaceAll('/rift-validator-guard.js?v=20260902-security-smoke-r1', '/rift-validator-guard.js?v=20260902-zone-authority-r1');
  value = value.replaceAll('/rift-auto-validation.js?v=20260902-draft-restore-r1', '/rift-auto-validation.js?v=20260902-zone-authority-r1');
  write(path, value);
}

let pkg = JSON.parse(read('package.json'));
let build = String(pkg.scripts?.build || '');
build = build.replace('node --check src/realtime-entry.js', 'node --check src/realtime-entry.js && node --check src/zone-contract.js && node --check src/zone-authority.js');
if (!build.includes('node scripts/check-zone-authority-v1.mjs')) build += ' && node scripts/check-zone-authority-v1.mjs';
pkg.scripts.build = build;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

execFileSync(process.execPath, ['scripts/generate-integrity-manifest.mjs'], { stdio: 'inherit' });
console.log('Ironvale Zone Authority v1 integration applied.');
