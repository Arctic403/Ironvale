from pathlib import Path
import json


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old, new, 1)


def patch_file(path, transform):
    p = Path(path)
    original = p.read_text()
    updated = transform(original)
    if updated == original:
        raise SystemExit(f'patch produced no change: {path}')
    p.write_text(updated)


def patch_app(text):
    text = replace_once(
        text,
        "import { RiftTerrain } from './rift-terrain.js?v=20260831-character-freecam-r2';",
        "import { RiftLandscape } from './rift-landscape.js?v=20260831-rift-landscape-v2';",
        'app landscape import'
    )
    text = replace_once(
        text,
        "const LOCAL_DRAFT_KEY = 'ironvale:terrain:draft:v2';",
        "const LOCAL_DRAFT_KEY = 'ironvale:terrain:draft:v3';\nconst LEGACY_LOCAL_DRAFT_KEY = 'ironvale:terrain:draft:v2';",
        'landscape draft key'
    )
    text = replace_once(
        text,
        "const freecamSpeedValue = $('#freecam-speed-value');",
        "const freecamSpeedValue = $('#freecam-speed-value');\nconst editLayerSelect = $('#terrain-edit-layer');\nconst addEditLayerButton = $('#add-terrain-edit-layer');",
        'layer ui refs'
    )
    text = replace_once(
        text,
        "freecamSpeedInput.addEventListener('input', refreshEditorLabels);",
        """freecamSpeedInput.addEventListener('input', refreshEditorLabels);
editLayerSelect?.addEventListener('change', () => {
  if (!terrain?.setActiveEditLayer(editLayerSelect.value)) return;
  refreshTerrainLayerControls();
  editorStatus.textContent = `Editing terrain layer: ${terrain.activeEditLayer?.name || editLayerSelect.value}.`;
});
addEditLayerButton?.addEventListener('click', () => {
  if (!terrain?.createEditLayer) return;
  const created = terrain.createEditLayer(`Layer ${terrain.listEditLayers().length + 1}`);
  refreshTerrainLayerControls();
  editorStatus.textContent = `Created non-destructive terrain layer: ${created?.name || 'Layer'}.`;
});""",
        'layer ui listeners'
    )
    text = replace_once(text, "terrain = new RiftTerrain(worldDocument.terrain);", "terrain = new RiftLandscape(worldDocument.terrain);", 'start landscape')
    text = replace_once(
        text,
        "  restoreLocalDraft();\n  engine = new RiftEngine(canvas);",
        "  restoreLocalDraft();\n  refreshTerrainLayerControls();\n  engine = new RiftEngine(canvas);",
        'refresh layers on start'
    )
    text = replace_once(
        text,
        "terrainStatus.textContent = `640×640 · ${stats.components ?? 25} components · ${stats.surfaceSections ?? terrainMeshes.size} sections · adaptive LOD`;",
        "terrainStatus.textContent = `RiftLandscape · 640×640 · ${stats.components ?? 25} components · ${stats.surfaceSections ?? terrainMeshes.size} sections · ${stats.editLayers ?? 1} edit layer${(stats.editLayers ?? 1) === 1 ? '' : 's'} · adaptive LOD`;",
        'landscape boot status'
    )
    text = replace_once(
        text,
        """  const nextPlan = terrain.planSectionLods(
    Number.isFinite(cameraX) ? cameraX : player.x,
    Number.isFinite(cameraZ) ? cameraZ : player.z
  );""",
        """  const nextPlan = terrain.planSectionLods(
    Number.isFinite(cameraX) ? cameraX : player.x,
    Number.isFinite(cameraZ) ? cameraZ : player.z,
    terrainLodPlan
  );""",
        'lod hysteresis previous plan'
    )
    text = replace_once(
        text,
        """function captureTerrainState() {
  return {
    heights: new Float32Array(terrain.heights),
    manualDelta: new Float32Array(terrain.manualDelta),
    manualHoles: new Uint8Array(terrain.manualHoles),
    revision: terrain.revision
  };
}

function restoreTerrainState(state) {
  if (!terrain || !state) return;
  terrain.heights.set(state.heights);
  terrain.manualDelta.set(state.manualDelta);
  terrain.manualHoles.set(state.manualHoles);
  terrain.revision = state.revision + 1;
  rebuildTerrainMeshes();
  snapPlayerToSupport();
  updateReticleTarget();
}""",
        """function captureTerrainState() {
  return terrain?.captureEditState?.() || null;
}

function restoreTerrainState(state) {
  if (!terrain || !state || !terrain.restoreEditState?.(state)) return;
  rebuildTerrainMeshes();
  snapPlayerToSupport();
  updateReticleTarget();
  refreshTerrainLayerControls();
}""",
        'layer aware undo state'
    )
    start = text.index('function serializeTerrainEdits() {')
    end = text.index('\nfunction saveDraft() {', start)
    text = text[:start] + """function serializeTerrainEdits() {
  if (!terrain?.serializeLandscapeEdits) return null;
  return terrain.serializeLandscapeEdits({ worldId: worldDocument?.id || 'ironvale-terrain' });
}

function applySerializedEdits(data) {
  if (!terrain || !data) return false;
  if (data.format === 'rift-landscape-edits-v1') return terrain.applySerializedLandscapeEdits?.(data) === true;
  if (data.format === 'rift-terrain-edit-v2') return terrain.importLegacyManualEdits?.(data) === true;
  return false;
}
""" + text[end:]
    text = replace_once(
        text,
        """function saveDraftSilently() {
  if (!terrain) return;
  try { localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(serializeTerrainEdits())); } catch {}
}

function restoreLocalDraft() {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (raw) applySerializedEdits(JSON.parse(raw));
  } catch {}
}""",
        """function saveDraftSilently() {
  if (!terrain) return;
  try {
    const serialized = serializeTerrainEdits();
    if (serialized) localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(serialized));
  } catch {}
}

function restoreLocalDraft() {
  try {
    const current = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (current && applySerializedEdits(JSON.parse(current))) return;
    const legacy = localStorage.getItem(LEGACY_LOCAL_DRAFT_KEY);
    if (legacy && applySerializedEdits(JSON.parse(legacy))) saveDraftSilently();
  } catch {}
}""",
        'draft migration'
    )
    text = text.replace("'ironvale-terrain-edits.json'", "'ironvale-landscape-edits.json'")
    text = text.replace("link.download = 'ironvale-terrain-edits.json';", "link.download = 'ironvale-landscape-edits.json';")
    text = replace_once(text, "terrain = new RiftTerrain(worldDocument.terrain);", "terrain = new RiftLandscape(worldDocument.terrain);", 'reset landscape')
    text = replace_once(
        text,
        "  try { localStorage.removeItem(LOCAL_DRAFT_KEY); } catch {}",
        "  try { localStorage.removeItem(LOCAL_DRAFT_KEY); localStorage.removeItem(LEGACY_LOCAL_DRAFT_KEY); } catch {}",
        'clear both draft versions'
    )
    text = replace_once(
        text,
        "  rebuildTerrainMeshes();\n  snapPlayerToSupport();\n  updateReticleTarget();\n  terrainStatus.textContent = `640×640 blank terrain reset",
        "  rebuildTerrainMeshes();\n  snapPlayerToSupport();\n  updateReticleTarget();\n  refreshTerrainLayerControls();\n  terrainStatus.textContent = `640×640 blank terrain reset",
        'reset layer controls'
    )
    marker = "function refreshEditorLabels() {"
    if marker not in text:
        raise SystemExit('missing patch anchor: refresh editor labels')
    layer_controls = """function refreshTerrainLayerControls() {
  if (!editLayerSelect) return;
  const layers = terrain?.listEditLayers?.() || [];
  editLayerSelect.replaceChildren(...layers.map(layer => {
    const option = document.createElement('option');
    option.value = layer.id;
    option.textContent = `${layer.name}${layer.locked ? ' 🔒' : ''}`;
    option.disabled = layer.locked;
    return option;
  }));
  if (terrain?.activeEditLayerId) editLayerSelect.value = terrain.activeEditLayerId;
  addEditLayerButton.disabled = !terrain?.createEditLayer;
}

"""
    text = text.replace(marker, layer_controls + marker, 1)
    text = replace_once(
        text,
        "terrainStatus.textContent = `640×640 · edit ${terrain.revision} · ${lodSummary() || 'adaptive LOD'}`;",
        "terrainStatus.textContent = `RiftLandscape · ${terrain.activeEditLayer?.name || 'Sculpt'} · edit ${terrain.revision} · ${lodSummary() || 'adaptive LOD'}`;",
        'sculpt layer status'
    )
    return text


