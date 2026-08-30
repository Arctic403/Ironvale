const DB_NAME = 'rift-local-builder-v1';
const DB_VERSION = 1;
const STORES = ['candidates', 'results', 'jobs'];

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(storeName, mode, work) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let value;
      try { value = work(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
    });
  } finally {
    db.close();
  }
}

export async function putLocal(storeName, record) {
  if (!STORES.includes(storeName)) throw new Error(`Unknown local store '${storeName}'.`);
  await transaction(storeName, 'readwrite', store => store.put(record));
  return record;
}

export async function getLocal(storeName, id) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function listLocal(storeName) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0)));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function mirrorOpfs(folderName, id, payload) {
  if (!navigator.storage?.getDirectory) return false;
  try {
    const root = await navigator.storage.getDirectory();
    const rootDir = await root.getDirectoryHandle('rift-local-builder', { create: true });
    const folder = await rootDir.getDirectoryHandle(folderName, { create: true });
    const file = await folder.getFileHandle(`${String(id).replace(/[^a-zA-Z0-9._-]/g, '_')}.json`, { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    return true;
  } catch (_) {
    return false;
  }
}

export async function saveCandidate(id, program, artifact, publicResult) {
  const record = { id, program, artifact, publicResult, savedAt: Date.now() };
  await putLocal('candidates', record);
  await mirrorOpfs('candidates', id, record);
  return record;
}

export async function saveResult(id, publicResult) {
  const record = { id, publicResult, savedAt: Date.now() };
  await putLocal('results', record);
  await mirrorOpfs('results', id, publicResult);
  return record;
}
