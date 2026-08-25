import { WORLD3D_CITY_LAYOUT } from './world3d-city-layout.js';

const LAYOUT_PATH='public/world3d-city-layout.js';
const DRAFT_KEY='riftcity-world-editor-draft-v2';

export function cloneCityLayout() {
  return normalizeLayout(WORLD3D_CITY_LAYOUT);
}

export function createLayoutObjectManager(B,scene,shadowGenerator,materials,initialObjects=[]) {
  const records=new Map();

  const build=object=>{
    const root=new B.TransformNode(`custom-${object.id}`,scene);
    const meshes=[];
    const add=mesh=>{
      mesh.parent=root;
      mesh.metadata={...(mesh.metadata||{}),worldEditor:{kind:'custom',id:object.id,type:object.type||'building',label:object.label||object.id}};
      meshes.push(mesh);
      return mesh;
    };
    root.metadata={...(root.metadata||{}),worldEditor:{kind:'custom',id:object.id,type:object.type||'building',label:object.label||object.id}};

    const type=object.type||'building';
    if (type==='road') {
      const road=add(B.MeshBuilder.CreateBox(`${object.id}-road`,{width:9,height:.08,depth:24},scene));
      road.position.y=.05;road.material=materials.roadMat;
      for (const x of [-2.15,2.15]) {
        const line=add(B.MeshBuilder.CreateBox(`${object.id}-lane-${x}`,{width:.08,height:.09,depth:22},scene));
        line.position.set(x,.1,0);line.material=materials.lineMat;
      }
    } else if (type==='sidewalk') {
      const lot=add(B.MeshBuilder.CreateBox(`${object.id}-sidewalk`,{width:16,height:.14,depth:16},scene));
      lot.position.y=.08;lot.material=materials.sidewalkMat;lot.checkCollisions=true;
    } else if (type==='intersection') {
      const pad=add(B.MeshBuilder.CreateBox(`${object.id}-intersection`,{width:12,height:.07,depth:12},scene));
      pad.position.y=.05;pad.material=materials.roadMat;
      for (const z of [-4,4]) {
        const line=add(B.MeshBuilder.CreateBox(`${object.id}-cross-${z}`,{width:8,height:.09,depth:.28},scene));
        line.position.set(0,.1,z);line.material=materials.lineMat;
      }
    } else if (type==='tree') {
      const trunk=add(B.MeshBuilder.CreateCylinder(`${object.id}-trunk`,{height:2.4,diameter:.34,tessellation:8},scene));
      trunk.position.y=1.2;trunk.material=materials.trunkMat;
      const crown=add(B.MeshBuilder.CreateSphere(`${object.id}-crown`,{diameter:2.6,segments:8},scene));
      crown.position.y=3.15;crown.scaling.y=1.2;crown.material=materials.foliageMat;
      shadowGenerator.addShadowCaster(crown);
    } else if (type==='light') {
      const pole=add(B.MeshBuilder.CreateCylinder(`${object.id}-pole`,{height:4.2,diameter:.12,tessellation:8},scene));
      pole.position.y=2.1;pole.material=materials.metalMat;
      const bulb=add(B.MeshBuilder.CreateSphere(`${object.id}-bulb`,{diameter:.32,segments:8},scene));
      bulb.position.set(.38,4.05,0);bulb.material=materials.accentMat;
    } else if (type==='parked-car') {
      addCar(B,scene,shadowGenerator,materials,add,object.id);
    } else if (type==='prop') {
      const prop=add(B.MeshBuilder.CreateBox(`${object.id}-prop`,{width:1.4,height:1.15,depth:1},scene));
      prop.position.y=.58;prop.material=materials.metalMat;shadowGenerator.addShadowCaster(prop);
    } else {
      const body=add(B.MeshBuilder.CreateBox(`${object.id}-building`,{width:10,height:10,depth:10},scene));
      body.position.y=5;body.material=materials.buildingMats?.[0]||materials.metalMat;body.checkCollisions=true;body.receiveShadows=true;
      shadowGenerator.addShadowCaster(body);
      const door=add(B.MeshBuilder.CreateBox(`${object.id}-door`,{width:1.8,height:2.8,depth:.1},scene));
      door.position.set(0,1.4,5.05);door.material=materials.glassMat;
      const sign=add(B.MeshBuilder.CreateBox(`${object.id}-sign`,{width:4.6,height:.55,depth:.15},scene));
      sign.position.set(0,3.5,5.12);sign.material=materials.accentMat;
    }
    records.set(object.id,{id:object.id,type,label:object.label||object.id,root,meshes});
    applyObjectTransform(object,root);
    return records.get(object.id);
  };

  const clear=()=>{
    for (const record of records.values()) {
      for (const mesh of record.meshes) try{mesh.dispose(false,false);}catch(_){}
      try{record.root.dispose(false,false);}catch(_){}
    }
    records.clear();
  };

  const replaceAll=objects=>{
    clear();
    for (const object of objects||[]) build(object);
  };

  replaceAll(initialObjects);

  return {
    updateObject(object) {
      let record=records.get(object.id);
      if (!record) record=build(object);
      applyObjectTransform(object,record.root);
    },
    replaceAll,
    remove(id) {
      const record=records.get(id);
      if (!record) return;
      for (const mesh of record.meshes) try{mesh.dispose(false,false);}catch(_){}
      try{record.root.dispose(false,false);}catch(_){}
      records.delete(id);
    },
    getRecord(id){return records.get(id)||null;},
    dispose:clear
  };
}

