import { escapeHtml } from './ui/helpers.js';

let activeWorld = null;

export function destroyCity3D() {
  if (!activeWorld) return;
  activeWorld.destroy();
  activeWorld = null;
}

export function mountCity3D({ root, world, onEnterLocation }) {
  destroyCity3D();
  const canvas = root.querySelector('#riftcity-3d-canvas');
  if (!canvas || !window.BABYLON) {
    const message = root.querySelector('#world3d-status');
    if (message) message.textContent = '3D engine failed to load. Check your connection and reload.';
    return null;
  }

  const B = window.BABYLON;
  const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, adaptToDeviceRatio: true });
  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(0.035, 0.045, 0.055, 1);
  scene.collisionsEnabled = true;
  scene.gravity = new B.Vector3(0, -0.38, 0);

  const camera = new B.ArcRotateCamera('player-camera', Math.PI * 1.5, 1.05, 11, new B.Vector3(0, 2.2, 0), scene);
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 16;
  camera.lowerBetaLimit = 0.65;
  camera.upperBetaLimit = 1.35;
  camera.wheelPrecision = 45;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);

  const hemi = new B.HemisphericLight('sky-light', new B.Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.72;
  const sun = new B.DirectionalLight('sun', new B.Vector3(-0.45, -1, 0.35), scene);
  sun.position = new B.Vector3(25, 50, -25);
  sun.intensity = 0.8;

  const shadowGenerator = new B.ShadowGenerator(1024, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 18;

  const material = (name, hex, emissive = 0) => {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = B.Color3.FromHexString(hex);
    m.specularColor = new B.Color3(0.08, 0.08, 0.08);
    if (emissive) m.emissiveColor = B.Color3.FromHexString(hex).scale(emissive);
    return m;
  };

  const roadMat = material('road', '#191d22');
  const sidewalkMat = material('sidewalk', '#34383d');
  const groundMat = material('ground', '#242922');
  const lineMat = material('road-lines', '#b98743', 0.1);
  const accentMat = material('accent', '#d68d35', 0.22);
  const glassMat = material('glass', '#203544', 0.18);
  glassMat.alpha = 0.86;

  const ground = B.MeshBuilder.CreateGround('city-ground', { width: 190, height: 190 }, scene);
  ground.material = groundMat;
  ground.checkCollisions = true;
  ground.receiveShadows = true;

  createRoadGrid(B, scene, roadMat, sidewalkMat, lineMat);

  const locationEntries = buildLocationLayout(world?.locations || []);
  const interactables = [];
  locationEntries.forEach((entry, index) => {
    const building = createBuilding(B, scene, entry, index, { accentMat, glassMat, shadowGenerator });
    interactables.push({ ...entry, mesh: building.pickMesh });
  });

  createSkyline(B, scene, material, shadowGenerator);
  createStreetLights(B, scene, accentMat);

  const player = createPlayer(B, scene, shadowGenerator);
  player.root.position = new B.Vector3(0, 0.92, 7);
  const currentId = world?.current?.locationId;
  const currentEntry = locationEntries.find(entry => entry.id === currentId);
  if (currentEntry) player.root.position = new B.Vector3(currentEntry.x, 0.92, currentEntry.z + 7);
  player.collider.position.copyFrom(player.root.position);
  player.visual.position.copyFrom(player.root.position);

  createNPCs(B, scene, shadowGenerator, 11);

  const keys = new Set();
  const touch = { forward: false, back: false, left: false, right: false, run: false, axisX: 0, axisZ: 0 };
  const onKeyDown = event => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    keys.add(event.code);
    if (event.code === 'KeyE') tryInteract();
  };
  const onKeyUp = event => keys.delete(event.code);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  root.querySelectorAll('[data-move]').forEach(button => {
    const action = button.dataset.move;
    const start = event => {
      event.preventDefault();
      touch[action] = true;
      try { button.setPointerCapture?.(event.pointerId); } catch (_) {}
    };
    const stop = event => {
      event.preventDefault();
      touch[action] = false;
      try { button.releasePointerCapture?.(event.pointerId); } catch (_) {}
    };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
  });

  const joystick = setupVirtualJoystick(root, touch);
  const interactButton = root.querySelector('#world3d-interact');
  const touchInteractButton = root.querySelector('#world3d-touch-interact');
  interactButton?.addEventListener('click', tryInteract);
  touchInteractButton?.addEventListener('click', tryInteract);

  const shell = root.querySelector('.world3d-shell');
  const fullscreenButton = root.querySelector('#world3d-fullscreen-button');
  const rotatePrompt = root.querySelector('#world3d-rotate');
  let gameMode = false;

  const updateOrientationUi = () => {
    const portrait = window.matchMedia?.('(orientation: portrait)')?.matches ?? (window.innerHeight > window.innerWidth);
    rotatePrompt?.classList.toggle('visible', gameMode && portrait && isTouchDevice());
  };

  const setGameMode = async enabled => {
    gameMode = enabled;
    document.body.classList.toggle('world3d-game-mode', enabled);
    shell?.classList.toggle('game-mode', enabled);
    fullscreenButton?.classList.toggle('active', enabled);
    if (fullscreenButton) fullscreenButton.textContent = enabled ? 'EXIT FULLSCREEN' : 'FULLSCREEN';

    if (enabled) {
      try {
        const request = shell?.requestFullscreen || shell?.webkitRequestFullscreen;
        if (request && !document.fullscreenElement && !document.webkitFullscreenElement) {
          await request.call(shell);
        }
      } catch (_) {}
      try {
        if (screen.orientation?.lock) await screen.orientation.lock('landscape');
      } catch (_) {}
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (_) {}
      try { screen.orientation?.unlock?.(); } catch (_) {}
    }

    updateOrientationUi();
    setTimeout(() => engine.resize(), 80);
  };

  fullscreenButton?.addEventListener('click', () => setGameMode(!gameMode));
  const onOrientationChange = () => {
    updateOrientationUi();
    setTimeout(() => engine.resize(), 80);
  };
  window.addEventListener('orientationchange', onOrientationChange);
  window.addEventListener('resize', onOrientationChange);
  const directoryButton = root.querySelector('#world3d-directory-button');
  const directory = root.querySelector('#world3d-directory');
  directoryButton?.addEventListener('click', () => directory?.classList.toggle('open'));
  root.querySelector('#world3d-directory-close')?.addEventListener('click', () => directory?.classList.remove('open'));
  root.querySelectorAll('[data-world3d-place]').forEach(button => button.addEventListener('click', () => {
    const target = locationEntries.find(entry => entry.id === button.dataset.world3dPlace);
    if (!target) return;
    player.root.position.x = target.x;
    player.root.position.z = target.z + 7;
    player.velocity.set(0, 0, 0);
    directory?.classList.remove('open');
  }));

  let nearest = null;
  let lastTime = performance.now();
  let entering = false;
  const status = root.querySelector('#world3d-status');
  const prompt = root.querySelector('#world3d-prompt');
  const locationLabel = root.querySelector('#world3d-location');

  function tryInteract() {
    if (!nearest || entering) return;
    entering = true;
    interactButton?.classList.add('busy');
    Promise.resolve(onEnterLocation(nearest.id)).finally(() => {
      entering = false;
      interactButton?.classList.remove('busy');
    });
  }

  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const forward = keys.has('KeyW') || keys.has('ArrowUp') || touch.forward;
    const back = keys.has('KeyS') || keys.has('ArrowDown') || touch.back;
    const left = keys.has('KeyA') || keys.has('ArrowLeft') || touch.left;
    const right = keys.has('KeyD') || keys.has('ArrowRight') || touch.right;
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.run;

    let inputX = (right ? 1 : 0) - (left ? 1 : 0);
    let inputZ = (forward ? 1 : 0) - (back ? 1 : 0);
    if (Math.abs(touch.axisX) > 0.01 || Math.abs(touch.axisZ) > 0.01) {
      inputX = touch.axisX;
      inputZ = touch.axisZ;
    }
    const inputStrength = Math.min(1, Math.hypot(inputX, inputZ));
    const moving = inputStrength > 0.04;

    if (moving) {
      const cameraForward = camera.target.subtract(camera.position);
      cameraForward.y = 0;
      cameraForward.normalize();
      const cameraRight = new B.Vector3(cameraForward.z, 0, -cameraForward.x);
      const direction = cameraForward.scale(inputZ).add(cameraRight.scale(inputX)).normalize();
      const speed = (running ? 7.1 : 4.6) * Math.max(0.32, inputStrength);
      player.velocity.x = B.Scalar.Lerp(player.velocity.x, direction.x * speed, Math.min(1, dt * 9));
      player.velocity.z = B.Scalar.Lerp(player.velocity.z, direction.z * speed, Math.min(1, dt * 9));
      const targetYaw = Math.atan2(direction.x, direction.z);
      player.visual.rotation.y = lerpAngle(player.visual.rotation.y, targetYaw, Math.min(1, dt * 10));
      player.walkTime += dt * (running ? 11 : 7.5);
      player.leftArm.rotation.x = Math.sin(player.walkTime) * 0.6;
      player.rightArm.rotation.x = -Math.sin(player.walkTime) * 0.6;
      player.leftLeg.rotation.x = -Math.sin(player.walkTime) * 0.5;
      player.rightLeg.rotation.x = Math.sin(player.walkTime) * 0.5;
    } else {
      player.velocity.x = B.Scalar.Lerp(player.velocity.x, 0, Math.min(1, dt * 11));
      player.velocity.z = B.Scalar.Lerp(player.velocity.z, 0, Math.min(1, dt * 11));
      player.leftArm.rotation.x *= 0.82;
      player.rightArm.rotation.x *= 0.82;
      player.leftLeg.rotation.x *= 0.82;
      player.rightLeg.rotation.x *= 0.82;
    }

    const motion = new B.Vector3(player.velocity.x * dt, -0.2 * dt, player.velocity.z * dt);
    player.collider.moveWithCollisions(motion);
    player.root.position.copyFrom(player.collider.position);
    player.visual.position.copyFrom(player.root.position);
    camera.target = B.Vector3.Lerp(camera.target, player.root.position.add(new B.Vector3(0, 1.55, 0)), Math.min(1, dt * 8));

    nearest = getNearest(interactables, player.root.position, 6.7);
    if (nearest) {
      prompt?.classList.add('visible');
      if (locationLabel) locationLabel.textContent = nearest.name;
      if (status) status.textContent = `Near ${nearest.name}`;
    } else {
      prompt?.classList.remove('visible');
      if (status) status.textContent = running ? 'Running through RiftCity' : 'Explore RiftCity';
    }
  });

  engine.runRenderLoop(() => scene.render());
  const resize = () => engine.resize();
  window.addEventListener('resize', resize);

  activeWorld = {
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.removeEventListener('resize', onOrientationChange);
      joystick?.destroy?.();
      document.body.classList.remove('world3d-game-mode');
      try { screen.orientation?.unlock?.(); } catch (_) {}
      try {
        if ((document.fullscreenElement === shell || document.webkitFullscreenElement === shell) && document.exitFullscreen) {
          const exiting = document.exitFullscreen();
          exiting?.catch?.(() => {});
        } else if (document.webkitFullscreenElement === shell && document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      } catch (_) {}
      scene.dispose();
      engine.dispose();
      if (activeWorld === this) activeWorld = null;
    }
  };
  return activeWorld;
}

