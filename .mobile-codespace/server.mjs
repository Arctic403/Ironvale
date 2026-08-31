import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(process.env.MOBILE_WORKSPACE_ROOT || process.env.CODESPACE_VSCODE_FOLDER || process.cwd());
const port = Number(process.env.MOBILE_BRIDGE_PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const codespaceName = process.env.CODESPACE_NAME || '';
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
const pagesOrigin = process.env.MOBILE_PAGES_ORIGIN || 'https://arctic403.github.io';
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const authCache = new Map();
const ignoredNames = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.cache', '.turbo', '.vite']);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function allowedOrigin(origin) {
  if (!origin) return true;
  return origin === pagesOrigin || origin === `https://${codespaceName}-${port}.${forwardingDomain}`;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigin(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.setHeader('access-control-max-age', '600');
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 3 * 1024 * 1024) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function safePath(input = '') {
  const clean = String(input).replace(/^[/\\]+/, '');
  const resolved = path.resolve(root, clean);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new HttpError(400, 'Path is outside the workspace');
  return resolved;
}

function relativeFromRoot(abs) {
  const rel = path.relative(root, abs);
  return rel === '' ? '' : rel.split(path.sep).join('/');
}

async function authorize(req) {
  const value = String(req.headers.authorization || '');
  if (!value.startsWith('Bearer ')) throw new HttpError(401, 'GitHub token required');
  const token = value.slice(7).trim();
  if (!token) throw new HttpError(401, 'GitHub token required');
  if (!codespaceName) throw new HttpError(503, 'Codespace identity is unavailable');

  const digest = createHash('sha256').update(token).digest('hex');
  if ((authCache.get(digest) || 0) > Date.now()) return;

  let response;
  try {
    response = await fetch(`https://api.github.com/user/codespaces/${encodeURIComponent(codespaceName)}`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': 'mobile-codespace-bridge'
      }
    });
  } catch {
    throw new HttpError(503, 'Could not verify GitHub access');
  }
  if (!response.ok) throw new HttpError(401, 'Token cannot access this Codespace');
  const info = await response.json();
  if (info?.name !== codespaceName) throw new HttpError(403, 'Codespace identity mismatch');
  authCache.set(digest, Date.now() + 5 * 60 * 1000);
}

async function runProcess(command, args = [], options = {}) {
  const cwd = safePath(options.cwd || '');
  const timeoutMs = options.timeoutMs ?? 120000;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '0', NO_COLOR: '1' },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '', truncated = false, timedOut = false;
    const append = (target, chunk) => {
      const s = chunk.toString();
      if (target.length + s.length > MAX_OUTPUT_BYTES) { truncated = true; return (target + s).slice(-MAX_OUTPUT_BYTES); }
      return target + s;
    };
    child.stdout.on('data', (c) => { stdout = append(stdout, c); });
    child.stderr.on('data', (c) => { stderr = append(stderr, c); });
    child.on('error', (e) => resolve({ ok: false, code: null, stdout, stderr: stderr + e.message, truncated, timedOut }));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 1500).unref();
    }, timeoutMs);
    if (options.stdin) child.stdin.write(options.stdin);
    child.stdin.end();
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut, code, stdout, stderr, truncated, timedOut });
    });
  });
}

const runShell = (command, cwd = '', timeoutMs = 120000) => runProcess('bash', ['-lc', command], { cwd, timeoutMs });

async function getGitStatus() {
  const [branch, status, remote] = await Promise.all([
    runShell('git branch --show-current 2>/dev/null || true'),
    runShell('git status --porcelain=v1 -b 2>/dev/null || true'),
    runShell('git remote get-url origin 2>/dev/null || true')
  ]);
  const lines = status.stdout.trimEnd().split('\n').filter(Boolean);
  const header = lines[0]?.startsWith('## ') ? lines.shift().slice(3) : '';
  return {
    branch: branch.stdout.trim() || header.split('...')[0] || '—',
    tracking: header,
    remote: remote.stdout.trim(),
    changes: lines.map((line) => ({ code: line.slice(0, 2), path: line.slice(3) }))
  };
}