def patch_index(text):
    text = replace_once(
        text,
        '<small>Centered-reticle RPG camera + Freecam sculpting.</small>',
        '<small>RiftLandscape edit layers · component LOD · Freecam sculpting.</small>',
        'terrain tools subtitle'
    )
    text = replace_once(
        text,
        """      <div class="brush-grid brush-modes">
        <button data-brush="raise" class="active">Raise</button>
        <button data-brush="lower">Lower</button>
        <button data-brush="smooth">Smooth</button>
        <button data-brush="flatten">Flatten</button>
        <button data-brush="hole">Cut Hole</button>
        <button data-brush="unhole">Fill Hole</button>
      </div>

      <label>Radius""",
        """      <div class="brush-grid brush-modes">
        <button data-brush="raise" class="active">Raise</button>
        <button data-brush="lower">Lower</button>
        <button data-brush="smooth">Smooth</button>
        <button data-brush="flatten">Flatten</button>
        <button data-brush="hole">Cut Hole</button>
        <button data-brush="unhole">Fill Hole</button>
      </div>

      <div class="landscape-layer-row">
        <label class="landscape-layer-label">Edit Layer <select id="terrain-edit-layer" aria-label="Terrain edit layer"></select></label>
        <button id="add-terrain-edit-layer" type="button">+ Layer</button>
      </div>

      <label>Radius""",
        'edit layer controls'
    )
    text = replace_once(text, '/styles.css?v=20260831-landscape-rpg-r1', '/styles.css?v=20260831-rift-landscape-v2', 'style cache')
    text = replace_once(text, '/app.js?v=20260831-pinch-zoom-r2', '/app.js?v=20260831-rift-landscape-v2', 'app cache')
    return text


