# Rift Local Builder · H2.10

Rift Local Builder moves BuildingProgram iteration off Cloudflare and off the heavy GitHub preview workflows.

## Architecture

`ChatGPT/GitHub -> rift-local-queue:rift-local-jobs/*.json -> GitHub Pages Builder -> browser Web Worker -> H2 compiler/validators -> rift-local-queue:rift-local-results/*.json -> final accepted source commit on ai-static-world-builder -> normal CI`

Cloudflare is not used anywhere in this developer/build loop. The existing Cloudflare Worker remains the RiftCity game/API backend only.

## Why the queue uses its own branch

Jobs and results use the dedicated `rift-local-queue` branch. This is intentionally separate from `ai-static-world-builder`.

The AI branch already participates in an open pull request. GitHub pull-request path filters are evaluated against the PR's changed-file set, so pushing harmless job/result JSON to the AI branch could still retrigger preview workflows because older files in the PR match those filters. A separate queue branch has no pull request and none of RiftCity's workflows listen to it, so routine local-build traffic launches **zero GitHub Actions**.

The queue contains:

- `rift-local-jobs/`
- `rift-local-results/`

Only the final accepted BuildingProgram update is committed to `ai-static-world-builder`, where normal CI can independently verify it once.

## Private repository warning

`RiftCityV1` is private. GitHub Pages from a private personal repository requires a GitHub plan that supports Pages for private repositories. GitHub Pages sites are public on the internet unless using eligible organization/Enterprise private Pages. H2.10 deliberately publishes only the Builder shell plus the minimum H2 compiler runtime files; it does **not** publish the RiftCity game assets, Worker source, D1 schema, private BuildingPrograms, or queue contents.

If private-repository Pages is unavailable, the same minimal `_site` bundle can later be moved to a separate public Pages repository without changing the local worker/job protocol and without adding Cloudflare.

## One-time GitHub App setup

Create a GitHub App for the local Builder and install it only on `Arctic403/RiftCityV1`.

Recommended app configuration:

1. Repository permission: **Contents: Read and write**.
2. Do not request unrelated repository/account permissions.
3. Enable **Device Flow**.
4. Install the app on **Only select repositories -> RiftCityV1**.
5. Copy the app's **Client ID** into the Builder connection panel. The Client ID is not a secret.

The Builder requests a GitHub App user token through device flow and includes RiftCityV1's repository ID when completing authorization. The access token is stored only in browser `sessionStorage`; it is never committed to the repository or included in result JSON.

For Pages, open repository **Settings -> Pages -> Build and deployment -> Source -> GitHub Actions** once. Then manually run `Rift Local Builder Pages` if the initial push could not deploy because Pages was not enabled yet.

## iPhone use

Open the Pages Builder URL in Safari. It can be added to the Home Screen. While the Builder page is open it can poll `rift-local-queue`, compile jobs in a module Web Worker, validate every H2 stage, save full candidates/results in IndexedDB (and mirror JSON into OPFS where supported), then commit only the compact result manifest back to the queue branch.

Closing/suspending Safari pauses polling. The phone is a local compute worker, not an always-on server.

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

A job may alternatively use `source.path` instead of `candidate.program` to compile an already committed BuildingProgram from the source branch.

## Result contract

The browser returns `riftcity-local-build-result` containing candidate SHA-256, compiled-document SHA-256, BuildingPlan fingerprint, exact H2 pipeline snapshot, affected stages, compiler stats, diagnostics/repair tasks and PASS/FAIL.

The full compiled document stays on the device. The compact result is enough for ChatGPT/GitHub to verify that the candidate tested on the phone is exactly the candidate being approved.

## Deterministic parity gate

`scripts/check-rift-local-builder.js` compiles the current Bank through both the direct H2 compiler and the same `local-build-core.js` used by the browser worker. It requires identical document hashes, stats and stage pipeline output. No npm install, Chrome, screenshots or Cloudflare are required for this parity workflow.
