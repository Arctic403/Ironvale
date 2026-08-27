import { mat4FromTRS, mat4LookAt, mat4Perspective, normalize3 } from './rift-engine-math.js';
import { createBoxGeometry, createCylinderGeometry, createSphereGeometry } from './rift-engine-geometry.js';

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aVertexColor;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vWorldPosition;
out vec3 vNormal;
out vec3 vVertexColor;
void main(){
  vec4 world = uModel * vec4(aPosition,1.0);
  vWorldPosition = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vVertexColor = aVertexColor;
  gl_Position = uProjection * uView * world;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vVertexColor;
uniform vec3 uColor;
uniform vec3 uLightDirection;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uNoise;
uniform float uBlockGrid;
uniform float uBlockFaceShade;
uniform float uBlockElevationCue;
uniform float uBlockElevationBase;
uniform vec3 uCameraPosition;
out vec4 outColor;
float stableVariation(vec2 p){
  float broad = sin(p.x * 0.29 + sin(p.y * 0.13) * 0.8);
  float cross = cos(p.y * 0.23 - p.x * 0.09);
  return broad * 0.62 + cross * 0.38;
}
float riftBlockFaceShade(vec3 n){
  vec3 an = abs(n);
  if(an.y >= an.x && an.y >= an.z) return n.y >= 0.0 ? 1.00 : 0.52;
  if(an.x >= an.z) return n.x >= 0.0 ? 0.74 : 0.68;
  return n.z >= 0.0 ? 0.86 : 0.80;
}
float riftBlockElevationShade(vec3 n, float worldY){
  if(uBlockElevationCue <= 0.001 || n.y <= 0.65) return 1.0;
  float metersAboveBase = max(worldY - uBlockElevationBase, 0.0);
  return 1.0 + min(metersAboveBase * uBlockElevationCue, 0.12);
}
void main(){
  vec3 normal = normalize(vNormal);
  float diffuse = max(dot(normal, normalize(-uLightDirection)), 0.0);
  float variation = stableVariation(vWorldPosition.xz) * uNoise;
  vec3 base = clamp(uColor * vVertexColor * (1.0 + variation), 0.0, 1.0);
  if(uBlockGrid > 0.001){
    vec3 an = abs(normal);
    vec2 uv = an.y > 0.65 ? vWorldPosition.xz : (an.x > an.z ? vWorldPosition.zy : vWorldPosition.xy);
    vec2 cell = abs(fract(uv) - 0.5);
    vec2 width = max(fwidth(uv) * 1.15, vec2(0.012));
    float seam = max(smoothstep(0.46 - width.x, 0.49, cell.x), smoothstep(0.46 - width.y, 0.49, cell.y));
    base *= mix(1.0, 0.72, seam * clamp(uBlockGrid, 0.0, 1.0));
  }
  float directionalLight = 0.59 + diffuse * 0.52;
  float blockFaceLight = riftBlockFaceShade(normal);
  float faceMix = clamp(uBlockFaceShade, 0.0, 1.0);
  float elevationLight = mix(1.0, riftBlockElevationShade(normal, vWorldPosition.y), faceMix);
  vec3 lit = base * mix(directionalLight, blockFaceLight, faceMix) * elevationLight;
  float distanceToCamera = distance(vWorldPosition, uCameraPosition);
  float fog = smoothstep(uFogStart, uFogEnd, distanceToCamera);
  vec3 finalColor = mix(lit, uFogColor, fog);
  outColor = vec4(finalColor, 1.0);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(`Rift Engine shader compile failed: ${info}`);
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown shader link error';
    gl.deleteProgram(program);
    throw new Error(`Rift Engine shader link failed: ${info}`);
  }
  return program;
}

