import { DOWNTOWN3D_FOUNDATION as CONFIG } from './downtown3d-config.js';

const BABYLON_CDN = 'https://cdn.babylonjs.com/babylon.js';
let babylonPromise = null;
let activeFoundation = null;

export function destroyDowntown3D() {
  activeFoundation?.destroy?.();
  activeFoundation = null;
  document.body.classList.remove('world3d-game-mode');
}

export async function renderDowntown3D(root) {
  destroyDowntown3D();

  root.innerHTML = `
    <section class="world3d-shell downtown3d-foundation" aria-label="Playable 3D Downtown street foundation">
      <canvas id="riftcity-3d-canvas" aria-label="RiftCity Downtown 3D viewport"></canvas>
      <div class="world3d-vignette" aria-hidden="true"></div>

      <div class="world3d-top-left downtown3d-title">
        <span class="eyebrow">DOWNTOWN 3D · FOUNDATION 01</span>
        <strong>Commerce Avenue</strong>
        <small>Road + curbs + sidewalks · master city scale</small>
      </div>

      <div class="world3d-top-right">
        <button id="downtown3d-reset-camera" class="world3d-hud-button" type="button">RESET CAMERA</button>
        <button id="world3d-fullscreen-button" class="world3d-hud-button" type="button">FULLSCREEN</button>
      </div>

      <div id="downtown3d-status" class="downtown3d-status" role="status">
        <strong>LOADING 3D STREET…</strong>
        <span>Preparing the first Downtown foundation.</span>
      </div>

      <div class="downtown3d-meter" aria-live="polite">
        <span id="downtown3d-fps">FPS --</span>
        <span>ROAD ${CONFIG.street.roadWidth}M</span>
        <span>SIDEWALK ${CONFIG.street.sidewalkWidth}M</span>
        <span>BLOCK ${CONFIG.street.length}M</span>
      </div>

      <div class="world3d-touch">
        <div id="world3d-joystick" class="world3d-joystick" aria-label="Movement joystick">
          <div class="world3d-joystick-ring"><div id="world3d-joystick-knob" class="world3d-joystick-knob"></div></div>
          <span>MOVE</span>
        </div>
        <div class="world3d-action-pad downtown3d-action-pad">
          <button id="downtown3d-run" class="world3d-action" type="button">RUN</button>
        </div>
      </div>
    </section>`;

  const canvas = root.querySelector('#riftcity-3d-canvas');
  const status = root.querySelector('#downtown3d-status');

  try {
    const B = await ensureBabylon();
    if (!root.isConnected || !canvas.isConnected) return null;
    activeFoundation = createFoundation({ root, canvas, status, B });
    return activeFoundation;
  } catch (error) {
    console.error('Downtown 3D foundation failed to start', error);
    if (status) {
      status.classList.add('error');
      status.innerHTML = `<strong>3D ENGINE FAILED TO LOAD</strong><span>${escapeText(error?.message || 'Check your connection and retry.')}</span>`;
    }
    return null;
  }
}

function ensureBabylon() {
  if (window.BABYLON) return Promise.resolve(window.BABYLON);
  if (babylonPromise) return babylonPromise;

  babylonPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-riftcity-babylon]');
    const script = existing || document.createElement('script');
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      babylonPromise = null;
      if (!window.BABYLON) script.remove();
      finish(reject, new Error('Timed out loading the 3D engine.'));
    }, 15000);

    script.addEventListener('load', () => {
      if (!window.BABYLON) {
        babylonPromise = null;
        finish(reject, new Error('The 3D engine loaded without exposing BABYLON.'));
        return;
      }
      finish(resolve, window.BABYLON);
    }, { once: true });
    script.addEventListener('error', () => {
      babylonPromise = null;
      script.remove();
      finish(reject, new Error('Could not download the 3D engine.'));
    }, { once: true });

    if (!existing) {
      script.src = BABYLON_CDN;
      script.async = true;
      script.dataset.riftcityBabylon = '1';
      document.head.appendChild(script);
    }
  });

  return babylonPromise;
}

