import { handleIronvaleApi } from './ironvale/api.js';
import { handleAiBuilderMcpRequest, AI_BUILDER_MCP_PATH, AI_BUILDER_MCP_VERSION, AI_BUILDER_REMOTE_TOOL_NAMES, executeRiftBridgeJob, RIFTBRIDGE_VERSION, RIFTBRIDGE_ENDPOINT, RIFTBRIDGE_JOB_FORMAT } from './ai-builder-mcp.js';

const SESSION_COOKIE = 'ironvale_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
// Cloudflare Workers currently supports PBKDF2 iteration counts up to 100,000.
const PASSWORD_ITERATIONS = 100_000;
const SESSION_ACTIVITY_WRITE_INTERVAL_MS = 5 * 60_000;
let logSchemaEnsured = false;
const LOG_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS system_logs (
    id TEXT PRIMARY KEY,
    error_id TEXT UNIQUE,
    severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR')),
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    route TEXT,
    method TEXT,
    request_id TEXT,
    user_id TEXT,
    context_json TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`;

// Ironvale gameplay data lives under src/ironvale and uses its own namespaced tables.

// Rift Engine authoring and Ironvale persistence share this Worker; game-domain state is namespaced under /api/ironvale.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const requestId = request.headers.get('cf-ray') || crypto.randomUUID();

    if (url.pathname === AI_BUILDER_MCP_PATH) {
      return handleAiBuilderMcpRequest(request, env, ctx);
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url, requestId);
      } catch (error) {
        const errorId = makeErrorId();
        console.error(`[${errorId}] [${requestId}]`, error);
        await safeWriteSystemLog(env, {
          errorId,
          severity: 'ERROR',
          eventType: 'API_ERROR',
          message: safeErrorMessage(error),
          stack: safeStack(error),
          route: url.pathname,
          method: request.method,
          requestId,
          userId: null,
          context: { search: url.search || null }
        });
        return json({ ok: false, error: 'Internal server error', errorId }, 500, { 'X-Ironvale-Request-ID': requestId });
      }
    }

    if (url.pathname === '/dev/block-editor' || url.pathname === '/dev/block-editor/') {
      return serveDeveloperBlockEditor(request, env);
    }

    if (url.pathname === '/dev/ai-builder' || url.pathname === '/dev/ai-builder/') {
      return serveDeveloperAiBuilder(request, env);
    }

    if (url.pathname === '/admin/logs' || url.pathname === '/admin/logs/') {
      const adminUrl = new URL('/admin-logs.html', request.url);
      return env.ASSETS.fetch(new Request(adminUrl, request));
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env, url, requestId) {
  const method = request.method.toUpperCase();

  if (method === 'POST' && url.pathname === '/api/auth/register') return register(request, env, requestId);
  if (method === 'POST' && url.pathname === '/api/auth/login') return login(request, env, requestId);
  if (method === 'POST' && url.pathname === '/api/auth/logout') return logout(request, env, requestId);
  if (method === 'GET' && url.pathname === '/api/auth/me') return me(request, env);
  const ironvaleResponse = await handleIronvaleApi(request, env, url, {
    authenticate, json, readJson, writeAudit
  });
  if (ironvaleResponse) return ironvaleResponse;
  if (method === 'GET' && url.pathname.startsWith('/api/world/blocks/')) return getPublishedBlockLayout(request, env, url);
  if (method === 'GET' && url.pathname === '/api/health') return health(env);

  // H1.78 public AI Builder + stateless remote MCP bridge. The anonymous surface is intentionally
  // write-only with respect to D1: agents may inspect/edit their in-browser
  // staging scene and submit a review draft, but only authenticated
  // developer/admin users can list, read or mark those drafts as loaded.
  if (method === 'GET' && url.pathname === '/api/riftbridge') return getRiftBridgeStatus();
  if (method === 'POST' && url.pathname === RIFTBRIDGE_ENDPOINT) return submitRiftBridgeJob(request, env, requestId);
  if (method === 'GET' && url.pathname === '/api/ai-builder/tools') return getPublicAiBuilderTools();
  if (method === 'POST' && url.pathname === '/api/ai-builder/drafts') return savePublicAiBuilderDraft(request, env, requestId);
  if (url.pathname === '/api/admin/ai-builder/drafts' && method === 'GET') return listAdminAiBuilderDrafts(request, env, url);
  if (url.pathname.startsWith('/api/admin/ai-builder/drafts/')) {
    if (method === 'GET') return getAdminAiBuilderDraft(request, env, url);
    if (method === 'POST' && url.pathname.endsWith('/loaded')) return markAdminAiBuilderDraftLoaded(request, env, url, requestId);
  }

  if (method === 'GET' && url.pathname === '/api/admin/logs') return getSystemLogs(request, env, url);

  if (method === 'POST' && url.pathname === '/api/admin/assets/register') return registerApprovedAsset(request, env, requestId);
  if (method === 'GET' && url.pathname === '/api/admin/assets') return listApprovedAssets(request, env);
  if (method === 'GET' && url.pathname.startsWith('/api/assets/')) return getApprovedAsset(request, env, url);

  if (url.pathname.startsWith('/api/admin/blocks/')) {
    if (method === 'GET' && url.pathname.endsWith('/editor')) return getBlockEditorState(request, env, url);
    if (method === 'GET' && url.pathname.endsWith('/history')) return getBlockLayoutHistory(request, env, url);
    if (method === 'PUT' && url.pathname.endsWith('/draft')) return saveBlockDraft(request, env, url, requestId);
    if (method === 'POST' && url.pathname.endsWith('/publish')) return publishBlockDraft(request, env, url, requestId);
    if (method === 'POST' && url.pathname.endsWith('/revert-draft')) return revertBlockDraft(request, env, url, requestId);
    if (method === 'POST' && url.pathname.endsWith('/restore-revision')) return restoreBlockHistoryToDraft(request, env, url, requestId);
  }

  if (method === 'POST' && url.pathname.startsWith('/api/admin/logs/') && url.pathname.endsWith('/resolve')) {
    return resolveSystemLog(request, env, url);
  }

  return json({ ok: false, error: 'Not found' }, 404);
}

async function register(request, env, requestId) {
  const body = await readJson(request);
  const username = normalizeUsername(body?.username);
  const password = typeof body?.password === 'string' ? body.password : '';

  const validationError = validateCredentials(username, password);
  if (validationError) return json({ ok: false, error: validationError }, 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return json({ ok: false, error: 'Username is already taken' }, 409);

  const userId = crypto.randomUUID();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToBase64(saltBytes);
  const passwordHash = await hashPassword(password, saltBytes);
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO users (id, username, password_hash, password_salt, role, created_at, last_active_at)
    VALUES (?, ?, ?, ?, 'player', ?, ?)
  `).bind(userId, username, passwordHash, salt, now, now).run();
  await writeAudit(env, userId, 'user.registered', userId, { username });
  await safeWriteSystemLog(env, {
    severity: 'INFO', eventType: 'ACCOUNT_CREATED', message: `Account created: ${username}`,
    route: '/api/auth/register', method: 'POST', requestId, userId, context: { username }
  });

  const session = await createSession(env, request, userId);
  return json({
    ok: true,
    user: { id: userId, username, role: 'player', createdAt: now, lastActiveAt: now }
  }, 201, { 'Set-Cookie': session.cookie });
}

async function login(request, env, requestId) {
  const body = await readJson(request);
  const username = normalizeUsername(body?.username);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !password) return json({ ok: false, error: 'Username and password are required' }, 400);

  const user = await env.DB.prepare(`
    SELECT id, username, password_hash, password_salt, role, created_at, last_active_at, is_banned, ban_reason
    FROM users WHERE username = ?
  `).bind(username).first();

  if (!user) {
    await safeWriteSystemLog(env, {
      severity: 'WARNING', eventType: 'LOGIN_FAILED', message: `Login failed for username: ${username}`,
      route: '/api/auth/login', method: 'POST', requestId, context: { username, reason: 'unknown_user' }
    });
    return json({ ok: false, error: 'Invalid username or password' }, 401);
  }

  const saltBytes = base64ToBytes(user.password_salt);
  const suppliedHash = await hashPassword(password, saltBytes);
  if (!constantTimeEqual(suppliedHash, user.password_hash)) {
    await safeWriteSystemLog(env, {
      severity: 'WARNING', eventType: 'LOGIN_FAILED', message: `Login failed for username: ${username}`,
      route: '/api/auth/login', method: 'POST', requestId, userId: user.id,
      context: { username, reason: 'invalid_password' }
    });
    return json({ ok: false, error: 'Invalid username or password' }, 401);
  }

  if (user.is_banned) return json({ ok: false, error: user.ban_reason || 'This account is banned' }, 403);

  const now = Date.now();
  await env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(now, user.id).run();
  await writeAudit(env, user.id, 'user.login', user.id, {});
  await safeWriteSystemLog(env, {
    severity: 'INFO', eventType: 'LOGIN_SUCCESS', message: `Login successful: ${user.username}`,
    route: '/api/auth/login', method: 'POST', requestId, userId: user.id, context: { username: user.username }
  });

  const session = await createSession(env, request, user.id);
  return json({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role, createdAt: user.created_at, lastActiveAt: now }
  }, 200, { 'Set-Cookie': session.cookie });
}

