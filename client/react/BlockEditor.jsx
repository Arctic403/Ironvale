import React from 'react';

export function BlockEditor() {
  return (
    <aside className="bw-editor" id="bw-editor" aria-hidden="true">
      <header className="bw-editor-head">
        <div className="bw-editor-title">
          <strong>BLOCK EDITOR</strong>
          <small id="bw-editor-selection">Tap an object</small>
          <small id="bw-editor-server-status" className="bw-editor-server-status">SERVER · loading…</small>
        </div>
        <div className="bw-editor-head-actions">
          <button id="bw-editor-minimize" type="button" aria-label="Hide editor panel">—</button>
          <button id="bw-editor-close" type="button" aria-label="Return to play mode">×</button>
        </div>
      </header>

      <div className="bw-editor-mainrow">
        <label className="bw-editor-object-row">
          <span>EDIT</span>
          <select id="bw-editor-object" aria-label="Selected editor object" />
        </label>

        <div className="bw-editor-transform-grid" aria-label="Transform">
          <label>X<input id="bw-editor-x" inputMode="numeric" type="number" step="5" /></label>
          <label>Y<input id="bw-editor-y" inputMode="numeric" type="number" step="5" /></label>
          <label>W<input id="bw-editor-w" inputMode="numeric" type="number" step="5" /></label>
          <label>H<input id="bw-editor-h" inputMode="numeric" type="number" step="5" /></label>
        </div>

        <div className="bw-editor-quickbar">
          <button type="button" id="bw-editor-undo" title="Undo" aria-label="Undo">↶</button>
          <button type="button" id="bw-editor-redo" title="Redo" aria-label="Redo">↷</button>
          <label className="bw-editor-snap-compact">
            <span>SNAP</span>
            <select id="bw-editor-snap" defaultValue="10" aria-label="Snap size">
              <option value="1">OFF</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
            </select>
          </label>
          <button type="button" id="bw-editor-export">PUBLISH</button>
        </div>
      </div>

      <details className="bw-editor-more">
        <summary>MORE TOOLS</summary>
        <div className="bw-editor-more-grid">
          <div className="bw-editor-actions">
            <button type="button" id="bw-editor-duplicate">DUPLICATE</button>
            <button type="button" id="bw-editor-delete">DELETE</button>
            <button type="button" id="bw-editor-revert-draft">REVERT DRAFT</button>
            <button type="button" id="bw-editor-local-export">EXPORT JSON</button>
          </div>

          <div className="bw-editor-add-prop">
            <select id="bw-editor-prop-kind" defaultValue="tree" aria-label="Prop type">
              <option>tree</option><option>lamp</option><option>bench</option><option>hydrant</option>
              <option>box</option><option>news</option><option>car</option><option>van</option>
            </select>
            <button type="button" id="bw-editor-add-prop">ADD PROP</button>
          </div>

          <div className="bw-asset-panel">
            <label className="bw-asset-import">ASSET JSON<input id="bw-asset-file" type="file" accept="application/json,.json" /></label>
            <div id="bw-asset-status">Optional asset library.</div>
            <select id="bw-editor-asset" defaultValue="" aria-label="Building asset"><option value="">No asset</option></select>
            <div className="bw-editor-actions">
              <button type="button" id="bw-asset-apply">ASSIGN</button>
              <button type="button" id="bw-asset-clear">CLEAR</button>
            </div>
          </div>

          <button type="button" className="bw-editor-danger" id="bw-editor-reset">RESET BLOCK</button>
        </div>
      </details>
    </aside>
  );
}
