import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing patch anchor: ${label}`);
  return text.replace(from, to);
}

// Diagnostics: console history + stronger string redaction.
let diagnostics = fs.readFileSync('public/rift-diagnostics.js', 'utf8');
diagnostics = replaceOnce(diagnostics,
`const MAX_NETWORK_EVENTS = 120;\nconst MAX_STRING = 120000;`,
`const MAX_NETWORK_EVENTS = 120;\nconst MAX_CONSOLE_EVENTS = 120;\nconst MAX_STRING = 120000;`, 'console limit');
diagnostics = replaceOnce(diagnostics,
`  if (text.length > MAX_STRING) text = text.slice(0, MAX_STRING) + '…[truncated]';\n  if (/^https?:\\/\\//i.test(text)) {`,
`  if (text.length > MAX_STRING) text = text.slice(0, MAX_STRING) + '…[truncated]';\n  text = text.replace(/((?:password|token|secret|authorization|api[-_]?key)\\s*[:=]\\s*)[^\\s,;]+/gi, '$1[REDACTED]');\n  text = text.replace(/\\bBearer\\s+[A-Za-z0-9._~+\\/-]+/gi, 'Bearer [REDACTED]');\n  if (/^https?:\\/\\//i.test(text)) {`, 'string secret redaction');
diagnostics = replaceOnce(diagnostics,
`    this.events = [];\n    this.networkEvents = [];\n    this.providers = new Map();`,
`    this.events = [];\n    this.networkEvents = [];\n    this.consoleEvents = [];\n    this.providers = new Map();`, 'console state');
diagnostics = replaceOnce(diagnostics,
`    this._nativeFetch = null;\n    this._fetchWrapper = null;`,
`    this._nativeFetch = null;\n    this._fetchWrapper = null;\n    this._consoleOriginals = null;`, 'console originals');
diagnostics = replaceOnce(diagnostics,
`    this._installFetchTelemetry();\n    this._restartTimer();`,
`    this._installFetchTelemetry();\n    this._installConsoleTelemetry();\n    this._restartTimer();`, 'console install');
diagnostics = replaceOnce(diagnostics,
`    this._restoreFetchTelemetry();\n  }`,
`    this._restoreFetchTelemetry();\n    this._restoreConsoleTelemetry();\n  }`, 'console restore');
const diagnosticsMethodsAnchor = `  getNetworkTelemetry() { return sanitize(this.networkEvents); }\n`;
const diagnosticsMethods = `${diagnosticsMethodsAnchor}\n  _recordConsole(level, args) {\n    const values = Array.from(args || []).slice(0, 8).map(value => value instanceof Error ? safeError(value) : sanitize(value));\n    this.consoleEvents.push({ at: isoNow(), level, values });\n    if (this.consoleEvents.length > MAX_CONSOLE_EVENTS) this.consoleEvents.splice(0, this.consoleEvents.length - MAX_CONSOLE_EVENTS);\n  }\n\n  _installConsoleTelemetry() {\n    if (this._consoleOriginals || !globalThis.console) return;\n    this._consoleOriginals = {};\n    for (const level of ['warn', 'error']) {\n      if (typeof console[level] !== 'function') continue;\n      const original = console[level];\n      this._consoleOriginals[level] = original;\n      console[level] = (...args) => { this._recordConsole(level, args); return original.apply(console, args); };\n    }\n  }\n\n  _restoreConsoleTelemetry() {\n    if (!this._consoleOriginals) return;\n    for (const [level, original] of Object.entries(this._consoleOriginals)) console[level] = original;\n    this._consoleOriginals = null;\n  }\n\n  getConsoleTelemetry(deep = true) {\n    const events = deep ? this.consoleEvents : this.consoleEvents.slice(-30);\n    return { total: this.consoleEvents.length, warnings: this.consoleEvents.filter(item => item.level === 'warn').length, errors: this.consoleEvents.filter(item => item.level === 'error').length, events: sanitize(events) };\n  }\n`;
diagnostics = replaceOnce(diagnostics, diagnosticsMethodsAnchor, diagnosticsMethods, 'console methods');
diagnostics = replaceOnce(diagnostics,
`        network: sanitize(this.networkEvents.slice(-24)),\n        subsystemProviders: await this._collectProviders(2),`,
`        network: sanitize(this.networkEvents.slice(-24)),\n        console: this.getConsoleTelemetry(false),\n        subsystemProviders: await this._collectProviders(2),`, 'L2 console');
diagnostics = replaceOnce(diagnostics,
`        network: sanitize(this.networkEvents),\n        subsystemProviders: await this._collectProviders(3),`,
`        network: sanitize(this.networkEvents),\n        console: this.getConsoleTelemetry(true),\n        subsystemProviders: await this._collectProviders(3),`, 'L3 console');
fs.writeFileSync('public/rift-diagnostics.js', diagnostics);

