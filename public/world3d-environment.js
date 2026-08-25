import { WORLD3D_CONFIG, WORLD3D_DISTRICTS, getNearbyChunkKeys } from './world3d-layout.js';

const DISTRICT_STYLES = Object.freeze({
  downtown: {
    awning: '#d68d35',
    sign: '#f0be6d',
    neon: '#d98f3c',
    foliage: 4,
    lotShade: 0,
    cars: ['#a3483f','#445b72','#2e3137','#a07a39']
  },
  northside: {
    awning: '#6f94b8',
    sign: '#a9c7e0',
    neon: '#5f89ae',
    foliage: 7,
    lotShade: 1,
    cars: ['#445b72','#77715e','#52614c','#34373c']
  },
  harbor: {
    awning: '#4f8da3',
    sign: '#93d3e4',
    neon: '#4f8da3',
    foliage: 6,
    lotShade: 2,
    cars: ['#4f8da3','#c0c6ca','#49606b','#795d4b']
  },
  industrial: {
    awning: '#8e733e',
    sign: '#ddc689',
    neon: '#977747',
    foliage: 3,
    lotShade: 3,
    cars: ['#8e733e','#34373c','#6e5a48','#55606a']
  },
  westend: {
    awning: '#7b5f8f',
    sign: '#ccb2db',
    neon: '#8f70a7',
    foliage: 5,
    lotShade: 1,
    cars: ['#7b5f8f','#34373c','#9d7854','#626d78']
  }
});

export function createStreamedEnvironment(B, scene, shadowGenerator, materials) {
  const chunks = new Map();
  const activeCars = [];
  let lastCenter = '';
  let trafficObserver = null;

  const parseKey = key => key.split(':').map(Number);

  const update = (x, z) => {
    const wanted = new Set(getNearbyChunkKeys(x, z, WORLD3D_CONFIG.activeChunkRadius));
    const cx = Math.floor(x / WORLD3D_CONFIG.chunkSize);
    const cz = Math.floor(z / WORLD3D_CONFIG.chunkSize);
    const center = `${cx}:${cz}`;
    if (center === lastCenter && chunks.size) return;
    lastCenter = center;

    for (const [key, bundle] of chunks) {
      if (wanted.has(key)) continue;
      bundle.dispose();
      chunks.delete(key);
    }

    for (const key of wanted) {
      if (chunks.has(key)) continue;
      const [chunkX, chunkZ] = parseKey(key);
      chunks.set(key, createEnvironmentChunk(B, scene, shadowGenerator, materials, chunkX, chunkZ, activeCars));
    }

    if (!trafficObserver) {
      trafficObserver = scene.onBeforeRenderObservable.add(() => {
        const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
        for (let i = activeCars.length - 1; i >= 0; i--) {
          const item = activeCars[i];
          if (!item?.root || item.root.isDisposed?.()) {
            activeCars.splice(i, 1);
            continue;
          }
          if (item.axis === 'z') {
            item.root.position.z += item.direction * item.speed * dt;
            if (item.root.position.z > item.max) item.root.position.z = item.min;
            if (item.root.position.z < item.min) item.root.position.z = item.max;
          } else {
            item.root.position.x += item.direction * item.speed * dt;
            if (item.root.position.x > item.max) item.root.position.x = item.min;
            if (item.root.position.x < item.min) item.root.position.x = item.max;
          }
        }
      });
    }
  };

  return {
    update,
    dispose() {
      for (const bundle of chunks.values()) bundle.dispose();
      chunks.clear();
      activeCars.length = 0;
      if (trafficObserver) scene.onBeforeRenderObservable.remove(trafficObserver);
      trafficObserver = null;
    }
  };
}

