import fs from 'node:fs';
import {
  ANTICHEAT_CASE_MIN_RISK,
  ANTICHEAT_DEEP_MIN_RISK,
  ANTICHEAT_SCHEMA,
  antiCheatSummary,
  createAntiCheatState,
  observeAcceptedMovement,
  observeRejectedMovement,
  shouldPersistAntiCheatCase
} from '../src/anticheat.js';

const assert = (ok, message) => { if (!ok) throw new Error(`Anti-cheat v1 check failed: ${message}`); };

function accept(state, previous, next, now, seq) {
  const accepted = { ...next, y: 0.9, yaw: 0, now, seq };
  return observeAcceptedMovement(state, { ...previous, y: 0.9, yaw: 0, lastAcceptedAt: now - 500 }, accepted);
}

let normal = createAntiCheatState(0);
let previous = { x: 20, z: 20 };
for (let index = 1; index <= 120; index += 1) {
  const next = { x: 20 + index * 3, z: 20 };
  normal = accept(normal, previous, next, index * 500, index);
  previous = next;
}
const normalSummary = antiCheatSummary(normal);
assert(normalSummary.score < 30, `ordinary straight movement false-positive score=${normalSummary.score}`);
assert(!shouldPersistAntiCheatCase(normal, 120 * 500), 'ordinary movement must not create a D1 case');

let bot = createAntiCheatState(0);
let now = 0;
let seq = 0;
previous = { x: 100, z: 100 };
const loop = [];
for (let x = 0; x < 8; x += 1) loop.push({ x: 100 + x * 4, z: 100 });
for (let z = 1; z < 8; z += 1) loop.push({ x: 128, z: 100 + z * 4 });
for (let x = 7; x >= 0; x -= 1) loop.push({ x: 100 + x * 4, z: 128 });
for (let z = 7; z >= 1; z -= 1) loop.push({ x: 100, z: 100 + z * 4 });
for (let repeat = 0; repeat < 10; repeat += 1) {
  for (const next of loop) {
    now += 500;
    seq += 1;
    bot = accept(bot, previous, next, now, seq);
    previous = next;
  }
}
const botSummary = antiCheatSummary(bot);
assert(botSummary.score >= ANTICHEAT_CASE_MIN_RISK, `repetitive loop was not promoted score=${botSummary.score}`);
assert(botSummary.metrics.maxPatternRepeats >= 5, 'route repetition fingerprint did not accumulate');
assert(shouldPersistAntiCheatCase(bot, now), 'suspicious loop should create sparse D1 case');
assert(!/ban/i.test(botSummary.recommendedAction), 'detector must recommend review/telemetry, never automatic ban');

let rejectState = createAntiCheatState(0);
rejectState = observeRejectedMovement(rejectState, 'horizontal-speed', 1000);
assert(antiCheatSummary(rejectState).score < ANTICHEAT_CASE_MIN_RISK, 'single speed rejection must not auto-promote a case');
for (let index = 0; index < 5; index += 1) rejectState = observeRejectedMovement(rejectState, 'horizontal-speed', 2000 + index * 100);
assert(antiCheatSummary(rejectState).score <= 30, 'speed rejects alone should remain bounded');

assert(ANTICHEAT_DEEP_MIN_RISK > ANTICHEAT_CASE_MIN_RISK, 'deep telemetry threshold must exceed case threshold');
assert(ANTICHEAT_SCHEMA.some(sql => sql.includes('anti_cheat_cases')), 'anti-cheat D1 case schema missing');

const worker = fs.readFileSync('src/realtime-entry.js', 'utf8');
const schema = fs.readFileSync('schema.sql', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const token of [
  "from './anticheat.js'",
  '/api/anticheat/cases',
  'ANTICHEAT_SERVICE_KEY',
  'persistAntiCheatCaseIfNeeded',
  'observeAcceptedMovement',
  'observeRejectedMovement',
  'aiAuthority: \'recommendation-only\'',
  'automaticBan: false',
  'suspiciousCaseWritesOnly: true'
]) assert(worker.includes(token), `worker missing ${token}`);
const serviceKeyReadOnly = worker.includes("if (!write && configured && supplied && constantTimeEqual(configured, supplied))") || (
  worker.includes("if (!write) {") &&
  worker.includes("if (configured && supplied && constantTimeEqual(configured, supplied))")
);
assert(serviceKeyReadOnly, 'service-key reviewer must remain read-only');
assert(worker.includes("if (reviewer.kind !== 'admin' || !reviewer.auth)"), 'case mutation must remain admin-only');
assert(worker.includes("if (!state?.userId || !shouldPersistAntiCheatCase(state.antiCheat)) return false;"), 'ordinary movement must skip case persistence before D1');
assert(schema.includes('CREATE TABLE IF NOT EXISTS anti_cheat_cases'), 'manual D1 schema missing anti-cheat cases');
assert(!fs.existsSync('scripts/apply-anticheat-v1.mjs'), 'temporary anti-cheat patcher must be removed');
assert(!fs.existsSync('.github/workflows/apply-anticheat-v1.yml'), 'temporary anti-cheat workflow must be removed');
const build = String(pkg.scripts?.build || '');
assert(build.includes('node --check src/anticheat.js'), 'core build missing anti-cheat syntax check');
assert(build.includes('node scripts/check-anticheat-v1.mjs'), 'core build missing anti-cheat contract check');

console.log(`Ironvale Anti-Cheat v1 verified: normal=${normalSummary.score}, loop=${botSummary.score}, no auto-ban, sparse suspicious-case persistence, reviewer boundaries locked.`);
