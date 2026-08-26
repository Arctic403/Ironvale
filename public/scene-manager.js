// RiftCity H1.20 — lightweight scene manager for 2.5D rooms/sub-areas.
// It owns transition state and scene-plate preloading only. Movement, collision,
// camera math and rendering remain in the Block World runtime.
export class SceneManager {
  constructor(resolveScene){
    if(typeof resolveScene!=='function') throw new Error('SceneManager requires a scene resolver.');
    this.resolveScene=resolveScene;
    this.active=null;
    this.stack=[];
    this.sequence=0;
    this.preloads=new Map();
  }

  resolve(id){
    const scene=this.resolveScene(String(id||''));
    return scene||null;
  }

  preload(id){
    const scene=this.resolve(id);
    if(!scene) return Promise.reject(new Error(`Unknown scene: ${id}`));

    const primary=String(scene.scenePlate?.src||'');
    const fallback=String(scene.scenePlate?.fallbackSrc||'');
    const candidates=[...new Set([primary,fallback].filter(Boolean))];
    if(!candidates.length) return Promise.resolve({scene,assetError:false,loadedSrc:''});

    const cacheKey=candidates.join('|');
    if(this.preloads.has(cacheKey)) return this.preloads.get(cacheKey);

    // Safari can occasionally leave Image() in limbo when a preview/service-worker
    // asset is missing. Never allow scene entry to wait forever on an image event.
    // Try the preferred plate first, then the source-controlled fallback, and finally
    // resolve anyway so the room can open with its diagnostic background.
    const pending=(async()=>{
      for(const src of candidates){
        const loaded=await preloadImageWithTimeout(src,1100);
        if(loaded) return {scene,assetError:false,loadedSrc:src};
      }
      return {scene,assetError:true,loadedSrc:''};
    })();

    this.preloads.set(cacheKey,pending);
    return pending;
  }

  async enter(id,returnState=null){
    const seq=++this.sequence;
    const loaded=await this.preload(id);
    if(seq!==this.sequence) return {cancelled:true};
    if(this.active){
      this.stack.push({scene:this.active.scene,returnState:this.active.returnState});
    }
    this.active={
      scene:loaded.scene,
      assetError:!!loaded.assetError,
      loadedSrc:String(loaded.loadedSrc||''),
      returnState:returnState?structuredCloneSafe(returnState):null
    };
    return {cancelled:false,...this.active};
  }

  leave(){
    ++this.sequence;
    if(!this.active) return null;
    const leaving=this.active;
    const parent=this.stack.pop()||null;
    this.active=parent
      ? {scene:parent.scene,assetError:false,returnState:parent.returnState}
      : null;
    return {
      scene:leaving.scene,
      returnState:leaving.returnState,
      parent:this.active?.scene||null
    };
  }

  cancel(){
    ++this.sequence;
  }

  reset(){
    ++this.sequence;
    this.active=null;
    this.stack.length=0;
  }
}


function preloadImageWithTimeout(src,timeoutMs=1100){
  return new Promise((resolve)=>{
    const image=new Image();
    let settled=false;
    let timer=0;

    const finish=(ok)=>{
      if(settled)return;
      settled=true;
      if(timer)clearTimeout(timer);
      image.onload=null;
      image.onerror=null;
      resolve(!!ok);
    };

    image.decoding='async';
    image.onload=()=>finish(image.naturalWidth>0);
    image.onerror=()=>finish(false);
    timer=setTimeout(()=>finish(false),Math.max(250,Number(timeoutMs)||1100));

    try{
      image.src=src;
      if(image.complete){
        queueMicrotask(()=>finish(image.naturalWidth>0));
      }
    }catch(_){
      finish(false);
    }
  });
}

function structuredCloneSafe(value){
  if(value==null) return value;
  try{
    if(typeof structuredClone==='function') return structuredClone(value);
  }catch(_){}
  return JSON.parse(JSON.stringify(value));
}