function createEnvironmentChunk(B, scene, shadowGenerator, materials, chunkX, chunkZ, activeCars) {
  const size = WORLD3D_CONFIG.chunkSize;
  const centerX = chunkX * size + size / 2;
  const centerZ = chunkZ * size + size / 2;
  const seed = hash2(chunkX, chunkZ);
  const district = getDistrictFor(centerX, centerZ);
  const style = DISTRICT_STYLES[district.id] || DISTRICT_STYLES.downtown;
  const owned = [];
  const localCars = [];
  const own = mesh => { owned.push(mesh); return mesh; };

  const accentMat = tintMaterial(B, scene, `chunk-accent-${chunkX}-${chunkZ}`, style.awning);
  const signMat = tintMaterial(B, scene, `chunk-sign-${chunkX}-${chunkZ}`, style.sign, true);
  const altBuildingMat = materials.buildingMats[(Math.abs(seed) + style.lotShade) % materials.buildingMats.length];

  const roadV = own(B.MeshBuilder.CreateBox(`stream-road-v-${chunkX}-${chunkZ}`, { width: 9, height: 0.055, depth: size + 1 }, scene));
  roadV.position.set(centerX, 0.048, centerZ);
  roadV.material = materials.roadMat;
  const roadH = own(B.MeshBuilder.CreateBox(`stream-road-h-${chunkX}-${chunkZ}`, { width: size + 1, height: 0.056, depth: 9 }, scene));
  roadH.position.set(centerX, 0.049, centerZ);
  roadH.material = materials.roadMat;

  const medV = own(B.MeshBuilder.CreateBox(`stream-med-v-${chunkX}-${chunkZ}`, { width: 0.14, height: 0.065, depth: size - 8 }, scene));
  medV.position.set(centerX, 0.08, centerZ);
  medV.material = signMat;
  const medH = own(B.MeshBuilder.CreateBox(`stream-med-h-${chunkX}-${chunkZ}`, { width: size - 8, height: 0.065, depth: 0.14 }, scene));
  medH.position.set(centerX, 0.08, centerZ);
  medH.material = signMat;

  for (const lane of [-2.15, 2.15]) {
    const vLine = own(B.MeshBuilder.CreateBox(`stream-vline-${chunkX}-${chunkZ}-${lane}`, { width: 0.08, height: 0.064, depth: size - 6 }, scene));
    vLine.position.set(centerX + lane, 0.086, centerZ);
    vLine.material = materials.lineMat;
    const hLine = own(B.MeshBuilder.CreateBox(`stream-hline-${chunkX}-${chunkZ}-${lane}`, { width: size - 6, height: 0.064, depth: 0.08 }, scene));
    hLine.position.set(centerX, 0.087, centerZ + lane);
    hLine.material = materials.lineMat;
  }

  for (const [dx, dz] of [[-6,-6], [6,-6], [-6,6], [6,6]]) {
    const cross = own(B.MeshBuilder.CreateBox(`stream-cross-${chunkX}-${chunkZ}-${dx}-${dz}`, { width: 2.8, height: 0.064, depth: 0.26 }, scene));
    cross.position.set(centerX + dx, 0.086, centerZ + dz);
    cross.material = materials.lineMat;
  }

  const blockCenters = [[-25,-25],[25,-25],[-25,25],[25,25]];
  blockCenters.forEach(([ox, oz], index) => {
    const lot = own(B.MeshBuilder.CreateBox(`stream-lot-${chunkX}-${chunkZ}-${index}`, { width: 31, height: 0.12, depth: 31 }, scene));
    lot.position.set(centerX + ox, 0.075, centerZ + oz);
    lot.material = materials.sidewalkMat;
    lot.checkCollisions = true;

    const inset = own(B.MeshBuilder.CreateBox(`stream-plaza-${chunkX}-${chunkZ}-${index}`, { width: 24.5, height: 0.02, depth: 24.5 }, scene));
    inset.position.set(centerX + ox, 0.15, centerZ + oz);
    inset.material = materials.groundMat;

    createSidewalkFurniture(B, scene, materials, owned, centerX + ox, centerZ + oz, `${chunkX}-${chunkZ}-${index}`, district.id, shadowGenerator);

    const count = 2 + ((seed + index) % 2);
    for (let j = 0; j < count; j++) {
      const sideX = j % 2 ? 1 : -1;
      const sideZ = j < 2 ? 1 : -1;
      const bx = centerX + ox + sideX * (5.5 + ((seed + j * 7) % 4));
      const bz = centerZ + oz + sideZ * (5.5 + ((seed + j * 5) % 4));
      createFillerBuilding(B, scene, shadowGenerator, materials, owned, bx, bz, seed + index * 11 + j, {
        districtId: district.id, style, accentMat, signMat, altBuildingMat, chunkX, chunkZ
      });
    }
  });

  const treeCount = style.foliage;
  for (let i = 0; i < treeCount; i++) {
    const angle = ((seed % 17) + i * 1.65);
    const radius = 14 + ((seed + i * 13) % 19);
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    createTree(B, scene, shadowGenerator, materials, owned, x, z, `${chunkX}-${chunkZ}-${i}`);
  }

  for (const [dx, dz] of [[-6,-18],[6,18],[-18,6],[18,-6],[-6,18],[6,-18]]) {
    createLamp(B, scene, materials, owned, centerX + dx, centerZ + dz, `${chunkX}-${chunkZ}-${dx}-${dz}`, style.sign);
  }

  createTrafficLights(B, scene, materials, owned, centerX, centerZ, accentMat);

  const parkedA = createCar(B, scene, shadowGenerator, materials, `stream-parked-a-${chunkX}-${chunkZ}`, style.cars[Math.abs(seed) % style.cars.length], owned, 0.82);
  parkedA.position.set(centerX + 12, 0.12, centerZ + 16);
  parkedA.rotation.y = Math.PI / 2;

  if ((seed & 3) !== 0) {
    const parkedB = createCar(B, scene, shadowGenerator, materials, `stream-parked-b-${chunkX}-${chunkZ}`, style.cars[(Math.abs(seed) + 2) % style.cars.length], owned, 0.78);
    parkedB.position.set(centerX - 17, 0.12, centerZ - 12);
    parkedB.rotation.y = 0;
  }

  const moving = createCar(B, scene, shadowGenerator, materials, `stream-traffic-${chunkX}-${chunkZ}`, style.cars[(Math.abs(seed) + 1) % style.cars.length], owned, 0.8);
  const vertical = (seed & 1) === 0;
  const direction = (seed & 2) === 0 ? 1 : -1;
  if (vertical) {
    moving.position.set(centerX + (direction > 0 ? -2 : 2), 0.12, centerZ - direction * size * 0.42);
    moving.rotation.y = direction > 0 ? 0 : Math.PI;
    localCars.push({ root: moving, axis: 'z', direction, speed: 3.8 + (Math.abs(seed) % 4) * 0.45, min: centerZ - size / 2, max: centerZ + size / 2 });
  } else {
    moving.position.set(centerX - direction * size * 0.42, 0.12, centerZ + (direction > 0 ? 2 : -2));
    moving.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    localCars.push({ root: moving, axis: 'x', direction, speed: 3.8 + (Math.abs(seed) % 4) * 0.45, min: centerX - size / 2, max: centerX + size / 2 });
  }

  if ((seed & 7) < 4) {
    const movingB = createCar(B, scene, shadowGenerator, materials, `stream-traffic-b-${chunkX}-${chunkZ}`, style.cars[(Math.abs(seed) + 3) % style.cars.length], owned, 0.74);
    if (!vertical) {
      movingB.position.set(centerX + 2, 0.12, centerZ - direction * size * 0.34);
      movingB.rotation.y = direction > 0 ? 0 : Math.PI;
      localCars.push({ root: movingB, axis: 'z', direction, speed: 3.45 + (Math.abs(seed) % 3) * 0.4, min: centerZ - size / 2, max: centerZ + size / 2 });
    } else {
      movingB.position.set(centerX - direction * size * 0.34, 0.12, centerZ - 2);
      movingB.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      localCars.push({ root: movingB, axis: 'x', direction, speed: 3.45 + (Math.abs(seed) % 3) * 0.4, min: centerX - size / 2, max: centerX + size / 2 });
    }
  }

  activeCars.push(...localCars);

  return {
    dispose() {
      for (const car of localCars) {
        const index = activeCars.indexOf(car);
        if (index >= 0) activeCars.splice(index, 1);
      }
      for (const mesh of owned) {
        try { mesh.dispose(false, false); } catch (_) {}
      }
      try { accentMat.dispose(); } catch (_) {}
      try { signMat.dispose(); } catch (_) {}
    }
  };
}

