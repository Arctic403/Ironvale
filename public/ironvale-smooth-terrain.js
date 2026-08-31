const W=320,D=320,SEA=2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gauss=(x,z,cx,cz,sx,sz,a)=>a*Math.exp(-(((x-cx)/sx)**2+((z-cz)/sz)**2));

export function valebornIslandField(x,z){
  const dx=x-158,dz=(z-160)*1.04;
  const a=Math.atan2(dz,dx),r=Math.hypot(dx,dz);
  const coastR=111+15*Math.sin(a*3+0.45)+9*Math.sin(a*5-1.2)+6*Math.cos(a*7+0.7)+4*Math.sin(a*11-0.3);
  let edge=coastR-r;
  edge+=gauss(x,z,161,30,32,34,27)+gauss(x,z,260,77,39,37,34)+gauss(x,z,278,226,35,43,25)+gauss(x,z,74,251,42,36,18)+gauss(x,z,42,104,32,43,15);
  edge-=gauss(x,z,45,169,30,42,31)+gauss(x,z,154,294,40,27,24)+gauss(x,z,287,151,28,38,21)+gauss(x,z,99,42,26,29,13);
  edge+=Math.sin(x/8.5+z/13)*1.8+Math.sin(x/17-z/11)*1.3;
  return edge/14;
}
export const valebornRiverX=z=>132+(z-52)*0.19+Math.sin(z/22)*12+Math.sin(z/47)*7;
export const valebornRiverW=z=>3.5+(Math.sin(z/29)+1)*1.2;
export const valebornRoadX=z=>188+Math.sin((z-55)/26)*15+Math.sin(z/12)*3.5;
const basin=(x,z)=>clamp(1-(((x-178)/49)**2+((z-178)/42)**2),0,1);

export function valebornTerrainHeight(x,z){
  const coast=valebornIslandField(x,z);
  if(coast<=0)return 0.25;
  let h=3;
  h+=gauss(x,z,259,73,39,34,26)+gauss(x,z,235,111,55,29,10)+gauss(x,z,67,91,44,50,8)+gauss(x,z,71,248,52,40,6)+gauss(x,z,246,250,54,45,7)+gauss(x,z,158,59,46,24,4);
  h+=(Math.sin(x/18)+Math.cos(z/21)+Math.sin((x+z)/34))*0.7;
  const b=basin(x,z);h=h*(1-b*0.68)+3.1*(b*0.68);
  const d=Math.abs(x-valebornRiverX(z)),rw=valebornRiverW(z);
  if(z>42&&z<287&&d<=rw)h=1.15;
  else if(z>42&&z<287&&d<=rw+5)h=Math.min(h,1.55+(d-rw)*0.38);
  const shore=clamp(coast*5.5,0,1);
  h=SEA+(h-SEA)*shore;
  return clamp(h,0.25,22);
}

function normalAt(x,z){
  const dx=valebornTerrainHeight(x+1,z)-valebornTerrainHeight(x-1,z);
  const dz=valebornTerrainHeight(x,z+1)-valebornTerrainHeight(x,z-1);
  const nx=-dx,ny=2,nz=-dz,l=Math.hypot(nx,ny,nz)||1;
  return [nx/l,ny/l,nz/l];
}
function colorAt(x,z,h,n){
  const coast=valebornIslandField(x,z);
  if(coast<=0)return [0.27,0.25,0.20];
  const slope=1-n[1];
  if(h<2.65||coast<0.12)return [0.69,0.61,0.42];
  if(slope>0.30||h>15)return [0.43,0.45,0.42];
  if(z>62&&z<267&&Math.abs(x-valebornRoadX(z))<2.2)return [0.43,0.36,0.24];
  if(z>42&&z<287&&Math.abs(x-valebornRiverX(z))<valebornRiverW(z)+2.0)return [0.50,0.45,0.31];
  const shade=clamp(0.02*Math.sin(x*0.11)+0.025*Math.cos(z*0.09),-0.04,0.04);
  const high=clamp((h-5)/12,0,1);
  return [0.27+shade-high*0.04,0.43+shade-high*0.06,0.20+shade-high*0.02];
}

function makeTerrainChunk(x0,z0,size=32,step=2){
  const cols=Math.floor(size/step)+1,rows=cols;
  const vertices=new Float32Array(cols*rows*9);
  for(let rz=0;rz<rows;rz++)for(let rx=0;rx<cols;rx++){
    const x=Math.min(W-1,x0+rx*step),z=Math.min(D-1,z0+rz*step),h=valebornTerrainHeight(x,z),n=normalAt(x,z),c=colorAt(x,z,h,n),o=(rz*cols+rx)*9;
    vertices[o]=x;vertices[o+1]=h;vertices[o+2]=z;
    vertices[o+3]=n[0];vertices[o+4]=n[1];vertices[o+5]=n[2];
    vertices[o+6]=c[0];vertices[o+7]=c[1];vertices[o+8]=c[2];
  }
  const indices=new Uint16Array((cols-1)*(rows-1)*6);let p=0;
  for(let z=0;z<rows-1;z++)for(let x=0;x<cols-1;x++){
    const a=z*cols+x,b=a+1,c=a+cols,d=c+1;
    indices[p++]=a;indices[p++]=c;indices[p++]=b;
    indices[p++]=b;indices[p++]=c;indices[p++]=d;
  }
  return {vertices,indices,vertexStride:9};
}
function makeOcean(){
  const y=2.02,vertices=new Float32Array([
    -96,y,-96,0,1,0,0.16,0.31,0.40,
    416,y,-96,0,1,0,0.16,0.31,0.40,
    -96,y,416,0,1,0,0.13,0.28,0.38,
    416,y,416,0,1,0,0.13,0.28,0.38
  ]);
  return {vertices,indices:new Uint16Array([0,2,1,1,2,3]),vertexStride:9};
}

export function createValebornSmoothTerrain(engine,{chunkSize=32,step=2}={}){
  const drawables=[];
  const ocean=engine.addMesh(makeOcean(),{color:'#ffffff',noise:0.04,blockGrid:0,blockFaceShade:0,doubleSided:true});
  ocean.doubleSided=true;drawables.push(ocean);
  for(let z=0;z<D-1;z+=chunkSize)for(let x=0;x<W-1;x+=chunkSize){
    const drawable=engine.addMesh(makeTerrainChunk(x,z,Math.min(chunkSize,W-1-x),step),{color:'#ffffff',noise:0.055,blockGrid:0,blockFaceShade:0,doubleSided:false});
    drawable.doubleSided=false;drawables.push(drawable);
  }
  return {drawables,destroy(){engine.removeDrawables(drawables);},heightAt:valebornTerrainHeight};
}

export function validateValebornSmoothTerrain(){
  const failures=[];
  if(valebornIslandField(158,160)<=0)failures.push('island center');
  if(valebornIslandField(0,0)>0)failures.push('ocean corner');
  if(valebornTerrainHeight(250,80)<12)failures.push('Blackstone mountain height');
  if(valebornTerrainHeight(178,178)>6)failures.push('central basin height');
  return {ok:failures.length===0,failures};
}
