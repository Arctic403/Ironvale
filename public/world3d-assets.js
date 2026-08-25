const MATERIAL_CACHE = new WeakMap();

export const WORLD3D_ASSETS = Object.freeze([
  {id:'corner-store-01',label:'Corner Store',category:'Buildings',type:'building'},
  {id:'apartment-01',label:'3-Storey Apartment',category:'Buildings',type:'building'},
  {id:'office-01',label:'Mid-Rise Office',category:'Buildings',type:'building'},
  {id:'warehouse-01',label:'Small Warehouse',category:'Buildings',type:'building'},
  {id:'sedan-01',label:'Sedan',category:'Vehicles',type:'parked-car'},
  {id:'van-01',label:'Cargo Van',category:'Vehicles',type:'parked-car'},
  {id:'pickup-01',label:'Pickup Truck',category:'Vehicles',type:'parked-car'},
  {id:'bench-01',label:'City Bench',category:'Street Props',type:'prop'},
  {id:'dumpster-01',label:'Dumpster',category:'Street Props',type:'prop'},
  {id:'hydrant-01',label:'Fire Hydrant',category:'Street Props',type:'prop'},
  {id:'mailbox-01',label:'Street Mailbox',category:'Street Props',type:'prop'},
  {id:'bus-stop-01',label:'Bus Stop Shelter',category:'Street Props',type:'prop'},
  {id:'traffic-light-01',label:'Traffic Light',category:'Street Props',type:'prop'},
  {id:'streetlight-01',label:'Modern Streetlight',category:'Street Props',type:'light'},
  {id:'tree-urban-01',label:'Urban Tree',category:'Nature',type:'tree'}
]);

export function getWorldAsset(id) {
  return WORLD3D_ASSETS.find(asset => asset.id === id) || null;
}

export function buildWorldAssetInto({B,scene,shadowGenerator,materials,assetId,id,root,add}) {
  const asset=getWorldAsset(assetId);
  if(!asset) return null;
  const m=getMaterials(B,scene,materials);
  const ctx={B,scene,shadowGenerator,materials:m,id,root,add};
  const builders={
    'corner-store-01':buildCornerStore,
    'apartment-01':buildApartment,
    'office-01':buildOffice,
    'warehouse-01':buildWarehouse,
    'sedan-01':buildSedan,
    'van-01':buildVan,
    'pickup-01':buildPickup,
    'bench-01':buildBench,
    'dumpster-01':buildDumpster,
    'hydrant-01':buildHydrant,
    'mailbox-01':buildMailbox,
    'bus-stop-01':buildBusStop,
    'traffic-light-01':buildTrafficLight,
    'streetlight-01':buildStreetlight,
    'tree-urban-01':buildTree
  };
  builders[assetId]?.(ctx);
  return asset;
}

function buildCornerStore(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-body`,10,5.2,8,0,2.6,0,m.warmConcrete,true,shadowGenerator);
  meshBox(B,scene,add,`${id}-parapet`,10.35,.45,8.35,0,5.35,0,m.roof,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-storefront`,7.5,2.65,.18,0,1.65,4.08,m.glass);
  meshBox(B,scene,add,`${id}-door`,1.25,2.45,.2,3.45,1.45,4.1,m.darkGlass);
  meshBox(B,scene,add,`${id}-awning`,7.8,.22,1.35,-.4,3.12,4.62,m.orange,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-sign`,5.5,.75,.18,-.55,4.15,4.12,m.cream);
  for(const x of [-3.4,-1.15,1.15]) meshBox(B,scene,add,`${id}-frame-${x}`,.12,2.7,.2,x,1.65,4.12,m.black);
  meshBox(B,scene,add,`${id}-ac`,2.2,.85,1.45,2.5,5.95,-1.2,m.metal,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-side-door`,1.15,2.3,.15,-5.08,1.3,1.7,m.metal);
}

