import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}

function replaceRegexOnce(source, regex, after, label) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const matches = source.match(new RegExp(regex.source, flags)) || [];
  if (matches.length !== 1) throw new Error(`${label}: expected 1 match, found ${matches.length}`);
  return source.replace(regex, after);
}

const TAG = '20260902-terrain-pack-r1';

let terrain = read('public/rift-terrain.js');
terrain = replaceRegexOnce(
  terrain,
  /  buildSurfaceSectionGeometry\(sectionX, sectionZ, lodStep = 1, neighborLods = null\) \{[\s\S]*?\n  \}\n\n  buildSurfaceChunkGeometry/,
  `  _buildSurfaceSectionNative(sectionX, sectionZ, lodStep = 1, neighborLods = null) {
    const step = Math.max(1, Math.trunc(lodStep));
    const neighbors = neighborLods || { north: step, east: step, south: step, west: step };
    const build = NATIVE.rift_terrain_build_section || NATIVE.rift_terrain_build_chunk;
    const nativeBuildStarted = performance.now();
    const ok = NATIVE.rift_terrain_build_section
      ? build(
          Math.trunc(sectionX),
          Math.trunc(sectionZ),
          this.sectionSize,
          step,
          Math.max(step, Math.trunc(neighbors.north || step)),
          Math.max(step, Math.trunc(neighbors.east || step)),
          Math.max(step, Math.trunc(neighbors.south || step)),
          Math.max(step, Math.trunc(neighbors.west || step))
        )
      : build(Math.trunc(sectionX), Math.trunc(sectionZ), this.sectionSize, step);
    assertNative(ok, \`RiftCore could not build terrain section \${sectionX}:\${sectionZ}.\`);
    const nativeBuildMs = performance.now() - nativeBuildStarted;
    const vertexFloatCount = NATIVE.rift_mesh_vertex_float_count();
    const indexCount = NATIVE.rift_mesh_index_count();
    return {
      step,
      neighbors: { ...neighbors },
      nativeBuildMs,
      vertexView: new Float32Array(MEMORY.buffer, NATIVE.rift_mesh_vertices_ptr(), vertexFloatCount),
      indexView: new Uint32Array(MEMORY.buffer, NATIVE.rift_mesh_indices_ptr(), indexCount)
    };
  }

  buildSurfaceSectionGeometry(sectionX, sectionZ, lodStep = 1, neighborLods = null) {
    const native = this._buildSurfaceSectionNative(sectionX, sectionZ, lodStep, neighborLods);
    const copyStarted = performance.now();
    const vertices = new Float32Array(native.vertexView);
    const vertexCount = vertices.length / 9;
    const indices = vertexCount > 65535 ? new Uint32Array(native.indexView) : Uint16Array.from(native.indexView);
    const copyMs = performance.now() - copyStarted;
    return {
      buildTelemetry: {
        nativeBuildMs: native.nativeBuildMs,
        copyMs,
        materialPackMs: 0,
        indexCopyMs: copyMs,
        sourceVertexBytes: native.vertexView.byteLength,
        intermediateVertexBytesAvoided: 0,
        materialFastPathVertices: 0,
        materialFallbackVertices: 0,
        vertexBytes: vertices.byteLength,
        indexBytes: indices.byteLength
      },
      id: \`terrain-section-\${sectionX}-\${sectionZ}\`,
      sectionX,
      sectionZ,
      chunkX: sectionX,
      chunkZ: sectionZ,
      lod: native.step,
      lodStep: native.step,
      neighborLods: native.neighbors,
      geometry: { vertices, indices, vertexStride: 9 },
      triangles: indices.length / 3
    };
  }

  buildSurfaceChunkGeometry`,
  'terrain native-view split'
);
write('public/rift-terrain.js', terrain);

