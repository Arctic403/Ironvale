import { WORLD3D_CONFIG, WORLD3D_DISTRICTS, getNearbyChunkKeys } from './world3d-layout.js';

const DISTRICT_STYLES = Object.freeze({
  downtown:{accent:'#d68d35',sign:'#f0be6d',foliage:4,cars:['#a3483f','#445b72','#2e3137','#a07a39']},
  northside:{accent:'#6f94b8',sign:'#a9c7e0',foliage:7,cars:['#445b72','#77715e','#52614c','#34373c']},
  harbor:{accent:'#4f8da3',sign:'#93d3e4',foliage:6,cars:['#4f8da3','#c0c6ca','#49606b','#795d4b']},
  industrial:{accent:'#8e733e',sign:'#ddc689',foliage:3,cars:['#8e733e','#34373c','#6e5a48','#55606a']},
  westend:{accent:'#7b5f8f',sign:'#ccb2db',foliage:5,cars:['#7b5f8f','#34373c','#9d7854','#626d78']}
});

export function createStreamedEnvironment(B, scene, shadowGenerator, materials, initialOverrides = {}) {
  const chunks = new Map();
  const editable = new Map();
  const activeCars = [];
  let overrides = initialOverrides || {};
  let lastCenter = '';
  let trafficObserver = null;

  const applyTransform = record => {
    const o = overrides?.[record.id] || null;
    const base = record.base;
    record.root.position.set(
      finite(o?.x, base.x),
      finite(o?.y, base.y),
      finite(o?.z, base.z)
    );
    record.root.rotation.set(
      radians(finite(o?.rotationX, base.rotationX)),
      radians(finite(o?.rotationY, base.rotationY)),
      radians(finite(o?.rotationZ, base.rotationZ))
    );
    record.root.scaling.set(
      Math.max(.05, finite(o?.scaleX, base.scaleX)),
      Math.max(.05, finite(o?.scaleY, base.scaleY)),
      Math.max(.05, finite(o?.scaleZ, base.scaleZ))
    );
    record.root.setEnabled(o?.deleted !== true);
  };

  const register = (id, type, label, root, meshes, chunkKey, extra = {}) => {
    const record = {
      id, type, label, root, meshes, chunkKey, extra,
      base:{
        x:root.position.x,y:root.position.y,z:root.position.z,
        rotationX:degrees(root.rotation.x),rotationY:degrees(root.rotation.y),rotationZ:degrees(root.rotation.z),
        scaleX:root.scaling.x,scaleY:root.scaling.y,scaleZ:root.scaling.z
      }
    };
    root.metadata = { ...(root.metadata || {}), worldEditor:{kind:'environment',id,type,label} };
    for (const mesh of meshes) {
      mesh.metadata = { ...(mesh.metadata || {}), worldEditor:{kind:'environment',id,type,label} };
    }
    editable.set(id, record);
    applyTransform(record);
    return record;
  };

  const unregisterChunk = chunkKey => {
    for (const [id, record] of editable) {
      if (record.chunkKey === chunkKey) editable.delete(id);
    }
  };

  const update = (x,z,force=false) => {
    const wanted = new Set(getNearbyChunkKeys(x,z,WORLD3D_CONFIG.activeChunkRadius));
    const cx=Math.floor(x/WORLD3D_CONFIG.chunkSize);
    const cz=Math.floor(z/WORLD3D_CONFIG.chunkSize);
    const center=`${cx}:${cz}`;
    if (!force && center===lastCenter && chunks.size) return;
    lastCenter=center;

    for (const [key,bundle] of chunks) {
      if (wanted.has(key)) continue;
      bundle.dispose();
      unregisterChunk(key);
      chunks.delete(key);
    }

    for (const key of wanted) {
      if (chunks.has(key)) continue;
      const [chunkX,chunkZ]=key.split(':').map(Number);
      chunks.set(key,createEnvironmentChunk({
        B,scene,shadowGenerator,materials,chunkX,chunkZ,chunkKey:key,activeCars,register
      }));
    }

    if (!trafficObserver) {
      trafficObserver=scene.onBeforeRenderObservable.add(()=>{
        const dt=Math.min(scene.getEngine().getDeltaTime()/1000,.05);
        for (let i=activeCars.length-1;i>=0;i--) {
          const item=activeCars[i];
          if (!item?.root || item.root.isDisposed?.()) {
            activeCars.splice(i,1);
            continue;
          }
          const record=editable.get(item.id);
          if (!record || !record.root.isEnabled()) continue;
          if (overrides?.[item.id]?.freezeTraffic === true) continue;
          if (item.axis==='z') {
            item.root.position.z += item.direction*item.speed*dt;
            if (item.root.position.z>item.max) item.root.position.z=item.min;
            if (item.root.position.z<item.min) item.root.position.z=item.max;
          } else {
            item.root.position.x += item.direction*item.speed*dt;
            if (item.root.position.x>item.max) item.root.position.x=item.min;
            if (item.root.position.x<item.min) item.root.position.x=item.max;
          }
        }
      });
    }
  };

  return {
    update,
    setOverrides(next) {
      overrides=next||{};
      for (const record of editable.values()) applyTransform(record);
    },
    applyOverride(id, override) {
      overrides[id]=override;
      const record=editable.get(id);
      if (record) applyTransform(record);
    },
    resetOverride(id) {
      delete overrides[id];
      const record=editable.get(id);
      if (record) applyTransform(record);
    },
    getEditableRecord(id){ return editable.get(id)||null; },
    getEditableRecords(){ return [...editable.values()]; },
    dispose(){
      for (const bundle of chunks.values()) bundle.dispose();
      chunks.clear();
      editable.clear();
      activeCars.length=0;
      if (trafficObserver) scene.onBeforeRenderObservable.remove(trafficObserver);
      trafficObserver=null;
    }
  };
}

