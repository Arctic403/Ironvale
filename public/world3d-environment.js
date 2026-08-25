import { WORLD3D_CONFIG, getNearbyChunkKeys } from './world3d-layout.js';

const CAR_COLORS = ['#a3483f','#445b72','#77715e','#34373c','#755064','#a07a39'];

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
  const owned = [];
  const localCars = [];
  const own = mesh => {
    owned.push(mesh);
    return mesh;
  };

  // Cross roads per streamed chunk. Adjacent chunks line up into continuous streets.
  const roadV = own(B.MeshBuilder.CreateBox(`stream-road-v-${chunkX}-${chunkZ}`, { width: 9, height: 0.055, depth: size + 1 }, scene));
  roadV.position.set(centerX, 0.048, centerZ);
  roadV.material = materials.roadMat;

  const roadH = own(B.MeshBuilder.CreateBox(`stream-road-h-${chunkX}-${chunkZ}`, { width: size + 1, height: 0.056, depth: 9 }, scene));
  roadH.position.set(centerX, 0.049, centerZ);
  roadH.material = materials.roadMat;

  for (const lane of [-2.0, 2.0]) {
    const vLine = own(B.MeshBuilder.CreateBox(`stream-vline-${chunkX}-${chunkZ}-${lane}`, { width: 0.08, height: 0.064, depth: size }, scene));
    vLine.position.set(centerX + lane, 0.086, centerZ);
    vLine.material = materials.lineMat;

    const hLine = own(B.MeshBuilder.CreateBox(`stream-hline-${chunkX}-${chunkZ}-${lane}`, { width: size, height: 0.064, depth: 0.08 }, scene));
    hLine.position.set(centerX, 0.087, centerZ + lane);
    hLine.material = materials.lineMat;
  }

  const blockOffsets = [
    [-25,-25],[25,-25],[-25,25],[25,25]
  ];

  blockOffsets.forEach(([ox, oz], index) => {
    const lot = own(B.MeshBuilder.CreateBox(`stream-lot-${chunkX}-${chunkZ}-${index}`, { width: 30, height: 0.12, depth: 30 }, scene));
    lot.position.set(centerX + ox, 0.075, centerZ + oz);
    lot.material = materials.sidewalkMat;
    lot.checkCollisions = true;

    const count = 2 + ((seed + index) % 2);
    for (let j = 0; j < count; j++) {
      const sideX = j % 2 ? 1 : -1;
      const sideZ = j < 2 ? 1 : -1;
      const bx = centerX + ox + sideX * (5.5 + ((seed + j * 7) % 4));
      const bz = centerZ + oz + sideZ * (5.5 + ((seed + j * 5) % 4));
      createFillerBuilding(B, scene, shadowGenerator, materials, owned, bx, bz, seed + index * 11 + j, chunkX, chunkZ);
    }
  });

  // Trees and lamps are sparse, deterministic and cheap.
  for (let i = 0; i < 6; i++) {
    const angle = ((seed % 17) + i * 2.4);
    const radius = 17 + ((seed + i * 13) % 15);
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    createTree(B, scene, shadowGenerator, materials, owned, x, z, `${chunkX}-${chunkZ}-${i}`);
  }

  for (const [dx, dz] of [[-6,-18],[6,18],[-18,6],[18,-6]]) {
    createLamp(B, scene, materials, owned, centerX + dx, centerZ + dz, `${chunkX}-${chunkZ}-${dx}-${dz}`);
  }

  // One parked car and one moving car per chunk keeps the city alive without exploding draw calls.
  const parked = createCar(B, scene, shadowGenerator, materials, `stream-parked-${chunkX}-${chunkZ}`, CAR_COLORS[Math.abs(seed) % CAR_COLORS.length], owned, 0.82);
  parked.position.set(centerX + 12, 0.12, centerZ + 16);
  parked.rotation.y = Math.PI / 2;

  const moving = createCar(B, scene, shadowGenerator, materials, `stream-traffic-${chunkX}-${chunkZ}`, CAR_COLORS[Math.abs(seed + 3) % CAR_COLORS.length], owned, 0.78);
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
    }
  };
}

