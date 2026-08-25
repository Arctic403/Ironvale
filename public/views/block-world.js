import { api } from '../ui/api.js';
import { go } from '../ui/router.js';
import { BLOCK1, BLOCK_EDITOR_SCHEMA_VERSION } from '../block1.js';

let cleanup=null;
export function destroyBlockWorld(){ if(cleanup){cleanup();cleanup=null;} }

export async function renderBlockWorld(root){
  destroyBlockWorld();
  const [worldData,playerData]=await Promise.all([api('/api/world'),api('/api/player')]);
  const locations=worldData.locations||[];
  const validLocationIds=new Set(locations.map(x=>x.id));

  root.innerHTML=`
    <section class="blockworld-shell">
      <div class="blockworld-viewport" id="blockworld-viewport">
        <div class="blockworld-scene" id="blockworld-scene">
          <div class="bw-sky"></div>
          <div class="bw-backdrop"><span></span><span></span><span></span><span></span></div>
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
        <button class="bw-edit-toggle" id="bw-edit-toggle" type="button">EDIT BLOCK</button>
        <button class="bw-fullscreen" id="bw-fullscreen" type="button" aria-label="Toggle fullscreen">FULLSCREEN</button>
      </div>
      <aside class="bw-editor" id="bw-editor" aria-hidden="true">
        <header><strong>BLOCK EDITOR</strong><button id="bw-editor-close" type="button">×</button></header>
        <div class="bw-editor-tabs">
          <button data-tool="select" class="active">SELECT</button><button data-tool="add">ADD PROP</button>
        </div>
        <div class="bw-editor-body">
          <label>Object<select id="bw-editor-object"></select></label>
          <div class="bw-editor-grid">
            <label>X<input id="bw-editor-x" type="number" step="5"></label>
            <label>Y<input id="bw-editor-y" type="number" step="5"></label>
            <label>W<input id="bw-editor-w" type="number" step="5"></label>
            <label>H<input id="bw-editor-h" type="number" step="5"></label>
          </div>
          <label>Snap<select id="bw-editor-snap"><option value="1">OFF</option><option value="5">5 px</option><option value="10" selected>10 px</option><option value="25">25 px</option></select></label>
          <div class="bw-editor-actions"><button id="bw-editor-duplicate">DUPLICATE</button><button id="bw-editor-delete">DELETE</button></div>
          <label>Add prop<select id="bw-editor-prop-kind"><option>tree</option><option>lamp</option><option>bench</option><option>hydrant</option><option>box</option><option>news</option><option>car</option><option>van</option></select></label>
          <button id="bw-editor-add-prop">ADD AT PLAYER</button>
          <div class="bw-editor-actions"><button id="bw-editor-undo">UNDO</button><button id="bw-editor-redo">REDO</button></div>
          <button class="primary" id="bw-editor-export">EXPORT WORLD JSON</button>
          <button id="bw-editor-reset">RESET BLOCK</button>
          <small>Drag objects directly in the scene. Buildings also expose door markers. Export and send the JSON with your newest workspace.</small>
        </div>
      </aside>
      <div class="bw-controls">
        <div class="bw-stick" id="bw-stick"><div class="bw-knob" id="bw-knob"></div></div>
        <button class="bw-run" id="bw-run">RUN</button>
        <button class="bw-interact" id="bw-interact" disabled>ENTER</button>
      </div>
    </section>`;

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
  const editor=root.querySelector('#bw-editor');
  const editorClose=root.querySelector('#bw-editor-close');
  const objectSelect=root.querySelector('#bw-editor-object');
  const inputX=root.querySelector('#bw-editor-x'),inputY=root.querySelector('#bw-editor-y');
  const inputW=root.querySelector('#bw-editor-w'),inputH=root.querySelector('#bw-editor-h');
  const snapSelect=root.querySelector('#bw-editor-snap');
  const duplicateButton=root.querySelector('#bw-editor-duplicate'),deleteButton=root.querySelector('#bw-editor-delete');
  const undoButton=root.querySelector('#bw-editor-undo'),redoButton=root.querySelector('#bw-editor-redo');
  const exportButton=root.querySelector('#bw-editor-export'),resetButton=root.querySelector('#bw-editor-reset');
  const addPropButton=root.querySelector('#bw-editor-add-prop'),propKind=root.querySelector('#bw-editor-prop-kind');

  // Editable working copy; the imported authored block remains untouched.
  let editMode=false, selectedKey='', drag=null;
  let working=JSON.parse(JSON.stringify(BLOCK1));
  let undoStack=[],redoStack=[];

  function allEditable(){
    return [
      ...working.buildings.map((o,i)=>({key:`building:${i}`,type:'building',i,o,label:o.name})),
      ...working.props.map((o,i)=>({key:`prop:${i}`,type:'prop',i,o,label:`${o.kind} ${i+1}`})),
      {key:'alley:0',type:'alley',i:0,o:working.alley,label:'Alley'}
    ];
  }
  function currentEditable(){return allEditable().find(x=>x.key===selectedKey)||null;}
  function snapshot(){return JSON.stringify(working);}
  function commit(before){
    const after=snapshot(); if(before!==after){undoStack.push(before);if(undoStack.length>60)undoStack.shift();redoStack=[];}
  }
  function snap(v){const n=Number(snapSelect.value)||1;return Math.round(v/n)*n;}
  function populateObjectSelect(){
    const current=selectedKey;
    objectSelect.innerHTML='<option value="">Choose object…</option>'+allEditable().map(x=>`<option value="${x.key}">${x.type.toUpperCase()} · ${x.label}</option>`).join('');
    if(allEditable().some(x=>x.key===current))objectSelect.value=current;
  }
  function syncInspector(){
    const item=currentEditable(); if(!item){inputX.value=inputY.value=inputW.value=inputH.value='';return;}
    const o=item.o; inputX.value=Math.round(o.x||0);inputY.value=Math.round(o.y||0);
    inputW.value=Math.round(o.w??o.width??0);inputH.value=Math.round(o.h??o.height??0);
    inputW.disabled=item.type==='prop';inputH.disabled=item.type==='prop';
  }
  function select(key){
    selectedKey=key||'';populateObjectSelect();syncInspector();
    scene.querySelectorAll('.bw-edit-selected').forEach(x=>x.classList.remove('bw-edit-selected'));
    if(key)scene.querySelector(`[data-edit-key="${key}"]`)?.classList.add('bw-edit-selected');
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
    });
    props.querySelectorAll('.bw-prop-authored').forEach(x=>x.remove());
    working.props.forEach((p,i)=>{
      const el=document.createElement('div');el.className=`bw-prop bw-${p.kind} bw-prop-authored`;
      el.dataset.editKey=`prop:${i}`;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;
      el.innerHTML=p.kind==='tree'?'<i></i>':'<i></i><b></b>';props.appendChild(el);
    });
    alley.dataset.editKey='alley:0';alley.style.left=`${working.alley.x}px`;alley.style.top=`${working.alley.y}px`;
    alley.style.width=`${working.alley.width}px`;alley.style.height=`${working.alley.height}px`;
    populateObjectSelect(); if(selectedKey)select(selectedKey);
  }
  function setEditMode(on){
    editMode=!!on;shell.classList.toggle('bw-edit-mode',editMode);editor.classList.toggle('show',editMode);
    editor.setAttribute('aria-hidden',String(!editMode));editToggle.textContent=editMode?'PLAY MODE':'EDIT BLOCK';
    if(editMode){populateObjectSelect();syncInspector();}else select('');
  }
  function applyInspector(){
    const item=currentEditable();if(!item)return;const before=snapshot(),o=item.o;
    o.x=snap(inputX.value);o.y=snap(inputY.value);
    if(item.type!=='prop'){const wk='w' in o?'w':'width',hk='h' in o?'h':'height';o[wk]=Math.max(20,snap(inputW.value));o[hk]=Math.max(20,snap(inputH.value));}
    if(item.type==='building'){o.doorX=Math.max(o.x,Math.min(o.x+o.w,o.doorX));o.doorY=o.y+o.h;}
    commit(before);renderEditorObjects();
  }
  function undo(){if(!undoStack.length)return;redoStack.push(snapshot());working=JSON.parse(undoStack.pop());renderEditorObjects();syncInspector();}
  function redo(){if(!redoStack.length)return;undoStack.push(snapshot());working=JSON.parse(redoStack.pop());renderEditorObjects();syncInspector();}
  function downloadWorld(){
    const payload={format:'riftcity-block-edit',version:BLOCK_EDITOR_SCHEMA_VERSION,exportedAt:new Date().toISOString(),block:working};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${working.id}-edit.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  for(const b of BLOCK1.buildings){
    const el=document.createElement('div');
    el.className=`bw-building tone-${b.tone} style-${b.style||b.tone}`; el.dataset.buildingId=b.id;
    el.style.cssText=`left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
    const upperCount=b.style==='apartments'?10:(b.style==='realty'?6:5);
    el.innerHTML=`
      <div class="bw-roof"><span class="bw-roof-unit"></span></div>
      <div class="bw-upper">${'<i></i>'.repeat(upperCount)}</div>
      <div class="bw-storefront">
        <b>${b.sign}</b><em>${b.detail||''}</em>
        <span class="bw-awning"></span><span class="bw-door"></span><span class="bw-window"></span>
        <span class="bw-window-display"></span>
      </div>
      <span class="bw-side-sign">${b.style==='pharmacy'?'✚':b.style==='pawn'?'$':b.style==='noodle'?'NOODLES':''}</span>`;
    buildings.appendChild(el);
  }
  const alley=document.createElement('div');
  alley.className='bw-alley';
  alley.style.cssText=`left:${BLOCK1.alley.x}px;top:${BLOCK1.alley.y}px;width:${BLOCK1.alley.width}px;height:${BLOCK1.alley.height}px`;
  alley.innerHTML=`<span class="bw-fireescape"></span><span class="bw-dumpster"></span><span class="bw-bins"></span><span class="bw-graffiti">RIFT</span><span class="bw-puddle"></span>`;
  buildings.appendChild(alley);

  // Street life is decorative only: parked cars, hydrants, benches and utility clutter.
  const life=[
    ['car',610,1015],['car',2210,690],['van',2750,1010],
    ['hydrant',1150,615],['bench',1430,600],['box',1835,600],
    ['news',2490,605],['bench',3300,600]
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

  const state={x:BLOCK1.spawn.x,y:BLOCK1.spawn.y,vx:0,vy:0,running:false,near:null,last:performance.now()};
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
    nx=Math.max(45,Math.min(BLOCK1.width-45,nx));
    // The whole foreground street plane is walkable. Players can now walk
    // north across the road and right up to the storefront threshold.
    ny=Math.max(510,Math.min(1225,ny));

    // Resolve axes separately so facades feel solid without sticky corners.
    if(!collidesWithFacade(nx,state.y))state.x=nx;
    if(!collidesWithFacade(state.x,ny))state.y=ny;
    player.style.left=`${state.x}px`; player.style.top=`${state.y}px`;
    const playerDepth=.78+((state.y-510)/(1225-510))*.24;
    player.style.transform=`translate(-50%,-100%) scale(${playerDepth})`;
    player.style.zIndex=String(30+Math.round(state.y));

    // Scale Block 01 to the real viewport height so portrait mode never crops
    // the buildings/road/controls. The camera then pans through world space.
    const authoredHeight=1260;
    const fitScale=Math.max(.26,Math.min(1,viewport.clientHeight/authoredHeight));
    const visibleWorldWidth=viewport.clientWidth/fitScale;
    const cameraX=Math.max(
      0,
      Math.min(Math.max(0,BLOCK1.width-visibleWorldWidth),state.x-visibleWorldWidth*.46)
    );
    scene.style.transform=`translate3d(${-cameraX*fitScale}px,0,0) scale(${fitScale})`;
    updatePrompt();
    raf=requestAnimationFrame(tick);
  }
  function keydown(e){
    const k=e.key.toLowerCase();
    if(editMode){if((e.ctrlKey||e.metaKey)&&k==='z'){e.shiftKey?redo():undo();e.preventDefault();}return;}
    if(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown','shift'].includes(k)){keys.add(k);e.preventDefault();}
    if((k==='e'||k==='enter')&&state.near){enter();e.preventDefault();}
  }
  function keyup(e){keys.delete(e.key.toLowerCase());}
  function joy(e){
    const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    let x=e.clientX-cx,y=e.clientY-cy; const m=Math.hypot(x,y),lim=r.width*.34;
    if(m>lim){x=x/m*lim;y=y/m*lim;}
    joyX=x/lim;joyY=y/lim;knob.style.transform=`translate(${x}px,${y}px)`;
  }
  function down(e){if(editMode)return;pointerId=e.pointerId;stick.setPointerCapture(pointerId);joy(e);}
  function move(e){if(e.pointerId===pointerId)joy(e);}
  function up(e){if(e.pointerId!==pointerId)return;pointerId=null;joyX=joyY=0;knob.style.transform='translate(0,0)';}


  function onEditorPointerDown(e){
    if(!editMode)return;
    const target=e.target.closest('[data-edit-key]');if(!target)return;
    e.preventDefault();e.stopPropagation();select(target.dataset.editKey);
    const item=currentEditable();if(!item)return;
    drag={id:e.pointerId,key:selectedKey,startX:e.clientX,startY:e.clientY,ox:item.o.x,oy:item.o.y,before:snapshot()};
    target.setPointerCapture?.(e.pointerId);
  }
  function onEditorPointerMove(e){
    if(!drag||e.pointerId!==drag.id)return;const item=currentEditable();if(!item)return;
    // scene screen scale can differ from authored world scale.
    const scale=scene.getBoundingClientRect().width/BLOCK1.width||1;
    item.o.x=snap(drag.ox+(e.clientX-drag.startX)/scale);
    item.o.y=snap(drag.oy+(e.clientY-drag.startY)/scale);
    if(item.type==='building'){item.o.doorX+=item.o.x-Number(inputX.value||drag.ox);item.o.doorY=item.o.y+item.o.h;}
    renderEditorObjects();syncInspector();
  }
  function onEditorPointerUp(e){
    if(!drag||e.pointerId!==drag.id)return;commit(drag.before);drag=null;
  }
  editToggle.addEventListener('click',()=>setEditMode(!editMode));
  editorClose.addEventListener('click',()=>setEditMode(false));
  objectSelect.addEventListener('change',()=>select(objectSelect.value));
  [inputX,inputY,inputW,inputH].forEach(el=>el.addEventListener('change',applyInspector));
  undoButton.addEventListener('click',undo);redoButton.addEventListener('click',redo);
  exportButton.addEventListener('click',downloadWorld);
  resetButton.addEventListener('click',()=>{const before=snapshot();working=JSON.parse(JSON.stringify(BLOCK1));commit(before);select('');renderEditorObjects();});
  addPropButton.addEventListener('click',()=>{const before=snapshot();working.props.push({kind:propKind.value,x:snap(state.x+70),y:snap(state.y)});commit(before);renderEditorObjects();select(`prop:${working.props.length-1}`);});
  duplicateButton.addEventListener('click',()=>{const item=currentEditable();if(!item)return;const before=snapshot(),copy=JSON.parse(JSON.stringify(item.o));copy.x+=40;copy.y+=40;if(item.type==='building'){copy.id=`${copy.id}-copy-${Date.now().toString(36)}`;copy.name+= ' Copy';copy.doorX+=40;copy.doorY+=40;working.buildings.push(copy);commit(before);renderEditorObjects();select(`building:${working.buildings.length-1}`);}else if(item.type==='prop'){working.props.push(copy);commit(before);renderEditorObjects();select(`prop:${working.props.length-1}`);}});
  deleteButton.addEventListener('click',()=>{const item=currentEditable();if(!item||item.type==='alley')return;const before=snapshot();if(item.type==='building')working.buildings.splice(item.i,1);else working.props.splice(item.i,1);commit(before);select('');renderEditorObjects();});
  scene.addEventListener('pointerdown',onEditorPointerDown,true);
  scene.addEventListener('pointermove',onEditorPointerMove,true);
  scene.addEventListener('pointerup',onEditorPointerUp,true);
  scene.addEventListener('pointercancel',onEditorPointerUp,true);
  renderEditorObjects();


  let fullscreenMode=false;

  function isiOS(){
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
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
  interact.addEventListener('click',enter);
  run.addEventListener('pointerdown',()=>state.running=true);
  run.addEventListener('pointerup',()=>state.running=false);
  run.addEventListener('pointercancel',()=>state.running=false);

  player.style.left=`${state.x}px`;player.style.top=`${state.y}px`;
  raf=requestAnimationFrame(tick);
  cleanup=()=>{
    cancelAnimationFrame(raf);
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