function createEnvironmentChunk(ctx) {
  const {B,scene,shadowGenerator,materials,chunkX,chunkZ,chunkKey,activeCars,register}=ctx;
  const size=WORLD3D_CONFIG.chunkSize;
  const centerX=chunkX*size+size/2;
  const centerZ=chunkZ*size+size/2;
  const seed=hash2(chunkX,chunkZ);
  const district=getDistrictFor(centerX,centerZ);
  const style=DISTRICT_STYLES[district.id]||DISTRICT_STYLES.downtown;
  const owned=[];
  const localCars=[];
  const chunkMaterials=[];
  const accentMat=tintMaterial(B,scene,`chunk-accent-${chunkX}-${chunkZ}`,style.accent);
  const signMat=tintMaterial(B,scene,`chunk-sign-${chunkX}-${chunkZ}`,style.sign,true);
  chunkMaterials.push(accentMat,signMat);
  const altBuildingMat=materials.buildingMats[(Math.abs(seed)+(district.id.length%3))%materials.buildingMats.length];

  const makeRoot=(id,type,label,x=0,y=0,z=0)=>{
    const root=new B.TransformNode(`editable-${id}`,scene);
    root.position.set(x,y,z);
    owned.push(root);
    const meshes=[];
    const add=mesh=>{
      mesh.parent=root;
      meshes.push(mesh);
      owned.push(mesh);
      return mesh;
    };
    return {id,type,label,root,meshes,add,finish:(extra={})=>register(id,type,label,root,meshes,chunkKey,extra)};
  };

  // Vertical road + its lane markings.
  {
    const o=makeRoot(`road-v:${chunkX}:${chunkZ}`,'road','Vertical road',centerX,0,centerZ);
    const road=o.add(B.MeshBuilder.CreateBox(`${o.id}-surface`,{width:9,height:.055,depth:size+1},scene));
    road.position.y=.048; road.material=materials.roadMat;
    const median=o.add(B.MeshBuilder.CreateBox(`${o.id}-median`,{width:.14,height:.065,depth:size-8},scene));
    median.position.y=.08; median.material=signMat;
    for (const lane of [-2.15,2.15]) {
      const line=o.add(B.MeshBuilder.CreateBox(`${o.id}-lane-${lane}`,{width:.08,height:.064,depth:size-6},scene));
      line.position.set(lane,.086,0); line.material=materials.lineMat;
    }
    o.finish({orientation:'vertical'});
  }

  // Horizontal road + its lane markings.
  {
    const o=makeRoot(`road-h:${chunkX}:${chunkZ}`,'road','Horizontal road',centerX,0,centerZ);
    const road=o.add(B.MeshBuilder.CreateBox(`${o.id}-surface`,{width:size+1,height:.056,depth:9},scene));
    road.position.y=.049; road.material=materials.roadMat;
    const median=o.add(B.MeshBuilder.CreateBox(`${o.id}-median`,{width:size-8,height:.065,depth:.14},scene));
    median.position.y=.08; median.material=signMat;
    for (const lane of [-2.15,2.15]) {
      const line=o.add(B.MeshBuilder.CreateBox(`${o.id}-lane-${lane}`,{width:size-6,height:.064,depth:.08},scene));
      line.position.set(0,.087,lane); line.material=materials.lineMat;
    }
    o.finish({orientation:'horizontal'});
  }

  // Intersection/crosswalk markings + traffic lights as one logical object.
  {
    const o=makeRoot(`intersection:${chunkX}:${chunkZ}`,'intersection','Intersection',centerX,0,centerZ);
    for (const [dx,dz] of [[-6,-6],[6,-6],[-6,6],[6,6]]) {
      const cross=o.add(B.MeshBuilder.CreateBox(`${o.id}-cross-${dx}-${dz}`,{width:2.8,height:.064,depth:.26},scene));
      cross.position.set(dx,.086,dz); cross.material=materials.lineMat;
    }
    for (const [dx,dz,rot] of [[-4.8,-4.8,0],[4.8,-4.8,Math.PI/2],[-4.8,4.8,-Math.PI/2],[4.8,4.8,Math.PI]]) {
      const pole=o.add(B.MeshBuilder.CreateCylinder(`${o.id}-pole-${dx}-${dz}`,{height:3.5,diameter:.11,tessellation:8},scene));
      pole.position.set(dx,1.8,dz); pole.material=materials.metalMat;
      const bar=o.add(B.MeshBuilder.CreateBox(`${o.id}-bar-${dx}-${dz}`,{width:.16,height:.14,depth:1.45},scene));
      bar.position.set(dx,3.42,dz); bar.rotation.y=rot; bar.material=materials.metalMat;
      const lamp=o.add(B.MeshBuilder.CreateBox(`${o.id}-lamp-${dx}-${dz}`,{width:.22,height:.6,depth:.18},scene));
      lamp.position.set(dx,3.2,dz); lamp.material=accentMat;
    }
    o.finish();
  }

  const blockCenters=[[-25,-25],[25,-25],[-25,25],[25,25]];
  blockCenters.forEach(([ox,oz],index)=>{
    const blockX=centerX+ox, blockZ=centerZ+oz;

    const sidewalk=makeRoot(`sidewalk:${chunkX}:${chunkZ}:${index}`,'sidewalk',`Sidewalk block ${index+1}`,blockX,0,blockZ);
    const lot=sidewalk.add(B.MeshBuilder.CreateBox(`${sidewalk.id}-lot`,{width:31,height:.12,depth:31},scene));
    lot.position.y=.075; lot.material=materials.sidewalkMat; lot.checkCollisions=true;
    const inset=sidewalk.add(B.MeshBuilder.CreateBox(`${sidewalk.id}-plaza`,{width:24.5,height:.02,depth:24.5},scene));
    inset.position.y=.15; inset.material=materials.groundMat;
    addFurniture(B,scene,materials,shadowGenerator,sidewalk, district.id);
    sidewalk.finish();

    const count=2+((Math.abs(seed)+index)%2);
    for (let j=0;j<count;j++) {
      const sideX=j%2?1:-1;
      const sideZ=j<2?1:-1;
      const bx=blockX+sideX*(5.5+(Math.abs(seed+j*7)%4));
      const bz=blockZ+sideZ*(5.5+(Math.abs(seed+j*5)%4));
      createBuildingObject({
        B,scene,shadowGenerator,materials,makeRoot,
        id:`building:${chunkX}:${chunkZ}:${index}:${j}`,
        label:`Filler building ${index+1}.${j+1}`,
        x:bx,z:bz,seed:seed+index*11+j,
        accentMat,signMat,buildingMat:(seed&1)?altBuildingMat:materials.buildingMats[Math.abs(seed+j)%materials.buildingMats.length]
      });
    }
  });

  for (let i=0;i<style.foliage;i++) {
    const angle=((Math.abs(seed)%17)+i*1.65);
    const radius=14+(Math.abs(seed+i*13)%19);
    const x=centerX+Math.cos(angle)*radius;
    const z=centerZ+Math.sin(angle)*radius;
    const o=makeRoot(`tree:${chunkX}:${chunkZ}:${i}`,'tree',`Tree ${i+1}`,x,0,z);
    addTree(B,scene,shadowGenerator,materials,o);
    o.finish();
  }

  [[-6,-18],[6,18],[-18,6],[18,-6],[-6,18],[6,-18]].forEach(([dx,dz],i)=>{
    const o=makeRoot(`lamp:${chunkX}:${chunkZ}:${i}`,'light',`Street light ${i+1}`,centerX+dx,0,centerZ+dz);
    addLamp(B,scene,materials,o,signMat);
    o.finish();
  });

  const makeCar=(id,label,x,z,rotation,color,scale,movingMeta=null)=>{
    const o=makeRoot(id,movingMeta?'traffic-car':'parked-car',label,x,.12,z);
    o.root.rotation.y=rotation;
    addCar(B,scene,shadowGenerator,materials,o,color,scale,chunkMaterials);
    const rec=o.finish(movingMeta||{});
    if (movingMeta) {
      const car={id,root:o.root,...movingMeta};
      localCars.push(car);
      activeCars.push(car);
    }
    return rec;
  };

  makeCar(`parked-a:${chunkX}:${chunkZ}`,'Parked car A',centerX+12,centerZ+16,Math.PI/2,style.cars[Math.abs(seed)%style.cars.length],.82);
  if ((seed&3)!==0) {
    makeCar(`parked-b:${chunkX}:${chunkZ}`,'Parked car B',centerX-17,centerZ-12,0,style.cars[(Math.abs(seed)+2)%style.cars.length],.78);
  }

  const vertical=(seed&1)===0;
  const direction=(seed&2)===0?1:-1;
  if (vertical) {
    makeCar(`traffic:${chunkX}:${chunkZ}`,'Traffic car',centerX+(direction>0?-2:2),centerZ-direction*size*.42,direction>0?0:Math.PI,
      style.cars[(Math.abs(seed)+1)%style.cars.length],.8,
      {axis:'z',direction,speed:3.8+(Math.abs(seed)%4)*.45,min:centerZ-size/2,max:centerZ+size/2});
  } else {
    makeCar(`traffic:${chunkX}:${chunkZ}`,'Traffic car',centerX-direction*size*.42,centerZ+(direction>0?2:-2),direction>0?Math.PI/2:-Math.PI/2,
      style.cars[(Math.abs(seed)+1)%style.cars.length],.8,
      {axis:'x',direction,speed:3.8+(Math.abs(seed)%4)*.45,min:centerX-size/2,max:centerX+size/2});
  }

  return {
    dispose(){
      for (const car of localCars) {
        const idx=activeCars.indexOf(car);
        if (idx>=0) activeCars.splice(idx,1);
      }
      for (const item of owned) {
        try { item.dispose(false,false); } catch (_) {}
      }
      for (const mat of chunkMaterials) {
        try { mat.dispose(); } catch (_) {}
      }
    }
  };
}

