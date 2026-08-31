import { RiftEngine } from './rift-engine.js';
import { RiftTerrain } from './rift-terrain.js';

const authScreen=document.querySelector('#auth-screen');
const worldScreen=document.querySelector('#world-screen');
const authForm=document.querySelector('#auth-form');
const authStatus=document.querySelector('#auth-status');
const authSubmit=document.querySelector('#auth-submit');
const canvas=document.querySelector('#rift-canvas');
const characterName=document.querySelector('#character-name');
const terrainStatus=document.querySelector('#terrain-status');
const coords=document.querySelector('#coords');
const tools=document.querySelector('#terrain-tools');
const editorStatus=document.querySelector('#editor-status');
const brushReadout=document.querySelector('#brush-readout');
const radiusInput=document.querySelector('#brush-radius');
const strengthInput=document.querySelector('#brush-strength');
const radiusValue=document.querySelector('#radius-value');
const strengthValue=document.querySelector('#strength-value');
const editButton=document.querySelector('#edit-mode');

let authMode='login';
let engine=null;
let terrain=null;
let worldDocument=null;
let terrainMeshes=new Map();
let playerMesh=null;
let brushMesh=null;
let animationFrame=0;
let lastFrame=performance.now();
let lastPositionSave=0;
let lastCameraPosition=[160,22,178];
let lastCameraTarget=[160,1,160];
let editMode=false;
let brushMode='raise';
let brushHit=null;
let brushStrokeActive=false;
let brushPointerId=null;
let lastBrushApply=0;
const undoStack=[];
const redoStack=[];
const MAX_HISTORY=12;
const LOCAL_DRAFT_KEY='ironvale:terrain:draft:v1';

const player={x:160,y:.9,z:160,yaw:0,vy:0,grounded:true};
const camera={yaw:Math.PI,pitch:.34,distance:9.5,fov:Math.PI/3};
const input={forward:0,strafe:0,keys:new Set()};

document.querySelectorAll('[data-auth-tab]').forEach(button=>button.addEventListener('click',()=>{
  authMode=button.dataset.authTab;
  document.querySelectorAll('[data-auth-tab]').forEach(tab=>tab.classList.toggle('active',tab===button));
  authSubmit.textContent=authMode==='register'?'Create account':'Enter Ironvale';
  authForm.password.autocomplete=authMode==='register'?'new-password':'current-password';
  setAuthStatus('');
}));

authForm.addEventListener('submit',async event=>{
  event.preventDefault();
  authSubmit.disabled=true;
  setAuthStatus(authMode==='register'?'Creating account…':'Signing in…');
  try{
    const result=await api(`/api/auth/${authMode}`,{method:'POST',body:{username:authForm.username.value,password:authForm.password.value}});
    if(!result.ok)throw new Error(result.error||'Authentication failed');
    authForm.reset();
    await bootSession();
  }catch(error){setAuthStatus(error.message,true)}finally{authSubmit.disabled=false}
});

document.querySelector('#logout-button').addEventListener('click',async()=>{
  await api('/api/auth/logout',{method:'POST'}).catch(()=>null);
  stopWorld();showAuth();
});

document.querySelector('#terrain-tools-button').addEventListener('click',()=>{tools.hidden=!tools.hidden});
editButton.addEventListener('click',()=>setEditMode(!editMode));

document.querySelectorAll('[data-brush]').forEach(button=>button.addEventListener('click',()=>{
  brushMode=button.dataset.brush;
  document.querySelectorAll('[data-brush]').forEach(item=>item.classList.toggle('active',item===button));
  refreshEditorLabels();
}));

radiusInput.addEventListener('input',()=>{refreshEditorLabels();rebuildBrushMarker()});
strengthInput.addEventListener('input',refreshEditorLabels);
document.querySelector('#undo-terrain').addEventListener('click',undoTerrain);
document.querySelector('#redo-terrain').addEventListener('click',redoTerrain);
document.querySelector('#save-terrain').addEventListener('click',saveDraft);
document.querySelector('#export-terrain').addEventListener('click',exportDraft);
document.querySelector('#reset-terrain').addEventListener('click',resetTerrain);

window.addEventListener('keydown',event=>{
  if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  const key=event.key.toLowerCase();
  if((event.ctrlKey||event.metaKey)&&key==='z'){event.preventDefault();event.shiftKey?redoTerrain():undoTerrain();return}
  input.keys.add(key);
});
window.addEventListener('keyup',event=>input.keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>input.keys.clear());
window.addEventListener('pagehide',()=>savePosition(true));
window.addEventListener('beforeunload',()=>savePosition(true));

