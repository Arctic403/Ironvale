import fs from 'node:fs';

const OUT='public/rift-world-blocks/brackenford-lowlands-001.json';
const CONTENT='src/ironvale/content.js';
const W=320,D=320,SEA=2;
const ops=[];
const fill=(state,min,max,name)=>ops.push({op:'fill_box',state,min,max,...(name?{name}:{})});
const set=(state,at,name)=>ops.push({op:'set',state,at,...(name?{name}:{})});
const cut=(min,max,name)=>ops.push({op:'cut_box',min,max,...(name?{name}:{})});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gauss=(x,z,cx,cz,sx,sz,a)=>a*Math.exp(-(((x-cx)/sx)**2+((z-cz)/sz)**2));
const hash=(x,z)=>{const n=Math.sin(x*12.9898+z*78.233)*43758.5453;return n-Math.floor(n);};

const islandField=(x,z)=>{
  const dx=x-158,dz=(z-160)*1.04;
  const a=Math.atan2(dz,dx),r=Math.hypot(dx,dz);
  const coastR=111+15*Math.sin(a*3+0.45)+9*Math.sin(a*5-1.2)+6*Math.cos(a*7+0.7)+4*Math.sin(a*11-0.3);
  let edge=coastR-r;
  edge+=gauss(x,z,161,30,32,34,27);
  edge+=gauss(x,z,260,77,39,37,34);
  edge+=gauss(x,z,278,226,35,43,25);
  edge+=gauss(x,z,74,251,42,36,18);
  edge+=gauss(x,z,42,104,32,43,15);
  edge-=gauss(x,z,45,169,30,42,31);
  edge-=gauss(x,z,154,294,40,27,24);
  edge-=gauss(x,z,287,151,28,38,21);
  edge-=gauss(x,z,99,42,26,29,13);
  edge+=Math.sin(x/8.5+z/13)*1.8+Math.sin(x/17-z/11)*1.3;
  return edge/14;
};

const riverX=z=>132+(z-52)*0.19+Math.sin(z/22)*12+Math.sin(z/47)*7;
const riverW=z=>3.5+(Math.sin(z/29)+1)*1.2;
const roadX=z=>188+Math.sin((z-55)/26)*15+Math.sin(z/12)*3.5;
const basin=(x,z)=>clamp(1-(((x-178)/49)**2+((z-178)/42)**2),0,1);

const height=Array.from({length:D},()=>new Int16Array(W));
const land=Array.from({length:D},()=>new Uint8Array(W));
for(let z=0;z<D;z++)for(let x=0;x<W;x++){
  const coast=islandField(x,z);
  if(coast<=0){height[z][x]=0;continue;}
  land[z][x]=1;
  let h=3;
  h+=gauss(x,z,259,73,39,34,26);
  h+=gauss(x,z,235,111,55,29,10);
  h+=gauss(x,z,67,91,44,50,8);
  h+=gauss(x,z,71,248,52,40,6);
  h+=gauss(x,z,246,250,54,45,7);
  h+=gauss(x,z,158,59,46,24,4);
  h+=(Math.sin(x/18)+Math.cos(z/21)+Math.sin((x+z)/34))*0.7;
  const b=basin(x,z);h=h*(1-b*0.68)+3.1*(b*0.68);
  const d=Math.abs(x-riverX(z)),rw=riverW(z);
  if(z>42&&z<287&&d<=rw)h=1;else if(z>42&&z<287&&d<=rw+5)h=Math.min(h,2+Math.floor((d-rw)/1.7));
  const shore=clamp(coast*5.5,0,1);
  h=SEA+(h-SEA)*shore;
  height[z][x]=clamp(Math.round(h),2,22);
}

fill('sand',[0,0,0],[W-1,0,D-1],'Valeborn sea floor');
fill('water',[0,1,0],[W-1,SEA,D-1],'Valeborn surrounding sea');

