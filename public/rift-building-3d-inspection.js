import {RiftCamera,RiftEngine} from './rift-engine.js';
import {compileRiftCityBlock} from './rift-city-block-importer.js';
import {compileRiftBuildingProgram} from './rift-building-program.js';
import {buildRiftInspectionDocument,createRiftInspectionReport,inspectionFocus} from './rift-building-inspection-core.js';

const canvas=document.querySelector('#inspection-canvas');
const status=document.querySelector('#inspection-status');
const params=new URLSearchParams(location.search);
const allowedViews=new Set(['top','north','east','south','west','iso-nw','iso-ne','iso-sw','iso-se','inside-north','inside-east','inside-south','inside-west']);
let engine=null,camera=null,compiled=null,authoring=null,report=null;

function setStatus(v){if(status)status.textContent=String(v||'')}
function queryParam(name){return params.has(name)?params.get(name):undefined}
function safeProgramUrl(raw){
  raw=String(raw||'./rift-buildings/legacy-building-fixture-001.json').trim();
  if(/^(?:[a-z]+:)?\/\//i.test(raw))throw new Error('3D Building Inspector only loads local source-controlled JSON.');
  const url=new URL(raw,import.meta.url);if(url.origin!==location.origin)throw new Error('Inspection program must stay on current origin.');return url;
}
async function loadJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`BuildingProgram request failed with HTTP ${r.status}.`);return r.json()}

function roomFocus(authoring,id){
  if(!id)return null;
  const space=(authoring.semantics?.interior?.spaces||[]).find(item=>item.id===id);if(!space)return null;
  const floor=(authoring.semantics?.floors||[]).find(item=>item.floor===space.floor);if(!floor)return null;
  const min=space.local?.min||[space.min[0],0,space.min[1]],max=space.local?.max||[space.max[0],0,space.max[1]];
  const width=max[0]-min[0]+1,depth=max[2]-min[2]+1,clear=Math.max(2,Number(space.clearHeight||4));
  return{kind:'room',id:space.id,name:space.name,space,target:[(min[0]+max[0]+1)/2,floor.localY+Math.min(3,Math.max(2,clear*.3)),(min[2]+max[2]+1)/2],span:Math.max(width,depth),eyeRadius:Math.max(3,Math.min(8,Math.min(width,depth)*.28))};
}

function cameraFor(block,view,focus,worldOrigin=[0,0,0]){
  const b=block.worldBounds,min=b.min,max=b.max;
  const width=max[0]-min[0]+1,height=max[1]-min[1]+1,depth=max[2]-min[2]+1,span=Math.max(width,depth,height*1.25);
  const center=focus?.target?focus.target.map((v,i)=>v+(worldOrigin?.[i]||0)):[(min[0]+max[0]+1)/2,(min[1]+max[1]+1)/2,(min[2]+max[2]+1)/2];
  const focusSpan=focus?.span||span,inside=view.startsWith('inside-'),sideView=['north','east','south','west'].includes(view);
  const next=new RiftCamera({projection:sideView?'orthographic':'perspective',alpha:-Math.PI/2,beta:.82,radius:Math.max(18,focusSpan*1.65),minRadius:.5,maxRadius:600,orthoSize:Math.max(14,focusSpan*1.22),minOrthoSize:6,maxOrthoSize:500,fov:inside?Math.PI/2.65:Math.PI/3.15,near:.03,far:1000,minBeta:.02,maxBeta:1.56});
  if(inside){
    next.setProjection('perspective');next.beta=1.52;next.radius=focus?.eyeRadius||5;
    next.alpha=view==='inside-north'?Math.PI/2:view==='inside-east'?Math.PI:view==='inside-south'?-Math.PI/2:0;
  }else if(view==='top'){next.setProjection('orthographic');next.alpha=-Math.PI/2;next.beta=.025;next.orthoSize=Math.max(16,focusSpan*1.22)}
  else if(sideView){next.setProjection('orthographic');next.beta=Math.PI/2;next.alpha=view==='north'?-Math.PI/2:view==='south'?Math.PI/2:view==='east'?0:Math.PI;next.orthoSize=Math.max(14,focusSpan*1.18)}
  else{
    next.setProjection('perspective');next.beta=.72;next.radius=Math.max(20,focusSpan*1.65);
    next.alpha=view==='iso-ne'?-Math.PI/4:view==='iso-se'?Math.PI/4:view==='iso-sw'?3*Math.PI/4:-3*Math.PI/4;
  }
  next.setTarget(...center);next.updatePosition();return next;
}

