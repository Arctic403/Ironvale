const GLB_MAGIC = 0x46546c67;
const GLB_JSON = 0x4e4f534a;
const GLB_BIN = 0x004e4942;
const TYPE_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });
const COMPONENT_BYTES = Object.freeze({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 });
const TARGET_HEIGHT = 1.82;

function parseGlb(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Character file is not a GLB.');
  if (view.getUint32(4, true) !== 2) throw new Error('Character GLB must use glTF 2.0.');
  let offset = 12;
  let document = null;
  let binary = null;
  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + length > view.byteLength) throw new Error('Character GLB chunk is truncated.');
    const bytes = new Uint8Array(buffer, offset, length);
    if (type === GLB_JSON) {
      const text = new TextDecoder().decode(bytes).replace(/\0+$/g, '').trim();
      document = JSON.parse(text);
    } else if (type === GLB_BIN) {
      binary = bytes;
    }
    offset += length;
  }
  if (!document || !binary) throw new Error('Character GLB is missing JSON or BIN data.');
  if ((document.extensionsRequired || []).length) throw new Error(`Unsupported required character extensions: ${document.extensionsRequired.join(', ')}`);
  return { document, binary };
}

function readComponent(view, offset, type) {
  if (type === 5120) return view.getInt8(offset);
  if (type === 5121) return view.getUint8(offset);
  if (type === 5122) return view.getInt16(offset, true);
  if (type === 5123) return view.getUint16(offset, true);
  if (type === 5125) return view.getUint32(offset, true);
  if (type === 5126) return view.getFloat32(offset, true);
  throw new Error(`Unsupported glTF component type ${type}.`);
}

function normalizedComponent(value, type) {
  if (type === 5120) return Math.max(value / 127, -1);
  if (type === 5121) return value / 255;
  if (type === 5122) return Math.max(value / 32767, -1);
  if (type === 5123) return value / 65535;
  return value;
}

function readAccessor(parsed, index) {
  const { document, binary } = parsed;
  const accessor = document.accessors?.[index];
  if (!accessor) throw new Error(`Missing glTF accessor ${index}.`);
  if (accessor.sparse) throw new Error('Sparse character accessors are not supported yet.');
  const bufferView = document.bufferViews?.[accessor.bufferView];
  if (!bufferView) throw new Error(`Accessor ${index} has no bufferView.`);
  const components = TYPE_COMPONENTS[accessor.type];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  if (!components || !componentBytes) throw new Error(`Unsupported accessor ${accessor.type}/${accessor.componentType}.`);
  const stride = bufferView.byteStride || components * componentBytes;
  const start = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const source = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const result = new Float64Array(accessor.count * components);
  for (let item = 0; item < accessor.count; item += 1) {
    const base = start + item * stride;
    for (let component = 0; component < components; component += 1) {
      let value = readComponent(source, base + component * componentBytes, accessor.componentType);
      if (accessor.normalized) value = normalizedComponent(value, accessor.componentType);
      result[item * components + component] = value;
    }
  }
  return { values: result, count: accessor.count, components, accessor };
}

function colorForMaterial(document, index) {
  const material = document.materials?.[index] || {};
  const name = String(material.name || '').toLowerCase();
  const factor = material.pbrMetallicRoughness?.baseColorFactor;
  if (name.includes('skin') || name.includes('body')) return [0.68, 0.49, 0.35];
  if (name.includes('hair')) return [0.075, 0.06, 0.05];
  if (name.includes('eye')) return [0.15, 0.18, 0.20];
  if (name.includes('boot') || name.includes('shoe')) return [0.055, 0.06, 0.065];
  if (name.includes('cloth') || name.includes('shirt') || name.includes('pant') || name.includes('superhero')) return [0.22, 0.27, 0.31];
  if (Array.isArray(factor) && factor.length >= 3 && factor.slice(0, 3).some(value => value < 0.94)) {
    return factor.slice(0, 3).map(value => Math.max(0.025, Math.min(1, Number(value) || 0)));
  }
  const palette = [[0.23,0.28,0.32],[0.62,0.45,0.33],[0.08,0.09,0.10],[0.35,0.39,0.42]];
  return palette[(Number(index) || 0) % palette.length];
}