function buildApartment(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-body`,10.5,11.5,8.5,0,5.75,0,m.brick,true,shadowGenerator);
  meshBox(B,scene,add,`${id}-base`,10.8,1.05,8.8,0,.55,0,m.warmConcrete);
  meshBox(B,scene,add,`${id}-roof`,10.9,.55,8.9,0,11.75,0,m.roof,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-entry`,2.15,3,.18,0,1.7,4.33,m.darkGlass);
  meshBox(B,scene,add,`${id}-canopy`,3.5,.18,1.25,0,3.25,4.82,m.metal,false,shadowGenerator);
  for(let floor=0;floor<3;floor++){
    const y=2.55+floor*2.7;
    for(const x of [-3.3,-1.1,1.1,3.3]){
      meshBox(B,scene,add,`${id}-win-${floor}-${x}`,1.35,1.35,.12,x,y,4.32,m.glass);
      meshBox(B,scene,add,`${id}-sill-${floor}-${x}`,1.55,.12,.34,x,y-.8,4.43,m.cream);
    }
  }
  for(let floor=1;floor<3;floor++){
    const y=3.6+floor*2.7;
    meshBox(B,scene,add,`${id}-balcony-${floor}`,3.1,.16,1.25,2.9,y,4.78,m.metal,false,shadowGenerator);
    for(const x of [1.55,2.45,3.35,4.25]) meshBox(B,scene,add,`${id}-rail-${floor}-${x}`,.08,.8,.08,x,y+.45,5.3,m.black);
  }
  meshBox(B,scene,add,`${id}-roof-ac`,2.2,.9,1.5,-2.8,12.45,-1.1,m.metal,false,shadowGenerator);
}

function buildOffice(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-core`,11,15,9.5,0,7.5,0,m.coolConcrete,true,shadowGenerator);
  meshBox(B,scene,add,`${id}-glass-front`,9.5,12.8,.2,0,8.1,4.86,m.darkGlass);
  for(const x of [-3.7,-1.85,0,1.85,3.7]) meshBox(B,scene,add,`${id}-mullion-${x}`,.11,12.7,.26,x,8.1,4.94,m.black);
  for(const y of [3.1,5.5,7.9,10.3,12.7]) meshBox(B,scene,add,`${id}-floorline-${y}`,9.6,.1,.28,0,y,4.95,m.metal);
  meshBox(B,scene,add,`${id}-lobby`,5.2,3.1,.28,0,1.75,5,m.glass);
  meshBox(B,scene,add,`${id}-entry-canopy`,6.4,.22,1.55,0,3.35,5.65,m.orange,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-roof`,11.4,.5,9.9,0,15.25,0,m.roof,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-roof-mech`,3.5,1.2,2.4,2.2,16.05,-1.2,m.metal,false,shadowGenerator);
}

function buildWarehouse(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-body`,14,6.6,11,0,3.3,0,m.industrial,true,shadowGenerator);
  meshBox(B,scene,add,`${id}-roof`,14.4,.42,11.4,0,6.72,0,m.roof,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-loading`,5,4.1,.22,-2.6,2.15,5.62,m.metal);
  for(const y of [.7,1.4,2.1,2.8,3.5]) meshBox(B,scene,add,`${id}-doorline-${y}`,5.05,.07,.26,-2.6,y,5.74,m.black);
  meshBox(B,scene,add,`${id}-person-door`,1.3,2.45,.2,4.8,1.35,5.62,m.darkGlass);
  meshBox(B,scene,add,`${id}-awning`,2.1,.2,1.2,4.8,2.85,6.1,m.orange,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-vent`,2.4,1.2,.8,-4.5,5.2,5.78,m.metal);
  for(const x of [-5.8,-3.8,-1.8,.2,2.2]) meshBox(B,scene,add,`${id}-rib-${x}`,.12,5.8,.16,x,3.25,5.61,m.coolConcrete);
}

