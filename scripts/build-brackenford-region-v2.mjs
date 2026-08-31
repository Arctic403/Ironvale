import fs from 'node:fs';

const out='public/rift-world-blocks/brackenford-lowlands-001.json';
const contentPath='src/ironvale/content.js';
const ops=[];
const layout=[];
const prefabs={};
const fill=(state,min,max,name)=>ops.push({op:'fill_box',state,min,max,...(name?{name}:{})});
const cut=(min,max,name)=>ops.push({op:'cut_box',min,max,...(name?{name}:{})});
const set=(state,at,name)=>ops.push({op:'set',state,at,...(name?{name}:{})});
const inst=(id,prefab,origin,rotation='north',tags=[])=>layout.push({type:'instance',id,prefab,origin,rotation,tags,allow_overlap:true});
const road=(state,x1,z1,x2,z2,w=4,name='Road')=>{
  if(x1===x2) fill(state,[x1-Math.floor(w/2),1,Math.min(z1,z2)],[x1+Math.ceil(w/2)-1,1,Math.max(z1,z2)],name);
  else if(z1===z2) fill(state,[Math.min(x1,x2),1,z1-Math.floor(w/2)],[Math.max(x1,x2),1,z1+Math.ceil(w/2)-1],name);
};
const atlas=i=>[254/255,i/255,1/255];
const palette={
  air:{material_id:0,shape:'air',color:[0,0,0]},
  aged_roof_e:{material_id:253,shape:'stair',rotation:'east',color:atlas(11),texture:'aged_wood'},
  aged_roof_w:{material_id:253,shape:'stair',rotation:'west',color:atlas(11),texture:'aged_wood'},
  aged_roof_n:{material_id:253,shape:'stair',rotation:'north',color:atlas(11),texture:'aged_wood'},
  aged_roof_s:{material_id:253,shape:'stair',rotation:'south',color:atlas(11),texture:'aged_wood'},
  stone_slab:{material_id:246,shape:'slab_bottom',color:atlas(4),texture:'stone'},
  barley:{material_id:237,shape:'grass_detail',kind:'detail',color:[0.58,0.49,0.18],texture:'barley',height:0.82,width:0.34}
};