function createBuildingObject({B,scene,shadowGenerator,materials,makeRoot,id,label,x,z,seed,accentMat,signMat,buildingMat}) {
  const height=8+(Math.abs(seed*7)%20);
  const width=8+(Math.abs(seed*3)%7);
  const depth=8+(Math.abs(seed*5)%7);
  const o=makeRoot(id,'building',label,x,0,z);
  const building=o.add(B.MeshBuilder.CreateBox(`${id}-body`,{width,height,depth},scene));
  building.position.y=height/2+.15; building.material=buildingMat; building.checkCollisions=true; building.receiveShadows=true;
  shadowGenerator.addShadowCaster(building);
  const awning=o.add(B.MeshBuilder.CreateBox(`${id}-awning`,{width:Math.max(3.4,width*.54),height:.2,depth:1.1},scene));
  awning.position.set(0,2.7,depth/2+.55); awning.material=accentMat;
  const door=o.add(B.MeshBuilder.CreateBox(`${id}-door`,{width:1.65,height:2.85,depth:.08},scene));
  door.position.set(0,1.45,depth/2+.05); door.material=materials.glassMat;
  const sign=o.add(B.MeshBuilder.CreateBox(`${id}-sign`,{width:Math.max(2.8,width*.5),height:.52,depth:.14},scene));
  sign.position.set(0,3.45,depth/2+.18); sign.material=signMat;
  const roof=o.add(B.MeshBuilder.CreateBox(`${id}-roof`,{width:width*.45,height:.7,depth:depth*.4},scene));
  roof.position.set(.8,height+.5,-.6); roof.material=buildingMat;
  for (let row=0;row<Math.max(1,Math.floor(height/3.2)-1);row++) {
    for (const side of [-1,1]) {
      const win=o.add(B.MeshBuilder.CreateBox(`${id}-window-${row}-${side}`,{width:Math.max(1.7,width*.22),height:.72,depth:.07},scene));
      win.position.set(side*width*.26,Math.min(height-1.2,4.1+row*2.25),depth/2+.05);
      win.material=materials.glassMat;
    }
  }
  o.finish({width,height,depth});
}