function createFillerBuilding(B, scene, shadowGenerator, materials, owned, x, z, seed, ctx) {
  const { style, accentMat, signMat, altBuildingMat, chunkX, chunkZ } = ctx;
  const height = 8 + (Math.abs(seed * 7) % 20);
  const width = 8 + (Math.abs(seed * 3) % 7);
  const depth = 8 + (Math.abs(seed * 5) % 7);
  const buildingMat = (seed & 1) ? altBuildingMat : materials.buildingMats[Math.abs(seed) % materials.buildingMats.length];

  const building = B.MeshBuilder.CreateBox(`filler-${chunkX}-${chunkZ}-${seed}`, { width, height, depth }, scene);
  building.position.set(x, height / 2 + 0.15, z);
  building.material = buildingMat;
  building.checkCollisions = true;
  building.receiveShadows = true;
  shadowGenerator.addShadowCaster(building);
  owned.push(building);

  const inset = B.MeshBuilder.CreateBox(`filler-inset-${chunkX}-${chunkZ}-${seed}`, { width: width * 0.76, height: 0.32, depth: 0.18 }, scene);
  inset.position.set(x, 1.25, z + depth / 2 + 0.05);
  inset.material = accentMat;
  owned.push(inset);

  const awning = B.MeshBuilder.CreateBox(`filler-awning-${chunkX}-${chunkZ}-${seed}`, { width: Math.max(3.4, width * 0.54), height: 0.2, depth: 1.1 }, scene);
  awning.position.set(x, 2.7, z + depth / 2 + 0.55);
  awning.material = accentMat;
  shadowGenerator.addShadowCaster(awning);
  owned.push(awning);

  const door = B.MeshBuilder.CreateBox(`filler-door-${chunkX}-${chunkZ}-${seed}`, { width: 1.65, height: 2.85, depth: 0.08 }, scene);
  door.position.set(x, 1.45, z + depth / 2 + 0.05);
  door.material = materials.glassMat;
  owned.push(door);

  const sign = B.MeshBuilder.CreateBox(`filler-sign-${chunkX}-${chunkZ}-${seed}`, { width: Math.max(2.8, width * 0.5), height: 0.52, depth: 0.14 }, scene);
  sign.position.set(x, 3.45, z + depth / 2 + 0.18);
  sign.material = signMat;
  owned.push(sign);

  const roof = B.MeshBuilder.CreateBox(`filler-roof-${chunkX}-${chunkZ}-${seed}`, { width: width * 0.45, height: 0.7, depth: depth * 0.4 }, scene);
  roof.position.set(x + 0.8, height + 0.5, z - 0.6);
  roof.material = buildingMat;
  shadowGenerator.addShadowCaster(roof);
  owned.push(roof);

  for (let row = 0; row < Math.max(1, Math.floor(height / 3.2) - 1); row++) {
    for (const side of [-1, 1]) {
      const windowBand = B.MeshBuilder.CreateBox(`filler-window-${chunkX}-${chunkZ}-${seed}-${row}-${side}`, {
        width: Math.max(1.7, width * 0.22),
        height: 0.72,
        depth: 0.07
      }, scene);
      windowBand.position.set(x + side * width * 0.26, Math.min(height - 1.2, 4.1 + row * 2.25), z + depth / 2 + 0.05);
      windowBand.material = materials.glassMat;
      owned.push(windowBand);
    }
  }

  if ((seed & 3) === 0) {
    const cornerStrip = B.MeshBuilder.CreateBox(`filler-corner-${chunkX}-${chunkZ}-${seed}`, { width: 0.18, height: height * 0.82, depth: 0.18 }, scene);
    cornerStrip.position.set(x + width / 2 - 0.22, height * 0.5, z + depth / 2 + 0.08);
    cornerStrip.material = accentMat;
    owned.push(cornerStrip);
  }
}

