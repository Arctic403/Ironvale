const GLB_MAGIC = 0x46546c67;
const GLB_JSON = 0x4e4f534a;
const GLB_BIN = 0x004e4942;
const TYPE_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });
const COMPONENT_BYTES = Object.freeze({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 });
const TARGET_HEIGHT = 1.82;
const CHARACTER_STRIDE = 19;

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

function bufferViewBytes(parsed, index) {
  const view = parsed.document.bufferViews?.[index];
  if (!view) throw new Error(`Missing glTF bufferView ${index}.`);
  const start = view.byteOffset || 0;
  const end = start + view.byteLength;
  if (end > parsed.binary.byteLength) throw new Error(`bufferView ${index} exceeds GLB binary data.`);
  return parsed.binary.slice(start, end);
}

function mat4Identity(out) {
  out.fill(0); out[0] = out[5] = out[10] = out[15] = 1; return out;
}

function mat4MultiplySlice(out, oo, a, ao, b, bo) {
  for (let column = 0; column < 4; column += 1) {
    const b0 = b[bo + column * 4];
    const b1 = b[bo + column * 4 + 1];
    const b2 = b[bo + column * 4 + 2];
    const b3 = b[bo + column * 4 + 3];
    out[oo + column * 4] = a[ao] * b0 + a[ao + 4] * b1 + a[ao + 8] * b2 + a[ao + 12] * b3;
    out[oo + column * 4 + 1] = a[ao + 1] * b0 + a[ao + 5] * b1 + a[ao + 9] * b2 + a[ao + 13] * b3;
    out[oo + column * 4 + 2] = a[ao + 2] * b0 + a[ao + 6] * b1 + a[ao + 10] * b2 + a[ao + 14] * b3;
    out[oo + column * 4 + 3] = a[ao + 3] * b0 + a[ao + 7] * b1 + a[ao + 11] * b2 + a[ao + 15] * b3;
  }
  return out;
}

function mat4Multiply(out, a, b) { return mat4MultiplySlice(out, 0, a, 0, b, 0); }

function composeTrs(out, translation, to, rotation, ro, scale, so) {
  const x = rotation[ro], y = rotation[ro + 1], z = rotation[ro + 2], w = rotation[ro + 3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = scale[so], sy = scale[so + 1], sz = scale[so + 2];
  out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx; out[2] = (xz - wy) * sx; out[3] = 0;
  out[4] = (xy - wz) * sy; out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy; out[7] = 0;
  out[8] = (xz + wy) * sz; out[9] = (yz - wx) * sz; out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
  out[12] = translation[to]; out[13] = translation[to + 1]; out[14] = translation[to + 2]; out[15] = 1;
  return out;
}

function quaternionFromMatrix(m) {
  const trace = m[0] + m[5] + m[10];
  let x = 0, y = 0, z = 0, w = 1;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2; w = 0.25 * s; x = (m[6] - m[9]) / s; y = (m[8] - m[2]) / s; z = (m[1] - m[4]) / s;
  } else if (m[0] > m[5] && m[0] > m[10]) {
    const s = Math.sqrt(1 + m[0] - m[5] - m[10]) * 2; w = (m[6] - m[9]) / s; x = 0.25 * s; y = (m[4] + m[1]) / s; z = (m[8] + m[2]) / s;
  } else if (m[5] > m[10]) {
    const s = Math.sqrt(1 + m[5] - m[0] - m[10]) * 2; w = (m[8] - m[2]) / s; x = (m[4] + m[1]) / s; y = 0.25 * s; z = (m[9] + m[6]) / s;
  } else {
    const s = Math.sqrt(1 + m[10] - m[0] - m[5]) * 2; w = (m[1] - m[4]) / s; x = (m[8] + m[2]) / s; y = (m[9] + m[6]) / s; z = 0.25 * s;
  }
  const length = Math.hypot(x, y, z, w) || 1;
  return [x / length, y / length, z / length, w / length];
}

