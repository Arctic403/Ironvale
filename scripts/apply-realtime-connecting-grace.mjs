import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const write = (path, value) => fs.writeFileSync(new URL(`../${path}`, import.meta.url), value);
function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing reconnect grace patch anchor: ${label}`);
  return source.replace(before, after);
}

let realtime = read('public/rift-realtime.js');
realtime = replaceOnce(realtime,
"  socketState: 'idle',\n  connectedAt: null,",
"  socketState: 'idle',\n  connectingAt: null,\n  connectedAt: null,",
'realtime connecting timestamp state');
realtime = replaceOnce(realtime,
"  state.socketState = 'connecting';\n  try {",
"  state.socketState = 'connecting';\n  state.connectingAt = new Date().toISOString();\n  try {",
'realtime connect start timestamp');
realtime = replaceOnce(realtime,
"    state.socketState = 'error';\n    state.lastError = String(error?.message || error || 'WebSocket construction failed').slice(0, 160);",
"    state.socketState = 'error';\n    state.connectingAt = null;\n    state.lastError = String(error?.message || error || 'WebSocket construction failed').slice(0, 160);",
'constructor failure clears connecting timestamp');
realtime = replaceOnce(realtime,
"    state.socketState = 'open';\n    state.connectedAt = new Date().toISOString();",
"    state.socketState = 'open';\n    state.connectingAt = null;\n    state.connectedAt = new Date().toISOString();",
'open clears connecting timestamp');
realtime = replaceOnce(realtime,
"    state.socketState = 'error';\n    state.lastError = 'WebSocket transport error';",
"    state.socketState = 'error';\n    state.connectingAt = null;\n    state.lastError = 'WebSocket transport error';",
'error clears connecting timestamp');
realtime = replaceOnce(realtime,
"    state.socketState = 'closed';\n    state.disconnectedAt = new Date().toISOString();",
"    state.socketState = 'closed';\n    state.connectingAt = null;\n    state.disconnectedAt = new Date().toISOString();",
'close clears connecting timestamp');
realtime = replaceOnce(realtime,
"  state.socketState = 'closed';\n  state.disconnectedAt = new Date().toISOString();",
"  state.socketState = 'closed';\n  state.connectingAt = null;\n  state.disconnectedAt = new Date().toISOString();",
'client close clears connecting timestamp');
realtime = replaceOnce(realtime,
"function realtimeStatus() {\n  const now = Date.now();\n  return {\n    ...state,\n    socketState: socket?.readyState === WebSocket.OPEN ? 'open' : state.socketState,",
"function realtimeStatus() {\n  const now = Date.now();\n  const socketState = socket?.readyState === WebSocket.OPEN ? 'open' : state.socketState;\n  const connectingAtMs = Date.parse(state.connectingAt || '');\n  const connectingAgeMs = socketState === 'connecting' && Number.isFinite(connectingAtMs)\n    ? Math.max(0, now - connectingAtMs)\n    : null;\n  return {\n    ...state,\n    socketState,\n    connectingAgeMs,",
'realtime status connecting age');
realtime = replaceOnce(realtime,
"  state.socketState = 'offline';\n  state.disconnectedAt = new Date().toISOString();",
"  state.socketState = 'offline';\n  state.connectingAt = null;\n  state.disconnectedAt = new Date().toISOString();",
'offline clears connecting timestamp');
write('public/rift-realtime.js', realtime);

let validator = read('public/rift-validator-guard.js');
validator = replaceOnce(validator,
"const originalRunValidation = RiftDiagnostics.prototype.runValidation;",
"const originalRunValidation = RiftDiagnostics.prototype.runValidation;\nconst REALTIME_CONNECTING_GRACE_MS = 1500;",
'validator grace constant');
validator = replaceOnce(validator,
"    const socketState = String(realtime.socketState || 'unknown');\n    const socketStatus = socketState === 'open' ? 'pass' : ['connecting', 'idle'].includes(socketState) ? 'warn' : 'fail';\n    checks.push(statusCheck('realtime.socket', socketStatus, `Realtime socket=${socketState}`));",
"    const socketState = String(realtime.socketState || 'unknown');\n    const connectingAgeMs = Number(realtime.connectingAgeMs);\n    const connectingWithinGrace = socketState === 'connecting' && Number.isFinite(connectingAgeMs) && connectingAgeMs >= 0 && connectingAgeMs < REALTIME_CONNECTING_GRACE_MS;\n    const socketStatus = socketState === 'open' || connectingWithinGrace ? 'pass' : ['connecting', 'idle'].includes(socketState) ? 'warn' : 'fail';\n    const socketDetail = connectingWithinGrace\n      ? `Realtime socket=connecting · ${Math.round(connectingAgeMs)}ms/${REALTIME_CONNECTING_GRACE_MS}ms startup/reconnect grace`\n      : `Realtime socket=${socketState}`;\n    checks.push(statusCheck('realtime.socket', socketStatus, socketDetail));",
'validator connecting grace');
write('public/rift-validator-guard.js', validator);

let html = read('public/index.html');
html = replaceOnce(html,
'/rift-realtime.js?v=20260901-realtime-10hz-r1',
'/rift-realtime.js?v=20260901-reconnect-grace-r1',
'realtime cache bust');
html = replaceOnce(html,
'/rift-validator-guard.js?v=20260901-validator-evidence-r1',
'/rift-validator-guard.js?v=20260901-reconnect-grace-r1',
'validator cache bust');
write('public/index.html', html);

let check = read('scripts/check-realtime-state.mjs');
check = replaceOnce(check,
"const styles = read('public/styles.css');",
"const styles = read('public/styles.css');\nconst validatorGuard = read('public/rift-validator-guard.js');",
'load validator guard for static check');
check = replaceOnce(check,
"requireMatch(html, /rift-realtime\\.js\\?v=20260901-realtime-10hz-r1/, '10Hz realtime client module loaded');",
"requireMatch(html, /rift-realtime\\.js\\?v=20260901-reconnect-grace-r1/, 'realtime client reconnect-grace module loaded');\nrequireMatch(html, /rift-validator-guard\\.js\\?v=20260901-reconnect-grace-r1/, 'validator reconnect-grace module loaded');",
'cache version verification');
check = replaceOnce(check,
"requireMatch(client, /lastRttMs/, 'RTT telemetry');",
"requireMatch(client, /lastRttMs/, 'RTT telemetry');\nrequireMatch(client, /connectingAt:\\s*null/, 'realtime connecting timestamp telemetry');\nrequireMatch(client, /connectingAgeMs/, 'realtime connecting age telemetry');",
'realtime grace telemetry checks');
check = replaceOnce(check,
"requireMatch(architecture, /direct-meaningful-10hz/, 'runtime validator requires direct 10Hz mode');",
"requireMatch(architecture, /direct-meaningful-10hz/, 'runtime validator requires direct 10Hz mode');\nrequireMatch(validatorGuard, /REALTIME_CONNECTING_GRACE_MS\\s*=\\s*1500/, 'validator 1.5s realtime connecting grace');\nrequireMatch(validatorGuard, /connectingWithinGrace/, 'validator recognizes bounded connecting transition');\nrequireMatch(validatorGuard, /socketState === 'open' \\|\\| connectingWithinGrace/, 'brief connecting state passes only inside grace window');",
'validator reconnect grace static checks');
write('scripts/check-realtime-state.mjs', check);

console.log('Installed bounded 1.5s realtime connecting grace telemetry and validator policy.');