function createFoundation({ root, canvas, status, B }) {
  const shell = root.querySelector('.world3d-shell');
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const engine = new B.Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    adaptToDeviceRatio: false,
    powerPreference: 'high-performance'
  });

  const targetPixelRatio = coarsePointer ? CONFIG.render.mobileTargetPixelRatio : CONFIG.render.desktopTargetPixelRatio;
  const deviceRatio = Math.max(1, window.devicePixelRatio || 1);
  engine.setHardwareScalingLevel(Math.max(1, deviceRatio / targetPixelRatio));

  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(0.105, 0.135, 0.17, 1);
  scene.fogMode = B.Scene.FOGMODE_LINEAR;
  scene.fogColor = new B.Color3(0.105, 0.135, 0.17);
  scene.fogStart = CONFIG.render.fogStart;
  scene.fogEnd = CONFIG.render.fogEnd;
  scene.skipPointerMovePicking = true;
  scene.imageProcessingConfiguration.contrast = 1.08;
  scene.imageProcessingConfiguration.exposure = 1.04;

  const cameraTarget = new B.TransformNode('downtown-camera-target', scene);
  const camera = new B.ArcRotateCamera(
    'downtown-player-camera',
    CONFIG.camera.alpha,
    CONFIG.camera.beta,
    CONFIG.camera.radius,
    new B.Vector3(CONFIG.player.spawn.x, CONFIG.camera.followHeight, CONFIG.player.spawn.z),
    scene
  );
  camera.lowerRadiusLimit = CONFIG.camera.minRadius;
  camera.upperRadiusLimit = CONFIG.camera.maxRadius;
  camera.lowerBetaLimit = CONFIG.camera.minBeta;
  camera.upperBetaLimit = CONFIG.camera.maxBeta;
  camera.panningSensibility = 0;
  camera.wheelPrecision = 46;
  camera.pinchPrecision = 110;
  camera.angularSensibilityX = 1400;
  camera.angularSensibilityY = 1400;
  camera.inertia = 0.78;
  cameraTarget.position.set(CONFIG.player.spawn.x, CONFIG.camera.followHeight, CONFIG.player.spawn.z);
  camera.lockedTarget = cameraTarget;
  camera.attachControl(canvas, true);

  const hemi = new B.HemisphericLight('downtown-sky-light', new B.Vector3(0.22, 1, -0.1), scene);
  hemi.intensity = 0.78;
  hemi.groundColor = new B.Color3(0.12, 0.13, 0.14);

  const sun = new B.DirectionalLight('downtown-sun', new B.Vector3(-0.48, -1, 0.32), scene);
  sun.position = new B.Vector3(34, 52, -30);
  sun.intensity = 1.05;

  const shadowMapSize = coarsePointer ? CONFIG.render.mobileShadowMapSize : CONFIG.render.desktopShadowMapSize;
  const shadows = new B.ShadowGenerator(shadowMapSize, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.0015;
  shadows.normalBias = 0.02;

  const materials = createStreetMaterials(B, scene);
  const foundation = buildStreetFoundation(B, scene, materials);
  const player = createScalePlayer(B, scene, materials, shadows);
  player.root.position.set(CONFIG.player.spawn.x, 0, CONFIG.player.spawn.z);

  const input = { x: 0, y: 0, run: false };
  const keys = new Set();
  const joystick = setupJoystick(root, input);
  const runButton = root.querySelector('#downtown3d-run');
  const resetCameraButton = root.querySelector('#downtown3d-reset-camera');
  const fullscreenButton = root.querySelector('#world3d-fullscreen-button');
  const fpsLabel = root.querySelector('#downtown3d-fps');

  const onKeyDown = event => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    keys.add(event.code);
  };
  const onKeyUp = event => keys.delete(event.code);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const setRun = enabled => {
    input.run = enabled;
    runButton?.classList.toggle('active', enabled);
  };
  const runStart = event => { event.preventDefault(); setRun(true); };
  const runStop = event => { event.preventDefault(); setRun(false); };
  runButton?.addEventListener('pointerdown', runStart);
  runButton?.addEventListener('pointerup', runStop);
  runButton?.addEventListener('pointercancel', runStop);
  runButton?.addEventListener('pointerleave', runStop);

  const resetCamera = () => {
    camera.alpha = CONFIG.camera.alpha;
    camera.beta = CONFIG.camera.beta;
    camera.radius = CONFIG.camera.radius;
  };
  resetCameraButton?.addEventListener('click', resetCamera);

  let gameMode = false;
  const setGameMode = async enabled => {
    gameMode = enabled;
    document.body.classList.toggle('world3d-game-mode', enabled);
    fullscreenButton?.classList.toggle('active', enabled);
    if (fullscreenButton) fullscreenButton.textContent = enabled ? 'EXIT FULLSCREEN' : 'FULLSCREEN';

    if (enabled) {
      try {
        const request = shell?.requestFullscreen || shell?.webkitRequestFullscreen;
        if (request && !document.fullscreenElement && !document.webkitFullscreenElement) await request.call(shell);
      } catch (_) {}
      try { await screen.orientation?.lock?.('landscape'); } catch (_) {}
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (_) {}
      try { screen.orientation?.unlock?.(); } catch (_) {}
    }
    requestAnimationFrame(() => engine.resize());
  };
  fullscreenButton?.addEventListener('click', () => setGameMode(!gameMode));

  const onFullscreenChange = () => {
    const nativeActive = document.fullscreenElement === shell || document.webkitFullscreenElement === shell;
    if (gameMode && !nativeActive && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      gameMode = false;
      document.body.classList.remove('world3d-game-mode');
      fullscreenButton?.classList.remove('active');
      if (fullscreenButton) fullscreenButton.textContent = 'FULLSCREEN';
      try { screen.orientation?.unlock?.(); } catch (_) {}
      requestAnimationFrame(() => engine.resize());
    }
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  const resize = () => requestAnimationFrame(() => engine.resize());
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.visualViewport?.addEventListener('resize', resize);

  let lastTime = performance.now();
  let fpsTimer = 0;
  let fpsFrames = 0;
  let fpsAverage = 0;

  const bounds = foundation.bounds;
  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;

    let inputX = input.x;
    let inputY = input.y;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) inputY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) inputY += 1;

    const magnitude = Math.hypot(inputX, inputY);
    if (magnitude > 1) {
      inputX /= magnitude;
      inputY /= magnitude;
    }

    const moving = Math.hypot(inputX, inputY) > 0.05;
    if (moving) {
      const forward = camera.getForwardRay().direction.clone();
      forward.y = 0;
      if (forward.lengthSquared() < 0.0001) forward.set(0, 0, -1);
      forward.normalize();
      const right = new B.Vector3(-forward.z, 0, forward.x);
      const direction = right.scale(inputX).add(forward.scale(-inputY));
      if (direction.lengthSquared() > 0.0001) direction.normalize();

      const running = input.run || keys.has('ShiftLeft') || keys.has('ShiftRight');
      const speed = running ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
      player.root.position.addInPlace(direction.scale(speed * dt));
      player.root.position.x = clamp(player.root.position.x, bounds.minX, bounds.maxX);
      player.root.position.z = clamp(player.root.position.z, bounds.minZ, bounds.maxZ);

      const targetYaw = Math.atan2(direction.x, direction.z);
      player.visual.rotation.y = lerpAngle(player.visual.rotation.y, targetYaw, Math.min(1, dt * 12));
      player.walkPhase += dt * (running ? 11 : 7.5);
      player.visual.position.y = Math.sin(player.walkPhase) * (running ? 0.035 : 0.02);
    } else {
      player.visual.position.y += (0 - player.visual.position.y) * Math.min(1, dt * 10);
    }

    const desiredTarget = new B.Vector3(player.root.position.x, CONFIG.camera.followHeight, player.root.position.z);
    const followT = 1 - Math.exp(-CONFIG.camera.followSharpness * dt);
    cameraTarget.position = B.Vector3.Lerp(cameraTarget.position, desiredTarget, followT);

    fpsFrames += 1;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      const instant = fpsFrames / fpsTimer;
      fpsAverage = fpsAverage ? fpsAverage * 0.6 + instant * 0.4 : instant;
      if (fpsLabel) fpsLabel.textContent = `FPS ${Math.round(fpsAverage)}`;
      fpsTimer = 0;
      fpsFrames = 0;
    }
  };

  scene.onBeforeRenderObservable.add(tick);
  engine.runRenderLoop(() => scene.render());

  if (status) {
    status.classList.add('ready');
    status.innerHTML = '<strong>EMPTY DOWNTOWN STREET V1</strong><span>Walk the scale test. No buildings are loaded yet.</span>';
    setTimeout(() => status?.classList.add('settled'), 2200);
  }

  requestAnimationFrame(() => engine.resize());

  return {
    scene,
    engine,
    destroy() {
      joystick?.destroy?.();
      setRun(false);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      runButton?.removeEventListener('pointerdown', runStart);
      runButton?.removeEventListener('pointerup', runStop);
      runButton?.removeEventListener('pointercancel', runStop);
      runButton?.removeEventListener('pointerleave', runStop);
      resetCameraButton?.removeEventListener('click', resetCamera);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      if (document.fullscreenElement === shell || document.webkitFullscreenElement === shell) {
        try { document.exitFullscreen?.() || document.webkitExitFullscreen?.(); } catch (_) {}
      }
      document.body.classList.remove('world3d-game-mode');
      try { scene.dispose(); } catch (_) {}
      try { engine.dispose(); } catch (_) {}
      root.style.height = '';
    }
  };
}

