import { RiftCamera, RiftEngine } from './rift-engine.js';
import { compileRiftCityBlock } from './rift-city-block-importer.js';

const INDEX_URL = new URL('./riftcity-blocks/world-index.json', import.meta.url);
const canvas = document.querySelector('#inspection-canvas');
const status = document.querySelector('#inspection-status');
const params = new URLSearchParams(location.search);
const requestedView = String(params.get('view') || 'top').toLowerCase();
const ALLOWED_VIEWS = new Set(['top', 'birdseye', 'north', 'east', 'south', 'west']);

let engine = null;
let camera = null;
let compiled = null;
let currentBlockUrl = null;

function setStatus(message) {
  if (status) status.textContent = String(message || '');
}

function safeLocalUrl(value, base) {
  const raw = String(value || '').trim();
  if (!raw || /^(?:[a-z]+:)?\/\//i.test(raw)) throw new Error('Inspection block path must be a local source-controlled path.');
  const url = new URL(raw.replace(/^\//, './'), base);
  if (url.origin !== location.origin) throw new Error('Inspection block path must stay on the current origin.');
  return url;
}

async function loadJson(url, label) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${label} request failed with HTTP ${response.status}.`);
  try { return await response.json(); }
  catch (error) { throw new Error(`${label} is not valid JSON: ${error.message}`); }
}

async function resolveBlock() {
  const index = await loadJson(INDEX_URL, 'World index');
  if (index?.format !== 'riftcity-world-index' || Number(index?.version) !== 1 || !Array.isArray(index?.blocks)) {
    throw new Error('world-index.json is not a supported RiftCity world index.');
  }

  const requestedId = String(params.get('id') || index.activeBlockId || '').trim();
  let entry = index.blocks.find(item => String(item?.id || '') === requestedId) || null;
  if (!entry && index.blocks.length === 1) entry = index.blocks[0];

  const blockOverride = params.get('block');
  const blockUrl = blockOverride
    ? safeLocalUrl(blockOverride, import.meta.url)
    : entry?.path ? safeLocalUrl(entry.path, INDEX_URL) : null;
  if (!blockUrl) throw new Error(`World index does not define block ${requestedId || '(none)'}.`);

  const document = await loadJson(blockUrl, entry?.name || requestedId || 'RiftCity block');
  return { index, entry, blockUrl, document };
}

function inspectionCameraFor(block, view) {
  const bounds = block.worldBounds;
  const min = bounds.min;
  const max = bounds.max;
  const width = Math.max(1, max[0] - min[0] + 1);
  const height = Math.max(1, max[1] - min[1] + 1);
  const depth = Math.max(1, max[2] - min[2] + 1);
  const span = Math.max(width, depth);
  const center = [
    (min[0] + max[0] + 1) * 0.5,
    (min[1] + max[1] + 1) * 0.5,
    (min[2] + max[2] + 1) * 0.5
  ];

  const next = new RiftCamera({
    projection: view === 'north' || view === 'east' || view === 'south' || view === 'west' ? 'perspective' : 'orthographic',
    alpha: -Math.PI / 2,
    beta: 0.055,
    radius: Math.max(24, Math.min(420, span * 1.5 + height)),
    minRadius: 2,
    maxRadius: 520,
    orthoSize: Math.max(18, Math.min(360, span * 1.32 + height * 0.28)),
    minOrthoSize: 8,
    maxOrthoSize: 420,
    minBeta: 0.02,
    maxBeta: 1.25,
    fov: Math.PI / 3.05,
    near: 0.05,
    far: 900
  });

  if (view === 'birdseye') {
    next.setProjection('orthographic');
    next.alpha = -Math.PI / 4;
    next.beta = 0.66;
    next.orthoSize = Math.max(20, Math.min(360, span * 1.45 + height * 0.4));
  } else if (view === 'north' || view === 'east' || view === 'south' || view === 'west') {
    next.setProjection('perspective');
    next.beta = 0.92;
    next.radius = Math.max(18, Math.min(420, span * 1.12 + height * 1.15));
    next.alpha = view === 'north' ? -Math.PI / 2
      : view === 'south' ? Math.PI / 2
      : view === 'east' ? 0
      : Math.PI;
  } else {
    next.setProjection('orthographic');
    next.alpha = -Math.PI / 2;
    next.beta = 0.055;
  }

  next.setTarget(...center);
  next.updatePosition();
  return next;
}

function captureCanvasPng() {
  if (!engine || !camera) return null;
  engine.render(camera);
  const gl = engine.gl;
  const width = Math.max(1, canvas.width | 0);
  const height = Math.max(1, canvas.height | 0);
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d', { alpha: false });
  const image = context.createImageData(width, height);
  const stride = width * 4;
  for (let y = 0; y < height; y += 1) {
    const sourceStart = (height - 1 - y) * stride;
    image.data.set(pixels.subarray(sourceStart, sourceStart + stride), y * stride);
  }
  context.putImageData(image, 0, 0);
  return output.toDataURL('image/png');
}

function resizeAndRender() {
  if (!engine || !camera) return;
  const ratio = Math.min(Math.max(1, window.devicePixelRatio || 1), 1.75);
  engine.resize(ratio);
  engine.render(camera);
}

async function boot() {
  if (!canvas) throw new Error('Inspection canvas is missing.');
  const view = ALLOWED_VIEWS.has(requestedView) ? requestedView : 'top';
  setStatus(`Resolving JSON world index · ${view.toUpperCase()} view…`);
  const resolved = await resolveBlock();
  currentBlockUrl = resolved.blockUrl;
  compiled = compileRiftCityBlock(resolved.document);

  engine = new RiftEngine(canvas, {
    antialias: true,
    clearColor: [0.045, 0.055, 0.065],
    fogColor: [0.045, 0.055, 0.065],
    fogStart: 300,
    fogEnd: 760
  });

  const meshOptions = {
    color: '#ffffff',
    noise: 0,
    blockGrid: 0.16,
    blockFaceShade: 1,
    blockElevationCue: 0.01,
    blockElevationBase: 0,
    doubleSided: false
  };
  for (const mesh of compiled.meshes) engine.addMesh(mesh.geometry, meshOptions);

  camera = inspectionCameraFor(compiled, view);
  resizeAndRender();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  resizeAndRender();

  const stats = compiled.stats || {};
  setStatus(`${compiled.name} · ${view.toUpperCase()} · ${Number(stats.cells || 0).toLocaleString()} cells · ${Number(stats.triangles || 0).toLocaleString()} tris · source JSON only`);
  document.documentElement.dataset.riftInspectionReady = '1';
  document.title = `READY · ${compiled.name} · ${view}`;

  const api = {
    version: 1,
    view,
    blockId: compiled.id,
    blockName: compiled.name,
    blockUrl: currentBlockUrl.href,
    bounds: compiled.worldBounds,
    stats: { ...stats },
    capturePng: captureCanvasPng,
    setView(nextView) {
      const normalized = String(nextView || '').toLowerCase();
      if (!ALLOWED_VIEWS.has(normalized)) throw new Error(`Unsupported inspection view: ${nextView}`);
      camera = inspectionCameraFor(compiled, normalized);
      resizeAndRender();
      return normalized;
    }
  };
  Object.defineProperty(window, 'RiftCityWorldInspection', { value: Object.freeze(api), configurable: true });
}

window.addEventListener('resize', resizeAndRender);
boot().catch(error => {
  console.error('RiftCity static world inspection failed', error);
  document.documentElement.dataset.riftInspectionError = '1';
  document.title = 'ERROR · RiftCity World Inspection';
  setStatus(error?.message || String(error));
});
