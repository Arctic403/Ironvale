import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function mustReplace(text, find, replace, label){
  if(!text.includes(find)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(find, replace);
}
function functionSlice(source, signature){
  const start=source.indexOf(signature);
  if(start<0) throw new Error(`Missing function: ${signature}`);
  const brace=source.indexOf('{',start);
  let depth=0, quote=null, template=false, escape=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i], prev=source[i-1];
    if(escape){escape=false;continue;}
    if(quote){if(ch==='\\'){escape=true;continue;} if(ch===quote){quote=null;} continue;}
    if(template){if(ch==='\\'){escape=true;continue;} if(ch==='`'){template=false;} continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='`'){template=true;continue;}
    if(ch==='{') depth++;
    else if(ch==='}' && --depth===0) return {start,end:i+1,text:source.slice(start,i+1)};
  }
  throw new Error(`Unclosed function: ${signature}`);
}
function replaceFunction(source, signature, replacement){const s=functionSlice(source,signature);return source.slice(0,s.start)+replacement+source.slice(s.end);}

let app=read('public/app.js');
let terrain=read('public/rift-terrain.js');
let landscape=read('public/rift-landscape.js');
let validator=read('public/rift-validator-guard.js');
let index=read('public/index.html');

app=mustReplace(app,"import { RiftLandscape } from './rift-landscape.js?v=20260901-terrain-lock-r1';","import { RiftLandscape } from './rift-landscape.js?v=20260901-terrain-profiler-r1';",'app landscape cache');
app=mustReplace(app,"const APP_DIAGNOSTIC_BUILD = '20260901-sprint-speed-r2';","const APP_DIAGNOSTIC_BUILD = '20260901-terrain-profiler-r1';",'app build');
app=mustReplace(app,
"const diagnosticFrameTimings = { sampleEveryFrames: 15, samples: 0, movementMs: 0, animationMs: 0, cameraMs: 0, terrainLodMs: 0, reticleMs: 0, renderMs: 0, totalMs: 0, maxTotalMs: 0 };\nconst combatTargets = new Map();",
`const diagnosticFrameTimings = { sampleEveryFrames: 15, samples: 0, movementMs: 0, animationMs: 0, cameraMs: 0, terrainLodMs: 0, reticleMs: 0, renderMs: 0, totalMs: 0, maxTotalMs: 0 };
const TERRAIN_EDIT_PERF_FORMAT = 'ironvale-terrain-edit-performance-v1';
const TERRAIN_EDIT_SAMPLE_LIMIT = 256;
const terrainEditSamples = [];
let terrainEditSequence = 0;
const combatTargets = new Map();

function terrainEditRound(value) { return Math.round((Math.max(0, Number(value) || 0) + Number.EPSILON) * 1000) / 1000; }
function terrainEditPercentile(values, percentile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return terrainEditRound(sorted[index]);
}
function recordTerrainEditSample(sample = {}) {
  const normalized = {
    sequence: ++terrainEditSequence,
    at: new Date().toISOString(),
    mode: String(sample.mode || 'unknown'),
    continuous: Boolean(sample.continuous),
    radius: Number(sample.radius) || 0,
    mutationMs: terrainEditRound(sample.mutationMs),
    nativeMeshBuildMs: terrainEditRound(sample.nativeMeshBuildMs),
    meshCopyMs: terrainEditRound(sample.meshCopyMs),
    meshBuildWallMs: terrainEditRound(sample.meshBuildWallMs),
    gpuUploadSubmitMs: terrainEditRound(sample.gpuUploadSubmitMs),
    visibilityMs: terrainEditRound(sample.visibilityMs),
    totalMs: terrainEditRound(sample.totalMs),
    dirtySections: Math.max(0, Math.trunc(Number(sample.dirtySections) || 0)),
    rebuiltSections: Math.max(0, Math.trunc(Number(sample.rebuiltSections) || 0)),
    skippedUnstreamedSections: Math.max(0, Math.trunc(Number(sample.skippedUnstreamedSections) || 0)),
    vertexBytes: Math.max(0, Math.trunc(Number(sample.vertexBytes) || 0)),
    indexBytes: Math.max(0, Math.trunc(Number(sample.indexBytes) || 0)),
    bytesUploaded: Math.max(0, Math.trunc(Number(sample.bytesUploaded) || 0))
  };
  terrainEditSamples.push(normalized);
  if (terrainEditSamples.length > TERRAIN_EDIT_SAMPLE_LIMIT) terrainEditSamples.splice(0, terrainEditSamples.length - TERRAIN_EDIT_SAMPLE_LIMIT);
  return normalized;
}
function terrainEditPerformanceStatus(deep = false) {
  const metrics = ['totalMs','mutationMs','nativeMeshBuildMs','meshCopyMs','meshBuildWallMs','gpuUploadSubmitMs','visibilityMs'];
  const percentiles = {};
  for (const metric of metrics) {
    const values = terrainEditSamples.map(sample => Number(sample[metric]) || 0);
    percentiles[metric] = { p50: terrainEditPercentile(values, 50), p95: terrainEditPercentile(values, 95), p99: terrainEditPercentile(values, 99), max: terrainEditRound(values.length ? Math.max(...values) : 0) };
  }
  const totals = terrainEditSamples.reduce((out, sample) => {
    out.dirtySections += sample.dirtySections; out.rebuiltSections += sample.rebuiltSections; out.skippedUnstreamedSections += sample.skippedUnstreamedSections;
    out.vertexBytes += sample.vertexBytes; out.indexBytes += sample.indexBytes; out.bytesUploaded += sample.bytesUploaded;
    return out;
  }, { dirtySections: 0, rebuiltSections: 0, skippedUnstreamedSections: 0, vertexBytes: 0, indexBytes: 0, bytesUploaded: 0 });
  return {
    format: TERRAIN_EDIT_PERF_FORMAT,
    sampleCount: terrainEditSamples.length,
    sampleLimit: TERRAIN_EDIT_SAMPLE_LIMIT,
    continuousBrushIntervalMs: CONTINUOUS_BRUSH_MS,
    last: terrainEditSamples.at(-1) || null,
    percentiles,
    totals,
    instrumentation: {
      nativeMutation: true,
      nativeMeshBuild: true,
      wasmToJsCopy: true,
      gpuUploadSubmission: true,
      dirtySections: true,
      bytesUploaded: true,
      note: 'gpuUploadSubmitMs measures CPU-side WebGL buffer upload submission, not completed GPU execution time.'
    },
    ...(deep ? { recent: terrainEditSamples.slice(-64) } : {})
  };
}`,
'profiler state');