export function mountWorldEditor({
  B,root,scene,camera,player,locationEntries,chunkManager,environmentManager,objectManager,initialLayout,onLayoutChange
}) {
  const toggle=root.querySelector('#world3d-editor-button');
  const panel=root.querySelector('#world3d-editor');
  const close=root.querySelector('#world3d-editor-close');
  if (!toggle||!panel) return null;

  let layout=loadDraft(initialLayout);
  let selected=null;
  let step=1;
  let mode='move';
  let syncingGizmo=false;
  let lastTransformSignature='';
  const undo=[];
  const redo=[];

  const q=s=>panel.querySelector(s);
  const status=q('[data-editor-status]');
  const selectedLabel=q('[data-editor-selected]');
  const selectedType=q('[data-editor-type]');
  const xOut=q('[data-editor-x]');
  const yOut=q('[data-editor-y]');
  const zOut=q('[data-editor-z]');
  const rotOut=q('[data-editor-rot]');
  const scaleOut=q('[data-editor-scale]');
  const stepSelect=q('[data-editor-step]');
  const jsonBox=q('[data-editor-json]');
  const placeType=q('[data-editor-place-type]');
  const gridButton=q('[data-editor-grid]');
  const gizmoManager=B.GizmoManager?new B.GizmoManager(scene):null;
  let gridRoot=null;

  const say=message=>{if(status)status.textContent=message;};
  const snapshot=()=>JSON.stringify(layout);
  const pushUndo=()=>{
    undo.push(snapshot());
    if(undo.length>60)undo.shift();
    redo.length=0;
  };
  const persist=message=>{
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(layout));}catch(_){}
    onLayoutChange?.(layout);
    refreshSelection();
    if(message)say(message);
  };

  const getCustom=id=>layout.customObjects.find(row=>row.id===id);
  const getLocation=id=>locationEntries.find(row=>row.id===id);
  const getEnvironment=id=>environmentManager.getEditableRecord(id);

  const selectedRecord=()=>{
    if(!selected)return null;
    if(selected.kind==='custom')return objectManager.getRecord(selected.id);
    if(selected.kind==='environment')return getEnvironment(selected.id);
    return null;
  };

  const selectedData=()=>{
    if(!selected)return null;
    if(selected.kind==='custom')return getCustom(selected.id);
    if(selected.kind==='location')return getLocation(selected.id);
    if(selected.kind==='environment')return layout.environmentOverrides[selected.id]||environmentSnapshot(selected.id);
    return null;
  };

  const refreshSelection=()=>{
    if(!selected){
      selectedLabel.textContent='Nothing selected';
      selectedType.textContent='Tap anything in the city.';
      xOut.textContent=yOut.textContent=zOut.textContent=rotOut.textContent=scaleOut.textContent='—';
      attachGizmo(null);
      return;
    }
    const data=selectedData();
    if(!data){selected=null;refreshSelection();return;}
    const record=selectedRecord();
    selectedLabel.textContent=data.label||record?.label||data.name||selected.id;
    selectedType.textContent=selected.kind==='location'?'RiftCity location':(record?.type||data.type||selected.kind);
    const t=record?.root?readRoot(record.root):data;
    xOut.textContent=format(t.x);yOut.textContent=format(t.y);zOut.textContent=format(t.z);
    rotOut.textContent=`${format(t.rotationY)}°`;
    scaleOut.textContent=`${format(t.scaleX,1)} / ${format(t.scaleY,1)} / ${format(t.scaleZ,1)}`;
    attachGizmo(record?.root||null);
  };

  const setSelected=next=>{
    selected=next;
    lastTransformSignature='';
    refreshSelection();
    say(next?'Selected. W/E/R = move/rotate/scale.':'Selection cleared.');
  };

  function attachGizmo(node){
    if(!gizmoManager)return;
    try{
      gizmoManager.positionGizmoEnabled=!!node&&mode==='move';
      gizmoManager.rotationGizmoEnabled=!!node&&mode==='rotate';
      gizmoManager.scaleGizmoEnabled=!!node&&mode==='scale';
      if(gizmoManager.attachToNode)gizmoManager.attachToNode(node||null);
      else if(gizmoManager.attachToMesh)gizmoManager.attachToMesh(node||null);
    }catch(_){}
  }

  const setMode=next=>{
    mode=next;
    panel.querySelectorAll('[data-editor-mode]').forEach(b=>b.classList.toggle('active',b.dataset.editorMode===mode));
    refreshSelection();
    say(`${mode.toUpperCase()} mode.`);
  };

  const makeEnvironmentOverride=id=>{
    const record=getEnvironment(id);
    if(!record)return null;
    const current=readRoot(record.root);
    const existing=layout.environmentOverrides[id]||{};
    return {...existing,...current,type:record.type,label:record.label};
  };

  const applyEnvironment=id=>{
    const override=layout.environmentOverrides[id];
    if(override)environmentManager.applyOverride(id,override);
    else environmentManager.resetOverride(id);
  };

  const updateSelectedFromRoot=()=>{
    if(syncingGizmo||!selected)return;
    const record=selectedRecord();
    if(!record?.root)return;
    const current=readRoot(record.root);
    const sig=JSON.stringify(current);
    if(sig===lastTransformSignature)return;
    if(lastTransformSignature) {
      if(selected.kind==='custom'){
        Object.assign(getCustom(selected.id),current);
      } else if(selected.kind==='environment'){
        layout.environmentOverrides[selected.id]={...(layout.environmentOverrides[selected.id]||{}),...current,type:record.type,label:record.label,freezeTraffic:record.type==='traffic-car'};
      }
      try{localStorage.setItem(DRAFT_KEY,JSON.stringify(layout));}catch(_){}
      onLayoutChange?.(layout);
      refreshSelectionReadout(current);
    }
    lastTransformSignature=sig;
  };

  const refreshSelectionReadout=t=>{
    xOut.textContent=format(t.x);yOut.textContent=format(t.y);zOut.textContent=format(t.z);
    rotOut.textContent=`${format(t.rotationY)}°`;
    scaleOut.textContent=`${format(t.scaleX,1)} / ${format(t.scaleY,1)} / ${format(t.scaleZ,1)}`;
  };

  const mutateTransform=(axis,amount)=>{
    if(!selected)return say('Select something first.');
    pushUndo();
    if(selected.kind==='location'){
      const entry=getLocation(selected.id);
      if(axis==='x'||axis==='z'){
        entry[axis]=round(number(entry[axis])+amount);
      }else if(axis==='y'){
        return say('Main locations stay ground-aligned for now.');
      }
      layout.locationOverrides[entry.id]={x:round(entry.x),z:round(entry.z)};
      chunkManager.refreshEntry?.(entry.id);
      chunkManager.update(player.root.position.x,player.root.position.z);
    }else{
      const record=selectedRecord();
      if(!record)return;
      record.root.position[axis]+=amount;
      commitNodeTransform(record);
    }
    persist('Moved.');
  };

  const rotateSelected=amount=>{
    if(!selected||selected.kind==='location')return say('Select an editable world object to rotate.');
    pushUndo();
    const record=selectedRecord();if(!record)return;
    record.root.rotation.y+=radians(amount);
    commitNodeTransform(record);
    persist('Rotated.');
  };

  const scaleSelected=(axis,amount)=>{
    if(!selected||selected.kind==='location')return say('Select an editable world object to scale.');
    pushUndo();
    const record=selectedRecord();if(!record)return;
    record.root.scaling[axis]=Math.max(.05,record.root.scaling[axis]+amount);
    commitNodeTransform(record);
    persist('Scaled.');
  };

  const commitNodeTransform=record=>{
    const current=readRoot(record.root);
    if(selected.kind==='custom'){
      Object.assign(getCustom(selected.id),current);
      objectManager.updateObject(getCustom(selected.id));
    }else if(selected.kind==='environment'){
      layout.environmentOverrides[selected.id]={...(layout.environmentOverrides[selected.id]||{}),...current,type:record.type,label:record.label,freezeTraffic:record.type==='traffic-car'};
      environmentManager.applyOverride(selected.id,layout.environmentOverrides[selected.id]);
    }
    lastTransformSignature=JSON.stringify(current);
  };

  const addObject=(forcedType=null)=>{
    pushUndo();
    const type=forcedType||placeType?.value||'building';
    const id=`custom-${type}-${Date.now().toString(36)}`;
    const labels={road:'Road segment',sidewalk:'Sidewalk',intersection:'Intersection',building:'Building',tree:'Tree',light:'Street light','parked-car':'Parked car',prop:'Street prop'};
    const object={id,type,label:labels[type]||`Custom ${type}`,x:round(player.root.position.x+4),y:0,z:round(player.root.position.z+4),rotationX:0,rotationY:0,rotationZ:0,scaleX:1,scaleY:1,scaleZ:1};
    layout.customObjects.push(object);
    objectManager.updateObject(object);
    setSelected({kind:'custom',id});
    persist(`${object.label} added beside the player.`);
  };

  const duplicateSelected=()=>{
    if(!selected)return say('Select something first.');
    if(selected.kind==='location')return say('Core locations cannot be duplicated.');
    pushUndo();
    const record=selectedRecord();if(!record)return;
    const t=readRoot(record.root);
    const type=record.type||'building';
    const id=`custom-${type}-${Date.now().toString(36)}`;
    const object={id,type,label:`Copy of ${record.label||type}`,...t,x:round(t.x+2),z:round(t.z+2)};
    layout.customObjects.push(object);
    objectManager.updateObject(object);
    setSelected({kind:'custom',id});
    persist('Duplicated.');
  };

  const deleteSelected=()=>{
    if(!selected)return say('Select something first.');
    if(selected.kind==='location')return say('Core RiftCity locations cannot be deleted; move them instead.');
    pushUndo();
    if(selected.kind==='custom'){
      layout.customObjects=layout.customObjects.filter(row=>row.id!==selected.id);
      objectManager.remove(selected.id);
    }else{
      const override=makeEnvironmentOverride(selected.id)||{};
      layout.environmentOverrides[selected.id]={...override,deleted:true};
      environmentManager.applyOverride(selected.id,layout.environmentOverrides[selected.id]);
    }
    selected=null;
    persist('Deleted from the visual layout.');
  };

  const resetSelected=()=>{
    if(!selected)return say('Select something first.');
    pushUndo();
    if(selected.kind==='location'){
      delete layout.locationOverrides[selected.id];
      const entry=getLocation(selected.id);
      if(entry?.baseX!=null){entry.x=entry.baseX;entry.z=entry.baseZ;}
      chunkManager.refreshEntry?.(selected.id);
      chunkManager.update(player.root.position.x,player.root.position.z);
    }else if(selected.kind==='environment'){
      delete layout.environmentOverrides[selected.id];
      environmentManager.resetOverride(selected.id);
    }else{
      const object=getCustom(selected.id);
      object.rotationX=object.rotationY=object.rotationZ=0;
      object.scaleX=object.scaleY=object.scaleZ=1;
      objectManager.updateObject(object);
    }
    persist('Selection reset.');
  };

  const applyWholeLayout=()=>{
    syncingGizmo=true;
    for(const entry of locationEntries){
      const o=layout.locationOverrides?.[entry.id];
      entry.x=o?.x??entry.baseX??entry.x;
      entry.z=o?.z??entry.baseZ??entry.z;
      chunkManager.refreshEntry?.(entry.id);
    }
    objectManager.replaceAll(layout.customObjects||[]);
    environmentManager.setOverrides(layout.environmentOverrides||{});
    chunkManager.update(player.root.position.x,player.root.position.z);
    environmentManager.update(player.root.position.x,player.root.position.z,true);
    selected=null;
    syncingGizmo=false;
    refreshSelection();
    onLayoutChange?.(layout);
  };

  const doUndo=()=>{
    if(!undo.length)return say('Nothing to undo.');
    redo.push(snapshot());
    layout=normalizeLayout(JSON.parse(undo.pop()));
    applyWholeLayout();persist('Undo complete.');
  };
  const doRedo=()=>{
    if(!redo.length)return say('Nothing to redo.');
    undo.push(snapshot());
    layout=normalizeLayout(JSON.parse(redo.pop()));
    applyWholeLayout();persist('Redo complete.');
  };

  const clearDraft=()=>{
    pushUndo();
    try{localStorage.removeItem(DRAFT_KEY);}catch(_){}
    layout=normalizeLayout(initialLayout);
    applyWholeLayout();persist('Local draft reset to the deployed layout.');
  };

  const exportPatch=async()=>{
    const content=serializeLayout(layout);
    let baseSha=null;
    try{
      const response=await fetch('/world3d-city-layout.js',{cache:'no-store'});
      if(response.ok)baseSha=await sha256(await response.text());
    }catch(_){}
    const patch={
      format:'riftcity-ai-patch',version:1,title:'RiftCity full visual world edit',
      target_repo:'Arctic403/RiftCityV1',target_branch:'main',base_snapshot_sha256:null,
      changes:[{action:'write',path:LAYOUT_PATH,base_sha256:baseSha,reason:'Apply roads, sidewalks, environment objects, locations and custom placements exported from the in-game World Editor.',content}]
    };
    const json=JSON.stringify(patch,null,2);
    if(jsonBox){jsonBox.hidden=false;jsonBox.value=json;}
    downloadText(`RiftCity-World-${new Date().toISOString().replace(/[:.]/g,'-')}.patch.json`,json);
    say('City patch exported. Import it into your custom Editor.');
  };

  const toggleGrid=()=>{
    if(gridRoot){gridRoot.dispose();gridRoot=null;gridButton?.classList.remove('active');return;}
    gridRoot=new B.TransformNode('editor-grid-root',scene);
    const mat=new B.StandardMaterial('editor-grid-mat',scene);
    mat.emissiveColor=B.Color3.FromHexString('#d68d35').scale(.4);mat.alpha=.5;
    const size=84,extent=336;
    for(let x=-extent;x<=extent;x+=size){
      const line=B.MeshBuilder.CreateBox(`grid-x-${x}`,{width:.08,height:.03,depth:extent*2},scene);
      line.position.set(x,.19,0);line.material=mat;line.parent=gridRoot;
    }
    for(let z=-extent;z<=extent;z+=size){
      const line=B.MeshBuilder.CreateBox(`grid-z-${z}`,{width:extent*2,height:.03,depth:.08},scene);
      line.position.set(0,.19,z);line.material=mat;line.parent=gridRoot;
    }
    gridRoot.metadata={editorMaterial:mat};
    gridButton?.classList.add('active');
  };

  toggle.addEventListener('click',()=>{
    panel.classList.toggle('open');
    toggle.classList.toggle('active',panel.classList.contains('open'));
    refreshSelection();
  });
  close?.addEventListener('click',()=>panel.classList.remove('open'));
  stepSelect?.addEventListener('change',()=>{step=Math.max(.1,number(stepSelect.value,1));});

  panel.querySelectorAll('[data-editor-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.editorMode)));
  panel.querySelectorAll('[data-editor-nudge]').forEach(button=>button.addEventListener('click',()=>{
    const [axis,direction]=button.dataset.editorNudge.split(':');
    mutateTransform(axis,(direction==='+'?1:-1)*step);
  }));
  panel.querySelectorAll('[data-editor-rotate]').forEach(button=>button.addEventListener('click',()=>rotateSelected(Number(button.dataset.editorRotate))));
  panel.querySelectorAll('[data-editor-scale]').forEach(button=>button.addEventListener('click',()=>{
    const [axis,amount]=button.dataset.editorScale.split(':');
    scaleSelected(axis,Number(amount));
  }));
  q('[data-editor-add]')?.addEventListener('click',()=>addObject());
  q('[data-editor-duplicate]')?.addEventListener('click',duplicateSelected);
  q('[data-editor-delete]')?.addEventListener('click',deleteSelected);
  q('[data-editor-reset]')?.addEventListener('click',resetSelected);
  q('[data-editor-undo]')?.addEventListener('click',doUndo);
  q('[data-editor-redo]')?.addEventListener('click',doRedo);
  q('[data-editor-export]')?.addEventListener('click',exportPatch);
  q('[data-editor-clear-draft]')?.addEventListener('click',clearDraft);
  gridButton?.addEventListener('click',toggleGrid);

  const pointerObserver=scene.onPointerObservable.add(pointerInfo=>{
    if(!panel.classList.contains('open')||pointerInfo.type!==1)return;
    const metadata=pointerInfo.pickInfo?.pickedMesh?.metadata?.worldEditor;
    if(!metadata)return;
    if(metadata.kind==='custom'||metadata.kind==='location'||metadata.kind==='environment'){
      setSelected({kind:metadata.kind,id:metadata.id});
    }
  });

  const keyboard=event=>{
    if(!panel.classList.contains('open'))return;
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    const mod=event.ctrlKey||event.metaKey;
    if(mod&&event.code==='KeyZ'){event.preventDefault();return event.shiftKey?doRedo():doUndo();}
    if(mod&&event.code==='KeyY'){event.preventDefault();return doRedo();}
    if(mod&&event.code==='KeyD'){event.preventDefault();return duplicateSelected();}
    if(event.code==='KeyW'){event.preventDefault();return setMode('move');}
    if(event.code==='KeyE'){event.preventDefault();return setMode('rotate');}
    if(event.code==='KeyR'){event.preventDefault();return setMode('scale');}
    if(event.code==='Delete'||event.code==='Backspace'){event.preventDefault();return deleteSelected();}
    const amount=event.shiftKey?step*5:step;
    if(event.code==='ArrowLeft'){event.preventDefault();return mutateTransform('x',-amount);}
    if(event.code==='ArrowRight'){event.preventDefault();return mutateTransform('x',amount);}
    if(event.code==='ArrowUp'){event.preventDefault();return mutateTransform('z',-amount);}
    if(event.code==='ArrowDown'){event.preventDefault();return mutateTransform('z',amount);}
    if(event.code==='PageUp'){event.preventDefault();return mutateTransform('y',amount);}
    if(event.code==='PageDown'){event.preventDefault();return mutateTransform('y',-amount);}
  };
  window.addEventListener('keydown',keyboard);

  const transformObserver=scene.onBeforeRenderObservable.add(()=>{
    if(panel.classList.contains('open'))updateSelectedFromRoot();
  });

  applyWholeLayout();
  setMode('move');
  say('Full editor ready. Select roads, sidewalks, buildings, props, cars or locations.');

  return {
    isEditing:()=>panel.classList.contains('open'),
    getLayout:()=>layout,
    dispose(){
      try{scene.onPointerObservable.remove(pointerObserver);}catch(_){}
      try{scene.onBeforeRenderObservable.remove(transformObserver);}catch(_){}
      window.removeEventListener('keydown',keyboard);
      try{gizmoManager?.dispose?.();}catch(_){}
      if(gridRoot){
        try{gridRoot.metadata?.editorMaterial?.dispose?.();}catch(_){}
        try{gridRoot.dispose();}catch(_){}
      }
    }
  };
}