// Engine: texture format/material metadata + vertex submission count.
let engine = fs.readFileSync('public/rift-engine.js', 'utf8');
engine = replaceOnce(engine,
`this.textureInfo.set(texture,{id:'tex-'+this._resourceSequence++,width,height,srgb:Boolean(srgb),mipmapped:true,estimatedBytes:mipEstimateBytes(width,height)});return texture;`,
`this.textureInfo.set(texture,{id:'tex-'+this._resourceSequence++,width,height,srgb:Boolean(srgb),format:srgb?'SRGB8_ALPHA8':'RGBA8',mipmapped:true,estimatedBytes:mipEstimateBytes(width,height)});return texture;`, '2d texture format');
engine = replaceOnce(engine,
`const resource={texture,width:w,height:h,layers:depth,levels,srgb:Boolean(srgb),diagnosticId:'tex-array-'+this._resourceSequence++,estimatedBytes:mipEstimateBytes(w,h,depth)};`,
`const resource={texture,width:w,height:h,layers:depth,levels,srgb:Boolean(srgb),format:srgb?'SRGB8_ALPHA8':'RGBA8',mipmapped:levels>1,diagnosticId:'tex-array-'+this._resourceSequence++,estimatedBytes:mipEstimateBytes(w,h,depth)};`, 'array texture format');
engine = replaceOnce(engine,
`const renderStarted=performance.now();let drawCalls=0,triangles=0,indices=0,visibleMeshes=0;`,
`const renderStarted=performance.now();let drawCalls=0,triangles=0,indices=0,vertexBufferVertices=0,visibleMeshes=0;`, 'vertex frame counter');
engine = replaceOnce(engine,
`gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,mesh.indexType,0);drawCalls+=1;visibleMeshes+=1;indices+=mesh.count;triangles+=Math.floor(mesh.count/3)`,
`gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,mesh.indexType,0);drawCalls+=1;visibleMeshes+=1;indices+=mesh.count;vertexBufferVertices+=mesh.vertexCount||0;triangles+=Math.floor(mesh.count/3)`, 'vertex frame accumulation');
engine = replaceOnce(engine,
`this._telemetry.lastFrame={at:new Date().toISOString(),renderMs:performance.now()-renderStarted,drawCalls,visibleMeshes,triangles,indices};`,
`this._telemetry.lastFrame={at:new Date().toISOString(),renderMs:performance.now()-renderStarted,drawCalls,visibleMeshes,triangles,indices,vertexBufferVertices,vertexMetricNote:'Unique vertex records in buffers submitted by visible indexed meshes; exact post-transform GPU invocations are not exposed by WebGL.'};`, 'vertex frame telemetry');
engine = replaceOnce(engine,
`terrainMaterial:Boolean(mesh.terrainMaterial)}));`,
`terrainMaterial:Boolean(mesh.terrainMaterial),material:{baseColorFactor:[...mesh.baseColorFactor],tint:[...mesh.tint],textureId:textureLookup.get(mesh.texture)?.id||null,terrain:Boolean(mesh.terrainMaterial)}}));`, 'mesh material metadata');
engine = replaceOnce(engine,
`const textureArrays=[...this.textureArrays].map(resource=>({id:resource.diagnosticId,width:resource.width,height:resource.height,layers:resource.layers,levels:resource.levels,srgb:resource.srgb,estimatedBytes:resource.estimatedBytes}));`,
`const textureArrays=[...this.textureArrays].map(resource=>({id:resource.diagnosticId,width:resource.width,height:resource.height,layers:resource.layers,levels:resource.levels,srgb:resource.srgb,format:resource.format|| (resource.srgb?'SRGB8_ALPHA8':'RGBA8'),mipmapped:resource.mipmapped!==false,estimatedBytes:resource.estimatedBytes}));`, 'array inventory metadata');
fs.writeFileSync('public/rift-engine.js', engine);

