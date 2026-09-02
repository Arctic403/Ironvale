import fs from 'node:fs';

const path = 'scripts/apply-terrain-profiler.mjs';
let text = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    "    terrainStatus.textContent = `RiftLandscape · ${terrain.activeMaterialLayer?.name || 'Material'} ${brushMode === 'erase-material' ? 'erase' : 'paint'} · edit ${terrain.revision} · ${lodSummary() || 'adaptive LOD'} · edit ${sample.totalMs.toFixed(1)}ms`;",
    "    terrainStatus.textContent = 'RiftLandscape · ' + (terrain.activeMaterialLayer?.name || 'Material') + ' ' + (brushMode === 'erase-material' ? 'erase' : 'paint') + ' · edit ' + terrain.revision + ' · ' + (lodSummary() || 'adaptive LOD') + ' · edit ' + sample.totalMs.toFixed(1) + 'ms';"
  ],
  [
    "  terrainStatus.textContent = `RiftLandscape · ${terrain.activeEditLayer?.name || 'Sculpt'} · edit ${terrain.revision} · ${lodSummary() || 'adaptive LOD'} · edit ${sample.totalMs.toFixed(1)}ms`;",
    "  terrainStatus.textContent = 'RiftLandscape · ' + (terrain.activeEditLayer?.name || 'Sculpt') + ' · edit ' + terrain.revision + ' · ' + (lodSummary() || 'adaptive LOD') + ' · edit ' + sample.totalMs.toFixed(1) + 'ms';"
  ],
  [
    "    checks.push(passFail('terrain.section-coverage', coverageOk, `${meshes}/${expectedStreamedMeshes} streamed meshes · ${lodPlan}/${expectedSections} LOD entries · ${renderedComponents || 'all'} render component(s)`));",
    "    checks.push(passFail('terrain.section-coverage', coverageOk, meshes + '/' + expectedStreamedMeshes + ' streamed meshes · ' + lodPlan + '/' + expectedSections + ' LOD entries · ' + (renderedComponents || 'all') + ' render component(s)'));"
  ]
];

for (const [before, after] of replacements) {
  if (!text.includes(before)) throw new Error('Missing helper fix target: ' + before.slice(0, 100));
  text = text.replace(before, after);
}

fs.writeFileSync(path, text);
console.log('Terrain profiler helper generator fixed.');