def patch_styles(text):
    text = replace_once(text, 'button,input{font:inherit}', 'button,input,select{font:inherit}', 'select font')
    anchor = '.history-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}'
    addition = """.landscape-layer-row{display:grid;grid-template-columns:minmax(0,1fr) 76px;gap:7px;align-items:end;margin-top:10px}
.landscape-layer-label{display:grid!important;grid-template-columns:1fr!important;gap:5px!important;margin:0!important;color:#a9c5b0}
.landscape-layer-label select{width:100%;height:38px;padding:0 9px;border:1px solid #ffffff20;border-radius:9px;background:#101b15;color:#f1f6f2;outline:none}
.landscape-layer-label select:focus{border-color:#7bc58c}
#add-terrain-edit-layer{height:38px;min-height:38px}
"""
    if anchor not in text:
        raise SystemExit('missing patch anchor: terrain history grid css')
    text = text.replace(anchor, addition + anchor, 1)
    return text


def patch_package(text):
    return replace_once(
        text,
        'node --check public/rift-terrain.js && node scripts/check-native.mjs',
        'node --check public/rift-terrain.js && node --check public/rift-landscape.js && node scripts/check-native.mjs',
        'landscape syntax check'
    )


def patch_check(text):
    text = replace_once(
        text,
        "if (world.terrain?.lod?.neighborMaxLevelDelta !== 1 || world.terrain?.lod?.seamMode !== 'edge-morph') failures.push('terrain LOD seam contract');",
        """if (world.terrain?.lod?.neighborMaxLevelDelta !== 1 || world.terrain?.lod?.seamMode !== 'edge-morph') failures.push('terrain LOD seam contract');
if (world.terrain?.landscape?.format !== 'rift-landscape-v2') failures.push('RiftLandscape v2 config');
if (!Array.isArray(world.terrain?.landscape?.editLayers) || world.terrain.landscape.editLayers[0]?.id !== 'sculpt') failures.push('landscape edit layers');
if (!Array.isArray(world.terrain?.landscape?.materialLayers) || world.terrain.landscape.materialLayers.length < 4) failures.push('landscape material weight layers');
if (!(Number(world.terrain?.landscape?.lodHysteresis) > 0)) failures.push('landscape LOD hysteresis');""",
        'landscape world checks'
    )
    text = replace_once(
        text,
        "if (!app.includes('function updateTerrainLod(') || !app.includes('terrain.planSectionLods(')) failures.push('adaptive terrain LOD controller');",
        """if (!app.includes('function updateTerrainLod(') || !app.includes('terrain.planSectionLods(')) failures.push('adaptive terrain LOD controller');
if (!app.includes("import { RiftLandscape } from './rift-landscape.js?v=") || !app.includes('new RiftLandscape(worldDocument.terrain)')) failures.push('RiftLandscape runtime integration');
if (!app.includes("ironvale:terrain:draft:v3") || !app.includes('serializeLandscapeEdits') || !app.includes('captureEditState')) failures.push('layer-aware terrain persistence/undo');
if (!app.includes('refreshTerrainLayerControls') || !app.includes("$('#terrain-edit-layer')")) failures.push('terrain edit layer controls');""",
        'landscape app checks'
    )
    text = replace_once(
        text,
        "if (!indexHtml.includes('id=\"combat-hud\"') || !indexHtml.includes('id=\"rotate-device\"') || !indexHtml.includes('data-ability-slot=\"1\"')) failures.push('landscape RPG HUD markup');",
        """if (!indexHtml.includes('id="combat-hud"') || !indexHtml.includes('id="rotate-device"') || !indexHtml.includes('data-ability-slot="1"')) failures.push('landscape RPG HUD markup');
if (!indexHtml.includes('id="terrain-edit-layer"') || !indexHtml.includes('id="add-terrain-edit-layer"')) failures.push('RiftLandscape edit-layer UI');""",
        'layer ui check'
    )
    text = replace_once(
        text,
        "const terrain = fs.readFileSync('public/rift-terrain.js', 'utf8');",
        """const terrain = fs.readFileSync('public/rift-terrain.js', 'utf8');
const landscape = fs.readFileSync('public/rift-landscape.js', 'utf8');
if (!landscape.includes('class RiftLandscape extends RiftTerrain') || !landscape.includes('recomposeEditLayers(') || !landscape.includes('paintMaterial(')) failures.push('RiftLandscape edit/weight architecture');
if (!landscape.includes('captureEditState(') || !landscape.includes('serializeLandscapeEdits(') || !landscape.includes('importLegacyManualEdits(')) failures.push('RiftLandscape persistence architecture');
if (!landscape.includes('planSectionLods(cameraX, cameraZ, previousPlan') || !landscape.includes('lodHysteresis')) failures.push('RiftLandscape LOD hysteresis');
if (!landscape.includes('consumeDirtyComponents(') || !landscape.includes('streamKey')) failures.push('RiftLandscape component streaming hooks');
if (!landscape.includes('setSpline(') || !landscape.includes('removeSpline(')) failures.push('RiftLandscape spline data hooks');""",
        'landscape module checks'
    )
    text = replace_once(
        text,
        "console.log('Ironvale core verified: textured animated humanoid + landscape RPG tap-target controls + Freecam reticle tools + adaptive stitched terrain LOD + C++/WASM terrain core.');",
        "console.log('Ironvale core verified: RiftLandscape v2 edit layers + material weights + component LOD hysteresis/streaming hooks + C++/WASM terrain + mobile RPG camera/character runtime.');",
        'verification summary'
    )
    return text