function nodeTrs(node = {}) {
  if (!Array.isArray(node.matrix) || node.matrix.length !== 16) {
    return {
      translation: [...(node.translation || [0, 0, 0])],
      rotation: [...(node.rotation || [0, 0, 0, 1])],
      scale: [...(node.scale || [1, 1, 1])]
    };
  }
  const m = node.matrix.map(Number);
  const sx = Math.hypot(m[0], m[1], m[2]) || 1;
  const sy = Math.hypot(m[4], m[5], m[6]) || 1;
  const sz = Math.hypot(m[8], m[9], m[10]) || 1;
  const rotationMatrix = [m[0] / sx, m[1] / sx, m[2] / sx, 0, m[4] / sy, m[5] / sy, m[6] / sy, 0, m[8] / sz, m[9] / sz, m[10] / sz, 0, 0, 0, 0, 1];
  return { translation: [m[12], m[13], m[14]], rotation: quaternionFromMatrix(rotationMatrix), scale: [sx, sy, sz] };
}

function buildParents(document) {
  const parents = new Int32Array(document.nodes?.length || 0); parents.fill(-1);
  for (let parent = 0; parent < parents.length; parent += 1) {
    for (const child of document.nodes[parent]?.children || []) if (child >= 0 && child < parents.length) parents[child] = parent;
  }
  return parents;
}

function buildSkinData(parsed) {
  const document = parsed.document;
  return (document.skins || []).map((skin, skinIndex) => {
    const joints = Int32Array.from(skin.joints || []);
    if (!joints.length) throw new Error(`Character skin ${skinIndex} has no joints.`);
    const inverseBind = new Float32Array(joints.length * 16);
    if (skin.inverseBindMatrices != null) {
      const accessor = readAccessor(parsed, skin.inverseBindMatrices);
      if (accessor.components !== 16 || accessor.count < joints.length) throw new Error(`Character skin ${skinIndex} has invalid inverse bind matrices.`);
      for (let i = 0; i < inverseBind.length; i += 1) inverseBind[i] = accessor.values[i];
    } else {
      for (let joint = 0; joint < joints.length; joint += 1) mat4Identity(inverseBind.subarray(joint * 16, joint * 16 + 16));
    }
    return { name: skin.name || `Skin ${skinIndex}`, joints, inverseBind };
  });
}

function materialInfo(document, index) {
  const material = document.materials?.[index] || {};
  const pbr = material.pbrMetallicRoughness || {};
  return {
    name: material.name || null,
    baseColorFactor: Array.isArray(pbr.baseColorFactor) ? [pbr.baseColorFactor[0] ?? 1, pbr.baseColorFactor[1] ?? 1, pbr.baseColorFactor[2] ?? 1, pbr.baseColorFactor[3] ?? 1] : [1, 1, 1, 1],
    baseColorTextureIndex: pbr.baseColorTexture?.index ?? null,
    alphaMode: material.alphaMode || 'OPAQUE',
    doubleSided: Boolean(material.doubleSided)
  };
}