function buildGeometry(parsed) {
  const { document } = parsed;
  if (!document.skins?.length) throw new Error('Imported character is not rigged.');
  const skin = document.skins[0];
  if ((skin.joints || []).length < 20) throw new Error('Imported humanoid rig has too few joints.');

  const vertices = [];
  const indices = [];
  let vertexBase = 0;
  let riggedPrimitiveCount = 0;

  for (const mesh of document.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      if ((primitive.mode ?? 4) !== 4 || primitive.attributes?.POSITION == null) continue;
      const positions = readAccessor(parsed, primitive.attributes.POSITION);
      const normals = primitive.attributes.NORMAL == null ? null : readAccessor(parsed, primitive.attributes.NORMAL);
      const joints = primitive.attributes.JOINTS_0 == null ? null : readAccessor(parsed, primitive.attributes.JOINTS_0);
      const weights = primitive.attributes.WEIGHTS_0 == null ? null : readAccessor(parsed, primitive.attributes.WEIGHTS_0);
      if (joints && weights) riggedPrimitiveCount += 1;
      const color = colorForMaterial(document, primitive.material);
      for (let i = 0; i < positions.count; i += 1) {
        const p = i * positions.components;
        const n = normals ? i * normals.components : -1;
        vertices.push(
          positions.values[p], positions.values[p + 1], positions.values[p + 2],
          normals ? normals.values[n] : 0,
          normals ? normals.values[n + 1] : 1,
          normals ? normals.values[n + 2] : 0,
          color[0], color[1], color[2]
        );
      }
      if (primitive.indices != null) {
        const sourceIndices = readAccessor(parsed, primitive.indices);
        for (let i = 0; i < sourceIndices.count; i += 1) indices.push(vertexBase + Math.trunc(sourceIndices.values[i]));
      } else {
        for (let i = 0; i < positions.count; i += 1) indices.push(vertexBase + i);
      }
      vertexBase += positions.count;
    }
  }
  if (!vertices.length || !indices.length) throw new Error('Character GLB contains no renderable triangle geometry.');
  if (!riggedPrimitiveCount) throw new Error('Character mesh does not expose JOINTS_0/WEIGHTS_0 skin data.');

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertices.length; i += 9) {
    minX = Math.min(minX, vertices[i]); maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]); maxY = Math.max(maxY, vertices[i + 1]);
    minZ = Math.min(minZ, vertices[i + 2]); maxZ = Math.max(maxZ, vertices[i + 2]);
  }
  const sourceHeight = Math.max(0.001, maxY - minY);
  const scale = TARGET_HEIGHT / sourceHeight;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  for (let i = 0; i < vertices.length; i += 9) {
    vertices[i] = (vertices[i] - centerX) * scale;
    vertices[i + 1] = (vertices[i + 1] - minY) * scale;
    vertices[i + 2] = (vertices[i + 2] - centerZ) * scale;
  }

  const jointNames = (skin.joints || []).map(nodeIndex => document.nodes?.[nodeIndex]?.name || `joint-${nodeIndex}`);
  return {
    geometry: {
      vertices: new Float32Array(vertices),
      indices: vertexBase > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
      vertexStride: 9
    },
    rig: {
      skinName: skin.name || 'Armature',
      jointCount: jointNames.length,
      jointNames,
      authoredForward: '+Z',
      feetAtY: 0,
      sourceHeight,
      renderHeight: TARGET_HEIGHT,
      animationReady: true
    },
    materials: (document.materials || []).map(material => material.name || null)
  };
}

export async function loadRiggedCharacterGeometry(url = '/assets/characters/quaternius/universal-base-male.glb') {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Rigged character failed to load (${response.status}).`);
  const parsed = parseGlb(await response.arrayBuffer());
  return buildGeometry(parsed);
}
