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
const road=(state,x1,z1,x2,z2,w=4,name='Road',y=1)=>{
  if(x1===x2) fill(state,[x1-Math.floor(w/2),y,Math.min(z1,z2)],[x1+Math.ceil(w/2)-1,y,Math.max(z1,z2)],name);
  else if(z1===z2) fill(state,[Math.min(x1,x2),y,z1-Math.floor(w/2)],[Math.max(x1,x2),y,z1+Math.ceil(w/2)-1],name);
  else throw new Error('road segments must be axis aligned; compose bends from multiple segments');
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

const makePrefab=(kind,bounds,ops,anchors={})=>({kind,bounds,ops,anchors});
function gableRoof(p,name,minX,maxX,minZ,maxZ,eaveY){
  const f=(s,a,b,n)=>p.push({op:'fill_box',state:s,min:a,max:b,name:n});
  const width=maxX-minX+1, half=Math.ceil(width/2);
  for(let i=0;i<half;i++){
    f('aged_roof_e',[minX+i,eaveY+i,minZ],[minX+i,eaveY+i,maxZ],`${name} west roof ${i}`);
    f('aged_roof_w',[maxX-i,eaveY+i,minZ],[maxX-i,eaveY+i,maxZ],`${name} east roof ${i}`);
  }
}
function shellWing(p,name,{minX,minZ,maxX,maxZ,floorY=0,wallTop=5,lower='stone',upper='aged_wood',door=null,windows=[]}){
  const f=(s,a,b,n)=>p.push({op:'fill_box',state:s,min:a,max:b,name:n}); const c=(a,b,n)=>p.push({op:'cut_box',min:a,max:b,name:n});
  f('cobblestone',[minX,floorY,minZ],[maxX,floorY,maxZ],name+' foundation');
  f(lower,[minX,floorY+1,minZ],[maxX,floorY+2,maxZ],name+' lower shell');
  f(upper,[minX,floorY+3,minZ],[maxX,wallTop,maxZ],name+' upper shell');
  c([minX+1,floorY+1,minZ+1],[maxX-1,wallTop,maxZ-1],name+' clear interior');
  for(const [x,z] of [[minX,minZ],[maxX,minZ],[minX,maxZ],[maxX,maxZ]]) f('oak_wood',[x,floorY+1,z],[x,wallTop,z],name+' timber post');
  if(door){const [side,a,b]=door;if(side==='south')c([a,floorY+1,minZ],[b,floorY+3,minZ],name+' door');if(side==='north')c([a,floorY+1,maxZ],[b,floorY+3,maxZ],name+' door');if(side==='west')c([minX,floorY+1,a],[minX,floorY+3,b],name+' door');if(side==='east')c([maxX,floorY+1,a],[maxX,floorY+3,b],name+' door');}
  for(const w of windows){const [side,a,b]=w;if(side==='south')c([a,floorY+2,minZ],[b,floorY+3,minZ],name+' window');if(side==='north')c([a,floorY+2,maxZ],[b,floorY+3,maxZ],name+' window');if(side==='west')c([minX,floorY+2,a],[minX,floorY+3,b],name+' window');if(side==='east')c([maxX,floorY+2,a],[maxX,floorY+3,b],name+' window');}
  gableRoof(p,name,minX,maxX,minZ,maxZ,wallTop+1);
}
function cottage(){
  const p=[]; shellWing(p,'Cottage main',{minX:1,minZ:1,maxX:11,maxZ:9,wallTop:5,door:['south',5,6],windows:[['north',3,4],['north',8,9],['west',4,5]]});
  shellWing(p,'Cottage side wing',{minX:8,minZ:7,maxX:15,maxZ:13,wallTop:4,lower:'cobblestone',door:['east',9,10],windows:[['north',11,12]]});
  p.push({op:'fill_box',state:'stone_dark',min:[9,5,6],max:[10,9,7],name:'Cottage chimney'});
  p.push({op:'fill_box',state:'oak_wood',min:[3,1,0],max:[8,1,0],name:'Cottage porch deck'});
  p.push({op:'fill_box',state:'aged_wood',min:[3,5,0],max:[8,5,0],name:'Cottage porch awning'});
  p.push({op:'fill_box',state:'oak_wood',min:[3,2,0],max:[3,4,0],name:'Cottage porch post'});p.push({op:'fill_box',state:'oak_wood',min:[8,2,0],max:[8,4,0],name:'Cottage porch post'});
  return makePrefab('home',{min:[0,0,0],max:[15,11,13]},p,{door:{at:[5,1,1],facing:'south'}});
}
function farmhouse(){
  const p=[]; shellWing(p,'Farmhouse main',{minX:1,minZ:1,maxX:15,maxZ:11,wallTop:6,door:['south',7,9],windows:[['north',3,5],['north',11,13],['west',4,6],['east',5,7]]});
  shellWing(p,'Farmhouse kitchen wing',{minX:11,minZ:8,maxX:20,maxZ:16,wallTop:5,lower:'stone',door:['east',11,12],windows:[['north',14,16]]});
  p.push({op:'fill_box',state:'oak_wood',min:[4,1,0],max:[11,1,0],name:'Farmhouse porch'});p.push({op:'fill_box',state:'aged_wood',min:[4,5,0],max:[11,5,0],name:'Farmhouse porch roof'});
  p.push({op:'fill_box',state:'stone_dark',min:[13,6,7],max:[14,11,8],name:'Farmhouse chimney'});
  return makePrefab('farm-home',{min:[0,0,0],max:[20,14,16]},p);
}
function barn(){
  const p=[];const f=(s,a,b,n)=>p.push({op:'fill_box',state:s,min:a,max:b,name:n});const c=(a,b,n)=>p.push({op:'cut_box',min:a,max:b,name:n});
  f('cobblestone',[1,0,1],[18,0,13],'Barn stone footing');f('aged_wood',[1,1,1],[18,7,13],'Barn shell');c([2,1,2],[17,7,12],'Barn tall interior');
  for(const x of [1,6,12,18]){f('oak_wood',[x,1,1],[x,7,1],'Barn frame');f('oak_wood',[x,1,13],[x,7,13],'Barn frame');}
  c([7,1,1],[12,6,1],'Barn wagon doors');c([3,4,13],[5,6,13],'Barn rear vent');c([14,4,13],[16,6,13],'Barn rear vent');
  f('oak_wood',[2,6,2],[17,6,6],'Barn partial hay loft');gableRoof(p,'Barn',0,19,0,14,8);
  f('oak_wood',[18,1,5],[23,1,13],'Barn lean-to floor');f('oak_wood',[23,2,5],[23,5,5],'Barn lean-to post');f('oak_wood',[23,2,13],[23,5,13],'Barn lean-to post');f('aged_wood',[18,6,4],[23,6,14],'Barn lean-to roof');
  return makePrefab('farm',{min:[0,0,0],max:[23,17,14]},p);
}
function trainingHall(){
  const p=[];shellWing(p,'Warden hall',{minX:1,minZ:1,maxX:20,maxZ:12,wallTop:6,door:['south',8,11],windows:[['north',3,5],['north',15,17],['west',4,6]]});
  shellWing(p,'Armory wing',{minX:15,minZ:10,maxX:27,maxZ:20,wallTop:5,lower:'stone',door:['east',14,16],windows:[['north',19,21]]});
  p.push({op:'fill_box',state:'oak_wood',min:[2,1,0],max:[14,1,0],name:'Training arcade deck'});p.push({op:'fill_box',state:'aged_wood',min:[2,5,0],max:[14,5,0],name:'Training arcade roof'});
  for(const x of [2,6,10,14])p.push({op:'fill_box',state:'oak_wood',min:[x,2,0],max:[x,4,0],name:'Training arcade post'});
  return makePrefab('training',{min:[0,0,0],max:[27,16,20]},p);
}
function reeveHall(){
  const p=[];shellWing(p,'Reeve great hall',{minX:1,minZ:1,maxX:20,maxZ:14,wallTop:7,door:['south',8,11],windows:[['north',4,6],['north',15,17],['west',5,7]]});
  shellWing(p,'Reeve office wing',{minX:14,minZ:12,maxX:28,maxZ:22,wallTop:5,lower:'stone',door:['east',16,18],windows:[['north',18,20],['east',14,15]]});
  p.push({op:'fill_box',state:'cobblestone',min:[4,1,0],max:[14,1,0],name:'Reeve entrance terrace'});p.push({op:'fill_box',state:'aged_wood',min:[4,6,0],max:[14,6,0],name:'Reeve covered entrance'});
  for(const x of [4,9,14])p.push({op:'fill_box',state:'oak_wood',min:[x,2,0],max:[x,5,0],name:'Reeve entrance post'});
  p.push({op:'fill_box',state:'stone_dark',min:[17,7,11],max:[18,12,12],name:'Reeve chimney'});
  return makePrefab('civic',{min:[0,0,0],max:[28,17,22]},p);
}
function inn(){
  const p=[];shellWing(p,'Wayfarer inn hall',{minX:1,minZ:1,maxX:18,maxZ:12,wallTop:6,door:['south',8,10],windows:[['north',3,5],['north',13,15],['west',5,7]]});
  shellWing(p,'Inn kitchen stable wing',{minX:13,minZ:10,maxX:27,maxZ:20,wallTop:5,lower:'cobblestone',door:['east',14,17],windows:[['north',18,20]]});
  p.push({op:'fill_box',state:'oak_wood',min:[3,1,0],max:[14,1,0],name:'Inn porch'});p.push({op:'fill_box',state:'aged_wood',min:[3,5,0],max:[14,5,0],name:'Inn porch roof'});
  p.push({op:'fill_box',state:'stone_dark',min:[15,6,8],max:[16,12,9],name:'Inn chimney'});
  return makePrefab('inn',{min:[0,0,0],max:[27,15,20]},p);
}
function smithy(){
  const p=[];shellWing(p,'Smith dwelling',{minX:1,minZ:1,maxX:13,maxZ:10,wallTop:5,door:['south',5,7],windows:[['north',3,4],['west',5,6]]});
  p.push({op:'fill_box',state:'cobblestone',min:[10,0,8],max:[23,0,19],name:'Forge yard paving'});p.push({op:'fill_box',state:'oak_wood',min:[11,1,10],max:[11,5,10],name:'Forge shed post'});p.push({op:'fill_box',state:'oak_wood',min:[22,1,10],max:[22,5,10],name:'Forge shed post'});p.push({op:'fill_box',state:'oak_wood',min:[11,1,18],max:[11,5,18],name:'Forge shed post'});p.push({op:'fill_box',state:'oak_wood',min:[22,1,18],max:[22,5,18],name:'Forge shed post'});p.push({op:'fill_box',state:'aged_wood',min:[10,6,9],max:[23,6,19],name:'Forge shed roof'});p.push({op:'fill_box',state:'stone_dark',min:[14,1,13],max:[18,3,16],name:'Forge hearth'});p.push({op:'fill_box',state:'stone_dark',min:[17,4,15],max:[18,10,16],name:'Forge chimney'});
  return makePrefab('craft',{min:[0,0,0],max:[23,12,19]},p);
}
function chapel(){
  const p=[];const f=(s,a,b,n)=>p.push({op:'fill_box',state:s,min:a,max:b,name:n});const c=(a,b,n)=>p.push({op:'cut_box',min:a,max:b,name:n});
  f('cobblestone',[2,0,1],[15,0,21],'Chapel foundation');f('mossy_stone',[2,1,1],[15,8,21],'Chapel nave shell');c([3,1,2],[14,8,20],'Chapel tall nave');c([7,1,1],[10,5,1],'Chapel doors');c([2,3,6],[2,6,8],'Chapel west lancet');c([15,3,13],[15,6,15],'Chapel east lancet');gableRoof(p,'Chapel nave',1,16,0,22,9);
  shellWing(p,'Chapel records',{minX:14,minZ:15,maxX:24,maxZ:24,wallTop:5,lower:'mossy_stone',upper:'stone',door:['east',18,20],windows:[['north',18,20]]});
  f('stone',[0,1,14],[6,12,21],'Bell tower shell');c([1,2,15],[5,11,20],'Bell tower interior');c([2,7,14],[4,10,14],'Bell opening');f('aged_wood',[0,13,14],[6,13,21],'Bell tower roof');
  return makePrefab('religious',{min:[0,0,0],max:[24,16,24]},p);
}
function tree(){return makePrefab('vegetation',{min:[0,0,0],max:[4,7,4]},[{op:'fill_box',state:'oak_wood',min:[2,0,2],max:[2,5,2],name:'Tree trunk'},{op:'fill_box',state:'grass_block',min:[1,5,1],max:[3,7,3],name:'Tree crown'},{op:'fill_box',state:'grass_block',min:[0,6,2],max:[4,6,2],name:'Tree crown spread'},{op:'fill_box',state:'grass_block',min:[2,6,0],max:[2,6,4],name:'Tree crown spread'}]);}

prefabs.cottage=cottage();prefabs.farmhouse=farmhouse();prefabs.barn=barn();prefabs.trainingHall=trainingHall();prefabs.reeveHall=reeveHall();prefabs.smithy=smithy();prefabs.chapel=chapel();prefabs.inn=inn();prefabs.tree=tree();

fill('dirt',[0,0,0],[159,0,159],'Deep lowland soil');fill('grass_block',[0,1,0],[159,1,159],'Brackenford lowland turf');
for(const [minX,maxX,minZ,maxZ,top] of [[2,30,12,50,3],[6,27,16,47,5],[11,24,20,43,7],[16,22,25,38,9]]){fill('dirt',[minX,2,minZ],[maxX,top-1,maxZ],'West hill earth');fill('grass_block',[minX,top,minZ],[maxX,top,maxZ],'West hill turf');}
for(const [minX,maxX,minZ,maxZ,top] of [[116,154,10,56,3],[120,151,14,53,5],[124,148,18,49,7],[129,144,23,44,9],[133,141,27,40,11]]){fill('dirt',[minX,2,minZ],[maxX,top-1,maxZ],'Blackstone ridge earth');fill('grass_block',[minX,top,minZ],[maxX,top,maxZ],'Blackstone ridge turf');}
fill('stone_dark',[128,2,27],[153,9,42],'Blackstone cave rock core');cut([127,2,33],[143,6,37],'Blackstone cave tunnel');cut([139,2,29],[149,7,41],'Blackstone cave chamber');cut([127,2,34],[132,6,36],'Blackstone cave mouth');fill('mossy_stone',[127,2,31],[129,7,33],'Cave mouth west shoulder');fill('mossy_stone',[127,2,37],[129,7,39],'Cave mouth east shoulder');fill('mossy_stone',[127,7,32],[129,8,38],'Cave mouth lintel');
fill('dirt',[0,2,117],[78,3,159],'Southern farm rise');fill('grass_block',[0,4,117],[78,4,159],'Southern farm turf');
fill('dirt_dry',[5,4,124],[28,4,153],'West barley soil');fill('barley',[6,5,125],[27,5,152],'West barley');fill('dirt_dry',[54,4,123],[75,4,152],'East barley soil');fill('barley',[55,5,124],[74,5,151],'East barley');
for(let z=126;z<=151;z+=7)fill('gravel',[5,4,z],[28,4,z],'West field row');for(let z=125;z<=150;z+=7)fill('gravel',[54,4,z],[75,4,z],'East field row');
for(let x=3;x<=77;x+=3){set('oak_wood',[x,5,120],'Farm north fence');set('oak_wood',[x,5,156],'Farm south fence');}for(let z=121;z<=155;z+=3){set('oak_wood',[3,5,z],'Farm west fence');set('oak_wood',[77,5,z],'Farm east fence');}

road('gravel',78,43,78,58,5,'South approach');road('gravel',78,58,72,58,5,'South bend');road('cobblestone',72,58,72,72,5,'Lower High Lane');road('cobblestone',72,72,86,72,6,'Market bend west');road('cobblestone',86,72,86,84,5,'Market bend north');road('cobblestone',86,84,97,84,5,'Upper Market Lane');
fill('cobblestone',[75,1,66],[88,1,77],'Irregular market court');fill('gravel',[89,1,79],[102,1,88],'Smiths court');fill('gravel',[54,1,61],[68,1,74],'Warden court');
road('gravel',62,74,62,91,3,'West residential lane');road('gravel',62,91,54,91,3,'West lane dogleg');road('gravel',54,91,54,105,3,'Abbey lane');road('gravel',97,84,108,84,3,'East residential lane');road('gravel',108,84,108,101,3,'East lane turn');
road('gravel',86,84,86,102,4,'North lane');road('gravel',86,102,93,102,4,'North road first bend');road('gravel',93,102,93,118,4,'Old North Road lower');road('gravel',93,118,103,118,4,'Old North Road second bend');road('gravel',103,118,103,145,4,'Old North Road upper');
road('gravel',54,105,43,105,3,'Farm lane west');road('gravel',43,105,43,122,3,'Farm lane south');road('gravel',108,84,118,84,3,'East ridge lane');road('gravel',118,84,118,57,3,'East ridge turn');road('gravel',118,57,130,57,3,'Cave trail east');road('gravel',130,57,130,36,3,'Cave approach');

fill('gravel',[54,1,55],[70,1,68],'Warden drill yard');for(const [a,b] of [[[55,2,56],[55,3,67]],[[69,2,56],[69,3,67]],[[55,2,56],[69,3,56]]])fill('oak_wood',a,b,'Warden yard rail');
fill('gravel',[31,4,125],[52,4,146],'Farmstead yard');
fill('dirt',[95,2,133],[113,4,152],'North Watch hill');fill('grass_block',[95,5,133],[113,5,152],'North Watch turf');fill('stone_dark',[99,6,136],[110,12,148],'North Watch ruin shell');cut([100,6,137],[109,12,147],'North Watch ruined interior');cut([103,6,136],[106,10,138],'North Watch door breach');cut([99,10,141],[102,12,145],'North Watch collapsed west wall');fill('mossy_stone',[96,6,135],[100,7,139],'North Watch rubble');fill('mossy_stone',[108,6,146],[113,8,150],'North Watch rubble');
fill('mossy_stone',[94,2,111],[94,4,111],'Broken North Road milestone');fill('stone_slab',[94,5,111],[94,5,111],'Milestone cap');

inst('warden-training-hall','trainingHall',[40,2,49],'east',['town','training']);
inst('reeve-hall','reeveHall',[70,2,48],'south',['town','civic']);
inst('brackenford-smithy','smithy',[94,2,57],'west',['town','craft']);
inst('saint-orin-chapel','chapel',[46,2,82],'east',['town','religious']);
inst('wayfarer-inn','inn',[80,2,77],'north',['town','inn']);
inst('cottage-west-1','cottage',[40,2,75],'east',['town','home']);
inst('cottage-west-2','cottage',[38,2,98],'south',['town','home']);
inst('cottage-west-3','cottage',[57,2,104],'west',['town','home']);
inst('cottage-east-1','cottage',[109,2,73],'west',['town','home']);
inst('cottage-east-2','cottage',[111,2,94],'north',['town','home']);
inst('cottage-north-1','cottage',[74,2,101],'east',['town','home']);
inst('cottage-south-1','cottage',[58,2,43],'south',['town','home']);
inst('farmhouse','farmhouse',[20,5,127],'east',['farm','home']);
inst('barn','barn',[43,5,126],'south',['farm','barn']);

const trees=[[11,2,18],[20,2,29],[31,2,19],[38,2,31],[17,2,72],[27,2,84],[32,2,104],[116,2,91],[124,2,97],[134,2,87],[143,2,78],[149,2,66],[123,2,107],[133,2,113],[144,2,121],[151,2,129],[119,2,12],[109,2,23],[151,2,99],[9,2,101],[18,2,109],[86,2,21],[96,2,31],[71,2,20],[63,2,27],[35,2,55],[120,2,64]];
trees.forEach((p,i)=>inst('tree-'+i,'tree',p,['north','east','south','west'][i%4],['vegetation']));

const world={format:'riftcity-city-block',version:2,id:'brackenford-lowlands-001',name:'Brackenford Lowlands · Valeborn Start v2',units:'meters',grid:{cell_size:1,shape_increment:0.5},origin:[0,0,0],bounds:{min:[0,0,0],max:[159,23,159]},palette,prefabs,layout,validation:{overlap_policy:'allow',max_validation_cells:3000000},anchors:{'valeborn-spawn':{at:[62,2,64],facing:'north',tags:['spawn','valeborn']},'farmstead':{at:[38,5,136],facing:'east',tags:['farm']},'blackstone-cave':{at:[130,2,35],facing:'east',tags:['cave','dungeon-future']}},ops};
fs.writeFileSync(out,JSON.stringify(world,null,2)+'\n');

let c=fs.readFileSync(contentPath,'utf8');
const swaps=[
  [[20,2,22],[62,2,64]],[[43,2,34],[80,2,69]],[[30,2,22],[65,2,62]],[[48,2,52],[94,2,111]],[[75,2,73],[104,6,142]],[[88,2,84],[130,2,35]],[[22,2,22],[59,2,63]],[[44,2,34],[82,2,68]],[[58,2,30],[101,2,69]],[[22,2,58],[61,2,91]],[[63,2,65],[62,2,64]],[[80,2,72],[80,2,69]],[[68,2,65],[65,2,62]],[[88,2,109],[94,2,111]],[[103,5,140],[104,6,142]],[[129,2,35],[130,2,35]],[[60,2,65],[59,2,63]],[[82,2,70],[82,2,68]],[[101,2,66],[101,2,69]],[[72,2,88],[61,2,91]]
];
for(const [from,to] of swaps){const a=`[${from.join(', ')}]`,b=`[${to.join(', ')}]`;c=c.replace(a,b);}
c=c.replace(/description: 'Fields, training yards, workshops and old military roads surrounding the walled village of Brackenford\.'/,"description: 'A broad working lowland of crooked medieval lanes, irregular timber-and-stone buildings, farms, wooded hills, an abandoned watch and the Blackstone cave ridge around Brackenford.'");
c=c.replace(/description: 'A broad working lowland[^']*'/,"description: 'A broad working lowland of crooked medieval lanes, irregular timber-and-stone buildings, farms, wooded hills, an abandoned watch and the Blackstone cave ridge around Brackenford.'");
fs.writeFileSync(contentPath,c);
console.log(`[brackenford-v2] wrote ${ops.length} raw ops, ${layout.length} instances, ${Object.keys(prefabs).length} irregular prefabs`);
