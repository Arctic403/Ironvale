import { normalize3 } from './rift-engine-math.js';
import { simplifyRoadStroke } from './rift-road-network.js';
import { RIFT_WORLD_SCALE as WORLD_SCALE } from './rift-world-scale.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function round(value, step = 0.01) {
  return Math.round(value / step) * step;
}

function snapPoint(point, step) {
  if (!(step > 0)) return { x: point.x, z: point.z };
  return {
    x: round(point.x, step),
    z: round(point.z, step)
  };
}

function angleSnapPoint(origin, point, degrees) {
  if (!(degrees > 0)) return point;
  const dx = point.x - origin.x;
  const dz = point.z - origin.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return point;
  const step = degrees * Math.PI / 180;
  const angle = Math.atan2(dz, dx);
  const snapped = Math.round(angle / step) * step;
  return {
    x: origin.x + Math.cos(snapped) * length,
    z: origin.z + Math.sin(snapped) * length
  };
}

function cameraGroundPoint(canvas, camera, clientX, clientY, groundY = 0.02) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
  const forward = normalize3(
    camera.target[0] - camera.position[0],
    camera.target[1] - camera.position[1],
    camera.target[2] - camera.position[2]
  );
  const right = normalize3(-forward[2], 0, forward[0]);
  const up = normalize3(
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0]
  );
  const aspect = Math.max(0.01, rect.width / rect.height);
  const tan = Math.tan(camera.fov * 0.5);
  const ray = normalize3(
    forward[0] + right[0] * ndcX * tan * aspect + up[0] * ndcY * tan,
    forward[1] + right[1] * ndcX * tan * aspect + up[1] * ndcY * tan,
    forward[2] + right[2] * ndcX * tan * aspect + up[2] * ndcY * tan
  );
  if (Math.abs(ray[1]) < 1e-5) return null;
  const t = (groundY - camera.position[1]) / ray[1];
  if (t <= 0) return null;
  return {
    x: camera.position[0] + ray[0] * t,
    z: camera.position[2] + ray[2] * t
  };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountRiftWorldEditor({
  root,
  canvas,
  engine,
  camera,
  roadNetwork,
  worldBounds,
  onModeChange,
  onReferenceChange
}) {
  const shell = root.querySelector('.world3d-shell');
  const toggle = root.querySelector('#rift-world-editor-button');
  if (!shell || !toggle || !canvas || !roadNetwork) return null;

  const storageKey = `riftcity:rift-world-editor:roads:${roadNetwork.data.id || 'downtown'}:v1`;
  const panel = document.createElement('aside');
  panel.id = 'rift-world-editor';
  panel.className = 'rift-world-editor';
  panel.setAttribute('aria-hidden', 'true');

  const profiles = Object.values(roadNetwork.data.profiles || {});
  panel.innerHTML = `
    <div class="rift-world-editor-head">
      <div><span>RIFT WORLD EDITOR 0.1</span><strong>ROAD PAINTER</strong></div>
      <div class="rift-world-editor-stats" data-road-stats>0 ROADS · 0 JUNCTIONS</div>
    </div>
    <div class="rift-world-editor-main-tools" role="group" aria-label="Road editor tools">
      <button type="button" data-road-tool="paint">PAINT</button>
      <button type="button" data-road-tool="erase">ERASE</button>
      <button type="button" data-road-tool="measure">MEASURE</button>
      <button type="button" data-road-tool="camera">FREECAM</button>
    </div>
    <div class="rift-world-editor-options">
      <label>ROAD
        <select data-road-profile>
          ${profiles.map(profile => `<option value="${profile.id}">${profile.label || profile.id}</option>`).join('')}
        </select>
      </label>
      <div class="rift-world-editor-option-scroll">
        <button type="button" data-road-undo>UNDO</button>
        <button type="button" data-road-redo>REDO</button>
        <button type="button" data-road-snap>SNAP 0.5M</button>
        <button type="button" data-road-angle>ANGLE FREE</button>
        <button type="button" data-road-reference>REFERENCE</button>
        <button type="button" data-road-export>EXPORT JSON</button>
        <button type="button" data-road-reset>RESET SOURCE</button>
      </div>
    </div>
    <div class="rift-world-editor-status" data-road-status>PAINT: drag directly on the ground. Cross another road to auto-create an intersection.</div>`;
  shell.appendChild(panel);

  const q = selector => panel.querySelector(selector);
  const status = q('[data-road-status]');
  const stats = q('[data-road-stats]');
  const profileSelect = q('[data-road-profile]');
  const snapButton = q('[data-road-snap]');
  const angleButton = q('[data-road-angle]');
  const undoButton = q('[data-road-undo]');
  const redoButton = q('[data-road-redo]');
  const referenceButton = q('[data-road-reference]');

  let open = false;
  let tool = 'paint';
  let snapStep = 0.5;
  let angleSnap = 0;
  const strokeSampleSpacing = 2.2;
  let activePointer = null;
  let stroke = [];
  let hoverPoint = null;
  let previewDrawables = [];
  let eraseSnapshot = null;
  let cameraTap = null;
  let measureStart = null;
  let referenceVisible = false;
  const undo = [];
  const redo = [];

  const say = message => { if (status) status.textContent = message; };
  const snapshotText = () => JSON.stringify(roadNetwork.snapshot());
  const setUndoButtons = () => {
    if (undoButton) undoButton.disabled = undo.length === 0;
    if (redoButton) redoButton.disabled = redo.length === 0;
  };
  const updateStats = () => {
    const current = roadNetwork.stats();
    if (stats) stats.textContent = `${current.segments} ROADS · ${current.intersections} JUNCTION${current.intersections === 1 ? '' : 'S'}`;
    setUndoButtons();
  };

  const persist = () => {
    try { localStorage.setItem(storageKey, snapshotText()); } catch (_) {}
    updateStats();
  };

  const pushUndoText = before => {
    if (!before) return;
    undo.push(before);
    if (undo.length > 60) undo.shift();
    redo.length = 0;
    setUndoButtons();
  };

  const restoreFromText = text => {
    roadNetwork.replace(JSON.parse(text));
    persist();
  };

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      roadNetwork.replace(JSON.parse(saved));
      say('Restored the local road draft. PAINT or ERASE to keep working.');
    }
  } catch (error) {
    console.warn('Rift World Editor ignored an invalid local road draft.', error);
    try { localStorage.removeItem(storageKey); } catch (_) {}
  }

  const currentProfile = () => roadNetwork.profile(profileSelect?.value || roadNetwork.data.defaultProfile);

  const setTool = next => {
    tool = next;
    panel.querySelectorAll('[data-road-tool]').forEach(button => button.classList.toggle('active', button.dataset.roadTool === tool));
    shell.dataset.riftWorldTool = tool;
    clearPreview();
    activePointer = null;
    stroke = [];
    hoverPoint = null;
    eraseSnapshot = null;
    measureStart = null;
    if (tool === 'paint') say('PAINT: drag straight or curved roads. Smooth curves, snapping and intersections rebuild automatically.');
    if (tool === 'erase') say('ERASE: swipe across a road segment. Junctions repair themselves when branches disappear.');
    if (tool === 'measure') say('MEASURE: drag between any two ground points for a true meter distance.');
    if (tool === 'camera') say('FREECAM: WASD/arrows pan, Shift moves faster, drag orbits, pinch/wheel zooms, tap moves focus.');
  };

  const setOpen = next => {
    open = !!next;
    shell.classList.toggle('rift-world-editor-open', open);
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggle.classList.toggle('active', open);
    toggle.textContent = open ? 'PLAY MODE' : 'WORLD EDITOR';
    if (open) {
      // Entering Edit Mode always starts detached from the player in navigation/freecam mode.
      setTool('camera');
    } else {
      clearPreview();
      activePointer = null;
      stroke = [];
      hoverPoint = null;
      eraseSnapshot = null;
      cameraTap = null;
      measureStart = null;
      if (referenceVisible) {
        referenceVisible = false;
        referenceButton?.classList.remove('active');
        onReferenceChange?.(false);
      }
    }
    onModeChange?.(open);
    updateStats();
  };

  const clearPreview = () => {
    if (!previewDrawables.length) return;
    engine.removeDrawables(previewDrawables);
    previewDrawables = [];
  };

  const drawPreview = points => {
    clearPreview();
    if (!Array.isArray(points) || points.length < 2) return;
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index];
      const b = points[index + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.1) continue;
      previewDrawables.push(engine.addBox({
        position: [(a.x + b.x) * 0.5, 0.24, (a.z + b.z) * 0.5],
        scale: [0.34, 0.04, length],
        rotationY: Math.atan2(dx, dz),
        color: '#ffb44d'
      }));
    }
  };

  const editorPoint = event => {
    let point = cameraGroundPoint(canvas, camera, event.clientX, event.clientY);
    if (!point) return null;
    if (worldBounds) {
      point.x = Math.max(worldBounds.minX, Math.min(worldBounds.maxX, point.x));
      point.z = Math.max(worldBounds.minZ, Math.min(worldBounds.maxZ, point.z));
    }
    point = snapPoint(point, snapStep);
    if (angleSnap && stroke.length) {
      point = angleSnapPoint(stroke[stroke.length - 1], point, angleSnap);
      point = snapPoint(point, snapStep > 0 ? Math.min(snapStep, 0.5) : 0);
    }
    if (worldBounds) {
      point.x = Math.max(worldBounds.minX, Math.min(worldBounds.maxX, point.x));
      point.z = Math.max(worldBounds.minZ, Math.min(worldBounds.maxZ, point.z));
    }
    return point;
  };

  const finishPaint = event => {
    if (activePointer !== event.pointerId) return;
    const finalPoint = editorPoint(event) || hoverPoint;
    if (finalPoint && (!stroke.length || distance(stroke[stroke.length - 1], finalPoint) >= 0.45)) stroke.push(finalPoint);
    clearPreview();
    activePointer = null;
    hoverPoint = null;
    if (stroke.length < 2) { stroke = []; return; }
    const simplified = simplifyRoadStroke(stroke, 0.18);
    const before = snapshotText();
    const result = roadNetwork.addStroke(simplified, profileSelect?.value || roadNetwork.data.defaultProfile);
    stroke = [];
    if (!result.added) {
      say('No new road was added — the stroke was too short or already connected.');
      return;
    }
    pushUndoText(before);
    persist();
    say(result.intersections
      ? `ROAD ADDED · ${result.intersections} AUTO INTERSECTION${result.intersections === 1 ? '' : 'S'} CREATED.`
      : `ROAD ADDED · ${result.added} CONNECTED SEGMENT${result.added === 1 ? '' : 'S'}.`);
  };

  const pointerDown = event => {
    if (!open) return;
    if (tool === 'camera') {
      cameraTap = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    try { canvas.setPointerCapture?.(event.pointerId); } catch (_) {}
    const point = editorPoint(event);
    if (!point) {
      try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
      activePointer = null;
      return;
    }

    if (tool === 'paint') {
      stroke = [point];
      hoverPoint = point;
      drawPreview(stroke);
      return;
    }

    if (tool === 'measure') {
      measureStart = point;
      hoverPoint = point;
      drawPreview([point, { x: point.x + 0.01, z: point.z }]);
      say(`MEASURE START · X ${point.x.toFixed(1)} · Z ${point.z.toFixed(1)}`);
      return;
    }

    if (tool === 'erase') {
      eraseSnapshot = snapshotText();
      const profile = currentProfile();
      const radius = Math.max(2.5, (profile?.roadWidth || 8) * 0.56);
      if (roadNetwork.eraseAt(point, radius)) {
        pushUndoText(eraseSnapshot);
        eraseSnapshot = null;
        persist();
        say('ROAD ERASED · nearby junction geometry repaired automatically.');
      }
    }
  };

  const pointerMove = event => {
    if (!open || activePointer !== event.pointerId || tool === 'camera') return;
    event.preventDefault();
    event.stopPropagation();
    const point = editorPoint(event);
    if (!point) {
      try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
      activePointer = null;
      return;
    }

    if (tool === 'paint') {
      hoverPoint = point;
      const last = stroke[stroke.length - 1];
      if (distance(last, point) >= strokeSampleSpacing) stroke.push(point);
      drawPreview([...stroke, point]);
      return;
    }

    if (tool === 'measure' && measureStart) {
      hoverPoint = point;
      drawPreview([measureStart, point]);
      say(`MEASURE · ${distance(measureStart, point).toFixed(2)} M`);
      return;
    }

    if (tool === 'erase') {
      const profile = currentProfile();
      const radius = Math.max(2.5, (profile?.roadWidth || 8) * 0.56);
      if (roadNetwork.eraseAt(point, radius)) {
        if (eraseSnapshot) {
          pushUndoText(eraseSnapshot);
          eraseSnapshot = null;
        }
        persist();
        say('ERASING ROAD…');
      }
    }
  };

  const pointerEnd = event => {
    if (!open) return;
    if (tool === 'camera') {
      if (cameraTap?.pointerId === event.pointerId) {
        const moved = Math.hypot(event.clientX - cameraTap.x, event.clientY - cameraTap.y);
        const elapsed = performance.now() - cameraTap.time;
        if (moved < 8 && elapsed < 350) {
          const point = cameraGroundPoint(canvas, camera, event.clientX, event.clientY);
          if (point) {
            if (worldBounds) {
              point.x = Math.max(worldBounds.minX, Math.min(worldBounds.maxX, point.x));
              point.z = Math.max(worldBounds.minZ, Math.min(worldBounds.maxZ, point.z));
            }
            camera.target[0] = point.x;
            camera.target[2] = point.z;
            camera.updatePosition();
            say(`CAMERA FOCUS · X ${point.x.toFixed(1)} · Z ${point.z.toFixed(1)}`);
          }
        }
      }
      cameraTap = null;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (tool === 'paint') finishPaint(event);
    if (tool === 'measure' && activePointer === event.pointerId && measureStart) {
      const point = editorPoint(event) || hoverPoint || measureStart;
      hoverPoint = point;
      drawPreview([measureStart, point]);
      const measured = distance(measureStart, point);
      say(`MEASURED ${measured.toFixed(2)} M · 1 WORLD UNIT = ${WORLD_SCALE.metersPerWorldUnit} M`);
      measureStart = null;
    }
    if (activePointer === event.pointerId) {
      try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
      activePointer = null;
      eraseSnapshot = null;
    }
  };

  const cancelPointer = event => {
    if (activePointer !== event.pointerId) return;
    clearPreview();
    activePointer = null;
    stroke = [];
    hoverPoint = null;
    eraseSnapshot = null;
    measureStart = null;
  };

  const onToolClick = event => setTool(event.currentTarget.dataset.roadTool);
  panel.querySelectorAll('[data-road-tool]').forEach(button => button.addEventListener('click', onToolClick));

  const doUndo = () => {
    if (!undo.length) return;
    redo.push(snapshotText());
    const previous = undo.pop();
    restoreFromText(previous);
    say('UNDO · road network restored.');
  };
  const doRedo = () => {
    if (!redo.length) return;
    undo.push(snapshotText());
    const next = redo.pop();
    restoreFromText(next);
    say('REDO · road network restored.');
  };
  undoButton?.addEventListener('click', doUndo);
  redoButton?.addEventListener('click', doRedo);

  snapButton?.addEventListener('click', () => {
    snapStep = snapStep === 0.5 ? 1 : snapStep === 1 ? 0 : 0.5;
    snapButton.textContent = snapStep ? `SNAP ${snapStep}M` : 'SNAP OFF';
    snapButton.classList.toggle('active', snapStep > 0);
  });

  angleButton?.addEventListener('click', () => {
    angleSnap = angleSnap ? 0 : 45;
    angleButton.textContent = angleSnap ? 'ANGLE 45°' : 'ANGLE FREE';
    angleButton.classList.toggle('active', !!angleSnap);
  });

  referenceButton?.addEventListener('click', () => {
    referenceVisible = !referenceVisible;
    referenceButton.classList.toggle('active', referenceVisible);
    onReferenceChange?.(referenceVisible);
    if (referenceVisible) {
      const ref = WORLD_SCALE.reference;
      say(`REFERENCE KIT · 1M CUBE · HUMAN ${ref.humanHeight}M · DOOR ${ref.doorWidth}×${ref.doorHeight}M · CAR ${ref.carLength}M · PARKING ${ref.parkingWidth}×${ref.parkingLength}M`);
    } else {
      say('REFERENCE KIT HIDDEN · world scale remains locked at 1 unit = 1 meter.');
    }
  });

  q('[data-road-export]')?.addEventListener('click', () => {
    const payload = roadNetwork.snapshot();
    payload.exportedAt = new Date().toISOString();
    downloadJson(`riftcity-road-network-${payload.district || 'world'}-${Date.now()}.json`, payload);
    say('EXPORTED ROAD NETWORK JSON. Local draft remains active.');
  });

  q('[data-road-reset]')?.addEventListener('click', () => {
    if (!window.confirm('Reset the local road draft back to the source Downtown avenue?')) return;
    pushUndoText(snapshotText());
    roadNetwork.resetToSource();
    try { localStorage.removeItem(storageKey); } catch (_) {}
    updateStats();
    say('RESET TO SOURCE · the original Commerce Avenue is restored.');
  });

  const onToggle = () => setOpen(!open);
  toggle.addEventListener('click', onToggle);
  canvas.addEventListener('pointerdown', pointerDown, { capture: true, passive: false });
  canvas.addEventListener('pointermove', pointerMove, { capture: true, passive: false });
  canvas.addEventListener('pointerup', pointerEnd, { capture: true, passive: false });
  canvas.addEventListener('pointercancel', cancelPointer, { capture: true, passive: false });

  snapButton?.classList.add('active');
  angleButton?.classList.remove('active');
  setTool('paint');
  updateStats();

  return {
    isOpen: () => open,
    getTool: () => tool,
    close: () => setOpen(false),
    destroy() {
      setOpen(false);
      clearPreview();
      toggle.removeEventListener('click', onToggle);
      canvas.removeEventListener('pointerdown', pointerDown, true);
      canvas.removeEventListener('pointermove', pointerMove, true);
      canvas.removeEventListener('pointerup', pointerEnd, true);
      canvas.removeEventListener('pointercancel', cancelPointer, true);
      panel.remove();
    }
  };
}
