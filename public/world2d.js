import { DOWNTOWN_GROUND } from './downtown-ground.js';

export const WORLD2D_CONFIG=Object.freeze({
  width:6400,
  height:5697,
  chunkSize:512,
  playerRadius:34,
  walkSpeed:330,
  runSpeed:520,
  interactRadius:130,
  cameraLookAhead:110,
  cameraLerp:0.14,
  minZoom:0.56,
  maxZoom:1.0
});

export const WORLD2D_COLLIDERS=Object.freeze([
  {id:'nw-parking',kind:'rect',x:240,y:430,width:1140,height:1070},
  {id:'north-park-east',kind:'rect',x:3070,y:420,width:1290,height:1080},
  {id:'ne-parking',kind:'rect',x:5470,y:420,width:730,height:1120},
  {id:'west-mid',kind:'rect',x:300,y:1850,width:1120,height:1380},
  {id:'center-mid',kind:'rect',x:2420,y:1840,width:860,height:1350},
  {id:'center-east-small',kind:'rect',x:3540,y:1840,width:670,height:980},
  {id:'east-mid',kind:'rect',x:4580,y:1850,width:870,height:1350},
  {id:'far-east-mid',kind:'rect',x:5620,y:1870,width:640,height:1350},
  {id:'sw-block',kind:'rect',x:260,y:3490,width:1260,height:1220},
  {id:'south-west-parking',kind:'rect',x:1110,y:3490,width:790,height:1220},
  {id:'south-mid-left',kind:'rect',x:2450,y:3490,width:890,height:1200},
  {id:'south-mid',kind:'rect',x:3460,y:3490,width:810,height:1200},
  {id:'south-east',kind:'rect',x:4570,y:3490,width:910,height:1220},
  {id:'far-se-parking',kind:'rect',x:5660,y:3490,width:590,height:1220},
  {id:'harbor-left',kind:'rect',x:0,y:5050,width:1850,height:647},
  {id:'harbor-center-water',kind:'rect',x:3910,y:5260,width:2170,height:437}
]);

export const WORLD2D_LOCATION_POSITIONS=Object.freeze({
  'rift-national-bank':{x:3170,y:2380},
  'rift-civic-hall':{x:2710,y:2380},
  'courthouse':{x:3920,y:2450},
  'company-plaza':{x:1640,y:2440},
  'downtown-core':{x:3170,y:1560},
  'meridian-casino':{x:4810,y:2360},
  'the-exchange':{x:5340,y:2450},
  'rift-mall':{x:1700,y:3850},
  'aurelia-jewelers':{x:4220,y:3850},
  'mercy-point-medical':{x:1000,y:3650},
  'blackridge-detention':{x:5200,y:3860},
  'rift-metropolitan-institute':{x:2800,y:3860},
  'forge-athletics':{x:3650,y:3860},
  'rift-employment-bureau':{x:4400,y:3860},
  'rift-central-precinct':{x:1010,y:2400},
  'northside-pharmacy':{x:5480,y:1500},
  'cornerstone-market':{x:4850,y:1500},
  'riftcity-park':{x:2380,y:1020},
  'greywater-docks':{x:3200,y:5250},
  'breakwater-beach':{x:2500,y:5350},
  'afterdark':{x:2050,y:4600},
  'central-transit':{x:1920,y:2920},
  'rift-international-airport':{x:5900,y:4700},
  'warehouse-district':{x:1180,y:4480},
  'redline-garage':{x:1570,y:4480},
  'blacktop-motors':{x:4040,y:4480},
  'ironline-armory':{x:4680,y:4480},
  'district-supply-co':{x:5340,y:4480},
  'circuit-house':{x:5850,y:4480},
  'safehouse':{x:2350,y:4480},
  'keystone-realty':{x:1230,y:1030},
  'second-chance-exchange':{x:5060,y:1020},
  'saint-vesper-cemetery':{x:4660,y:1030}
});

export function getWorld2DLocationPosition(id,index=0){
  return WORLD2D_LOCATION_POSITIONS[id] || fallbackPosition(index);
}

export function getChunkKey(x,y){
  return `${Math.floor(x/WORLD2D_CONFIG.chunkSize)}:${Math.floor(y/WORLD2D_CONFIG.chunkSize)}`;
}

export function getNearbyChunkKeys(x,y,radius=1){
  const cx=Math.floor(x/WORLD2D_CONFIG.chunkSize), cy=Math.floor(y/WORLD2D_CONFIG.chunkSize);
  const keys=[];
  for(let yy=cy-radius;yy<=cy+radius;yy++)for(let xx=cx-radius;xx<=cx+radius;xx++)keys.push(`${xx}:${yy}`);
  return keys;
}

export function buildSpatialIndex(items){
  const map=new Map();
  items.forEach(item=>{
    const box=itemAabb(item);
    const minX=Math.floor(box.x/WORLD2D_CONFIG.chunkSize), maxX=Math.floor((box.x+box.width)/WORLD2D_CONFIG.chunkSize);
    const minY=Math.floor(box.y/WORLD2D_CONFIG.chunkSize), maxY=Math.floor((box.y+box.height)/WORLD2D_CONFIG.chunkSize);
    for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
      const key=`${cx}:${cy}`;
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(item);
    }
  });
  return map;
}

export function querySpatialIndex(index,x,y,radius=1){
  const out=[],seen=new Set();
  getNearbyChunkKeys(x,y,radius).forEach(key=>{
    for(const item of index.get(key)||[])if(!seen.has(item.id)){
      seen.add(item.id);out.push(item);
    }
  });
  return out;
}

export function playerHitsCollider(x,y,radius,collider){
  if(collider.kind==='rect'){
    const nx=Math.max(collider.x,Math.min(x,collider.x+collider.width));
    const ny=Math.max(collider.y,Math.min(y,collider.y+collider.height));
    return Math.hypot(x-nx,y-ny)<radius;
  }
  if(collider.kind==='poly')return circleVsPolygon(x,y,radius,collider.points||[]);
  return false;
}

export function clampPlayer(x,y,radius){
  return {
    x:Math.max(radius,Math.min(WORLD2D_CONFIG.width-radius,x)),
    y:Math.max(radius,Math.min(WORLD2D_CONFIG.height-radius,y))
  };
}

function fallbackPosition(index){
  const cols=6, padX=720,padY=700;
  return {
    x:padX+(index%cols)*920,
    y:padY+(Math.floor(index/cols)%5)*900
  };
}

function itemAabb(item){
  if(item.kind==='rect')return {x:item.x,y:item.y,width:item.width,height:item.height};
  const pts=item.points||[];
  if(!pts.length)return {x:item.x||0,y:item.y||0,width:1,height:1};
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}

function circleVsPolygon(cx,cy,r,points){
  if(points.length<3)return false;
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if(((a.y>cy)!==(b.y>cy))&&(cx<(b.x-a.x)*(cy-a.y)/(b.y-a.y)+a.x))inside=!inside;
  }
  if(inside)return true;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const vx=b.x-a.x,vy=b.y-a.y,wx=cx-a.x,wy=cy-a.y;
    const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/(vx*vx+vy*vy||1)));
    if(Math.hypot(cx-(a.x+t*vx),cy-(a.y+t*vy))<r)return true;
  }
  return false;
}
