import fs from 'node:fs';

const path = 'public/rift-terrain.js';
let source = fs.readFileSync(path, 'utf8');

const before = `  markDirtyRegion(x, z, radius = 0) {
    const counts = this.sectionCounts();
    const pad = Math.max(this.sampleSpacing * 2, Number(radius) || 0);
    const minX = clamp(Math.floor((x - pad - this.origin[0]) / this.sectionSize) - 1, 0, counts.x - 1);
    const maxX = clamp(Math.floor((x + pad - this.origin[0]) / this.sectionSize) + 1, 0, counts.x - 1);
    const minZ = clamp(Math.floor((z - pad - this.origin[2]) / this.sectionSize) - 1, 0, counts.z - 1);
    const maxZ = clamp(Math.floor((z + pad - this.origin[2]) / this.sectionSize) + 1, 0, counts.z - 1);
    for (let sectionZ = minZ; sectionZ <= maxZ; sectionZ += 1) {
      for (let sectionX = minX; sectionX <= maxX; sectionX += 1) {
        this._dirtySections.add(this.sectionKey(sectionX, sectionZ));
      }
    }
  }`;

const after = `  markDirtyRegion(x, z, radius = 0) {
    const counts = this.sectionCounts();
    // Terrain normals sample neighboring source points, so edits need a small
    // sample-space halo — not an unconditional whole-section halo.
    const normalHalo = this.sampleSpacing * 2;
    const influenceRadius = Math.max(0, Number(radius) || 0) + normalHalo;
    const minX = clamp(Math.floor((x - influenceRadius - this.origin[0]) / this.sectionSize), 0, counts.x - 1);
    const maxX = clamp(Math.floor((x + influenceRadius - this.origin[0]) / this.sectionSize), 0, counts.x - 1);
    const minZ = clamp(Math.floor((z - influenceRadius - this.origin[2]) / this.sectionSize), 0, counts.z - 1);
    const maxZ = clamp(Math.floor((z + influenceRadius - this.origin[2]) / this.sectionSize), 0, counts.z - 1);
    for (let sectionZ = minZ; sectionZ <= maxZ; sectionZ += 1) {
      for (let sectionX = minX; sectionX <= maxX; sectionX += 1) {
        // A circular brush should not dirty corner sections that its influence
        // radius never reaches. This keeps rebuild work proportional to the edit.
        if (this._distanceToSection(x, z, this.sectionBounds(sectionX, sectionZ)) <= influenceRadius + EPSILON) {
          this._dirtySections.add(this.sectionKey(sectionX, sectionZ));
        }
      }
    }
  }`;

if (!source.includes(before)) throw new Error('Expected legacy markDirtyRegion implementation was not found.');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Terrain dirty-region optimization applied.');