function createSidewalkFurniture(B, scene, materials, owned, x, z, key, districtId, shadowGenerator) {
  const planter = B.MeshBuilder.CreateBox(`planter-${key}`, { width: 3.2, height: 0.55, depth: 1.1 }, scene);
  planter.position.set(x - 6.4, 0.38, z + 7.2);
  planter.material = materials.trunkMat;
  owned.push(planter);

  const benchSeat = B.MeshBuilder.CreateBox(`bench-seat-${key}`, { width: 1.9, height: 0.15, depth: 0.5 }, scene);
  benchSeat.position.set(x + 7.3, 0.68, z - 6.5);
  benchSeat.material = materials.trunkMat;
  owned.push(benchSeat);

  const benchBack = B.MeshBuilder.CreateBox(`bench-back-${key}`, { width: 1.9, height: 0.55, depth: 0.14 }, scene);
  benchBack.position.set(x + 7.3, 0.95, z - 6.78);
  benchBack.material = materials.trunkMat;
  owned.push(benchBack);

  if (districtId !== 'harbor') {
    const dumpster = B.MeshBuilder.CreateBox(`dumpster-${key}`, { width: 1.4, height: 1.15, depth: 1.0 }, scene);
    dumpster.position.set(x - 7.2, 0.68, z - 7.1);
    dumpster.material = materials.metalMat;
    shadowGenerator.addShadowCaster(dumpster);
    owned.push(dumpster);
  }

  for (const [dx, dz] of [[-10.8,-10.8],[10.8,-10.8],[-10.8,10.8],[10.8,10.8]]) {
    const bollard = B.MeshBuilder.CreateCylinder(`bollard-${key}-${dx}-${dz}`, { height: 0.72, diameter: 0.18, tessellation: 8 }, scene);
    bollard.position.set(x + dx, 0.44, z + dz);
    bollard.material = materials.metalMat;
    owned.push(bollard);
  }
}