function normalizeGeometrySource(source) {
  if (!source?.vertices || !source?.indices) throw new Error('Custom geometry requires vertices and indices.');

  const rawVertices = source.vertices instanceof Float32Array ? source.vertices : new Float32Array(source.vertices);
  const sourceStride = Math.trunc(Number(source.vertexStride) || 6);
  if (sourceStride !== 6 && sourceStride !== 9) {
    throw new Error(`Rift Engine geometry vertexStride ${sourceStride} is unsupported; expected 6 or 9 floats.`);
  }
  if (rawVertices.length % sourceStride !== 0) {
    throw new Error(`Rift Engine geometry vertex data length ${rawVertices.length} is not divisible by stride ${sourceStride}.`);
  }

  let vertices = rawVertices;
  if (sourceStride === 6) {
    const count = rawVertices.length / 6;
    vertices = new Float32Array(count * 9);
    for (let i = 0; i < count; i += 1) {
      const sourceOffset = i * 6;
      const targetOffset = i * 9;
      vertices[targetOffset] = rawVertices[sourceOffset];
      vertices[targetOffset + 1] = rawVertices[sourceOffset + 1];
      vertices[targetOffset + 2] = rawVertices[sourceOffset + 2];
      vertices[targetOffset + 3] = rawVertices[sourceOffset + 3];
      vertices[targetOffset + 4] = rawVertices[sourceOffset + 4];
      vertices[targetOffset + 5] = rawVertices[sourceOffset + 5];
      vertices[targetOffset + 6] = 1;
      vertices[targetOffset + 7] = 1;
      vertices[targetOffset + 8] = 1;
    }
  }

  let indices = source.indices;
  if (!(indices instanceof Uint16Array) && !(indices instanceof Uint32Array)) {
    let maxIndex = 0;
    for (const index of indices) maxIndex = Math.max(maxIndex, Number(index) || 0);
    indices = maxIndex > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  }
  return { vertices, indices, vertexStride: 9 };
}

function uploadGeometry(gl, rawSource) {
  const source = normalizeGeometrySource(rawSource);
  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, source.vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, source.indices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
  gl.bindVertexArray(null);
  return {
    vao,
    vertexBuffer,
    indexBuffer,
    count: source.indices.length,
    indexType: source.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
  };
}

function hexToRgb(hex) {
  const clean = String(hex).replace('#','');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const number = Number.parseInt(full, 16);
  return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
}

export class RiftCamera {
  constructor(options = {}) {
    this.alpha = options.alpha ?? Math.PI / 2;
    this.beta = options.beta ?? 1.02;
    this.radius = options.radius ?? 12.5;
    this.minRadius = options.minRadius ?? 7;
    this.maxRadius = options.maxRadius ?? 19;
    this.minBeta = options.minBeta ?? 0.62;
    this.maxBeta = options.maxBeta ?? 1.28;
    this.target = [0, 1.35, 0];
    this.position = [0, 0, 0];
    this.fov = options.fov ?? Math.PI / 3.25;
    this.near = options.near ?? 0.08;
    this.far = options.far ?? 220;
    this.updatePosition();
  }

  updatePosition() {
    const sinBeta = Math.sin(this.beta);
    this.position[0] = this.target[0] + this.radius * sinBeta * Math.cos(this.alpha);
    this.position[1] = this.target[1] + this.radius * Math.cos(this.beta);
    this.position[2] = this.target[2] + this.radius * sinBeta * Math.sin(this.alpha);
  }

  setTarget(x, y, z) {
    this.target[0] = x; this.target[1] = y; this.target[2] = z;
    this.updatePosition();
  }

  orbit(deltaAlpha, deltaBeta) {
    this.alpha += deltaAlpha;
    this.beta = Math.max(this.minBeta, Math.min(this.maxBeta, this.beta + deltaBeta));
    this.updatePosition();
  }

  zoom(delta) {
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius + delta));
    this.updatePosition();
  }

  flatForward() {
    return normalize3(this.target[0] - this.position[0], 0, this.target[2] - this.position[2]);
  }
}

