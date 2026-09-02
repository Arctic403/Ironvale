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
const character = read('public/rift-character.js');
const auto = read('public/rift-auto-validation.js');
const architecture = read('public/rift-architecture-guard.js');
const wrangler = read('wrangler.toml');
const html = read('public/index.html');
const styles = read('public/styles.css');
const validatorGuard = read('public/rift-validator-guard.js');

requireMatch(wrangler, /main\s*=\s*"src\/realtime-entry\.js"/, 'realtime Worker entrypoint');
requireMatch(wrangler, /\[\[durable_objects\.bindings\]\][\s\S]*name\s*=\s*"PLAYER_STATE"[\s\S]*class_name\s*=\s*"PlayerState"/, 'PLAYER_STATE Durable Object binding');
requireMatch(wrangler, /new_sqlite_classes\s*=\s*\[\s*"PlayerState"\s*\]/, 'SQLite Durable Object migration');
requireMatch(html, /rift-realtime\.js\?v=20260902-integrity-v1/, 'realtime client reconnect-grace module loaded');
requireMatch(html, /rift-validator-guard\.js\?v=(?:20260902-integrity-v1|20260902-security-smoke-r1)/, 'validator module loaded');

requireMatch(worker, /REALTIME_FORMAT = 'ironvale-realtime-authority-v2'/, 'realtime authority v2');
requireMatch(worker, /export class PlayerState extends DurableObject/, 'PlayerState Durable Object class');
requireMatch(worker, /acceptWebSocket\(/, 'hibernatable WebSocket acceptance');
requireMatch(worker, /serializeAttachment\(/, 'hibernation-safe live state attachment');
requireMatch(worker, /deserializeAttachment\(/, 'hibernation state restore');
requireMatch(worker, /webSocketMessage\(/, 'authoritative movement message handler');
requireMatch(worker, /webSocketClose\(/, 'disconnect checkpoint handler');
requireMatch(worker, /webSocketError\(/, 'socket-error checkpoint handler');
requireMatch(worker, /CHECKPOINT_INTERVAL_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/, 'five-minute safety checkpoint');
requireMatch(worker, /async ensureCheckpointAlarm\(\)/, 'checkpoint alarm scheduler');
requireMatch(worker, /async alarm\(\)/, 'Durable Object periodic alarm handler');
requireMatch(worker, /if \(state\.dirty\) await this\.ensureCheckpointAlarm\(\)/, 'socket movement schedules alarm only when dirty');
requireMatch(worker, /if \(remaining\?\.state\?\.dirty\) await this\.ctx\.storage\.setAlarm/, 'alarm only repeats while dirty');
requireMatch(worker, /storage\.setAlarm\(Date\.now\(\) \+ CHECKPOINT_INTERVAL_MS\)/, 'real five-minute alarm scheduling');
requireMatch(worker, /periodic-alarm/, 'periodic alarm D1 checkpoint reason');
requireMatch(worker, /MAX_HORIZONTAL_SPEED_MPS\s*=\s*12/, 'movement speed authority matches runtime');
requireMatch(worker, /horizontal-speed/, 'server-side jump/speed rejection');
requireMatch(worker, /url\.pathname === '\/api\/character\/position'/, 'legacy compatibility route remains RAM-authoritative');
requireMatch(worker, /routePositionFallback/, 'Durable Object HTTP movement fallback');
requireMatch(worker, /url\.pathname === '\/api\/realtime\/checkpoint'/, 'explicit lifecycle checkpoint route');
requireMatch(worker, /routeRealtimeCheckpoint/, 'checkpoint route targets Durable Object');
requireMatch(worker, /latestAuthorityState\(\)/, 'freshest RAM authority selection');
requireMatch(worker, /Carry the freshest RAM authority/, 'reconnect carry-forward contract');
requireMatch(worker, /this\.httpState && Number\(this\.httpState\.lastAcceptedAt \|\| 0\) > Number\(closing\.lastAcceptedAt \|\| 0\)/, 'disconnect prefers newer HTTP fallback RAM state');
requireMatch(worker, /this\.httpState && Number\(this\.httpState\.lastAcceptedAt \|\| 0\) > Number\(socketState\.lastAcceptedAt \|\| 0\)/, 'socket error prefers newer HTTP fallback RAM state');
requireMatch(worker, /checkpointReason = String\(request\.headers\.get\('x-ironvale-checkpoint-reason'\)/, 'explicit checkpoint reason preserved');
requireMatch(worker, /headers\.set\('x-ironvale-checkpoint-reason', 'logout'\)/, 'logout checkpoint reason');
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
requireMatch(client, /connectingAt:\s*null/, 'realtime connecting timestamp telemetry');
requireMatch(client, /connectingAgeMs/, 'realtime connecting age telemetry');
requireMatch(client, /ordinaryMovementWritesToD1:\s*false/, 'D1 movement-write policy exposed to diagnostics');
requireMatch(client, /durableObjectAlarm:\s*true/, 'alarm checkpoint policy exposed');
requireMatch(client, /pagehide/, 'page hide checkpoint');
requireMatch(client, /visibility-hidden/, 'visibility checkpoint');

requireMatch(app, /IronvaleRealtimeMovement\?\.publish\?\.\(\{ x: player\.x, y: player\.y, z: player\.z, yaw: player\.yaw \}\)/, 'app publishes live transform directly');
requireMatch(app, /ironvale:movement-correction/, 'app consumes authoritative corrections');
requireMatch(app, /WALK_SPEED_MPS\s*=\s*7\.2/, 'walk speed contract');
requireMatch(app, /SPRINT_SPEED_MPS\s*=\s*12/, 'sprint speed contract');
requireMatch(app, /AUTO_RUN_HOLD_MS\s*=\s*450/, 'mobile auto-run long-hold threshold');
requireMatch(app, /function setupSprintControl\(/, 'mobile sprint pointer control');
requireMatch(app, /autoRunEnabled \? 1 : input\.forward/, 'auto-run forward movement source');
requireMatch(app, /movement-stopped/, 'tap sprint cancels after movement stops');
requireMatch(app, /asset\.defaultClips\.run \|\| asset\.defaultClips\.walk/, 'run animation with walk fallback');
requireMatch(character, /const run = chooseClip\(clipNames,[\s\S]*?\/sprint\/i,[\s\S]*?\/run\/i/, 'dedicated run clip mapping');
requireMatch(character, /defaultClips:\s*\{ idle, walk, run \}/, 'run clip exposed to locomotion runtime');
requireMatch(html, /id="sprint-button"/, 'sprint HUD button');
requireMatch(styles, /\.sprint-button\.auto-run/, 'Auto Run HUD state');
if (/lastPositionSave/.test(app) || /async function savePosition\(/.test(app) || /now - lastPositionSave > 5000/.test(app)) {
  throw new Error('Legacy five-second app movement heartbeat must be removed.');
}

requireMatch(auto, /sprint \+ auto run controls/, 'auto validator exercises sprint and Auto Run');
requireMatch(auto, /Long hold did not activate Auto Run/, 'auto validator checks long-hold Auto Run');
requireMatch(auto, /Sprint displacement ratio/, 'auto validator measures walk versus sprint displacement');
requireMatch(auto, /sprintRatio < 1\.35/, 'auto validator enforces meaningful sprint speed gain');
requireMatch(auto, /Direct 10Hz publisher only emitted/, 'auto validator verifies packet cadence path');
requireMatch(auto, /realtime\.checkpoint\('auto-validation'\)/, 'auto validator checkpoints via realtime API');
requireMatch(auto, /source:\s*'validator-restore'/, 'validator exact player restore uses direct publisher');
requireMatch(auto, /exercisesDirectRealtimePublisher:\s*true/, 'auto validation policy declares direct publisher coverage');
requireMatch(architecture, /publisherDeclared/, 'runtime architecture validator checks publisher mode');
requireMatch(architecture, /direct-meaningful-10hz/, 'runtime validator requires direct 10Hz mode');
requireMatch(validatorGuard, /REALTIME_CONNECTING_GRACE_MS\s*=\s*1500/, 'validator 1.5s realtime connecting grace');
requireMatch(validatorGuard, /connectingWithinGrace/, 'validator recognizes bounded connecting transition');
requireMatch(validatorGuard, /socketState === 'open' \|\| connectingWithinGrace/, 'brief connecting state passes only inside grace window');

const movementRoute = worker.match(/if \(method === 'PUT' && url\.pathname === '\/api\/character\/position'\)[\s\S]*?\n\s*}/)?.[0] || '';
if (/env\.DB\.(?:prepare|batch)/.test(movementRoute)) {
  throw new Error('Realtime movement route must not write directly to D1.');
}

console.log('Ironvale direct 10Hz realtime RAM authority verified.');