function timberHouse(name,w=11,d=9,h=5,{stoneBase=true,chimney=true,porch=true}={}){
  const p=[]; const f=(state,min,max,n)=>p.push({op:'fill_box',state,min,max,name:n}); const c=(min,max,n)=>p.push({op:'cut_box',min,max,name:n});
  f('cobblestone',[1,0,1],[w-2,0,d-2],name+' foundation');
  f(stoneBase?'stone':'aged_wood',[1,1,1],[w-2,2,d-2],name+' lower shell'); c([2,2,2],[w-3,2,d-3],name+' lower room');
  f('aged_wood',[1,3,1],[w-2,h-1,d-2],name+' timber upper'); c([2,3,2],[w-3,h-1,d-3],name+' upper room');
  for(const x of [1,w-2]) for(const z of [1,d-2]) f('oak_wood',[x,1,z],[x,h-1,z],name+' corner beam');
  c([Math.floor(w/2),1,1],[Math.floor(w/2)+1,3,1],name+' front door');
  c([2,2,d-2],[3,3,d-2],name+' rear window'); c([w-4,2,d-2],[w-3,3,d-2],name+' rear window');
  c([1,2,3],[1,3,4],name+' side window'); c([w-2,2,d-5],[w-2,3,d-4],name+' side window');
  const mid=Math.floor((w-1)/2); let y=h;
  for(let i=0;i<=mid-1;i++,y++){ f('aged_roof_e',[i,y,0],[i,y,d-1],name+' roof west '+i); f('aged_roof_w',[w-1-i,y,0],[w-1-i,y,d-1],name+' roof east '+i); if(i>0&&i<mid) f('aged_wood',[i,y,1],[w-1-i,y,d-2],name+' roof fill '+i); }
  if(chimney) f('stone_dark',[w-3,h,Math.max(2,d-3)],[w-2,h+3,Math.max(2,d-2)],name+' chimney');
  if(porch){ f('oak_wood',[Math.max(1,mid-2),1,0],[Math.min(w-2,mid+3),1,0],name+' porch deck'); f('aged_wood',[Math.max(1,mid-2),4,0],[Math.min(w-2,mid+3),4,0],name+' porch awning'); f('oak_wood',[Math.max(1,mid-2),2,0],[Math.max(1,mid-2),3,0],name+' porch post'); f('oak_wood',[Math.min(w-2,mid+3),2,0],[Math.min(w-2,mid+3),3,0],name+' porch post'); }
  return {kind:'building',bounds:{min:[0,0,0],max:[w-1,h+4,d-1]},ops:p,anchors:{door:{at:[Math.floor(w/2),1,1],facing:'south'}}};
}
function barn(){
  const p=[]; const f=(s,a,b,n)=>p.push({op:'fill_box',state:s,min:a,max:b,name:n}); const c=(a,b,n)=>p.push({op:'cut_box',min:a,max:b,name:n});
  const w=17,d=13,h=7; f('cobblestone',[1,0,1],[15,0,11],'Barn stone footing'); f('aged_wood',[1,1,1],[15,6,11],'Barn shell'); c([2,1,2],[14,6,10],'Barn interior');
  for(const x of [1,8,15]){f('oak_wood',[x,1,1],[x,6,1],'Barn front post');f('oak_wood',[x,1,11],[x,6,11],'Barn rear post');}
  c([6,1,1],[10,5,1],'Barn wagon door'); c([3,3,11],[5,5,11],'Barn rear vent'); c([11,3,11],[13,5,11],'Barn rear vent'); f('oak_wood',[2,5,2],[14,5,10],'Barn loft');
  for(let i=0;i<8;i++){f('aged_roof_e',[i,7+i,0],[i,7+i,12],'Barn roof west');f('aged_roof_w',[16-i,7+i,0],[16-i,7+i,12],'Barn roof east');}
  return {kind:'farm',bounds:{min:[0,0,0],max:[16,15,12]},ops:p};
}
function hall(name,w=17,d=13){
  const p=[]; const f=(s,a,b,n)=>p.push({op:'fill_box',state:s,min:a,max:b,name:n}); const c=(a,b,n)=>p.push({op:'cut_box',min:a,max:b,name:n});
  f('cobblestone',[0,0,0],[w-1,0,d-1],name+' foundation'); f('stone',[0,1,0],[w-1,2,d-1],name+' stone lower'); c([1,1,1],[w-2,2,d-2],name+' lower interior'); f('aged_wood',[0,3,0],[w-1,5,d-1],name+' timber upper'); c([1,3,1],[w-2,5,d-2],name+' upper interior');
  for(const x of [0,w-1]) for(const z of [0,d-1]) f('oak_wood',[x,1,z],[x,5,z],name+' framing');
  c([Math.floor(w/2)-1,1,0],[Math.floor(w/2)+1,3,0],name+' main door'); c([0,2,3],[0,3,5],name+' west windows'); c([w-1,2,d-6],[w-1,3,d-4],name+' east windows');
  const mid=Math.floor((w-1)/2); for(let i=0;i<mid;i++){f('aged_roof_e',[i,6+i,0],[i,6+i,d-1],name+' roof west');f('aged_roof_w',[w-1-i,6+i,0],[w-1-i,6+i,d-1],name+' roof east');}
  return {kind:'civic',bounds:{min:[0,0,0],max:[w-1,14,d-1]},ops:p};
}
function smithy(){
  const base=timberHouse('Smithy',13,9,5,{stoneBase:true,chimney:true,porch:false}); const p=[...base.ops]; const f=(s,a,b,n)=>p.push({op:'fill_box',state:s,min:a,max:b,name:n});
  f('cobblestone',[1,0,8],[11,0,12],'Forge yard'); f('oak_wood',[1,1,9],[1,4,12],'Forge canopy posts'); f('oak_wood',[11,1,9],[11,4,12],'Forge canopy posts'); f('aged_wood',[1,5,8],[11,5,12],'Forge canopy'); f('stone_dark',[4,1,10],[7,2,11],'Forge hearth');
  return {kind:'craft',bounds:{min:[0,0,0],max:[12,10,12]},ops:p};
}
function chapel(){
  const p=[];const f=(s,a,b,n)=>p.push({op:'fill_box',state:s,min:a,max:b,name:n});const c=(a,b,n)=>p.push({op:'cut_box',min:a,max:b,name:n}); const w=13,d=17;
  f('cobblestone',[0,0,0],[12,0,16],'Chapel foundation');f('mossy_stone',[0,1,0],[12,6,16],'Chapel shell');c([1,1,1],[11,6,15],'Chapel nave');c([5,1,0],[7,4,0],'Chapel door');c([0,3,5],[0,5,7],'Chapel west lancet');c([12,3,9],[12,5,11],'Chapel east lancet');
  for(let i=0;i<6;i++){f('aged_roof_e',[i,7+i,0],[i,7+i,16],'Chapel roof west');f('aged_roof_w',[12-i,7+i,0],[12-i,7+i,16],'Chapel roof east');}
  f('stone',[4,7,12],[8,12,16],'Chapel bell tower');c([5,8,13],[7,11,15],'Bell chamber');f('aged_wood',[4,13,12],[8,13,16],'Bell roof');
  return {kind:'religious',bounds:{min:[0,0,0],max:[12,14,16]},ops:p};
}
function tree(){return {kind:'vegetation',bounds:{min:[0,0,0],max:[4,7,4]},ops:[{op:'fill_box',state:'oak_wood',min:[2,0,2],max:[2,4,2],name:'Tree trunk'},{op:'fill_box',state:'grass_block',min:[1,4,1],max:[3,6,3],name:'Tree crown'},{op:'fill_box',state:'grass_block',min:[0,5,2],max:[4,5,2],name:'Tree crown spread'},{op:'fill_box',state:'grass_block',min:[2,5,0],max:[2,5,4],name:'Tree crown spread'}]};}

