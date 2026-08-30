import { RiftEngine } from './rift-engine.js';
import { RIFT_TEXTURE_ATLAS_COLUMNS, RIFT_TEXTURE_ATLAS_ROWS } from './rift-texture-atlas.js';

const PATCH = Symbol.for('riftcity.renderQuality.h1.87');
const KEY = 'riftcity:graphics:h1.84:v1';
const DEFAULTS = Object.freeze({
  quality: 'high',
  resolution: 'auto',
  materialMode: 'realistic',
  waterMotion: true,
  grassMotion: true,
  showFps: false
});
const CAPS = Object.freeze({ performance: 0.9, balanced: 1.15, high: 1.55, ultra: 1.9 });
const engines = new Set();
let settings = load();

const TEXTURE_SENTINEL_R = 254 / 255;
const TEXTURE_SENTINEL_B = 1 / 255;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitize(raw = {}) {
  return {
    quality: CAPS[raw.quality] ? raw.quality : DEFAULTS.quality,
    resolution: ['auto', '720', '1080'].includes(String(raw.resolution)) ? String(raw.resolution) : DEFAULTS.resolution,
    materialMode: ['simple', 'realistic'].includes(String(raw.materialMode)) ? String(raw.materialMode) : DEFAULTS.materialMode,
    waterMotion: raw.waterMotion !== false,
    grassMotion: raw.grassMotion !== false,
    showFps: raw.showFps === true
  };
}