async function listDirectory(rel = '') {
  const dir = safePath(rel);
  const stat = await fs.stat(dir);
  if (!stat.isDirectory()) throw new HttpError(400, 'Not a directory');
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => !ignoredNames.has(e.name))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map((e) => ({ name: e.name, path: relativeFromRoot(path.join(dir, e.name)), type: e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other' }));
}

async function api(req, res, url) {
  await authorize(req);
  const p = url.pathname;

  if (req.method === 'GET' && p === '/api/status') {
    const [git, node, codex] = await Promise.all([
      getGitStatus(),
      runProcess('node', ['--version']),
      runShell('command -v codex >/dev/null 2>&1 && codex --version || true')
    ]);
    return json(res, 200, { ok: true, workspace: root, workspaceName: path.basename(root), codespace: codespaceName, forwardingDomain, backendPort: port, node: node.stdout.trim(), codex: codex.stdout.trim() || null, git });
  }

  if (req.method === 'GET' && p === '/api/tree') return json(res, 200, { ok: true, path: url.searchParams.get('path') || '', entries: await listDirectory(url.searchParams.get('path') || '') });

  if (req.method === 'GET' && p === '/api/file') {
    const abs = safePath(url.searchParams.get('path') || '');
    const stat = await fs.stat(abs);
    if (!stat.isFile()) throw new HttpError(400, 'Not a file');
    if (stat.size > MAX_FILE_BYTES) throw new HttpError(413, 'File is too large for the mobile editor');
    return json(res, 200, { ok: true, path: relativeFromRoot(abs), content: await fs.readFile(abs, 'utf8'), size: stat.size });
  }

  if (req.method === 'PUT' && p === '/api/file') {
    const body = await readJson(req), abs = safePath(body.path);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, String(body.content ?? ''), 'utf8');
    return json(res, 200, { ok: true, path: relativeFromRoot(abs) });
  }

  if (req.method === 'POST' && p === '/api/mkdir') {
    const body = await readJson(req), abs = safePath(body.path);
    await fs.mkdir(abs, { recursive: true });
    return json(res, 200, { ok: true, path: relativeFromRoot(abs) });
  }

  if (req.method === 'DELETE' && p === '/api/path') {
    const rel = url.searchParams.get('path') || '';
    if (!rel) throw new HttpError(400, 'Refusing to delete workspace root');
    await fs.rm(safePath(rel), { recursive: true, force: false });
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && p === '/api/command') {
    const body = await readJson(req), command = String(body.command || '').trim();
    if (!command) throw new HttpError(400, 'Command is required');
    return json(res, 200, { ok: true, result: await runShell(command, body.cwd || '', Math.min(Number(body.timeoutMs || 120000), 600000)) });
  }

  if (req.method === 'GET' && p === '/api/git/status') return json(res, 200, { ok: true, git: await getGitStatus() });

  if (req.method === 'POST' && p === '/api/git/action') {
    const body = await readJson(req);
    const allowed = { stageAll: 'git add -A', unstageAll: 'git reset', pull: 'git pull --ff-only', push: 'git push', fetch: 'git fetch --prune' };
    let command = allowed[body.action];
    if (body.action === 'commit') {
      const message = String(body.message || '').trim();
      if (!message) throw new HttpError(400, 'Commit message is required');
      command = `git commit -m ${JSON.stringify(message)}`;
    }
    if (!command) throw new HttpError(400, 'Unsupported Git action');
    const result = await runShell(command, '', 180000);
    return json(res, 200, { ok: true, result, git: await getGitStatus() });
  }

  if (req.method === 'POST' && p === '/api/codex') {
    const body = await readJson(req), prompt = String(body.prompt || '').trim();
    if (!prompt) throw new HttpError(400, 'Prompt is required');
    const mode = body.mode === 'read-only' ? 'read-only' : 'workspace-write';
    const args = ['exec', '--skip-git-repo-check', '--sandbox', mode, '--ask-for-approval', 'never', '--color', 'never', prompt];
    return json(res, 200, { ok: true, result: await runProcess('codex', args, { cwd: body.cwd || '', timeoutMs: 600000 }) });
  }

  throw new HttpError(404, 'API route not found');
}

const server = http.createServer(async (req, res) => {
  applyCors(req, res);
  try {
    if (req.method === 'OPTIONS') {
      if (!allowedOrigin(req.headers.origin)) throw new HttpError(403, 'Origin not allowed');
      res.statusCode = 204;
      return res.end();
    }
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/api/')) return json(res, 200, { ok: true, service: 'mobile-codespace-bridge', codespace: codespaceName, port });
    return await api(req, res, url);
  } catch (error) {
    return json(res, Number(error?.status || 400), { ok: false, error: error?.message || 'Unknown error' });
  }
});

server.listen(port, host, () => {
  console.log(`Mobile Codespace bridge listening on http://${host}:${port}`);
  console.log(`Workspace root: ${root}`);
});
