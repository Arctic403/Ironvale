import { composeRiftBuildingProgramIntoCityBlock, RIFT_DOWNTOWN_BANK_REPLACEMENT } from './rift-world-composer.js';

const nativeFetch = window.fetch.bind(window);
const BANK_PROGRAM_URL = new URL('./riftcity-buildings/riftcity-bank-001.json', import.meta.url);
const DOWNTOWN_SUFFIX = '/riftcity-blocks/downtown-block-001.json';
const ACTIVE_BLOCK_STORAGE_KEY = 'riftcity:h1.57:active-city-block:v1';
const BANK_BUNDLE_REVISION = 'h2.01-research-bank-v1';
const BANK_OVERLAY_ID = 'riftcity-bank-001';
let bankProgramPromise = null;
let lastComposition = null;

function requestUrl(input) {
  const raw = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
  try { return new URL(raw, location.href); }
  catch { return null; }
}

function isDowntownRequest(input) {
  const url = requestUrl(input);
  return !!url && url.origin === location.origin && url.pathname.endsWith(DOWNTOWN_SUFFIX) && url.searchParams.get('rift_raw') !== '1';
}

function storageCandidates() {
  const candidates = [];
  try { if (window.localStorage) candidates.push(window.localStorage); } catch (_) {}
  try { if (window.sessionStorage) candidates.push(window.sessionStorage); } catch (_) {}
  return candidates;
}

function savedHasCurrentBundledBank(saved) {
  if (saved?.id !== 'downtown-block-001') return true;
  const revision = saved?.document?.metadata?.rift_bundle?.bankRevision;
  const overlays = saved?.document?.metadata?.world_composition?.overlays;
  const hasBankOverlay = Array.isArray(overlays) && overlays.some(item => item?.id === BANK_OVERLAY_ID);
  return revision === BANK_BUNDLE_REVISION && hasBankOverlay;
}

function clearStaleBundledDowntownSnapshots() {
  for (const storage of storageCandidates()) {
    try {
      const raw = storage.getItem(ACTIVE_BLOCK_STORAGE_KEY);
      if (!raw) continue;
      const saved = JSON.parse(raw);
      if (!savedHasCurrentBundledBank(saved)) storage.removeItem(ACTIVE_BLOCK_STORAGE_KEY);
    } catch (_) {}
  }
}

async function getBankProgram() {
  if (!bankProgramPromise) {
    bankProgramPromise = nativeFetch(BANK_PROGRAM_URL, { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(`RiftCity Bank BuildingProgram request failed with HTTP ${response.status}.`);
      return response.json();
    }).catch(error => {
      bankProgramPromise = null;
      throw error;
    });
  }
  return bankProgramPromise;
}

async function composeDowntown(baseDocument) {
  const program = await getBankProgram();
  const composed = composeRiftBuildingProgramIntoCityBlock(baseDocument, program, RIFT_DOWNTOWN_BANK_REPLACEMENT);
  composed.document.metadata = {
    ...(composed.document.metadata || {}),
    rift_bundle: {
      ...(composed.document.metadata?.rift_bundle || {}),
      bankRevision: BANK_BUNDLE_REVISION,
      bankOverlayId: BANK_OVERLAY_ID,
      composedAtRuntime: true
    }
  };
  lastComposition = composed;
  return composed.document;
}

clearStaleBundledDowntownSnapshots();

window.fetch = async function riftWorldComposedFetch(input, init) {
  if (!isDowntownRequest(input)) return nativeFetch(input, init);
  const response = await nativeFetch(input, init);
  if (!response.ok) return response;
  const baseDocument = await response.clone().json();
  const document = await composeDowntown(baseDocument);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-rift-world-composed', BANK_BUNDLE_REVISION);
  return new Response(JSON.stringify(document), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

window.RiftCityWorldComposition = Object.freeze({
  version: 'H2.01',
  bankRevision: BANK_BUNDLE_REVISION,
  bankProgramUrl: BANK_PROGRAM_URL.href,
  composeDowntown,
  clearStaleBundledDowntownSnapshots,
  get last() { return lastComposition; },
  async reloadBankProgram() {
    bankProgramPromise = null;
    clearStaleBundledDowntownSnapshots();
    return getBankProgram();
  }
});