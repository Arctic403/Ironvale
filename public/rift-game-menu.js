import { getRiftGraphics, setRiftGraphics, resetRiftGraphics, getRiftRenderBuffer } from './rift-render-quality.js';

const state = { root: null, open: false };
const DEV_MODE_KEY = 'riftcity:dev-mode:v1';
const VALIDATOR_DEBUG_KEY = 'riftcity:validator-debug:v1';

function readStoredFlag(key) {
  try { return localStorage.getItem(key) === '1'; } catch (_) { return false; }
}

function writeStoredFlag(key, enabled) {
  try { localStorage.setItem(key, enabled ? '1' : '0'); } catch (_) {}
}

function devModeEnabled() {
  return document.body.classList.contains('rift-dev-mode');
}

function validatorDebugEnabled() {
  return document.body.classList.contains('rift-validator-debug');
}

function setValidatorDebug(enabled, { persist = true, announce = true } = {}) {
  const next = !!enabled && devModeEnabled();
  document.body.classList.toggle('rift-validator-debug', next);
  if (persist) writeStoredFlag(VALIDATOR_DEBUG_KEY, next);
  if (announce) window.dispatchEvent(new CustomEvent('riftvalidatordebugchange', { detail: { enabled: next } }));
  syncDevTools();
  return next;
}

function setDevMode(enabled, { persist = true, announce = true } = {}) {
  const next = !!enabled;
  const previous = devModeEnabled();
  document.body.classList.toggle('rift-dev-mode', next);
  if (persist) writeStoredFlag(DEV_MODE_KEY, next);
  if (!next) {
    document.body.classList.remove('rift-validator-debug');
    if (persist) writeStoredFlag(VALIDATOR_DEBUG_KEY, false);
  }
  if (announce && previous !== next) {
    window.dispatchEvent(new CustomEvent('riftdevmodechange', { detail: { enabled: next } }));
    if (!next) window.dispatchEvent(new CustomEvent('riftvalidatordebugchange', { detail: { enabled: false } }));
  }
  syncDevTools();
  return next;
}

function hydrateDevState() {
  const dev = readStoredFlag(DEV_MODE_KEY);
  document.body.classList.toggle('rift-dev-mode', dev);
  document.body.classList.toggle('rift-validator-debug', dev && readStoredFlag(VALIDATOR_DEBUG_KEY));
}

