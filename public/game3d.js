import { escapeHtml } from './ui/helpers.js';
import { WORLD3D_CONFIG, WORLD3D_DISTRICTS, buildWorldLayout, getNearbyChunkKeys, getChunkKey } from './world3d-layout.js';
import { createStreamedEnvironment } from './world3d-environment.js';
import { cloneCityLayout, createLayoutObjectManager, mountWorldEditor } from './world3d-editor.js';

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
  scene.clearColor = new B.Color4(0.028, 0.036, 0.047, 1);
  scene.collisionsEnabled = true;
  scene.gravity = new B.Vector3(0, -0.38, 0);
  scene.fogMode = B.Scene.FOGMODE_LINEAR;
  scene.fogColor = new B.Color3(0.055, 0.07, 0.085);
  scene.fogStart = 72;
  scene.fogEnd = 175;
  scene.imageProcessingConfiguration.contrast = 1.12;
  scene.imageProcessingConfiguration.exposure = 1.04;

  const camera = new B.ArcRotateCamera('player-camera', Math.PI * 1.5, 1.0, 9.4, new B.Vector3(0, 1.7, 0), scene);
  camera.lowerRadiusLimit = 4.6;
  camera.upperRadiusLimit = 13;
  camera.lowerBetaLimit = 0.58;
  camera.upperBetaLimit = 1.22;
  camera.wheelPrecision = 45;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);

  const hemi = new B.HemisphericLight('sky-light', new B.Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.66;
  hemi.groundColor = new B.Color3(0.08, 0.09, 0.11);
  const sun = new B.DirectionalLight('sun', new B.Vector3(-0.45, -1, 0.35), scene);
  sun.position = new B.Vector3(25, 50, -25);
  sun.intensity = 0.92;

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
  const curbMat = material('curb', '#585b5f');
  const foliageMat = material('foliage', '#304337');
  const trunkMat = material('trunk', '#4a372b');
  const metalMat = material('metal', '#24282c');
  const buildingMats = [
    material('filler-building-0', '#171b20'),
    material('filler-building-1', '#1d2126'),
    material('filler-building-2', '#20252a'),
    material('filler-building-3', '#262328')
  ];
  glassMat.alpha = 0.86;

  const ground = B.MeshBuilder.CreateGround('city-ground', { width: WORLD3D_CONFIG.worldSize, height: WORLD3D_CONFIG.worldSize }, scene);
  ground.material = groundMat;
  ground.checkCollisions = true;
  ground.receiveShadows = true;

  const editorInitialLayout = cloneCityLayout();
  const locationEntries = buildWorldLayout(world?.locations || [], editorInitialLayout.locationOverrides);
  const interactables = locationEntries;
  const chunkManager = createLocationChunkManager({
    entries: locationEntries,
    create: (entry, index) => createBuilding(B, scene, entry, index, { accentMat, glassMat, shadowGenerator })
  });

  createSkyline(B, scene, material, shadowGenerator);

  const environmentManager = createStreamedEnvironment(B, scene, shadowGenerator, {
    roadMat, sidewalkMat, groundMat, lineMat, accentMat, glassMat, foliageMat, trunkMat, metalMat, buildingMats
  }, editorInitialLayout.environmentOverrides);

  const layoutObjectManager = createLayoutObjectManager(B, scene, shadowGenerator, {
    roadMat, sidewalkMat, groundMat, lineMat, accentMat, glassMat, foliageMat, trunkMat, metalMat, buildingMats
  }, editorInitialLayout.customObjects);

  const player = createPlayer(B, scene, shadowGenerator);
  player.root.position = new B.Vector3(0, 0.92, 7);
  const currentId = world?.current?.locationId;
  const currentEntry = locationEntries.find(entry => entry.id === currentId);
  if (currentEntry) player.root.position = new B.Vector3(currentEntry.x, 0.92, currentEntry.z + 7);
  player.collider.position.copyFrom(player.root.position);
  player.visual.position.copyFrom(player.root.position);
  chunkManager.update(player.root.position.x, player.root.position.z);
  environmentManager.update(player.root.position.x, player.root.position.z);

  createNPCs(B, scene, shadowGenerator, 11);

  const keys = new Set();
  const touch = { forward: false, back: false, left: false, right: false, run: false, axisX: 0, axisZ: 0 };
  const onKeyDown = event => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (root.querySelector('#world3d-editor')?.classList.contains('open')) return;
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
    setTimeout(() => {
      if (!enabled) syncViewport?.();
      engine.resize();
    }, 80);
  };

  fullscreenButton?.addEventListener('click', () => setGameMode(!gameMode));
  const onOrientationChange = () => {
    updateOrientationUi();
    setTimeout(() => engine.resize(), 80);
  };
  window.addEventListener('orientationchange', onOrientationChange);
  window.addEventListener('resize', onOrientationChange);

  const syncViewport = () => {
    if (!shell || gameMode) return;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const shellTop = Math.max(0, shell.getBoundingClientRect().top);
    const mobileNav = document.querySelector('#mobile-nav');
    const navHeight = mobileNav && getComputedStyle(mobileNav).display !== 'none'
      ? mobileNav.getBoundingClientRect().height
      : 0;
    const safeGap = 4;
    const available = Math.max(320, Math.floor(viewportHeight - shellTop - navHeight - safeGap));
    shell.style.height = `${available}px`;
    root.style.height = `${available}px`;
    engine.resize();
  };
  const visualViewport = window.visualViewport;
  visualViewport?.addEventListener('resize', syncViewport);
  visualViewport?.addEventListener('scroll', syncViewport);
  setTimeout(syncViewport, 0);

  const directoryButton = root.querySelector('#world3d-directory-button');
  const directory = root.querySelector('#world3d-directory');
  directoryButton?.addEventListener('click', () => directory?.classList.toggle('open'));
  root.querySelector('#world3d-directory-close')?.addEventListener('click', () => directory?.classList.remove('open'));
  root.querySelectorAll('[data-world3d-place]').forEach(button => button.addEventListener('click', () => {
    const target = locationEntries.find(entry => entry.id === button.dataset.world3dPlace);
    if (!target) return;
    player.root.position.x = target.x;
    player.root.position.z = target.z + 7;
    player.collider.position.copyFrom(player.root.position);
    player.visual.position.copyFrom(player.root.position);
    player.velocity.set(0, 0, 0);
    chunkManager.update(player.root.position.x, player.root.position.z);
    environmentManager.update(player.root.position.x, player.root.position.z);
    directory?.classList.remove('open');
  }));

  const worldEditor = mountWorldEditor({
    B,
    root,
    scene,
    camera,
    player,
    locationEntries,
    chunkManager,
    environmentManager,
    objectManager: layoutObjectManager,
    initialLayout: editorInitialLayout,
    onLayoutChange: layout => {
      environmentManager.setOverrides(layout.environmentOverrides || {});
      chunkManager.update(player.root.position.x, player.root.position.z);
    }
  });

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

    const editingWorld = worldEditor?.isEditing?.() === true;
    const forward = !editingWorld && (keys.has('KeyW') || keys.has('ArrowUp') || touch.forward);
    const back = !editingWorld && (keys.has('KeyS') || keys.has('ArrowDown') || touch.back);
    const left = !editingWorld && (keys.has('KeyA') || keys.has('ArrowLeft') || touch.left);
    const right = !editingWorld && (keys.has('KeyD') || keys.has('ArrowRight') || touch.right);
    const running = !editingWorld && (keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.run);

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
    chunkManager.update(player.root.position.x, player.root.position.z);
    environmentManager.update(player.root.position.x, player.root.position.z);
    camera.target = B.Vector3.Lerp(camera.target, player.root.position.add(new B.Vector3(0, 1.35, 0)), Math.min(1, dt * 9.5));

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
      visualViewport?.removeEventListener('resize', syncViewport);
      visualViewport?.removeEventListener('scroll', syncViewport);
      joystick?.destroy?.();
      worldEditor?.dispose?.();
      chunkManager.dispose();
      environmentManager.dispose();
      layoutObjectManager.dispose();
      root.style.height = '';
      shell?.style.removeProperty('height');
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

