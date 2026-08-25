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
  const stick=root.querySelector('#bw-stick');
  const knob=root.querySelector('#bw-knob');

  for(const b of BLOCK1.buildings){
    const el=document.createElement('div');
    el.className=`bw-building tone-${b.tone}`;
    el.style.cssText=`left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
    el.innerHTML=`<div class="bw-roof"></div><div class="bw-upper">${'<i></i>'.repeat(b.tone==='apartment'?8:5)}</div><div class="bw-storefront"><b>${b.sign}</b><span class="bw-door"></span><span class="bw-window"></span></div>`;
    buildings.appendChild(el);
  }
  const alley=document.createElement('div');
  alley.className='bw-alley';
  alley.style.cssText=`left:${BLOCK1.alley.x}px;top:${BLOCK1.alley.y}px;width:${BLOCK1.alley.width}px;height:${BLOCK1.alley.height}px`;
  buildings.appendChild(alley);

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
      const doorX=b.x+b.w*.5, doorY=560;
      const d=Math.hypot(state.x-doorX,state.y-doorY);
      if(d<dist){dist=d;best=b;}
    }
    return dist<190?best:null;
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
    ny=Math.max(610,Math.min(1225,ny));
    // Building fronts are solid; the player approaches doors from the sidewalk.
    if(ny<625)ny=625;
    state.x=nx;state.y=ny;
    player.style.left=`${state.x}px`; player.style.top=`${state.y}px`;
    const cameraX=Math.max(0,Math.min(BLOCK1.width-viewport.clientWidth,state.x-viewport.clientWidth*.46));
    scene.style.transform=`translate3d(${-cameraX}px,0,0)`;
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
  };
}