setupCanvasControls();
setupJoystick();
refreshEditorLabels();
bootSession();

async function bootSession(){
  try{
    const data=await api('/api/bootstrap');
    if(!data.ok||!data.authenticated){showAuth();return}
    characterName.textContent=data.character.displayName||data.user.username;
    const saved=data.character.position||{};
    player.x=finiteOr(saved.x,160);player.y=finiteOr(saved.y,.9);player.z=finiteOr(saved.z,160);player.yaw=finiteOr(saved.yaw,0);
    camera.yaw=player.yaw+Math.PI;
    await startWorld(data.world?.url||'/world/ironvale-terrain.json');
  }catch{showAuth()}
}

async function startWorld(url){
  stopWorld();
  authScreen.hidden=true;worldScreen.hidden=false;
  terrainStatus.textContent='Loading blank Rift Terrain…';
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`Terrain failed to load (${response.status})`);
  worldDocument=await response.json();
  terrain=new RiftTerrain(worldDocument.terrain);
  restoreLocalDraft();
  engine=new RiftEngine(canvas);
  rebuildTerrainMeshes();
  playerMesh=engine.addMesh(createCapsuleGeometry(),{position:[player.x,player.y,player.z]});
  snapPlayerToSupport();
  const stats=terrain.getStats?.()||{};
  terrainStatus.textContent=`Blank terrain · ${stats.surfaceChunks??terrainMeshes.size} render chunks`;
  lastFrame=performance.now();
  animationFrame=requestAnimationFrame(frame);
}

function stopWorld(){
  cancelAnimationFrame(animationFrame);animationFrame=0;
  if(engine)engine.destroy();
  engine=null;terrain=null;worldDocument=null;terrainMeshes=new Map();playerMesh=null;brushMesh=null;brushHit=null;
  undoStack.length=0;redoStack.length=0;
  setEditMode(false);
  worldScreen.hidden=true;
}

function showAuth(){authScreen.hidden=false;worldScreen.hidden=true;setAuthStatus('')}

function rebuildTerrainMeshes(){
  if(!engine||!terrain)return;
  for(const mesh of terrainMeshes.values())engine.removeMesh(mesh);
  terrainMeshes.clear();
  const chunksX=Math.ceil(terrain.width/terrain.chunkSize),chunksZ=Math.ceil(terrain.depth/terrain.chunkSize);
  for(let cz=0;cz<chunksZ;cz+=1)for(let cx=0;cx<chunksX;cx+=1){
    const entry=terrain.buildSurfaceChunkGeometry(cx,cz,1);
    terrainMeshes.set(`${cx}:${cz}`,engine.addMesh(entry.geometry||entry));
  }
  rebuildBrushMarker();
}

function rebuildTerrainArea(x,z,radius){
  if(!engine||!terrain)return;
  const minCx=clamp(Math.floor((x-radius-terrain.origin[0])/terrain.chunkSize),0,Math.ceil(terrain.width/terrain.chunkSize)-1);
  const maxCx=clamp(Math.floor((x+radius-terrain.origin[0])/terrain.chunkSize),0,Math.ceil(terrain.width/terrain.chunkSize)-1);
  const minCz=clamp(Math.floor((z-radius-terrain.origin[2])/terrain.chunkSize),0,Math.ceil(terrain.depth/terrain.chunkSize)-1);
  const maxCz=clamp(Math.floor((z+radius-terrain.origin[2])/terrain.chunkSize),0,Math.ceil(terrain.depth/terrain.chunkSize)-1);
  for(let cz=minCz;cz<=maxCz;cz+=1)for(let cx=minCx;cx<=maxCx;cx+=1){
    const key=`${cx}:${cz}`,entry=terrain.buildSurfaceChunkGeometry(cx,cz,1),mesh=terrainMeshes.get(key);
    if(mesh)engine.updateMesh(mesh,entry.geometry||entry);else terrainMeshes.set(key,engine.addMesh(entry.geometry||entry));
  }
}

function snapPlayerToSupport(){
  if(!terrain)return;
  const surface=terrain.supportAtPoint(player.x,player.z,player.y-.9,{maxRise:50,maxDrop:100});
  if(surface!=null){player.y=surface+.9;player.vy=0;player.grounded=true}
  if(playerMesh)playerMesh.position=[player.x,player.y,player.z];
}

