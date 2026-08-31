import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`[cloudflare-efficiency] ${label}: expected block not found`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`[cloudflare-efficiency] ${label}: expected block is not unique`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}
function replaceRegex(source, regex, replacement, label) {
  const matches = source.match(regex);
  if (!matches) throw new Error(`[cloudflare-efficiency] ${label}: expected pattern not found`);
  return source.replace(regex, replacement);
}
let app = read('public/app.js');
app = replaceOnce(app,
  "    await refreshSession({navigate:false});\n",
  "    await refreshSession({navigate:false,maxAgeMs:120_000});\n",
  'focus auth throttle');
write('public/app.js', app);

let shell = read('public/ui/shell.js');
shell = replaceOnce(shell,
  "import { api, getService } from './api.js';\n",
  "import { api } from './api.js';\n",
  'remove service fanout import');
shell = replaceOnce(shell,
  "let effectTimer=null;\n",
  "const EFFECT_SYNC_FALLBACK_MS=120_000;\nconst EFFECT_SYNC_MIN_GAP_MS=5_000;\nlet effectTimer=null;\nlet effectRefreshTimer=null;\nlet effectSyncPending=null;\nlet lastEffectSyncAt=0;\nlet mutationSyncTimer=null;\nlet lastSessionRefreshAt=0;\n",
  'sync timing state');
shell = replaceOnce(shell,
`  try {
    const result=await api('/api/player/state');
    if (result.ok&&result.player) renderPlayerHud(result.player);
  } finally {`,
`  try {
    await refreshEffects({reason:'resource-regen',force:true});
  } finally {`, 'regen uses aggregate sync');
shell = replaceOnce(shell,
  "export async function refreshSession({navigate=true}={}) {\n  setSessionStatus('Checking RiftCity session…');\n",
  "export async function refreshSession({navigate=true,maxAgeMs=0}={}) {\n  if (state.authenticated && Number(maxAgeMs)>0 && Date.now()-lastSessionRefreshAt<Number(maxAgeMs)) {\n    renderPlayerHud(state.player);\n    startEffects();\n    return true;\n  }\n  setSessionStatus('Checking RiftCity session…');\n",
  'session max age');
shell = replaceOnce(shell,
  "    clearState();\n    $('#auth-grid')?.classList.remove('hidden');\n",
  "    clearState();\n    lastSessionRefreshAt=0;\n    $('#auth-grid')?.classList.remove('hidden');\n",
  'clear auth refresh timestamp');
shell = replaceOnce(shell,
  "  state.authenticated=true;\n  state.user=result.user;\n",
  "  state.authenticated=true;\n  lastSessionRefreshAt=Date.now();\n  state.user=result.user;\n",
  'record auth refresh timestamp');
