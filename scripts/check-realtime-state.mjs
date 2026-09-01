import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireMatch(source, pattern, label) {
  if (!pattern.test(source)) throw new Error(`Missing realtime contract: ${label}`);
}

const worker = read('src/realtime-entry.js');
const client = read('public/rift-realtime.js');
const wrangler = read('wrangler.toml');
const html = read('public/index.html');

requireMatch(wrangler, /main\s*=\s*"src\/realtime-entry\.js"/, 'realtime Worker entrypoint');
requireMatch(wrangler, /\[\[durable_objects\.bindings\]\][\s\S]*name\s*=\s*"PLAYER_STATE"[\s\S]*class_name\s*=\s*"PlayerState"/, 'PLAYER_STATE Durable Object binding');
requireMatch(wrangler, /new_sqlite_classes\s*=\s*\[\s*"PlayerState"\s*\]/, 'SQLite Durable Object migration');
requireMatch(html, /rift-realtime\.js/, 'realtime client module loaded');

requireMatch(worker, /export class PlayerState extends DurableObject/, 'PlayerState Durable Object class');
requireMatch(worker, /acceptWebSocket\(/, 'hibernatable WebSocket acceptance');
requireMatch(worker, /serializeAttachment\(/, 'hibernation-safe live state attachment');
requireMatch(worker, /deserializeAttachment\(/, 'hibernation state restore');
requireMatch(worker, /webSocketMessage\(/, 'authoritative movement message handler');
requireMatch(worker, /webSocketClose\(/, 'disconnect checkpoint handler');
requireMatch(worker, /CHECKPOINT_INTERVAL_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/, 'five-minute safety checkpoint');
requireMatch(worker, /MAX_HORIZONTAL_SPEED_MPS\s*=\s*7\.2/, 'movement speed authority matches runtime');
requireMatch(worker, /horizontal-speed/, 'server-side jump/speed rejection');
requireMatch(worker, /url\.pathname === '\/api\/character\/position'/, 'legacy heartbeat rerouted away from D1');
requireMatch(worker, /routePositionFallback/, 'Durable Object HTTP fallback');
requireMatch(worker, /checkpointBeforeLogout/, 'logout checkpoint');
requireMatch(worker, /ON CONFLICT\(user_id\) DO UPDATE/, 'single-statement durable checkpoint');

requireMatch(client, /new WebSocket\(/, 'WebSocket movement transport');
requireMatch(client, /type: 'move'/, 'movement packet protocol');
requireMatch(client, /realtime-movement/, 'diagnostic provider');
requireMatch(client, /ordinaryMovementWritesToD1:\s*false/, 'D1 movement-write policy exposed to diagnostics');
requireMatch(client, /pagehide/, 'page hide checkpoint');
requireMatch(client, /visibility-hidden/, 'visibility checkpoint');

const movementRoute = worker.match(/if \(method === 'PUT' && url\.pathname === '\/api\/character\/position'\)[\s\S]*?\n\s*}/)?.[0] || '';
if (/env\.DB\.(?:prepare|batch)/.test(movementRoute)) {
  throw new Error('Realtime movement route must not write directly to D1.');
}

console.log('Ironvale realtime RAM authority verified.');
