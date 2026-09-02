import { RiftTerrain } from './rift-terrain.js?v=20260902-terrain-pack-r1';

export const RIFT_LANDSCAPE_FORMAT = 'rift-landscape-v3';
export const RIFT_LANDSCAPE_EDIT_FORMAT = 'rift-landscape-edits-v2';
const LEGACY_LANDSCAPE_FORMATS = new Set(['rift-landscape-v2', RIFT_LANDSCAPE_FORMAT]);
const LEGACY_EDIT_FORMATS = new Set(['rift-landscape-edits-v1', RIFT_LANDSCAPE_EDIT_FORMAT]);

const DEFAULT_EDIT_LAYERS = Object.freeze([
  { id: 'sculpt', name: 'Sculpt', enabled: true, locked: false }
]);

const DEFAULT_MATERIAL_LAYERS = Object.freeze([
  { id: 'grass', name: 'Grass', defaultWeight: 255, color: [0.25, 0.42, 0.23], tileMeters: 4, roughnessFactor: 0.88 },
  { id: 'dirt', name: 'Dirt', defaultWeight: 0, color: [0.43, 0.31, 0.20], tileMeters: 3.5, roughnessFactor: 0.9 },
  { id: 'rock', name: 'Rock', defaultWeight: 0, color: [0.43, 0.45, 0.44], tileMeters: 4, roughnessFactor: 0.72 },
  { id: 'gravel', name: 'Gravel', defaultWeight: 0, color: [0.52, 0.50, 0.44], tileMeters: 3, roughnessFactor: 0.86 },
  { id: 'mud', name: 'Mud', defaultWeight: 0, color: [0.29, 0.23, 0.17], tileMeters: 3.5, roughnessFactor: 0.96 },
  { id: 'path', name: 'Path', defaultWeight: 0, color: [0.49, 0.39, 0.25], tileMeters: 3, roughnessFactor: 0.82 }
]);

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function smooth01(value) { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function distanceToSegment2D(px, pz, a, b) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const denom = abx * abx + abz * abz;
  const t = denom > 1e-8 ? clamp(((px - a.x) * abx + (pz - a.z) * abz) / denom, 0, 1) : 0;
  const x = lerp(a.x, b.x, t);
  const z = lerp(a.z, b.z, t);
  return { distance: Math.hypot(px - x, pz - z), t, x, z };
}
function catmullRom(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}
function smoothSplinePolyline(points, samplesPerSegment = 8) {
  if (!Array.isArray(points) || points.length < 2) return Array.isArray(points) ? points.map(copySpline) : [];
  const result = [];
  const samples = clamp(Math.trunc(Number(samplesPerSegment) || 8), 2, 24);
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let sample = 0; sample < samples; sample += 1) {
      if (i > 0 && sample === 0) continue;
      const t = sample / samples;
      result.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, t)
      });
    }
  }
  result.push(copySpline(points[points.length - 1]));
  return result;
}
function cleanId(value, fallback = 'layer') {
  const text = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return text || fallback;
}
function copySpline(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
function sparseFloat(array, epsilon = 0.0001) {
  const result = [];
  for (let i = 0; i < array.length; i += 1) {
    const value = array[i];
    if (Math.abs(value) > epsilon) result.push([i, Number(value.toFixed(4))]);
  }
  return result;
}
function sparseInt(array) {
  const result = [];
  for (let i = 0; i < array.length; i += 1) if (array[i]) result.push([i, Number(array[i])]);
  return result;
}
function applySparse(target, entries, transform = Number) {
  target.fill(0);
  for (const entry of entries || []) {
    const index = Number(entry?.[0]);
    const value = transform(entry?.[1]);
    if (Number.isInteger(index) && index >= 0 && index < target.length && Number.isFinite(value)) target[index] = value;
  }
}

export class RiftLandscape extends RiftTerrain {
  constructor(config = {}) {
    super(config);
    const landscape = config.landscape || {};
    this.landscapeFormat = LEGACY_LANDSCAPE_FORMATS.has(landscape.format) ? landscape.format : RIFT_LANDSCAPE_FORMAT;
    this.lodHysteresis = clamp(Number(landscape.lodHysteresis ?? 0.12), 0, 0.45);
    this.schemaVersion = 3;
    this._dirtyComponents = new Set();
    this.editLayers = new Map();
    this.editLayerOrder = [];
    this.materialLayers = new Map();
    this.splines = Array.isArray(landscape.splines) ? landscape.splines.map(copySpline) : [];
    this.streaming = {
      enabled: landscape.streaming?.enabled !== false,
      componentRadius: Math.max(1, Math.trunc(Number(landscape.streaming?.componentRadius) || 3)),
      preloadRing: Math.max(0, Math.trunc(Number(landscape.streaming?.preloadRing) || 0))
    };
    this.collisionPolicy = {
      nearDistance: Math.max(this.sectionSize, Number(config.collision?.nearDistance) || 128),
      mediumDistance: Math.max(this.componentSize, Number(config.collision?.mediumDistance) || 256),
      lodSteps: Array.isArray(config.collision?.lodSteps) && config.collision.lodSteps.length
        ? config.collision.lodSteps.map(value => Math.max(1, Math.trunc(Number(value) || 1)))
        : [...this.collisionLodSteps]
    };

    const editDefinitions = Array.isArray(landscape.editLayers) && landscape.editLayers.length
      ? landscape.editLayers
      : DEFAULT_EDIT_LAYERS;
    for (const definition of editDefinitions) this._createEditLayerFromDefinition(definition);
    if (!this.editLayerOrder.length) this._createEditLayerFromDefinition(DEFAULT_EDIT_LAYERS[0]);

    const requestedActive = cleanId(landscape.activeEditLayer || this.editLayerOrder[0]);
    this.activeEditLayerId = this.editLayers.has(requestedActive) ? requestedActive : this.editLayerOrder[0];

    const materialDefinitions = Array.isArray(landscape.materialLayers) && landscape.materialLayers.length
      ? landscape.materialLayers
      : DEFAULT_MATERIAL_LAYERS;
    for (const definition of materialDefinitions) this._createMaterialLayerFromDefinition(definition);
    this.baseMaterialLayerId = this.materialLayers.has(cleanId(landscape.baseMaterialLayer || 'grass'))
      ? cleanId(landscape.baseMaterialLayer || 'grass')
      : this.materialLayers.keys().next().value || null;
    const requestedMaterial = cleanId(landscape.activeMaterialLayer || 'dirt');
    this.activeMaterialLayerId = this.materialLayers.has(requestedMaterial)
      ? requestedMaterial
      : (this.materialLayers.has('dirt') ? 'dirt' : this.baseMaterialLayerId);
    const requestedSpline = cleanId(landscape.activeSpline || '');
    this.activeSplineId = this.splines.some(entry => cleanId(entry.id) === requestedSpline)
      ? requestedSpline
      : (this.splines[0]?.id || null);
    if (this.splines.length) this.recomposeEditLayers();
  }

  _createEditLayerFromDefinition(definition = {}) {
    let id = cleanId(definition.id || definition.name || `layer-${this.editLayerOrder.length + 1}`);
    if (this.editLayers.has(id)) {
      let suffix = 2;
      while (this.editLayers.has(`${id}-${suffix}`)) suffix += 1;
      id = `${id}-${suffix}`;
    }
    const layer = {
      id,
      name: String(definition.name || id),
      enabled: definition.enabled !== false,
      locked: Boolean(definition.locked),
      opacity: clamp(Number(definition.opacity ?? 1), 0, 1),
      heightDelta: new Float32Array(this.manualDelta.length),
      holeOps: new Int8Array(this.manualHoles.length)
    };
    this.editLayers.set(id, layer);
    this.editLayerOrder.push(id);
    return layer;
  }

  _createMaterialLayerFromDefinition(definition = {}) {
    const id = cleanId(definition.id || definition.name || `material-${this.materialLayers.size + 1}`);
    if (this.materialLayers.has(id)) return this.materialLayers.get(id);
    const roughnessFactor = clamp(Number(definition.roughnessFactor ?? (typeof definition.roughness === 'number' ? definition.roughness : 0.82)), 0.04, 1);
    const layer = {
      id,
      name: String(definition.name || id),
      defaultWeight: clamp(Math.round(Number(definition.defaultWeight) || 0), 0, 255),
      texture: typeof definition.texture === 'string' ? definition.texture : null,
      normal: typeof definition.normal === 'string' ? definition.normal : null,
      roughness: typeof definition.roughness === 'string' ? definition.roughness : null,
      roughnessFactor,
      tileMeters: Math.max(0.5, Number(definition.tileMeters) || 4),
      color: Array.isArray(definition.color) && definition.color.length >= 3
        ? definition.color.slice(0, 3).map(value => clamp(Number(value) || 0, 0, 1))
        : [0.4, 0.4, 0.4],
      weights: new Uint8Array(this.manualDelta.length)
    };
    this.materialLayers.set(id, layer);
    return layer;
  }

  listEditLayers() {
    return this.editLayerOrder.map((id, index) => {
      const layer = this.editLayers.get(id);
      return {
        id: layer.id,
        name: layer.name,
        enabled: layer.enabled,
        locked: layer.locked,
        opacity: layer.opacity,
        active: id === this.activeEditLayerId,
        order: index
      };
    });
  }

  get activeEditLayer() { return this.editLayers.get(this.activeEditLayerId) || null; }

  listMaterialLayers() {
    return [...this.materialLayers.values()].map(layer => ({
      id: layer.id,
      name: layer.name,
      color: [...layer.color],
      texture: layer.texture,
      normal: layer.normal,
      roughness: layer.roughness,
      roughnessFactor: layer.roughnessFactor,
      tileMeters: layer.tileMeters,
      base: layer.id === this.baseMaterialLayerId,
      active: layer.id === this.activeMaterialLayerId
    }));
  }

  materialLayerIds() { return [...this.materialLayers.keys()]; }
  materialLayerDescriptor(id) {
    const layer = this.materialLayers.get(cleanId(id));
    return layer ? {
      id: layer.id, name: layer.name, color: [...layer.color], texture: layer.texture, normal: layer.normal,
      roughness: layer.roughness, roughnessFactor: layer.roughnessFactor, tileMeters: layer.tileMeters,
      base: layer.id === this.baseMaterialLayerId
    } : null;
  }

  get activeMaterialLayer() { return this.materialLayers.get(this.activeMaterialLayerId) || null; }

  setActiveMaterialLayer(id) {
    const key = cleanId(id);
    if (!this.materialLayers.has(key)) return false;
    this.activeMaterialLayerId = key;
    this.revision += 1;
    return true;
  }

  setActiveEditLayer(id) {
    const key = cleanId(id);
    if (!this.editLayers.has(key)) return false;
    this.activeEditLayerId = key;
    this.revision += 1;
    return true;
  }

  createEditLayer(name = 'Edit Layer', options = {}) {
    const layer = this._createEditLayerFromDefinition({ ...options, name, id: options.id || name });
    this.activeEditLayerId = layer.id;
    this.revision += 1;
    return this.listEditLayers().find(entry => entry.id === layer.id);
  }

  renameEditLayer(id, name) {
    const layer = this.editLayers.get(cleanId(id));
    if (!layer) return false;
    layer.name = String(name || layer.name).trim() || layer.name;
    this.revision += 1;
    return true;
  }

  setEditLayerLocked(id, locked) {
    const layer = this.editLayers.get(cleanId(id));
    if (!layer) return false;
    layer.locked = Boolean(locked);
    this.revision += 1;
    return true;
  }

  setEditLayerEnabled(id, enabled) {
    const layer = this.editLayers.get(cleanId(id));
    if (!layer) return false;
    layer.enabled = Boolean(enabled);
    this.recomposeEditLayers();
    return true;
  }

  setEditLayerOpacity(id, opacity) {
    const layer = this.editLayers.get(cleanId(id));
    if (!layer) return false;
    layer.opacity = clamp(Number(opacity), 0, 1);
    this.recomposeEditLayers();
    return true;
  }

  moveEditLayer(id, toIndex) {
    const key = cleanId(id);
    const from = this.editLayerOrder.indexOf(key);
    if (from < 0) return false;
    const target = clamp(Math.trunc(Number(toIndex) || 0), 0, this.editLayerOrder.length - 1);
    if (from === target) return true;
    this.editLayerOrder.splice(from, 1);
    this.editLayerOrder.splice(target, 0, key);
    this.recomposeEditLayers();
    return true;
  }

  deleteEditLayer(id) {
    const key = cleanId(id);
    if (!this.editLayers.has(key) || this.editLayerOrder.length <= 1) return false;
    this.editLayers.delete(key);
    this.editLayerOrder = this.editLayerOrder.filter(entry => entry !== key);
    if (this.activeEditLayerId === key) this.activeEditLayerId = this.editLayerOrder[0];
    this.recomposeEditLayers();
    return true;
  }

  _sampleIndicesInBrush(x, z, radius) {
    const minX = clamp(Math.floor((x - radius - this.origin[0]) / this.sampleSpacing), 0, this.columns - 1);
    const maxX = clamp(Math.ceil((x + radius - this.origin[0]) / this.sampleSpacing), 0, this.columns - 1);
    const minZ = clamp(Math.floor((z - radius - this.origin[2]) / this.sampleSpacing), 0, this.rows - 1);
    const maxZ = clamp(Math.ceil((z + radius - this.origin[2]) / this.sampleSpacing), 0, this.rows - 1);
    const result = [];
    for (let iz = minZ; iz <= maxZ; iz += 1) {
      for (let ix = minX; ix <= maxX; ix += 1) {
        const wx = this.origin[0] + ix * this.sampleSpacing;
        const wz = this.origin[2] + iz * this.sampleSpacing;
        if (Math.hypot(wx - x, wz - z) <= radius + this.sampleSpacing) result.push(iz * this.columns + ix);
      }
    }
    return result;
  }

  _writeHoleOperation(layer, mode, x, z, radius) {
    const cellColumns = this.columns - 1;
    const cellRows = this.rows - 1;
    const minX = clamp(Math.floor((x - radius - this.origin[0]) / this.sampleSpacing), 0, cellColumns - 1);
    const maxX = clamp(Math.ceil((x + radius - this.origin[0]) / this.sampleSpacing), 0, cellColumns - 1);
    const minZ = clamp(Math.floor((z - radius - this.origin[2]) / this.sampleSpacing), 0, cellRows - 1);
    const maxZ = clamp(Math.ceil((z + radius - this.origin[2]) / this.sampleSpacing), 0, cellRows - 1);
    const operation = mode === 'hole' ? 1 : -1;
    for (let iz = minZ; iz <= maxZ; iz += 1) {
      for (let ix = minX; ix <= maxX; ix += 1) {
        const cx = this.origin[0] + (ix + 0.5) * this.sampleSpacing;
        const cz = this.origin[2] + (iz + 0.5) * this.sampleSpacing;
        if (Math.hypot(cx - x, cz - z) <= radius) layer.holeOps[iz * cellColumns + ix] = operation;
      }
    }
  }

  applyBrush(brush = {}) {
    const layer = this.activeEditLayer;
    if (!layer) throw new Error('RiftLandscape has no active edit layer.');
    if (layer.locked) throw new Error(`Terrain edit layer "${layer.name}" is locked.`);
    if (!layer.enabled) layer.enabled = true;

    const mode = String(brush.mode || 'raise').toLowerCase();
    const x = Number(brush.x) || 0;
    const z = Number(brush.z) || 0;
    const radius = Math.max(this.sampleSpacing, Number(brush.radius) || 6);

    if (mode === 'hole' || mode === 'unhole') {
      super.applyBrush(brush);
      this._writeHoleOperation(layer, mode, x, z, radius);
      this._markDirtyComponentsFromSections();
      return;
    }

    const indices = this._sampleIndicesInBrush(x, z, radius);
    const before = new Float32Array(indices.length);
    for (let i = 0; i < indices.length; i += 1) before[i] = this.manualDelta[indices[i]];
    super.applyBrush(brush);
    for (let i = 0; i < indices.length; i += 1) {
      const index = indices[i];
      const change = this.manualDelta[index] - before[i];
      if (Math.abs(change) > 0.000001) layer.heightDelta[index] += change;
    }
    this._markDirtyComponentsFromSections();
  }

  recomposeEditLayers() {
    this.manualDelta.fill(0);
    this.manualHoles.fill(0);
    for (const id of this.editLayerOrder) {
      const layer = this.editLayers.get(id);
      if (!layer?.enabled) continue;
      const opacity = clamp(Number(layer.opacity ?? 1), 0, 1);
      for (let i = 0; i < this.manualDelta.length; i += 1) this.manualDelta[i] += layer.heightDelta[i] * opacity;
      for (let i = 0; i < this.manualHoles.length; i += 1) {
        const operation = layer.holeOps[i];
        if (operation > 0) this.manualHoles[i] = 1;
        else if (operation < 0) this.manualHoles[i] = 0;
      }
    }
    this._applySplineDeformation();
    super.rebuildFromManualDelta();
    this.markAllComponentsDirty();
  }

  captureEditState() {
    return {
      format: 'rift-landscape-state-v1',
      activeEditLayerId: this.activeEditLayerId,
      activeMaterialLayerId: this.activeMaterialLayerId,
      activeSplineId: this.activeSplineId,
      editLayerOrder: [...this.editLayerOrder],
      editLayers: this.editLayerOrder.map(id => {
        const layer = this.editLayers.get(id);
        return {
          id: layer.id,
          name: layer.name,
          enabled: layer.enabled,
          locked: layer.locked,
          opacity: layer.opacity,
          heightDelta: new Float32Array(layer.heightDelta),
          holeOps: new Int8Array(layer.holeOps)
        };
      }),
      materialLayers: [...this.materialLayers.values()].map(layer => ({
        id: layer.id,
        name: layer.name,
        defaultWeight: layer.defaultWeight,
        texture: layer.texture,
        normal: layer.normal,
        roughness: layer.roughness,
        roughnessFactor: layer.roughnessFactor,
        tileMeters: layer.tileMeters,
        color: [...layer.color],
        weights: new Uint8Array(layer.weights)
      })),
      splines: this.splines.map(copySpline),
      revision: this.revision
    };
  }

  restoreEditState(state) {
    if (!state || state.format !== 'rift-landscape-state-v1') return false;
    this.editLayers.clear();
    this.editLayerOrder = [];
    for (const source of state.editLayers || []) {
      const layer = this._createEditLayerFromDefinition(source);
      if (source.heightDelta?.length === layer.heightDelta.length) layer.heightDelta.set(source.heightDelta);
      if (source.holeOps?.length === layer.holeOps.length) layer.holeOps.set(source.holeOps);
    }
    if (!this.editLayerOrder.length) this._createEditLayerFromDefinition(DEFAULT_EDIT_LAYERS[0]);
    const order = (state.editLayerOrder || []).filter(id => this.editLayers.has(id));
    if (order.length === this.editLayerOrder.length) this.editLayerOrder = [...order];
    this.activeEditLayerId = this.editLayers.has(state.activeEditLayerId) ? state.activeEditLayerId : this.editLayerOrder[0];

    if (Array.isArray(state.materialLayers) && state.materialLayers.length) {
      this.materialLayers.clear();
      for (const source of state.materialLayers) {
        const layer = this._createMaterialLayerFromDefinition(source);
        if (source.weights?.length === layer.weights.length) layer.weights.set(source.weights);
      }
    }
    const requestedMaterial = cleanId(state.activeMaterialLayerId || this.activeMaterialLayerId || '');
    this.activeMaterialLayerId = this.materialLayers.has(requestedMaterial)
      ? requestedMaterial
      : (this.materialLayers.has('dirt') ? 'dirt' : this.baseMaterialLayerId);
    this.splines = Array.isArray(state.splines) ? state.splines.map(copySpline) : [];
    const requestedSpline = cleanId(state.activeSplineId || '');
    this.activeSplineId = this.splines.some(entry => entry.id === requestedSpline) ? requestedSpline : (this.splines[0]?.id || null);
    this.recomposeEditLayers();
    return true;
  }

  serializeLandscapeEdits({ worldId = 'ironvale-terrain' } = {}) {
    return {
      format: RIFT_LANDSCAPE_EDIT_FORMAT,
      schemaVersion: 2,
      landscapeFormat: RIFT_LANDSCAPE_FORMAT,
      worldId,
      width: this.width,
      depth: this.depth,
      sampleSpacing: this.sampleSpacing,
      savedAt: Date.now(),
      activeEditLayer: this.activeEditLayerId,
      activeMaterialLayer: this.activeMaterialLayerId,
      activeSpline: this.activeSplineId,
      editLayers: this.editLayerOrder.map(id => {
        const layer = this.editLayers.get(id);
        return {
          id: layer.id,
          name: layer.name,
          enabled: layer.enabled,
          locked: layer.locked,
          opacity: layer.opacity,
          heightDelta: sparseFloat(layer.heightDelta),
          holeOps: sparseInt(layer.holeOps)
        };
      }),
      materialLayers: [...this.materialLayers.values()].map(layer => ({
        id: layer.id,
        name: layer.name,
        defaultWeight: layer.defaultWeight,
        texture: layer.texture,
        normal: layer.normal,
        roughness: layer.roughness,
        roughnessFactor: layer.roughnessFactor,
        tileMeters: layer.tileMeters,
        color: [...layer.color],
        weights: sparseInt(layer.weights)
      })),
      splines: this.splines.map(copySpline),
      validation: this.validateLandscape()
    };
  }

  applySerializedLandscapeEdits(data) {
    if (!data || !LEGACY_EDIT_FORMATS.has(data.format)) return false;
    if (Number(data.width) !== this.width || Number(data.depth) !== this.depth || Number(data.sampleSpacing) !== this.sampleSpacing) return false;

    this.editLayers.clear();
    this.editLayerOrder = [];
    for (const source of data.editLayers || []) {
      const layer = this._createEditLayerFromDefinition(source);
      applySparse(layer.heightDelta, source.heightDelta, Number);
      applySparse(layer.holeOps, source.holeOps, value => Math.sign(Number(value) || 0));
    }
    if (!this.editLayerOrder.length) this._createEditLayerFromDefinition(DEFAULT_EDIT_LAYERS[0]);
    this.activeEditLayerId = this.editLayers.has(cleanId(data.activeEditLayer)) ? cleanId(data.activeEditLayer) : this.editLayerOrder[0];

    if (Array.isArray(data.materialLayers) && data.materialLayers.length) {
      this.materialLayers.clear();
      for (const source of data.materialLayers) {
        const layer = this._createMaterialLayerFromDefinition(source);
        applySparse(layer.weights, source.weights, value => clamp(Math.round(Number(value) || 0), 0, 255));
      }
    }
    const requestedMaterial = cleanId(data.activeMaterialLayer || this.activeMaterialLayerId || '');
    this.activeMaterialLayerId = this.materialLayers.has(requestedMaterial)
      ? requestedMaterial
      : (this.materialLayers.has('dirt') ? 'dirt' : this.baseMaterialLayerId);
    for (let index = 0; index < this.manualDelta.length; index += 1) this._normalizeMaterialWeightsAtIndex(index);
    this.splines = Array.isArray(data.splines) ? data.splines.map(copySpline) : [];
    const requestedSpline = cleanId(data.activeSpline || '');
    this.activeSplineId = this.splines.some(entry => entry.id === requestedSpline) ? requestedSpline : (this.splines[0]?.id || null);
    this.recomposeEditLayers();
    return this.validateLandscape().ok;
  }

  importLegacyManualEdits(data) {
    if (!data || data.format !== 'rift-terrain-edit-v2') return false;
    if (Number(data.width) !== this.width || Number(data.depth) !== this.depth || Number(data.sampleSpacing) !== this.sampleSpacing) return false;
    const layer = this.activeEditLayer || this.editLayers.get(this.editLayerOrder[0]);
    layer.heightDelta.fill(0);
    layer.holeOps.fill(0);
    applySparse(layer.heightDelta, data.delta, Number);
    for (const value of data.holes || []) {
      const index = Number(value);
      if (Number.isInteger(index) && index >= 0 && index < layer.holeOps.length) layer.holeOps[index] = 1;
    }
    this.recomposeEditLayers();
    return true;
  }

  _materialWeightBytesAtIndex(index) {
    const result = {};
    const baseId = this.baseMaterialLayerId || this.materialLayers.keys().next().value || null;
    let nonBaseTotal = 0;
    for (const layer of this.materialLayers.values()) {
      if (layer.id === baseId) continue;
      const value = clamp(Number(layer.weights[index]) || 0, 0, 255);
      result[layer.id] = value;
      nonBaseTotal += value;
    }
    if (nonBaseTotal > 255) {
      const scale = 255 / nonBaseTotal;
      nonBaseTotal = 0;
      for (const id of Object.keys(result)) {
        result[id] = Math.round(result[id] * scale);
        nonBaseTotal += result[id];
      }
    }
    if (baseId) result[baseId] = clamp(255 - nonBaseTotal, 0, 255);
    return result;
  }

  _normalizeMaterialWeightsAtIndex(index, protectedId = null) {
    const nonBase = [...this.materialLayers.values()].filter(entry => entry.id !== this.baseMaterialLayerId);
    let total = nonBase.reduce((sum, entry) => sum + (Number(entry.weights[index]) || 0), 0);
    if (total <= 255) return;
    const protectedLayer = protectedId ? this.materialLayers.get(cleanId(protectedId)) : null;
    const protectedWeight = protectedLayer && protectedLayer.id !== this.baseMaterialLayerId ? protectedLayer.weights[index] : 0;
    const adjustable = nonBase.filter(entry => entry !== protectedLayer);
    const adjustableTotal = adjustable.reduce((sum, entry) => sum + (Number(entry.weights[index]) || 0), 0);
    const targetAdjustable = Math.max(0, 255 - protectedWeight);
    if (adjustableTotal > 0) {
      const scale = targetAdjustable / adjustableTotal;
      for (const entry of adjustable) entry.weights[index] = clamp(Math.round(entry.weights[index] * scale), 0, 255);
    }
    total = nonBase.reduce((sum, entry) => sum + (Number(entry.weights[index]) || 0), 0);
    if (total > 255 && protectedLayer) protectedLayer.weights[index] = Math.max(0, protectedLayer.weights[index] - (total - 255));
  }

  paintMaterial(brush = {}) {
    const id = cleanId(brush.layerId || brush.material || this.activeMaterialLayerId || '');
    const layer = this.materialLayers.get(id);
    if (!layer) return false;
    const x = Number(brush.x) || 0;
    const z = Number(brush.z) || 0;
    const radius = Math.max(this.sampleSpacing, Number(brush.radius) || 6);
    const strength = clamp(Number(brush.strength) || 0.25, 0, 1);
    const erase = Boolean(brush.erase);
    const replaceOthers = Boolean(brush.replaceOthers);
    const indices = this._sampleIndicesInBrush(x, z, radius);
    const nonBaseLayers = [...this.materialLayers.values()].filter(entry => entry.id !== this.baseMaterialLayerId);

    for (const index of indices) {
      const ix = index % this.columns;
      const iz = Math.floor(index / this.columns);
      const wx = this.origin[0] + ix * this.sampleSpacing;
      const wz = this.origin[2] + iz * this.sampleSpacing;
      const distance = Math.hypot(wx - x, wz - z);
      const falloff = smooth01(1 - distance / radius);
      const amount = Math.round(255 * strength * falloff);
      if (!amount) continue;

      if (id === this.baseMaterialLayerId) {
        if (erase) continue;
        const total = nonBaseLayers.reduce((sum, entry) => sum + entry.weights[index], 0);
        if (total > 0) {
          const targetTotal = Math.max(0, total - amount);
          const scale = targetTotal / total;
          for (const entry of nonBaseLayers) entry.weights[index] = Math.round(entry.weights[index] * scale);
        }
        continue;
      }

      if (erase) {
        layer.weights[index] = Math.max(0, layer.weights[index] - amount);
        continue;
      }

      if (replaceOthers) {
        const targetWeight = Math.min(255, Math.max(layer.weights[index], amount));
        for (const entry of nonBaseLayers) if (entry.id !== id) entry.weights[index] = Math.max(0, entry.weights[index] - amount);
        layer.weights[index] = targetWeight;
      } else {
        layer.weights[index] = Math.min(255, layer.weights[index] + amount);
      }
      this._normalizeMaterialWeightsAtIndex(index, id);
    }
    this.markDirtyRegion(x, z, radius);
    this._markDirtyComponentsFromSections();
    this.revision += 1;
    return true;
  }

  sampleMaterialWeights(x, z) {
    if (!this.containsXZ(x, z)) return {};
    const gx = clamp((x - this.origin[0]) / this.sampleSpacing, 0, this.columns - 1);
    const gz = clamp((z - this.origin[2]) / this.sampleSpacing, 0, this.rows - 1);
    const x0 = Math.floor(gx), z0 = Math.floor(gz);
    const x1 = clamp(x0 + 1, 0, this.columns - 1), z1 = clamp(z0 + 1, 0, this.rows - 1);
    const tx = gx - x0, tz = gz - z0;
    const ids = this.materialLayerIds();
    const sampleBytes = (ix, iz) => this._materialWeightBytesAtIndex(iz * this.columns + ix);
    const a = sampleBytes(x0, z0), b = sampleBytes(x1, z0), c = sampleBytes(x0, z1), d = sampleBytes(x1, z1);
    const result = {};
    let total = 0;
    for (const id of ids) {
      const top = lerp(a[id] || 0, b[id] || 0, tx);
      const bottom = lerp(c[id] || 0, d[id] || 0, tx);
      const value = Math.max(0, lerp(top, bottom, tz));
      result[id] = value;
      total += value;
    }
    if (total <= 0) return {};
    for (const id of ids) result[id] /= total;
    return result;
  }

  sampleMaterialColor(x, z) {
    const weights = this.sampleMaterialWeights(x, z);
    const color = [0, 0, 0];
    let total = 0;
    for (const [id, weight] of Object.entries(weights)) {
      const layer = this.materialLayers.get(id);
      if (!layer || weight <= 0) continue;
      color[0] += layer.color[0] * weight;
      color[1] += layer.color[1] * weight;
      color[2] += layer.color[2] * weight;
      total += weight;
    }
    return total > 0 ? color : [0.36, 0.40, 0.34];
  }

  listSplines() {
    return this.splines.map((entry, index) => ({
      id: entry.id,
      name: entry.name,
      enabled: entry.enabled !== false,
      width: Number(entry.width) || 6,
      falloff: Number(entry.falloff) || 4,
      strength: Number(entry.strength ?? 1),
      offset: Number(entry.offset) || 0,
      pointCount: Array.isArray(entry.points) ? entry.points.length : 0,
      active: entry.id === this.activeSplineId,
      order: index
    }));
  }

  get activeSpline() { return this.splines.find(entry => entry.id === this.activeSplineId) || null; }

  setActiveSpline(id) {
    const key = cleanId(id);
    if (!this.splines.some(entry => entry.id === key)) return false;
    this.activeSplineId = key;
    this.revision += 1;
    return true;
  }

  createSpline(name = 'Landscape Spline', options = {}) {
    let baseId = cleanId(options.id || name || `spline-${this.splines.length + 1}`, `spline-${this.splines.length + 1}`);
    let id = baseId;
    let suffix = 2;
    while (this.splines.some(entry => entry.id === id)) id = `${baseId}-${suffix++}`;
    const spline = this.setSpline({
      id,
      name,
      enabled: true,
      width: Number(options.width) || 6,
      falloff: Number(options.falloff) || 4,
      strength: Number(options.strength ?? 1),
      offset: Number(options.offset) || 0,
      points: []
    }, { recompose: false });
    this.activeSplineId = spline.id;
    this.revision += 1;
    return copySpline(spline);
  }

  setSpline(spline = {}, { recompose = true } = {}) {
    const id = cleanId(spline.id || `spline-${this.splines.length + 1}`, `spline-${this.splines.length + 1}`);
    const normalized = {
      ...copySpline(spline),
      id,
      name: String(spline.name || id),
      enabled: spline.enabled !== false,
      width: Math.max(this.sampleSpacing, Number(spline.width) || 6),
      falloff: Math.max(0, Number(spline.falloff) || 4),
      strength: clamp(Number(spline.strength ?? 1), 0, 1),
      offset: Number(spline.offset) || 0,
      smooth: spline.smooth !== false,
      samplesPerSegment: clamp(Math.trunc(Number(spline.samplesPerSegment) || 8), 2, 24),
      mode: 'flatten',
      points: Array.isArray(spline.points) ? spline.points.map(point => ({
        x: clamp(Number(point?.x ?? point?.[0]) || 0, this.origin[0], this.origin[0] + this.width),
        y: Number.isFinite(Number(point?.y ?? point?.[1])) ? Number(point?.y ?? point?.[1]) : this.baseHeight,
        z: clamp(Number(point?.z ?? point?.[2]) || 0, this.origin[2], this.origin[2] + this.depth)
      })) : []
    };
    const index = this.splines.findIndex(entry => entry.id === id);
    if (index >= 0) this.splines[index] = normalized;
    else this.splines.push(normalized);
    if (!this.activeSplineId) this.activeSplineId = id;
    if (recompose) this.recomposeEditLayers();
    else this.revision += 1;
    return normalized;
  }

  updateSpline(id, patch = {}) {
    const key = cleanId(id);
    const current = this.splines.find(entry => entry.id === key);
    if (!current) return null;
    return this.setSpline({ ...current, ...copySpline(patch), id: key });
  }

  appendSplinePoint(id, point = {}) {
    const key = cleanId(id || this.activeSplineId || '');
    const current = this.splines.find(entry => entry.id === key);
    if (!current) return null;
    const next = copySpline(current);
    next.points = Array.isArray(next.points) ? next.points : [];
    next.points.push({
      x: Number(point.x ?? point[0]) || 0,
      y: Number.isFinite(Number(point.y ?? point[1])) ? Number(point.y ?? point[1]) : this.baseHeight,
      z: Number(point.z ?? point[2]) || 0
    });
    this.activeSplineId = key;
    return this.setSpline(next);
  }
  updateSplinePoint(id, pointIndex, point = {}) {
    const key = cleanId(id || this.activeSplineId || '');
    const current = this.splines.find(entry => entry.id === key);
    const index = Math.trunc(Number(pointIndex));
    if (!current || !Number.isInteger(index) || index < 0 || index >= current.points.length) return null;
    const next = copySpline(current);
    const before = next.points[index];
    next.points[index] = {
      x: Number.isFinite(Number(point.x ?? point[0])) ? Number(point.x ?? point[0]) : before.x,
      y: Number.isFinite(Number(point.y ?? point[1])) ? Number(point.y ?? point[1]) : before.y,
      z: Number.isFinite(Number(point.z ?? point[2])) ? Number(point.z ?? point[2]) : before.z
    };
    this.activeSplineId = key;
    return this.setSpline(next);
  }

  insertSplinePoint(id, pointIndex, point = {}) {
    const key = cleanId(id || this.activeSplineId || '');
    const current = this.splines.find(entry => entry.id === key);
    if (!current) return null;
    const next = copySpline(current);
    const index = clamp(Math.trunc(Number(pointIndex) || 0), 0, next.points.length);
    next.points.splice(index, 0, {
      x: Number(point.x ?? point[0]) || 0,
      y: Number.isFinite(Number(point.y ?? point[1])) ? Number(point.y ?? point[1]) : this.baseHeight,
      z: Number(point.z ?? point[2]) || 0
    });
    this.activeSplineId = key;
    return this.setSpline(next);
  }

  removeSplinePoint(id, pointIndex = -1) {
    const key = cleanId(id || this.activeSplineId || '');
    const current = this.splines.find(entry => entry.id === key);
    if (!current?.points?.length) return null;
    const next = copySpline(current);
    let index = Math.trunc(Number(pointIndex));
    if (!Number.isInteger(index) || index < 0) index = next.points.length - 1;
    if (index < 0 || index >= next.points.length) return null;
    next.points.splice(index, 1);
    this.activeSplineId = key;
    return this.setSpline(next);
  }

  splinePolyline(id = this.activeSplineId) {
    const spline = this.splines.find(entry => entry.id === cleanId(id || ''));
    if (!spline) return [];
    return spline.smooth === false ? spline.points.map(copySpline) : smoothSplinePolyline(spline.points, spline.samplesPerSegment);
  }


  clearSpline(id) {
    const key = cleanId(id || this.activeSplineId || '');
    const current = this.splines.find(entry => entry.id === key);
    if (!current) return false;
    this.setSpline({ ...current, points: [] });
    return true;
  }

  removeSpline(id) {
    const key = cleanId(id);
    const before = this.splines.length;
    this.splines = this.splines.filter(entry => entry.id !== key);
    if (this.splines.length === before) return false;
    if (this.activeSplineId === key) this.activeSplineId = this.splines[0]?.id || null;
    this.recomposeEditLayers();
    return true;
  }

  _applySplineDeformation() {
    if (!this.splines.length) return;
    for (const spline of this.splines) {
      if (spline?.enabled === false || !Array.isArray(spline?.points) || spline.points.length < 2) continue;
      const points = spline.smooth === false ? spline.points : smoothSplinePolyline(spline.points, spline.samplesPerSegment);
      const halfWidth = Math.max(this.sampleSpacing * 0.5, (Number(spline.width) || 6) * 0.5);
      const falloff = Math.max(0, Number(spline.falloff) || 4);
      const influenceRadius = halfWidth + falloff;
      const strength = clamp(Number(spline.strength ?? 1), 0, 1);
      const offset = Number(spline.offset) || 0;
      for (let segment = 0; segment < points.length - 1; segment += 1) {
        const a = points[segment];
        const b = points[segment + 1];
        const minIx = clamp(Math.floor((Math.min(a.x, b.x) - influenceRadius - this.origin[0]) / this.sampleSpacing), 0, this.columns - 1);
        const maxIx = clamp(Math.ceil((Math.max(a.x, b.x) + influenceRadius - this.origin[0]) / this.sampleSpacing), 0, this.columns - 1);
        const minIz = clamp(Math.floor((Math.min(a.z, b.z) - influenceRadius - this.origin[2]) / this.sampleSpacing), 0, this.rows - 1);
        const maxIz = clamp(Math.ceil((Math.max(a.z, b.z) + influenceRadius - this.origin[2]) / this.sampleSpacing), 0, this.rows - 1);
        for (let iz = minIz; iz <= maxIz; iz += 1) {
          for (let ix = minIx; ix <= maxIx; ix += 1) {
            const wx = this.origin[0] + ix * this.sampleSpacing;
            const wz = this.origin[2] + iz * this.sampleSpacing;
            const hit = distanceToSegment2D(wx, wz, a, b);
            if (hit.distance > influenceRadius) continue;
            const influence = hit.distance <= halfWidth
              ? 1
              : (falloff > 0 ? smooth01(1 - (hit.distance - halfWidth) / falloff) : 0);
            if (influence <= 0) continue;
            const index = iz * this.columns + ix;
            const currentHeight = this.baseHeight + this.manualDelta[index];
            const targetHeight = lerp(Number(a.y) || 0, Number(b.y) || 0, hit.t) + offset;
            this.manualDelta[index] += (targetHeight - currentHeight) * strength * influence;
          }
        }
      }
    }
  }

  _markDirtyComponentsFromSections() {
    for (const key of this._dirtySections) {
      const [sectionX, sectionZ] = key.split(':').map(Number);
      if (!Number.isFinite(sectionX) || !Number.isFinite(sectionZ)) continue;
      const componentX = Math.floor(sectionX / this.sectionsPerComponent);
      const componentZ = Math.floor(sectionZ / this.sectionsPerComponent);
      this._dirtyComponents.add(`component-${componentX}-${componentZ}`);
    }
  }

  markDirtyRegion(x, z, radius = 0) {
    super.markDirtyRegion(x, z, radius);
    this._markDirtyComponentsFromSections();
  }

  markAllComponentsDirty() {
    const counts = this.componentCounts();
    for (let z = 0; z < counts.z; z += 1) {
      for (let x = 0; x < counts.x; x += 1) this._dirtyComponents.add(`component-${x}-${z}`);
    }
  }

  consumeDirtyComponents() {
    const result = [...this._dirtyComponents];
    this._dirtyComponents.clear();
    return result;
  }

  planComponentStreaming(cameraX, cameraZ) {
    const counts = this.componentCounts();
    const cx = clamp(Math.floor((cameraX - this.origin[0]) / this.componentSize), 0, counts.x - 1);
    const cz = clamp(Math.floor((cameraZ - this.origin[2]) / this.componentSize), 0, counts.z - 1);
    const activeRadius = this.streaming.enabled ? this.streaming.componentRadius : Math.max(counts.x, counts.z);
    const preloadRadius = activeRadius + (this.streaming.enabled ? this.streaming.preloadRing : 0);
    const active = new Set();
    const preload = new Set();
    const render = new Set();
    for (let z = 0; z < counts.z; z += 1) {
      for (let x = 0; x < counts.x; x += 1) {
        const distance = Math.max(Math.abs(x - cx), Math.abs(z - cz));
        const id = `component-${x}-${z}`;
        if (distance <= activeRadius) active.add(id);
        else if (distance <= preloadRadius) preload.add(id);
        if (distance <= preloadRadius) render.add(id);
      }
    }
    return { center: { x: cx, z: cz }, active, preload, render, activeRadius, preloadRadius };
  }

  sectionRenderSphere(section) {
    const bounds = section?.bounds || this.sectionBounds(section?.sectionX || 0, section?.sectionZ || 0);
    const cx = (bounds.minX + bounds.maxX) * 0.5;
    const cz = (bounds.minZ + bounds.maxZ) * 0.5;
    const cy = this.sampleHeight(cx, cz) ?? this.baseHeight;
    const horizontalRadius = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 0.55;
    return { center: [cx, cy, cz], radius: Math.max(48, horizontalRadius + 24) };
  }

  collisionLodStepAt(x, z, observerX, observerZ) {
    const distance = Math.hypot(Number(x) - Number(observerX), Number(z) - Number(observerZ));
    if (distance < this.collisionPolicy.nearDistance) return this.collisionPolicy.lodSteps[0] ?? 1;
    if (distance < this.collisionPolicy.mediumDistance) return this.collisionPolicy.lodSteps[1] ?? this.collisionPolicy.lodSteps[0] ?? 1;
    return this.collisionPolicy.lodSteps[2] ?? this.collisionPolicy.lodSteps.at(-1) ?? 1;
  }

  sampleHeightAtLod(x, z, lodStep = 1) {
    if (!this.containsXZ(x, z)) return null;
    const step = Math.max(1, Math.trunc(Number(lodStep) || 1));
    if (step <= 1) return this.sampleHeight(x, z);
    const grid = this.sampleSpacing * step;
    const localX = clamp(Number(x) - this.origin[0], 0, this.width);
    const localZ = clamp(Number(z) - this.origin[2], 0, this.depth);
    const x0 = this.origin[0] + Math.floor(localX / grid) * grid;
    const z0 = this.origin[2] + Math.floor(localZ / grid) * grid;
    const x1 = Math.min(this.origin[0] + this.width, x0 + grid);
    const z1 = Math.min(this.origin[2] + this.depth, z0 + grid);
    const tx = x1 === x0 ? 0 : (Number(x) - x0) / (x1 - x0);
    const tz = z1 === z0 ? 0 : (Number(z) - z0) / (z1 - z0);
    const a = this.sampleHeight(x0, z0), b = this.sampleHeight(x1, z0), c = this.sampleHeight(x0, z1), d = this.sampleHeight(x1, z1);
    if ([a, b, c, d].some(value => value == null)) return this.sampleHeight(x, z);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  sampleCollisionHeight(x, z, observerX, observerZ) {
    const lodStep = this.collisionLodStepAt(x, z, observerX, observerZ);
    return { height: this.sampleHeightAtLod(x, z, lodStep), lodStep };
  }

  supportAtPointCollision(x, z, aroundY, observerX, observerZ, options = {}) {
    const { height, lodStep } = this.sampleCollisionHeight(x, z, observerX, observerZ);
    if (lodStep <= 1 || height == null || this.isHoleAt(x, z) || this._caveCache?.length) {
      return { height: super.supportAtPoint(x, z, aroundY, options), lodStep: 1 };
    }
    const maxRise = Math.max(0, Number(options.maxRise ?? 0.6));
    const maxDrop = Math.max(0, Number(options.maxDrop ?? 4));
    const upper = aroundY + maxRise;
    const lower = aroundY - maxDrop;
    return { height: height <= upper + .002 && height >= lower - .002 ? height : null, lodStep };
  }

  getComponentDescriptor(componentX, componentZ) {
    const descriptor = super.getComponentDescriptor(componentX, componentZ);
    const minX = this.origin[0] + componentX * this.componentSize;
    const minZ = this.origin[2] + componentZ * this.componentSize;
    return {
      ...descriptor,
      bounds: {
        minX,
        minZ,
        maxX: Math.min(this.origin[0] + this.width, minX + this.componentSize),
        maxZ: Math.min(this.origin[2] + this.depth, minZ + this.componentSize)
      },
      streamKey: `landscape/${componentX}/${componentZ}`,
      streaming: { ...this.streaming },
      collision: { ...this.collisionPolicy, lodSteps: [...this.collisionPolicy.lodSteps] }
    };
  }

  planSectionLods(cameraX, cameraZ, previousPlan = null) {
    const rawPlan = super.planSectionLods(cameraX, cameraZ);
    if (!previousPlan?.size || this.lodHysteresis <= 0) return rawPlan;
    const counts = this.sectionCounts();
    const levels = new Map();

    for (const [key, raw] of rawPlan) {
      const previous = previousPlan.get(key);
      let level = raw.lodLevel;
      if (previous) {
        const previousLevel = clamp(Number(previous.lodLevel) || 0, 0, this.lodSteps.length - 1);
        const distance = this._distanceToSection(cameraX, cameraZ, raw.bounds);
        if (level > previousLevel) {
          const boundary = this.lodDistances[previousLevel] ?? Infinity;
          if (distance < boundary * (1 + this.lodHysteresis)) level = previousLevel;
        } else if (level < previousLevel) {
          const boundary = this.lodDistances[level] ?? 0;
          if (distance > boundary * (1 - this.lodHysteresis)) level = previousLevel;
        }
      }
      levels.set(key, level);
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (let z = 0; z < counts.z; z += 1) {
        for (let x = 0; x < counts.x; x += 1) {
          const key = this.sectionKey(x, z);
          let level = levels.get(key) ?? 0;
          for (const [nx, nz] of [[x, z - 1], [x + 1, z], [x, z + 1], [x - 1, z]]) {
            if (nx < 0 || nz < 0 || nx >= counts.x || nz >= counts.z) continue;
            const neighbor = levels.get(this.sectionKey(nx, nz)) ?? 0;
            if (level > neighbor + 1) {
              level = neighbor + 1;
              levels.set(key, level);
              changed = true;
            }
          }
        }
      }
    }

    const plan = new Map();
    for (let z = 0; z < counts.z; z += 1) {
      for (let x = 0; x < counts.x; x += 1) {
        const key = this.sectionKey(x, z);
        const level = clamp(levels.get(key) ?? 0, 0, this.lodSteps.length - 1);
        plan.set(key, {
          ...this.getSectionDescriptor(x, z, this.lodSteps[level]),
          lodLevel: level,
          lodStep: this.lodSteps[level]
        });
      }
    }
    return plan;
  }

  buildSurfaceSectionGeometry(sectionX, sectionZ, lodStep = 1, neighborLods = null) {
    // Phase 2 terrain edit path: consume the native WASM scratch mesh directly
    // into the final PBR vertex layout. Avoid the old 9-float intermediate copy
    // and avoid object-heavy bilinear material sampling for exact grid vertices.
    const native = this._buildSurfaceSectionNative(sectionX, sectionZ, lodStep, neighborLods);
    const source = native.vertexView;
    const sourceStride = 9;
    const targetStride = 17;
    const count = Math.floor(source.length / sourceStride);
    const vertices = new Float32Array(count * targetStride);
    const materialIds = this.materialLayerIds().slice(0, 6);
    const materialLayers = materialIds.map(id => this.materialLayers.get(id) || null);
    const baseLayerIndex = materialIds.indexOf(this.baseMaterialLayerId);
    const gridEpsilon = 0.0001;
    let materialFastPathVertices = 0;
    let materialFallbackVertices = 0;
    const materialPackStarted = performance.now();

    for (let vertex = 0; vertex < count; vertex += 1) {
      const input = vertex * sourceStride;
      const output = vertex * targetStride;
      for (let i = 0; i < 9; i += 1) vertices[output + i] = source[input + i];
      const x = source[input];
      const z = source[input + 2];
      vertices[output + 9] = x;
      vertices[output + 10] = z;

      const gx = (x - this.origin[0]) / this.sampleSpacing;
      const gz = (z - this.origin[2]) / this.sampleSpacing;
      const ix = Math.round(gx);
      const iz = Math.round(gz);
      const exactGrid = baseLayerIndex >= 0 &&
        ix >= 0 && iz >= 0 && ix < this.columns && iz < this.rows &&
        Math.abs(gx - ix) <= gridEpsilon && Math.abs(gz - iz) <= gridEpsilon;

      if (exactGrid) {
        const sampleIndex = iz * this.columns + ix;
        let nonBaseTotal = 0;
        for (let layer = 0; layer < materialLayers.length; layer += 1) {
          if (layer === baseLayerIndex) continue;
          nonBaseTotal += Math.max(0, Number(materialLayers[layer]?.weights?.[sampleIndex]) || 0);
        }
        const nonBaseScale = nonBaseTotal > 255 ? 255 / nonBaseTotal : 1;
        const scaledNonBaseTotal = Math.min(255, nonBaseTotal * nonBaseScale);
        for (let layer = 0; layer < 6; layer += 1) {
          let value = 0;
          if (layer < materialLayers.length) {
            value = layer === baseLayerIndex
              ? Math.max(0, 255 - scaledNonBaseTotal)
              : Math.max(0, Number(materialLayers[layer]?.weights?.[sampleIndex]) || 0) * nonBaseScale;
          }
          vertices[output + 11 + layer] = value / 255;
        }
        materialFastPathVertices += 1;
      } else {
        const weights = this.sampleMaterialWeights(x, z);
        let weightTotal = 0;
        for (let layer = 0; layer < 6; layer += 1) {
          const value = materialIds[layer] ? Math.max(0, Number(weights[materialIds[layer]]) || 0) : 0;
          vertices[output + 11 + layer] = value;
          weightTotal += value;
        }
        if (weightTotal <= 0) vertices[output + 11] = 1;
        materialFallbackVertices += 1;
      }

      // PBR albedo is already color-correct; generic vertex tint stays neutral.
      vertices[output + 6] = 1;
      vertices[output + 7] = 1;
      vertices[output + 8] = 1;
    }
    const materialPackMs = performance.now() - materialPackStarted;

    const indexCopyStarted = performance.now();
    const indices = count > 65535 ? new Uint32Array(native.indexView) : Uint16Array.from(native.indexView);
    const indexCopyMs = performance.now() - indexCopyStarted;
    const intermediateVertexBytesAvoided = source.byteLength;

    return {
      buildTelemetry: {
        nativeBuildMs: native.nativeBuildMs,
        copyMs: materialPackMs + indexCopyMs,
        materialPackMs,
        indexCopyMs,
        sourceVertexBytes: source.byteLength,
        intermediateVertexBytesAvoided,
        materialFastPathVertices,
        materialFallbackVertices,
        vertexBytes: vertices.byteLength,
        indexBytes: indices.byteLength
      },
      id: `terrain-section-${sectionX}-${sectionZ}`,
      sectionX,
      sectionZ,
      chunkX: sectionX,
      chunkZ: sectionZ,
      lod: native.step,
      lodStep: native.step,
      neighborLods: native.neighbors,
      geometry: {
        vertices,
        indices,
        vertexStride: targetStride,
        attributes: { uv: 9, terrainWeights0: 11, terrainWeights1: 15 }
      },
      triangles: indices.length / 3
    };
  }

  validateLandscape() {
    const errors = [];
    if (!LEGACY_LANDSCAPE_FORMATS.has(this.landscapeFormat)) errors.push(`Unsupported landscape format: ${this.landscapeFormat}`);
    if (this.editLayerOrder.length < 1) errors.push('At least one edit layer is required.');
    if (!this.materialLayers.has(this.baseMaterialLayerId)) errors.push('Base terrain material layer is missing.');
    if (this.materialLayers.size > 6) errors.push('Rift terrain splat shader currently supports at most 6 material layers.');
    for (const id of this.editLayerOrder) if (!this.editLayers.has(id)) errors.push(`Edit layer order references missing layer ${id}.`);
    for (const spline of this.splines) {
      if (!spline.id) errors.push('Landscape spline is missing an id.');
      if (!Array.isArray(spline.points)) errors.push(`Landscape spline ${spline.id || '?'} has invalid points.`);
    }
    return {
      ok: errors.length === 0,
      errors,
      format: RIFT_LANDSCAPE_FORMAT,
      schemaVersion: this.schemaVersion,
      components: this.componentCounts(),
      sections: this.sectionCounts()
    };
  }

  getStats() {
    const validation = this.validateLandscape();
    return {
      ...super.getStats(),
      landscapeFormat: RIFT_LANDSCAPE_FORMAT,
      schemaVersion: this.schemaVersion,
      editLayers: this.editLayerOrder.length,
      activeEditLayer: this.activeEditLayerId,
      materialLayers: this.materialLayers.size,
      activeMaterialLayer: this.activeMaterialLayerId,
      splines: this.splines.length,
      activeSpline: this.activeSplineId,
      lodHysteresis: this.lodHysteresis,
      streaming: { ...this.streaming },
      collisionPolicy: { ...this.collisionPolicy, lodSteps: [...this.collisionPolicy.lodSteps] },
      validation
    };
  }
}

export function createRiftLandscape(config) { return new RiftLandscape(config); }
export function createRiftLandscapeFromDocument(document) {
  return document?.terrain?.format === 'rift-terrain-v1' ? new RiftLandscape(document.terrain) : null;
}