export function serializeLayout(layout) {
  const clean=normalizeLayout(layout);
  return `export const WORLD3D_CITY_LAYOUT = Object.freeze(${JSON.stringify(clean,null,2)});\n`;
}

function normalizeLayout(layout){
  return JSON.parse(JSON.stringify({
    version:2,
    locationOverrides:layout?.locationOverrides||{},
    environmentOverrides:layout?.environmentOverrides||{},
    customObjects:layout?.customObjects||[]
  }));
}
function loadDraft(initialLayout){
  try{const raw=localStorage.getItem(DRAFT_KEY);if(raw)return normalizeLayout(JSON.parse(raw));}catch(_){}
  return normalizeLayout(initialLayout);
}
function environmentSnapshot(){return {x:0,y:0,z:0,rotationX:0,rotationY:0,rotationZ:0,scaleX:1,scaleY:1,scaleZ:1};}
function applyObjectTransform(object,root){
  root.position.set(number(object.x),number(object.y),number(object.z));
  root.rotation.set(radians(number(object.rotationX)),radians(number(object.rotationY)),radians(number(object.rotationZ)));
  root.scaling.set(Math.max(.05,number(object.scaleX,1)),Math.max(.05,number(object.scaleY,1)),Math.max(.05,number(object.scaleZ,1)));
}
function readRoot(root){
  return {
    x:round(root.position.x),y:round(root.position.y),z:round(root.position.z),
    rotationX:round(degrees(root.rotation.x)),rotationY:round(degrees(root.rotation.y)),rotationZ:round(degrees(root.rotation.z)),
    scaleX:round(root.scaling.x),scaleY:round(root.scaling.y),scaleZ:round(root.scaling.z)
  };
}
function addCar(B,scene,shadowGenerator,materials,add,id){
  const body=add(B.MeshBuilder.CreateBox(`${id}-body`,{width:1.8,height:.58,depth:4},scene));
  body.position.y=.56;body.material=materials.accentMat;shadowGenerator.addShadowCaster(body);
  const cabin=add(B.MeshBuilder.CreateBox(`${id}-cabin`,{width:1.46,height:.58,depth:1.7},scene));
  cabin.position.set(0,1.02,-.12);cabin.material=materials.glassMat;
  for(const [x,y,z] of [[-.9,.34,-1.25],[.9,.34,-1.25],[-.9,.34,1.25],[.9,.34,1.25]]){
    const wheel=add(B.MeshBuilder.CreateCylinder(`${id}-wheel-${x}-${z}`,{height:.24,diameter:.56,tessellation:10},scene));
    wheel.position.set(x,y,z);wheel.rotation.z=Math.PI/2;wheel.material=materials.metalMat;
  }
}
function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function round(value){return Math.round(number(value)*100)/100;}
function format(value,fallback=0){return number(value,fallback).toFixed(2);}
function radians(degrees){return number(degrees)*Math.PI/180;}
function degrees(radiansValue){return number(radiansValue)*180/Math.PI;}
async function sha256(text){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function downloadText(filename,text){
  const blob=new Blob([text],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
