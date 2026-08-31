import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const exists = path => fs.existsSync(path);
const fail = message => { console.error(`[ironvale-foundation] FAIL · ${message}`); process.exit(1); };
const expect = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const index = read('public/index.html');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const app = read('public/app.js');
const router = read('public/ui/router.js');
const server = read('src/index.js');
const schema = read('schema.sql');
const content = read('src/ironvale/content.js');
const api = read('src/ironvale/api.js');
const worldShell = read('public/downtown3d-foundation.js');

expect(pkg.name === 'ironvale-medieval-mmo', 'package must identify Ironvale');
expect(pkg.scripts?.build?.includes('verify:ironvale'), 'build must run Ironvale verifier');
expect(index.includes('IRONVALE') && !index.includes('RiftCity'), 'active HTML must be Ironvale branded');
expect(manifest.name === 'Ironvale' && manifest.start_url === '/#world' && manifest.orientation === 'any', 'PWA must launch Ironvale world in any orientation');
expect(manifest.icons?.[0]?.src === '/ironvale-icon.svg' && exists('public/ironvale-icon.svg'), 'Ironvale icon must be installed');
expect(!exists('public/riftcity-icon.svg'), 'old RiftCity icon must be removed');
expect(router.includes("'world'") && !router.includes("casino:'casino'") && !router.includes("police:'law'"), 'router must expose the new RPG surface');
expect(app.includes('renderJournal') && app.includes('renderCodex') && !app.includes('renderCrimes') && !app.includes('renderService'), 'active app must route to Ironvale views only');
for (const path of ['public/views/crimes.js','public/views/service.js','public/views/wiki.js','public/views/services','src/plugins','src/services']) expect(!exists(path), `${path} must be removed from active source`);
for (const path of ['native/rift-core.cpp','public/rift-engine.js','public/rift-player.js','public/rift-wasm-core.js','public/rift-block-section.js','public/rift-building-pipeline.js']) expect(exists(path), `${path} Rift Engine foundation must remain`);
expect(exists('public/rift-world-blocks') && exists('public/rift-buildings'), 'game asset namespaces must use Rift Engine names');
expect(!exists('public/riftcity-blocks') && !exists('public/riftcity-buildings'), 'RiftCity-named asset directories must be gone');
expect(exists('public/rift-world-blocks/ironvale-foundation-001.json'), 'Ironvale foundation world must be the default block');
expect(server.includes("handleIronvaleApi") && server.includes("ironvale_session"), 'Worker must use Ironvale API and session namespace');
expect(!server.includes("url.pathname === '/api/crimes'") && !server.includes("url.pathname.startsWith('/api/services')") && !server.includes("url.pathname === '/api/world/travel'"), 'modern RiftCity gameplay routes must be removed');
expect(server.includes("url.pathname.startsWith('/api/world/blocks/')"), 'Rift authoring block endpoint must remain');
for (const table of ['ironvale_characters','ironvale_inventory','ironvale_equipment','ironvale_quest_progress','ironvale_world_flags']) expect(schema.includes(table), `schema missing ${table}`);
for (const legacy of ['player_crime_progress','crime_history','player_casino','player_law','player_bank_accounts']) expect(!schema.includes(legacy), `fresh schema still contains ${legacy}`);
for (const token of ['IRONVALE_QUESTS','IRONVALE_NPCS','IRONVALE_FACTIONS','IRONVALE_CREATURES','IRONVALE_DUNGEONS','blackstone-barrow','brackenford']) expect(content.includes(token), `content foundation missing ${token}`);
expect(api.includes("/api/ironvale/bootstrap") && api.includes("/api/ironvale/sync") && api.includes("/api/ironvale/quests/accept"), 'Ironvale API foundation incomplete');
expect(worldShell.includes('IRONVALE · RIFT ENGINE WORLD FOUNDATION') && worldShell.includes("ironvale:world:active-block:v1"), '3D world shell must be Ironvale-branded');

console.log('[ironvale-foundation] PASS · Ironvale owns the active MMO/RPG surface while Rift Engine, Native Core v3, authoring and Cloudflare foundations remain intact.');