function buildPrimitives(parsed) {
  const { document } = parsed;
  if (!document.skins?.length) throw new Error('Imported character is not rigged.');
  const primitives = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let riggedPrimitiveCount = 0;
  const nodes = document.nodes || [];
  const meshNodes = nodes.map((node, nodeIndex) => ({ node, nodeIndex })).filter(entry => entry.node?.mesh != null);
  const entries = meshNodes.length ? meshNodes : (document.meshes || []).map((mesh, meshIndex) => ({ node: { mesh: meshIndex, skin: 0 }, nodeIndex: -1 }));

  for (const { node, nodeIndex } of entries) {
    const mesh = document.meshes?.[node.mesh];
    if (!mesh) continue;
    for (const primitive of mesh.primitives || []) {
      if ((primitive.mode ?? 4) !== 4 || primitive.attributes?.POSITION == null) continue;
      const positions = readAccessor(parsed, primitive.attributes.POSITION);
      const normals = primitive.attributes.NORMAL == null ? null : readAccessor(parsed, primitive.attributes.NORMAL);
      const uv = primitive.attributes.TEXCOORD_0 == null ? null : readAccessor(parsed, primitive.attributes.TEXCOORD_0);
      const colors = primitive.attributes.COLOR_0 == null ? null : readAccessor(parsed, primitive.attributes.COLOR_0);
      const joints = primitive.attributes.JOINTS_0 == null ? null : readAccessor(parsed, primitive.attributes.JOINTS_0);
      const weights = primitive.attributes.WEIGHTS_0 == null ? null : readAccessor(parsed, primitive.attributes.WEIGHTS_0);
      const rigged = Boolean(joints && weights && node.skin != null);
      if (rigged) riggedPrimitiveCount += 1;
      const vertices = new Float32Array(positions.count * CHARACTER_STRIDE);
      for (let i = 0; i < positions.count; i += 1) {
        const out = i * CHARACTER_STRIDE, p = i * positions.components, n = normals ? i * normals.components : -1, t = uv ? i * uv.components : -1, c = colors ? i * colors.components : -1, j = joints ? i * joints.components : -1, w = weights ? i * weights.components : -1;
        const px = positions.values[p], py = positions.values[p + 1], pz = positions.values[p + 2];
        vertices[out] = px; vertices[out + 1] = py; vertices[out + 2] = pz;
        vertices[out + 3] = normals ? normals.values[n] : 0; vertices[out + 4] = normals ? normals.values[n + 1] : 1; vertices[out + 5] = normals ? normals.values[n + 2] : 0;
        vertices[out + 6] = colors ? colors.values[c] : 1; vertices[out + 7] = colors ? colors.values[c + 1] : 1; vertices[out + 8] = colors ? colors.values[c + 2] : 1;
        vertices[out + 9] = uv ? uv.values[t] : 0; vertices[out + 10] = uv ? uv.values[t + 1] : 0;
        vertices[out + 11] = joints ? joints.values[j] : 0; vertices[out + 12] = joints ? joints.values[j + 1] : 0; vertices[out + 13] = joints ? joints.values[j + 2] : 0; vertices[out + 14] = joints ? joints.values[j + 3] : 0;
        let w0 = weights ? weights.values[w] : 1, w1 = weights ? weights.values[w + 1] : 0, w2 = weights ? weights.values[w + 2] : 0, w3 = weights ? weights.values[w + 3] : 0;
        const weightTotal = w0 + w1 + w2 + w3;
        if (weightTotal > 0.000001) { w0 /= weightTotal; w1 /= weightTotal; w2 /= weightTotal; w3 /= weightTotal; } else { w0 = 1; w1 = w2 = w3 = 0; }
        vertices[out + 15] = w0; vertices[out + 16] = w1; vertices[out + 17] = w2; vertices[out + 18] = w3;
        minX = Math.min(minX, px); minY = Math.min(minY, py); minZ = Math.min(minZ, pz); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); maxZ = Math.max(maxZ, pz);
      }
      let indices;
      if (primitive.indices != null) {
        const source = readAccessor(parsed, primitive.indices);
        const IndexType = positions.count > 65535 ? Uint32Array : Uint16Array;
        indices = new IndexType(source.count);
        for (let i = 0; i < source.count; i += 1) indices[i] = Math.trunc(source.values[i]);
      } else {
        const IndexType = positions.count > 65535 ? Uint32Array : Uint16Array;
        indices = new IndexType(positions.count); for (let i = 0; i < positions.count; i += 1) indices[i] = i;
      }
      const attributes = { uv: 9 };
      if (rigged) { attributes.joints = 11; attributes.weights = 15; }
      primitives.push({
        geometry: { vertices, indices, vertexStride: CHARACTER_STRIDE, attributes },
        material: materialInfo(document, primitive.material),
        skinIndex: rigged ? Number(node.skin) : null,
        meshNodeIndex: nodeIndex,
        meshName: mesh.name || null
      });
    }
  }
  if (!primitives.length) throw new Error('Character GLB contains no renderable triangle geometry.');
  if (!riggedPrimitiveCount) throw new Error('Character mesh does not expose usable JOINTS_0/WEIGHTS_0 skin data.');
  const sourceHeight = Math.max(0.001, maxY - minY);
  return { primitives, bounds: { minX, minY, minZ, maxX, maxY, maxZ }, sourceHeight, renderScale: TARGET_HEIGHT / sourceHeight };
}

