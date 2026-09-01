import { RiftEngine } from './rift-engine.js?v=20260901-engine-blackbox-r1';

export const IRONVALE_GL_TRIPWIRE_FORMAT = 'ironvale-gl-tripwire-v1';

const PATCH = Symbol.for('ironvale.gl-tripwire.patched');
const MAX_CAPTURES = 24;
const ARM_FRAMES = 120;
const POST_CAPTURE_FRAMES = 3;
const WATCHED_CALLS = Object.freeze([
  'viewport', 'clearColor', 'clear', 'useProgram',
  'uniformMatrix4fv', 'uniform3fv', 'uniform4fv', 'uniform1f', 'uniform1i', 'uniform1fv',
  'vertexAttrib2f', 'vertexAttrib4f', 'activeTexture', 'bindTexture', 'bindVertexArray', 'drawElements'
]);

const state = {
  format: IRONVALE_GL_TRIPWIRE_FORMAT,
  installedAt: new Date().toISOString(),
  armed: false,
  armedFrames: 0,
  triggerCount: 0,
  captureCount: 0,
  lastTriggerAt: null,
  lastCaptureAt: null,
  installFailures: [],
  triggers: [],
  captures: []
};

let providerRegistered = false;

function isoNow() { return new Date().toISOString(); }
function short(value, max = 160) { return String(value == null ? '' : value).slice(0, max); }
function pushRing(target, value, max = MAX_CAPTURES) {
  target.push(value);
  if (target.length > max) target.splice(0, target.length - max);
  return value;
}
function record(message, data = null, severity = 'info') {
  try { window.IronvaleDiagnostics?.record?.('gl-tripwire', message, data, severity); } catch (_) {}
}
function errorName(gl, code) {
  const pairs = [
    [gl.INVALID_ENUM, 'INVALID_ENUM'], [gl.INVALID_VALUE, 'INVALID_VALUE'], [gl.INVALID_OPERATION, 'INVALID_OPERATION'],
    [gl.INVALID_FRAMEBUFFER_OPERATION, 'INVALID_FRAMEBUFFER_OPERATION'], [gl.OUT_OF_MEMORY, 'OUT_OF_MEMORY'],
    [gl.CONTEXT_LOST_WEBGL, 'CONTEXT_LOST_WEBGL']
  ];
  return pairs.find(([value]) => value === code)?.[1] || `0x${Number(code).toString(16)}`;
}
function enumName(gl, value) {
  const known = new Map([
    [gl.TRIANGLES, 'TRIANGLES'], [gl.UNSIGNED_SHORT, 'UNSIGNED_SHORT'], [gl.UNSIGNED_INT, 'UNSIGNED_INT'],
    [gl.TEXTURE_2D, 'TEXTURE_2D'], [gl.TEXTURE_2D_ARRAY, 'TEXTURE_2D_ARRAY'],
    [gl.TEXTURE0, 'TEXTURE0'], [gl.TEXTURE1, 'TEXTURE1'], [gl.TEXTURE2, 'TEXTURE2'], [gl.TEXTURE3, 'TEXTURE3'], [gl.TEXTURE4, 'TEXTURE4']
  ]);
  return known.get(value) || Number(value);
}
function textureId(engine, texture) {
  if (!texture) return null;
  if (texture === engine.whiteTexture) return 'white-texture';
  const info = engine.textureInfo?.get?.(texture);
  if (info?.id) return info.id;
  for (const resource of engine.textureArrays || []) if (resource?.texture === texture) return resource.diagnosticId || 'texture-array';
  for (const skin of engine.skins || []) if (skin?.texture === texture) return skin.diagnosticId || 'skin-texture';
  return 'untracked-texture';
}
function meshSnapshot(engine, mesh) {
  if (!mesh) return null;
  const gl = engine.gl;
  return {
    id: mesh.diagnosticId || null,
    kind: mesh.kind || null,
    label: mesh.label || null,
    visible: Boolean(mesh.visible),
    vertexCount: Number(mesh.vertexCount) || 0,
    indexCount: Number(mesh.count) || 0,
    indexType: mesh.indexType === gl.UNSIGNED_INT ? 'UNSIGNED_INT' : mesh.indexType === gl.UNSIGNED_SHORT ? 'UNSIGNED_SHORT' : Number(mesh.indexType) || null,
    stride: Number(mesh.stride) || 0,
    attributes: Object.keys(mesh.attributes || {}),
    textureId: textureId(engine, mesh.texture),
    skinId: mesh.skin?.diagnosticId || null,
    skinned: Boolean(mesh.skin?.texture && Number.isInteger(mesh.attributes?.joints) && Number.isInteger(mesh.attributes?.weights)),
    terrainMaterial: Boolean(mesh.terrainMaterial),
    terrainLayerCount: Number(mesh.terrainMaterial?.layerCount) || 0
  };
}
function summarizeArgs(gl, name, args, engine, activeUnit) {
  if (name === 'drawElements') return { mode: enumName(gl, args[0]), count: Number(args[1]) || 0, type: enumName(gl, args[2]), offset: Number(args[3]) || 0 };
  if (name === 'activeTexture') return { unit: enumName(gl, args[0]) };
  if (name === 'bindTexture') return { target: enumName(gl, args[0]), activeUnit, textureId: textureId(engine, args[1]) };
  if (name === 'bindVertexArray') return { vao: args[0] ? 'bound' : 'null' };
  if (name.startsWith('uniform')) return { location: args[0] ? 'active' : 'null', scalar: typeof args[1] === 'number' ? Number(args[1]) : undefined };
  if (name.startsWith('vertexAttrib')) return { index: Number(args[0]), values: args.slice(1).map(value => Number(value)) };
  if (name === 'viewport') return { x: Number(args[0]), y: Number(args[1]), width: Number(args[2]), height: Number(args[3]) };
  return {};
}
function arm(reason, errors = []) {
  state.armed = true;
  state.armedFrames = Math.max(state.armedFrames, ARM_FRAMES);
  state.triggerCount += 1;
  state.lastTriggerAt = isoNow();
  const trigger = pushRing(state.triggers, { at: state.lastTriggerAt, reason: short(reason, 80), errors: errors.map(item => ({ code: item.code, name: item.name, source: item.source })) }, 12);
  record('WebGL tripwire armed after renderer error', trigger, 'warn');
}
function appendEngineError(engine, entry) {
  const errors = engine?._telemetry?.glErrors;
  if (!Array.isArray(errors)) return;
  errors.push(entry);
  if (errors.length > 80) errors.splice(0, errors.length - 80);
}
function captureFault(engine, context, operation, args, code) {
  const gl = engine.gl;
  const mesh = context.currentVao ? context.vaoToMesh.get(context.currentVao) || null : null;
  const entry = {
    at: isoNow(),
    source: 'tripwire',
    code,
    name: errorName(gl, code),
    frameNumber: Number(engine?._telemetry?.frameNumber) + 1 || null,
    operation,
    activeTextureUnit: context.activeUnit,
    args: summarizeArgs(gl, operation, args, engine, context.activeUnit),
    mesh: meshSnapshot(engine, mesh),
    renderer: {
      programLinked: (() => { try { return Boolean(gl.getProgramParameter(engine.program, gl.LINK_STATUS)); } catch (_) { return null; } })(),
      contextLost: Boolean(gl.isContextLost?.()),
      viewport: engine.viewport ? { cssWidth: engine.viewport.cssWidth, cssHeight: engine.viewport.cssHeight, width: engine.viewport.width, height: engine.viewport.height } : null
    }
  };
  state.captureCount += 1;
  state.lastCaptureAt = entry.at;
  pushRing(state.captures, entry);
  appendEngineError(engine, { at: entry.at, source: `tripwire:${operation}`, code, name: entry.name, meshId: entry.mesh?.id || null });
  state.armedFrames = Math.min(state.armedFrames, POST_CAPTURE_FRAMES);
  record('WebGL tripwire localized renderer error', entry, 'error');
}
function instrumentGlForFrame(engine) {
  const gl = engine.gl;
  const nativeGetError = gl.getError.bind(gl);
  const originals = new Map();
  const vaoToMesh = new Map();
  for (const mesh of engine.meshes || []) if (mesh?.vao) vaoToMesh.set(mesh.vao, mesh);
  const context = { currentVao: null, activeUnit: 0, vaoToMesh };

  for (const name of WATCHED_CALLS) {
    const original = gl[name];
    if (typeof original !== 'function') continue;
    const bound = original.bind(gl);
    originals.set(name, original);
    try {
      gl[name] = function tripwireWrappedGlCall(...args) {
        const result = bound(...args);
        if (name === 'activeTexture') context.activeUnit = Math.max(0, Number(args[0]) - gl.TEXTURE0);
        if (name === 'bindVertexArray') context.currentVao = args[0] || null;
        for (let index = 0; index < 4; index += 1) {
          const code = nativeGetError();
          if (code === gl.NO_ERROR) break;
          captureFault(engine, context, name, args, code);
        }
        return result;
      };
    } catch (error) {
      pushRing(state.installFailures, { at: isoNow(), call: name, error: short(error?.message || error, 220) }, 12);
    }
  }

  return () => {
    for (const [name, original] of originals) {
      try { gl[name] = original; } catch (_) {}
    }
  };
}