async function logout(request, env, requestId) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (rawToken) {
    const tokenHash = await sha256(rawToken);
    const session = await env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').bind(tokenHash).first();
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    if (session?.user_id) {
      await writeAudit(env, session.user_id, 'user.logout', session.user_id, {});
      await safeWriteSystemLog(env, {
        severity: 'INFO', eventType: 'LOGOUT', message: 'Player logged out', route: '/api/auth/logout',
        method: 'POST', requestId, userId: session.user_id
      });
    }
  }

  return json({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  });
}

async function me(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, authenticated: false }, 401);
  return json({
    ok: true, authenticated: true,
    user: {
      id: auth.user.id, username: auth.user.username, role: auth.user.role,
      createdAt: auth.user.created_at, lastActiveAt: auth.user.last_active_at, online: true
    }
  });
}

async function health(env) {
  const result = { ok: true, service: 'ironvale-foundation-v1', database: 'unknown' };
  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
    result.database = 'connected';
  } catch {
    result.ok = false;
    result.database = 'error';
  }
  return json(result, result.ok ? 200 : 503);
}


const AI_BUILDER_DRAFT_MAX_BYTES = 2 * 1024 * 1024;
const AI_BUILDER_TOOL_VERSION = AI_BUILDER_MCP_VERSION;
const AI_BUILDER_PUBLIC_TOOLS = Object.freeze([
  { name: 'rift_scene_state', access: 'public-browser', persistence: 'none' },
  { name: 'rift_inspect_object', access: 'public-browser', persistence: 'none' },
  { name: 'rift_focus_object', access: 'public-browser', persistence: 'none' },
  { name: 'rift_set_camera', access: 'public-browser', persistence: 'none' },
  { name: 'rift_move_object', access: 'public-browser', persistence: 'staging-only' },
  { name: 'rift_rotate_object', access: 'public-browser', persistence: 'staging-only' },
  { name: 'rift_duplicate_object', access: 'public-browser', persistence: 'staging-only' },
  { name: 'rift_delete_object', access: 'public-browser', persistence: 'staging-only' },
  { name: 'rift_import_blueprint', access: 'public-browser', persistence: 'staging-only' },
  { name: 'rift_undo', access: 'public-browser', persistence: 'staging-only' },
  { name: 'rift_redo', access: 'public-browser', persistence: 'staging-only' },
  { name: 'rift_checkpoint', access: 'public-browser', persistence: 'browser-local' },
  { name: 'rift_capture_view', access: 'public-browser', persistence: 'none' },
  { name: 'rift_save_draft', access: 'public', persistence: 'd1-review-draft' }
]);