const CSS = `
.rift-game-ui-active .world3d-top-left{top:62px!important}
.rift-game-top-controls{position:absolute;z-index:55;top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left));display:flex;gap:7px}
.rift-game-tools-control{position:absolute;z-index:56;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right))}
.rift-game-tools-button{min-width:76px;height:42px;padding:0 13px;border:1px solid #5f8fc4aa;background:#071018dc;color:#eef7ff;font:900 11px/1 system-ui;letter-spacing:.09em;backdrop-filter:blur(10px);box-shadow:0 7px 22px #0007}
.rift-game-tools-button.active{border-color:#69d69b;background:#174e38;color:#e5fff0}
.rift-game-ui-active .rift-import-actions{right:max(96px,calc(env(safe-area-inset-right) + 96px))!important}
.rift-game-ui-active #rift-creative-open-panel,
.rift-game-ui-active #rift-first-person-toggle{display:none!important}
.rift-game-circle{width:42px;height:42px;border:1px solid #ffffff2c;border-radius:50%;background:#071018dc;color:#edf8ff;font:900 19px/1 system-ui;backdrop-filter:blur(10px);box-shadow:0 7px 22px #0007}
.rift-game-circle:active{transform:scale(.96)}
.rift-game-overlay{position:absolute;z-index:80;inset:0;display:none;align-items:center;justify-content:center;padding:18px;background:#03070bb8;backdrop-filter:blur(8px);pointer-events:auto}
.rift-game-overlay.open{display:flex}
.rift-game-card{width:min(520px,100%);max-height:min(720px,calc(100vh - 36px));overflow:auto;border:1px solid #ffffff22;border-radius:20px;background:#0a1219f5;color:#eef7fd;box-shadow:0 24px 80px #000b}
.rift-game-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px 18px 12px;border-bottom:1px solid #ffffff15}
.rift-game-card header span{display:block;color:#8ecfff;font:800 10px/1.2 system-ui;letter-spacing:.13em}
.rift-game-card header strong{display:block;margin-top:4px;font:900 22px/1.1 system-ui}
.rift-game-close{border:0;background:#ffffff12;color:#fff;width:38px;height:38px;border-radius:12px;font-size:22px}
.rift-game-body{padding:16px 18px 20px}
.rift-game-tabs{display:flex;gap:6px;margin-bottom:14px}
.rift-game-tabs button{flex:1;min-width:0;min-height:38px;padding:0 7px;border:1px solid #ffffff18;border-radius:10px;background:#0d1922;color:#c9d7e1;font-weight:800}
.rift-game-tabs button.active{background:#174f74;color:#fff}
.rift-game-panel[hidden]{display:none}
.rift-game-menu-actions{display:grid;gap:9px}
.rift-game-menu-actions button{display:flex;align-items:center;justify-content:space-between;min-height:48px;padding:0 14px;border:1px solid #ffffff18;border-radius:13px;background:#111d27;color:#f3f9fd;font:800 13px system-ui}
.rift-game-menu-actions button.primary{background:#174f74;border-color:#5eb0ed88}
.rift-settings-grid{display:grid;gap:13px}
.rift-setting{display:grid;grid-template-columns:1fr minmax(120px,180px);align-items:center;gap:12px}
.rift-setting span b{display:block;font:800 13px system-ui}
.rift-setting span small{display:block;margin-top:3px;color:#9eb0be;font:500 10px/1.3 system-ui}
.rift-setting select{width:100%;min-height:40px;border:1px solid #ffffff22;border-radius:11px;background:#071018;color:#fff;padding:0 9px;font-weight:800}
.rift-setting-toggle{display:flex;justify-content:flex-end}
.rift-setting-toggle input{width:24px;height:24px;accent-color:#5eb0ed}
.rift-resolution-readout{margin:14px 0 0;padding:9px 11px;border-radius:10px;background:#ffffff0b;color:#a9c6d9;font:700 10px system-ui}
.rift-controls-copy{display:grid;grid-template-columns:1fr auto;gap:9px 16px;color:#bcd0dc;font:700 12px system-ui}
.rift-controls-copy b{color:#fff;text-align:right}
.rift-world-menu-copy{margin:0 0 12px;color:#9eb0be;font:600 11px/1.45 system-ui}
.rift-world-menu-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.rift-world-menu-grid button{min-height:46px;padding:8px 10px;border:1px solid #ffffff18;border-radius:12px;background:#111d27;color:#f3f9fd;font:800 11px/1.15 system-ui;letter-spacing:.025em}
.rift-world-menu-grid button.active{border-color:#69d69b;background:#174e38;color:#d9ffea}
.rift-world-menu-grid button[data-rift-world-target="#rift-import-json"]{border-color:#d68d3588}
.rift-world-menu-grid button[data-rift-world-target="#world3d-fullscreen-button"]{border-color:#d68d3588}
.rift-dev-tools-copy{margin:0 0 12px;color:#9eb0be;font:600 11px/1.45 system-ui}
.rift-dev-mode-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;padding:12px 13px;border:1px solid #ffffff18;border-radius:13px;background:#111d27}
.rift-dev-mode-row b{display:block;font:900 13px system-ui;color:#f3f9fd}.rift-dev-mode-row small{display:block;margin-top:3px;color:#9eb0be;font:500 10px/1.35 system-ui}
.rift-dev-mode-row input{width:26px;height:26px;accent-color:#5eb0ed}
.rift-dev-tools-locked{margin-top:10px;padding:11px 12px;border:1px dashed #ffffff22;border-radius:11px;color:#9eb0be;font:700 11px/1.4 system-ui}
.rift-dev-tools-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
.rift-dev-tools-grid[hidden]{display:none!important}
.rift-dev-tools-grid button,.rift-validator-row{min-height:48px;border:1px solid #ffffff18;border-radius:12px;background:#111d27;color:#f3f9fd;font:800 11px/1.15 system-ui}
.rift-dev-tools-grid button.active{border-color:#69d69b;background:#174e38;color:#d9ffea}
.rift-validator-row{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 12px}
.rift-validator-row span{display:grid;gap:2px}.rift-validator-row small{color:#9eb0be;font-size:9px;font-weight:600}.rift-validator-row input{width:24px;height:24px;accent-color:#69d69b}
.rift-hide-fps #downtown3d-fps{display:none!important}
@media(pointer:coarse),(max-width:700px){
  .rift-game-ui-active .world3d-top-left{top:58px!important}
  .rift-game-circle{width:40px;height:40px}
  .rift-game-card{border-radius:16px}
  .rift-setting{grid-template-columns:1fr 130px}
  .rift-game-body{padding:14px}
  .rift-game-tabs{gap:4px}
  .rift-game-tabs button{min-height:36px;padding:0 4px;font-size:10px}
}
@media(max-width:420px){
  .rift-world-menu-grid{grid-template-columns:1fr 1fr;gap:7px}
  .rift-world-menu-grid button{min-height:44px;font-size:10px}
}
`;

