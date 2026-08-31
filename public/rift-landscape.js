import { RiftTerrain } from './rift-terrain.js?v=20260831-landscape-v2';

export const RIFT_LANDSCAPE_FORMAT = 'rift-landscape-v2';
export const RIFT_LANDSCAPE_EDIT_FORMAT = 'rift-landscape-edits-v1';

const DEFAULT_EDIT_LAYERS = Object.freeze([
  { id: 'sculpt', name: 'Sculpt', enabled: true, locked: false }
]);

const DEFAULT_MATERIAL_LAYERS = Object.freeze([
  { id: 'grass', name: 'Grass', defaultWeight: 255 },
  { id: 'dirt', name: 'Dirt', defaultWeight: 0 },
  { id: 'rock', name: 'Rock', defaultWeight: 0 },
  { id: 'gravel', name: 'Gravel', defaultWeight: 0 },
  { id: 'mud', name: 'Mud', defaultWeight: 0 },
  { id: 'path', name: 'Path', defaultWeight: 0 }
]);

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function smooth01(value) { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); }
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
    this.landscapeFormat = landscape.format || RIFT_LANDSCAPE_FORMAT;
    this.lodHysteresis = clamp(Number(landscape.lodHysteresis ?? 0.12), 0, 0.45);
    this._dirtyComponents = new Set();
    this.editLayers = new Map();
    this.editLayerOrder = [];
    this.materialLayers = new Map();
    this.splines = Array.isArray(landscape.splines) ? landscape.splines.map(copySpline) : [];
    this.streaming = {
      enabled: landscape.streaming?.enabled !== false,
      componentRadius: Math.max(1, Math.trunc(Number(landscape.streaming?.componentRadius) || 3)),
      preloadRing: Math.max(0, Math.trunc(Number(landscape.streaming?.preloadRing) || 1))
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
    const layer = {
      id,
      name: String(definition.name || id),
      defaultWeight: clamp(Math.round(Number(definition.defaultWeight) || 0), 0, 255),
      texture: definition.texture || null,
      normal: definition.normal || null,
      roughness: definition.roughness ?? null,
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
    super.rebuildFromManualDelta();
    this.markAllComponentsDirty();
  }

  captureEditState() {
    return {
      format: 'rift-landscape-state-v1',
      activeEditLayerId: this.activeEditLayerId,
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
    this.splines = Array.isArray(state.splines) ? state.splines.map(copySpline) : [];
    this.recomposeEditLayers();
    return true;
  }

  serializeLandscapeEdits({ worldId = 'ironvale-terrain' } = {}) {
    return {
      format: RIFT_LANDSCAPE_EDIT_FORMAT,
      landscapeFormat: RIFT_LANDSCAPE_FORMAT,
      worldId,
      width: this.width,
      depth: this.depth,
      sampleSpacing: this.sampleSpacing,
      savedAt: Date.now(),
      activeEditLayer: this.activeEditLayerId,
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
        weights: sparseInt(layer.weights)
      })),
      splines: this.splines.map(copySpline)
    };
  }

  applySerializedLandscapeEdits(data) {
    if (!data || data.format !== RIFT_LANDSCAPE_EDIT_FORMAT) return false;
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
    this.splines = Array.isArray(data.splines) ? data.splines.map(copySpline) : [];
    this.recomposeEditLayers();
    return true;
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

  paintMaterial(brush = {}) {
    const id = cleanId(brush.layerId || brush.material || '');
    const layer = this.materialLayers.get(id);
    if (!layer) return false;
    const x = Number(brush.x) || 0;
    const z = Number(brush.z) || 0;
    const radius = Math.max(this.sampleSpacing, Number(brush.radius) || 6);
    const strength = clamp(Number(brush.strength) || 0.25, 0, 1);
    const erase = Boolean(brush.erase);
    const indices = this._sampleIndicesInBrush(x, z, radius);
    for (const index of indices) {
      const ix = index % this.columns;
      const iz = Math.floor(index / this.columns);
      const wx = this.origin[0] + ix * this.sampleSpacing;
      const wz = this.origin[2] + iz * this.sampleSpacing;
      const distance = Math.hypot(wx - x, wz - z);
      const falloff = smooth01(1 - distance / radius);
      const amount = Math.round(255 * strength * falloff);
      layer.weights[index] = clamp(layer.weights[index] + (erase ? -amount : amount), 0, 255);
    }
    this.markDirtyRegion(x, z, radius);
    this._markDirtyComponentsFromSections();
    this.revision += 1;
    return true;
  }

  sampleMaterialWeights(x, z) {
    if (!this.containsXZ(x, z)) return {};
    const ix = clamp(Math.round((x - this.origin[0]) / this.sampleSpacing), 0, this.columns - 1);
    const iz = clamp(Math.round((z - this.origin[2]) / this.sampleSpacing), 0, this.rows - 1);
    const index = iz * this.columns + ix;
    const result = {};
    let total = 0;
    for (const layer of this.materialLayers.values()) {
      const explicit = layer.weights[index];
      const value = explicit || layer.defaultWeight || 0;
      result[layer.id] = value;
      total += value;
    }
    if (total > 0) for (const id of Object.keys(result)) result[id] = result[id] / total;
    return result;
  }

  setSpline(spline = {}) {
    const id = cleanId(spline.id || `spline-${this.splines.length + 1}`, `spline-${this.splines.length + 1}`);
    const normalized = {
      ...copySpline(spline),
      id,
      name: String(spline.name || id),
      enabled: spline.enabled !== false,
      points: Array.isArray(spline.points) ? spline.points.map(copySpline) : []
    };
    const index = this.splines.findIndex(entry => entry.id === id);
    if (index >= 0) this.splines[index] = normalized;
    else this.splines.push(normalized);
    this.revision += 1;
    return normalized;
  }

  removeSpline(id) {
    const key = cleanId(id);
    const before = this.splines.length;
    this.splines = this.splines.filter(entry => entry.id !== key);
    if (this.splines.length !== before) this.revision += 1;
    return this.splines.length !== before;
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
      streaming: { ...this.streaming }
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

  getStats() {
    return {
      ...super.getStats(),
      landscapeFormat: RIFT_LANDSCAPE_FORMAT,
      editLayers: this.editLayerOrder.length,
      activeEditLayer: this.activeEditLayerId,
      materialLayers: this.materialLayers.size,
      splines: this.splines.length,
      lodHysteresis: this.lodHysteresis,
      streaming: { ...this.streaming }
    };
  }
}

export function createRiftLandscape(config) { return new RiftLandscape(config); }
export function createRiftLandscapeFromDocument(document) {
  return document?.terrain?.format === 'rift-terrain-v1' ? new RiftLandscape(document.terrain) : null;
}
