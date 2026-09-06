#include "../include/rift/terrain.hpp"

extern "C" void* memset(void* dest, int value, unsigned long n) {
  unsigned char* d = (unsigned char*)dest;
  for (unsigned long i = 0; i < n; ++i) d[i] = (unsigned char)value;
  return dest;
}
extern "C" void* memcpy(void* dest, const void* src, unsigned long n) {
  unsigned char* d = (unsigned char*)dest; const unsigned char* s = (const unsigned char*)src;
  for (unsigned long i = 0; i < n; ++i) d[i] = s[i];
  return dest;
}

namespace {
constexpr int kMaxColumns = 1025;
constexpr int kMaxRows = 1025;
constexpr int kMaxSamples = kMaxColumns * kMaxRows;
constexpr int kMaxCells = (kMaxColumns - 1) * (kMaxRows - 1);
constexpr int kMaxChunkCells = 128;
constexpr int kMaxChunkVerts = (kMaxChunkCells + 1) * (kMaxChunkCells + 1);
constexpr int kVertexStride = 9;
constexpr int kMaxVertexFloats = kMaxChunkVerts * kVertexStride;
constexpr int kMaxIndices = kMaxChunkCells * kMaxChunkCells * 6;

int gColumns = 0;
int gRows = 0;
float gSpacing = 1.0f;
float gOriginX = 0.0f;
float gOriginZ = 0.0f;
float gBaseHeight = 0.0f;
float gMaxWalkSlope = 0.78f;
float gHeights[kMaxSamples];
float gGeneratedBase[kMaxSamples];
float gDelta[kMaxSamples];
unsigned char gHoles[kMaxCells];
float gNormal[3] = {0.0f, 1.0f, 0.0f};
float gRaycast[4] = {0,0,0,0};
float gMeshVertices[kMaxVertexFloats];
unsigned int gMeshIndices[kMaxIndices];
int gMeshVertexFloats = 0;
int gMeshIndexCount = 0;

inline float absf(float x) { return x < 0.0f ? -x : x; }
inline float minf(float a, float b) { return a < b ? a : b; }
inline float maxf(float a, float b) { return a > b ? a : b; }
inline float clampf(float x, float a, float b) { return x < a ? a : (x > b ? b : x); }
inline int clampi(int x, int a, int b) { return x < a ? a : (x > b ? b : x); }
inline float lerpf(float a, float b, float t) { return a + (b - a) * t; }
inline float smoothstepf(float t) { float x=clampf(t,0.0f,1.0f); return x*x*(3.0f-2.0f*x); }
inline float sqrtf_fast(float x) { return __builtin_sqrtf(maxf(0.0f, x)); }
inline int floori(float x) { int i=(int)x; return (x < (float)i) ? i-1 : i; }
inline int ceili(float x) { int i=(int)x; return (x > (float)i) ? i+1 : i; }
inline float hypot2(float x, float y) { return sqrtf_fast(x*x+y*y); }
inline int hidx(int ix,int iz){ return iz*gColumns+ix; }
inline int cidx(int ix,int iz){ return iz*(gColumns-1)+ix; }
inline float worldX(int ix){ return gOriginX + (float)ix*gSpacing; }
inline float worldZ(int iz){ return gOriginZ + (float)iz*gSpacing; }
inline bool ready(){ return gColumns>1 && gRows>1; }
inline bool contains(float x,float z){ return ready() && x>=gOriginX && z>=gOriginZ && x<=gOriginX+(gColumns-1)*gSpacing && z<=gOriginZ+(gRows-1)*gSpacing; }

unsigned int mix32(unsigned int x){
  x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x;
}
float hash01(int x,int z,unsigned int seed){
  unsigned int h=mix32((unsigned int)x*0x9e3779b1U ^ (unsigned int)z*0x85ebca77U ^ seed*0xc2b2ae3dU);
  return (float)(h & 0x00ffffffU) / 16777215.0f;
}
float valueNoise(float x,float z,float scale,unsigned int seed){
  scale=maxf(1.0f,scale); float gx=x/scale,gz=z/scale; int x0=floori(gx),z0=floori(gz),x1=x0+1,z1=z0+1;
  float tx=smoothstepf(gx-(float)x0),tz=smoothstepf(gz-(float)z0);
  float a=hash01(x0,z0,seed),b=hash01(x1,z0,seed),c=hash01(x0,z1,seed),d=hash01(x1,z1,seed);
  return lerpf(lerpf(a,b,tx),lerpf(c,d,tx),tz)*2.0f-1.0f;
}
float fbm(float x,float z,float scale,unsigned int seed){
  float total=0.0f,amp=0.5f,norm=0.0f; float currentScale=maxf(2.0f,scale);
  for(int octave=0;octave<5;octave++){
    total+=valueNoise(x,z,currentScale,seed+(unsigned int)octave*0x9e3779b9U)*amp; norm+=amp; amp*=0.5f; currentScale*=0.5f;
  }
  return norm>0.0f?total/norm:0.0f;
}
float islandHeightAt(float x,float z,unsigned int seed,float waterLevel,float coastWidth,float landHeight,float hillHeight,float mountainHeight,float roughness){
  const float width=(gColumns-1)*gSpacing,depth=(gRows-1)*gSpacing;
  const float halfW=maxf(gSpacing,width*0.5f),halfD=maxf(gSpacing,depth*0.5f),halfMin=minf(halfW,halfD);
  const float centerX=gOriginX+halfW,centerZ=gOriginZ+halfD;
  const float rawNx=(x-centerX)/halfW,rawNz=(z-centerZ)/halfD;
  float nx=rawNx,nz=rawNz;
  const float warpX=fbm(x+131.0f,z-79.0f,220.0f,seed^0x68bc21ebU)*0.12f;
  const float warpZ=fbm(x-47.0f,z+193.0f,240.0f,seed^0x02e5be93U)*0.12f;
  nx=(nx+warpX)*0.95f; nz=(nz+warpZ)*1.05f;
  const float radial=sqrtf_fast(nx*nx+nz*nz);
  const float coastNoise=fbm(x,z,170.0f,seed^0xa511e9b3U)*0.13f + fbm(x+83.0f,z-61.0f,72.0f,seed^0x63d83595U)*0.045f;
  float islandField=0.82f-radial+coastNoise;
  const float edgeNorm=minf(1.0f-absf(rawNx),1.0f-absf(rawNz));
  const float edgeLimit=(edgeNorm-0.07f)*1.5f;
  islandField=minf(islandField,edgeLimit);
  const float coastNorm=maxf(gSpacing/halfMin,coastWidth/halfMin);
  if(islandField<=0.0f){
    const float sea=smoothstepf(clampf((-islandField)/(coastNorm*2.8f),0.0f,1.0f));
    const float seabedNoise=fbm(x,z,95.0f,seed^0x9e3779b9U)*1.6f;
    return waterLevel-1.4f-sea*10.5f+seabedNoise*sea;
  }
  const float broadRise=smoothstepf(clampf(islandField/coastNorm,0.0f,1.0f));
  const float cliffSelector=smoothstepf(clampf((fbm(x+211.0f,z+37.0f,210.0f,seed^0x51ed270bU)-0.18f)/0.42f,0.0f,1.0f));
  const float cliffRise=smoothstepf(clampf(islandField/(coastNorm*0.34f),0.0f,1.0f));
  const float shoreRise=lerpf(broadRise,cliffRise,cliffSelector*0.58f);
  const float interior=smoothstepf(clampf(islandField/(coastNorm*3.2f),0.0f,1.0f));
  const float macro=0.5f+0.5f*fbm(x,z,210.0f,seed^0x7f4a7c15U);
  const float hills=0.5f+0.5f*fbm(x+57.0f,z-103.0f,105.0f,seed^0x94d049bbU);
  const float ridgeNoise=fbm(x-149.0f,z+89.0f,145.0f,seed^0xd1b54a35U);
  float ridges=1.0f-absf(ridgeNoise); ridges=ridges*ridges;
  const float mountainZone=smoothstepf(clampf((macro-0.48f)/0.38f,0.0f,1.0f))*interior;
  const float flatSelector=smoothstepf(clampf((fbm(x+301.0f,z-217.0f,260.0f,seed^0x165667b1U)-0.18f)/0.38f,0.0f,1.0f))*interior;
  const float reliefDamp=1.0f-flatSelector*0.62f;
  const float lowland=2.0f+landHeight*(0.28f+macro*0.72f);
  const float hillRelief=hillHeight*hills*interior*reliefDamp;
  const float mountainRelief=mountainHeight*ridges*mountainZone*reliefDamp;
  const float fine=fbm(x+17.0f,z+29.0f,28.0f,seed^0x27d4eb2fU)*1.55f*clampf(roughness,0.0f,2.0f)*interior*reliefDamp;
  return waterLevel+shoreRise*(2.0f+interior*(lowland+hillRelief+mountainRelief)+fine);
}


float islandHeightAtScaled(float x,float z,unsigned int seed,float waterLevel,float coastWidth,float landHeight,float hillHeight,float mountainHeight,float roughness,float footprintRadius,float edgeMargin,float warpStrength){
  const float width=(gColumns-1)*gSpacing,depth=(gRows-1)*gSpacing;
  const float halfW=maxf(gSpacing,width*0.5f),halfD=maxf(gSpacing,depth*0.5f),halfMin=minf(halfW,halfD);
  const float centerX=gOriginX+halfW,centerZ=gOriginZ+halfD;
  const float rawNx=(x-centerX)/halfW,rawNz=(z-centerZ)/halfD;

  // v2 deliberately scales its noise wavelengths with world size. This keeps a
  // 5 km island made of broad regions instead of repeating the 640 m map eight times.
  const float macroScale=maxf(320.0f,halfMin*0.42f);
  const float coastScale=maxf(220.0f,halfMin*0.28f);
  const float coastDetailScale=maxf(90.0f,halfMin*0.095f);
  const float hillScale=maxf(180.0f,halfMin*0.20f);
  const float ridgeScale=maxf(220.0f,halfMin*0.25f);
  const float flatScale=maxf(360.0f,halfMin*0.46f);
  const float fineScale=maxf(55.0f,halfMin*0.052f);

  const float warpX=fbm(x+131.0f,z-79.0f,macroScale*0.92f,seed^0x68bc21ebU)*warpStrength;
  const float warpZ=fbm(x-47.0f,z+193.0f,macroScale,seed^0x02e5be93U)*warpStrength;
  float nx=(rawNx+warpX)*0.96f;
  float nz=(rawNz+warpZ)*1.04f;
  const float radial=sqrtf_fast(nx*nx+nz*nz);

  const float coastNoise=
    fbm(x,z,coastScale,seed^0xa511e9b3U)*0.14f+
    fbm(x+83.0f,z-61.0f,coastDetailScale,seed^0x63d83595U)*0.045f;
  float islandField=footprintRadius-radial+coastNoise;

  // Keep a guaranteed ocean moat around all four world edges for every seed.
  const float edgeNorm=minf(1.0f-absf(rawNx),1.0f-absf(rawNz));
  const float edgeLimit=(edgeNorm-edgeMargin)*1.65f;
  islandField=minf(islandField,edgeLimit);

  const float coastNorm=maxf(gSpacing/halfMin,coastWidth/halfMin);
  if(islandField<=0.0f){
    const float sea=smoothstepf(clampf((-islandField)/(coastNorm*3.1f),0.0f,1.0f));
    const float seabedNoise=fbm(x,z,maxf(75.0f,fineScale*0.8f),seed^0x9e3779b9U)*2.2f;
    return waterLevel-1.8f-sea*15.0f+seabedNoise*sea;
  }

  const float broadRise=smoothstepf(clampf(islandField/coastNorm,0.0f,1.0f));
  const float cliffSelector=smoothstepf(clampf((fbm(x+211.0f,z+37.0f,coastScale*0.9f,seed^0x51ed270bU)-0.16f)/0.40f,0.0f,1.0f));
  const float cliffRise=smoothstepf(clampf(islandField/(coastNorm*0.30f),0.0f,1.0f));
  const float shoreRise=lerpf(broadRise,cliffRise,cliffSelector*0.52f);
  const float interior=smoothstepf(clampf(islandField/(coastNorm*4.0f),0.0f,1.0f));

  // Broad continental-scale shaping first.
  const float macro=0.5f+0.5f*fbm(x,z,macroScale,seed^0x7f4a7c15U);
  const float secondary=0.5f+0.5f*fbm(x-451.0f,z+337.0f,macroScale*0.62f,seed^0x4f1bbcdcU);
  const float hills=0.5f+0.5f*fbm(x+57.0f,z-103.0f,hillScale,seed^0x94d049bbU);
  const float ridgeNoise=fbm(x-149.0f,z+89.0f,ridgeScale,seed^0xd1b54a35U);
  float ridges=1.0f-absf(ridgeNoise); ridges=ridges*ridges;

  const float mountainZone=smoothstepf(clampf((macro*0.72f+secondary*0.28f-0.52f)/0.34f,0.0f,1.0f))*interior;
  const float flatSelector=smoothstepf(clampf((fbm(x+301.0f,z-217.0f,flatScale,seed^0x165667b1U)-0.10f)/0.42f,0.0f,1.0f))*interior;
  const float valleySelector=smoothstepf(clampf((0.18f-fbm(x-517.0f,z+223.0f,macroScale*0.48f,seed^0x8cb92baaU))/0.48f,0.0f,1.0f))*interior;
  const float reliefDamp=clampf(1.0f-flatSelector*0.68f-valleySelector*0.28f,0.22f,1.0f);

  const float lowland=3.0f+landHeight*(0.24f+macro*0.52f+secondary*0.24f);
  const float hillRelief=hillHeight*hills*interior*reliefDamp;
  const float mountainRelief=mountainHeight*ridges*mountainZone*reliefDamp;
  const float valleyCut=valleySelector*landHeight*0.24f;
  const float fine=fbm(x+17.0f,z+29.0f,fineScale,seed^0x27d4eb2fU)*2.0f*clampf(roughness,0.0f,2.0f)*interior*reliefDamp;

  return waterLevel+shoreRise*(2.5f+interior*(lowland+hillRelief+mountainRelief-valleyCut)+fine);
}

float islandHeightAtV2(float x,float z,unsigned int seed,float waterLevel,float coastWidth,float landHeight,float hillHeight,float mountainHeight,float roughness){
  return islandHeightAtScaled(x,z,seed,waterLevel,coastWidth,landHeight,hillHeight,mountainHeight,roughness,0.84f,0.055f,0.11f);
}

float islandHeightAtV3(float x,float z,unsigned int seed,float waterLevel,float coastWidth,float landHeight,float hillHeight,float mountainHeight,float roughness){
  // v3 preserves the 5.12 km world while shrinking the land footprint so the
  // ocean is a meaningful part of the map instead of a thin border.
  return islandHeightAtScaled(x,z,seed,waterLevel,coastWidth,landHeight,hillHeight,mountainHeight,roughness,0.70f,0.09f,0.13f);
}

float sample(float x,float z){
  if(!contains(x,z)) return 1.0e30f;
  float gx=clampf((x-gOriginX)/gSpacing,0.0f,(float)(gColumns-1));
  float gz=clampf((z-gOriginZ)/gSpacing,0.0f,(float)(gRows-1));
  int x0=floori(gx), z0=floori(gz);
  int x1=clampi(x0+1,0,gColumns-1), z1=clampi(z0+1,0,gRows-1);
  float tx=gx-x0, tz=gz-z0;
  float a=gHeights[hidx(x0,z0)], b=gHeights[hidx(x1,z0)];
  float c=gHeights[hidx(x0,z1)], d=gHeights[hidx(x1,z1)];
  return lerpf(lerpf(a,b,tx),lerpf(c,d,tx),tz);
}

void normalAt(float x,float z,float* out){
  float center=sample(x,z); if(center>1.0e20f) center=gBaseHeight;
  float l=sample(x-gSpacing,z); if(l>1.0e20f) l=center;
  float r=sample(x+gSpacing,z); if(r>1.0e20f) r=center;
  float d=sample(x,z-gSpacing); if(d>1.0e20f) d=center;
  float u=sample(x,z+gSpacing); if(u>1.0e20f) u=center;
  float nx=l-r, ny=gSpacing*2.0f, nz=d-u;
  float len=sqrtf_fast(nx*nx+ny*ny+nz*nz); if(len<1.0e-6f) len=1.0f;
  out[0]=nx/len; out[1]=ny/len; out[2]=nz/len;
}

bool manualHole(float x,float z){
  if(!contains(x,z)) return false;
  int gx=floori((x-gOriginX)/gSpacing), gz=floori((z-gOriginZ)/gSpacing);
  if(gx<0||gz<0||gx>=gColumns-1||gz>=gRows-1) return false;
  return gHoles[cidx(gx,gz)]!=0;
}


float seamAlongX(float x,float z,int coarseStep){
  if(coarseStep<=1) return sample(x,z);
  float gx=clampf((x-gOriginX)/gSpacing,0.0f,(float)(gColumns-1));
  int stride=coarseStep;
  int i0=clampi((floori(gx/(float)stride))*stride,0,gColumns-1);
  int i1=clampi(i0+stride,0,gColumns-1);
  if(i1==i0) return sample(x,z);
  float t=clampf((gx-(float)i0)/(float)(i1-i0),0.0f,1.0f);
  return lerpf(sample(worldX(i0),z),sample(worldX(i1),z),t);
}

float seamAlongZ(float x,float z,int coarseStep){
  if(coarseStep<=1) return sample(x,z);
  float gz=clampf((z-gOriginZ)/gSpacing,0.0f,(float)(gRows-1));
  int stride=coarseStep;
  int i0=clampi((floori(gz/(float)stride))*stride,0,gRows-1);
  int i1=clampi(i0+stride,0,gRows-1);
  if(i1==i0) return sample(x,z);
  float t=clampf((gz-(float)i0)/(float)(i1-i0),0.0f,1.0f);
  return lerpf(sample(x,worldZ(i0)),sample(x,worldZ(i1)),t);
}

float stitchedHeight(float x,float z,int lod,int northLod,int eastLod,int southLod,int westLod,
                     float minX,float maxX,float minZ,float maxZ){
  float y=sample(x,z);
  const float edgeEpsilon=maxf(0.0005f,gSpacing*0.001f);
  if(absf(z-minZ)<=edgeEpsilon && northLod>lod) y=seamAlongX(x,z,northLod);
  if(absf(x-maxX)<=edgeEpsilon && eastLod>lod) y=seamAlongZ(x,z,eastLod);
  if(absf(z-maxZ)<=edgeEpsilon && southLod>lod) y=seamAlongX(x,z,southLod);
  if(absf(x-minX)<=edgeEpsilon && westLod>lod) y=seamAlongZ(x,z,westLod);
  return y;
}

void terrainColor(float y,const float* n,float* out){
  float slope=clampf(1.0f-n[1],0.0f,1.0f);
  const float low[3]={0.26f,0.39f,0.19f};
  const float grass[3]={0.32f,0.48f,0.22f};
  const float rock[3]={0.42f,0.40f,0.35f};
  float elevation=clampf((y-gBaseHeight)/22.0f,-1.0f,1.0f);
  float grassMix=clampf(0.65f+elevation*0.18f,0.3f,0.9f);
  float base[3]={lerpf(low[0],grass[0],grassMix),lerpf(low[1],grass[1],grassMix),lerpf(low[2],grass[2],grassMix)};
  float rockMix=smoothstepf(clampf((slope-0.18f)/0.45f,0.0f,1.0f));
  out[0]=lerpf(base[0],rock[0],rockMix); out[1]=lerpf(base[1],rock[1],rockMix); out[2]=lerpf(base[2],rock[2],rockMix);
}
}

