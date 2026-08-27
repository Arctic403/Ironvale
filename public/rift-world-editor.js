import { normalize3 } from './rift-engine-math.js';
import { rasterizeBlockLine, rectangleCells } from './rift-block-world.js';
import { RIFT_WORLD_SCALE as WORLD_SCALE } from './rift-world-scale.js';

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
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

function uniqueCells(cells) {
  const seen = new Set();
  const result = [];
  for (const cell of cells || []) {
    const key = `${cell.x}|${cell.y}|${cell.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cell);
  }
  return result;
}

function expandBrush(cells, size) {
  if (size <= 1) return uniqueCells(cells);
  const radius = Math.floor(size / 2);
  const expanded = [];
  for (const cell of cells || []) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) expanded.push({ x: cell.x + dx, y: cell.y, z: cell.z + dz });
    }
  }
  return uniqueCells(expanded);
}

export function mountRiftWorldEditor({
  root,
  canvas,
  engine,
  camera,
  blockWorld,
  worldBounds,
  onModeChange,
  onReferenceChange
}) {
  const shell = root.querySelector('.world3d-shell');
  const toggle = root.querySelector('#rift-world-editor-button');
  if (!shell || !toggle || !canvas || !blockWorld) return null;

  const storageKey = `riftcity:rift-block-world:${blockWorld.data.id || 'downtown'}:v1`;
  const panel = document.createElement('aside');
  panel.id = 'rift-world-editor';
  panel.className = 'rift-world-editor rift-block-editor';
  panel.setAttribute('aria-hidden', 'true');

  const materials = blockWorld.materialList();
  panel.innerHTML = `
    <div class="rift-world-editor-head">
      <div><span>RIFT BLOCK WORLD 0.1</span><strong>1M BLOCK EDITOR</strong></div>
      <div class="rift-world-editor-stats" data-block-stats>-- BLOCKS · -- CHUNKS</div>
    </div>
    <div class="rift-world-editor-main-tools rift-block-editor-tools" role="group" aria-label="Block editor tools">
      <button type="button" data-block-tool="brush">BRUSH</button>
      <button type="button" data-block-tool="erase">ERASE</button>
      <button type="button" data-block-tool="line">LINE</button>
      <button type="button" data-block-tool="rect">RECT</button>
      <button type="button" data-block-tool="measure">MEASURE</button>
      <button type="button" data-block-tool="camera">FREECAM</button>
    </div>
    <div class="rift-world-editor-options rift-block-editor-options">
      <label>BLOCK MATERIAL
        <select data-block-material>
          ${materials.map(material => `<option value="${material.id}">${material.label || material.id}</option>`).join('')}
        </select>
      </label>
      <div class="rift-world-editor-option-scroll">
        <button type="button" data-block-layer-down>Y −</button>
        <button type="button" data-block-layer>Y -1</button>
        <button type="button" data-block-layer-up>Y +</button>
        <button type="button" data-block-brush>BRUSH 1×1</button>
        <button type="button" data-block-undo>UNDO</button>
        <button type="button" data-block-redo>REDO</button>
        <button type="button" data-block-reference>REFERENCE</button>
        <button type="button" data-block-export>EXPORT JSON</button>
        <button type="button" data-block-reset>RESET SOURCE</button>
      </div>
    </div>
    <div class="rift-world-editor-status" data-block-status>FREECAM: move around the block world, then choose a build tool.</div>`;
  shell.appendChild(panel);

  const q = selector => panel.querySelector(selector);
  const status = q('[data-block-status]');
  const stats = q('[data-block-stats]');
  const materialSelect = q('[data-block-material]');
  const layerButton = q('[data-block-layer]');
  const brushButton = q('[data-block-brush]');
  const undoButton = q('[data-block-undo]');
  const redoButton = q('[data-block-redo]');
  const referenceButton = q('[data-block-reference]');

  let open = false;
  let tool = 'camera';
  let layerY = -1;
  let brushSize = 1;
  let activePointer = null;
  let startCell = null;
  let hoverCell = null;
  let previewDrawables = [];
  let cameraTap = null;
  let referenceVisible = false;
  let dragSnapshot = null;
  const paintedThisDrag = new Set();
  const undo = [];
  const redo = [];

  const say = message => { if (status) status.textContent = message; };
  const snapshotText = () => JSON.stringify(blockWorld.snapshot());
  const setUndoButtons = () => {
    if (undoButton) undoButton.disabled = undo.length === 0;
    if (redoButton) redoButton.disabled = redo.length === 0;
  };
  const updateStats = () => {
    const current = blockWorld.stats();
    if (stats) stats.textContent = `${current.logicalBlocks.toLocaleString()} BLOCKS · ${current.loadedChunks} CHUNKS`;
    setUndoButtons();
  };
  const persist = () => {
    try { localStorage.setItem(storageKey, snapshotText()); } catch (error) { console.warn('Block-world local draft could not be saved.', error); }
    updateStats();
  };
  const pushUndoText = before => {
    if (!before) return;
    undo.push(before);
    if (undo.length > 24) undo.shift();
    redo.length = 0;
    setUndoButtons();
  };
  const restoreFromText = text => {
    blockWorld.replace(JSON.parse(text));
    blockWorld.setViewCenter(camera.target[0], camera.target[2]);
    persist();
  };

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      blockWorld.replace(JSON.parse(saved));
      say('Restored the local 1m block-world draft.');
    }
  } catch (error) {
    console.warn('Rift Block Editor ignored an invalid local draft.', error);
    try { localStorage.removeItem(storageKey); } catch (_) {}
  }

  const clearPreview = () => {
    if (!previewDrawables.length) return;
    engine.removeDrawables(previewDrawables);
    previewDrawables = [];
  };

  const previewCells = cells => {
    clearPreview();
    for (const cell of (cells || []).slice(0, 512)) {
      if (!blockWorld.inBounds(cell.x, cell.y, cell.z)) continue;
      const isSurface = cell.y === blockWorld.data.base.y;
      previewDrawables.push(engine.addBox({
        position: [cell.x + 0.5, isSurface ? 0.026 : cell.y + 0.5, cell.z + 0.5],
        scale: isSurface ? [0.9, 0.045, 0.9] : [0.86, 0.86, 0.86],
        color: '#ffb44d',
        dynamic: true
      }));
    }
  };

  const drawMeasure = (a, b) => {
    clearPreview();
    if (!a || !b) return;
    const ax = a.x + 0.5, az = a.z + 0.5;
    const bx = b.x + 0.5, bz = b.z + 0.5;
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) return;
    previewDrawables.push(engine.addBox({
      position: [(ax + bx) * 0.5, 0.08, (az + bz) * 0.5],
      scale: [0.12, 0.05, length],
      rotationY: Math.atan2(dx, dz),
      color: '#ffb44d'
    }));
  };

  const cellFromEvent = event => {
    const point = cameraGroundPoint(canvas, camera, event.clientX, event.clientY);
    if (!point) return null;
    const b = blockWorld.data.bounds;
    return {
      x: Math.max(b.minX, Math.min(b.maxX, Math.floor(point.x))),
      y: layerY,
      z: Math.max(b.minZ, Math.min(b.maxZ, Math.floor(point.z)))
    };
  };

  const brushCells = cell => expandBrush([cell], brushSize).filter(candidate => blockWorld.inBounds(candidate.x, candidate.y, candidate.z));
  const lineCells = (a, b) => expandBrush(rasterizeBlockLine(a, b, layerY), brushSize).filter(cell => blockWorld.inBounds(cell.x, cell.y, cell.z));
  const rectCells = (a, b) => rectangleCells(a, b, layerY, 4096).filter(cell => blockWorld.inBounds(cell.x, cell.y, cell.z));

  const applyCells = (cells, erase = false) => {
    let changed = 0;
    const material = erase ? null : materialSelect?.value || 'brick';
    for (const cell of uniqueCells(cells)) {
      if (!blockWorld.inBounds(cell.x, cell.y, cell.z)) continue;
      changed += blockWorld.setBlock(cell.x, cell.y, cell.z, material) ? 1 : 0;
    }
    if (changed) blockWorld.rebuildDirtyLoaded();
    return changed;
  };

  const setTool = next => {
    tool = next;
    panel.querySelectorAll('[data-block-tool]').forEach(button => button.classList.toggle('active', button.dataset.blockTool === tool));
    shell.dataset.riftWorldTool = tool;
    clearPreview();
    activePointer = null;
    startCell = null;
    hoverCell = null;
    dragSnapshot = null;
    paintedThisDrag.clear();
    if (tool === 'brush') say(`BRUSH: paint ${brushSize}×${brushSize} one-meter blocks on Y ${layerY}.`);
    if (tool === 'erase') say(`ERASE: remove blocks on Y ${layerY}. Ground-layer erase returns cells to default ground.`);
    if (tool === 'line') say(`LINE: drag a straight block line on Y ${layerY}. Diagonals stay visibly stepped.`);
    if (tool === 'rect') say(`RECT: drag a filled block rectangle on Y ${layerY}.`);
    if (tool === 'measure') say('MEASURE: drag between block cells for true meter distance.');
    if (tool === 'camera') say('FREECAM: WASD/arrows pan, Shift moves faster, drag orbits, pinch/wheel zooms, tap moves focus.');
  };

  const setOpen = next => {
    open = !!next;
    shell.classList.toggle('rift-world-editor-open', open);
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggle.classList.toggle('active', open);
    toggle.textContent = open ? 'PLAY MODE' : 'WORLD EDITOR';
    if (open) setTool('camera');
    else {
      clearPreview();
      activePointer = null;
      startCell = null;
      hoverCell = null;
      cameraTap = null;
      dragSnapshot = null;
      paintedThisDrag.clear();
      if (referenceVisible) {
        referenceVisible = false;
        referenceButton?.classList.remove('active');
        onReferenceChange?.(false);
      }
    }
    onModeChange?.(open);
    updateStats();
  };

  const paintBrushCell = cell => {
    const cells = brushCells(cell);
    const fresh = cells.filter(candidate => {
      const key = `${candidate.x}|${candidate.y}|${candidate.z}`;
      if (paintedThisDrag.has(key)) return false;
      paintedThisDrag.add(key);
      return true;
    });
    if (!fresh.length) return 0;
    return applyCells(fresh, tool === 'erase');
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
    const cell = cellFromEvent(event);
    if (!cell) { activePointer = null; return; }
    startCell = cell;
    hoverCell = cell;
    dragSnapshot = snapshotText();
    paintedThisDrag.clear();

    if (tool === 'brush' || tool === 'erase') {
      const changed = paintBrushCell(cell);
      previewCells(brushCells(cell));
      if (changed) say(`${tool === 'erase' ? 'ERASING' : 'PAINTING'} Y ${layerY} · ${materialSelect?.value || ''}`);
      return;
    }
    if (tool === 'line') previewCells(lineCells(cell, cell));
    if (tool === 'rect') previewCells(rectCells(cell, cell));
    if (tool === 'measure') {
      drawMeasure(cell, cell);
      say(`MEASURE START · X ${cell.x} · Z ${cell.z}`);
    }
  };

  const pointerMove = event => {
    if (!open || activePointer !== event.pointerId || tool === 'camera') return;
    event.preventDefault();
    event.stopPropagation();
    const cell = cellFromEvent(event);
    if (!cell) return;
    hoverCell = cell;
    if (tool === 'brush' || tool === 'erase') {
      paintBrushCell(cell);
      previewCells(brushCells(cell));
      return;
    }
    if (tool === 'line') {
      previewCells(lineCells(startCell, cell));
      return;
    }
    if (tool === 'rect') {
      previewCells(rectCells(startCell, cell));
      return;
    }
    if (tool === 'measure') {
      drawMeasure(startCell, cell);
      say(`MEASURE · ${distance(startCell, cell).toFixed(2)} M · ΔX ${Math.abs(cell.x - startCell.x)} · ΔZ ${Math.abs(cell.z - startCell.z)}`);
    }
  };

  const finishBuildGesture = () => {
    let changed = 0;
    if (tool === 'line' && startCell && hoverCell) changed = applyCells(lineCells(startCell, hoverCell), false);
    if (tool === 'rect' && startCell && hoverCell) changed = applyCells(rectCells(startCell, hoverCell), false);
    if (tool === 'brush' || tool === 'erase') {
      // Brush changes were applied continuously; compare snapshots before committing undo.
      changed = dragSnapshot && dragSnapshot !== snapshotText() ? 1 : 0;
    }
    if (changed && dragSnapshot) {
      pushUndoText(dragSnapshot);
      persist();
      if (tool === 'line') say('BLOCK LINE BUILT · diagonal lines intentionally use stepped 1m cells.');
      if (tool === 'rect') say('BLOCK RECTANGLE BUILT · one layer filled on the active Y level.');
      if (tool === 'brush') say('BLOCK BRUSH APPLIED.');
      if (tool === 'erase') say('BLOCKS ERASED.');
    }
    dragSnapshot = null;
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
            const b = worldBounds || blockWorld.data.bounds;
            camera.target[0] = Math.max(b.minX, Math.min(b.maxX, point.x));
            camera.target[2] = Math.max(b.minZ, Math.min(b.maxZ, point.z));
            camera.updatePosition();
            blockWorld.setViewCenter(camera.target[0], camera.target[2]);
            say(`CAMERA FOCUS · X ${camera.target[0].toFixed(1)} · Z ${camera.target[2].toFixed(1)}`);
          }
        }
      }
      cameraTap = null;
      return;
    }
    if (activePointer !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const final = cellFromEvent(event);
    if (final) hoverCell = final;
    if (tool === 'measure' && startCell && hoverCell) {
      drawMeasure(startCell, hoverCell);
      say(`MEASURED ${distance(startCell, hoverCell).toFixed(2)} M · EACH BLOCK = ${WORLD_SCALE.block.size}×${WORLD_SCALE.block.size}×${WORLD_SCALE.block.size} M`);
      dragSnapshot = null;
    } else finishBuildGesture();
    try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
    activePointer = null;
    startCell = null;
    hoverCell = null;
    paintedThisDrag.clear();
  };

  const pointerCancel = event => {
    if (activePointer !== event.pointerId) return;
    clearPreview();
    activePointer = null;
    startCell = null;
    hoverCell = null;
    dragSnapshot = null;
    paintedThisDrag.clear();
  };

  panel.querySelectorAll('[data-block-tool]').forEach(button => button.addEventListener('click', event => setTool(event.currentTarget.dataset.blockTool)));

  const updateLayerButton = () => {
    if (layerButton) layerButton.textContent = layerY === -1 ? 'Y -1 SURFACE' : `Y ${layerY}`;
  };
  const setLayer = next => {
    const b = blockWorld.data.bounds;
    layerY = Math.max(b.minY, Math.min(b.maxY, Math.trunc(next)));
    updateLayerButton();
    setTool(tool);
  };
  q('[data-block-layer-down]')?.addEventListener('click', () => setLayer(layerY - 1));
  q('[data-block-layer-up]')?.addEventListener('click', () => setLayer(layerY + 1));
  layerButton?.addEventListener('click', () => setLayer(layerY === -1 ? 0 : -1));

  brushButton?.addEventListener('click', () => {
    brushSize = brushSize === 1 ? 3 : brushSize === 3 ? 5 : 1;
    brushButton.textContent = `BRUSH ${brushSize}×${brushSize}`;
    setTool(tool);
  });

  undoButton?.addEventListener('click', () => {
    if (!undo.length) return;
    redo.push(snapshotText());
    restoreFromText(undo.pop());
    say('UNDO · block world restored.');
  });
  redoButton?.addEventListener('click', () => {
    if (!redo.length) return;
    undo.push(snapshotText());
    restoreFromText(redo.pop());
    say('REDO · block world restored.');
  });

  referenceButton?.addEventListener('click', () => {
    referenceVisible = !referenceVisible;
    referenceButton.classList.toggle('active', referenceVisible);
    onReferenceChange?.(referenceVisible);
    const ref = WORLD_SCALE.reference;
    say(referenceVisible
      ? `REFERENCE · 1M BLOCK · HUMAN ${ref.humanHeight}M · DOOR ${ref.doorWidth}×${ref.doorHeight}M · CAR ${ref.carLength}M`
      : 'REFERENCE HIDDEN · block scale remains permanently locked at 1 meter.');
  });

  q('[data-block-export]')?.addEventListener('click', () => {
    const payload = blockWorld.snapshot();
    payload.exportedAt = new Date().toISOString();
    downloadJson(`riftcity-block-world-${payload.district || 'world'}-${Date.now()}.json`, payload);
    say('EXPORTED BLOCK-WORLD JSON · local draft remains active.');
  });

  q('[data-block-reset]')?.addEventListener('click', () => {
    if (!window.confirm('Reset the local block-world draft back to the source Downtown block district?')) return;
    pushUndoText(snapshotText());
    blockWorld.resetToSource();
    blockWorld.setViewCenter(camera.target[0], camera.target[2]);
    try { localStorage.removeItem(storageKey); } catch (_) {}
    updateStats();
    say('RESET TO SOURCE · Downtown block district restored.');
  });

  materialSelect?.addEventListener('change', () => setTool(tool));

  const onToggle = () => setOpen(!open);
  toggle.addEventListener('click', onToggle);
  canvas.addEventListener('pointerdown', pointerDown, { capture: true, passive: false });
  canvas.addEventListener('pointermove', pointerMove, { capture: true, passive: false });
  canvas.addEventListener('pointerup', pointerEnd, { capture: true, passive: false });
  canvas.addEventListener('pointercancel', pointerCancel, { capture: true, passive: false });

  updateLayerButton();
  setTool('camera');
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
      canvas.removeEventListener('pointercancel', pointerCancel, true);
      panel.remove();
    }
  };
}