function createTree(B, scene, shadowGenerator, materials, owned, x, z, name) {
  const trunk = B.MeshBuilder.CreateCylinder(`stream-tree-trunk-${name}`, { height: 2.2, diameter: 0.3, tessellation: 7 }, scene);
  trunk.position.set(x, 1.18, z);
  trunk.material = materials.trunkMat;
  shadowGenerator.addShadowCaster(trunk);
  owned.push(trunk);

  const crown = B.MeshBuilder.CreateSphere(`stream-tree-crown-${name}`, { diameter: 2.3, segments: 7 }, scene);
  crown.position.set(x, 3.0, z);
  crown.scaling.y = 1.2;
  crown.material = materials.foliageMat;
  shadowGenerator.addShadowCaster(crown);
  owned.push(crown);
}

function createLamp(B, scene, materials, owned, x, z, name, bulbColor) {
  const pole = B.MeshBuilder.CreateCylinder(`stream-lamp-${name}`, { height: 4.2, diameter: 0.1, tessellation: 7 }, scene);
  pole.position.set(x, 2.1, z);
  pole.material = materials.metalMat;
  owned.push(pole);

  const arm = B.MeshBuilder.CreateBox(`stream-lamp-arm-${name}`, { width: 0.14, height: 0.12, depth: 0.9 }, scene);
  arm.position.set(x + 0.22, 3.82, z);
  arm.material = materials.metalMat;
  owned.push(arm);

  const bulbMat = tintMaterial(B, scene, `stream-bulb-mat-${name}`, bulbColor, true);
  const bulb = B.MeshBuilder.CreateSphere(`stream-bulb-${name}`, { diameter: 0.28, segments: 6 }, scene);
  bulb.position.set(x + 0.44, 3.73, z);
  bulb.material = bulbMat;
  owned.push(bulb);
}

