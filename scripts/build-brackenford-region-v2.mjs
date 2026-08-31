import fs from 'node:fs';

const OUT='public/rift-world-blocks/brackenford-lowlands-001.json';
const CONTENT='src/ironvale/content.js';
const W=160,D=160;
const ops=[];
const fill=(state,min,max,name)=>ops.push({op:'fill_box',state,min,max,...(name?{name}:{})});
const set=(state,at,name)=>ops.push({op:'set',state,at,...(name?{name}:{})});
const cut=(min,max,name)=>ops.push({op:'cut_box',min,max,...(name?{name}:{})});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gauss=(x,z,cx,cz,sx,sz,a)=>a*Math.exp(-(((x-cx)/sx)**2+((z-cz)/sz)**2));
const hash=(x,z)=>{const n=Math.sin(x*12.9898+z*78.233)*43758.5453;return n-Math.floor(n);};
const riverX=z=>47+z*0.16+Math.sin(z/17)*8+Math.sin(z/41)*5;
const riverW=z=>3.2+(Math.sin(z/23)+1)*0.9;
const roadX=z=>91+Math.sin((z-20)/21)*10+Math.sin(z/9)*2.5;
const basin=(x,z)=>clamp(1-(((x-82)/34)**2+((z-92)/30)**2),0,1);

const height=Array.from({length:D},()=>new Int16Array(W));
for(let z=0;z<D;z++)for(let x=0;x<W;x++){
  let h=2+gauss(x,z,137,27,25,22,18)+gauss(x,z,119,44,34,18,7)+gauss(x,z,24,43,24,25,5)+gauss(x,z,28,128,30,24,4)+gauss(x,z,118,131,34,28,4)+gauss(x,z,77,34,28,15,2.5);
  h+=(Math.sin(x/13)+Math.cos(z/17)+Math.sin((x+z)/25))*0.42;
  const b=basin(x,z); h=h*(1-b*0.72)+2.1*(b*0.72);
  const d=Math.abs(x-riverX(z)),rw=riverW(z);
  if(d<=rw)h=1;else if(d<=rw+3)h=Math.min(h,2+Math.floor((d-rw)/1.5));
  height[z][x]=clamp(Math.round(h),1,24);
}

// Compact natural terrain runs.
for(let z=0;z<D;z++){
  let x=0;
  while(x<W){const h=height[z][x];let e=x;while(e+1<W&&height[z][e+1]===h)e++;fill('dirt',[x,0,z],[e,h-1,z],'Natural earth');fill('grass_block',[x,h,z],[e,h,z],'Natural turf');x=e+1;}
}

// Curved river and banks: one compact span per row.
for(let z=2;z<D-2;z++){
  const cx=Math.round(riverX(z)),rw=Math.round(riverW(z));
  fill('sand',[cx-rw,1,z],[cx+rw,1,z],'River bed');
  fill('water',[cx-rw,2,z],[cx+rw,2,z],'Brackenford River');
  set('gravel',[cx-rw-1,height[z][cx-rw-1],z],'River gravel bank');
  set('gravel',[cx+rw+1,height[z][cx+rw+1],z],'River gravel bank');
}

// Curving old road through the valley.
for(let z=6;z<154;z++){
  const cx=Math.round(roadX(z)),y=Math.min(...[-2,-1,0,1,2].map(dx=>height[z][cx+dx]));
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
        const x=cx+ox,z=cz+oz,k=x+'|'+z;if(x<1||z<1||x>=W-1||z>=D-1||seen.has(k))continue;seen.add(k);set('dirt_dry',[x,height[z][x],z],name);
      }
    }
  }
}
stampTrail([[26,122],[34,112],[47,105],[61,98],[76,94],[90,91]],'Meadow footpath');
stampTrail([[92,78],[104,68],[115,58],[124,49],[131,42],[136,37]],'Blackstone cave trail');

