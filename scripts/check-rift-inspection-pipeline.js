import fs from 'node:fs';
import {compileRiftBuildingProgram} from '../public/rift-building-program.js';
import {compileRiftCityBlock} from '../public/rift-city-block-importer.js';
import {buildRiftInspectionDocument,createRiftInspectionReport,inspectionFocus} from '../public/rift-building-inspection-core.js';

const source=JSON.parse(fs.readFileSync(new URL('../public/riftcity-buildings/riftcity-bank-001.json',import.meta.url),'utf8'));
const authoring=compileRiftBuildingProgram(source,{strict:true});
const report=createRiftInspectionReport(authoring);
const fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};

ok(report.validation.ok,'Bank BuildingProgram is not clean.');
ok(report.clearance.spaces.length>=10,'Inspection report did not measure all Bank spaces.');
for(const space of report.clearance.spaces){
  ok(space.p10>=Math.min(8,space.declaredClearHeight),`${space.id} physical P10 clearance ${space.p10}m is too low.`);
  ok(space.median>=space.declaredClearHeight,`${space.id} median physical clearance ${space.median}m is below authored ${space.declaredClearHeight}m.`);
  ok(space.declaredPassRatio>=.90,`${space.id} only ${Math.round(space.declaredPassRatio*100)}% of supported samples meet authored clearance.`);
}
const vault=report.clearance.spaces.find(x=>x.id==='b1-vault');
const hall=report.clearance.spaces.find(x=>x.id==='f1-grand-hall');
ok(vault?.median>=10,`Grand Vault physically measures only ${vault?.median||0}m median clearance.`);
ok(hall?.median>=10,`Grand Banking Hall physically measures only ${hall?.median||0}m median clearance.`);
ok(report.verticalCores.every(c=>!c.blockedHeadroom&&!c.missingStairs),'Inspection report found blocked stair headroom or missing stairs.');

const cases=[
  ['full',{mode:'full'}],['b1-floor',{mode:'floor',floor:1}],['f1-floor',{mode:'floor',floor:2}],
  ['north-section',{mode:'section',sectionAxis:'z',sectionDepth:3}],['south-section',{mode:'section',sectionAxis:'z',sectionDepth:3}],
  ['west-section',{mode:'section',sectionAxis:'x',sectionDepth:3}],['east-section',{mode:'section',sectionAxis:'x',sectionDepth:3}],
  ['stair-longitudinal-section',{mode:'section',sectionAxis:'z',sectionDepth:2,focus:'grand-stair-b1-f1'}],
  ['stair-transverse-section',{mode:'section',sectionAxis:'x',sectionDepth:3,focus:'grand-stair-b1-f1'}]
];
for(const [label,options] of cases){
  try{
    const doc=buildRiftInspectionDocument(authoring,options),compiled=compileRiftCityBlock(doc);
    ok(compiled.stats.cells>60,`${label} inspection contains too little geometry (${compiled.stats.cells} cells).`);
    if(options.sectionDepth){
      const section=doc.metadata?.inspection?.section,axis=section?.axis==='x'?0:2,size=doc.bounds.max[axis]-doc.bounds.min[axis]+1;
      ok(section?.depth===Number(options.sectionDepth),`${label} did not preserve requested ${options.sectionDepth}m section depth.`);
      ok(size<=Number(options.sectionDepth),`${label} slice is ${size}m thick; expected at most ${options.sectionDepth}m.`);
      ok((section?.solidCells||0)>60,`${label} section metadata reports too little solid geometry (${section?.solidCells||0} cells).`);
    }
  }catch(error){fail.push(`${label}: ${error.message}`)}
}

// Browser URLSearchParams returns null for absent keys. This must never become numeric 0.
const browserStyle=[
  ['browser-center-z',{mode:'section',sectionAxis:'z',sectionAt:null,sectionDepth:'3'}],
  ['browser-center-x',{mode:'section',sectionAxis:'x',sectionAt:'',sectionDepth:'3'}],
  ['browser-stair-z',{mode:'section',sectionAxis:'z',sectionAt:null,sectionDepth:'2',focus:'grand-stair-b1-f1'}],
  ['browser-stair-x',{mode:'section',sectionAxis:'x',sectionAt:null,sectionDepth:'3',focus:'grand-stair-b1-f1'}]
];
for(const [label,options] of browserStyle){
  try{
    const doc=buildRiftInspectionDocument(authoring,options),compiled=compileRiftCityBlock(doc),section=doc.metadata?.inspection?.section,axis=section?.axis==='x'?0:2;
    const focus=inspectionFocus(authoring,options.focus),expected=focus?Math.round(focus.target[axis]):Math.round((authoring.document.bounds.min[axis]+authoring.document.bounds.max[axis])/2);
    ok(section?.at===expected,`${label} resolved sectionAt=${section?.at}; expected fallback ${expected}.`);
    ok(section?.depth===Number(options.sectionDepth),`${label} lost browser-style sectionDepth '${options.sectionDepth}'.`);
    ok(compiled.stats.cells>60,`${label} browser-style section contains too little geometry (${compiled.stats.cells} cells).`);
  }catch(error){fail.push(`${label}: ${error.message}`)}
}

if(fail.length){console.error('[building-inspection-pipeline] FAIL');for(const item of fail)console.error(` - ${item}`);process.exit(1)}
console.log(`[building-inspection-pipeline] PASS · ${report.clearance.spaces.length} spaces physically measured · Vault ${vault.median}m median · Grand Hall ${hall.median}m median · ${cases.length} inspection modes + ${browserStyle.length} browser-query regressions validated.`);