// Native terrain: retain failed assert history for forensic dumps.
let terrain = fs.readFileSync('public/rift-terrain.js', 'utf8');
terrain = replaceOnce(terrain,
`const MEMORY = RiftCore.memory;\n`,
`const MEMORY = RiftCore.memory;\nconst NATIVE_FAILURES = [];\n`, 'native failure state');
terrain = replaceOnce(terrain,
`function assertNative(ok, message) {\n  if (!ok) throw new Error(message);\n}`,
`function assertNative(ok, message) {\n  if (ok) return;\n  const error = new Error(message);\n  NATIVE_FAILURES.push({ at: new Date().toISOString(), message: String(message || 'Native call failed'), stack: String(error.stack || '').slice(0, 8000) });\n  if (NATIVE_FAILURES.length > 64) NATIVE_FAILURES.splice(0, NATIVE_FAILURES.length - 64);\n  throw error;\n}`,'native failure capture');
terrain = replaceOnce(terrain,
`      functionCount: nativeFunctions.length,\n      ...(deep ? { exports: exportNames, nativeFunctions } : {})`,
`      functionCount: nativeFunctions.length,\n      failureCount: NATIVE_FAILURES.length,\n      lastFailure: NATIVE_FAILURES.at(-1) || null,\n      ...(deep ? { exports: exportNames, nativeFunctions, failures: [...NATIVE_FAILURES] } : {})`, 'native diagnostics failures');
fs.writeFileSync('public/rift-terrain.js', terrain);

// App: artifact hash + device/browser capability snapshot + console access API.
let app = fs.readFileSync('public/app.js', 'utf8');
app = replaceOnce(app,
`  network: () => diagnostics.getNetworkTelemetry(),\n  registerProvider:`,
`  network: () => diagnostics.getNetworkTelemetry(),\n  console: () => diagnostics.getConsoleTelemetry(true),\n  registerProvider:`, 'public console telemetry');
const resourceAnchor = `function resourceTimingDiagnostics() {\n  const entries = performance.getEntriesByType?.('resource') || [];\n  return entries.slice(-180).map(entry => ({ name: entry.name, initiatorType: entry.initiatorType, duration: entry.duration, startTime: entry.startTime, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, nextHopProtocol: entry.nextHopProtocol || null }));\n}\n`;
const resourceHelpers = `${resourceAnchor}\nasync function sha256Hex(buffer) {\n  if (!crypto?.subtle) return null;\n  const digest = await crypto.subtle.digest('SHA-256', buffer);\n  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');\n}\n\nasync function wasmArtifactDiagnostics() {\n  try {\n    const response = await fetch('/rift-core.wasm.gz', { cache: 'no-store' });\n    if (!response.ok) return { error: 'HTTP ' + response.status };\n    const bytes = await response.arrayBuffer();\n    return { url: response.url, compressedBytes: bytes.byteLength, sha256: await sha256Hex(bytes), fingerprintKind: 'sha256-compressed-artifact' };\n  } catch (error) { return { error: String(error?.message || error) }; }\n}\n\nfunction deviceCapabilityDiagnostics() {\n  return {\n    userAgent: navigator.userAgent, platform: navigator.platform || null, language: navigator.language, languages: navigator.languages || [],\n    hardwareConcurrency: navigator.hardwareConcurrency || null, deviceMemory: navigator.deviceMemory || null, maxTouchPoints: navigator.maxTouchPoints || 0, online: navigator.onLine,\n    pixelRatio: devicePixelRatio || 1, screen: { width: screen?.width || null, height: screen?.height || null, colorDepth: screen?.colorDepth || null, pixelDepth: screen?.pixelDepth || null },\n    secureContext: globalThis.isSecureContext, crossOriginIsolated: globalThis.crossOriginIsolated, webAssembly: typeof WebAssembly !== 'undefined',\n    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined', offscreenCanvas: typeof OffscreenCanvas !== 'undefined', decompressionStream: typeof DecompressionStream !== 'undefined', compressionStream: typeof CompressionStream !== 'undefined',\n    webGPU: Boolean(navigator.gpu), opfs: Boolean(navigator.storage?.getDirectory), cacheStorage: 'caches' in window, serviceWorker: 'serviceWorker' in navigator,\n    pointerCoarse: matchMedia?.('(pointer: coarse)')?.matches || false, hoverCapable: matchMedia?.('(hover: hover)')?.matches || false, reducedMotion: matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false\n  };\n}\n`;
app = replaceOnce(app, resourceAnchor, resourceHelpers, 'artifact/device helpers');
app = replaceOnce(app,
`  const [storage, cacheState, serviceWorker] = await Promise.all([storageDiagnostics(), cacheDiagnostics(), serviceWorkerDiagnostics()]);`,
`  const [storage, cacheState, serviceWorker, wasmArtifact] = await Promise.all([storageDiagnostics(), cacheDiagnostics(), serviceWorkerDiagnostics(), wasmArtifactDiagnostics()]);`, 'deep artifact load');
app = replaceOnce(app,
`    riftCore: { sourceManifest: coreSourceManifest, wasmResource: resources.find(entry => entry.name.includes('rift-core.wasm')) || null },\n    storage,`,
`    riftCore: { sourceManifest: coreSourceManifest, wasmResource: resources.find(entry => entry.name.includes('rift-core.wasm')) || null, artifact: wasmArtifact },\n    deviceCapabilities: deviceCapabilityDiagnostics(),\n    consoleTelemetry: diagnostics.getConsoleTelemetry(true),\n    storage,`, 'deep engine extras');
fs.writeFileSync('public/app.js', app);