function render(){if(!engine||!camera)return;const ratio=Math.min(Math.max(1,devicePixelRatio||1),1.75);engine.resize(ratio);engine.render(camera)}
function clearanceSummary(floor,spaceId){
  let rows=report.clearance.spaces.filter(x=>!floor||x.floor===floor);if(spaceId)rows=rows.filter(x=>x.id===spaceId);if(!rows.length)return 'no authored spaces';
  const worst=rows.reduce((a,b)=>a.p10<b.p10?a:b);return `physical clearance P10 ${worst.p10}m · median ${worst.median}m · authored ${worst.declaredClearHeight}m · ${Math.round(worst.declaredPassRatio*100)}% pass`;
}

async function boot(){
  if(!canvas)throw new Error('Inspection canvas is missing.');
  const url=safeProgramUrl(params.get('program')),source=await loadJson(url);
  authoring=compileRiftBuildingProgram(source,{strict:true});report=createRiftInspectionReport(authoring);
  const viewRaw=String(params.get('view')||'iso-nw').toLowerCase(),view=allowedViews.has(viewRaw)?viewRaw:'iso-nw';
  const modeRaw=String(params.get('mode')||'full').toLowerCase(),mode=['full','floor','section'].includes(modeRaw)?modeRaw:'full';
  const floor=Math.max(0,Number.parseInt(params.get('floor')||'0',10)||0),focusId=String(params.get('focus')||'').trim(),spaceId=String(params.get('space')||'').trim();
  const focus=roomFocus(authoring,spaceId)||inspectionFocus(authoring,focusId);
  if(view.startsWith('inside-')&&!focus?.space)throw new Error('Eye-level inside views require ?space=<interior-space-id>.');
  const inspectionDocument=buildRiftInspectionDocument(authoring,{mode,floor,sectionAxis:queryParam('sectionAxis'),sectionSide:queryParam('sectionSide'),sectionAt:queryParam('sectionAt'),sectionDepth:queryParam('sectionDepth'),focus:focusId});
  compiled=compileRiftCityBlock(inspectionDocument);
  engine=new RiftEngine(canvas,{antialias:true,clearColor:[.035,.045,.055],fogColor:[.035,.045,.055],fogStart:220,fogEnd:800});
  for(const mesh of compiled.meshes)engine.addMesh(mesh.geometry,{color:'#ffffff',noise:0,blockGrid:.17,blockFaceShade:1,blockElevationCue:.008,blockElevationBase:compiled.worldBounds.min[1],doubleSided:false});
  camera=cameraFor(compiled,view,focus,authoring.semantics?.worldOrigin||[0,0,0]);render();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));render();
  const sectionInfo=inspectionDocument.metadata?.inspection?.section,section=mode==='section'?` · ${String(sectionInfo?.axis||queryParam('sectionAxis')||'z').toUpperCase()} @ ${sectionInfo?.at??'?'}${sectionInfo?.depth?` · ${sectionInfo.depth}m SLICE`:''}${Number.isFinite(sectionInfo?.solidCells)?` · ${sectionInfo.solidCells.toLocaleString()} CELLS`:''}`:'',room=focus?.space?` · ${focus.name}`:'';
  setStatus(`${authoring.semantics.name} · ${mode.toUpperCase()}${floor?` F${floor}`:''}${section}${room} · ${view.toUpperCase()} · ${clearanceSummary(floor,spaceId)} · ${compiled.stats.cells.toLocaleString()} cells`);
  document.documentElement.dataset.riftInspectionReady='1';document.title=`READY · ${authoring.semantics.name} · ${mode} · ${view}`;
  window.RiftCityBuilding3DInspection=Object.freeze({version:5,view,mode,floor,spaceId,section:sectionInfo||null,report,stats:{...compiled.stats},capturePng(){render();const gl=engine.gl,w=canvas.width,h=canvas.height,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const out=document.createElement('canvas');out.width=w;out.height=h;const c=out.getContext('2d',{alpha:false}),img=c.createImageData(w,h),stride=w*4;for(let y=0;y<h;y++)img.data.set(pixels.subarray((h-1-y)*stride,(h-y)*stride),y*stride);c.putImageData(img,0,0);return out.toDataURL('image/png')}});
}
window.addEventListener('resize',render);
boot().catch(error=>{console.error(error);document.documentElement.dataset.riftInspectionError='1';document.title='ERROR · RiftCity Building 3D Inspection';setStatus(error?.message||String(error))});