prefabs.cottage=timberHouse('Cottage',11,9,5,{stoneBase:true,chimney:true,porch:true});
prefabs.farmhouse=timberHouse('Farmhouse',15,11,6,{stoneBase:true,chimney:true,porch:true});
prefabs.barn=barn(); prefabs.trainingHall=hall('Warden Training Hall',19,13); prefabs.reeveHall=hall('Reeve Hall',17,15); prefabs.smithy=smithy(); prefabs.chapel=chapel(); prefabs.inn=timberHouse('Wayfarer Inn',15,11,6,{stoneBase:true,chimney:true,porch:true}); prefabs.tree=tree();

// Base lowland.
fill('dirt',[0,0,0],[159,0,159],'Deep lowland soil'); fill('grass_block',[0,1,0],[159,1,159],'Brackenford lowland turf');
// Rolling west hills.
for(const [i,b] of [[0,[2,2,20,45]],[1,[5,4,17,42]],[2,[8,7,14,39]],[3,[11,10,11,36]]]){const [x1,x2,z1,z2]=b;fill('dirt',[x1,2,z1],[x2,2+i,z2],'West hill earth '+i);fill('grass_block',[x1,3+i,z1],[x2,3+i,z2],'West hill turf '+i);}
// Northeast cave hill / ridge.
const caveLayers=[[116,151,14,53,2],[119,148,17,50,3],[122,145,20,47,4],[125,142,23,44,5],[128,139,26,41,6]];
for(const [x1,x2,z1,z2,h] of caveLayers){fill('dirt',[x1,2,z1],[x2,h,z2],'Blackstone hill earth');fill('grass_block',[x1,h+1,z1],[x2,h+1,z2],'Blackstone hill turf');}
fill('stone_dark',[128,2,28],[151,7,40],'Blackstone cave rock'); cut([128,2,32],[145,5,36],'Blackstone cave tunnel'); cut([136,2,29],[146,6,39],'Blackstone cave chamber'); fill('mossy_stone',[127,2,31],[128,6,37],'Blackstone cave mouth west'); fill('mossy_stone',[127,2,37],[128,6,39],'Blackstone cave mouth east'); cut([127,2,34],[130,5,36],'Blackstone cave entrance');
// Southern/farm rolling rise.
fill('dirt',[0,2,118],[77,2,159],'Southern farm rise');fill('grass_block',[0,3,118],[77,3,159],'Southern farm turf');
// Farm fields and barley rows.
fill('dirt_dry',[5,4,125],[27,4,153],'West barley soil');fill('barley',[6,5,126],[26,5,152],'West barley crop');
fill('dirt_dry',[52,4,124],[74,4,151],'East barley soil');fill('barley',[53,5,125],[73,5,150],'East barley crop');
for(let z=125;z<=153;z+=7) fill('gravel',[5,4,z],[27,4,z],'West field walking row');
for(let z=124;z<=151;z+=7) fill('gravel',[52,4,z],[74,4,z],'East field walking row');
// Stone/hedge boundaries around the farm.
for(let x=3;x<=76;x+=3){set('oak_wood',[x,4,121],'Farm north fence');set('oak_wood',[x,4,155],'Farm south fence');}
for(let z=122;z<=154;z+=3){set('oak_wood',[3,4,z],'Farm west fence');set('oak_wood',[76,4,z],'Farm east fence');}
// Winding village/region road network.
road('gravel',78,46,78,68,5,'South approach'); road('cobblestone',78,68,103,68,5,'Market east lane'); road('cobblestone',52,72,80,72,5,'Market west lane'); road('cobblestone',80,68,80,91,5,'Village spine'); road('gravel',80,91,87,91,4,'North Road jog'); road('gravel',87,91,87,116,4,'Old North Road lower'); road('gravel',87,116,101,116,4,'Old North Road bend'); road('gravel',101,116,101,145,4,'Old North Road upper');
road('gravel',55,72,55,105,3,'West cottage lane'); road('gravel',55,105,42,105,3,'Farm lane bend'); road('gravel',42,105,42,124,3,'Farm lane');
road('gravel',103,68,116,68,3,'East hill lane'); road('gravel',116,68,116,50,3,'East hill turn'); road('gravel',116,50,129,50,3,'Cave trail'); road('gravel',129,50,129,37,3,'Cave approach');
fill('cobblestone',[73,1,66],[85,1,76],'Brackenford market square');
// Training yard.
fill('gravel',[56,1,57],[72,1,70],'Warden training yard'); fill('oak_wood',[57,2,58],[57,3,69],'Training yard rail'); fill('oak_wood',[71,2,58],[71,3,69],'Training yard rail');
// Farm yard on raised ground.
fill('gravel',[28,4,124],[49,4,145],'Farmstead yard');
// Watch hill and ruins.
fill('dirt',[94,2,134],[111,3,151],'North Watch hill');fill('grass_block',[94,4,134],[111,4,151],'North Watch hill turf');fill('stone_dark',[98,5,136],[108,10,146],'North Watch ruin mass');cut([99,5,137],[107,10,145],'North Watch ruined interior');cut([102,5,136],[104,8,138],'North Watch doorway');fill('mossy_stone',[96,5,134],[99,6,137],'North Watch fallen stones');fill('mossy_stone',[108,5,143],[111,6,147],'North Watch fallen stones');
// Broken milestone on road.
fill('mossy_stone',[88,2,109],[88,4,109],'Broken North Road milestone');fill('stone_slab',[88,5,109],[88,5,109],'Milestone cap');