if (!RiftEngine.prototype[PATCH]) {
  Object.defineProperty(RiftEngine.prototype, PATCH, { value: true });
  const nativeRender = RiftEngine.prototype.render;
  const nativeCapture = RiftEngine.prototype._captureGlErrors;

  RiftEngine.prototype._captureGlErrors = function tripwireAwareCapture(source = 'runtime') {
    const before = Array.isArray(this?._telemetry?.glErrors) ? this._telemetry.glErrors.length : 0;
    const result = nativeCapture.call(this, source);
    const after = Array.isArray(this?._telemetry?.glErrors) ? this._telemetry.glErrors.length : 0;
    if (source === 'render' && after > before) arm('periodic-render-error', this._telemetry.glErrors.slice(before, after));
    return result;
  };

  RiftEngine.prototype.render = function tripwireRender(...args) {
    if (!state.armed || state.armedFrames <= 0 || !this?.gl || this.gl.isContextLost?.()) return nativeRender.apply(this, args);
    state.armedFrames -= 1;
    let restore = () => {};
    try { restore = instrumentGlForFrame(this); }
    catch (error) { pushRing(state.installFailures, { at: isoNow(), call: 'frame-install', error: short(error?.message || error, 220) }, 12); }
    try { return nativeRender.apply(this, args); }
    finally {
      restore();
      if (state.armedFrames <= 0 || state.captureCount >= MAX_CAPTURES) {
        state.armed = false;
        state.armedFrames = 0;
      }
    }
  };
}

