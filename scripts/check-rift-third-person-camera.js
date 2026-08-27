import { validateRiftThirdPersonCamera } from '../public/rift-third-person-camera.js';
import { buildRiftVisibilityStructures, resolveRiftBuildingVisibility } from '../public/rift-building-visibility.js';

const result = validateRiftThirdPersonCamera();
if (!result.ok) throw new Error(`third-person camera regression failed: ${result.failures.join('; ')}`);

const structures = buildRiftVisibilityStructures([{ op:'hollow_box', name:'shell', min:[2,1,2], max:[9,6,9], wall_thickness:1, floor:true }]);
const outside = resolveRiftBuildingVisibility({ structures, playerPosition:[12,2,5], cameraPosition:[-5,4,5] });
if (outside.hiddenLayers.size || outside.suppressedStructures.length) throw new Error('third-person exterior view must never hide building geometry');
const inside = resolveRiftBuildingVisibility({ structures, playerPosition:[5,2,5], cameraPosition:[5,3,4] });
if (!inside.insideStructures.length) throw new Error('third-person interior containment metadata was lost');
if (inside.hiddenLayers.size || inside.suppressedStructures.length) throw new Error('third-person interior view must never hide roof/wall/floor geometry');
console.log('RiftCity third-person camera collision + no-cutaway rendering: PASS');
