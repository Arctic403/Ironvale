import { RIFT_LOCAL_BUILD_JOB_FORMAT, RIFT_LOCAL_BUILD_VERSION } from './local-build-core.js';
import { RiftGitHubClient } from './github.js';
import { getLocal, listLocal, putLocal, saveCandidate, saveResult } from './storage.js';

const $ = selector => document.querySelector(selector);
const client = new RiftGitHubClient();
const worker = new Worker(new URL('./local-build-worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
let latest = null;
let pollTimer = null;
let syncing = false;

const ui = {
  clientId: $('#client-id'), connect: $('#connect'), disconnect: $('#disconnect'), authStatus: $('#auth-status'),
  deviceCode: $('#device-code'), deviceUserCode: $('#device-user-code'), deviceLink: $('#device-link'),
  queueStatus: $('#queue-status'), waitingCount: $('#waiting-count'), completedCount: $('#completed-count'), historyCount: $('#history-count'),
  autoPoll: $('#auto-poll'), syncJobs: $('#sync-jobs'), refreshHistory: $('#refresh-history'),
  targetPath: $('#target-path'), loadTarget: $('#load-target'), candidateJson: $('#candidate-json'), runBuild: $('#run-build'),
  buildStatus: $('#build-status'), publishResult: $('#publish-result'), downloadResult: $('#download-result'),
  resultCard: $('#result-card'), resultTitle: $('#result-title'), resultStatus: $('#result-status'), stats: $('#stats'), stages: $('#stages'), diagnostics: $('#diagnostics'),
  history: $('#history'), runtimePill: $('#runtime-pill'), dialog: $('#message-dialog'), dialogTitle: $('#dialog-title'), dialogMessage: $('#dialog-message'), dialogClose: $('#dialog-close')
};

function setStatus(element, text, kind = 'neutral') {
  element.textContent = text;
  element.className = `status ${kind}`;
}

function showMessage(title, message) {
  ui.dialogTitle.textContent = title;
  ui.dialogMessage.textContent = String(message || '');
  ui.dialog.showModal();
}
ui.dialogClose.onclick = () => ui.dialog.close();

worker.addEventListener('message', event => {
  const message = event.data || {};
  if (message.type === 'ready') {
    ui.runtimePill.textContent = `${message.version} · Browser worker`;
    return;
  }
  const item = pending.get(message.requestId);
  if (!item) return;
  pending.delete(message.requestId);
  if (message.type === 'result') item.resolve(message);
  else item.reject(new Error(message.error || 'Local worker failed.'));
});

function runWorker(job, program) {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    worker.postMessage({ type: 'build', requestId, job, program });
  });
}

function createManualJob(program) {
  const id = `manual-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  return {
    format: RIFT_LOCAL_BUILD_JOB_FORMAT,
    version: 1,
    job_id: id,
    created_at: Date.now(),
    target: { path: ui.targetPath.value.trim(), branch: 'ai-static-world-builder' },
    candidate: { program },
    changed_paths: []
  };
}

function renderResult(publicResult) {
  latest = publicResult;
  ui.resultCard.classList.remove('hidden');
  ui.resultTitle.textContent = publicResult.job_id || 'Build result';
  setStatus(ui.resultStatus, publicResult.ok ? 'PASS' : 'FAIL', publicResult.ok ? 'pass' : 'fail');
  const stats = publicResult.stats || {};
  const rows = [
    ['Structural cells', stats.structuralCells ?? '—'], ['Operations', stats.operations ?? '—'], ['Masses', stats.masses ?? '—'],
    ['Floors', stats.floors ?? '—'], ['Spaces', stats.spaces ?? stats.rooms ?? '—'], ['Portals', stats.portals ?? '—'],
    ['Errors', stats.errors ?? (publicResult.ok ? 0 : '—')], ['Warnings', stats.warnings ?? '—'], ['Duration', `${publicResult.duration_ms ?? 0} ms`]
  ];
  ui.stats.innerHTML = rows.map(([label, value]) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`).join('');
  const stages = publicResult.pipeline?.stages || [];
  ui.stages.innerHTML = stages.length ? stages.map(stage => `<div class="stage ${stage.status}"><b>${stage.id}</b><small>${stage.status} · hard ${stage.hardFailures || 0} · soft ${stage.softIssues || 0}</small></div>`).join('') : '<p class="hint">Pipeline stopped before a complete stage snapshot was available.</p>';
  const diagnostics = publicResult.diagnostics || [];
  ui.diagnostics.innerHTML = diagnostics.length ? diagnostics.map(item => `<div class="diag ${item.severity || 'notice'}"><b>${String(item.severity || 'notice').toUpperCase()} · ${item.code || 'diagnostic'}</b><br>${item.message || ''}</div>`).join('') : '<div class="diag notice">No diagnostics. Candidate is clean.</div>';
  ui.publishResult.disabled = !client.connected;
  ui.downloadResult.disabled = false;
}