shell = replaceOnce(shell,
`export function startEffects() {
  if (effectTimer) return;
  refreshEffects();
  effectTimer=setInterval(tickEffects,1000);
  refreshEffects.timer=setInterval(refreshEffects,30000);
}

export function stopEffects() {
  clearInterval(effectTimer); effectTimer=null;
  clearInterval(refreshEffects.timer); refreshEffects.timer=null;
}

let effects=[];
`,
`function scheduleEffectRefresh(delay=EFFECT_SYNC_FALLBACK_MS) {
  clearTimeout(effectRefreshTimer);
  effectRefreshTimer=null;
  if (!state.authenticated) return;
  effectRefreshTimer=setTimeout(()=>refreshEffects({reason:'timer'}),Math.max(5_000,Number(delay)||EFFECT_SYNC_FALLBACK_MS));
}

export function startEffects() {
  if (effectTimer) return;
  effectTimer=setInterval(tickEffects,1000);
  tickEffects();
  refreshEffects({reason:'start',force:true});
}

export function stopEffects() {
  clearInterval(effectTimer); effectTimer=null;
  clearTimeout(effectRefreshTimer); effectRefreshTimer=null;
  clearTimeout(mutationSyncTimer); mutationSyncTimer=null;
  effectSyncPending=null;
}

let effects=[];
`, 'replace 30 second effect fanout timer');
shell = replaceRegex(shell,
/export async function refreshEffects\(\) \{[\s\S]*?\n\}\n$/,
`export async function refreshEffects({reason='manual',force=false}={}) {
  if (!state.authenticated) return null;
  if (!force && document.visibilityState==='hidden') {
    scheduleEffectRefresh(EFFECT_SYNC_FALLBACK_MS);
    return null;
  }
  if (typeof navigator!=='undefined' && navigator.onLine===false) {
    scheduleEffectRefresh(30_000);
    return null;
  }
  const age=Date.now()-lastEffectSyncAt;
  if (!force && age<EFFECT_SYNC_MIN_GAP_MS) {
    scheduleEffectRefresh(Math.max(EFFECT_SYNC_MIN_GAP_MS-age,5_000));
    return null;
  }
  if (effectSyncPending) return effectSyncPending;

  effectSyncPending=(async()=>{
    const result=await api('/api/sync',{riftBackground:true,riftCacheTtl:750});
    if (!result.ok) {
      scheduleEffectRefresh(result.offline?30_000:45_000);
      return result;
    }
    lastEffectSyncAt=Date.now();
    if (result.player) renderPlayerHud(result.player);
    if (result.location) state.location=result.location;
    const bundle=result.effects||{};
    if (bundle.law) state.law=bundle.law;
    if (bundle.merits) state.merits=bundle.merits;

    const next=[];
    const status=bundle.status||result.player?.status;
    if (status?.type&&status.type!=='active') next.push({label:String(status.type).toUpperCase(),until:status.until,route:'status',tone:'danger'});
    const event=bundle.event;
    if (event) next.push({label:'CITY EVENT',value:event.name||event.title||'Active',route:'events',tone:'event'});
    const travel=bundle.travel;
    if (travel?.travelingTo&&Number(travel.arrivesAt)>Date.now()) next.push({label:'TRAVEL',until:travel.arrivesAt,route:'travel',tone:'info'});
    for (const enrollment of bundle.education||[]) {
      if (Number(enrollment.completesAt)>Date.now()) next.push({label:'EDUCATION',value:enrollment.name||enrollment.courseId,until:enrollment.completesAt,route:'education'});
    }
    if (Number(bundle.production?.activeCount)>0) next.push({label:'PRODUCTION',value:\`${'${'}bundle.production.activeCount} active\`,route:'production'});
    if (bundle.bank?.frozen) next.push({label:'BANK FROZEN',until:bundle.bank.frozenUntil,route:'bank',tone:'danger'});
    if (Number(bundle.law?.heat)>0) next.push({label:'HEAT',value:\`${'${'}bundle.law.heat} · ${'${'}bundle.law.tier?.name||''}\`,route:'law',tone:Number(bundle.law.heat)>=60?'danger':'event'});
    if (Number(bundle.activity?.unread)>0) next.push({label:'ACTIVITY',value:\`${'${'}bundle.activity.unread} unread\`,route:'activity',tone:'info'});
    effects=next;
    const root=$('#effects-strip');
    root?.classList.toggle('empty',!effects.length);
    tickEffects();
    scheduleEffectRefresh(Math.max(30_000,Number(result.pollAfterMs)||EFFECT_SYNC_FALLBACK_MS));
    return result;
  })();

  try { return await effectSyncPending; }
  finally { effectSyncPending=null; }
}

function scheduleMutationSync() {
  if (!state.authenticated) return;
  clearTimeout(mutationSyncTimer);
  mutationSyncTimer=setTimeout(()=>refreshEffects({reason:'mutation',force:true}),350);
}

window.addEventListener('riftapi:mutation',scheduleMutationSync);
window.addEventListener('online',()=>{ if(state.authenticated) refreshEffects({reason:'online',force:true}); });
document.addEventListener('visibilitychange',()=>{
  if (document.visibilityState==='visible'&&state.authenticated&&Date.now()-lastEffectSyncAt>30_000) refreshEffects({reason:'visible',force:true});
});
`, 'replace effect fanout with aggregate sync');
write('public/ui/shell.js', shell);