app=mustReplace(app,"diagnostics.registerProvider('movement-mode', () => movementModeStatus());","diagnostics.registerProvider('movement-mode', () => movementModeStatus());\ndiagnostics.registerProvider('terrain-edit-performance', level => terrainEditPerformanceStatus(level >= 3));",'profiler provider');
app=mustReplace(app,"    diagnosticCheck('player.movement-mode', Boolean(sprintButton) && typeof window.IronvaleMovementMode?.status === 'function', `walk ${WALK_SPEED_MPS}m/s · sprint ${SPRINT_SPEED_MPS}m/s · auto-run hold ${AUTO_RUN_HOLD_MS}ms`)","    diagnosticCheck('player.movement-mode', Boolean(sprintButton) && typeof window.IronvaleMovementMode?.status === 'function', `walk ${WALK_SPEED_MPS}m/s · sprint ${SPRINT_SPEED_MPS}m/s · auto-run hold ${AUTO_RUN_HOLD_MS}ms`),\n    diagnosticCheck('terrain.edit-profiler', typeof terrainEditPerformanceStatus === 'function', `${terrainEditSamples.length} terrain edit timing sample(s) captured`)",'profiler validator check');
app=mustReplace(app,"      rig: playerRig ? { renderHeight: playerRig.renderHeight, renderScale: playerRig.renderScale, feetAtY: playerRig.feetAtY, jointCount: playerRig.jointCount, animationClipCount: playerRig.animationClipCount, authoredForward: playerRig.authoredForward } : null","      rig: playerRig ? { renderHeight: playerRig.renderHeight, renderScale: playerRig.renderScale, feetAtY: playerRig.feetAtY, jointCount: playerRig.jointCount, animationClipCount: playerRig.animationClipCount, authoredForward: playerRig.authoredForward, defaultClips: playerRig.defaultClips ? { ...playerRig.defaultClips } : null } : null",'character default clips telemetry');
app=mustReplace(app,"    performance: { averageFrameMs: terrainPerfAverageMs, approximateFps: terrainPerfAverageMs > 0 ? 1000 / terrainPerfAverageMs : null, mobileLandscape: isMobileLandscapeGameplay(), subsystemTimings: { ...diagnosticFrameTimings } },","    performance: { averageFrameMs: terrainPerfAverageMs, approximateFps: terrainPerfAverageMs > 0 ? 1000 / terrainPerfAverageMs : null, mobileLandscape: isMobileLandscapeGameplay(), subsystemTimings: { ...diagnosticFrameTimings }, terrainEdit: terrainEditPerformanceStatus(false) },",'runtime profiler snapshot');
app=mustReplace(app,"    targeting: { registeredTargets: combatTargets.size, selectedTargetId, hardLockEnabled },","    targeting: { registeredTargets: combatTargets.size, selectedTargetId, hardLockEnabled },\n    terrainEditPerformance: terrainEditPerformanceStatus(true),",'deep profiler snapshot');
app=mustReplace(app,"  diagnosticFrameCounter = 0;\n  for (const key of Object.keys(diagnosticFrameTimings))","  diagnosticFrameCounter = 0;\n  terrainEditSamples.length = 0;\n  terrainEditSequence = 0;\n  for (const key of Object.keys(diagnosticFrameTimings))",'profiler reset');

