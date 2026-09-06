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
const { RiftLandscape } = await import('../public/rift-landscape.js?island-runtime-check=2');
const terrain = new RiftLandscape(world.terrain);
const generator = terrain.getGeneratorInfo();
const center = world.terrain.size[0] / 2;
if (generator?.id !== 'island-v3' || generator.version !== 3 || generator.seed !== world.terrain.seed) throw new Error('RiftLandscape did not apply island-v3 world seed');
if (terrain.width !== 5120 || terrain.depth !== 5120 || terrain.sampleSpacing !== 5) throw new Error('RiftLandscape large-world geometry contract drifted');
if (!(terrain.sampleHeight(center, center) > 8)) throw new Error('RiftLandscape center is not raised land');
if (!(terrain.sampleHeight(10, 10) < generator.waterLevel)) throw new Error('RiftLandscape world edge is not below water');

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
if (maxSand < 128 || sandSamples < 1500) throw new Error(`generated shoreline sand mask too weak: max=${maxSand}, samples=${sandSamples}`);
if (maxRock < 96 || rockSamples < 500) throw new Error(`generated rock mask too weak: max=${maxRock}, samples=${rockSamples}`);

const stream = terrain.planComponentStreaming(center, center);
const plan = terrain.planSectionLods(center, center);
if (stream.render.size !== 25) throw new Error(`expected 25 resident components at map center, got ${stream.render.size}`);
if (plan.size !== 100) throw new Error(`expected 100 resident section LOD entries, got ${plan.size}`);
if (terrain.getStats().surfaceSections !== 4096) throw new Error('large-world total section count must be 4096');

const before = terrain.sampleHeight(center, center);
terrain.applyBrush({ mode: 'raise', x: center, z: center, radius: 20, strength: 1 });
const edited = terrain.sampleHeight(center, center);
if (!(edited > before)) throw new Error('RiftLandscape manual edit did not apply over generated island');
terrain.recomposeEditLayers();
if (Math.abs(terrain.sampleHeight(center, center) - edited) > 0.001) throw new Error('RiftLandscape edit layer recomposition lost generated base');

console.log(`island-v3 runtime verified: 5120m world · ${plan.size}/4096 resident sections · seed ${generator.seed} · sand ${sandSamples}/max ${maxSand} · rock ${rockSamples}/max ${maxRock}`);