function frame(now){
  if(!engine||!terrain)return;
  const dt=Math.min(.05,Math.max(.001,(now-lastFrame)/1000));lastFrame=now;
  updateKeyboardInput();
  if(!editMode)updatePlayer(dt);
  updateCamera();
  engine.render();
  coords.textContent=`${player.x.toFixed(1)}, ${player.y.toFixed(1)}, ${player.z.toFixed(1)}`;
  if(now-lastPositionSave>5000){lastPositionSave=now;savePosition()}
  animationFrame=requestAnimationFrame(frame);
}

function updateKeyboardInput(){
  if(editMode){input.forward=0;input.strafe=0;return}
  let forward=0,strafe=0;
  if(input.keys.has('w')||input.keys.has('arrowup'))forward+=1;
  if(input.keys.has('s')||input.keys.has('arrowdown'))forward-=1;
  if(input.keys.has('d')||input.keys.has('arrowright'))strafe+=1;
  if(input.keys.has('a')||input.keys.has('arrowleft'))strafe-=1;
  if(forward||strafe){const length=Math.hypot(forward,strafe)||1;input.forward=forward/length;input.strafe=strafe/length}
  else if(!joystickActive){input.forward=0;input.strafe=0}
}

function updatePlayer(dt){
  const moving=Math.abs(input.forward)+Math.abs(input.strafe)>.001;
  if(moving){
    const forwardX=-Math.sin(camera.yaw),forwardZ=-Math.cos(camera.yaw),rightX=Math.cos(camera.yaw),rightZ=-Math.sin(camera.yaw);
    let dx=forwardX*input.forward+rightX*input.strafe,dz=forwardZ*input.forward+rightZ*input.strafe;
    const length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
    const speed=7.2;
    const nextX=clamp(player.x+dx*speed*dt,terrain.origin[0]+.5,terrain.origin[0]+terrain.width-.5);
    const nextZ=clamp(player.z+dz*speed*dt,terrain.origin[2]+.5,terrain.origin[2]+terrain.depth-.5);
    const footY=player.y-.9;
    const support=terrain.supportAtPoint(nextX,nextZ,footY,{maxRise:.9,maxDrop:3.2});
    player.x=nextX;player.z=nextZ;player.yaw=Math.atan2(dx,dz);
    if(support!=null){player.y=support+.9;player.vy=0;player.grounded=true}else player.grounded=false;
  }
  if(!player.grounded){
    player.vy-=18*dt;player.y+=player.vy*dt;
    const support=terrain.supportAtPoint(player.x,player.z,player.y-.9,{maxRise:.35,maxDrop:1.5});
    if(support!=null&&player.y-.9<=support+.25){player.y=support+.9;player.vy=0;player.grounded=true}
  }
  if(player.y<-80){
    const spawn=worldDocument?.anchors?.starter_spawn||{x:160,z:160};
    player.x=spawn.x;player.z=spawn.z;player.y=(terrain.sampleHeight(player.x,player.z)??0)+.9;player.vy=0;player.grounded=true;
  }
  if(playerMesh){playerMesh.position[0]=player.x;playerMesh.position[1]=player.y;playerMesh.position[2]=player.z;playerMesh.yaw=player.yaw}
}

function updateCamera(){
  const targetY=player.y+.7;
  const horizontal=Math.cos(camera.pitch)*camera.distance;
  const position=[player.x+Math.sin(camera.yaw)*horizontal,targetY+Math.sin(camera.pitch)*camera.distance,player.z+Math.cos(camera.yaw)*horizontal];
  const target=[player.x,targetY,player.z];
  lastCameraPosition=position;lastCameraTarget=target;
  engine.setCamera({position,target,fov:camera.fov,near:.08,far:650});
}

function setEditMode(enabled){
  editMode=Boolean(enabled)&&Boolean(terrain);
  worldScreen.classList.toggle('editing',editMode);
  editButton.textContent=editMode?'Edit ON':'Edit OFF';
  editButton.classList.toggle('active',editMode);
  brushReadout.hidden=!editMode;
  if(!editMode){brushHit=null;brushStrokeActive=false;brushPointerId=null;if(brushMesh)brushMesh.visible=false}
  refreshEditorLabels();
}

