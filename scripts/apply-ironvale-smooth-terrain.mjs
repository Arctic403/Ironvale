import fs from 'node:fs';

function update(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after===before)console.log(`[smooth-terrain] unchanged ${path}`);else{fs.writeFileSync(path,after);console.log(`[smooth-terrain] patched ${path}`);}}
function replaceOnce(text,needle,replacement,label){if(text.includes(replacement))return text;const i=text.indexOf(needle);if(i<0)throw new Error(`Missing ${label}: ${needle.slice(0,80)}`);return text.slice(0,i)+replacement+text.slice(i+needle.length);}

update('public/downtown3d-foundation.js',text=>{
  text=replaceOnce(text,
    "import { createIronvaleStarterRuntime } from './ironvale-gameplay.js';",
    "import { createIronvaleStarterRuntime } from './ironvale-gameplay.js';\nimport { createValebornSmoothTerrain } from './ironvale-smooth-terrain.js';\nimport { createIronvaleNatureEnvironment } from './ironvale-environment.js';",
    'foundation visual imports');
  text=replaceOnce(text,
    "  let ironvaleGameplay = null;",
    "  let ironvaleGameplay = null;\n  let smoothTerrain = null;\n  let natureEnvironment = null;\n  let visualRevision = 0;",
    'foundation visual state');
  text=replaceOnce(text,
    "  const loadDocument = (document, label = 'LOCAL JSON', options = {}) => {",
    `  const syncVisualEnvironment = async document => {\n    const revision = ++visualRevision;\n    natureEnvironment?.destroy?.(); natureEnvironment = null;\n    smoothTerrain?.destroy?.(); smoothTerrain = null;\n    if (document?.metadata?.visual_surface !== 'smooth-terrain-v1') return;\n    smoothTerrain = createValebornSmoothTerrain(engine, { chunkSize: 32, step: 2 });\n    try {\n      const environment = await createIronvaleNatureEnvironment(engine);\n      if (destroyed || revision !== visualRevision) { environment?.destroy?.(); return; }\n      natureEnvironment = environment;\n    } catch (error) {\n      console.warn('Ironvale nature environment could not finish loading', error);\n    }\n  };\n\n  const loadDocument = (document, label = 'LOCAL JSON', options = {}) => {`,
    'visual environment synchronizer');
  text=replaceOnce(text,
    "      for (const mesh of compiled.meshes) {",
    "      if (document?.metadata?.visual_surface !== 'smooth-terrain-v1') for (const mesh of compiled.meshes) {",
    'voxel visual suppression');
  text=replaceOnce(text,
    "    imported = compiled;\n    ironvaleGameplay?.onWorldChanged?.(compiled.document);",
    "    imported = compiled;\n    void syncVisualEnvironment(compiled.document);\n    ironvaleGameplay?.onWorldChanged?.(compiled.document);",
    'visual environment load');
  text=replaceOnce(text,
    "      ironvaleGameplay?.destroy?.();\n      ironvaleGameplay = null;",
    "      ironvaleGameplay?.destroy?.();\n      ironvaleGameplay = null;\n      visualRevision += 1;\n      natureEnvironment?.destroy?.(); natureEnvironment = null;\n      smoothTerrain?.destroy?.(); smoothTerrain = null;",
    'visual environment cleanup');
  return text;
});

update('scripts/build-brackenford-region-v2.mjs',text=>{
  const old="metadata:{terrain_pass:'starter-island-v1',buildings:false,island:true,surrounded_by_water:true,coastline:'organic-multilobed',features:";
  const next="metadata:{terrain_pass:'starter-island-v1',visual_surface:'smooth-terrain-v1',environment_pack:'quaternius-stylized-nature-standard',buildings:false,island:true,surrounded_by_water:true,coastline:'organic-multilobed',features:";
  return replaceOnce(text,old,next,'starter island visual metadata');
});

update('scripts/check-ironvale-starter-game.js',text=>{
  text=replaceOnce(text,
    "const css = read('public/ironvale.css');",
    "const css = read('public/ironvale.css');\nconst smoothTerrain = read('public/ironvale-smooth-terrain.js');\nconst gltfLoader = read('public/rift-gltf.js');\nconst environment = read('public/ironvale-environment.js');",
    'starter verifier visual sources');
  text=replaceOnce(text,
    "expect(world.metadata?.island === true && world.metadata?.surrounded_by_water === true && world.metadata?.coastline === 'organic-multilobed', 'starter zone must remain an organic island surrounded by water');",
    "expect(world.metadata?.island === true && world.metadata?.surrounded_by_water === true && world.metadata?.coastline === 'organic-multilobed', 'starter zone must remain an organic island surrounded by water');\nexpect(world.metadata?.visual_surface === 'smooth-terrain-v1' && world.metadata?.environment_pack === 'quaternius-stylized-nature-standard', 'starter island smooth visual surface metadata is missing');",
    'starter visual metadata assertion');
  text=replaceOnce(text,
    "expect(foundation.includes(\"ironvale:world:active-block:v2\") && !foundation.includes(\"ironvale:world:active-block:v1\"), 'starter game must invalidate the old flat saved-world slot');",
    "expect(foundation.includes(\"ironvale:world:active-block:v2\") && !foundation.includes(\"ironvale:world:active-block:v1\"), 'starter game must invalidate the old flat saved-world slot');\nexpect(foundation.includes('createValebornSmoothTerrain') && foundation.includes('createIronvaleNatureEnvironment') && foundation.includes(\"visual_surface !== 'smooth-terrain-v1'\"), 'smooth terrain/environment is not wired into the active renderer');\nexpect(smoothTerrain.includes('createValebornSmoothTerrain') && smoothTerrain.includes('valebornTerrainHeight') && smoothTerrain.includes('blockGrid:0'), 'smooth terrain renderer is incomplete');\nexpect(gltfLoader.includes('loadRiftGltf') && gltfLoader.includes('bufferViews') && gltfLoader.includes('vertexStride:9'), 'Rift glTF loader is incomplete');\nexpect(environment.includes('Rock_Medium_1.gltf') && environment.includes('CommonTree_1.gltf') && environment.includes('Pine_1.gltf'), 'Quaternius environment manifest is incomplete');\nfor (const file of ['LICENSE.txt','Rock_Medium_1.gltf','Rock_Medium_1.bin','Rock_Medium_2.gltf','Rock_Medium_2.bin','Rock_Medium_3.gltf','Rock_Medium_3.bin','CommonTree_1.gltf','CommonTree_1.bin','Pine_1.gltf','Pine_1.bin']) expect(fs.existsSync('public/assets/quaternius/stylized-nature/'+file), 'missing vendored Quaternius asset '+file);",
    'starter smooth terrain assertions');
  text=text.replace("PASS · Valeborn Knight foundation + organic 320×320 starter island with coast, mountain, cave, river, hills and travel routes.","PASS · Valeborn Knight foundation + smooth 320×320 island terrain + local Quaternius rock/tree environment meshes.");
  return text;
});
