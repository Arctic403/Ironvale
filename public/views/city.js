import { api } from '../ui/api.js';
import { state } from '../ui/state.js';
import { escapeHtml, panel, empty } from '../ui/helpers.js';
import { go } from '../ui/router.js';
import { showToast } from '../ui/shell.js';
import { DOWNTOWN_GROUND } from '../downtown-ground.js';
import {
  WORLD2D_CONFIG, WORLD2D_COLLIDERS, getWorld2DLocationPosition,
  buildSpatialIndex, querySpatialIndex, playerHitsCollider, clampPlayer
} from '../world2d.js';

const ROUTE_BY_TYPE={bank:'bank',education:'education',gym:'gym',jobs:'jobs',properties:'properties',shop:'shop',status:'status',casino:'casino',travel:'travel',production:'production',market:'market',auction:'auction',law:'law',nightclub:'nightclub','city-activities':'city-activities'};

let activeCity2D=null;

export function destroyCity2D(){
  activeCity2D?.destroy?.();
  activeCity2D=null;
  document.body.classList.remove('city2d-game-mode');
}

export async function renderCity(root){
  destroyCity2D();
  const result=await api('/api/world');
  if(!result.ok){
    root.innerHTML=`<div class="rc-error"><strong>Could not load RiftCity</strong><p>${escapeHtml(result.error||'World service unavailable')}</p></div>`;
    return;
  }

  state.world=result.world;
  state.location=result.world?.current||state.location;
  const locations=result.world?.locations||[];
  const entries=locations.map((location,index)=>({
    ...location,
    ...getWorld2DLocationPosition(location.id,index)
  }));

  root.innerHTML=`
    <section class="city2d-shell" aria-label="Playable 2D Downtown">
      <div id="city2d-viewport" class="city2d-viewport">
        <div id="city2d-world" class="city2d-world">
          <img class="city2d-ground" src="${DOWNTOWN_GROUND.src}" alt="" draggable="false">
          <div id="city2d-location-layer" class="city2d-location-layer"></div>
          <div id="city2d-player" class="city2d-player"><span class="city2d-player-body"></span></div>
        </div>
      </div>

      <div class="city2d-top-left">
        <span class="eyebrow">RIFTCITY / DOWNTOWN</span>
        <strong id="city2d-status">Explore Downtown</strong>
        <small>WASD / arrows · Shift run · E enter</small>
      </div>

      <div class="city2d-top-right">
        <button id="city2d-fullscreen" class="city2d-hud-button" type="button">FULLSCREEN</button>
        <button id="city2d-directory-button" class="city2d-hud-button" type="button">CITY DIRECTORY</button>
      </div>

      <div id="city2d-prompt" class="city2d-prompt">
        <div><span>NEARBY</span><strong id="city2d-nearby-name">Location</strong></div>
        <button id="city2d-interact" type="button">ENTER <kbd>E</kbd></button>
      </div>

      <div class="city2d-touch">
        <div id="city2d-joystick" class="city2d-joystick" aria-label="Movement joystick">
          <div class="city2d-joystick-ring"><div id="city2d-joystick-knob" class="city2d-joystick-knob"></div></div>
          <span>MOVE</span>
        </div>
        <div class="city2d-action-pad">
          <button id="city2d-touch-interact" class="city2d-action city2d-action-enter" type="button">ENTER</button>
          <button id="city2d-run" class="city2d-action" type="button">RUN</button>
        </div>
      </div>

      <aside id="city2d-directory" class="city2d-directory" aria-hidden="true">
        <header><div><span class="eyebrow">DOWNTOWN</span><strong>City Directory</strong></div><button id="city2d-directory-close" type="button">×</button></header>
        <div class="city2d-directory-list">
          ${entries.map(entry=>`<button type="button" data-city2d-place="${escapeHtml(entry.id)}"><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.categoryName||entry.categoryId||entry.type||'Location')}</small></button>`).join('')}
        </div>
      </aside>
    </section>`;

  const shell=root.querySelector('.city2d-shell');
  const viewport=root.querySelector('#city2d-viewport');
  const world=root.querySelector('#city2d-world');
  const playerEl=root.querySelector('#city2d-player');
  const layer=root.querySelector('#city2d-location-layer');
  const prompt=root.querySelector('#city2d-prompt');
  const nearbyName=root.querySelector('#city2d-nearby-name');
  const status=root.querySelector('#city2d-status');
  const directory=root.querySelector('#city2d-directory');

  entries.forEach(entry=>{
    const marker=document.createElement('button');
    marker.type='button';
    marker.className='city2d-location-marker';
    marker.dataset.city2dId=entry.id;
    marker.style.left=`${entry.x}px`;
    marker.style.top=`${entry.y}px`;
    marker.innerHTML=`<span>!</span><strong>${escapeHtml(entry.name)}</strong>`;
    marker.addEventListener('click',()=>go(`city/place/${encodeURIComponent(entry.id)}`));
    layer.appendChild(marker);
  });

  const collisionIndex=buildSpatialIndex(WORLD2D_COLLIDERS);
  const locationIndex=buildSpatialIndex(entries.map(e=>({id:e.id,kind:'rect',x:e.x-1,y:e.y-1,width:2,height:2,entry:e})));

  const currentId=state.location?.locationId;
  const currentEntry=entries.find(e=>e.id===currentId);
  let player={
    x:currentEntry?.x??WORLD2D_CONFIG.width*.5,
    y:(currentEntry?.y??WORLD2D_CONFIG.height*.46)+110,
    radius:WORLD2D_CONFIG.playerRadius,
    facingX:0,facingY:1
  };
  player=clampPlayer(player.x,player.y,player.radius);

  const input={x:0,y:0,run:false};
  const keys=new Set();
  const joystick=setupJoystick(root,input);
  let nearest=null;
  let raf=0,last=performance.now();
  let camera={x:player.x,y:player.y,zoom:preferredZoom()};
  let destroyed=false;

  const updateViewportHeight=()=>{
    const vv=window.visualViewport;
    const viewportHeight=vv?.height||window.innerHeight;
    const top=Math.max(0,shell.getBoundingClientRect().top);
    const nav=document.querySelector('#mobile-nav');
    const navH=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().height:0;
    const h=Math.max(330,Math.floor(viewportHeight-top-navH-4));
    shell.style.height=`${h}px`;
    root.style.height=`${h}px`;
    camera.zoom=preferredZoom();
  };

  function preferredZoom(){
    const w=viewport?.clientWidth||window.innerWidth;
    if(w<=430)return .62;
    if(w<=700)return .68;
    if(w<=1000)return .78;
    return .9;
  }

  function worldToScreen(x,y){
    return {
      x:(x-camera.x)*camera.zoom+viewport.clientWidth/2,
      y:(y-camera.y)*camera.zoom+viewport.clientHeight/2
    };
  }

  function updateTransform(){
    world.style.width=`${WORLD2D_CONFIG.width}px`;
    world.style.height=`${WORLD2D_CONFIG.height}px`;
    world.style.transform=`translate(${viewport.clientWidth/2-camera.x*camera.zoom}px,${viewport.clientHeight/2-camera.y*camera.zoom}px) scale(${camera.zoom})`;
    world.style.transformOrigin='0 0';
    playerEl.style.left=`${player.x}px`;
    playerEl.style.top=`${player.y}px`;
  }

  function collides(x,y){
    for(const c of querySpatialIndex(collisionIndex,x,y,1)){
      if(playerHitsCollider(x,y,player.radius,c))return true;
    }
    return false;
  }

  function tryMove(dx,dy){
    const nextX=clampPlayer(player.x+dx,player.y,player.radius);
    if(!collides(nextX.x,nextX.y))player.x=nextX.x;
    const nextY=clampPlayer(player.x,player.y+dy,player.radius);
    if(!collides(nextY.x,nextY.y))player.y=nextY.y;
  }

  function updateNearest(){
    nearest=null;
    let best=WORLD2D_CONFIG.interactRadius;
    for(const candidate of querySpatialIndex(locationIndex,player.x,player.y,1)){
      const entry=candidate.entry;
      const d=Math.hypot(entry.x-player.x,entry.y-player.y);
      if(d<best){best=d;nearest=entry;}
    }
    prompt.classList.toggle('visible',!!nearest);
    if(nearest){
      nearbyName.textContent=nearest.name;
      status.textContent=`Near ${nearest.name}`;
    }else status.textContent='Explore Downtown';
  }

  function interact(){
    if(nearest)go(`city/place/${encodeURIComponent(nearest.id)}`);
  }

  const onKeyDown=e=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    keys.add(e.code);
    if(e.code==='KeyE')interact();
  };
  const onKeyUp=e=>keys.delete(e.code);
  window.addEventListener('keydown',onKeyDown);
  window.addEventListener('keyup',onKeyUp);

  const runButton=root.querySelector('#city2d-run');
  const runStart=e=>{e.preventDefault();input.run=true;runButton.classList.add('active');};
  const runStop=e=>{e.preventDefault();input.run=false;runButton.classList.remove('active');};
  ['pointerdown'].forEach(t=>runButton.addEventListener(t,runStart));
  ['pointerup','pointercancel','pointerleave'].forEach(t=>runButton.addEventListener(t,runStop));

  root.querySelector('#city2d-interact')?.addEventListener('click',interact);
  root.querySelector('#city2d-touch-interact')?.addEventListener('click',interact);

  root.querySelector('#city2d-directory-button')?.addEventListener('click',()=>{
    directory.classList.add('open');directory.setAttribute('aria-hidden','false');
  });
  root.querySelector('#city2d-directory-close')?.addEventListener('click',()=>{
    directory.classList.remove('open');directory.setAttribute('aria-hidden','true');
  });
  root.querySelectorAll('[data-city2d-place]').forEach(btn=>btn.addEventListener('click',()=>{
    const entry=entries.find(e=>e.id===btn.dataset.city2dPlace);
    if(!entry)return;
    player.x=entry.x;player.y=entry.y+110;
    directory.classList.remove('open');
  }));

  const fullscreen=root.querySelector('#city2d-fullscreen');
  fullscreen?.addEventListener('click',async()=>{
    const enabled=!document.body.classList.contains('city2d-game-mode');
    document.body.classList.toggle('city2d-game-mode',enabled);
    fullscreen.textContent=enabled?'EXIT FULLSCREEN':'FULLSCREEN';
    if(enabled){
      try{await (shell.requestFullscreen?.()||shell.webkitRequestFullscreen?.());}catch(_){}
    }else{
      try{await (document.exitFullscreen?.()||document.webkitExitFullscreen?.());}catch(_){}
    }
    setTimeout(updateViewportHeight,50);
  });

  function frame(now){
    if(destroyed)return;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    let x=input.x,y=input.y;
    if(keys.has('KeyA')||keys.has('ArrowLeft'))x-=1;
    if(keys.has('KeyD')||keys.has('ArrowRight'))x+=1;
    if(keys.has('KeyW')||keys.has('ArrowUp'))y-=1;
    if(keys.has('KeyS')||keys.has('ArrowDown'))y+=1;
    const len=Math.hypot(x,y);
    if(len>.04){
      x/=Math.max(1,len);y/=Math.max(1,len);
      player.facingX=x;player.facingY=y;
      const running=input.run||keys.has('ShiftLeft')||keys.has('ShiftRight');
      const speed=running?WORLD2D_CONFIG.runSpeed:WORLD2D_CONFIG.walkSpeed;
      tryMove(x*speed*dt,y*speed*dt);
      playerEl.classList.add('moving');
    }else playerEl.classList.remove('moving');

    const aheadX=player.x+player.facingX*WORLD2D_CONFIG.cameraLookAhead;
    const aheadY=player.y+player.facingY*WORLD2D_CONFIG.cameraLookAhead;
    camera.x+=(aheadX-camera.x)*WORLD2D_CONFIG.cameraLerp;
    camera.y+=(aheadY-camera.y)*WORLD2D_CONFIG.cameraLerp;

    const halfW=viewport.clientWidth/(2*camera.zoom),halfH=viewport.clientHeight/(2*camera.zoom);
    camera.x=Math.max(halfW,Math.min(WORLD2D_CONFIG.width-halfW,camera.x));
    camera.y=Math.max(halfH,Math.min(WORLD2D_CONFIG.height-halfH,camera.y));

    updateNearest();
    updateTransform();
    raf=requestAnimationFrame(frame);
  }

  const onResize=()=>updateViewportHeight();
  window.addEventListener('resize',onResize);
  window.visualViewport?.addEventListener('resize',onResize);

  updateViewportHeight();
  updateTransform();
  raf=requestAnimationFrame(frame);

  activeCity2D={
    destroy(){
      destroyed=true;
      cancelAnimationFrame(raf);
      joystick?.destroy?.();
      window.removeEventListener('keydown',onKeyDown);
      window.removeEventListener('keyup',onKeyUp);
      window.removeEventListener('resize',onResize);
      window.visualViewport?.removeEventListener('resize',onResize);
      root.style.height='';
      shell.style.height='';
      document.body.classList.remove('city2d-game-mode');
    }
  };
}

