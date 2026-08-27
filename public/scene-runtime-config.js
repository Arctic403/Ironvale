// RiftCity source-controlled scene runtime configuration.
//
// Precedence is intentionally:
//   verified published D1 scene runtimeConfig
//   -> public/config/scene-runtime.json
//   -> legacy runtimeConfig/camera/character values in JS scene definitions
//   -> runtime defaults in block-world.js
//
// This file only loads/tidies source config. Production trust for published D1
// documents remains enforced by the Worker integrity/signature pipeline.

export const SCENE_RUNTIME_CONFIG_URL='/config/scene-runtime.json';
export const SCENE_RUNTIME_CONFIG_SCHEMA_VERSION=1;

let sourcePromise=null;

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);

function normalizeRuntimeConfig(value){
  if(!isObject(value))return null;
  const schemaVersion=Number(value.schemaVersion??1);
  if(schemaVersion!==SCENE_RUNTIME_CONFIG_SCHEMA_VERSION)return null;
  const out={schemaVersion};
  for(const key of ['camera','player','movement','interaction']){
    if(value[key]==null)continue;
    if(!isObject(value[key]))return null;
    out[key]={...value[key]};
  }
  return out;
}

export function normalizeSceneRuntimeSource(value){
  if(!isObject(value))return {schemaVersion:SCENE_RUNTIME_CONFIG_SCHEMA_VERSION,scenes:{}};
  const schemaVersion=Number(value.schemaVersion??1);
  if(schemaVersion!==SCENE_RUNTIME_CONFIG_SCHEMA_VERSION){
    console.warn(`Unsupported scene runtime source schemaVersion ${value.schemaVersion}; source config ignored.`);
    return {schemaVersion:SCENE_RUNTIME_CONFIG_SCHEMA_VERSION,scenes:{}};
  }
  const scenes={};
  if(isObject(value.scenes)){
    for(const [sceneId,entry] of Object.entries(value.scenes)){
      if(!sceneId||!isObject(entry))continue;
      const runtimeConfig=normalizeRuntimeConfig(entry.runtimeConfig);
      if(runtimeConfig)scenes[String(sceneId)]={runtimeConfig};
    }
  }
  return {schemaVersion,scenes};
}

export async function loadSceneRuntimeSource({fresh=false}={}){
  if(!sourcePromise||fresh){
    sourcePromise=(async()=>{
      try{
        const response=await fetch(SCENE_RUNTIME_CONFIG_URL,{cache:'no-store',headers:{Accept:'application/json'}});
        if(!response.ok){
          if(response.status!==404)console.warn(`Scene runtime source returned HTTP ${response.status}; legacy source defaults will be used.`);
          return normalizeSceneRuntimeSource(null);
        }
        return normalizeSceneRuntimeSource(await response.json());
      }catch(error){
        console.warn('Scene runtime source could not be loaded; legacy source defaults will be used.',error);
        return normalizeSceneRuntimeSource(null);
      }
    })();
  }
  return sourcePromise;
}

export function sourceRuntimeConfigFor(source,sceneId){
  const runtime=source?.scenes?.[String(sceneId||'')]?.runtimeConfig;
  return runtime?clone(runtime):null;
}

export function mergeSceneRuntimeConfig(base,override){
  const a=isObject(base)?base:{};
  const b=isObject(override)?override:{};
  return {
    ...clone(a),
    ...clone(b),
    schemaVersion:Number(b.schemaVersion??a.schemaVersion??SCENE_RUNTIME_CONFIG_SCHEMA_VERSION),
    camera:{...(isObject(a.camera)?a.camera:{}),...(isObject(b.camera)?b.camera:{})},
    player:{...(isObject(a.player)?a.player:{}),...(isObject(b.player)?b.player:{})},
    movement:{...(isObject(a.movement)?a.movement:{}),...(isObject(b.movement)?b.movement:{})},
    interaction:{...(isObject(a.interaction)?a.interaction:{}),...(isObject(b.interaction)?b.interaction:{})}
  };
}