async function build(job, program, { publish = false } = {}) {
  setStatus(ui.buildStatus, 'Building locally…', 'busy');
  setStatus(ui.queueStatus, 'Local H2 worker busy', 'busy');
  try {
    const response = await runWorker(job, program);
    await saveCandidate(job.job_id, program, response.artifact, response.publicResult);
    await saveResult(job.job_id, response.publicResult);
    await putLocal('jobs', { id: job.job_id, job, savedAt: Date.now() });
    renderResult(response.publicResult);
    if (publish && client.connected) {
      await client.writeJsonFile(client.resultPath(job.job_id), response.publicResult, `Rift Local Builder result: ${job.job_id}`);
    }
    setStatus(ui.buildStatus, response.publicResult.ok ? 'Local PASS' : 'Local FAIL', response.publicResult.ok ? 'pass' : 'fail');
    setStatus(ui.queueStatus, publish ? 'Result returned to GitHub' : 'Local build complete', response.publicResult.ok ? 'pass' : 'fail');
    await refreshHistory();
    return response.publicResult;
  } catch (error) {
    setStatus(ui.buildStatus, 'Build error', 'fail');
    setStatus(ui.queueStatus, 'Worker error', 'fail');
    showMessage('Local build failed', error?.stack || error?.message || error);
    throw error;
  }
}

async function refreshAuth() {
  ui.clientId.value = client.savedClientId;
  if (!client.connected) { setStatus(ui.authStatus, 'Disconnected', 'neutral'); return; }
  try {
    const user = await client.whoAmI();
    setStatus(ui.authStatus, `@${user.login}`, 'pass');
  } catch (error) {
    client.disconnect();
    setStatus(ui.authStatus, 'Reconnect required', 'fail');
  }
}

ui.connect.onclick = async () => {
  try {
    setStatus(ui.authStatus, 'Starting device login…', 'busy');
    const device = await client.startDeviceLogin(ui.clientId.value);
    ui.deviceUserCode.textContent = device.user_code;
    ui.deviceLink.href = device.verification_uri;
    ui.deviceCode.classList.remove('hidden');
    setStatus(ui.authStatus, 'Authorize on GitHub', 'busy');
    const user = await client.finishDeviceLogin(ui.clientId.value, device);
    ui.deviceCode.classList.add('hidden');
    setStatus(ui.authStatus, `@${user.login}`, 'pass');
    await syncJobs();
  } catch (error) {
    setStatus(ui.authStatus, 'Login failed', 'fail');
    showMessage('GitHub connection failed', error?.message || error);
  }
};

ui.disconnect.onclick = () => {
  client.disconnect();
  setStatus(ui.authStatus, 'Disconnected', 'neutral');
};

ui.loadTarget.onclick = async () => {
  try {
    const target = ui.targetPath.value.trim();
    const file = await client.readJsonFile(target);
    ui.candidateJson.value = JSON.stringify(file.json, null, 2);
    setStatus(ui.buildStatus, 'Loaded from GitHub', 'pass');
  } catch (error) { showMessage('Could not load target', error?.message || error); }
};

