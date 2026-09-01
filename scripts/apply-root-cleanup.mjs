import fs from 'node:fs';

const appPath = new URL('../public/app.js', import.meta.url);
let app = fs.readFileSync(appPath, 'utf8');

const badCapsule = `      const c = (ring + 1) * radial + side;\n      const d = c + 1;\n      indices.push(a, c, b, b, c, d);`;
const fixedCapsule = `      const c = (ring + 1) * radial + side;\n      const d = (ring + 1) * radial + next;\n      indices.push(a, c, b, b, c, d);`;

if (app.includes(badCapsule)) {
  app = app.replace(badCapsule, fixedCapsule);
} else if (!app.includes(fixedCapsule)) {
  throw new Error('Expected fallback capsule seam source was not found.');
}

const historyAnchor = `const undoStack = [];\nconst redoStack = [];\n`;
const historyMarker = `const IRONVALE_EDITOR_HISTORY_FORMAT = 'ironvale-editor-history-runtime-v1';`;
const historyApi = `${historyAnchor}\nconst IRONVALE_EDITOR_HISTORY_FORMAT = 'ironvale-editor-history-runtime-v1';\nconst IRONVALE_EDITOR_HISTORY_SNAPSHOT_FORMAT = 'ironvale-editor-history-snapshot-v1';\nconst editorHistorySnapshots = new Map();\nlet editorHistorySnapshotSequence = 0;\n\nfunction editorHistoryStatus() {\n  return {\n    format: IRONVALE_EDITOR_HISTORY_FORMAT,\n    undoDepth: undoStack.length,\n    redoDepth: redoStack.length,\n    retainedSnapshots: editorHistorySnapshots.size\n  };\n}\n\nfunction captureEditorHistory(label = 'external') {\n  const token = \`history-\${Date.now().toString(36)}-\${(++editorHistorySnapshotSequence).toString(36)}\`;\n  editorHistorySnapshots.set(token, {\n    undo: undoStack.slice(),\n    redo: redoStack.slice(),\n    label: String(label || 'external').slice(0, 80),\n    createdAt: new Date().toISOString()\n  });\n  while (editorHistorySnapshots.size > 4) {\n    const oldest = editorHistorySnapshots.keys().next().value;\n    editorHistorySnapshots.delete(oldest);\n  }\n  return {\n    format: IRONVALE_EDITOR_HISTORY_SNAPSHOT_FORMAT,\n    token,\n    label: String(label || 'external').slice(0, 80),\n    undoDepth: undoStack.length,\n    redoDepth: redoStack.length\n  };\n}\n\nfunction restoreEditorHistory(snapshotOrToken) {\n  const token = typeof snapshotOrToken === 'string' ? snapshotOrToken : snapshotOrToken?.token;\n  const snapshot = token ? editorHistorySnapshots.get(token) : null;\n  if (!snapshot) return { ok: false, error: 'history-snapshot-not-found', ...editorHistoryStatus() };\n  undoStack.length = 0;\n  redoStack.length = 0;\n  if (snapshot.undo.length) undoStack.push(...snapshot.undo);\n  if (snapshot.redo.length) redoStack.push(...snapshot.redo);\n  editorHistorySnapshots.delete(token);\n  return { ok: true, token, ...editorHistoryStatus() };\n}\n\nfunction discardEditorHistory(snapshotOrToken) {\n  const token = typeof snapshotOrToken === 'string' ? snapshotOrToken : snapshotOrToken?.token;\n  return Boolean(token && editorHistorySnapshots.delete(token));\n}\n\nwindow.IronvaleEditorHistory = Object.freeze({\n  format: IRONVALE_EDITOR_HISTORY_FORMAT,\n  capture: captureEditorHistory,\n  restore: restoreEditorHistory,\n  discard: discardEditorHistory,\n  status: editorHistoryStatus\n});\n`;

if (!app.includes(historyMarker)) {
  if (!app.includes(historyAnchor)) throw new Error('Undo/redo history anchor was not found.');
  app = app.replace(historyAnchor, historyApi);
}

if (app.includes('const d = c + 1;') && app.indexOf('function createCapsuleGeometry()') < app.indexOf('const d = c + 1;', app.indexOf('function createCapsuleGeometry()'))) {
  const capsuleStart = app.indexOf('function createCapsuleGeometry()');
  const capsuleEnd = app.indexOf('\nfunction normalize3', capsuleStart);
  const capsule = app.slice(capsuleStart, capsuleEnd);
  if (capsule.includes('const d = c + 1;')) throw new Error('Fallback capsule still contains an unwrapped d index.');
}

fs.writeFileSync(appPath, app);
console.log('Patched fallback capsule source and installed explicit editor history runtime API.');