function createRoadGrid(B, scene, roadMat, sidewalkMat, lineMat, curbMat, originX = 0, originZ = 0, extent = 190) {
  const roadPositions = [-56, -28, 0, 28, 56];
  roadPositions.forEach(localX => {
    const x = originX + localX;
    const road = B.MeshBuilder.CreateBox(`road-v-${originX}-${originZ}-${localX}`, { width: 9, height: 0.07, depth: extent }, scene);
    road.position.set(x, 0.045, originZ);
    road.material = roadMat;

    for (const lane of [-2.15, 2.15]) {
      const line = B.MeshBuilder.CreateBox(`lane-v-${originX}-${originZ}-${localX}-${lane}`, { width: 0.09, height: 0.082, depth: extent }, scene);
      line.position.set(x + lane, 0.092, originZ);
      line.material = lineMat;
    }
    for (const side of [-1, 1]) {
      const curb = B.MeshBuilder.CreateBox(`curb-v-${originX}-${originZ}-${localX}-${side}`, { width: 0.22, height: 0.22, depth: extent }, scene);
      curb.position.set(x + side * 4.62, 0.13, originZ);
      curb.material = curbMat;
      curb.checkCollisions = true;
    }
  });

  roadPositions.forEach(localZ => {
    const z = originZ + localZ;
    const road = B.MeshBuilder.CreateBox(`road-h-${originX}-${originZ}-${localZ}`, { width: extent, height: 0.075, depth: 9 }, scene);
    road.position.set(originX, 0.05, z);
    road.material = roadMat;

    for (const lane of [-2.15, 2.15]) {
      const line = B.MeshBuilder.CreateBox(`lane-h-${originX}-${originZ}-${localZ}-${lane}`, { width: extent, height: 0.082, depth: 0.09 }, scene);
      line.position.set(originX, 0.093, z + lane);
      line.material = lineMat;
    }
    for (const side of [-1, 1]) {
      const curb = B.MeshBuilder.CreateBox(`curb-h-${originX}-${originZ}-${localZ}-${side}`, { width: extent, height: 0.22, depth: 0.22 }, scene);
      curb.position.set(originX, 0.13, z + side * 4.62);
      curb.material = curbMat;
      curb.checkCollisions = true;
    }
  });

  const blockCenters = [-70, -42, -14, 14, 42, 70];
  blockCenters.forEach(localX => blockCenters.forEach(localZ => {
    const pad = B.MeshBuilder.CreateBox(`sidewalk-${originX}-${originZ}-${localX}-${localZ}`, { width: 17.2, height: 0.16, depth: 17.2 }, scene);
    pad.position.set(originX + localX, 0.08, originZ + localZ);
    pad.material = sidewalkMat;
    pad.checkCollisions = true;
  }));

  for (const localX of roadPositions) {
    for (const localZ of roadPositions) {
      const x = originX + localX;
      const z = originZ + localZ;
      for (const offset of [-3.15, 3.15]) {
        const crossA = B.MeshBuilder.CreateBox(`cross-a-${originX}-${originZ}-${localX}-${localZ}-${offset}`, { width: 0.32, height: 0.085, depth: 2.3 }, scene);
        crossA.position.set(x + offset, 0.097, z);
        crossA.material = lineMat;
        const crossB = B.MeshBuilder.CreateBox(`cross-b-${originX}-${originZ}-${localX}-${localZ}-${offset}`, { width: 2.3, height: 0.085, depth: 0.32 }, scene);
        crossB.position.set(x, 0.097, z + offset);
        crossB.material = lineMat;
      }
    }
  }
}

