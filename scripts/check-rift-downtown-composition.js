import fs from 'node:fs';
import {composeRiftBuildingProgramIntoCityBlock,RIFT_DOWNTOWN_BANK_REPLACEMENT} from '../public/rift-world-composer.js';
import {compileRiftCityBlock} from '../public/rift-city-block-importer.js';
const base=JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/downtown-block-001.json',import.meta.url),'utf8'));
const bank=JSON.parse(fs.readFileSync(new URL('../public/riftcity-buildings/riftcity-bank-001.json',import.meta.url),'utf8'));
const worldIndex=JSON.parse(fs.readFileSync(new URL('../public/riftcity-blocks/world-index.json',import.meta.url),'utf8'));
const appSource=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const runtimeSource=fs.readFileSync(new URL('../public/rift-world-composition-runtime.js',import.meta.url),'utf8');
const failures=[]; const ok=(v,m)=>{if(!v)failures.push(m)};
try{
 const r=composeRiftBuildingProgramIntoCityBlock(base,bank,RIFT_DOWNTOWN_BANK_REPLACEMENT),s=r.overlay.semantics,i=s.interior;
 ok(r.overlay.report.ok,'Bank BuildingProgram report is not clean.');
 ok(r.stats.removedOperations===RIFT_DOWNTOWN_BANK_REPLACEMENT.removeNames.length,'Legacy Bank replacement count drifted.');
 ok(r.stats.overlayOperations>=180,`Bank generated only ${r.stats.overlayOperations} ops.`);

 ok(appSource.includes("import './rift-world-composition-runtime.js';"),'app.js no longer directly depends on the Downtown composition runtime.');
 ok(runtimeSource.includes("BANK_BUNDLE_REVISION = 'h2.01-research-bank-v1'"),'Runtime Bank bundle revision is missing or drifted.');
 ok(runtimeSource.includes("version: 'H2.01'"),'Runtime composition API is not advertising H2.01.');
 ok(runtimeSource.includes('clearStaleBundledDowntownSnapshots();'),'Runtime no longer clears stale bundled Downtown snapshots before City boot.');
 ok(runtimeSource.includes("saved?.id !== 'downtown-block-001'"),'Stale-snapshot guard no longer scopes itself to bundled Downtown saves.');
 ok(runtimeSource.includes("item?.id === BANK_OVERLAY_ID"),'Stale-snapshot guard no longer verifies the Bank overlay.');
 const activeEntry=worldIndex.blocks.find(x=>x.id===worldIndex.activeBlockId);
 const bankEntry=worldIndex.blocks.find(x=>x.id==='riftcity-bank-001-generated');
 ok(worldIndex.activeBlockId==='downtown-block-001','Downtown must remain the active playable district.');
 ok(activeEntry?.runtime_overlays?.includes('riftcity-bank-001'),'Active Downtown index entry does not advertise the runtime Bank overlay.');
 ok(activeEntry?.tags?.includes('h2.01-research-bank-overlay'),'Active Downtown index entry is not marked for the H2.01 Bank overlay.');
 ok(bankEntry?.tags?.includes('one-level')&&bankEntry?.tags?.includes('relationship-banking'),'World index does not describe the researched one-level relationship-banking layout.');
 ok(bankEntry?.tags?.includes('BANK-signage'),'World index does not advertise required BANK facade signage.');

 ok(s.floors.length===1,`Bank occupied-level metadata ${s.floors.length} != 1.`);
 ok(bank.building?.floors===1,'Bank must remain one occupied floor.');
 ok(bank.building?.ground_floor===1,'Street-level Bank floor must remain floor 1.');
 ok(bank.building?.floor_height===16,'Bank shell must keep the 16m maximum storey height.');
 ok(bank.building?.occupancy_target>=250,'Bank occupancy target must remain at least 250.');
 ok(bank.building?.interior?.minimum_clear_height>=10,'Interior minimum clear height must remain at least 10m.');
 ok(bank.building?.design_rules?.public_to_secure_depth_gradient===true,'Bank must preserve the public-to-secure depth gradient.');
 ok(bank.building?.design_rules?.rear_armored_service_route===true,'Bank must preserve a separate rear armored-service route.');
 ok(bank.building?.design_rules?.front_branding_required==='BANK','Bank design contract must require BANK front branding.');

 const o=bank.building.origin||[0,0,0],m=bank.building.masses||[];
 const minX=Math.min(...m.map(x=>o[0]+x.origin[0])),maxX=Math.max(...m.map(x=>o[0]+x.origin[0]+x.size[0]-1));
 const minZ=Math.min(...m.map(x=>o[2]+x.origin[2])),maxZ=Math.max(...m.map(x=>o[2]+x.origin[2]+x.size[1]-1));
 const fw=maxX-minX+1,fd=maxZ-minZ+1;
 ok(fw>=50&&fd>=48,`Bank footprint ${fw}x${fd}m is too small.`);

 const roofMasses=m.filter(x=>(x.tags||[]).includes('roof'));
 const roofLevels=[...new Set(roofMasses.map(x=>x.origin[1]))].sort((a,b)=>a-b);
 const roofPeak=Math.max(...roofMasses.map(x=>x.origin[1]+(x.floor_height||1)*(x.floors||1)-1));
 ok(roofMasses.length>=8,`Bank roof has only ${roofMasses.length} authored detail masses.`);
 ok(roofLevels.length>=4,`Bank roof has only ${roofLevels.length} distinct height tiers.`);
 ok(roofPeak>=26,`Bank roof peak ${roofPeak}m is too low.`);
 ok(roofMasses.some(x=>(x.tags||[]).includes('clerestory')),'Bank roof clerestory is missing.');
 ok(roofMasses.some(x=>(x.tags||[]).includes('skylight')),'Bank roof skylight mass is missing.');
 ok(roofMasses.some(x=>(x.tags||[]).includes('mechanical-screen')),'Bank rear mechanical screen is missing.');
 ok(roofMasses.some(x=>(x.tags||[]).includes('crown')),'Bank landmark roof crown is missing.');

 ok(i,'Compiled Interior Architecture semantics are missing.');
 ok((i?.spaces?.length||0)>=11,'Bank needs at least 11 real semantic spaces.');
 ok((i?.portals?.length||0)>=12,'Bank needs at least 12 real portals.');
 ok((i?.verticalCores?.length||0)===0,'One-level Bank must not contain stair cores.');
 ok(!i?.graph?.unreachable?.length,'Bank has unreachable interior spaces.');
 ok(!r.overlay.report.stats.invalidVerticalCores,'Bank has an invalid vertical core.');
 ok(!r.overlay.report.stats.blockedPortals,'Bank has a blocked portal.');

 const area=x=>(x.max[0]-x.min[0]+1)*(x.max[1]-x.min[1]+1);
 const vault=i?.spaces?.find(x=>x.id==='main-vault'),hall=i?.spaces?.find(x=>x.id==='grand-hall'),tellers=i?.spaces?.find(x=>x.id==='teller-gallery'),entry=i?.spaces?.find(x=>x.id==='entry-vestibule');
 ok(vault&&area(vault)>=300&&vault.clearHeight>=12,'Main Vault must remain at least 300m² with 12m clear height.');
 ok(hall&&area(hall)>=250&&hall.clearHeight>=14,'Lobby + Waiting Hall must remain at least 250m² with 14m clear height.');
 ok(tellers&&area(tellers)>=180&&tellers.clearHeight>=13,'Teller + Transaction Hall must remain at least 180m² with 13m clear height.');
 ok(entry&&entry.tags?.includes('atm'),'Entry vestibule must include the ATM zone.');
 for(const space of i?.spaces||[]) ok(space.clearHeight>=10&&(space.clearRatio??1)>=.65,`${space.id} must remain a tall, usable Bank room (>=10m clear).`);

 for(const required of ['entry-vestibule','west-loan-offices','east-executive-offices','west-operations','east-security','records-room','cash-processing','secure-corridor'])
   ok(i?.spaces?.some(x=>x.id===required),`Bank space ${required} is missing.`);

 const names=(bank.site_ops||[]).map(x=>String(x.name||''));
 for(const feature of ['Bank public forecourt','Main entrance canopy','Teller transaction counter','Concierge service desk','Security surveillance console','Safe deposit wall west','Vault deposit box wall A','Armored service pad','Mechanical screen cap'])
   ok(names.includes(feature),`Bank physical feature '${feature}' is missing.`);
 for(const letter of ['BANK letter B spine','BANK letter A left','BANK letter N left','BANK letter K spine'])
   ok(names.includes(letter),`Bank facade branding '${letter}' is missing.`);
 ok(names.some(name=>name.startsWith('BANK letter B'))&&names.some(name=>name.startsWith('BANK letter A'))&&names.some(name=>name.startsWith('BANK letter N'))&&names.some(name=>name.startsWith('BANK letter K')),'BANK facade lettering is incomplete.');

 ok(s.entrances.length>=3,'Bank needs at least 3 entrances.');
 for(const a of ['atm-zone','bank-service-desk','teller-line','manager-office','security-console','safe-deposit-service','main-vault-center','armored-service'])
   ok(s.anchors.some(x=>x.id===a),`Bank anchor ${a} is missing.`);

 ok(r.document.bounds.min[1]>=base.bounds.min[1],`Bank unexpectedly expanded Downtown downward to Y ${r.document.bounds.min[1]}.`);
 ok(r.stats.boundsVolume<=3_000_000,'Downtown composed bounds exceed 3M cells.');
 const c=compileRiftCityBlock(r.document);
 ok(c.stats.cells>=85000,'Composed Downtown cell count is unexpectedly low.');
 ok(c.stats.triangles>=300000,'Composed Downtown triangle count is unexpectedly low.');
 if(!failures.length)console.log(`[downtown-composition] PASS · LIVE City route wired to ${bankEntry?.name||'Bank'} · bank ${r.overlay.report.stats.structuralCells.toLocaleString()} structural cells / ${r.stats.overlayOperations} ops · footprint ${fw}x${fd}m · ${i.spaces.length} spaces / ${i.portals.length} portals · lobby ${area(hall)}m² @ ${hall.clearHeight}m · teller hall ${area(tellers)}m² @ ${tellers.clearHeight}m · vault ${area(vault)}m² @ ${vault.clearHeight}m · ${roofMasses.length} roof masses / ${roofLevels.length} roof tiers / ${roofPeak}m peak · BANK signage verified · Downtown ${c.stats.cells.toLocaleString()} cells / ${c.stats.triangles.toLocaleString()} tris.`);
}catch(e){failures.push(e?.stack||e?.message||String(e))}
if(failures.length){console.error('[downtown-composition] FAIL');for(const f of failures)console.error(` - ${f}`);process.exit(1)}