import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';
import { expandRiftCityBlueprintLayer, RIFT_CITY_BLUEPRINT_VERSION } from '../public/rift-city-blueprints.js';

export const AI_BUILDER_MCP_VERSION = 'H1.78';
export const AI_BUILDER_MCP_PATH = '/mcp';
export const AI_BUILDER_REMOTE_TOOL_NAMES = Object.freeze([
  'rift_create_blueprint',
  'rift_validate_blueprint',
  'rift_scene_state',
  'rift_inspect_object',
  'rift_move_object',
  'rift_rotate_object',
  'rift_duplicate_object',
  'rift_delete_object',
  'rift_upsert_layout_object',
  'rift_set_prefab',
  'rift_delete_prefab',
  'rift_apply_edits',
  'rift_save_draft'
]);

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const ROTATIONS = Object.freeze(['north', 'east', 'south', 'west']);
const DOCUMENT_JSON = z.string().min(2).max(MAX_DOCUMENT_BYTES);
const ID = z.string().min(1).max(160);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function parseJson(text, label = 'JSON') {
  const source = String(text ?? '');
  if (byteLength(source) > MAX_DOCUMENT_BYTES) throw new Error(`${label} exceeds the 2 MB AI Builder limit.`);
  try { return JSON.parse(source); }
  catch (error) { throw new Error(`${label} is invalid: ${error?.message || error}`); }
}

function asInteger(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) throw new Error(`${label} must be an integer.`);
  return number;
}

