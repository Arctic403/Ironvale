import { readFile } from 'node:fs/promises';

const files = {
  server: await readFile('src/index.js', 'utf8'),
  entry: await readFile('public/editor/ai-builder-entry.js', 'utf8'),
  builder: await readFile('public/rift-ai-builder.js', 'utf8'),
  foundation: await readFile('public/downtown3d-foundation.js', 'utf8'),
  styles: await readFile('public/ai-builder.css', 'utf8')
};
const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`${label} missing '${text}'`); };

requireText(files.server, "/dev/ai-builder", 'server route');
requireText(files.server, 'serveDeveloperAiBuilder', 'server route');
requireText(files.server, 'requireAdmin(request, env)', 'server gate');
requireText(files.entry, 'renderDowntown3D', 'AI Builder entry');
requireText(files.entry, 'mountRiftAiBuilder', 'AI Builder entry');
requireText(files.foundation, 'setInspectionCamera', 'Rift Engine foundation');
requireText(files.foundation, 'captureCanvasPng', 'Rift Engine foundation');
requireText(files.builder, 'AI COMMAND', 'AI Builder UI');
requireText(files.builder, 'IMPORT TO STAGING', 'AI Builder UI');
requireText(files.builder, 'CAPTURE CLEAN PNG', 'AI Builder UI');
requireText(files.builder, 'checkpoint', 'AI Builder staging');
requireText(files.builder, 'document.modelContext?.registerTool', 'WebMCP progressive enhancement');

const expectedTools = [
  'rift_scene_state', 'rift_inspect_object', 'rift_focus_object', 'rift_set_camera',
  'rift_move_object', 'rift_rotate_object', 'rift_duplicate_object', 'rift_delete_object',
  'rift_import_blueprint', 'rift_undo', 'rift_redo', 'rift_checkpoint', 'rift_capture_view'
];
for (const tool of expectedTools) requireText(files.builder, `name: '${tool}'`, `WebMCP tool ${tool}`);

const expectedCommands = ['scene', 'inspect', 'select', 'focus', 'camera', 'move', 'rotate', 'duplicate', 'delete', 'undo', 'redo', 'checkpoint', 'restore', 'capture', 'export'];
for (const command of expectedCommands) requireText(files.builder, `command === '${command}'`, `AI command ${command}`);

if (/cutaway|hide roof|hide wall/i.test(files.builder)) failures.push('AI Builder must not reintroduce gameplay cutaway behavior.');
if (!/noindex,nofollow/.test(files.server)) failures.push('AI Builder developer page must remain non-indexable.');
if (!/Cache-Control': 'no-store, private'/.test(files.server)) failures.push('AI Builder developer page must be private/no-store.');
if (!/rift-ai-builder-page/.test(files.styles)) failures.push('AI Builder isolated page styles missing.');

if (failures.length) {
  console.error('RiftCity AI Builder regression failed:');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`RiftCity AI Builder regression passed: protected page + ${expectedTools.length} WebMCP tools + deterministic command surface + clean canvas capture.`);