def patch_readme(text):
    addition = """

## RiftLandscape v2

Ironvale's terrain management layer is now `RiftLandscape`, an Unreal-Landscape-inspired architecture over the existing RiftCore native heightfield. The native C++/WASM core still owns height sampling, sculpt math, collision queries, raycasts, section mesh generation and stitched LOD edges; RiftLandscape adds higher-level authoring and streaming state without moving hot terrain math back into JavaScript.

RiftLandscape organizes the world as **128 m components → 64 m render sections → 1 m source samples**. Sculpting writes into an active non-destructive edit layer, and enabled layers are composited back into the native heightfield. Layer enable/disable, ordering, locking, undo/redo snapshots and sparse draft serialization are first-class. Legacy `rift-terrain-edit-v2` drafts migrate into the default Sculpt layer.

The landscape also owns sparse material weightmaps (grass/dirt/rock/gravel/mud/path slots), spline metadata hooks for future roads/rivers, dirty-component tracking, component streaming keys, collision-LOD policy hooks, and LOD hysteresis so section detail does not flap at distance thresholds. Material weight data and splines are foundation data in this milestone; terrain shader blending and spline deformation come on top of this architecture rather than replacing it.
"""
    if '## RiftLandscape v2' not in text:
        text += addition
    return text


def patch_worker(text):
    return replace_once(
        text,
        "foundation: 'rift-terrain-v1',",
        "foundation: 'rift-landscape-v2',\n      terrainFormat: 'rift-terrain-v1',",
        'bootstrap landscape foundation'
    )


