import {
  compileRiftBuildingProgram,
  RIFT_BUILDING_PIPELINE_VERSION,
  getRiftBuildingAffectedStages
} from '../rift-building-program.js';

export const RIFT_LOCAL_BUILD_VERSION = 'H2.10';
export const RIFT_LOCAL_BUILD_JOB_FORMAT = 'riftcity-local-build-job';
export const RIFT_LOCAL_BUILD_RESULT_FORMAT = 'riftcity-local-build-result';

const now = () => Date.now();
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export async function sha256Text(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function sha256Json(value) {
  return sha256Text(JSON.stringify(value));
}

export function validateLocalBuildJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) throw new Error('Local build job must be an object.');
  if (job.format !== RIFT_LOCAL_BUILD_JOB_FORMAT) throw new Error(`Job format must be '${RIFT_LOCAL_BUILD_JOB_FORMAT}'.`);
  if (Number(job.version) !== 1) throw new Error('Local build job version must be 1.');
  const jobId = String(job.job_id || '').trim();
  if (!jobId || jobId.length > 180) throw new Error('job_id is required and must be 180 characters or fewer.');
  const targetPath = String(job.target?.path || '').trim();
  if (!targetPath) throw new Error('job.target.path is required.');
  return { jobId, targetPath };
}

function failedResult({ job, jobId, targetPath, programSha256, error, startedAt }) {
  const pipeline = clone(error?.pipeline || error?.report?.pipeline || null);
  const diagnostics = clone(error?.diagnostics || error?.report?.diagnostics || []);
  return {
    format: RIFT_LOCAL_BUILD_RESULT_FORMAT,
    version: 1,
    local_builder_version: RIFT_LOCAL_BUILD_VERSION,
    building_pipeline_version: RIFT_BUILDING_PIPELINE_VERSION,
    job_id: jobId,
    ok: false,
    target: { path: targetPath, branch: String(job.target?.branch || 'ai-static-world-builder') },
    candidate_sha256: programSha256,
    completed_at: now(),
    duration_ms: Math.max(0, now() - startedAt),
    error: String(error?.message || error),
    failed_stage: String(error?.stage || '') || null,
    plan_fingerprint: error?.plan?.fingerprint || pipeline?.planFingerprint || null,
    affected_stages: getRiftBuildingAffectedStages(job.changed_paths || []),
    pipeline,
    stats: error?.report?.stats || null,
    diagnostics,
    repair_tasks: clone(error?.report?.repairTasks || [])
  };
}

export async function runLocalBuildJob(job, program) {
  const { jobId, targetPath } = validateLocalBuildJob(job);
  if (!program || typeof program !== 'object' || Array.isArray(program)) throw new Error('Candidate BuildingProgram must be a JSON object.');
  const startedAt = now();
  const programSha256 = await sha256Json(program);

  let compiled;
  try {
    compiled = compileRiftBuildingProgram(program, { strict: true });
  } catch (error) {
    return {
      publicResult: failedResult({ job, jobId, targetPath, programSha256, error, startedAt }),
      artifact: { job: clone(job), program: clone(program), error: String(error?.message || error) }
    };
  }

  const documentSha256 = await sha256Json(compiled.document);
  const publicResult = {
    format: RIFT_LOCAL_BUILD_RESULT_FORMAT,
    version: 1,
    local_builder_version: RIFT_LOCAL_BUILD_VERSION,
    building_pipeline_version: RIFT_BUILDING_PIPELINE_VERSION,
    job_id: jobId,
    ok: compiled.report.ok === true,
    target: { path: targetPath, branch: String(job.target?.branch || 'ai-static-world-builder') },
    candidate_sha256: programSha256,
    compiled_document_sha256: documentSha256,
    source_program_id: compiled.report.sourceProgramId,
    source_fingerprint: compiled.report.sourceFingerprint,
    plan_fingerprint: compiled.plan?.fingerprint || null,
    affected_stages: getRiftBuildingAffectedStages(job.changed_paths || []),
    completed_at: now(),
    duration_ms: Math.max(0, now() - startedAt),
    stats: clone(compiled.report.stats),
    pipeline: clone(compiled.pipeline),
    diagnostics: clone(compiled.report.diagnostics),
    repair_tasks: clone(compiled.report.repairTasks)
  };

  return {
    publicResult,
    artifact: {
      job: clone(job),
      program: clone(program),
      document: clone(compiled.document),
      plan: clone(compiled.plan),
      pipeline: clone(compiled.pipeline),
      report: clone(compiled.report),
      semantics: clone(compiled.semantics)
    }
  };
}