function createFillerBuilding(B, scene, shadowGenerator, materials, owned, x, z, seed, chunkX, chunkZ) {
  const height = 8 + (Math.abs(seed * 7) % 20);
  const width = 8 + (Math.abs(seed * 3) % 6);
  const depth = 8 + (Math.abs(seed * 5) % 6);
  const mat = materials.buildingMats[Math.abs(seed) % materials.buildingMats.length];

  const building = B.MeshBuilder.CreateBox(`filler-${chunkX}-${chunkZ}-${seed}`, { width, height, depth }, scene);
  building.position.set(x, height / 2 + 0.15, z);
  building.material = mat;
  building.checkCollisions = true;
  building.receiveShadows = true;
  shadowGenerator.addShadowCaster(building);
  owned.push(building);

  const roof = B.MeshBuilder.CreateBox(`filler-roof-${chunkX}-${chunkZ}-${seed}`, { width: width * 0.45, height: 0.7, depth: depth * 0.4 }, scene);
  roof.position.set(x + 0.8, height + 0.5, z - 0.6);
  roof.material = mat;
  owned.push(roof);

  const windowBand = B.MeshBuilder.CreateBox(`filler-glass-${chunkX}-${chunkZ}-${seed}`, { width: width * 0.68, height: 0.8, depth: 0.08 }, scene);
  windowBand.position.set(x, Math.min(height - 1.1, 4.8), z + depth / 2 + 0.05);
  windowBand.material = materials.glassMat;
  owned.push(windowBand);
}

function createTree(B, scene, shadowGenerator, materials, owned, x, z, name) {
  const trunk = B.MeshBuilder.CreateCylinder(`stream-tree-trunk-${name}`, { height: 2.2, diameter: 0.3, tessellation: 7 }, scene);
  trunk.position.set(x, 1.18, z);
  trunk.material = materials.trunkMat;
  owned.push(trunk);

  const crown = B.MeshBuilder.CreateSphere(`stream-tree-crown-${name}`, { diameter: 2.3, segments: 7 }, scene);
  crown.position.set(x, 3.0, z);
  crown.scaling.y = 1.2;
  crown.material = materials.foliageMat;
  shadowGenerator.addShadowCaster(crown);
  owned.push(crown);
}

function createLamp(B, scene, materials, owned, x, z, name) {
  const pole = B.MeshBuilder.CreateCylinder(`stream-lamp-${name}`, { height: 4, diameter: 0.1, tessellation: 7 }, scene);
  pole.position.set(x, 2.05, z);
  pole.material = materials.metalMat;
  owned.push(pole);

  const bulb = B.MeshBuilder.CreateSphere(`stream-bulb-${name}`, { diameter: 0.28, segments: 6 }, scene);
  bulb.position.set(x, 4.08, z);
  bulb.material = materials.accentMat;
  owned.push(bulb);
}

function createCar(B, scene, shadowGenerator, materials, name, color, owned, scale = 1) {
  const root = new B.TransformNode(name, scene);
  const bodyMat = new B.StandardMaterial(`${name}-mat`, scene);
  bodyMat.diffuseColor = B.Color3.FromHexString(color);
  bodyMat.specularColor = new B.Color3(0.25,0.25,0.25);

  const body = B.MeshBuilder.CreateBox(`${name}-body`, { width:1.75,height:0.55,depth:3.8 }, scene);
  body.parent = root;
  body.position.y = 0.55;
  body.material = bodyMat;
  shadowGenerator.addShadowCaster(body);
  owned.push(body);

  const cabin = B.MeshBuilder.CreateBox(`${name}-cabin`, { width:1.45,height:0.55,depth:1.65 }, scene);
  cabin.parent = root;
  cabin.position.set(0,0.98,-0.15);
  cabin.material = materials.glassMat;
  owned.push(cabin);

  const wheels = [[-.88,.34,-1.2],[.88,.34,-1.2],[-.88,.34,1.2],[.88,.34,1.2]];
  wheels.forEach(([x,y,z], i) => {
    const wheel = B.MeshBuilder.CreateCylinder(`${name}-wheel-${i}`, { height:.24,diameter:.55,tessellation:10 }, scene);
    wheel.parent = root;
    wheel.position.set(x,y,z);
    wheel.rotation.z = Math.PI / 2;
    wheel.material = materials.metalMat;
    owned.push(wheel);
  });

  root.scaling.setAll(scale);
  owned.push(root);
  return root;
}

function hash2(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return h ^ (h >>> 16);
}
