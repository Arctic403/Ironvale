const DEFAULT_TEXTURE_SIZE = 512;
const MAX_TERRAIN_MATERIAL_LAYERS = 6;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

async function decodeResizedImage(url, size) {
  if (!url) return null;
  const response = await fetch(url, { cache: 'force-cache', mode: 'cors' });
  if (!response.ok) throw new Error(`Terrain material failed to load (${response.status}): ${url}`);
  const blob = await response.blob();
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: 'high'
      });
    } catch {}
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = 'anonymous';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Terrain material image decode failed: ${url}`));
      element.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('2D canvas unavailable for terrain material resize.');
    context.drawImage(image, 0, 0, size, size);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function defaultRoughnessByte(layer) {
  const value = Number(layer?.roughnessFactor);
  return Math.round(clamp(Number.isFinite(value) ? value : 0.82, 0, 1) * 255);
}

export class RiftTerrainMaterialRuntime {
  constructor(engine, terrain, options = {}) {
    this.engine = engine;
    this.terrain = terrain;
    this.size = Math.max(128, Math.min(1024, Math.trunc(Number(options.size) || DEFAULT_TEXTURE_SIZE)));
    this.layerIds = terrain.materialLayerIds().slice(0, MAX_TERRAIN_MATERIAL_LAYERS);
    this.layerIndex = new Map(this.layerIds.map((id, index) => [id, index]));
    this.loaded = new Set();
    this.loading = new Map();

    this.albedoArray = engine.createTextureArray(this.size, this.size, MAX_TERRAIN_MATERIAL_LAYERS, { srgb: true });
    this.normalArray = engine.createTextureArray(this.size, this.size, MAX_TERRAIN_MATERIAL_LAYERS, { srgb: false });
    this.roughnessArray = engine.createTextureArray(this.size, this.size, MAX_TERRAIN_MATERIAL_LAYERS, { srgb: false });

    const tileMeters = new Float32Array(MAX_TERRAIN_MATERIAL_LAYERS);
    for (let index = 0; index < MAX_TERRAIN_MATERIAL_LAYERS; index += 1) {
      const id = this.layerIds[index];
      const layer = id ? terrain.materialLayerDescriptor(id) : null;
      const color = layer?.color || [0.4, 0.4, 0.4];
      engine.fillTextureArrayLayer(this.albedoArray, index, [
        Math.round(clamp(color[0], 0, 1) * 255),
        Math.round(clamp(color[1], 0, 1) * 255),
        Math.round(clamp(color[2], 0, 1) * 255),
        255
      ]);
      engine.fillTextureArrayLayer(this.normalArray, index, [128, 128, 255, 255]);
      const rough = defaultRoughnessByte(layer);
      engine.fillTextureArrayLayer(this.roughnessArray, index, [rough, rough, rough, 255]);
      tileMeters[index] = Math.max(0.5, Number(layer?.tileMeters) || 4);
    }

    this.material = {
      kind: 'rift-terrain-splat-v1',
      layerCount: this.layerIds.length,
      layerIds: [...this.layerIds],
      albedoArray: this.albedoArray,
      normalArray: this.normalArray,
      roughnessArray: this.roughnessArray,
      tileMeters
    };
  }

  attach(mesh) {
    if (mesh) mesh.terrainMaterial = this.material;
    return mesh;
  }

  async loadLayer(id) {
    const key = String(id || '');
    const index = this.layerIndex.get(key);
    if (!Number.isInteger(index)) return false;
    if (this.loaded.has(key)) return true;
    if (this.loading.has(key)) return this.loading.get(key);

    const layer = this.terrain.materialLayerDescriptor(key);
    const task = (async () => {
      const [albedo, normal, roughness] = await Promise.all([
        decodeResizedImage(layer?.texture, this.size).catch(error => { console.warn(error); return null; }),
        decodeResizedImage(layer?.normal, this.size).catch(error => { console.warn(error); return null; }),
        decodeResizedImage(layer?.roughness, this.size).catch(error => { console.warn(error); return null; })
      ]);
      if (albedo) this.engine.updateTextureArrayLayer(this.albedoArray, index, albedo);
      if (normal) this.engine.updateTextureArrayLayer(this.normalArray, index, normal);
      if (roughness) this.engine.updateTextureArrayLayer(this.roughnessArray, index, roughness);
      albedo?.close?.();
      normal?.close?.();
      roughness?.close?.();
      this.loaded.add(key);
      this.loading.delete(key);
      return true;
    })().catch(error => {
      this.loading.delete(key);
      console.warn(`Terrain material layer "${key}" stayed on fallback colors.`, error);
      return false;
    });

    this.loading.set(key, task);
    return task;
  }

  async loadInitial() {
    const ids = new Set([
      this.terrain?.baseMaterialLayerId,
      this.terrain?.activeMaterialLayerId
    ].filter(Boolean));
    return Promise.allSettled([...ids].map(id => this.loadLayer(id)));
  }

  async loadAll() {
    return Promise.allSettled(this.layerIds.map(id => this.loadLayer(id)));
  }

  destroy() {
    if (!this.engine) return;
    this.engine.destroyTextureArray(this.albedoArray);
    this.engine.destroyTextureArray(this.normalArray);
    this.engine.destroyTextureArray(this.roughnessArray);
    this.engine = null;
    this.terrain = null;
    this.loading.clear();
    this.loaded.clear();
  }
}

export function createRiftTerrainMaterialRuntime(engine, terrain, options) {
  return new RiftTerrainMaterialRuntime(engine, terrain, options);
}
