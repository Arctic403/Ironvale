import fs from 'node:fs';
const path='public/rift-third-person-camera.js';
let s=fs.readFileSync(path,'utf8');
const oldSig=`export function resolveRiftThirdPersonCameraDistance({
  grid,
  target,
  alpha,
  beta,
  desiredDistance,
  minDistance = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minDistance,
  collisionStep = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.collisionStep,
  collisionSkin = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.collisionSkin
} = {}) {`;
const newSig=`export function resolveRiftThirdPersonCameraDistance({
  grid,
  target,
  alpha,
  beta,
  desiredDistance,
  cameraLift = 0,
  minDistance = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minDistance,
  collisionStep = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.collisionStep,
  collisionSkin = RIFT_THIRD_PERSON_CAMERA_DEFAULTS.collisionSkin
} = {}) {`;
if(!s.includes(oldSig)) throw new Error('camera distance signature sentinel missing');
s=s.replace(oldSig,newSig);
const oldLoop=`    const x = target[0] + dx * t;
    const y = target[1] + dy * t;
    const z = target[2] + dz * t;
    if (!occupiedAt(grid, x, y, z)) continue;
    safeDistance = Math.max(minDistance, length * Math.max(0, t - collisionSkin / length));
    break;`;
const newLoop=`    const x = target[0] + dx * t;
    const y = target[1] + dy * t;
    const z = target[2] + dz * t;
    // Probe both the physical boom and the camera's lifted render path. The
    // latter matters under ceilings: the old probe could pass safely below a
    // roof, then framingLift moved the actual camera up inside that roof.
    const blockedBoom = occupiedAt(grid, x, y, z);
    const blockedCamera = occupiedAt(grid, x, y + (Number(cameraLift) || 0), z);
    if (!blockedBoom && !blockedCamera) continue;
    safeDistance = Math.max(minDistance, length * Math.max(0, t - collisionSkin / length));
    break;`;
if(!s.includes(oldLoop)) throw new Error('camera collision loop sentinel missing');
s=s.replace(oldLoop,newLoop);
const oldCall=`      desiredDistance: fixedDistance,
      minDistance: config.minDistance,`;
const newCall=`      desiredDistance: fixedDistance,
      cameraLift: config.framingLift,
      minDistance: config.minDistance,`;
if(!s.includes(oldCall)) throw new Error('camera collision call sentinel missing');
s=s.replace(oldCall,newCall);
const oldTest=`  const blocked = resolveRiftThirdPersonCameraDistance({ grid:fakeGrid, target:[0,2,0], alpha:-Math.PI/2, beta:Math.PI/2, desiredDistance:8.5 });
  if (!(blocked < 8.5 && blocked >= RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minDistance)) failures.push('camera collision did not retract before a blocking wall');`;
const newTest=`  const blocked = resolveRiftThirdPersonCameraDistance({ grid:fakeGrid, target:[0,2,0], alpha:-Math.PI/2, beta:Math.PI/2, desiredDistance:8.5 });
  if (!(blocked < 8.5 && blocked >= RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minDistance)) failures.push('camera collision did not retract before a blocking wall');

  // A low roof can intersect only the lifted render camera while leaving the
  // lower boom ray clear. Collision must still push the camera forward.
  const roofGrid = {
    getBlockWorld(x, y, z) {
      return (x === 0 && y === 3 && z <= -3 && z >= -5) ? 1 : 0;
    }
  };
  const roofBlocked = resolveRiftThirdPersonCameraDistance({
    grid: roofGrid,
    target: [0, 2, 0],
    alpha: -Math.PI/2,
    beta: Math.PI/2,
    desiredDistance: 8.5,
    cameraLift: RIFT_THIRD_PERSON_CAMERA_DEFAULTS.framingLift
  });
  if (!(roofBlocked < 8.5 && roofBlocked >= RIFT_THIRD_PERSON_CAMERA_DEFAULTS.minDistance)) failures.push('camera collision did not retract under a low roof');`;
if(!s.includes(oldTest)) throw new Error('camera validation sentinel missing');
s=s.replace(oldTest,newTest);
fs.writeFileSync(path,s);
console.log('third-person roof camera collision patched');
