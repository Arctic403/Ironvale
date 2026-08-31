from pathlib import Path

BUILD = '20260831-character-freecam-r2'
MODEL_SHA = '14697e33502e41ddbc1b7fdbf56bbf0478027700'
ANIM_SHA = '4fccf561b9b2ef73f611efe21981ef8739080065'


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old, new, 1)


# Character payload sanity check: both GLBs must still exist and be real GLB files.
for name, expected_size in [
    ('public/assets/characters/quaternius/universal-base-male.glb', 6465208),
    ('public/assets/characters/quaternius/universal-animation-library.glb', 2714756),
]:
    p = Path(name)
    if not p.exists() or p.stat().st_size != expected_size or p.read_bytes()[:4] != b'glTF':
        raise SystemExit(f'character payload invalid: {name}')

app_path = Path('public/app.js')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "import { RiftEngine } from './rift-engine.js';\nimport { RiftTerrain } from './rift-terrain.js';\nimport { loadRiggedCharacterAsset } from './rift-character.js';",
    f"import {{ RiftEngine }} from './rift-engine.js?v={BUILD}';\nimport {{ RiftTerrain }} from './rift-terrain.js?v={BUILD}';\nimport {{ loadRiggedCharacterAsset }} from './rift-character.js?v={BUILD}';\n\nconst CHARACTER_MODEL_URL = new URL('./assets/characters/quaternius/universal-base-male.glb?v={MODEL_SHA}', import.meta.url).href;\nconst CHARACTER_ANIMATION_URL = new URL('./assets/characters/quaternius/universal-animation-library.glb?v={ANIM_SHA}', import.meta.url).href;",
    'versioned module imports',
)
app = replace_once(
    app,
    "    asset = await loadRiggedCharacterAsset(\n      '/assets/characters/quaternius/universal-base-male.glb',\n      '/assets/characters/quaternius/universal-animation-library.glb'\n    );",
    "    asset = await loadRiggedCharacterAsset(\n      CHARACTER_MODEL_URL,\n      CHARACTER_ANIMATION_URL\n    );",
    'character URLs',
)
app = replace_once(
    app,
    "    console.warn('Rigged humanoid failed to load; keeping capsule fallback.', error);",
    "    const characterError = String(error?.message || error || 'unknown error').slice(0, 120);\n    if (terrainStatus) terrainStatus.textContent = `${terrainStatus.textContent} · character fallback: ${characterError}`;\n    console.warn('Rigged humanoid failed to load; keeping capsule fallback.', error);",
    'visible character fallback error',
)
app = replace_once(
    app,
    "  cancelGesture();\n  if (next && preserveCamera) {",
    "  cancelGesture();\n  // Capture the actual current orbit view, not a potentially stale previous-frame camera.\n  if (next && preserveCamera && !freecamEnabled) updateOrbitCamera();\n  if (next && preserveCamera) {",
    'fresh freecam entry camera',
)
app = replace_once(
    app,
    "  editorStatus.textContent = freecamEnabled\n    ? 'Swipe to look. Hold, then drag to sculpt continuously. Tap for one stamp.'\n    : 'Turn Freecam ON to sculpt terrain.';\n}",
    "  editorStatus.textContent = freecamEnabled\n    ? 'Swipe to look. Hold, then drag to sculpt continuously. Tap for one stamp.'\n    : 'Turn Freecam ON to sculpt terrain.';\n  // Make the mode switch atomic: camera, center ray and reticle all agree immediately.\n  updateCamera();\n  updateReticleTarget();\n}",
    'atomic freecam switch',
)
app = replace_once(
    app,
    "    if (gesture.mode === 'look') {\n      applyCameraLookDelta(freecam, dx, dy, FREECAM_MIN_PITCH, FREECAM_MAX_PITCH);\n      return;\n    }",
    "    if (gesture.mode === 'look') {\n      event.preventDefault();\n      applyCameraLookDelta(freecam, dx, dy, FREECAM_MIN_PITCH, FREECAM_MAX_PITCH);\n      updateCamera();\n      updateReticleTarget();\n      return;\n    }",
    'live freecam look refresh',
)
app = replace_once(
    app,
    "    if (!freecamEnabled) {\n      if (event.pointerId === orbitPointerId) orbitPointerId = null;\n      return;\n    }",
    "    if (!freecamEnabled) {\n      if (event.pointerId === orbitPointerId) orbitPointerId = null;\n      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);\n      return;\n    }",
    'orbit pointer release',
)
app = replace_once(
    app,
    "    const sculpted = endedGesture.mode === 'sculpt';\n    endContinuousSculpt();",
    "    const sculpted = endedGesture.mode === 'sculpt';\n    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);\n    endContinuousSculpt();",
    'freecam pointer release',
)
app_path.write_text(app, encoding='utf-8')

