import { api } from '../ui/api.js';
import { go } from '../ui/router.js';
import { BLOCK1, BLOCK_EDITOR_SCHEMA_VERSION } from '../block1.js';
import { BLOCK_ASSETS } from '../block-assets.js';
import { getSubarea } from '../subareas.js';
import { SceneManager } from '../scene-manager.js';
import {
  sha256File,
  dataUrlToBlob,
  cacheVerifiedBlob,
  fetchApprovedAssetMetadata,
  verifiedAssetObjectUrl,
  normalizeSha256
} from '../ui/asset-integrity.js';

let cleanup=null;
export function destroyBlockWorld(){ if(cleanup){cleanup();cleanup=null;} }

export async function renderBlockWorld(root, options={}){
  const editorWorkspace=!!options.editorWorkspace;
  destroyBlockWorld();
  const PRIMARY_SUBAREA_ID='alley-commerce-01';
  const [worldData,playerData,publishedBlockData,publishedAlleyData]=await Promise.all([
    api('/api/world'),
    api('/api/player'),
    api(`/api/world/blocks/${encodeURIComponent(BLOCK1.id)}`),
    api(`/api/world/blocks/${encodeURIComponent(PRIMARY_SUBAREA_ID)}`)
  ]);
  const locations=worldData.locations||[];
  const validLocationIds=new Set(locations.map(x=>x.id));

  root.innerHTML=`
    <section class="blockworld-shell${editorWorkspace?' bw-editor-page':''}">
      <div class="blockworld-viewport" id="blockworld-viewport">
        <div class="blockworld-scene" id="blockworld-scene">
          <img class="bw-scene-plate" id="bw-scene-plate" src="/assets/blocks/commerce-street.svg" alt="" draggable="false" decoding="async" fetchpriority="high">
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
          <div class="bw-player" id="bw-player" data-state="idle" data-facing="south" aria-hidden="true">
            <div class="bw-player-shadow"></div>
            <div class="bw-player-rig">
              <div class="bw-player-sprite">
                <div class="bw-player-feet">
                  <span class="bw-player-leg bw-player-leg-left"><i class="bw-player-shoe"></i></span>
                  <span class="bw-player-leg bw-player-leg-right"><i class="bw-player-shoe"></i></span>
                </div>
                <div class="bw-player-body">
                  <span class="bw-player-arm bw-player-arm-left"></span>
                  <span class="bw-player-arm bw-player-arm-right"></span>
                  <span class="bw-player-torso"><i class="bw-player-chain"></i></span>
                  <span class="bw-player-head"><i class="bw-player-neck"></i><i class="bw-player-hair"></i><i class="bw-player-face"></i></span>
                </div>
              </div>
            </div>
          </div>
          <div class="bw-prompt" id="bw-prompt"></div>
          <div class="bw-exit bw-exit-west">← NEXT BLOCK</div>
          <div class="bw-exit bw-exit-east">NEXT BLOCK →</div>
        </div>
        <div class="blockworld-subarea-scene" id="blockworld-subarea-scene" aria-hidden="true">
          <div class="bw-subarea-stage" id="bw-subarea-stage">
            <img class="bw-subarea-plate" id="bw-subarea-plate" alt="" draggable="false" decoding="async" aria-hidden="true">
            <div class="bw-subarea-world" id="bw-subarea-world">
              <div class="bw-subarea-debug" id="bw-subarea-debug" aria-hidden="true"></div>
            </div>
          </div>
        </div>
        <div class="bw-scene-transition" id="bw-scene-transition" aria-hidden="true">
          <span id="bw-scene-transition-label">LOADING AREA…</span>
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
        <button id="bw-editor-shape-toggle"></button><button id="bw-editor-add-point"></button><button id="bw-editor-delete-point"></button><button id="bw-editor-duplicate"></button><button id="bw-editor-delete"></button>
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
  const subareaScene=root.querySelector('#blockworld-subarea-scene');
  const subareaStage=root.querySelector('#bw-subarea-stage');
  const subareaWorld=root.querySelector('#bw-subarea-world');
  const sceneTransition=root.querySelector('#bw-scene-transition');
  const sceneTransitionLabel=root.querySelector('#bw-scene-transition-label');
  const buildings=scene.querySelector('.bw-buildings');
  const props=scene.querySelector('.bw-props');
  const scenePlate=scene.querySelector('#bw-scene-plate');
  const subareaPlate=subareaScene.querySelector('#bw-subarea-plate');
  const subareaDebug=subareaScene.querySelector('#bw-subarea-debug');
  const player=scene.querySelector('#bw-player');
  const prompt=scene.querySelector('#bw-prompt');
  const areaKicker=root.querySelector('#bw-area-kicker');
  const areaName=root.querySelector('#bw-area-name');
  const interact=root.querySelector('#bw-interact');
  const run=root.querySelector('#bw-run');
  const fullscreenButton=root.querySelector('#bw-fullscreen')||editorQuery('#bw-fullscreen');
  const shell=root.querySelector('.blockworld-shell');
  const stick=root.querySelector('#bw-stick');
  const knob=root.querySelector('#bw-knob');

  // Room art is presentation-only. The primary alley scene is source-controlled
  // as text, and this error fallback never participates in gameplay ownership.
  subareaPlate?.addEventListener('load',()=>{
    shell.classList.remove('bw-subarea-asset-error');
  });
  subareaPlate?.addEventListener('error',()=>{
    const fallback=String(subareaPlate.dataset.fallbackSrc||'');
    const fallbackHref=fallback?new URL(fallback,location.href).href:'';
    const attempted=subareaPlate.dataset.fallbackAttempted==='1';
    if(fallback&&!attempted&&subareaPlate.src!==fallbackHref){
      subareaPlate.dataset.fallbackAttempted='1';
      subareaPlate.src=fallback;
      return;
    }
    shell.classList.add('bw-subarea-asset-error');
  });

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
  const shapeToggleButton=editorQuery('#bw-editor-shape-toggle'),addPointButton=editorQuery('#bw-editor-add-point'),deletePointButton=editorQuery('#bw-editor-delete-point');
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
  const editorContextLabel=editorQuery('#bw-editor-context');
  const editorParentSceneButton=editorQuery('#bw-editor-parent-scene');
  const editorSubareaButtons=[...editorScope.querySelectorAll('[data-bw-open-subarea]')];
  const configCameraZoom=editorQuery('#bw-config-camera-zoom');
  const configPlayerScale=editorQuery('#bw-config-player-scale');
  const configLookAhead=editorQuery('#bw-config-lookahead');
  const configInteractionRadius=editorQuery('#bw-config-interaction-radius');
  const configWalkSpeed=editorQuery('#bw-config-walk-speed');
  const configRunSpeed=editorQuery('#bw-config-run-speed');
  const configDepthMin=editorQuery('#bw-config-depth-min');
  const configDepthMax=editorQuery('#bw-config-depth-max');
  const configIntegrityStatus=editorQuery('#bw-config-integrity-status');

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

  // Verified Asset Lab runtime library. Image bytes can be cached locally, but the
  // published layout trusts only server-approved assetId + SHA-256 pairs.
  const ASSET_CACHE_KEY='riftcity:block-assets:v4';
  const importedAssets=new Map();
  const sourceAssetIds=new Set();
  const pendingAssetLoads=new Map();
  const assetObjectUrls=new Set();

  function normalizeAsset(raw,preview={}){
    if(!raw||typeof raw!=='object')return null;
    const assetId=String(raw.assetId||raw.id||raw.slug||raw.name||'').trim();
    const internalId=String(raw.id||assetId).trim();
    const sha256=normalizeSha256(raw.sha256||raw.assetHash);
    let src=String(raw.src||raw.dataUrl||raw.image||raw.imageData||raw.data||'').trim();
    const mime=String(raw.mimeType||raw.mime||'image/png').trim()||'image/png';
    if(src&&!src.startsWith('data:image/')&&!src.startsWith('blob:')&&/^[A-Za-z0-9+/=\s]+$/.test(src)){
      src=`data:${mime};base64,${src.replace(/\s+/g,'')}`;
    }
    if(!assetId||(!src&&!sha256))return null;
    return {
      ...raw,
      id:internalId,
      assetId,
      sha256,
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
      if(asset?.sha256)importedAssets.set(asset.assetId,asset);
    }
  }catch(_){}

  function persistImportedAssets(){
    try{
      const cached=[...importedAssets.values()]
        .filter(a=>!sourceAssetIds.has(a.assetId)&&a.sha256)
        .map(a=>{
          const {
            src,dataUrl,image,imageData,data,preview,...metadata
          }=a;
          return {...metadata,preview:a.preview||{}};
        });
      localStorage.setItem(ASSET_CACHE_KEY,JSON.stringify(cached));
    }catch(err){
      console.warn('RiftCity verified asset metadata could not be saved',err);
      if(assetStatus)assetStatus.textContent='Asset verified, but local metadata storage is full.';
    }
  }

  function assetRefMatches(asset,assetId,hash){
    return !!asset&&asset.assetId===assetId&&normalizeSha256(asset.sha256)===normalizeSha256(hash);
  }

  async function ensureVerifiedAssetForRef(assetId,hash){
    const normalizedHash=normalizeSha256(hash);
    if(!assetId||!normalizedHash)return null;
    const existing=importedAssets.get(assetId);
    if(assetRefMatches(existing,assetId,normalizedHash)&&existing.src)return existing;
    const key=`${assetId}:${normalizedHash}`;
    if(pendingAssetLoads.has(key))return pendingAssetLoads.get(key);

    const pending=(async()=>{
      const [assetMeta,url]=await Promise.all([
        fetchApprovedAssetMetadata(assetId,normalizedHash),
        verifiedAssetObjectUrl(assetId,normalizedHash)
      ]);
      assetObjectUrls.add(url);
      const metadata=assetMeta.metadata||{};
      const asset=normalizeAsset({
        ...metadata,
        id:assetId,
        assetId,
        sha256:normalizedHash,
        mimeType:assetMeta.mimeType,
        src:url
      },metadata.preview||{});
      if(!asset)throw new Error(`Approved asset ${assetId} could not be normalized`);
      importedAssets.set(assetId,asset);
      persistImportedAssets();
      populateAssetSelect();
      return asset;
    })();
    pendingAssetLoads.set(key,pending);
    try{return await pending;}
    finally{pendingAssetLoads.delete(key);}
  }

  function warmLayoutAssets(layout){
    for(const holder of [...(layout?.buildings||[]),...(layout?.props||[])]) {
      const assetId=String(holder?.assetId||'').trim();
      const hash=normalizeSha256(holder?.assetHash);
      if(assetId&&hash){
        ensureVerifiedAssetForRef(assetId,hash)
          .then(()=>renderEditorObjects())
          .catch(err=>console.warn(`Verified asset ${assetId} could not be loaded`,err));
      }
    }
  }

  // Published server layout is authoritative in Play Mode. Source layouts remain
  // deterministic fallbacks for both the street and editable room scenes.
  const cloneBlock=value=>JSON.parse(JSON.stringify(value));
  const DEFAULT_RUNTIME_CONFIG=Object.freeze({
    schemaVersion:1,
    camera:Object.freeze({mode:'follow',playScale:.60,minScale:.20,maxScale:1.5,anchorX:.46,anchorY:.76,lookAhead:100,vertical:'follow',positionEase:.17,zoomEase:.13}),
    player:Object.freeze({baseScale:1,editorScale:1,depthMin:.78,depthMax:1.05}),
    movement:Object.freeze({walkSpeed:235,runSpeed:390,maxStep:7}),
    interaction:Object.freeze({radius:100,roomExitRadius:105})
  });

  function sourceSceneDocument(id){
    return String(id||'')===BLOCK1.id?BLOCK1:getSubarea(id);
  }

  function runtimeConfigFor(area=currentArea()){
    const authored=sourceSceneDocument(area?.id)||{};
    const authoredRuntime=authored.runtimeConfig||{};
    const runtime=area?.runtimeConfig||{};
    return {
      schemaVersion:Number(runtime.schemaVersion||authoredRuntime.schemaVersion||DEFAULT_RUNTIME_CONFIG.schemaVersion),
      camera:{...DEFAULT_RUNTIME_CONFIG.camera,...(authored.camera||{}),...(area?.camera||{}),...(authoredRuntime.camera||{}),...(runtime.camera||{})},
      player:{...DEFAULT_RUNTIME_CONFIG.player,...(authored.character||{}),...(area?.character||{}),...(authoredRuntime.player||{}),...(runtime.player||{})},
      movement:{...DEFAULT_RUNTIME_CONFIG.movement,...(authoredRuntime.movement||{}),...(runtime.movement||{})},
      interaction:{...DEFAULT_RUNTIME_CONFIG.interaction,...(authoredRuntime.interaction||{}),...(runtime.interaction||{})}
    };
  }

  function ensureWorkingRuntimeConfig(){
    const resolved=runtimeConfigFor(working);
    working.runtimeConfig={
      schemaVersion:1,
      camera:{...resolved.camera},
      player:{...resolved.player},
      movement:{...resolved.movement},
      interaction:{...resolved.interaction}
    };
    // Keep compatibility aliases in exported layouts during the migration.
    working.camera={...resolved.camera};
    working.character={...resolved.player};
    return working.runtimeConfig;
  }

  const normalizeSubareaLayout=(value,id=PRIMARY_SUBAREA_ID)=>{
    const authored=getSubarea(id);
    if(!authored)return null;
    const raw=cloneBlock(value||authored);
    const base=cloneBlock(authored);
    const next={...base,...raw};
    next.id=String(raw.id||base.id);
    next.kind='subarea';
    next.parentBlock=String(raw.parentBlock||base.parentBlock||BLOCK1.id);
    next.width=Number(raw.width)||base.width;
    next.height=Number(raw.height)||base.height;
    next.scenePlate={...base.scenePlate,...(raw.scenePlate||{})};
    next.spawn={...base.spawn,...(raw.spawn||{})};
    next.walkable={...base.walkable,...(raw.walkable||{})};
    next.exit={...base.exit,...(raw.exit||{})};
    next.camera={...base.camera,...(raw.camera||{})};
    next.character={...base.character,...(raw.character||{})};
    next.runtimeConfig={
      ...(base.runtimeConfig||{}),
      ...(raw.runtimeConfig||{}),
      camera:{...(base.runtimeConfig?.camera||{}),...(raw.runtimeConfig?.camera||{})},
      player:{...(base.runtimeConfig?.player||{}),...(raw.runtimeConfig?.player||{})},
      movement:{...(base.runtimeConfig?.movement||{}),...(raw.runtimeConfig?.movement||{})},
      interaction:{...(base.runtimeConfig?.interaction||{}),...(raw.runtimeConfig?.interaction||{})}
    };
    next.buildings=Array.isArray(raw.buildings)?raw.buildings:[];
    next.props=Array.isArray(raw.props)?raw.props:[];
    next.obstacles=Array.isArray(raw.obstacles)?raw.obstacles:cloneBlock(base.obstacles||[]);
    next.interactions=Array.isArray(raw.interactions)?raw.interactions:cloneBlock(base.interactions||[]);
    return next;
  };

  let publishedWorking=cloneBlock(publishedBlockData?.block||BLOCK1);
  const publishedSubareas=new Map();
  const publishedAlley=normalizeSubareaLayout(publishedAlleyData?.block,PRIMARY_SUBAREA_ID);
  if(publishedAlley)publishedSubareas.set(PRIMARY_SUBAREA_ID,publishedAlley);
  const resolveSubarea=id=>publishedSubareas.get(String(id||''))||getSubarea(id);

  let editMode=false, editorCollapsed=false, selectedKey='', selectedVertexIndex=-1, addPointMode=false, drag=null;
  let working=cloneBlock(publishedWorking);
  let editorSceneId=BLOCK1.id;
  let editorStreetReturn=null;
  const sceneManager=new SceneManager(resolveSubarea);
  let activeSubarea=null;
  let sceneTransitionBusy=false;
  let sceneFailureTimer=0;
  let undoStack=[],redoStack=[];
  const localEditorDrafts=new Map();
  let draftDirty=false,draftSaving=false,draftTimer=null,draftInterval=null;
  let draftRevision=0,publishedRevision=Number(publishedBlockData?.revision||0);
  const publishedIntegrityByScene=new Map([
    [BLOCK1.id,publishedBlockData?.integrity||null],
    [PRIMARY_SUBAREA_ID,publishedAlleyData?.integrity||null]
  ]);

  const editingSubarea=()=>editorSceneId!==BLOCK1.id;
  const editorDocumentId=()=>editorSceneId||BLOCK1.id;
  const authoredEditorDocument=()=>editingSubarea()
    ? normalizeSubareaLayout(getSubarea(editorSceneId),editorSceneId)
    : cloneBlock(BLOCK1);
  const publishedEditorDocument=()=>editingSubarea()
    ? cloneBlock(publishedSubareas.get(editorSceneId)||normalizeSubareaLayout(getSubarea(editorSceneId),editorSceneId))
    : cloneBlock(publishedWorking);

  function setWorkingEditorDocument(value){
    working=editingSubarea()
      ? normalizeSubareaLayout(value||authoredEditorDocument(),editorSceneId)
      : cloneBlock(value||publishedWorking||BLOCK1);
    if(editingSubarea()){
      activeSubarea=working;
      if(sceneManager.active)sceneManager.active.scene=activeSubarea;
      else sceneManager.enter(editorSceneId,editorStreetReturn);
      applyAreaVisuals();
      updatePlayer();
      applyCamera();
    }
  }

  function syncEditorSceneContext(){
    const room=editingSubarea();
    shell.classList.toggle('bw-editor-room-context',room);
    if(editorContextLabel){
      editorContextLabel.textContent=room
        ? `${working.kicker||'DOWNTOWN / BLOCK 01'}  •  ${working.name||'Commerce Alley'}`
        : 'DOWNTOWN / BLOCK 01  •  Commerce Street';
    }
    if(editorParentSceneButton)editorParentSceneButton.hidden=!room;
  }

  // Room artwork is intentionally not allowed to gate gameplay scene entry.
  // The active room <img> loads independently after scene ownership switches.

  function setServerStatus(text,state=''){
    if(!serverStatus)return;
    serverStatus.textContent=text;
    serverStatus.dataset.state=state;
  }

  function markDraftDirty(){
    if(!editMode)return;
    draftDirty=true;
    localEditorDrafts.set(editorDocumentId(),cloneBlock(working));
    setServerStatus('DRAFT · unsaved','dirty');
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>saveDraftToServer(),1200);
  }

  async function saveDraftToServer({force=false}={}){
    if(!editMode||draftSaving||(!draftDirty&&!force))return true;
    // Materialize the resolved per-scene runtime config into every saved draft so
    // legacy D1 layouts migrate to the versioned config envelope on next publish.
    ensureWorkingRuntimeConfig();
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
    localEditorDrafts.delete(editorDocumentId());
    setServerStatus(`DRAFT · saved r${draftRevision}`,'saved');
    return true;
  }

  async function loadDraftForEditor(){
    const id=editorDocumentId();
    const authored=authoredEditorDocument();
    const publishedFallback=publishedEditorDocument();
    setServerStatus(`SERVER · loading ${editingSubarea()?'room':'block'} draft…`,'saving');
    const result=await api(`/api/admin/blocks/${encodeURIComponent(id)}/editor`);
    const localDraft=localEditorDrafts.get(id);
    if(!result.ok){
      // Local Frontend Test intentionally blocks authoritative mutations. Keep a
      // per-scene in-memory draft so street ↔ alley authoring still works safely.
      setWorkingEditorDocument(localDraft||publishedFallback||authored);
      draftRevision=0;
      undoStack=[];redoStack=[];draftDirty=!!localDraft;
      renderEditorObjects();syncInspector();syncEditorSceneContext();
      setServerStatus(localDraft?'LOCAL · unsaved scene draft':(result.status===403?'SERVER · admin role required':`LOCAL · ${result.error||'fallback scene'}`),localDraft?'dirty':'error');
      return false;
    }
    draftRevision=Number(result.draftRevision||0);
    publishedRevision=Number(result.publishedRevision||0);
    if(result.integrity)publishedIntegrityByScene.set(id,result.integrity);
    const next=localDraft||result.draft||result.published||publishedFallback||authored;
    setWorkingEditorDocument(next);
    undoStack=[];redoStack=[];draftDirty=!!localDraft;
    renderEditorObjects();syncInspector();syncEditorSceneContext();
    setServerStatus(localDraft?'LOCAL · unsaved scene draft':`DRAFT · r${draftRevision} · LIVE r${publishedRevision}`,localDraft?'dirty':'saved');
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

    props.querySelectorAll('.bw-prop-authored').forEach(el=>el.remove());

    if(!preservePlayer&&working.spawn){
      state.x=Number(working.spawn.x)||state.x;
      state.y=Number(working.spawn.y)||state.y;
    }
    if(working.walkable)ensurePlayerInCurrentArea();

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

    const result=await api(`/api/admin/blocks/${encodeURIComponent(working.id)}/publish`,{method:'POST'});
    if(!result.ok||!result.block){
      setServerStatus(`PUBLISH · ${result.error||'failed'}`,'error');
      return;
    }

    publishedRevision=Number(result.publishedRevision||publishedRevision+1);
    draftRevision=Math.max(draftRevision,publishedRevision);
    draftDirty=false;
    if(result.integrity)publishedIntegrityByScene.set(editorDocumentId(),result.integrity);

    if(editingSubarea()){
      const publishedRoom=normalizeSubareaLayout(result.block,editorSceneId);
      publishedSubareas.set(editorSceneId,cloneBlock(publishedRoom));
      setWorkingEditorDocument(publishedRoom);
      renderEditorObjects();
      updatePlayer();
      applyCamera();
    }else{
      publishedWorking=cloneBlock(result.block);
      hydrateBlock(publishedWorking,{preservePlayer:true});
    }

    syncInspector();
    await loadVersionHistory();
    const integrity=result.integrity;
    setServerStatus(`LIVE · r${publishedRevision}${integrity?.verified?(String(integrity.algorithm||'').startsWith('hmac')?' · SIGNED':' · SHA256'):''}`,'published');
    syncSceneConfigControls();
  }

  async function revertServerDraft(){
    const id=editorDocumentId();
    setServerStatus('DRAFT · reverting…','saving');
    const result=await api(`/api/admin/blocks/${encodeURIComponent(id)}/revert-draft`,{method:'POST'});
    if(!result.ok){
      setServerStatus(`REVERT · ${result.error||'failed'}`,'error');
      return;
    }
    localEditorDrafts.delete(id);
    if(result.integrity)publishedIntegrityByScene.set(id,result.integrity);
    setWorkingEditorDocument(result.block||publishedEditorDocument()||authoredEditorDocument());
    draftDirty=false;undoStack=[];redoStack=[];
    renderEditorObjects();syncInspector();syncEditorSceneContext();
    setServerStatus(`DRAFT · reverted to ${result.revertedTo}`,'saved');
  }

  async function loadVersionHistory(){
    if(!historySelect)return;
    const id=editorDocumentId();
    const result=await api(`/api/admin/blocks/${encodeURIComponent(id)}/history`);
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
    const id=editorDocumentId();
    setServerStatus(`RESTORE · r${revision}…`,'saving');
    const result=await api(`/api/admin/blocks/${encodeURIComponent(id)}/restore-revision`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({revision})
    });
    if(!result.ok||!result.block){
      setServerStatus(`RESTORE · ${result.error||'failed'}`,'error');
      return;
    }
    localEditorDrafts.delete(id);
    if(result.integrity)publishedIntegrityByScene.set(id,result.integrity);
    setWorkingEditorDocument(result.block);
    draftRevision=Number(result.draftRevision||draftRevision);
    draftDirty=false;undoStack=[];redoStack=[];selectedKey='';
    renderEditorObjects();populateObjectSelect();syncInspector();syncEditorSceneContext();
    setServerStatus(`DRAFT · restored from live r${revision}`,'saved');
  }

  // Drag-end/change schedules a fast save; this interval is a second safety net.
  draftInterval=setInterval(()=>{ if(editMode&&draftDirty)saveDraftToServer(); },5000);

  function allEditable(){
    if(editingSubarea()){
      const items=[
        ...(working.obstacles||[]).map((o,i)=>({key:`obstacle:${i}`,type:'obstacle',i,o,label:o.label||o.id||`Collision ${i+1}`})),
        ...(working.props||[]).map((o,i)=>({key:`prop:${i}`,type:'prop',i,o,label:o.label||o.kind||`Prop ${i+1}`})),
        {key:'spawn:0',type:'spawn',i:0,o:working.spawn,label:'Player spawn'},
        {key:'walkable:0',type:'walkable',i:0,o:working.walkable,label:'Walkable area'},
        {key:'scene:0',type:'scene',i:0,o:working.scenePlate,label:'Scene plate'}
      ];
      if(working.exit)items.splice(2,0,{key:'room-exit:0',type:'room-exit',i:0,o:working.exit,label:working.exit.label||'Street exit'});
      return items.filter(item=>item.o);
    }
    return [
      ...(working.buildings||[]).map((o,i)=>({key:`building:${i}`,type:'building',i,o,label:o.name})),
      ...(working.props||[]).map((o,i)=>({key:`prop:${i}`,type:'prop',i,o,label:`${o.kind} ${i+1}`})),
      ...((working.exits||[]).map((o,i)=>({key:`exit:${i}`,type:'exit',i,o,label:`${o.id.toUpperCase()} block exit`}))),
      {key:'spawn:0',type:'spawn',i:0,o:working.spawn,label:'Player spawn'},
      {key:'walkable:0',type:'walkable',i:0,o:working.walkable||(working.walkable={x:0,y:990,width:working.width,height:working.height-990}),label:'Walkable area'},
      {key:'scene:0',type:'scene',i:0,o:working.scenePlate||(working.scenePlate={src:'/assets/blocks/commerce-street.svg',x:0,y:0,width:working.width,height:working.height,scale:1}),label:'Scene plate'},
      {key:'alley:0',type:'alley',i:0,o:working.alley,label:'Alley'}
    ].filter(item=>item.o);
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
  const SHAPE_EDIT_TYPES=new Set(['walkable','obstacle','exit','room-exit']);
  const PLAYER_RADIUS=18;
  const PLAYER_SKIN=1.5;
  const isPolygonGeometry=o=>Array.isArray(o?.points)&&o.points.length>=3;
  const canShapeEditItem=item=>!!item&&SHAPE_EDIT_TYPES.has(item.type);
  function geometryBounds(o){
    if(isPolygonGeometry(o)){
      const xs=o.points.map(p=>Number(p?.x)||0), ys=o.points.map(p=>Number(p?.y)||0);
      const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
      return {x:minX,y:minY,width:Math.max(0,maxX-minX),height:Math.max(0,maxY-minY)};
    }
    return {x:Number(o?.x)||0,y:Number(o?.y)||0,width:Math.max(0,Number(o?.w??o?.width)||0),height:Math.max(0,Number(o?.h??o?.height)||0)};
  }
  function syncPolygonBounds(o){
    if(!isPolygonGeometry(o))return;
    const b=geometryBounds(o);
    o.x=snap(b.x); o.y=snap(b.y);
    if('w' in o)o.w=Math.max(20,snap(b.width)); else o.width=Math.max(20,snap(b.width));
    if('h' in o)o.h=Math.max(20,snap(b.height)); else o.height=Math.max(20,snap(b.height));
    o.kind='poly';
  }
  function createRectPolygon(o){
    const b=geometryBounds(o);
    o.points=[
      {x:snap(b.x),y:snap(b.y)},
      {x:snap(b.x+b.width),y:snap(b.y)},
      {x:snap(b.x+b.width),y:snap(b.y+b.height)},
      {x:snap(b.x),y:snap(b.y+b.height)}
    ];
    o.kind='poly';
    syncPolygonBounds(o);
  }
  function stripPolygon(o){
    if(!isPolygonGeometry(o))return;
    const b=geometryBounds(o);
    delete o.points; delete o.kind;
    o.x=snap(b.x); o.y=snap(b.y);
    if('w' in o)o.w=Math.max(20,snap(b.width)); else o.width=Math.max(20,snap(b.width));
    if('h' in o)o.h=Math.max(20,snap(b.height)); else o.height=Math.max(20,snap(b.height));
  }
  function translateGeometry(o,dx,dy){
    if(isPolygonGeometry(o)){
      o.points=o.points.map(p=>({x:snap((Number(p?.x)||0)+dx),y:snap((Number(p?.y)||0)+dy)}));
      syncPolygonBounds(o);
      return;
    }
    o.x=snap((Number(o.x)||0)+dx); o.y=snap((Number(o.y)||0)+dy);
  }
  function scaleGeometryToBounds(o,nextBounds,sourceBounds=null){
    if(isPolygonGeometry(o)){
      const before=sourceBounds||geometryBounds(o);
      const sx=(Number(nextBounds.width)||0)/Math.max(1,Number(before.width)||1);
      const sy=(Number(nextBounds.height)||0)/Math.max(1,Number(before.height)||1);
      o.points=(o.points||[]).map(p=>({
        x:snap((Number(nextBounds.x)||0)+((Number(p?.x)||0)-before.x)*sx),
        y:snap((Number(nextBounds.y)||0)+((Number(p?.y)||0)-before.y)*sy)
      }));
      syncPolygonBounds(o);
      return;
    }
    o.x=snap(nextBounds.x); o.y=snap(nextBounds.y);
    const wk='w' in o?'w':'width', hk='h' in o?'h':'height';
    o[wk]=Math.max(20,snap(nextBounds.width)); o[hk]=Math.max(20,snap(nextBounds.height));
  }
  function polygonPathWithinBounds(o){
    if(!isPolygonGeometry(o))return '';
    const b=geometryBounds(o), w=Math.max(1,b.width), h=Math.max(1,b.height);
    return o.points.map(p=>`${(((Number(p?.x)||0)-b.x)/w*100).toFixed(2)}% ${(((Number(p?.y)||0)-b.y)/h*100).toFixed(2)}%`).join(',');
  }
  function polygonSvgPoints(o){
    if(!isPolygonGeometry(o))return '';
    const b=geometryBounds(o);
    return o.points.map(p=>`${(Number(p?.x)||0)-b.x},${(Number(p?.y)||0)-b.y}`).join(' ');
  }
  function editorVertexPoints(o){
    if(isPolygonGeometry(o))return o.points;
    const b=geometryBounds(o);
    return [
      {x:b.x,y:b.y},
      {x:b.x+b.width,y:b.y},
      {x:b.x+b.width,y:b.y+b.height},
      {x:b.x,y:b.y+b.height}
    ];
  }
  function restoreObjectSnapshot(target,source){
    for(const key of Object.keys(target))delete target[key];
    Object.assign(target,cloneBlock(source));
  }
  function pointInPolygon(x,y,points){
    if(!Array.isArray(points)||points.length<3)return false;
    for(let i=0;i<points.length;i++){
      const a=points[i], b=points[(i+1)%points.length];
      if(closestPointOnSegment(x,y,Number(a?.x)||0,Number(a?.y)||0,Number(b?.x)||0,Number(b?.y)||0).d<=1)return true;
    }
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const xi=Number(points[i]?.x)||0, yi=Number(points[i]?.y)||0;
      const xj=Number(points[j]?.x)||0, yj=Number(points[j]?.y)||0;
      const intersects=((yi>y)!==(yj>y)) && (x < ((xj-xi)*(y-yi))/((yj-yi)||1e-9)+xi);
      if(intersects)inside=!inside;
    }
    return inside;
  }
  function closestPointOnSegment(px,py,ax,ay,bx,by){
    const abx=bx-ax, aby=by-ay, lensq=abx*abx+aby*aby;
    if(!lensq)return {x:ax,y:ay,d:Math.hypot(px-ax,py-ay),t:0};
    const t=Math.max(0,Math.min(1,((px-ax)*abx+(py-ay)*aby)/lensq));
    const x=ax+abx*t, y=ay+aby*t;
    return {x,y,d:Math.hypot(px-x,py-y),t};
  }
  function geometrySegments(o){
    if(!o)return [];
    if(isPolygonGeometry(o)){
      return o.points.map((point,index)=>{
        const next=o.points[(index+1)%o.points.length];
        return {
          ax:Number(point?.x)||0,
          ay:Number(point?.y)||0,
          bx:Number(next?.x)||0,
          by:Number(next?.y)||0,
          index
        };
      });
    }
    const b=geometryBounds(o);
    return [
      {ax:b.x,ay:b.y,bx:b.x+b.width,by:b.y,index:0},
      {ax:b.x+b.width,ay:b.y,bx:b.x+b.width,by:b.y+b.height,index:1},
      {ax:b.x+b.width,ay:b.y+b.height,bx:b.x,by:b.y+b.height,index:2},
      {ax:b.x,ay:b.y+b.height,bx:b.x,by:b.y,index:3}
    ];
  }
  function nearestGeometryBoundary(x,y,o){
    let best=null;
    for(const segment of geometrySegments(o)){
      const hit=closestPointOnSegment(x,y,segment.ax,segment.ay,segment.bx,segment.by);
      if(!best||hit.d<best.d){
        const dx=segment.bx-segment.ax,dy=segment.by-segment.ay,len=Math.hypot(dx,dy)||1;
        best={...hit,...segment,tx:dx/len,ty:dy/len};
      }
    }
    return best;
  }
  function pointInsideGeometry(x,y,o){
    if(isPolygonGeometry(o))return pointInPolygon(x,y,o.points);
    const b=geometryBounds(o);
    return x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height;
  }
  function distanceToGeometry(x,y,o){
    if(!o)return Infinity;
    if(pointInsideGeometry(x,y,o))return 0;
    return nearestGeometryBoundary(x,y,o)?.d??Infinity;
  }
  function circleInsideGeometry(x,y,radius,o){
    if(!o)return false;
    const r=Math.max(0,Number(radius)||0);
    if(isPolygonGeometry(o)){
      if(!pointInPolygon(x,y,o.points))return false;
      const edge=nearestGeometryBoundary(x,y,o);
      return !!edge&&edge.d>=Math.max(0,r-PLAYER_SKIN);
    }
    const b=geometryBounds(o);
    return x>=b.x+r&&x<=b.x+b.width-r&&y>=b.y+r&&y<=b.y+b.height-r;
  }
  function circleIntersectsGeometry(x,y,radius,o){
    if(!o)return false;
    const r=Math.max(0,Number(radius)||0);
    if(pointInsideGeometry(x,y,o))return true;
    return (nearestGeometryBoundary(x,y,o)?.d??Infinity)<r;
  }
  function setAddPointMode(active,{announce=true}={}){
    const item=currentEditable();
    addPointMode=!!active&&!!item&&canShapeEditItem(item)&&!isLocked(item);
    shell.classList.toggle('bw-add-point-mode',addPointMode);
    if(addPointButton){
      addPointButton.classList.toggle('active',addPointMode);
      addPointButton.setAttribute('aria-pressed',String(addPointMode));
      addPointButton.textContent=addPointMode?'TAP SHAPE…':'ADD POINT';
    }
    if(addPointMode&&announce&&editorSelection){
      editorSelection.textContent='ADD POINT · tap an edge or anywhere inside the selected shape, then drag';
    }
  }
  function updateShapeButtons(){
    const item=currentEditable();
    const shapeable=canShapeEditItem(item)&&!isLocked(item);
    const polygon=shapeable&&isPolygonGeometry(item.o);
    if(!shapeable&&addPointMode)setAddPointMode(false,{announce:false});
    if(shapeToggleButton){
      shapeToggleButton.disabled=!shapeable;
      shapeToggleButton.textContent=polygon?'MAKE BOX':'TO SHAPE';
    }
    if(addPointButton){
      addPointButton.disabled=!shapeable||(polygon&&(item.o.points||[]).length>=64);
      addPointButton.classList.toggle('active',addPointMode&&shapeable);
      addPointButton.setAttribute('aria-pressed',String(addPointMode&&shapeable));
      addPointButton.textContent=addPointMode&&shapeable?'TAP SHAPE…':'ADD POINT';
    }
    if(deletePointButton)deletePointButton.disabled=!polygon||(item.o.points||[]).length<=3||selectedVertexIndex<0;
  }
  function screenPointCenter(element){
    const rect=element.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  }
  function insertionOnNearestScreenEdge(target,item,clientX,clientY){
    const worldPoints=editorVertexPoints(item.o);
    if(worldPoints.length<3||worldPoints.length>=64)return null;
    const handles=[...target.querySelectorAll('[data-vertex-index]')]
      .sort((a,b)=>Number(a.dataset.vertexIndex||0)-Number(b.dataset.vertexIndex||0));
    if(handles.length!==worldPoints.length)return null;
    const screenPoints=handles.map(screenPointCenter);
    let best=null;
    for(let i=0;i<screenPoints.length;i++){
      const a=screenPoints[i], b=screenPoints[(i+1)%screenPoints.length];
      const hit=closestPointOnSegment(clientX,clientY,a.x,a.y,b.x,b.y);
      if(!best||hit.d<best.d)best={...hit,edgeIndex:i};
    }
    if(!best)return null;
    const a=worldPoints[best.edgeIndex], b=worldPoints[(best.edgeIndex+1)%worldPoints.length];
    const t=Math.max(.001,Math.min(.999,Number(best.t)||0));
    return {
      insertIndex:best.edgeIndex+1,
      point:{
        x:snap((Number(a?.x)||0)+((Number(b?.x)||0)-(Number(a?.x)||0))*t),
        y:snap((Number(a?.y)||0)+((Number(b?.y)||0)-(Number(a?.y)||0))*t)
      }
    };
  }
  function nudgeSelected(dx,dy){
    const item=currentEditable();if(!item||isLocked(item))return;
    const before=snapshot(),step=Number(snapSelect.value)||1;
    translateGeometry(item.o,dx*step,dy*step);
    if(item.type==='building'){
      item.o.doorX=(Number(item.o.doorX)||0)+dx*step;
      item.o.doorY=item.o.y+item.o.h;
    }
    commit(before);renderEditorObjects();syncInspector();
  }
  function focusSelected(){
    const item=currentEditable();if(!item)return;
    const b=geometryBounds(item.o||{});
    state.x=Math.max(0,Math.min(working.width||BLOCK1.width,b.x+b.width/2));
  }
  function populateObjectSelect(){
    const current=selectedKey;
    objectSelect.innerHTML='<option value="">Choose object…</option>'+allEditable().map(x=>`<option value="${x.key}">${x.type.toUpperCase()} · ${x.label}${isLocked(x)?' · LOCKED':''}</option>`).join('');
    if(allEditable().some(x=>x.key===current))objectSelect.value=current;
  }
  function populateAssetSelect(){
    const current=assetSelect.value;
    const verified=[...importedAssets.values()].filter(a=>normalizeSha256(a.sha256));
    assetSelect.innerHTML='<option value="">No asset</option>'+verified.map(a=>`<option value="${escapeAttr(a.assetId)}">${escapeText(a.name||a.assetId)}</option>`).join('');
    if(verified.some(a=>a.assetId===current))assetSelect.value=current;
  }
  function escapeText(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function escapeAttr(v){return escapeText(v).replace(/'/g,'&#39;');}
  function syncAssetInspector(){
    const item=currentEditable(); const b=item?.type==='building'?item.o:null;
    assetSelect.disabled=!b;assetApply.disabled=!b;assetClear.disabled=!b;
    const asset=b?.assetId?importedAssets.get(b.assetId):null;
    assetSelect.value=b&&assetRefMatches(asset,b.assetId,b.assetHash)?b.assetId:'';
  }

  async function registerImportedAsset(imported){
    const blob=await dataUrlToBlob(imported.src);
    if(!['image/png','image/jpeg','image/webp'].includes(blob.type)){
      throw new Error(`${imported.assetId}: convert this asset to PNG, JPEG or WebP before registration`);
    }
    const file=new File([blob],`${imported.assetId.replace(/[^a-z0-9._-]+/gi,'_')}`,{type:blob.type});
    const claimedSha256=await sha256File(file);
    const form=new FormData();
    form.set('assetId',imported.assetId);
    form.set('claimedSha256',claimedSha256);
    form.set('file',file);
    form.set('metadata',JSON.stringify({
      name:imported.name,
      sourceWidth:imported.sourceWidth,
      sourceHeight:imported.sourceHeight,
      x:imported.x,
      y:imported.y,
      scale:imported.scale,
      rotation:imported.rotation,
      opacity:imported.opacity,
      groundY:imported.groundY,
      shadow:imported.shadow
    }));
    const response=await fetch('/api/admin/assets/register',{
      method:'POST',
      credentials:'same-origin',
      body:form
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.ok||!payload.asset)throw new Error(payload.error||`${imported.assetId}: server verification failed`);
    if(normalizeSha256(payload.asset.sha256)!==claimedSha256)throw new Error(`${imported.assetId}: server returned a different asset hash`);
    await cacheVerifiedBlob(blob,claimedSha256);
    return {...imported,sha256:claimedSha256,mime:payload.asset.mimeType||blob.type};
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
        const local=normalizeAsset(raw,preview);
        if(!local||!local.src)continue;
        assetStatus.textContent=`VERIFYING · ${local.assetId}…`;
        const imported=await registerImportedAsset(local);
        importedAssets.set(imported.assetId,imported);

        const hinted=imported.assetId.match(/^building\.([a-z0-9-]+)(?:\.|$)/i)?.[1];
        const target=working.buildings.find(b=>b.id===hinted)
          ||working.buildings.find(b=>String(b.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')===hinted);
        if(target){
          target.assetId=imported.assetId;
          target.assetHash=imported.sha256;
          delete target.asset;
          selectedKey=`building:${working.buildings.indexOf(target)}`;
          matched++;
        }
        added++;
      }
      if(!added)throw new Error('No valid embedded PNG/JPEG/WebP assets were found in this pack.');
      persistImportedAssets();
      populateAssetSelect();
      assetStatus.textContent=`${added} verified asset${added===1?'':'s'} registered${matched?` · ${matched} auto-matched`:''}`;
      syncAssetInspector();renderEditorObjects();syncInspector();
      markDraftDirty();
    }catch(err){assetStatus.textContent=`Import failed: ${err.message}`;}
    finally{assetFile.value='';}
  }
  function applyBuildingAsset(){
    const item=currentEditable();if(item?.type!=='building'||isLocked(item))return;
    const id=assetSelect.value;
    const asset=importedAssets.get(id);
    if(!id||!asset||!normalizeSha256(asset.sha256)){assetStatus.textContent='Choose a server-verified asset first.';return;}
    const before=snapshot();
    item.o.assetId=id;
    item.o.assetHash=asset.sha256;
    delete item.o.asset;
    commit(before);renderEditorObjects();syncAssetInspector();
  }
  function clearBuildingAsset(){
    const item=currentEditable();if(item?.type!=='building'||isLocked(item))return;
    const before=snapshot();
    delete item.o.assetId;delete item.o.assetHash;delete item.o.assetSha256;delete item.o.asset;
    commit(before);renderEditorObjects();syncAssetInspector();
  }
  function objectDisplayLabel(item){
    if(!item)return '';
    const o=item.o||{};
    if(item.type==='building')return o.name||o.id||item.label||'Building';
    if(item.type==='exit')return o.label||o.id||'Block Exit';
    if(item.type==='room-exit')return o.label||o.id||'Room Exit';
    if(item.type==='obstacle')return o.label||o.id||'Collision';
    if(item.type==='prop')return o.label||o.kind||'Prop';
    return o.label||item.label||item.type;
  }
  function objectTarget(item){
    if(!item)return '';
    const o=item.o||{};
    if(item.type==='building')return o.locationId||'';
    if(item.type==='exit')return o.targetBlock||'';
    if(item.type==='room-exit')return o.target||o.targetBlock||working.parentBlock||BLOCK1.id;
    return o.target||o.targetBlock||'';
  }
  function syncStudioStatus(){
    statusObjects && (statusObjects.textContent=String(allEditable().length));
    statusEntrances && (statusEntrances.textContent=String(editingSubarea()?0:(working.buildings||[]).length+(working.alley?1:0)));
    statusExits && (statusExits.textContent=String(editingSubarea()?(working.exit?1:0):(working.exits||[]).length));
    statusProps && (statusProps.textContent=String((working.props||[]).length));
  }

  function syncSceneConfigControls(){
    if(!editorWorkspace)return;
    const config=runtimeConfigFor(working);
    const camera=config.camera, playerConfig=config.player, movement=config.movement, interaction=config.interaction;
    if(configCameraZoom)configCameraZoom.value=String(Number(editingSubarea()?camera.zoom:camera.playScale)||1);
    if(configPlayerScale)configPlayerScale.value=String(Number(playerConfig.baseScale)||1);
    if(configLookAhead)configLookAhead.value=String(Number(camera.lookAhead)||0);
    if(configInteractionRadius)configInteractionRadius.value=String(Number(editingSubarea()?interaction.roomExitRadius:interaction.radius)||100);
    if(configWalkSpeed)configWalkSpeed.value=String(Number(movement.walkSpeed)||235);
    if(configRunSpeed)configRunSpeed.value=String(Number(movement.runSpeed)||390);
    if(configDepthMin)configDepthMin.value=String(Number(playerConfig.depthMin)||.78);
    if(configDepthMax)configDepthMax.value=String(Number(playerConfig.depthMax)||1.05);
    if(configIntegrityStatus){
      const integrity=publishedIntegrityByScene.get(editorDocumentId());
      const verified=integrity?.verified===true;
      const signed=verified&&String(integrity.algorithm||'').startsWith('hmac');
      configIntegrityStatus.dataset.state=verified?'verified':(integrity?.reason?'error':'warning');
      configIntegrityStatus.textContent=signed
        ? `LIVE CONFIG · HMAC VERIFIED · r${publishedRevision}`
        : verified
          ? `LIVE CONFIG · SHA-256 VERIFIED · r${publishedRevision}`
          : integrity?.reason
            ? `LIVE CONFIG · INTEGRITY FAILED · using source fallback`
            : 'PUBLISH · Worker validates + SHA-256 protects config';
    }
  }

  function setSceneConfigValue(group,key,value,{min=-Infinity,max=Infinity}={}){
    const number=Number(value);
    if(!Number.isFinite(number))return;
    const before=snapshot();
    const config=ensureWorkingRuntimeConfig();
    config[group]||(config[group]={});
    config[group][key]=Math.max(min,Math.min(max,number));
    if(group==='camera')working.camera={...config.camera};
    if(group==='player')working.character={...config.player};
    commit(before);
    updatePlayer();
    applyCamera();
    syncSceneConfigControls();
  }

  function syncInspector(){
    syncSceneConfigControls();
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
      updateShapeButtons();
      syncStudioStatus();
      return;
    }
    const o=item.o||{}, bounds=geometryBounds(o);
    inputX.value=Math.round(bounds.x);inputY.value=Math.round(bounds.y);
    inputW.value=Math.round(bounds.width);inputH.value=Math.round(bounds.height);
    const pointOnly=item.type==='prop'||item.type==='spawn';
    inputW.disabled=pointOnly;inputH.disabled=pointOnly;
    const label=objectDisplayLabel(item);
    if(inputIdLabel)inputIdLabel.value=label;
    if(inputRotation)inputRotation.value=String(Number(o.rotation||0));
    if(inputZIndex)inputZIndex.value=String(Number(o.zIndex||0));
    if(propType)propType.value=item.type.replace(/(^|[-_])(\w)/g,(_,a,b)=>`${a?' ':''}${b.toUpperCase()}`)+(isPolygonGeometry(o)?' Shape':'');
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
    if(duplicateButton)duplicateButton.disabled=locked||!['building','prop','obstacle'].includes(item.type);
    if(deleteButton)deleteButton.disabled=locked||item.type==='alley'||!['building','prop','obstacle'].includes(item.type);
    editorScope.querySelectorAll('[data-bw-nudge]').forEach(button=>{button.disabled=locked;});
    updateShapeButtons();
    syncStudioStatus();
  }
  function editorSurfaceElement(){return editingSubarea()?subareaWorld:scene;}
  function select(key){
    const changed=(key||'')!==selectedKey;
    if(changed){selectedVertexIndex=-1;if(addPointMode)setAddPointMode(false,{announce:false});}
    selectedKey=key||'';populateObjectSelect();syncInspector();
    const selected=currentEditable();if(editorSelection)editorSelection.textContent=selected?`${selected.type.toUpperCase()} · ${selected.label}`:'Tap an object in the scene';
    scene.querySelectorAll('.bw-edit-selected').forEach(x=>x.classList.remove('bw-edit-selected'));
    subareaWorld.querySelectorAll('.bw-edit-selected').forEach(x=>x.classList.remove('bw-edit-selected'));
    if(key)editorSurfaceElement().querySelector(`[data-edit-key="${key}"]`)?.classList.add('bw-edit-selected');
    // Selecting a zone once immediately paints its corner handles. The render
    // re-enters select() with the same key, so this is intentionally one-shot.
    if(changed&&editMode&&canShapeEditItem(selected))renderEditorObjects();
    // Selecting/dragging never forces a minimized inspector back open.
    if(editMode&&!editorCollapsed){
      editor.classList.add('show');
      editor.setAttribute('aria-hidden','false');
    }
  }
  function appendEditorGuide(parent,key,o,kind,label,{point=false}={}){
    if(!o)return null;
    const g=document.createElement('div');
    g.className=`bw-editor-guide bw-guide-${kind}`;
    g.dataset.editKey=key;
    g.classList.toggle('bw-edit-locked',!!o.locked);
    g.dataset.editLocked=o.locked?'true':'false';
    g.style.zIndex=String(5000+Number(o.zIndex||0));
    const keyType=String(key||'').split(':')[0];
    const shapeable=SHAPE_EDIT_TYPES.has(keyType);
    const bounds=geometryBounds(o);

    if(point){
      g.classList.add('bw-guide-point');
      g.style.left=`${Number(o.x)||0}px`;
      g.style.top=`${Number(o.y)||0}px`;
    }else{
      g.style.left=`${bounds.x}px`;
      g.style.top=`${bounds.y}px`;
      g.style.width=`${Math.max(1,bounds.width)}px`;
      g.style.height=`${Math.max(1,bounds.height)}px`;
      if(isPolygonGeometry(o)){
        g.classList.add('bw-guide-polygon');
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.classList.add('bw-guide-polygon-svg');
        svg.setAttribute('viewBox',`0 0 ${Math.max(1,bounds.width)} ${Math.max(1,bounds.height)}`);
        svg.setAttribute('preserveAspectRatio','none');
        const poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');
        poly.setAttribute('points',polygonSvgPoints(o));
        svg.appendChild(poly);
        g.appendChild(svg);
      }
    }
    if(Number(o.rotation||0)){
      g.style.transform=`rotate(${Number(o.rotation)||0}deg)`;
      g.style.transformOrigin='50% 50%';
    }
    const text=document.createElement('span');
    text.textContent=label;
    g.appendChild(text);

    // Shapeable zones always expose their corners while selected. Dragging a
    // corner of a rectangle auto-converts it into a polygon, so diagonal sides
    // do not require a hidden mode switch first.
    if(shapeable&&editMode&&selectedKey===key&&!o.locked){
      const w=Math.max(1,bounds.width), h=Math.max(1,bounds.height);
      editorVertexPoints(o).forEach((pointObj,index)=>{
        const handle=document.createElement('button');
        handle.type='button';
        handle.className='bw-polygon-vertex';
        if(index===selectedVertexIndex)handle.classList.add('active');
        handle.dataset.editKey=key;
        handle.dataset.vertexIndex=String(index);
        handle.style.left=`${(((Number(pointObj?.x)||0)-bounds.x)/w*100).toFixed(2)}%`;
        handle.style.top=`${(((Number(pointObj?.y)||0)-bounds.y)/h*100).toFixed(2)}%`;
        handle.setAttribute('aria-label',`Shape point ${index+1}`);
        g.appendChild(handle);
      });
    }
    parent.appendChild(g);
    return g;
  }

  function appendResizeGizmos(target,key){
    if(!target)return;
    const gizmos=document.createElement('div');
    gizmos.className='bw-resize-gizmos';
    gizmos.dataset.editKey=key;
    for(const edge of ['n','e','s','w','nw','ne','se','sw']){
      const h=document.createElement('button');
      h.type='button';
      h.className=`bw-resize-handle bw-resize-${edge}`;
      h.dataset.editKey=key;
      h.dataset.resize=edge;
      h.setAttribute('aria-label',`Resize ${edge}`);
      gizmos.appendChild(h);
    }
    target.appendChild(gizmos);
  }

  function renderRoomEditorObjects(){
    working=normalizeSubareaLayout(working,editorSceneId);
    activeSubarea=working;
    if(sceneManager.active)sceneManager.active.scene=activeSubarea;
    else sceneManager.enter(editorSceneId,editorStreetReturn);
    applyAreaVisuals();

    subareaWorld.querySelectorAll('.bw-editor-guide,.bw-resize-gizmos').forEach(x=>x.remove());

    (working.obstacles||[]).forEach((o,i)=>appendEditorGuide(subareaWorld,`obstacle:${i}`,o,'obstacle',o.label||o.id||`COLLISION ${i+1}`));
    (working.props||[]).forEach((o,i)=>appendEditorGuide(subareaWorld,`prop:${i}`,o,'prop',o.label||o.kind||`PROP ${i+1}`,{point:true}));
    appendEditorGuide(subareaWorld,'room-exit:0',working.exit,'room-exit',working.exit?.label||'STREET EXIT');
    appendEditorGuide(subareaWorld,'spawn:0',working.spawn,'spawn','SPAWN',{point:true});
    appendEditorGuide(subareaWorld,'walkable:0',working.walkable,'walkable','WALKABLE');
    appendEditorGuide(subareaWorld,'scene:0',working.scenePlate,'scene','SCENE');

    const gizmoItem=currentEditable();
    if(editMode&&gizmoItem&&!isLocked(gizmoItem)&&!['prop','spawn'].includes(gizmoItem.type)&&!canShapeEditItem(gizmoItem)){
      appendResizeGizmos(subareaWorld.querySelector(`[data-edit-key="${selectedKey}"]`),selectedKey);
    }

    renderSubareaDebug();
    populateObjectSelect();
    if(selectedKey)select(selectedKey);
    syncEditorSceneContext();
  }

  function renderEditorObjects(){
    if(editingSubarea()){renderRoomEditorObjects();return;}
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
      const assetKey=String(b.assetId||'').trim();
      const assetHash=normalizeSha256(b.assetHash);
      const imported=assetKey?importedAssets.get(assetKey):null;
      const verified=assetRefMatches(imported,assetKey,assetHash)&&!!imported.src;
      if(verified){
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
        art.dataset.assetSha256=imported.sha256;
        art.dataset.assetInternalId=imported.id;
        el.classList.add('has-building-art');
      }else{
        art?.remove();el.classList.remove('has-building-art');
        if(assetKey&&assetHash&&!pendingAssetLoads.has(`${assetKey}:${assetHash}`)){
          ensureVerifiedAssetForRef(assetKey,assetHash)
            .then(()=>renderEditorObjects())
            .catch(err=>console.warn(`Verified asset ${assetKey} could not be loaded`,err));
        }
      }
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
      appendEditorGuide(scene,'spawn:0',working.spawn,'spawn','SPAWN',{point:true});
      (working.exits||[]).forEach((x,i)=>appendEditorGuide(scene,`exit:${i}`,x,'exit',`${x.id.toUpperCase()} EXIT`));
      if(working.walkable)appendEditorGuide(scene,'walkable:0',working.walkable,'walkable','WALKABLE');
      if(working.scenePlate)appendEditorGuide(scene,'scene:0',working.scenePlate,'scene','SCENE');
    }
    scene.querySelectorAll('.bw-resize-gizmos').forEach(x=>x.remove());
    const gizmoItem=currentEditable();
    if(editMode&&gizmoItem&&!isLocked(gizmoItem)&&!['prop','spawn'].includes(gizmoItem.type)&&!canShapeEditItem(gizmoItem)){
      appendResizeGizmos(scene.querySelector(`[data-edit-key="${selectedKey}"]`),selectedKey);
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
    if(on){
      editorSceneId=activeSubarea?.id||BLOCK1.id;
      if(activeSubarea){
        editorStreetReturn=sceneManager.active?.returnState||editorStreetReturn||null;
      }
    }

    editMode=!!on;
    shell.classList.toggle('bw-edit-mode',editMode);
    if(editMode){
      editorCollapsed=false;
      editToggle.textContent='PLAY';
      editToggle.setAttribute('aria-label','Switch to play mode');
      await loadDraftForEditor();
      await loadVersionHistory();
      populateObjectSelect();syncInspector();renderEditorObjects();syncEditorSceneContext();
      syncEditorPanelUI();
    }else{
      clearTimeout(draftTimer);
      if(draftDirty)await saveDraftToServer();
      const wasRoom=editingSubarea();
      const roomId=editorSceneId;

      editorCollapsed=true;
      editToggle.textContent='EDIT';
      editToggle.setAttribute('aria-label','Switch to edit mode');
      drag=null;
      select('');

      if(wasRoom){
        // Play Mode stays inside the room. Draft-only changes disappear; the
        // verified published room becomes authoritative just like the street.
        const live=cloneBlock(publishedSubareas.get(roomId)||normalizeSubareaLayout(getSubarea(roomId),roomId));
        working=cloneBlock(publishedWorking);
        activeSubarea=live;
        if(sceneManager.active)sceneManager.active.scene=activeSubarea;
        else sceneManager.enter(roomId,editorStreetReturn);
        applyAreaVisuals();
        ensurePlayerInCurrentArea();
        updatePlayer();
        applyCamera();
      }else{
        rebuildPublishedScene();
      }

      joyX=0;joyY=0;state.running=false;
      editorSceneId=activeSubarea?.id||BLOCK1.id;
      syncEditorSceneContext();
      setServerStatus(`LIVE · r${publishedRevision}`,'published');
      syncEditorPanelUI();
    }
  }

  async function switchEditorScene(targetId){
    if(!editMode)return false;
    const target=String(targetId||'');
    if(target===editorSceneId)return true;

    clearTimeout(draftTimer);
    if(draftDirty)await saveDraftToServer({force:true});
    selectedKey='';undoStack=[];redoStack=[];draftDirty=false;

    if(target===BLOCK1.id){
      const back=sceneManager.active?.returnState||editorStreetReturn||publishedWorking.spawn;
      sceneManager.reset();
      activeSubarea=null;
      editorSceneId=BLOCK1.id;
      working=cloneBlock(publishedWorking);
      state.x=Number(back?.x)||working.spawn.x;
      state.y=Number(back?.y)||working.spawn.y;
      applyAreaVisuals();
      updatePlayer();
      applyCamera();
      await loadDraftForEditor();
      await loadVersionHistory();
      renderEditorObjects();syncInspector();syncEditorSceneContext();
      return true;
    }

    const authored=getSubarea(target);
    if(!authored){
      setServerStatus(`ROOM · unknown ${target}`,'error');
      return false;
    }

    if(!activeSubarea)editorStreetReturn={x:state.x,y:state.y};
    const live=cloneBlock(publishedSubareas.get(target)||normalizeSubareaLayout(authored,target));
    editorSceneId=target;
    sceneManager.reset();
    sceneManager.enter(target,editorStreetReturn);
    activeSubarea=live;
    state.x=Number(live.spawn?.x)||state.x;
    state.y=Number(live.spawn?.y)||state.y;
    applyAreaVisuals();
    updatePlayer();
    applyCamera();
    await loadDraftForEditor();
    await loadVersionHistory();
    renderEditorObjects();syncInspector();syncEditorSceneContext();
    return true;
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

    if(source===propWidth&&inputW)inputW.value=propWidth.value;
    else if(source===inputW&&propWidth)propWidth.value=inputW.value;
    if(source===propHeight&&inputH)inputH.value=propHeight.value;
    else if(source===inputH&&propHeight)propHeight.value=inputH.value;
    if(source===propLabel&&inputIdLabel)inputIdLabel.value=propLabel.value;
    else if(source===inputIdLabel&&propLabel)propLabel.value=inputIdLabel.value;
    if(source===propZIndex&&inputZIndex)inputZIndex.value=propZIndex.value;
    else if(source===inputZIndex&&propZIndex)propZIndex.value=inputZIndex.value;

    const before=snapshot(),o=item.o;
    const pointOnly=item.type==='prop'||item.type==='spawn';
    if(pointOnly){
      o.x=snap(inputX.value);o.y=snap(inputY.value);
    }else if(isPolygonGeometry(o)){
      const current=geometryBounds(o);
      scaleGeometryToBounds(o,{
        x:snap(inputX.value),
        y:snap(inputY.value),
        width:Math.max(20,snap(inputW.value)),
        height:Math.max(20,snap(inputH.value))
      },current);
    }else{
      o.x=snap(inputX.value);o.y=snap(inputY.value);
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
    else if(item.type==='room-exit')o.target=target||working.parentBlock||BLOCK1.id;
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
    if(isPolygonGeometry(o))syncPolygonBounds(o);
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

  const state={
    x:working.spawn.x,y:working.spawn.y,vx:0,vy:0,running:false,near:null,last:performance.now(),
    facingX:0,facingY:1,action:'idle',actionUntil:0,renderedState:'idle',renderedFacing:'south'
  };
  const keys=new Set();
  let raf=0, pointerId=null, joyX=0,joyY=0;

  function triggerPlayerAction(action='interact',duration=420){
    state.action=String(action||'idle');
    state.actionUntil=performance.now()+Math.max(0,Number(duration)||0);
  }

  function resolveFacing(x=0,y=1){
    if(Math.abs(x)>Math.abs(y))return x<0?'west':'east';
    return y<0?'north':'south';
  }

  function resolvePlayerVisual(now,inputX=0,inputY=0){
    const motion=Math.hypot(inputX,inputY);
    if(motion>.08){
      state.facingX=inputX/motion;
      state.facingY=inputY/motion;
    }
    if(state.action!=='idle'&&now>=state.actionUntil){
      state.action='idle';
      state.actionUntil=0;
    }
    const moving=motion>.08;
    const transient=state.action!=='idle'&&now<state.actionUntil?state.action:'';
    const nextState=transient||(moving?((state.running||keys.has('shift'))?'run':'walk'):'idle');
    const nextFacing=resolveFacing(state.facingX,state.facingY);
    return {moving,state:nextState,facing:nextFacing};
  }

  root.__bwPlayerAction=(action,duration)=>triggerPlayerAction(action,duration);
  const onPlayerActionEvent=e=>triggerPlayerAction(e.detail?.action||'interact',e.detail?.duration||420);
  root.addEventListener('bw-player-action',onPlayerActionEvent);

  function setJoystickKnob(x=0,y=0){
    if(!knob)return;
    knob.style.transform=`translate(${Number(x)||0}px,${Number(y)||0}px)`;
  }

  function currentArea(){
    if(activeSubarea)return activeSubarea;
    return {
      id:working.id,
      name:working.name||'Commerce Street',
      width:working.width||BLOCK1.width,
      height:working.height||BLOCK1.height,
      spawn:working.spawn,
      walkable:working.walkable||{x:0,y:990,width:working.width||BLOCK1.width,height:(working.height||BLOCK1.height)-990},
      obstacles:working.buildings||[],
      camera:working.camera||BLOCK1.camera||{},
      character:working.character||BLOCK1.character||{}
    };
  }

  function distanceToRect(x,y,rect){
    return distanceToGeometry(x,y,rect);
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

    const radius=Math.max(20,Number(runtimeConfigFor(currentArea()).interaction.radius)||100);
    return best&&dist<radius?best:null;
  }

  function nearestSubareaInteraction(){
    if(!activeSubarea)return null;
    const exit=activeSubarea.exit;
    const radius=Math.max(20,Number(runtimeConfigFor(activeSubarea).interaction.roomExitRadius)||105);
    if(exit&&distanceToGeometry(state.x,state.y,exit)<radius){
      return {kind:'subarea-exit',name:exit.label||'Commerce Street',distance:0};
    }
    return null;
  }

  function areaObstacles(area=currentArea()){
    return Array.isArray(area?.obstacles)?area.obstacles:[];
  }

  function collidesAt(x,y,radius=PLAYER_RADIUS,area=currentArea()){
    return areaObstacles(area).some(o=>circleIntersectsGeometry(x,y,radius,o));
  }

  function canOccupyPlayerAt(x,y,area=currentArea()){
    return !!area?.walkable
      && circleInsideGeometry(x,y,PLAYER_RADIUS,area.walkable)
      && !collidesAt(x,y,PLAYER_RADIUS,area);
  }

  function blockingBoundaryHits(x,y,area=currentArea()){
    const hits=[];
    if(area?.walkable&&!circleInsideGeometry(x,y,PLAYER_RADIUS,area.walkable)){
      const hit=nearestGeometryBoundary(x,y,area.walkable);
      if(hit)hits.push({...hit,kind:'walkable'});
    }
    for(const obstacle of areaObstacles(area)){
      if(!circleIntersectsGeometry(x,y,PLAYER_RADIUS,obstacle))continue;
      const hit=nearestGeometryBoundary(x,y,obstacle);
      if(hit)hits.push({...hit,kind:'obstacle'});
    }
    return hits.sort((a,b)=>a.d-b.d);
  }

  function findNearestValidPlayerPoint(x,y,area=currentArea()){
    if(canOccupyPlayerAt(x,y,area))return {x,y};
    const walk=area?.walkable;
    if(!walk)return {x,y};
    const bounds=geometryBounds(walk);
    const candidates=[];
    const add=(cx,cy)=>{
      if(Number.isFinite(cx)&&Number.isFinite(cy))candidates.push({x:cx,y:cy});
    };

    // For a box this is the exact inset clamp. For polygons it is still a useful
    // first candidate before the edge/grid search below.
    add(
      Math.max(bounds.x+PLAYER_RADIUS,Math.min(bounds.x+bounds.width-PLAYER_RADIUS,x)),
      Math.max(bounds.y+PLAYER_RADIUS,Math.min(bounds.y+bounds.height-PLAYER_RADIUS,y))
    );
    add(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    if(area.spawn)add(Number(area.spawn.x),Number(area.spawn.y));

    // Every boundary segment contributes candidates on both sides. Only the
    // geometrically valid inward side survives canOccupyPlayerAt().
    for(const segment of geometrySegments(walk)){
      const hit=closestPointOnSegment(x,y,segment.ax,segment.ay,segment.bx,segment.by);
      const dx=segment.bx-segment.ax,dy=segment.by-segment.ay,len=Math.hypot(dx,dy)||1;
      const nx=-dy/len,ny=dx/len,pad=PLAYER_RADIUS+PLAYER_SKIN+1;
      add(hit.x+nx*pad,hit.y+ny*pad);
      add(hit.x-nx*pad,hit.y-ny*pad);
    }

    let best=null;
    for(const candidate of candidates){
      if(!canOccupyPlayerAt(candidate.x,candidate.y,area))continue;
      const d=Math.hypot(candidate.x-x,candidate.y-y);
      if(!best||d<best.d)best={...candidate,d};
    }
    if(best)return {x:best.x,y:best.y};

    // Concave rooms can make the closest-edge normal land in another wall.
    // A bounded coarse search finds the nearest actually valid center without
    // projecting the player onto an unusable polygon edge.
    const cols=32,rows=20;
    for(let row=0;row<=rows;row++){
      const cy=bounds.y+(bounds.height*row/rows);
      for(let col=0;col<=cols;col++){
        const cx=bounds.x+(bounds.width*col/cols);
        if(!canOccupyPlayerAt(cx,cy,area))continue;
        const d=Math.hypot(cx-x,cy-y);
        if(!best||d<best.d)best={x:cx,y:cy,d};
      }
    }
    return best?{x:best.x,y:best.y}:{x,y};
  }

  function ensurePlayerInCurrentArea(){
    const area=currentArea();
    if(canOccupyPlayerAt(state.x,state.y,area))return true;
    const fixed=findNearestValidPlayerPoint(state.x,state.y,area);
    if(!canOccupyPlayerAt(fixed.x,fixed.y,area))return false;
    state.x=fixed.x;
    state.y=fixed.y;
    return true;
  }

  function movePlayerBy(deltaX,deltaY){
    const distance=Math.hypot(deltaX,deltaY);
    if(!distance)return;
    const area=currentArea();
    const maxStep=Math.max(2,Math.min(24,Number(runtimeConfigFor(area).movement.maxStep)||7));
    const steps=Math.max(1,Math.ceil(distance/maxStep));
    const stepX=deltaX/steps,stepY=deltaY/steps;

    for(let step=0;step<steps;step++){
      const candidateX=state.x+stepX,candidateY=state.y+stepY;
      if(canOccupyPlayerAt(candidateX,candidateY,area)){
        state.x=candidateX;
        state.y=candidateY;
        continue;
      }

      // Project the attempted movement onto the actual blocking edge tangent.
      // This is what makes a circular player slide along diagonal/concave polygon
      // sides instead of hitting the old invisible X/Y rectangle walls.
      let moved=false;
      for(const hit of blockingBoundaryHits(candidateX,candidateY,area)){
        const along=stepX*hit.tx+stepY*hit.ty;
        if(Math.abs(along)<0.0001)continue;
        const slideX=hit.tx*along,slideY=hit.ty*along;
        for(const factor of [1,.7,.4]){
          const sx=state.x+slideX*factor,sy=state.y+slideY*factor;
          if(!canOccupyPlayerAt(sx,sy,area))continue;
          state.x=sx;
          state.y=sy;
          moved=true;
          break;
        }
        if(moved)break;
      }
    }
  }

  function renderSubareaDebug(){
    if(!subareaDebug)return;
    subareaDebug.innerHTML='';
    if(!activeSubarea)return;
    const addDebugShape=(cls,shape)=>{
      if(!shape)return;
      const el=document.createElement('div');
      const b=geometryBounds(shape);
      el.className=cls;
      el.style.left=`${b.x}px`;
      el.style.top=`${b.y}px`;
      el.style.width=`${Math.max(1,b.width)}px`;
      el.style.height=`${Math.max(1,b.height)}px`;
      if(isPolygonGeometry(shape))el.style.clipPath=`polygon(${polygonPathWithinBounds(shape)})`;
      subareaDebug.appendChild(el);
    };
    for(const obstacle of activeSubarea.obstacles||[])addDebugShape('bw-subarea-collider',obstacle);
    addDebugShape('bw-subarea-walkable',activeSubarea.walkable);
    addDebugShape('bw-subarea-exit-guide',activeSubarea.exit);
  }

  function activeSceneElement(){
    // The outer sub-area scene is a fixed viewport-sized clipping surface.
    // Camera transforms apply only to the authored stage inside it.
    return activeSubarea ? subareaStage : scene;
  }

  function setSceneTransition(active,label='ENTERING AREA…'){
    sceneTransitionBusy=!!active;
    if(sceneTransitionLabel)sceneTransitionLabel.textContent=label;
    if(sceneTransition){
      sceneTransition.classList.remove('error');
      sceneTransition.classList.toggle('show',!!active);
      sceneTransition.setAttribute('aria-hidden',active?'false':'true');
    }
    if(interact)interact.disabled=!!active||!state.near;
  }

  function visualBeat(maxMs=70){
    return Promise.race([
      new Promise(resolve=>requestAnimationFrame(()=>resolve())),
      new Promise(resolve=>setTimeout(resolve,maxMs))
    ]);
  }

  function showSceneFailure(message){
    console.error('RiftCity scene transition failed:',message);
    if(!sceneTransition||!sceneTransitionLabel)return;
    clearTimeout(sceneFailureTimer);
    sceneTransitionLabel.textContent=`ALLEY ERROR · ${String(message||'UNKNOWN').slice(0,72)}`;
    sceneTransition.classList.add('show','error');
    sceneTransition.setAttribute('aria-hidden','false');
    sceneFailureTimer=setTimeout(()=>{
      sceneTransition.classList.remove('show','error');
      sceneTransition.setAttribute('aria-hidden','true');
    },2200);
  }

  function applyAreaVisuals(){
    if(activeSubarea){
      shell.classList.add('bw-subarea-active','bw-subarea-alley');
      shell.classList.remove('bw-subarea-asset-error');
      shell.dataset.activeArea=activeSubarea.id;
      shell.dataset.sceneState='room';
      shell.style.setProperty('--bw-subarea-width',`${activeSubarea.width}px`);
      shell.style.setProperty('--bw-subarea-height',`${activeSubarea.height}px`);

      // Hard ownership swap. The street is not resized or reused as an interior.
      scene.style.display='none';
      scene.style.visibility='hidden';
      scene.setAttribute('aria-hidden','true');
      scene.style.transform='none';

      subareaScene.style.display='block';
      subareaScene.style.visibility='visible';
      subareaScene.setAttribute('aria-hidden','false');

      subareaStage.style.width=`${activeSubarea.width}px`;
      subareaStage.style.height=`${activeSubarea.height}px`;
      subareaWorld.style.width=`${activeSubarea.width}px`;
      subareaWorld.style.height=`${activeSubarea.height}px`;
      subareaWorld.appendChild(player);
      subareaWorld.appendChild(prompt);

      if(subareaPlate){
        const plate=activeSubarea.scenePlate||{};
        const nextSrc=String(plate.src||'');
        const fallbackSrc=String(plate.fallbackSrc||'');
        subareaPlate.dataset.fallbackSrc=fallbackSrc;
        subareaPlate.dataset.fallbackAttempted='0';
        if(subareaPlate.dataset.src!==nextSrc){
          subareaPlate.dataset.src=nextSrc;
          subareaPlate.src=nextSrc;
        }
        subareaPlate.style.display=nextSrc||fallbackSrc?'block':'none';
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
    shell.dataset.sceneState='street';
    shell.style.removeProperty('--bw-subarea-width');
    shell.style.removeProperty('--bw-subarea-height');

    subareaScene.style.display='none';
    subareaScene.style.visibility='hidden';
    subareaScene.setAttribute('aria-hidden','true');
    subareaStage.style.transform='none';

    scene.style.display='block';
    scene.style.visibility='visible';
    scene.setAttribute('aria-hidden','false');
    scene.style.width=`${working.width||BLOCK1.width}px`;
    scene.style.height=`${working.height||BLOCK1.height}px`;
    scene.appendChild(player);
    scene.appendChild(prompt);

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

  function assertSceneOwnership(){
    if(!activeSubarea)return true;
    const checks={
      streetHidden:scene.style.display==='none'&&getComputedStyle(scene).display==='none',
      alleyVisible:getComputedStyle(subareaScene).display!=='none'&&getComputedStyle(subareaScene).visibility!=='hidden',
      playerOwned:player.parentElement===subareaWorld,
      promptOwned:prompt.parentElement===subareaWorld,
      shellActive:shell.classList.contains('bw-subarea-active')
    };
    if(Object.values(checks).every(Boolean))return true;
    throw new Error(
      Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key).join(', ')||'ownership'
    );
  }

  function updatePlayer(inputX=0,inputY=0,now=performance.now()){
    const area=currentArea();
    const walkBounds=geometryBounds(area.walkable);
    const visual=resolvePlayerVisual(now,inputX,inputY);
    const character=runtimeConfigFor(area).player;
    const editorCharacterScale=Number(character.editorScale);
    const playCharacterScale=Number(character.baseScale);
    const baseCharacterScale=(editorWorkspace&&editMode)
      ? (Number.isFinite(editorCharacterScale)&&editorCharacterScale>0?editorCharacterScale:1)
      : (Number.isFinite(playCharacterScale)&&playCharacterScale>0?playCharacterScale:1);
    const depthRange=Math.max(1,walkBounds.height-PLAYER_RADIUS*2);
    const rawDepth=.82+((state.y-(walkBounds.y+PLAYER_RADIUS))/depthRange)*.20;
    const depthMin=Number.isFinite(Number(character.depthMin))?Number(character.depthMin):.78;
    const depthMax=Number.isFinite(Number(character.depthMax))?Number(character.depthMax):1.05;
    const playerDepth=clampCamera(rawDepth,Math.min(depthMin,depthMax),Math.max(depthMin,depthMax));
    const visualScale=baseCharacterScale*playerDepth;

    player.style.left=`${state.x}px`;
    player.style.top=`${state.y}px`;
    player.style.transform=`translate(-50%,-100%) scale(${visualScale})`;
    player.style.zIndex=String(30+Math.round(state.y));
    player.dataset.state=visual.state;
    player.dataset.facing=visual.facing;
    player.classList.toggle('is-moving',visual.moving);
    player.classList.toggle('is-running',visual.state==='run');
    player.classList.toggle('is-interactable',!!state.near&&!sceneTransitionBusy);
    player.style.setProperty('--bw-player-depth',playerDepth.toFixed(3));
    player.style.setProperty('--bw-player-base-scale',baseCharacterScale.toFixed(3));
    player.style.setProperty('--bw-player-look-x',String((state.facingX||0).toFixed(3)));
    player.style.setProperty('--bw-player-look-y',String((state.facingY||1).toFixed(3)));
  }

  function clampCamera(value,min,max){
    return Math.max(min,Math.min(max,value));
  }

  const cameraState={key:'',x:0,y:0,scale:1};
  function cameraBlend(key,targetX,targetY,targetScale,{snap=false}={}){
    if(snap||cameraState.key!==key||!Number.isFinite(cameraState.scale)){
      cameraState.key=key;
      cameraState.x=targetX;
      cameraState.y=targetY;
      cameraState.scale=targetScale;
      return {...cameraState};
    }
    const cameraConfig=runtimeConfigFor(currentArea()).camera;
    const positionEase=clampCamera(Number(cameraConfig.positionEase)||.17,.01,1);
    const zoomEase=clampCamera(Number(cameraConfig.zoomEase)||.13,.01,1);
    cameraState.x+=(targetX-cameraState.x)*positionEase;
    cameraState.y+=(targetY-cameraState.y)*positionEase;
    cameraState.scale+=(targetScale-cameraState.scale)*zoomEase;
    return {...cameraState};
  }

  function applyCamera(){
    const area=currentArea();
    const viewportWidth=Math.max(1,viewport.clientWidth||1);
    const viewportHeight=Math.max(1,viewport.clientHeight||1);
    const authoredWidth=Math.max(1,Number(area.width)||1);
    const authoredHeight=Math.max(1,Number(area.height)||1);
    const cameraScene=activeSceneElement();
    const camera=runtimeConfigFor(area).camera;
    const editorOverview=editorWorkspace&&editMode&&!activeSubarea;
    const sceneKey=`${activeSubarea?'room':'street'}:${area.id||BLOCK1.id}:${editorOverview?'edit':'play'}`;

    let fitScale=1,cameraX=0,cameraY=0,screenOffsetX=0,screenOffsetY=0;

    if(activeSubarea){
      const containScale=Math.min(viewportWidth/authoredWidth,viewportHeight/authoredHeight);
      const coverScale=Math.max(viewportWidth/authoredWidth,viewportHeight/authoredHeight);
      const roomMode=camera.mode==='contain'||camera.mode==='room';
      const zoom=Number.isFinite(Number(camera.zoom))&&Number(camera.zoom)>0?Number(camera.zoom):1;
      const requested=(roomMode?containScale:coverScale)*zoom;
      const minScale=Number(camera.minScale)||.20;
      const maxScale=Number(camera.maxScale)||1.5;
      fitScale=clampCamera(requested,minScale,maxScale);

      if(roomMode){
        // Room art remains fully framed. Character scale is tuned separately so
        // close interiors do not require a fake gameplay-camera zoom.
        cameraX=0;
        cameraY=0;
        screenOffsetX=Math.max(0,(viewportWidth-authoredWidth*fitScale)/2);
        screenOffsetY=Math.max(0,(viewportHeight-authoredHeight*fitScale)/2);
        cameraState.key=sceneKey;
        cameraState.x=0;cameraState.y=0;cameraState.scale=fitScale;
      }else{
        const visibleWorldWidth=viewportWidth/fitScale;
        const visibleWorldHeight=viewportHeight/fitScale;
        const anchorX=Number.isFinite(Number(camera.anchorX))?Number(camera.anchorX):.5;
        const anchorY=Number.isFinite(Number(camera.anchorY))?Number(camera.anchorY):.72;
        const lookAhead=Number(camera.lookAhead)||0;
        const maxX=Math.max(0,authoredWidth-visibleWorldWidth);
        const maxY=Math.max(0,authoredHeight-visibleWorldHeight);
        const targetX=clampCamera(state.x+(state.facingX||0)*lookAhead-visibleWorldWidth*anchorX,0,maxX);
        const targetY=camera.vertical==='ground'
          ? maxY
          : clampCamera(state.y-visibleWorldHeight*anchorY,0,maxY);
        const blended=cameraBlend(sceneKey,targetX,targetY,fitScale);
        cameraX=blended.x;cameraY=blended.y;fitScale=blended.scale;
      }
    }else if(editorOverview){
      // Authoring still fits the complete block, independent of the gameplay camera.
      const editorBaseFit=Math.min(
        1,
        Math.max(.06,viewportHeight/authoredHeight),
        Math.max(.06,viewportWidth/authoredWidth)
      );
      fitScale=Math.max(.06,Math.min(1.8,editorBaseFit*editorZoom));
      const visibleWorldWidth=viewportWidth/fitScale;
      cameraX=Math.max(0,Math.min(Math.max(0,authoredWidth-visibleWorldWidth),state.x-visibleWorldWidth*.46));
      cameraState.key=sceneKey;
      cameraState.x=cameraX;cameraState.y=0;cameraState.scale=fitScale;
    }else{
      // Commerce Street play mode is a true following gameplay camera rather
      // than a panorama fit. The world/collision geometry remains unchanged.
      const naturalScale=Math.max(.20,Math.min(1,viewportHeight/authoredHeight));
      const requestedScale=Number.isFinite(Number(camera.playScale))&&Number(camera.playScale)>0
        ? Number(camera.playScale)
        : naturalScale;
      const minScale=Number.isFinite(Number(camera.minScale))?Number(camera.minScale):naturalScale;
      const maxScale=Number.isFinite(Number(camera.maxScale))?Number(camera.maxScale):1;
      const targetScale=clampCamera(Math.max(naturalScale,requestedScale),Math.min(minScale,maxScale),Math.max(minScale,maxScale));
      const visibleWorldWidth=viewportWidth/targetScale;
      const visibleWorldHeight=viewportHeight/targetScale;
      const anchorX=Number.isFinite(Number(camera.anchorX))?Number(camera.anchorX):.46;
      const anchorY=Number.isFinite(Number(camera.anchorY))?Number(camera.anchorY):.76;
      const lookAhead=Number(camera.lookAhead)||0;
      const maxX=Math.max(0,authoredWidth-visibleWorldWidth);
      const maxY=Math.max(0,authoredHeight-visibleWorldHeight);
      const targetX=clampCamera(state.x+(state.facingX||0)*lookAhead-visibleWorldWidth*anchorX,0,maxX);
      const targetY=camera.vertical==='ground'
        ? maxY
        : clampCamera(state.y-visibleWorldHeight*anchorY,0,maxY);
      const blended=cameraBlend(sceneKey,targetX,targetY,targetScale);
      cameraX=blended.x;cameraY=blended.y;fitScale=blended.scale;
    }

    cameraScene.style.transform=`translate3d(${screenOffsetX-cameraX*fitScale}px,${screenOffsetY-cameraY*fitScale}px,0) scale(${fitScale})`;
  }

  async function enterSubarea(targetId){
    if(sceneTransitionBusy)return false;
    const next=getSubarea(targetId);
    if(!next){
      showSceneFailure(`UNKNOWN AREA ${targetId}`);
      return false;
    }

    const streetReturn={x:state.x,y:state.y};
    let failure='';
    setSceneTransition(true,'ENTERING ALLEY…');
    state.near=null;
    prompt.classList.remove('show');
    interact.disabled=true;

    try{
      // Give Safari one opportunity to paint the transition, but never wait on
      // artwork/network state. visualBeat has its own timer fallback.
      await visualBeat();

      const result=sceneManager.enter(targetId,streetReturn);
      activeSubarea=result.scene;
      state.x=Number(activeSubarea.spawn?.x)||220;
      state.y=Number(activeSubarea.spawn?.y)||800;
      ensurePlayerInCurrentArea();
      state.running=false;
      joyX=joyY=0;
      keys.clear();
      setJoystickKnob();

      applyAreaVisuals();
      assertSceneOwnership();
      updatePlayer();
      applyCamera();

      shell.dataset.sceneState='alley-ready';
      await visualBeat(50);
      return true;
    }catch(error){
      failure=error?.message||String(error);
      sceneManager.reset();
      activeSubarea=null;
      state.x=streetReturn.x;
      state.y=streetReturn.y;
      state.near=null;
      state.running=false;
      joyX=joyY=0;
      keys.clear();
      setJoystickKnob();
      applyAreaVisuals();
      updatePlayer();
      applyCamera();
      return false;
    }finally{
      setSceneTransition(false);
      updatePrompt();
      if(failure)showSceneFailure(failure);
    }
  }

  async function leaveSubarea(){
    if(sceneTransitionBusy||!activeSubarea)return false;
    let failure='';
    setSceneTransition(true,'RETURNING TO STREET…');

    try{
      await visualBeat();
      const result=sceneManager.leave();
      activeSubarea=sceneManager.active?.scene||null;

      const fallback=working.alley&&Number(working.alley.width)>0
        ? {x:Number(working.alley.x)+Number(working.alley.width)/2,y:Number(working.alley.y)+Number(working.alley.height)+35}
        : working.spawn;
      const back=result?.returnState||fallback||working.spawn;

      state.x=Number(back?.x)||working.spawn.x;
      state.y=Number(back?.y)||working.spawn.y;
      ensurePlayerInCurrentArea();
      state.near=null;
      state.running=false;
      joyX=joyY=0;
      keys.clear();
      setJoystickKnob();

      applyAreaVisuals();
      updatePlayer();
      applyCamera();
      editorStreetReturn=null;
      await visualBeat(50);
      return true;
    }catch(error){
      failure=error?.message||String(error);
      return false;
    }finally{
      setSceneTransition(false);
      updatePrompt();
      if(failure)showSceneFailure(failure);
    }
  }

  function updatePrompt(){
    if(sceneTransitionBusy){
      state.near=null;
      prompt.classList.remove('show');
      interact.disabled=true;
      return;
    }
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

  async function enter(){
    if(sceneTransitionBusy||!state.near)return;
    triggerPlayerAction(state.near.kind==='location'?'interact':'search',480);
    if(state.near.kind==='subarea'){
      await enterSubarea(state.near.target);
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
    const inputLength=Math.hypot(dx,dy)||1;
    if(inputLength>1){dx/=inputLength;dy/=inputLength;}
    const movement=runtimeConfigFor(currentArea()).movement;
    const walkSpeed=Math.max(40,Number(movement.walkSpeed)||235);
    const runSpeed=Math.max(walkSpeed,Number(movement.runSpeed)||390);
    const speed=(state.running||keys.has('shift'))?runSpeed:walkSpeed;

    // Editing can reshape the polygon underneath the player marker; do not fight
    // the authoring gesture by relocating the marker every animation frame. The
    // position is repaired once when Play Mode resumes.
    if(!editMode){
      ensurePlayerInCurrentArea();
      movePlayerBy(dx*speed*dt,dy*speed*dt);
    }
    updatePlayer(dx,dy,now);

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
        const moveX=k==='arrowleft'?-step:k==='arrowright'?step:0;
        const moveY=k==='arrowup'?-step:k==='arrowdown'?step:0;
        translateGeometry(item.o,moveX,moveY);
        if(item.type==='building'){item.o.doorX+=moveX;item.o.doorY=item.o.y+item.o.h;}
        commit(before);renderEditorObjects();syncInspector();e.preventDefault();return;
      }
      if(item&&!isLocked(item)&&!typing&&(k==='delete'||k==='backspace')&&['building','prop','obstacle'].includes(item.type)){
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
    setJoystickKnob(screenX,screenY);
  }
  function down(e){if(editMode)return;e.preventDefault();e.stopPropagation();pointerId=e.pointerId;stick.setPointerCapture?.(pointerId);joy(e);}
  function move(e){if(e.pointerId===pointerId){e.preventDefault();joy(e);}}
  function up(e){if(e.pointerId!==pointerId)return;pointerId=null;joyX=joyY=0;setJoystickKnob();}


  function onEditorPointerDown(e){
    if(!editMode)return;
    const vertex=e.target.closest('[data-vertex-index]');
    const target=e.target.closest('[data-edit-key]');if(!target)return;
    const item=allEditable().find(x=>x.key===target.dataset.editKey);
    if(!item||isLocked(item))return;
    e.preventDefault();e.stopPropagation();

    const key=target.dataset.editKey;
    const wasSelected=selectedKey===key;
    const pointModeGesture=addPointMode&&wasSelected&&canShapeEditItem(item)&&!vertex&&!e.target.closest('[data-resize]');
    const before=snapshot();
    select(key);
    const resize=e.target.closest('[data-resize]')?.dataset.resize||'';
    let vertexDrag=!!vertex&&canShapeEditItem(item);
    let vertexIndex=vertexDrag?Number(vertex.dataset.vertexIndex||0):-1;

    // ADD POINT is a persistent tap-to-insert mode. The tap is projected onto
    // the nearest visible edge in SCREEN space, so Window mode, Safari scaling
    // and rotated/fullscreen transforms all resolve to the same authored edge.
    // The inserted point is selected and becomes the active drag point in the
    // same pointer gesture, so the user can tap then immediately pull it inward
    // or outward without another tap.
    if(pointModeGesture){
      const insertion=insertionOnNearestScreenEdge(target,item,e.clientX,e.clientY);
      if(!insertion){
        if(editorSelection)editorSelection.textContent=(editorVertexPoints(item.o).length>=64)
          ?'SHAPE LIMIT · maximum 64 points'
          :'ADD POINT · could not resolve an edge; tap the selected shape again';
        return;
      }
      if(!isPolygonGeometry(item.o))createRectPolygon(item.o);
      item.o.points.splice(insertion.insertIndex,0,insertion.point);
      syncPolygonBounds(item.o);
      selectedVertexIndex=insertion.insertIndex;
      vertexDrag=true;
      vertexIndex=insertion.insertIndex;
      renderEditorObjects();
      syncInspector();
      setAddPointMode(true,{announce:false});
    }else{
      // A rectangle becomes a four-point polygon the instant one of its corner
      // handles is dragged. This keeps diagonal editing direct and discoverable.
      if(vertexDrag&&!isPolygonGeometry(item.o))createRectPolygon(item.o);
      if(vertexDrag)selectedVertexIndex=vertexIndex;
      else if(!resize)selectedVertexIndex=-1;
    }

    const bounds=geometryBounds(item.o);
    drag={
      id:e.pointerId,
      key,
      mode:vertexDrag?'vertex':(resize?'resize':'move'),
      resize,
      startX:e.clientX,
      startY:e.clientY,
      ox:bounds.x,oy:bounds.y,ow:bounds.width,oh:bounds.height,
      origin:cloneBlock(item.o),
      vertexIndex,
      before
    };
    editorSurfaceElement().setPointerCapture?.(e.pointerId);
    syncInspector();
  }
  function onEditorPointerMove(e){
    if(!drag||e.pointerId!==drag.id)return;
    e.preventDefault();e.stopPropagation();
    const item=allEditable().find(x=>x.key===drag.key);if(!item)return;
    const scale=pointerScaleToWorld();
    const screenDx=e.clientX-drag.startX,screenDy=e.clientY-drag.startY;
    const worldDelta=pointerVectorToWorld(screenDx,screenDy);
    const dx=worldDelta.x/scale,dy=worldDelta.y/scale;

    // Always rebuild the dragged geometry from its pointer-down snapshot before
    // applying the total pointer delta. H1.27 applied that total delta to the
    // already-moved object on every pointermove, causing exponential/runaway
    // movement that looked like boxes flying off screen.
    restoreObjectSnapshot(item.o,drag.origin);

    if(drag.mode==='vertex'&&isPolygonGeometry(item.o)){
      const point=item.o.points[drag.vertexIndex];
      if(point){
        point.x=snap((Number(drag.origin.points?.[drag.vertexIndex]?.x)||0)+dx);
        point.y=snap((Number(drag.origin.points?.[drag.vertexIndex]?.y)||0)+dy);
      }
      syncPolygonBounds(item.o);
      selectedVertexIndex=drag.vertexIndex;
    }else if(drag.mode==='resize'){
      const edge=drag.resize,min=30;
      let x=drag.ox,y=drag.oy,w=drag.ow,h=drag.oh;
      if(edge.includes('w')){x=snap(drag.ox+dx);w=snap(drag.ow-(x-drag.ox));if(w<min){x=drag.ox+drag.ow-min;w=min;}}
      if(edge.includes('e'))w=Math.max(min,snap(drag.ow+dx));
      if(edge.includes('n')){y=snap(drag.oy+dy);h=snap(drag.oh-(y-drag.oy));if(h<min){y=drag.oy+drag.oh-min;h=min;}}
      if(edge.includes('s'))h=Math.max(min,snap(drag.oh+dy));
      scaleGeometryToBounds(item.o,{x,y,width:w,height:h},{x:drag.ox,y:drag.oy,width:drag.ow,height:drag.oh});
      if(item.type==='building'){
        const ratio=drag.ow?((Number(drag.origin.doorX)||drag.ox)-drag.ox)/drag.ow:0.5;
        item.o.doorX=geometryBounds(item.o).x+Math.max(0,Math.min(1,ratio))*geometryBounds(item.o).width;
        item.o.doorY=item.o.y+item.o.h;
      }
    }else{
      translateGeometry(item.o,dx,dy);
      if(item.type==='building'){
        const movedX=(Number(item.o.x)||0)-drag.ox;
        item.o.doorX=(Number(drag.origin.doorX)||0)+movedX;
        item.o.doorY=item.o.y+item.o.h;
      }
    }
    selectedKey=drag.key;
    renderEditorObjects();
    syncInspector();
  }
  function onEditorPointerUp(e){
    if(!drag||e.pointerId!==drag.id)return;
    e.preventDefault();e.stopPropagation();
    commit(drag.before);
    try{editorSurfaceElement().releasePointerCapture?.(e.pointerId);}catch(_){ }
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

  configCameraZoom?.addEventListener('change',()=>{
    const value=Math.max(.2,Math.min(2,Number(configCameraZoom.value)||1));
    const key=editingSubarea()?'zoom':'playScale';
    const before=snapshot();
    const config=ensureWorkingRuntimeConfig();
    config.camera[key]=value;
    if(value<Number(config.camera.minScale||value))config.camera.minScale=value;
    if(value>Number(config.camera.maxScale||value))config.camera.maxScale=value;
    working.camera={...config.camera};
    commit(before);applyCamera();syncSceneConfigControls();
  });
  configPlayerScale?.addEventListener('change',()=>setSceneConfigValue('player','baseScale',configPlayerScale.value,{min:.5,max:3}));
  configLookAhead?.addEventListener('change',()=>setSceneConfigValue('camera','lookAhead',configLookAhead.value,{min:0,max:1200}));
  configInteractionRadius?.addEventListener('change',()=>setSceneConfigValue('interaction',editingSubarea()?'roomExitRadius':'radius',configInteractionRadius.value,{min:20,max:500}));
  configWalkSpeed?.addEventListener('change',()=>setSceneConfigValue('movement','walkSpeed',configWalkSpeed.value,{min:40,max:800}));
  configRunSpeed?.addEventListener('change',()=>setSceneConfigValue('movement','runSpeed',configRunSpeed.value,{min:60,max:1200}));
  configDepthMin?.addEventListener('change',()=>{
    const value=Math.max(.3,Math.min(2,Number(configDepthMin.value)||.78));
    const before=snapshot(),config=ensureWorkingRuntimeConfig();
    config.player.depthMin=value;
    if(Number(config.player.depthMax)<value)config.player.depthMax=value;
    working.character={...config.player};
    commit(before);updatePlayer();syncSceneConfigControls();
  });
  configDepthMax?.addEventListener('change',()=>{
    const value=Math.max(.3,Math.min(2.5,Number(configDepthMax.value)||1.05));
    const before=snapshot(),config=ensureWorkingRuntimeConfig();
    config.player.depthMax=value;
    if(Number(config.player.depthMin)>value)config.player.depthMin=value;
    working.character={...config.player};
    commit(before);updatePlayer();syncSceneConfigControls();
  });

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
  shapeToggleButton?.addEventListener('click',()=>{
    const item=currentEditable();if(!item||isLocked(item)||!canShapeEditItem(item))return;
    setAddPointMode(false,{announce:false});
    const before=snapshot();
    if(isPolygonGeometry(item.o)){
      stripPolygon(item.o);
      selectedVertexIndex=-1;
    }else{
      createRectPolygon(item.o);
      selectedVertexIndex=0;
    }
    commit(before);renderEditorObjects();syncInspector();
  });
  addPointButton?.addEventListener('click',()=>{
    const item=currentEditable();if(!item||isLocked(item)||!canShapeEditItem(item))return;
    if(isPolygonGeometry(item.o)&&(item.o.points||[]).length>=64){
      if(editorSelection)editorSelection.textContent='SHAPE LIMIT · maximum 64 points';
      return;
    }
    setAddPointMode(!addPointMode);
  });
  deletePointButton?.addEventListener('click',()=>{
    const item=currentEditable();
    if(!item||isLocked(item)||!isPolygonGeometry(item.o)||(item.o.points||[]).length<=3||selectedVertexIndex<0)return;
    const before=snapshot();
    const pts=item.o.points||[];
    const removeAt=Math.max(0,Math.min(pts.length-1,selectedVertexIndex));
    pts.splice(removeAt,1);
    selectedVertexIndex=Math.min(removeAt,pts.length-1);
    syncPolygonBounds(item.o);
    commit(before);renderEditorObjects();syncInspector();
  });
  editorScope.querySelectorAll('[data-bw-nudge]').forEach(button=>button.addEventListener('click',()=>{
    const dir=button.dataset.bwNudge;
    if(dir==='up')nudgeSelected(0,-1);
    if(dir==='down')nudgeSelected(0,1);
    if(dir==='left')nudgeSelected(-1,0);
    if(dir==='right')nudgeSelected(1,0);
  }));
  editorSubareaButtons.forEach(button=>button.addEventListener('click',()=>switchEditorScene(button.dataset.bwOpenSubarea)));
  editorParentSceneButton?.addEventListener('click',()=>switchEditorScene(BLOCK1.id));
  resetButton.addEventListener('click',()=>{const before=snapshot();setWorkingEditorDocument(authoredEditorDocument());commit(before);select('');renderEditorObjects();syncEditorSceneContext();});
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
      if(editingSubarea())return;
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
    if(kind==='obstacle'&&editingSubarea()){
      working.obstacles=working.obstacles||[];
      const id=`collision-${Date.now().toString(36)}`;
      working.obstacles.push({id,x:snap(Math.max(0,state.x-80)),y:snap(Math.max(0,state.y-60)),width:160,height:120,active:true});
      commit(before);renderEditorObjects();select(`obstacle:${working.obstacles.length-1}`);return;
    }
    if(kind==='exit'){
      if(editingSubarea()){
        working.exit={...(working.exit||{}),id:working.exit?.id||'street-exit',x:snap(Math.max(0,state.x-80)),y:snap(Math.max(0,state.y-100)),width:160,height:220,label:working.exit?.label||'Commerce Street'};
        commit(before);renderEditorObjects();select('room-exit:0');return;
      }
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
      if(editingSubarea())return;
      const nearest=(working.buildings||[]).map((b,i)=>({b,i,d:Math.hypot((b.doorX??b.x)-state.x,(b.doorY??b.y)-state.y)})).sort((a,b)=>a.d-b.d)[0];
      if(nearest){nearest.b.doorX=snap(state.x);nearest.b.doorY=snap(state.y);commit(before);renderEditorObjects();select(`building:${nearest.i}`);}
    }
  }));
  duplicateButton.addEventListener('click',()=>{const item=currentEditable();if(!item||isLocked(item))return;const before=snapshot(),copy=JSON.parse(JSON.stringify(item.o));translateGeometry(copy,40,40);if(item.type==='building'){copy.id=`${copy.id}-copy-${Date.now().toString(36)}`;copy.name+= ' Copy';copy.doorX+=40;copy.doorY+=40;working.buildings.push(copy);commit(before);renderEditorObjects();select(`building:${working.buildings.length-1}`);}else if(item.type==='prop'){const slug=String(copy.kind||'prop').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'prop';copy.id=`prop-${slug}-${Date.now().toString(36)}-${(++propSerial).toString(36)}`;delete copy.locked;working.props.push(copy);commit(before);renderEditorObjects();select(`prop:${working.props.length-1}`);}else if(item.type==='obstacle'){copy.id=`${copy.id||'collision'}-copy-${Date.now().toString(36)}`;delete copy.locked;working.obstacles.push(copy);commit(before);renderEditorObjects();select(`obstacle:${working.obstacles.length-1}`);}});
  deleteButton.addEventListener('click',()=>{const item=currentEditable();if(!item||isLocked(item)||item.type==='alley')return;const before=snapshot();if(item.type==='building')working.buildings.splice(item.i,1);else if(item.type==='prop')working.props.splice(item.i,1);else if(item.type==='obstacle')working.obstacles.splice(item.i,1);else return;commit(before);select('');renderEditorObjects();});
  for(const surface of [scene,subareaWorld]){
    surface.addEventListener('pointerdown',onEditorPointerDown,true);
    surface.addEventListener('pointermove',onEditorPointerMove,true);
    surface.addEventListener('pointerup',onEditorPointerUp,true);
    surface.addEventListener('pointercancel',onEditorPointerUp,true);
  }
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
    const rect=activeSceneElement().getBoundingClientRect();
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
    root.removeEventListener('bw-player-action',onPlayerActionEvent);
    try{ delete root.__bwPlayerAction; }catch(_){ root.__bwPlayerAction=undefined; }
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
    sceneManager.reset();
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
    for(const surface of [scene,subareaWorld]){
      surface.removeEventListener('pointerdown',onEditorPointerDown,true);
      surface.removeEventListener('pointermove',onEditorPointerMove,true);
      surface.removeEventListener('pointerup',onEditorPointerUp,true);
      surface.removeEventListener('pointercancel',onEditorPointerUp,true);
    }
    for(const url of assetObjectUrls)try{URL.revokeObjectURL(url);}catch(_){}
    assetObjectUrls.clear();
  };
}
