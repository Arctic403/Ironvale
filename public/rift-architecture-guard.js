import { RiftDiagnostics } from './rift-diagnostics.js?v=20260901-diagnostic-gzip-r3';

export const IRONVALE_ARCHITECTURE_GUARD_FORMAT = 'ironvale-architecture-guard-v1';

const PATCH = Symbol.for('ironvale.architecture-guard.patched');
const INSTANCE_PATCH = Symbol('ironvale.architecture-guard.instance');
const MOVEMENT_ROUTE = '/api/character/position';

const state = {
  format: IRONVALE_ARCHITECTURE_GUARD_FORMAT,
  installedAt: new Date().toISOString(),
  runs: 0,
  lastRunAt: null,
  lastCheck: null
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
  const socketPackets = Number(realtime?.sent) || 0;

  let status = 'pass';
  if (d1Calls > 0 || d1Writes > 0 || d1Failures > 0) status = 'fail';
  else if (!policyDeclared) status = 'fail';
  else if (!realtime) status = 'warn';

  const check = statusCheck(
    'architecture.movement-zero-d1',
    status,
    `${movement.length} backend movement request(s) · ${d1Calls} D1 call(s) · ${d1Writes} D1 write(s) · ${socketPackets} realtime packet(s) · policy=${policyDeclared ? 'RAM-authoritative' : 'invalid'}`
  );
  state.lastCheck = {
    at: new Date().toISOString(),
    status,
    movementBackendRequests: movement.length,
    d1Calls,
    d1Writes,
    d1Failures,
    socketPackets,
    policyDeclared
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
        const architectureCheck = await movementD1Check(this);
        state.runs += 1;
        state.lastRunAt = new Date().toISOString();
        return [...baseChecks.filter(check => check?.id !== 'architecture.movement-zero-d1'), architectureCheck];
      };
      Object.defineProperty(this, INSTANCE_PATCH, { value: true });
      try {
        this.registerProvider?.('architecture-guard', () => ({ ...state, lastCheck: state.lastCheck ? { ...state.lastCheck } : null }));
      } catch (_) {}
    }
    return nativeRunValidation.call(this, reason);
  };
}

window.IronvaleArchitectureGuard = Object.freeze({
  format: state.format,
  status: () => ({ ...state, lastCheck: state.lastCheck ? { ...state.lastCheck } : null })
});