const buildTerrainSection = `function buildTerrainSection(section, plan = terrainLodPlan, force = false) {
  if (!engine || !terrain || !section) return { built: false };
  const key = section.key;
  const neighbors = terrain.sectionNeighborLods(plan, section.sectionX, section.sectionZ, section.lodStep);
  const signature = sectionSignature(section, neighbors);
  const existing = terrainMeshes.get(key);
  if (!force && existing?.signature === signature) return { built: false };

  const geometryStarted = performance.now();
  const entry = terrain.buildSurfaceSectionGeometry(section.sectionX, section.sectionZ, section.lodStep, neighbors);
  const meshBuildWallMs = performance.now() - geometryStarted;
  const geometry = entry.geometry || entry;
  const vertexBytes = Number(geometry?.vertices?.byteLength) || 0;
  const indexBytes = Number(geometry?.indices?.byteLength) || 0;
  const uploadStarted = performance.now();
  if (existing?.mesh) {
    engine.updateMesh(existing.mesh, geometry);
    terrainMaterialRuntime?.attach(existing.mesh);
    existing.lodStep = section.lodStep;
    existing.signature = signature;
    existing.componentId = section.componentId;
    existing.triangles = Number(entry.triangles) || 0;
  } else {
    const mesh = engine.addMesh(geometry, { kind: 'terrain', label: key, terrainMaterial: terrainMaterialRuntime?.material || null });
    terrainMeshes.set(key, { mesh, lodStep: section.lodStep, signature, componentId: section.componentId, triangles: Number(entry.triangles) || 0 });
  }
  const gpuUploadSubmitMs = performance.now() - uploadStarted;
  return {
    built: true,
    nativeMeshBuildMs: Number(entry.buildTelemetry?.nativeBuildMs) || 0,
    meshCopyMs: Number(entry.buildTelemetry?.copyMs) || 0,
    meshBuildWallMs,
    gpuUploadSubmitMs,
    vertexBytes,
    indexBytes,
    bytesUploaded: vertexBytes + indexBytes
  };
}`;
app=replaceFunction(app,'function buildTerrainSection(',buildTerrainSection);

