export const DEFAULT_GITHUB_CONFIG = Object.freeze({
  owner: 'Arctic403',
  repo: 'RiftCityV1',
  branch: 'ai-static-world-builder',
  repositoryId: '1337864874',
  jobsDir: 'rift-local-jobs',
  resultsDir: 'rift-local-results'
});

const API = 'https://api.github.com';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const SESSION_TOKEN_KEY = 'rift-local-builder.github-token';
const CLIENT_ID_KEY = 'rift-local-builder.github-client-id';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function encodePath(path) { return String(path).split('/').map(encodeURIComponent).join('/'); }
function cleanId(value) { return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180); }

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(String(text));
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(String(value || '').replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function parseResponse(response) {
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  if (!response.ok) {
    const error = new Error(body?.message || body?.error_description || body?.error || `GitHub request failed with HTTP ${response.status}.`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export class RiftGitHubClient {
  constructor(config = DEFAULT_GITHUB_CONFIG) {
    this.config = { ...DEFAULT_GITHUB_CONFIG, ...config };
    this.token = sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
  }

  get connected() { return Boolean(this.token); }
  get savedClientId() { return localStorage.getItem(CLIENT_ID_KEY) || ''; }
  set savedClientId(value) {
    const clean = String(value || '').trim();
    if (clean) localStorage.setItem(CLIENT_ID_KEY, clean); else localStorage.removeItem(CLIENT_ID_KEY);
  }

  disconnect() {
    this.token = '';
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }

  async startDeviceLogin(clientId) {
    const clean = String(clientId || '').trim();
    if (!clean) throw new Error('GitHub App Client ID is required.');
    this.savedClientId = clean;
    const response = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clean })
    });
    return parseResponse(response);
  }

  async finishDeviceLogin(clientId, device) {
    const started = Date.now();
    let interval = Math.max(5, Number(device.interval || 5));
    const expiresMs = Math.max(60, Number(device.expires_in || 900)) * 1000;
    while (Date.now() - started < expiresMs) {
      await sleep(interval * 1000);
      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: String(clientId).trim(),
          device_code: device.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          repository_id: String(this.config.repositoryId)
        })
      });
      const body = await parseResponse(response);
      if (body.access_token) {
        this.token = body.access_token;
        sessionStorage.setItem(SESSION_TOKEN_KEY, this.token);
        return this.whoAmI();
      }
      if (body.error === 'authorization_pending') continue;
      if (body.error === 'slow_down') { interval += 5; continue; }
      throw new Error(body.error_description || body.error || 'GitHub device authorization failed.');
    }
    throw new Error('GitHub device authorization expired. Start it again.');
  }

  async api(path, { method = 'GET', body = null } = {}) {
    if (!this.token) throw new Error('Connect GitHub first.');
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2026-03-10',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return parseResponse(response);
  }

  async whoAmI() { return this.api('/user'); }

  contentPath(path) {
    return `/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/contents/${encodePath(path)}`;
  }

  async listJson(dir) {
    try {
      const rows = await this.api(`${this.contentPath(dir)}?ref=${encodeURIComponent(this.config.branch)}`);
      return (Array.isArray(rows) ? rows : []).filter(item => item.type === 'file' && item.name.endsWith('.json'));
    } catch (error) {
      if (error.status === 404) return [];
      throw error;
    }
  }

  async readJsonFile(path) {
    const row = await this.api(`${this.contentPath(path)}?ref=${encodeURIComponent(this.config.branch)}`);
    if (!row?.content) throw new Error(`GitHub did not return inline content for '${path}'.`);
    return { json: JSON.parse(base64ToUtf8(row.content)), sha: row.sha, path: row.path };
  }

  async exists(path) {
    try { await this.api(`${this.contentPath(path)}?ref=${encodeURIComponent(this.config.branch)}`); return true; }
    catch (error) { if (error.status === 404) return false; throw error; }
  }

  resultPath(jobId) { return `${this.config.resultsDir}/${cleanId(jobId)}.json`; }

  async writeJsonFile(path, payload, message) {
    let sha = null;
    try {
      const current = await this.api(`${this.contentPath(path)}?ref=${encodeURIComponent(this.config.branch)}`);
      sha = current?.sha || null;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    const body = {
      message: String(message || `Rift Local Builder: ${path}`),
      content: utf8ToBase64(`${JSON.stringify(payload, null, 2)}\n`),
      branch: this.config.branch,
      ...(sha ? { sha } : {})
    };
    return this.api(this.contentPath(path), { method: 'PUT', body });
  }
}