function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
}

function setupVirtualJoystick(root, touch) {
  const zone = root.querySelector('#world3d-joystick');
  const ring = zone?.querySelector('.world3d-joystick-ring');
  const knob = root.querySelector('#world3d-joystick-knob');
  if (!zone || !ring || !knob) return null;

  let activePointer = null;
  const maxDistance = 38;

  const reset = () => {
    activePointer = null;
    touch.axisX = 0;
    touch.axisZ = 0;
    knob.style.transform = 'translate(0px, 0px)';
    zone.classList.remove('active');
  };

  const update = event => {
    if (activePointer !== event.pointerId) return;
    const rect = ring.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const distance = Math.hypot(dx, dy);
    if (distance > maxDistance) {
      dx = dx / distance * maxDistance;
      dy = dy / distance * maxDistance;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.axisX = dx / maxDistance;
    touch.axisZ = -dy / maxDistance;
  };

  const down = event => {
    event.preventDefault();
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    zone.classList.add('active');
    try { zone.setPointerCapture?.(event.pointerId); } catch (_) {}
    update(event);
  };

  const move = event => {
    if (activePointer !== event.pointerId) return;
    event.preventDefault();
    update(event);
  };

  const up = event => {
    if (activePointer !== event.pointerId) return;
    event.preventDefault();
    try { zone.releasePointerCapture?.(event.pointerId); } catch (_) {}
    reset();
  };

  zone.addEventListener('pointerdown', down);
  zone.addEventListener('pointermove', move);
  zone.addEventListener('pointerup', up);
  zone.addEventListener('pointercancel', up);

  return {
    destroy() {
      zone.removeEventListener('pointerdown', down);
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerup', up);
      zone.removeEventListener('pointercancel', up);
      reset();
    }
  };
}

function createRoadGrid(B, scene, roadMat, sidewalkMat, lineMat) {
  const roadPositions = [-56, -28, 0, 28, 56];
  roadPositions.forEach(x => {
    const road = B.MeshBuilder.CreateBox(`road-v-${x}`, { width: 9, height: 0.07, depth: 190 }, scene);
    road.position.set(x, 0.045, 0);
    road.material = roadMat;
    const line = B.MeshBuilder.CreateBox(`line-v-${x}`, { width: 0.15, height: 0.08, depth: 190 }, scene);
    line.position.set(x, 0.09, 0);
    line.material = lineMat;
  });
  roadPositions.forEach(z => {
    const road = B.MeshBuilder.CreateBox(`road-h-${z}`, { width: 190, height: 0.075, depth: 9 }, scene);
    road.position.set(0, 0.05, z);
    road.material = roadMat;
    const line = B.MeshBuilder.CreateBox(`line-h-${z}`, { width: 190, height: 0.08, depth: 0.15 }, scene);
    line.position.set(0, 0.095, z);
    line.material = lineMat;
  });
  const blockCenters = [-70, -42, -14, 14, 42, 70];
  blockCenters.forEach(x => blockCenters.forEach(z => {
    const pad = B.MeshBuilder.CreateBox(`sidewalk-${x}-${z}`, { width: 17.2, height: 0.16, depth: 17.2 }, scene);
    pad.position.set(x, 0.08, z);
    pad.material = sidewalkMat;
    pad.checkCollisions = true;
  }));
}

function buildLocationLayout(locations) {
  const pads = [];
  const blockCenters = [-70, -42, -14, 14, 42, 70];
  blockCenters.forEach(x => blockCenters.forEach(z => pads.push({ x, z })));
  const ordered = [...locations].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return ordered.slice(0, pads.length).map((location, index) => ({
    id: location.id,
    name: location.name,
    code: location.code,
    type: location.type,
    status: location.status,
    categoryId: location.categoryId,
    shortDescription: location.shortDescription,
    ...pads[index]
  }));
}

function createBuilding(B, scene, entry, index, { accentMat, glassMat, shadowGenerator }) {
  const heights = [6, 8, 10, 12, 15, 18];
  const height = heights[index % heights.length];
  const width = 11 + (index % 3) * 1.6;
  const depth = 10 + ((index + 1) % 3) * 1.4;
  const shellMat = new B.StandardMaterial(`building-mat-${index}`, scene);
  const base = 0.12 + (index % 4) * 0.035;
  shellMat.diffuseColor = new B.Color3(base, base + 0.015, base + 0.025);
  shellMat.specularColor = new B.Color3(0.05, 0.05, 0.05);

  const building = B.MeshBuilder.CreateBox(`building-${entry.id}`, { width, height, depth }, scene);
  building.position.set(entry.x, height / 2 + 0.17, entry.z);
  building.material = shellMat;
  building.checkCollisions = true;
  building.receiveShadows = true;
  shadowGenerator.addShadowCaster(building);

  const door = B.MeshBuilder.CreateBox(`door-${entry.id}`, { width: 2.15, height: 3.2, depth: 0.12 }, scene);
  door.position.set(entry.x, 1.76, entry.z + depth / 2 + 0.07);
  door.material = glassMat;

  const canopy = B.MeshBuilder.CreateBox(`canopy-${entry.id}`, { width: 4.1, height: 0.22, depth: 1.35 }, scene);
  canopy.position.set(entry.x, 3.6, entry.z + depth / 2 + 0.65);
  canopy.material = accentMat;
  shadowGenerator.addShadowCaster(canopy);

  for (let floor = 0; floor < Math.max(1, Math.floor(height / 3) - 1); floor++) {
    for (const side of [-1, 1]) {
      const window = B.MeshBuilder.CreateBox(`window-${entry.id}-${floor}-${side}`, { width: 2.4, height: 1.15, depth: 0.08 }, scene);
      window.position.set(entry.x + side * width * 0.25, 5 + floor * 2.5, entry.z + depth / 2 + 0.05);
      window.material = glassMat;
    }
  }

  const signPlane = B.MeshBuilder.CreatePlane(`sign-${entry.id}`, { width: Math.min(width - 1, 9), height: 1.4 }, scene);
  signPlane.position.set(entry.x, Math.min(height - 1.2, 5.05), entry.z + depth / 2 + 0.11);
  const signMat = new B.StandardMaterial(`sign-mat-${entry.id}`, scene);
  const texture = new B.DynamicTexture(`sign-texture-${entry.id}`, { width: 1024, height: 256 }, scene, false);
  texture.hasAlpha = true;
  texture.drawText(entry.name.toUpperCase().slice(0, 28), null, 165, 'bold 64px Arial', '#f3d2a0', '#151719', true, true);
  signMat.diffuseTexture = texture;
  signMat.emissiveTexture = texture;
  signMat.opacityTexture = texture;
  signPlane.material = signMat;

  const marker = B.MeshBuilder.CreateCylinder(`marker-${entry.id}`, { height: 0.16, diameter: 3.3, tessellation: 40 }, scene);
  marker.position.set(entry.x, 0.2, entry.z + depth / 2 + 2.0);
  marker.material = accentMat;
  return { pickMesh: marker };
}

function createSkyline(B, scene, material, shadowGenerator) {
  const skylineMat = material('skyline', '#11151a');
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const radius = 108 + (i % 4) * 4;
    const height = 16 + (i % 7) * 5;
    const tower = B.MeshBuilder.CreateBox(`skyline-${i}`, { width: 8 + (i % 3) * 3, height, depth: 9 }, scene);
    tower.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    tower.material = skylineMat;
    shadowGenerator.addShadowCaster(tower);
  }
}