function createBuilding(B, scene, entry, index, { accentMat, glassMat, shadowGenerator }) {
  const ownedMeshes = [];
  const own = mesh => {
    ownedMeshes.push(mesh);
    return mesh;
  };

  const heights = [6, 8, 10, 12, 15, 18];
  const height = heights[index % heights.length];
  const width = 11 + (index % 3) * 1.6;
  const depth = 10 + ((index + 1) % 3) * 1.4;
  const shellMat = new B.StandardMaterial(`building-mat-${entry.id}`, scene);
  const base = 0.12 + (index % 4) * 0.035;
  shellMat.diffuseColor = new B.Color3(base, base + 0.015, base + 0.025);
  shellMat.specularColor = new B.Color3(0.05, 0.05, 0.05);

  const building = own(B.MeshBuilder.CreateBox(`building-${entry.id}`, { width, height, depth }, scene));
  building.position.set(entry.x, height / 2 + 0.17, entry.z);
  building.material = shellMat;
  building.checkCollisions = true;
  building.receiveShadows = true;
  shadowGenerator.addShadowCaster(building);

  const roof = own(B.MeshBuilder.CreateBox(`roof-${entry.id}`, {
    width: Math.max(3.5, width * 0.48),
    height: 0.65 + (index % 3) * 0.22,
    depth: Math.max(3.2, depth * 0.42)
  }, scene));
  roof.position.set(entry.x + ((index % 2) ? 1.2 : -1.1), height + 0.48, entry.z - 0.4);
  roof.material = shellMat;
  shadowGenerator.addShadowCaster(roof);

  for (const side of [-1, 1]) {
    const trim = own(B.MeshBuilder.CreateBox(`facade-trim-${entry.id}-${side}`, { width: 0.16, height: height * 0.82, depth: 0.16 }, scene));
    trim.position.set(entry.x + side * (width / 2 - 0.28), height * 0.52, entry.z + depth / 2 + 0.08);
    trim.material = accentMat;
  }

  const door = own(B.MeshBuilder.CreateBox(`door-${entry.id}`, { width: 2.15, height: 3.2, depth: 0.12 }, scene));
  door.position.set(entry.x, 1.76, entry.z + depth / 2 + 0.07);
  door.material = glassMat;

  const canopy = own(B.MeshBuilder.CreateBox(`canopy-${entry.id}`, { width: 4.1, height: 0.22, depth: 1.35 }, scene));
  canopy.position.set(entry.x, 3.6, entry.z + depth / 2 + 0.65);
  canopy.material = accentMat;
  shadowGenerator.addShadowCaster(canopy);

  for (let floor = 0; floor < Math.max(1, Math.floor(height / 3) - 1); floor++) {
    for (const side of [-1, 1]) {
      const windowMesh = own(B.MeshBuilder.CreateBox(`window-${entry.id}-${floor}-${side}`, { width: 2.4, height: 1.15, depth: 0.08 }, scene));
      windowMesh.position.set(entry.x + side * width * 0.25, 5 + floor * 2.5, entry.z + depth / 2 + 0.05);
      windowMesh.material = glassMat;
    }
  }

  const signPlane = own(B.MeshBuilder.CreatePlane(`sign-${entry.id}`, { width: Math.min(width - 1, 9), height: 1.4 }, scene));
  signPlane.position.set(entry.x, Math.min(height - 1.2, 5.05), entry.z + depth / 2 + 0.11);
  const signMat = new B.StandardMaterial(`sign-mat-${entry.id}`, scene);
  const texture = new B.DynamicTexture(`sign-texture-${entry.id}`, { width: 1024, height: 256 }, scene, false);
  texture.hasAlpha = true;
  texture.drawText(entry.name.toUpperCase().slice(0, 28), null, 165, 'bold 64px Arial', '#f3d2a0', '#151719', true, true);
  signMat.diffuseTexture = texture;
  signMat.emissiveTexture = texture;
  signMat.opacityTexture = texture;
  signPlane.material = signMat;

  const marker = own(B.MeshBuilder.CreateCylinder(`marker-${entry.id}`, { height: 0.16, diameter: 3.3, tessellation: 40 }, scene));
  marker.position.set(entry.x, 0.2, entry.z + depth / 2 + 2.0);
  marker.material = accentMat;

  ownedMeshes.forEach(mesh => {
    mesh.metadata = { ...(mesh.metadata || {}), worldEditor: { kind: 'location', id: entry.id } };
  });

  return {
    pickMesh: marker,
    dispose() {
      ownedMeshes.forEach(mesh => {
        try { mesh.dispose(false, false); } catch (_) {}
      });
      try { texture.dispose(); } catch (_) {}
      try { signMat.dispose(); } catch (_) {}
      try { shellMat.dispose(); } catch (_) {}
    }
  };
}