// Buildings: intentionally mixed rotations and setbacks.
inst('warden-training-hall','trainingHall',[51,2,42],'east',['town','training']);
inst('reeve-hall','reeveHall',[76,2,57],'south',['town','civic']);
inst('brackenford-smithy','smithy',[97,2,55],'west',['town','craft']);
inst('saint-orin-chapel','chapel',[67,2,80],'east',['town','religious']);
inst('wayfarer-inn','inn',[87,2,79],'north',['town','inn']);
inst('cottage-west-1','cottage',[43,2,80],'east',['town','home']);
inst('cottage-west-2','cottage',[47,2,94],'south',['town','home']);
inst('cottage-east-1','cottage',[106,2,76],'west',['town','home']);
inst('cottage-east-2','cottage',[102,2,92],'north',['town','home']);
inst('cottage-north-1','cottage',[66,2,101],'west',['town','home']);
inst('cottage-south-1','cottage',[65,2,47],'south',['town','home']);
inst('farmhouse','farmhouse',[24,5,129],'east',['farm','home']);
inst('barn','barn',[39,5,126],'south',['farm','barn']);
// Trees in uneven clusters, leaving roads/fields clear.
const trees=[[15,2,18],[23,2,25],[31,2,17],[40,2,25],[112,2,84],[119,2,88],[125,2,78],[134,2,72],[141,2,65],[148,2,58],[121,2,101],[130,2,106],[139,2,112],[147,2,118],[17,2,78],[24,2,85],[31,2,91],[118,2,11],[108,2,20],[150,2,96],[9,2,103],[18,2,108],[85,2,22],[92,2,31]];
trees.forEach((p,i)=>inst('tree-'+i,'tree',p,['north','east','south','west'][i%4],['vegetation']));

