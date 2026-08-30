// RiftCity Base World reset.
//
// H2.01 previously intercepted the bundled Downtown JSON request and composed
// the Bank BuildingProgram into it at runtime. The active city is intentionally
// blank again, so runtime world composition is disabled until a new district is
// authored on top of the base material system.

const ACTIVE_BLOCK_STORAGE_KEY = 'riftcity:h1.57:active-city-block:v1';
const RESET_REVISION = 'base-world-texture-atlas-v1';
let lastComposition = null;

function storageCandidates() {
  const candidates = [];
  try { if (window.localStorage) candidates.push(window.localStorage); } catch (_) {}
  try { if (window.sessionStorage) candidates.push(window.sessionStorage); } catch (_) {}
  return candidates;
}

export function clearLegacyDowntownSnapshots() {
  for (const storage of storageCandidates()) {
    try { storage.removeItem(ACTIVE_BLOCK_STORAGE_KEY); } catch (_) {}
  }
}

export async function composeBaseWorld(baseDocument) {
  // Keep a clone boundary so dev callers can experiment without mutating their
  // source object, but do not inject buildings/roads/overlays into the world.
  const document = typeof structuredClone === 'function'
    ? structuredClone(baseDocument)
    : JSON.parse(JSON.stringify(baseDocument));
  lastComposition = { document, disabled: true, revision: RESET_REVISION };
  return document;
}

// Do not replace window.fetch here. The bundled JSON must reach the importer
// exactly as authored during the reset.
clearLegacyDowntownSnapshots();

window.RiftCityWorldComposition = Object.freeze({
  version: 'BASE-1',
  revision: RESET_REVISION,
  disabled: true,
  composeDowntown: composeBaseWorld,
  composeBaseWorld,
  clearStaleBundledDowntownSnapshots: clearLegacyDowntownSnapshots,
  clearLegacyDowntownSnapshots,
  get last() { return lastComposition; }
});