function addFurniture(B,scene,materials,shadowGenerator,o,districtId) {
  const planter=o.add(B.MeshBuilder.CreateBox(`${o.id}-planter`,{width:3.2,height:.55,depth:1.1},scene));
  planter.position.set(-6.4,.38,7.2); planter.material=materials.trunkMat;
  const seat=o.add(B.MeshBuilder.CreateBox(`${o.id}-bench-seat`,{width:1.9,height:.15,depth:.5},scene));
  seat.position.set(7.3,.68,-6.5); seat.material=materials.trunkMat;
  const back=o.add(B.MeshBuilder.CreateBox(`${o.id}-bench-back`,{width:1.9,height:.55,depth:.14},scene));
  back.position.set(7.3,.95,-6.78); back.material=materials.trunkMat;
  if (districtId!=='harbor') {
    const dumpster=o.add(B.MeshBuilder.CreateBox(`${o.id}-dumpster`,{width:1.4,height:1.15,depth:1},scene));
    dumpster.position.set(-7.2,.68,-7.1); dumpster.material=materials.metalMat;
    shadowGenerator.addShadowCaster(dumpster);
  }
  for (const [dx,dz] of [[-10.8,-10.8],[10.8,-10.8],[-10.8,10.8],[10.8,10.8]]) {
    const bollard=o.add(B.MeshBuilder.CreateCylinder(`${o.id}-bollard-${dx}-${dz}`,{height:.72,diameter:.18,tessellation:8},scene));
    bollard.position.set(dx,.44,dz); bollard.material=materials.metalMat;
  }
}

