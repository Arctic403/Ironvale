export const DEFAULT_GITHUB_CONFIG = Object.freeze({
  owner: 'Arctic403',
  repo: 'RiftCityV1',
  sourceBranch: 'ai-static-world-builder',
  queueBranch: 'rift-local-queue',
  jobsDir: 'rift-local-jobs',
  resultsDir: 'rift-local-results'
});

const API = 'https://api.github.com';
const SESSION_TOKEN_KEY = 'rift-local-builder.github-token';

function encodePath(path) { return String(path).split('/').map(encodeURIComponent).join('/'); }
function cleanId(value) { return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180); }

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(String(text));
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
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
    const error = new Error(body?.message || body?.error || `GitHub request failed with HTTP ${response.status}.`);
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

  disconnect() {
    this.token = '';
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }

  async connectWithToken(token) {
    const clean = String(token || '').trim();
    if (!clean) throw new Error('A fine-grained GitHub token is required.');
    this.token = clean;
    try {
      const user = await this.whoAmI();
      await this.verifyRepositoryAccess();
      sessionStorage.setItem(SESSION_TOKEN_KEY, clean);
      return user;
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  async api(path, { method = 'GET', body = null } = {}) {
    if (!this.token) throw new Error('Connect GitHub first.');
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return parseResponse(response);
  }

  async whoAmI() { return this.api('/user'); }

  async verifyRepositoryAccess() {
    return this.api(`/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}`);
  }

  contentPath(path) {
    return `/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/contents/${encodePath(path)}`;
  }

  async listJson(dir, ref = this.config.queueBranch) {
    try {
      const rows = await this.api(`${this.contentPath(dir)}?ref=${encodeURIComponent(ref)}`);
      return (Array.isArray(rows) ? rows : []).filter(item => item.type === 'file' && item.name.endsWith('.json'));
    } catch (error) {
      if (error.status === 404) return [];
      throw error;
    }
  }

  async readJsonFile(path, ref = this.config.sourceBranch) {
    const row = await this.api(`${this.contentPath(path)}?ref=${encodeURIComponent(ref)}`);
    if (!row?.content) throw new Error(`GitHub did not return inline content for '${path}'.`);
    return { json: JSON.parse(base64ToUtf8(row.content)), sha: row.sha, path: row.path, ref };
  }

  async exists(path, ref = this.config.queueBranch) {
    try { await this.api(`${this.contentPath(path)}?ref=${encodeURIComponent(ref)}`); return true; }
    catch (error) { if (error.status === 404) return false; throw error; }
  }

  resultPath(jobId) { return `${this.config.resultsDir}/${cleanId(jobId)}.json`; }

  async writeJsonFile(path, payload, message, ref = this.config.queueBranch) {
    let sha = null;
    try {
      const current = await this.api(`${this.contentPath(path)}?ref=${encodeURIComponent(ref)}`);
      sha = current?.sha || null;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    return this.api(this.contentPath(path), {
      method: 'PUT',
      body: {
        message: String(message || `Rift Local Builder: ${path}`),
        content: utf8ToBase64(`${JSON.stringify(payload, null, 2)}\n`),
        branch: ref,
        ...(sha ? { sha } : {})
      }
    });
  }

  async readQueueJson(path) { return this.readJsonFile(path, this.config.queueBranch); }
}