if (!document.getElementById('rift-game-menu-css')) {
  const style = document.createElement('style');
  style.id = 'rift-game-menu-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

function root() {
  const shell = document.querySelector('.downtown3d-foundation');
  return shell?.closest('#game-root') || shell?.parentElement || null;
}

function typing() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function syncWorldActions() {
  const r = state.root;
  if (!r) return;
  r.querySelectorAll('[data-rift-world-target]').forEach(button => {
    const target = r.querySelector(button.dataset.riftWorldTarget);
    if (!target) {
      button.disabled = true;
      button.classList.remove('active');
      return;
    }
    button.disabled = false;
    button.classList.toggle('active', target.classList.contains('active'));
    const liveLabel = String(target.textContent || '').trim();
    if (liveLabel) button.textContent = liveLabel;
  });
}

function syncDevTools() {
  const r = state.root;
  if (!r) return;
  const dev = devModeEnabled();
  const validator = validatorDebugEnabled();
  const devToggle = r.querySelector('[data-rift-dev-mode]');
  const validatorToggle = r.querySelector('[data-rift-validator-debug]');
  const locked = r.querySelector('[data-rift-dev-locked]');
  const grid = r.querySelector('[data-rift-dev-tools]');
  const topButton = r.querySelector('[data-rift-open-dev-tools]');
  if (devToggle) devToggle.checked = dev;
  if (validatorToggle) validatorToggle.checked = validator;
  if (locked) locked.hidden = dev;
  if (grid) grid.hidden = !dev;
  if (topButton) topButton.classList.toggle('active', dev);
  const freecam = r.querySelector('[data-rift-tool-freecam]');
  if (freecam) freecam.classList.toggle('active', !!window.RiftCityAIWorldTools?.freecamActive);
  const firstPerson = r.querySelector('[data-rift-tool-first-person]');
  const firstPersonSource = r.querySelector('#rift-first-person-toggle');
  if (firstPerson) firstPerson.classList.toggle('active', !!firstPersonSource?.classList.contains('active'));
  const buildPanel = r.querySelector('[data-rift-tool-build-panel]');
  if (buildPanel) buildPanel.classList.toggle('active', !!r.querySelector('#rift-creative-panel')?.classList.contains('open'));
}

function sync() {
  const r = state.root;
  if (!r) return;
  const graphics = getRiftGraphics();
  for (const [key, selector] of Object.entries({
    quality: '[data-rift-setting-quality]',
    resolution: '[data-rift-setting-resolution]',
    materialMode: '[data-rift-setting-material]'
  })) {
    const element = r.querySelector(selector);
    if (element) element.value = graphics[key];
  }
  const water = r.querySelector('[data-rift-setting-water]');
  const grass = r.querySelector('[data-rift-setting-grass]');
  const fps = r.querySelector('[data-rift-setting-fps]');
  if (water) water.checked = graphics.waterMotion;
  if (grass) grass.checked = graphics.grassMotion;
  if (fps) fps.checked = graphics.showFps;
  const buffer = getRiftRenderBuffer();
  const out = r.querySelector('[data-rift-resolution-readout]');
  if (out) out.textContent = buffer ? `${buffer.width} × ${buffer.height} render buffer` : 'Render buffer calculating…';
  syncWorldActions();
  syncDevTools();
}

function panel(name) {
  const r = state.root;
  if (!r) return;
  r.querySelectorAll('[data-rift-game-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.riftGameTab === name);
  });
  r.querySelectorAll('[data-rift-game-panel]').forEach(item => {
    item.hidden = item.dataset.riftGamePanel !== name;
  });
  if (name === 'world') syncWorldActions();
  if (name === 'tools') syncDevTools();
}

