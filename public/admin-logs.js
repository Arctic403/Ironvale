const list = document.querySelector('#logs-list');
const status = document.querySelector('#log-status');
const severity = document.querySelector('#severity-filter');
const resolved = document.querySelector('#resolved-filter');
const refresh = document.querySelector('#refresh-logs');

refresh.addEventListener('click', loadLogs);
severity.addEventListener('change', loadLogs);
resolved.addEventListener('change', loadLogs);

async function loadLogs() {
  status.textContent = 'Loading logs…';
  const params = new URLSearchParams({ limit: '150' });
  if (severity.value) params.set('severity', severity.value);
  if (resolved.value) params.set('resolved', resolved.value);

  const response = await fetch(`/api/admin/logs?${params}`, { credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    list.innerHTML = '';
    status.innerHTML = `${escapeHtml(data.error || 'Could not load logs')}. <strong>You must be signed in as an admin or developer.</strong>`;
    return;
  }

  const logs = data.logs || [];
  status.textContent = `${logs.length} log entr${logs.length === 1 ? 'y' : 'ies'}`;
  list.innerHTML = logs.length ? logs.map(renderLog).join('') : '<div class="card empty-state">No matching logs.</div>';

  document.querySelectorAll('[data-resolve]').forEach(button => {
    button.addEventListener('click', () => resolveLog(button.dataset.resolve));
  });
}

function renderLog(log) {
  const context = prettyJson(log.context_json);
  return `
    <article class="card log-entry severity-${escapeHtml(log.severity.toLowerCase())}">
      <div class="log-entry-head">
        <div>
          <span class="log-level">${escapeHtml(log.severity)}</span>
          <strong>${escapeHtml(log.event_type)}</strong>
        </div>
        <time>${new Date(log.created_at).toLocaleString()}</time>
      </div>
      ${log.error_id ? `<div class="error-id">${escapeHtml(log.error_id)}</div>` : ''}
      <p class="log-message">${escapeHtml(log.message)}</p>
      <dl class="log-meta">
        ${log.route ? `<dt>Route</dt><dd>${escapeHtml(log.method || '')} ${escapeHtml(log.route)}</dd>` : ''}
        ${log.request_id ? `<dt>Request</dt><dd>${escapeHtml(log.request_id)}</dd>` : ''}
        ${log.user_id ? `<dt>Player</dt><dd>${escapeHtml(log.user_id)}</dd>` : ''}
        <dt>Status</dt><dd>${log.resolved ? 'Resolved' : 'Unresolved'}</dd>
      </dl>
      ${context ? `<details><summary>Context</summary><pre>${escapeHtml(context)}</pre></details>` : ''}
      ${log.stack ? `<details><summary>Stack trace</summary><pre>${escapeHtml(log.stack)}</pre></details>` : ''}
      ${!log.resolved ? `<button class="secondary resolve-btn" data-resolve="${escapeHtml(log.id)}">Mark resolved</button>` : ''}
    </article>`;
}

async function resolveLog(id) {
  const response = await fetch(`/api/admin/logs/${encodeURIComponent(id)}/resolve`, { method: 'POST', credentials: 'same-origin' });
  if (response.ok) await loadLogs();
}

function prettyJson(value) {
  if (!value || value === '{}') return '';
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[ch]);
}

loadLogs();