for(let z=0;z<D;z++){
  let x=0;
  while(x<W){
    if(!land[z][x]){x++;continue;}
    const h=height[z][x];let e=x;
    while(e+1<W&&land[z][e+1]&&height[z][e+1]===h)e++;
    const shore=h<=3;
    fill(shore?'sand':'dirt',[x,1,z],[e,h-1,z],shore?'Coastal sand mass':'Island earth');
    fill(shore?'sand':'grass_block',[x,h,z],[e,h,z],shore?'Natural shoreline':'Island turf');
    x=e+1;
  }
}

for(let z=44;z<286;z++){
  const cx=Math.round(riverX(z)),rw=Math.round(riverW(z));
  if(!land[z]?.[cx])continue;
  const l=clamp(cx-rw,1,W-2),r=clamp(cx+rw,1,W-2);
  fill('sand',[l,1,z],[r,1,z],'Brackenford river bed');
  fill('water',[l,2,z],[r,2,z],'Brackenford River');
  if(land[z][l-1])set('gravel',[l-1,height[z][l-1],z],'River gravel bank');
  if(land[z][r+1])set('gravel',[r+1,height[z][r+1],z],'River gravel bank');
}

for(let z=62;z<267;z++){
  const cx=Math.round(roadX(z));
  if(!land[z][cx])continue;
  const sample=[-2,-1,0,1,2].filter(dx=>land[z][cx+dx]).map(dx=>height[z][cx+dx]);
  if(!sample.length)continue;
  const y=Math.min(...sample);
  fill('dirt_dry',[cx-2,y,z],[cx+2,y,z],'Old North Road verge');
  fill('gravel',[cx-1,y,z],[cx+1,y,z],'Old North Road');
}

function stampTrail(points,name){
  const seen=new Set();
  for(let i=0;i<points.length-1;i++){
    const [x0,z0]=points[i],[x1,z1]=points[i+1],steps=Math.max(Math.abs(x1-x0),Math.abs(z1-z0))*2;
    for(let s=0;s<=steps;s++){
      const t=s/steps,cx=Math.round(x0+(x1-x0)*t),cz=Math.round(z0+(z1-z0)*t);
      for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){
        const x=cx+ox,z=cz+oz,k=x+'|'+z;
        if(x<1||z<1||x>=W-1||z>=D-1||!land[z][x]||seen.has(k))continue;
        seen.add(k);set('dirt_dry',[x,height[z][x],z],name);
      }
    }
  }
}
stampTrail([[80,238],[102,224],[126,211],[151,197],[177,184],[198,171]],'Western meadow trail');
stampTrail([[198,153],[216,136],[233,116],[247,103],[254,96],[259,92]],'Blackstone mountain trail');
stampTrail([[173,186],[164,205],[153,225],[143,245],[134,264]],'South valley trail');

cut([252,4,86],[262,13,98],'Blackstone cave entrance cut');
cut([240,4,88],[258,12,96],'Blackstone cave tunnel');
cut([226,4,82],[244,14,101],'Blackstone cave chamber');
fill('stone_dark',[228,3,87],[260,3,97],'Blackstone cave floor');
fill('mossy_stone',[258,4,85],[260,11,87],'Blackstone cave mouth north pier');
fill('mossy_stone',[258,4,97],[260,11,99],'Blackstone cave mouth south pier');
fill('stone_dark',[256,11,87],[260,14,97],'Blackstone cave brow');

for(const [cx,cz,r] of [[273,86,5],[247,55,4],[231,122,4],[46,108,4],[78,69,3],[231,242,3],[83,254,3]]){
  for(let z=cz-r;z<=cz+r;z++)for(let x=cx-r;x<=cx+r;x++){
    if(x<0||z<0||x>=W||z>=D||!land[z][x]||(x-cx)**2+(z-cz)**2>r*r)continue;
    if(hash(x+7,z+13)>.5)set(hash(x,z)>.5?'stone':'mossy_stone',[x,height[z][x],z],'Natural rock outcrop');
  }
}

