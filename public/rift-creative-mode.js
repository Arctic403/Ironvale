import { ensureRiftSharedPalette } from './rift-material-library.js';
import { createRiftNativeGridAccelerator } from './rift-wasm-core.js';
const ROTATIONS=['north','east','south','west'];
const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=v=>{const l=Math.hypot(...v)||1;return v.map(n=>n/l);};

export function riftReticleClientPoint(canvas, viewport = globalThis.visualViewport || null){
  const rect=canvas?.getBoundingClientRect?.();
  if(!rect)return [0,0];
  // The HUD reticle is fixed to the visible screen center. Use that same client
  // point for picking so third-person camera motion can never drag the pointer
  // around the world. If the screen center is outside a windowed canvas, fall
  // back to the canvas center.
  const vw=Number(viewport?.width),vh=Number(viewport?.height);
  const vx=Number(viewport?.offsetLeft)||0,vy=Number(viewport?.offsetTop)||0;
  if(Number.isFinite(vw)&&vw>0&&Number.isFinite(vh)&&vh>0){
    const x=vx+vw*.5,y=vy+vh*.5;
    if(x>=rect.left&&x<=rect.left+rect.width&&y>=rect.top&&y<=rect.top+rect.height)return [x,y];
  }
  return [rect.left+rect.width*.5,rect.top+rect.height*.5];
}

function objectPoint(object){ if(Array.isArray(object.origin))return object.origin;if(Array.isArray(object.center))return object.center;if(Array.isArray(object.from)&&Array.isArray(object.to))return object.from.map((v,i)=>(v+object.to[i])/2);return [0,0,0]; }
function shiftVec(vec,dx,dy,dz){if(!Array.isArray(vec))return;vec[0]+=dx;vec[1]+=dy;vec[2]+=dz;}
function esc(value=''){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}

