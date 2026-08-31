import fs from 'node:fs';

const replaceOnce=(text,needle,replacement,label)=>{
  if(!text.includes(needle)) throw new Error(`Missing ${label}: ${needle.slice(0,100)}`);
  return text.replace(needle,replacement);
};
const removeIfExists=path=>{if(fs.existsSync(path)){fs.rmSync(path);console.log('[terrain-reset] removed',path);}};

let foundation=fs.readFileSync('public/downtown3d-foundation.js','utf8');
foundation=replaceOnce(foundation,"import { createIronvaleStarterRuntime } from './ironvale-gameplay.js';\nimport { createValebornSmoothTerrain } from './ironvale-smooth-terrain.js';\nimport { createIronvaleNatureEnvironment } from './ironvale-environment.js';","import { createIronvaleStarterRuntime } from './ironvale-gameplay.js';",'legacy terrain imports');
foundation=replaceOnce(foundation,"const DEFAULT_BLOCK_URL = new URL('./rift-world-blocks/brackenford-lowlands-001.json', import.meta.url);","const DEFAULT_BLOCK_URL = new URL('./rift-world-blocks/ironvale-terrain-bootstrap.json', import.meta.url);",'default world URL');
foundation=replaceOnce(foundation,"const ACTIVE_BLOCK_STORAGE_KEY = 'ironvale:world:active-block:v2';\nconst ACTIVE_BLOCK_STORAGE_VERSION = 2;","const ACTIVE_BLOCK_STORAGE_KEY = 'ironvale:world:active-block:v3';\nconst ACTIVE_BLOCK_STORAGE_VERSION = 3;",'saved world version');
foundation=foundation.replace("blockGrid: 0.16,","blockGrid: 0,");
foundation=foundation.replace("let sourceLabel = 'BRACKENFORD LOWLANDS';","let sourceLabel = 'IRONVALE TERRAIN BOOTSTRAP';");
foundation=foundation.replace("  let ironvaleGameplay = null;\n  let smoothTerrain = null;\n  let natureEnvironment = null;\n  let visualRevision = 0;","  let ironvaleGameplay = null;");
foundation=foundation.replace("const player = createRiftPlayer(engine, { position: [32, 2, 32] });","const player = createRiftPlayer(engine, { position: [160, 2, 160] });");
foundation=foundation.replace(/\n  const syncVisualEnvironment = async document => \{[\s\S]*?\n  \};\n\n  const loadDocument =/m,"\n\n  const loadDocument =");
foundation=foundation.replace("      if (document?.metadata?.visual_surface !== 'smooth-terrain-v1') for (const mesh of compiled.meshes) {","      for (const mesh of compiled.meshes) {");
foundation=foundation.replace("    void syncVisualEnvironment(compiled.document);\n","");
foundation=foundation.replace("      visualRevision += 1;\n      natureEnvironment?.destroy?.(); natureEnvironment = null;\n      smoothTerrain?.destroy?.(); smoothTerrain = null;\n","");
foundation=foundation.replaceAll('IMPORTING COMMERCE BLOCK 01…','LOADING TERRAIN BOOTSTRAP…');
foundation=foundation.replaceAll('Bundled Block 001 request failed','Bundled terrain bootstrap request failed');
foundation=foundation.replaceAll("'DEFAULT BLOCK 001'","'TERRAIN BOOTSTRAP'");
foundation=foundation.replaceAll('DEFAULT BLOCK RESTORED','TERRAIN BOOTSTRAP RESTORED');
foundation=foundation.replaceAll('falling back to bundled Block 001','falling back to the bundled terrain bootstrap');
foundation=foundation.replaceAll('BLOCK 001 RELOAD FAILED','TERRAIN BOOTSTRAP RELOAD FAILED');
fs.writeFileSync('public/downtown3d-foundation.js',foundation);

let content=fs.readFileSync('src/ironvale/content.js','utf8');
content=content.replace("worldId: 'brackenford-lowlands-001', worldUrl: '/rift-world-blocks/brackenford-lowlands-001.json',","worldId: 'ironvale-terrain-bootstrap', worldUrl: '/rift-world-blocks/ironvale-terrain-bootstrap.json',");
content=content.replace("description: 'A broad working lowland of crooked medieval lanes, irregular timber-and-stone buildings, farms, wooded hills, an abandoned watch and the Blackstone cave ridge around Brackenford.',","description: 'A broad Valeborn starter region whose authored landscape is being rebuilt on Rift Terrain. Story, quest and world-object definitions remain independent from the terrain implementation.',");
content=content.replace("spawn: { id: 'valeborn-training-yard', position: [178, 4, 178], facing: 0 },","spawn: { id: 'valeborn-training-yard', position: [160, 2, 160], facing: 0 },");
fs.writeFileSync('src/ironvale/content.js',content);

const world={
  format:'riftcity-city-block',version:2,id:'ironvale-terrain-bootstrap',name:'Ironvale Terrain Bootstrap',units:'meters',
  grid:{cell_size:1,shape_increment:0.5},origin:[0,0,0],bounds:{min:[0,0,0],max:[319,8,319]},
  palette:{air:{material_id:0,shape:'air',color:[0,0,0]}},
  ops:[{op:'fill_box',state:'grass_block',min:[0,0,0],max:[319,0,319],name:'Temporary flat compatibility floor'}],
  prefabs:{},layout:[],
  anchors:{terrain_origin:{at:[160,1,160],facing:'north',tags:['terrain-origin','bootstrap']},starter_spawn:{at:[160,1,160],facing:'north',tags:['spawn','bootstrap']}},
  validation:{overlap_policy:'allow'},
  metadata:{terrain_reset:true,terrain_authority:'rift-terrain-native-pending',compatibility_floor:true,legacy_island:false,buildings:false,purpose:'Temporary flat collision/bootstrap surface while native editable Rift Terrain replaces the retired procedural/block terrain prototypes.'}
};
fs.mkdirSync('public/rift-world-blocks',{recursive:true});
fs.writeFileSync('public/rift-world-blocks/ironvale-terrain-bootstrap.json',JSON.stringify(world,null,2)+'\n');

