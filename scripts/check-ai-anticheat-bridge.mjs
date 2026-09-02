import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (ok, message) => { if (!ok) throw new Error(`AI anti-cheat bridge check failed: ${message}`); };

const oidc = read('src/github-oidc.js');
const worker = read('src/realtime-entry.js');
const workflow = read('.github/workflows/ai-anticheat-review.yml');
const pkg = JSON.parse(read('package.json'));

for (const token of [
  "GITHUB_OIDC_AUDIENCE = 'ironvale-anticheat'",
  "GITHUB_OIDC_REPOSITORY = 'Arctic403/Ironvale'",
  "GITHUB_OIDC_REPOSITORY_ID = '1337864874'",
  "GITHUB_OIDC_REF = 'refs/heads/main'",
  "GITHUB_OIDC_WORKFLOW_REF = 'Arctic403/Ironvale/.github/workflows/ai-anticheat-review.yml@refs/heads/main'",
  "header?.alg !== 'RS256'",
  "crypto.subtle.verify",
  "github-oidc-signature-invalid"
]) assert(oidc.includes(token), `OIDC verifier missing ${token}`);

for (const token of [
  "verifyGitHubAntiCheatOidc",
  "kind: 'github-oidc'",
  "reviewer: 'ai-anticheat-github-oidc'"
]) assert(worker.includes(token), `Worker missing ${token}`);

assert(worker.includes("authorizeAntiCheatReviewer(request, env, { write = false } = {})"), 'reviewer boundary missing');
assert(worker.includes("if (!write)"), 'OIDC/service access must be read-only');
assert(worker.includes("if (auth?.role === 'admin')"), 'admin write fallback missing');

for (const token of [
  'id-token: write',
  'audience=ironvale-anticheat',
  '/api/anticheat/summary',
  '/api/anticheat/cases?status=all&minRisk=30&limit=50',
  'retention-days: 1'
]) assert(workflow.includes(token), `review workflow missing ${token}`);

assert(!fs.existsSync('scripts/apply-ai-anticheat-oidc.mjs'), 'temporary AI bridge patcher must be removed');
assert(!fs.existsSync('.github/workflows/apply-ai-anticheat-oidc.yml'), 'temporary AI bridge apply workflow must be removed');

const build = String(pkg.scripts?.build || '');
assert(build.includes('node --check src/github-oidc.js'), 'core build missing OIDC syntax check');
assert(build.includes('node scripts/check-ai-anticheat-bridge.mjs'), 'core build missing AI bridge contract check');

console.log('Ironvale AI anti-cheat bridge verified: signed GitHub OIDC, exact repo/workflow/ref, read-only AI access, one-day evidence snapshots, staging clean.');
