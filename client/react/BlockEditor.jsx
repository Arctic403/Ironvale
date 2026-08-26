import React from 'react';

function PanelHeader({ title, panel }) {
  return (
    <header className="bw-studio-panel-head">
      <strong>{title}</strong>
      <button type="button" data-panel-collapse={panel} aria-label={`Collapse ${title}`}>⌃</button>
    </header>
  );
}

export function BlockEditor() {
  return (
    <aside className="bw-editor bw-editor-studio" id="bw-editor" aria-hidden="true">
      <header className="bw-studio-topbar">
        <div className="bw-editor-title">
          <strong>BLOCK EDITOR</strong>
          <small>DOWNTOWN / BLOCK 01 · Commerce Street</small>
        </div>
        <div className="bw-studio-status">
          <small id="bw-editor-server-status" className="bw-editor-server-status">SERVER · loading…</small>
          <small id="bw-editor-selection">Tap an object</small>
        </div>
        <div className="bw-editor-head-actions">
          <button type="button" id="bw-editor-export" className="bw-studio-publish">PUBLISH</button>
          <button id="bw-editor-minimize" type="button" aria-label="Hide editor panels">HIDE</button>
          <button id="bw-editor-close" type="button" aria-label="Hide editor panels">×</button>
        </div>
      </header>

      <section className="bw-studio-transform" data-editor-panel="transform">
        <button className="bw-panel-collapse bw-transform-collapse" type="button" data-panel-collapse="transform" aria-label="Collapse transform bar">⌃</button>
        <label className="bw-editor-object-row">
          <span>OBJECT</span>
          <select id="bw-editor-object" aria-label="Selected editor object" />
        </label>

        <div className="bw-editor-transform-grid" aria-label="Transform">
          <label>X<input id="bw-editor-x" inputMode="numeric" type="number" step="5" /></label>
          <label>Y<input id="bw-editor-y" inputMode="numeric" type="number" step="5" /></label>
          <label>W<input id="bw-editor-w" inputMode="numeric" type="number" step="5" /></label>
          <label>H<input id="bw-editor-h" inputMode="numeric" type="number" step="5" /></label>
        </div>

        <label className="bw-editor-snap-compact">
          <span>SNAP</span>
          <select id="bw-editor-snap" defaultValue="10" aria-label="Snap size">
            <option value="1">OFF</option>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="25">25</option>
          </select>
        </label>

        <div className="bw-editor-quickbar">
          <button type="button" id="bw-editor-undo" title="Undo" aria-label="Undo">↶</button>
          <button type="button" id="bw-editor-redo" title="Redo" aria-label="Redo">↷</button>
        </div>
      </section>

      <section className="bw-studio-panel bw-studio-left" data-editor-panel="palette">
        <PanelHeader title="ADD OBJECT" panel="palette" />
        <div className="bw-studio-panel-body">
          <div className="bw-editor-create-grid">
            <button type="button" data-bw-add-object="alley">▣ <span>Alley Entrance</span></button>
            <button type="button" data-bw-add-object="door">▤ <span>Door / Entrance</span></button>
            <button type="button" data-bw-add-object="exit">⇥ <span>Block Exit</span></button>
            <button type="button" data-bw-add-object="spawn">♙ <span>Spawn Point</span></button>
            <button type="button" data-bw-add-object="walkable">▧ <span>Walkable Zone</span></button>
          </div>

          <div className="bw-editor-add-prop">
            <label>PROP / DECORATION</label>
            <select id="bw-editor-prop-kind" defaultValue="tree" aria-label="Prop type">
              <option>tree</option><option>lamp</option><option>bench</option><option>hydrant</option>
              <option>box</option><option>news</option><option>car</option><option>van</option>
              <option>dumpster</option><option>bin</option><option>crate</option><option>barrier</option>
            </select>
            <button type="button" id="bw-editor-add-prop">ADD PROP</button>
          </div>
        </div>
        <div className="bw-panel-resizer bw-panel-resizer-x" data-panel-resizer="palette" aria-hidden="true" />
      </section>

      <section className="bw-studio-panel bw-studio-right" data-editor-panel="properties">
        <PanelHeader title="PROPERTIES" panel="properties" />
        <div className="bw-studio-panel-body">
          <div className="bw-studio-property-copy">
            <strong>SELECTED OBJECT</strong>
            <small>Use the transform strip or drag the object/gizmos directly in the scene.</small>
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

          <div className="bw-editor-actions bw-studio-danger-actions">
            <button type="button" id="bw-editor-delete" className="bw-editor-danger">DELETE OBJECT</button>
            <button type="button" id="bw-editor-reset" className="bw-editor-danger">RESET BLOCK</button>
          </div>
        </div>
        <div className="bw-panel-resizer bw-panel-resizer-x" data-panel-resizer="properties" aria-hidden="true" />
      </section>

      <section className="bw-studio-panel bw-studio-bottom" data-editor-panel="tools">
        <PanelHeader title="TOOLS · VIEW · STATUS" panel="tools" />
        <div className="bw-studio-panel-body bw-studio-bottom-body">
          <div className="bw-studio-toolgroup">
            <small>TOOLS</small>
            <div className="bw-editor-actions">
              <button type="button" id="bw-editor-duplicate">DUPLICATE</button>
              <button type="button" id="bw-editor-local-export">EXPORT JSON</button>
              <button type="button" id="bw-editor-revert-draft">REVERT DRAFT</button>
            </div>
          </div>
          <div className="bw-studio-toolgroup">
            <small>DIRECT MANIPULATION</small>
            <div className="bw-studio-help">DRAG to move · DRAG edges/corners to resize · tap an object to select</div>
          </div>
          <div className="bw-studio-toolgroup bw-studio-status-summary">
            <small>STATUS</small>
            <span>Draft autosave</span>
            <span>Server publish</span>
            <span>Touch + mouse + keyboard</span>
          </div>
        </div>
        <div className="bw-panel-resizer bw-panel-resizer-y" data-panel-resizer="tools" aria-hidden="true" />
      </section>
    </aside>
  );
}