function setupJoystick(root,input){
  const zone=root.querySelector('#city2d-joystick');
  const ring=zone?.querySelector('.city2d-joystick-ring');
  const knob=root.querySelector('#city2d-joystick-knob');
  if(!zone||!ring||!knob)return null;
  let pointer=null;
  const max=40;
  const reset=()=>{pointer=null;input.x=0;input.y=0;knob.style.transform='translate(0,0)';zone.classList.remove('active');};
  const update=e=>{
    if(e.pointerId!==pointer)return;
    const r=ring.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    let dx=e.clientX-cx,dy=e.clientY-cy;
    const d=Math.hypot(dx,dy);
    if(d>max){dx=dx/d*max;dy=dy/d*max;}
    knob.style.transform=`translate(${dx}px,${dy}px)`;
    input.x=dx/max;input.y=dy/max;
  };
  const down=e=>{e.preventDefault();if(pointer!==null)return;pointer=e.pointerId;zone.classList.add('active');zone.setPointerCapture?.(e.pointerId);update(e);};
  const move=e=>{if(e.pointerId!==pointer)return;e.preventDefault();update(e);};
  const up=e=>{if(e.pointerId!==pointer)return;e.preventDefault();reset();};
  zone.addEventListener('pointerdown',down);zone.addEventListener('pointermove',move);zone.addEventListener('pointerup',up);zone.addEventListener('pointercancel',up);
  return{destroy(){zone.removeEventListener('pointerdown',down);zone.removeEventListener('pointermove',move);zone.removeEventListener('pointerup',up);zone.removeEventListener('pointercancel',up);reset();}};
}

