import { WORLD3D_CITY_LAYOUT } from './world3d-city-layout.js';

const LAYOUT_PATH = 'public/world3d-city-layout.js';
const DRAFT_KEY = 'riftcity-world-editor-draft-v1';

export function cloneCityLayout() {
  return JSON.parse(JSON.stringify(WORLD3D_CITY_LAYOUT || { version: 1, locationOverrides: {}, customObjects: [] }));
}

export function createLayoutObjectManager(B, scene, shadowGenerator, materials, initialObjects = []) {
  const records = new Map();

  const build = object => {
    const root = new B.TransformNode(`editor-object-${object.id}`, scene);
    root.position.set(number(object.x), number(object.y), number(object.z));
    root.rotation.y = radians(number(object.rotationY));
    root.scaling.set(
      Math.max(0.15, number(object.scaleX, 1)),
      Math.max(0.15, number(object.scaleY, 1)),
      Math.max(0.15, number(object.scaleZ, 1))
    );

    const meshes = [];
    const own = mesh => {
      mesh.parent = root;
      mesh.metadata = { ...(mesh.metadata || {}), worldEditor: { kind: 'custom', id: object.id } };
      meshes.push(mesh);
      return mesh;
    };

    const type = object.type || 'building';
    if (type === 'tree') {
      const trunk = own(B.MeshBuilder.CreateCylinder(`${object.id}-trunk`, { height: 2.4, diameter: 0.35, tessellation: 8 }, scene));
      trunk.position.y = 1.2;
      trunk.material = materials.trunkMat;
      const crown = own(B.MeshBuilder.CreateSphere(`${object.id}-crown`, { diameter: 2.6, segments: 8 }, scene));
      crown.position.y = 3.15;
      crown.scaling.y = 1.2;
      crown.material = materials.foliageMat;
      shadowGenerator.addShadowCaster(crown);
    } else if (type === 'light') {
      const pole = own(B.MeshBuilder.CreateCylinder(`${object.id}-pole`, { height: 4.2, diameter: 0.12, tessellation: 8 }, scene));
      pole.position.y = 2.1;
      pole.material = materials.metalMat;
      const bulb = own(B.MeshBuilder.CreateSphere(`${object.id}-bulb`, { diameter: 0.32, segments: 8 }, scene));
      bulb.position.set(0.38, 4.05, 0);
      bulb.material = materials.accentMat;
    } else if (type === 'parked-car') {
      const body = own(B.MeshBuilder.CreateBox(`${object.id}-body`, { width: 1.8, height: 0.58, depth: 4.0 }, scene));
      body.position.y = 0.56;
      body.material = materials.accentMat;
      const cabin = own(B.MeshBuilder.CreateBox(`${object.id}-cabin`, { width: 1.46, height: 0.58, depth: 1.7 }, scene));
      cabin.position.set(0, 1.02, -0.12);
      cabin.material = materials.glassMat;
      for (const [x,y,z] of [[-.9,.34,-1.25],[.9,.34,-1.25],[-.9,.34,1.25],[.9,.34,1.25]]) {
        const wheel = own(B.MeshBuilder.CreateCylinder(`${object.id}-wheel-${x}-${z}`, { height:.24, diameter:.56, tessellation:10 }, scene));
        wheel.position.set(x,y,z);
        wheel.rotation.z = Math.PI / 2;
        wheel.material = materials.metalMat;
      }
      shadowGenerator.addShadowCaster(body);
    } else if (type === 'prop') {
      const base = own(B.MeshBuilder.CreateBox(`${object.id}-prop`, { width: 1.4, height: 1.15, depth: 1.0 }, scene));
      base.position.y = 0.58;
      base.material = materials.metalMat;
      shadowGenerator.addShadowCaster(base);
    } else {
      const base = own(B.MeshBuilder.CreateBox(`${object.id}-building`, { width: 10, height: 10, depth: 10 }, scene));
      base.position.y = 5;
      base.material = materials.buildingMats?.[0] || materials.metalMat;
      base.checkCollisions = true;
      base.receiveShadows = true;
      shadowGenerator.addShadowCaster(base);
      const door = own(B.MeshBuilder.CreateBox(`${object.id}-door`, { width: 1.8, height: 2.8, depth: 0.1 }, scene));
      door.position.set(0, 1.4, 5.05);
      door.material = materials.glassMat;
      const sign = own(B.MeshBuilder.CreateBox(`${object.id}-sign`, { width: 4.6, height: 0.55, depth: 0.15 }, scene));
      sign.position.set(0, 3.5, 5.12);
      sign.material = materials.accentMat;
    }

    records.set(object.id, { root, meshes });
    return records.get(object.id);
  };

  const clear = () => {
    for (const record of records.values()) {
      try { record.root.dispose(false, false); } catch (_) {}
      for (const mesh of record.meshes) {
        try { mesh.dispose(false, false); } catch (_) {}
      }
    }
    records.clear();
  };

  const replaceAll = objects => {
    clear();
    for (const object of objects || []) build(object);
  };

  const updateObject = object => {
    let record = records.get(object.id);
    if (!record) record = build(object);
    record.root.position.set(number(object.x), number(object.y), number(object.z));
    record.root.rotation.y = radians(number(object.rotationY));
    record.root.scaling.set(
      Math.max(0.15, number(object.scaleX, 1)),
      Math.max(0.15, number(object.scaleY, 1)),
      Math.max(0.15, number(object.scaleZ, 1))
    );
  };

  replaceAll(initialObjects);

  return {
    updateObject,
    replaceAll,
    remove(id) {
      const record = records.get(id);
      if (!record) return;
      try { record.root.dispose(false, false); } catch (_) {}
      for (const mesh of record.meshes) {
        try { mesh.dispose(false, false); } catch (_) {}
      }
      records.delete(id);
    },
    getRoot(id) { return records.get(id)?.root || null; },
    dispose: clear
  };
}

