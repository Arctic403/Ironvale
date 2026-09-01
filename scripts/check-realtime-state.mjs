import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireMatch(source, pattern, label) {
  if (!pattern.test(source)) throw new Error(`Missing realtime contract: ${label}`);
}

const worker = read('src/realtime-entry.js');
const client = read('public/rift-realtime.js');
const app = read('public/app.js');
const auto = read('public/rift-auto-validation.js');
const architecture = read('public/rift-architecture-guard.js');
const wrangler = read('wrangler.toml');
const html = read('public/index.html');

requireMatch(wrangler, /main\s*=\s*"src\/realtime-entry\.js"/, 'realtime Worker entrypoint');
requireMatch(wrangler, /\[\[durable_objects\.bindings\]\][\s\S]*name\s*=\s*"PLAYER_STATE"[\s\S]*class_name\s*=\s*"PlayerState"/, 'PLAYER_STATE Durable Object binding');
requireMatch(wrangler, /new_sqlite_classes\s*=\s*\[\s*"PlayerState"\s*\]/, 'SQLite Durable Object migration');
requireMatch(html, /rift-realtime\.js\?v=20260901-realtime-10hz-r1/, '10Hz realtime client module loaded');

requireMatch(worker, /export class PlayerState extends DurableObject/, 'PlayerState Durable Object class');
requireMatch(worker, /acceptWebSocket\(/, 'hibernatable WebSocket acceptance');
requireMatch(worker, /serializeAttachment\(/, 'hibernation-safe live state attachment');
requireMatch(worker, /deserializeAttachment\(/, 'hibernation state restore');
requireMatch(worker, /webSocketMessage\(/, 'authoritative movement message handler');
requireMatch(worker, /webSocketClose\(/, 'disconnect checkpoint handler');
requireMatch(worker, /webSocketError\(/, 'socket-error checkpoint handler');
requireMatch(worker, /CHECKPOINT_INTERVAL_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/, 'five-minute safety checkpoint');
requireMatch(worker, /async alarm\(\)/, 'Durable Object periodic alarm handler');
requireMatch(worker, /storage\.setAlarm\(Date\.now\(\) \+ CHECKPOINT_INTERVAL_MS\)/, 'real five-minute alarm scheduling');
requireMatch(worker, /periodic-alarm/, 'periodic alarm D1 checkpoint reason');
requireMatch(worker, /MAX_HORIZONTAL_SPEED_MPS\s*=\s*7\.2/, 'movement speed authority matches runtime');
requireMatch(worker, /horizontal-speed/, 'server-side jump/speed rejection');
requireMatch(worker, /url\.pathname === '\/api\/character\/position'/, 'legacy compatibility route remains RAM-authoritative');
requireMatch(worker, /routePositionFallback/, 'Durable Object HTTP movement fallback');
requireMatch(worker, /url\.pathname === '\/api\/realtime\/checkpoint'/, 'explicit lifecycle checkpoint route');
requireMatch(worker, /routeRealtimeCheckpoint/, 'checkpoint route targets Durable Object');
requireMatch(worker, /latestAuthorityState\(\)/, 'freshest RAM authority selection');
requireMatch(worker, /Carry the freshest RAM authority/, 'reconnect carry-forward contract');
requireMatch(worker, /checkpointBeforeLogout/, 'logout checkpoint');
requireMatch(worker, /ON CONFLICT\(user_id\) DO UPDATE/, 'single-statement durable checkpoint');

requireMatch(client, /RIFT_REALTIME_FORMAT = 'ironvale-realtime-client-v2'/, 'realtime client v2');
requireMatch(client, /PUBLISH_INTERVAL_MS\s*=\s*100/, '10Hz publish interval');
requireMatch(client, /POSITION_EPSILON_METERS\s*=\s*0\.02/, 'meaningful position threshold');
requireMatch(client, /YAW_EPSILON_RADIANS\s*=\s*0\.005/, 'meaningful yaw threshold');
requireMatch(client, /publisherMode:\s*'direct-meaningful-10hz'/, 'direct publisher telemetry mode');
requireMatch(client, /function publishMovement\(/, 'direct movement publisher');
requireMatch(client, /window\.IronvaleRealtimeMovement = Object\.freeze/, 'direct realtime runtime API');
requireMatch(client, /publish:\s*publishMovement/, 'publisher exposed to app');
requireMatch(client, /legacyFetchBridgeCompatibilityOnly:\s*true/, 'legacy fetch path demoted to compatibility only');
requireMatch(client, /appLegacyHeartbeatRemoved:\s*true/, 'legacy app heartbeat removal exposed');
requireMatch(client, /fallbackMaxHz:\s*1000 \/ FALLBACK_MIN_INTERVAL_MS/, 'bounded HTTP fallback rate');
requireMatch(client, /lastRttMs/, 'RTT telemetry');
requireMatch(client, /ordinaryMovementWritesToD1:\s*false/, 'D1 movement-write policy exposed to diagnostics');
requireMatch(client, /durableObjectAlarm:\s*true/, 'alarm checkpoint policy exposed');
requireMatch(client, /pagehide/, 'page hide checkpoint');
requireMatch(client, /visibility-hidden/, 'visibility checkpoint');

requireMatch(app, /IronvaleRealtimeMovement\?\.publish\?\.\(\{ x: player\.x, y: player\.y, z: player\.z, yaw: player\.yaw \}\)/, 'app publishes live transform directly');
requireMatch(app, /ironvale:movement-correction/, 'app consumes authoritative corrections');
if (/lastPositionSave/.test(app) || /async function savePosition\(/.test(app) || /now - lastPositionSave > 5000/.test(app)) {
  throw new Error('Legacy five-second app movement heartbeat must be removed.');
}

requireMatch(auto, /Direct 10Hz publisher only emitted/, 'auto validator verifies packet cadence path');
requireMatch(auto, /realtime\.checkpoint\('auto-validation'\)/, 'auto validator checkpoints via realtime API');
requireMatch(auto, /source:\s*'validator-restore'/, 'validator exact player restore uses direct publisher');
requireMatch(auto, /exercisesDirectRealtimePublisher:\s*true/, 'auto validation policy declares direct publisher coverage');
requireMatch(architecture, /publisherDeclared/, 'runtime architecture validator checks publisher mode');
requireMatch(architecture, /direct-meaningful-10hz/, 'runtime validator requires direct 10Hz mode');

const movementRoute = worker.match(/if \(method === 'PUT' && url\.pathname === '\/api\/character\/position'\)[\s\S]*?\n\s*}/)?.[0] || '';
if (/env\.DB\.(?:prepare|batch)/.test(movementRoute)) {
  throw new Error('Realtime movement route must not write directly to D1.');
}

console.log('Ironvale direct 10Hz realtime RAM authority verified.');