function createTrafficLights(B, scene, materials, owned, x, z, accentMat) {
  for (const [dx, dz, rot] of [[-4.8,-4.8,0],[4.8,-4.8,Math.PI/2],[-4.8,4.8,-Math.PI/2],[4.8,4.8,Math.PI]]) {
    const pole = B.MeshBuilder.CreateCylinder(`traffic-pole-${dx}-${dz}`, { height: 3.5, diameter: 0.11, tessellation: 8 }, scene);
    pole.position.set(x + dx, 1.8, z + dz);
    pole.material = materials.metalMat;
    owned.push(pole);

    const bar = B.MeshBuilder.CreateBox(`traffic-bar-${dx}-${dz}`, { width: 0.16, height: 0.14, depth: 1.45 }, scene);
    bar.position.set(x + dx, 3.42, z + dz);
    bar.rotation.y = rot;
    bar.material = materials.metalMat;
    owned.push(bar);

    const lamp = B.MeshBuilder.CreateBox(`traffic-lamp-${dx}-${dz}`, { width: 0.22, height: 0.6, depth: 0.18 }, scene);
    lamp.position.set(x + dx, 3.2, z + dz);
    lamp.material = accentMat;
    owned.push(lamp);
  }
}

function createCar(B, scene, shadowGenerator, materials, name, color, owned, scale = 1) {
  const root = new B.TransformNode(name, scene);
  const bodyMat = new B.StandardMaterial(`${name}-mat`, scene);
  bodyMat.diffuseColor = B.Color3.FromHexString(color);
  bodyMat.specularColor = new B.Color3(0.25, 0.25, 0.25);

  const body = B.MeshBuilder.CreateBox(`${name}-body`, { width: 1.78, height: 0.55, depth: 3.95 }, scene);
  body.parent = root;
  body.position.y = 0.55;
  body.material = bodyMat;
  shadowGenerator.addShadowCaster(body);
  owned.push(body);

  const nose = B.MeshBuilder.CreateBox(`${name}-nose`, { width: 1.55, height: 0.14, depth: 0.22 }, scene);
  nose.parent = root;
  nose.position.set(0, 0.44, 2.0);
  nose.material = materials.metalMat;
  owned.push(nose);

  const cabin = B.MeshBuilder.CreateBox(`${name}-cabin`, { width: 1.45, height: 0.55, depth: 1.65 }, scene);
  cabin.parent = root;
  cabin.position.set(0, 0.98, -0.15);
  cabin.material = materials.glassMat;
  owned.push(cabin);

  const wheels = [[-.88,.34,-1.2],[.88,.34,-1.2],[-.88,.34,1.2],[.88,.34,1.2]];
  wheels.forEach(([x, y, z], i) => {
    const wheel = B.MeshBuilder.CreateCylinder(`${name}-wheel-${i}`, { height: .24, diameter: .55, tessellation: 10 }, scene);
    wheel.parent = root;
    wheel.position.set(x, y, z);
    wheel.rotation.z = Math.PI / 2;
    wheel.material = materials.metalMat;
    owned.push(wheel);
  });

  root.scaling.setAll(scale);
  owned.push(root);
  return root;
}

function getDistrictFor(x, z) {
  let best = WORLD3D_DISTRICTS[0];
  let bestDist = Infinity;
  for (const district of WORLD3D_DISTRICTS) {
    const dx = x - district.x;
    const dz = z - district.z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      best = district;
      bestDist = d;
    }
  }
  return best;
}

function tintMaterial(B, scene, name, color, emissive = false) {
  const mat = new B.StandardMaterial(name, scene);
  const c = B.Color3.FromHexString(color);
  mat.diffuseColor = c;
  mat.specularColor = new B.Color3(0.1, 0.1, 0.1);
  if (emissive) mat.emissiveColor = c.scale(0.35);
  return mat;
}

function hash2(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return h ^ (h >>> 16);
}