function overlay(open, name = 'menu') {
  const r = state.root;
  if (!r) return;
  state.open = !!open;
  const item = r.querySelector('.rift-game-overlay');
  if (!item) return;
  item.classList.toggle('open', !!open);
  item.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) panel(name);
  sync();
}

function runWorldAction(button) {
  const r = state.root;
  if (!r) return;
  const selector = button?.dataset?.riftWorldTarget;
  const target = selector ? r.querySelector(selector) : null;
  if (!target) return;
  target.click();
  overlay(false);
  setTimeout(syncWorldActions, 0);
}

function runDevTool(action) {
  const r = state.root;
  if (!r || !devModeEnabled()) return;
  if (action === 'freecam') {
    window.RiftCityAIWorldTools?.toggleFreecam?.();
    overlay(false);
  } else if (action === 'first-person') {
    r.querySelector('#rift-first-person-toggle')?.click();
    overlay(false);
  } else if (action === 'build-panel') {
    r.querySelector('#rift-creative-open-panel')?.click();
    overlay(false);
  }
  setTimeout(syncDevTools, 0);
}

function mount(r) {
  if (!r || r.querySelector('[data-rift-open-game-menu]')) return;
  state.root = r;
  r.classList.add('rift-game-ui-active');
  const shell = r.querySelector('.world3d-shell');
  if (!shell) return;

  const top = document.createElement('div');
  top.className = 'rift-game-top-controls';
  top.innerHTML = '<button class="rift-game-circle" data-rift-open-game-menu type="button" aria-label="Open game menu">☰</button><button class="rift-game-circle" data-rift-open-game-settings type="button" aria-label="Open graphics settings">⚙</button>';
  shell.appendChild(top);

  const toolsTop = document.createElement('div');
  toolsTop.className = 'rift-game-tools-control';
  toolsTop.innerHTML = '<button class="rift-game-tools-button" data-rift-open-dev-tools type="button" aria-label="Open developer tools">TOOLS</button>';
  shell.appendChild(toolsTop);

  const item = document.createElement('div');
  item.className = 'rift-game-overlay';
  item.setAttribute('aria-hidden', 'true');
  item.innerHTML = `
    <section class="rift-game-card" role="dialog" aria-modal="true" aria-label="RiftCity game menu">
      <header>
        <div><span>RIFTCITY</span><strong>Game Menu</strong></div>
        <button class="rift-game-close" data-rift-close-menu type="button" aria-label="Close menu">×</button>
      </header>
      <div class="rift-game-body">
        <div class="rift-game-tabs">
          <button data-rift-game-tab="menu" class="active">MENU</button>
          <button data-rift-game-tab="world">WORLD</button>
          <button data-rift-game-tab="tools">TOOLS</button>
          <button data-rift-game-tab="settings">SETTINGS</button>
          <button data-rift-game-tab="controls">CONTROLS</button>
        </div>
        <div class="rift-game-panel" data-rift-game-panel="menu">
          <div class="rift-game-menu-actions">
            <button class="primary" data-rift-resume type="button"><span>Resume</span><span>ESC</span></button>
            <button data-rift-menu-world type="button"><span>World / Build Controls</span><span>›</span></button>
            <button data-rift-menu-settings type="button"><span>Graphics Settings</span><span>›</span></button>
            <button data-rift-menu-controls type="button"><span>Controls</span><span>›</span></button>
            <button data-rift-reset-graphics type="button"><span>Reset Graphics Defaults</span><span>↺</span></button>
          </div>
        </div>
        <div class="rift-game-panel" data-rift-game-panel="world" hidden>
          <p class="rift-world-menu-copy">Portrait fullscreen keeps developer HUD chrome off the playfield. These buttons operate the original world controls directly.</p>
          <div class="rift-world-menu-grid">
            <button type="button" data-rift-world-target="#rift-creative-toggle">BUILD MODE</button>
            <button type="button" data-rift-world-target="#rift-import-json">IMPORT JSON</button>
            <button type="button" data-rift-world-target="#rift-import-reset">RESET DEFAULT</button>
            <button type="button" data-rift-world-target="#rift-import-cull">CULL ON</button>
            <button type="button" data-rift-world-target="#rift-import-top">CITY OVERVIEW</button>
            <button type="button" data-rift-world-target="#rift-import-view">RESET VIEW</button>
            <button type="button" data-rift-world-target="#world3d-fullscreen-button">FULLSCREEN</button>
          </div>
        </div>
        <div class="rift-game-panel" data-rift-game-panel="tools" hidden>
          <p class="rift-dev-tools-copy">Developer camera and validation helpers stay out of normal gameplay. Enable Dev Mode to reveal them.</p>
          <label class="rift-dev-mode-row"><span><b>Dev Mode</b><small>Unlock Freecam, First Person and validator diagnostics.</small></span><input data-rift-dev-mode type="checkbox"></label>
          <div class="rift-dev-tools-locked" data-rift-dev-locked>Dev tools are currently disabled.</div>
          <div class="rift-dev-tools-grid" data-rift-dev-tools hidden>
            <button type="button" data-rift-tool-freecam>FREECAM</button>
            <button type="button" data-rift-tool-first-person>FIRST PERSON</button>
            <button type="button" data-rift-tool-build-panel>BUILD TOOLS</button>
            <label class="rift-validator-row"><span><b>VALIDATOR DEBUG</b><small>Show live validation pass popups after block/world edits.</small></span><input data-rift-validator-debug type="checkbox"></label>
          </div>
        </div>
        <div class="rift-game-panel" data-rift-game-panel="settings" hidden>
          <div class="rift-settings-grid">
            <label class="rift-setting"><span><b>Graphics Quality</b><small>Controls the automatic render-scale ceiling.</small></span><select data-rift-setting-quality><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="high">High</option><option value="ultra">Ultra</option></select></label>
            <label class="rift-setting"><span><b>Resolution</b><small>720p/1080p target the WebGL render-buffer height; Auto adapts to the device.</small></span><select data-rift-setting-resolution><option value="auto">Auto</option><option value="720">720p</option><option value="1080">1080p</option></select></label>
            <label class="rift-setting"><span><b>Material Detail</b><small>Realistic enables detailed procedural concrete, brick, stone, asphalt, grass, glass, wood and more.</small></span><select data-rift-setting-material><option value="simple">Simple</option><option value="realistic">Realistic</option></select></label>
            <label class="rift-setting"><span><b>Water Animation</b><small>Directional flow, ripples and surface motion.</small></span><span class="rift-setting-toggle"><input data-rift-setting-water type="checkbox"></span></label>
            <label class="rift-setting"><span><b>Grass Motion</b><small>Wind sway on non-solid grass detail.</small></span><span class="rift-setting-toggle"><input data-rift-setting-grass type="checkbox"></span></label>
            <label class="rift-setting"><span><b>FPS Counter</b><small>Show renderer FPS in the world HUD.</small></span><span class="rift-setting-toggle"><input data-rift-setting-fps type="checkbox"></span></label>
          </div>
          <div class="rift-resolution-readout" data-rift-resolution-readout>Render buffer calculating…</div>
        </div>
        <div class="rift-game-panel" data-rift-game-panel="controls" hidden>
          <div class="rift-controls-copy">
            <span>Game menu</span><b>ESC / ☰</b>
            <span>World controls</span><b>☰ → WORLD</b>
            <span>Developer tools</span><b>TOOLS</b>
            <span>Quick graphics</span><b>⚙</b>
            <span>Freecam</span><b>Dev Mode → TOOLS</b>
            <span>Move</span><b>WASD / joystick</b>
            <span>Vertical</span><b>E / Q · UP / DOWN</b>
            <span>Speed</span><b>Shift / FAST</b>
            <span>Look</span><b>Drag</b>
          </div>
        </div>
      </div>
    </section>`;
  shell.appendChild(item);

  r.querySelector('[data-rift-open-game-menu]')?.addEventListener('click', () => overlay(true, 'menu'));
  r.querySelector('[data-rift-open-game-settings]')?.addEventListener('click', () => overlay(true, 'settings'));
  r.querySelector('[data-rift-open-dev-tools]')?.addEventListener('click', () => overlay(true, 'tools'));
  r.querySelector('[data-rift-close-menu]')?.addEventListener('click', () => overlay(false));
  r.querySelector('[data-rift-resume]')?.addEventListener('click', () => overlay(false));
  r.querySelector('[data-rift-menu-world]')?.addEventListener('click', () => panel('world'));
  r.querySelector('[data-rift-menu-settings]')?.addEventListener('click', () => panel('settings'));
  r.querySelector('[data-rift-menu-controls]')?.addEventListener('click', () => panel('controls'));
  r.querySelector('[data-rift-reset-graphics]')?.addEventListener('click', () => { resetRiftGraphics(); sync(); });
  r.querySelectorAll('[data-rift-game-tab]').forEach(button => button.addEventListener('click', () => panel(button.dataset.riftGameTab)));
  r.querySelectorAll('[data-rift-world-target]').forEach(button => button.addEventListener('click', () => runWorldAction(button)));
  r.querySelector('[data-rift-dev-mode]')?.addEventListener('change', event => setDevMode(event.target.checked));
  r.querySelector('[data-rift-validator-debug]')?.addEventListener('change', event => setValidatorDebug(event.target.checked));
  r.querySelector('[data-rift-tool-freecam]')?.addEventListener('click', () => runDevTool('freecam'));
  r.querySelector('[data-rift-tool-first-person]')?.addEventListener('click', () => runDevTool('first-person'));
  r.querySelector('[data-rift-tool-build-panel]')?.addEventListener('click', () => runDevTool('build-panel'));
  r.querySelector('[data-rift-setting-quality]')?.addEventListener('change', event => setRiftGraphics({ quality: event.target.value }));
  r.querySelector('[data-rift-setting-resolution]')?.addEventListener('change', event => setRiftGraphics({ resolution: event.target.value }));
  r.querySelector('[data-rift-setting-material]')?.addEventListener('change', event => setRiftGraphics({ materialMode: event.target.value }));
  r.querySelector('[data-rift-setting-water]')?.addEventListener('change', event => setRiftGraphics({ waterMotion: event.target.checked }));
  r.querySelector('[data-rift-setting-grass]')?.addEventListener('change', event => setRiftGraphics({ grassMotion: event.target.checked }));
  r.querySelector('[data-rift-setting-fps]')?.addEventListener('change', event => setRiftGraphics({ showFps: event.target.checked }));
  item.addEventListener('pointerdown', event => { if (event.target === item) overlay(false); });
  sync();
}