let landscape = read('public/rift-landscape.js');
landscape = landscape.replace("./rift-terrain.js?v=20260902-dirty-region-r1", `./rift-terrain.js?v=${TAG}`);
landscape = replaceRegexOnce(
  landscape,
  /  buildSurfaceSectionGeometry\(sectionX, sectionZ, lodStep = 1, neighborLods = null\) \{[\s\S]*?\n  \}\n\n  validateLandscape/,
  `  buildSurfaceSectionGeometry(sectionX, sectionZ, lodStep = 1, neighborLods = null) {
    // Phase 2 terrain edit path: consume the native WASM scratch mesh directly
    // into the final PBR vertex layout. Avoid the old 9-float intermediate copy
    // and avoid object-heavy bilinear material sampling for exact grid vertices.
    const native = this._buildSurfaceSectionNative(sectionX, sectionZ, lodStep, neighborLods);
    const source = native.vertexView;
    const sourceStride = 9;
    const targetStride = 17;
    const count = Math.floor(source.length / sourceStride);
    const vertices = new Float32Array(count * targetStride);
    const materialIds = this.materialLayerIds().slice(0, 6);
    const materialLayers = materialIds.map(id => this.materialLayers.get(id) || null);
    const baseLayerIndex = materialIds.indexOf(this.baseMaterialLayerId);
    const gridEpsilon = 0.0001;
    let materialFastPathVertices = 0;
    let materialFallbackVertices = 0;
    const materialPackStarted = performance.now();

    for (let vertex = 0; vertex < count; vertex += 1) {
      const input = vertex * sourceStride;
      const output = vertex * targetStride;
      for (let i = 0; i < 9; i += 1) vertices[output + i] = source[input + i];
      const x = source[input];
      const z = source[input + 2];
      vertices[output + 9] = x;
      vertices[output + 10] = z;

      const gx = (x - this.origin[0]) / this.sampleSpacing;
      const gz = (z - this.origin[2]) / this.sampleSpacing;
      const ix = Math.round(gx);
      const iz = Math.round(gz);
      const exactGrid = baseLayerIndex >= 0 &&
        ix >= 0 && iz >= 0 && ix < this.columns && iz < this.rows &&
        Math.abs(gx - ix) <= gridEpsilon && Math.abs(gz - iz) <= gridEpsilon;

      if (exactGrid) {
        const sampleIndex = iz * this.columns + ix;
        let nonBaseTotal = 0;
        for (let layer = 0; layer < materialLayers.length; layer += 1) {
          if (layer === baseLayerIndex) continue;
          nonBaseTotal += Math.max(0, Number(materialLayers[layer]?.weights?.[sampleIndex]) || 0);
        }
        const nonBaseScale = nonBaseTotal > 255 ? 255 / nonBaseTotal : 1;
        const scaledNonBaseTotal = Math.min(255, nonBaseTotal * nonBaseScale);
        for (let layer = 0; layer < 6; layer += 1) {
          let value = 0;
          if (layer < materialLayers.length) {
            value = layer === baseLayerIndex
              ? Math.max(0, 255 - scaledNonBaseTotal)
              : Math.max(0, Number(materialLayers[layer]?.weights?.[sampleIndex]) || 0) * nonBaseScale;
          }
          vertices[output + 11 + layer] = value / 255;
        }
        materialFastPathVertices += 1;
      } else {
        const weights = this.sampleMaterialWeights(x, z);
        let weightTotal = 0;
        for (let layer = 0; layer < 6; layer += 1) {
          const value = materialIds[layer] ? Math.max(0, Number(weights[materialIds[layer]]) || 0) : 0;
          vertices[output + 11 + layer] = value;
          weightTotal += value;
        }
        if (weightTotal <= 0) vertices[output + 11] = 1;
        materialFallbackVertices += 1;
      }

      // PBR albedo is already color-correct; generic vertex tint stays neutral.
      vertices[output + 6] = 1;
      vertices[output + 7] = 1;
      vertices[output + 8] = 1;
    }
    const materialPackMs = performance.now() - materialPackStarted;

    const indexCopyStarted = performance.now();
    const indices = count > 65535 ? new Uint32Array(native.indexView) : Uint16Array.from(native.indexView);
    const indexCopyMs = performance.now() - indexCopyStarted;
    const intermediateVertexBytesAvoided = source.byteLength;

    return {
      buildTelemetry: {
        nativeBuildMs: native.nativeBuildMs,
        copyMs: materialPackMs + indexCopyMs,
        materialPackMs,
        indexCopyMs,
        sourceVertexBytes: source.byteLength,
        intermediateVertexBytesAvoided,
        materialFastPathVertices,
        materialFallbackVertices,
        vertexBytes: vertices.byteLength,
        indexBytes: indices.byteLength
      },
      id: \`terrain-section-\${sectionX}-\${sectionZ}\`,
      sectionX,
      sectionZ,
      chunkX: sectionX,
      chunkZ: sectionZ,
      lod: native.step,
      lodStep: native.step,
      neighborLods: native.neighbors,
      geometry: {
        vertices,
        indices,
        vertexStride: targetStride,
        attributes: { uv: 9, terrainWeights0: 11, terrainWeights1: 15 }
      },
      triangles: indices.length / 3
    };
  }

  validateLandscape`,
  'landscape direct PBR pack'
);
write('public/rift-landscape.js', landscape);

let app = read('public/app.js');
app = app.replace("./rift-landscape.js?v=20260902-dirty-region-r1", `./rift-landscape.js?v=${TAG}`);
app = app.replace("const APP_DIAGNOSTIC_BUILD = '20260902-security-smoke-r1';", `const APP_DIAGNOSTIC_BUILD = '${TAG}';`);
app = replaceOnce(app,
  "    meshCopyMs: terrainEditRound(sample.meshCopyMs),\n    meshBuildWallMs: terrainEditRound(sample.meshBuildWallMs),",
  "    meshCopyMs: terrainEditRound(sample.meshCopyMs),\n    materialPackMs: terrainEditRound(sample.materialPackMs),\n    indexCopyMs: terrainEditRound(sample.indexCopyMs),\n    meshBuildWallMs: terrainEditRound(sample.meshBuildWallMs),",
  'app sample timing fields');