patch_file('public/app.js', patch_app)
patch_file('public/index.html', patch_index)
patch_file('public/styles.css', patch_styles)
patch_file('package.json', patch_package)
patch_file('scripts/check-core.js', patch_check)
patch_file('README.md', patch_readme)
patch_file('src/index.js', patch_worker)

world_path = Path('public/world/ironvale-terrain.json')
world = json.loads(world_path.read_text())
terrain = world['terrain']
terrain['landscape'] = {
    'format': 'rift-landscape-v2',
    'editLayers': [
        {'id': 'sculpt', 'name': 'Sculpt', 'enabled': True, 'locked': False, 'opacity': 1}
    ],
    'activeEditLayer': 'sculpt',
    'baseMaterialLayer': 'grass',
    'materialLayers': [
        {'id': 'grass', 'name': 'Grass', 'defaultWeight': 255},
        {'id': 'dirt', 'name': 'Dirt', 'defaultWeight': 0},
        {'id': 'rock', 'name': 'Rock', 'defaultWeight': 0},
        {'id': 'gravel', 'name': 'Gravel', 'defaultWeight': 0},
        {'id': 'mud', 'name': 'Mud', 'defaultWeight': 0},
        {'id': 'path', 'name': 'Path', 'defaultWeight': 0}
    ],
    'splines': [],
    'lodHysteresis': 0.12,
    'streaming': {'enabled': True, 'componentRadius': 3, 'preloadRing': 1}
}
world['metadata']['worldFoundation'] = 'rift-landscape-v2'
world['metadata']['terrainOrganization'] = 'RiftLandscape: 128m components / 64m sections / 1m source samples / non-destructive edit layers'
world['metadata']['nonDestructiveTerrainLayers'] = True
world['metadata']['materialWeightmaps'] = True
world['metadata']['landscapeSplineHooks'] = True
world_path.write_text(json.dumps(world, indent=2) + '\n')

print('RiftLandscape v2 integration applied.')