function setupCanvasControls(){
  let lookPointerId=null,lastX=0,lastY=0;
  canvas.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    if(editMode){
      event.preventDefault();
      brushPointerId=event.pointerId;brushStrokeActive=true;canvas.setPointerCapture(event.pointerId);
      beginTerrainStroke();
      updateBrushFromPointer(event,true);
      return;
    }
    lookPointerId=event.pointerId;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(lookPointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(editMode){
      if(event.pointerId!==brushPointerId&&!brushStrokeActive)return;
      updateBrushFromPointer(event,brushStrokeActive);
      return;
    }
    if(event.pointerId!==lookPointerId)return;
    const dx=event.clientX-lastX,dy=event.clientY-lastY;lastX=event.clientX;lastY=event.clientY;
    camera.yaw-=dx*.005;camera.pitch=clamp(camera.pitch+dy*.004,-.12,1.05);
  });
  const end=event=>{
    if(editMode&&event.pointerId===brushPointerId){brushPointerId=null;brushStrokeActive=false;saveDraftSilently();return}
    if(event.pointerId===lookPointerId)lookPointerId=null;
  };
  canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('wheel',event=>{event.preventDefault();camera.distance=clamp(camera.distance+event.deltaY*.01,3.5,28)},{passive:false});
}

function updateBrushFromPointer(event,apply){
  if(!terrain||!engine)return;
  const hit=raycastTerrain(event.clientX,event.clientY);
  if(!hit)return;
  brushHit=hit;
  updateBrushMarkerPosition();
  if(apply&&performance.now()-lastBrushApply>45){lastBrushApply=performance.now();applyCurrentBrush()}
}

function raycastTerrain(clientX,clientY){
  const rect=canvas.getBoundingClientRect();
  const nx=((clientX-rect.left)/Math.max(1,rect.width))*2-1;
  const ny=1-((clientY-rect.top)/Math.max(1,rect.height))*2;
  const forward=normalize3(lastCameraTarget[0]-lastCameraPosition[0],lastCameraTarget[1]-lastCameraPosition[1],lastCameraTarget[2]-lastCameraPosition[2]);
  const right=normalize3(...cross3(forward,[0,1,0]));
  const up=normalize3(...cross3(right,forward));
  const tangent=Math.tan(camera.fov/2),aspect=rect.width/Math.max(1,rect.height);
  const direction=normalize3(
    forward[0]+right[0]*nx*tangent*aspect+up[0]*ny*tangent,
    forward[1]+right[1]*nx*tangent*aspect+up[1]*ny*tangent,
    forward[2]+right[2]*nx*tangent*aspect+up[2]*ny*tangent
  );
  let previous=null;
  for(let t=.25;t<=700;t+=.75){
    const x=lastCameraPosition[0]+direction[0]*t;
    const y=lastCameraPosition[1]+direction[1]*t;
    const z=lastCameraPosition[2]+direction[2]*t;
    const height=terrain.sampleHeight(x,z);
    if(height==null){previous=null;continue}
    const diff=y-height;
    if(previous&&previous.diff>0&&diff<=0){
      let low=previous.t,high=t;
      for(let i=0;i<8;i+=1){
        const mid=(low+high)/2;
        const mx=lastCameraPosition[0]+direction[0]*mid,mz=lastCameraPosition[2]+direction[2]*mid;
        const mh=terrain.sampleHeight(mx,mz);
        const my=lastCameraPosition[1]+direction[1]*mid;
        if(mh==null||my-mh>0)low=mid;else high=mid;
      }
      const finalT=(low+high)/2;
      const fx=lastCameraPosition[0]+direction[0]*finalT,fz=lastCameraPosition[2]+direction[2]*finalT;
      return {x:fx,y:terrain.sampleHeight(fx,fz)??0,z:fz};
    }
    previous={t,diff};
  }
  return null;
}

function beginTerrainStroke(){
  if(!terrain)return;
  pushUndo(captureTerrainState());
  redoStack.length=0;
}

function applyCurrentBrush(){
  if(!terrain||!brushHit)return;
  const brush={mode:brushMode,x:brushHit.x,z:brushHit.z,radius:Number(radiusInput.value),strength:Number(strengthInput.value)};
  if(brushMode==='flatten')brush.targetHeight=brushHit.y;
  terrain.applyBrush(brush);
  brushHit.y=terrain.sampleHeight(brushHit.x,brushHit.z)??brushHit.y;
  rebuildTerrainArea(brushHit.x,brushHit.z,Number(radiusInput.value)+terrain.sampleSpacing*2);
  updateBrushMarkerPosition();
  if(Math.hypot(player.x-brushHit.x,player.z-brushHit.z)<Number(radiusInput.value)+2)snapPlayerToSupport();
  terrainStatus.textContent=`Blank terrain · edit revision ${terrain.revision}`;
}