async function decodeImageBlob(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob); } catch (_) {}
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Character texture failed to decode.')); };
    image.src = url;
  });
}

async function loadTextureImage(parsed, modelUrl, textureIndex) {
  const texture = parsed.document.textures?.[textureIndex];
  if (!texture) return null;
  const image = parsed.document.images?.[texture.source];
  if (!image) return null;
  let blob;
  if (image.bufferView != null) {
    blob = new Blob([bufferViewBytes(parsed, image.bufferView)], { type: image.mimeType || 'application/octet-stream' });
  } else if (image.uri) {
    const response = await fetch(new URL(image.uri, new URL(modelUrl, location.href)).href, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Character texture failed to load (${response.status}).`);
    blob = await response.blob();
  } else return null;
  return decodeImageBlob(blob);
}

function animationValueIndex(track, key) {
  return track.interpolation === 'CUBICSPLINE' ? (key * 3 + 1) * track.components : key * track.components;
}

function findKeyframe(times, time) {
  const count = times.length;
  if (count <= 1 || time <= times[0]) return [0, 0, 0];
  if (time >= times[count - 1]) return [count - 1, count - 1, 0];
  let lo = 0, hi = count - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (times[mid] <= time) lo = mid; else hi = mid; }
  const span = times[hi] - times[lo] || 1;
  return [lo, hi, Math.max(0, Math.min(1, (time - times[lo]) / span))];
}

function slerpInto(target, offset, a, ao, b, bo, t) {
  let ax = a[ao], ay = a[ao + 1], az = a[ao + 2], aw = a[ao + 3];
  let bx = b[bo], by = b[bo + 1], bz = b[bo + 2], bw = b[bo + 3];
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) { dot = -dot; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let scale0 = 1 - t, scale1 = t;
  if (1 - dot > 0.00001) {
    const theta = Math.acos(Math.max(-1, Math.min(1, dot))), sinTheta = Math.sin(theta) || 1;
    scale0 = Math.sin((1 - t) * theta) / sinTheta; scale1 = Math.sin(t * theta) / sinTheta;
  }
  const x = scale0 * ax + scale1 * bx, y = scale0 * ay + scale1 * by, z = scale0 * az + scale1 * bz, w = scale0 * aw + scale1 * bw;
  const length = Math.hypot(x, y, z, w) || 1;
  target[offset] = x / length; target[offset + 1] = y / length; target[offset + 2] = z / length; target[offset + 3] = w / length;
}

function buildAnimationClips(parsed, baseDocument) {
  const baseNameMap = new Map();
  (baseDocument.nodes || []).forEach((node, index) => { if (node?.name) { baseNameMap.set(node.name, index); baseNameMap.set(node.name.toLowerCase(), index); } });
  const clips = new Map();
  for (let animationIndex = 0; animationIndex < (parsed.document.animations || []).length; animationIndex += 1) {
    const animation = parsed.document.animations[animationIndex];
    const tracks = [];
    let duration = 0;
    for (const channel of animation.channels || []) {
      const targetNode = parsed.document.nodes?.[channel.target?.node];
      const targetName = targetNode?.name;
      const nodeIndex = targetName ? (baseNameMap.get(targetName) ?? baseNameMap.get(targetName.toLowerCase())) : null;
      if (nodeIndex == null || !['translation', 'rotation', 'scale'].includes(channel.target?.path)) continue;
      const sampler = animation.samplers?.[channel.sampler];
      if (!sampler || sampler.input == null || sampler.output == null) continue;
      const input = readAccessor(parsed, sampler.input), output = readAccessor(parsed, sampler.output);
      const times = Float32Array.from(input.values);
      if (!times.length) continue;
      duration = Math.max(duration, times[times.length - 1]);
      tracks.push({ nodeIndex, path: channel.target.path, times, values: Float32Array.from(output.values), components: output.components, interpolation: sampler.interpolation || 'LINEAR' });
    }
    if (!tracks.length) continue;
    const name = animation.name || `Animation ${animationIndex + 1}`;
    clips.set(name, { name, tracks, duration: Math.max(0.0001, duration) });
  }
  return clips;
}

function chooseClip(names, patterns, fallback = null) {
  for (const pattern of patterns) {
    const found = names.find(name => pattern.test(name));
    if (found) return found;
  }
  return fallback;
}

class RiftCharacterRuntime {
  constructor(document, skins, clips) {
    this.document = document;
    this.skins = skins;
    this.clips = clips;
    this.parents = buildParents(document);
    const count = document.nodes?.length || 0;
    this.restTranslation = new Float32Array(count * 3); this.restRotation = new Float32Array(count * 4); this.restScale = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const trs = nodeTrs(document.nodes[i]);
      this.restTranslation.set(trs.translation, i * 3); this.restRotation.set(trs.rotation, i * 4); this.restScale.set(trs.scale, i * 3);
    }
    this.translation = new Float32Array(this.restTranslation); this.rotation = new Float32Array(this.restRotation); this.scale = new Float32Array(this.restScale);
    this.localMatrices = Array.from({ length: count }, () => new Float32Array(16)); this.worldMatrices = Array.from({ length: count }, () => new Float32Array(16)); this.worldReady = new Uint8Array(count);
    this.skinMatrices = skins.map(skin => new Float32Array(skin.joints.length * 16));
    this.clipName = null; this.time = 0;
    this._composeWorld();
  }
  _composeWorld() {
    const count = this.worldMatrices.length; this.worldReady.fill(0);
    for (let i = 0; i < count; i += 1) composeTrs(this.localMatrices[i], this.translation, i * 3, this.rotation, i * 4, this.scale, i * 3);
    const resolve = index => {
      if (this.worldReady[index]) return this.worldMatrices[index];
      const parent = this.parents[index];
      if (parent >= 0) mat4Multiply(this.worldMatrices[index], resolve(parent), this.localMatrices[index]); else this.worldMatrices[index].set(this.localMatrices[index]);
      this.worldReady[index] = 1; return this.worldMatrices[index];
    };
    for (let i = 0; i < count; i += 1) resolve(i);
    for (let skinIndex = 0; skinIndex < this.skins.length; skinIndex += 1) {
      const skin = this.skins[skinIndex], out = this.skinMatrices[skinIndex];
      for (let joint = 0; joint < skin.joints.length; joint += 1) mat4MultiplySlice(out, joint * 16, this.worldMatrices[skin.joints[joint]], 0, skin.inverseBind, joint * 16);
    }
  }
  update(dt, requestedClip) {
    const clip = this.clips.get(requestedClip) || this.clips.values().next().value || null;
    const nextName = clip?.name || null;
    if (nextName !== this.clipName) { this.clipName = nextName; this.time = 0; }
    else if (clip) this.time = (this.time + Math.max(0, Number(dt) || 0)) % clip.duration;
    this.translation.set(this.restTranslation); this.rotation.set(this.restRotation); this.scale.set(this.restScale);
    if (clip) {
      for (const track of clip.tracks) {
        const [aKey, bKey, mix] = findKeyframe(track.times, this.time);
        const a = animationValueIndex(track, aKey), b = animationValueIndex(track, bKey);
        if (track.path === 'rotation') {
          slerpInto(this.rotation, track.nodeIndex * 4, track.values, a, track.values, b, track.interpolation === 'STEP' ? 0 : mix);
        } else {
          const target = track.path === 'translation' ? this.translation : this.scale, offset = track.nodeIndex * 3, amount = track.interpolation === 'STEP' ? 0 : mix;
          target[offset] = track.values[a] + (track.values[b] - track.values[a]) * amount;
          target[offset + 1] = track.values[a + 1] + (track.values[b + 1] - track.values[a + 1]) * amount;
          target[offset + 2] = track.values[a + 2] + (track.values[b + 2] - track.values[a + 2]) * amount;
        }
      }
    }
    this._composeWorld();
    return this;
  }
  getSkinMatrices(index = 0) { return this.skinMatrices[index] || null; }
}

async function fetchGlb(url) {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Character asset failed to load (${response.status}).`);
  return parseGlb(await response.arrayBuffer());
}

export async function loadRiggedCharacterAsset(
  modelUrl = '/assets/characters/quaternius/universal-base-male.glb',
  animationUrl = '/assets/characters/quaternius/universal-animation-library.glb'
) {
  const [modelParsed, animationParsed] = await Promise.all([fetchGlb(modelUrl), fetchGlb(animationUrl)]);
  const built = buildPrimitives(modelParsed);
  const skins = buildSkinData(modelParsed);
  const textureIndices = [...new Set(built.primitives.map(entry => entry.material.baseColorTextureIndex).filter(Number.isInteger))];
  const decodedTextures = new Map();
  await Promise.all(textureIndices.map(async index => decodedTextures.set(index, await loadTextureImage(modelParsed, modelUrl, index))));
  for (const primitive of built.primitives) primitive.material.baseColorImage = Number.isInteger(primitive.material.baseColorTextureIndex) ? decodedTextures.get(primitive.material.baseColorTextureIndex) || null : null;

  const clips = buildAnimationClips(animationParsed, modelParsed.document);
  const clipNames = [...clips.keys()];
  const idle = chooseClip(clipNames, [/^idle$/i, /idle/i, /stand/i], clipNames[0] || null);
  const walk = chooseClip(clipNames, [/walk(?!.*back)/i, /walking/i, /run/i], idle);
  const runtime = new RiftCharacterRuntime(modelParsed.document, skins, clips);
  runtime.update(0, idle);
  const skin = modelParsed.document.skins?.[0];
  const jointNames = (skin?.joints || []).map(nodeIndex => modelParsed.document.nodes?.[nodeIndex]?.name || `joint-${nodeIndex}`);
  return {
    primitives: built.primitives,
    runtime,
    clips: clipNames,
    defaultClips: { idle, walk },
    rig: {
      skinName: skin?.name || 'Armature', jointCount: jointNames.length, jointNames, authoredForward: '+Z',
      feetAtY: built.bounds.minY * built.renderScale, sourceHeight: built.sourceHeight, renderHeight: TARGET_HEIGHT, renderScale: built.renderScale,
      textured: textureIndices.length > 0, animationClipCount: clipNames.length, animationReady: clipNames.length > 0
    },
    materials: built.primitives.map(entry => entry.material.name)
  };
}

// Backward-compatible diagnostic helper. Runtime gameplay should use loadRiggedCharacterAsset so textures and animation are preserved.
export async function loadRiggedCharacterGeometry(url = '/assets/characters/quaternius/universal-base-male.glb') {
  const asset = await loadRiggedCharacterAsset(url);
  return { geometry: asset.primitives[0]?.geometry, rig: asset.rig, materials: asset.materials };
}