// Cave cut directly into the mountain mass.
cut([132,3,27],[145,11,33],'Blackstone cave entrance cut');
cut([137,3,22],[148,10,32],'Blackstone cave tunnel');
cut([143,3,15],[155,12,29],'Blackstone cave chamber');
fill('stone_dark',[132,2,28],[150,2,32],'Blackstone cave floor');
fill('mossy_stone',[131,3,27],[132,9,27],'Blackstone cave mouth west pier');
fill('mossy_stone',[131,3,33],[132,9,33],'Blackstone cave mouth east pier');
fill('stone_dark',[132,9,28],[136,11,32],'Blackstone cave brow');

// Rock outcrops.
for(const [cx,cz,r] of [[147,39,4],[124,19,3],[117,52,3],[15,50,3],[35,30,2],[111,126,2]])for(let z=cz-r;z<=cz+r;z++)for(let x=cx-r;x<=cx+r;x++){
  if(x<0||z<0||x>=W||z>=D||(x-cx)**2+(z-cz)**2>r*r)continue;
  if(hash(x+7,z+13)>.46)set(hash(x,z)>.5?'stone':'mossy_stone',[x,height[z][x],z],'Natural rock outcrop');
}

// Woodland follows ridges/edges rather than filling the future settlement basin.
let trees=0;
for(let z=6;z<D-6;z+=5)for(let x=6;x<W-6;x+=5){
  const h=height[z][x],nearRiver=Math.abs(x-riverX(z))<9,nearRoad=Math.abs(x-roadX(z))<7;
  const woodland=h>=6||(x<42&&z<85)||(z>132&&x>84);
  if(!woodland||nearRiver||nearRoad||hash(x*3,z*5)<=.44)continue;
  fill('oak_wood',[x,h+1,z],[x,h+4,z],'Tree trunk');
  fill('grass_detail',[x-1,h+5,z-1],[x+1,h+6,z+1],'Tree crown detail');trees++;
}

// Sparse meadow detail.
for(let z=10;z<150;z+=5)for(let x=10;x<150;x+=5){
  if(Math.abs(x-riverX(z))<8||Math.abs(x-roadX(z))<6)continue;
  const h=height[z][x];if(h<=4&&hash(x+31,z+17)>.3)set('grass_detail',[x,h+1,z],'Meadow grass');
}

const world={format:'riftcity-city-block',version:2,id:'brackenford-lowlands-001',name:'Brackenford Lowlands · Natural Terrain Pass',units:'meters',grid:{cell_size:1,shape_increment:0.5},origin:[0,0,0],bounds:{min:[0,0,0],max:[159,31,159]},palette:{air:{material_id:0,shape:'air',color:[0,0,0]}},ops,prefabs:{},layout:[],anchors:{future_settlement_basin:{at:[82,3,92],facing:'north',tags:['future-town','meadow']},blackstone_cave:{at:[133,3,30],facing:'east',tags:['cave','mountain']},river_crossing:{at:[62,3,95],facing:'east',tags:['river','future-crossing']},north_road:{at:[90,3,78],facing:'north',tags:['road']}},validation:{overlap_policy:'allow'},metadata:{terrain_pass:'natural-v1',buildings:false,features:['mountain','cave','river','rolling-hills','valley','old-road','footpaths','woodland','future-settlement-basin']}};
fs.writeFileSync(OUT,JSON.stringify(world,null,2)+'\n');

let content=fs.readFileSync(CONTENT,'utf8');
content=content.replace(/description: 'Fields, training yards, workshops and old military roads surrounding the walled village of Brackenford\.'/,"description: 'A broad river valley of rolling meadow, wooded hills and the Blackstone mountain ridge. The settlement itself will be placed only after the natural terrain and travel routes are locked.'");
content=content.replace(/spawn: \{ id: 'valeborn-training-yard', position: \[[^\]]+\], facing: 0 \}/,"spawn: { id: 'valeborn-training-yard', position: [82, 3, 92], facing: 0 }");
fs.writeFileSync(CONTENT,content);
console.log(`[brackenford-natural] wrote ${ops.length} ops; trees=${trees}; buildings=0`);
