const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const TYPES={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const BYTES={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};

function resolveUrl(base,relative){return new URL(relative,base).href;}
function readAccessor(gltf,buffers,index){
  const accessor=gltf.accessors?.[index];
  if(!accessor)throw new Error(`glTF accessor ${index} is missing.`);
  const view=gltf.bufferViews?.[accessor.bufferView];
  if(!view)throw new Error(`glTF bufferView ${accessor.bufferView} is missing.`);
  const Typed=TYPES[accessor.componentType],components=COMPONENTS[accessor.type];
  if(!Typed||!components)throw new Error(`Unsupported glTF accessor type ${accessor.componentType}/${accessor.type}.`);
  const buffer=buffers[view.buffer];
  if(!buffer)throw new Error(`glTF buffer ${view.buffer} is missing.`);
  const byteOffset=(view.byteOffset||0)+(accessor.byteOffset||0);
  const elementBytes=BYTES[accessor.componentType]*components;
  const stride=view.byteStride||elementBytes;
  if(stride===elementBytes)return new Typed(buffer,byteOffset,accessor.count*components);
  const out=new Typed(accessor.count*components),source=new Uint8Array(buffer);
  for(let i=0;i<accessor.count;i++){
    const slice=source.slice(byteOffset+i*stride,byteOffset+i*stride+elementBytes);
    out.set(new Typed(slice.buffer,slice.byteOffset,components),i*components);
  }
  return out;
}

function materialTint(name=''){
  const n=name.toLowerCase();
  if(n.includes('leaf')||n.includes('leaves')||n.includes('foliage'))return [0.32,0.48,0.21];
  if(n.includes('bark')||n.includes('wood')||n.includes('trunk'))return [0.38,0.27,0.16];
  if(n.includes('rock')||n.includes('stone'))return [0.48,0.50,0.47];
  return [0.62,0.64,0.56];
}

export async function loadRiftGltf(url,{fetchImpl=fetch}={}){
  const absolute=new URL(url,document.baseURI).href;
  const response=await fetchImpl(absolute,{cache:'force-cache'});
  if(!response.ok)throw new Error(`glTF ${response.status}: ${absolute}`);
  const gltf=await response.json();
  if(gltf.asset?.version!=='2.0')throw new Error(`Only glTF 2.0 is supported; got ${gltf.asset?.version||'unknown'}.`);
  const buffers=await Promise.all((gltf.buffers||[]).map(async buffer=>{
    if(!buffer.uri)throw new Error('Embedded GLB buffers are not supported by this lightweight loader yet.');
    const r=await fetchImpl(resolveUrl(absolute,buffer.uri),{cache:'force-cache'});
    if(!r.ok)throw new Error(`glTF buffer ${r.status}: ${buffer.uri}`);
    return r.arrayBuffer();
  }));
  const parts=[];
  for(const mesh of gltf.meshes||[]){
    for(const primitive of mesh.primitives||[]){
      if((primitive.mode??4)!==4)continue;
      const positions=readAccessor(gltf,buffers,primitive.attributes.POSITION);
      const normals=primitive.attributes.NORMAL!==undefined?readAccessor(gltf,buffers,primitive.attributes.NORMAL):null;
      const count=positions.length/3;
      const material=gltf.materials?.[primitive.material]||{};
      const tint=materialTint(material.name||mesh.name||'');
      const vertices=new Float32Array(count*9);
      for(let i=0;i<count;i++){
        const p=i*3,v=i*9;
        vertices[v]=positions[p];vertices[v+1]=positions[p+1];vertices[v+2]=positions[p+2];
        vertices[v+3]=normals?.[p]??0;vertices[v+4]=normals?.[p+1]??1;vertices[v+5]=normals?.[p+2]??0;
        vertices[v+6]=tint[0];vertices[v+7]=tint[1];vertices[v+8]=tint[2];
      }
      let indices;
      if(primitive.indices!==undefined){
        const raw=readAccessor(gltf,buffers,primitive.indices);
        indices=raw instanceof Uint32Array?new Uint32Array(raw):new Uint16Array(raw);
      }else{
        indices=count>65535?new Uint32Array(count):new Uint16Array(count);
        for(let i=0;i<count;i++)indices[i]=i;
      }
      parts.push({name:mesh.name||'gltf-mesh',material:material.name||'',doubleSided:!!material.doubleSided,geometry:{vertices,indices,vertexStride:9}});
    }
  }
  if(!parts.length)throw new Error(`No triangle primitives found in ${absolute}.`);
  return {url:absolute,parts,gltf};
}

export function validateRiftGltfLoader(){
  const failures=[];
  if(COMPONENTS.VEC3!==3)failures.push('VEC3 component map');
  if(TYPES[5126]!==Float32Array)failures.push('float accessor map');
  return {ok:failures.length===0,failures};
}