ui.runBuild.onclick = async () => {
  try {
    const program = JSON.parse(ui.candidateJson.value);
    await build(createManualJob(program), program);
  } catch (error) {
    if (error instanceof SyntaxError) showMessage('Candidate JSON is invalid', error.message);
  }
};

ui.publishResult.onclick = async () => {
  if (!latest) return;
  try {
    await client.writeJsonFile(client.resultPath(latest.job_id), latest, `Rift Local Builder result: ${latest.job_id}`);
    setStatus(ui.queueStatus, 'Result returned to GitHub', 'pass');
  } catch (error) { showMessage('Could not publish result', error?.message || error); }
};

ui.downloadResult.onclick = () => {
  if (!latest) return;
  const blob = new Blob([`${JSON.stringify(latest, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${latest.job_id || 'rift-local-result'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

async function syncJobs() {
  if (syncing || !client.connected) return;
  syncing = true;
  setStatus(ui.queueStatus, 'Syncing GitHub…', 'busy');
  try {
    const [jobRows, resultRows] = await Promise.all([
      client.listJson(client.config.jobsDir),
      client.listJson(client.config.resultsDir)
    ]);
    const completed = new Set(resultRows.map(row => row.name.replace(/\.json$/i, '')));
    const waiting = jobRows.filter(row => !completed.has(row.name.replace(/\.json$/i, '')));
    ui.waitingCount.textContent = waiting.length;
    ui.completedCount.textContent = completed.size;
    for (const row of waiting) {
      const loaded = await client.readQueueJson(row.path);
      const job = loaded.json;
      if (job.format !== RIFT_LOCAL_BUILD_JOB_FORMAT) continue;
      let program = job.candidate?.program || null;
      if (!program && job.source?.path) program = (await client.readJsonFile(job.source.path)).json;
      if (!program) throw new Error(`Job '${job.job_id}' has no candidate.program or source.path.`);
      await build(job, program, { publish: true });
    }
    setStatus(ui.queueStatus, waiting.length ? 'Queue processed' : 'No waiting jobs', 'pass');
  } catch (error) {
    setStatus(ui.queueStatus, 'Sync failed', 'fail');
    showMessage('GitHub queue error', error?.message || error);
  } finally { syncing = false; }
}

async function refreshHistory() {
  const rows = await listLocal('candidates');
  ui.historyCount.textContent = rows.length;
  ui.history.innerHTML = rows.length ? rows.slice(0, 20).map(row => `<div class="history-row"><div><b>${row.id}</b><span>${new Date(row.savedAt).toLocaleString()} · ${row.publicResult?.ok ? 'PASS' : 'FAIL'}</span></div><button class="secondary" data-history-id="${row.id}">Load</button></div>`).join('') : '<p class="hint">No local candidates yet.</p>';
  ui.history.querySelectorAll('[data-history-id]').forEach(button => button.onclick = async () => {
    const row = await getLocal('candidates', button.dataset.historyId);
    if (!row) return;
    ui.candidateJson.value = JSON.stringify(row.program, null, 2);
    renderResult(row.publicResult);
    scrollTo({ top: ui.resultCard.offsetTop - 70, behavior: 'smooth' });
  });
}

ui.syncJobs.onclick = syncJobs;
ui.refreshHistory.onclick = refreshHistory;
ui.autoPoll.onchange = () => {
  clearInterval(pollTimer);
  pollTimer = null;
  if (ui.autoPoll.checked) pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') syncJobs();
  }, 20000);
};

window.addEventListener('online', () => setStatus(ui.queueStatus, 'Online', 'pass'));
window.addEventListener('offline', () => setStatus(ui.queueStatus, 'Offline · local builds still work', 'neutral'));

(async function boot() {
  ui.runtimePill.textContent = `${RIFT_LOCAL_BUILD_VERSION} · starting worker`;
  await refreshAuth();
  await refreshHistory();
  if (!crypto?.subtle || !window.Worker || !window.indexedDB) {
    setStatus(ui.buildStatus, 'Unsupported browser', 'fail');
    showMessage('Browser capability missing', 'Rift Local Builder requires Web Workers, IndexedDB and Web Crypto.');
  }
})();
