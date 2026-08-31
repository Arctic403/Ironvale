import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = Object.fromEntries([
  'src/index.js','src/services/sync.js','src/services/gameplay.js','src/services/advanced.js','src/services/living-city.js',
  'public/ui/api.js','public/ui/shell.js','public/app.js','public/rift-game-menu.js','schema.sql'
].map(path=>[path,fs.readFileSync(new URL('../'+path,import.meta.url),'utf8')]));

const has=(path,text)=>assert.ok(files[path].includes(text), path+' missing '+text);
has('src/index.js','SESSION_ACTIVITY_WRITE_INTERVAL_MS = 5 * 60_000');
has('src/index.js','s.last_seen_at');
has('src/index.js','now - lastActivityWrite >= SESSION_ACTIVITY_WRITE_INTERVAL_MS');
has('src/index.js',"url.pathname === '/api/sync'");
has('src/index.js','playerStateSchemaEnsured');
has('src/index.js','playerLocationSchemaEnsured');
has('src/index.js','inventorySchemaEnsured');
has('src/services/sync.js','env.DB.batch([');
has('src/services/sync.js','pollAfterMs: RIFT_SYNC_POLL_MS');
has('src/services/gameplay.js','idx_player_education_active');
has('src/services/advanced.js','idx_production_unclaimed');
has('src/services/living-city.js','idx_activity_feed_unread');
has('schema.sql','idx_player_education_active');
has('schema.sql','idx_production_unclaimed');
has('schema.sql','idx_activity_feed_unread');
has('public/ui/shell.js',"api('/api/sync'");
assert.ok(!files['public/ui/shell.js'].includes("getService('status')"),'legacy nine-service HUD fanout is still present');
has('public/ui/shell.js','EFFECT_SYNC_FALLBACK_MS=120_000');
has('public/app.js','maxAgeMs:120_000');
has('public/rift-game-menu.js','data-rift-network-readout');

const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async () => {
  calls += 1;
  await new Promise(resolve=>setTimeout(resolve,15));
  return new Response(JSON.stringify({ok:true,pollAfterMs:120000,usage:{batchQueries:6,batchRowsRead:12,batchRowsWritten:0}}),{status:200,headers:{'Content-Type':'application/json'}});
};
const apiModule = await import(new URL('../public/ui/api.js?efficiency-test='+Date.now(),import.meta.url));
const firstPair = await Promise.all([
  apiModule.api('/api/sync',{riftCacheTtl:1000}),
  apiModule.api('/api/sync',{riftCacheTtl:1000})
]);
assert.equal(calls,1,'identical in-flight sync GETs must dedupe to one Worker request');
assert.equal(firstPair[0].ok,true);
await apiModule.api('/api/sync',{riftCacheTtl:1000});
assert.equal(calls,1,'short sync cache must avoid the immediate follow-up Worker request');
const status = apiModule.getRiftNetworkStatus();
assert.ok(status.deduped>=1,'dedupe metric did not move');
assert.ok(status.cacheHits>=1,'cache-hit metric did not move');
assert.equal(status.syncBatchQueries,6,'sync D1 batch telemetry did not propagate');
assert.equal(status.syncBatchRowsRead,12,'sync D1 read telemetry did not propagate');
globalThis.fetch = originalFetch;

console.log('[rift-cloudflare-efficiency] PASS · aggregate HUD sync, throttled session writes, cached schema guards, request dedupe/cache/guard and Dev Tools telemetry are wired.');
