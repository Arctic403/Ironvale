import { api } from '../ui/api.js';
import { go } from '../ui/router.js';
import { BLOCK1, BLOCK_EDITOR_SCHEMA_VERSION } from '../block1.js';
import { BLOCK_ASSETS } from '../block-assets.js';
import { getSubarea } from '../subareas.js';

let cleanup=null;
export function destroyBlockWorld(){ if(cleanup){cleanup();cleanup=null;} }

export async function renderBlockWorld(root, options={}){
  const editorWorkspace=!!options.editorWorkspace;
  destroyBlockWorld();
  const [worldData,playerData,publishedBlockData]=await Promise.all([
    api('/api/world'),
    api('/api/player'),
    api(`/api/world/blocks/${encodeURIComponent(BLOCK1.id)}`)
  ]);
  const locations=worldData.locations||[];
  const validLocationIds=new Set(locations.map(x=>x.id));

  root.innerHTML=`
    <section class="blockworld-shell${editorWorkspace?' bw-editor-page':''}">
      <div class="blockworld-viewport" id="blockworld-viewport">
        <div class="blockworld-scene" id="blockworld-scene">
          <img class="bw-scene-plate" id="bw-scene-plate" src="/assets/blocks/commerce-street.svg" alt="" draggable="false" decoding="async" fetchpriority="high">
          <img class="bw-subarea-plate" id="bw-subarea-plate" alt="" draggable="false" decoding="async" aria-hidden="true">
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
          <div class="bw-subarea-debug" id="bw-subarea-debug" aria-hidden="true"></div>
          <div class="bw-player" id="bw-player"><i></i></div>
          <div class="bw-prompt" id="bw-prompt"></div>
          <div class="bw-exit bw-exit-west">← NEXT BLOCK</div>
          <div class="bw-exit bw-exit-east">NEXT BLOCK →</div>
        </div>
      </div>
      <div class="bw-block-label"><small id="bw-area-kicker">DOWNTOWN / BLOCK 01</small><strong id="bw-area-name">Commerce Street</strong></div>
      ${editorWorkspace
        ? '<div id="bw-react-editor-root" class="bw-react-editor-host"></div>'
        : '<div class="bw-dev-buttons bw-player-only-buttons"><button class="bw-fullscreen" id="bw-fullscreen" type="button" aria-label="Toggle fullscreen">FULLSCREEN</button></div>'}
      <div class="bw-controls">
        <div class="bw-stick" id="bw-stick"><div class="bw-knob" id="bw-knob"></div></div>
        <button type="button" class="bw-run" id="bw-run">RUN</button>
        <button type="button" class="bw-interact" id="bw-interact" disabled>ENTER</button>
      </div>
    </section>`;

  let unmountReactEditor=()=>{};
  let editorScope=root;

  if(editorWorkspace){
    const { mountBlockEditor }=await import('../react-ui.js');
    unmountReactEditor=mountBlockEditor(root.querySelector('#bw-react-editor-root'));
  }else{
    editorScope=document.createElement('div');
    editorScope.innerHTML=`
      <button id="bw-edit-toggle"></button><button id="bw-editor-panel-toggle"></button>
      <aside id="bw-editor"><button id="bw-editor-close"></button><button id="bw-editor-minimize"></button>
        <span id="bw-editor-selection"></span><span id="bw-editor-server-status"></span>
        <select id="bw-editor-object"></select>
        <input id="bw-editor-x"><input id="bw-editor-y"><input id="bw-editor-w"><input id="bw-editor-h">
        <input id="bw-editor-idlabel"><input id="bw-editor-rotation"><input id="bw-editor-zindex">
        <select id="bw-editor-snap"><option value="10" selected>10</option></select>
        <button id="bw-editor-duplicate"></button><button id="bw-editor-delete"></button>
        <button id="bw-editor-undo"></button><button id="bw-editor-redo"></button>
        <button id="bw-editor-export"></button><button id="bw-editor-reset"></button>
        <button id="bw-editor-revert-draft"></button><button id="bw-editor-local-export"></button>
        <button id="bw-editor-add-prop"></button><select id="bw-editor-prop-kind"><option>tree</option></select>
        <input id="bw-asset-file" type="file"><select id="bw-editor-asset"><option value=""></option></select>
        <span id="bw-asset-status"></span><button id="bw-asset-apply"></button><button id="bw-asset-clear"></button>
        <input id="bw-prop-type"><input id="bw-prop-target"><input id="bw-prop-requires">
        <input id="bw-prop-label"><input id="bw-prop-active" type="checkbox">
        <input id="bw-prop-width"><input id="bw-prop-height"><input id="bw-prop-zindex">
        <button id="bw-editor-zoom-in"></button><button id="bw-editor-zoom-out"></button><button id="bw-editor-fit"></button>
        <button id="bw-view-grid"></button><button id="bw-view-colliders"></button><button id="bw-view-zones"></button><button id="bw-view-labels"></button>
        <span id="bw-status-objects"></span><span id="bw-status-entrances"></span><span id="bw-status-exits"></span><span id="bw-status-props"></span>
      </aside>`;
  }

  const editorQuery=selector=>editorScope.querySelector(selector);

  const viewport=root.querySelector('#blockworld-viewport');
  const scene=root.querySelector('#blockworld-scene');
  const buildings=scene.querySelector('.bw-buildings');
  const props=scene.querySelector('.bw-props');
  const scenePlate=scene.querySelector('#bw-scene-plate');
  const subareaPlate=scene.querySelector('#bw-subarea-plate');
  const subareaDebug=scene.querySelector('#bw-subarea-debug');
  const player=scene.querySelector('#bw-player');
  const prompt=scene.querySelector('#bw-prompt');
  const areaKicker=root.querySelector('#bw-area-kicker');
  const areaName=root.querySelector('#bw-area-name');
  const interact=root.querySelector('#bw-interact');
  const run=root.querySelector('#bw-run');
  const fullscreenButton=root.querySelector('#bw-fullscreen')||editorQuery('#bw-fullscreen');
  const shell=root.querySelector('.blockworld-shell');
  const stick=root.querySelector('#bw-stick');

  // A failed alley asset should never fall back visually to Commerce Street.
  // Keep the sub-area canvas active and expose a dark fallback instead.
  subareaPlate?.addEventListener('load',()=>shell.classList.remove('bw-subarea-asset-error'));
  subareaPlate?.addEventListener('error',()=>shell.classList.add('bw-subarea-asset-error'));
  const initialAlley=getSubarea('alley-commerce-01');
  if(subareaPlate&&initialAlley?.scenePlate?.src){
    subareaPlate.dataset.src=initialAlley.scenePlate.src;
    subareaPlate.src=initialAlley.scenePlate.src;
  }
  const editToggle=editorQuery('#bw-edit-toggle');
  const editorPanelToggle=editorQuery('#bw-editor-panel-toggle');
  const editor=editorQuery('#bw-editor');
  const editorClose=editorQuery('#bw-editor-close');
  const editorMinimize=editorQuery('#bw-editor-minimize');
  const editorSelection=editorQuery('#bw-editor-selection');
  const objectSelect=editorQuery('#bw-editor-object');
  const inputX=editorQuery('#bw-editor-x'),inputY=editorQuery('#bw-editor-y');
  const inputW=editorQuery('#bw-editor-w'),inputH=editorQuery('#bw-editor-h');
  const inputIdLabel=editorQuery('#bw-editor-idlabel');
  const inputRotation=editorQuery('#bw-editor-rotation');
  const inputZIndex=editorQuery('#bw-editor-zindex');
  const snapSelect=editorQuery('#bw-editor-snap');
  const duplicateButton=editorQuery('#bw-editor-duplicate'),deleteButton=editorQuery('#bw-editor-delete');
  const lockButton=editorQuery('#bw-editor-lock');
  const undoButton=editorQuery('#bw-editor-undo'),redoButton=editorQuery('#bw-editor-redo');
  const exportButton=editorQuery('#bw-editor-export'),resetButton=editorQuery('#bw-editor-reset');
  const serverStatus=editorQuery('#bw-editor-server-status');
  const revertDraftButton=editorQuery('#bw-editor-revert-draft');
  const localExportButton=editorQuery('#bw-editor-local-export');
  const addPropButton=editorQuery('#bw-editor-add-prop'),propKind=editorQuery('#bw-editor-prop-kind');
  const assetFile=editorQuery('#bw-asset-file'),assetSelect=editorQuery('#bw-editor-asset');
  const assetStatus=editorQuery('#bw-asset-status');
  const assetApply=editorQuery('#bw-asset-apply'),assetClear=editorQuery('#bw-asset-clear');
  const propType=editorQuery('#bw-prop-type'),propTarget=editorQuery('#bw-prop-target');
  const propRequires=editorQuery('#bw-prop-requires'),propLabel=editorQuery('#bw-prop-label');
  const propActive=editorQuery('#bw-prop-active'),propWidth=editorQuery('#bw-prop-width');
  const propHeight=editorQuery('#bw-prop-height'),propZIndex=editorQuery('#bw-prop-zindex');
  const zoomInButton=editorQuery('#bw-editor-zoom-in'),zoomOutButton=editorQuery('#bw-editor-zoom-out'),fitButton=editorQuery('#bw-editor-fit');
  const viewGridButton=editorQuery('#bw-view-grid'),viewColliderButton=editorQuery('#bw-view-colliders');
  const viewZonesButton=editorQuery('#bw-view-zones'),viewLabelsButton=editorQuery('#bw-view-labels');
  const statusObjects=editorQuery('#bw-status-objects'),statusEntrances=editorQuery('#bw-status-entrances');
  const statusExits=editorQuery('#bw-status-exits'),statusProps=editorQuery('#bw-status-props');
  const historySelect=editorQuery('#bw-editor-history'),historyLoadButton=editorQuery('#bw-editor-load-history');
  const focusButton=editorQuery('#bw-editor-focus'),resetLayoutButton=editorQuery('#bw-editor-reset-layout');

  const STUDIO_LAYOUT_KEY='riftcity:block-editor:studio-layout:v3';
  function setupStudioPanels(){
    if(!editorWorkspace||!editor)return ()=>{};
    const layoutTarget=shell;
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(STUDIO_LAYOUT_KEY)||'{}')||{};}catch(_){}
    const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
    const panels=[...editor.querySelectorAll('[data-editor-panel]')];
    const panelByName=name=>editor.querySelector(`[data-editor-panel="${name}"]`);
    const isCollapsed=name=>panelByName(name)?.dataset.collapsed==='true';

    const cssNumber=(name,fallback)=>{
      const value=parseFloat(getComputedStyle(layoutTarget).getPropertyValue(name));
      return Number.isFinite(value)?value:fallback;
    };
    const compact=()=>Math.min(window.innerWidth||9999,window.innerHeight||9999)<520 || (window.innerHeight||9999)<470;
    const defaults=()=>compact()
      ? {left:148,right:158,bottom:72,top:50}
      : {left:238,right:252,bottom:140,top:82};

    const applySaved=()=>{
      const d=defaults();
      if(Number(saved.left))layoutTarget.style.setProperty('--be-left',`${clamp(saved.left,112,360)}px`);
      if(Number(saved.right))layoutTarget.style.setProperty('--be-right',`${clamp(saved.right,112,360)}px`);
      if(Number(saved.bottom))layoutTarget.style.setProperty('--be-bottom',`${clamp(saved.bottom,58,230)}px`);
      if(Number(saved.top))layoutTarget.style.setProperty('--be-transform',`${clamp(saved.top,42,120)}px`);
      // H1.14 starts with the scene clear. Each tool surface is one tap away
      // as a floating popover, while an existing v3 preference is respected.
      const collapsed={palette:true,properties:true,tools:true,transform:true,...(saved.collapsed||{})};
      panels.forEach(panel=>{
        const name=panel.dataset.editorPanel;
        panel.dataset.collapsed=collapsed[name]?'true':'false';
      });
      if(!Number(saved.left))layoutTarget.style.removeProperty('--be-left');
      if(!Number(saved.right))layoutTarget.style.removeProperty('--be-right');
      if(!Number(saved.bottom))layoutTarget.style.removeProperty('--be-bottom');
      if(!Number(saved.top))layoutTarget.style.removeProperty('--be-transform');
    };

    const syncDockState=()=>{
      layoutTarget.classList.toggle('bw-dock-left-collapsed',isCollapsed('palette'));
      layoutTarget.classList.toggle('bw-dock-right-collapsed',isCollapsed('properties'));
      layoutTarget.classList.toggle('bw-dock-bottom-collapsed',isCollapsed('tools'));
      layoutTarget.classList.toggle('bw-dock-transform-collapsed',isCollapsed('transform'));
      editor.querySelectorAll('[data-panel-toggle]').forEach(button=>{
        const open=!isCollapsed(button.dataset.panelToggle);
        button.classList.toggle('active',open);
        button.setAttribute('aria-pressed',String(open));
      });
    };

    const constrainLayout=(preferred='')=>{
      const d=defaults();
      const rect=layoutTarget.getBoundingClientRect();
      const width=Math.max(320,rect.width||window.innerWidth||667);
      const height=Math.max(260,rect.height||window.innerHeight||375);
      const minSide=compact()?112:150;
      const rail=compact()?34:46;
      const gap=compact()?4:8;
      const minScene=Math.max(compact()?220:340,Math.min(compact()?300:520,width*.42));
      const sideBudget=Math.max(minSide*2,width-minScene-rail-gap*5-20);

      let left=cssNumber('--be-left',d.left);
      let right=cssNumber('--be-right',d.right);
      left=clamp(left,minSide,Math.min(360,width*.34));
      right=clamp(right,minSide,Math.min(360,width*.34));

      const leftEff=isCollapsed('palette')?34:left;
      const rightEff=isCollapsed('properties')?34:right;
      if(leftEff+rightEff>sideBudget){
        if(preferred==='left'&&!isCollapsed('palette')){
          left=Math.max(minSide,sideBudget-rightEff);
        }else if(preferred==='right'&&!isCollapsed('properties')){
          right=Math.max(minSide,sideBudget-leftEff);
        }else if(!isCollapsed('palette')&&!isCollapsed('properties')){
          const ratio=sideBudget/Math.max(1,left+right);
          left=Math.max(minSide,left*ratio);
          right=Math.max(minSide,right*ratio);
        }
      }

      const header=compact()?44:68;
      const transform=isCollapsed('transform')?32:cssNumber('--be-transform',d.top);
      const minSceneHeight=compact()?110:180;
      const maxBottom=Math.max(58,height-header-transform-minSceneHeight-gap*4-16);
      let bottom=cssNumber('--be-bottom',d.bottom);
      bottom=clamp(bottom,58,Math.min(230,maxBottom));

      layoutTarget.style.setProperty('--be-left',`${Math.round(left)}px`);
      layoutTarget.style.setProperty('--be-right',`${Math.round(right)}px`);
      layoutTarget.style.setProperty('--be-bottom',`${Math.round(bottom)}px`);
    };

    applySaved();
    syncDockState();
    requestAnimationFrame(()=>constrainLayout());

    const persist=()=>{
      const d=defaults();
      const payload={
        left:cssNumber('--be-left',d.left),
        right:cssNumber('--be-right',d.right),
        bottom:cssNumber('--be-bottom',d.bottom),
        top:cssNumber('--be-transform',d.top),
        collapsed:Object.fromEntries(panels.map(p=>[p.dataset.editorPanel,p.dataset.collapsed==='true']))
      };
      try{localStorage.setItem(STUDIO_LAYOUT_KEY,JSON.stringify(payload));}catch(_){}
    };

    const collapseHandlers=[];
    const togglePanel=(name,force)=>{
      const panel=panelByName(name);
      if(!panel)return;
      const next=typeof force==='boolean'?force:panel.dataset.collapsed==='true';
      panel.dataset.collapsed=next?'false':'true';
      syncDockState();
      constrainLayout();
      persist();
    };
    editor.querySelectorAll('[data-panel-collapse]').forEach(button=>{
      const handler=e=>{
        e.preventDefault();e.stopPropagation();
        togglePanel(button.dataset.panelCollapse,false);
      };
      button.addEventListener('click',handler);
      collapseHandlers.push(()=>button.removeEventListener('click',handler));
    });
    editor.querySelectorAll('[data-panel-toggle]').forEach(button=>{
      const handler=e=>{
        e.preventDefault();e.stopPropagation();
        togglePanel(button.dataset.panelToggle);
      };
      button.addEventListener('click',handler);
      collapseHandlers.push(()=>button.removeEventListener('click',handler));
    });

    let resize=null;
    const down=e=>{
      const handle=e.target.closest('[data-panel-resizer]');
      if(!handle)return;
      e.preventDefault();e.stopPropagation();
      const name=handle.dataset.panelResizer;
      const d=defaults();
      resize={
        id:e.pointerId,name,startX:e.clientX,startY:e.clientY,
        left:cssNumber('--be-left',d.left),
        right:cssNumber('--be-right',d.right),
        bottom:cssNumber('--be-bottom',d.bottom)
      };
      handle.setPointerCapture?.(e.pointerId);
    };
    const move=e=>{
      if(!resize||e.pointerId!==resize.id)return;
      e.preventDefault();
      const rawX=e.clientX-resize.startX,rawY=e.clientY-resize.startY;
      const delta=typeof pointerVectorToWorld==='function'?pointerVectorToWorld(rawX,rawY):{x:rawX,y:rawY};
      if(resize.name==='palette'){
        layoutTarget.style.setProperty('--be-left',`${resize.left+delta.x}px`);
        constrainLayout('left');
      }
      if(resize.name==='properties'){
        layoutTarget.style.setProperty('--be-right',`${resize.right-delta.x}px`);
        constrainLayout('right');
      }
      if(resize.name==='tools'){
        layoutTarget.style.setProperty('--be-bottom',`${resize.bottom-delta.y}px`);
        constrainLayout('bottom');
      }
    };
    const up=e=>{
      if(!resize||e.pointerId!==resize.id)return;
      resize=null;constrainLayout();persist();
    };
    editor.addEventListener('pointerdown',down,true);
    editor.addEventListener('pointermove',move,true);
    editor.addEventListener('pointerup',up,true);
    editor.addEventListener('pointercancel',up,true);

    const resetLayout=()=>{
      try{localStorage.removeItem(STUDIO_LAYOUT_KEY);}catch(_){}
      ['--be-left','--be-right','--be-bottom','--be-transform'].forEach(name=>layoutTarget.style.removeProperty(name));
      panels.forEach(panel=>panel.dataset.collapsed='true');
      syncDockState();
      requestAnimationFrame(()=>constrainLayout());
    };
    resetLayoutButton?.addEventListener('click',resetLayout);

    const onStudioResize=()=>constrainLayout();
    window.addEventListener('resize',onStudioResize);
    window.visualViewport?.addEventListener('resize',onStudioResize);

    return ()=>{
      collapseHandlers.forEach(fn=>fn());
      resetLayoutButton?.removeEventListener('click',resetLayout);
      editor.removeEventListener('pointerdown',down,true);
      editor.removeEventListener('pointermove',move,true);
      editor.removeEventListener('pointerup',up,true);
      editor.removeEventListener('pointercancel',up,true);
      window.removeEventListener('resize',onStudioResize);
      window.visualViewport?.removeEventListener('resize',onStudioResize);
      ['bw-dock-left-collapsed','bw-dock-right-collapsed','bw-dock-bottom-collapsed','bw-dock-transform-collapsed'].forEach(name=>layoutTarget.classList.remove(name));
    };
  }
  const destroyStudioPanels=setupStudioPanels();

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
  let activeSubarea=null;
  let streetReturnPoint=null;
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
    await loadVersionHistory();
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

  async function loadVersionHistory(){
    if(!historySelect)return;
    const result=await api(`/api/admin/blocks/${encodeURIComponent(BLOCK1.id)}/history`);
    if(!result.ok){
      historySelect.innerHTML='<option value="">History unavailable</option>';
      return;
    }
    const history=result.history||[];
    historySelect.innerHTML='<option value="">Published revisions…</option>'+history.map(item=>{
      const stamp=item.published_at?new Date(Number(item.published_at)).toLocaleString():'unknown time';
      return `<option value="${Number(item.revision)||0}">r${Number(item.revision)||0} · ${escapeText(stamp)}</option>`;
    }).join('');
  }

  async function restoreHistoryToDraft(){
    const revision=Number(historySelect?.value||0);
    if(!revision)return;
    setServerStatus(`RESTORE · r${revision}…`,'saving');
    const result=await api(`/api/admin/blocks/${encodeURIComponent(BLOCK1.id)}/restore-revision`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({revision})
    });
    if(!result.ok||!result.block){
      setServerStatus(`RESTORE · ${result.error||'failed'}`,'error');
      return;
    }
    working=cloneBlock(result.block);
    draftRevision=Number(result.draftRevision||draftRevision);
    draftDirty=false;undoStack=[];redoStack=[];selectedKey='';
    renderEditorObjects();populateObjectSelect();syncInspector();
    setServerStatus(`DRAFT · restored from live r${revision}`,'saved');
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
  function isLocked(item){return !!item?.o?.locked;}
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
  function nudgeSelected(dx,dy){
    const item=currentEditable();if(!item||isLocked(item))return;
    const before=snapshot(),step=Number(snapSelect.value)||1;
    item.o.x=(Number(item.o.x)||0)+dx*step;
    item.o.y=(Number(item.o.y)||0)+dy*step;
    if(item.type==='building'){
      item.o.doorX=(Number(item.o.doorX)||0)+dx*step;
      item.o.doorY=item.o.y+item.o.h;
    }
    commit(before);renderEditorObjects();syncInspector();
  }
  function focusSelected(){
    const item=currentEditable();if(!item)return;
    const o=item.o||{},width=Number(o.w??o.width??0);
    state.x=Math.max(0,Math.min(working.width||BLOCK1.width,(Number(o.x)||0)+width/2));
  }
  function populateObjectSelect(){
    const current=selectedKey;
    objectSelect.innerHTML='<option value="">Choose object…</option>'+allEditable().map(x=>`<option value="${x.key}">${x.type.toUpperCase()} · ${x.label}${isLocked(x)?' · LOCKED':''}</option>`).join('');
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
    const item=currentEditable();if(item?.type!=='building'||isLocked(item))return;
    const id=assetSelect.value;if(!id||!importedAssets.has(id)){assetStatus.textContent='Choose an imported asset first.';return;}
    const before=snapshot();item.o.assetId=id;commit(before);renderEditorObjects();syncAssetInspector();
  }
  function clearBuildingAsset(){
    const item=currentEditable();if(item?.type!=='building'||isLocked(item))return;
    const before=snapshot();delete item.o.assetId;delete item.o.asset;commit(before);renderEditorObjects();syncAssetInspector();
  }
  function objectDisplayLabel(item){
    if(!item)return '';
    const o=item.o||{};
    if(item.type==='building')return o.name||o.id||item.label||'Building';
    if(item.type==='exit')return o.label||o.id||'Block Exit';
    if(item.type==='prop')return o.label||o.kind||'Prop';
    return o.label||item.label||item.type;
  }
  function objectTarget(item){
    if(!item)return '';
    const o=item.o||{};
    if(item.type==='building')return o.locationId||'';
    if(item.type==='exit')return o.targetBlock||'';
    return o.target||o.targetBlock||'';
  }
  function syncStudioStatus(){
    statusObjects && (statusObjects.textContent=String(allEditable().length));
    statusEntrances && (statusEntrances.textContent=String((working.buildings||[]).length+(working.alley?1:0)));
    statusExits && (statusExits.textContent=String((working.exits||[]).length));
    statusProps && (statusProps.textContent=String((working.props||[]).length));
  }
  function syncInspector(){
    const item=currentEditable();
    if(!item){
      inputX.value=inputY.value=inputW.value=inputH.value='';
      inputIdLabel && (inputIdLabel.value='');
      inputRotation && (inputRotation.value='0');
      inputZIndex && (inputZIndex.value='0');
      inputW.disabled=inputH.disabled=true;
      if(propType)propType.value='';
      if(propTarget)propTarget.value='';
      if(propRequires)propRequires.value='';
      if(propLabel)propLabel.value='';
      if(propActive)propActive.checked=false;
      if(propWidth)propWidth.value='';
      if(propHeight)propHeight.value='';
      if(propZIndex)propZIndex.value='';
      if(lockButton){lockButton.disabled=true;lockButton.textContent='LOCK SELECTED';lockButton.classList.remove('active');}
      syncStudioStatus();
      return;
    }
    const o=item.o||{};
    inputX.value=Math.round(o.x||0);inputY.value=Math.round(o.y||0);
    inputW.value=Math.round(o.w??o.width??0);inputH.value=Math.round(o.h??o.height??0);
    const pointOnly=item.type==='prop'||item.type==='spawn';
    inputW.disabled=pointOnly;inputH.disabled=pointOnly;
    const label=objectDisplayLabel(item);
    if(inputIdLabel)inputIdLabel.value=label;
    if(inputRotation)inputRotation.value=String(Number(o.rotation||0));
    if(inputZIndex)inputZIndex.value=String(Number(o.zIndex||0));
    if(propType)propType.value=item.type.replace(/(^|[-_])(\w)/g,(_,a,b)=>`${a?' ':''}${b.toUpperCase()}`);
    if(propTarget)propTarget.value=objectTarget(item);
    if(propRequires)propRequires.value=String(o.requires||'');
    if(propLabel)propLabel.value=label;
    if(propActive)propActive.checked=o.active!==false;
    if(propWidth){propWidth.value=inputW.value;propWidth.disabled=pointOnly;}
    if(propHeight){propHeight.value=inputH.value;propHeight.disabled=pointOnly;}
    if(propZIndex)propZIndex.value=String(Number(o.zIndex||0));
    syncAssetInspector();

    const locked=isLocked(item);
    if(lockButton){
      lockButton.disabled=false;
      lockButton.textContent=locked?'UNLOCK SELECTED':'LOCK SELECTED';
      lockButton.classList.toggle('active',locked);
    }
    [inputX,inputY,inputIdLabel,inputRotation,inputZIndex,propTarget,propRequires,propLabel,propActive,propZIndex].filter(Boolean).forEach(el=>{el.disabled=locked;});
    inputW.disabled=pointOnly||locked;inputH.disabled=pointOnly||locked;
    if(propWidth)propWidth.disabled=pointOnly||locked;
    if(propHeight)propHeight.disabled=pointOnly||locked;
    if(assetSelect)assetSelect.disabled=locked||item.type!=='building';
    if(assetApply)assetApply.disabled=locked||item.type!=='building';
    if(assetClear)assetClear.disabled=locked||item.type!=='building';
    if(duplicateButton)duplicateButton.disabled=locked||!['building','prop'].includes(item.type);
    if(deleteButton)deleteButton.disabled=locked||item.type==='alley'||!['building','prop'].includes(item.type);
    editorScope.querySelectorAll('[data-bw-nudge]').forEach(button=>{button.disabled=locked;});
    syncStudioStatus();
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
      el.classList.toggle('bw-edit-locked',!!b.locked);
      el.dataset.editLocked=b.locked?'true':'false';
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
      el.dataset.editKey=`prop:${i}`;el.classList.toggle('bw-edit-locked',!!p.locked);el.dataset.editLocked=p.locked?'true':'false';
      el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;
      el.innerHTML=p.kind==='tree'?'<i></i>':'<i></i><b></b>';props.appendChild(el);
    });
    alley.dataset.editKey='alley:0';alley.classList.toggle('bw-edit-locked',!!working.alley.locked);alley.dataset.editLocked=working.alley.locked?'true':'false';
    alley.style.left=`${working.alley.x}px`;alley.style.top=`${working.alley.y}px`;
    alley.style.width=`${working.alley.width}px`;alley.style.height=`${working.alley.height}px`;
    scene.querySelectorAll('.bw-editor-guide').forEach(x=>x.remove());
    if(editMode){
      const addGuide=(key,o,kind,label)=>{
        const g=document.createElement('div');g.className=`bw-editor-guide bw-guide-${kind}`;g.dataset.editKey=key;
        g.classList.toggle('bw-edit-locked',!!o.locked);g.dataset.editLocked=o.locked?'true':'false';
        const point=kind==='spawn';
        g.style.left=`${o.x||0}px`;g.style.top=`${o.y||0}px`;
        if(!point){g.style.width=`${o.w??o.width??40}px`;g.style.height=`${o.h??o.height??40}px`;}
        g.style.zIndex=String(5000+Number(o.zIndex||0));
        if(Number(o.rotation||0)){g.style.transform=`rotate(${Number(o.rotation)||0}deg)`;g.style.transformOrigin='50% 50%';}
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
    if(editMode&&gizmoItem&&!isLocked(gizmoItem)&&!['prop','spawn'].includes(gizmoItem.type)){
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
    if(scenePlate&&working.scenePlate&&!activeSubarea){
      scenePlate.src=working.scenePlate.src||'/assets/blocks/commerce-street.svg';
      scenePlate.style.left=`${working.scenePlate.x||0}px`;scenePlate.style.top=`${working.scenePlate.y||0}px`;
      scenePlate.style.width=`${working.scenePlate.width||working.width}px`;scenePlate.style.height=`${working.scenePlate.height||working.height}px`;
      scenePlate.style.transform=`scale(${Number(working.scenePlate.scale)||1})`;scenePlate.style.transformOrigin='0 0';
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
    if(editorWorkspace)shell.classList.toggle('bw-editor-chrome-hidden',!visible);
  }

  async function setEditMode(on){
    if(on&&activeSubarea)leaveSubarea();
    editMode=!!on;
    shell.classList.toggle('bw-edit-mode',editMode);
    if(editMode){
      // Mode and panel visibility are intentionally separate. Enter Edit with the
      // panel visible, then the dedicated panel button may hide/show it freely.
      editorCollapsed=false;
      editToggle.textContent='PLAY';
      editToggle.setAttribute('aria-label','Switch to play mode');
      await loadDraftForEditor();
      await loadVersionHistory();
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
  function applyInspector(event){
    const item=currentEditable();if(!item||isLocked(item))return;
    const source=event?.target;

    // The compact transform popup and Properties popup expose a few mirrored
    // fields. Keep the mirrors synchronized before reading values so changing
    // W/H, label or z-index in either surface cannot be silently overwritten.
    if(source===propWidth&&inputW)inputW.value=propWidth.value;
    else if(source===inputW&&propWidth)propWidth.value=inputW.value;
    if(source===propHeight&&inputH)inputH.value=propHeight.value;
    else if(source===inputH&&propHeight)propHeight.value=inputH.value;
    if(source===propLabel&&inputIdLabel)inputIdLabel.value=propLabel.value;
    else if(source===inputIdLabel&&propLabel)propLabel.value=inputIdLabel.value;
    if(source===propZIndex&&inputZIndex)inputZIndex.value=propZIndex.value;
    else if(source===inputZIndex&&propZIndex)propZIndex.value=inputZIndex.value;

    const before=snapshot(),o=item.o;
    o.x=snap(inputX.value);o.y=snap(inputY.value);
    if(item.type!=='prop'&&item.type!=='spawn'){
      const wk='w' in o?'w':'width',hk='h' in o?'h':'height';
      o[wk]=Math.max(20,snap(inputW.value));o[hk]=Math.max(20,snap(inputH.value));
    }
    const nextLabel=(inputIdLabel?.value||propLabel?.value||'').trim();
    if(nextLabel){
      if(item.type==='building')o.name=nextLabel;
      else if(item.type==='exit')o.label=nextLabel;
      else o.label=nextLabel;
    }
    const target=(propTarget?.value||'').trim();
    if(item.type==='building')o.locationId=target;
    else if(item.type==='exit')o.targetBlock=target;
    else if(target)o.target=target;
    else if('target' in o)delete o.target;
    if(propRequires)o.requires=propRequires.value.trim();
    if(propActive)o.active=!!propActive.checked;
    o.rotation=Number(inputRotation?.value||o.rotation||0);
    o.zIndex=Number(inputZIndex?.value||propZIndex?.value||o.zIndex||0);
    if(item.type==='building'){
      o.doorX=Math.max(o.x,Math.min(o.x+o.w,o.doorX));
      o.doorY=o.y+o.h;
    }
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

  function currentArea(){
    if(activeSubarea)return activeSubarea;
    return {
      id:working.id,
      name:working.name||'Commerce Street',
      width:working.width||BLOCK1.width,
      height:working.height||BLOCK1.height,
      walkable:working.walkable||{x:0,y:990,width:working.width||BLOCK1.width,height:(working.height||BLOCK1.height)-990},
      obstacles:working.buildings||[]
    };
  }

  function distanceToRect(x,y,rect){
    const left=Number(rect.x)||0,top=Number(rect.y)||0;
    const width=Number(rect.width??rect.w)||0,height=Number(rect.height??rect.h)||0;
    const right=left+width,bottom=top+height;
    const dx=x<left?left-x:x>right?x-right:0;
    const dy=y<top?top-y:y>bottom?y-bottom:0;
    return Math.hypot(dx,dy);
  }

  function nearestStreetInteraction(){
    let best=null,dist=Infinity;
    for(const b of working.buildings||[]){
      const doorX=b.doorX??(b.x+b.w*.5);
      const doorY=b.doorY??510;
      const d=Math.hypot(state.x-doorX,state.y-doorY);
      if(d<dist){
        dist=d;
        best={kind:'location',name:b.name||'Building',locationId:b.locationId,distance:d};
      }
    }

    const alley=working.alley;
    if(alley&&alley.active!==false&&(Number(alley.width)||0)>0&&(Number(alley.height)||0)>0){
      const d=distanceToRect(state.x,state.y,alley);
      if(d<dist){
        dist=d;
        best={
          kind:'subarea',
          name:alley.label||'Commerce Alley',
          target:alley.target||'alley-commerce-01',
          distance:d
        };
      }
    }

    return best&&dist<100?best:null;
  }

  function nearestSubareaInteraction(){
    if(!activeSubarea)return null;
    const exit=activeSubarea.exit;
    if(exit&&distanceToRect(state.x,state.y,exit)<105){
      return {kind:'subarea-exit',name:exit.label||'Commerce Street',distance:0};
    }
    return null;
  }

  function collidesAt(x,y){
    const radius=18;
    const obstacles=activeSubarea?(activeSubarea.obstacles||[]):(working.buildings||[]);
    return obstacles.some(o=>{
      const left=Number(o.x)||0,top=Number(o.y)||0;
      const width=Number(o.width??o.w)||0,height=Number(o.height??o.h)||0;
      return x>left-radius&&x<left+width+radius&&y>top-radius&&y<top+height+radius;
    });
  }

  function renderSubareaDebug(){
    if(!subareaDebug)return;
    subareaDebug.innerHTML='';
    if(!activeSubarea)return;
    for(const obstacle of activeSubarea.obstacles||[]){
      const el=document.createElement('div');
      el.className='bw-subarea-collider';
      el.style.left=`${obstacle.x}px`;
      el.style.top=`${obstacle.y}px`;
      el.style.width=`${obstacle.width}px`;
      el.style.height=`${obstacle.height}px`;
      subareaDebug.appendChild(el);
    }
    if(activeSubarea.walkable){
      const walk=document.createElement('div');
      walk.className='bw-subarea-walkable';
      walk.style.left=`${activeSubarea.walkable.x}px`;
      walk.style.top=`${activeSubarea.walkable.y}px`;
      walk.style.width=`${activeSubarea.walkable.width}px`;
      walk.style.height=`${activeSubarea.walkable.height}px`;
      subareaDebug.appendChild(walk);
    }
    if(activeSubarea.exit){
      const exit=document.createElement('div');
      exit.className='bw-subarea-exit-guide';
      exit.style.left=`${activeSubarea.exit.x}px`;
      exit.style.top=`${activeSubarea.exit.y}px`;
      exit.style.width=`${activeSubarea.exit.width}px`;
      exit.style.height=`${activeSubarea.exit.height}px`;
      subareaDebug.appendChild(exit);
    }
  }

  function applyAreaVisuals(){
    if(activeSubarea){
      shell.classList.add('bw-subarea-active','bw-subarea-alley');
      shell.dataset.activeArea=activeSubarea.id;
      shell.style.setProperty('--bw-subarea-width',`${activeSubarea.width}px`);
      shell.style.setProperty('--bw-subarea-height',`${activeSubarea.height}px`);
      scene.style.width=`${activeSubarea.width}px`;
      scene.style.height=`${activeSubarea.height}px`;

      // Keep the street and sub-area plates as separate DOM images. Reusing the
      // Commerce Street <img> allowed Safari to keep painting the previous
      // decoded frame while the alley asset was loading, which made the alley
      // look like a tiny/cropped part of the street instead of a new scene.
      if(scenePlate)scenePlate.style.display='none';
      if(subareaPlate){
        const plate=activeSubarea.scenePlate||{};
        const nextSrc=plate.src||'';
        if(subareaPlate.dataset.src!==nextSrc){
          subareaPlate.dataset.src=nextSrc;
          subareaPlate.src=nextSrc;
        }
        subareaPlate.style.display='block';
        subareaPlate.style.left=`${Number(plate.x)||0}px`;
        subareaPlate.style.top=`${Number(plate.y)||0}px`;
        subareaPlate.style.width=`${Number(plate.width)||activeSubarea.width}px`;
        subareaPlate.style.height=`${Number(plate.height)||activeSubarea.height}px`;
        subareaPlate.style.transform=`scale(${Number(plate.scale)||1})`;
        subareaPlate.style.transformOrigin='0 0';
      }

      if(areaKicker)areaKicker.textContent=activeSubarea.kicker||'DOWNTOWN / BLOCK 01';
      if(areaName)areaName.textContent=activeSubarea.name||'Commerce Alley';
      renderSubareaDebug();
      return;
    }

    shell.classList.remove('bw-subarea-active','bw-subarea-alley','bw-subarea-asset-error');
    delete shell.dataset.activeArea;
    shell.style.removeProperty('--bw-subarea-width');
    shell.style.removeProperty('--bw-subarea-height');
    scene.style.width=`${working.width||BLOCK1.width}px`;
    scene.style.height=`${working.height||BLOCK1.height}px`;
    if(subareaPlate)subareaPlate.style.display='none';
    if(scenePlate){
      scenePlate.style.display='block';
      scenePlate.src=working.scenePlate?.src||'/assets/blocks/commerce-street.svg';
      scenePlate.style.left=`${working.scenePlate?.x||0}px`;
      scenePlate.style.top=`${working.scenePlate?.y||0}px`;
      scenePlate.style.transform=`scale(${Number(working.scenePlate?.scale)||1})`;
      scenePlate.style.transformOrigin='0 0';
    }
    if(areaKicker)areaKicker.textContent='DOWNTOWN / BLOCK 01';
    if(areaName)areaName.textContent='Commerce Street';
    renderSubareaDebug();
  }

  function updatePlayer(){
    const area=currentArea();
    const walk=area.walkable;
    player.style.left=`${state.x}px`;
    player.style.top=`${state.y}px`;
    const depthRange=Math.max(1,walk.height-63);
    const playerDepth=.82+((state.y-(walk.y+18))/depthRange)*.20;
    player.style.transform=`translate(-50%,-100%) scale(${Math.max(.78,Math.min(1.05,playerDepth))})`;
    player.style.zIndex=String(30+Math.round(state.y));
  }

  function clampCamera(value,min,max){
    return Math.max(min,Math.min(max,value));
  }

  function applyCamera(){
    const area=currentArea();
    const viewportWidth=Math.max(1,viewport.clientWidth||1);
    const viewportHeight=Math.max(1,viewport.clientHeight||1);
    const authoredWidth=Math.max(1,Number(area.width)||1);
    const authoredHeight=Math.max(1,Number(area.height)||1);

    let fitScale=1,cameraX=0,cameraY=0;

    if(activeSubarea){
      const camera=area.camera||{};
      const containScale=Math.min(viewportWidth/authoredWidth,viewportHeight/authoredHeight);
      const coverScale=Math.max(viewportWidth/authoredWidth,viewportHeight/authoredHeight);
      const requested=camera.mode==='contain'?containScale:coverScale;
      const minScale=Number(camera.minScale)||.20;
      const maxScale=Number(camera.maxScale)||1.5;
      fitScale=clampCamera(requested,minScale,maxScale);

      const visibleWorldWidth=viewportWidth/fitScale;
      const visibleWorldHeight=viewportHeight/fitScale;
      const anchorX=Number.isFinite(Number(camera.anchorX))?Number(camera.anchorX):.38;
      const anchorY=Number.isFinite(Number(camera.anchorY))?Number(camera.anchorY):.72;

      cameraX=clampCamera(
        state.x-visibleWorldWidth*anchorX,
        0,
        Math.max(0,authoredWidth-visibleWorldWidth)
      );
      cameraY=clampCamera(
        state.y-visibleWorldHeight*anchorY,
        0,
        Math.max(0,authoredHeight-visibleWorldHeight)
      );
    }else{
      const editorBaseFit=Math.min(
        1,
        Math.max(.06,viewportHeight/authoredHeight),
        Math.max(.06,viewportWidth/authoredWidth)
      );
      const baseFitScale=editorWorkspace
        ? editorBaseFit
        : Math.max(.20,Math.min(1,viewportHeight/authoredHeight));
      fitScale=editorWorkspace
        ? Math.max(.06,Math.min(1.8,baseFitScale*editorZoom))
        : baseFitScale;

      const visibleWorldWidth=viewportWidth/fitScale;
      cameraX=Math.max(
        0,
        Math.min(Math.max(0,authoredWidth-visibleWorldWidth),state.x-visibleWorldWidth*.46)
      );
    }

    scene.style.transform=`translate3d(${-cameraX*fitScale}px,${-cameraY*fitScale}px,0) scale(${fitScale})`;
  }

  function enterSubarea(targetId){
    const next=getSubarea(targetId);
    if(!next)return false;
    streetReturnPoint={x:state.x,y:state.y};
    activeSubarea=next;
    state.x=Number(next.spawn?.x)||220;
    state.y=Number(next.spawn?.y)||800;
    state.near=null;
    state.running=false;
    joyX=joyY=0;
    keys.clear();
    knob.style.transform='translate(0,0)';
    applyAreaVisuals();
    updatePlayer();
    applyCamera();
    requestAnimationFrame(applyCamera);
    return true;
  }

  function leaveSubarea(){
    if(!activeSubarea)return false;
    activeSubarea=null;
    const fallback=working.alley&&Number(working.alley.width)>0
      ? {x:Number(working.alley.x)+Number(working.alley.width)/2,y:Number(working.alley.y)+Number(working.alley.height)+35}
      : working.spawn;
    const back=streetReturnPoint||fallback||working.spawn;
    streetReturnPoint=null;
    state.x=Number(back?.x)||working.spawn.x;
    state.y=Number(back?.y)||working.spawn.y;
    state.near=null;
    state.running=false;
    joyX=joyY=0;
    keys.clear();
    knob.style.transform='translate(0,0)';
    applyAreaVisuals();
    updatePlayer();
    applyCamera();
    requestAnimationFrame(applyCamera);
    return true;
  }

  function updatePrompt(){
    state.near=activeSubarea?nearestSubareaInteraction():nearestStreetInteraction();
    if(state.near){
      const action=state.near.kind==='subarea-exit'?'Exit':'Enter';
      prompt.textContent=`${state.near.name} · ${action}`;
      prompt.classList.add('show');
      interact.disabled=false;
      interact.textContent=action.toUpperCase();
    }else{
      prompt.classList.remove('show');
      interact.disabled=true;
      interact.textContent='ENTER';
    }
  }

  function enter(){
    if(!state.near)return;
    if(state.near.kind==='subarea'){
      enterSubarea(state.near.target);
      return;
    }
    if(state.near.kind==='subarea-exit'){
      leaveSubarea();
      return;
    }
    if(state.near.kind==='location'&&validLocationIds.has(state.near.locationId)){
      go(`city/${state.near.locationId}`);
    }
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
    const area=currentArea();
    const walk=area.walkable;
    let nx=state.x+dx*speed*dt, ny=state.y+dy*speed*dt;
    nx=Math.max(45,Math.min(area.width-45,nx));
    ny=Math.max(walk.y+18,Math.min(walk.y+walk.height-45,ny));
    nx=Math.max(walk.x+18,Math.min(walk.x+walk.width-45,nx));

    // Resolve axes separately so storefronts and sub-area props feel solid
    // without producing sticky diagonal corners.
    if(!collidesAt(nx,state.y))state.x=nx;
    if(!collidesAt(state.x,ny))state.y=ny;
    updatePlayer();

    applyCamera();
    updatePrompt();
    raf=requestAnimationFrame(tick);
  }

  function keydown(e){
    const k=e.key.toLowerCase();
    const typing=/input|select|textarea/i.test(e.target?.tagName||'');
    if(!typing&&k==='e'){
      if(editorWorkspace)toggleTopEditor();
      else enter();
      e.preventDefault();return;
    }
    if(editMode){
      if((e.ctrlKey||e.metaKey)&&k==='z'){e.shiftKey?redo():undo();e.preventDefault();return;}
      if((e.ctrlKey||e.metaKey)&&k==='y'){redo();e.preventDefault();return;}
      if(k==='escape'){if(editorCollapsed)setEditMode(false);else toggleEditorPanel();e.preventDefault();return;}
      const item=currentEditable();
      if(item&&!isLocked(item)&&!typing&&['arrowleft','arrowright','arrowup','arrowdown'].includes(k)){
        const before=snapshot(),step=(Number(snapSelect.value)||1)*(e.shiftKey?5:1);
        if(k==='arrowleft')item.o.x=(Number(item.o.x)||0)-step;
        if(k==='arrowright')item.o.x=(Number(item.o.x)||0)+step;
        if(k==='arrowup')item.o.y=(Number(item.o.y)||0)-step;
        if(k==='arrowdown')item.o.y=(Number(item.o.y)||0)+step;
        if(item.type==='building'){item.o.doorX+=k==='arrowleft'?-step:k==='arrowright'?step:0;item.o.doorY=item.o.y+item.o.h;}
        commit(before);renderEditorObjects();syncInspector();e.preventDefault();return;
      }
      if(item&&!isLocked(item)&&!typing&&(k==='delete'||k==='backspace')&&(item.type==='building'||item.type==='prop')){
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
    const item=allEditable().find(x=>x.key===target.dataset.editKey);
    if(!item||isLocked(item))return;
    e.preventDefault();e.stopPropagation();
    select(target.dataset.editKey);
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
  [inputX,inputY,inputW,inputH,inputIdLabel,inputRotation,inputZIndex].filter(Boolean).forEach(el=>el.addEventListener('change',applyInspector));
  [propTarget,propRequires,propLabel,propZIndex].filter(Boolean).forEach(el=>el.addEventListener('change',applyInspector));
  propActive?.addEventListener('change',applyInspector);
  propWidth?.addEventListener('change',applyInspector);
  propHeight?.addEventListener('change',applyInspector);
  let editorZoom=1;
  const setEditorZoom=value=>{editorZoom=Math.max(.55,Math.min(1.8,value));};
  zoomInButton?.addEventListener('click',()=>setEditorZoom(editorZoom+.1));
  zoomOutButton?.addEventListener('click',()=>setEditorZoom(editorZoom-.1));
  fitButton?.addEventListener('click',()=>setEditorZoom(1));
  const toggleView=(button,className)=>{
    button?.addEventListener('click',()=>{
      shell.classList.toggle(className);
      button.classList.toggle('active',shell.classList.contains(className));
    });
  };
  toggleView(viewGridButton,'bw-view-grid');
  toggleView(viewColliderButton,'bw-view-colliders');
  toggleView(viewZonesButton,'bw-view-zones');
  toggleView(viewLabelsButton,'bw-view-labels');
  undoButton.addEventListener('click',undo);redoButton.addEventListener('click',redo);
  exportButton.addEventListener('click',publishDraft);
  localExportButton?.addEventListener('click',downloadWorld);
  revertDraftButton?.addEventListener('click',revertServerDraft);
  historyLoadButton?.addEventListener('click',restoreHistoryToDraft);
  focusButton?.addEventListener('click',focusSelected);
  lockButton?.addEventListener('click',()=>{
    const item=currentEditable();if(!item)return;
    const before=snapshot();
    item.o.locked=!item.o.locked;
    commit(before);renderEditorObjects();syncInspector();
  });
  editorScope.querySelectorAll('[data-bw-nudge]').forEach(button=>button.addEventListener('click',()=>{
    const dir=button.dataset.bwNudge;
    if(dir==='up')nudgeSelected(0,-1);
    if(dir==='down')nudgeSelected(0,1);
    if(dir==='left')nudgeSelected(-1,0);
    if(dir==='right')nudgeSelected(1,0);
  }));
  resetButton.addEventListener('click',()=>{const before=snapshot();working=JSON.parse(JSON.stringify(BLOCK1));commit(before);select('');renderEditorObjects();});
  let propSerial=0;
  addPropButton.addEventListener('click',()=>{
    const before=snapshot();
    const kind=String(propKind.value||'prop').trim()||'prop';
    const sameKind=(working.props||[]).filter(p=>p.kind===kind).length;
    const step=Math.max(10,Number(snapSelect.value)||10);
    const column=sameKind%6,row=Math.floor(sameKind/6);
    const slug=kind.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'prop';
    const id=`prop-${slug}-${Date.now().toString(36)}-${(++propSerial).toString(36)}`;
    working.props.push({id,kind,x:snap(state.x+70+column*step*2),y:snap(state.y+row*step*2),active:true});
    commit(before);renderEditorObjects();select(`prop:${working.props.length-1}`);
  });
  editorScope.querySelectorAll('[data-bw-add-object]').forEach(button=>button.addEventListener('click',()=>{
    const kind=button.dataset.bwAddObject;
    const before=snapshot();
    if(kind==='alley'){
      const width=Math.max(20,Number(working.alley?.width)||200);
      const height=Math.max(20,Number(working.alley?.height)||140);
      const x=snap(Math.max(0,Math.min((working.width||BLOCK1.width)-width,state.x-width/2)));
      const y=snap(Math.max(0,Math.min((working.height||BLOCK1.height)-height,state.y-height/2)));
      working.alley={
        ...(working.alley||{}),
        x,y,width,height,
        target:working.alley?.target||'alley-commerce-01',
        label:working.alley?.label||'Commerce Alley',
        active:working.alley?.active!==false
      };
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
  duplicateButton.addEventListener('click',()=>{const item=currentEditable();if(!item||isLocked(item))return;const before=snapshot(),copy=JSON.parse(JSON.stringify(item.o));copy.x+=40;copy.y+=40;if(item.type==='building'){copy.id=`${copy.id}-copy-${Date.now().toString(36)}`;copy.name+= ' Copy';copy.doorX+=40;copy.doorY+=40;working.buildings.push(copy);commit(before);renderEditorObjects();select(`building:${working.buildings.length-1}`);}else if(item.type==='prop'){const slug=String(copy.kind||'prop').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'prop';copy.id=`prop-${slug}-${Date.now().toString(36)}-${(++propSerial).toString(36)}`;delete copy.locked;working.props.push(copy);commit(before);renderEditorObjects();select(`prop:${working.props.length-1}`);}});
  deleteButton.addEventListener('click',()=>{const item=currentEditable();if(!item||isLocked(item)||item.type==='alley')return;const before=snapshot();if(item.type==='building')working.buildings.splice(item.i,1);else working.props.splice(item.i,1);commit(before);select('');renderEditorObjects();});
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
    const worldWidth=currentArea().width||working.width||BLOCK1.width||1;
    return Math.max(0.0001,(usesRotatedIOSFullscreen()?rect.height:rect.width)/worldWidth);
  }

  function updateShellSize(){
    if(fullscreenMode)return;
    const vv=window.visualViewport;
    const viewportHeight=vv?.height||window.innerHeight;
    if(editorWorkspace){
      shell.style.height=`${Math.max(300,Math.floor(viewportHeight))}px`;
      shell.style.width='100%';
      return;
    }
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
    fullscreenButton.textContent='WINDOW';

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
    requestAnimationFrame(()=>requestAnimationFrame(applyCamera));
  }

  async function exitFullscreen(){
    fullscreenMode=false;
    document.body.classList.remove('bw-fullscreen-mode');
    shell.classList.remove('bw-fullscreen-active','bw-editor-chrome-hidden');
    fullscreenButton.textContent='FULLSCREEN';
    try{screen.orientation?.unlock?.();}catch(_){}
    try{
      if(document.fullscreenElement)await document.exitFullscreen?.();
    }catch(_){}
    requestAnimationFrame(()=>{
      updateShellSize();
      requestAnimationFrame(applyCamera);
    });
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
      requestAnimationFrame(()=>{
        updateShellSize();
        requestAnimationFrame(applyCamera);
      });
    }
  }

  function onViewportChange(){
    if(!fullscreenMode)updateShellSize();
    requestAnimationFrame(applyCamera);
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

  applyAreaVisuals();
  updatePlayer();
  applyCamera();
  if(editorWorkspace)await setEditMode(true);
  raf=requestAnimationFrame(tick);
  cleanup=()=>{
    cancelAnimationFrame(raf);
    clearTimeout(draftTimer);
    clearInterval(draftInterval);
    destroyStudioPanels?.();
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
