const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in vec2 aUv;
layout(location=4) in vec4 aJoints;
layout(location=5) in vec4 aWeights;
layout(location=6) in vec4 aTerrainWeights0;
layout(location=7) in vec2 aTerrainWeights1;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform int uSkinned;
uniform sampler2D uJointMatrices;
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorld;
out vec2 vUv;
out vec4 vTerrainWeights0;
out vec2 vTerrainWeights1;

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
  vTerrainWeights0 = aTerrainWeights0;
  vTerrainWeights1 = aTerrainWeights1;
  gl_Position = uProjection * uView * world;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler2DArray;
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorld;
in vec2 vUv;
in vec4 vTerrainWeights0;
in vec2 vTerrainWeights1;
uniform vec3 uLightDirection;
uniform vec3 uFogColor;
uniform vec3 uCamera;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uTint;
uniform vec4 uBaseColorFactor;
uniform int uTextured;
uniform sampler2D uBaseColorTexture;
uniform int uTerrainMaterial;
uniform int uTerrainLayerCount;
uniform sampler2DArray uTerrainAlbedoArray;
uniform sampler2DArray uTerrainNormalArray;
uniform sampler2DArray uTerrainRoughnessArray;
uniform float uTerrainTileMeters[6];
out vec4 outColor;

float terrainWeight(int index) {
  if (index == 0) return vTerrainWeights0.x;
  if (index == 1) return vTerrainWeights0.y;
  if (index == 2) return vTerrainWeights0.z;
  if (index == 3) return vTerrainWeights0.w;
  if (index == 4) return vTerrainWeights1.x;
  if (index == 5) return vTerrainWeights1.y;
  return 0.0;
}

