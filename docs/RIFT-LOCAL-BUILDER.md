# Rift Local Builder · H2.10

Rift Local Builder moves BuildingProgram iteration off Cloudflare and off the heavy GitHub preview workflows.

## Architecture

`ChatGPT/GitHub -> rift-local-queue:rift-local-jobs/*.json -> GitHub Pages Builder -> browser Web Worker -> H2 compiler/validators -> rift-local-queue:rift-local-results/*.json -> final accepted source commit on ai-static-world-builder -> normal CI`

Cloudflare is not used anywhere in this developer/build loop. The existing Cloudflare Worker remains the RiftCity game/API backend only.

## Queue branch

Jobs and results use `rift-local-queue`, separate from `ai-static-world-builder`. The AI branch already participates in an open pull request, so harmless queue commits there could retrigger PR workflows based on older changed files. No RiftCity workflow listens to `rift-local-queue`, therefore routine local build traffic launches zero GitHub Actions.

- Jobs: `rift-local-jobs/`
- Results: `rift-local-results/`

Only the final accepted BuildingProgram update goes to `ai-static-world-builder` for normal independent CI.

## Browser authentication: fine-grained PAT, no relay

GitHub's OAuth/device token endpoints are not a reliable direct browser authentication path because browser CORS prevents a static SPA from completing the token exchange. H2.10 therefore does not embed a GitHub App secret and does not use Cloudflare or any other auth proxy.

Create a **fine-grained personal access token** with the narrowest possible access:

1. Resource owner: the account that owns `RiftCityV1`.
2. Repository access: **Only select repositories -> RiftCityV1**.
3. Repository permissions: **Contents -> Read and write**.
4. Do not grant unrelated permissions.
5. Prefer an expiration date rather than an indefinite token.

Paste it into the Builder when you start a work session. The token is stored in browser `sessionStorage` only, cleared by **Forget token**, and never included in BuildingPrograms, result manifests, OPFS/IndexedDB artifacts, GitHub commits, or Cloudflare requests.

## Private repository / Pages

`RiftCityV1` is private. GitHub Pages from a private personal repository requires a GitHub plan that supports Pages for private repositories. The deployed Pages site itself is public unless using eligible organization/Enterprise private Pages.

H2.10 deliberately deploys only the Builder shell plus the minimum H2 compiler runtime. It does not deploy game assets, Worker source, D1 schema, private BuildingPrograms, or queue content.

The initial Pages workflow will fail at `actions/configure-pages` until Pages is enabled once. In repository settings choose **Settings -> Pages -> Build and deployment -> Source -> GitHub Actions**, then rerun **Rift Local Builder Pages**. `configure-pages` cannot safely self-enable this using the default `GITHUB_TOKEN`; its enablement mode requires a different credential.

If private-repository Pages is unavailable on the account plan, the same minimal Builder artifact can be hosted from a separate public Pages repository later, still with zero Cloudflare.

## iPhone use

Open the Pages Builder URL in Safari and optionally Add to Home Screen. While open it polls `rift-local-queue`, compiles jobs in a module Web Worker, validates every H2 stage, stores full local candidates/results in IndexedDB and best-effort OPFS, and commits only compact result manifests to the queue branch.

Closing or suspending Safari pauses polling. The phone is the compute worker, not an always-on server.

## Job format

```json
{
  "format": "riftcity-local-build-job",
  "version": 1,
  "job_id": "bank-candidate-001",
  "target": {
    "path": "public/riftcity-buildings/riftcity-bank-001.json",
    "branch": "ai-static-world-builder"
  },
  "candidate": {
    "program": { "format": "riftcity-building-program" }
  },
  "changed_paths": ["building.roof_plan"]
}
```

A job may alternatively use `source.path` to compile an already committed BuildingProgram from the source branch.

## Result contract and parity

The browser returns `riftcity-local-build-result` with candidate SHA-256, compiled-document SHA-256, BuildingPlan fingerprint, exact H2 stage snapshot, affected stages, stats, diagnostics/repair tasks and PASS/FAIL. The full compiled document stays on the device.

`scripts/check-rift-local-builder.js` compiles the current Bank both directly and through the same `local-build-core.js` used by the browser worker. It requires identical document hashes, stats and pipeline output. It needs no npm install, Chrome, screenshots or Cloudflare.
