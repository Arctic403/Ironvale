import { api } from '../ui/api.js';
import { go } from '../ui/router.js';
import { BLOCK1 } from '../block1.js';

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
      <button class="bw-fullscreen" id="bw-fullscreen" type="button" aria-label="Toggle fullscreen">FULLSCREEN</button>
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
  const knob=root.querySelector('#bw-knob');

  for(const b of BLOCK1.buildings){
    const el=document.createElement('div');
    el.className=`bw-building tone-${b.tone} style-${b.style||b.tone}`;
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

  for(const p of BLOCK1.props){
    const el=document.createElement('div');
    el.className=`bw-prop bw-${p.kind}`;
    el.style.left=`${p.x}px`; el.style.top=`${p.y}px`;
    el.innerHTML=p.kind==='tree'?'<i></i>':'<i></i><b></b>';
    props.appendChild(el);
  }

  const state={x:BLOCK1.spawn.x,y:BLOCK1.spawn.y,vx:0,vy:0,running:false,near:null,last:performance.now()};
  const keys=new Set();
  let raf=0, pointerId=null, joyX=0,joyY=0;

  function nearestBuilding(){
    let best=null,dist=Infinity;
    for(const b of BLOCK1.buildings){
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
    return BLOCK1.buildings.some(b=>
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
  function down(e){pointerId=e.pointerId;stick.setPointerCapture(pointerId);joy(e);}
  function move(e){if(e.pointerId===pointerId)joy(e);}
  function up(e){if(e.pointerId!==pointerId)return;pointerId=null;joyX=joyY=0;knob.style.transform='translate(0,0)';}


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
  };
}
