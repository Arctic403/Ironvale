import { composeRiftBuildingProgramIntoCityBlock, RIFT_DOWNTOWN_BANK_REPLACEMENT } from './rift-world-composer.js';

const nativeFetch = window.fetch.bind(window);
const BANK_PROGRAM_URL = new URL('./riftcity-buildings/riftcity-bank-001.json', import.meta.url);
const DOWNTOWN_SUFFIX = '/riftcity-blocks/downtown-block-001.json';
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
  lastComposition = composed;
  return composed.document;
}

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
  headers.set('x-rift-world-composed', 'h1.86-bank');
  return new Response(JSON.stringify(document), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

window.RiftCityWorldComposition = Object.freeze({
  version: 'H1.86',
  bankProgramUrl: BANK_PROGRAM_URL.href,
  composeDowntown,
  get last() { return lastComposition; },
  async reloadBankProgram() {
    bankProgramPromise = null;
    return getBankProgram();
  }
});
