import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
  if (url.protocol === 'file:') {
    const bytes = fs.readFileSync(fileURLToPath(url));
    return new Response(bytes, { status: 200, headers: { 'Content-Type': url.pathname.endsWith('.gz') ? 'application/gzip' : 'application/octet-stream' } });
  }
  return realFetch(input, init);
};

const world = JSON.parse(fs.readFileSync('public/world/rift-survival-terrain.json', 'utf8'));
const { RiftLandscape } = await import('../public/rift-landscape.js?island-runtime-check=1');
const terrain = new RiftLandscape(world.terrain);
const generator = terrain.getGeneratorInfo();
if (generator?.id !== 'island-v1' || generator.seed !== world.terrain.seed) throw new Error('RiftLandscape did not apply island-v1 world seed');
if (!(terrain.sampleHeight(320, 320) > 5)) throw new Error('RiftLandscape center is not raised land');
if (!(terrain.sampleHeight(2, 2) < generator.waterLevel)) throw new Error('RiftLandscape world edge is not below water');

const sand = terrain.materialLayers.get('sand');
const rock = terrain.materialLayers.get('rock');
if (!sand || !rock) throw new Error('generated terrain material layers missing sand/rock');
let maxSand = 0, maxRock = 0, sandSamples = 0, rockSamples = 0;
for (let i = 0; i < sand.weights.length; i += 1) {
  const sw = sand.weights[i], rw = rock.weights[i];
  if (sw > maxSand) maxSand = sw;
  if (rw > maxRock) maxRock = rw;
  if (sw > 32) sandSamples += 1;
  if (rw > 32) rockSamples += 1;
}
if (maxSand < 128 || sandSamples < 1000) throw new Error(`generated shoreline sand mask too weak: max=${maxSand}, samples=${sandSamples}`);
if (maxRock < 96 || rockSamples < 500) throw new Error(`generated rock mask too weak: max=${maxRock}, samples=${rockSamples}`);

const before = terrain.sampleHeight(320, 320);
terrain.applyBrush({ mode: 'raise', x: 320, z: 320, radius: 8, strength: 1 });
const edited = terrain.sampleHeight(320, 320);
if (!(edited > before)) throw new Error('RiftLandscape manual edit did not apply over generated island');
terrain.recomposeEditLayers();
if (Math.abs(terrain.sampleHeight(320, 320) - edited) > 0.001) throw new Error('RiftLandscape edit layer recomposition lost generated base');

console.log(`island-v1 runtime verified: seed ${generator.seed} · sand ${sandSamples} samples/max ${maxSand} · rock ${rockSamples} samples/max ${maxRock}`);