function createStreetLights(B, scene, accentMat) {
  for (const x of [-49, -35, -21, -7, 7, 21, 35, 49]) {
    for (const z of [-49, -21, 7, 35]) {
      const pole = B.MeshBuilder.CreateCylinder(`lamp-${x}-${z}`, { height: 4.2, diameter: 0.12 }, scene);
      pole.position.set(x, 2.15, z);
      const bulb = B.MeshBuilder.CreateSphere(`bulb-${x}-${z}`, { diameter: 0.34, segments: 8 }, scene);
      bulb.position.set(x, 4.3, z);
      bulb.material = accentMat;
    }
  }
}

function createPlayer(B, scene, shadowGenerator) {
  const root = new B.TransformNode('player-root', scene);
  const visual = new B.TransformNode('player-visual', scene);
  const bodyMat = new B.StandardMaterial('player-jacket', scene);
  bodyMat.diffuseColor = B.Color3.FromHexString('#252a30');
  const skinMat = new B.StandardMaterial('player-skin', scene);
  skinMat.diffuseColor = B.Color3.FromHexString('#c18c69');
  const accent = new B.StandardMaterial('player-accent', scene);
  accent.diffuseColor = B.Color3.FromHexString('#d68d35');

  const torso = B.MeshBuilder.CreateBox('player-torso', { width: 0.85, height: 1.1, depth: 0.42 }, scene);
  torso.parent = visual;
  torso.position.y = 1.55;
  torso.material = bodyMat;
  const head = B.MeshBuilder.CreateSphere('player-head', { diameter: 0.58, segments: 16 }, scene);
  head.parent = visual;
  head.position.y = 2.42;
  head.material = skinMat;
  const leftArm = limb(B, scene, visual, -0.56, 1.55, bodyMat, 'left-arm');
  const rightArm = limb(B, scene, visual, 0.56, 1.55, bodyMat, 'right-arm');
  const leftLeg = limb(B, scene, visual, -0.22, 0.6, accent, 'left-leg', 0.9);
  const rightLeg = limb(B, scene, visual, 0.22, 0.6, accent, 'right-leg', 0.9);
  [torso, head, leftArm, rightArm, leftLeg, rightLeg].forEach(mesh => shadowGenerator.addShadowCaster(mesh));

  const collider = B.MeshBuilder.CreateCapsule('player-collider', { radius: 0.38, height: 1.8 }, scene);
  collider.isVisible = false;
  collider.checkCollisions = true;
  collider.ellipsoid = new B.Vector3(0.38, 0.9, 0.38);
  collider.ellipsoidOffset = new B.Vector3(0, 0.9, 0);
  collider.position.copyFrom(root.position);
  return { root, visual, collider, leftArm, rightArm, leftLeg, rightLeg, velocity: new B.Vector3(), walkTime: 0 };
}