const rebuildDirty = `function rebuildDirtyTerrainSections() {
  const profile = { dirtySections: 0, rebuiltSections: 0, skippedUnstreamedSections: 0, nativeMeshBuildMs: 0, meshCopyMs: 0, meshBuildWallMs: 0, gpuUploadSubmitMs: 0, visibilityMs: 0, vertexBytes: 0, indexBytes: 0, bytesUploaded: 0 };
  if (!engine || !terrain) return profile;
  if (!terrainLodPlan.size) terrainLodPlan = terrain.planSectionLods(player.x, player.z);
  if (!terrainStreamPlan) refreshTerrainStreamPlan(player.x, player.z);
  const dirty = terrain.consumeDirtySections();
  profile.dirtySections = dirty.length;
  for (const key of dirty) {
    const section = terrainLodPlan.get(key);
    if (!section || !sectionIsStreamed(section)) { profile.skippedUnstreamedSections += 1; continue; }
    const built = buildTerrainSection(section, terrainLodPlan, true) || {};
    if (!built.built) continue;
    profile.rebuiltSections += 1;
    for (const metric of ['nativeMeshBuildMs','meshCopyMs','meshBuildWallMs','gpuUploadSubmitMs']) profile[metric] += Number(built[metric]) || 0;
    profile.vertexBytes += Number(built.vertexBytes) || 0;
    profile.indexBytes += Number(built.indexBytes) || 0;
    profile.bytesUploaded += Number(built.bytesUploaded) || 0;
  }
  const visibilityStarted = performance.now();
  updateTerrainMeshVisibility();
  profile.visibilityMs = performance.now() - visibilityStarted;
  return profile;
}`;
app=replaceFunction(app,'function rebuildDirtyTerrainSections(',rebuildDirty);

const applyBrush = `function applyBrushAtReticle(strengthScale = 1, flattenY = null, saveImmediately = false) {
  if (!terrain || !reticleHit) return;
  const stampStarted = performance.now();
  const radius = Number(radiusInput.value);
  const strength = Number(strengthInput.value) * strengthScale;
  let mutationMs = 0;
  let rebuild = null;
  const continuous = !saveImmediately && Boolean(gesture?.mode === 'sculpt');

  if (brushMode === 'paint' || brushMode === 'erase-material') {
    const mutationStarted = performance.now();
    const painted = terrain.paintMaterial?.({ layerId: terrain.activeMaterialLayerId, x: reticleHit.x, z: reticleHit.z, radius, strength: Math.min(1, Math.max(0.01, strength * 0.35)), erase: brushMode === 'erase-material' });
    mutationMs = performance.now() - mutationStarted;
    if (!painted) return;
    rebuild = rebuildDirtyTerrainSections();
    updateReticleTarget();
    const sample = recordTerrainEditSample({ mode: brushMode, continuous, radius, mutationMs, ...rebuild, totalMs: performance.now() - stampStarted });
    if (saveImmediately) saveDraftSilently();
    terrainStatus.textContent = `RiftLandscape · ${terrain.activeMaterialLayer?.name || 'Material'} ${brushMode === 'erase-material' ? 'erase' : 'paint'} · edit ${terrain.revision} · ${lodSummary() || 'adaptive LOD'} · edit ${sample.totalMs.toFixed(1)}ms`;
    return;
  }

  const brush = { mode: brushMode, x: reticleHit.x, z: reticleHit.z, radius, strength };
  if (brushMode === 'flatten') brush.targetHeight = Number.isFinite(flattenY) ? flattenY : reticleHit.y;
  const mutationStarted = performance.now();
  terrain.applyBrush(brush);
  mutationMs = performance.now() - mutationStarted;
  rebuild = rebuildDirtyTerrainSections();
  snapPlayerToSupport();
  updateReticleTarget();
  const sample = recordTerrainEditSample({ mode: brushMode, continuous, radius, mutationMs, ...rebuild, totalMs: performance.now() - stampStarted });
  if (saveImmediately) saveDraftSilently();
  terrainStatus.textContent = `RiftLandscape · ${terrain.activeEditLayer?.name || 'Sculpt'} · edit ${terrain.revision} · ${lodSummary() || 'adaptive LOD'} · edit ${sample.totalMs.toFixed(1)}ms`;
}`;
app=replaceFunction(app,'function applyBrushAtReticle(',applyBrush);