function load() {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (_) { return { ...DEFAULTS }; }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); }
  catch (_) {}
}

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aVertexColor;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uTime;
uniform float uNoise;
uniform float uBlockGrid;
uniform float uBlockElevationCue;
uniform float uBlockElevationBase;
uniform float uGrassMotion;
uniform float uWaterMotion;
out vec3 p;
out vec3 n;
out vec3 c;
void main(){
  vec3 local = aPosition;
  if(uNoise < -0.5 && uNoise > -1.5 && uGrassMotion > 0.5){
    float w = smoothstep(0.06, 0.58, fract(aPosition.y));
    float sway = (sin(uTime*1.65+aPosition.x*0.53+aPosition.z*0.31)+sin(uTime*0.81+aPosition.z*0.72))*0.035*w;
    local.x += sway;
    local.z += sway*0.52;
  } else if(uNoise <= -1.5 && uWaterMotion > 0.5){
    float w = smoothstep(0.30, 0.72, fract(aPosition.y));
    vec2 q = aPosition.xz + vec2(uBlockElevationCue,uBlockElevationBase)*uTime*uBlockGrid*2.4;
    local.y += (sin(q.x*0.72+q.y*0.16)*0.028+cos(q.y*0.91-q.x*0.13)*0.019+sin((q.x+q.y)*1.65)*0.009)*w;
  }
  vec4 world = uModel * vec4(local,1.0);
  p = world.xyz;
  n = mat3(uModel) * aNormal;
  c = aVertexColor;
  gl_Position = uProjection * uView * world;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 p;
in vec3 n;
in vec3 c;
uniform vec3 uColor;
uniform vec3 uLightDirection;
uniform vec3 uFogColor;
uniform vec3 uCameraPosition;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uNoise;
uniform float uBlockGrid;
uniform float uBlockFaceShade;
uniform float uBlockElevationCue;
uniform float uBlockElevationBase;
uniform float uTime;
uniform float uMaterialDetail;
uniform float uWaterMotion;
uniform sampler2D uTextureAtlas;
out vec4 o;

const float RIFT_TEX_SENTINEL_R = ${TEXTURE_SENTINEL_R.toFixed(9)};
const float RIFT_TEX_SENTINEL_B = ${TEXTURE_SENTINEL_B.toFixed(9)};
const float RIFT_ATLAS_COLUMNS = ${RIFT_TEXTURE_ATLAS_COLUMNS.toFixed(1)};
const float RIFT_ATLAS_ROWS = ${RIFT_TEXTURE_ATLAS_ROWS.toFixed(1)};

float h(vec2 q){
  q=fract(q*vec2(123.34,456.21));
  q+=dot(q,q+45.32);
  return fract(q.x*q.y);
}
float n2(vec2 q){
  vec2 i=floor(q),f=fract(q);
  f=f*f*(3.0-2.0*f);
  float a=h(i),b=h(i+vec2(1,0)),d=h(i+vec2(0,1)),e=h(i+vec2(1,1));
  return mix(mix(a,b,f.x),mix(d,e,f.x),f.y);
}
float fbm(vec2 q){
  float s=0.0,a=0.5;
  for(int i=0;i<4;i++){
    s+=n2(q)*a;
    q=q*2.03+17.1;
    a*=0.5;
  }
  return s;
}
float v(vec2 q){
  return sin(q.x*0.29+sin(q.y*0.13)*0.8)*0.62+cos(q.y*0.23-q.x*0.09)*0.38;
}
vec2 uv(vec3 N){
  vec3 b=abs(N);
  return b.y>0.65?p.xz:(b.x>b.z?p.zy:p.xy);
}
float d3(vec3 a,vec3 b){
  vec3 q=a-b;
  return dot(q,q);
}
void pick(inout float best,inout float st,vec3 r,float k){
  float q=d3(c,r);
  if(q<best){best=q;st=k;}
}
float style(){
  if(c.r>0.93&&c.g>0.93&&c.b>0.93)return 0.0;
  float b=99.0,s=0.0;
  pick(b,s,vec3(.10,.11,.12),1.0);pick(b,s,vec3(.15,.16,.17),1.0);pick(b,s,vec3(.88,.88,.80),1.0);pick(b,s,vec3(.90,.64,.12),1.0);
  pick(b,s,vec3(.58,.58,.56),2.0);pick(b,s,vec3(.55,.56,.57),2.0);pick(b,s,vec3(.64,.63,.59),2.0);
  pick(b,s,vec3(.46,.20,.16),3.0);pick(b,s,vec3(.47,.24,.19),3.0);pick(b,s,vec3(.28,.20,.18),3.0);pick(b,s,vec3(.31,.22,.18),3.0);
  pick(b,s,vec3(.64,.61,.54),4.0);pick(b,s,vec3(.52,.51,.48),4.0);
  pick(b,s,vec3(.22,.48,.62),5.0);pick(b,s,vec3(.28,.48,.58),5.0);
  pick(b,s,vec3(.18,.30,.17),6.0);pick(b,s,vec3(.16,.36,.16),6.0);pick(b,s,vec3(.21,.39,.15),6.0);
  pick(b,s,vec3(.38,.36,.32),7.0);pick(b,s,vec3(.34,.31,.27),7.0);pick(b,s,vec3(.22,.24,.22),7.0);
  pick(b,s,vec3(.12,.13,.14),8.0);pick(b,s,vec3(.18,.20,.21),8.0);
  pick(b,s,vec3(.42,.43,.44),9.0);pick(b,s,vec3(.23,.18,.13),10.0);
  pick(b,s,vec3(.31,.36,.40),11.0);pick(b,s,vec3(.20,.42,.66),11.0);
  pick(b,s,vec3(.22,.10,.28),12.0);pick(b,s,vec3(.42,.30,.22),12.0);
  pick(b,s,vec3(.34,.24,.14),13.0);
  return b<0.085?s:0.0;
}
float seam(float x,float period,float thick){
  float q=x/period,e=abs(fract(q)-0.5),a=max(fwidth(q)*1.3,0.004);
  return smoothstep(0.5-thick-a,0.5-thick+a,e);
}
float tex(float s,vec3 N){
  if(uMaterialDetail<0.5)return 1.0;
  vec2 q=uv(N);
  float fine=fbm(q*5.2),broad=fbm(q*0.58),g=h(floor(q*9.0));
  if(s<0.5)return 1.0;
  if(s<1.5){float cracks=smoothstep(.965,1.0,fbm(q*.17+7.0));return .88+broad*.13+(g-.5)*.10-cracks*.20;}
  if(s<2.5){float panel=max(seam(q.x,4.0,.025),seam(q.y,4.0,.025));float pores=g>.9?-.09:0.0;return(.91+broad*.10+fine*.04+pores)*mix(1.0,.72,panel);}
  if(s<3.5){float row=floor(q.y*2.0),x=q.x+mod(row,2.0)*.5,m=max(seam(x,1.0,.055),seam(q.y,.5,.07));return(.91+h(floor(vec2(x,q.y)*vec2(1.0,2.0)))*.16+fine*.025)*mix(1.0,.58,m);}
  if(s<4.5){float joints=max(seam(q.x,1.6,.035),seam(q.y,1.05,.04)),vein=smoothstep(.75,.94,fbm(q*1.7+3.0))*.13;return(.91+broad*.15-vein)*mix(1.0,.71,joints);}
  if(s<5.5)return .95+sin((q.x+q.y*.27)*2.2)*.035;
  if(s<6.5){float turf=.79+broad*.31+fine*.10;return N.y>.62?turf:turf*.76;}
  if(s<7.5)return .78+fine*.27+(g-.5)*.19;
  if(s<8.5)return(.87+broad*.17+fine*.04)*mix(1.0,.70,seam(q.y,1.0,.025));
  if(s<9.5)return(.93+broad*.11)*mix(1.0,.67,max(seam(q.x+mod(floor(q.y*2.0),2.0)*.25,.5,.055),seam(q.y,.5,.055)));
  if(s<10.5)return .91+broad*.08+sin(q.y*5.5+fbm(q*.55)*2.5)*.07;
  if(s<11.5)return(1.0+sin(q.y*20.0)*.018)*mix(1.0,.77,max(seam(q.x,2.0,.018),seam(q.y,1.0,.018)));
  if(s<12.5)return .90+broad*.14+fine*.03;
  return .78+broad*.24+fine*.08;
}
float face(vec3 a){
  vec3 b=abs(a);
  if(b.y>=b.x&&b.y>=b.z)return a.y>=0.0?1.0:.52;
  if(b.x>=b.z)return a.x>=0.0?.74:.68;
  return a.z>=0.0?.86:.80;
}
bool riftTextureEncoded(vec3 code){
  return abs(code.r-RIFT_TEX_SENTINEL_R)<0.0019&&abs(code.b-RIFT_TEX_SENTINEL_B)<0.0019;
}
vec3 riftAtlasColor(vec3 code,vec3 N){
  float tileIndex=floor(code.g*255.0+0.5);
  float tileX=mod(tileIndex,RIFT_ATLAS_COLUMNS);
  float tileY=floor(tileIndex/RIFT_ATLAS_COLUMNS);
  vec2 localUv=fract(uv(N)+vec2(0.0001));
  localUv=mix(vec2(0.018),vec2(0.982),localUv);
  vec2 atlasUv=vec2((tileX+localUv.x)/RIFT_ATLAS_COLUMNS,(tileY+localUv.y)/RIFT_ATLAS_ROWS);
  return texture(uTextureAtlas,atlasUv).rgb;
}
void main(){
  vec3 N=normalize(n);
  float diff=max(dot(N,normalize(-uLightDirection)),0.0);
  if(uNoise<=-1.5){
    vec3 V=normalize(uCameraPosition-p);
    vec2 q=p.xz+(uWaterMotion>.5?vec2(uBlockElevationCue,uBlockElevationBase)*uTime*uBlockGrid*2.0:vec2(0.0));
    float ripple=uWaterMotion>.5?(sin(q.x*1.25+q.y*.25)+cos(q.y*1.05-q.x*.18)+sin((q.x+q.y)*2.15)*.35):0.0;
    float fres=pow(1.0-clamp(abs(dot(N,V)),0.0,1.0),2.4);
    vec3 water=clamp(uColor*c,0.0,1.0);
    vec3 col=mix(water*.64,min(vec3(1.0),water*1.28+vec3(.02,.05,.07)),.50+ripple*.055);
    col=mix(col,vec3(.48,.66,.77),fres*.42);
    float fog=smoothstep(uFogStart,uFogEnd,distance(p,uCameraPosition));
    o=vec4(mix(col,uFogColor,fog),.68+.16*fres);
    return;
  }
  if(uNoise<-.5){
    float wind=.92+sin(uTime*1.3+p.x*.6+p.z*.37)*.035;
    vec3 base=clamp(uColor*c*wind,0.0,1.0);
    float fog=smoothstep(uFogStart,uFogEnd,distance(p,uCameraPosition));
    o=vec4(mix(base,uFogColor,fog),1.0);
    return;
  }
  bool atlasBacked=riftTextureEncoded(c);
  float st=atlasBacked?0.0:style();
  vec3 source=atlasBacked?riftAtlasColor(c,N):c;
  float legacyTexture=atlasBacked?1.0:tex(st,N);
  vec3 base=clamp(uColor*source*(1.0+v(p.xz)*uNoise)*legacyTexture,0.0,1.0);
  if(!atlasBacked&&st>4.5&&st<5.5&&uMaterialDetail>.5){
    vec3 V=normalize(uCameraPosition-p);
    float fres=pow(1.0-clamp(abs(dot(N,V)),0.0,1.0),3.0);
    base=mix(base,vec3(.43,.60,.72),.17+.36*fres);
  }
  if(uBlockGrid>.001){
    vec2 q=uv(N),cell=abs(fract(q)-.5),w=max(fwidth(q)*1.15,vec2(.012));
    float sm=max(smoothstep(.46-w.x,.49,cell.x),smoothstep(.46-w.y,.49,cell.y));
    base*=mix(1.0,.82,sm*clamp(uBlockGrid,0.0,1.0));
  }
  float directional=.58+diff*.54,fm=clamp(uBlockFaceShade,0.0,1.0),e=1.0;
  if(uBlockElevationCue>.001&&N.y>.65)e=1.0+min(max(p.y-uBlockElevationBase,0.0)*uBlockElevationCue,.12);
  vec3 lit=base*mix(directional,face(N),fm)*mix(1.0,e,fm);
  float fog=smoothstep(uFogStart,uFogEnd,distance(p,uCameraPosition));
  o=vec4(mix(lit,uFogColor,fog),1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'shader error';
    gl.deleteShader(shader);
    throw new Error(`Rift H1.87 shader compile failed: ${info}`);
  }
  return shader;
}

function upgrade(engine) {
  if (engine.__riftH187Shader) return;
  const gl = engine.gl;
  const vertex = compile(gl, gl.VERTEX_SHADER, VS);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FS);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'link error';
    gl.deleteProgram(program);
    throw new Error(`Rift H1.87 shader link failed: ${info}`);
  }

  const old = engine.program;
  const u = name => gl.getUniformLocation(program, name);
  engine.program = program;
  engine.uniforms = {
    projection: u('uProjection'),
    view: u('uView'),
    model: u('uModel'),
    color: u('uColor'),
    lightDirection: u('uLightDirection'),
    fogColor: u('uFogColor'),
    fogStart: u('uFogStart'),
    fogEnd: u('uFogEnd'),
    noise: u('uNoise'),
    blockGrid: u('uBlockGrid'),
    blockFaceShade: u('uBlockFaceShade'),
    blockElevationCue: u('uBlockElevationCue'),
    blockElevationBase: u('uBlockElevationBase'),
    cameraPosition: u('uCameraPosition'),
    textureAtlas: u('uTextureAtlas'),
    time: u('uTime'),
    materialDetail: u('uMaterialDetail'),
    grassMotion: u('uGrassMotion'),
    waterMotion: u('uWaterMotion')
  };
  engine.__riftTextures = true;
  engine.__riftH187Shader = true;
  try { gl.deleteProgram(old); } catch (_) {}
}

