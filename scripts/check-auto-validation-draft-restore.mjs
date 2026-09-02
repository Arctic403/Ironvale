import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const auto = read('public/rift-auto-validation.js');
const html = read('public/index.html');
const pkg = JSON.parse(read('package.json'));
const assert = (ok, message) => { if (!ok) throw new Error('Auto-validation draft restore check failed: ' + message); };

for (const token of [
  "const TERRAIN_DRAFT_KEY = 'ironvale:terrain:draft:v4'",
  'function captureDraftBaseline()',
  'function restoreDraftBaseline(baseline)',
  'draftBaseline = captureDraftBaseline()',
  "if (!restoreDraftBaseline(draftBaseline)) throw new Error('Unable to restore exact terrain draft baseline')",
  'if (draftBaseline && !restoreDraftBaseline(draftBaseline))'
]) assert(auto.includes(token), 'missing ' + token);
assert(auto.indexOf('draftBaseline = captureDraftBaseline()') < auto.indexOf('state.baselineIntegrity = await window.IronvaleValidatorGuard.captureIntegrity()'), 'draft baseline must be captured immediately before integrity baseline');
assert(auto.indexOf("if (!restoreDraftBaseline(draftBaseline)) throw new Error('Unable to restore exact terrain draft baseline')") < auto.indexOf('state.finalIntegrity = await window.IronvaleValidatorGuard.captureIntegrity()'), 'exact draft must be restored before final integrity capture');
assert(html.includes('/rift-auto-validation.js?v=20260902-zone-authority-r1'), 'Safari cache-bust missing');
assert(String(pkg.scripts?.build || '').includes('node scripts/check-auto-validation-draft-restore.mjs'), 'build verifier missing');
assert(!fs.existsSync('scripts/apply-auto-validation-draft-restore.mjs'), 'temporary patcher must be removed');
assert(!fs.existsSync('.github/workflows/apply-auto-validation-draft-restore.yml'), 'temporary workflow must be removed');
console.log('Ironvale auto-validation exact local draft restoration verified.');