function buildStreetFoundation(B, scene, materials) {
  const street = CONFIG.street;
  const roadHalf = street.roadWidth / 2;
  const sidewalkHalf = street.sidewalkWidth / 2;
  const sidewalkCenter = roadHalf + sidewalkHalf;
  const totalHalfWidth = roadHalf + street.sidewalkWidth + street.buildableDepth;
  const totalLength = street.length + street.worldMargin * 2;

  const ground = B.MeshBuilder.CreateGround('downtown-foundation-ground', {
    width: totalHalfWidth * 2,
    height: totalLength
  }, scene);
  ground.position.y = 0;
  ground.material = materials.ground;
  ground.receiveShadows = true;

  const road = B.MeshBuilder.CreateGround('commerce-avenue-road', {
    width: street.roadWidth,
    height: street.length
  }, scene);
  road.position.y = 0.022;
  road.material = materials.asphalt;
  road.receiveShadows = true;

  for (const side of [-1, 1]) {
    const sidewalk = B.MeshBuilder.CreateBox(`commerce-sidewalk-${side < 0 ? 'west' : 'east'}`, {
      width: street.sidewalkWidth,
      depth: street.length,
      height: street.sidewalkHeight
    }, scene);
    sidewalk.position.set(side * sidewalkCenter, street.sidewalkHeight / 2, 0);
    sidewalk.material = materials.sidewalk;
    sidewalk.receiveShadows = true;

    const curb = B.MeshBuilder.CreateBox(`commerce-curb-${side < 0 ? 'west' : 'east'}`, {
      width: street.curbWidth,
      depth: street.length,
      height: street.curbHeight
    }, scene);
    curb.position.set(side * (roadHalf + street.curbWidth / 2), street.curbHeight / 2, 0);
    curb.material = materials.curb;
    curb.receiveShadows = true;
  }

  const dashStep = street.centerDashLength + street.centerDashGap;
  const firstDash = -street.length / 2 + street.centerDashLength;
  for (let z = firstDash; z < street.length / 2; z += dashStep) {
    const dash = B.MeshBuilder.CreateBox(`center-line-${Math.round(z * 10)}`, {
      width: 0.14,
      depth: street.centerDashLength,
      height: 0.025
    }, scene);
    dash.position.set(0, 0.042, z);
    dash.material = materials.centerLine;
  }

  for (const side of [-1, 1]) {
    const edgeX = side * (roadHalf - 1.05);
    for (let z = -street.length / 2 + 5; z <= street.length / 2 - 5; z += 7.5) {
      const parkingTick = B.MeshBuilder.CreateBox(`parking-tick-${side}-${z}`, {
        width: 1.9,
        depth: 0.07,
        height: 0.018
      }, scene);
      parkingTick.position.set(edgeX, 0.039, z);
      parkingTick.material = materials.parkingLine;
    }
  }

  return {
    bounds: {
      minX: -totalHalfWidth + CONFIG.player.radius,
      maxX: totalHalfWidth - CONFIG.player.radius,
      minZ: -street.length / 2 + CONFIG.player.radius,
      maxZ: street.length / 2 - CONFIG.player.radius
    }
  };
}

