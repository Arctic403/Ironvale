import { validateRiftThirdPersonCamera, validateRiftFirstPersonCamera } from '../public/rift-third-person-camera.js';
import { buildRiftVisibilityStructures, resolveRiftBuildingVisibility } from '../public/rift-building-visibility.js';
import { riftReticleClientPoint } from '../public/rift-creative-mode.js';

const result = validateRiftThirdPersonCamera();
if (!result.ok) throw new Error(`third-person camera regression failed: ${result.failures.join('; ')}`);

const firstPersonResult = validateRiftFirstPersonCamera();
if (!firstPersonResult.ok) throw new Error(`first-person camera regression failed: ${firstPersonResult.failures.join('; ')}`);

const reticlePoint = riftReticleClientPoint(
  { getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 1136 }) },
  { offsetLeft: 0, offsetTop: 0, width: 640, height: 1136 }
);
if (reticlePoint[0] !== 320 || reticlePoint[1] !== 568) throw new Error('shared reticle target is not locked to visible-screen center');
const windowedReticlePoint = riftReticleClientPoint(
  { getBoundingClientRect: () => ({ left: 20, top: 10, width: 300, height: 180 }) },
  { offsetLeft: 0, offsetTop: 0, width: 640, height: 1136 }
);
if (windowedReticlePoint[0] !== 170 || windowedReticlePoint[1] !== 100) throw new Error('windowed reticle target did not fall back to canvas center');

const structures = buildRiftVisibilityStructures([{ op:'hollow_box', name:'shell', min:[2,1,2], max:[9,6,9], wall_thickness:1, floor:true }]);
const outside = resolveRiftBuildingVisibility({ structures, playerPosition:[12,2,5], cameraPosition:[-5,4,5] });
if (outside.hiddenLayers.size || outside.suppressedStructures.length) throw new Error('third-person exterior view must never hide building geometry');
const inside = resolveRiftBuildingVisibility({ structures, playerPosition:[5,2,5], cameraPosition:[5,3,4] });
if (!inside.insideStructures.length) throw new Error('third-person interior containment metadata was lost');
if (inside.hiddenLayers.size || inside.suppressedStructures.length) throw new Error('third-person interior view must never hide roof/wall/floor geometry');
console.log('RiftCity first/third-person shared reticle + camera regressions: PASS');
