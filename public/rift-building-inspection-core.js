const clone=value=>JSON.parse(JSON.stringify(value));
const key=(x,y,z)=>`${x}|${y}|${z}`;
const inside=(b,p)=>p.every((v,i)=>v>=b.min[i]&&v<=b.max[i]);
const boxIntersection=(a,b)=>{const min=a.min.map((v,i)=>Math.max(v,b.min[i])),max=a.max.map((v,i)=>Math.min(v,b.max[i]));return min.every((v,i)=>v<=max[i])?{min,max}:null};
const percentile=(values,p)=>{if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*p)))]};

function solidState(document,state){
  const raw=document.palette?.[state]||{};
  const shape=String(raw.shape||'full').toLowerCase();
  const kind=String(raw.kind||'').toLowerCase();
  return Number(raw.material_id)!==0&&shape!=='air'&&kind!=='detail'&&kind!=='fluid'&&shape!=='grass_detail'&&shape!=='grass'&&shape!=='water';
}
function cellValue(op){return{state:op.state,role:String(op._semanticRole||''),group:String(op._semanticGroup||''),name:String(op.name||'')}}
function applyBox(cells,op,write){for(let y=op.min[1];y<=op.max[1];y++)for(let z=op.min[2];z<=op.max[2];z++)for(let x=op.min[0];x<=op.max[0];x++)write(x,y,z)}

export function replayRiftBuildingCells(document){
  const cells=new Map();
  for(const op of document.ops||[]){
    const type=String(op.op||'').toLowerCase(),value=cellValue(op);
    if(type==='set'){
      const k=key(...op.at);if(solidState(document,op.state))cells.set(k,value);else cells.delete(k);continue;
    }
    if(!op.min||!op.max)continue;
    if(type==='fill_box')applyBox(cells,op,(x,y,z)=>{const k=key(x,y,z);if(solidState(document,op.state))cells.set(k,value);else cells.delete(k)});
    else if(type==='cut_box')applyBox(cells,op,(x,y,z)=>cells.delete(key(x,y,z)));
    else if(type==='hollow_box')applyBox(cells,op,(x,y,z)=>{const edge=x===op.min[0]||x===op.max[0]||y===op.min[1]||y===op.max[1]||z===op.min[2]||z===op.max[2],k=key(x,y,z);if(edge&&solidState(document,op.state))cells.set(k,value);else if(!edge)cells.delete(k)});
  }
  return cells;
}

function localRect(space){
  if(space.local?.min&&space.local?.max)return{min:[space.local.min[0],space.local.min[2]],max:[space.local.max[0],space.local.max[2]]};
  return{min:[space.min[0],space.min[1]],max:[space.max[0],space.max[1]]};
}
function architecturalColumn(cells,x,z,floorY,ceilingY){
  for(let y=floorY+1;y<ceilingY;y++){
    const cell=cells.get(key(x,y,z));
    if(!cell)continue;
    if(cell.role==='stair'||cell.role==='interior-wall')return cell.role;
  }
  return null;
}

export function measureRiftInteriorClearance(authoring){
  const document=authoring.document,interior=authoring.semantics?.interior;
  if(!interior)return{spaces:[],summary:{spaces:0,minimum:0,p10:0,median:0,declaredPassRatio:1}};
  const cells=replayRiftBuildingCells(document),floors=authoring.semantics.floors||[],reports=[];
  for(const space of interior.spaces||[]){
    const floorMeta=floors.find(item=>item.floor===space.floor);if(!floorMeta)continue;
    const floorY=floorMeta.localY,next=floors.find(item=>item.floor===space.floor+1),ceilingY=next?next.localY:document.bounds.max[1]+1,rect=localRect(space),heights=[];
    let excludedStairColumns=0,excludedWallColumns=0,unsupportedColumns=0;
    for(let z=rect.min[1];z<=rect.max[1];z++)for(let x=rect.min[0];x<=rect.max[0];x++){
      const support=cells.get(key(x,floorY,z));
      if(!support||support.role!=='floor'){unsupportedColumns++;continue}
      const architectural=architecturalColumn(cells,x,z,floorY,ceilingY);
      if(architectural==='stair'){excludedStairColumns++;continue}
      if(architectural==='interior-wall'){excludedWallColumns++;continue}
      let clear=0;
      for(let y=floorY+1;y<ceilingY;y++){if(cells.has(key(x,y,z)))break;clear++}
      heights.push(clear);
    }
    const declared=Number(space.clearHeight||0),pass=heights.filter(v=>v>=declared).length;
    reports.push({
      id:space.id,name:space.name,floor:space.floor,declaredClearHeight:declared,samples:heights.length,
      excludedStairColumns,excludedWallColumns,unsupportedColumns,
      minimum:heights.length?Math.min(...heights):0,p10:percentile(heights,.10),median:percentile(heights,.50),p90:percentile(heights,.90),maximum:heights.length?Math.max(...heights):0,
      declaredPassRatio:heights.length?pass/heights.length:0
    });
  }
  const medians=reports.map(x=>x.median),p10s=reports.map(x=>x.p10),mins=reports.map(x=>x.minimum);
  return{spaces:reports,summary:{spaces:reports.length,minimum:mins.length?Math.min(...mins):0,p10:p10s.length?Math.min(...p10s):0,median:medians.length?Math.min(...medians):0,declaredPassRatio:reports.length?Math.min(...reports.map(x=>x.declaredPassRatio)):1}};
}