function registerProvider() {
  if (providerRegistered) return;
  const diagnostics = window.IronvaleDiagnostics;
  if (!diagnostics?.registerProvider) { setTimeout(registerProvider, 100); return; }
  diagnostics.registerProvider('gl-tripwire', level => ({
    format: state.format,
    installedAt: state.installedAt,
    armed: state.armed,
    armedFrames: state.armedFrames,
    triggerCount: state.triggerCount,
    captureCount: state.captureCount,
    lastTriggerAt: state.lastTriggerAt,
    lastCaptureAt: state.lastCaptureAt,
    installFailures: [...state.installFailures],
    triggers: level >= 3 ? state.triggers.map(item => ({ ...item })) : state.triggers.slice(-3).map(item => ({ ...item })),
    captures: level >= 3 ? state.captures.map(item => ({ ...item })) : state.captures.slice(-4).map(item => ({ ...item })),
    policy: { dormantUntilPeriodicError: true, perCallGetErrorOnlyWhileArmed: true, maxCaptures: MAX_CAPTURES }
  }));
  providerRegistered = true;
}

window.IronvaleGlTripwire = Object.freeze({
  format: state.format,
  status: () => ({ ...state, triggers: state.triggers.map(item => ({ ...item })), captures: state.captures.map(item => ({ ...item })) }),
  arm: () => arm('manual')
});

registerProvider();
