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
    const src=String(scene.scenePlate?.src||'');
    if(!src) return Promise.resolve({scene,assetError:false});
    if(this.preloads.has(src)) return this.preloads.get(src);

    const pending=new Promise((resolve)=>{
      const image=new Image();
      image.decoding='async';
      image.onload=()=>resolve({scene,assetError:false});
      image.onerror=()=>resolve({scene,assetError:true});
      image.src=src;
      if(image.complete){
        queueMicrotask(()=>resolve({scene,assetError:!image.naturalWidth}));
      }
    });
    this.preloads.set(src,pending);
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

function structuredCloneSafe(value){
  if(value==null) return value;
  try{
    if(typeof structuredClone==='function') return structuredClone(value);
  }catch(_){}
  return JSON.parse(JSON.stringify(value));
}
