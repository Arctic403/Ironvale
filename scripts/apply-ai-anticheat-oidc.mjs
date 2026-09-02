// v2: reviewer-contract compatible OIDC bridge patch
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

let worker = read('src/realtime-entry.js');
if (!worker.includes("from './github-oidc.js'")) {
  const importMarker = "import { ANTICHEAT_SCHEMA, antiCheatEvidence, antiCheatSummary, createAntiCheatState, markAntiCheatCasePersisted, observeAcceptedMovement, observeRejectedMovement, shouldPersistAntiCheatCase } from './anticheat.js';";
  if (!worker.includes(importMarker)) throw new Error('AI bridge patch: anti-cheat import marker missing');
  worker = worker.replace(importMarker, `${importMarker}\nimport { verifyGitHubAntiCheatOidc } from './github-oidc.js';`);
}

const reviewerPattern = /async function authorizeAntiCheatReviewer\(request, env, \{ write = false \} = \{\}\) \{[\s\S]*?\n\}\n\nfunction antiCheatCaseRow/;
const reviewerReplacement = `async function authorizeAntiCheatReviewer(request, env, { write = false } = {}) {
  if (!write) {
    const configured = String(env.ANTICHEAT_SERVICE_KEY || '');
    const supplied = String(request.headers.get('x-ironvale-anticheat-key') || '');
    if (configured && supplied && constantTimeEqual(configured, supplied)) {
      return { kind: 'service', reviewer: 'ai-anticheat-service', auth: null };
    }

    const authorization = String(request.headers.get('authorization') || '');
    const bearer = authorization.replace(/^Bearer\\s+/i, '').trim();
    if (bearer && bearer !== authorization) {
      const oidc = await verifyGitHubAntiCheatOidc(bearer);
      if (oidc.ok) {
        return {
          kind: 'github-oidc',
          reviewer: 'ai-anticheat-github-oidc',
          auth: null,
          oidc: { runId: oidc.runId, runAttempt: oidc.runAttempt, actor: oidc.actor, expiresAt: oidc.expiresAt }
        };
      }
    }
  }

  const auth = await loadSessionState(request, env);
  if (auth?.role === 'admin') return { kind: 'admin', reviewer: auth.username || 'admin', auth };
  return null;
}

function antiCheatCaseRow`;
if (!worker.includes("reviewer: 'ai-anticheat-github-oidc'")) {
  if (!reviewerPattern.test(worker)) throw new Error('AI bridge patch: reviewer function marker missing');
  worker = worker.replace(reviewerPattern, reviewerReplacement);
}
write('src/realtime-entry.js', worker);

const packagePath = 'package.json';
const pkg = JSON.parse(read(packagePath));
let build = String(pkg.scripts?.build || '');
if (!build.includes('node --check src/github-oidc.js')) {
  build = build.replace('node --check src/anticheat.js', 'node --check src/anticheat.js && node --check src/github-oidc.js');
}
if (!build.includes('node scripts/check-ai-anticheat-bridge.mjs')) {
  build = `${build} && node scripts/check-ai-anticheat-bridge.mjs`;
}
pkg.scripts.build = build;
write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('AI anti-cheat GitHub OIDC bridge integrated.');