let trees=0;
for(let z=10;z<D-10;z+=6)for(let x=10;x<W-10;x+=6){
  if(!land[z][x])continue;
  const h=height[z][x],nearRiver=z>42&&z<287&&Math.abs(x-riverX(z))<11,nearRoad=z>62&&z<267&&Math.abs(x-roadX(z))<8;
  const central=basin(x,z)>.28;
  const woodland=h>=8||(x<105&&z<150)||(z>246&&x>195)||(x<105&&z>210);
  if(!woodland||central||nearRiver||nearRoad||hash(x*3,z*5)<=.45)continue;
  fill('oak_wood',[x,h+1,z],[x,h+4,z],'Tree trunk');
  fill('grass_detail',[x-1,h+5,z-1],[x+1,h+6,z+1],'Tree crown detail');trees++;
}

for(let z=14;z<D-14;z+=7)for(let x=14;x<W-14;x+=7){
  if(!land[z][x])continue;
  const h=height[z][x];
  if(h>3&&h<=6&&Math.abs(x-riverX(z))>9&&hash(x+31,z+17)>.32)set('grass_detail',[x,h+1,z],'Lowland grass');
}

const world={
  format:'riftcity-city-block',version:2,id:'brackenford-lowlands-001',name:'Valeborn Starter Island · Natural Terrain Pass',units:'meters',
  grid:{cell_size:1,shape_increment:0.5},origin:[0,0,0],bounds:{min:[0,0,0],max:[319,28,319]},
  palette:{air:{material_id:0,shape:'air',color:[0,0,0]}},ops,prefabs:{},layout:[],
  anchors:{
    future_settlement_basin:{at:[178,4,178],facing:'north',tags:['future-town','central-meadow']},
    blackstone_cave:{at:[259,4,92],facing:'east',tags:['cave','mountain']},
    river_crossing:{at:[155,3,181],facing:'east',tags:['river','future-crossing']},
    old_north_road:{at:[194,4,154],facing:'north',tags:['road']},
    western_questlands:{at:[84,6,207],facing:'east',tags:['future-quest-pocket','western-hills']},
    southern_lowlands:{at:[157,4,257],facing:'north',tags:['future-quest-pocket','south-valley']},
    north_coast:{at:[160,3,28],facing:'south',tags:['coast','future-quest-pocket']},
    western_bay:{at:[57,3,171],facing:'east',tags:['coast','bay']},
    southeast_peninsula:{at:[273,4,225],facing:'west',tags:['coast','peninsula']}
  },
  validation:{overlap_policy:'allow'},
  metadata:{terrain_pass:'starter-island-v1',visual_surface:'smooth-terrain-v1',environment_pack:'quaternius-stylized-nature-standard',buildings:false,island:true,surrounded_by_water:true,coastline:'organic-multilobed',features:['ocean','irregular-coastline','bays','coves','peninsulas','mountain','cave','river','rolling-hills','valleys','old-road','footpaths','woodland','central-settlement-basin','questland-reserves']}
};
fs.writeFileSync(OUT,JSON.stringify(world,null,2)+'\n');

let content=fs.readFileSync(CONTENT,'utf8');
content=content.replace(/description: 'A broad river valley of rolling meadow, wooded hills and the Blackstone mountain ridge\. The settlement itself will be placed only after the natural terrain and travel routes are locked\.'/,
  "description: 'A large Valeborn island surrounded by open water, with an irregular coast of bays and peninsulas, wooded uplands, river valleys, rolling questlands and the Blackstone mountain dominating the east. Brackenford will be placed later inside the central meadow basin.'");
content=content.replace(/spawn: \{ id: 'valeborn-training-yard', position: \[[^\]]+\], facing: 0 \}/,"spawn: { id: 'valeborn-training-yard', position: [178, 4, 178], facing: 0 }");
fs.writeFileSync(CONTENT,content);
console.log(`[valeborn-island] organic coastline ${W}x${D}; ops=${ops.length}; trees=${trees}; buildings=0`);