window.addEventListener('riftgraphicschange', sync);
window.addEventListener('riftgraphicsbuffer', sync);
window.addEventListener('keydown', event => {
  if (typing()) return;
  const r = state.root || root();
  if (!r) return;
  if (event.code === 'Escape') {
    if (window.RiftCityAIWorldTools?.freecamActive) return;
    overlay(!state.open, 'menu');
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (state.open && (/^(Key[WASDQEF]|Arrow|Space|Shift|Control)/.test(event.code))) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

function mountAll() {
  const r = root();
  if (r) mount(r);
  if (state.root && !state.root.isConnected) {
    state.root = null;
    state.open = false;
  }
}

hydrateDevState();
new MutationObserver(mountAll).observe(document.documentElement, { childList: true, subtree: true });
mountAll();
window.RiftCityGameMenu = Object.freeze({
  version: 'H1.86-dev-tools-validator-debug',
  open() { mountAll(); if (state.root) overlay(true, 'menu'); },
  world() { mountAll(); if (state.root) overlay(true, 'world'); },
  settings() { mountAll(); if (state.root) overlay(true, 'settings'); },
  tools() { mountAll(); if (state.root) overlay(true, 'tools'); },
  setDevMode(enabled) { return setDevMode(enabled); },
  get devMode() { return devModeEnabled(); },
  setValidatorDebug(enabled) { return setValidatorDebug(enabled); },
  get validatorDebug() { return validatorDebugEnabled(); },
  close() { overlay(false); }
});