function createLocationChunkManager({ entries, create }) {
  const active = new Map();
  let lastCenter = '';

  const update = (x, z) => {
    const wanted = new Set(getNearbyChunkKeys(x, z));
    const center = `${Math.floor(x / WORLD3D_CONFIG.chunkSize)}:${Math.floor(z / WORLD3D_CONFIG.chunkSize)}`;
    if (center === lastCenter && active.size) return;
    lastCenter = center;

    for (const [id, record] of active) {
      if (wanted.has(record.entry.chunkKey)) continue;
      record.bundle.dispose();
      record.entry.mesh = null;
      active.delete(id);
    }

    entries.forEach((entry, index) => {
      entry.chunkKey = getChunkKey(entry.x, entry.z);
      if (!wanted.has(entry.chunkKey) || active.has(entry.id)) return;
      const bundle = create(entry, index);
      entry.mesh = bundle.pickMesh;
      active.set(entry.id, { entry, bundle, index });
    });
  };

  const refreshEntry = id => {
    const entry = entries.find(row => row.id === id);
    if (!entry) return;
    entry.chunkKey = getChunkKey(entry.x, entry.z);
    const existing = active.get(id);
    if (existing) {
      existing.bundle.dispose();
      entry.mesh = null;
      active.delete(id);
    }
    lastCenter = '';
  };

  return {
    update,
    refreshEntry,
    dispose() {
      for (const record of active.values()) {
        record.bundle.dispose();
        record.entry.mesh = null;
      }
      active.clear();
    }
  };
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

function createCityProps(B, scene, { foliageMat, trunkMat, sidewalkMat, shadowGenerator }) {
  const treeSpots = [
    [-49,-42],[-35,-42],[-21,-14],[-7,-14],[7,14],[21,14],[35,42],[49,42],
    [-70,-49],[-42,-21],[-14,7],[14,35],[42,-49],[70,-21],[-70,35],[70,7]
  ];
  treeSpots.forEach(([x,z], index) => {
    const trunk = B.MeshBuilder.CreateCylinder(`tree-trunk-${index}`, { height: 2.4, diameter: 0.34, tessellation: 8 }, scene);
    trunk.position.set(x, 1.25, z);
    trunk.material = trunkMat;
    const crown = B.MeshBuilder.CreateSphere(`tree-crown-${index}`, { diameter: 2.5 + (index % 3) * 0.25, segments: 8 }, scene);
    crown.scaling.y = 1.25;
    crown.position.set(x, 3.15, z);
    crown.material = foliageMat;
    shadowGenerator.addShadowCaster(trunk);
    shadowGenerator.addShadowCaster(crown);
  });

  const benchSpots = [[-35,-7],[-7,21],[21,-35],[49,21],[-49,49],[7,-49]];
  benchSpots.forEach(([x,z], index) => {
    const seat = B.MeshBuilder.CreateBox(`bench-seat-${index}`, { width: 2.1, height: 0.18, depth: 0.58 }, scene);
    seat.position.set(x, 0.68, z);
    seat.material = trunkMat;
    const back = B.MeshBuilder.CreateBox(`bench-back-${index}`, { width: 2.1, height: 0.72, depth: 0.14 }, scene);
    back.position.set(x, 1.03, z - 0.28);
    back.material = trunkMat;
  });

  const bollardSpots = [-42,-14,14,42];
  for (const x of bollardSpots) {
    for (const z of [-63,63]) {
      const bollard = B.MeshBuilder.CreateCylinder(`bollard-${x}-${z}`, { height: 0.8, diameter: 0.22, tessellation: 10 }, scene);
      bollard.position.set(x, 0.48, z);
      bollard.material = sidewalkMat;
    }
  }
}

function createCar(B, scene, shadowGenerator, name, color, scale = 1) {
  const root = new B.TransformNode(name, scene);
  const bodyMat = new B.StandardMaterial(`${name}-body-mat`, scene);
  bodyMat.diffuseColor = B.Color3.FromHexString(color);
  bodyMat.specularColor = new B.Color3(0.32, 0.32, 0.32);

  const darkMat = new B.StandardMaterial(`${name}-dark-mat`, scene);
  darkMat.diffuseColor = B.Color3.FromHexString('#111820');
  darkMat.specularColor = new B.Color3(0.18, 0.18, 0.18);

  const body = B.MeshBuilder.CreateBox(`${name}-body`, { width: 1.85, height: 0.62, depth: 4.15 }, scene);
  body.parent = root;
  body.position.y = 0.58;
  body.material = bodyMat;

  const cabin = B.MeshBuilder.CreateBox(`${name}-cabin`, { width: 1.62, height: 0.65, depth: 1.85 }, scene);
  cabin.parent = root;
  cabin.position.set(0, 1.08, -0.15);
  cabin.material = darkMat;

  const bumperFront = B.MeshBuilder.CreateBox(`${name}-front`, { width: 1.7, height: 0.18, depth: 0.16 }, scene);
  bumperFront.parent = root;
  bumperFront.position.set(0, 0.45, 2.1);
  bumperFront.material = darkMat;

  const wheelPositions = [[-0.93,0.36,-1.35],[0.93,0.36,-1.35],[-0.93,0.36,1.35],[0.93,0.36,1.35]];
  wheelPositions.forEach(([x,y,z], index) => {
    const wheel = B.MeshBuilder.CreateCylinder(`${name}-wheel-${index}`, { height: 0.28, diameter: 0.62, tessellation: 12 }, scene);
    wheel.parent = root;
    wheel.position.set(x,y,z);
    wheel.rotation.z = Math.PI / 2;
    wheel.material = darkMat;
  });

  root.scaling.setAll(scale);
  [body, cabin].forEach(mesh => shadowGenerator.addShadowCaster(mesh));
  return root;
}

function createTraffic(B, scene, shadowGenerator) {
  const colors = ['#a93e37','#c7c8ca','#2f536f','#6e7142','#8a5e39','#373a3e','#7d394d','#b08a3f'];
  const traffic = [];
  const lanes = [-56,-28,0,28,56];

  for (let i = 0; i < 10; i++) {
    const vertical = i % 2 === 0;
    const road = lanes[(i * 2 + 1) % lanes.length];
    const direction = i % 4 < 2 ? 1 : -1;
    const car = createCar(B, scene, shadowGenerator, `traffic-car-${i}`, colors[i % colors.length], 0.88 + (i % 3) * 0.05);
    const laneOffset = direction > 0 ? -2.05 : 2.05;
    const start = -86 + (i * 19) % 172;
    if (vertical) {
      car.position.set(road + laneOffset, 0.12, start);
      car.rotation.y = direction > 0 ? 0 : Math.PI;
    } else {
      car.position.set(start, 0.12, road - laneOffset);
      car.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    traffic.push({ car, vertical, direction, speed: 4.2 + (i % 4) * 0.65 });
  }

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    for (const item of traffic) {
      if (item.vertical) {
        item.car.position.z += item.direction * item.speed * dt;
        if (item.car.position.z > 94) item.car.position.z = -94;
        if (item.car.position.z < -94) item.car.position.z = 94;
      } else {
        item.car.position.x += item.direction * item.speed * dt;
        if (item.car.position.x > 94) item.car.position.x = -94;
        if (item.car.position.x < -94) item.car.position.x = 94;
      }
    }
  });
}