extern "C" {
int rift_core_version(){ return 1; }
int rift_terrain_init(int columns,int rows,float sampleSpacing,float originX,float originZ,float baseHeight,float maxWalkSlope){
  if(columns<2||rows<2||columns>kMaxColumns||rows>kMaxRows||sampleSpacing<=0.0f) return 0;
  gColumns=columns; gRows=rows; gSpacing=sampleSpacing; gOriginX=originX; gOriginZ=originZ; gBaseHeight=baseHeight; gMaxWalkSlope=clampf(maxWalkSlope,0.25f,2.5f);
  int samples=columns*rows, cells=(columns-1)*(rows-1);
  for(int i=0;i<samples;i++){ gDelta[i]=0.0f; gGeneratedBase[i]=gBaseHeight; gHeights[i]=gBaseHeight; }
  for(int i=0;i<cells;i++) gHoles[i]=0;
  gMeshVertexFloats=0; gMeshIndexCount=0; return 1;
}
int rift_terrain_columns(){ return gColumns; }
int rift_terrain_rows(){ return gRows; }
int rift_terrain_sample_count(){ return gColumns*gRows; }
int rift_terrain_cell_count(){ return ready()?(gColumns-1)*(gRows-1):0; }
unsigned int rift_terrain_heights_ptr(){ return (unsigned int)(unsigned long)gHeights; }
unsigned int rift_terrain_delta_ptr(){ return (unsigned int)(unsigned long)gDelta; }
unsigned int rift_terrain_holes_ptr(){ return (unsigned int)(unsigned long)gHoles; }
void rift_terrain_reset_flat(){ if(!ready())return; int n=gColumns*gRows,c=(gColumns-1)*(gRows-1); for(int i=0;i<n;i++){gDelta[i]=0;gGeneratedBase[i]=gBaseHeight;gHeights[i]=gBaseHeight;} for(int i=0;i<c;i++)gHoles[i]=0; }
int rift_terrain_generate_island(int seed,float waterLevel,float coastWidth,float landHeight,float hillHeight,float mountainHeight,float roughness){
  if(!ready())return 0;
  coastWidth=clampf(coastWidth,gSpacing*4.0f,minf((gColumns-1)*gSpacing,(gRows-1)*gSpacing)*0.22f);
  landHeight=clampf(landHeight,1.0f,80.0f); hillHeight=clampf(hillHeight,0.0f,80.0f); mountainHeight=clampf(mountainHeight,0.0f,120.0f); roughness=clampf(roughness,0.0f,2.0f);
  const unsigned int useSeed=(unsigned int)(seed==0?1:seed); int n=gColumns*gRows,c=(gColumns-1)*(gRows-1);
  for(int iz=0;iz<gRows;iz++)for(int ix=0;ix<gColumns;ix++){
    int idx=hidx(ix,iz); float generated=islandHeightAt(worldX(ix),worldZ(iz),useSeed,waterLevel,coastWidth,landHeight,hillHeight,mountainHeight,roughness);
    gGeneratedBase[idx]=generated; gDelta[idx]=0.0f; gHeights[idx]=generated;
  }
  for(int i=0;i<c;i++)gHoles[i]=0; gMeshVertexFloats=0; gMeshIndexCount=0; return n>0?1:0;
}
int rift_terrain_generate_island_v2(int seed,float waterLevel,float coastWidth,float landHeight,float hillHeight,float mountainHeight,float roughness){
  if(!ready())return 0;
  coastWidth=clampf(coastWidth,gSpacing*6.0f,minf((gColumns-1)*gSpacing,(gRows-1)*gSpacing)*0.18f);
  landHeight=clampf(landHeight,1.0f,120.0f); hillHeight=clampf(hillHeight,0.0f,120.0f); mountainHeight=clampf(mountainHeight,0.0f,180.0f); roughness=clampf(roughness,0.0f,2.0f);
  const unsigned int useSeed=(unsigned int)(seed==0?1:seed); int n=gColumns*gRows,c=(gColumns-1)*(gRows-1);
  for(int iz=0;iz<gRows;iz++)for(int ix=0;ix<gColumns;ix++){
    int idx=hidx(ix,iz); float generated=islandHeightAtV2(worldX(ix),worldZ(iz),useSeed,waterLevel,coastWidth,landHeight,hillHeight,mountainHeight,roughness);
    gGeneratedBase[idx]=generated; gDelta[idx]=0.0f; gHeights[idx]=generated;
  }
  for(int i=0;i<c;i++)gHoles[i]=0; gMeshVertexFloats=0; gMeshIndexCount=0; return n>0?1:0;
}
int rift_terrain_generate_island_v3(int seed,float waterLevel,float coastWidth,float landHeight,float hillHeight,float mountainHeight,float roughness){
  if(!ready())return 0;
  coastWidth=clampf(coastWidth,gSpacing*6.0f,minf((gColumns-1)*gSpacing,(gRows-1)*gSpacing)*0.18f);
  landHeight=clampf(landHeight,1.0f,120.0f); hillHeight=clampf(hillHeight,0.0f,120.0f); mountainHeight=clampf(mountainHeight,0.0f,180.0f); roughness=clampf(roughness,0.0f,2.0f);
  const unsigned int useSeed=(unsigned int)(seed==0?1:seed); int n=gColumns*gRows,c=(gColumns-1)*(gRows-1);
  for(int iz=0;iz<gRows;iz++)for(int ix=0;ix<gColumns;ix++){
    int idx=hidx(ix,iz); float generated=islandHeightAtV3(worldX(ix),worldZ(iz),useSeed,waterLevel,coastWidth,landHeight,hillHeight,mountainHeight,roughness);
    gGeneratedBase[idx]=generated; gDelta[idx]=0.0f; gHeights[idx]=generated;
  }
  for(int i=0;i<c;i++)gHoles[i]=0; gMeshVertexFloats=0; gMeshIndexCount=0; return n>0?1:0;
}
void rift_terrain_rebuild_from_delta(){ if(!ready())return; int n=gColumns*gRows; for(int i=0;i<n;i++) gHeights[i]=gGeneratedBase[i]+gDelta[i]; }
float rift_terrain_sample_height(float x,float z){ return sample(x,z); }
int rift_terrain_sample_normal(float x,float z){ if(!contains(x,z))return 0; normalAt(x,z,gNormal); return 1; }
unsigned int rift_terrain_normal_ptr(){ return (unsigned int)(unsigned long)gNormal; }
float rift_terrain_slope_at(float x,float z){ if(!contains(x,z)) return 1.0e30f; normalAt(x,z,gNormal); return hypot2(gNormal[0],gNormal[2])/maxf(0.001f,gNormal[1]); }
int rift_terrain_walkable_at(float x,float z){ return rift_terrain_slope_at(x,z)<=gMaxWalkSlope ? 1:0; }
int rift_terrain_is_manual_hole_at(float x,float z){ return manualHole(x,z)?1:0; }

int rift_terrain_apply_brush(int mode,float x,float z,float radius,float strength,float targetHeight){
  if(!ready()) return 0;
  radius=maxf(gSpacing,radius); float mag=absf(strength);
  int minX=clampi(floori((x-radius-gOriginX)/gSpacing),0,gColumns-1);
  int maxX=clampi(ceili((x+radius-gOriginX)/gSpacing),0,gColumns-1);
  int minZ=clampi(floori((z-radius-gOriginZ)/gSpacing),0,gRows-1);
  int maxZ=clampi(ceili((z+radius-gOriginZ)/gSpacing),0,gRows-1);
  if(mode==4||mode==5){
    int value=mode==4?1:0;
    for(int iz=clampi(minZ,0,gRows-2);iz<=clampi(maxZ,0,gRows-2);iz++) for(int ix=clampi(minX,0,gColumns-2);ix<=clampi(maxX,0,gColumns-2);ix++){
      float cx=worldX(ix)+gSpacing*0.5f, cz=worldZ(iz)+gSpacing*0.5f;
      if(hypot2(cx-x,cz-z)<=radius)gHoles[cidx(ix,iz)]=(unsigned char)value;
    }
    return 1;
  }
  static float smoothSource[kMaxSamples];
  if(mode==3){ int n=gColumns*gRows; for(int i=0;i<n;i++) smoothSource[i]=gHeights[i]; }
  for(int iz=minZ;iz<=maxZ;iz++) for(int ix=minX;ix<=maxX;ix++){
    float wx=worldX(ix), wz=worldZ(iz); float dist=hypot2(wx-x,wz-z); if(dist>radius)continue;
    float weight=smoothstepf(1.0f-dist/radius); int idx=hidx(ix,iz); float old=gHeights[idx], next=old;
    if(mode==0) next=old+mag*weight;
    else if(mode==1) next=old-mag*weight;
    else if(mode==2) next=lerpf(old,targetHeight,clampf(mag*weight,0.0f,1.0f));
    else if(mode==3){ float sum=0.0f; int count=0; for(int oz=-1;oz<=1;oz++)for(int ox=-1;ox<=1;ox++){int sx=clampi(ix+ox,0,gColumns-1),sz=clampi(iz+oz,0,gRows-1);sum+=smoothSource[hidx(sx,sz)];count++;} next=lerpf(old,sum/(float)count,clampf(mag*weight,0.0f,1.0f)); }
    float change=next-old; gDelta[idx]+=change; gHeights[idx]=next;
  }
  return 1;
}

int rift_terrain_build_section(int sectionX,int sectionZ,float sectionSize,int lod,
                               int northLod,int eastLod,int southLod,int westLod){
  if(!ready()||sectionSize<=0.0f) return 0;
  int step=lod<1?1:lod;
  northLod=northLod<step?step:northLod;
  eastLod=eastLod<step?step:eastLod;
  southLod=southLod<step?step:southLod;
  westLod=westLod<step?step:westLod;

  float width=(gColumns-1)*gSpacing, depth=(gRows-1)*gSpacing;
  float startX=sectionX*sectionSize,startZ=sectionZ*sectionSize;
  if(startX>=width||startZ>=depth)return 0;
  float endX=minf(width,startX+sectionSize),endZ=minf(depth,startZ+sectionSize),cellStep=gSpacing*(float)step;
  int cellsX=ceili((endX-startX)/cellStep); if(cellsX<1)cellsX=1; if(cellsX>kMaxChunkCells) return 0;
  int cellsZ=ceili((endZ-startZ)/cellStep); if(cellsZ<1)cellsZ=1; if(cellsZ>kMaxChunkCells) return 0;
  int vertsX=cellsX+1,vertsZ=cellsZ+1,vertex=0;
  float worldMinX=gOriginX+startX, worldMaxX=gOriginX+endX;
  float worldMinZ=gOriginZ+startZ, worldMaxZ=gOriginZ+endZ;

  for(int iz=0;iz<vertsZ;iz++){
    float z=gOriginZ+minf(endZ,startZ+(float)iz*cellStep);
    for(int ix=0;ix<vertsX;ix++){
      float x=gOriginX+minf(endX,startX+(float)ix*cellStep);
      float y=stitchedHeight(x,z,step,northLod,eastLod,southLod,westLod,worldMinX,worldMaxX,worldMinZ,worldMaxZ);
      if(y>1e20f)y=gBaseHeight;
      float n[3], color[3]; normalAt(x,z,n); terrainColor(y,n,color); int o=vertex*kVertexStride;
      gMeshVertices[o]=x;gMeshVertices[o+1]=y;gMeshVertices[o+2]=z;gMeshVertices[o+3]=n[0];gMeshVertices[o+4]=n[1];gMeshVertices[o+5]=n[2];gMeshVertices[o+6]=color[0];gMeshVertices[o+7]=color[1];gMeshVertices[o+8]=color[2]; vertex++;
    }
  }
  int indexCount=0;
  for(int iz=0;iz<cellsZ;iz++)for(int ix=0;ix<cellsX;ix++){
    float x0=minf(endX,startX+(float)ix*cellStep), x1=minf(endX,startX+(float)(ix+1)*cellStep);
    float z0=minf(endZ,startZ+(float)iz*cellStep), z1=minf(endZ,startZ+(float)(iz+1)*cellStep);
    float cx=gOriginX+(x0+x1)*0.5f,cz=gOriginZ+(z0+z1)*0.5f; if(manualHole(cx,cz))continue;
    unsigned int a=(unsigned int)(iz*vertsX+ix),b=a+1,c=a+(unsigned int)vertsX,d=c+1;
    gMeshIndices[indexCount++]=a;gMeshIndices[indexCount++]=c;gMeshIndices[indexCount++]=d;gMeshIndices[indexCount++]=a;gMeshIndices[indexCount++]=d;gMeshIndices[indexCount++]=b;
  }
  gMeshVertexFloats=vertex*kVertexStride; gMeshIndexCount=indexCount; return 1;
}

int rift_terrain_build_chunk(int chunkX,int chunkZ,float chunkSize,int lod){
  int step=lod<1?1:lod;
  return rift_terrain_build_section(chunkX,chunkZ,chunkSize,step,step,step,step,step);
}
unsigned int rift_mesh_vertices_ptr(){ return (unsigned int)(unsigned long)gMeshVertices; }
int rift_mesh_vertex_float_count(){ return gMeshVertexFloats; }
unsigned int rift_mesh_indices_ptr(){ return (unsigned int)(unsigned long)gMeshIndices; }
int rift_mesh_index_count(){ return gMeshIndexCount; }

int rift_terrain_raycast(float ox,float oy,float oz,float dx,float dy,float dz,float maxDistance,float step){
  if(!ready()||maxDistance<=0.0f)return 0; if(step<=0.0f)step=1.0f;
  float len=sqrtf_fast(dx*dx+dy*dy+dz*dz); if(len<1e-6f)return 0; dx/=len;dy/=len;dz/=len;
  bool havePrev=false; float prevT=0,prevDiff=0;
  for(float t=0.1f;t<=maxDistance;t+=step){
    float x=ox+dx*t,y=oy+dy*t,z=oz+dz*t,h=sample(x,z); if(h>1e20f){havePrev=false;continue;} float diff=y-h;
    if(absf(diff)<0.02f){gRaycast[0]=x;gRaycast[1]=h;gRaycast[2]=z;gRaycast[3]=t;return 1;}
    if(havePrev && ((prevDiff>0&&diff<=0)||(prevDiff<0&&diff>=0))){
      float lo=prevT,hi=t; float sign=prevDiff>=0?1.0f:-1.0f;
      for(int i=0;i<12;i++){float mid=(lo+hi)*0.5f,mx=ox+dx*mid,my=oy+dy*mid,mz=oz+dz*mid,mh=sample(mx,mz);if(mh>1e20f){lo=mid;continue;}float md=my-mh;if((md>=0?1.0f:-1.0f)==sign)lo=mid;else hi=mid;}
      float ft=(lo+hi)*0.5f,fx=ox+dx*ft,fz=oz+dz*ft,fh=sample(fx,fz);gRaycast[0]=fx;gRaycast[1]=fh;gRaycast[2]=fz;gRaycast[3]=ft;return 1;
    }
    havePrev=true;prevT=t;prevDiff=diff;
  }
  return 0;
}
unsigned int rift_raycast_ptr(){ return (unsigned int)(unsigned long)gRaycast; }
}