// World contract describes completed black-box coverage.
let world = JSON.parse(fs.readFileSync('public/world/ironvale-terrain.json', 'utf8'));
world.diagnostics.blackBoxCompleteness = 'max-v1';
world.diagnostics.deepTelemetry = [
  'mesh-resource-material-inventory','gpu-memory-estimates','draw-triangle-index-vertex-stats','shader-compile-link-logs','webgl-error-history','context-loss-history',
  'wasm-abi-memory-exports-source-manifest-artifact-sha256','native-failure-history','frame-subsystem-timings','network-failures-timings','console-warning-error-history',
  'storage-quota-cache-service-worker','module-cache-versions','device-capabilities','asset-scene-provider-hooks'
];
fs.writeFileSync('public/world/ironvale-terrain.json', JSON.stringify(world, null, 2) + '\n');

// Verification contract.
let check = fs.readFileSync('scripts/check-core.js', 'utf8');
const nativeAnchor = `if (!terrain.includes('NATIVE.rift_terrain_raycast')) failures.push('native terrain raycast missing');`;
check = replaceOnce(check, nativeAnchor, `${nativeAnchor}\nif (!terrain.includes('NATIVE_FAILURES') || !terrain.includes('failureCount: NATIVE_FAILURES.length')) failures.push('native failure history diagnostics');`, 'native verifier');
const diagnosticsAnchor = `if (!diagnosticsRuntime.includes('class RiftDiagnostics') || !diagnosticsRuntime.includes('automatic-crash') || !diagnosticsRuntime.includes('l1Quick') || !diagnosticsRuntime.includes('l2Runtime') || !diagnosticsRuntime.includes('l3Deep') || !diagnosticsRuntime.includes('credentialsIncluded: false')) failures.push('three-layer sanitized diagnostics runtime');`;
check = replaceOnce(check, diagnosticsAnchor, `${diagnosticsAnchor}\nif (!diagnosticsRuntime.includes('getConsoleTelemetry(') || !diagnosticsRuntime.includes('_installConsoleTelemetry(')) failures.push('console warning/error telemetry');\nif (!renderer.includes('vertexBufferVertices') || !renderer.includes("format:srgb?'SRGB8_ALPHA8':'RGBA8'")) failures.push('renderer vertex/texture-format telemetry');\nif (!app.includes('wasmArtifactDiagnostics()') || !app.includes('deviceCapabilityDiagnostics()') || !app.includes('consoleTelemetry: diagnostics.getConsoleTelemetry(true)')) failures.push('deep artifact/device/console telemetry');\nif (world.diagnostics?.blackBoxCompleteness !== 'max-v1' || !world.diagnostics?.deepTelemetry?.includes('native-failure-history')) failures.push('max black-box diagnostics world contract');`, 'max blackbox verifier');
check = check.replace('Ironvale core verified: RiftLandscape + meter scale contract + silent automated validator + three-layer diagnostic dumps + C++/WASM terrain + RPG runtime.', 'Ironvale core verified: RiftLandscape + C++/WASM terrain + RPG runtime + max three-layer engine black-box diagnostics.');
fs.writeFileSync('scripts/check-core.js', check);

console.log('Applied final max engine black-box telemetry gaps.');