function buildSedan(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-lower`,1.9,.5,4.1,0,.52,0,m.carBlue,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-hood`,1.78,.28,1.25,0,.82,1.32,m.carBlue);
  meshBox(B,scene,add,`${id}-trunk`,1.75,.28,.85,0,.78,-1.5,m.carBlue);
  meshBox(B,scene,add,`${id}-cabin`,1.62,.78,1.75,0,1.13,-.2,m.darkGlass);
  meshBox(B,scene,add,`${id}-roof`,1.45,.12,1.05,0,1.56,-.25,m.carBlue);
  addWheels(c,1.02,1.38,.62);
  meshBox(B,scene,add,`${id}-front-light-l`,.42,.16,.08,-.55,.67,2.08,m.cream);
  meshBox(B,scene,add,`${id}-front-light-r`,.42,.16,.08,.55,.67,2.08,m.cream);
  meshBox(B,scene,add,`${id}-bumper`,1.75,.16,.14,0,.38,2.12,m.black);
}

function buildVan(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-body`,2.05,1.65,4.6,0,1.02,-.1,m.carGrey,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-nose`,1.95,.85,.95,0,.72,2.35,m.carGrey,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-windshield`,1.72,.72,.08,0,1.48,2.31,m.darkGlass);
  meshBox(B,scene,add,`${id}-sidewindow-l`,.08,.62,1.05,-1.04,1.45,1.2,m.darkGlass);
  meshBox(B,scene,add,`${id}-sidewindow-r`,.08,.62,1.05,1.04,1.45,1.2,m.darkGlass);
  meshBox(B,scene,add,`${id}-rear-door`,1.75,1.35,.08,0,1.05,-2.43,m.metal);
  addWheels(c,1.08,1.55,.65);
}

function buildPickup(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-chassis`,2,.55,4.7,0,.55,0,m.carRed,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-cab`,1.8,1.1,1.7,0,1.18,1.05,m.carRed,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-windshield`,1.55,.55,.08,0,1.42,1.92,m.darkGlass);
  meshBox(B,scene,add,`${id}-bed`,1.85,.68,1.85,0,.85,-1.35,m.carRed,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-bed-inner`,1.55,.25,1.5,0,1.08,-1.35,m.black);
  addWheels(c,1.06,1.55,.66);
}

function buildBench(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-seat`,2.15,.16,.58,0,.68,0,m.wood,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-back`,2.15,.72,.13,0,1.05,-.28,m.wood);
  for(const x of [-.8,.8]){
    meshBox(B,scene,add,`${id}-leg-${x}`,.12,.7,.45,x,.34,0,m.black);
    meshBox(B,scene,add,`${id}-arm-${x}`,.12,.45,.65,x,.9,0,m.black);
  }
}

function buildDumpster(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-body`,1.8,1.2,1.25,0,.65,0,m.dumpster,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-lid`,1.9,.14,1.32,0,1.34,-.03,m.black);
  for(const x of [-.72,.72]){
    cylinder(B,scene,add,`${id}-wheel-${x}`, .18,.32,x,.18,.48,m.black,Math.PI/2);
    meshBox(B,scene,add,`${id}-handle-${x}`,.12,.35,.12,x,1.05,.68,m.metal);
  }
}

function buildHydrant(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  cylinder(B,scene,add,`${id}-body`,1.05,.48,0,.58,0,m.hydrant);
  cylinder(B,scene,add,`${id}-top`,.18,.62,0,1.12,0,m.hydrant);
  sphere(B,scene,add,`${id}-cap`,.48,0,1.28,0,m.hydrant);
  for(const x of [-.34,.34]){
    cylinder(B,scene,add,`${id}-side-${x}`,.3,.24,x,.72,0,m.hydrant,Math.PI/2);
    sphere(B,scene,add,`${id}-sidecap-${x}`,.22,x*1.32,.72,0,m.metal);
  }
}

function buildMailbox(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  meshBox(B,scene,add,`${id}-body`,.72,1.08,.68,0,1.05,0,m.mailBlue,false,shadowGenerator);
  cylinder(B,scene,add,`${id}-top`,.72,.72,0,1.58,0,m.mailBlue,Math.PI/2);
  meshBox(B,scene,add,`${id}-slot`,.46,.08,.04,0,1.45,.36,m.black);
  cylinder(B,scene,add,`${id}-post`,.75,.12,0,.38,0,m.metal);
}

function buildBusStop(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  for(const x of [-1.7,1.7]) cylinder(B,scene,add,`${id}-post-${x}`,2.55,.11,x,1.28,0,m.metal);
  meshBox(B,scene,add,`${id}-roof`,3.8,.16,1.45,0,2.6,0,m.metal,false,shadowGenerator);
  meshBox(B,scene,add,`${id}-back-glass`,3.45,2.15,.08,0,1.35,-.62,m.glass);
  meshBox(B,scene,add,`${id}-bench`,2.45,.15,.46,0,.65,-.15,m.wood);
  for(const x of [-.85,.85]) meshBox(B,scene,add,`${id}-bench-leg-${x}`,.1,.62,.35,x,.32,-.15,m.black);
  meshBox(B,scene,add,`${id}-sign`,.55,.85,.08,1.75,2.08,.18,m.orange);
}

function buildTrafficLight(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  cylinder(B,scene,add,`${id}-pole`,4.2,.14,0,2.1,0,m.metal);
  meshBox(B,scene,add,`${id}-arm`,.14,.14,3.2,0,3.95,1.5,m.metal);
  meshBox(B,scene,add,`${id}-head`,.48,1.35,.44,0,3.45,3.05,m.black);
  sphere(B,scene,add,`${id}-red`,.22,0,3.82,3.29,m.signalRed);
  sphere(B,scene,add,`${id}-yellow`,.22,0,3.45,3.29,m.signalYellow);
  sphere(B,scene,add,`${id}-green`,.22,0,3.08,3.29,m.signalGreen);
}

function buildStreetlight(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  cylinder(B,scene,add,`${id}-pole`,4.8,.12,0,2.4,0,m.metal);
  meshBox(B,scene,add,`${id}-arm`,1.25,.11,.11,.55,4.55,0,m.metal);
  meshBox(B,scene,add,`${id}-lamp`,.58,.2,.3,1.12,4.48,0,m.cream);
  cylinder(B,scene,add,`${id}-base`,.26,.34,0,.13,0,m.black);
}

function buildTree(c){
  const {B,scene,shadowGenerator,materials:m,id,add}=c;
  cylinder(B,scene,add,`${id}-trunk`,2.7,.42,0,1.35,0,m.trunk);
  for(const [x,y,z,s] of [[0,3.5,0,2.2],[-.85,3.35,.15,1.6],[.8,3.45,-.2,1.55],[0,4.35,.15,1.65]]){
    const crown=sphere(B,scene,add,`${id}-crown-${x}-${y}`,s,x,y,z,m.foliage);
    crown.scaling.y=.82;
    shadowGenerator?.addShadowCaster?.(crown);
  }
  cylinder(B,scene,add,`${id}-grate`,.08,1.2,0,.06,0,m.black);
}

function addWheels(c,x,z,diameter){
  const {B,scene,materials:m,id,add}=c;
  for(const px of [-x,x]) for(const pz of [-z,z]){
    const wheel=cylinder(B,scene,add,`${id}-wheel-${px}-${pz}`,.28,diameter,px,.36,pz,m.black,Math.PI/2);
    const hub=cylinder(B,scene,add,`${id}-hub-${px}-${pz}`,.3,diameter*.42,px,.36,pz,m.metal,Math.PI/2);
    wheel.rotation.z=Math.PI/2;hub.rotation.z=Math.PI/2;
  }
}

function getMaterials(B,scene,base){
  if(MATERIAL_CACHE.has(scene)) return MATERIAL_CACHE.get(scene);
  const make=(name,color,{metallic=0,roughness=.82,emissive=null,alpha=1}={})=>{
    let mat;
    if(B.PBRMaterial){
      mat=new B.PBRMaterial(`asset-${name}`,scene);
      mat.albedoColor=B.Color3.FromHexString(color);
      mat.metallic=metallic;mat.roughness=roughness;
      if(emissive) mat.emissiveColor=B.Color3.FromHexString(emissive);
    }else{
      mat=new B.StandardMaterial(`asset-${name}`,scene);
      mat.diffuseColor=B.Color3.FromHexString(color);
      mat.specularColor=new B.Color3(.12,.12,.12);
      if(emissive) mat.emissiveColor=B.Color3.FromHexString(emissive);
    }
    mat.alpha=alpha;
    return mat;
  };
  const m={
    warmConcrete:make('warm-concrete','#5b554d'),
    coolConcrete:make('cool-concrete','#4c5359'),
    brick:make('brick','#6b4438'),
    industrial:make('industrial','#4d5352',{metallic:.08,roughness:.72}),
    roof:make('roof','#282b2d'),
    metal:make('metal','#32383d',{metallic:.45,roughness:.5}),
    black:make('black','#121619',{metallic:.18,roughness:.55}),
    glass:make('glass','#547080',{metallic:.12,roughness:.22,emissive:'#15252e',alpha:.78}),
    darkGlass:make('dark-glass','#243640',{metallic:.18,roughness:.18,emissive:'#0f1a21',alpha:.88}),
    orange:make('orange','#c77a2c',{roughness:.65}),
    cream:make('cream','#d8c9a7',{emissive:'#2f291d'}),
    wood:make('wood','#75543b'),
    carBlue:make('car-blue','#355f7b',{metallic:.32,roughness:.36}),
    carGrey:make('car-grey','#69737a',{metallic:.3,roughness:.4}),
    carRed:make('car-red','#85483e',{metallic:.28,roughness:.4}),
    dumpster:make('dumpster','#3f6658',{metallic:.1,roughness:.7}),
    hydrant:make('hydrant','#a7493d',{metallic:.1,roughness:.6}),
    mailBlue:make('mail-blue','#355d7a',{metallic:.18,roughness:.55}),
    signalRed:make('signal-red','#7f231f',{emissive:'#bc362f'}),
    signalYellow:make('signal-yellow','#8c7422',{emissive:'#c7a738'}),
    signalGreen:make('signal-green','#245f3b',{emissive:'#34885a'}),
    foliage:base?.foliageMat||make('foliage','#38543d'),
    trunk:base?.trunkMat||make('trunk','#4f382a')
  };
  MATERIAL_CACHE.set(scene,m);
  return m;
}

function meshBox(B,scene,add,name,width,height,depth,x,y,z,material,collisions=false,shadowGenerator=null){
  const mesh=add(B.MeshBuilder.CreateBox(name,{width,height,depth},scene));
  mesh.position.set(x,y,z);mesh.material=material;mesh.checkCollisions=collisions;mesh.receiveShadows=collisions;
  shadowGenerator?.addShadowCaster?.(mesh);
  return mesh;
}
function cylinder(B,scene,add,name,height,diameter,x,y,z,material,rotationZ=0){
  const mesh=add(B.MeshBuilder.CreateCylinder(name,{height,diameter,tessellation:10},scene));
  mesh.position.set(x,y,z);mesh.material=material;mesh.rotation.z=rotationZ;return mesh;
}
function sphere(B,scene,add,name,diameter,x,y,z,material){
  const mesh=add(B.MeshBuilder.CreateSphere(name,{diameter,segments:8},scene));
  mesh.position.set(x,y,z);mesh.material=material;return mesh;
}