export async function renderLocation(root,id) {
  const result=await api(`/api/world/locations/${encodeURIComponent(id)}`);
  if (!result.ok) {
    root.innerHTML=`<div class="rc-error"><strong>Location unavailable</strong><p>${escapeHtml(result.error||'Could not load location')}</p><a class="rc-button" href="#city" data-route="city">Return to City</a></div>`;
    return;
  }
  const location=result.location, category=result.category;
  state.selectedLocation=location;
  state.location=result.current||state.location;
  const actions=location.actions||[];
  root.innerHTML=`
    <a class="back-link" href="#city" data-route="city">← Return to City</a>
    <section class="location-hero">
      <div><span class="location-code">${escapeHtml(location.code)}</span><span class="eyebrow">${escapeHtml(category?.name||location.categoryId)}</span><h2>${escapeHtml(location.name)}</h2><p>${escapeHtml(location.description)}</p></div>
      <div class="location-status-box"><span>STATUS</span><strong>${escapeHtml(location.status)}</strong><small>${escapeHtml(location.type)}</small></div>
    </section>
    <div class="tag-row">${(location.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div>
    ${panel('Available Services',actions.length?`<div class="service-launch-grid">${actions.map(action=>{
      const route=ROUTE_BY_TYPE[action.type]||ROUTE_BY_TYPE[action.id]||null;
      const shopQuery=action.type==='shop'?`?location=${encodeURIComponent(location.id)}`:'';
      return `<button class="service-launch" data-service-route="${route||''}" data-service-query="${shopQuery}" ${!action.enabled?'disabled':''}>
        <span><strong>${escapeHtml(action.label)}</strong><small>${escapeHtml(action.note||'Service')}</small></span><b>${action.enabled?(route?'OPEN':'INFO'):'LOCKED'}</b>
      </button>`;
    }).join('')}</div>`:empty('No services installed'),{eyebrow:'LOCATION MODULES'})}`;
  root.querySelectorAll('[data-service-route]').forEach(btn=>btn.addEventListener('click',()=>{
    if (!btn.dataset.serviceRoute) return showToast('This service is not installed yet.');
    window.location.hash=`#${btn.dataset.serviceRoute}${btn.dataset.serviceQuery||''}`;
  }));
}