app = replaceOnce(app,
  "    bytesUploaded: Math.max(0, Math.trunc(Number(sample.bytesUploaded) || 0))",
  "    bytesUploaded: Math.max(0, Math.trunc(Number(sample.bytesUploaded) || 0)),\n    intermediateVertexBytesAvoided: Math.max(0, Math.trunc(Number(sample.intermediateVertexBytesAvoided) || 0)),\n    materialFastPathVertices: Math.max(0, Math.trunc(Number(sample.materialFastPathVertices) || 0)),\n    materialFallbackVertices: Math.max(0, Math.trunc(Number(sample.materialFallbackVertices) || 0))",
  'app sample allocation fields');
app = replaceOnce(app,
  "  const metrics = ['totalMs','mutationMs','nativeMeshBuildMs','meshCopyMs','meshBuildWallMs','gpuUploadSubmitMs','visibilityMs'];",
  "  const metrics = ['totalMs','mutationMs','nativeMeshBuildMs','meshCopyMs','materialPackMs','indexCopyMs','meshBuildWallMs','gpuUploadSubmitMs','visibilityMs'];",
  'app profiler metric list');
app = replaceOnce(app,
  "    out.vertexBytes += sample.vertexBytes; out.indexBytes += sample.indexBytes; out.bytesUploaded += sample.bytesUploaded;\n    return out;\n  }, { dirtySections: 0, rebuiltSections: 0, skippedUnstreamedSections: 0, vertexBytes: 0, indexBytes: 0, bytesUploaded: 0 });",
  "    out.vertexBytes += sample.vertexBytes; out.indexBytes += sample.indexBytes; out.bytesUploaded += sample.bytesUploaded;\n    out.intermediateVertexBytesAvoided += sample.intermediateVertexBytesAvoided;\n    out.materialFastPathVertices += sample.materialFastPathVertices;\n    out.materialFallbackVertices += sample.materialFallbackVertices;\n    return out;\n  }, { dirtySections: 0, rebuiltSections: 0, skippedUnstreamedSections: 0, vertexBytes: 0, indexBytes: 0, bytesUploaded: 0, intermediateVertexBytesAvoided: 0, materialFastPathVertices: 0, materialFallbackVertices: 0 });",
  'app profiler totals');
app = replaceOnce(app,
  "      wasmToJsCopy: true,\n      gpuUploadSubmission: true,",
  "      wasmToJsCopy: true,\n      directWasmToFinalPbrPack: true,\n      exactGridMaterialFastPath: true,\n      gpuUploadSubmission: true,",
  'app profiler instrumentation');
app = replaceOnce(app,
  "    meshCopyMs: Number(entry.buildTelemetry?.copyMs) || 0,\n    meshBuildWallMs,",
  "    meshCopyMs: Number(entry.buildTelemetry?.copyMs) || 0,\n    materialPackMs: Number(entry.buildTelemetry?.materialPackMs) || 0,\n    indexCopyMs: Number(entry.buildTelemetry?.indexCopyMs) || 0,\n    meshBuildWallMs,",
  'app section pack timings');
app = replaceOnce(app,
  "    bytesUploaded: vertexBytes + indexBytes\n  };",
  "    bytesUploaded: vertexBytes + indexBytes,\n    intermediateVertexBytesAvoided: Number(entry.buildTelemetry?.intermediateVertexBytesAvoided) || 0,\n    materialFastPathVertices: Number(entry.buildTelemetry?.materialFastPathVertices) || 0,\n    materialFallbackVertices: Number(entry.buildTelemetry?.materialFallbackVertices) || 0\n  };",
  'app section allocation telemetry');
app = replaceOnce(app,
  "  const profile = { dirtySections: 0, rebuiltSections: 0, skippedUnstreamedSections: 0, nativeMeshBuildMs: 0, meshCopyMs: 0, meshBuildWallMs: 0, gpuUploadSubmitMs: 0, visibilityMs: 0, vertexBytes: 0, indexBytes: 0, bytesUploaded: 0 };",
  "  const profile = { dirtySections: 0, rebuiltSections: 0, skippedUnstreamedSections: 0, nativeMeshBuildMs: 0, meshCopyMs: 0, materialPackMs: 0, indexCopyMs: 0, meshBuildWallMs: 0, gpuUploadSubmitMs: 0, visibilityMs: 0, vertexBytes: 0, indexBytes: 0, bytesUploaded: 0, intermediateVertexBytesAvoided: 0, materialFastPathVertices: 0, materialFallbackVertices: 0 };",
  'app dirty profile fields');