export function mountWorldEditor({
  root, scene, camera, player, locationEntries, chunkManager, objectManager, initialLayout, onLayoutChange
}) {
  const toggle = root.querySelector('#world3d-editor-button');
  const panel = root.querySelector('#world3d-editor');
  const close = root.querySelector('#world3d-editor-close');
  if (!toggle || !panel) return null;

  let layout = loadDraft(initialLayout);
  let selected = null;
  let step = 1;
  const undo = [];
  const redo = [];

  const status = panel.querySelector('[data-editor-status]');
  const selectedLabel = panel.querySelector('[data-editor-selected]');
  const selectedType = panel.querySelector('[data-editor-type]');
  const xOut = panel.querySelector('[data-editor-x]');
  const zOut = panel.querySelector('[data-editor-z]');
  const rotOut = panel.querySelector('[data-editor-rot]');
  const scaleOut = panel.querySelector('[data-editor-scale]');
  const stepSelect = panel.querySelector('[data-editor-step]');
  const jsonBox = panel.querySelector('[data-editor-json]');
  const placeType = panel.querySelector('[data-editor-place-type]');

  const say = message => {
    if (status) status.textContent = message;
  };

  const snapshot = () => JSON.stringify(layout);
  const pushUndo = () => {
    undo.push(snapshot());
    if (undo.length > 40) undo.shift();
    redo.length = 0;
  };

  const commit = message => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(layout));
    onLayoutChange?.(layout);
    refreshSelection();
    say(message);
  };

  const getCustom = id => layout.customObjects.find(row => row.id === id);
  const getLocation = id => locationEntries.find(row => row.id === id);

  const refreshSelection = () => {
    if (!selected) {
      if (selectedLabel) selectedLabel.textContent = 'Nothing selected';
      if (selectedType) selectedType.textContent = 'Tap a location/building or add an object.';
      if (xOut) xOut.textContent = '—';
      if (zOut) zOut.textContent = '—';
      if (rotOut) rotOut.textContent = '—';
      if (scaleOut) scaleOut.textContent = '—';
      return;
    }
    const object = selected.kind === 'custom' ? getCustom(selected.id) : getLocation(selected.id);
    if (!object) {
      selected = null;
      refreshSelection();
      return;
    }
    if (selectedLabel) selectedLabel.textContent = object.label || object.name || selected.id;
    if (selectedType) selectedType.textContent = selected.kind === 'custom' ? (object.type || 'object') : 'RiftCity location';
    if (xOut) xOut.textContent = format(object.x);
    if (zOut) zOut.textContent = format(object.z);
    if (rotOut) rotOut.textContent = selected.kind === 'custom' ? `${format(object.rotationY)}°` : 'fixed';
    if (scaleOut) scaleOut.textContent = selected.kind === 'custom'
      ? `${format(object.scaleX,1)} / ${format(object.scaleY,1)} / ${format(object.scaleZ,1)}`
      : 'generated';
  };

  const setSelected = next => {
    selected = next;
    refreshSelection();
    say(next ? 'Selected. Use the big nudge controls below.' : 'Selection cleared.');
  };

  const applyLocationOverride = entry => {
    layout.locationOverrides[entry.id] = { x: round(entry.x), z: round(entry.z) };
    chunkManager.refreshEntry?.(entry.id);
  };

  const nudge = (axis, amount) => {
    if (!selected) return say('Select something first.');
    pushUndo();
    if (selected.kind === 'location') {
      const entry = getLocation(selected.id);
      if (!entry) return;
      entry[axis] = round(number(entry[axis]) + amount);
      applyLocationOverride(entry);
    } else {
      const object = getCustom(selected.id);
      if (!object) return;
      object[axis] = round(number(object[axis]) + amount);
      objectManager.updateObject(object);
    }
    commit('Moved.');
  };

  const rotate = amount => {
    if (!selected || selected.kind !== 'custom') return say('Rotation is available for placed editor objects.');
    pushUndo();
    const object = getCustom(selected.id);
    object.rotationY = round((number(object.rotationY) + amount + 360) % 360);
    objectManager.updateObject(object);
    commit('Rotated.');
  };

  const scale = (axis, amount) => {
    if (!selected || selected.kind !== 'custom') return say('Scaling is available for placed editor objects.');
    pushUndo();
    const object = getCustom(selected.id);
    object[axis] = Math.max(0.15, round(number(object[axis], 1) + amount));
    objectManager.updateObject(object);
    commit('Scaled.');
  };

  const addObject = () => {
    pushUndo();
    const type = placeType?.value || 'building';
    const id = `custom-${type}-${Date.now().toString(36)}`;
    const object = {
      id,
      type,
      label: `Custom ${type.replace('-', ' ')}`,
      x: round(player.root.position.x + 3),
      y: type === 'building' ? 0 : 0,
      z: round(player.root.position.z + 3),
      rotationY: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1
    };
    layout.customObjects.push(object);
    objectManager.updateObject(object);
    setSelected({ kind: 'custom', id });
    commit('Object added beside the player.');
  };

  const deleteSelected = () => {
    if (!selected) return say('Select something first.');
    if (selected.kind === 'location') return say('Core RiftCity locations cannot be deleted; move them instead.');
    pushUndo();
    layout.customObjects = layout.customObjects.filter(row => row.id !== selected.id);
    objectManager.remove(selected.id);
    selected = null;
    commit('Object deleted.');
  };

  const resetSelected = () => {
    if (!selected) return say('Select something first.');
    pushUndo();
    if (selected.kind === 'location') {
      delete layout.locationOverrides[selected.id];
      const entry = getLocation(selected.id);
      if (entry?.baseX != null) {
        entry.x = entry.baseX;
        entry.z = entry.baseZ;
      }
      chunkManager.refreshEntry?.(selected.id);
    } else {
      const object = getCustom(selected.id);
      object.rotationY = 0;
      object.scaleX = object.scaleY = object.scaleZ = 1;
      objectManager.updateObject(object);
    }
    commit('Selection reset.');
  };

  const doUndo = () => {
    if (!undo.length) return say('Nothing to undo.');
    redo.push(snapshot());
    layout = JSON.parse(undo.pop());
    applyWholeLayout();
    commit('Undo complete.');
  };

  const doRedo = () => {
    if (!redo.length) return say('Nothing to redo.');
    undo.push(snapshot());
    layout = JSON.parse(redo.pop());
    applyWholeLayout();
    commit('Redo complete.');
  };

  const applyWholeLayout = () => {
    for (const entry of locationEntries) {
      const override = layout.locationOverrides?.[entry.id];
      entry.x = override?.x ?? entry.baseX ?? entry.x;
      entry.z = override?.z ?? entry.baseZ ?? entry.z;
      chunkManager.refreshEntry?.(entry.id);
    }
    objectManager.replaceAll(layout.customObjects || []);
    selected = null;
    refreshSelection();
    onLayoutChange?.(layout);
  };

  const exportPatch = async () => {
    const content = serializeLayout(layout);
    let baseSha = null;
    try {
      const response = await fetch('/world3d-city-layout.js', { cache: 'no-store' });
      if (response.ok) baseSha = await sha256(await response.text());
    } catch (_) {}

    const patch = {
      format: 'riftcity-ai-patch',
      version: 1,
      title: 'RiftCity visual city layout edit',
      target_repo: 'Arctic403/RiftCityV1',
      target_branch: 'main',
      base_snapshot_sha256: null,
      changes: [{
        action: 'write',
        path: LAYOUT_PATH,
        base_sha256: baseSha,
        reason: 'Apply visual city edits exported from the in-game DEV WORLD EDITOR.',
        content
      }]
    };
    const json = JSON.stringify(patch, null, 2);
    if (jsonBox) {
      jsonBox.hidden = false;
      jsonBox.value = json;
    }
    downloadText(`RiftCity-City-Layout-${new Date().toISOString().replace(/[:.]/g,'-')}.patch.json`, json);
    say(baseSha ? 'Patch exported. Import it into your Editor.' : 'Patch exported. Base hash could not be read, so review it in your Editor before applying.');
  };

  const clearDraft = () => {
    pushUndo();
    localStorage.removeItem(DRAFT_KEY);
    layout = cloneLayout(initialLayout);
    applyWholeLayout();
    commit('Local draft reset to the deployed city layout.');
  };

  toggle.addEventListener('click', () => {
    panel.classList.toggle('open');
    toggle.classList.toggle('active', panel.classList.contains('open'));
    refreshSelection();
  });
  close?.addEventListener('click', () => panel.classList.remove('open'));
  stepSelect?.addEventListener('change', () => { step = Math.max(0.1, number(stepSelect.value, 1)); });

  panel.querySelectorAll('[data-editor-nudge]').forEach(button => {
    button.addEventListener('click', () => {
      const [axis, direction] = button.dataset.editorNudge.split(':');
      nudge(axis, (direction === '+' ? 1 : -1) * step);
    });
  });
  panel.querySelectorAll('[data-editor-rotate]').forEach(button => {
    button.addEventListener('click', () => rotate(Number(button.dataset.editorRotate)));
  });
  panel.querySelectorAll('[data-editor-scale]').forEach(button => {
    button.addEventListener('click', () => {
      const [axis, amount] = button.dataset.editorScale.split(':');
      scale(axis, Number(amount));
    });
  });

  panel.querySelector('[data-editor-add]')?.addEventListener('click', addObject);
  panel.querySelector('[data-editor-delete]')?.addEventListener('click', deleteSelected);
  panel.querySelector('[data-editor-reset]')?.addEventListener('click', resetSelected);
  panel.querySelector('[data-editor-undo]')?.addEventListener('click', doUndo);
  panel.querySelector('[data-editor-redo]')?.addEventListener('click', doRedo);
  panel.querySelector('[data-editor-export]')?.addEventListener('click', exportPatch);
  panel.querySelector('[data-editor-clear-draft]')?.addEventListener('click', clearDraft);

  const pointerObserver = scene.onPointerObservable.add(pointerInfo => {
    if (!panel.classList.contains('open')) return;
    if (pointerInfo.type !== 1) return;
    const pick = pointerInfo.pickInfo;
    const mesh = pick?.pickedMesh;
    const metadata = mesh?.metadata?.worldEditor;
    if (metadata?.kind === 'custom') return setSelected({ kind: 'custom', id: metadata.id });
    if (metadata?.kind === 'location') return setSelected({ kind: 'location', id: metadata.id });
  });

  applyWholeLayout();
  say('DEV editor ready. Tap a RiftCity location or add an object.');

  return {
    getLayout: () => layout,
    dispose() {
      try { scene.onPointerObservable.remove(pointerObserver); } catch (_) {}
    }
  };
}

export function serializeLayout(layout) {
  const clean = {
    version: 1,
    locationOverrides: layout.locationOverrides || {},
    customObjects: layout.customObjects || []
  };
  return `export const WORLD3D_CITY_LAYOUT = Object.freeze(${JSON.stringify(clean, null, 2)});\n`;
}

function loadDraft(initialLayout) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return cloneLayout(initialLayout);
}

function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout || { version: 1, locationOverrides: {}, customObjects: [] }));
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function round(value) { return Math.round(value * 100) / 100; }
function format(value, fallback = 0) { return number(value, fallback).toFixed(2); }
function radians(degrees) { return degrees * Math.PI / 180; }

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
