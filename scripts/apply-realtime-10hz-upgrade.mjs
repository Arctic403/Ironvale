import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const write = (path, value) => fs.writeFileSync(new URL(`../${path}`, import.meta.url), value);
function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing patch anchor: ${label}`);
  return source.replace(before, after);
}

// App: remove legacy five-second heartbeat and publish the live transform directly.
let app = read('public/app.js');
app = app.replace('let lastPositionSave = 0;\n', '');
app = replaceOnce(app,
`  if (!freecamEnabled && now - lastPositionSave > 5000) {\n    lastPositionSave = now;\n    savePosition();\n  }`,
`  if (!freecamEnabled) {\n    window.IronvaleRealtimeMovement?.publish?.({ x: player.x, y: player.y, z: player.z, yaw: player.yaw });\n  }`,
'legacy frame heartbeat');

app = app.replace(/\nasync function savePosition\(useKeepalive = false\) \{[\s\S]*?\n\}\n\nasync function api\(/,
'\nasync function api(');
app = app.replace("window.addEventListener('pagehide', () => savePosition(true));\n", '');
app = app.replace("window.addEventListener('beforeunload', () => savePosition(true));\n", '');

if (!app.includes("window.addEventListener('ironvale:movement-correction'")) {
  const anchor = `$('#logout-button').addEventListener('click', async () => {\n  await api('/api/auth/logout', { method: 'POST' }).catch(() => null);\n  stopWorld();\n  showAuth();\n});\n`;
  const correction = `${anchor}\nwindow.addEventListener('ironvale:movement-correction', event => {\n  const position = event?.detail?.position;\n  const values = [position?.x, position?.y, position?.z, position?.yaw].map(Number);\n  if (values.some(value => !Number.isFinite(value))) return;\n  input.forward = 0;\n  input.strafe = 0;\n  input.keys.clear();\n  joystickActive = false;\n  playerMoving = false;\n  player.x = values[0];\n  player.y = values[1];\n  player.z = values[2];\n  player.yaw = values[3];\n  player.vy = 0;\n  player.grounded = true;\n  try { diagnostics.record('realtime', 'Applied authoritative movement correction', { reason: event?.detail?.reason || null, seq: event?.detail?.seq ?? null, position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw } }, 'warn'); } catch (_) {}\n});\n`;
  app = replaceOnce(app, anchor, correction, 'logout handler for correction consumer');
}
write('public/app.js', app);

// Auto validator: exercise direct publisher and restore exact player state without legacy fetch interception.
let auto = read('public/rift-auto-validation.js');
const oldRestore = /async function restorePlayerBaseline\(baseline\) \{[\s\S]*?\n\}\n\nasync function runFullAutoValidation\(\) \{/;
const newRestore = `async function restorePlayerBaseline(baseline) {\n  const api = window.IronvalePlayerState;\n  const realtime = window.IronvaleRealtimeMovement;\n  if (!baseline || !api?.restore) throw new Error('Player restoration API unavailable');\n  if (!realtime?.publish || !realtime?.checkpoint) throw new Error('Direct realtime publisher unavailable');\n  const restored = api.restore(baseline);\n  if (!restored?.ok) throw new Error(restored?.error || 'Player transform restore failed');\n  await nextFrame();\n  await nextFrame();\n\n  const published = realtime.publish({ x: baseline.x, y: baseline.y, z: baseline.z, yaw: baseline.yaw }, { force: true, source: 'validator-restore' });\n  if (published?.ok === false) throw new Error(published?.reason || 'Authoritative player restore publish failed');\n  await sleep(140);\n  const checkpoint = await realtime.checkpoint('validator-restore');\n  if (checkpoint?.ok === false) throw new Error(checkpoint?.error || 'Authoritative player restore checkpoint failed');\n  await sleep(180);\n\n  const current = api.status?.();\n  const distance = current ? Math.hypot(\n    Number(current.x) - Number(baseline.x),\n    Number(current.y) - Number(baseline.y),\n    Number(current.z) - Number(baseline.z)\n  ) : Number.POSITIVE_INFINITY;\n  const yawDelta = current ? Math.abs(Number(current.yaw) - Number(baseline.yaw)) : Number.POSITIVE_INFINITY;\n  const exact = Number.isFinite(distance) && distance <= 0.001 && Number.isFinite(yawDelta) && yawDelta <= 0.001;\n  if (!exact) throw new Error(\`Player baseline restore drifted by \${distance.toFixed(4)}m / yaw \${yawDelta.toFixed(4)}\`);\n  return { ok: true, distance, yawDelta, transport: published?.transport || null, checkpointTransport: checkpoint?.transport || null, baseline: { x: baseline.x, y: baseline.y, z: baseline.z, yaw: baseline.yaw } };\n}\n\nasync function runFullAutoValidation() {`;
if (!oldRestore.test(auto)) throw new Error('restorePlayerBaseline function not found');
auto = auto.replace(oldRestore, newRestore);

const oldMovementStep = `    await runStep('realtime movement + checkpoint path', async () => {\n      const freecamButton = required('#freecam-button');\n      if (freecamButton.classList.contains('active')) freecamButton.click();\n      await holdKey('w', 300);\n      await holdKey('s', 300);\n      window.dispatchEvent(new Event('pagehide'));\n      await sleep(350);\n      return 'forward/back movement interception + pagehide checkpoint requested';\n    });`;
const newMovementStep = `    await runStep('realtime movement + checkpoint path', async () => {\n      const freecamButton = required('#freecam-button');\n      if (freecamButton.classList.contains('active')) freecamButton.click();\n      const realtime = window.IronvaleRealtimeMovement;\n      if (!realtime?.status || !realtime?.checkpoint) throw new Error('Direct realtime publisher unavailable');\n      const before = realtime.status();\n      await holdKey('w', 300);\n      await holdKey('s', 300);\n      await sleep(180);\n      const afterMovement = realtime.status();\n      const directDelta = Number(afterMovement?.directPublished || 0) - Number(before?.directPublished || 0);\n      if (directDelta < 2) throw new Error(\`Direct 10Hz publisher only emitted \${directDelta} packet(s)\`);\n      const checkpoint = await realtime.checkpoint('auto-validation');\n      if (checkpoint?.ok === false) throw new Error('Realtime checkpoint request failed');\n      await sleep(220);\n      const after = realtime.status();\n      return \`direct packets=\${directDelta} · total sent=\${after.sent || 0} · accepted=\${after.accepted || 0} · RTT=\${after.lastRttMs ?? 'n/a'}ms · checkpoint=\${checkpoint?.transport || 'unknown'}\`;\n    });`;
auto = replaceOnce(auto, oldMovementStep, newMovementStep, 'auto validation realtime step');
auto = auto.replace('      exercisesRealtimeCheckpoint: true,', '      exercisesDirectRealtimePublisher: true,\n      exercisesRealtimeCheckpoint: true,');
write('public/rift-auto-validation.js', auto);

// Durable Object: explicit lifecycle checkpoint route, true 5-minute alarm, and RAM-state carry-forward on reconnect.
let worker = read('src/realtime-entry.js');
if (!worker.includes("async function routeRealtimeCheckpoint(request, env)")) {
  const anchor = `async function checkpointBeforeLogout(request, env) {`;
  const fn = `async function routeRealtimeCheckpoint(request, env) {\n  const auth = await loadSessionState(request, env);\n  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);\n  const body = await readJson(request);\n  const reason = String(body?.reason || 'explicit-http').slice(0, 32);\n  const stub = playerStateStub(env, auth.userId);\n  const headers = internalStateHeaders(auth, request);\n  headers.set('x-ironvale-checkpoint-reason', reason);\n  return stub.fetch(new Request('https://player-state/checkpoint', { method: 'POST', headers }));\n}\n\n`;
  worker = replaceOnce(worker, anchor, fn + anchor, 'checkpoint route function');
}

worker = replaceOnce(worker,
`    if (url.pathname === '/api/realtime/movement') {\n      return routeRealtimeSocket(request, env);\n    }`,
`    if (url.pathname === '/api/realtime/movement') {\n      return routeRealtimeSocket(request, env);\n    }\n\n    if (method === 'POST' && url.pathname === '/api/realtime/checkpoint') {\n      return routeRealtimeCheckpoint(request, env);\n    }`,
'realtime checkpoint route');

if (!worker.includes('async ensureCheckpointAlarm()')) {
  worker = replaceOnce(worker,
`  async fetch(request) {`,
`  async ensureCheckpointAlarm() {\n    const current = await this.ctx.storage.getAlarm();\n    if (current == null) await this.ctx.storage.setAlarm(Date.now() + CHECKPOINT_INTERVAL_MS);\n  }\n\n  latestAuthorityState() {\n    let best = this.httpState && !this.httpState.superseded ? { state: this.httpState, socket: null } : null;\n    for (const ws of this.ctx.getWebSockets()) {\n      try {\n        const candidate = ws.deserializeAttachment();\n        if (!candidate || candidate.superseded) continue;\n        if (!best || Number(candidate.lastAcceptedAt || candidate.sourceUpdatedAt || 0) > Number(best.state.lastAcceptedAt || best.state.sourceUpdatedAt || 0)) {\n          best = { state: candidate, socket: ws };\n        }\n      } catch (_) {}\n    }\n    return best;\n  }\n\n  async fetch(request) {`,
'Durable Object alarm helpers');
}

const oldConnect = `  async connect(request) {\n    if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'WebSocket upgrade required' }, 426);\n    const initial = this.stateFromHeaders(request);\n    if (!initial.userId || initial.sessionExpiresAt <= Date.now()) return json({ ok: false, error: 'Session expired' }, 401);\n\n    // A player has one live authority stream. Mark older sockets as superseded so\n    // their close event cannot overwrite a newer state checkpoint.\n    for (const existing of this.ctx.getWebSockets()) {\n      try {\n        const previous = existing.deserializeAttachment() || {};\n        previous.superseded = true;\n        existing.serializeAttachment(previous);\n        existing.close(4001, 'superseded');\n      } catch (_) {}\n    }\n\n    const pair = new WebSocketPair();\n    const [client, server] = Object.values(pair);\n    this.ctx.acceptWebSocket(server, ['player']);\n    server.serializeAttachment(initial);\n    server.send(JSON.stringify({\n      type: 'hello',\n      format: REALTIME_FORMAT,\n      position: { x: initial.x, y: initial.y, z: initial.z, yaw: initial.yaw },\n      checkpointIntervalMs: CHECKPOINT_INTERVAL_MS,\n      validator: 'server-authoritative'\n    }));\n    return new Response(null, { status: 101, webSocket: client });\n  }`;
const newConnect = `  async connect(request) {\n    if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'WebSocket upgrade required' }, 426);\n    let initial = this.stateFromHeaders(request);\n    if (!initial.userId || initial.sessionExpiresAt <= Date.now()) return json({ ok: false, error: 'Session expired' }, 401);\n\n    // Carry the freshest RAM authority into the replacement socket before older\n    // sockets are superseded. This prevents a reconnect from reverting to the\n    // last D1 checkpoint after an HTTP-fallback movement window.\n    const carried = this.latestAuthorityState();\n    if (carried?.state?.userId === initial.userId) {\n      initial = {\n        ...carried.state,\n        username: initial.username,\n        sessionExpiresAt: initial.sessionExpiresAt,\n        superseded: false,\n        connectedAt: Date.now()\n      };\n    }\n\n    for (const existing of this.ctx.getWebSockets()) {\n      try {\n        const previous = existing.deserializeAttachment() || {};\n        previous.superseded = true;\n        existing.serializeAttachment(previous);\n        existing.close(4001, 'superseded');\n      } catch (_) {}\n    }\n    this.httpState = null;\n\n    const pair = new WebSocketPair();\n    const [client, server] = Object.values(pair);\n    this.ctx.acceptWebSocket(server, ['player']);\n    server.serializeAttachment(initial);\n    await this.ensureCheckpointAlarm();\n    server.send(JSON.stringify({\n      type: 'hello',\n      format: REALTIME_FORMAT,\n      position: { x: initial.x, y: initial.y, z: initial.z, yaw: initial.yaw },\n      checkpointIntervalMs: CHECKPOINT_INTERVAL_MS,\n      validator: 'server-authoritative'\n    }));\n    return new Response(null, { status: 101, webSocket: client });\n  }`;
worker = replaceOnce(worker, oldConnect, newConnect, 'DO connect carry-forward');

worker = worker.replace(
`    return { ok: true, now, x, y, z, yaw, seq: nextSeq };`,
`    return { ok: true, now, x, y, z, yaw, seq: nextSeq, clientSentAt: finite(packet?.clientSentAt) };`
);
worker = worker.replace(
`      position: { x: state.x, y: state.y, z: state.z, yaw: state.yaw }`,
`      position: { x: state.x, y: state.y, z: state.z, yaw: state.yaw },\n      clientSentAt: validation?.clientSentAt ?? null`
);
worker = worker.replace(
`      position: { x: state.x, y: state.y, z: state.z, yaw: state.yaw }\n    }));`,
`      position: { x: state.x, y: state.y, z: state.z, yaw: state.yaw },\n      clientSentAt: validation.clientSentAt ?? null\n    }));`
);
worker = worker.replace(
`    this.applyAccepted(this.httpState, validation);\n    let checkpointed = false;`,
`    this.applyAccepted(this.httpState, validation);\n    await this.ensureCheckpointAlarm();\n    let checkpointed = false;`
);
worker = worker.replace(
`      position: { x: this.httpState.x, y: this.httpState.y, z: this.httpState.z, yaw: this.httpState.yaw }\n    }, 202);`,
`      position: { x: this.httpState.x, y: this.httpState.y, z: this.httpState.z, yaw: this.httpState.yaw },\n      clientSentAt: validation.clientSentAt ?? null\n    }, 202);`
);
worker = worker.replace(
`    const saved = await this.checkpointState(best, 'logout');`,
`    const checkpointReason = String(request.headers.get('x-ironvale-checkpoint-reason') || 'explicit-http').slice(0, 32);\n    const saved = await this.checkpointState(best, checkpointReason);`
);

if (!worker.includes('async alarm()')) {
  worker = replaceOnce(worker,
`  async webSocketClose(ws, code, reason) {`,
`  async alarm() {\n    const best = this.latestAuthorityState();\n    if (best?.state) {\n      await this.checkpointState(best.state, 'periodic-alarm');\n      if (best.socket) {\n        try { best.socket.serializeAttachment(best.state); } catch (_) {}\n      } else {\n        this.httpState = best.state;\n      }\n    }\n    const hasLiveSocket = this.ctx.getWebSockets().some(ws => {\n      try { return !(ws.deserializeAttachment()?.superseded); } catch { return false; }\n    });\n    if (hasLiveSocket || this.httpState?.dirty) await this.ctx.storage.setAlarm(Date.now() + CHECKPOINT_INTERVAL_MS);\n  }\n\n  async webSocketClose(ws, code, reason) {`,
'DO periodic alarm handler');
}
write('src/realtime-entry.js', worker);

// Architecture validator: require the direct publisher contract, not just zero D1 writes.
let architecture = read('public/rift-architecture-guard.js');
architecture = architecture.replace(
`  const policyDeclared = realtime?.authority === 'server-durable-object' &&\n    realtime?.d1Policy === 'load-checkpoint-only' &&\n    realtime?.checkpointPolicy?.ordinaryMovementWritesToD1 === false;`,
`  const policyDeclared = realtime?.authority === 'server-durable-object' &&\n    realtime?.d1Policy === 'load-checkpoint-only' &&\n    realtime?.checkpointPolicy?.ordinaryMovementWritesToD1 === false;\n  const publisherDeclared = realtime?.publisherMode === 'direct-meaningful-10hz' &&\n    Number(realtime?.publishPolicy?.maxHz) === 10 &&\n    realtime?.publishPolicy?.appLegacyHeartbeatRemoved === true;`
);
architecture = architecture.replace(
`  else if (!policyDeclared) status = 'fail';`,
`  else if (!policyDeclared || !publisherDeclared) status = 'fail';`
);
architecture = architecture.replace(
"    `${movement.length} backend movement request(s) · ${d1Calls} D1 call(s) · ${d1Writes} D1 write(s) · ${socketPackets} realtime packet(s) · policy=${policyDeclared ? 'RAM-authoritative' : 'invalid'}`",
"    `${movement.length} backend movement request(s) · ${d1Calls} D1 call(s) · ${d1Writes} D1 write(s) · ${socketPackets} realtime packet(s) · publisher=${publisherDeclared ? 'direct-10Hz' : 'invalid'} · policy=${policyDeclared ? 'RAM-authoritative' : 'invalid'}`"
);
architecture = architecture.replace(
`    socketPackets,\n    policyDeclared`,
`    socketPackets,\n    directPublished: Number(realtime?.directPublished) || 0,\n    legacyIntercepts: Number(realtime?.legacyIntercepts) || 0,\n    publisherDeclared,\n    policyDeclared`
);
write('public/rift-architecture-guard.js', architecture);

// Cache bust changed runtime modules.
let index = read('public/index.html');
index = index
  .replace('/app.js?v=20260901-player-restore-r1', '/app.js?v=20260901-realtime-10hz-r1')
  .replace('/rift-realtime.js?v=20260901-realtime-authority-r1', '/rift-realtime.js?v=20260901-realtime-10hz-r1')
  .replace('/rift-architecture-guard.js?v=20260901-render-forensics-r1', '/rift-architecture-guard.js?v=20260901-realtime-10hz-r1')
  .replace('/rift-auto-validation.js?v=20260901-player-restore-r1', '/rift-auto-validation.js?v=20260901-realtime-10hz-r1');
write('public/index.html', index);

console.log('Installed direct meaningful-change 10Hz movement publishing, correction consumption, RAM carry-forward, and true periodic checkpoint alarms.');
