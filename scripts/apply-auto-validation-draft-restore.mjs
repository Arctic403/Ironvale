import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Draft restore patch ${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}

let auto = read('public/rift-auto-validation.js');
auto = replaceOnce(auto,
`const SCREENSHOT_QUALITY = 0.78;\n\nconst state = {`,
`const SCREENSHOT_QUALITY = 0.78;\nconst TERRAIN_DRAFT_KEY = 'ironvale:terrain:draft:v4';\n\nfunction captureDraftBaseline() {\n  try {\n    const value = localStorage.getItem(TERRAIN_DRAFT_KEY);\n    return { present: value !== null, value: value ?? '', error: null };\n  } catch (error) {\n    return { present: false, value: '', error: String(error?.message || error || 'draft capture failed') };\n  }\n}\n\nfunction restoreDraftBaseline(baseline) {\n  if (!baseline || baseline.error) return false;\n  try {\n    if (baseline.present) localStorage.setItem(TERRAIN_DRAFT_KEY, baseline.value);\n    else localStorage.removeItem(TERRAIN_DRAFT_KEY);\n    return true;\n  } catch (_) { return false; }\n}\n\nconst state = {`,
'add exact draft baseline helpers');

auto = replaceOnce(auto,
`  const uiBaseline = captureUiBaseline();\n  const playerBaseline = window.IronvalePlayerState?.capture?.('auto-validation') || null;\n  diagnosticsRecord('Full auto validation started', { runId: state.runId, format: AUTO_VALIDATION_FORMAT });`,
`  const uiBaseline = captureUiBaseline();\n  const playerBaseline = window.IronvalePlayerState?.capture?.('auto-validation') || null;\n  let draftBaseline = null;\n  diagnosticsRecord('Full auto validation started', { runId: state.runId, format: AUTO_VALIDATION_FORMAT });`,
'add draft baseline variable');

auto = replaceOnce(auto,
`    await runStep('baseline integrity snapshot', async () => {\n      if (!window.IronvaleValidatorGuard?.captureIntegrity) throw new Error('Validator guard unavailable');\n      state.baselineIntegrity = await window.IronvaleValidatorGuard.captureIntegrity();`,
`    await runStep('baseline integrity snapshot', async () => {\n      if (!window.IronvaleValidatorGuard?.captureIntegrity) throw new Error('Validator guard unavailable');\n      draftBaseline = captureDraftBaseline();\n      if (draftBaseline.error) throw new Error('Terrain draft baseline unavailable: ' + draftBaseline.error);\n      state.baselineIntegrity = await window.IronvaleValidatorGuard.captureIntegrity();`,
'capture raw draft beside baseline integrity');

auto = replaceOnce(auto,
`    await restoreUiBaseline(uiBaseline);\n    state.playerRestoration = await restorePlayerBaseline(playerBaseline);\n    await runStep('post-test restoration integrity', async () => {`,
`    await restoreUiBaseline(uiBaseline);\n    if (!restoreDraftBaseline(draftBaseline)) throw new Error('Unable to restore exact terrain draft baseline');\n    state.playerRestoration = await restorePlayerBaseline(playerBaseline);\n    await runStep('post-test restoration integrity', async () => {`,
'restore exact draft before integrity comparison');

auto = replaceOnce(auto,
`    try { await restoreUiBaseline(uiBaseline); } catch (error) {\n      state.warn += 1;\n      state.steps.push({ name: 'restore UI baseline', status: 'warn', durationMs: 0, detail: shortError(error), screenshot: null });\n      state.status = strongestStatus(state.status, 'warn');\n    }\n    state.completedAt = nowIso();`,
`    try { await restoreUiBaseline(uiBaseline); } catch (error) {\n      state.warn += 1;\n      state.steps.push({ name: 'restore UI baseline', status: 'warn', durationMs: 0, detail: shortError(error), screenshot: null });\n      state.status = strongestStatus(state.status, 'warn');\n    }\n    if (draftBaseline && !restoreDraftBaseline(draftBaseline)) {\n      state.warn += 1;\n      state.steps.push({ name: 'restore terrain draft baseline', status: 'warn', durationMs: 0, detail: 'Exact local terrain draft restore failed', screenshot: null });\n      state.status = strongestStatus(state.status, 'warn');\n    }\n    state.completedAt = nowIso();`,
'restore exact draft in abort/final recovery');
write('public/rift-auto-validation.js', auto);

let html = read('public/index.html');
html = html.replace('/rift-auto-validation.js?v=20260902-security-smoke-r1', '/rift-auto-validation.js?v=20260902-draft-restore-r1');
write('public/index.html', html);

let securityCheck = read('scripts/check-security-smoke-v1.mjs');
securityCheck = securityCheck.replace(
`  '/rift-auto-validation.js?v=20260902-security-smoke-r1'`,
`  '/rift-auto-validation.js?v=20260902-draft-restore-r1'`
);
write('scripts/check-security-smoke-v1.mjs', securityCheck);

const verifier = `import fs from 'node:fs';\n\nconst read = path => fs.readFileSync(path, 'utf8');\nconst auto = read('public/rift-auto-validation.js');\nconst html = read('public/index.html');\nconst pkg = JSON.parse(read('package.json'));\nconst assert = (ok, message) => { if (!ok) throw new Error('Auto-validation draft restore check failed: ' + message); };\n\nfor (const token of [\n  \"const TERRAIN_DRAFT_KEY = 'ironvale:terrain:draft:v4'\",\n  'function captureDraftBaseline()',\n  'function restoreDraftBaseline(baseline)',\n  'draftBaseline = captureDraftBaseline()',\n  \"if (!restoreDraftBaseline(draftBaseline)) throw new Error('Unable to restore exact terrain draft baseline')\",\n  'if (draftBaseline && !restoreDraftBaseline(draftBaseline))'\n]) assert(auto.includes(token), 'missing ' + token);\nassert(auto.indexOf('draftBaseline = captureDraftBaseline()') < auto.indexOf('state.baselineIntegrity = await window.IronvaleValidatorGuard.captureIntegrity()'), 'draft baseline must be captured immediately before integrity baseline');\nassert(auto.indexOf(\"if (!restoreDraftBaseline(draftBaseline)) throw new Error('Unable to restore exact terrain draft baseline')\") < auto.indexOf('state.finalIntegrity = await window.IronvaleValidatorGuard.captureIntegrity()'), 'exact draft must be restored before final integrity capture');\nassert(html.includes('/rift-auto-validation.js?v=20260902-draft-restore-r1'), 'Safari cache-bust missing');\nassert(String(pkg.scripts?.build || '').includes('node scripts/check-auto-validation-draft-restore.mjs'), 'build verifier missing');\nassert(!fs.existsSync('scripts/apply-auto-validation-draft-restore.mjs'), 'temporary patcher must be removed');\nassert(!fs.existsSync('.github/workflows/apply-auto-validation-draft-restore.yml'), 'temporary workflow must be removed');\nconsole.log('Ironvale auto-validation exact local draft restoration verified.');\n`;
write('scripts/check-auto-validation-draft-restore.mjs', verifier);

const pkg = JSON.parse(read('package.json'));
let build = String(pkg.scripts?.build || '');
if (!build.includes('node scripts/check-auto-validation-draft-restore.mjs')) build += ' && node scripts/check-auto-validation-draft-restore.mjs';
pkg.scripts.build = build;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

execFileSync(process.execPath, ['scripts/generate-integrity-manifest.mjs'], { stdio: 'inherit' });
console.log('Exact auto-validation local draft restoration patch applied.');
