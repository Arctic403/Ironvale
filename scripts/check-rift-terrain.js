import fs from 'node:fs';
import { createRiftTerrain, createRiftTerrainFromDocument, validateRiftTerrainConfig } from '../public/rift-terrain.js';

const fail = message => { console.error('[rift-terrain] FAIL · ' + message); process.exit(1); };
const expect = (value, message) => { if (!value) fail(message); };
const world = JSON.parse(fs.readFileSync('public/rift-world-blocks/ironvale-terrain-bootstrap.json', 'utf8'));
const validation = validateRiftTerrainConfig(world.terrain);
expect(validation.ok, validation.failures.join('; '));

const terrain = createRiftTerrainFromDocument(world);
expect(terrain, 'terrain document did not instantiate');
const stats = terrain.getStats();
expect(stats.width === 320 && stats.depth === 320, 'starter terrain must stay 320x320 meters');
expect(stats.sampleSpacing === 1 && stats.samples === 103041, 'starter terrain must use the 1m/321x321 heightfield');
expect(stats.chunkSize === 32 && stats.surfaceChunks === 100, 'starter terrain must compile into 100 32m components');
expect(stats.layers >= 6, 'starter terrain needs layered non-destructive relief');
expect(stats.caves >= 1, 'starter terrain must include a cave volume');

const spawn = terrain.sampleHeight(160, 160);
const westHill = terrain.sampleHeight(72, 88);
const valley = terrain.sampleHeight(160, 215);
expect(Number.isFinite(spawn) && Math.abs(spawn - 10) < 1.2, 'spawn meadow did not flatten near 10m');
expect(westHill > spawn + 8, 'west hill relief is too flat');
expect(valley < spawn - 3, 'central valley relief is missing');
expect(terrain.slopeAt(160, 160) < 0.12, 'spawn meadow is too steep');

expect(terrain.isHoleAt(228, 154), 'Blackstone cave entrance did not cut a terrain visibility hole');
const caveMeshes = terrain.buildCaveGeometries();
expect(caveMeshes.length === 1 && caveMeshes[0].triangles >= 120, 'Blackstone cave did not build real 3D tunnel geometry');
const surfaceMeshes = terrain.buildSurfaceGeometries();
const surfaceTriangles = surfaceMeshes.reduce((sum, item) => sum + item.triangles, 0);
expect(surfaceMeshes.length === 100, 'surface component mesh count regressed');
expect(surfaceTriangles > 180000 && surfaceTriangles < 205000, 'surface triangle budget is outside the expected mobile range');

const terrainCopy = createRiftTerrain(world.terrain);
const beforeRaise = terrainCopy.sampleHeight(120, 120);
terrainCopy.applyBrush({ mode: 'raise', x: 120, z: 120, radius: 7, strength: 2 });
expect(terrainCopy.sampleHeight(120, 120) > beforeRaise + 1.8, 'raise brush did not edit the heightfield');
terrainCopy.applyBrush({ mode: 'hole', x: 120, z: 120, radius: 3 });
expect(terrainCopy.isHoleAt(120, 120), 'visibility-hole brush did not edit the mask');

const surfaceSupport = terrain.supportAtPoint(160, 160, spawn + 0.2, { maxRise: 1, maxDrop: 2 });
expect(surfaceSupport != null && Math.abs(surfaceSupport - spawn) < 0.02, 'terrain collision support does not match rendered surface');
expect(terrain.isSolidPoint(160, spawn - 0.5, 160), 'terrain earth volume is not solid below the surface');

const foundation = fs.readFileSync('public/downtown3d-foundation.js', 'utf8');
const player = fs.readFileSync('public/rift-player.js', 'utf8');
expect(foundation.includes("createRiftTerrainFromDocument") && foundation.includes('buildSurfaceGeometries'), 'world foundation is not rendering Rift Terrain');
expect(foundation.includes('getTerrain: () => terrain'), 'player controller is not connected to Rift Terrain');
expect(player.includes('getTerrain') && player.includes('terrain.supportCandidatesAt'), 'player surface solver is not terrain-aware');
expect(player.includes("!getTerrain?.()"), 'native block-only player step must be bypassed while smooth terrain owns collision');

console.log(`[rift-terrain] PASS · ${stats.surfaceChunks} surface chunks · ${stats.samples} height samples · ${surfaceTriangles} surface triangles · ${caveMeshes[0].triangles} cave triangles · sculpt + holes + terrain collision live.`);
