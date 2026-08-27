import { renderBlockWorld, destroyBlockWorld } from '../views/block-world.js';
import { mountBlockEditor } from './block-editor-ui.js';

export async function renderDeveloperBlockEditor(root, options={}) {
  return renderBlockWorld(root, {
    ...options,
    editorWorkspace: true,
    mountEditorUi: mountBlockEditor
  });
}

export { destroyBlockWorld };
