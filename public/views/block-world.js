import { api } from '../ui/api.js';
import { go } from '../ui/router.js';
import { BLOCK1, BLOCK_EDITOR_SCHEMA_VERSION } from '../block1.js';
import { BLOCK_ASSETS } from '../block-assets.js';
import { mountBlockEditor } from '../react-ui.js';

let cleanup=null;
export function destroyBlockWorld(){ if(cleanup){cleanup();cleanup=null;} }

export async function renderBlockWorld(root){
  destroyBlockWorld();
  const [worldData,playerData,publishedBlockData]=await Promise.all([
    api('/api/world'),
    api('/api/player'),
    api(`/api/world/blocks/${encodeURIComponent(BLOCK1.id)}`)
  ]);
  const locations=worldData.locations||[];
  const validLocationIds=new Set(locations.map(x=>x.id));

  root.innerHTML=`
    <section class="blockworld-shell">
      <div class="blockworld-viewport" id="blockworld-viewport">
        <div class="blockworld-scene" id="blockworld-scene">
          <img class="bw-scene-plate" src="/assets/blocks/commerce-street.svg" alt="" draggable="false" decoding="async" fetchpriority="high">
          <div class="bw-sky"></div>
          <div class="bw-backdrop">
            <div class="bw-haze"></div>
            <div class="bw-skyline bw-skyline-far">
              ${'<span></span>'.repeat(12)}
            </div>
            <div class="bw-skyline bw-skyline-near">
              ${'<i></i>'.repeat(10)}
            </div>
            <div class="bw-rooftop-life">
              <span class="bw-water-tank"></span>
              <span class="bw-distant-antenna"></span>
              <span class="bw-distant-hvac"></span>
              <span class="bw-distant-hvac second"></span>
            </div>
            <div class="bw-wire wire-a"></div>
            <div class="bw-wire wire-b"></div>
          </div>
          <div class="bw-ground"></div>
          <div class="bw-road">
            <div class="bw-road-line"></div><div class="bw-road-line second"></div>
          </div>
          <div class="bw-sidewalk bw-sidewalk-north"></div>
          <div class="bw-sidewalk bw-sidewalk-south"></div>
          <div class="bw-buildings"></div>
          <div class="bw-props"></div>
          <div class="bw-player" id="bw-player"><i></i></div>
          <div class="bw-prompt" id="bw-prompt"></div>
          <div class="bw-exit bw-exit-west">← NEXT BLOCK</div>
          <div class="bw-exit bw-exit-east">NEXT BLOCK →</div>
        </div>
      </div>
      <div class="bw-block-label"><small>DOWNTOWN / BLOCK 01</small><strong>Commerce Street</strong></div>
      <div class="bw-dev-buttons">
        <button class="bw-edit-toggle" id="bw-edit-toggle" type="button">EDIT</button>
        <button class="bw-editor-panel-toggle" id="bw-editor-panel-toggle" type="button" hidden>HIDE PANEL</button>
        <button class="bw-fullscreen" id="bw-fullscreen" type="button" aria-label="Toggle fullscreen">FULLSCREEN</button>
      </div>
      <div id="bw-react-editor-root" class="bw-react-editor-host"></div>
      <div class="bw-controls">
        <div class="bw-stick" id="bw-stick"><div class="bw-knob" id="bw-knob"></div></div>
        <button type="button" class="bw-run" id="bw-run">RUN</button>
        <button type="button" class="bw-interact" id="bw-interact" disabled>ENTER</button>
      </div>
    </section>`;

  const unmountReactEditor=mountBlockEditor(root.querySelector('#bw-react-editor-root'));

  const viewport=root.querySelector('#blockworld-viewport');
  const scene=root.querySelector('#blockworld-scene');
  const buildings=scene.querySelector('.bw-buildings');
  const props=scene.querySelector('.bw-props');
  const player=scene.querySelector('#bw-player');
  const prompt=scene.querySelector('#bw-prompt');
  const interact=root.querySelector('#bw-interact');
  const run=root.querySelector('#bw-run');
  const fullscreenButton=root.querySelector('#bw-fullscreen');
  const shell=root.querySelector('.blockworld-shell');
  const stick=root.querySelector('#bw-stick');
  const editToggle=root.querySelector('#bw-edit-toggle');
  const editorPanelToggle=root.querySelector('#bw-editor-panel-toggle');
  const editor=root.querySelector('#bw-editor');
  const editorClose=root.querySelector('#bw-editor-close');
  const editorMinimize=root.querySelector('#bw-editor-minimize');
  const editorSelection=root.querySelector('#bw-editor-selection');
  const objectSelect=root.querySelector('#bw-editor-object');
  const inputX=root.querySelector('#bw-editor-x'),inputY=root.querySelector('#bw-editor-y');
  const inputW=root.querySelector('#bw-editor-w'),inputH=root.querySelector('#bw-editor-h');
  const snapSelect=root.querySelector('#bw-editor-snap');
  const duplicateButton=root.querySelector('#bw-editor-duplicate'),deleteButton=root.querySelector('#bw-editor-delete');
  const undoButton=root.querySelector('#bw-editor-undo'),redoButton=root.querySelector('#bw-editor-redo');
  const exportButton=root.querySelector('#bw-editor-export'),resetButton=root.querySelector('#bw-editor-reset');
  const serverStatus=root.querySelector('#bw-editor-server-status');
  const revertDraftButton=root.querySelector('#bw-editor-revert-draft');
  const localExportButton=root.querySelector('#bw-editor-local-export');
  const addPropButton=root.querySelector('#bw-editor-add-prop'),propKind=root.querySelector('#bw-editor-prop-kind');
  const assetFile=root.querySelector('#bw-asset-file'),assetSelect=root.querySelector('#bw-editor-asset');
  const assetStatus=root.querySelector('#bw-asset-status');
  const assetApply=root.querySelector('#bw-asset-apply'),assetClear=root.querySelector('#bw-asset-clear');

  // Asset Lab-compatible runtime library. Keep every imported asset object intact:
  // internal id, stable assetId, embedded src, source dimensions and transform metadata.
  // Buildings resolve by stable assetId; Asset Lab's internal id remains preserved.
  const ASSET_CACHE_KEY='riftcity:block-assets:v3';
  const importedAssets=new Map();
  const sourceAssetIds=new Set();

  function normalizeAsset(raw,preview={}){
    if(!raw||typeof raw!=='object')return null;
    const assetId=String(raw.assetId||raw.id||raw.slug||raw.name||'').trim();
    const internalId=String(raw.id||assetId).trim();
    let src=String(raw.src||raw.dataUrl||raw.image||raw.imageData||raw.data||'').trim();
    const mime=String(raw.mimeType||raw.mime||'image/png').trim()||'image/png';
    if(src&&!src.startsWith('data:image/')&&/^[A-Za-z0-9+/=\s]+$/.test(src)){
      src=`data:${mime};base64,${src.replace(/\s+/g,'')}`;
    }
    if(!assetId||!src.startsWith('data:image/'))return null;
    return {
      ...raw,
      id:internalId,
      assetId,
      name:String(raw.name||raw.label||assetId),
      mime,
      src,
      sourceWidth:Number(raw.sourceWidth||raw.width||0),
      sourceHeight:Number(raw.sourceHeight||raw.height||0),
      x:Number(raw.x||0),
      y:Number(raw.y||0),
      scale:Number(raw.scale??1),
      rotation:Number(raw.rotation||0),
      opacity:Number(raw.opacity??1),
      groundY:Number(raw.groundY||0),
      shadow:raw.shadow!==false,
      preview:{
        width:Number(preview.width||raw.preview?.width||0),
        height:Number(preview.height||raw.preview?.height||0),
        background:String(preview.background||raw.preview?.background||'')
      }
    };
  }

  for(const [key,raw] of Object.entries(BLOCK_ASSETS)){
    const asset=normalizeAsset({...raw,assetId:raw.assetId||key,id:raw.id||key},raw.preview||{});
    if(asset){importedAssets.set(asset.assetId,asset);sourceAssetIds.add(asset.assetId);}
  }
  try{
    const cached=JSON.parse(localStorage.getItem(ASSET_CACHE_KEY)||'[]');
    for(const raw of Array.isArray(cached)?cached:[]){
      const asset=normalizeAsset(raw,raw.preview||{});
      if(asset)importedAssets.set(asset.assetId,asset);
    }
  }catch(_){}
  function persistImportedAssets(){
    try{
      const cached=[...importedAssets.values()].filter(a=>!sourceAssetIds.has(a.assetId));
      localStorage.setItem(ASSET_CACHE_KEY,JSON.stringify(cached));
    }catch(err){
      console.warn('RiftCity asset library could not be saved',err);
      assetStatus.textContent='Asset imported, but browser storage is full. Export/trim older assets before reloading.';
    }
  }

  // Published server layout is authoritative in Play Mode. BLOCK1 remains the source fallback.
  const cloneBlock=value=>JSON.parse(JSON.stringify(value));
  let publishedWorking=cloneBlock(publishedBlockData?.block||BLOCK1);
  let editMode=false, editorCollapsed=false, selectedKey='', drag=null;
  let working=cloneBlock(publishedWorking);
  let undoStack=[],redoStack=[];
  let draftDirty=false,draftSaving=false,draftTimer=null,draftInterval=null;
  let draftRevision=0,publishedRevision=Number(publishedBlockData?.revision||0);

  function setServerStatus(text,state=''){
    if(!serverStatus)return;
    serverStatus.textContent=text;
    serverStatus.dataset.state=state;
  }

  function markDraftDirty(){
    if(!editMode)return;
    draftDirty=true;
    setServerStatus('DRAFT · unsaved','dirty');
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>saveDraftToServer(),1200);
  }

  async function saveDraftToServer({force=false}={}){
    if(!editMode||draftSaving||(!draftDirty&&!force))return true;
    draftSaving=true;
    setServerStatus('DRAFT · saving…','saving');
    const result=await api(`/api/admin/blocks/${encodeURIComponent(working.id)}/draft`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({schemaVersion:BLOCK_EDITOR_SCHEMA_VERSION,block:working})
    });
    draftSaving=false;
    if(!result.ok){
      setServerStatus(`DRAFT · ${result.error||'save failed'}`,'error');
      return false;
    }
    draftRevision=Number(result.draftRevision||draftRevision);
    draftDirty=false;
    setServerStatus(`DRAFT · saved r${draftRevision}`,'saved');
    return true;
  }

  async function loadDraftForEditor(){
    setServerStatus('SERVER · loading draft…','saving');
    const result=await api(`/api/admin/blocks/${encodeURIComponent(BLOCK1.id)}/editor`);
    if(!result.ok){
      setServerStatus(result.status===403?'SERVER · admin role required':`SERVER · ${result.error||'unavailable'}`,'error');
      return false;
    }
    draftRevision=Number(result.draftRevision||0);
    publishedRevision=Number(result.publishedRevision||publishedRevision);
    working=cloneBlock(result.draft||result.published||publishedWorking||BLOCK1);
    undoStack=[];redoStack=[];draftDirty=false;
    renderEditorObjects();syncInspector();
    setServerStatus(`DRAFT · r${draftRevision} · LIVE r${publishedRevision}`,'saved');
    return true;
  }

  function hydrateBlock(layout,{preservePlayer=true}={}){
    const next=cloneBlock(layout||BLOCK1);
    working=next;

    // Rebuild gameplay building DOM instead of only repositioning whatever happened
    // to exist before. This makes add/delete/reorder/published version changes deterministic.
    buildings.querySelectorAll('.bw-building').forEach(el=>el.remove());
    for(const b of working.buildings){
      const el=document.createElement('div');
      el.className='bw-building bw-building-geometry';
      el.dataset.buildingId=b.id;
      buildings.insertBefore(el,alley);
    }

    // Rebuild the authored prop layer from the authoritative layout.
    props.querySelectorAll('.bw-prop-authored').forEach(el=>el.remove());

    // Clamp the player to the newly authoritative walkable area rather than silently
    // restoring the authored spawn every time Publish is pressed.
    if(!preservePlayer&&working.spawn){
      state.x=Number(working.spawn.x)||state.x;
      state.y=Number(working.spawn.y)||state.y;
    }
    const walk=working.walkable;
    if(walk){
      state.x=Math.max(walk.x,Math.min(walk.x+walk.width,state.x));
      state.y=Math.max(walk.y,Math.min(walk.y+walk.height,state.y));
    }

    renderEditorObjects();
    updatePlayer();
  }

  function rebuildPublishedScene(){
    hydrateBlock(publishedWorking,{preservePlayer:true});
  }

  async function publishDraft(){
    const saved=await saveDraftToServer({force:true});
    if(!saved)return;
    setServerStatus('PUBLISHING…','saving');

    // The publish transaction already returns the exact validated JSON committed to D1.
    // Adopt that response directly: no second GET/read-after-write race is required.
    const result=await api(`/api/admin/blocks/${encodeURIComponent(working.id)}/publish`,{method:'POST'});
    if(!result.ok||!result.block){
      setServerStatus(`PUBLISH · ${result.error||'failed'}`,'error');
      return;
    }

    publishedRevision=Number(result.publishedRevision||publishedRevision+1);
    publishedWorking=cloneBlock(result.block);
    draftRevision=Math.max(draftRevision,publishedRevision);
    draftDirty=false;
    hydrateBlock(publishedWorking,{preservePlayer:true});
    syncInspector();
    setServerStatus(`LIVE · r${publishedRevision}`,'published');
  }

  async function revertServerDraft(){
    setServerStatus('DRAFT · reverting…','saving');
    const result=await api(`/api/admin/blocks/${encodeURIComponent(BLOCK1.id)}/revert-draft`,{method:'POST'});
    if(!result.ok){
      setServerStatus(`REVERT · ${result.error||'failed'}`,'error');
      return;
    }
    working=cloneBlock(result.block||publishedWorking||BLOCK1);
    draftDirty=false;undoStack=[];redoStack=[];
    renderEditorObjects();syncInspector();
    setServerStatus(`DRAFT · reverted to ${result.revertedTo}`,'saved');
  }

  // Drag-end/change schedules a fast save; this interval is a second safety net.
  draftInterval=setInterval(()=>{ if(editMode&&draftDirty)saveDraftToServer(); },5000);

  function allEditable(){
    return [
      ...working.buildings.map((o,i)=>({key:`building:${i}`,type:'building',i,o,label:o.name})),
      ...working.props.map((o,i)=>({key:`prop:${i}`,type:'prop',i,o,label:`${o.kind} ${i+1}`})),
      ...((working.exits||[]).map((o,i)=>({key:`exit:${i}`,type:'exit',i,o,label:`${o.id.toUpperCase()} block exit`}))),
      {key:'spawn:0',type:'spawn',i:0,o:working.spawn,label:'Player spawn'},
      {key:'walkable:0',type:'walkable',i:0,o:working.walkable||(working.walkable={x:0,y:990,width:working.width,height:working.height-990}),label:'Walkable area'},
      {key:'scene:0',type:'scene',i:0,o:working.scenePlate||(working.scenePlate={src:'/assets/blocks/commerce-street.svg',x:0,y:0,width:working.width,height:working.height,scale:1}),label:'Scene plate'},
      {key:'alley:0',type:'alley',i:0,o:working.alley,label:'Alley'}
    ];
  }
  function currentEditable(){return allEditable().find(x=>x.key===selectedKey)||null;}
  function snapshot(){return JSON.stringify(working);}
  function commit(before){
    const after=snapshot();
    if(before!==after){
      undoStack.push(before);
      if(undoStack.length>60)undoStack.shift();
      redoStack=[];
      markDraftDirty();
    }
  }
  function snap(v){const n=Number(snapSelect.value)||1;return Math.round(v/n)*n;}
  function populateObjectSelect(){
    const current=selectedKey;
    objectSelect.innerHTML='<option value="">Choose object…</option>'+allEditable().map(x=>`<option value="${x.key}">${x.type.toUpperCase()} · ${x.label}</option>`).join('');
    if(allEditable().some(x=>x.key===current))objectSelect.value=current;
  }
  function populateAssetSelect(){
    const current=assetSelect.value;
    assetSelect.innerHTML='<option value="">No asset</option>'+[...importedAssets.values()].map(a=>`<option value="${escapeAttr(a.assetId)}">${escapeText(a.name||a.assetId)}</option>`).join('');
    if(importedAssets.has(current))assetSelect.value=current;
  }
  function escapeText(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function escapeAttr(v){return escapeText(v).replace(/'/g,'&#39;');}
  function syncAssetInspector(){
    const item=currentEditable(); const b=item?.type==='building'?item.o:null;
    assetSelect.disabled=!b;assetApply.disabled=!b;assetClear.disabled=!b;
    assetSelect.value=b?.assetId&&importedAssets.has(b.assetId)?b.assetId:'';
  }
  async function importAssetPack(file){
    if(!file)return;
    try{
      const payload=JSON.parse(await file.text());
      if(payload?.format!=='riftcity-asset-pack'||!Array.isArray(payload.assets)){
        throw new Error(`Expected a RiftAssets riftcity-asset-pack JSON.`);
      }
      if(!payload.assets.length)throw new Error('This asset pack is empty.');

      const preview={
        width:Number(payload.preview?.width||0),
        height:Number(payload.preview?.height||0),
        background:String(payload.preview?.background||'')
      };
      let added=0,matched=0;
      for(const raw of payload.assets.slice(0,100)){
        const imported=normalizeAsset(raw,preview);
        if(!imported)continue;
        importedAssets.set(imported.assetId,imported);

        // Stable Asset Lab ids such as building.corner-mart.a target the matching
        // authored building. The full Asset Lab transform remains on the asset
        // object; runtime placement overrides are stored separately on the building.
        const hinted=imported.assetId.match(/^building\.([a-z0-9-]+)(?:\.|$)/i)?.[1];
        const target=working.buildings.find(b=>b.id===hinted)
          ||working.buildings.find(b=>String(b.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')===hinted);
        if(target){
          target.assetId=imported.assetId;
          selectedKey=`building:${working.buildings.indexOf(target)}`;
          matched++;
        }
        added++;
      }
      if(!added)throw new Error('No valid embedded image assets were found in this pack.');
      persistImportedAssets();
      populateAssetSelect();
      assetStatus.textContent=`${added} Asset Lab asset${added===1?'':'s'} imported & saved${matched?` · ${matched} auto-matched`:''}`;
      syncAssetInspector();renderEditorObjects();syncInspector();
    }catch(err){assetStatus.textContent=`Import failed: ${err.message}`;}
    finally{assetFile.value='';}
  }
  function applyBuildingAsset(){
    const item=currentEditable();if(item?.type!=='building')return;
    const id=assetSelect.value;if(!id||!importedAssets.has(id)){assetStatus.textContent='Choose an imported asset first.';return;}
    const before=snapshot();item.o.assetId=id;commit(before);renderEditorObjects();syncAssetInspector();
  }
  function clearBuildingAsset(){
    const item=currentEditable();if(item?.type!=='building')return;
    const before=snapshot();delete item.o.assetId;delete item.o.asset;commit(before);renderEditorObjects();syncAssetInspector();
  }
  function syncInspector(){
    const item=currentEditable(); if(!item){inputX.value=inputY.value=inputW.value=inputH.value='';inputW.disabled=inputH.disabled=true;return;}
    const o=item.o; inputX.value=Math.round(o.x||0);inputY.value=Math.round(o.y||0);
    inputW.value=Math.round(o.w??o.width??0);inputH.value=Math.round(o.h??o.height??0);
    const pointOnly=item.type==='prop'||item.type==='spawn';
    inputW.disabled=pointOnly;inputH.disabled=pointOnly;syncAssetInspector();
  }
  function select(key){
    selectedKey=key||'';populateObjectSelect();syncInspector();
    const selected=currentEditable();if(editorSelection)editorSelection.textContent=selected?`${selected.type.toUpperCase()} · ${selected.label}`:'Tap an object in the scene';
    scene.querySelectorAll('.bw-edit-selected').forEach(x=>x.classList.remove('bw-edit-selected'));
    if(key)scene.querySelector(`[data-edit-key="${key}"]`)?.classList.add('bw-edit-selected');
    // Selecting/dragging never forces a minimized inspector back open.
    if(editMode&&!editorCollapsed){
      editor.classList.add('show');
      editor.setAttribute('aria-hidden','false');
    }
  }
  function renderEditorObjects(){
    // Keep authored markup but reposition it from working data.
    working.buildings.forEach((b,i)=>{
      const el=buildings.querySelector(`[data-building-id="${b.id}"]`);
      if(!el)return; el.dataset.editKey=`building:${i}`;
      el.style.left=`${b.x}px`;el.style.top=`${b.y}px`;el.style.width=`${b.w}px`;el.style.height=`${b.h}px`;
      let marker=el.querySelector('.bw-door-marker');
      if(!marker){marker=document.createElement('span');marker.className='bw-door-marker';el.appendChild(marker);}
      marker.style.left=`${(b.doorX??b.x+b.w/2)-b.x}px`;marker.title='Interaction door';
      let art=el.querySelector('.bw-building-art');
      const assetKey=b.assetId||b.asset?.assetId||b.asset?.id;
      const imported=assetKey?importedAssets.get(assetKey):null;
      if(imported){
        if(!art){art=document.createElement('img');art.className='bw-building-art';art.draggable=false;el.prepend(art);}
        art.src=imported.src;art.alt=b.name;
        art.style.width=`${imported.sourceWidth||b.w}px`;
        art.style.height=`${imported.sourceHeight||b.h}px`;
        art.style.left=`${Number(imported.x)||0}px`;
        art.style.top=`${Number(imported.y)||0}px`;
        art.style.opacity=String(Math.max(0,Math.min(1,Number(imported.opacity??1))));
        art.style.transformOrigin='50% 100%';
        art.style.transform=`translate(-50%,-100%) scale(${Number(imported.scale??1)}) rotate(${Number(imported.rotation)||0}deg)`;
        art.dataset.assetId=imported.assetId;
        art.dataset.assetInternalId=imported.id;
        el.classList.add('has-building-art');
      }else{art?.remove();el.classList.remove('has-building-art');}
    });
    props.querySelectorAll('.bw-prop-authored').forEach(x=>x.remove());
    working.props.forEach((p,i)=>{
      const el=document.createElement('div');el.className=`bw-prop bw-${p.kind} bw-prop-authored`;
      el.dataset.editKey=`prop:${i}`;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;
      el.innerHTML=p.kind==='tree'?'<i></i>':'<i></i><b></b>';props.appendChild(el);
    });
    alley.dataset.editKey='alley:0';alley.style.left=`${working.alley.x}px`;alley.style.top=`${working.alley.y}px`;
    alley.style.width=`${working.alley.width}px`;alley.style.height=`${working.alley.height}px`;
    scene.querySelectorAll('.bw-editor-guide').forEach(x=>x.remove());
    if(editMode){
      const addGuide=(key,o,kind,label)=>{
        const g=document.createElement('div');g.className=`bw-editor-guide bw-guide-${kind}`;g.dataset.editKey=key;
        const point=kind==='spawn';
        g.style.left=`${o.x||0}px`;g.style.top=`${o.y||0}px`;
        if(!point){g.style.width=`${o.w??o.width??40}px`;g.style.height=`${o.h??o.height??40}px`;}
        g.innerHTML=`<span>${label}</span>`;scene.appendChild(g);
      };
      addGuide('spawn:0',working.spawn,'spawn','SPAWN');
      (working.exits||[]).forEach((x,i)=>addGuide(`exit:${i}`,x,'exit',`${x.id.toUpperCase()} EXIT`));
      if(working.walkable)addGuide('walkable:0',working.walkable,'walkable','WALKABLE');
      if(working.scenePlate)addGuide('scene:0',working.scenePlate,'scene','SCENE');
    }
    // H1.2: touch/mouse resize gizmos for the selected rectangular editable.
    scene.querySelectorAll('.bw-resize-gizmos').forEach(x=>x.remove());
    const gizmoItem=currentEditable();
    if(editMode&&gizmoItem&&!['prop','spawn'].includes(gizmoItem.type)){
      const target=scene.querySelector(`[data-edit-key="${selectedKey}"]`);
      if(target){
        const gizmos=document.createElement('div');
        gizmos.className='bw-resize-gizmos';
        gizmos.dataset.editKey=selectedKey;
        const handles=['n','e','s','w','nw','ne','se','sw'];
        handles.forEach(edge=>{
          const h=document.createElement('button');
          h.type='button';h.className=`bw-resize-handle bw-resize-${edge}`;
          h.dataset.editKey=selectedKey;h.dataset.resize=edge;
          h.setAttribute('aria-label',`Resize ${edge}`);
          gizmos.appendChild(h);
        });
        target.appendChild(gizmos);
      }
    }
    const plate=root.querySelector('#bw-scene-plate');
    if(plate&&working.scenePlate){
      plate.style.left=`${working.scenePlate.x||0}px`;plate.style.top=`${working.scenePlate.y||0}px`;
      plate.style.width=`${working.scenePlate.width||working.width}px`;plate.style.height=`${working.scenePlate.height||working.height}px`;
      plate.style.transform=`scale(${Number(working.scenePlate.scale)||1})`;plate.style.transformOrigin='0 0';
    }
    populateObjectSelect(); if(selectedKey)select(selectedKey);
  }
  function syncEditorPanelUI(){
    const visible=editMode&&!editorCollapsed;
    editor.classList.toggle('show',visible);
    editor.setAttribute('aria-hidden',String(!visible));
    editorPanelToggle.hidden=!editMode;
    editorPanelToggle.textContent=visible?'HIDE PANEL':'SHOW PANEL';
    editorPanelToggle.setAttribute('aria-pressed',String(visible));
  }

  async function setEditMode(on){
    editMode=!!on;
    shell.classList.toggle('bw-edit-mode',editMode);
    if(editMode){
      // Mode and panel visibility are intentionally separate. Enter Edit with the
      // panel visible, then the dedicated panel button may hide/show it freely.
      editorCollapsed=false;
      editToggle.textContent='PLAY';
      editToggle.setAttribute('aria-label','Switch to play mode');
      await loadDraftForEditor();
      populateObjectSelect();syncInspector();renderEditorObjects();
      syncEditorPanelUI();
    }else{
      clearTimeout(draftTimer);
      if(draftDirty)await saveDraftToServer();
      editorCollapsed=true;
      editToggle.textContent='EDIT';
      editToggle.setAttribute('aria-label','Switch to edit mode');
      drag=null;
      select('');
      rebuildPublishedScene();
      joyX=0;joyY=0;state.running=false;
      setServerStatus(`LIVE · r${publishedRevision}`,'published');
      syncEditorPanelUI();
    }
  }

  function toggleEditorPanel(){
    if(!editMode)return;
    editorCollapsed=!editorCollapsed;
    syncEditorPanelUI();
  }

  async function toggleTopEditor(){
    await setEditMode(!editMode);
  }
  function applyInspector(){
    const item=currentEditable();if(!item)return;const before=snapshot(),o=item.o;
    o.x=snap(inputX.value);o.y=snap(inputY.value);
    if(item.type!=='prop'&&item.type!=='spawn'){
      const wk='w' in o?'w':'width',hk='h' in o?'h':'height';
      o[wk]=Math.max(20,snap(inputW.value));o[hk]=Math.max(20,snap(inputH.value));
    }
    if(item.type==='building'){o.doorX=Math.max(o.x,Math.min(o.x+o.w,o.doorX));o.doorY=o.y+o.h;}
    commit(before);renderEditorObjects();syncInspector();
  }
  function undo(){if(!undoStack.length)return;redoStack.push(snapshot());working=JSON.parse(undoStack.pop());renderEditorObjects();syncInspector();markDraftDirty();}
  function redo(){if(!redoStack.length)return;undoStack.push(snapshot());working=JSON.parse(redoStack.pop());renderEditorObjects();syncInspector();markDraftDirty();}
  function downloadWorld(){
    const payload={format:'riftcity-block-edit',version:BLOCK_EDITOR_SCHEMA_VERSION,exportedAt:new Date().toISOString(),block:working};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${working.id}-edit.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  // Buildings are gameplay geometry only. Visible storefront art comes exclusively
  // from Asset Lab packs; no legacy procedural facade is generated.
  for(const b of working.buildings){
    const el=document.createElement('div');
    el.className='bw-building bw-building-geometry';
    el.dataset.buildingId=b.id;
    el.style.cssText=`left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
    buildings.appendChild(el);
  }
  const alley=document.createElement('div');
  alley.className='bw-alley';
  alley.style.cssText=`left:${working.alley.x}px;top:${working.alley.y}px;width:${working.alley.width}px;height:${working.alley.height}px`;
  alley.innerHTML=`<span class="bw-fireescape"></span><span class="bw-dumpster"></span><span class="bw-bins"></span><span class="bw-graffiti">RIFT</span><span class="bw-puddle"></span><span class="bw-alley-pipe"></span><span class="bw-alley-light"></span><span class="bw-alley-crates"></span><span class="bw-alley-steam"></span>`;
  buildings.appendChild(alley);

  // Street life is decorative only: parked cars, hydrants, benches and utility clutter.
  const life=[
    ['car',610,1015],['car',2210,690],['van',2750,1010],
    ['hydrant',1150,615],['bench',1430,600],['box',1835,600],
    ['news',2490,605],['bench',3300,600],['bollard',430,610],
    ['trashbag',1718,602],['planter',3060,602],['bike',1045,600]
  ];
  for(const [kind,x,y] of life){
    const el=document.createElement('div'); el.className=`bw-life bw-${kind}`;
    el.style.cssText=`left:${x}px;top:${y}px`; el.innerHTML='<i></i><b></b>';
    props.appendChild(el);
  }

  for(const p of working.props){
    const el=document.createElement('div');
    el.className=`bw-prop bw-${p.kind} bw-prop-authored`;
    el.style.left=`${p.x}px`; el.style.top=`${p.y}px`;
    el.innerHTML=p.kind==='tree'?'<i></i>':'<i></i><b></b>';
    props.appendChild(el);
  }

  const state={x:working.spawn.x,y:working.spawn.y,vx:0,vy:0,running:false,near:null,last:performance.now()};
  const keys=new Set();
  let raf=0, pointerId=null, joyX=0,joyY=0;

  function nearestBuilding(){
    let best=null,dist=Infinity;
    for(const b of working.buildings){
      const doorX=b.doorX??(b.x+b.w*.5);
      const doorY=b.doorY??510;
      const d=Math.hypot(state.x-doorX,state.y-doorY);
      if(d<dist){dist=d;best=b;}
    }
    // Interaction only activates when the character is actually at the door.
    return dist<92?best:null;
  }

  function collidesWithFacade(x,y){
    const radius=18;
    return working.buildings.some(b=>
      x>b.x-radius && x<b.x+b.w+radius &&
      y>b.y-radius && y<b.y+b.h+radius
    );
  }
  function updatePrompt(){
    state.near=nearestBuilding();
    if(state.near){
      prompt.textContent=`${state.near.name} · Enter`;
      prompt.classList.add('show');
      interact.disabled=false;
      interact.textContent='ENTER';
    }else{
      prompt.classList.remove('show');
      interact.disabled=true;
    }
  }
  function enter(){
    if(!state.near)return;
    if(validLocationIds.has(state.near.locationId)) go(`city/${state.near.locationId}`);
  }
  function tick(now){
    const dt=Math.min(.035,(now-state.last)/1000||0); state.last=now;
    let dx=joyX,dy=joyY;
    if(keys.has('a')||keys.has('arrowleft'))dx-=1;
    if(keys.has('d')||keys.has('arrowright'))dx+=1;
    if(keys.has('w')||keys.has('arrowup'))dy-=1;
    if(keys.has('s')||keys.has('arrowdown'))dy+=1;
    const len=Math.hypot(dx,dy)||1; if(Math.hypot(dx,dy)>1){dx/=len;dy/=len;}
    const speed=(state.running||keys.has('shift'))?390:235;
    let nx=state.x+dx*speed*dt, ny=state.y+dy*speed*dt;
    nx=Math.max(45,Math.min((working.width||BLOCK1.width)-45,nx));
    // The whole foreground street plane is walkable. Players can now walk
    // north across the road and right up to the storefront threshold.
    const walk=working.walkable||{x:0,y:990,width:working.width,height:working.height-990};
    ny=Math.max(walk.y+18,Math.min(walk.y+walk.height-45,ny));
    nx=Math.max(walk.x+18,Math.min(walk.x+walk.width-45,nx));

    // Resolve axes separately so facades feel solid without sticky corners.
    if(!collidesWithFacade(nx,state.y))state.x=nx;
    if(!collidesWithFacade(state.x,ny))state.y=ny;
    player.style.left=`${state.x}px`; player.style.top=`${state.y}px`;
    const depthRange=Math.max(1,walk.height-63);const playerDepth=.82+((state.y-(walk.y+18))/depthRange)*.20;
    player.style.transform=`translate(-50%,-100%) scale(${playerDepth})`;
    player.style.zIndex=String(30+Math.round(state.y));

    // Gameplay world height is independent from the 2:1 scene-plate bitmap.
    // Fit the playable 1440-unit block to the available viewport; the plate
    // may extend below it visually without changing movement/camera scale.
    const authoredHeight=working.height||BLOCK1.height;
    const fitScale=Math.max(.20,Math.min(1,viewport.clientHeight/authoredHeight));
    const visibleWorldWidth=viewport.clientWidth/fitScale;
    const cameraX=Math.max(
      0,
      Math.min(Math.max(0,(working.width||BLOCK1.width)-visibleWorldWidth),state.x-visibleWorldWidth*.46)
    );
    scene.style.transform=`translate3d(${-cameraX*fitScale}px,0,0) scale(${fitScale})`;
    updatePrompt();
    raf=requestAnimationFrame(tick);
  }
  function keydown(e){
    const k=e.key.toLowerCase();
    const typing=/input|select|textarea/i.test(e.target?.tagName||'');
    if(!typing&&k==='e'){toggleTopEditor();e.preventDefault();return;}
    if(editMode){
      if((e.ctrlKey||e.metaKey)&&k==='z'){e.shiftKey?redo():undo();e.preventDefault();return;}
      if((e.ctrlKey||e.metaKey)&&k==='y'){redo();e.preventDefault();return;}
      if(k==='escape'){if(editorCollapsed)setEditMode(false);else toggleEditorMinimized();e.preventDefault();return;}
      const item=currentEditable();
      if(item&&!typing&&['arrowleft','arrowright','arrowup','arrowdown'].includes(k)){
        const before=snapshot(),step=(Number(snapSelect.value)||1)*(e.shiftKey?5:1);
        if(k==='arrowleft')item.o.x=(Number(item.o.x)||0)-step;
        if(k==='arrowright')item.o.x=(Number(item.o.x)||0)+step;
        if(k==='arrowup')item.o.y=(Number(item.o.y)||0)-step;
        if(k==='arrowdown')item.o.y=(Number(item.o.y)||0)+step;
        if(item.type==='building'){item.o.doorX+=k==='arrowleft'?-step:k==='arrowright'?step:0;item.o.doorY=item.o.y+item.o.h;}
        commit(before);renderEditorObjects();syncInspector();e.preventDefault();return;
      }
      if(item&&!typing&&(k==='delete'||k==='backspace')&&(item.type==='building'||item.type==='prop')){
        deleteButton.click();e.preventDefault();return;
      }
      return;
    }
    if(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown','shift'].includes(k)){keys.add(k);e.preventDefault();}
    if((k==='enter')&&state.near){enter();e.preventDefault();}
  }
  function keyup(e){keys.delete(e.key.toLowerCase());}
  function joy(e){
    const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    let screenX=e.clientX-cx,screenY=e.clientY-cy;
    const m=Math.hypot(screenX,screenY),lim=r.width*.34;
    if(m>lim){screenX=screenX/m*lim;screenY=screenY/m*lim;}
    const world=pointerVectorToWorld(screenX,screenY);
    joyX=world.x/lim;joyY=world.y/lim;
    // The knob follows the finger in screen space; only movement math is remapped.
    knob.style.transform=`translate(${screenX}px,${screenY}px)`;
  }
  function down(e){if(editMode)return;e.preventDefault();e.stopPropagation();pointerId=e.pointerId;stick.setPointerCapture?.(pointerId);joy(e);}
  function move(e){if(e.pointerId===pointerId){e.preventDefault();joy(e);}}
  function up(e){if(e.pointerId!==pointerId)return;pointerId=null;joyX=joyY=0;knob.style.transform='translate(0,0)';}


  function onEditorPointerDown(e){
    if(!editMode)return;
    const target=e.target.closest('[data-edit-key]');if(!target)return;
    e.preventDefault();e.stopPropagation();
    select(target.dataset.editKey);
    const item=currentEditable();if(!item)return;
    const resize=e.target.closest('[data-resize]')?.dataset.resize||'';
    drag={
      id:e.pointerId,key:selectedKey,mode:resize?'resize':'move',resize,
      startX:e.clientX,startY:e.clientY,
      ox:Number(item.o.x)||0,oy:Number(item.o.y)||0,
      ow:Number(item.o.w??item.o.width??0),oh:Number(item.o.h??item.o.height??0),
      doorX:item.type==='building'?(Number(item.o.doorX)||0):null,
      before:snapshot()
    };
    scene.setPointerCapture?.(e.pointerId);
  }
  function onEditorPointerMove(e){
    if(!drag||e.pointerId!==drag.id)return;
    e.preventDefault();e.stopPropagation();
    const item=allEditable().find(x=>x.key===drag.key);if(!item)return;
    const scale=pointerScaleToWorld();
    const screenDx=e.clientX-drag.startX,screenDy=e.clientY-drag.startY;
    const worldDelta=pointerVectorToWorld(screenDx,screenDy);
    const dx=worldDelta.x/scale,dy=worldDelta.y/scale;
    if(drag.mode==='resize'){
      const edge=drag.resize,min=30;
      let x=drag.ox,y=drag.oy,w=drag.ow,h=drag.oh;
      if(edge.includes('w')){x=snap(drag.ox+dx);w=snap(drag.ow-(x-drag.ox));if(w<min){x=drag.ox+drag.ow-min;w=min;}}
      if(edge.includes('e'))w=Math.max(min,snap(drag.ow+dx));
      if(edge.includes('n')){y=snap(drag.oy+dy);h=snap(drag.oh-(y-drag.oy));if(h<min){y=drag.oy+drag.oh-min;h=min;}}
      if(edge.includes('s'))h=Math.max(min,snap(drag.oh+dy));
      item.o.x=x;item.o.y=y;
      if('w' in item.o)item.o.w=w;else item.o.width=w;
      if('h' in item.o)item.o.h=h;else item.o.height=h;
      if(item.type==='building'){
        // Keep the door in the same relative horizontal position while its building is resized.
        const ratio=drag.ow?((drag.doorX-drag.ox)/drag.ow):0.5;
        item.o.doorX=item.o.x+Math.max(0,Math.min(1,ratio))*w;
        item.o.doorY=item.o.y+h;
      }
    }else{
      item.o.x=snap(drag.ox+dx);item.o.y=snap(drag.oy+dy);
      if(item.type==='building'){
        item.o.doorX=(drag.doorX??item.o.doorX)+(item.o.x-drag.ox);
        item.o.doorY=item.o.y+item.o.h;
      }
    }
    selectedKey=drag.key;renderEditorObjects();syncInspector();
  }
  function onEditorPointerUp(e){
    if(!drag||e.pointerId!==drag.id)return;
    e.preventDefault();e.stopPropagation();commit(drag.before);
    try{scene.releasePointerCapture?.(e.pointerId);}catch(_){}
    drag=null;
  }
  assetFile.addEventListener('click',e=>{e.stopPropagation();});
  assetFile.addEventListener('change',async e=>{
    e.preventDefault();
    e.stopPropagation();
    const file=e.currentTarget.files?.[0];
    assetStatus.textContent=file?`Reading ${file.name}…`:'No file selected.';
    if(file) await importAssetPack(file);
  });
  assetApply.addEventListener('click',applyBuildingAsset);assetClear.addEventListener('click',clearBuildingAsset);
  assetSelect.addEventListener('change',()=>{const item=currentEditable();if(item?.type==='building'&&item.o.asset?.id===assetSelect.value)syncAssetInspector();});
  editToggle.addEventListener('click',toggleTopEditor);
  editorPanelToggle.addEventListener('click',toggleEditorPanel);
  editorClose.addEventListener('click',toggleEditorPanel);
  editorMinimize.addEventListener('click',toggleEditorPanel);
  objectSelect.addEventListener('change',()=>select(objectSelect.value));
  [inputX,inputY,inputW,inputH].forEach(el=>el.addEventListener('change',applyInspector));
  undoButton.addEventListener('click',undo);redoButton.addEventListener('click',redo);
  exportButton.addEventListener('click',publishDraft);
  localExportButton?.addEventListener('click',downloadWorld);
  revertDraftButton?.addEventListener('click',revertServerDraft);
  resetButton.addEventListener('click',()=>{const before=snapshot();working=JSON.parse(JSON.stringify(BLOCK1));commit(before);select('');renderEditorObjects();});
  addPropButton.addEventListener('click',()=>{const before=snapshot();working.props.push({kind:propKind.value,x:snap(state.x+70),y:snap(state.y)});commit(before);renderEditorObjects();select(`prop:${working.props.length-1}`);});
  root.querySelectorAll('[data-bw-add-object]').forEach(button=>button.addEventListener('click',()=>{
    const kind=button.dataset.bwAddObject;
    const before=snapshot();
    if(kind==='alley'){
      if(!working.alley) working.alley={x:snap(state.x),y:snap(state.y),width:180,height:260};
      else { working.alley.x=snap(state.x); working.alley.y=snap(state.y); }
      commit(before);renderEditorObjects();select('alley:0');return;
    }
    if(kind==='exit'){
      working.exits=working.exits||[];
      const id=`exit-${Date.now().toString(36)}`;
      working.exits.push({id,x:snap(state.x),y:snap(state.y),width:120,height:220,targetBlock:''});
      commit(before);renderEditorObjects();select(`exit:${working.exits.length-1}`);return;
    }
    if(kind==='spawn'){
      working.spawn={...(working.spawn||{}),x:snap(state.x),y:snap(state.y)};
      commit(before);renderEditorObjects();select('spawn:0');return;
    }
    if(kind==='walkable'){
      working.walkable={x:snap(Math.max(0,state.x-500)),y:snap(Math.max(0,state.y-180)),width:1000,height:360};
      commit(before);renderEditorObjects();select('walkable:0');return;
    }
    if(kind==='door'){
      const nearest=(working.buildings||[]).map((b,i)=>({b,i,d:Math.hypot((b.doorX??b.x)-state.x,(b.doorY??b.y)-state.y)})).sort((a,b)=>a.d-b.d)[0];
      if(nearest){nearest.b.doorX=snap(state.x);nearest.b.doorY=snap(state.y);commit(before);renderEditorObjects();select(`building:${nearest.i}`);}
    }
  }));
  duplicateButton.addEventListener('click',()=>{const item=currentEditable();if(!item)return;const before=snapshot(),copy=JSON.parse(JSON.stringify(item.o));copy.x+=40;copy.y+=40;if(item.type==='building'){copy.id=`${copy.id}-copy-${Date.now().toString(36)}`;copy.name+= ' Copy';copy.doorX+=40;copy.doorY+=40;working.buildings.push(copy);commit(before);renderEditorObjects();select(`building:${working.buildings.length-1}`);}else if(item.type==='prop'){working.props.push(copy);commit(before);renderEditorObjects();select(`prop:${working.props.length-1}`);}});
  deleteButton.addEventListener('click',()=>{const item=currentEditable();if(!item||item.type==='alley')return;const before=snapshot();if(item.type==='building')working.buildings.splice(item.i,1);else working.props.splice(item.i,1);commit(before);select('');renderEditorObjects();});
  scene.addEventListener('pointerdown',onEditorPointerDown,true);
  scene.addEventListener('pointermove',onEditorPointerMove,true);
  scene.addEventListener('pointerup',onEditorPointerUp,true);
  scene.addEventListener('pointercancel',onEditorPointerUp,true);
  editor.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();},true);
  editor.addEventListener('click',e=>{
    const button=e.target.closest('button');
    if(button){button.type='button';}
  },true);
  renderEditorObjects();


  let fullscreenMode=false;

  function isiOS(){
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  }

  function usesRotatedIOSFullscreen(){
    return fullscreenMode && isiOS() && window.matchMedia?.('(orientation: portrait)').matches;
  }

  // Convert a screen-space pointer vector back into the unrotated game/world axes.
  // The iPhone portrait fullscreen fallback rotates #game-root 90deg clockwise in CSS.
  function pointerVectorToWorld(dx,dy){
    return usesRotatedIOSFullscreen() ? {x:dy,y:-dx} : {x:dx,y:dy};
  }

  function pointerScaleToWorld(){
    const rect=scene.getBoundingClientRect();
    const worldWidth=working.width||BLOCK1.width||1;
    return Math.max(0.0001,(usesRotatedIOSFullscreen()?rect.height:rect.width)/worldWidth);
  }

  function updateShellSize(){
    if(fullscreenMode)return;
    const vv=window.visualViewport;
    const viewportHeight=vv?.height||window.innerHeight;
    const rect=shell.getBoundingClientRect();
    const mobileNav=document.querySelector('#mobile-nav');
    const navHeight=mobileNav && getComputedStyle(mobileNav).display!=='none'
      ? mobileNav.getBoundingClientRect().height : 0;
    const available=Math.max(330,Math.floor(viewportHeight-Math.max(0,rect.top)-navHeight-4));
    shell.style.height=`${available}px`;
  }

  async function enterFullscreen(){
    fullscreenMode=true;
    document.body.classList.add('bw-fullscreen-mode');
    shell.classList.add('bw-fullscreen-active');
    fullscreenButton.textContent='EXIT';

    if(!isiOS()){
      // Samsung / Android: use real browser fullscreen and request landscape.
      try{
        if(!document.fullscreenElement && shell.requestFullscreen){
          await shell.requestFullscreen({navigationUI:'hide'});
        }
      }catch(_){}
      try{
        if(screen.orientation?.lock) await screen.orientation.lock('landscape');
      }catch(_){}
    }else{
      // iPhone Safari cannot reliably orientation-lock ordinary webpages.
      // We still attempt native fullscreen where Safari exposes it, then
      // rotate the game shell in CSS when the phone itself is portrait.
      try{
        if(!document.fullscreenElement && shell.requestFullscreen){
          await shell.requestFullscreen();
        }
      }catch(_){}
    }
  }

  async function exitFullscreen(){
    fullscreenMode=false;
    document.body.classList.remove('bw-fullscreen-mode');
    shell.classList.remove('bw-fullscreen-active');
    fullscreenButton.textContent='FULLSCREEN';
    try{screen.orientation?.unlock?.();}catch(_){}
    try{
      if(document.fullscreenElement)await document.exitFullscreen?.();
    }catch(_){}
    requestAnimationFrame(updateShellSize);
  }

  async function toggleFullscreen(){
    if(fullscreenMode)await exitFullscreen();
    else await enterFullscreen();
  }

  function onFullscreenChange(){
    // Android can leave browser fullscreen with Back/system gestures.
    if(!document.fullscreenElement && fullscreenMode && !isiOS()){
      fullscreenMode=false;
      document.body.classList.remove('bw-fullscreen-mode');
      shell.classList.remove('bw-fullscreen-active');
      fullscreenButton.textContent='FULLSCREEN';
      requestAnimationFrame(updateShellSize);
    }
  }

  function onViewportChange(){
    if(!fullscreenMode)updateShellSize();
  }

  fullscreenButton.addEventListener('click',toggleFullscreen);
  document.addEventListener('fullscreenchange',onFullscreenChange);
  window.addEventListener('resize',onViewportChange);
  window.visualViewport?.addEventListener('resize',onViewportChange);
  updateShellSize();

  addEventListener('keydown',keydown,{passive:false});
  addEventListener('keyup',keyup);
  stick.addEventListener('pointerdown',down);
  stick.addEventListener('pointermove',move);
  stick.addEventListener('pointerup',up);
  stick.addEventListener('pointercancel',up);
  interact.addEventListener('pointerup',e=>{if(!editMode){e.preventDefault();enter();}});
  run.addEventListener('pointerdown',e=>{if(!editMode){e.preventDefault();e.stopPropagation();state.running=true;run.setPointerCapture?.(e.pointerId);}});
  run.addEventListener('pointerup',()=>state.running=false);
  run.addEventListener('pointercancel',()=>state.running=false);

  player.style.left=`${state.x}px`;player.style.top=`${state.y}px`;
  raf=requestAnimationFrame(tick);
  cleanup=()=>{
    cancelAnimationFrame(raf);
    clearTimeout(draftTimer);
    clearInterval(draftInterval);
    unmountReactEditor?.();
    removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);
    stick.removeEventListener('pointerdown',down);stick.removeEventListener('pointermove',move);
    stick.removeEventListener('pointerup',up);stick.removeEventListener('pointercancel',up);
    fullscreenButton.removeEventListener('click',toggleFullscreen);
    document.removeEventListener('fullscreenchange',onFullscreenChange);
    window.removeEventListener('resize',onViewportChange);
    window.visualViewport?.removeEventListener('resize',onViewportChange);
    document.body.classList.remove('bw-fullscreen-mode');
    shell.classList.remove('bw-fullscreen-active');
    try{screen.orientation?.unlock?.();}catch(_){}
    scene.removeEventListener('pointerdown',onEditorPointerDown,true);
    scene.removeEventListener('pointermove',onEditorPointerMove,true);
    scene.removeEventListener('pointerup',onEditorPointerUp,true);
    scene.removeEventListener('pointercancel',onEditorPointerUp,true);
  };
}
