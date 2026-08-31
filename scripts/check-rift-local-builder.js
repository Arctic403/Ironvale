import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { compileRiftBuildingProgram } from '../public/rift-building-program.js';
import { runLocalBuildJob, sha256Json, RIFT_LOCAL_BUILD_JOB_FORMAT, RIFT_LOCAL_BUILD_VERSION } from '../public/builder/local-build-core.js';

const bank = JSON.parse(await fs.readFile(new URL('../public/rift-buildings/legacy-building-fixture-001.json', import.meta.url), 'utf8'));
const job = {
  format: RIFT_LOCAL_BUILD_JOB_FORMAT,
  version: 1,
  job_id: 'parity-bank-h2.10',
  target: { path: 'public/rift-buildings/legacy-building-fixture-001.json', branch: 'ai-static-world-builder' },
  candidate: { program: bank },
  changed_paths: []
};

const direct = compileRiftBuildingProgram(bank, { strict: true });
const local = await runLocalBuildJob(job, bank);
const expectedDocumentHash = await sha256Json(direct.document);
const expectedProgramHash = await sha256Json(bank);

assert.equal(local.publicResult.ok, true, 'Local builder must PASS the current Bank.');
assert.equal(local.publicResult.local_builder_version, RIFT_LOCAL_BUILD_VERSION);
assert.equal(local.publicResult.compiled_document_sha256, expectedDocumentHash, 'Browser/local build document must be byte-equivalent under deterministic JSON serialization.');
assert.equal(local.publicResult.candidate_sha256, expectedProgramHash, 'Candidate hash mismatch.');
assert.deepEqual(local.publicResult.stats, direct.report.stats, 'Local builder stats must exactly match direct H2 compiler stats.');
assert.deepEqual(local.publicResult.pipeline, direct.pipeline, 'Local builder stage pipeline must exactly match direct H2 compiler pipeline.');
assert.equal(local.artifact.document.metadata.building_plan_fingerprint, direct.document.metadata.building_plan_fingerprint);

console.log(`[rift-local-builder] PASS · ${RIFT_LOCAL_BUILD_VERSION} · ${local.publicResult.stats.structuralCells.toLocaleString()} cells · ${local.publicResult.stats.operations.toLocaleString()} ops · ${expectedDocumentHash.slice(0, 16)}…`);
