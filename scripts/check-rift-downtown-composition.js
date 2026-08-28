import fs from 'node:fs';
import {composeRiftBuildingProgramIntoCityBlock,RIFT_DOWNTOWN_BANK_REPLACEMENT} from '../public/rift-world-composer.js';
import {compileRiftCityBlock} from '../public/rift-city-block-importer.js';
const base=JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/downtown-block-001.json',import.meta.url),'utf8'));
const bank=JSON.parse(fs.readFileSync(new URL('../public/riftcity-buildings/riftcity-bank-001.json',import.meta.url),'utf8'));
const failures=[]; const ok=(v,m)=>{if(!v)failures.push(m)};
try{
 const r=composeRiftBuildingProgramIntoCityBlock(base,bank,RIFT_DOWNTOWN_BANK_REPLACEMENT),s=r.overlay.semantics,i=s.interior;
 ok(r.overlay.report.ok,'Bank BuildingProgram report is not clean.');
 ok(r.stats.removedOperations===RIFT_DOWNTOWN_BANK_REPLACEMENT.removeNames.length,'Legacy Bank replacement count drifted.');
 ok(r.stats.overlayOperations>=180,`Bank generated only ${r.stats.overlayOperations} ops.`);

 // H1.95 deliberately removes the old basement/mezzanine concept. The public Bank is one monumental occupied level.
 ok(s.floors.length===1,`Bank occupied-level metadata ${s.floors.length} != 1.`);
 ok(bank.building?.floors===1,'Bank must remain one occupied floor.');
 ok(bank.building?.ground_floor===1,'Street-level Bank floor must remain floor 1.');
 ok(bank.building?.floor_height===16,'Bank shell must keep the 16m maximum storey height.');
 ok(bank.building?.occupancy_target>=300,'Bank occupancy target must remain at least 300.');
 ok(bank.building?.interior?.minimum_clear_height>=10,'Interior minimum clear height must remain at least 10m.');

 const o=bank.building.origin||[0,0,0],m=bank.building.masses||[];
 const minX=Math.min(...m.map(x=>o[0]+x.origin[0])),maxX=Math.max(...m.map(x=>o[0]+x.origin[0]+x.size[0]-1));
 const minZ=Math.min(...m.map(x=>o[2]+x.origin[2])),maxZ=Math.max(...m.map(x=>o[2]+x.origin[2]+x.size[1]-1));
 const fw=maxX-minX+1,fd=maxZ-minZ+1;
 ok(fw>=50&&fd>=48,`Bank footprint ${fw}x${fd}m is too small.`);

 // The roof must stay visibly articulated rather than collapsing back to a flat cap.
 const roofMasses=m.filter(x=>(x.tags||[]).includes('roof'));
 const roofLevels=[...new Set(roofMasses.map(x=>x.origin[1]))].sort((a,b)=>a-b);
 const roofPeak=Math.max(...roofMasses.map(x=>x.origin[1]+(x.floor_height||1)*(x.floors||1)-1));
 ok(roofMasses.length>=8,`Bank roof has only ${roofMasses.length} authored detail masses.`);
 ok(roofLevels.length>=5,`Bank roof has only ${roofLevels.length} distinct height tiers.`);
 ok(roofPeak>=29,`Bank roof peak ${roofPeak}m is too low.`);
 ok(roofMasses.some(x=>(x.tags||[]).includes('clerestory')),'Bank roof clerestory is missing.');
 ok(roofMasses.some(x=>(x.tags||[]).includes('pediment')),'Bank front pediment is missing.');
 ok(roofMasses.some(x=>(x.tags||[]).includes('corner-turret')),'Bank roof corner turrets are missing.');

 ok(i,'Compiled Interior Architecture semantics are missing.');
 ok((i?.spaces?.length||0)>=10,'Bank needs at least 10 actual spaces.');
 ok((i?.portals?.length||0)>=9,'Bank needs at least 9 real portals.');
 ok((i?.verticalCores?.length||0)===0,'One-level Bank must not contain legacy stair cores.');
 ok(!i?.graph?.unreachable?.length,'Bank has unreachable interior spaces.');
 ok(!r.overlay.report.stats.invalidVerticalCores,'Bank has an invalid vertical core.');
 ok(!r.overlay.report.stats.blockedPortals,'Bank has a blocked portal.');

 const area=x=>(x.max[0]-x.min[0]+1)*(x.max[1]-x.min[1]+1);
 const vault=i?.spaces?.find(x=>x.id==='main-vault'),hall=i?.spaces?.find(x=>x.id==='grand-hall'),tellers=i?.spaces?.find(x=>x.id==='teller-gallery');
 ok(vault&&area(vault)>=190&&vault.clearHeight>=12,'Grand Main Vault must remain at least 190m² with 12m clear height.');
 ok(hall&&area(hall)>=500&&hall.clearHeight>=14,'Grand Banking Hall must remain at least 500m² with 14m clear height.');
 ok(tellers&&area(tellers)>=250&&tellers.clearHeight>=13,'Teller Gallery must remain at least 250m² with 13m clear height.');
 for(const space of i?.spaces||[]) ok(space.clearHeight>=10&&(space.clearRatio??1)>=.65,`${space.id} must remain a genuinely tall Bank room (>=10m clear).`);

 for(const required of ['west-loan-offices','east-executive-offices','west-operations','east-security','records-room','cash-processing','secure-corridor'])
   ok(i?.spaces?.some(x=>x.id===required),`Bank space ${required} is missing.`);

 const names=(bank.site_ops||[]).map(x=>String(x.name||''));
 for(const feature of ['Bank grand forecourt','Portico entablature','Pediment gold crown','Teller counter base','Security surveillance console','Vault deposit box wall A','Roof crown gold cap'])
   ok(names.includes(feature),`Bank physical feature '${feature}' is missing.`);

 ok(s.entrances.length>=3,'Bank needs at least 3 entrances.');
 for(const a of ['bank-service-desk','teller-line','manager-office','security-console','main-vault-center','armored-service'])
   ok(s.anchors.some(x=>x.id===a),`Bank anchor ${a} is missing.`);

 // H1.95 is street-level only. The composed district must no longer be expanded downward just to service a Bank basement.
 ok(r.document.bounds.min[1]>=base.bounds.min[1],`Bank unexpectedly expanded Downtown downward to Y ${r.document.bounds.min[1]}.`);
 ok(r.stats.boundsVolume<=3_000_000,'Downtown composed bounds exceed 3M cells.');
 const c=compileRiftCityBlock(r.document);
 ok(c.stats.cells>=85000,'Composed Downtown cell count is unexpectedly low.');
 ok(c.stats.triangles>=300000,'Composed Downtown triangle count is unexpectedly low.');
 if(!failures.length)console.log(`[downtown-composition] PASS · bank ${r.overlay.report.stats.structuralCells.toLocaleString()} structural cells / ${r.stats.overlayOperations} ops · footprint ${fw}x${fd}m · one occupied level · grand hall ${area(hall)}m² @ ${hall.clearHeight}m clear · vault ${area(vault)}m² @ ${vault.clearHeight}m clear · ${roofMasses.length} roof masses / ${roofLevels.length} roof tiers / ${roofPeak}m peak · Downtown ${c.stats.cells.toLocaleString()} cells / ${c.stats.triangles.toLocaleString()} tris · bounds volume ${r.stats.boundsVolume.toLocaleString()}.`);
}catch(e){failures.push(e?.stack||e?.message||String(e))}
if(failures.length){console.error('[downtown-composition] FAIL');for(const f of failures)console.error(` - ${f}`);process.exit(1)}