function createStreetMaterials(B, scene) {
  const asphalt = dynamicMaterial(B, scene, 'asphalt-material', 512, (ctx, size, random) => {
    ctx.fillStyle = '#252a2e';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i++) {
      const shade = 34 + Math.floor(random() * 25);
      ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 4},${0.12 + random() * 0.16})`;
      const r = random() * 1.7 + 0.35;
      ctx.fillRect(random() * size, random() * size, r, r);
    }
    ctx.strokeStyle = 'rgba(8,10,12,.18)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      let x = random() * size;
      let y = random() * size;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (random() - 0.5) * 52;
        y += (random() - 0.5) * 52;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, 4, 18);

  const sidewalk = dynamicMaterial(B, scene, 'sidewalk-material', 512, (ctx, size, random) => {
    ctx.fillStyle = '#777a77';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(35,38,37,.38)';
    ctx.lineWidth = 3;
    const step = size / 4;
    for (let n = 0; n <= 4; n++) {
      const p = Math.round(n * step) + 0.5;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
    }
    for (let i = 0; i < 900; i++) {
      const shade = 85 + Math.floor(random() * 45);
      ctx.fillStyle = `rgba(${shade},${shade},${shade - 2},.12)`;
      ctx.fillRect(random() * size, random() * size, 1.4, 1.4);
    }
  }, 1, 14);

  const ground = dynamicMaterial(B, scene, 'city-lot-ground', 512, (ctx, size, random) => {
    ctx.fillStyle = '#353a36';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1700; i++) {
      const green = 45 + Math.floor(random() * 28);
      ctx.fillStyle = `rgba(${green - 7},${green},${green - 5},.18)`;
      ctx.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
    }
  }, 9, 24);

  const curb = simpleMaterial(B, scene, 'curb-material', '#9a9a94');
  const centerLine = simpleMaterial(B, scene, 'center-line-material', '#d5a83c');
  centerLine.emissiveColor = B.Color3.FromHexString('#6d5318').scale(0.08);
  const parkingLine = simpleMaterial(B, scene, 'parking-line-material', '#d7d9d7');
  const playerDark = simpleMaterial(B, scene, 'player-dark', '#1e2228');
  const playerAccent = simpleMaterial(B, scene, 'player-accent', '#c98635');
  const playerSkin = simpleMaterial(B, scene, 'player-skin', '#a8785e');

  return { asphalt, sidewalk, ground, curb, centerLine, parkingLine, playerDark, playerAccent, playerSkin };
}

function dynamicMaterial(B, scene, name, size, painter, uScale, vScale) {
  const texture = new B.DynamicTexture(`${name}-texture`, { width: size, height: size }, scene, false);
  const context = texture.getContext();
  painter(context, size, seededRandom(hashString(name)));
  texture.update(false);
  texture.wrapU = B.Texture.WRAP_ADDRESS;
  texture.wrapV = B.Texture.WRAP_ADDRESS;
  texture.uScale = uScale;
  texture.vScale = vScale;
  texture.anisotropicFilteringLevel = 4;

  const material = new B.StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.specularColor = new B.Color3(0.045, 0.045, 0.045);
  material.ambientColor = new B.Color3(0.08, 0.08, 0.08);
  return material;
}

function simpleMaterial(B, scene, name, hex) {
  const material = new B.StandardMaterial(name, scene);
  material.diffuseColor = B.Color3.FromHexString(hex);
  material.specularColor = new B.Color3(0.05, 0.05, 0.05);
  return material;
}

function createScalePlayer(B, scene, materials, shadows) {
  const root = new B.TransformNode('downtown-player-root', scene);
  const visual = new B.TransformNode('downtown-player-visual', scene);
  visual.parent = root;
  visual.scaling.setAll(CONFIG.player.height / 1.88);

  const body = B.MeshBuilder.CreateCylinder('downtown-player-body', {
    height: 0.92,
    diameterTop: 0.48,
    diameterBottom: 0.58,
    tessellation: 8
  }, scene);
  body.parent = visual;
  body.position.y = 1.08;
  body.material = materials.playerDark;

  const jacket = B.MeshBuilder.CreateBox('downtown-player-jacket', { width: 0.54, height: 0.52, depth: 0.32 }, scene);
  jacket.parent = visual;
  jacket.position.set(0, 1.18, 0.02);
  jacket.material = materials.playerAccent;

  const head = B.MeshBuilder.CreateSphere('downtown-player-head', { diameter: 0.38, segments: 10 }, scene);
  head.parent = visual;
  head.position.y = 1.69;
  head.material = materials.playerSkin;

  for (const x of [-0.16, 0.16]) {
    const leg = B.MeshBuilder.CreateBox(`downtown-player-leg-${x}`, { width: 0.18, height: 0.72, depth: 0.22 }, scene);
    leg.parent = visual;
    leg.position.set(x, 0.46, 0);
    leg.material = materials.playerDark;
    shadows.addShadowCaster(leg);
  }

  shadows.addShadowCaster(body);
  shadows.addShadowCaster(jacket);
  shadows.addShadowCaster(head);

  return { root, visual, walkPhase: 0 };
}

function setupJoystick(root, input) {
  const zone = root.querySelector('#world3d-joystick');
  const ring = zone?.querySelector('.world3d-joystick-ring');
  const knob = root.querySelector('#world3d-joystick-knob');
  if (!zone || !ring || !knob) return null;

  let pointerId = null;
  const max = 38;

  const update = event => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    const rect = ring.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > max) {
      const scale = max / distance;
      dx *= scale;
      dy *= scale;
    }
    input.x = dx / max;
    input.y = dy / max;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  };

  const start = event => {
    event.preventDefault();
    pointerId = event.pointerId;
    zone.classList.add('active');
    try { zone.setPointerCapture?.(event.pointerId); } catch (_) {}
    update(event);
  };

  const reset = event => {
    if (event && pointerId !== null && event.pointerId !== pointerId) return;
    if (event) event.preventDefault();
    try { if (event && pointerId !== null) zone.releasePointerCapture?.(pointerId); } catch (_) {}
    pointerId = null;
    input.x = 0;
    input.y = 0;
    knob.style.transform = 'translate(0,0)';
    zone.classList.remove('active');
  };

  zone.addEventListener('pointerdown', start);
  zone.addEventListener('pointermove', update);
  zone.addEventListener('pointerup', reset);
  zone.addEventListener('pointercancel', reset);

  return {
    destroy() {
      reset();
      zone.removeEventListener('pointerdown', start);
      zone.removeEventListener('pointermove', update);
      zone.removeEventListener('pointerup', reset);
      zone.removeEventListener('pointercancel', reset);
    }
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function lerpAngle(current, target, amount) {
  let delta = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * amount;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