function captureTerrainState(){
  return {heights:new Float32Array(terrain.heights),manualDelta:new Float32Array(terrain.manualDelta),manualHoles:new Uint8Array(terrain.manualHoles),revision:terrain.revision};
}

function restoreTerrainState(state){
  if(!terrain||!state)return;
  terrain.heights.set(state.heights);terrain.manualDelta.set(state.manualDelta);terrain.manualHoles.set(state.manualHoles);terrain.revision=state.revision+1;
  rebuildTerrainMeshes();snapPlayerToSupport();
}

function pushUndo(state){undoStack.push(state);if(undoStack.length>MAX_HISTORY)undoStack.shift()}
function undoTerrain(){if(!terrain||!undoStack.length)return;redoStack.push(captureTerrainState());restoreTerrainState(undoStack.pop());saveDraftSilently();editorStatus.textContent='Undo'}
function redoTerrain(){if(!terrain||!redoStack.length)return;pushUndo(captureTerrainState());restoreTerrainState(redoStack.pop());saveDraftSilently();editorStatus.textContent='Redo'}

function serializeTerrainEdits(){
  const delta=[];for(let i=0;i<terrain.manualDelta.length;i+=1){const value=terrain.manualDelta[i];if(Math.abs(value)>.0001)delta.push([i,Number(value.toFixed(4))])}
  const holes=[];for(let i=0;i<terrain.manualHoles.length;i+=1)if(terrain.manualHoles[i])holes.push(i);
  return {format:'rift-terrain-edit-v1',worldId:worldDocument?.id||'ironvale-terrain',savedAt:Date.now(),delta,holes};
}

function applySerializedEdits(data){
  if(!terrain||!data||data.format!=='rift-terrain-edit-v1')return false;
  terrain=new RiftTerrain(worldDocument.terrain);
  for(const entry of data.delta||[]){const index=Number(entry[0]),value=Number(entry[1]);if(Number.isInteger(index)&&index>=0&&index<terrain.manualDelta.length&&Number.isFinite(value)){terrain.manualDelta[index]=value;terrain.heights[index]+=value}}
  for(const indexValue of data.holes||[]){const index=Number(indexValue);if(Number.isInteger(index)&&index>=0&&index<terrain.manualHoles.length)terrain.manualHoles[index]=1}
  terrain.revision+=1;return true;
}

function saveDraft(){saveDraftSilently();editorStatus.textContent='Terrain draft saved on this device.'}
function saveDraftSilently(){if(!terrain)return;try{localStorage.setItem(LOCAL_DRAFT_KEY,JSON.stringify(serializeTerrainEdits()))}catch{}}
function restoreLocalDraft(){try{const raw=localStorage.getItem(LOCAL_DRAFT_KEY);if(raw)applySerializedEdits(JSON.parse(raw))}catch{}}

async function exportDraft(){
  if(!terrain)return;
  const text=JSON.stringify(serializeTerrainEdits(),null,2);
  try{
    const file=new File([text],'ironvale-terrain-edits.json',{type:'application/json'});
    if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Ironvale Terrain Edits'});editorStatus.textContent='Terrain draft shared.';return}
  }catch{}
  const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='ironvale-terrain-edits.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  editorStatus.textContent='Terrain draft exported.';
}

function resetTerrain(){
  if(!worldDocument||!terrain)return;
  pushUndo(captureTerrainState());redoStack.length=0;
  terrain=new RiftTerrain(worldDocument.terrain);
  try{localStorage.removeItem(LOCAL_DRAFT_KEY)}catch{}
  rebuildTerrainMeshes();snapPlayerToSupport();
  terrainStatus.textContent='Blank terrain reset';editorStatus.textContent='Back to a perfectly flat blank canvas.';
}

function refreshEditorLabels(){
  const radius=Number(radiusInput.value),strength=Number(strengthInput.value);
  radiusValue.textContent=`${radius}m`;strengthValue.textContent=strength.toFixed(1);
  brushReadout.textContent=`${brushModeLabel(brushMode)} · ${radius}m`;
  if(editMode)editorStatus.textContent='Tap or drag directly on the terrain. Turn Edit OFF to move/look normally.';
}

function brushModeLabel(mode){return({raise:'Raise',lower:'Lower',smooth:'Smooth',flatten:'Flatten',hole:'Cut Hole',unhole:'Fill Hole'})[mode]||mode}

function rebuildBrushMarker(){
  if(!engine)return;
  if(brushMesh)engine.removeMesh(brushMesh);
  brushMesh=engine.addMesh(createRingGeometry(Number(radiusInput.value)),{position:[0,-999,0]});
  brushMesh.visible=editMode&&Boolean(brushHit);
  updateBrushMarkerPosition();
}