character_path = Path('public/rift-character.js')
character = character_path.read_text(encoding='utf-8')
character = replace_once(
    character,
    'const CHARACTER_STRIDE = 19;',
    f"const CHARACTER_STRIDE = 19;\nconst DEFAULT_CHARACTER_MODEL_URL = new URL('./assets/characters/quaternius/universal-base-male.glb?v={MODEL_SHA}', import.meta.url).href;\nconst DEFAULT_CHARACTER_ANIMATION_URL = new URL('./assets/characters/quaternius/universal-animation-library.glb?v={ANIM_SHA}', import.meta.url).href;",
    'character default URLs',
)
character = character.replace("{ cache: 'force-cache' }", "{ cache: 'no-cache' }")
character = replace_once(
    character,
    "  modelUrl = '/assets/characters/quaternius/universal-base-male.glb',\n  animationUrl = '/assets/characters/quaternius/universal-animation-library.glb'",
    '  modelUrl = DEFAULT_CHARACTER_MODEL_URL,\n  animationUrl = DEFAULT_CHARACTER_ANIMATION_URL',
    'character function defaults',
)
character = replace_once(
    character,
    "export async function loadRiggedCharacterGeometry(url = '/assets/characters/quaternius/universal-base-male.glb') {",
    'export async function loadRiggedCharacterGeometry(url = DEFAULT_CHARACTER_MODEL_URL) {',
    'geometry helper default',
)
character_path.write_text(character, encoding='utf-8')

index_path = Path('public/index.html')
index = index_path.read_text(encoding='utf-8')
index = replace_once(
    index,
    '<script type="module" src="/app.js"></script>',
    f'<script type="module" src="/app.js?v={BUILD}"></script>',
    'app cache-bust',
)
index_path.write_text(index, encoding='utf-8')

check_path = Path('scripts/check-core.js')
check = check_path.read_text(encoding='utf-8')
check = replace_once(
    check,
    "if (!app.includes(\"import { loadRiggedCharacterAsset } from './rift-character.js'\") || !app.includes('function installRiggedPlayerVisual(') || !app.includes('function updatePlayerVisualTransform(') || !app.includes('function updatePlayerCharacterAnimation(')) failures.push('animated textured humanoid controller hookup');",
    "if (!/import \\{ loadRiggedCharacterAsset \\} from '\\.\\/rift-character\\.js\\?v=/.test(app) || !app.includes('function installRiggedPlayerVisual(') || !app.includes('function updatePlayerVisualTransform(') || !app.includes('function updatePlayerCharacterAnimation(')) failures.push('animated textured humanoid controller hookup');",
    'character import guard',
)
anchor = "if (!app.includes('createCapsuleGeometry()')) failures.push('character visual fallback');\n"
insert = (
    "if (!app.includes('const CHARACTER_MODEL_URL = new URL(') || !app.includes('const CHARACTER_ANIMATION_URL = new URL(')) failures.push('versioned character asset URLs');\n"
    "if (!app.includes('if (next && preserveCamera && !freecamEnabled) updateOrbitCamera();') || !app.includes('// Make the mode switch atomic: camera, center ray and reticle all agree immediately.')) failures.push('freecam atomic camera refresh');\n"
    "if (!app.includes('character fallback: ${characterError}')) failures.push('visible character fallback diagnostics');\n"
)
check = replace_once(check, anchor, anchor + insert, 'runtime regression guards')
check = replace_once(
    check,
    "if (!characterRuntime.includes('loadRiggedCharacterAsset(') || !characterRuntime.includes('buildAnimationClips(') || !characterRuntime.includes('baseColorImage') || !characterRuntime.includes('getSkinMatrices(')) failures.push('character texture/animation runtime');",
    "if (!characterRuntime.includes('loadRiggedCharacterAsset(') || !characterRuntime.includes('buildAnimationClips(') || !characterRuntime.includes('baseColorImage') || !characterRuntime.includes('getSkinMatrices(')) failures.push('character texture/animation runtime');\nif (!characterRuntime.includes('DEFAULT_CHARACTER_MODEL_URL') || !characterRuntime.includes(\"cache: 'no-cache'\")) failures.push('character cache-safe loading');",
    'character cache guard',
)
check_path.write_text(check, encoding='utf-8')

print('Character + Freecam runtime regression patch applied.')