const world={format:'riftcity-city-block',version:2,id:'brackenford-lowlands-001',name:'Brackenford Lowlands · Valeborn Start v2',units:'meters',grid:{cell_size:1,shape_increment:0.5},origin:[0,0,0],bounds:{min:[0,0,0],max:[159,23,159]},palette,prefabs,layout,validation:{overlap_policy:'allow',max_validation_cells:3000000},anchors:{'valeborn-spawn':{at:[63,2,65],facing:'north',tags:['spawn','valeborn']},'farmstead':{at:[37,5,134],facing:'east',tags:['farm']},'blackstone-cave':{at:[129,2,35],facing:'east',tags:['cave','dungeon-future']}},ops};
fs.writeFileSync(out,JSON.stringify(world,null,2)+'\n');

let c=fs.readFileSync(contentPath,'utf8');
const replacements=new Map([
  ["spawn: { id: 'valeborn-training-yard', position: [20, 2, 22], facing: 0 }","spawn: { id: 'valeborn-training-yard', position: [63, 2, 65], facing: 0 }"],
  ["position: [43, 2, 34]","position: [80, 2, 72]"],
  ["position: [30, 2, 22]","position: [68, 2, 65]"],
  ["position: [48, 2, 52]","position: [88, 2, 109]"],
  ["position: [75, 2, 73]","position: [103, 5, 140]"],
  ["position: [88, 2, 84]","position: [129, 2, 35]"],
  ["position: [22, 2, 22]","position: [60, 2, 65]"],
  ["position: [44, 2, 34]","position: [82, 2, 70]"],
  ["position: [58, 2, 30]","position: [101, 2, 66]"],
  ["position: [22, 2, 58]","position: [72, 2, 88]"]
]);
for(const [a,b] of replacements){if(!c.includes(a)) throw new Error('Missing content position: '+a);c=c.replace(a,b);}
c=c.replace("description: 'Fields, training yards, workshops and old military roads surrounding the walled village of Brackenford.'","description: 'A broad working lowland of crooked village lanes, timber-and-stone homes, farms, wooded hills, an abandoned watch and the Blackstone cave ridge around Brackenford.'");
fs.writeFileSync(contentPath,c);
console.log(`[brackenford-v2] wrote ${ops.length} raw ops, ${layout.length} blueprint instances, ${Object.keys(prefabs).length} prefabs`);