const verifier=`import fs from 'node:fs';
import { compileRiftCityBlock } from '../public/rift-city-block-importer.js';
import { IRONVALE_RACES, IRONVALE_CLASSES, IRONVALE_ZONES, IRONVALE_QUESTS, IRONVALE_CAMPAIGNS } from '../src/ironvale/content.js';
const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{console.error('[ironvale-starter-game] FAIL · '+m);process.exit(1);};
const expect=(v,m)=>{if(!v)fail(m);};
const world=JSON.parse(read('public/rift-world-blocks/ironvale-terrain-bootstrap.json'));
const compiled=compileRiftCityBlock(world);
const foundation=read('public/downtown3d-foundation.js');
const gameplay=read('public/ironvale-gameplay.js');
const api=read('src/ironvale/api.js');
const nativeCore=read('native/rift-core.cpp');
const schema=read('schema.sql');
const css=read('public/ironvale.css');
expect(IRONVALE_RACES.length===1&&IRONVALE_RACES[0].id==='valeborn','exactly one playable race must remain Valeborn');
expect(IRONVALE_CLASSES.length===1&&IRONVALE_CLASSES[0].id==='knight','exactly one playable class must remain Knight');
expect(IRONVALE_ZONES.length===1&&IRONVALE_ZONES[0].worldId==='ironvale-terrain-bootstrap','starter zone must point at terrain bootstrap');
expect(IRONVALE_QUESTS.length>=5&&IRONVALE_CAMPAIGNS.some(c=>c.id==='the-broken-oath'),'starter campaign data regressed');
expect(world.id==='ironvale-terrain-bootstrap'&&world.metadata?.terrain_reset===true,'terrain reset bootstrap metadata missing');
expect(world.metadata?.terrain_authority==='rift-terrain-native-pending'&&world.metadata?.legacy_island===false,'legacy island must not remain terrain authority');
expect(world.bounds?.max?.[0]===319&&world.bounds?.max?.[2]===319,'terrain bootstrap must remain a broad 320x320 neutral workspace');
expect(world.ops?.length===1&&JSON.stringify(world.ops[0]).includes('Temporary flat compatibility floor'),'bootstrap must contain only the temporary flat compatibility floor');
expect(Object.keys(world.prefabs||{}).length===0&&(world.layout||[]).length===0,'bootstrap must not contain settlement/world prefabs');
expect(compiled.stats.cells>=100000&&compiled.stats.sections>=400,'bootstrap did not compile into the expected flat RiftSection workspace');
expect(foundation.includes('ironvale-terrain-bootstrap.json')&&foundation.includes("ironvale:world:active-block:v3"),'active world boot was not reset');
expect(!foundation.includes('createValebornSmoothTerrain')&&!foundation.includes('createIronvaleNatureEnvironment')&&!foundation.includes("visual_surface !== 'smooth-terrain-v1'"),'legacy procedural visual terrain is still wired');
expect(foundation.includes('blockGrid: 0'),'bootstrap surface must not render the old Minecraft-style grid');
expect(gameplay.includes('createIronvaleStarterRuntime')&&gameplay.includes('riftNativeResolveCombat')&&gameplay.includes("Digit1")&&gameplay.includes("KeyE"),'starter gameplay runtime regressed');
expect(api.includes('/api/ironvale/character/create')&&api.includes('/api/ironvale/quests/progress'),'starter persistence endpoints regressed');
expect(schema.includes('ironvale_character_profiles'),'character identity table missing');
expect(css.includes('.iv-actionbar')&&css.includes('.iv-character-create'),'starter HUD styling missing');
expect(nativeCore.includes('Rift Native Core v4')&&nativeCore.includes('rift_build_section_mesh')&&nativeCore.includes('rift_player_step_world'),'Rift Native foundation regressed');
expect(fs.existsSync('public/rift-gltf.js'),'reusable Rift glTF loader must remain');
for(const file of ['Rock_Medium_1.gltf','Rock_Medium_2.gltf','Rock_Medium_3.gltf','CommonTree_1.gltf','Pine_1.gltf'])expect(fs.existsSync('public/assets/quaternius/stylized-nature/'+file),'reusable nature asset missing: '+file);
for(const path of ['public/ironvale-smooth-terrain.js','public/ironvale-environment.js','scripts/apply-ironvale-smooth-terrain.mjs','scripts/build-brackenford-region-v2.mjs','public/rift-world-blocks/brackenford-lowlands-001.json'])expect(!fs.existsSync(path),'legacy terrain file still active: '+path);
console.log('[ironvale-starter-game] PASS · legacy terrain retired; neutral 320x320 bootstrap + Rift Native/gameplay/glTF foundations retained.');
`;
fs.writeFileSync('scripts/check-ironvale-starter-game.js',verifier);

for(const path of [
  'public/ironvale-smooth-terrain.js',
  'public/ironvale-environment.js',
  'scripts/apply-ironvale-smooth-terrain.mjs',
  'scripts/build-brackenford-region-v2.mjs',
  'public/rift-world-blocks/brackenford-lowlands-001.json',
  '.github/workflows/ironvale-smooth-terrain-build.yml'
]) removeIfExists(path);

console.log('[terrain-reset] legacy terrain stripped; native terrain bootstrap ready');
