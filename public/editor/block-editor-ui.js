const panelHeader = (title, panel) => `
  <header class="bw-studio-panel-head">
    <strong>${title}</strong>
    <button type="button" data-panel-collapse="${panel}" aria-label="Close ${title}">×</button>
  </header>`;

const BLOCK_EDITOR_HTML = `
  <div class="bw-studio-global-actions" aria-label="Block Editor actions">
    <button class="bw-edit-toggle bw-studio-play" id="bw-edit-toggle" type="button">PLAY</button>
    <button class="bw-studio-publish" type="button" id="bw-editor-export">PUBLISH</button>
    <details class="bw-studio-action-menu">
      <summary aria-label="More editor actions">•••</summary>
      <div class="bw-studio-action-popover">
        <button class="bw-editor-panel-toggle" id="bw-editor-panel-toggle" type="button">HIDE PANEL</button>
        <button class="bw-fullscreen" id="bw-fullscreen" type="button">FULLSCREEN</button>
        <a class="bw-editor-exit" href="/#city">EXIT EDITOR</a>
      </div>
    </details>
  </div>

  <aside class="bw-editor bw-editor-studio" id="bw-editor" aria-hidden="true">
    <button id="bw-editor-minimize" class="bw-runtime-only-control" type="button" aria-hidden="true">HIDE</button>
    <button id="bw-editor-close" class="bw-runtime-only-control" type="button" aria-hidden="true">×</button>

    <header class="bw-studio-topbar">
      <button class="bw-studio-menu-button" type="button" data-panel-toggle="palette" aria-label="Open Add Object menu">＋</button>
      <div class="bw-editor-title">
        <strong>BLOCK EDITOR</strong>
        <small id="bw-editor-context">DOWNTOWN / BLOCK 01&nbsp;&nbsp;•&nbsp;&nbsp;Commerce Street</small>
      </div>
      <div class="bw-studio-status">
        <small id="bw-editor-server-status" class="bw-editor-server-status">SERVER · loading…</small>
        <small id="bw-editor-selection">Tap an object in the scene</small>
      </div>
    </header>

    <nav class="bw-studio-quickdock" aria-label="Editor menus">
      <button type="button" data-panel-toggle="palette" title="Add Object"><b>＋</b><span>ADD</span></button>
      <button type="button" data-panel-toggle="properties" title="Properties"><b>▤</b><span>PROPS</span></button>
      <button type="button" data-panel-toggle="transform" title="Transform"><b>↔</b><span>MOVE</span></button>
      <button type="button" data-panel-toggle="tools" title="Tools and View"><b>•••</b><span>TOOLS</span></button>
    </nav>

    <section class="bw-studio-transform" data-editor-panel="transform">
      <button class="bw-panel-collapse bw-transform-collapse" type="button" data-panel-collapse="transform" aria-label="Close transform panel">×</button>
      <label class="bw-editor-object-row"><span>OBJECT</span><select id="bw-editor-object" aria-label="Selected editor object"></select></label>
      <small class="bw-shape-help">WALK / EXIT / COLLISION: drag corner dots for diagonals. ADD POINT → tap an edge or anywhere inside the selected shape; the new point is selected and draggable immediately.</small>
      <label class="bw-studio-idlabel"><span>ID / LABEL</span><input id="bw-editor-idlabel" type="text" autocomplete="off"></label>
      <div class="bw-editor-transform-grid" aria-label="Transform">
        <label>X<input id="bw-editor-x" inputmode="numeric" type="number" step="5"></label>
        <label>Y<input id="bw-editor-y" inputmode="numeric" type="number" step="5"></label>
        <label>W<input id="bw-editor-w" inputmode="numeric" type="number" step="5"></label>
        <label>H<input id="bw-editor-h" inputmode="numeric" type="number" step="5"></label>
      </div>
      <label class="bw-studio-small-field"><span>ROT</span><input id="bw-editor-rotation" type="number" step="1" value="0"></label>
      <label class="bw-studio-small-field"><span>Z-INDEX</span><input id="bw-editor-zindex" type="number" step="1" value="0"></label>
      <label class="bw-editor-snap-compact">
        <span>SNAP</span>
        <select id="bw-editor-snap" aria-label="Snap size">
          <option value="1">OFF</option><option value="5">5</option><option value="10" selected>10</option><option value="25">25</option>
        </select>
      </label>
      <div class="bw-editor-quickbar">
        <button type="button" id="bw-editor-undo" title="Undo">↶</button>
        <button type="button" id="bw-editor-redo" title="Redo">↷</button>
      </div>
    </section>

    <section class="bw-studio-panel bw-studio-left" data-editor-panel="palette">
      ${panelHeader('ADD OBJECT', 'palette')}
      <div class="bw-studio-panel-body">
        <div class="bw-editor-create-grid">
          <button type="button" data-bw-open-subarea="alley-commerce-01" data-bw-street-only="true"><b>↳</b><span>Edit Commerce Alley</span></button>
          <button type="button" id="bw-editor-parent-scene" data-bw-room-only="true"><b>←</b><span>Back to Street</span></button>
          <button type="button" data-bw-add-object="alley" data-bw-street-only="true"><b>▣</b><span>Alley Entrance</span></button>
          <button type="button" data-bw-add-object="door" data-bw-street-only="true"><b>▤</b><span>Door / Entrance</span></button>
          <button type="button" data-bw-add-object="obstacle" data-bw-room-only="true"><b>▰</b><span>Collision Box</span></button>
          <button type="button" data-bw-add-object="exit"><b>⇥</b><span>Exit Zone</span></button>
          <button type="button" data-bw-add-object="spawn"><b>♙</b><span>Spawn Point</span></button>
          <button type="button" data-bw-add-object="walkable"><b>▧</b><span>Walkable Zone</span></button>
        </div>
        <div class="bw-editor-add-prop">
          <label>PROP / DECORATION</label>
          <select id="bw-editor-prop-kind">
            <option>tree</option><option>lamp</option><option>bench</option><option>hydrant</option>
            <option>box</option><option>news</option><option>car</option><option>van</option>
            <option>dumpster</option><option>bin</option><option>crate</option><option>barrier</option>
          </select>
          <button type="button" id="bw-editor-add-prop">ADD PROP</button>
        </div>
        <details class="bw-studio-more-tools">
          <summary>MORE TOOLS</summary>
          <div class="bw-asset-panel">
            <label class="bw-asset-import">ASSET JSON<input id="bw-asset-file" type="file" accept="application/json,.json"></label>
            <div id="bw-asset-status">Optional Asset Lab library.</div>
            <select id="bw-editor-asset"><option value="">No asset</option></select>
            <div class="bw-editor-actions"><button type="button" id="bw-asset-apply">ASSIGN</button><button type="button" id="bw-asset-clear">CLEAR</button></div>
          </div>
          <div class="bw-studio-history">
            <strong>VERSION HISTORY</strong>
            <select id="bw-editor-history"><option value="">Published revisions…</option></select>
            <button type="button" id="bw-editor-load-history">LOAD REVISION AS DRAFT</button>
            <small>Restore only changes the draft. Publish is still required to make it live.</small>
          </div>
        </details>
      </div>
      <div class="bw-panel-resizer bw-panel-resizer-x" data-panel-resizer="palette"></div>
    </section>

    <section class="bw-studio-panel bw-studio-right" data-editor-panel="properties">
      ${panelHeader('PROPERTIES', 'properties')}
      <div class="bw-studio-panel-body bw-studio-properties">
        <label>TYPE<input id="bw-prop-type" type="text" readonly></label>
        <label>TARGET<input id="bw-prop-target" type="text" autocomplete="off"></label>
        <label>REQUIRES<input id="bw-prop-requires" type="text" autocomplete="off"></label>
        <label>LABEL<input id="bw-prop-label" type="text" autocomplete="off"></label>
        <label class="bw-studio-toggle-row"><span>ACTIVE</span><input id="bw-prop-active" type="checkbox" checked></label>
        <label>ZONE WIDTH<input id="bw-prop-width" inputmode="numeric" type="number"></label>
        <label>ZONE HEIGHT<input id="bw-prop-height" inputmode="numeric" type="number"></label>
        <label>Z-INDEX<input id="bw-prop-zindex" inputmode="numeric" type="number"></label>
        <button type="button" id="bw-editor-delete" class="bw-editor-danger">DELETE OBJECT</button>
        <button type="button" id="bw-editor-reset" class="bw-editor-danger bw-reset-secondary">RESET BLOCK</button>
      </div>
      <div class="bw-panel-resizer bw-panel-resizer-x" data-panel-resizer="properties"></div>
    </section>

    <div class="bw-studio-viewport-tools">
      <button type="button" id="bw-editor-fit" title="Fit scene">◎</button>
      <button type="button" id="bw-editor-zoom-in" title="Zoom in">＋</button>
      <button type="button" id="bw-editor-zoom-out" title="Zoom out">−</button>
    </div>

    <section class="bw-studio-panel bw-studio-bottom" data-editor-panel="tools">
      ${panelHeader('TOOLS · VIEW · SETTINGS · STATUS', 'tools')}
      <div class="bw-studio-panel-body bw-studio-bottom-scroll" id="bw-tools-scroll">
        <div class="bw-studio-bottom-body">
          <div class="bw-studio-toolgroup">
            <small>TOOLS</small>
            <div class="bw-studio-icon-tools">
              <button class="active" type="button">SELECT</button><button type="button">MOVE</button>
              <button type="button" disabled>ROTATE</button><button type="button">SCALE</button>
              <button type="button" id="bw-editor-shape-toggle">TO SHAPE</button>
              <button type="button" id="bw-editor-add-point">ADD POINT</button>
              <button type="button" id="bw-editor-delete-point">DELETE POINT</button>
              <button type="button" id="bw-editor-lock">LOCK SELECTED</button>
              <button type="button" id="bw-editor-duplicate">DUPLICATE</button><button type="button" id="bw-editor-local-export">EXPORT</button>
            </div>
          </div>
          <div class="bw-studio-toolgroup">
            <small>VIEW</small>
            <div class="bw-studio-icon-tools">
              <button type="button" id="bw-view-grid">GRID</button><button type="button" id="bw-view-colliders">COLLIDERS</button>
              <button type="button" id="bw-view-zones">ZONES</button><button type="button" id="bw-view-labels">LABELS</button>
            </div>
          </div>
          <div class="bw-studio-toolgroup bw-studio-scene-config">
            <small>SCENE CONFIG</small>
            <details class="bw-scene-config-details">
              <summary>CAMERA · PLAYER · GAMEPLAY</summary>
              <div class="bw-scene-config-grid">
                <label>CAMERA ZOOM<input id="bw-config-camera-zoom" type="number" inputmode="decimal" min="0.2" max="2" step="0.01"></label>
                <label>PLAYER SCALE<input id="bw-config-player-scale" type="number" inputmode="decimal" min="0.5" max="3" step="0.05"></label>
                <label>LOOK AHEAD<input id="bw-config-lookahead" type="number" inputmode="numeric" min="0" max="1200" step="10"></label>
                <label>INTERACT RADIUS<input id="bw-config-interaction-radius" type="number" inputmode="numeric" min="20" max="500" step="5"></label>
                <label>WALK SPEED<input id="bw-config-walk-speed" type="number" inputmode="numeric" min="40" max="800" step="5"></label>
                <label>RUN SPEED<input id="bw-config-run-speed" type="number" inputmode="numeric" min="60" max="1200" step="5"></label>
                <label>DEPTH MIN<input id="bw-config-depth-min" type="number" inputmode="decimal" min="0.3" max="2" step="0.01"></label>
                <label>DEPTH MAX<input id="bw-config-depth-max" type="number" inputmode="decimal" min="0.3" max="2.5" step="0.01"></label>
              </div>
              <small id="bw-config-integrity-status" class="bw-config-integrity-status">PUBLISH · integrity protected</small>
            </details>
          </div>
          <div class="bw-studio-toolgroup">
            <small>PRECISION & SETTINGS</small>
            <div class="bw-studio-nudge" aria-label="Nudge selected object">
              <span></span><button type="button" data-bw-nudge="up" aria-label="Nudge up">↑</button><span></span>
              <button type="button" data-bw-nudge="left" aria-label="Nudge left">←</button>
              <button type="button" id="bw-editor-focus">FOCUS</button>
              <button type="button" data-bw-nudge="right" aria-label="Nudge right">→</button>
              <span></span><button type="button" data-bw-nudge="down" aria-label="Nudge down">↓</button><span></span>
            </div>
            <div class="bw-editor-actions bw-studio-settings-actions">
              <button type="button" id="bw-editor-revert-draft">REVERT DRAFT</button>
              <button type="button" id="bw-editor-reset-layout">RESET UI</button>
            </div>
          </div>
          <div class="bw-studio-toolgroup bw-studio-status-summary">
            <small>STATUS</small>
            <span>Objects <b id="bw-status-objects">0</b></span>
            <span>Entrances <b id="bw-status-entrances">0</b></span>
            <span>Exits <b id="bw-status-exits">0</b></span>
            <span>Props <b id="bw-status-props">0</b></span>
          </div>
        </div>
      </div>
      <input class="bw-studio-bottom-scrollbar" id="bw-tools-scrollbar" type="range" min="0" max="1000" step="1" value="0" aria-label="Scroll tools bar">
      <div class="bw-panel-resizer bw-panel-resizer-y" data-panel-resizer="tools"></div>
    </section>
  </aside>`;

export function mountBlockEditor(host) {
  if (!host) throw new Error('Block Editor UI host is missing.');
  host.innerHTML = BLOCK_EDITOR_HTML;
  return () => {
    host.replaceChildren();
  };
}