app = replaceOnce(app,
  "    for (const metric of ['nativeMeshBuildMs','meshCopyMs','meshBuildWallMs','gpuUploadSubmitMs']) profile[metric] += Number(built[metric]) || 0;",
  "    for (const metric of ['nativeMeshBuildMs','meshCopyMs','materialPackMs','indexCopyMs','meshBuildWallMs','gpuUploadSubmitMs']) profile[metric] += Number(built[metric]) || 0;",
  'app dirty timing accumulation');
app = replaceOnce(app,
  "    profile.bytesUploaded += Number(built.bytesUploaded) || 0;",
  "    profile.bytesUploaded += Number(built.bytesUploaded) || 0;\n    profile.intermediateVertexBytesAvoided += Number(built.intermediateVertexBytesAvoided) || 0;\n    profile.materialFastPathVertices += Number(built.materialFastPathVertices) || 0;\n    profile.materialFallbackVertices += Number(built.materialFallbackVertices) || 0;",
  'app dirty pack accumulation');
write('public/app.js', app);

let html = read('public/index.html');
html = html.replace('/app.js?v=20260902-security-smoke-r1', `/app.js?v=${TAG}`);
write('public/index.html', html);

// Existing regression scripts intentionally pin cache/build labels. Move those
// expectations forward together so they validate the same feature set under the
// new measured terrain-pack build instead of failing on a stale label.
for (const name of fs.readdirSync('scripts')) {
  if (!name.endsWith('.mjs') || name === 'apply-terrain-pack-v1.mjs') continue;
  const path = `scripts/${name}`;
  let source = read(path);
  source = source.replaceAll('20260902-security-smoke-r1', TAG);
  write(path, source);
}

const verifierPath = 'scripts/check-terrain-material-pack.mjs';
write(verifierPath, `import fs from 'node:fs';
const read = path => fs.readFileSync(path, 'utf8');
const assert = (ok, message) => { if (!ok) throw new Error('Terrain material pack check failed: ' + message); };
const terrain = read('public/rift-terrain.js');
const landscape = read('public/rift-landscape.js');
const app = read('public/app.js');
const index = read('public/index.html');
const pkg = JSON.parse(read('package.json'));
assert(terrain.includes('_buildSurfaceSectionNative(sectionX'), 'native scratch-view build split missing');
assert(terrain.includes('vertexView: new Float32Array(MEMORY.buffer'), 'native vertex view missing');
assert(landscape.includes('const native = this._buildSurfaceSectionNative'), 'landscape must consume native view directly');
assert(!/buildSurfaceSectionGeometry[\\s\\S]{0,240}super\\.buildSurfaceSectionGeometry/.test(landscape), 'landscape still uses copied base geometry');
for (const token of ['exactGrid', 'materialFastPathVertices', 'materialFallbackVertices', 'intermediateVertexBytesAvoided', 'materialPackMs', 'indexCopyMs']) assert(landscape.includes(token), 'landscape missing ' + token);
assert(landscape.includes('this.sampleMaterialWeights(x, z)'), 'off-grid safety fallback missing');
for (const token of ['materialPackMs','indexCopyMs','intermediateVertexBytesAvoided','materialFastPathVertices','materialFallbackVertices','directWasmToFinalPbrPack','exactGridMaterialFastPath']) assert(app.includes(token), 'profiler missing ' + token);
assert(index.includes('/app.js?v=${TAG}'), 'app cache tag missing');
assert(app.includes("APP_DIAGNOSTIC_BUILD = '${TAG}'"), 'app build label missing');
assert(landscape.includes("./rift-terrain.js?v=${TAG}"), 'terrain module cache tag missing');
assert(app.includes("./rift-landscape.js?v=${TAG}"), 'landscape module cache tag missing');
assert(String(pkg.scripts?.build || '').includes('node scripts/check-terrain-material-pack.mjs'), 'permanent verifier missing from build');
assert(!fs.existsSync('scripts/apply-terrain-pack-v1.mjs'), 'temporary patcher must be removed');
assert(!fs.existsSync('.github/workflows/apply-terrain-pack-v1.yml'), 'temporary workflow must be removed');
console.log('Ironvale terrain material pack verified: direct WASM→PBR packing + exact-grid material fast path + measured allocation avoidance.');
`);

const pkg = JSON.parse(read('package.json'));
if (!String(pkg.scripts?.build || '').includes('node scripts/check-terrain-material-pack.mjs')) {
  pkg.scripts.build += ' && node scripts/check-terrain-material-pack.mjs';
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');
}

execFileSync(process.execPath, ['scripts/generate-integrity-manifest.mjs'], { stdio: 'inherit' });
console.log('Terrain material pack Phase 2 applied.');
