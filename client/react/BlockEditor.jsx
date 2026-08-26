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
    <>
      <div className="bw-studio-global-actions" aria-label="Block Editor actions">
        <button className="bw-edit-toggle bw-studio-play" id="bw-edit-toggle" type="button">PLAY</button>
        <button className="bw-editor-panel-toggle" id="bw-editor-panel-toggle" type="button">HIDE PANEL</button>
        <button className="bw-studio-publish" type="button" id="bw-editor-export">PUBLISH</button>
        <button className="bw-fullscreen" id="bw-fullscreen" type="button">FULLSCREEN</button>
        <a className="bw-editor-exit" href="/#city">EXIT</a>
      </div>

      <aside className="bw-editor bw-editor-studio" id="bw-editor" aria-hidden="true">
        <button id="bw-editor-minimize" className="bw-runtime-only-control" type="button" aria-hidden="true">HIDE</button>
        <button id="bw-editor-close" className="bw-runtime-only-control" type="button" aria-hidden="true">×</button>

        <header className="bw-studio-topbar">
          <div className="bw-editor-title">
            <strong>BLOCK EDITOR</strong>
            <small>DOWNTOWN / BLOCK 01&nbsp;&nbsp;•&nbsp;&nbsp;Commerce Street</small>
          </div>
          <div className="bw-studio-status">
            <small id="bw-editor-server-status" className="bw-editor-server-status">SERVER · loading…</small>
            <small id="bw-editor-selection">Tap an object in the scene</small>
          </div>
        </header>

        <section className="bw-studio-transform" data-editor-panel="transform">
          <button className="bw-panel-collapse bw-transform-collapse" type="button" data-panel-collapse="transform" aria-label="Collapse transform bar">⌃</button>
          <label className="bw-editor-object-row"><span>OBJECT</span><select id="bw-editor-object" aria-label="Selected editor object" /></label>
          <label className="bw-studio-idlabel"><span>ID / LABEL</span><input id="bw-editor-idlabel" type="text" autoComplete="off" /></label>
          <div className="bw-editor-transform-grid" aria-label="Transform">
            <label>X<input id="bw-editor-x" inputMode="numeric" type="number" step="5" /></label>
            <label>Y<input id="bw-editor-y" inputMode="numeric" type="number" step="5" /></label>
            <label>W<input id="bw-editor-w" inputMode="numeric" type="number" step="5" /></label>
            <label>H<input id="bw-editor-h" inputMode="numeric" type="number" step="5" /></label>
          </div>
          <label className="bw-studio-small-field"><span>ROT</span><input id="bw-editor-rotation" type="number" step="1" defaultValue="0" /></label>
          <label className="bw-studio-small-field"><span>Z-INDEX</span><input id="bw-editor-zindex" type="number" step="1" defaultValue="0" /></label>
          <label className="bw-editor-snap-compact">
            <span>SNAP</span>
            <select id="bw-editor-snap" defaultValue="10" aria-label="Snap size">
              <option value="1">OFF</option><option value="5">5</option><option value="10">10</option><option value="25">25</option>
            </select>
          </label>
          <div className="bw-editor-quickbar">
            <button type="button" id="bw-editor-undo" title="Undo">↶</button>
            <button type="button" id="bw-editor-redo" title="Redo">↷</button>
          </div>
        </section>

        <section className="bw-studio-panel bw-studio-left" data-editor-panel="palette">
          <PanelHeader title="ADD OBJECT" panel="palette" />
          <div className="bw-studio-panel-body">
            <div className="bw-editor-create-grid">
              <button type="button" data-bw-add-object="alley"><b>▣</b><span>Alley Entrance</span></button>
              <button type="button" data-bw-add-object="door"><b>▤</b><span>Door / Entrance</span></button>
              <button type="button" data-bw-add-object="exit"><b>⇥</b><span>Block Exit</span></button>
              <button type="button" data-bw-add-object="spawn"><b>♙</b><span>Spawn Point</span></button>
              <button type="button" data-bw-add-object="walkable"><b>▧</b><span>Walkable Zone</span></button>
            </div>
            <div className="bw-editor-add-prop">
              <label>PROP / DECORATION</label>
              <select id="bw-editor-prop-kind" defaultValue="tree">
                <option>tree</option><option>lamp</option><option>bench</option><option>hydrant</option>
                <option>box</option><option>news</option><option>car</option><option>van</option>
                <option>dumpster</option><option>bin</option><option>crate</option><option>barrier</option>
              </select>
              <button type="button" id="bw-editor-add-prop">ADD PROP</button>
            </div>
            <details className="bw-studio-more-tools">
              <summary>MORE TOOLS</summary>
              <div className="bw-asset-panel">
                <label className="bw-asset-import">ASSET JSON<input id="bw-asset-file" type="file" accept="application/json,.json" /></label>
                <div id="bw-asset-status">Optional Asset Lab library.</div>
                <select id="bw-editor-asset" defaultValue=""><option value="">No asset</option></select>
                <div className="bw-editor-actions"><button type="button" id="bw-asset-apply">ASSIGN</button><button type="button" id="bw-asset-clear">CLEAR</button></div>
              </div>
            </details>
          </div>
          <div className="bw-panel-resizer bw-panel-resizer-x" data-panel-resizer="palette" />
        </section>

        <section className="bw-studio-panel bw-studio-right" data-editor-panel="properties">
          <PanelHeader title="PROPERTIES" panel="properties" />
          <div className="bw-studio-panel-body bw-studio-properties">
            <label>TYPE<input id="bw-prop-type" type="text" readOnly /></label>
            <label>TARGET<input id="bw-prop-target" type="text" autoComplete="off" /></label>
            <label>REQUIRES<input id="bw-prop-requires" type="text" autoComplete="off" /></label>
            <label>LABEL<input id="bw-prop-label" type="text" autoComplete="off" /></label>
            <label className="bw-studio-toggle-row"><span>ACTIVE</span><input id="bw-prop-active" type="checkbox" defaultChecked /></label>
            <label>ZONE WIDTH<input id="bw-prop-width" inputMode="numeric" type="number" /></label>
            <label>ZONE HEIGHT<input id="bw-prop-height" inputMode="numeric" type="number" /></label>
            <label>Z-INDEX<input id="bw-prop-zindex" inputMode="numeric" type="number" /></label>
            <button type="button" id="bw-editor-delete" className="bw-editor-danger">DELETE OBJECT</button>
            <button type="button" id="bw-editor-reset" className="bw-editor-danger bw-reset-secondary">RESET BLOCK</button>
          </div>
          <div className="bw-panel-resizer bw-panel-resizer-x" data-panel-resizer="properties" />
        </section>

        <div className="bw-studio-viewport-tools">
          <button type="button" id="bw-editor-fit" title="Fit scene">◎</button>
          <button type="button" id="bw-editor-zoom-in" title="Zoom in">＋</button>
          <button type="button" id="bw-editor-zoom-out" title="Zoom out">−</button>
        </div>

        <section className="bw-studio-panel bw-studio-bottom" data-editor-panel="tools">
          <PanelHeader title="TOOLS · VIEW · SNAP & SETTINGS · STATUS" panel="tools" />
          <div className="bw-studio-panel-body bw-studio-bottom-body">
            <div className="bw-studio-toolgroup">
              <small>TOOLS</small>
              <div className="bw-studio-icon-tools">
                <button className="active" type="button">SELECT</button><button type="button">MOVE</button>
                <button type="button" disabled>ROTATE</button><button type="button">SCALE</button>
                <button type="button" id="bw-editor-duplicate">DUPLICATE</button><button type="button" id="bw-editor-local-export">EXPORT</button>
              </div>
            </div>
            <div className="bw-studio-toolgroup">
              <small>VIEW</small>
              <div className="bw-studio-icon-tools">
                <button type="button" id="bw-view-grid">GRID</button><button type="button" id="bw-view-colliders">COLLIDERS</button>
                <button type="button" id="bw-view-zones">ZONES</button><button type="button" id="bw-view-labels">LABELS</button>
              </div>
            </div>
            <div className="bw-studio-toolgroup">
              <small>SNAP & SETTINGS</small>
              <div className="bw-studio-help">Drag panel dividers to resize. Layout is saved on this device.</div>
              <div className="bw-editor-actions"><button type="button" id="bw-editor-revert-draft">REVERT DRAFT</button></div>
            </div>
            <div className="bw-studio-toolgroup bw-studio-status-summary">
              <small>STATUS</small>
              <span>Objects <b id="bw-status-objects">0</b></span>
              <span>Entrances <b id="bw-status-entrances">0</b></span>
              <span>Exits <b id="bw-status-exits">0</b></span>
              <span>Props <b id="bw-status-props">0</b></span>
            </div>
          </div>
          <div className="bw-panel-resizer bw-panel-resizer-y" data-panel-resizer="tools" />
        </section>
      </aside>
    </>
  );
}
