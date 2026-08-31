let corePromise = null;

async function instantiate(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`RiftCore WASM failed to load (${response.status})`);
  try {
    if (WebAssembly.instantiateStreaming) {
      const result = await WebAssembly.instantiateStreaming(response.clone(), {});
      return result.instance;
    }
  } catch (error) {
    console.warn('RiftCore streaming instantiate unavailable; falling back to ArrayBuffer.', error);
  }
  const bytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(bytes, {});
  return result.instance;
}

export async function loadRiftCore() {
  if (!corePromise) {
    corePromise = instantiate(new URL('./rift-core.wasm', import.meta.url)).then(instance => {
      const exports = instance.exports;
      if (!exports.memory || typeof exports.rift_core_version !== 'function') {
        throw new Error('RiftCore WASM exports are incomplete.');
      }
      if (exports.rift_core_version() !== 1) {
        throw new Error(`Unsupported RiftCore ABI ${exports.rift_core_version()}.`);
      }
      return Object.freeze({ instance, exports, memory: exports.memory, abi: 1 });
    });
  }
  return corePromise;
}

export const RiftCore = await loadRiftCore();
