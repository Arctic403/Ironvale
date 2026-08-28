import { readFile } from 'node:fs/promises';

const files = {
  server: await readFile('src/index.js', 'utf8'),
  mcp: await readFile('src/ai-builder-mcp.js', 'utf8'),
  package: await readFile('package.json', 'utf8'),
  schema: await readFile('schema.sql', 'utf8'),
  entry: await readFile('public/editor/ai-builder-entry.js', 'utf8'),
  builder: await readFile('public/rift-ai-builder.js', 'utf8'),
  foundation: await readFile('public/downtown3d-foundation.js', 'utf8'),
  creative: await readFile('public/rift-creative-mode.js', 'utf8'),
  styles: await readFile('public/ai-builder.css', 'utf8'),
  appStyles: await readFile('public/styles.css', 'utf8')
};
const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`${label} missing '${text}'`); };

requireText(files.server, "/dev/ai-builder", 'server route');
requireText(files.server, 'serveDeveloperAiBuilder', 'server route');
requireText(files.server, "/api/ai-builder/tools", 'public tool manifest');
requireText(files.server, "/api/ai-builder/drafts", 'public D1 draft save');
requireText(files.server, 'handleAiBuilderMcpRequest', 'remote MCP route');
requireText(files.server, 'AI_BUILDER_MCP_PATH', 'remote MCP route');
requireText(files.server, 'remoteMcp', 'public MCP discovery metadata');
requireText(files.server, 'savePublicAiBuilderDraft', 'public D1 draft save');
requireText(files.server, 'listAdminAiBuilderDrafts', 'developer D1 inbox');
requireText(files.server, 'getAdminAiBuilderDraft', 'developer D1 inbox');
requireText(files.server, 'markAdminAiBuilderDraftLoaded', 'developer D1 inbox');
requireText(files.server, 'CREATE TABLE IF NOT EXISTS ai_builder_drafts', 'runtime D1 migration');
requireText(files.schema, 'CREATE TABLE IF NOT EXISTS ai_builder_drafts', 'schema D1 migration');
requireText(files.entry, 'renderDowntown3D', 'AI Builder entry');
requireText(files.entry, 'mountRiftAiBuilder', 'AI Builder entry');
requireText(files.foundation, 'setInspectionCamera', 'Rift Engine foundation');
requireText(files.foundation, 'captureCanvasPng', 'Rift Engine foundation');
requireText(files.foundation, 'AI DRAFT INBOX · DEV ONLY', 'normal Build Mode AI inbox');
requireText(files.creative, '/api/admin/ai-builder/drafts?limit=60', 'normal Build Mode D1 list');
requireText(files.creative, '/loaded', 'normal Build Mode D1 load acknowledgement');
requireText(files.builder, 'AI COMMAND', 'AI Builder UI');
requireText(files.builder, 'IMPORT TO STAGING', 'AI Builder UI');
requireText(files.builder, 'SAVE D1 DRAFT', 'AI Builder UI');
requireText(files.builder, 'CAPTURE CLEAN PNG', 'AI Builder UI');
requireText(files.builder, 'checkpoint', 'AI Builder staging');
requireText(files.builder, 'document.modelContext || navigator.modelContext', 'WebMCP compatibility bridge');
requireText(files.mcp, "createMcpHandler", 'Cloudflare Streamable HTTP MCP handler');
requireText(files.mcp, "@modelcontextprotocol/server", 'MCP SDK v2');
requireText(files.mcp, "route: AI_BUILDER_MCP_PATH", 'MCP /mcp route');
requireText(files.mcp, "responseMode: 'auto'", 'stateless MCP response mode');
requireText(files.mcp, "source, tool_version, created_at", 'MCP D1 draft append');
requireText(files.package, '"@modelcontextprotocol/server": "2.0.0"', 'MCP SDK dependency');
requireText(files.package, '"agents": "0.21.0"', 'Cloudflare Agents dependency');

const expectedTools = [
  'rift_scene_state', 'rift_inspect_object', 'rift_focus_object', 'rift_set_camera',
  'rift_move_object', 'rift_rotate_object', 'rift_duplicate_object', 'rift_delete_object',
  'rift_import_blueprint', 'rift_undo', 'rift_redo', 'rift_checkpoint', 'rift_capture_view',
  'rift_save_draft'
];
for (const tool of expectedTools) requireText(files.builder, `name: '${tool}'`, `WebMCP tool ${tool}`);
for (const tool of expectedTools) requireText(files.server, `name: '${tool}'`, `public manifest tool ${tool}`);

const expectedRemoteTools = [
  'rift_create_blueprint', 'rift_validate_blueprint', 'rift_scene_state', 'rift_inspect_object',
  'rift_move_object', 'rift_rotate_object', 'rift_duplicate_object', 'rift_delete_object',
  'rift_upsert_layout_object', 'rift_set_prefab', 'rift_delete_prefab', 'rift_apply_edits', 'rift_save_draft'
];
for (const tool of expectedRemoteTools) requireText(files.mcp, `registerTool('${tool}'`, `remote MCP tool ${tool}`);

const expectedCommands = ['scene', 'inspect', 'select', 'focus', 'camera', 'move', 'rotate', 'duplicate', 'delete', 'undo', 'redo', 'checkpoint', 'restore', 'capture', 'save', 'export'];
for (const command of expectedCommands) requireText(files.builder, `command === '${command}'`, `AI command ${command}`);

const aiRouteStart = files.server.indexOf('async function serveDeveloperAiBuilder');
const aiRouteEnd = files.server.indexOf('async function requireAdmin', aiRouteStart);
const aiRoute = files.server.slice(aiRouteStart, aiRouteEnd);
if (aiRoute.includes('requireAdmin(request, env)')) failures.push('Public AI Builder page must not require a RiftCity account.');
if (aiRoute.includes("fetch('/api/auth/me'")) failures.push('Public AI Builder bootstrap must not perform a session gate.');
if (!/Cache-Control': 'no-store'/.test(aiRoute)) failures.push('Public AI Builder page must stay no-store.');
if (/Cache-Control': 'no-store, private'/.test(aiRoute)) failures.push('Public AI Builder page must not use the old private cache directive.');
if (!/noindex,nofollow/.test(aiRoute)) failures.push('Public AI Builder page must remain non-indexable during development.');
if (/cutaway|hide roof|hide wall/i.test(files.builder)) failures.push('AI Builder must not reintroduce gameplay cutaway behavior.');
if (!/rift-ai-builder-page/.test(files.styles)) failures.push('AI Builder isolated page styles missing.');
if (!/rift-ai-draft-inbox/.test(files.appStyles)) failures.push('Normal Build Mode D1 inbox styles missing.');

if (failures.length) {
  console.error('RiftCity AI Builder regression failed:');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`RiftCity AI Builder regression passed: public no-account page + ${expectedTools.length} WebMCP tools + ${expectedRemoteTools.length} stateless remote MCP tools + D1-only AI draft handoff + developer Build Mode inbox.`);
