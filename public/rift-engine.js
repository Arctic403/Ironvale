const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in vec2 aUv;
layout(location=4) in vec4 aJoints;
layout(location=5) in vec4 aWeights;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform int uSkinned;
uniform sampler2D uJointMatrices;
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorld;
out vec2 vUv;

mat4 jointMatrix(float indexValue) {
  int row = int(indexValue + 0.5);
  return mat4(
    texelFetch(uJointMatrices, ivec2(0, row), 0),
    texelFetch(uJointMatrices, ivec2(1, row), 0),
    texelFetch(uJointMatrices, ivec2(2, row), 0),
    texelFetch(uJointMatrices, ivec2(3, row), 0)
  );
}

void main() {
  vec4 localPosition = vec4(aPosition, 1.0);
  vec3 localNormal = aNormal;
  if (uSkinned != 0) {
    mat4 skin =
      jointMatrix(aJoints.x) * aWeights.x +
      jointMatrix(aJoints.y) * aWeights.y +
      jointMatrix(aJoints.z) * aWeights.z +
      jointMatrix(aJoints.w) * aWeights.w;
    localPosition = skin * localPosition;
    localNormal = mat3(skin) * localNormal;
  }
  vec4 world = uModel * localPosition;
  vWorld = world.xyz;
  vNormal = normalize(mat3(uModel) * localNormal);
  vColor = aColor;
  vUv = aUv;
  gl_Position = uProjection * uView * world;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorld;
in vec2 vUv;
uniform vec3 uLightDirection;
uniform vec3 uFogColor;
uniform vec3 uCamera;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uTint;
uniform vec4 uBaseColorFactor;
uniform int uTextured;
uniform sampler2D uBaseColorTexture;
out vec4 outColor;
void main() {
  vec4 surface = uBaseColorFactor;
  if (uTextured != 0) surface *= texture(uBaseColorTexture, vUv);
  surface.rgb *= vColor * uTint;
  if (surface.a < 0.08) discard;
  vec3 n = normalize(vNormal);
  float diffuse = max(dot(n, normalize(-uLightDirection)), 0.0);
  float hemi = n.y * 0.18 + 0.42;
  float light = 0.38 + diffuse * 0.48 + hemi;
  vec3 lit = surface.rgb * light;
  float distanceToCamera = distance(vWorld, uCamera);
  float fog = smoothstep(uFogNear, uFogFar, distanceToCamera);
  outColor = vec4(mix(lit, uFogColor, fog), surface.a);
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
  return {vertices,indices,stride,attributes:geometry.attributes||{}};
}
function viewportMetrics(canvas, pixelRatio) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, Number(rect.width) || Number(canvas.clientWidth) || 1);
  const cssHeight = Math.max(1, Number(rect.height) || Number(canvas.clientHeight) || 1);
  const ratio = Math.max(0.5, Math.min(Number(pixelRatio) || 1, 2));
  const width = Math.max(1, Math.round(cssWidth * ratio));
  const height = Math.max(1, Math.round(cssHeight * ratio));
  return { rect, cssWidth, cssHeight, width, height, aspect: cssWidth / cssHeight, pixelRatio: ratio };
}