function clipOp(op,bounds){
  const type=String(op.op||'').toLowerCase();if(type==='set')return inside(bounds,op.at)?clone(op):null;if(!op.min||!op.max)return clone(op);
  const hit=boxIntersection({min:op.min,max:op.max},bounds);if(!hit)return null;const next=clone(op);next.min=hit.min;next.max=hit.max;return next;
}
function clampInt(value,min,max){return Math.max(min,Math.min(max,Math.round(value)))}

export function buildRiftInspectionDocument(authoring,options={}){
  const mode=String(options.mode||'full').toLowerCase(),document=clone(authoring.document),floors=authoring.semantics.floors||[],floor=Number(options.floor)||0;let bounds=clone(document.bounds),section=null;
  if(floor){const meta=floors.find(item=>item.floor===floor);if(!meta)throw new Error(`Inspection floor ${floor} does not exist.`);const next=floors.find(item=>item.floor===floor+1);bounds.min[1]=meta.localY;bounds.max[1]=next?next.localY-1:document.bounds.max[1]}
  if(mode==='section'){
    const axisName=String(options.sectionAxis||'z').toLowerCase()==='x'?'x':'z',axis=axisName==='x'?0:2,side=String(options.sectionSide||'low').toLowerCase()==='high'?'high':'low',focus=inspectionFocus(authoring,options.focus),fallback=focus?Math.round(focus.target[axis]):Math.round((bounds.min[axis]+bounds.max[axis])/2),requested=Number.isFinite(Number(options.sectionAt))?Number(options.sectionAt):fallback,at=clampInt(requested,bounds.min[axis],bounds.max[axis]),depthValue=Number(options.sectionDepth),depth=Number.isFinite(depthValue)&&depthValue>0?Math.max(1,Math.round(depthValue)):0;
    if(depth){
      const before=Math.floor((depth-1)/2),after=depth-1-before;
      bounds.min[axis]=Math.max(bounds.min[axis],at-before);bounds.max[axis]=Math.min(bounds.max[axis],at+after);
    }else if(side==='low')bounds.max[axis]=Math.min(bounds.max[axis],at);else bounds.min[axis]=Math.max(bounds.min[axis],at);
    section={axis:axisName,side,at,depth:depth||null,bounds:{min:[...bounds.min],max:[...bounds.max]}};
  }
  document.bounds=bounds;document.ops=(document.ops||[]).map(op=>clipOp(op,bounds)).filter(Boolean).filter(op=>!(mode==='floor'&&String(op._semanticRole||'')==='roof'));
  document.metadata={...(document.metadata||{}),inspection:{mode,floor:floor||null,section}};
  document.id=`${document.id}-inspection-${mode}${floor?`-f${floor}`:''}`;document.name=`${document.name} · inspection ${mode}${floor?` · F${floor}`:''}`;return document;
}

export function inspectionFocus(authoring,focusId){
  if(!focusId)return null;const core=(authoring.semantics?.interior?.verticalCores||[]).find(item=>item.id===focusId);if(!core)return null;
  const cells=core.openingCellsLocal||[],points=cells.length?cells.map(p=>[p[0],p[1],p[2]]):[core.local||core.at],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]||0),zs=points.map(p=>p[2]??p[1]);
  return{target:[(Math.min(...xs)+Math.max(...xs)+1)/2,(Math.min(...ys)+Math.max(...ys)+1)/2,(Math.min(...zs)+Math.max(...zs)+1)/2],span:Math.max(12,Number(core.width||2)*2,Number(core.steps||4)*1.3),core};
}

export function createRiftInspectionReport(authoring){
  const clearance=measureRiftInteriorClearance(authoring),interior=authoring.semantics?.interior;
  return{version:1,buildingId:authoring.semantics.buildingId,name:authoring.semantics.name,worldBounds:authoring.semantics.worldBounds,
    floors:(authoring.semantics.floors||[]).map(item=>({floor:item.floor,localY:item.localY,worldY:item.worldY})),clearance,
    portals:(interior?.portals||[]).map(p=>({id:p.id,floor:p.floor,width:p.width,height:p.height,blocked:!!p.blocked})),
    verticalCores:(interior?.verticalCores||[]).map(c=>({id:c.id,fromFloor:c.fromFloor,toFloor:c.toFloor,width:c.width,steps:c.steps,headClearance:c.headClearance,removedFloorCells:c.removedFloorCells,topLandings:c.topLandings,bottomLandings:c.bottomLandings,blockedHeadroom:!!c.blockedHeadroom,missingStairs:!!c.missingStairs})),
    validation:{ok:authoring.report.ok,errors:authoring.report.stats.errors,warnings:authoring.report.stats.warnings,blockedPortals:authoring.report.stats.blockedPortals||0,invalidVerticalCores:authoring.report.stats.invalidVerticalCores||0}};
}
