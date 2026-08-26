import React from 'react';

export function BlockEditor() {
  return (
    <aside className="bw-editor" id="bw-editor" aria-hidden="true">
      <header className="bw-editor-head">
        <div>
          <strong>BLOCK EDITOR</strong>
          <small id="bw-editor-selection">Tap an object in the scene</small>
        </div>
        <div className="bw-editor-head-actions">
          <button id="bw-editor-minimize" type="button" aria-label="Minimize editor">—</button>
          <button id="bw-editor-close" type="button" aria-label="Close editor">×</button>
        </div>
      </header>

      <div className="bw-editor-quickbar bw-editor-compactbar">
        <button type="button" id="bw-editor-undo" title="Undo" aria-label="Undo">↶</button>
        <button type="button" id="bw-editor-redo" title="Redo" aria-label="Redo">↷</button>
        <label className="bw-editor-snap-compact">
          <span>SNAP</span>
          <select id="bw-editor-snap" defaultValue="10">
            <option value="1">OFF</option>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="25">25</option>
          </select>
        </label>
        <button type="button" id="bw-editor-export">SAVE</button>
      </div>

      <div className="bw-editor-body">
        <div className="bw-editor-primary-row">
          <label className="bw-editor-object-row">
            <span>EDIT</span>
            <select id="bw-editor-object" />
          </label>

          <div className="bw-editor-grid bw-editor-transform-grid" aria-label="Transform">
            <label>X<input id="bw-editor-x" inputMode="numeric" type="number" step="5" /></label>
            <label>Y<input id="bw-editor-y" inputMode="numeric" type="number" step="5" /></label>
            <label>W<input id="bw-editor-w" inputMode="numeric" type="number" step="5" /></label>
            <label>H<input id="bw-editor-h" inputMode="numeric" type="number" step="5" /></label>
          </div>
        </div>

        <details className="bw-editor-section">
          <summary>OBJECT ACTIONS</summary>
          <div className="bw-editor-actions">
            <button type="button" id="bw-editor-duplicate">DUPLICATE</button>
            <button type="button" id="bw-editor-delete">DELETE</button>
          </div>
        </details>

        <details className="bw-editor-section">
          <summary>ADD PROP</summary>
          <label>
            PROP
            <select id="bw-editor-prop-kind" defaultValue="tree">
              <option>tree</option>
              <option>lamp</option>
              <option>bench</option>
              <option>hydrant</option>
              <option>box</option>
              <option>news</option>
              <option>car</option>
              <option>van</option>
            </select>
          </label>
          <button type="button" id="bw-editor-add-prop">ADD AT PLAYER</button>
        </details>

        <details className="bw-editor-section">
          <summary>LEGACY ASSET LAB</summary>
          <div className="bw-asset-panel">
            <label className="bw-asset-import">
              Import asset JSON
              <input id="bw-asset-file" type="file" accept="application/json,.json" />
            </label>
            <div id="bw-asset-status">Optional per-building art library.</div>
            <label>
              Asset
              <select id="bw-editor-asset" defaultValue="">
                <option value="">No asset</option>
              </select>
            </label>
            <div className="bw-editor-actions">
              <button type="button" id="bw-asset-apply">ASSIGN</button>
              <button type="button" id="bw-asset-clear">CLEAR</button>
            </div>
          </div>
        </details>

        <button type="button" className="bw-editor-danger" id="bw-editor-reset">RESET BLOCK</button>
        <small className="bw-editor-help">
          Drag the selected box to move it. Drag an edge handle to resize that edge; drag a corner
          to resize two edges. Mouse/trackpad uses the same gizmos. Keyboard: arrows nudge,
          Shift = faster, Delete removes, Ctrl/Cmd+Z undo, Ctrl/Cmd+Y redo, E toggles editor.
        </small>
      </div>
    </aside>
  );
}
