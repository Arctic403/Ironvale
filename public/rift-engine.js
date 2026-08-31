const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vColor = aColor;
  gl_Position = uProjection * uView * world;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorld;
uniform vec3 uLightDirection;
uniform vec3 uFogColor;
uniform vec3 uCamera;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uTint;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  float diffuse = max(dot(n, normalize(-uLightDirection)), 0.0);
  float hemi = n.y * 0.18 + 0.42;
  float light = 0.38 + diffuse * 0.48 + hemi;
  vec3 base = vColor * uTint;
  vec3 lit = base * light;
  float distanceToCamera = distance(vWorld, uCamera);
  float fog = smoothstep(uFogNear, uFogFar, distanceToCamera);
  outColor = vec4(mix(lit, uFogColor, fog), 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Shader compile failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}
function createProgram(gl) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Program link failed';
    gl.deleteProgram(program); throw new Error(message);
  }
  return program;
}
function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2); out.fill(0);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far); out[11] = -1; out[14] = (2 * far * near) / (near - far); return out;
}
function lookAt(out, eye, target, up = [0, 1, 0]) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let length = Math.hypot(zx, zy, zz) || 1; zx /= length; zy /= length; zz /= length;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  length = Math.hypot(xx, xy, xz) || 1; xx /= length; xy /= length; xz /= length;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0]=xx;out[1]=yx;out[2]=zx;out[3]=0;out[4]=xy;out[5]=yy;out[6]=zy;out[7]=0;out[8]=xz;out[9]=yz;out[10]=zz;out[11]=0;
  out[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);out[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);out[15]=1; return out;
}
function modelMatrix(out, position, yaw, scale) {
  const c=Math.cos(yaw||0),s=Math.sin(yaw||0),sx=scale?.[0]??1,sy=scale?.[1]??1,sz=scale?.[2]??1;
  out[0]=c*sx;out[1]=0;out[2]=-s*sx;out[3]=0;out[4]=0;out[5]=sy;out[6]=0;out[7]=0;out[8]=s*sz;out[9]=0;out[10]=c*sz;out[11]=0;
  out[12]=position?.[0]||0;out[13]=position?.[1]||0;out[14]=position?.[2]||0;out[15]=1; return out;
}
function normalizeGeometry(geometry) {
  if (!geometry) throw new Error('Mesh geometry is required');
  const vertices=geometry.vertices instanceof Float32Array?geometry.vertices:new Float32Array(geometry.vertices||[]);
  const stride=Math.trunc(Number(geometry.vertexStride)||9);
  if(stride<9||vertices.length%stride!==0) throw new Error('Rift mesh vertices must use a >=9 float stride');
  const indices=geometry.indices instanceof Uint32Array||geometry.indices instanceof Uint16Array?geometry.indices:(vertices.length/stride>65535?new Uint32Array(geometry.indices||[]):new Uint16Array(geometry.indices||[]));
  return {vertices,indices,stride};
}