function createParkedCars(B, scene, shadowGenerator) {
  const colors = ['#4f5962','#8b3f38','#334b63','#70634f','#2e3034','#8a824d'];
  const spots = [
    [-66,-58,Math.PI/2],[-38,-30,Math.PI/2],[-10,-2,Math.PI/2],[18,26,Math.PI/2],
    [46,54,Math.PI/2],[58,-66,0],[30,-38,0],[2,-10,0],[-26,18,0],[-54,46,0]
  ];
  spots.forEach(([x,z,rotation], index) => {
    const car = createCar(B, scene, shadowGenerator, `parked-car-${index}`, colors[index % colors.length], 0.86);
    car.position.set(x, 0.12, z);
    car.rotation.y = rotation;
  });
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
  const shoeMat = new B.StandardMaterial('player-shoe', scene);
  shoeMat.diffuseColor = B.Color3.FromHexString('#191d22');

  const torso = B.MeshBuilder.CreateBox('player-torso', { width: 0.82, height: 1.14, depth: 0.42 }, scene);
  torso.parent = visual;
  torso.position.y = 1.56;
  torso.material = bodyMat;
  const chest = B.MeshBuilder.CreateBox('player-chest', { width: 0.74, height: 0.38, depth: 0.18 }, scene);
  chest.parent = visual;
  chest.position.set(0, 1.75, 0.22);
  chest.material = accent;
  const head = B.MeshBuilder.CreateSphere('player-head', { diameter: 0.56, segments: 16 }, scene);
  head.parent = visual;
  head.position.y = 2.42;
  head.material = skinMat;
  const hair = B.MeshBuilder.CreateBox('player-hair', { width: 0.52, height: 0.18, depth: 0.46 }, scene);
  hair.parent = visual;
  hair.position.set(0, 2.63, -0.02);
  hair.material = bodyMat;
  const leftArm = limb(B, scene, visual, -0.56, 1.52, bodyMat, 'left-arm', 0.88);
  const rightArm = limb(B, scene, visual, 0.56, 1.52, bodyMat, 'right-arm', 0.88);
  const leftLeg = limb(B, scene, visual, -0.22, 0.62, accent, 'left-leg', 0.92);
  const rightLeg = limb(B, scene, visual, 0.22, 0.62, accent, 'right-leg', 0.92);
  const leftFoot = B.MeshBuilder.CreateBox('player-left-foot', { width: 0.25, height: 0.1, depth: 0.4 }, scene);
  leftFoot.parent = visual;
  leftFoot.position.set(-0.22, 0.12, 0.08);
  leftFoot.material = shoeMat;
  const rightFoot = leftFoot.clone('player-right-foot');
  rightFoot.parent = visual;
  rightFoot.position.x = 0.22;
  [torso, chest, head, hair, leftArm, rightArm, leftLeg, rightLeg, leftFoot, rightFoot].forEach(mesh => shadowGenerator.addShadowCaster(mesh));

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
    if (!entry.mesh || entry.mesh.isDisposed?.()) continue;
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
