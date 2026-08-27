import { mat4FromTRS, mat4LookAt, mat4Perspective, normalize3 } from './rift-engine-math.js';
import { createBoxGeometry, createCylinderGeometry, createSphereGeometry } from './rift-engine-geometry.js';

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vWorldPosition;
out vec3 vNormal;
void main(){
  vec4 world = uModel * vec4(aPosition,1.0);
  vWorldPosition = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uProjection * uView * world;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorldPosition;
in vec3 vNormal;
uniform vec3 uColor;
uniform vec3 uLightDirection;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uNoise;
uniform vec3 uCameraPosition;
out vec4 outColor;
float hash21(vec2 p){
  p = fract(p * vec2(123.34,456.21));
  p += dot(p,p+45.32);
  return fract(p.x*p.y);
}
void main(){
  vec3 normal = normalize(vNormal);
  float diffuse = max(dot(normal, normalize(-uLightDirection)), 0.0);
  float noise = (hash21(vWorldPosition.xz * 3.1) - 0.5) * uNoise;
  vec3 base = clamp(uColor + vec3(noise), 0.0, 1.0);
  vec3 lit = base * (0.56 + diffuse * 0.58);
  float distanceToCamera = distance(vWorldPosition, uCameraPosition);
  float fog = smoothstep(uFogStart, uFogEnd, distanceToCamera);
  outColor = vec4(mix(lit, uFogColor, fog), 1.0);
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

function uploadGeometry(gl, source) {
  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, source.vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, source.indices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  gl.bindVertexArray(null);
  return { vao, vertexBuffer, indexBuffer, count: source.indices.length };
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
      cameraPosition: gl.getUniformLocation(this.program, 'uCameraPosition')
    };
    this.geometry = {
      box: uploadGeometry(gl, createBoxGeometry()),
      cylinder8: uploadGeometry(gl, createCylinderGeometry(8)),
      sphere: uploadGeometry(gl, createSphereGeometry(10, 6))
    };
    this.drawables = [];
    this.projection = new Float32Array(16);
    this.view = new Float32Array(16);
    this.modelScratch = new Float32Array(16);
    this.clearColor = options.clearColor || [0.105, 0.135, 0.17];
    this.fogColor = options.fogColor || this.clearColor;
    this.fogStart = options.fogStart ?? 62;
    this.fogEnd = options.fogEnd ?? 150;
    this.lightDirection = normalize3(-0.48, -1, 0.32);
    this.pixelRatio = 1;
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

  addDrawable(geometry, options = {}) {
    const drawable = {
      geometry,
      position: options.position ? [...options.position] : [0, 0, 0],
      scale: options.scale ? [...options.scale] : [1, 1, 1],
      rotationY: options.rotationY || 0,
      color: Array.isArray(options.color) ? [...options.color] : hexToRgb(options.color || '#ffffff'),
      noise: options.noise || 0,
      visible: options.visible !== false,
      modelMatrix: new Float32Array(16),
      dynamic: !!options.dynamic,
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
    for (const drawable of this.drawables) {
      if (!drawable.visible) continue;
      if (drawable.dirty) {
        mat4FromTRS(drawable.modelMatrix, drawable.position, drawable.rotationY, drawable.scale);
        drawable.dirty = false;
      }
      const mesh = this.geometry[drawable.geometry];
      if (!mesh) continue;
      if (currentGeometry !== mesh) {
        gl.bindVertexArray(mesh.vao);
        currentGeometry = mesh;
      }
      gl.uniformMatrix4fv(this.uniforms.model, false, drawable.modelMatrix);
      gl.uniform3fv(this.uniforms.color, drawable.color);
      gl.uniform1f(this.uniforms.noise, drawable.noise);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }
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
