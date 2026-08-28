import fs from 'node:fs';
import {compileRiftBuildingProgram} from '../public/rift-building-program.js';
import {compileRiftCityBlock} from '../public/rift-city-block-importer.js';
import {buildRiftInspectionDocument,createRiftInspectionReport} from '../public/rift-building-inspection-core.js';

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

for(const [label,options] of [
  ['full',{mode:'full'}],['b1-floor',{mode:'floor',floor:1}],['f1-floor',{mode:'floor',floor:2}],
  ['north-section',{mode:'section',sectionAxis:'z',sectionSide:'low'}],['south-section',{mode:'section',sectionAxis:'z',sectionSide:'high'}],
  ['west-section',{mode:'section',sectionAxis:'x',sectionSide:'low'}],['east-section',{mode:'section',sectionAxis:'x',sectionSide:'high'}],
  ['stair-section',{mode:'section',sectionAxis:'z',sectionSide:'low',focus:'grand-stair-b1-f1'}]
]){
  try{
    const doc=buildRiftInspectionDocument(authoring,options);const compiled=compileRiftCityBlock(doc);
    ok(compiled.stats.cells>100,`${label} inspection contains too little geometry (${compiled.stats.cells} cells).`);
  }catch(error){fail.push(`${label}: ${error.message}`)}
}

if(fail.length){console.error('[building-inspection-pipeline] FAIL');for(const item of fail)console.error(` - ${item}`);process.exit(1)}
console.log(`[building-inspection-pipeline] PASS · ${report.clearance.spaces.length} spaces physically measured · Vault ${vault.median}m median · Grand Hall ${hall.median}m median · 8 render slice modes validated.`);
