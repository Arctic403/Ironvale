import fs from 'node:fs';
import { compileRiftCityBlock, validateRiftCityBlockImporter } from '../public/rift-city-block-importer.js';

const fail = message => {
  console.error(`[blueprint-check] ${message}`);
  process.exitCode = 1;
};

const importer = validateRiftCityBlockImporter();
if (!importer.ok) fail(`importer self-test failed: ${importer.failures.join('; ')}`);

const examplePath = new URL('../public/rift-world-blocks/blueprint-example-downtown-cross.json', import.meta.url);
const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

try {
  const compiled = compileRiftCityBlock(example);
  const expected = {
    prefabCount: 3,
    instances: 10,
    nestedInstances: 8,
    roads: 2,
    intersections: 1,
    anchors: 14,
    groups: 1,
    connections: 2
  };
  for (const [key, value] of Object.entries(expected)) {
    if (compiled.stats[key] !== value) fail(`example ${key} ${compiled.stats[key]} != ${value}`);
  }
  if (compiled.stats.partialCells < 4) fail('nested rotated stairs did not survive the full/slab/stair pipeline');
  const rotatedDoor = compiled.blueprint.anchors.find(anchor => anchor.id === 'block-b/shop-west/stoop.door');
  if (!rotatedDoor || rotatedDoor.facing !== 'west') fail('nested prefab anchor did not inherit parent rotation');
  if (!compiled.blueprint.validation?.ok) fail('example blueprint validation did not report ok');
} catch (error) {
  fail(`example blueprint failed to compile: ${error.message}`);
}

const overlap = structuredClone(example);
overlap.id = 'blueprint-overlap-regression';
overlap.layout = [
  { type: 'instance', id: 'a', prefab: 'shop_shell', origin: [2, 0, 2], rotation: 'north' },
  { type: 'instance', id: 'b', prefab: 'shop_shell', origin: [3, 0, 3], rotation: 'north' }
];
overlap.anchors = {};
overlap.groups = {};
overlap.connections = [];
let overlapRejected = false;
try {
  compileRiftCityBlock(overlap);
} catch (error) {
  overlapRejected = /overlap validation failed|conflicts with/.test(error.message);
}
if (!overlapRejected) fail('different-instance cell overlap was not rejected');

const badReference = structuredClone(example);
badReference.id = 'blueprint-reference-regression';
badReference.connections = [{ from: 'block-a.street_link', to: 'missing.anchor', tolerance: 0 }];
let badReferenceRejected = false;
try {
  compileRiftCityBlock(badReference);
} catch (error) {
  badReferenceRejected = /unknown anchor/.test(error.message);
}
if (!badReferenceRejected) fail('bad anchor connection reference was not rejected');

const cycle = structuredClone(example);
cycle.id = 'blueprint-cycle-regression';
cycle.prefabs.cycle_a = {
  bounds: { min: [0, 0, 0], max: [3, 1, 3] },
  instances: [{ id: 'b', prefab: 'cycle_b', origin: [0, 0, 0] }]
};
cycle.prefabs.cycle_b = {
  bounds: { min: [0, 0, 0], max: [3, 1, 3] },
  instances: [{ id: 'a', prefab: 'cycle_a', origin: [0, 0, 0] }]
};
cycle.layout = [{ type: 'instance', id: 'cycle-root', prefab: 'cycle_a', origin: [0, 0, 0] }];
cycle.anchors = {};
cycle.groups = {};
cycle.connections = [];
let cycleRejected = false;
try {
  compileRiftCityBlock(cycle);
} catch (error) {
  cycleRejected = /cycle detected/.test(error.message);
}
if (!cycleRejected) fail('recursive prefab cycle was not rejected');

if (!process.exitCode) console.log('[blueprint-check] nested prefabs, rotations, anchors, references, overlap validation and legacy importer pipeline: PASS');