let menu = read('public/rift-game-menu.js');
menu = replaceOnce(menu,
  ".rift-validator-row span{display:grid;gap:2px}.rift-validator-row small{color:#9eb0be;font-size:9px;font-weight:600}.rift-validator-row input{width:24px;height:24px;accent-color:#69d69b}\n",
  ".rift-validator-row span{display:grid;gap:2px}.rift-validator-row small{color:#9eb0be;font-size:9px;font-weight:600}.rift-validator-row input{width:24px;height:24px;accent-color:#69d69b}\n.rift-network-readout{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:9px;border:1px solid #ffffff18;border-radius:12px;background:#09131b}.rift-network-readout div{min-width:0;padding:7px;border:1px solid #ffffff0d;background:#ffffff07}.rift-network-readout span{display:block;color:#8fa8ba;font:800 8px/1.2 system-ui;letter-spacing:.08em}.rift-network-readout b{display:block;margin-top:3px;color:#eaf8ff;font:900 12px/1 system-ui}.rift-network-readout small{grid-column:1/-1;color:#88a0b0;font:600 9px/1.35 system-ui}\n",
  'network telemetry css');
menu = replaceOnce(menu,
  "  const buildPanel = r.querySelector('[data-rift-tool-build-panel]');\n  if (buildPanel) buildPanel.classList.toggle('active', !!r.querySelector('#rift-creative-panel')?.classList.contains('open'));\n",
  "  const buildPanel = r.querySelector('[data-rift-tool-build-panel]');\n  if (buildPanel) buildPanel.classList.toggle('active', !!r.querySelector('#rift-creative-panel')?.classList.contains('open'));\n  const networkOut = r.querySelector('[data-rift-network-readout]');\n  if (networkOut) {\n    const net = window.RiftCityNetwork?.status;\n    if (!net) networkOut.innerHTML='<small>Network telemetry becomes available after the RiftCity API bridge loads.</small>';\n    else {\n      const hit = Math.round((Number(net.cacheHitRate)||0)*100);\n      const daily = net.estimatedDailyRequests==null?'WARMING':Number(net.estimatedDailyRequests).toLocaleString();\n      networkOut.innerHTML=`<div><span>WORKER REQUESTS</span><b>${net.networkRequests}</b></div><div><span>AVOIDED</span><b>${net.avoidedWorkerRequests}</b></div><div><span>CACHE / DEDUPE</span><b>${hit}%</b></div><div><span>AVG LATENCY</span><b>${Math.round(net.avgLatencyMs||0)} ms</b></div><div><span>SYNC D1 ROWS</span><b>${net.syncBatchRowsRead}</b></div><div><span>EST. / DAY</span><b>${daily}</b></div><small>Sync batch queries: ${net.syncBatchQueries} · retries: ${net.retries} · blocked runaway GETs: ${net.blocked}. D1 row count is the aggregate-sync batch only, not every game query.</small>`;\n    }\n  }\n",
  'network telemetry sync');
menu = replaceOnce(menu,
  "            <label class=\"rift-validator-row\"><span><b>VALIDATOR DEBUG</b><small>Show live validation pass popups after block/world edits.</small></span><input data-rift-validator-debug type=\"checkbox\"></label>\n",
  "            <label class=\"rift-validator-row\"><span><b>VALIDATOR DEBUG</b><small>Show live validation pass popups after block/world edits.</small></span><input data-rift-validator-debug type=\"checkbox\"></label>\n            <div class=\"rift-network-readout\" data-rift-network-readout><small>Loading Cloudflare efficiency telemetry…</small></div>\n",
  'network telemetry markup');
menu = replaceOnce(menu,
  "window.addEventListener('riftgraphicsbuffer', sync);\n",
  "window.addEventListener('riftgraphicsbuffer', sync);\nwindow.addEventListener('riftnetworkchange', syncDevTools);\n",
  'network telemetry event');
menu = replaceOnce(menu,
  "  version: 'H1.86-dev-tools-validator-debug',\n",
  "  version: 'H1.87-cloudflare-efficiency',\n",
  'menu version');
write('public/rift-game-menu.js', menu);

const verifierSource = `import fs from 'node:fs';
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
`;
write('scripts/check-rift-cloudflare-efficiency.js', verifierSource);

let pkg = JSON.parse(read('package.json'));
if (!pkg.scripts['verify:cloudflare-efficiency']) pkg.scripts['verify:cloudflare-efficiency'] = 'node scripts/check-rift-cloudflare-efficiency.js';
if (!pkg.scripts.build.includes('verify:cloudflare-efficiency')) {
  pkg.scripts.build = pkg.scripts.build.replace('node scripts/check-js.js &&', 'node scripts/check-js.js && npm run verify:cloudflare-efficiency &&');
}
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

console.log('[cloudflare-efficiency] patch applied');
