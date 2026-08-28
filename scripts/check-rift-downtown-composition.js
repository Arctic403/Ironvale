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
 ok(r.stats.overlayOperations>=120,`Bank generated only ${r.stats.overlayOperations} ops.`);
 ok(s.floors.length===2,`Bank level metadata ${s.floors.length} != 2 (B1 + F1).`);
 ok(bank.building?.ground_floor===2,'Ground floor must remain level 2 above B1.');
 ok(bank.building?.floor_height>=10,'Bank storey spacing must remain at least 10m.');
 ok(bank.building?.occupancy_target>=250,'Bank occupancy target must remain at least 250.');
 ok(bank.building?.interior?.minimum_clear_height>=4,'Interior minimum clear height must remain at least 4m.');
 const o=bank.building.origin||[0,0,0],m=bank.building.masses||[];
 const minX=Math.min(...m.map(x=>o[0]+x.origin[0])),maxX=Math.max(...m.map(x=>o[0]+x.origin[0]+x.size[0]-1));
 const minZ=Math.min(...m.map(x=>o[2]+x.origin[2])),maxZ=Math.max(...m.map(x=>o[2]+x.origin[2]+x.size[1]-1));
 const fw=maxX-minX+1,fd=maxZ-minZ+1; ok(fw>=50&&fd>=48,`Bank footprint ${fw}x${fd}m is too small.`);
 ok(i,'Compiled Interior Architecture semantics are missing.');
 ok((i?.spaces?.length||0)>=10,'Bank needs at least 10 actual spaces.'); ok((i?.portals?.length||0)>=8,'Bank needs at least 8 real portals.');
 ok((i?.verticalCores?.length||0)===1,'Bank must have exactly one B1→F1 stair core.');
 ok(!i?.graph?.unreachable?.length,'Bank has unreachable interior spaces.'); ok(!r.overlay.report.stats.invalidVerticalCores,'Bank has an invalid stair core.'); ok(!r.overlay.report.stats.blockedPortals,'Bank has a blocked portal.');
 const area=x=>(x.max[0]-x.min[0]+1)*(x.max[1]-x.min[1]+1),vault=i?.spaces?.find(x=>x.id==='b1-vault'),hall=i?.spaces?.find(x=>x.id==='f1-grand-hall');
 ok(vault&&area(vault)>=450&&vault.clearHeight>=8,'Grand Vault must be at least 450m² with 8m clear height.');
 ok(hall&&area(hall)>=700&&hall.clearHeight>=8,'Grand Banking Hall must be at least 700m² with 8m clear height.');
 for(const space of i?.spaces||[]) ok(space.clearHeight>=4&&(space.clearRatio??1)>=.65,`${space.id} fails full-height room clearance.`);
 for(const core of i?.verticalCores||[]){ok(core.width>=8,`${core.id} must remain at least 8m wide.`);ok(core.removedFloorCells>=core.width,`${core.id} opening is too small.`);ok(core.topLandings===core.width&&core.bottomLandings===core.width,`${core.id} landing support is incomplete.`);ok(!core.blockedHeadroom&&!core.missingStairs,`${core.id} has blocked headroom or missing stairs.`)}
 const names=(bank.site_ops||[]).map(x=>String(x.name||'')); for(const l of ['B','A','N','K'])ok(names.some(n=>n.startsWith(`BANK letter ${l}`)),`BANK facade lettering is missing ${l}.`);
 ok(s.entrances.length>=3,'Bank needs at least 3 entrances.'); for(const a of ['bank-teller-counter','bank-vault-door','bank-main-stairs'])ok(s.anchors.some(x=>x.id===a),`Bank anchor ${a} is missing.`);
 ok(r.document.bounds.min[1]===-10,`Downtown basement bound ${r.document.bounds.min[1]} != -10.`); ok(r.stats.boundsVolume<=3_000_000,'Downtown composed bounds exceed 3M cells.');
 const c=compileRiftCityBlock(r.document); ok(c.stats.cells>=85000,'Composed Downtown cell count is unexpectedly low.'); ok(c.stats.triangles>=300000,'Composed Downtown triangle count is unexpectedly low.');
 if(!failures.length)console.log(`[downtown-composition] PASS · bank ${r.overlay.report.stats.structuralCells.toLocaleString()} structural cells / ${r.stats.overlayOperations} ops · footprint ${fw}x${fd}m · B1 + F1 · 8m grand-room clearance · structural BANK sign · Downtown ${c.stats.cells.toLocaleString()} cells / ${c.stats.triangles.toLocaleString()} tris · bounds volume ${r.stats.boundsVolume.toLocaleString()}.`);
}catch(e){failures.push(e?.stack||e?.message||String(e))}
if(failures.length){console.error('[downtown-composition] FAIL');for(const f of failures)console.error(` - ${f}`);process.exit(1)}