export class RiftEngine {
  constructor(canvas, options = {}) {
    this.canvas=canvas;
    this.gl=canvas.getContext('webgl2',{antialias:options.antialias!==false,alpha:false,depth:true,powerPreference:'high-performance'});
    if(!this.gl) throw new Error('WebGL2 is required for Rift Engine');
    const gl=this.gl; this.program=createProgram(gl); this.meshes=new Set(); this.textures=new Set(); this.skins=new Set(); this.projection=new Float32Array(16); this.view=new Float32Array(16); this.model=new Float32Array(16);
    this.camera={position:[160,22,178],target:[160,10,160],fov:Math.PI/3,near:0.08,far:650};
    this.environment={clear:options.clear||[0.56,0.72,0.86],fog:options.fog||[0.64,0.75,0.82],fogNear:120,fogFar:420,light:[0.45,-1,0.28]};
    this.viewport={rect:null,cssWidth:1,cssHeight:1,width:1,height:1,aspect:1,pixelRatio:1};
    this.locations={
      projection:gl.getUniformLocation(this.program,'uProjection'),view:gl.getUniformLocation(this.program,'uView'),model:gl.getUniformLocation(this.program,'uModel'),
      light:gl.getUniformLocation(this.program,'uLightDirection'),fogColor:gl.getUniformLocation(this.program,'uFogColor'),fogNear:gl.getUniformLocation(this.program,'uFogNear'),fogFar:gl.getUniformLocation(this.program,'uFogFar'),camera:gl.getUniformLocation(this.program,'uCamera'),tint:gl.getUniformLocation(this.program,'uTint'),
      baseColorFactor:gl.getUniformLocation(this.program,'uBaseColorFactor'),textured:gl.getUniformLocation(this.program,'uTextured'),baseColorTexture:gl.getUniformLocation(this.program,'uBaseColorTexture'),
      skinned:gl.getUniformLocation(this.program,'uSkinned'),jointMatrices:gl.getUniformLocation(this.program,'uJointMatrices')
    };
    this.whiteTexture=this._createWhiteTexture();
    gl.enable(gl.DEPTH_TEST);
    // Terrain caves and two-sided character materials need to remain visible from both sides.
    gl.disable(gl.CULL_FACE);
  }
  _createWhiteTexture(){
    const gl=this.gl,texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
    gl.bindTexture(gl.TEXTURE_2D,null);return texture;
  }
  createTexture(image,{srgb=true}={}){
    if(!image) return null;
    const gl=this.gl,texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D,0,srgb?gl.SRGB8_ALPHA8:gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.generateMipmap(gl.TEXTURE_2D);gl.bindTexture(gl.TEXTURE_2D,null);this.textures.add(texture);return texture;
  }
  destroyTexture(texture){if(!texture||!this.textures.delete(texture))return;this.gl.deleteTexture(texture)}
  createSkin(jointCount){
    const count=Math.max(1,Math.trunc(Number(jointCount)||0));
    const gl=this.gl,texture=gl.createTexture(),matrices=new Float32Array(count*16);
    for(let joint=0;joint<count;joint+=1){const o=joint*16;matrices[o]=matrices[o+5]=matrices[o+10]=matrices[o+15]=1}
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,count,0,gl.RGBA,gl.FLOAT,matrices);gl.bindTexture(gl.TEXTURE_2D,null);
    const skin={texture,jointCount:count,matrices};this.skins.add(skin);return skin;
  }
  updateSkin(skin,matrices){
    if(!skin||!this.skins.has(skin))return;
    const source=matrices instanceof Float32Array?matrices:new Float32Array(matrices||[]);
    if(source.length!==skin.jointCount*16)throw new Error(`Skin matrix payload expected ${skin.jointCount*16} floats, got ${source.length}.`);
    skin.matrices.set(source);const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,skin.texture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,4,skin.jointCount,gl.RGBA,gl.FLOAT,skin.matrices);gl.bindTexture(gl.TEXTURE_2D,null);
  }
  destroySkin(skin){if(!skin||!this.skins.delete(skin))return;this.gl.deleteTexture(skin.texture);skin.texture=null}
  addMesh(geometry, options={}) {
    const mesh={position:[...(options.position||[0,0,0])],scale:[...(options.scale||[1,1,1])],yaw:Number(options.yaw)||0,tint:[...(options.tint||[1,1,1])],baseColorFactor:[...(options.baseColorFactor||[1,1,1,1])],texture:options.texture||null,skin:options.skin||null,visible:options.visible!==false,vao:null,vertexBuffer:null,indexBuffer:null,count:0,indexType:null,stride:9,attributes:{}};
    this._upload(mesh,geometry);this.meshes.add(mesh);return mesh;
  }
  updateMesh(mesh,geometry){if(this.meshes.has(mesh))this._upload(mesh,geometry)}
  removeMesh(mesh){if(!this.meshes.delete(mesh))return;this._disposeMesh(mesh)}
  _upload(mesh,geometry){
    const gl=this.gl,data=normalizeGeometry(geometry);if(mesh.vao)this._disposeMesh(mesh);
    mesh.vao=gl.createVertexArray();mesh.vertexBuffer=gl.createBuffer();mesh.indexBuffer=gl.createBuffer();mesh.count=data.indices.length;mesh.indexType=data.indices instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT;mesh.stride=data.stride;mesh.attributes=data.attributes;
    gl.bindVertexArray(mesh.vao);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,data.vertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);
    const bytes=data.stride*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,bytes,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,bytes,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,bytes,24);
    if(Number.isInteger(data.attributes.uv)){gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,2,gl.FLOAT,false,bytes,data.attributes.uv*4)}else gl.disableVertexAttribArray(3);
    if(Number.isInteger(data.attributes.joints)){gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,4,gl.FLOAT,false,bytes,data.attributes.joints*4)}else gl.disableVertexAttribArray(4);
    if(Number.isInteger(data.attributes.weights)){gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,4,gl.FLOAT,false,bytes,data.attributes.weights*4)}else gl.disableVertexAttribArray(5);
    gl.bindVertexArray(null)
  }
  _disposeMesh(mesh){const gl=this.gl;if(mesh.vertexBuffer)gl.deleteBuffer(mesh.vertexBuffer);if(mesh.indexBuffer)gl.deleteBuffer(mesh.indexBuffer);if(mesh.vao)gl.deleteVertexArray(mesh.vao);mesh.vertexBuffer=mesh.indexBuffer=mesh.vao=null}
  setCamera(camera){if(camera.position)this.camera.position=[...camera.position];if(camera.target)this.camera.target=[...camera.target];if(Number.isFinite(camera.fov))this.camera.fov=camera.fov;if(Number.isFinite(camera.near))this.camera.near=camera.near;if(Number.isFinite(camera.far))this.camera.far=camera.far}
  resize(pixelRatio=Math.min(devicePixelRatio||1,2)){
    const viewport=viewportMetrics(this.canvas,pixelRatio);this.viewport=viewport;
    if(this.canvas.width!==viewport.width||this.canvas.height!==viewport.height){this.canvas.width=viewport.width;this.canvas.height=viewport.height}
    this.gl.viewport(0,0,viewport.width,viewport.height);return viewport
  }
  getViewport(){return this.viewport}
  render(){
    const gl=this.gl;const viewport=this.resize();const aspect=viewport.aspect;perspective(this.projection,this.camera.fov,aspect,this.camera.near,this.camera.far);lookAt(this.view,this.camera.position,this.camera.target);const clear=this.environment.clear;
    gl.clearColor(clear[0],clear[1],clear[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.locations.projection,false,this.projection);gl.uniformMatrix4fv(this.locations.view,false,this.view);gl.uniform3fv(this.locations.light,this.environment.light);gl.uniform3fv(this.locations.fogColor,this.environment.fog);gl.uniform1f(this.locations.fogNear,this.environment.fogNear);gl.uniform1f(this.locations.fogFar,this.environment.fogFar);gl.uniform3fv(this.locations.camera,this.camera.position);gl.uniform1i(this.locations.baseColorTexture,0);gl.uniform1i(this.locations.jointMatrices,1);
    gl.vertexAttrib2f(3,0,0);gl.vertexAttrib4f(4,0,0,0,0);gl.vertexAttrib4f(5,1,0,0,0);
    for(const mesh of this.meshes){
      if(!mesh.visible||!mesh.count)continue;modelMatrix(this.model,mesh.position,mesh.yaw,mesh.scale);gl.uniformMatrix4fv(this.locations.model,false,this.model);gl.uniform3fv(this.locations.tint,mesh.tint);gl.uniform4fv(this.locations.baseColorFactor,mesh.baseColorFactor);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,mesh.texture||this.whiteTexture);gl.uniform1i(this.locations.textured,mesh.texture?1:0);
      const skinned=Boolean(mesh.skin?.texture&&Number.isInteger(mesh.attributes?.joints)&&Number.isInteger(mesh.attributes?.weights));gl.uniform1i(this.locations.skinned,skinned?1:0);if(skinned){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mesh.skin.texture)}
      gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,mesh.indexType,0)
    }
    gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null)
  }
  destroy(){
    for(const mesh of [...this.meshes])this.removeMesh(mesh);for(const skin of [...this.skins])this.destroySkin(skin);for(const texture of [...this.textures])this.destroyTexture(texture);if(this.whiteTexture)this.gl.deleteTexture(this.whiteTexture);this.whiteTexture=null;this.gl.deleteProgram(this.program);this.meshes.clear()
  }
}
