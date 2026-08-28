import { readFile } from 'node:fs/promises';

const eventPath = process.env.GITHUB_EVENT_PATH;
const token = process.env.GITHUB_TOKEN;
const endpoint = process.env.RIFTBRIDGE_ENDPOINT || 'https://riftcityv1.kc-campbell132.workers.dev/api/riftbridge/jobs';
const repository = process.env.GITHUB_REPOSITORY || '';

if (!eventPath) throw new Error('GITHUB_EVENT_PATH is unavailable.');
if (!token) throw new Error('GITHUB_TOKEN is unavailable.');
if (!repository.includes('/')) throw new Error('GITHUB_REPOSITORY is invalid.');

const event = JSON.parse(await readFile(eventPath, 'utf8'));
const issue = event.issue;
if (!issue) throw new Error('RiftBridge workflow requires a GitHub issue event.');

function extractJob(body) {
  const source = String(body || '').trim();
  const fence = source.match(/```riftbridge\s*([\s\S]*?)```/i);
  const jsonText = fence ? fence[1].trim() : source;
  if (!jsonText) throw new Error('Issue body does not contain a RiftBridge job.');
  let job;
  try { job = JSON.parse(jsonText); }
  catch (error) { throw new Error(`RiftBridge issue JSON is invalid: ${error.message}`); }
  if (!job || typeof job !== 'object' || Array.isArray(job)) throw new Error('RiftBridge issue payload must be one JSON object.');
  job.job_id ||= `${repository}#${issue.number}`;
  job.title ||= String(issue.title || '').replace(/^\[RIFT-AI\]\s*/i, '').trim();
  return job;
}

async function comment(body) {
  const response = await fetch(`https://api.github.com/repos/${repository}/issues/${issue.number}/comments`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ body })
  });
  if (!response.ok) throw new Error(`Could not comment on GitHub issue (${response.status}): ${await response.text()}`);
}

let result;
let status = 0;
try {
  const job = extractJob(issue.body);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'RiftCity-RiftBridge-GitHub-Action/1',
      'X-RiftBridge-Repository': repository,
      'X-RiftBridge-Issue': String(issue.number)
    },
    body: JSON.stringify(job)
  });
  status = response.status;
  const text = await response.text();
  try { result = JSON.parse(text); }
  catch { result = { ok: false, error: text || `RiftBridge returned HTTP ${response.status}.` }; }
  if (!response.ok || !result?.ok) throw new Error(result?.error || `RiftBridge returned HTTP ${response.status}.`);

  const compact = {
    ok: true,
    jobId: result.jobId,
    draftId: result.draft?.draftId,
    documentId: result.draft?.documentId,
    name: result.draft?.name,
    sha256: result.draft?.sha256,
    compiledObjects: result.validation?.compiledObjects,
    prefabs: result.validation?.prefabs,
    warnings: result.validation?.warnings?.length || 0,
    requestId: result.requestId
  };
  await comment(`<!-- riftbridge-result -->\n## RiftBridge result ✅\nA compiler-validated **D1 review draft** was created. Nothing was published or deployed.\n\n\`\`\`json\n${JSON.stringify(compact, null, 2)}\n\`\`\``);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const failure = {
    ok: false,
    httpStatus: status || null,
    error: String(error?.message || error),
    requestId: result?.requestId || null
  };
  try {
    await comment(`<!-- riftbridge-result -->\n## RiftBridge result ❌\nThe authoring job did not create a draft.\n\n\`\`\`json\n${JSON.stringify(failure, null, 2)}\n\`\`\``);
  } catch (commentError) {
    console.error('Could not post failure comment:', commentError);
  }
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
}