export class RiftEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: options.antialias !== false,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('WebGL2 is unavailable on this device/browser.');
    this.gl = gl;
    this.program = createProgram(gl);
    this.uniforms = {
      projection: gl.getUniformLocation(this.program, 'uProjection'),
      view: gl.getUniformLocation(this.program, 'uView'),
      model: gl.getUniformLocation(this.program, 'uModel'),
      color: gl.getUniformLocation(this.program, 'uColor'),
      lightDirection: gl.getUniformLocation(this.program, 'uLightDirection'),
      fogColor: gl.getUniformLocation(this.program, 'uFogColor'),
      fogStart: gl.getUniformLocation(this.program, 'uFogStart'),
      fogEnd: gl.getUniformLocation(this.program, 'uFogEnd'),
      noise: gl.getUniformLocation(this.program, 'uNoise'),
      blockGrid: gl.getUniformLocation(this.program, 'uBlockGrid'),
      blockFaceShade: gl.getUniformLocation(this.program, 'uBlockFaceShade'),
      blockElevationCue: gl.getUniformLocation(this.program, 'uBlockElevationCue'),
      blockElevationBase: gl.getUniformLocation(this.program, 'uBlockElevationBase'),
      cameraPosition: gl.getUniformLocation(this.program, 'uCameraPosition')
    };
    this.geometry = {
      box: uploadGeometry(gl, createBoxGeometry()),
      cylinder8: uploadGeometry(gl, createCylinderGeometry(8)),
      sphere: uploadGeometry(gl, createSphereGeometry(10, 6))
    };
    this.drawables = [];
    this.customGeometryCounter = 1;
    this.projection = new Float32Array(16);
    this.view = new Float32Array(16);
    this.modelScratch = new Float32Array(16);
    this.clearColor = options.clearColor || [0.105, 0.135, 0.17];
    this.fogColor = options.fogColor || this.clearColor;
    this.fogStart = options.fogStart ?? 62;
    this.fogEnd = options.fogEnd ?? 150;
    this.lightDirection = normalize3(-0.48, -1, 0.32);
    this.pixelRatio = 1;
    this.lastFrameDraws = 0;
    this.contextAttributes = gl.getContextAttributes?.() || {};
    this.disposed = false;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
  }

  addBox(options) { return this.addDrawable('box', options); }
  addCylinder(options) { return this.addDrawable('cylinder8', options); }
  addSphere(options) { return this.addDrawable('sphere', options); }

  addMesh(source, options = {}) {
    const key = `custom-${this.customGeometryCounter++}`;
    this.geometry[key] = uploadGeometry(this.gl, source);
    const drawable = this.addDrawable(key, options);
    drawable.ownedGeometry = key;
    return drawable;
  }

  updateMesh(drawable, rawSource) {
    const key = drawable?.ownedGeometry || drawable?.geometry;
    const mesh = this.geometry[key];
    if (!mesh) throw new Error('Rift Engine updateMesh requires a live mesh drawable.');

    const source = normalizeGeometrySource(rawSource);
    const gl = this.gl;

    gl.bindVertexArray(mesh.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, source.vertices, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, source.indices, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);

    mesh.count = source.indices.length;
    mesh.indexType = source.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    return drawable;
  }

  deleteGeometry(key) {
    if (!key || key === 'box' || key === 'cylinder8' || key === 'sphere') return;
    const mesh = this.geometry[key];
    if (!mesh) return;
    const gl = this.gl;
    gl.deleteVertexArray(mesh.vao);
    gl.deleteBuffer(mesh.vertexBuffer);
    gl.deleteBuffer(mesh.indexBuffer);
    delete this.geometry[key];
  }

  addDrawable(geometry, options = {}) {
    const drawable = {
      geometry,
      position: options.position ? [...options.position] : [0, 0, 0],
      scale: options.scale ? [...options.scale] : [1, 1, 1],
      rotationY: options.rotationY || 0,
      color: Array.isArray(options.color) ? [...options.color] : hexToRgb(options.color || '#ffffff'),
      noise: options.noise || 0,
      blockGrid: options.blockGrid || 0,
      blockFaceShade: options.blockFaceShade || 0,
      blockElevationCue: Math.max(0, Number(options.blockElevationCue) || 0),
      blockElevationBase: Number.isFinite(Number(options.blockElevationBase)) ? Number(options.blockElevationBase) : 0,
      visible: options.visible !== false,
      modelMatrix: new Float32Array(16),
      dynamic: !!options.dynamic,
      doubleSided: !!options.doubleSided,
      ownedGeometry: null,
      dirty: true
    };
    this.drawables.push(drawable);
    return drawable;
  }

  setTransform(drawable, position, rotationY, scale = drawable.scale) {
    drawable.position[0] = position[0]; drawable.position[1] = position[1]; drawable.position[2] = position[2];
    drawable.rotationY = rotationY;
    drawable.scale[0] = scale[0]; drawable.scale[1] = scale[1]; drawable.scale[2] = scale[2];
    drawable.dirty = true;
  }

  removeDrawable(drawable) {
    const index = this.drawables.indexOf(drawable);
    if (index < 0) return;
    this.drawables.splice(index, 1);
    if (drawable.ownedGeometry) this.deleteGeometry(drawable.ownedGeometry);
  }

  removeDrawables(drawables) {
    if (!drawables?.length) return;
    const removing = new Set(drawables);
    const owned = [];
    this.drawables = this.drawables.filter(drawable => {
      if (!removing.has(drawable)) return true;
      if (drawable.ownedGeometry) owned.push(drawable.ownedGeometry);
      return false;
    });
    for (const key of new Set(owned)) this.deleteGeometry(key);
  }

  getStats() {
    return {
      draws: this.lastFrameDraws,
      drawables: this.drawables.length,
      pixelRatio: this.pixelRatio,
      antialias: !!this.contextAttributes.antialias
    };
  }

  resize(targetPixelRatio = 1) {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.max(0.75, targetPixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.pixelRatio = ratio;
    this.gl.viewport(0, 0, width, height);
    return { width, height };
  }

  render(camera) {
    if (this.disposed) return;
    const gl = this.gl;
    const aspect = Math.max(0.01, this.canvas.width / Math.max(1, this.canvas.height));
    camera.updatePosition();
    mat4Perspective(this.projection, camera.fov, aspect, camera.near, camera.far);
    mat4LookAt(this.view, camera.position, camera.target);

    gl.clearColor(this.clearColor[0], this.clearColor[1], this.clearColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.projection, false, this.projection);
    gl.uniformMatrix4fv(this.uniforms.view, false, this.view);
    gl.uniform3fv(this.uniforms.lightDirection, this.lightDirection);
    gl.uniform3fv(this.uniforms.fogColor, this.fogColor);
    gl.uniform1f(this.uniforms.fogStart, this.fogStart);
    gl.uniform1f(this.uniforms.fogEnd, this.fogEnd);
    gl.uniform3fv(this.uniforms.cameraPosition, camera.position);

    let currentGeometry = null;
    let cullEnabled = true;
    let draws = 0;
    for (const drawable of this.drawables) {
      if (!drawable.visible) continue;
      if (drawable.dirty) {
        mat4FromTRS(drawable.modelMatrix, drawable.position, drawable.rotationY, drawable.scale);
        drawable.dirty = false;
      }
      const mesh = this.geometry[drawable.geometry];
      if (!mesh) continue;
      const wantsCull = !drawable.doubleSided;
      if (wantsCull !== cullEnabled) {
        if (wantsCull) gl.enable(gl.CULL_FACE);
        else gl.disable(gl.CULL_FACE);
        cullEnabled = wantsCull;
      }
      if (currentGeometry !== mesh) {
        gl.bindVertexArray(mesh.vao);
        currentGeometry = mesh;
      }
      gl.uniformMatrix4fv(this.uniforms.model, false, drawable.modelMatrix);
      gl.uniform3fv(this.uniforms.color, drawable.color);
      gl.uniform1f(this.uniforms.noise, drawable.noise);
      gl.uniform1f(this.uniforms.blockGrid, drawable.blockGrid || 0);
      gl.uniform1f(this.uniforms.blockFaceShade, drawable.blockFaceShade || 0);
      gl.uniform1f(this.uniforms.blockElevationCue, drawable.blockElevationCue || 0);
      gl.uniform1f(this.uniforms.blockElevationBase, drawable.blockElevationBase || 0);
      gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType || gl.UNSIGNED_SHORT, 0);
      draws += 1;
    }
    this.lastFrameDraws = draws;
    if (!cullEnabled) gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    for (const mesh of Object.values(this.geometry)) {
      gl.deleteVertexArray(mesh.vao);
      gl.deleteBuffer(mesh.vertexBuffer);
      gl.deleteBuffer(mesh.indexBuffer);
    }
    gl.deleteProgram(this.program);
    this.drawables.length = 0;
  }
}