function updateBrushMarkerPosition(){
  if(!brushMesh)return;
  brushMesh.visible=editMode&&Boolean(brushHit);
  if(brushHit)brushMesh.position=[brushHit.x,brushHit.y+.035,brushHit.z];
}

async function savePosition(useKeepalive=false){
  if(!engine)return;
  try{await fetch('/api/character/position',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:player.x,y:player.y,z:player.z,yaw:player.yaw}),keepalive:useKeepalive})}catch{}
}

async function api(path,options={}){
  const request={method:options.method||'GET',headers:{}};
  if(options.body!==undefined){request.headers['Content-Type']='application/json';request.body=JSON.stringify(options.body)}
  const response=await fetch(path,request);let data={};try{data=await response.json()}catch{}
  if(!response.ok&&!data.error)data.error=`Request failed (${response.status})`;return data;
}

function setAuthStatus(message,error=false){authStatus.textContent=message;authStatus.classList.toggle('error',error)}

let joystickActive=false;
function setupJoystick(){
  const stick=document.querySelector('#joystick'),knob=document.querySelector('#joystick-knob');
  let pointerId=null;const max=34;
  const update=event=>{const rect=stick.getBoundingClientRect();let dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2);const length=Math.hypot(dx,dy);if(length>max){dx*=max/length;dy*=max/length}knob.style.transform=`translate(${dx}px,${dy}px)`;input.strafe=dx/max;input.forward=-dy/max};
  stick.addEventListener('pointerdown',event=>{if(editMode)return;event.stopPropagation();pointerId=event.pointerId;joystickActive=true;stick.setPointerCapture(pointerId);update(event)});
  stick.addEventListener('pointermove',event=>{if(event.pointerId===pointerId)update(event)});
  const end=event=>{if(event.pointerId!==pointerId)return;pointerId=null;joystickActive=false;input.forward=0;input.strafe=0;knob.style.transform='translate(0,0)'};
  stick.addEventListener('pointerup',end);stick.addEventListener('pointercancel',end);
}

function createRingGeometry(radius){
  const segments=48,width=Math.max(.08,radius*.025),vertices=[],indices=[];
  for(let i=0;i<segments;i+=1){
    const angle=i/segments*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
    for(const r of [Math.max(.05,radius-width),radius+width])vertices.push(c*r,0,s*r,0,1,0,.95,.72,.18);
  }
  for(let i=0;i<segments;i+=1){const n=(i+1)%segments,a=i*2,b=a+1,c=n*2,d=c+1;indices.push(a,c,b,b,c,d)}
  return{vertices:new Float32Array(vertices),indices:new Uint16Array(indices),vertexStride:9};
}

function createCapsuleGeometry(){
  const radial=12,rings=[],radius=.36,half=.48;
  for(let i=0;i<=4;i+=1){const angle=-Math.PI/2+(Math.PI/2)*(i/4);rings.push({y:-half+Math.sin(angle)*radius,r:Math.cos(angle)*radius,ny:Math.sin(angle),nr:Math.cos(angle)})}
  for(let i=1;i<=4;i+=1){const angle=(Math.PI/2)*(i/4);rings.push({y:half+Math.sin(angle)*radius,r:Math.cos(angle)*radius,ny:Math.sin(angle),nr:Math.cos(angle)})}
  const vertices=[],indices=[];
  for(const ring of rings)for(let side=0;side<radial;side+=1){const angle=side/radial*Math.PI*2,x=Math.cos(angle)*ring.r,z=Math.sin(angle)*ring.r,nx=Math.cos(angle)*ring.nr,nz=Math.sin(angle)*ring.nr;vertices.push(x,ring.y,z,nx,ring.ny,nz,.30,.43,.34)}
  for(let ring=0;ring<rings.length-1;ring+=1)for(let side=0;side<radial;side+=1){const next=(side+1)%radial,a=ring*radial+side,b=ring*radial+next,c=(ring+1)*radial+side,d=(ring+1)*radial+next;indices.push(a,c,b,b,c,d)}
  return{vertices:new Float32Array(vertices),indices:new Uint16Array(indices),vertexStride:9};
}

function normalize3(x,y,z){const length=Math.hypot(x,y,z)||1;return[x/length,y/length,z/length]}
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function finiteOr(value,fallback){const number=Number(value);return Number.isFinite(number)?number:fallback}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
