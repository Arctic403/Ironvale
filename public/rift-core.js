let corePromise = null;

async function readWasmBytes(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`RiftCore WASM failed to load (${response.status})`);
  let bytes = await response.arrayBuffer();
  const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 4));
  const gzip = header[0] === 0x1f && header[1] === 0x8b;
  if (gzip) {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('This browser cannot decompress the RiftCore WASM artifact.');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = await new Response(stream).arrayBuffer();
  }
  return bytes;
}

async function instantiate(url) {
  const bytes = await readWasmBytes(url);
  const result = await WebAssembly.instantiate(bytes, {});
  return result.instance;
}

export async function loadRiftCore() {
  if (!corePromise) {
    corePromise = instantiate(new URL('./rift-core.wasm.gz', import.meta.url)).then(instance => {
      const exports = instance.exports;
      if (!exports.memory || typeof exports.rift_core_version !== 'function') {
        throw new Error('RiftCore WASM exports are incomplete.');
      }
      const abi = exports.rift_core_version();
      if (abi !== 1) throw new Error(`Unsupported RiftCore ABI ${abi}.`);
      return Object.freeze({ instance, exports, memory: exports.memory, abi });
    });
  }
  return corePromise;
}

export const RiftCore = await loadRiftCore();