async function ensureAiBuilderDraftTable(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ai_builder_drafts (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        name TEXT NOT NULL,
        draft_json TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'public-ai-builder',
        tool_version TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        loaded_at INTEGER,
        loaded_by TEXT,
        FOREIGN KEY (loaded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_builder_drafts_created ON ai_builder_drafts(created_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_builder_drafts_loaded ON ai_builder_drafts(loaded_at, created_at DESC)')
  ]);
}

function getPublicAiBuilderTools() {
  return json({
    ok: true,
    service: 'ironvale-ai-builder',
    version: AI_BUILDER_TOOL_VERSION,
    public: true,
    accountRequired: false,
    page: '/dev/ai-builder',
    draftSaveEndpoint: '/api/ai-builder/drafts',
    draftPersistence: 'D1 review inbox only; no anonymous load or publish endpoint exists.',
    toolCount: AI_BUILDER_PUBLIC_TOOLS.length,
    browserToolCount: AI_BUILDER_PUBLIC_TOOLS.length,
    tools: AI_BUILDER_PUBLIC_TOOLS,
    riftBridge: {
      version: RIFTBRIDGE_VERSION,
      statusEndpoint: '/api/riftbridge',
      jobEndpoint: RIFTBRIDGE_ENDPOINT,
      jobFormat: RIFTBRIDGE_JOB_FORMAT,
      githubIssueTitlePrefix: '[RIFT-AI]',
      workflow: '.github/workflows/riftbridge.yml',
      transport: 'GitHub Issue -> GitHub Actions -> Cloudflare HTTP -> D1 review draft',
      persistence: 'D1 review inbox only',
      publishAccess: false
    },
    remoteMcp: {
      endpoint: AI_BUILDER_MCP_PATH,
      transport: 'Streamable HTTP',
      authentication: 'none during development',
      stateModel: 'stateless Blueprint document-in/document-out; D1 is only touched by rift_save_draft',
      toolCount: AI_BUILDER_REMOTE_TOOL_NAMES.length,
      tools: AI_BUILDER_REMOTE_TOOL_NAMES
    }
  });
}


function getRiftBridgeStatus() {
  return json({
    ok: true,
    service: 'ironvale-riftbridge',
    version: RIFTBRIDGE_VERSION,
    public: true,
    accountRequired: false,
    jobEndpoint: RIFTBRIDGE_ENDPOINT,
    jobFormat: RIFTBRIDGE_JOB_FORMAT,
    github: {
      issueTitlePrefix: '[RIFT-AI]',
      workflow: '.github/workflows/riftbridge.yml',
      trustedIssueAuthors: ['OWNER', 'MEMBER', 'COLLABORATOR']
    },
    jobModel: 'one GitHub issue -> one GitHub Action -> one Cloudflare request -> one compiler-validated D1 review draft',
    persistence: 'D1 review inbox only',
    capabilities: ['create_blueprint', 'apply_up_to_250_edits', 'validate', 'save_d1_draft'],
    prohibited: ['load_draft', 'publish', 'deploy', 'live_world_mutation']
  });
}

async function submitRiftBridgeJob(request, env, requestId) {
  let body;
  try { body = await readJson(request); }
  catch (error) { return json({ ok: false, error: safeErrorMessage(error), requestId }, 400); }

  try {
    const result = await executeRiftBridgeJob(env, body);
    return json({ ...result, requestId }, 201);
  } catch (error) {
    return json({
      ok: false,
      service: 'ironvale-riftbridge',
      version: RIFTBRIDGE_VERSION,
      error: safeErrorMessage(error),
      requestId
    }, 400);
  }
}

function validateAiBuilderDraftDocument(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return 'Draft document must be a JSON object.';
  if (document.format !== 'riftcity-city-block') return "Draft format must be 'riftcity-city-block'.";
  if (!Number.isInteger(Number(document.version)) || Number(document.version) < 1 || Number(document.version) > 2) return 'Draft version must be 1 or 2.';
  if (typeof document.id !== 'string' || !document.id.trim() || document.id.length > 160) return 'Draft id is required and must be 160 characters or fewer.';
  if (document.units != null && document.units !== 'meters') return "Draft units must be 'meters'.";
  if (!Array.isArray(document.origin) || document.origin.length !== 3 || !document.origin.every(Number.isFinite)) return 'Draft origin must contain three finite meter coordinates.';
  const bounds = document.bounds;
  if (!bounds || !Array.isArray(bounds.min) || !Array.isArray(bounds.max) || bounds.min.length !== 3 || bounds.max.length !== 3) return 'Draft bounds.min and bounds.max must each contain three coordinates.';
  if (![...bounds.min, ...bounds.max].every(Number.isFinite)) return 'Draft bounds must contain finite coordinates.';
  if (!document.palette || typeof document.palette !== 'object' || Array.isArray(document.palette)) return 'Draft palette is required.';
  if (document.ops != null && !Array.isArray(document.ops)) return 'Draft ops must be an array when present.';
  if (document.layout != null && !Array.isArray(document.layout)) return 'Draft layout must be an array when present.';
  if (!Array.isArray(document.ops) && !Array.isArray(document.layout)) return 'Draft must contain ops or Blueprint layout objects.';
  if (document.prefabs != null && (typeof document.prefabs !== 'object' || Array.isArray(document.prefabs))) return 'Draft prefabs must be an object when present.';
  return '';
}

async function savePublicAiBuilderDraft(request, env, requestId) {
  const body = await readJson(request);
  if (!body?.document) return json({ ok: false, error: 'A Ironvale draft document is required.' }, 400);
  const validationError = validateAiBuilderDraftDocument(body.document);
  if (validationError) return json({ ok: false, error: validationError }, 400);

  let draftJson;
  try { draftJson = JSON.stringify(body.document); }
  catch { return json({ ok: false, error: 'Draft document could not be serialized.' }, 400); }
  const byteLength = new TextEncoder().encode(draftJson).byteLength;
  if (byteLength > AI_BUILDER_DRAFT_MAX_BYTES) {
    return json({ ok: false, error: 'AI Builder drafts are capped at 2 MB.' }, 413);
  }

  await ensureAiBuilderDraftTable(env);
  const id = crypto.randomUUID();
  const now = Date.now();
  const documentId = String(body.document.id).trim().slice(0, 160);
  const requestedName = typeof body.name === 'string' ? body.name.trim() : '';
  const name = (requestedName || String(body.document.name || documentId || 'Ironvale AI Draft')).slice(0, 160);
  const digest = await sha256(draftJson);

  await env.DB.prepare(`
    INSERT INTO ai_builder_drafts (id, document_id, name, draft_json, sha256, source, tool_version, created_at)
    VALUES (?, ?, ?, ?, ?, 'public-ai-builder', ?, ?)
  `).bind(id, documentId, name, draftJson, digest, AI_BUILDER_TOOL_VERSION, now).run();

  return json({
    ok: true,
    draftId: id,
    documentId,
    name,
    sha256: digest,
    bytes: byteLength,
    savedAt: now,
    review: 'Saved to the D1 AI draft inbox. Only developer/admin accounts can load it in Ironvale Build Mode.',
    requestId
  }, 201);
}

async function listAdminAiBuilderDrafts(request, env, url) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  await ensureAiBuilderDraftTable(env);
  const requested = Number(url.searchParams.get('limit') || 40);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, Math.floor(requested))) : 40;
  const result = await env.DB.prepare(`
    SELECT id, document_id, name, sha256, source, tool_version, created_at, loaded_at, loaded_by
    FROM ai_builder_drafts
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();
  return json({ ok: true, drafts: result.results || [] });
}

function adminAiBuilderDraftId(pathname, loadedSuffix = false) {
  const pattern = loadedSuffix
    ? /^\/api\/admin\/ai-builder\/drafts\/([^/]+)\/loaded$/
    : /^\/api\/admin\/ai-builder\/drafts\/([^/]+)$/;
  const match = pathname.match(pattern);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return ''; }
}

async function getAdminAiBuilderDraft(request, env, url) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const id = adminAiBuilderDraftId(url.pathname);
  if (!id) return json({ ok: false, error: 'Invalid AI draft id.' }, 400);
  await ensureAiBuilderDraftTable(env);
  const row = await env.DB.prepare(`
    SELECT id, document_id, name, draft_json, sha256, source, tool_version, created_at, loaded_at, loaded_by
    FROM ai_builder_drafts WHERE id = ?
  `).bind(id).first();
  if (!row) return json({ ok: false, error: 'AI draft not found.' }, 404);
  let document;
  try { document = JSON.parse(row.draft_json); }
  catch { return json({ ok: false, error: 'Stored AI draft JSON is corrupted.' }, 500); }
  return json({
    ok: true,
    draft: {
      id: row.id,
      documentId: row.document_id,
      name: row.name,
      sha256: row.sha256,
      source: row.source,
      toolVersion: row.tool_version,
      createdAt: row.created_at,
      loadedAt: row.loaded_at,
      loadedBy: row.loaded_by,
      document
    }
  });
}

async function markAdminAiBuilderDraftLoaded(request, env, url, requestId) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const id = adminAiBuilderDraftId(url.pathname, true);
  if (!id) return json({ ok: false, error: 'Invalid AI draft id.' }, 400);
  await ensureAiBuilderDraftTable(env);
  const now = Date.now();
  const result = await env.DB.prepare(`
    UPDATE ai_builder_drafts SET loaded_at = ?, loaded_by = ? WHERE id = ?
  `).bind(now, gate.auth.user.id, id).run();
  if (!Number(result.meta?.changes || 0)) return json({ ok: false, error: 'AI draft not found.' }, 404);
  await writeAudit(env, gate.auth.user.id, 'ai_builder.draft_loaded', gate.auth.user.id, { draftId: id });
  return json({ ok: true, draftId: id, loadedAt: now, requestId });
}


const BLOCK_LAYOUT_MAX_BYTES = 350_000;
const APPROVED_ASSET_MAX_BYTES = 10 * 1024 * 1024;
const APPROVED_ASSET_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
const ASSET_ID_RE = /^[a-z0-9][a-z0-9._-]{2,120}$/i;

async function ensureBlockEditorTables(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS block_layouts (
        block_id TEXT PRIMARY KEY,
        draft_json TEXT,
        draft_revision INTEGER NOT NULL DEFAULT 0,
        published_json TEXT,
        published_revision INTEGER NOT NULL DEFAULT 0,
        updated_by TEXT,
        updated_at INTEGER,
        published_at INTEGER,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS block_layout_history (
        id TEXT PRIMARY KEY,
        block_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        layout_json TEXT NOT NULL,
        published_by TEXT,
        published_at INTEGER NOT NULL,
        FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS block_layout_integrity (
        block_id TEXT PRIMARY KEY,
        published_revision INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        signature TEXT,
        algorithm TEXT NOT NULL,
        signed_at INTEGER NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS block_layout_history_integrity (
        history_id TEXT PRIMARY KEY,
        block_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        signature TEXT,
        algorithm TEXT NOT NULL,
        signed_at INTEGER NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS approved_assets (
        asset_id TEXT PRIMARY KEY,
        sha256 TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        storage_key TEXT NOT NULL,
        metadata_json TEXT,
        status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved','disabled')),
        created_by TEXT,
        created_at INTEGER NOT NULL,
        approved_at INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_block_layout_history_block ON block_layout_history(block_id, published_at DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_block_layout_history_integrity_block ON block_layout_history_integrity(block_id, revision DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_approved_assets_sha256 ON approved_assets(sha256)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_approved_assets_status ON approved_assets(status)`)
  ]);
}

function normalizeAssetId(value) {
  const assetId = String(value || '').trim();
  return ASSET_ID_RE.test(assetId) ? assetId : '';
}

function normalizeSha256(value) {
  const hash = String(value || '').trim().toLowerCase();
  return SHA256_HEX_RE.test(hash) ? hash : '';
}