void main() {
  vec4 surface = uBaseColorFactor;
  vec3 shadingNormal = normalize(vNormal);
  float roughness = 0.82;

  if (uTerrainMaterial != 0) {
    vec3 albedo = vec3(0.0);
    vec3 tangentNormal = vec3(0.0);
    float rough = 0.0;
    float weightTotal = 0.0;
    for (int layer = 0; layer < 6; layer += 1) {
      if (layer >= uTerrainLayerCount) break;
      float weight = max(0.0, terrainWeight(layer));
      if (weight <= 0.0001) continue;
      float tileMeters = max(0.5, uTerrainTileMeters[layer]);
      vec2 tileUv = vWorld.xz / tileMeters;
      albedo += texture(uTerrainAlbedoArray, vec3(tileUv, float(layer))).rgb * weight;
      tangentNormal += (texture(uTerrainNormalArray, vec3(tileUv, float(layer))).xyz * 2.0 - 1.0) * weight;
      rough += texture(uTerrainRoughnessArray, vec3(tileUv, float(layer))).r * weight;
      weightTotal += weight;
    }
    if (weightTotal > 0.0001) {
      albedo /= weightTotal;
      tangentNormal /= weightTotal;
      roughness = clamp(rough / weightTotal, 0.04, 1.0);
      vec3 n = normalize(vNormal);
      vec3 tangent = vec3(1.0, 0.0, 0.0) - n * dot(n, vec3(1.0, 0.0, 0.0));
      if (dot(tangent, tangent) < 0.0001) tangent = vec3(0.0, 0.0, 1.0) - n * dot(n, vec3(0.0, 0.0, 1.0));
      tangent = normalize(tangent);
      vec3 bitangent = normalize(cross(n, tangent));
      shadingNormal = normalize(tangent * tangentNormal.x + bitangent * tangentNormal.y + n * max(0.05, tangentNormal.z));
      surface = vec4(albedo * vColor * uTint, 1.0);
    } else {
      surface.rgb *= vColor * uTint;
    }
  } else {
    if (uTextured != 0) surface *= texture(uBaseColorTexture, vUv);
    surface.rgb *= vColor * uTint;
  }

  if (surface.a < 0.08) discard;
  vec3 n = normalize(shadingNormal);
  vec3 lightDirection = normalize(-uLightDirection);
  float diffuse = max(dot(n, lightDirection), 0.0);
  float hemi = n.y * 0.18 + 0.42;
  float light = 0.38 + diffuse * 0.48 + hemi;
  vec3 viewDirection = normalize(uCamera - vWorld);
  vec3 halfVector = normalize(lightDirection + viewDirection);
  float specPower = mix(54.0, 7.0, roughness);
  float specular = pow(max(dot(n, halfVector), 0.0), specPower) * (1.0 - roughness) * 0.22;
  vec3 lit = surface.rgb * light + vec3(specular);
  float distanceToCamera = distance(vWorld, uCamera);
  float fog = smoothstep(uFogNear, uFogFar, distanceToCamera);
  outColor = vec4(mix(lit, uFogColor, fog), surface.a);
}`;

export const RIFT_ENGINE_TELEMETRY_FORMAT = 'rift-engine-telemetry-v1';
const ENGINE_BOOT_TELEMETRY = {
  format: RIFT_ENGINE_TELEMETRY_FORMAT,
  shaders: { vertex: null, fragment: null },
  program: null
};

function shaderFingerprint(source) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function glErrorName(gl, code) {
  const pairs = [[gl.INVALID_ENUM,'INVALID_ENUM'],[gl.INVALID_VALUE,'INVALID_VALUE'],[gl.INVALID_OPERATION,'INVALID_OPERATION'],[gl.INVALID_FRAMEBUFFER_OPERATION,'INVALID_FRAMEBUFFER_OPERATION'],[gl.OUT_OF_MEMORY,'OUT_OF_MEMORY'],[gl.CONTEXT_LOST_WEBGL,'CONTEXT_LOST_WEBGL']];
  return pairs.find(([value]) => value === code)?.[1] || '0x' + Number(code).toString(16);
}
function mipEstimateBytes(width, height, layers = 1, bytesPerPixel = 4) { return Math.ceil(Math.max(1,width) * Math.max(1,height) * Math.max(1,layers) * bytesPerPixel * 4 / 3); }
export function getRiftEngineBootTelemetry() { return JSON.parse(JSON.stringify(ENGINE_BOOT_TELEMETRY)); }

function compile(gl, type, source) {
  const stage = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const ok = Boolean(gl.getShaderParameter(shader, gl.COMPILE_STATUS));
  const log = gl.getShaderInfoLog(shader) || '';
  ENGINE_BOOT_TELEMETRY.shaders[stage] = { ok, log, sourceLength: source.length, lines: source.split('\n').length, fingerprint: shaderFingerprint(source) };
  if (!ok) {
    gl.deleteShader(shader);
    throw new Error(log || stage + ' shader compile failed');
  }
  return shader;
}
function createProgram(gl) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  const linked = Boolean(gl.getProgramParameter(program, gl.LINK_STATUS));
  const log = gl.getProgramInfoLog(program) || '';
  ENGINE_BOOT_TELEMETRY.program = { linked, log, activeAttributes: linked ? gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) : null, activeUniforms: linked ? gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) : null };
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!linked) { gl.deleteProgram(program); throw new Error(log || 'Program link failed'); }
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
    const gl=this.gl; this.program=createProgram(gl); this.meshes=new Set(); this.textures=new Set(); this.textureInfo=new Map(); this.textureArrays=new Set(); this.skins=new Set(); this.projection=new Float32Array(16); this.view=new Float32Array(16); this.model=new Float32Array(16); this.pixelRatioCap=2; this._resourceSequence=1; this._telemetry={format:RIFT_ENGINE_TELEMETRY_FORMAT,createdAt:Date.now(),frameNumber:0,lastFrame:null,glErrors:[],contextEvents:[]}; this._contextLostHandler=()=>{this._telemetry.contextEvents.push({at:new Date().toISOString(),type:'lost'});}; this._contextRestoredHandler=()=>{this._telemetry.contextEvents.push({at:new Date().toISOString(),type:'restored'});}; canvas.addEventListener('webglcontextlost',this._contextLostHandler); canvas.addEventListener('webglcontextrestored',this._contextRestoredHandler);
    this.camera={position:[160,22,178],target:[160,10,160],fov:Math.PI/3,near:0.08,far:650};
    this.environment={clear:options.clear||[0.56,0.72,0.86],fog:options.fog||[0.64,0.75,0.82],fogNear:120,fogFar:420,light:[0.45,-1,0.28]};
    this.viewport={rect:null,cssWidth:1,cssHeight:1,width:1,height:1,aspect:1,pixelRatio:1};
    this.locations={
      projection:gl.getUniformLocation(this.program,'uProjection'),view:gl.getUniformLocation(this.program,'uView'),model:gl.getUniformLocation(this.program,'uModel'),
      light:gl.getUniformLocation(this.program,'uLightDirection'),fogColor:gl.getUniformLocation(this.program,'uFogColor'),fogNear:gl.getUniformLocation(this.program,'uFogNear'),fogFar:gl.getUniformLocation(this.program,'uFogFar'),camera:gl.getUniformLocation(this.program,'uCamera'),tint:gl.getUniformLocation(this.program,'uTint'),
      baseColorFactor:gl.getUniformLocation(this.program,'uBaseColorFactor'),textured:gl.getUniformLocation(this.program,'uTextured'),baseColorTexture:gl.getUniformLocation(this.program,'uBaseColorTexture'),
      skinned:gl.getUniformLocation(this.program,'uSkinned'),jointMatrices:gl.getUniformLocation(this.program,'uJointMatrices'),
      terrainMaterial:gl.getUniformLocation(this.program,'uTerrainMaterial'),terrainLayerCount:gl.getUniformLocation(this.program,'uTerrainLayerCount'),
      terrainAlbedoArray:gl.getUniformLocation(this.program,'uTerrainAlbedoArray'),terrainNormalArray:gl.getUniformLocation(this.program,'uTerrainNormalArray'),terrainRoughnessArray:gl.getUniformLocation(this.program,'uTerrainRoughnessArray'),
      terrainTileMeters:gl.getUniformLocation(this.program,'uTerrainTileMeters[0]')
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
    gl.generateMipmap(gl.TEXTURE_2D);gl.bindTexture(gl.TEXTURE_2D,null);this.textures.add(texture);const width=Math.max(1,Number(image.width||image.videoWidth)||1),height=Math.max(1,Number(image.height||image.videoHeight)||1);this.textureInfo.set(texture,{id:'tex-'+this._resourceSequence++,width,height,srgb:Boolean(srgb),format:srgb?'SRGB8_ALPHA8':'RGBA8',mipmapped:true,estimatedBytes:mipEstimateBytes(width,height)});return texture;
  }

  createTextureArray(width,height,layers,{srgb=false}={}){
    const gl=this.gl,w=Math.max(1,Math.trunc(width)),h=Math.max(1,Math.trunc(height)),depth=Math.max(1,Math.trunc(layers)),levels=Math.floor(Math.log2(Math.max(w,h)))+1;
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY,levels,srgb?gl.SRGB8_ALPHA8:gl.RGBA8,w,h,depth);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY,null);
    const resource={texture,width:w,height:h,layers:depth,levels,srgb:Boolean(srgb),format:srgb?'SRGB8_ALPHA8':'RGBA8',mipmapped:levels>1,diagnosticId:'tex-array-'+this._resourceSequence++,estimatedBytes:mipEstimateBytes(w,h,depth)};this.textureArrays.add(resource);return resource;
  }
  fillTextureArrayLayer(resource,layer,rgba){
    if(!resource||!this.textureArrays.has(resource))return;
    const index=Math.max(0,Math.min(resource.layers-1,Math.trunc(layer)));const color=rgba||[255,255,255,255];
    const pixels=new Uint8Array(resource.width*resource.height*4);
    for(let i=0;i<pixels.length;i+=4){pixels[i]=color[0]??255;pixels[i+1]=color[1]??255;pixels[i+2]=color[2]??255;pixels[i+3]=color[3]??255}
    const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D_ARRAY,resource.texture);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,index,resource.width,resource.height,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);gl.generateMipmap(gl.TEXTURE_2D_ARRAY);gl.bindTexture(gl.TEXTURE_2D_ARRAY,null);
  }
  updateTextureArrayLayer(resource,layer,image){
    if(!resource||!this.textureArrays.has(resource)||!image)return;
    const index=Math.max(0,Math.min(resource.layers-1,Math.trunc(layer)));const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D_ARRAY,resource.texture);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,index,resource.width,resource.height,1,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D_ARRAY);gl.bindTexture(gl.TEXTURE_2D_ARRAY,null);
  }
  destroyTextureArray(resource){if(!resource||!this.textureArrays.delete(resource))return;this.gl.deleteTexture(resource.texture);resource.texture=null}

  destroyTexture(texture){if(!texture||!this.textures.delete(texture))return;this.textureInfo.delete(texture);this.gl.deleteTexture(texture)}
  createSkin(jointCount){
    const count=Math.max(1,Math.trunc(Number(jointCount)||0));
    const gl=this.gl,texture=gl.createTexture(),matrices=new Float32Array(count*16);
    for(let joint=0;joint<count;joint+=1){const o=joint*16;matrices[o]=matrices[o+5]=matrices[o+10]=matrices[o+15]=1}
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,count,0,gl.RGBA,gl.FLOAT,matrices);gl.bindTexture(gl.TEXTURE_2D,null);
    const skin={texture,jointCount:count,matrices,diagnosticId:'skin-'+this._resourceSequence++,estimatedBytes:count*16*4};this.skins.add(skin);return skin;
  }
  updateSkin(skin,matrices){
    if(!skin||!this.skins.has(skin))return;
    const source=matrices instanceof Float32Array?matrices:new Float32Array(matrices||[]);
    if(source.length!==skin.jointCount*16)throw new Error(`Skin matrix payload expected ${skin.jointCount*16} floats, got ${source.length}.`);
    skin.matrices.set(source);const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,skin.texture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,4,skin.jointCount,gl.RGBA,gl.FLOAT,skin.matrices);gl.bindTexture(gl.TEXTURE_2D,null);
  }
  destroySkin(skin){if(!skin||!this.skins.delete(skin))return;this.gl.deleteTexture(skin.texture);skin.texture=null}
  addMesh(geometry, options={}) {
    const mesh={diagnosticId:String(options.diagnosticId||('mesh-'+this._resourceSequence++)),kind:String(options.kind||'mesh'),label:options.label==null?null:String(options.label),bounds:options.bounds||null,position:[...(options.position||[0,0,0])],scale:[...(options.scale||[1,1,1])],yaw:Number(options.yaw)||0,tint:[...(options.tint||[1,1,1])],baseColorFactor:[...(options.baseColorFactor||[1,1,1,1])],texture:options.texture||null,skin:options.skin||null,terrainMaterial:options.terrainMaterial||null,visible:options.visible!==false,vao:null,vertexBuffer:null,indexBuffer:null,count:0,indexType:null,stride:9,attributes:{},vertexCount:0,vertexBytes:0,indexBytes:0};
    this._upload(mesh,geometry);this.meshes.add(mesh);return mesh;
  }
  updateMesh(mesh,geometry){if(this.meshes.has(mesh))this._upload(mesh,geometry)}
  removeMesh(mesh){if(!this.meshes.delete(mesh))return;this._disposeMesh(mesh)}
  _upload(mesh,geometry){
    const gl=this.gl,data=normalizeGeometry(geometry);if(mesh.vao)this._disposeMesh(mesh);
    mesh.vao=gl.createVertexArray();mesh.vertexBuffer=gl.createBuffer();mesh.indexBuffer=gl.createBuffer();mesh.count=data.indices.length;mesh.indexType=data.indices instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT;mesh.stride=data.stride;mesh.attributes=data.attributes;mesh.vertexCount=data.vertices.length/data.stride;mesh.vertexBytes=data.vertices.byteLength;mesh.indexBytes=data.indices.byteLength;
    gl.bindVertexArray(mesh.vao);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,data.vertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);
    const bytes=data.stride*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,bytes,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,bytes,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,bytes,24);
    if(Number.isInteger(data.attributes.uv)){gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,2,gl.FLOAT,false,bytes,data.attributes.uv*4)}else gl.disableVertexAttribArray(3);
    if(Number.isInteger(data.attributes.joints)){gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,4,gl.FLOAT,false,bytes,data.attributes.joints*4)}else gl.disableVertexAttribArray(4);
    if(Number.isInteger(data.attributes.weights)){gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,4,gl.FLOAT,false,bytes,data.attributes.weights*4)}else gl.disableVertexAttribArray(5);
    if(Number.isInteger(data.attributes.terrainWeights0)){gl.enableVertexAttribArray(6);gl.vertexAttribPointer(6,4,gl.FLOAT,false,bytes,data.attributes.terrainWeights0*4)}else gl.disableVertexAttribArray(6);
    if(Number.isInteger(data.attributes.terrainWeights1)){gl.enableVertexAttribArray(7);gl.vertexAttribPointer(7,2,gl.FLOAT,false,bytes,data.attributes.terrainWeights1*4)}else gl.disableVertexAttribArray(7);
    gl.bindVertexArray(null)
  }
  _disposeMesh(mesh){const gl=this.gl;if(mesh.vertexBuffer)gl.deleteBuffer(mesh.vertexBuffer);if(mesh.indexBuffer)gl.deleteBuffer(mesh.indexBuffer);if(mesh.vao)gl.deleteVertexArray(mesh.vao);mesh.vertexBuffer=mesh.indexBuffer=mesh.vao=null}
  setCamera(camera){if(camera.position)this.camera.position=[...camera.position];if(camera.target)this.camera.target=[...camera.target];if(Number.isFinite(camera.fov))this.camera.fov=camera.fov;if(Number.isFinite(camera.near))this.camera.near=camera.near;if(Number.isFinite(camera.far))this.camera.far=camera.far}
  resize(pixelRatio=Math.min(devicePixelRatio||1,this.pixelRatioCap)){
    const viewport=viewportMetrics(this.canvas,Math.min(Number(pixelRatio)||1,this.pixelRatioCap));this.viewport=viewport;
    if(this.canvas.width!==viewport.width||this.canvas.height!==viewport.height){this.canvas.width=viewport.width;this.canvas.height=viewport.height}
    this.gl.viewport(0,0,viewport.width,viewport.height);return viewport
  }
  setPixelRatioCap(value){this.pixelRatioCap=Math.max(.75,Math.min(2,Number(value)||1));return this.pixelRatioCap}
  isSphereVisible(center,radius=1,padding=.08){
    const eye=this.camera.position,target=this.camera.target;
    let fx=target[0]-eye[0],fy=target[1]-eye[1],fz=target[2]-eye[2];let fl=Math.hypot(fx,fy,fz)||1;fx/=fl;fy/=fl;fz/=fl;
    let rx=fz,ry=0,rz=-fx;let rl=Math.hypot(rx,rz);if(rl<1e-4){rx=1;rz=0;rl=1}else{rx/=rl;rz/=rl}
    const ux=ry*fz-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy-ry*fx;
    const vx=(center?.[0]||0)-eye[0],vy=(center?.[1]||0)-eye[1],vz=(center?.[2]||0)-eye[2];
    const depth=vx*fx+vy*fy+vz*fz,r=Math.max(0,Number(radius)||0);
    if(depth+r<this.camera.near||depth-r>this.camera.far||depth<=-r)return false;
    const horizontal=vx*rx+vy*ry+vz*rz,vertical=vx*ux+vy*uy+vz*uz;
    const aspect=Math.max(.2,this.viewport?.aspect||((this.canvas.clientWidth||1)/(this.canvas.clientHeight||1)));
    const halfV=this.camera.fov*.5+padding,halfH=Math.atan(Math.tan(this.camera.fov*.5)*aspect)+padding;
    const inflate=Math.asin(Math.min(.95,r/Math.max(r+1e-4,Math.hypot(vx,vy,vz))));
    return Math.abs(Math.atan2(horizontal,Math.max(.001,depth)))<=halfH+inflate&&Math.abs(Math.atan2(vertical,Math.max(.001,depth)))<=halfV+inflate;
  }
  getViewport(){return this.viewport}
  render(){
    const renderStarted=performance.now();let drawCalls=0,triangles=0,indices=0,vertexBufferVertices=0,visibleMeshes=0;
    const gl=this.gl;const viewport=this.resize();const aspect=viewport.aspect;perspective(this.projection,this.camera.fov,aspect,this.camera.near,this.camera.far);lookAt(this.view,this.camera.position,this.camera.target);const clear=this.environment.clear;
    gl.clearColor(clear[0],clear[1],clear[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.locations.projection,false,this.projection);gl.uniformMatrix4fv(this.locations.view,false,this.view);gl.uniform3fv(this.locations.light,this.environment.light);gl.uniform3fv(this.locations.fogColor,this.environment.fog);gl.uniform1f(this.locations.fogNear,this.environment.fogNear);gl.uniform1f(this.locations.fogFar,this.environment.fogFar);gl.uniform3fv(this.locations.camera,this.camera.position);gl.uniform1i(this.locations.baseColorTexture,0);gl.uniform1i(this.locations.jointMatrices,1);gl.uniform1i(this.locations.terrainAlbedoArray,2);gl.uniform1i(this.locations.terrainNormalArray,3);gl.uniform1i(this.locations.terrainRoughnessArray,4);
    gl.vertexAttrib2f(3,0,0);gl.vertexAttrib4f(4,0,0,0,0);gl.vertexAttrib4f(5,1,0,0,0);gl.vertexAttrib4f(6,1,0,0,0);gl.vertexAttrib2f(7,0,0);
    for(const mesh of this.meshes){
      if(!mesh.visible||!mesh.count)continue;modelMatrix(this.model,mesh.position,mesh.yaw,mesh.scale);gl.uniformMatrix4fv(this.locations.model,false,this.model);gl.uniform3fv(this.locations.tint,mesh.tint);gl.uniform4fv(this.locations.baseColorFactor,mesh.baseColorFactor);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,mesh.texture||this.whiteTexture);gl.uniform1i(this.locations.textured,mesh.texture?1:0);
      const skinned=Boolean(mesh.skin?.texture&&Number.isInteger(mesh.attributes?.joints)&&Number.isInteger(mesh.attributes?.weights));gl.uniform1i(this.locations.skinned,skinned?1:0);if(skinned){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mesh.skin.texture)}
      const terrainMaterial=mesh.terrainMaterial;const terrainEnabled=Boolean(terrainMaterial?.albedoArray?.texture&&Number.isInteger(mesh.attributes?.terrainWeights0));gl.uniform1i(this.locations.terrainMaterial,terrainEnabled?1:0);
      if(terrainEnabled){
        gl.uniform1i(this.locations.terrainLayerCount,Math.max(1,Math.min(6,terrainMaterial.layerCount||1)));gl.uniform1fv(this.locations.terrainTileMeters,terrainMaterial.tileMeters);
        gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D_ARRAY,terrainMaterial.albedoArray.texture);
        gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D_ARRAY,terrainMaterial.normalArray.texture);
        gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,terrainMaterial.roughnessArray.texture);
      }
      gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,mesh.indexType,0);drawCalls+=1;visibleMeshes+=1;indices+=mesh.count;vertexBufferVertices+=mesh.vertexCount||0;triangles+=Math.floor(mesh.count/3)
    }
    gl.bindVertexArray(null);for(const unit of [4,3,2]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D_ARRAY,null)}gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
    this._telemetry.frameNumber+=1;this._telemetry.lastFrame={at:new Date().toISOString(),renderMs:performance.now()-renderStarted,drawCalls,visibleMeshes,triangles,indices,vertexBufferVertices,vertexMetricNote:'Unique vertex records in buffers submitted by visible indexed meshes; exact post-transform GPU invocations are not exposed by WebGL.'};if(this._telemetry.frameNumber%60===0)this._captureGlErrors('render');
  }
  _captureGlErrors(source='runtime'){
    const gl=this.gl;if(!gl||gl.isContextLost?.())return;for(let index=0;index<8;index+=1){const code=gl.getError();if(code===gl.NO_ERROR)break;this._telemetry.glErrors.push({at:new Date().toISOString(),source,code,name:glErrorName(gl,code)});}if(this._telemetry.glErrors.length>80)this._telemetry.glErrors.splice(0,this._telemetry.glErrors.length-80);
  }
  getDiagnostics(deep=false){
    const textureLookup=this.textureInfo;
    const meshes=[...this.meshes].map(mesh=>({id:mesh.diagnosticId,kind:mesh.kind,label:mesh.label,visible:Boolean(mesh.visible),position:[...mesh.position],yaw:mesh.yaw,scale:[...mesh.scale],bounds:mesh.bounds,vertexCount:mesh.vertexCount,indexCount:mesh.count,triangles:Math.floor(mesh.count/3),vertexBytes:mesh.vertexBytes,indexBytes:mesh.indexBytes,stride:mesh.stride,attributes:Object.keys(mesh.attributes||{}),textureId:textureLookup.get(mesh.texture)?.id||null,skinId:mesh.skin?.diagnosticId||null,terrainMaterial:Boolean(mesh.terrainMaterial),material:{baseColorFactor:[...mesh.baseColorFactor],tint:[...mesh.tint],textureId:textureLookup.get(mesh.texture)?.id||null,terrain:Boolean(mesh.terrainMaterial)}}));
    const textures=[...textureLookup.values()].map(info=>({...info}));
    const textureArrays=[...this.textureArrays].map(resource=>({id:resource.diagnosticId,width:resource.width,height:resource.height,layers:resource.layers,levels:resource.levels,srgb:resource.srgb,format:resource.format|| (resource.srgb?'SRGB8_ALPHA8':'RGBA8'),mipmapped:resource.mipmapped!==false,estimatedBytes:resource.estimatedBytes}));
    const skins=[...this.skins].map(skin=>({id:skin.diagnosticId,jointCount:skin.jointCount,estimatedBytes:skin.estimatedBytes}));
    const meshBytes=meshes.reduce((sum,item)=>sum+(item.vertexBytes||0)+(item.indexBytes||0),0),textureBytes=textures.reduce((sum,item)=>sum+(item.estimatedBytes||0),0),arrayBytes=textureArrays.reduce((sum,item)=>sum+(item.estimatedBytes||0),0),skinBytes=skins.reduce((sum,item)=>sum+(item.estimatedBytes||0),0);
    const program={linked:Boolean(this.gl.getProgramParameter(this.program,this.gl.LINK_STATUS)),activeAttributes:this.gl.getProgramParameter(this.program,this.gl.ACTIVE_ATTRIBUTES),activeUniforms:this.gl.getProgramParameter(this.program,this.gl.ACTIVE_UNIFORMS)};
    if(deep){program.attributes=[];program.uniforms=[];for(let i=0;i<program.activeAttributes;i+=1){const info=this.gl.getActiveAttrib(this.program,i);if(info)program.attributes.push({name:info.name,size:info.size,type:info.type});}for(let i=0;i<program.activeUniforms;i+=1){const info=this.gl.getActiveUniform(this.program,i);if(info)program.uniforms.push({name:info.name,size:info.size,type:info.type});}}
    return {format:RIFT_ENGINE_TELEMETRY_FORMAT,boot:getRiftEngineBootTelemetry(),frameNumber:this._telemetry.frameNumber,lastFrame:this._telemetry.lastFrame,camera:{...this.camera,position:[...this.camera.position],target:[...this.camera.target]},environment:{...this.environment},viewport:{...this.viewport,rect:null},pixelRatioCap:this.pixelRatioCap,program,contextLost:Boolean(this.gl.isContextLost?.()),contextEvents:[...this._telemetry.contextEvents],glErrors:[...this._telemetry.glErrors],resources:{meshes:meshes.length,textures2D:textures.length,textureArrays:textureArrays.length,skins:skins.length,gpuMemoryEstimate:{meshBuffers:meshBytes,textures2D:textureBytes,textureArrays:arrayBytes,skins:skinBytes,total:meshBytes+textureBytes+arrayBytes+skinBytes,note:'Estimated logical GPU resource bytes only; WebGL does not expose exact physical GPU allocation.'}},...(deep?{inventory:{meshes,textures2D:textures,textureArrays,skins}}:{})};
  }
  destroy(){
    this.canvas.removeEventListener('webglcontextlost',this._contextLostHandler);this.canvas.removeEventListener('webglcontextrestored',this._contextRestoredHandler);for(const mesh of [...this.meshes])this.removeMesh(mesh);for(const skin of [...this.skins])this.destroySkin(skin);for(const texture of [...this.textures])this.destroyTexture(texture);for(const textureArray of [...this.textureArrays])this.destroyTextureArray(textureArray);if(this.whiteTexture)this.gl.deleteTexture(this.whiteTexture);this.whiteTexture=null;this.gl.deleteProgram(this.program);this.meshes.clear();this.textureInfo.clear()
  }
}
