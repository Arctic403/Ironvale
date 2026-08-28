export const RIFT_SHARED_MATERIAL_RANGE = Object.freeze({ min: 240, max: 255 });

// Engine-reserved authoring materials. Documents can still override any entry by name,
// but authors should keep material ids 240..255 reserved so shared states stay stable.
export const RIFT_SHARED_PALETTE = Object.freeze({
  grass_block: Object.freeze({
    material_id: 240,
    shape: 'full',
    color: Object.freeze([0.21, 0.39, 0.15]),
    texture: 'grass_block',
    display_name: 'grass block'
  }),
  grass_detail: Object.freeze({
    material_id: 241,
    shape: 'grass_detail',
    kind: 'detail',
    color: Object.freeze([0.18, 0.48, 0.11]),
    texture: 'grass_blades',
    display_name: 'grass',
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
  dirt: Object.freeze({
    material_id: 243,
    shape: 'full',
    color: Object.freeze([0.34, 0.24, 0.14]),
    texture: 'dirt',
    display_name: 'dirt'
  })
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
