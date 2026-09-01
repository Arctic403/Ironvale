import fs from 'node:fs';

const path = new URL('../src/realtime-entry.js', import.meta.url);
let worker = fs.readFileSync(path, 'utf8');
function replaceOnce(before, after, label) {
  if (!worker.includes(before)) throw new Error(`Missing checkpoint hardening anchor: ${label}`);
  worker = worker.replace(before, after);
}

worker = worker.replace("const REALTIME_FORMAT = 'ironvale-realtime-authority-v1';", "const REALTIME_FORMAT = 'ironvale-realtime-authority-v2';");

replaceOnce(
`    server.serializeAttachment(initial);\n    await this.ensureCheckpointAlarm();\n    server.send(JSON.stringify({`,
`    server.serializeAttachment(initial);\n    if (initial.dirty) await this.ensureCheckpointAlarm();\n    server.send(JSON.stringify({`,
'connect alarm only for dirty state');

replaceOnce(
`    this.applyAccepted(state, validation);\n    let checkpointed = false;`,
`    this.applyAccepted(state, validation);\n    if (state.dirty) await this.ensureCheckpointAlarm();\n    let checkpointed = false;`,
'websocket movement alarm scheduling');

replaceOnce(
`  async checkpointRequest(request) {\n    let best = this.httpState;\n    for (const ws of this.ctx.getWebSockets()) {\n      try {\n        const candidate = ws.deserializeAttachment();\n        if (!candidate || candidate.superseded) continue;\n        if (!best || Number(candidate.lastAcceptedAt) > Number(best.lastAcceptedAt)) best = candidate;\n      } catch (_) {}\n    }\n    if (!best) best = this.stateFromHeaders(request);\n    const checkpointReason = String(request.headers.get('x-ironvale-checkpoint-reason') || 'explicit-http').slice(0, 32);\n    const saved = await this.checkpointState(best, checkpointReason);\n    return json({ ok: true, saved, checkpointCount: best.checkpointCount || 0 });\n  }`,
`  async checkpointRequest(request) {\n    const selected = this.latestAuthorityState();\n    const best = selected?.state || this.stateFromHeaders(request);\n    const checkpointReason = String(request.headers.get('x-ironvale-checkpoint-reason') || 'explicit-http').slice(0, 32);\n    const saved = await this.checkpointState(best, checkpointReason);\n    if (selected?.socket) {\n      try { selected.socket.serializeAttachment(best); } catch (_) {}\n    } else {\n      this.httpState = best;\n    }\n    return json({ ok: true, saved, checkpointCount: best.checkpointCount || 0 });\n  }`,
'explicit checkpoint freshest-state serialization');

replaceOnce(
`    const hasLiveSocket = this.ctx.getWebSockets().some(ws => {\n      try { return !(ws.deserializeAttachment()?.superseded); } catch { return false; }\n    });\n    if (hasLiveSocket || this.httpState?.dirty) await this.ctx.storage.setAlarm(Date.now() + CHECKPOINT_INTERVAL_MS);`,
`    const remaining = this.latestAuthorityState();\n    if (remaining?.state?.dirty) await this.ctx.storage.setAlarm(Date.now() + CHECKPOINT_INTERVAL_MS);`,
'alarm reschedule only while dirty');

replaceOnce(
`  async webSocketClose(ws, code, reason) {\n    try {\n      const state = ws.deserializeAttachment();\n      if (state && !state.superseded) await this.checkpointState(state, 'disconnect');\n    } catch (error) {\n      console.error('Ironvale realtime disconnect checkpoint failed', error);\n    }\n    try { ws.close(code, reason); } catch (_) {}\n  }`,
`  async webSocketClose(ws, code, reason) {\n    try {\n      const closing = ws.deserializeAttachment();\n      if (closing && !closing.superseded) {\n        const fallback = this.httpState && Number(this.httpState.lastAcceptedAt || 0) > Number(closing.lastAcceptedAt || 0) ? this.httpState : closing;\n        await this.checkpointState(fallback, 'disconnect');\n        if (fallback === this.httpState) this.httpState = fallback;\n      }\n    } catch (error) {\n      console.error('Ironvale realtime disconnect checkpoint failed', error);\n    }\n    try { ws.close(code, reason); } catch (_) {}\n  }`,
'disconnect freshest-state checkpoint');

replaceOnce(
`  async webSocketError(ws, error) {\n    try {\n      const state = ws.deserializeAttachment();\n      if (state && !state.superseded) await this.checkpointState(state, 'socket-error');\n    } catch (checkpointError) {\n      console.error('Ironvale realtime socket checkpoint failed', checkpointError);\n    }\n    console.error('Ironvale realtime WebSocket error', error);\n  }`,
`  async webSocketError(ws, error) {\n    try {\n      const socketState = ws.deserializeAttachment();\n      if (socketState && !socketState.superseded) {\n        const fallback = this.httpState && Number(this.httpState.lastAcceptedAt || 0) > Number(socketState.lastAcceptedAt || 0) ? this.httpState : socketState;\n        await this.checkpointState(fallback, 'socket-error');\n        if (fallback === this.httpState) this.httpState = fallback;\n      }\n    } catch (checkpointError) {\n      console.error('Ironvale realtime socket checkpoint failed', checkpointError);\n    }\n    console.error('Ironvale realtime WebSocket error', error);\n  }`,
'socket error freshest-state checkpoint');

replaceOnce(
`async function checkpointBeforeLogout(request, env) {\n  const auth = await loadSessionState(request, env);\n  if (!auth) return;\n  const stub = playerStateStub(env, auth.userId);\n  await stub.fetch(new Request('https://player-state/checkpoint', {\n    method: 'POST',\n    headers: internalStateHeaders(auth, request)\n  })).catch(() => null);\n}`,
`async function checkpointBeforeLogout(request, env) {\n  const auth = await loadSessionState(request, env);\n  if (!auth) return;\n  const stub = playerStateStub(env, auth.userId);\n  const headers = internalStateHeaders(auth, request);\n  headers.set('x-ironvale-checkpoint-reason', 'logout');\n  await stub.fetch(new Request('https://player-state/checkpoint', {\n    method: 'POST',\n    headers\n  })).catch(() => null);\n}`,
'logout checkpoint reason');

fs.writeFileSync(path, worker);
console.log('Hardened realtime alarm scheduling and freshest-state disconnect/error checkpoints.');