export class RiftEngine {
  constructor(canvas, options = {}) {
    this.canvas=canvas;
    this.gl=canvas.getContext('webgl2',{antialias:options.antialias!==false,alpha:false,depth:true,powerPreference:'high-performance'});
    if(!this.gl) throw new Error('WebGL2 is required for Rift Engine');
    const gl=this.gl; this.program=createProgram(gl); this.meshes=new Set(); this.projection=new Float32Array(16); this.view=new Float32Array(16); this.model=new Float32Array(16);
    this.camera={position:[160,22,178],target:[160,10,160],fov:Math.PI/3,near:0.08,far:650};
    this.environment={clear:options.clear||[0.56,0.72,0.86],fog:options.fog||[0.64,0.75,0.82],fogNear:120,fogFar:420,light:[0.45,-1,0.28]};
    this.locations={projection:gl.getUniformLocation(this.program,'uProjection'),view:gl.getUniformLocation(this.program,'uView'),model:gl.getUniformLocation(this.program,'uModel'),light:gl.getUniformLocation(this.program,'uLightDirection'),fogColor:gl.getUniformLocation(this.program,'uFogColor'),fogNear:gl.getUniformLocation(this.program,'uFogNear'),fogFar:gl.getUniformLocation(this.program,'uFogFar'),camera:gl.getUniformLocation(this.program,'uCamera'),tint:gl.getUniformLocation(this.program,'uTint')};
    gl.enable(gl.DEPTH_TEST);
    // Terrain caves need to be visible from inside and outside; no voxel-face culling assumptions.
    gl.disable(gl.CULL_FACE);
  }
  addMesh(geometry, options={}) {
    const mesh={position:[...(options.position||[0,0,0])],scale:[...(options.scale||[1,1,1])],yaw:Number(options.yaw)||0,tint:[...(options.tint||[1,1,1])],visible:options.visible!==false,vao:null,vertexBuffer:null,indexBuffer:null,count:0,indexType:null,stride:9};
    this._upload(mesh,geometry);this.meshes.add(mesh);return mesh;
  }
  updateMesh(mesh,geometry){if(this.meshes.has(mesh))this._upload(mesh,geometry)}
  removeMesh(mesh){if(!this.meshes.delete(mesh))return;this._disposeMesh(mesh)}
  _upload(mesh,geometry){const gl=this.gl,data=normalizeGeometry(geometry);if(mesh.vao)this._disposeMesh(mesh);mesh.vao=gl.createVertexArray();mesh.vertexBuffer=gl.createBuffer();mesh.indexBuffer=gl.createBuffer();mesh.count=data.indices.length;mesh.indexType=data.indices instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT;mesh.stride=data.stride;gl.bindVertexArray(mesh.vao);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,data.vertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);const bytes=data.stride*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,bytes,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,bytes,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,bytes,24);gl.bindVertexArray(null)}
  _disposeMesh(mesh){const gl=this.gl;if(mesh.vertexBuffer)gl.deleteBuffer(mesh.vertexBuffer);if(mesh.indexBuffer)gl.deleteBuffer(mesh.indexBuffer);if(mesh.vao)gl.deleteVertexArray(mesh.vao);mesh.vertexBuffer=mesh.indexBuffer=mesh.vao=null}
  setCamera(camera){if(camera.position)this.camera.position=[...camera.position];if(camera.target)this.camera.target=[...camera.target];if(Number.isFinite(camera.fov))this.camera.fov=camera.fov;if(Number.isFinite(camera.near))this.camera.near=camera.near;if(Number.isFinite(camera.far))this.camera.far=camera.far}
  resize(pixelRatio=Math.min(devicePixelRatio||1,2)){const width=Math.max(1,Math.round(this.canvas.clientWidth*pixelRatio)),height=Math.max(1,Math.round(this.canvas.clientHeight*pixelRatio));if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height}this.gl.viewport(0,0,width,height)}
  render(){const gl=this.gl;this.resize();const aspect=this.canvas.width/Math.max(1,this.canvas.height);perspective(this.projection,this.camera.fov,aspect,this.camera.near,this.camera.far);lookAt(this.view,this.camera.position,this.camera.target);const clear=this.environment.clear;gl.clearColor(clear[0],clear[1],clear[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.locations.projection,false,this.projection);gl.uniformMatrix4fv(this.locations.view,false,this.view);gl.uniform3fv(this.locations.light,this.environment.light);gl.uniform3fv(this.locations.fogColor,this.environment.fog);gl.uniform1f(this.locations.fogNear,this.environment.fogNear);gl.uniform1f(this.locations.fogFar,this.environment.fogFar);gl.uniform3fv(this.locations.camera,this.camera.position);for(const mesh of this.meshes){if(!mesh.visible||!mesh.count)continue;modelMatrix(this.model,mesh.position,mesh.yaw,mesh.scale);gl.uniformMatrix4fv(this.locations.model,false,this.model);gl.uniform3fv(this.locations.tint,mesh.tint);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,mesh.indexType,0)}gl.bindVertexArray(null)}
  destroy(){for(const mesh of [...this.meshes])this.removeMesh(mesh);this.gl.deleteProgram(this.program);this.meshes.clear()}
}
