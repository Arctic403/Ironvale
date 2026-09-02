import fs from 'node:fs';
import {
  ZONE_AUTHORITY_FORMAT,
  ZONE_NEARBY_FORMAT,
  ZONE_SIZE_METERS,
  ZONE_PRESENCE_TTL_MS,
  ZONE_MOVEMENT_SYNC_MS,
  ZONE_CLIENT_HEARTBEAT_MS,
  zoneIdForPosition,
  zoneIdsForInterest
} from '../src/zone-contract.js';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (ok, message) => { if (!ok) throw new Error(`Zone authority v1 check failed: ${message}`); };

assert(ZONE_AUTHORITY_FORMAT === 'ironvale-zone-authority-v1', 'authority format drifted');
assert(ZONE_NEARBY_FORMAT === 'ironvale-zone-nearby-v1', 'nearby format drifted');
assert(ZONE_SIZE_METERS === 128, 'zone size must remain 128m for current 640m world');
assert(ZONE_PRESENCE_TTL_MS >= ZONE_CLIENT_HEARTBEAT_MS * 2, 'presence TTL must tolerate multiple missed client heartbeats');
assert(ZONE_MOVEMENT_SYNC_MS >= 5000, 'movement must not fan out to zone authority at high frequency');
assert(zoneIdForPosition(0, 0) === 'ironvale-terrain:0:0', 'origin zone mapping wrong');
assert(zoneIdForPosition(127.999, 127.999) === 'ironvale-terrain:0:0', 'zone edge mapping wrong');
assert(zoneIdForPosition(128, 128) === 'ironvale-terrain:1:1', 'zone handoff mapping wrong');
assert(zoneIdForPosition(640, 640) === 'ironvale-terrain:4:4', 'world max must clamp into final zone');
assert(zoneIdsForInterest(320, 320, 96).length === 9, 'center interest window should touch 3x3 zones');
assert(zoneIdsForInterest(4, 4, 96).length === 1, 'corner interest window should clamp to one zone');

const zone = read('src/zone-authority.js');
const worker = read('src/realtime-entry.js');
const realtime = read('public/rift-realtime.js');
const auto = read('public/rift-auto-validation.js');
const guard = read('public/rift-validator-guard.js');
const wrangler = read('wrangler.toml');
const html = read('public/index.html');
const pkg = JSON.parse(read('package.json'));

for (const token of [
  'class ZoneState extends DurableObject',
  'this.members = new Map()',
  "url.pathname === '/presence'",
  "url.pathname === '/leave'",
  "url.pathname === '/nearby'",
  "storagePolicy: 'ram-only-ephemeral-presence'",
  'd1Writes: false',
  'durableStorageWrites: false'
]) assert(zone.includes(token), `zone Durable Object missing ${token}`);
assert(!zone.includes('env.DB'), 'zone presence must not use D1');
assert(!zone.includes('storage.put'), 'zone presence must not persist per-player presence in Durable Object storage');

for (const token of [
  "export { ZoneState } from './zone-authority.js'",
  'function zoneStateStub(env, zoneId)',
  'async syncZoneMembership(state',
  'async nearbyInterest(state',
  "'/api/realtime/nearby'",
  "url.pathname === '/nearby'",
  'zoneAuthority:'
]) assert(worker.includes(token), `player/worker integration missing ${token}`);
assert(worker.includes('zoneChanged || now - Number(zone.lastSyncAt || 0) >= ZONE_MOVEMENT_SYNC_MS'), 'zone sync must be throttled except handoff');
assert(worker.includes("reason: 'zone-handoff'"), 'immediate zone handoff missing');
assert(worker.includes("reason: 'client-presence'"), 'stationary presence heartbeat path missing');

for (const token of [
  'ZONE_PRESENCE_HEARTBEAT_MS',
  "type: 'presence'",
  'presenceHeartbeatsSent',
  'zoneAuthorityPolicy'
]) assert(realtime.includes(token), `realtime client missing ${token}`);

for (const token of [
  "'/api/realtime/nearby?radius=96&limit=64'",
  "body?.zoneAuthority?.format !== 'ironvale-zone-authority-v1'",
  "nearby?.format !== 'ironvale-zone-nearby-v1'",
  'zoneAuthority: { ...body.zoneAuthority',
  'nearby: { ...nearby'
]) assert(auto.includes(token), `security smoke missing ${token}`);
for (const id of ['architecture.zone-authority', 'architecture.interest-management']) assert(guard.includes(`'${id}'`), `validator missing ${id}`);

assert(wrangler.includes('name = "ZONE_STATE"'), 'ZONE_STATE Durable Object binding missing');
assert(wrangler.includes('class_name = "ZoneState"'), 'ZoneState class binding missing');
assert(wrangler.includes('tag = "zone-state-v1"'), 'ZoneState migration missing');
assert(wrangler.includes('new_sqlite_classes = ["ZoneState"]'), 'ZoneState sqlite-class migration missing');
assert(html.includes('/rift-realtime.js?v=20260902-zone-authority-r1'), 'realtime cache bust missing');
assert(html.includes('/rift-validator-guard.js?v=20260902-zone-authority-r1'), 'validator cache bust missing');
assert(html.includes('/rift-auto-validation.js?v=20260902-zone-authority-r1'), 'auto validation cache bust missing');

const build = String(pkg.scripts?.build || '');
assert(build.includes('node --check src/zone-contract.js'), 'zone contract syntax check missing');
assert(build.includes('node --check src/zone-authority.js'), 'zone authority syntax check missing');
assert(build.includes('node scripts/check-zone-authority-v1.mjs'), 'zone authority regression verifier missing');
assert(!fs.existsSync('scripts/apply-zone-authority-v1.mjs'), 'temporary zone patcher must be removed');
assert(!fs.existsSync('.github/workflows/apply-zone-authority-v1.yml'), 'temporary zone workflow must be removed');

console.log('Ironvale Zone Authority v1 verified: 128m RAM zones + immediate handoff + low-rate presence heartbeat + bounded nearby interest + zero D1 movement/presence writes.');
