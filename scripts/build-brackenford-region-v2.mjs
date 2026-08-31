import fs from 'node:fs';

const OUT='public/rift-world-blocks/brackenford-lowlands-001.json';
const CONTENT='src/ironvale/content.js';
const W=160, D=160, MAX_Y=31;
const ops=[];
const fill=(state,min,max,name)=>ops.push({op:'fill_box',state,min,max,...(name?{name}:{})});
const set=(state,at,name)=>ops.push({op:'set',state,at,...(name?{name}:{})});
const cut=(min,max,name)=>ops.push({op:'cut_box',min,max,...(name?{name}:{})});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gaussian=(x,z,cx,cz,sx,sz,amp)=>amp*Math.exp(-(((x-cx)/sx)**2+((z-cz)/sz)**2));
const hash=(x,z)=>{const n=Math.sin(x*12.9898+z*78.233)*43758.5453;return n-Math.floor(n);};

function riverX(z){return 47 + z*0.16 + Math.sin(z/17)*8 + Math.sin(z/41)*5;}
function riverWidth(z){return 3.2 + (Math.sin(z/23)+1)*0.9;}
function pathX(z){return 91 + Math.sin((z-20)/21)*10 + Math.sin(z/9)*2.5;}
function basinBlend(x,z){const dx=(x-82)/34,dz=(z-92)/30;return clamp(1-(dx*dx+dz*dz),0,1);}

const height=Array.from({length:D},()=>new Int16Array(W));
for(let z=0;z<D;z++){
  for(let x=0;x<W;x++){
    let h=2;
    h+=gaussian(x,z,137,27,25,22,18);      // Blackstone mountain mass
    h+=gaussian(x,z,119,44,34,18,7);       // foothill ridge
    h+=gaussian(x,z,24,43,24,25,5);        // western hills
    h+=gaussian(x,z,28,128,30,24,4);       // southwest rolling hill
    h+=gaussian(x,z,118,131,34,28,4);      // southeast rise
    h+=gaussian(x,z,77,34,28,15,2.5);      // north low ridge
    h+=(Math.sin(x/11)+Math.cos(z/14)+Math.sin((x+z)/19))*0.55;
    h+=(hash(x,z)-0.5)*0.9;
    const basin=basinBlend(x,z);
    h=h*(1-basin*0.72)+2.1*(basin*0.72);   // broad future settlement meadow
    const rx=riverX(z), rw=riverWidth(z), rd=Math.abs(x-rx);
    if(rd<=rw) h=1;
    else if(rd<=rw+3) h=Math.min(h,2+Math.floor((rd-rw)/1.5));
    height[z][x]=clamp(Math.round(h),1,24);
  }
}

// RLE terrain columns by row/height so the region remains compact and fast to import.
for(let z=0;z<D;z++){
  let x=0;
  while(x<W){
    const h=height[z][x]; let end=x;
    while(end+1<W && height[z][end+1]===h) end++;
    fill('dirt',[x,0,z],[end,h-1,z],'Natural earth');
    fill('grass_block',[x,h,z],[end,h,z],'Natural turf');
    x=end+1;
  }
}

// River: lower channel, sand/gravel banks and real fluid cells following a curved valley.
for(let z=2;z<D-2;z++){
  const cx=Math.round(riverX(z)), rw=Math.round(riverWidth(z));
  for(let x=cx-rw-2;x<=cx+rw+2;x++){
    if(x<1||x>=W-1) continue;
    const d=Math.abs(x-cx);
    if(d<=rw){
      set('sand',[x,1,z],'River bed');
      set('water',[x,2,z],'Brackenford River');
    }else if(d===rw+1){
      const y=height[z][x]; set('gravel',[x,y,z],'River gravel bank');
    }
  }
}

// Curving old road through the valley. It bends around hills and the mountain rather than crossing them.
for(let z=6;z<154;z++){
  const cx=Math.round(pathX(z));
  for(let dx=-2;dx<=2;dx++){
    const x=cx+dx;if(x<1||x>=W-1)continue;
    const y=height[z][x];set(Math.abs(dx)===2?'dirt_dry':'gravel',[x,y,z],'Old North Road');
  }
}
// West meadow trail and mountain approach trail.
const trails=[
  [[26,122],[34,112],[47,105],[61,98],[76,94],[90,91]],
  [[92,78],[104,68],[115,58],[124,49],[131,42],[136,37]]
];
function stampTrail(points,name){
  for(let i=0;i<points.length-1;i++){
    const [x0,z0]=points[i],[x1,z1]=points[i+1];
    const steps=Math.max(Math.abs(x1-x0),Math.abs(z1-z0))*2;
    for(let s=0;s<=steps;s++){
      const t=s/steps,cx=Math.round(x0+(x1-x0)*t),cz=Math.round(z0+(z1-z0)*t);
      for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){
        const x=cx+ox,z=cz+oz;if(x<1||z<1||x>=W-1||z>=D-1)continue;
        set('dirt_dry',[x,height[z][x],z],name);
      }
    }
  }
}
stampTrail(trails[0],'Meadow footpath');
stampTrail(trails[1],'Blackstone cave trail');