let sectionFn=functionSlice(terrain,'  buildSurfaceSectionGeometry(');
let sectionText=sectionFn.text;
sectionText=mustReplace(sectionText,"    const ok = NATIVE.rift_terrain_build_section","    const nativeBuildStarted = performance.now();\n    const ok = NATIVE.rift_terrain_build_section",'native mesh timer start');
sectionText=mustReplace(sectionText,"    assertNative(ok, `RiftCore could not build terrain section ${sectionX}:${sectionZ}.`);","    assertNative(ok, `RiftCore could not build terrain section ${sectionX}:${sectionZ}.`);\n    const nativeBuildMs = performance.now() - nativeBuildStarted;\n    const copyStarted = performance.now();",'native mesh timer end');
sectionText=mustReplace(sectionText,"    const indices = vertexCount > 65535 ? new Uint32Array(indexView) : Uint16Array.from(indexView);\n    return {","    const indices = vertexCount > 65535 ? new Uint32Array(indexView) : Uint16Array.from(indexView);\n    const copyMs = performance.now() - copyStarted;\n    return {\n      buildTelemetry: { nativeBuildMs, copyMs, vertexBytes: vertices.byteLength, indexBytes: indices.byteLength },",'copy timer');
terrain=terrain.slice(0,sectionFn.start)+sectionText+terrain.slice(sectionFn.end);

landscape=mustReplace(landscape,"import { RiftTerrain } from './rift-terrain.js?v=20260831-landscape-v2';","import { RiftTerrain } from './rift-terrain.js?v=20260901-terrain-profiler-r1';",'landscape terrain cache');

validator=mustReplace(validator,
"  const expectedSections = Number(stats.surfaceSections) || 0;\n  const meshes = Number(runtime.terrain?.meshCount) || 0;\n  const lodPlan = Number(runtime.terrain?.lodPlanSize) || 0;\n  if (expectedSections) checks.push(passFail('terrain.section-coverage', meshes === expectedSections && lodPlan === expectedSections, `${meshes}/${expectedSections} meshes · ${lodPlan}/${expectedSections} LOD entries`));",
`  const expectedSections = Number(stats.surfaceSections) || 0;
  const meshes = Number(runtime.terrain?.meshCount) || 0;
  const lodPlan = Number(runtime.terrain?.lodPlanSize) || 0;
  const renderedComponents = Array.isArray(runtime.terrain?.streamPlan?.render) ? runtime.terrain.streamPlan.render.length : 0;
  const sectionsPerComponent = Math.max(1, Number(stats.sectionsPerComponent) || 1);
  const expectedStreamedMeshes = renderedComponents > 0 ? Math.min(expectedSections, renderedComponents * sectionsPerComponent * sectionsPerComponent) : expectedSections;
  if (expectedSections) {
    const coverageOk = lodPlan === expectedSections && meshes === expectedStreamedMeshes;
    checks.push(passFail('terrain.section-coverage', coverageOk, `${meshes}/${expectedStreamedMeshes} streamed meshes · ${lodPlan}/${expectedSections} LOD entries · ${renderedComponents || 'all'} render component(s)`));
  }`,
'stream-aware coverage');

index=index.replace('/app.js?v=20260901-sprint-speed-r2','/app.js?v=20260901-terrain-profiler-r1');
index=index.replace('/rift-validator-guard.js?v=20260901-sprint-speed-r2','/rift-validator-guard.js?v=20260901-terrain-profiler-r1');

const checker=`import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('public/app.js'), terrain=read('public/rift-terrain.js'), validator=read('public/rift-validator-guard.js'), index=read('public/index.html');
const assert=(ok,msg)=>{if(!ok)throw new Error('Terrain edit profiler check failed: '+msg)};
for(const token of ['ironvale-terrain-edit-performance-v1','terrain-edit-performance','nativeMeshBuildMs','meshCopyMs','gpuUploadSubmitMs','bytesUploaded','terrainEditPerformanceStatus']) assert(app.includes(token),'app missing '+token);
assert(terrain.includes('buildTelemetry: { nativeBuildMs, copyMs'),'native build/copy telemetry missing');
assert(validator.includes('expectedStreamedMeshes')&&validator.includes('streamed meshes'),'stream-aware terrain coverage missing');
assert(app.includes('defaultClips: playerRig.defaultClips'),'character default clip telemetry missing');
assert(index.includes('/app.js?v=20260901-terrain-profiler-r1'),'app cache bust missing');
console.log('Ironvale terrain edit profiler verification passed.');
`;
write('scripts/check-terrain-edit-profiler.mjs',checker);

write('public/app.js',app);
write('public/rift-terrain.js',terrain);
write('public/rift-landscape.js',landscape);
write('public/rift-validator-guard.js',validator);
write('public/index.html',index);
console.log('Terrain profiler patch applied.');
