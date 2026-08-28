const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ROTATIONS = ['north', 'east', 'south', 'west'];

function safeFileName(value, fallback='riftcity-ai-builder') {
  const cleaned = String(value || fallback).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function downloadText(filename, text, type='application/json;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function shiftVec(vec, dx, dy, dz) {
  if (!Array.isArray(vec) || vec.length < 3) return false;
  vec[0] = Number(vec[0]) + dx;
  vec[1] = Number(vec[1]) + dy;
  vec[2] = Number(vec[2]) + dz;
  return true;
}

function objectCenter(object) {
  const bounds = object?.bounds;
  if (bounds?.min && bounds?.max) return bounds.min.map((v, i) => (Number(v) + Number(bounds.max[i]) + 1) * 0.5);
  if (Array.isArray(object?.origin)) return object.origin.map(Number);
  if (Array.isArray(object?.center)) return object.center.map(Number);
  if (Array.isArray(object?.from) && Array.isArray(object?.to)) return object.from.map((v, i) => (Number(v) + Number(object.to[i])) * 0.5);
  return [0, 0, 0];
}

function cameraState(foundation) {
  const camera = foundation.camera;
  return {
    projection: camera.projection,
    alpha: Number(camera.alpha.toFixed(6)),
    beta: Number(camera.beta.toFixed(6)),
    radius: Number(camera.radius.toFixed(3)),
    orthoSize: Number(camera.orthoSize.toFixed(3)),
    target: camera.target.map(v => Number(v.toFixed(3))),
    position: camera.position.map(v => Number(v.toFixed(3)))
  };
}

function sceneSnapshot(foundation) {
  const imported = foundation.imported;
  if (!imported) return null;
  return {
    id: imported.id,
    name: imported.name,
    worldBounds: imported.worldBounds,
    center: imported.center,
    stats: imported.stats,
    camera: cameraState(foundation),
    player: {
      position: foundation.player.position.map(v => Number(v.toFixed(3))),
      facing: Number(foundation.player.facing.toFixed(6)),
      visible: foundation.player.visible !== false
    },
    objects: (imported.blueprint?.objects || []).map(object => ({
      id: object.id,
      type: object.type,
      prefab: object.prefab || null,
      group: object.group || null,
      tags: object.tags || [],
      origin: object.origin || null,
      rotation: object.rotation || null,
      bounds: object.bounds
    })),
    anchors: imported.blueprint?.anchors || [],
    groups: imported.blueprint?.groups || {},
    connections: imported.blueprint?.connections || [],
    warnings: imported.blueprint?.warnings || []
  };
}

function findCompiledObject(foundation, id) {
  const needle = String(id || '').trim();
  if (!needle) return null;
  return (foundation.imported?.blueprint?.objects || []).find(object => String(object.id || '') === needle) || null;
}

function topLevelObject(draft, id) {
  const layout = Array.isArray(draft?.layout) ? draft.layout : [];
  return layout.find(item => String(item?.id || '') === String(id || '')) || null;
}

function objectInfo(foundation, draft, id) {
  const compiled = findCompiledObject(foundation, id);
  if (!compiled) return null;
  const editable = !!topLevelObject(draft, id);
  return {
    id: compiled.id,
    type: compiled.type,
    prefab: compiled.prefab || null,
    group: compiled.group || null,
    tags: compiled.tags || [],
    origin: compiled.origin || null,
    localOrigin: compiled.localOrigin || null,
    rotation: compiled.rotation || null,
    bounds: compiled.bounds,
    center: objectCenter(compiled),
    editable,
    editNote: editable ? 'Top-level Blueprint layout object.' : 'Compiled/nested object. Edit its top-level parent or prefab source.'
  };
}

export function mountRiftAiBuilder({ root, foundation }) {
  if (!root || !foundation) throw new Error('Rift AI Builder requires a mounted RiftCity foundation.');
  const shell = root.querySelector('.world3d-shell');
  if (!shell) throw new Error('Rift AI Builder could not find the Rift Engine shell.');

  document.body.classList.add('rift-ai-builder-page');
  foundation.playerController.setEnabled(false);

  const panel = document.createElement('section');
  panel.className = 'rift-ai-builder';
  panel.setAttribute('aria-label', 'RiftCity AI Builder');
  panel.innerHTML = `
    <header class="rift-ai-builder-head">
      <div><span>RIFTCITY DEV</span><strong>AI BUILDER</strong><small>STAGING · structured commands + scene inspection</small></div>
      <div class="rift-ai-builder-badges"><span data-ai-webmcp>WEBMCP CHECKING</span><button type="button" data-ai-collapse aria-label="Collapse AI Builder">−</button></div>
    </header>
    <div class="rift-ai-builder-body">
      <nav class="rift-ai-camera-row" aria-label="Inspection camera presets">
        ${['birdseye','top','north','south','east','west','third-person'].map(mode => `<button type="button" data-ai-camera="${mode}">${mode.toUpperCase()}</button>`).join('')}
      </nav>
      <div class="rift-ai-grid">
        <section class="rift-ai-card">
          <label>SCENE OBJECT
            <select data-ai-object aria-label="Blueprint object"></select>
          </label>
          <div class="rift-ai-button-row">
            <button type="button" data-ai-inspect>INSPECT</button>
            <button type="button" data-ai-focus>FOCUS</button>
            <button type="button" data-ai-scene>SCENE JSON</button>
          </div>
          <pre data-ai-inspector aria-live="polite">Loading scene…</pre>
        </section>
        <section class="rift-ai-card rift-ai-terminal-card">
          <label>AI COMMAND
            <textarea data-ai-command rows="3" spellcheck="false" autocomplete="off" placeholder="inspect station\nmove station 1 0 0\ncamera birdseye\ncheckpoint lobby-clean"></textarea>
          </label>
          <div class="rift-ai-button-row">
            <button type="button" class="primary" data-ai-run>RUN COMMAND</button>
            <button type="button" data-ai-help>HELP</button>
            <button type="button" data-ai-undo>UNDO</button>
            <button type="button" data-ai-redo>REDO</button>
          </div>
          <pre data-ai-result aria-live="polite">AI Builder ready.</pre>
        </section>
        <section class="rift-ai-card">
          <label>BLUEPRINT JSON
            <textarea data-ai-blueprint rows="6" spellcheck="false" autocomplete="off" placeholder="Paste a riftcity-city-block v2 Blueprint here"></textarea>
          </label>
          <div class="rift-ai-button-row">
            <button type="button" class="primary" data-ai-import>IMPORT TO STAGING</button>
            <button type="button" data-ai-load-current>LOAD CURRENT</button>
            <button type="button" data-ai-export>EXPORT JSON</button>
          </div>
        </section>
        <section class="rift-ai-card">
          <label>CHECKPOINT NAME
            <input data-ai-checkpoint-name value="checkpoint-1" autocomplete="off">
          </label>
          <div class="rift-ai-button-row">
            <button type="button" data-ai-checkpoint>SAVE CHECKPOINT</button>
            <button type="button" data-ai-restore>RESTORE</button>
            <select data-ai-checkpoints aria-label="Saved AI Builder checkpoints"></select>
          </div>
          <div class="rift-ai-button-row">
            <button type="button" class="primary" data-ai-capture>CAPTURE CLEAN PNG</button>
            <button type="button" data-ai-player>PLAYER: ON</button>
          </div>
          <img data-ai-capture-preview alt="Latest clean RiftCity AI Builder capture">
          <a data-ai-capture-download download="riftcity-ai-builder.png">DOWNLOAD LATEST PNG</a>
        </section>
      </div>
      <footer class="rift-ai-footer">
        <span data-ai-summary>--</span>
        <a href="/">EXIT TO RIFTCITY</a>
      </footer>
    </div>`;
  shell.appendChild(panel);

  const q = selector => panel.querySelector(selector);
  const objectSelect = q('[data-ai-object]');
  const inspector = q('[data-ai-inspector]');
  const commandInput = q('[data-ai-command]');
  const result = q('[data-ai-result]');
  const blueprintInput = q('[data-ai-blueprint]');
  const checkpointsSelect = q('[data-ai-checkpoints]');
  const checkpointName = q('[data-ai-checkpoint-name]');
  const summary = q('[data-ai-summary]');
  const webmcpBadge = q('[data-ai-webmcp]');
  const capturePreview = q('[data-ai-capture-preview]');
  const captureDownload = q('[data-ai-capture-download]');
  const playerButton = q('[data-ai-player]');

  let draft = clone(foundation.imported.document);
  let selectedId = '';
  let undo = [];
  let redo = [];
  let playerVisible = true;
  let destroyed = false;
  const checkpointStorageKey = () => `riftcity:ai-builder:${draft?.id || 'world'}:checkpoints:v1`;

  const writeResult = payload => {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    result.textContent = text;
    return payload;
  };

  const refreshScene = () => {
    const objects = foundation.imported?.blueprint?.objects || [];
    const previous = selectedId;
    objectSelect.innerHTML = objects.map(object => `<option value="${esc(object.id)}">${esc(object.id)} · ${esc(object.type || 'object')}</option>`).join('');
    selectedId = objects.some(object => String(object.id) === previous) ? previous : String(objects[0]?.id || '');
    objectSelect.value = selectedId;
    const stats = foundation.imported?.stats;
    summary.textContent = stats ? `${foundation.imported.name} · ${stats.blueprintObjects} objects · ${stats.cells.toLocaleString()} cells · ${stats.sections} sections · ${stats.triangles.toLocaleString()} tris` : 'No active scene';
    inspectSelected();
    refreshCheckpoints();
  };

  const inspectSelected = () => {
    const info = objectInfo(foundation, draft, selectedId);
    inspector.textContent = JSON.stringify(info || { error: selectedId ? `Object '${selectedId}' not found.` : 'No Blueprint objects in this document.' }, null, 2);
    return info;
  };

  const applyDraft = (message, { pushHistory = false, before = null } = {}) => {
    try {
      foundation.loadDocument(draft, 'AI BUILDER STAGING', {
        persist: true,
        fileName: `${draft.id || 'riftcity'}-ai-builder.json`,
        preservePlayer: true,
        preserveCamera: true
      });
      if (pushHistory && before) {
        undo.push(before);
        if (undo.length > 80) undo.shift();
        redo.length = 0;
      }
      draft = clone(foundation.imported.document);
      refreshScene();
      return writeResult({ ok: true, message, scene: { id: foundation.imported.id, name: foundation.imported.name, stats: foundation.imported.stats } });
    } catch (error) {
      return writeResult({ ok: false, error: String(error?.message || error) });
    }
  };

  const mutate = (label, mutator) => {
    const before = JSON.stringify(draft);
    try {
      const value = mutator();
      if (value === false) return writeResult({ ok: false, error: label });
      return applyDraft(label, { pushHistory: true, before });
    } catch (error) {
      draft = JSON.parse(before);
      return writeResult({ ok: false, error: String(error?.message || error) });
    }
  };

  const selectObject = id => {
    const object = findCompiledObject(foundation, id);
    if (!object) return writeResult({ ok: false, error: `Unknown object '${id}'.` });
    selectedId = String(object.id);
    objectSelect.value = selectedId;
    return writeResult({ ok: true, selected: objectInfo(foundation, draft, selectedId) });
  };

  const focusObject = id => {
    const object = findCompiledObject(foundation, id || selectedId);
    if (!object) return writeResult({ ok: false, error: `Unknown object '${id || selectedId}'.` });
    selectedId = String(object.id);
    objectSelect.value = selectedId;
    const camera = foundation.setInspectionCamera('birdseye', object.bounds);
    inspectSelected();
    return writeResult({ ok: true, focused: object.id, camera });
  };

  const setCamera = (mode, id = '') => {
    const object = id ? findCompiledObject(foundation, id) : (selectedId ? findCompiledObject(foundation, selectedId) : null);
    const bounds = object?.bounds || foundation.imported?.worldBounds || null;
    const camera = foundation.setInspectionCamera(mode, bounds);
    return writeResult({ ok: true, camera, targetObject: object?.id || null });
  };

  const moveObject = (id, dx, dy, dz) => mutate(`Moved ${id} by ${dx}, ${dy}, ${dz}.`, () => {
    const object = topLevelObject(draft, id);
    if (!object) throw new Error(`'${id}' is not a top-level editable layout object.`);
    const x = Number(dx), y = Number(dy), z = Number(dz);
    if (![x, y, z].every(Number.isFinite)) throw new Error('move requires numeric dx dy dz values.');
    if (shiftVec(object.origin, x, y, z) || shiftVec(object.center, x, y, z)) return true;
    if (Array.isArray(object.from) && Array.isArray(object.to)) {
      shiftVec(object.from, x, y, z); shiftVec(object.to, x, y, z); return true;
    }
    throw new Error(`Object '${id}' has no movable origin/center/from-to coordinates.`);
  });

  const rotateObject = (id, rotation) => mutate(`Rotated ${id} to ${rotation}.`, () => {
    const object = topLevelObject(draft, id);
    if (!object) throw new Error(`'${id}' is not a top-level editable layout object.`);
    const raw = String(rotation || '').toLowerCase();
    const current = ROTATIONS.indexOf(String(object.rotation || 'north').toLowerCase());
    let next = raw;
    if (['cw', 'right', '+1'].includes(raw)) next = ROTATIONS[(Math.max(0, current) + 1) % 4];
    if (['ccw', 'left', '-1'].includes(raw)) next = ROTATIONS[(Math.max(0, current) + 3) % 4];
    if (!ROTATIONS.includes(next)) throw new Error('rotation must be north/east/south/west/cw/ccw.');
    object.rotation = next;
    return true;
  });

  const duplicateObject = id => mutate(`Duplicated ${id}.`, () => {
    const layout = Array.isArray(draft.layout) ? draft.layout : (draft.layout = []);
    const object = topLevelObject(draft, id);
    if (!object) throw new Error(`'${id}' is not a top-level editable layout object.`);
    const copy = clone(object);
    let suffix = 2;
    while (layout.some(item => String(item.id || '') === `${id}-${suffix}`)) suffix += 1;
    copy.id = `${id}-${suffix}`;
    if (!(shiftVec(copy.origin, 2, 0, 2) || shiftVec(copy.center, 2, 0, 2))) {
      if (Array.isArray(copy.from) && Array.isArray(copy.to)) { shiftVec(copy.from, 2, 0, 2); shiftVec(copy.to, 2, 0, 2); }
    }
    layout.push(copy);
    selectedId = copy.id;
    return true;
  });

  const deleteObject = id => mutate(`Deleted ${id}.`, () => {
    const layout = Array.isArray(draft.layout) ? draft.layout : [];
    const index = layout.findIndex(item => String(item.id || '') === String(id));
    if (index < 0) throw new Error(`'${id}' is not a top-level editable layout object.`);
    layout.splice(index, 1);
    if (selectedId === id) selectedId = String(layout[Math.min(index, layout.length - 1)]?.id || '');
    return true;
  });

  const undoAction = () => {
    if (!undo.length) return writeResult({ ok: false, error: 'Undo stack is empty.' });
    redo.push(JSON.stringify(draft));
    draft = JSON.parse(undo.pop());
    return applyDraft('Undo applied.');
  };

  const redoAction = () => {
    if (!redo.length) return writeResult({ ok: false, error: 'Redo stack is empty.' });
    undo.push(JSON.stringify(draft));
    draft = JSON.parse(redo.pop());
    return applyDraft('Redo applied.');
  };

  const readCheckpoints = () => {
    try {
      const raw = localStorage.getItem(checkpointStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  };

  const writeCheckpoints = list => {
    localStorage.setItem(checkpointStorageKey(), JSON.stringify(list.slice(-8)));
  };

  const refreshCheckpoints = () => {
    const list = readCheckpoints();
    checkpointsSelect.innerHTML = list.length ? list.map(item => `<option value="${esc(item.name)}">${esc(item.name)} · ${esc(item.createdAt)}</option>`).join('') : '<option value="">NO CHECKPOINTS</option>';
  };

  const saveCheckpoint = name => {
    const clean = String(name || '').trim() || `checkpoint-${Date.now()}`;
    const list = readCheckpoints().filter(item => item.name !== clean);
    list.push({ name: clean, createdAt: new Date().toISOString(), document: clone(draft) });
    try { writeCheckpoints(list); } catch (error) { return writeResult({ ok: false, error: `Checkpoint storage failed: ${error?.message || error}` }); }
    refreshCheckpoints();
    checkpointsSelect.value = clean;
    return writeResult({ ok: true, checkpoint: clean });
  };

  const restoreCheckpoint = name => {
    const item = readCheckpoints().find(entry => entry.name === String(name || ''));
    if (!item) return writeResult({ ok: false, error: `Checkpoint '${name}' not found.` });
    const before = JSON.stringify(draft);
    draft = clone(item.document);
    return applyDraft(`Restored checkpoint ${item.name}.`, { pushHistory: true, before });
  };

  const importBlueprint = text => {
    try {
      const parsed = JSON.parse(String(text || ''));
      const before = JSON.stringify(draft);
      draft = parsed;
      const applied = applyDraft('Imported Blueprint JSON into staging.', { pushHistory: true, before });
      if (applied?.ok) blueprintInput.value = JSON.stringify(draft, null, 2);
      return applied;
    } catch (error) { return writeResult({ ok: false, error: `Invalid JSON: ${error?.message || error}` }); }
  };

  const captureView = (filename = '') => {
    try {
      const dataUrl = foundation.captureCanvasPng();
      const name = `${safeFileName(filename || foundation.imported?.id || 'riftcity')}-capture.png`;
      capturePreview.src = dataUrl;
      capturePreview.classList.add('show');
      captureDownload.href = dataUrl;
      captureDownload.download = name;
      captureDownload.classList.add('show');
      return writeResult({ ok: true, capture: name, width: foundation.canvas.width, height: foundation.canvas.height, camera: cameraState(foundation) });
    } catch (error) { return writeResult({ ok: false, error: `Capture failed: ${error?.message || error}` }); }
  };

  const help = () => writeResult(`RiftCity AI Builder commands\n\nscene\ninspect <object-id>\nselect <object-id>\nfocus <object-id>\ncamera birdseye|top|north|south|east|west|third-person [object-id]\nmove <object-id> <dx> <dy> <dz>\nrotate <object-id> north|east|south|west|cw|ccw\nduplicate <object-id>\ndelete <object-id>\nundo\nredo\ncheckpoint <name>\nrestore <name>\ncheckpoints\ncapture [filename]\nexport\nhelp`);

  const runCommand = raw => {
    const line = String(raw || '').trim();
    if (!line) return writeResult({ ok: false, error: 'Enter a command.' });
    const parts = line.match(/"[^"]*"|'[^']*'|\S+/g)?.map(part => part.replace(/^['"]|['"]$/g, '')) || [];
    const command = String(parts.shift() || '').toLowerCase();
    if (command === 'help') return help();
    if (command === 'scene') return writeResult({ ok: true, scene: sceneSnapshot(foundation) });
    if (command === 'inspect') { const id = parts.join(' ') || selectedId; const info = objectInfo(foundation, draft, id); return writeResult(info ? { ok: true, object: info } : { ok: false, error: `Unknown object '${id}'.` }); }
    if (command === 'select') return selectObject(parts.join(' '));
    if (command === 'focus') return focusObject(parts.join(' ') || selectedId);
    if (command === 'camera') return setCamera(parts[0] || 'birdseye', parts.slice(1).join(' '));
    if (command === 'move') return moveObject(parts[0] || selectedId, parts[1], parts[2], parts[3]);
    if (command === 'rotate') return rotateObject(parts[0] || selectedId, parts[1]);
    if (command === 'duplicate') return duplicateObject(parts.join(' ') || selectedId);
    if (command === 'delete') return deleteObject(parts.join(' ') || selectedId);
    if (command === 'undo') return undoAction();
    if (command === 'redo') return redoAction();
    if (command === 'checkpoint') return saveCheckpoint(parts.join(' '));
    if (command === 'restore') return restoreCheckpoint(parts.join(' '));
    if (command === 'checkpoints') return writeResult({ ok: true, checkpoints: readCheckpoints().map(({ name, createdAt }) => ({ name, createdAt })) });
    if (command === 'capture') return captureView(parts.join('-'));
    if (command === 'export') { downloadText(`${safeFileName(draft.id)}-ai-builder.json`, JSON.stringify(draft, null, 2)); return writeResult({ ok: true, exported: draft.id }); }
    return writeResult({ ok: false, error: `Unknown command '${command}'. Run help.` });
  };

  objectSelect.addEventListener('change', () => { selectedId = objectSelect.value; inspectSelected(); });
  q('[data-ai-inspect]').addEventListener('click', inspectSelected);
  q('[data-ai-focus]').addEventListener('click', () => focusObject(selectedId));
  q('[data-ai-scene]').addEventListener('click', () => writeResult({ ok: true, scene: sceneSnapshot(foundation) }));
  q('[data-ai-run]').addEventListener('click', () => runCommand(commandInput.value));
  q('[data-ai-help]').addEventListener('click', help);
  q('[data-ai-undo]').addEventListener('click', undoAction);
  q('[data-ai-redo]').addEventListener('click', redoAction);
  q('[data-ai-import]').addEventListener('click', () => importBlueprint(blueprintInput.value));
  q('[data-ai-load-current]').addEventListener('click', () => { blueprintInput.value = JSON.stringify(draft, null, 2); writeResult({ ok: true, message: 'Current staging Blueprint loaded into the textarea.' }); });
  q('[data-ai-export]').addEventListener('click', () => { downloadText(`${safeFileName(draft.id)}-ai-builder.json`, JSON.stringify(draft, null, 2)); writeResult({ ok: true, exported: draft.id }); });
  q('[data-ai-checkpoint]').addEventListener('click', () => saveCheckpoint(checkpointName.value));
  q('[data-ai-restore]').addEventListener('click', () => restoreCheckpoint(checkpointsSelect.value));
  q('[data-ai-capture]').addEventListener('click', () => captureView());
  playerButton.addEventListener('click', () => { playerVisible = !playerVisible; foundation.setPlayerVisible(playerVisible); playerButton.textContent = `PLAYER: ${playerVisible ? 'ON' : 'OFF'}`; writeResult({ ok: true, playerVisible }); });
  q('[data-ai-collapse]').addEventListener('click', () => panel.classList.toggle('collapsed'));
  panel.querySelectorAll('[data-ai-camera]').forEach(button => button.addEventListener('click', () => setCamera(button.dataset.aiCamera)));
  commandInput.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); runCommand(commandInput.value); } });

  const toolAbortController = new AbortController();
  const registerTool = async spec => {
    if (!document.modelContext?.registerTool) return false;
    await document.modelContext.registerTool(spec, { signal: toolAbortController.signal });
    return true;
  };

  const setupWebMcp = async () => {
    if (!document.modelContext?.registerTool) {
      webmcpBadge.textContent = 'WEBMCP FALLBACK UI';
      webmcpBadge.dataset.state = 'fallback';
      return;
    }
    const common = { annotations: { readOnlyHint: true } };
    const write = { annotations: { readOnlyHint: false } };
    const tools = [
      { name: 'rift_scene_state', description: 'Read the active RiftCity staging scene, Blueprint objects, bounds, stats, camera and player position.', inputSchema: { type: 'object', properties: {} }, execute: async () => sceneSnapshot(foundation), ...common },
      { name: 'rift_inspect_object', description: 'Inspect one RiftCity Blueprint object by exact object id.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, execute: async ({ id }) => objectInfo(foundation, draft, id) || { error: `Unknown object '${id}'.` }, ...common },
      { name: 'rift_focus_object', description: 'Select and move the RiftCity inspection camera to a birdseye view of one Blueprint object.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, execute: async ({ id }) => focusObject(id), ...write },
      { name: 'rift_set_camera', description: 'Set the RiftCity inspection camera. Modes: birdseye, top, north, south, east, west, third-person.', inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['birdseye','top','north','south','east','west','third-person'] }, object_id: { type: 'string' } }, required: ['mode'] }, execute: async ({ mode, object_id }) => setCamera(mode, object_id || ''), ...write },
      { name: 'rift_move_object', description: 'Move a top-level editable RiftCity Blueprint layout object by meter-grid deltas.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, dx: { type: 'number' }, dy: { type: 'number' }, dz: { type: 'number' } }, required: ['id','dx','dy','dz'] }, execute: async ({ id, dx, dy, dz }) => moveObject(id, dx, dy, dz), ...write },
      { name: 'rift_rotate_object', description: 'Rotate a top-level editable RiftCity Blueprint layout object.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, rotation: { type: 'string', enum: ['north','east','south','west','cw','ccw'] } }, required: ['id','rotation'] }, execute: async ({ id, rotation }) => rotateObject(id, rotation), ...write },
      { name: 'rift_duplicate_object', description: 'Duplicate a top-level editable RiftCity Blueprint layout object in staging.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, execute: async ({ id }) => duplicateObject(id), ...write },
      { name: 'rift_delete_object', description: 'Delete a top-level editable RiftCity Blueprint layout object from staging.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, execute: async ({ id }) => deleteObject(id), ...write },
      { name: 'rift_import_blueprint', description: 'Replace the staging scene with a RiftCity Blueprint JSON document.', inputSchema: { type: 'object', properties: { json: { type: 'string' } }, required: ['json'] }, execute: async ({ json }) => importBlueprint(json), ...write },
      { name: 'rift_undo', description: 'Undo the most recent RiftCity AI Builder staging edit.', inputSchema: { type: 'object', properties: {} }, execute: async () => undoAction(), ...write },
      { name: 'rift_redo', description: 'Redo the most recently undone RiftCity AI Builder staging edit.', inputSchema: { type: 'object', properties: {} }, execute: async () => redoAction(), ...write },
      { name: 'rift_checkpoint', description: 'Save a named local staging checkpoint for the current RiftCity Blueprint.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }, execute: async ({ name }) => saveCheckpoint(name), ...write },
      { name: 'rift_capture_view', description: 'Capture the current Rift Engine canvas as a clean PNG and show it in the AI Builder page.', inputSchema: { type: 'object', properties: { filename: { type: 'string' } } }, execute: async ({ filename } = {}) => captureView(filename || ''), ...write }
    ];
    for (const tool of tools) await registerTool(tool);
    webmcpBadge.textContent = `WEBMCP ${tools.length} TOOLS`;
    webmcpBadge.dataset.state = 'ready';
  };

  refreshScene();
  foundation.setInspectionCamera('birdseye', foundation.imported.worldBounds);
  blueprintInput.value = JSON.stringify(draft, null, 2);
  setupWebMcp().catch(error => {
    console.warn('RiftCity WebMCP registration failed', error);
    webmcpBadge.textContent = 'WEBMCP UI ONLY';
    webmcpBadge.dataset.state = 'error';
  });

  window.riftAiBuilder = Object.freeze({
    scene: () => sceneSnapshot(foundation),
    inspect: id => objectInfo(foundation, draft, id),
    run: runCommand,
    importBlueprint,
    capture: captureView
  });

  return {
    runCommand,
    scene: () => sceneSnapshot(foundation),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      toolAbortController.abort();
      foundation.playerController.setEnabled(true);
      document.body.classList.remove('rift-ai-builder-page');
      panel.remove();
      try { delete window.riftAiBuilder; } catch (_) {}
    }
  };
}