function addTree(B,scene,shadowGenerator,materials,o) {
  const trunk=o.add(B.MeshBuilder.CreateCylinder(`${o.id}-trunk`,{height:2.2,diameter:.3,tessellation:7},scene));
  trunk.position.y=1.18; trunk.material=materials.trunkMat;
  const crown=o.add(B.MeshBuilder.CreateSphere(`${o.id}-crown`,{diameter:2.3,segments:7},scene));
  crown.position.y=3; crown.scaling.y=1.2; crown.material=materials.foliageMat;
  shadowGenerator.addShadowCaster(crown);
}

function addLamp(B,scene,materials,o,bulbMat) {
  const pole=o.add(B.MeshBuilder.CreateCylinder(`${o.id}-pole`,{height:4.2,diameter:.1,tessellation:7},scene));
  pole.position.y=2.1; pole.material=materials.metalMat;
  const arm=o.add(B.MeshBuilder.CreateBox(`${o.id}-arm`,{width:.14,height:.12,depth:.9},scene));
  arm.position.set(.22,3.82,0); arm.material=materials.metalMat;
  const bulb=o.add(B.MeshBuilder.CreateSphere(`${o.id}-bulb`,{diameter:.28,segments:6},scene));
  bulb.position.set(.44,3.73,0); bulb.material=bulbMat;
}

function addCar(B,scene,shadowGenerator,materials,o,color,scale,ownedMaterials) {
  const bodyMat=tintMaterial(B,scene,`${o.id}-body-mat`,color);
  ownedMaterials.push(bodyMat);
  const body=o.add(B.MeshBuilder.CreateBox(`${o.id}-body`,{width:1.78,height:.55,depth:3.95},scene));
  body.position.y=.55; body.material=bodyMat; shadowGenerator.addShadowCaster(body);
  const cabin=o.add(B.MeshBuilder.CreateBox(`${o.id}-cabin`,{width:1.45,height:.55,depth:1.65},scene));
  cabin.position.set(0,.98,-.15); cabin.material=materials.glassMat;
  for (const [x,y,z] of [[-.88,.34,-1.2],[.88,.34,-1.2],[-.88,.34,1.2],[.88,.34,1.2]]) {
    const wheel=o.add(B.MeshBuilder.CreateCylinder(`${o.id}-wheel-${x}-${z}`,{height:.24,diameter:.55,tessellation:10},scene));
    wheel.position.set(x,y,z); wheel.rotation.z=Math.PI/2; wheel.material=materials.metalMat;
  }
  o.root.scaling.setAll(scale);
}

function getDistrictFor(x,z) {
  let best=WORLD3D_DISTRICTS[0],bestDist=Infinity;
  for (const district of WORLD3D_DISTRICTS) {
    const dx=x-district.x,dz=z-district.z,d=dx*dx+dz*dz;
    if (d<bestDist){best=district;bestDist=d;}
  }
  return best;
}
function tintMaterial(B,scene,name,color,emissive=false) {
  const mat=new B.StandardMaterial(name,scene);
  const c=B.Color3.FromHexString(color);
  mat.diffuseColor=c;
  mat.specularColor=new B.Color3(.1,.1,.1);
  if (emissive) mat.emissiveColor=c.scale(.35);
  return mat;
}
function hash2(x,z) {
  let h=(x*374761393+z*668265263)|0;
  h=(h^(h>>>13))*1274126177;
  return h^(h>>>16);
}
function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function radians(deg){return finite(deg)*Math.PI/180;}
function degrees(rad){return finite(rad)*180/Math.PI;}