export function createRiftCreativeMode({root,canvas,engine,camera,getImported,loadDocument,playerController,player,preparePlayerView}){
  const toggle=root.querySelector('#rift-creative-toggle'),panel=root.querySelector('#rift-creative-panel'),select=root.querySelector('#rift-creative-object'),status=root.querySelector('#rift-creative-status'),modeLabel=root.querySelector('#rift-mode-label');
  const stateSelect=root.querySelector('#rift-creative-block-state'),actionButtons=[...root.querySelectorAll('[data-rift-block-action]')];
  const aiDraftSelect=root.querySelector('#rift-ai-draft-select'),aiDraftStatus=root.querySelector('#rift-ai-draft-status'),aiDraftMeta=root.querySelector('#rift-ai-draft-meta');
  let active=false,draft=null,selectedId='',undo=[],redo=[],action='break',selectedState='',stairRotation='north',pointerDown=null;
  let aiDraftRows=[];
  const markerEdges=[];
  const edgeColorBreak='#ff6f66',edgeColorPlace='#65e39a';
  for(let i=0;i<12;i+=1)markerEdges.push(engine.addBox({color:edgeColorBreak,dynamic:true,scale:[.02,.02,.02],visible:false,blockFaceShade:1}));

  const currentLayout=()=>Array.isArray(draft?.layout)?draft.layout:[];
  const selectedObject=()=>currentLayout().find(item=>String(item.id||'')===selectedId)||null;
  const setStatus=text=>{if(status)status.textContent=text;};
  const setAiDraftStatus=text=>{if(aiDraftStatus)aiDraftStatus.textContent=text;};
  async function apiJson(path,options={}){
    try{
      const response=await fetch(path,{credentials:'same-origin',...options});
      const data=await response.json().catch(()=>({}));
      return {...data,ok:response.ok&&data.ok!==false,status:response.status};
    }catch(error){return {ok:false,status:0,error:error?.message||'Could not reach RiftCity server'};}
  }

  function renderAiDraftRows(){
    if(!aiDraftSelect)return;
    if(!aiDraftRows.length){aiDraftSelect.innerHTML='<option value="">NO AI DRAFTS</option>';if(aiDraftMeta)aiDraftMeta.textContent='No D1 AI drafts are currently available.';return;}
    aiDraftSelect.innerHTML=aiDraftRows.map(row=>{
      const state=row.loaded_at?'LOADED':'NEW',stamp=row.created_at?new Date(Number(row.created_at)).toLocaleString():'unknown time';
      return `<option value="${esc(row.id)}">${esc(state)} · ${esc(row.name||row.document_id||row.id)} · ${esc(stamp)}</option>`;
    }).join('');
    syncAiDraftMeta();
  }
  function syncAiDraftMeta(){
    if(!aiDraftMeta||!aiDraftSelect)return;
    const row=aiDraftRows.find(item=>item.id===aiDraftSelect.value);
    aiDraftMeta.textContent=row?`${row.document_id} · ${row.sha256?.slice?.(0,12)||'no hash'}… · ${row.loaded_at?'previously loaded':'not loaded yet'}`:'Choose a draft.';
  }
  async function refreshAiDrafts(){
    if(!aiDraftSelect)return false;
    setAiDraftStatus('Checking D1 AI draft inbox…');
    const result=await apiJson('/api/admin/ai-builder/drafts?limit=60');
    if(!result.ok){
      aiDraftRows=[];renderAiDraftRows();
      setAiDraftStatus(result.status===401||result.status===403?'DEV ONLY · sign in with a developer/admin account to load AI drafts.':`AI draft inbox unavailable: ${result.error||'server error'}`);
      return false;
    }
    aiDraftRows=Array.isArray(result.drafts)?result.drafts:[];
    renderAiDraftRows();
    setAiDraftStatus(`D1 AI DRAFT INBOX · ${aiDraftRows.length} draft${aiDraftRows.length===1?'':'s'} · loading stays in Build Mode staging.`);
    return true;
  }
  async function loadSelectedAiDraft(){
    const id=String(aiDraftSelect?.value||'');
    if(!id){setAiDraftStatus('Choose an AI draft first.');return false;}
    setAiDraftStatus('Loading AI draft from D1…');
    const result=await apiJson(`/api/admin/ai-builder/drafts/${encodeURIComponent(id)}`);
    if(!result.ok||!result.draft?.document){setAiDraftStatus(`AI draft load failed: ${result.error||'invalid draft'}`);return false;}
    const before=draft?JSON.stringify(draft):null;
    try{
      if(before){undo.push(before);if(undo.length>60)undo.shift();redo.length=0;}
      loadDocument(result.draft.document,`D1 AI DRAFT · ${result.draft.name||result.draft.documentId||id}`,{
        persist:true,
        fileName:`${result.draft.documentId||'riftcity'}-ai-draft.json`,
        preserveCamera:true,
        preservePlayer:true
      });
      draft=ensureRiftSharedPalette(clone(getImported().document));selectedId='';refreshPalette();refreshSelect();
      await apiJson(`/api/admin/ai-builder/drafts/${encodeURIComponent(id)}/loaded`,{method:'POST'});
      await refreshAiDrafts();
      setStatus(`Loaded D1 AI draft ${result.draft.name||result.draft.documentId||id}. Review/edit it here before any export or future publish step.`);
      setAiDraftStatus(`LOADED INTO BUILD MODE STAGING · ${result.draft.name||result.draft.documentId||id}`);
      return true;
    }catch(error){
      if(before&&undo[undo.length-1]===before)undo.pop();
      setAiDraftStatus(`AI draft rejected by the Rift Engine: ${error?.message||error}`);
      return false;
    }
  }

  function refreshPalette(){
    if(!stateSelect||!draft?.palette)return;
    const previous=selectedState;
    const entries=Object.entries(draft.palette).filter(([,entry])=>Number(entry?.material_id)!==0&&String(entry?.shape||'full').toLowerCase()!=='air');
    stateSelect.innerHTML=entries.map(([name,entry])=>{const label=entry.display_name||entry.displayName||name,kind=entry.kind&&entry.kind!=='solid'?entry.kind:(entry.shape||'full');return `<option value="${esc(name)}">${esc(label)} · ${esc(kind)}${entry.rotation?` · ${esc(entry.rotation)}`:''}</option>`;}).join('');
    selectedState=entries.some(([name])=>name===previous)?previous:(entries[0]?.[0]||'');
    stateSelect.value=selectedState;
    const selected=draft.palette[selectedState]; if(selected?.shape==='stair')stairRotation=String(selected.rotation||'north').toLowerCase();
  }

  function refreshSelect(){
    if(!select)return;
    const previous=selectedId;
    select.innerHTML=currentLayout().map((item,index)=>{const id=String(item.id||`layout-${index}`);return `<option value="${esc(id)}">${esc(id)} · ${esc(item.type||'object')}</option>`;}).join('');
    selectedId=currentLayout().some(item=>String(item.id||'')===previous)?previous:String(currentLayout()[0]?.id||'');
    select.value=selectedId;updateReadout();
  }
  function updateReadout(){
    const object=selectedObject(),point=objectPoint(object||{});
    const a=root.querySelector('#rift-creative-selected'),b=root.querySelector('#rift-creative-pos'),c=root.querySelector('#rift-creative-rot');
    if(a)a.textContent=object?String(object.id||'UNNAMED'):'NONE';if(b)b.textContent=object?point.map(v=>Number(v).toFixed(0)).join(', '):'--';if(c)c.textContent=object?.rotation||'--';
  }
  function captureHistory(){undo.push(JSON.stringify(draft));if(undo.length>60)undo.shift();redo.length=0;}
  function applyDraft(message='World recompiled.'){
    try{const selected=selectedId;loadDocument(draft,'BUILD DRAFT',{persistenceLabel:'LIVE EDIT',preserveCamera:true,preservePlayer:true});selectedId=selected;refreshSelect();refreshPalette();setStatus(message);return true;}
    catch(error){setStatus(`BLOCKED: ${error?.message||error}`);return false;}
  }

  function worldToLocal(cell){const origin=draft?.origin||[0,0,0];return [cell[0]-origin[0],cell[1]-origin[1],cell[2]-origin[2]];}
  function insideLocal(point){const b=draft?.bounds;return !!b&&point.every((v,i)=>v>=b.min[i]&&v<=b.max[i]);}
  function getGrid(){return getImported?.()?.grid||null;}

  const nativeGrid=createRiftNativeGridAccelerator(()=>getGrid());
  const FACE_NORMALS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

  function screenRay(clientX,clientY){
    const rect=canvas.getBoundingClientRect();
    const nx=((clientX-rect.left)/Math.max(1,rect.width))*2-1, ny=1-((clientY-rect.top)/Math.max(1,rect.height))*2;
    const forward=norm([camera.target[0]-camera.position[0],camera.target[1]-camera.position[1],camera.target[2]-camera.position[2]]);
    const flatLen=Math.hypot(forward[0],forward[2])||1,right=[-forward[2]/flatLen,0,forward[0]/flatLen];
    const up=norm([right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]]);
    const aspect=rect.width/Math.max(1,rect.height);
    if(camera.projection==='orthographic'){
      const halfHeight=Math.max(.01,Number(camera.orthoSize||24)*.5),halfWidth=halfHeight*aspect;
      return {
        origin:[camera.position[0]+right[0]*nx*halfWidth+up[0]*ny*halfHeight,camera.position[1]+right[1]*nx*halfWidth+up[1]*ny*halfHeight,camera.position[2]+right[2]*nx*halfWidth+up[2]*ny*halfHeight],
        direction:forward
      };
    }
    const t=Math.tan(camera.fov*.5);
    return {origin:[...camera.position],direction:norm([forward[0]+right[0]*nx*t*aspect+up[0]*ny*t,forward[1]+right[1]*nx*t*aspect+up[1]*ny*t,forward[2]+right[2]*nx*t*aspect+up[2]*ny*t])};
  }

  function raycastFallback(ray,maxDistance=120){
    const grid=getGrid();if(!grid)return null;let previous=null,lastKey='';
    for(let d=.05;d<=maxDistance;d+=.06){
      const p=[ray.origin[0]+ray.direction[0]*d,ray.origin[1]+ray.direction[1]*d,ray.origin[2]+ray.direction[2]*d],cell=p.map(Math.floor),key=cell.join(',');
      if(key===lastKey)continue;lastKey=key;
      const state=grid.getBlockWorld(cell[0],cell[1],cell[2])||0;
      const special=getImported?.()?.specialCells?.get?.(`${cell[0]}|${cell[1]}|${cell[2]}`)||null;
      if(state||special)return {hit:cell,place:previous,state,distance:d,special};
      previous=cell;
    }
    return null;
  }

  function raycast(clientX,clientY,maxDistance=120){
    const grid=getGrid();if(!grid)return null;const ray=screenRay(clientX,clientY);
    // Details/fluids live outside the solid RiftSection state array, so keep the
    // exact legacy picker whenever special cells exist. Ordinary block editing
    // uses the native voxel DDA and skips thousands of 0.06 m JS ray steps.
    if((getImported?.()?.specialCells?.size||0)>0)return raycastFallback(ray,maxDistance);
    const nativeHit=nativeGrid.raycast(ray.origin,ray.direction,maxDistance);
    if(!nativeHit.native)return raycastFallback(ray,maxDistance);
    if(!nativeHit.hit)return null;
    const normal=FACE_NORMALS[nativeHit.face]||[0,0,0];
    return {
      hit:nativeHit.hit,
      place:nativeHit.face<0?null:nativeHit.hit.map((value,index)=>value+normal[index]),
      state:nativeHit.state,
      distance:nativeHit.distance,
      special:null,
      native:true
    };
  }

  function resolvePlaceState(){
    if(!selectedState||!draft?.palette?.[selectedState])return selectedState;
    const entry=draft.palette[selectedState];if(String(entry.shape||'full').toLowerCase()!=='stair')return selectedState;
    const target=ROTATIONS.includes(stairRotation)?stairRotation:'north';
    for(const [name,candidate] of Object.entries(draft.palette))if(Number(candidate?.material_id)===Number(entry.material_id)&&String(candidate?.shape||'').toLowerCase()==='stair'&&String(candidate?.rotation||'north').toLowerCase()===target)return name;
    const base=`${selectedState.replace(/_[nesw]$/i,'')}_${target[0]}`;let name=base,suffix=2;while(draft.palette[name])name=`${base}_${suffix++}`;
    draft.palette[name]={...clone(entry),rotation:target};return name;
  }

  function editBlockAtReticle(){
    if(!active)return;const [clientX,clientY]=riftReticleClientPoint(canvas),hit=raycast(clientX,clientY);if(!hit){setStatus('No RiftBlock under the reticle. Look at a visible block and try again.');return;}
    const target=action==='place'?hit.place:hit.hit;if(!target){setStatus('No free adjacent cell for placement.');return;}
    const local=worldToLocal(target);if(!insideLocal(local)){setStatus(`BLOCKED: ${target.join(',')} is outside this JSON block bounds.`);return;}
    captureHistory();draft.ops=Array.isArray(draft.ops)?draft.ops:[];
    if(action==='break')draft.ops.push({op:'cut_box',min:[...local],max:[...local],name:'Creative break'});
    else {const state=resolvePlaceState();if(!state){undo.pop();setStatus('Choose a block type first.');return;}draft.ops.push({op:'set',state,at:[...local],name:'Creative placement'});}
    if(!applyDraft(`${action==='break'?'Broke':'Placed'} block at ${target.join(', ')}.`))undoAction();
  }

  function setMarkerCell(cell,color){
    if(!cell){for(const d of markerEdges)d.visible=false;return;}
    const [x,y,z]=cell.map(v=>v+.5),h=.505,t=.025;
    const defs=[
      [[x,y-h,z-h],[1.05,t,t]],[[x,y-h,z+h],[1.05,t,t]],[[x,y+h,z-h],[1.05,t,t]],[[x,y+h,z+h],[1.05,t,t]],
      [[x-h,y,z-h],[t,1.05,t]],[[x-h,y,z+h],[t,1.05,t]],[[x+h,y,z-h],[t,1.05,t]],[[x+h,y,z+h],[t,1.05,t]],
      [[x-h,y-h,z],[t,t,1.05]],[[x-h,y+h,z],[t,t,1.05]],[[x+h,y-h,z],[t,t,1.05]],[[x+h,y+h,z],[t,t,1.05]]
    ];
    defs.forEach((def,i)=>{const d=markerEdges[i];d.visible=true;d.color=color==='place'?[.40,.90,.60]:[1,.42,.38];engine.setTransform(d,def[0],0,def[1]);});
  }

  function updateTarget(){
    if(!active){setMarkerCell(null);return;}
    const [clientX,clientY]=riftReticleClientPoint(canvas),hit=raycast(clientX,clientY);
    setMarkerCell(hit?(action==='place'?hit.place:hit.hit):null,action);
  }

  function setAction(next){action=next==='place'?'place':'break';for(const button of actionButtons)button.classList.toggle('active',button.dataset.riftBlockAction===action);setStatus(action==='break'?'BREAK CELL: aim the reticle at a RiftBlock, then tap/click the canvas.':'PLACE CELL: aim the reticle at a block face, then tap/click to place the selected block beside it.');updateTarget();}
  actionButtons.forEach(button=>button.addEventListener('click',()=>setAction(button.dataset.riftBlockAction)));
  stateSelect?.addEventListener('change',()=>{selectedState=stateSelect.value;const entry=draft?.palette?.[selectedState];if(entry?.shape==='stair')stairRotation=String(entry.rotation||'north');});
  root.querySelector('#rift-creative-stair-rotate')?.addEventListener('click',()=>{stairRotation=ROTATIONS[(Math.max(0,ROTATIONS.indexOf(stairRotation))+1)%4];setStatus(`Stair placement faces ${stairRotation.toUpperCase()}.`);});

  function transform(dx,dy,dz){const object=selectedObject();if(!object)return;captureHistory();if(Array.isArray(object.origin))shiftVec(object.origin,dx,dy,dz);else if(Array.isArray(object.center))shiftVec(object.center,dx,dy,dz);else{shiftVec(object.from,dx,dy,dz);shiftVec(object.to,dx,dy,dz);}if(!applyDraft(`Moved ${selectedId} by ${dx}, ${dy}, ${dz}.`))undoAction();}
  function rotateSelected(direction=1){const object=selectedObject();if(!object||!['instance','prefab'].includes(String(object.type||'').toLowerCase())){setStatus('Blueprint rotation applies to prefab instances.');return;}captureHistory();const index=Math.max(0,ROTATIONS.indexOf(String(object.rotation||'north').toLowerCase()));object.rotation=ROTATIONS[(index+direction+4)%4];if(!applyDraft(`Rotated ${selectedId} ${object.rotation}.`))undoAction();}
  function duplicateSelected(){const object=selectedObject();if(!object)return;captureHistory();const copy=clone(object),base=String(object.id||'object');let suffix=2;while(currentLayout().some(item=>String(item.id||'')===`${base}-${suffix}`))suffix+=1;copy.id=`${base}-${suffix}`;if(Array.isArray(copy.origin))shiftVec(copy.origin,2,0,2);else if(Array.isArray(copy.center))shiftVec(copy.center,2,0,2);else{shiftVec(copy.from,2,0,2);shiftVec(copy.to,2,0,2);}draft.layout.push(copy);selectedId=copy.id;if(!applyDraft(`Duplicated ${base} → ${copy.id}.`))undoAction();}
  function deleteSelected(){if(!selectedId)return;const index=currentLayout().findIndex(item=>String(item.id||'')===selectedId);if(index<0)return;captureHistory();const [removed]=draft.layout.splice(index,1);selectedId=String(draft.layout[Math.min(index,draft.layout.length-1)]?.id||'');if(!applyDraft(`Deleted ${removed.id}.`))undoAction();}
  function undoAction(){if(!undo.length)return;redo.push(JSON.stringify(draft));draft=JSON.parse(undo.pop());applyDraft('Undo.');}
  function redoAction(){if(!redo.length)return;undo.push(JSON.stringify(draft));draft=JSON.parse(redo.pop());applyDraft('Redo.');}
  function exportDraft(){if(!draft)return;const blob=new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`${draft.id||'riftcity-world'}-creative.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1200);}

  aiDraftSelect?.addEventListener('change',syncAiDraftMeta);
  root.querySelector('#rift-ai-draft-refresh')?.addEventListener('click',refreshAiDrafts);
  root.querySelector('#rift-ai-draft-load')?.addEventListener('click',loadSelectedAiDraft);

  select?.addEventListener('change',()=>{selectedId=select.value;updateReadout();});
  root.querySelectorAll('[data-rift-nudge]').forEach(button=>button.addEventListener('click',()=>{const [x,y,z]=button.dataset.riftNudge.split(',').map(Number);transform(x,y,z);}));
  root.querySelector('#rift-creative-rotate-left')?.addEventListener('click',()=>rotateSelected(-1));root.querySelector('#rift-creative-rotate-right')?.addEventListener('click',()=>rotateSelected(1));root.querySelector('#rift-creative-duplicate')?.addEventListener('click',duplicateSelected);root.querySelector('#rift-creative-delete')?.addEventListener('click',deleteSelected);root.querySelector('#rift-creative-undo')?.addEventListener('click',undoAction);root.querySelector('#rift-creative-redo')?.addEventListener('click',redoAction);root.querySelector('#rift-creative-export')?.addEventListener('click',exportDraft);root.querySelector('#rift-creative-close')?.addEventListener('click',()=>panel?.classList.remove('open'));root.querySelector('#rift-creative-open-panel')?.addEventListener('click',()=>panel?.classList.toggle('open'));

  function enter(){const imported=getImported?.();if(!imported)return;preparePlayerView?.();active=true;draft=ensureRiftSharedPalette(clone(imported.document));undo=[];redo=[];playerController.setCreativeMode(true);root.classList.add('rift-creative-active');panel?.classList.add('open');toggle?.classList.add('active');if(toggle)toggle.textContent='PLAY MODE';if(modeLabel)modeLabel.textContent='BUILD';refreshPalette();refreshSelect();setAction('break');setStatus('Build Mode ON. Look through the center reticle, drag to aim, then tap/click the canvas to use the selected BREAK or PLACE tool.');refreshAiDrafts();}
  function exit(){if(!active){panel?.classList.remove('open');return;}active=false;playerController.setCreativeMode(false);root.classList.remove('rift-creative-active');panel?.classList.remove('open');toggle?.classList.remove('active');if(toggle)toggle.textContent='BUILD MODE';if(modeLabel)modeLabel.textContent='PLAY';setMarkerCell(null);}
  function toggleMode(){active?exit():enter();}toggle?.addEventListener('click',toggleMode);

  function onCanvasPointerDown(event){if(!active||event.button>0)return;pointerDown={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now()};updateTarget();}
  function onCanvasPointerMove(){if(!active)return;updateTarget();}
  function onCanvasPointerUp(event){if(!active||!pointerDown||pointerDown.id!==event.pointerId)return;const moved=Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y),elapsed=performance.now()-pointerDown.time;pointerDown=null;if(moved<10&&elapsed<700){editBlockAtReticle();event.preventDefault();}updateTarget();}
  canvas.addEventListener('pointerdown',onCanvasPointerDown,{passive:false});canvas.addEventListener('pointermove',onCanvasPointerMove,{passive:true});canvas.addEventListener('pointerup',onCanvasPointerUp,{passive:false});canvas.addEventListener('pointercancel',()=>{pointerDown=null;});

  function onKeyDown(event){if(!active)return;if(event.code==='Escape'){exit();event.preventDefault();return;}if((event.metaKey||event.ctrlKey)&&event.code==='KeyZ'){event.shiftKey?redoAction():undoAction();event.preventDefault();return;}if((event.metaKey||event.ctrlKey)&&event.code==='KeyY'){redoAction();event.preventDefault();return;}if(event.code==='KeyB'&&!event.repeat){setAction(action==='break'?'place':'break');event.preventDefault();return;}if(event.code==='KeyR'&&!event.repeat){const entry=draft?.palette?.[selectedState];if(entry?.shape==='stair')root.querySelector('#rift-creative-stair-rotate')?.click();else rotateSelected(1);event.preventDefault();}}
  window.addEventListener('keydown',onKeyDown,{passive:false});

  return {
    update(){updateTarget();},get active(){return active;},refreshAiDrafts,loadSelectedAiDraft,
    onDocumentLoaded(){if(active){draft=ensureRiftSharedPalette(clone(getImported().document));refreshPalette();refreshSelect();}},
    destroy(){exit();toggle?.removeEventListener('click',toggleMode);window.removeEventListener('keydown',onKeyDown);canvas.removeEventListener('pointerdown',onCanvasPointerDown);canvas.removeEventListener('pointermove',onCanvasPointerMove);canvas.removeEventListener('pointerup',onCanvasPointerUp);nativeGrid.dispose();engine.removeDrawables(markerEdges);}
  };
}
