import { loadRiftGltf } from './rift-gltf.js';
import { valebornTerrainHeight, valebornIslandField } from './ironvale-smooth-terrain.js';

const ROOT='./assets/quaternius/stylized-nature/';
export const IRONVALE_NATURE_ASSETS={
  rock1:`${ROOT}Rock_Medium_1.gltf`,
  rock2:`${ROOT}Rock_Medium_2.gltf`,
  rock3:`${ROOT}Rock_Medium_3.gltf`,
  tree:`${ROOT}CommonTree_1.gltf`,
  pine:`${ROOT}Pine_1.gltf`
};

// The eastern formation deliberately uses oversized real meshes on top of the
// smooth mountain. The landform supplies mass; these assets supply cliff faces,
// silhouettes and the cave-mouth break-up without building a mountain from cubes.
const rockPlacements=[
  ['rock1',252,84,6.4,0.2],['rock2',244,84,5.7,1.6],['rock3',252,92,5.2,2.5],
  ['rock2',244,92,6.9,0.8],['rock1',236,76,5.4,2.1],['rock3',244,68,4.8,1.1],
  ['rock1',236,100,4.1,0.4],['rock2',228,108,4.3,2.8],['rock3',252,100,3.8,1.7],
  ['rock2',252,88,3.7,0.0],['rock3',252,96,3.9,1.2],['rock1',244,88,3.5,2.2],
  ['rock1',228,60,3.1,0.7],['rock2',220,84,3.0,2.3],['rock3',220,108,2.8,1.5],
  ['rock1',86,72,2.0,0.5],['rock2',70,92,2.3,2.0],['rock3',53,113,2.0,1.4],
  ['rock2',239,240,2.5,0.9],['rock1',267,224,2.8,2.4],['rock3',88,253,2.3,1.1]
];
const treePlacements=[
  ['tree',72,104,1.0,0.3],['tree',84,88,1.15,1.4],['tree',57,118,0.95,2.7],['tree',94,70,1.1,0.9],
  ['tree',69,220,1.0,2.0],['tree',84,237,1.2,0.5],['tree',104,251,0.95,1.1],['tree',49,235,1.08,2.6],
  ['pine',205,248,1.05,0.8],['pine',225,260,1.2,2.2],['pine',246,246,0.95,1.5],['pine',217,276,1.1,0.2]
];

function optionsFor([,x,z,scale,rotation]){
  return {position:[x,valebornTerrainHeight(x,z)+0.05,z],scale:[scale,scale,scale],rotationY:rotation,color:'#ffffff',noise:0.025,blockGrid:0,blockFaceShade:0,doubleSided:true};
}

async function instantiateShared(engine,key,placements){
  const asset=await loadRiftGltf(new URL(IRONVALE_NATURE_ASSETS[key],import.meta.url));
  const relevant=placements.filter(p=>p[0]===key&&valebornIslandField(p[1],p[2])>0);
  if(!relevant.length)return {drawables:[],bases:[]};
  const drawables=[],bases=[];
  for(const part of asset.parts){
    // Upload each glTF primitive only once. All other instances share the same
    // Rift Engine GPU geometry, which is critical for mobile memory use.
    const base=engine.addMesh(part.geometry,optionsFor(relevant[0]));
    base.doubleSided=true;bases.push(base);drawables.push(base);
    for(let i=1;i<relevant.length;i++){
      const clone=engine.addDrawable(base.geometry,optionsFor(relevant[i]));
      clone.doubleSided=true;drawables.push(clone);
    }
  }
  return {drawables,bases};
}

export async function createIronvaleNatureEnvironment(engine){
  const groups=[];
  for(const key of ['rock1','rock2','rock3'])groups.push(await instantiateShared(engine,key,rockPlacements));
  for(const key of ['tree','pine'])groups.push(await instantiateShared(engine,key,treePlacements));
  const drawables=groups.flatMap(g=>g.drawables),bases=groups.flatMap(g=>g.bases);
  return {
    drawables,
    assetCount:Object.keys(IRONVALE_NATURE_ASSETS).length,
    instanceCount:rockPlacements.length+treePlacements.length,
    destroy(){
      const baseSet=new Set(bases),clones=drawables.filter(d=>!baseSet.has(d));
      engine.removeDrawables(clones);
      engine.removeDrawables(bases);
    }
  };
}

export function validateIronvaleNatureEnvironment(){
  const failures=[];
  if(Object.keys(IRONVALE_NATURE_ASSETS).length<5)failures.push('nature asset manifest');
  if(rockPlacements.length<18)failures.push('rock formations');
  if(treePlacements.length<10)failures.push('tree dressing');
  if(!rockPlacements.some(p=>p[3]>=6))failures.push('large mountain rock scale');
  if(rockPlacements.filter(p=>p[1]>220&&p[1]<260&&p[2]>65&&p[2]<110).length<10)failures.push('Blackstone mountain rock cluster');
  return {ok:failures.length===0,failures};
}