async function sha256Bytes(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeHexEqual(a, b) {
  const left = String(a || '').toLowerCase(), right = String(b || '').toLowerCase();
  if (left.length !== right.length || !left.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

function configSigningSecret(env) {
  const secret = String(env?.CONFIG_SIGNING_SECRET || '').trim();
  return secret.length >= 32 ? secret : '';
}

function blockIntegrityPayload(blockId, revision, sha256) {
  return `riftcity:block-layout:v1:${String(blockId)}:${Number(revision) || 0}:${String(sha256)}`;
}

async function createBlockIntegrity(env, blockId, revision, jsonText) {
  const sha256 = await sha256Bytes(new TextEncoder().encode(String(jsonText || '')));
  const secret = configSigningSecret(env);
  if (!secret) {
    return { verified: true, algorithm: 'sha256-v1', sha256, signature: null, signed: false };
  }
  const signature = await hmacSha256Hex(secret, blockIntegrityPayload(blockId, revision, sha256));
  return { verified: true, algorithm: 'hmac-sha256-v1', sha256, signature, signed: true };
}

async function verifyBlockIntegrity(env, blockId, revision, jsonText, record) {
  if (!record?.sha256 || !record?.algorithm) return { verified: false, reason: 'missing-integrity-record' };
  if (Number(record.published_revision ?? record.revision) !== Number(revision)) {
    return { verified: false, reason: 'revision-mismatch', algorithm: record.algorithm };
  }
  const sha256 = await sha256Bytes(new TextEncoder().encode(String(jsonText || '')));
  if (!constantTimeHexEqual(sha256, record.sha256)) {
    return { verified: false, reason: 'sha256-mismatch', algorithm: record.algorithm, sha256 };
  }
  const algorithm = String(record.algorithm || '');
  if (algorithm === 'sha256-v1') {
    return { verified: true, algorithm, sha256, signed: false };
  }
  if (algorithm !== 'hmac-sha256-v1') {
    return { verified: false, reason: 'unsupported-integrity-algorithm', algorithm, sha256 };
  }
  const secret = configSigningSecret(env);
  if (!secret) return { verified: false, reason: 'signing-secret-unavailable', algorithm, sha256 };
  const expected = await hmacSha256Hex(secret, blockIntegrityPayload(blockId, revision, sha256));
  if (!constantTimeHexEqual(expected, record.signature)) {
    return { verified: false, reason: 'signature-mismatch', algorithm, sha256 };
  }
  return { verified: true, algorithm, sha256, signed: true };
}

async function storePublishedIntegrity(env, blockId, revision, jsonText, { historyId = '' } = {}) {
  const integrity = await createBlockIntegrity(env, blockId, revision, jsonText);
  const now = Date.now();
  const statements = [env.DB.prepare(`
    INSERT INTO block_layout_integrity (block_id, published_revision, sha256, signature, algorithm, signed_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(block_id) DO UPDATE SET
      published_revision = excluded.published_revision,
      sha256 = excluded.sha256,
      signature = excluded.signature,
      algorithm = excluded.algorithm,
      signed_at = excluded.signed_at
  `).bind(blockId, revision, integrity.sha256, integrity.signature, integrity.algorithm, now)];
  if (historyId) statements.push(env.DB.prepare(`
    INSERT INTO block_layout_history_integrity (history_id, block_id, revision, sha256, signature, algorithm, signed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(history_id) DO UPDATE SET
      sha256 = excluded.sha256,
      signature = excluded.signature,
      algorithm = excluded.algorithm,
      signed_at = excluded.signed_at
  `).bind(historyId, blockId, revision, integrity.sha256, integrity.signature, integrity.algorithm, now));
  await env.DB.batch(statements);
  return { ...integrity, signedAt: now };
}

async function storeHistoryIntegrity(env, historyId, blockId, revision, jsonText) {
  const integrity = await createBlockIntegrity(env, blockId, revision, jsonText);
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO block_layout_history_integrity (history_id, block_id, revision, sha256, signature, algorithm, signed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(history_id) DO UPDATE SET
      sha256 = excluded.sha256,
      signature = excluded.signature,
      algorithm = excluded.algorithm,
      signed_at = excluded.signed_at
  `).bind(historyId, blockId, revision, integrity.sha256, integrity.signature, integrity.algorithm, now).run();
  return { ...integrity, signedAt: now };
}

function sanitizeAssetMetadata(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const number = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  return {
    name: String(source.name || source.label || '').slice(0, 160),
    sourceWidth: Math.max(0, Math.min(20000, number(source.sourceWidth ?? source.width))),
    sourceHeight: Math.max(0, Math.min(20000, number(source.sourceHeight ?? source.height))),
    x: Math.max(-20000, Math.min(20000, number(source.x))),
    y: Math.max(-20000, Math.min(20000, number(source.y))),
    scale: Math.max(0.01, Math.min(20, number(source.scale, 1))),
    rotation: Math.max(-3600, Math.min(3600, number(source.rotation))),
    opacity: Math.max(0, Math.min(1, number(source.opacity, 1))),
    groundY: Math.max(-20000, Math.min(20000, number(source.groundY))),
    shadow: source.shadow !== false
  };
}

function assetIdFromPath(pathname) {
  const raw = pathname.slice('/api/assets/'.length).split('/')[0] || '';
  let decoded = '';
  try { decoded = decodeURIComponent(raw); } catch { return ''; }
  return normalizeAssetId(decoded);
}

function canonicalizeBlockAssetReferences(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return block;
  const clean = JSON.parse(JSON.stringify(block));
  const normalizeHolder = holder => {
    if (!holder || typeof holder !== 'object' || Array.isArray(holder)) return;
    const legacy = holder.asset && typeof holder.asset === 'object' && !Array.isArray(holder.asset) ? holder.asset : {};
    const assetId = normalizeAssetId(holder.assetId || legacy.assetId || legacy.id);
    const assetHash = normalizeSha256(holder.assetHash || holder.assetSha256 || legacy.sha256 || legacy.hash);
    if (assetId) {
      holder.assetId = assetId;
      if (assetHash) holder.assetHash = assetHash;
    }
    delete holder.asset;
    delete holder.assetSha256;
    delete holder.dataUrl;
    delete holder.imageData;
    delete holder.image;
    delete holder.data;
  };
  for (const building of clean.buildings || []) normalizeHolder(building);
  for (const prop of clean.props || []) normalizeHolder(prop);
  normalizeHolder(clean.alley);
  if (clean.scenePlate && typeof clean.scenePlate === 'object') {
    normalizeHolder(clean.scenePlate);
    if (clean.scenePlate.assetId) delete clean.scenePlate.src;
  }
  return clean;
}

function collectBlockAssetReferences(block) {
  const refs = [];
  const add = (holder, path) => {
    if (!holder || typeof holder !== 'object' || Array.isArray(holder)) return;
    const assetId = normalizeAssetId(holder.assetId);
    const sha256 = normalizeSha256(holder.assetHash);
    if (!assetId && !holder.assetId && !holder.assetHash) return;
    refs.push({ assetId, sha256, path });
  };
  (block.buildings || []).forEach((item, index) => add(item, `buildings[${index}]`));
  (block.props || []).forEach((item, index) => add(item, `props[${index}]`));
  add(block.alley, 'alley');
  add(block.scenePlate, 'scenePlate');
  return refs;
}

async function validateApprovedBlockAssets(env, block) {
  const sceneSrc = String(block?.scenePlate?.src || '');
  if (!block?.scenePlate?.assetId && sceneSrc && !/^\/assets\/[a-z0-9/_\-.]+$/i.test(sceneSrc)) {
    return 'Scene plate must use a built-in /assets/ path or an approved asset reference';
  }

  const refs = collectBlockAssetReferences(block);
  for (const ref of refs) {
    if (!ref.assetId) return `Invalid assetId at ${ref.path}`;
    if (!ref.sha256) return `Approved asset ${ref.assetId} at ${ref.path} is missing its SHA-256 hash`;
  }
  if (!refs.length) return '';

  await ensureBlockEditorTables(env);
  const unique = [...new Map(refs.map(ref => [`${ref.assetId}:${ref.sha256}`, ref])).values()];
  const statements = unique.map(ref => env.DB.prepare(`
    SELECT asset_id, sha256, status
    FROM approved_assets
    WHERE asset_id = ? AND sha256 = ? AND status = 'approved'
    LIMIT 1
  `).bind(ref.assetId, ref.sha256));
  const results = await env.DB.batch(statements);

  for (let i = 0; i < unique.length; i++) {
    const row = results[i]?.results?.[0];
    if (!row) return `Asset ${unique[i].assetId} is not approved with hash ${unique[i].sha256}`;
  }
  return '';
}

async function registerApprovedAsset(request, env, requestId) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  if (!env.RIFT_ASSETS || typeof env.RIFT_ASSETS.put !== 'function') {
    return json({ ok: false, error: 'RIFT_ASSETS storage is not configured' }, 503);
  }

  let form;
  try { form = await request.formData(); }
  catch { return json({ ok: false, error: 'Expected multipart/form-data' }, 400); }

  const assetId = normalizeAssetId(form.get('assetId'));
  const claimedSha256 = normalizeSha256(form.get('claimedSha256'));
  const file = form.get('file');
  if (!assetId) return json({ ok: false, error: 'Invalid assetId' }, 400);
  if (!claimedSha256) return json({ ok: false, error: 'A valid claimedSha256 is required' }, 400);
  if (!file || typeof file.arrayBuffer !== 'function') return json({ ok: false, error: 'Image file is required' }, 400);

  const mimeType = String(file.type || '').toLowerCase();
  if (!APPROVED_ASSET_MIME_TYPES.has(mimeType)) {
    return json({ ok: false, error: 'Only PNG, JPEG and WebP assets are accepted' }, 415);
  }
  const bytes = await file.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > APPROVED_ASSET_MAX_BYTES) {
    return json({ ok: false, error: 'Asset must be between 1 byte and 10 MB' }, 413);
  }

  const actualSha256 = await sha256Bytes(bytes);
  if (!constantTimeEqual(actualSha256, claimedSha256)) {
    return json({
      ok: false,
      error: 'Client SHA-256 does not match the uploaded bytes',
      code: 'ASSET_HASH_MISMATCH'
    }, 400);
  }

  await ensureBlockEditorTables(env);
  const existing = await env.DB.prepare(`
    SELECT asset_id, sha256, mime_type, byte_size, storage_key, metadata_json, status
    FROM approved_assets WHERE asset_id = ?
  `).bind(assetId).first();

  if (existing && existing.sha256 !== actualSha256) {
    return json({
      ok: false,
      error: 'This assetId is already bound to different approved bytes. Use a new versioned assetId.',
      code: 'ASSET_ID_IMMUTABLE'
    }, 409);
  }

  if (existing && existing.status === 'approved') {
    let metadata = {};
    try { metadata = JSON.parse(existing.metadata_json || '{}'); } catch {}
    return json({
      ok: true,
      existing: true,
      asset: {
        assetId: existing.asset_id,
        sha256: existing.sha256,
        mimeType: existing.mime_type,
        byteSize: Number(existing.byte_size || 0),
        metadata
      }
    });
  }

  let submittedMetadata = {};
  try { submittedMetadata = JSON.parse(String(form.get('metadata') || '{}')); } catch {}
  const metadata = sanitizeAssetMetadata(submittedMetadata);
  const storageKey = `approved/${actualSha256.slice(0, 2)}/${actualSha256}`;
  const now = Date.now();

  await env.RIFT_ASSETS.put(storageKey, bytes, {
    httpMetadata: { contentType: mimeType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { assetId, sha256: actualSha256 }
  });

  await env.DB.prepare(`
    INSERT INTO approved_assets (
      asset_id, sha256, mime_type, byte_size, storage_key, metadata_json,
      status, created_by, created_at, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
    ON CONFLICT(asset_id) DO UPDATE SET
      status = 'approved',
      approved_at = excluded.approved_at
  `).bind(
    assetId, actualSha256, mimeType, bytes.byteLength, storageKey,
    JSON.stringify(metadata), gate.auth.user.id, now, now
  ).run();

  await writeAudit(env, gate.auth.user.id, 'asset.approved', gate.auth.user.id, {
    assetId, sha256: actualSha256, byteSize: bytes.byteLength, mimeType
  });

  return json({
    ok: true,
    asset: { assetId, sha256: actualSha256, mimeType, byteSize: bytes.byteLength, metadata },
    requestId
  }, 201);
}

async function listApprovedAssets(request, env) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  await ensureBlockEditorTables(env);
  const result = await env.DB.prepare(`
    SELECT asset_id, sha256, mime_type, byte_size, metadata_json, status, created_at, approved_at
    FROM approved_assets
    ORDER BY approved_at DESC, created_at DESC
    LIMIT 500
  `).all();
  return json({
    ok: true,
    assets: (result.results || []).map(row => {
      let metadata = {};
      try { metadata = JSON.parse(row.metadata_json || '{}'); } catch {}
      return {
        assetId: row.asset_id,
        sha256: row.sha256,
        mimeType: row.mime_type,
        byteSize: Number(row.byte_size || 0),
        status: row.status,
        createdAt: row.created_at,
        approvedAt: row.approved_at,
        metadata
      };
    })
  });
}

async function getApprovedAsset(request, env, url) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const assetId = assetIdFromPath(url.pathname);
  const expectedHash = normalizeSha256(url.searchParams.get('sha256'));
  if (!assetId || !expectedHash) return json({ ok: false, error: 'assetId and sha256 are required' }, 400);

  await ensureBlockEditorTables(env);
  const row = await env.DB.prepare(`
    SELECT asset_id, sha256, mime_type, byte_size, storage_key, metadata_json
    FROM approved_assets
    WHERE asset_id = ? AND sha256 = ? AND status = 'approved'
    LIMIT 1
  `).bind(assetId, expectedHash).first();

  if (!row) return json({ ok: false, error: 'Approved asset not found' }, 404);

  if (url.searchParams.get('meta') === '1') {
    let metadata = {};
    try { metadata = JSON.parse(row.metadata_json || '{}'); } catch {}
    return json({
      ok: true,
      asset: {
        assetId: row.asset_id,
        sha256: row.sha256,
        mimeType: row.mime_type,
        byteSize: Number(row.byte_size || 0),
        metadata
      }
    });
  }

  if (!env.RIFT_ASSETS || typeof env.RIFT_ASSETS.get !== 'function') {
    return json({ ok: false, error: 'RIFT_ASSETS storage is not configured' }, 503);
  }
  const object = await env.RIFT_ASSETS.get(row.storage_key);
  if (!object) return json({ ok: false, error: 'Approved asset bytes are missing' }, 404);

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': row.mime_type,
      'Content-Length': String(row.byte_size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': `"${row.sha256}"`,
      'X-Ironvale-Asset-ID': row.asset_id,
      'X-Ironvale-SHA256': row.sha256,
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function blockIdFromPath(pathname, suffix='') {
  const stripped = suffix && pathname.endsWith(suffix) ? pathname.slice(0, -suffix.length) : pathname;
  const raw = stripped.split('/').filter(Boolean).pop() || '';
  const id = decodeURIComponent(raw);
  return /^[a-z0-9][a-z0-9-]{1,80}$/i.test(id) ? id : '';
}


function isFinitePoint(point) {
  return !!point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}

function hasValidPolygonPoints(shape) {
  return Array.isArray(shape?.points)
    && shape.points.length >= 3
    && shape.points.length <= 64
    && shape.points.every(isFinitePoint);
}

function hasValidRectGeometry(shape) {
  return !!shape
    && Number.isFinite(Number(shape.x))
    && Number.isFinite(Number(shape.y))
    && Number.isFinite(Number(shape.width ?? shape.w))
    && Number.isFinite(Number(shape.height ?? shape.h));
}

function isValidZoneGeometry(shape) {
  return hasValidPolygonPoints(shape) || hasValidRectGeometry(shape);
}

function validateFiniteRange(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function validateKnownKeys(object, allowed, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return `${label} must be an object`;
  const unknown = Object.keys(object).find(key => !allowed.has(key));
  return unknown ? `${label} contains unsupported field ${unknown}` : '';
}

function validateSceneRuntimeConfig(config) {
  if (config == null) return '';
  const topError = validateKnownKeys(config, new Set(['schemaVersion','camera','player','movement','interaction']), 'runtimeConfig');
  if (topError) return topError;
  if (Number(config.schemaVersion || 1) !== 1) return 'Unsupported runtimeConfig schemaVersion';

  if (config.camera != null) {
    const error = validateKnownKeys(config.camera, new Set(['mode','playScale','zoom','minScale','maxScale','anchorX','anchorY','lookAhead','vertical','positionEase','zoomEase']), 'runtimeConfig.camera');
    if (error) return error;
    const camera = config.camera;
    if (camera.mode != null && !['follow','room','contain','cover'].includes(String(camera.mode))) return 'Invalid camera mode';
    if (camera.vertical != null && !['follow','ground'].includes(String(camera.vertical))) return 'Invalid camera vertical mode';
    for (const key of ['playScale','zoom','minScale','maxScale']) if (camera[key] != null && !validateFiniteRange(camera[key], .05, 3)) return `Invalid camera ${key}`;
    for (const key of ['anchorX','anchorY']) if (camera[key] != null && !validateFiniteRange(camera[key], 0, 1)) return `Invalid camera ${key}`;
    if (camera.lookAhead != null && !validateFiniteRange(camera.lookAhead, 0, 1200)) return 'Invalid camera lookAhead';
    for (const key of ['positionEase','zoomEase']) if (camera[key] != null && !validateFiniteRange(camera[key], .01, 1)) return `Invalid camera ${key}`;
    if (camera.minScale != null && camera.maxScale != null && Number(camera.minScale) > Number(camera.maxScale)) return 'camera minScale cannot exceed maxScale';
  }

  if (config.player != null) {
    const error = validateKnownKeys(config.player, new Set(['baseScale','editorScale','depthMin','depthMax','visualOffsetX','visualOffsetY','shadowScale']), 'runtimeConfig.player');
    if (error) return error;
    const player = config.player;
    for (const key of ['baseScale','editorScale']) if (player[key] != null && !validateFiniteRange(player[key], .3, 4)) return `Invalid player ${key}`;
    for (const key of ['depthMin','depthMax']) if (player[key] != null && !validateFiniteRange(player[key], .2, 3)) return `Invalid player ${key}`;
    for (const key of ['visualOffsetX','visualOffsetY']) if (player[key] != null && !validateFiniteRange(player[key], -500, 500)) return `Invalid player ${key}`;
    if (player.shadowScale != null && !validateFiniteRange(player.shadowScale, .2, 4)) return 'Invalid player shadowScale';
    if (player.depthMin != null && player.depthMax != null && Number(player.depthMin) > Number(player.depthMax)) return 'player depthMin cannot exceed depthMax';
  }

  if (config.movement != null) {
    const error = validateKnownKeys(config.movement, new Set(['walkSpeed','runSpeed','maxStep']), 'runtimeConfig.movement');
    if (error) return error;
    const movement = config.movement;
    if (movement.walkSpeed != null && !validateFiniteRange(movement.walkSpeed, 40, 800)) return 'Invalid movement walkSpeed';
    if (movement.runSpeed != null && !validateFiniteRange(movement.runSpeed, 60, 1200)) return 'Invalid movement runSpeed';
    if (movement.maxStep != null && !validateFiniteRange(movement.maxStep, 2, 24)) return 'Invalid movement maxStep';
    if (movement.walkSpeed != null && movement.runSpeed != null && Number(movement.runSpeed) < Number(movement.walkSpeed)) return 'runSpeed cannot be lower than walkSpeed';
  }

  if (config.interaction != null) {
    const error = validateKnownKeys(config.interaction, new Set(['radius','roomExitRadius']), 'runtimeConfig.interaction');
    if (error) return error;
    const interaction = config.interaction;
    for (const key of ['radius','roomExitRadius']) if (interaction[key] != null && !validateFiniteRange(interaction[key], 20, 500)) return `Invalid interaction ${key}`;
  }
  return '';
}

function validateBlockLayout(block, expectedId) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return 'Block layout must be an object';
  if (String(block.id || '') !== expectedId) return 'Block id does not match the route';
  const width = Number(block.width), height = Number(block.height);
  if (!Number.isFinite(width) || width < 320 || width > 20000) return 'Invalid block width';
  if (!Number.isFinite(height) || height < 240 || height > 12000) return 'Invalid block height';
  if (!Array.isArray(block.buildings) || block.buildings.length > 250) return 'Invalid buildings array';
  if (!Array.isArray(block.props) || block.props.length > 1000) return 'Invalid props array';
  if (!block.spawn || !Number.isFinite(Number(block.spawn.x)) || !Number.isFinite(Number(block.spawn.y))) return 'Invalid spawn';
  if (!block.walkable || !isValidZoneGeometry(block.walkable)) return 'Invalid walkable area';
  const runtimeConfigError = validateSceneRuntimeConfig(block.runtimeConfig);
  if (runtimeConfigError) return runtimeConfigError;

  if (block.obstacles != null) {
    if (!Array.isArray(block.obstacles) || block.obstacles.length > 250) return 'Invalid obstacles array';
    for (const obstacle of block.obstacles) {
      if (!isValidZoneGeometry(obstacle)) {
        return 'Invalid obstacle geometry';
      }
    }
  }
  if (block.exit != null && !isValidZoneGeometry(block.exit)) {
    return 'Invalid room exit geometry';
  }
  if (block.exits != null) {
    if (!Array.isArray(block.exits) || block.exits.length > 50) return 'Invalid exits array';
    for (const exit of block.exits) {
      if (!isValidZoneGeometry(exit)) return 'Invalid block exit geometry';
    }
  }

  const jsonText = JSON.stringify(block);
  if (new TextEncoder().encode(jsonText).byteLength > BLOCK_LAYOUT_MAX_BYTES) {
    return 'Block layout is too large. Keep image/assets outside the layout JSON.';
  }
  return '';
}

async function verifyPublishedBlockRecord(env, blockId, row, { allowBackfill = true } = {}) {
  if (!row?.published_json) return { ok: true, block: null, integrity: null };
  let block;
  try { block = canonicalizeBlockAssetReferences(JSON.parse(row.published_json)); }
  catch { return { ok: false, reason: 'published-json-corrupted' }; }

  const validationError = validateBlockLayout(block, blockId);
  if (validationError) return { ok: false, reason: `schema:${validationError}` };
  const assetError = await validateApprovedBlockAssets(env, block);
  if (assetError) return { ok: false, reason: `asset:${assetError}` };

  let record = await env.DB.prepare(`
    SELECT published_revision, sha256, signature, algorithm, signed_at
    FROM block_layout_integrity WHERE block_id = ?
  `).bind(blockId).first();

  let integrity;
  if (!record && allowBackfill) {
    integrity = await storePublishedIntegrity(env, blockId, Number(row.published_revision || 0), row.published_json);
    integrity.backfilled = true;
  } else {
    integrity = await verifyBlockIntegrity(env, blockId, Number(row.published_revision || 0), row.published_json, record);
  }

  if (integrity?.verified && integrity.algorithm === 'sha256-v1' && configSigningSecret(env)) {
    integrity = await storePublishedIntegrity(env, blockId, Number(row.published_revision || 0), row.published_json);
    integrity.upgradedToSignature = true;
  }

  if (!integrity?.verified) return { ok: false, reason: integrity?.reason || 'integrity-failed', integrity };
  return { ok: true, block, integrity };
}

async function verifyHistoryBlockRecord(env, history, blockId) {
  if (!history?.layout_json || !history?.id) return { ok: false, reason: 'history-missing' };
  let block;
  try { block = canonicalizeBlockAssetReferences(JSON.parse(history.layout_json)); }
  catch { return { ok: false, reason: 'history-json-corrupted' }; }
  const validationError = validateBlockLayout(block, blockId);
  if (validationError) return { ok: false, reason: `schema:${validationError}` };
  const assetError = await validateApprovedBlockAssets(env, block);
  if (assetError) return { ok: false, reason: `asset:${assetError}` };

  let record = await env.DB.prepare(`
    SELECT revision, sha256, signature, algorithm, signed_at
    FROM block_layout_history_integrity WHERE history_id = ?
  `).bind(history.id).first();
  let integrity;
  if (!record) {
    integrity = await storeHistoryIntegrity(env, history.id, blockId, Number(history.revision || 0), history.layout_json);
    integrity.backfilled = true;
  } else {
    integrity = await verifyBlockIntegrity(env, blockId, Number(history.revision || 0), history.layout_json, record);
  }
  if (integrity?.verified && integrity.algorithm === 'sha256-v1' && configSigningSecret(env)) {
    integrity = await storeHistoryIntegrity(env, history.id, blockId, Number(history.revision || 0), history.layout_json);
    integrity.upgradedToSignature = true;
  }
  if (!integrity?.verified) return { ok: false, reason: integrity?.reason || 'integrity-failed', integrity };
  return { ok: true, block, integrity };
}

async function getPublishedBlockLayout(request, env, url) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: false, error: 'Authentication required' }, 401);
  const blockId = blockIdFromPath(url.pathname);
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);
  const row = await env.DB.prepare(`
    SELECT published_json, published_revision, published_at
    FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  if (!row?.published_json) {
    return json({ ok: true, blockId, published: false, revision: 0, block: null, integrity: null });
  }

  const verified = await verifyPublishedBlockRecord(env, blockId, row);
  if (!verified.ok) {
    console.error('Ironvale rejected published block integrity', { blockId, reason: verified.reason });
    return json({
      ok: true,
      blockId,
      published: false,
      revision: Number(row.published_revision || 0),
      publishedAt: row.published_at,
      block: null,
      integrity: { verified: false, reason: verified.reason, ...(verified.integrity || {}) },
      fallbackRequired: true
    });
  }

  return json({
    ok: true,
    blockId,
    published: true,
    revision: Number(row.published_revision || 0),
    publishedAt: row.published_at,
    block: verified.block,
    integrity: verified.integrity
  });
}

async function getBlockEditorState(request, env, url) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/editor');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);

  const row = await env.DB.prepare(`
    SELECT draft_json, draft_revision, published_json, published_revision, updated_at, published_at
    FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  let draft = null, published = null, integrity = null;
  try { if (row?.draft_json) draft = JSON.parse(row.draft_json); } catch {}
  if (row?.published_json) {
    const verified = await verifyPublishedBlockRecord(env, blockId, row);
    if (verified.ok) {
      published = verified.block;
      integrity = verified.integrity;
    } else {
      integrity = { verified: false, reason: verified.reason, ...(verified.integrity || {}) };
    }
  }

  return json({
    ok: true,
    blockId,
    draft,
    draftRevision: Number(row?.draft_revision || 0),
    published,
    publishedRevision: Number(row?.published_revision || 0),
    updatedAt: row?.updated_at || null,
    publishedAt: row?.published_at || null,
    integrity
  });
}

async function saveBlockDraft(request, env, url, requestId) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/draft');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);

  const body = await readJson(request);
  const canonicalBlock = canonicalizeBlockAssetReferences(body?.block);
  const error = validateBlockLayout(canonicalBlock, blockId);
  if (error) return json({ ok: false, error }, 400);
  const assetError = await validateApprovedBlockAssets(env, canonicalBlock);
  if (assetError) return json({ ok: false, error: assetError, code: 'ASSET_NOT_APPROVED' }, 400);

  await ensureBlockEditorTables(env);
  const now = Date.now();
  const layoutJson = JSON.stringify(canonicalBlock);

  await env.DB.prepare(`
    INSERT INTO block_layouts (
      block_id, draft_json, draft_revision, published_json, published_revision,
      updated_by, updated_at, published_at
    ) VALUES (?, ?, 1, NULL, 0, ?, ?, NULL)
    ON CONFLICT(block_id) DO UPDATE SET
      draft_json = excluded.draft_json,
      draft_revision = block_layouts.draft_revision + 1,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).bind(blockId, layoutJson, gate.auth.user.id, now).run();

  const row = await env.DB.prepare(`
    SELECT draft_revision FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  await writeAudit(env, gate.auth.user.id, 'block.draft_saved', gate.auth.user.id, {
    blockId, revision: Number(row?.draft_revision || 0)
  });

  return json({
    ok: true,
    blockId,
    draftRevision: Number(row?.draft_revision || 0),
    savedAt: now,
    requestId
  });
}

async function publishBlockDraft(request, env, url, requestId) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/publish');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);

  const row = await env.DB.prepare(`
    SELECT draft_json, draft_revision, published_revision
    FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  if (!row?.draft_json) return json({ ok: false, error: 'No saved draft to publish' }, 409);
  let parsed;
  try { parsed = JSON.parse(row.draft_json); } catch { return json({ ok: false, error: 'Draft JSON is corrupted' }, 500); }
  parsed = canonicalizeBlockAssetReferences(parsed);
  const validationError = validateBlockLayout(parsed, blockId);
  if (validationError) return json({ ok: false, error: validationError }, 400);
  const assetError = await validateApprovedBlockAssets(env, parsed);
  if (assetError) return json({ ok: false, error: assetError, code: 'ASSET_NOT_APPROVED' }, 400);
  const canonicalJson = JSON.stringify(parsed);

  const nextRevision = Number(row.published_revision || 0) + 1;
  const now = Date.now();
  const historyId = crypto.randomUUID();
  const integrity = await createBlockIntegrity(env, blockId, nextRevision, canonicalJson);

  // One D1 transaction publishes the canonical config, its revision history and
  // the integrity envelope. If an HMAC secret is configured, D1 never receives
  // an unsigned live revision; without it SHA-256 corruption detection remains mandatory.
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE block_layouts
      SET draft_json = ?,
          published_json = ?,
          published_revision = ?,
          published_at = ?,
          updated_by = ?,
          updated_at = ?
      WHERE block_id = ?
    `).bind(canonicalJson, canonicalJson, nextRevision, now, gate.auth.user.id, now, blockId),
    env.DB.prepare(`
      INSERT INTO block_layout_history (id, block_id, revision, layout_json, published_by, published_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(historyId, blockId, nextRevision, canonicalJson, gate.auth.user.id, now),
    env.DB.prepare(`
      INSERT INTO block_layout_integrity (block_id, published_revision, sha256, signature, algorithm, signed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(block_id) DO UPDATE SET
        published_revision = excluded.published_revision,
        sha256 = excluded.sha256,
        signature = excluded.signature,
        algorithm = excluded.algorithm,
        signed_at = excluded.signed_at
    `).bind(blockId, nextRevision, integrity.sha256, integrity.signature, integrity.algorithm, now),
    env.DB.prepare(`
      INSERT INTO block_layout_history_integrity (history_id, block_id, revision, sha256, signature, algorithm, signed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(historyId, blockId, nextRevision, integrity.sha256, integrity.signature, integrity.algorithm, now)
  ]);

  await writeAudit(env, gate.auth.user.id, 'block.published', gate.auth.user.id, {
    blockId, revision: nextRevision, integrity: integrity.algorithm, sha256: integrity.sha256
  });

  return json({
    ok: true,
    blockId,
    publishedRevision: nextRevision,
    publishedAt: now,
    block: parsed,
    integrity: { ...integrity, signedAt: now },
    requestId
  });
}

async function revertBlockDraft(request, env, url, requestId) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/revert-draft');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);

  const row = await env.DB.prepare(`
    SELECT published_json, published_revision, published_at FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  if (!row?.published_json) {
    await env.DB.prepare(`DELETE FROM block_layouts WHERE block_id = ?`).bind(blockId).run();
    return json({ ok: true, blockId, revertedTo: 'authored', block: null, integrity: null, requestId });
  }

  const verified = await verifyPublishedBlockRecord(env, blockId, row);
  if (!verified.ok) return json({ ok: false, error: `Published config integrity failed: ${verified.reason}`, integrity: verified.integrity || null }, 409);

  const now = Date.now();
  await env.DB.prepare(`
    UPDATE block_layouts
    SET draft_json = published_json,
        draft_revision = draft_revision + 1,
        updated_by = ?,
        updated_at = ?
    WHERE block_id = ?
  `).bind(gate.auth.user.id, now, blockId).run();

  return json({
    ok: true,
    blockId,
    revertedTo: 'published',
    block: verified.block,
    integrity: verified.integrity,
    requestId
  });
}


async function restoreBlockHistoryToDraft(request, env, url, requestId) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/restore-revision');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);

  const body = await readJson(request);
  const revision = Number(body?.revision);
  if (!Number.isInteger(revision) || revision < 1) {
    return json({ ok: false, error: 'A valid published revision is required' }, 400);
  }

  await ensureBlockEditorTables(env);
  const history = await env.DB.prepare(`
    SELECT id, block_id, revision, layout_json, published_at
    FROM block_layout_history
    WHERE block_id = ? AND revision = ?
    LIMIT 1
  `).bind(blockId, revision).first();

  if (!history?.layout_json) {
    return json({ ok: false, error: 'Published revision not found' }, 404);
  }

  const verified = await verifyHistoryBlockRecord(env, history, blockId);
  if (!verified.ok) {
    return json({ ok: false, error: `Published revision integrity failed: ${verified.reason}`, integrity: verified.integrity || null }, 409);
  }
  const block = verified.block;
  const canonicalJson = JSON.stringify(block);

  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO block_layouts (
      block_id, draft_json, draft_revision, published_json, published_revision,
      updated_by, updated_at, published_at
    ) VALUES (?, ?, 1, NULL, 0, ?, ?, NULL)
    ON CONFLICT(block_id) DO UPDATE SET
      draft_json = excluded.draft_json,
      draft_revision = block_layouts.draft_revision + 1,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).bind(blockId, canonicalJson, gate.auth.user.id, now).run();

  const row = await env.DB.prepare(`
    SELECT draft_revision FROM block_layouts WHERE block_id = ?
  `).bind(blockId).first();

  await writeAudit(env, gate.auth.user.id, 'block.history_restored', gate.auth.user.id, {
    blockId, sourceRevision: revision, draftRevision: Number(row?.draft_revision || 0)
  });

  return json({
    ok: true,
    blockId,
    restoredRevision: revision,
    draftRevision: Number(row?.draft_revision || 0),
    block,
    integrity: verified.integrity,
    requestId
  });
}

async function getBlockLayoutHistory(request, env, url) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;
  const blockId = blockIdFromPath(url.pathname, '/history');
  if (!blockId) return json({ ok: false, error: 'Invalid block id' }, 400);
  await ensureBlockEditorTables(env);

  const result = await env.DB.prepare(`
    SELECT h.revision, h.published_by, h.published_at,
           i.algorithm AS integrity_algorithm, i.sha256 AS integrity_sha256
    FROM block_layout_history h
    LEFT JOIN block_layout_history_integrity i ON i.history_id = h.id
    WHERE h.block_id = ?
    ORDER BY h.revision DESC
    LIMIT 25
  `).bind(blockId).all();

  return json({ ok: true, blockId, history: result.results || [] });
}

async function getSystemLogs(request, env, url) {
  // TEMPORARY: public dev-log access during early Ironvale V2 development.
  // Restore requireAdmin() before opening the game to other users.
  await ensureLogTable(env);

  const severity = (url.searchParams.get('severity') || '').toUpperCase();
  const resolved = url.searchParams.get('resolved');
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 100, 250));
  const clauses = [];
  const values = [];

  if (['INFO', 'WARNING', 'ERROR'].includes(severity)) {
    clauses.push('severity = ?');
    values.push(severity);
  }
  if (resolved === '0' || resolved === '1') {
    clauses.push('resolved = ?');
    values.push(Number(resolved));
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const query = `SELECT * FROM system_logs ${where} ORDER BY created_at DESC LIMIT ?`;
  values.push(limit);
  const result = await env.DB.prepare(query).bind(...values).all();
  return json({ ok: true, logs: result.results || [] });
}

async function resolveSystemLog(request, env, url) {
  // TEMPORARY: public dev-log access during early Ironvale V2 development.
  // Restore requireAdmin() before opening the game to other users.
  await ensureLogTable(env);
  const match = url.pathname.match(/^\/api\/admin\/logs\/([^/]+)\/resolve$/);
  if (!match) return json({ ok: false, error: 'Invalid log ID' }, 400);
  const id = decodeURIComponent(match[1]);
  await env.DB.prepare('UPDATE system_logs SET resolved = 1 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}


async function serveDeveloperBlockEditor(request, env) {
  const gate = await requireAdmin(request, env);
  if (gate.response) {
    const status = gate.response.status === 401 ? 401 : 403;
    return new Response(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Ironvale Developer Access</title>
<style>
html,body{height:100%;margin:0;background:#05090c;color:#eef8fa;font:700 16px system-ui}
main{height:100%;display:grid;place-items:center;padding:24px;box-sizing:border-box;text-align:center}
a{color:#63e6b1}
</style></head><body><main><div><h1>Developer access required</h1>
<p>This Ironvale authoring surface is restricted to developer/admin accounts.</p>
<a href="/">Return to Ironvale</a></div></main></body></html>`, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'same-origin'
      }
    });
  }

  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no">
  <meta name="theme-color" content="#061014">
  <meta name="robots" content="noindex,nofollow">
  <title>Ironvale — Block Editor</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="dev-block-editor-page">
  <main id="dev-block-editor-root" aria-label="Ironvale Block Editor">
    <div class="dev-editor-loading"><strong>BLOCK EDITOR</strong><span>Loading Commerce Street…</span></div>
  </main>
  <script type="module">
import { renderDeveloperBlockEditor, destroyBlockWorld } from '/editor/block-editor-entry.js';
const root=document.querySelector('#dev-block-editor-root');
async function boot(){
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!['admin','developer'].includes(data&&data.user&&data.user.role)){
    root.innerHTML='<section class="dev-editor-denied"><strong>Developer access required</strong><a href="/">Return to Ironvale</a></section>';
    return;
  }
  document.documentElement.classList.add('dev-block-editor-document');
  await renderDeveloperBlockEditor(root);
}
window.addEventListener('pagehide',()=>destroyBlockWorld(),{once:true});
boot().catch(error=>{
  console.error(error);
  root.innerHTML='<section class="dev-editor-denied"><strong>Block Editor failed to start</strong><a href="/">Return to Ironvale</a></section>';
});
</script>
</body>
</html>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'same-origin'
    }
  });
}

async function serveDeveloperAiBuilder(request, env) {
  // H1.78: this staging surface remains intentionally public during development.
  // It has no anonymous publish/load API. The only server mutation available to
  // the public builder is POST /api/ai-builder/drafts, which writes an immutable
  // review draft to D1 for a developer/admin to load later in normal Build Mode.
  return new Response(`<!doctype html>
<html lang="en" class="rift-ai-builder-document">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no">
  <meta name="theme-color" content="#04080b">
  <meta name="robots" content="noindex,nofollow">
  <title>Ironvale — Public AI Builder</title>
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/ai-builder.css">
  <link rel="alternate" type="application/json" href="/api/ai-builder/tools" title="Ironvale AI Builder tool manifest">
</head>
<body class="rift-ai-builder-page">
  <main id="dev-ai-builder-root" aria-label="Ironvale Public AI Builder">
    <div class="dev-editor-loading"><strong>AI BUILDER</strong><span>Loading public Rift Engine staging scene…</span></div>
  </main>
  <script type="module">
import { renderDeveloperAiBuilder, destroyDeveloperAiBuilder } from '/editor/ai-builder-entry.js';
const root=document.querySelector('#dev-ai-builder-root');
async function boot(){
  await renderDeveloperAiBuilder(root);
}
window.addEventListener('pagehide',()=>destroyDeveloperAiBuilder(),{once:true});
boot().catch(error=>{
  console.error(error);
  root.innerHTML='<section class="dev-editor-denied"><strong>AI Builder failed to start</strong><a href="/">Return to Ironvale</a></section>';
});
</script>
</body>
</html>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'same-origin'
    }
  });
}

async function requireAdmin(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return { response: json({ ok: false, error: 'Authentication required' }, 401) };
  if (!['admin', 'developer'].includes(auth.user.role)) {
    return { response: json({ ok: false, error: 'Admin or developer access required' }, 403) };
  }
  return { auth };
}

async function authenticate(request, env) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const now = Date.now();

  const row = await env.DB.prepare(`
    SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.id, u.username, u.role, u.created_at,
      u.last_active_at, u.is_banned, u.ban_reason
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?
  `).bind(tokenHash).first();

  if (!row) return null;
  if (row.expires_at <= now || row.is_banned) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }

  const lastActivityWrite = Math.max(Number(row.last_seen_at) || 0, Number(row.last_active_at) || 0);
  if (now - lastActivityWrite >= SESSION_ACTIVITY_WRITE_INTERVAL_MS) {
    await env.DB.batch([
      env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(now, row.session_id),
      env.DB.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').bind(now, row.id)
    ]);
  }
  // The request is active now even when the persistence write is intentionally
  // throttled. Keep response semantics current without spending two D1 writes
  // on every API invocation.
  row.last_active_at = now;
  return { user: row, sessionId: row.session_id };
}

async function createSession(env, request, userId) {
  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const rawToken = bytesToBase64Url(rawBytes);
  const tokenHash = await sha256(rawToken);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const sessionId = crypto.randomUUID();
  const userAgent = request.headers.get('User-Agent') || null;

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(sessionId, userId, tokenHash, now, expiresAt, now, userAgent).run();

  return { cookie: `${SESSION_COOKIE}=${rawToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}` };
}

function validateCredentials(username, password) {
  if (!username) return 'Username is required';
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return 'Username must be 3-20 characters using letters, numbers, or underscores';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password is too long';
  return null;
}

function normalizeUsername(value) { return typeof value === 'string' ? value.trim() : ''; }

async function hashPassword(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PASSWORD_ITERATIONS }, keyMaterial, 256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

async function readJson(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) return null;
  try { return await request.json(); } catch { return null; }
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

async function writeAudit(env, actorUserId, action, targetUserId, details) {
  await env.DB.prepare(`
    INSERT INTO audit_log (id, actor_user_id, action, target_user_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), actorUserId || null, action, targetUserId || null, JSON.stringify(details || {}), Date.now()).run();
}

async function ensureLogTable(env) {
  if (logSchemaEnsured) return;
  await env.DB.prepare(LOG_TABLE_SQL).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_system_logs_error_id ON system_logs(error_id)').run();
  logSchemaEnsured = true;
}

async function safeWriteSystemLog(env, entry) {
  try {
    await ensureLogTable(env);
    await env.DB.prepare(`
      INSERT INTO system_logs
        (id, error_id, severity, event_type, message, stack, route, method, request_id, user_id, context_json, resolved, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).bind(
      crypto.randomUUID(), entry.errorId || null, entry.severity || 'INFO', entry.eventType || 'SYSTEM',
      String(entry.message || '').slice(0, 2000), entry.stack ? String(entry.stack).slice(0, 8000) : null,
      entry.route || null, entry.method || null, entry.requestId || null, entry.userId || null,
      JSON.stringify(entry.context || {}), Date.now()
    ).run();
  } catch (logError) {
    console.error('Ironvale logger failed:', logError);
  }
}

function makeErrorId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `IV-${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
function safeErrorMessage(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
function safeStack(error) { return error instanceof Error && error.stack ? error.stack : null; }

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function bytesToBase64Url(bytes) { return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function bytesToHex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