// Blackstone cave: carved into the actual mountain flank, with a recessed mouth, tunnel and chamber.
cut([132,3,27],[145,11,33],'Blackstone cave entrance cut');
cut([137,3,22],[148,10,32],'Blackstone cave tunnel');
cut([143,3,15],[155,12,29],'Blackstone cave chamber');
// Reinforce visible cave floor/walls with rock so the opening reads as part of the mountain.
fill('stone_dark',[132,2,28],[150,2,32],'Blackstone cave floor');
fill('mossy_stone',[131,3,27],[132,9,27],'Blackstone cave mouth west pier');
fill('mossy_stone',[131,3,33],[132,9,33],'Blackstone cave mouth east pier');
fill('stone_dark',[132,9,28],[136,11,32],'Blackstone cave brow');

// Natural rocky outcrops on the mountain and western hills.
for(const [cx,cz,r] of [[147,39,4],[124,19,3],[117,52,3],[15,50,3],[35,30,2],[111,126,2]]){
  for(let z=cz-r;z<=cz+r;z++)for(let x=cx-r;x<=cx+r;x++){
    if(x<0||z<0||x>=W||z>=D)continue;
    if((x-cx)**2+(z-cz)**2>r*r)continue;
    const y=height[z][x]; if(hash(x+7,z+13)>.46)set(hash(x,z)>.5?'stone':'mossy_stone',[x,y,z],'Natural rock outcrop');
  }
}

// Tree lines follow slopes and valley edges. No town/buildings are generated in this pass.
const treeCells=[];
for(let z=5;z<D-5;z+=4){
  for(let x=5;x<W-5;x+=4){
    const h=height[z][x], nearRiver=Math.abs(x-riverX(z))<9, nearRoad=Math.abs(x-pathX(z))<7;
    const mountain=h>=6, westWood=x<42&&z<85, southEdge=z>130&&x>82;
    if((mountain||westWood||southEdge) && !nearRiver && !nearRoad && hash(x*3,z*5)>.48) treeCells.push([x,h+1,z]);
  }
}
for(const [x,y,z] of treeCells){
  fill('oak_wood',[x,y,z],[x,y+3,z],'Tree trunk');
  fill('grass_detail',[x-1,y+4,z-1],[x+1,y+5,z+1],'Tree crown detail');
}

// Grass detail in meadows, but keep roads/river clear.
for(let z=8;z<152;z+=3)for(let x=8;x<152;x+=3){
  if(Math.abs(x-riverX(z))<8||Math.abs(x-pathX(z))<6)continue;
  const h=height[z][x]; if(h<=4&&hash(x+31,z+17)>.35)set('grass_detail',[x,h+1,z],'Meadow grass');
}

const world={
  format:'riftcity-city-block',version:2,id:'brackenford-lowlands-001',name:'Brackenford Lowlands · Natural Terrain Pass',units:'meters',
  grid:{cell_size:1,shape_increment:0.5},origin:[0,0,0],bounds:{min:[0,0,0],max:[159,31,159]},
  palette:{air:{material_id:0,shape:'air',color:[0,0,0]}},
  ops,prefabs:{},layout:[],anchors:{
    future_settlement_basin:{at:[82,3,92],facing:'north',tags:['future-town','meadow']},
    blackstone_cave:{at:[133,3,30],facing:'east',tags:['cave','mountain']},
    river_crossing:{at:[62,3,95],facing:'east',tags:['river','future-crossing']},
    north_road:{at:[90,3,78],facing:'north',tags:['road']}
  },
  validation:{overlap_policy:'allow'},
  metadata:{terrain_pass:'natural-v1',buildings:false,features:['mountain','cave','river','rolling-hills','valley','old-road','footpaths','woodland','future-settlement-basin']}
};
fs.writeFileSync(OUT,JSON.stringify(world,null,2)+'\n');

let content=fs.readFileSync(CONTENT,'utf8');
content=content.replace("description: 'Fields, training yards, workshops and old military roads surrounding the walled village of Brackenford.'","description: 'A broad river valley of rolling meadow, wooded hills and the Blackstone mountain ridge. The settlement itself will be placed only after the natural terrain and travel routes are locked.'");
content=content.replace("spawn: { id: 'valeborn-training-yard', position: [82, 2, 71], facing: 0 }","spawn: { id: 'valeborn-training-yard', position: [82, 3, 92], facing: 0 }")
  .replace("spawn: { id: 'valeborn-training-yard', position: [20, 2, 22], facing: 0 }","spawn: { id: 'valeborn-training-yard', position: [82, 3, 92], facing: 0 }");
fs.writeFileSync(CONTENT,content);
console.log(`[brackenford-natural] wrote ${ops.length} terrain/path ops; trees=${treeCells.length}; buildings=0`);