function asVec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} must contain exactly three coordinates.`);
  return value.map((item, index) => asInteger(item, `${label}[${index}]`));
}

function normalizedBounds(document) {
  const min = asVec3(document?.bounds?.min, 'bounds.min');
  const max = asVec3(document?.bounds?.max, 'bounds.max');
  for (let axis = 0; axis < 3; axis += 1) {
    if (min[axis] > max[axis]) throw new Error(`bounds.min[${axis}] exceeds bounds.max[${axis}].`);
  }
  return { min, max, size: max.map((value, axis) => value - min[axis] + 1) };
}

function assertDocumentShape(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Blueprint document must be a JSON object.');
  if (document.format !== 'riftcity-city-block') throw new Error("Blueprint format must be 'riftcity-city-block'.");
  const version = asInteger(document.version, 'version');
  if (version < 1 || version > 2) throw new Error('Blueprint version must be 1 or 2.');
  if (typeof document.id !== 'string' || !document.id.trim() || document.id.length > 160) throw new Error('Blueprint id is required and must be 160 characters or fewer.');
  if (document.units != null && document.units !== 'meters') throw new Error("Blueprint units must be 'meters'.");
  asVec3(document.origin, 'origin');
  const bounds = normalizedBounds(document);
  if (!document.palette || typeof document.palette !== 'object' || Array.isArray(document.palette)) throw new Error('Blueprint palette must be an object.');
  if (document.ops != null && !Array.isArray(document.ops)) throw new Error('Blueprint ops must be an array when present.');
  if (document.layout != null && !Array.isArray(document.layout)) throw new Error('Blueprint layout must be an array when present.');
  if (!Array.isArray(document.ops) && !Array.isArray(document.layout)) throw new Error('Blueprint must contain ops or layout.');
  if (document.prefabs != null && (!document.prefabs || typeof document.prefabs !== 'object' || Array.isArray(document.prefabs))) throw new Error('Blueprint prefabs must be an object when present.');
  return { version, bounds };
}

export function validateRemoteBlueprint(document) {
  const { version, bounds } = assertDocumentShape(document);
  const compiled = expandRiftCityBlueprintLayer(document, { bounds });
  return {
    ok: true,
    id: document.id,
    name: String(document.name || document.id),
    version,
    blueprintVersion: compiled.blueprintVersion,
    bounds,
    layoutObjects: Array.isArray(document.layout) ? document.layout.length : 0,
    compiledObjects: compiled.objects.length,
    anchors: compiled.anchors.length,
    prefabs: compiled.prefabCount,
    expandedOperations: compiled.expandedOperations,
    warnings: compiled.warnings,
    validation: compiled.validation
  };
}

function parseDocument(documentJson) {
  const document = parseJson(documentJson, 'document_json');
  validateRemoteBlueprint(document);
  return document;
}

function stringifyDocument(document) {
  const text = JSON.stringify(document);
  if (byteLength(text) > MAX_DOCUMENT_BYTES) throw new Error('Resulting Blueprint exceeds the 2 MB AI Builder limit.');
  return text;
}

function compile(document) {
  const bounds = normalizedBounds(document);
  return expandRiftCityBlueprintLayer(document, { bounds });
}

function topLevelObject(document, id) {
  const needle = String(id || '');
  return (Array.isArray(document.layout) ? document.layout : []).find(item => String(item?.id || '') === needle) || null;
}

function compiledObject(document, id) {
  const needle = String(id || '');
  return compile(document).objects.find(item => String(item?.id || '') === needle) || null;
}

function shiftVec(value, dx, dy, dz) {
  if (!Array.isArray(value) || value.length !== 3) return false;
  value[0] = Number(value[0]) + dx;
  value[1] = Number(value[1]) + dy;
  value[2] = Number(value[2]) + dz;
  return true;
}

function moveRawObject(object, dx, dy, dz) {
  if (shiftVec(object.origin, dx, dy, dz) || shiftVec(object.center, dx, dy, dz)) return;
  if (Array.isArray(object.from) && Array.isArray(object.to)) {
    shiftVec(object.from, dx, dy, dz);
    shiftVec(object.to, dx, dy, dz);
    return;
  }
  throw new Error(`Object '${object.id}' has no movable origin/center/from-to coordinates.`);
}

function nextRotation(current, requested) {
  const raw = String(requested || '').toLowerCase();
  const currentIndex = ROTATIONS.indexOf(String(current || 'north').toLowerCase());
  if (['cw', 'right', '+1'].includes(raw)) return ROTATIONS[(Math.max(0, currentIndex) + 1) % 4];
  if (['ccw', 'left', '-1'].includes(raw)) return ROTATIONS[(Math.max(0, currentIndex) + 3) % 4];
  if (!ROTATIONS.includes(raw)) throw new Error('rotation must be north/east/south/west/cw/ccw.');
  return raw;
}

function ensureTopLevel(document, id) {
  const object = topLevelObject(document, id);
  if (!object) throw new Error(`'${id}' is not a top-level editable layout object.`);
  return object;
}

function mutateDocument(documentJson, mutator) {
  const document = parseDocument(documentJson);
  mutator(document);
  const validation = validateRemoteBlueprint(document);
  return { document_json: stringifyDocument(document), validation };
}

function moveDocument(documentJson, id, dx, dy, dz) {
  return mutateDocument(documentJson, document => {
    const object = ensureTopLevel(document, id);
    moveRawObject(object, asInteger(dx, 'dx'), asInteger(dy, 'dy'), asInteger(dz, 'dz'));
  });
}

function rotateDocument(documentJson, id, rotation) {
  return mutateDocument(documentJson, document => {
    const object = ensureTopLevel(document, id);
    object.rotation = nextRotation(object.rotation, rotation);
  });
}

function duplicateDocument(documentJson, id, requestedId = '', offset = [2, 0, 2]) {
  return mutateDocument(documentJson, document => {
    const layout = Array.isArray(document.layout) ? document.layout : (document.layout = []);
    const source = ensureTopLevel(document, id);
    const copy = clone(source);
    const cleanRequested = String(requestedId || '').trim();
    if (cleanRequested) {
      if (layout.some(item => String(item?.id || '') === cleanRequested)) throw new Error(`Layout object '${cleanRequested}' already exists.`);
      copy.id = cleanRequested;
    } else {
      let suffix = 2;
      while (layout.some(item => String(item?.id || '') === `${id}-${suffix}`)) suffix += 1;
      copy.id = `${id}-${suffix}`;
    }
    const [dx, dy, dz] = asVec3(offset, 'offset');
    try { moveRawObject(copy, dx, dy, dz); } catch (_) {}
    layout.push(copy);
  });
}

function deleteDocumentObject(documentJson, id) {
  return mutateDocument(documentJson, document => {
    const layout = Array.isArray(document.layout) ? document.layout : [];
    const index = layout.findIndex(item => String(item?.id || '') === String(id));
    if (index < 0) throw new Error(`'${id}' is not a top-level editable layout object.`);
    layout.splice(index, 1);
  });
}

function upsertLayoutObject(documentJson, objectJson) {
  const object = parseJson(objectJson, 'object_json');
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error('object_json must contain one layout object.');
  const id = String(object.id || '').trim();
  if (!id) throw new Error('Layout object id is required.');
  return mutateDocument(documentJson, document => {
    const layout = Array.isArray(document.layout) ? document.layout : (document.layout = []);
    const index = layout.findIndex(item => String(item?.id || '') === id);
    if (index >= 0) layout[index] = object;
    else layout.push(object);
  });
}

function setPrefab(documentJson, name, prefabJson) {
  const prefabName = String(name || '').trim();
  if (!prefabName) throw new Error('Prefab name is required.');
  const prefab = parseJson(prefabJson, 'prefab_json');
  if (!prefab || typeof prefab !== 'object' || Array.isArray(prefab)) throw new Error('prefab_json must contain one prefab object.');
  return mutateDocument(documentJson, document => {
    if (!document.prefabs || typeof document.prefabs !== 'object' || Array.isArray(document.prefabs)) document.prefabs = {};
    document.prefabs[prefabName] = prefab;
  });
}

function deletePrefab(documentJson, name) {
  const prefabName = String(name || '').trim();
  return mutateDocument(documentJson, document => {
    if (!document.prefabs || !Object.prototype.hasOwnProperty.call(document.prefabs, prefabName)) throw new Error(`Prefab '${prefabName}' does not exist.`);
    delete document.prefabs[prefabName];
  });
}

function applyEdits(documentJson, editsJson) {
  const edits = parseJson(editsJson, 'edits_json');
  if (!Array.isArray(edits)) throw new Error('edits_json must be an array.');
  if (edits.length > 250) throw new Error('rift_apply_edits accepts at most 250 edits per call.');
  return mutateDocument(documentJson, document => {
    for (const [index, edit] of edits.entries()) {
      if (!edit || typeof edit !== 'object' || Array.isArray(edit)) throw new Error(`edits[${index}] must be an object.`);
      const action = String(edit.action || '').toLowerCase();
      if (action === 'move') {
        moveRawObject(ensureTopLevel(document, edit.id), asInteger(edit.dx ?? 0, `edits[${index}].dx`), asInteger(edit.dy ?? 0, `edits[${index}].dy`), asInteger(edit.dz ?? 0, `edits[${index}].dz`));
      } else if (action === 'rotate') {
        const object = ensureTopLevel(document, edit.id);
        object.rotation = nextRotation(object.rotation, edit.rotation);
      } else if (action === 'delete') {
        const layout = Array.isArray(document.layout) ? document.layout : [];
        const itemIndex = layout.findIndex(item => String(item?.id || '') === String(edit.id || ''));
        if (itemIndex < 0) throw new Error(`edits[${index}] unknown top-level object '${edit.id}'.`);
        layout.splice(itemIndex, 1);
      } else if (action === 'upsert_layout') {
        const object = edit.object;
        if (!object || typeof object !== 'object' || Array.isArray(object) || !String(object.id || '').trim()) throw new Error(`edits[${index}].object requires an id.`);
        const layout = Array.isArray(document.layout) ? document.layout : (document.layout = []);
        const itemIndex = layout.findIndex(item => String(item?.id || '') === String(object.id));
        if (itemIndex >= 0) layout[itemIndex] = clone(object); else layout.push(clone(object));
      } else if (action === 'set_prefab') {
        const name = String(edit.name || '').trim();
        if (!name || !edit.prefab || typeof edit.prefab !== 'object' || Array.isArray(edit.prefab)) throw new Error(`edits[${index}] requires prefab name/object.`);
        if (!document.prefabs || typeof document.prefabs !== 'object' || Array.isArray(document.prefabs)) document.prefabs = {};
        document.prefabs[name] = clone(edit.prefab);
      } else if (action === 'delete_prefab') {
        const name = String(edit.name || '').trim();
        if (!document.prefabs || !Object.prototype.hasOwnProperty.call(document.prefabs, name)) throw new Error(`edits[${index}] unknown prefab '${name}'.`);
        delete document.prefabs[name];
      } else {
        throw new Error(`edits[${index}].action '${action}' is unsupported.`);
      }
    }
  });
}

function sceneState(document) {
  const validation = validateRemoteBlueprint(document);
  const compiled = compile(document);
  return {
    ...validation,
    objects: compiled.objects.map(object => ({
      id: object.id,
      type: object.type,
      prefab: object.prefab || null,
      group: object.group || null,
      tags: object.tags || [],
      origin: object.origin || null,
      rotation: object.rotation || null,
      bounds: object.bounds,
      parentId: object.parentId || null,
      rootId: object.rootId || null,
      editable: !!topLevelObject(document, object.id)
    })),
    anchors: compiled.anchors,
    groups: compiled.groups,
    connections: compiled.connections
  };
}

function inspectObject(document, id) {
  const object = compiledObject(document, id);
  if (!object) throw new Error(`Unknown Blueprint object '${id}'.`);
  return {
    id: object.id,
    type: object.type,
    prefab: object.prefab || null,
    group: object.group || null,
    tags: object.tags || [],
    origin: object.origin || null,
    localOrigin: object.localOrigin || null,
    rotation: object.rotation || null,
    bounds: object.bounds,
    parentId: object.parentId || null,
    rootId: object.rootId || null,
    editable: !!topLevelObject(document, object.id),
    raw: topLevelObject(document, object.id)
  };
}

function createBlueprint({ id, name, min_x, min_y, min_z, max_x, max_y, max_z, palette_json }) {
  const min = [asInteger(min_x, 'min_x'), asInteger(min_y, 'min_y'), asInteger(min_z, 'min_z')];
  const max = [asInteger(max_x, 'max_x'), asInteger(max_y, 'max_y'), asInteger(max_z, 'max_z')];
  const palette = palette_json ? parseJson(palette_json, 'palette_json') : {};
  const document = {
    format: 'riftcity-city-block',
    version: 2,
    blueprint_version: RIFT_CITY_BLUEPRINT_VERSION,
    id: String(id).trim(),
    name: String(name || id).trim(),
    units: 'meters',
    origin: [0, 0, 0],
    bounds: { min, max },
    palette,
    prefabs: {},
    layout: [],
    anchors: {},
    groups: {},
    connections: [],
    validation: { overlap_policy: 'error' }
  };
  const validation = validateRemoteBlueprint(document);
  return { document_json: stringifyDocument(document), validation };
}

async function sha256(text) {
  const data = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function ensureDraftTable(env) {
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

async function saveDraft(env, documentJson, requestedName = '') {
  const document = parseDocument(documentJson);
  const compact = stringifyDocument(document);
  await ensureDraftTable(env);
  const id = crypto.randomUUID();
  const now = Date.now();
  const documentId = String(document.id).trim().slice(0, 160);
  const name = (String(requestedName || '').trim() || String(document.name || documentId || 'RiftCity AI Draft')).slice(0, 160);
  const digest = await sha256(compact);
  await env.DB.prepare(`
    INSERT INTO ai_builder_drafts (id, document_id, name, draft_json, sha256, source, tool_version, created_at)
    VALUES (?, ?, ?, ?, ?, 'public-ai-builder-mcp', ?, ?)
  `).bind(id, documentId, name, compact, digest, AI_BUILDER_MCP_VERSION, now).run();
  return {
    ok: true,
    draftId: id,
    documentId,
    name,
    sha256: digest,
    bytes: byteLength(compact),
    savedAt: now,
    persistence: 'D1 review inbox only',
    publishAccess: false,
    loadAccess: false
  };
}

function toolResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function toolError(error) {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ ok: false, error: String(error?.message || error) }) }] };
}

function guarded(handler) {
  return async args => {
    try { return toolResult(await handler(args)); }
    catch (error) { return toolError(error); }
  };
}

export function createAiBuilderMcpServer(env) {
  const server = new McpServer({ name: 'riftcity-ai-builder', version: AI_BUILDER_MCP_VERSION });
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
  const writeOnlyStaging = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };

  server.registerTool('rift_create_blueprint', {
    description: 'Create a blank RiftCity Blueprint v2 document. Returns document_json; nothing is persisted.',
    inputSchema: {
      id: ID,
      name: z.string().max(160).optional(),
      min_x: z.number().int(), min_y: z.number().int(), min_z: z.number().int(),
      max_x: z.number().int(), max_y: z.number().int(), max_z: z.number().int(),
      palette_json: z.string().optional()
    }, annotations: writeOnlyStaging
  }, guarded(createBlueprint));

  server.registerTool('rift_validate_blueprint', {
    description: 'Validate a RiftCity Blueprint with the same prefab/layout/road/intersection overlap compiler used by Rift Engine. Nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON }, annotations: readOnly
  }, guarded(({ document_json }) => validateRemoteBlueprint(parseJson(document_json, 'document_json'))));

  server.registerTool('rift_scene_state', {
    description: 'Inspect a complete RiftCity Blueprint document and return compiled top-level/nested objects, anchors, groups, connections and validation stats. Nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON }, annotations: readOnly
  }, guarded(({ document_json }) => sceneState(parseDocument(document_json))));

  server.registerTool('rift_inspect_object', {
    description: 'Inspect one compiled RiftCity Blueprint object by exact id. Nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON, id: ID }, annotations: readOnly
  }, guarded(({ document_json, id }) => inspectObject(parseDocument(document_json), id)));

  server.registerTool('rift_move_object', {
    description: 'Move a top-level RiftCity Blueprint layout object by integer meter-grid deltas. Returns a new document_json; nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON, id: ID, dx: z.number().int(), dy: z.number().int(), dz: z.number().int() }, annotations: writeOnlyStaging
  }, guarded(({ document_json, id, dx, dy, dz }) => moveDocument(document_json, id, dx, dy, dz)));

  server.registerTool('rift_rotate_object', {
    description: 'Rotate a top-level RiftCity Blueprint object north/east/south/west or cw/ccw. Returns a new document_json; nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON, id: ID, rotation: z.enum(['north', 'east', 'south', 'west', 'cw', 'ccw']) }, annotations: writeOnlyStaging
  }, guarded(({ document_json, id, rotation }) => rotateDocument(document_json, id, rotation)));

  server.registerTool('rift_duplicate_object', {
    description: 'Duplicate a top-level RiftCity Blueprint object, optionally choosing the new id and meter-grid offset. Returns a new document_json; nothing is persisted.',
    inputSchema: {
      document_json: DOCUMENT_JSON, id: ID, new_id: z.string().max(160).optional(),
      offset_x: z.number().int().optional(), offset_y: z.number().int().optional(), offset_z: z.number().int().optional()
    }, annotations: writeOnlyStaging
  }, guarded(({ document_json, id, new_id, offset_x, offset_y, offset_z }) => duplicateDocument(document_json, id, new_id || '', [offset_x ?? 2, offset_y ?? 0, offset_z ?? 2])));

  server.registerTool('rift_delete_object', {
    description: 'Delete a top-level RiftCity Blueprint layout object. Returns a new document_json; nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON, id: ID }, annotations: writeOnlyStaging
  }, guarded(({ document_json, id }) => deleteDocumentObject(document_json, id)));

  server.registerTool('rift_upsert_layout_object', {
    description: 'Add or replace one top-level Blueprint layout object using object_json. Returns a compiler-validated document_json; nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON, object_json: z.string().min(2).max(300_000) }, annotations: writeOnlyStaging
  }, guarded(({ document_json, object_json }) => upsertLayoutObject(document_json, object_json)));

  server.registerTool('rift_set_prefab', {
    description: 'Add or replace one named Blueprint prefab. Returns a compiler-validated document_json; nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON, name: ID, prefab_json: z.string().min(2).max(500_000) }, annotations: writeOnlyStaging
  }, guarded(({ document_json, name, prefab_json }) => setPrefab(document_json, name, prefab_json)));

  server.registerTool('rift_delete_prefab', {
    description: 'Delete one named Blueprint prefab if the resulting document still validates. Returns a new document_json; nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON, name: ID }, annotations: writeOnlyStaging
  }, guarded(({ document_json, name }) => deletePrefab(document_json, name)));

  server.registerTool('rift_apply_edits', {
    description: 'Apply up to 250 Blueprint edits in one compiler-validated operation. edits_json supports move, rotate, delete, upsert_layout, set_prefab and delete_prefab. Returns document_json; nothing is persisted.',
    inputSchema: { document_json: DOCUMENT_JSON, edits_json: z.string().min(2).max(1_000_000) }, annotations: writeOnlyStaging
  }, guarded(({ document_json, edits_json }) => applyEdits(document_json, edits_json)));

  server.registerTool('rift_save_draft', {
    description: 'The only remote persistence tool. Validate the supplied Blueprint and append it to the D1 AI review inbox. It cannot load or publish the draft.',
    inputSchema: { document_json: DOCUMENT_JSON, name: z.string().max(160).optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
  }, guarded(({ document_json, name }) => saveDraft(env, document_json, name || '')));

  return server;
}

export function handleAiBuilderMcpRequest(request, env, ctx) {
  const handler = createMcpHandler(() => createAiBuilderMcpServer(env), {
    route: AI_BUILDER_MCP_PATH,
    responseMode: 'auto'
  });
  return handler(request, env, ctx);
}