function limb(B, scene, parent, x, y, mat, name, length = 0.95) {
  const mesh = B.MeshBuilder.CreateBox(name, { width: 0.25, height: length, depth: 0.25 }, scene);
  mesh.parent = parent;
  mesh.position.set(x, y, 0);
  mesh.material = mat;
  return mesh;
}

function createNPCs(B, scene, shadowGenerator, count) {
  const mat = new B.StandardMaterial('npc-mat', scene);
  mat.diffuseColor = B.Color3.FromHexString('#5b6872');
  for (let i = 0; i < count; i++) {
    const npc = B.MeshBuilder.CreateCapsule(`npc-${i}`, { radius: 0.34, height: 1.75 }, scene);
    npc.position.set(-55 + (i * 13) % 105, 0.9, -48 + (i * 19) % 96);
    npc.material = mat;
    shadowGenerator.addShadowCaster(npc);
    const axis = i % 2 ? 'x' : 'z';
    const origin = npc.position[axis];
    const phase = i * 0.71;
    scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.00018 + phase;
      npc.position[axis] = origin + Math.sin(t * 5) * (4 + (i % 4));
    });
  }
}

function getNearest(entries, position, maxDistance) {
  let nearest = null;
  let nearestDistance = maxDistance;
  for (const entry of entries) {
    const dx = position.x - entry.mesh.position.x;
    const dz = position.z - entry.mesh.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < nearestDistance) {
      nearest = entry;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function lerpAngle(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

export function renderWorldDirectory(world) {
  const locations = world?.locations || [];
  const categories = world?.categories || [];
  return categories.map(category => {
    const rows = locations.filter(location => location.categoryId === category.id);
    if (!rows.length) return '';
    return `<section class="world3d-directory-group"><header><strong>${escapeHtml(category.name)}</strong><span>${rows.length}</span></header>${rows.map(location => `<button data-world3d-place="${escapeHtml(location.id)}"><span>${escapeHtml(location.code)}</span><b>${escapeHtml(location.name)}</b><small>${escapeHtml(location.type)}</small></button>`).join('')}</section>`;
  }).join('');
}
