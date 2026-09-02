export const ANTICHEAT_FORMAT = 'ironvale-anticheat-v1';
export const ANTICHEAT_CASE_MIN_RISK = 60;
export const ANTICHEAT_DEEP_MIN_RISK = 80;
export const ANTICHEAT_CRITICAL_MIN_RISK = 95;

const CELL_METERS = 4;
const ROUTE_WINDOW = 96;
const PATTERN_LENGTH = 12;
const PATTERN_LIMIT = 64;
const DEEP_EVENT_LIMIT = 96;
const CASE_REFRESH_MS = 60 * 1000;

export const ANTICHEAT_SCHEMA = Object.freeze([
  `CREATE TABLE IF NOT EXISTS anti_cheat_cases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    username TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    risk_score INTEGER NOT NULL DEFAULT 0,
    risk_band TEXT NOT NULL DEFAULT 'normal',
    watch_level TEXT NOT NULL DEFAULT 'summary',
    primary_signal TEXT,
    summary_json TEXT NOT NULL,
    evidence_json TEXT,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    reviewer TEXT,
    review_note TEXT,
    ai_recommendation TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_anti_cheat_cases_risk ON anti_cheat_cases(risk_score DESC, last_seen_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_anti_cheat_cases_user ON anti_cheat_cases(user_id, last_seen_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_anti_cheat_cases_status ON anti_cheat_cases(status, risk_score DESC)`
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function cellKey(x, z) {
  return `${Math.floor((Number(x) || 0) / CELL_METERS)},${Math.floor((Number(z) || 0) / CELL_METERS)}`;
}

function fingerprint(values) {
  let hash = 2166136261;
  const text = values.join('|');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function pushRing(target, value, limit) {
  target.push(value);
  if (target.length > limit) target.splice(0, target.length - limit);
}

function riskBand(score) {
  if (score >= ANTICHEAT_CRITICAL_MIN_RISK) return 'critical';
  if (score >= ANTICHEAT_DEEP_MIN_RISK) return 'deep';
  if (score >= ANTICHEAT_CASE_MIN_RISK) return 'elevated';
  if (score >= 30) return 'observe';
  return 'normal';
}

function watchLevel(score) {
  if (score >= ANTICHEAT_DEEP_MIN_RISK) return 'deep';
  if (score >= ANTICHEAT_CASE_MIN_RISK) return 'elevated';
  return 'summary';
}

function recommendation(score) {
  if (score >= ANTICHEAT_CRITICAL_MIN_RISK) return 'priority-human-review';
  if (score >= ANTICHEAT_DEEP_MIN_RISK) return 'deep-telemetry-and-review';
  if (score >= ANTICHEAT_CASE_MIN_RISK) return 'elevated-telemetry';
  if (score >= 30) return 'summary-watch';
  return 'none';
}

export function createAntiCheatState(now = Date.now()) {
  return {
    format: ANTICHEAT_FORMAT,
    sessionStartedAt: Number(now) || Date.now(),
    samples: 0,
    movingSamples: 0,
    distanceMeters: 0,
    movingMs: 0,
    nearMaxMovingMs: 0,
    currentContinuousMovingMs: 0,
    longestContinuousMovingMs: 0,
    lastMotionAt: 0,
    lastCell: null,
    routeCells: [],
    patternCounts: {},
    patternOrder: [],
    maxPatternRepeats: 0,
    deterministicRejects: 0,
    speedRejects: 0,
    verticalRejects: 0,
    staleSequenceRejects: 0,
    integrityRejects: 0,
    otherRejects: 0,
    score: 0,
    riskBand: 'normal',
    watchLevel: 'summary',
    signals: [],
    recommendedAction: 'none',
    deepEvidence: [],
    caseId: null,
    firstCaseAt: 0,
    lastCasePersistAt: 0,
    lastPersistedRisk: 0,
    lastEvaluationAt: Number(now) || Date.now()
  };
}

function ensureState(state, now = Date.now()) {
  if (!state || state.format !== ANTICHEAT_FORMAT) return createAntiCheatState(now);
  if (!Array.isArray(state.routeCells)) state.routeCells = [];
  if (!Array.isArray(state.patternOrder)) state.patternOrder = [];
  if (!state.patternCounts || typeof state.patternCounts !== 'object') state.patternCounts = {};
  if (!Array.isArray(state.deepEvidence)) state.deepEvidence = [];
  if (!Array.isArray(state.signals)) state.signals = [];
  return state;
}

function recordRouteCell(state, key) {
  if (!key || state.lastCell === key) return;
  state.lastCell = key;
  pushRing(state.routeCells, key, ROUTE_WINDOW);
  if (state.routeCells.length < PATTERN_LENGTH) return;
  const hash = fingerprint(state.routeCells.slice(-PATTERN_LENGTH));
  if (!Object.prototype.hasOwnProperty.call(state.patternCounts, hash)) {
    state.patternCounts[hash] = 0;
    state.patternOrder.push(hash);
    if (state.patternOrder.length > PATTERN_LIMIT) {
      const expired = state.patternOrder.shift();
      delete state.patternCounts[expired];
    }
  }
  state.patternCounts[hash] += 1;
  state.maxPatternRepeats = Math.max(state.maxPatternRepeats, state.patternCounts[hash]);
}

function evaluate(state, now = Date.now()) {
  const signals = [];
  let score = 0;
  const add = (id, weight, detail) => {
    const safeWeight = Math.max(0, Math.trunc(Number(weight) || 0));
    if (!safeWeight) return;
    score += safeWeight;
    signals.push({ id, weight: safeWeight, detail: String(detail || '').slice(0, 240) });
  };

  if (state.speedRejects) add('movement-speed-rejects', Math.min(30, 10 + Math.max(0, state.speedRejects - 1) * 5), `${state.speedRejects} horizontal speed rejection(s)`);
  if (state.verticalRejects) add('movement-vertical-rejects', Math.min(20, 8 + Math.max(0, state.verticalRejects - 1) * 4), `${state.verticalRejects} vertical movement rejection(s)`);
  if (state.integrityRejects) add('integrity-rejects', Math.min(30, 15 + Math.max(0, state.integrityRejects - 1) * 5), `${state.integrityRejects} integrity/session rejection(s)`);
  if (state.staleSequenceRejects >= 3) add('sequence-anomalies', Math.min(10, state.staleSequenceRejects * 2), `${state.staleSequenceRejects} stale sequence rejection(s)`);

  if (state.maxPatternRepeats >= 8) add('route-pattern-repeat', 50, `same ${PATTERN_LENGTH}-cell route fragment repeated ${state.maxPatternRepeats} times`);
  else if (state.maxPatternRepeats >= 5) add('route-pattern-repeat', 30, `same ${PATTERN_LENGTH}-cell route fragment repeated ${state.maxPatternRepeats} times`);
  else if (state.maxPatternRepeats >= 3) add('route-pattern-repeat', 15, `same ${PATTERN_LENGTH}-cell route fragment repeated ${state.maxPatternRepeats} times`);

  const recentCells = state.routeCells.slice(-ROUTE_WINDOW);
  const uniqueCells = new Set(recentCells).size;
  if (recentCells.length >= 80 && uniqueCells <= 18) add('low-route-diversity', 20, `${uniqueCells}/${recentCells.length} unique recent route cells`);
  else if (recentCells.length >= 80 && uniqueCells <= 28) add('low-route-diversity', 10, `${uniqueCells}/${recentCells.length} unique recent route cells`);

  if (state.longestContinuousMovingMs >= 4 * 60 * 60 * 1000) add('extended-continuous-movement', 15, `${Math.round(state.longestContinuousMovingMs / 60000)} minutes continuous movement`);
  else if (state.longestContinuousMovingMs >= 2 * 60 * 60 * 1000) add('extended-continuous-movement', 8, `${Math.round(state.longestContinuousMovingMs / 60000)} minutes continuous movement`);

  const nearMaxRatio = state.movingMs > 0 ? state.nearMaxMovingMs / state.movingMs : 0;
  if (state.movingMs >= 30 * 60 * 1000 && nearMaxRatio >= 0.97) add('near-max-speed-endurance', 8, `${Math.round(nearMaxRatio * 100)}% of moving time near sprint speed`);

  if (state.maxPatternRepeats >= 5 && state.longestContinuousMovingMs >= 20 * 60 * 1000) {
    add('repetitive-endurance-combination', 15, 'repeated route pattern combined with long uninterrupted movement');
  }

  state.score = clamp(score, 0, 100);
  state.riskBand = riskBand(state.score);
  state.watchLevel = watchLevel(state.score);
  state.signals = signals.sort((a, b) => b.weight - a.weight);
  state.recommendedAction = recommendation(state.score);
  state.lastEvaluationAt = Number(now) || Date.now();
  return state;
}

export function observeAcceptedMovement(inputState, previous, accepted) {
  const now = Number(accepted?.now) || Date.now();
  const state = ensureState(inputState, now);
  const previousAt = Number(previous?.lastAcceptedAt) || now;
  const dtMs = clamp(now - previousAt, 50, 30000);
  const dx = (Number(accepted?.x) || 0) - (Number(previous?.x) || 0);
  const dz = (Number(accepted?.z) || 0) - (Number(previous?.z) || 0);
  const horizontalDistance = Math.hypot(dx, dz);
  const speed = horizontalDistance / Math.max(0.05, dtMs / 1000);
  state.samples += 1;

  if (horizontalDistance > 0.02) {
    state.movingSamples += 1;
    state.distanceMeters += horizontalDistance;
    state.movingMs += dtMs;
    if (speed >= 10.5 && speed <= 14) state.nearMaxMovingMs += dtMs;
    if (state.lastMotionAt && now - state.lastMotionAt <= 2000) state.currentContinuousMovingMs += dtMs;
    else state.currentContinuousMovingMs = dtMs;
    state.longestContinuousMovingMs = Math.max(state.longestContinuousMovingMs, state.currentContinuousMovingMs);
    state.lastMotionAt = now;
    recordRouteCell(state, cellKey(accepted?.x, accepted?.z));
  } else if (state.lastMotionAt && now - state.lastMotionAt > 5000) {
    state.currentContinuousMovingMs = 0;
  }

  evaluate(state, now);
  if (state.score >= ANTICHEAT_DEEP_MIN_RISK) {
    pushRing(state.deepEvidence, {
      at: now,
      type: 'movement',
      seq: Number(accepted?.seq) || 0,
      x: round(accepted?.x),
      z: round(accepted?.z),
      distance: round(horizontalDistance),
      speed: round(speed),
      risk: state.score
    }, DEEP_EVENT_LIMIT);
  }
  return state;
}

export function observeRejectedMovement(inputState, reason, now = Date.now()) {
  const state = ensureState(inputState, now);
  const key = String(reason || 'unknown');
  state.deterministicRejects += 1;
  if (key === 'horizontal-speed') state.speedRejects += 1;
  else if (key === 'vertical-speed') state.verticalRejects += 1;
  else if (key === 'stale-sequence') state.staleSequenceRejects += 1;
  else if (key.startsWith('integrity-') || key === 'session-expired') state.integrityRejects += 1;
  else state.otherRejects += 1;
  evaluate(state, now);
  if (state.score >= ANTICHEAT_DEEP_MIN_RISK) {
    pushRing(state.deepEvidence, { at: Number(now) || Date.now(), type: 'rejection', reason: key, risk: state.score }, DEEP_EVENT_LIMIT);
  }
  return state;
}

export function antiCheatSummary(inputState) {
  const state = ensureState(inputState);
  const recentCells = state.routeCells.slice(-ROUTE_WINDOW);
  const uniqueCells = new Set(recentCells).size;
  return {
    format: ANTICHEAT_FORMAT,
    score: state.score,
    riskBand: state.riskBand,
    watchLevel: state.watchLevel,
    recommendedAction: state.recommendedAction,
    primarySignal: state.signals[0]?.id || null,
    signals: state.signals.slice(0, 8),
    metrics: {
      samples: state.samples,
      movingSamples: state.movingSamples,
      distanceMeters: round(state.distanceMeters, 1),
      movingMinutes: round(state.movingMs / 60000, 2),
      longestContinuousMovingMinutes: round(state.longestContinuousMovingMs / 60000, 2),
      nearMaxMovingRatio: state.movingMs ? round(state.nearMaxMovingMs / state.movingMs, 3) : 0,
      routeCells: recentCells.length,
      uniqueRouteCells: uniqueCells,
      maxPatternRepeats: state.maxPatternRepeats,
      deterministicRejects: state.deterministicRejects,
      speedRejects: state.speedRejects,
      verticalRejects: state.verticalRejects,
      staleSequenceRejects: state.staleSequenceRejects,
      integrityRejects: state.integrityRejects
    },
    caseId: state.caseId || null,
    sessionStartedAt: state.sessionStartedAt,
    lastEvaluationAt: state.lastEvaluationAt
  };
}

export function antiCheatEvidence(inputState) {
  const state = ensureState(inputState);
  return {
    format: 'ironvale-anticheat-evidence-v1',
    retentionPolicy: state.score >= ANTICHEAT_DEEP_MIN_RISK ? 'deep-suspicious-session' : 'summary-suspicious-session',
    routeCells: state.routeCells.slice(-ROUTE_WINDOW),
    patternCounts: Object.fromEntries(state.patternOrder.map(key => [key, state.patternCounts[key] || 0]).filter(([, count]) => count > 1)),
    deepEvents: state.score >= ANTICHEAT_DEEP_MIN_RISK ? state.deepEvidence.slice(-DEEP_EVENT_LIMIT) : [],
    summary: antiCheatSummary(state)
  };
}

export function shouldPersistAntiCheatCase(inputState, now = Date.now()) {
  const state = ensureState(inputState, now);
  if (state.score < ANTICHEAT_CASE_MIN_RISK) return false;
  if (!state.caseId || !state.lastCasePersistAt) return true;
  if (state.score >= ANTICHEAT_CRITICAL_MIN_RISK && state.lastPersistedRisk < ANTICHEAT_CRITICAL_MIN_RISK) return true;
  return Number(now) - Number(state.lastCasePersistAt) >= CASE_REFRESH_MS && state.score !== state.lastPersistedRisk;
}

export function markAntiCheatCasePersisted(inputState, caseId, now = Date.now()) {
  const state = ensureState(inputState, now);
  if (!state.caseId) state.caseId = String(caseId || '');
  if (!state.firstCaseAt) state.firstCaseAt = Number(now) || Date.now();
  state.lastCasePersistAt = Number(now) || Date.now();
  state.lastPersistedRisk = state.score;
  return state;
}
