export const RIFT_SHARED_MATERIAL_RANGE = Object.freeze({ min: 238, max: 255 });

// Material colors with this sentinel are not display colors. The Rift renderer
// decodes the green channel as a tile index into the original procedural atlas.
// This keeps the existing 9-float section mesh contract and batching intact.
const TEXTURE_SENTINEL_R = 254 / 255;
const TEXTURE_SENTINEL_B = 1 / 255;
const atlasColor = index => Object.freeze([TEXTURE_SENTINEL_R, index / 255, TEXTURE_SENTINEL_B]);

const solid = (material_id, textureIndex, texture, display_name) => Object.freeze({
  material_id,
  shape: 'full',
  color: atlasColor(textureIndex),
  texture,
  display_name
});

// Engine-reserved authoring materials. These are real atlas-backed blocks.
// Texture artwork is generated locally by RiftCity at runtime; no third-party
// copyrighted texture files are bundled or fetched.
export const RIFT_SHARED_PALETTE = Object.freeze({
  clay: solid(238, 14, 'clay', 'clay'),
  mud: solid(239, 15, 'mud', 'mud'),
  grass_block: solid(240, 0, 'grass', 'grass block'),
  grass_detail: Object.freeze({
    material_id: 241,
    shape: 'grass_detail',
    kind: 'detail',
    color: Object.freeze([0.18, 0.48, 0.11]),
    texture: 'grass_blades',
    display_name: 'grass detail',
    height: 0.58,
    width: 0.72
  }),
  water: Object.freeze({
    material_id: 242,
    shape: 'water',
    kind: 'fluid',
    color: Object.freeze([0.075, 0.32, 0.50]),
    texture: 'water',
    display_name: 'water',
    surface_height: 0.86,
    flow: Object.freeze([0.8, 0.35]),
    flow_speed: 0.55
  }),
  dirt: solid(243, 1, 'dirt', 'dirt'),
  dirt_dark: solid(244, 2, 'dirt_dark', 'dark dirt'),
  dirt_dry: solid(245, 3, 'dirt_dry', 'dry dirt'),
  stone: solid(246, 4, 'stone', 'stone'),
  stone_light: solid(247, 5, 'stone_light', 'light stone'),
  stone_dark: solid(248, 6, 'stone_dark', 'dark stone'),
  cobblestone: solid(249, 7, 'cobblestone', 'cobblestone'),
  mossy_stone: solid(250, 8, 'mossy_stone', 'mossy stone'),
  oak_wood: solid(251, 9, 'oak_wood', 'oak wood'),
  pine_wood: solid(252, 10, 'pine_wood', 'pine wood'),
  aged_wood: solid(253, 11, 'aged_wood', 'aged wood'),
  sand: solid(254, 12, 'sand', 'sand'),
  gravel: solid(255, 13, 'gravel', 'gravel')
});

function cloneEntry(entry) {
  return {
    ...entry,
    ...(Array.isArray(entry?.color) ? { color: [...entry.color] } : {}),
    ...(Array.isArray(entry?.flow) ? { flow: [...entry.flow] } : {})
  };
}

export function mergeRiftSharedPalette(rawPalette = {}) {
  const result = {};
  for (const [name, entry] of Object.entries(RIFT_SHARED_PALETTE)) result[name] = cloneEntry(entry);
  for (const [name, entry] of Object.entries(rawPalette || {})) result[name] = cloneEntry(entry);
  return result;
}

function migrateLegacyGrassReferences(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const item of value) migrateLegacyGrassReferences(item); return; }
  for (const [key, child] of Object.entries(value)) {
    if ((key === 'state' || key.endsWith('_state')) && child === 'grass') value[key] = 'grass_block';
    else migrateLegacyGrassReferences(child);
  }
}

export function ensureRiftSharedPalette(document) {
  if (!document || typeof document !== 'object') return document;
  const legacyGrass = document.palette?.grass;
  if (legacyGrass && String(legacyGrass.shape || 'full').toLowerCase() === 'full') {
    document.palette = { ...(document.palette || {}) };
    if (!document.palette.grass_block) document.palette.grass_block = cloneEntry(legacyGrass);
    delete document.palette.grass;
    migrateLegacyGrassReferences(document);
  }
  document.palette = mergeRiftSharedPalette(document.palette || {});
  return document;
}

// Saved-world migration belongs to the world-composition runtime, where the
// stored document ID is checked before anything is removed. Material imports
// must stay side-effect free so a valid new base-world save can never be wiped.
