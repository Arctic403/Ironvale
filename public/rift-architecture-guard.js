import { RiftDiagnostics } from './rift-diagnostics.js?v=20260901-diagnostic-gzip-r3';

export const RIFT_SURVIVAL_ARCHITECTURE_GUARD_FORMAT = 'rift-survival-architecture-guard-v2';

const PATCH = Symbol.for('rift-survival.architecture-guard.patched');
const INSTANCE_PATCH = Symbol('rift-survival.architecture-guard.instance');
const MOVEMENT_ROUTE = '/api/character/position';

const state = {
  format: RIFT_SURVIVAL_ARCHITECTURE_GUARD_FORMAT,
  installedAt: new Date().toISOString(),
  runs: 0,
  lastRunAt: null,
  lastCheck: null,
  lastGeometryCheck: null
};

function statusCheck(id, status, detail = '') {
  return { id, status: ['pass', 'warn', 'fail'].includes(status) ? status : 'pass', detail: String(detail || '').slice(0, 420) };
}
async function provider(instance, name, level = 2) {
  const fn = instance?.providers?.get?.(name);
  if (typeof fn !== 'function') return null;
  try { return await fn(level); } catch (error) { return { error: String(error?.message || error || 'provider failed') }; }
}
async function movementD1Check(instance) {
  const [backend, realtime] = await Promise.all([
    provider(instance, 'backend', 3),
    provider(instance, 'realtime-movement', 2)
  ]);
  const recent = Array.isArray(backend?.recent) ? backend.recent : [];
  const movement = recent.filter(entry => String(entry?.route || '') === MOVEMENT_ROUTE);
  const d1Calls = movement.reduce((sum, entry) => sum + (Number(entry?.d1?.calls) || 0), 0);
  const d1Writes = movement.reduce((sum, entry) => sum + (Number(entry?.d1?.writes) || 0), 0);
  const d1Failures = movement.reduce((sum, entry) => sum + (Number(entry?.d1?.failures) || 0), 0);
  const policyDeclared = realtime?.authority === 'server-durable-object' &&
    realtime?.d1Policy === 'load-checkpoint-only' &&
    realtime?.checkpointPolicy?.ordinaryMovementWritesToD1 === false;
  const publisherDeclared = realtime?.publisherMode === 'direct-meaningful-10hz' &&
    Number(realtime?.publishPolicy?.maxHz) === 10 &&
    realtime?.publishPolicy?.appLegacyHeartbeatRemoved === true;
  const socketPackets = Number(realtime?.sent) || 0;

  let status = 'pass';
  if (d1Calls > 0 || d1Writes > 0 || d1Failures > 0) status = 'fail';
  else if (!policyDeclared || !publisherDeclared) status = 'fail';
  else if (!realtime) status = 'warn';

  const check = statusCheck(
    'architecture.movement-zero-d1',
    status,
    `${movement.length} backend movement request(s) · ${d1Calls} D1 call(s) · ${d1Writes} D1 write(s) · ${socketPackets} realtime packet(s) · publisher=${publisherDeclared ? 'direct-10Hz' : 'invalid'} · policy=${policyDeclared ? 'RAM-authoritative' : 'invalid'}`
  );
  state.lastCheck = {
    at: new Date().toISOString(),
    status,
    movementBackendRequests: movement.length,
    d1Calls,
    d1Writes,
    d1Failures,
    socketPackets,
    directPublished: Number(realtime?.directPublished) || 0,
    legacyIntercepts: Number(realtime?.legacyIntercepts) || 0,
    publisherDeclared,
    policyDeclared
  };
  return check;
}

async function geometryGuardCheck(instance) {
  const geometry = await provider(instance, 'geometry-guard', 2);
  if (!geometry) {
    const check = statusCheck('geometry.guard-repairs', 'warn', 'Geometry guard diagnostics provider unavailable');
    state.lastGeometryCheck = { at: new Date().toISOString(), status: 'warn', providerAvailable: false };
    return check;
  }
  const validations = Number(geometry.validationCount) || 0;
  const repairs = Number(geometry.repairCount) || 0;
  const rejections = Number(geometry.rejectionCount) || 0;
  const status = repairs > 0 || rejections > 0 ? 'fail' : 'pass';
  const check = statusCheck(
    'geometry.guard-repairs',
    status,
    `${validations} geometry validation(s) · ${repairs} safety repair(s) · ${rejections} rejection(s)${repairs ? ` · last repair=${geometry.lastRepair?.mesh || 'unknown'}` : ''}${rejections ? ` · last rejection=${geometry.lastRejection?.mesh || 'unknown'}` : ''}`
  );
  state.lastGeometryCheck = {
    at: new Date().toISOString(),
    status,
    providerAvailable: true,
    validations,
    repairs,
    rejections,
    lastRepair: geometry.lastRepair || null,
    lastRejection: geometry.lastRejection || null
  };
  return check;
}

if (!RiftDiagnostics.prototype[PATCH]) {
  Object.defineProperty(RiftDiagnostics.prototype, PATCH, { value: true });
  const nativeRunValidation = RiftDiagnostics.prototype.runValidation;
  RiftDiagnostics.prototype.runValidation = async function architectureGuardedValidation(reason = 'manual') {
    if (!this[INSTANCE_PATCH]) {
      const baseValidator = this.validator;
      this.validator = async () => {
        const base = await baseValidator();
        const baseChecks = Array.isArray(base) ? base : Array.isArray(base?.checks) ? base.checks : [];
        const [architectureCheck, geometryCheck] = await Promise.all([
          movementD1Check(this),
          geometryGuardCheck(this)
        ]);
        state.runs += 1;
        state.lastRunAt = new Date().toISOString();
        return [
          ...baseChecks.filter(check => !['architecture.movement-zero-d1', 'geometry.guard-repairs'].includes(check?.id)),
          architectureCheck,
          geometryCheck
        ];
      };
      Object.defineProperty(this, INSTANCE_PATCH, { value: true });
      try {
        this.registerProvider?.('architecture-guard', () => ({
          ...state,
          lastCheck: state.lastCheck ? { ...state.lastCheck } : null,
          lastGeometryCheck: state.lastGeometryCheck ? { ...state.lastGeometryCheck } : null
        }));
      } catch (_) {}
    }
    return nativeRunValidation.call(this, reason);
  };
}

window.RiftSurvivalArchitectureGuard = Object.freeze({
  format: state.format,
  status: () => ({
    ...state,
    lastCheck: state.lastCheck ? { ...state.lastCheck } : null,
    lastGeometryCheck: state.lastGeometryCheck ? { ...state.lastGeometryCheck } : null
  })
});
