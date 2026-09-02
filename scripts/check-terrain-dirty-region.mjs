import fs from 'node:fs';

const terrain = fs.readFileSync(new URL('../public/rift-terrain.js', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Terrain dirty-region check failed: ${message}`);
}

assert(terrain.includes('const normalHalo = this.sampleSpacing * 2;'), '2-sample normal halo missing');
assert(terrain.includes('const influenceRadius = Math.max(0, Number(radius) || 0) + normalHalo;'), 'brush influence radius missing');
assert(terrain.includes('this._distanceToSection(x, z, this.sectionBounds(sectionX, sectionZ)) <= influenceRadius + EPSILON'), 'circular section intersection filter missing');
assert(!terrain.includes('/ this.sectionSize) - 1, 0, counts.x - 1)'), 'legacy whole-section X halo still present');
assert(!terrain.includes('/ this.sectionSize) + 1, 0, counts.x - 1)'), 'legacy whole-section X max halo still present');

function touchedSections(x, z, radius, sectionSize = 64, sampleSpacing = 1, count = 10) {
  const halo = sampleSpacing * 2;
  const influence = Math.max(0, radius) + halo;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const minX = clamp(Math.floor((x - influence) / sectionSize), 0, count - 1);
  const maxX = clamp(Math.floor((x + influence) / sectionSize), 0, count - 1);
  const minZ = clamp(Math.floor((z - influence) / sectionSize), 0, count - 1);
  const maxZ = clamp(Math.floor((z + influence) / sectionSize), 0, count - 1);
  const result = [];
  for (let sz = minZ; sz <= maxZ; sz += 1) {
    for (let sx = minX; sx <= maxX; sx += 1) {
      const minSectionX = sx * sectionSize;
      const maxSectionX = minSectionX + sectionSize;
      const minSectionZ = sz * sectionSize;
      const maxSectionZ = minSectionZ + sectionSize;
      const dx = x < minSectionX ? minSectionX - x : x > maxSectionX ? x - maxSectionX : 0;
      const dz = z < minSectionZ ? minSectionZ - z : z > maxSectionZ ? z - maxSectionZ : 0;
      if (Math.hypot(dx, dz) <= influence + 1e-6) result.push(`${sx}:${sz}`);
    }
  }
  return result;
}

assert(touchedSections(32, 32, 10).length === 1, '10m brush inside a section should rebuild one section');
assert(touchedSections(63, 32, 10).length === 2, '10m brush near one section edge should rebuild two sections');
assert(touchedSections(63, 63, 10).length === 4, '10m brush near a section corner should rebuild four sections');
assert(touchedSections(32, 32, 40).length <= 4, '40m brush should not expand to a legacy 3x3 whole-section halo');

console.log('Ironvale terrain dirty-region verification passed.');