function ratio(engine, requested) {
  if (engine.canvas?.id === 'inspection-canvas') return Math.max(0.75, Number(requested) || 1);
  const rect = engine.canvas.getBoundingClientRect();
  if (settings.resolution === '720' || settings.resolution === '1080') {
    return clamp(Number(settings.resolution) / Math.max(1, rect.height), 0.75, 2);
  }
  const device = Math.max(Number(requested) || 1, Number(window.devicePixelRatio) || 1);
  return clamp(Math.min(device, CAPS[settings.quality] || CAPS.high), 0.75, 2);
}

if (!RiftEngine.prototype[PATCH]) {
  const render = RiftEngine.prototype.render;
  const resize = RiftEngine.prototype.resize;
  Object.defineProperty(RiftEngine.prototype, PATCH, { value: true });

  RiftEngine.prototype.resize = function resizeWithQuality(target = 1) {
    engines.add(this);
    const result = resize.call(this, ratio(this, target));
    queueMicrotask(() => window.dispatchEvent(new CustomEvent('riftgraphicsbuffer')));
    return result;
  };

  RiftEngine.prototype.render = function renderWithQuality(camera) {
    engines.add(this);
    upgrade(this);
    const gl = this.gl;
    gl.useProgram(this.program);
    if (this.uniforms.materialDetail) gl.uniform1f(this.uniforms.materialDetail, settings.materialMode === 'realistic' ? 1 : 0);
    if (this.uniforms.grassMotion) gl.uniform1f(this.uniforms.grassMotion, settings.grassMotion ? 1 : 0);
    if (this.uniforms.waterMotion) gl.uniform1f(this.uniforms.waterMotion, settings.waterMotion ? 1 : 0);
    if (this.uniforms.time) gl.uniform1f(this.uniforms.time, performance.now() * 0.001);
    return render.call(this, camera);
  };
}

function apply() {
  persist();
  document.documentElement.classList.toggle('rift-hide-fps', !settings.showFps);
  for (const engine of engines) {
    if (engine?.disposed || !engine?.canvas?.isConnected) {
      engines.delete(engine);
      continue;
    }
    try { engine.resize(engine.pixelRatio || 1); } catch (_) {}
  }
  window.dispatchEvent(new CustomEvent('riftgraphicschange', { detail: { ...settings } }));
}

export function getRiftGraphics() { return { ...settings }; }
export function setRiftGraphics(next = {}) {
  settings = sanitize({ ...settings, ...next });
  apply();
  return getRiftGraphics();
}
export function resetRiftGraphics() {
  settings = { ...DEFAULTS };
  apply();
  return getRiftGraphics();
}
export function getRiftRenderBuffer() {
  const canvas = document.querySelector('#riftcity-3d-canvas');
  return canvas ? { width: canvas.width, height: canvas.height } : null;
}

apply();
window.RiftCityGraphicsCore = Object.freeze({
  version: 'H1.87-atlas-aware-renderer-settings',
  get: getRiftGraphics,
  set: setRiftGraphics,
  reset: resetRiftGraphics,
  buffer: getRiftRenderBuffer
});
