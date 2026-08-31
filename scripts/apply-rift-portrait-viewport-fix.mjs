import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`[portrait-viewport] ${label}: expected block not found`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`[portrait-viewport] ${label}: source block is ambiguous`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

const jsPath = 'public/downtown3d-foundation.js';
let js = fs.readFileSync(jsPath, 'utf8');

if (!js.includes("style.setProperty('--rift-viewport-height'")) {
  js = replaceOnce(js,
`  const resize = () => {
    const target = coarsePointer ? 1.35 : 1.75;
    const deviceRatio = Math.max(1, window.devicePixelRatio || 1);
    engine.resize(Math.min(deviceRatio, target));
  };

  const setGameMode = async enabled => {
`,
`  let viewportSettleTimer = 0;
  let viewportFinalTimer = 0;

  const syncViewport = () => {
    if (destroyed) return;
    const viewport = window.visualViewport;
    const width = Math.max(1, Math.round(Number(viewport?.width) || window.innerWidth || shell?.clientWidth || canvas.clientWidth || 1));
    const height = Math.max(1, Math.round(Number(viewport?.height) || window.innerHeight || shell?.clientHeight || canvas.clientHeight || 1));
    const style = document.documentElement.style;
    style.setProperty('--rift-viewport-width', \`${'${width}'}px\`);
    style.setProperty('--rift-viewport-height', \`${'${height}'}px\`);
    style.setProperty('--rift-viewport-left', \`${'${Math.max(0, Number(viewport?.offsetLeft) || 0)}'}px\`);
    style.setProperty('--rift-viewport-top', \`${'${Math.max(0, Number(viewport?.offsetTop) || 0)}'}px\`);

    const target = coarsePointer ? 1.35 : 1.75;
    const deviceRatio = Math.max(1, window.devicePixelRatio || 1);
    engine.resize(Math.min(deviceRatio, target));
  };

  const settleViewport = () => {
    if (destroyed) return;
    syncViewport();
    requestAnimationFrame(syncViewport);
    clearTimeout(viewportSettleTimer);
    clearTimeout(viewportFinalTimer);
    // Mobile Safari/PWA viewport dimensions can settle after fullscreen chrome
    // and orientation APIs finish. Re-measure twice so portrait fullscreen never
    // keeps the pre-fullscreen canvas/HUD geometry.
    viewportSettleTimer = window.setTimeout(syncViewport, 80);
    viewportFinalTimer = window.setTimeout(syncViewport, 220);
  };

  const clearViewportMetrics = () => {
    const style = document.documentElement.style;
    style.removeProperty('--rift-viewport-width');
    style.removeProperty('--rift-viewport-height');
    style.removeProperty('--rift-viewport-left');
    style.removeProperty('--rift-viewport-top');
  };

  const setGameMode = async enabled => {
`, 'replace resize with visual viewport sync');

  js = replaceOnce(js,
`    if (enabled) {
      try {
`,
`    if (enabled) {
      settleViewport();
      try {
`, 'pre-fullscreen sync');

  js = replaceOnce(js,
`    requestAnimationFrame(resize);
  };
  const onFullscreenButton = () => setGameMode(!gameMode);
`,
`    settleViewport();
  };
  const onFullscreenButton = () => setGameMode(!gameMode);
`, 'post-toggle settle');

  js = replaceOnce(js,
`    requestAnimationFrame(resize);
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.visualViewport?.addEventListener('resize', resize);
  resize();
`,
`    settleViewport();
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  window.addEventListener('resize', settleViewport);
  window.addEventListener('orientationchange', settleViewport);
  window.visualViewport?.addEventListener('resize', settleViewport);
  window.visualViewport?.addEventListener('scroll', settleViewport);
  settleViewport();
`, 'viewport listeners');

  js = replaceOnce(js,
`      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      document.body.classList.remove('world3d-game-mode');
`,
`      window.removeEventListener('resize', settleViewport);
      window.removeEventListener('orientationchange', settleViewport);
      window.visualViewport?.removeEventListener('resize', settleViewport);
      window.visualViewport?.removeEventListener('scroll', settleViewport);
      clearTimeout(viewportSettleTimer);
      clearTimeout(viewportFinalTimer);
      clearViewportMetrics();
      document.body.classList.remove('world3d-game-mode');
`, 'viewport listener cleanup');

  fs.writeFileSync(jsPath, js);
  console.log('[portrait-viewport] patched downtown3d-foundation.js');
}

const cssPath = 'public/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('H1.86 — visualViewport-authoritative iPhone fullscreen sizing')) {
  css = replaceOnce(css,
`body.world3d-game-mode .game-root:has(.world3d-shell){position:fixed;inset:0;z-index:200;width:100%;height:100dvh;padding:0;margin:0;overflow:hidden}
body.world3d-game-mode .world3d-shell{width:100%;height:100%;min-height:0}
`,
`body.world3d-game-mode .game-root:has(.world3d-shell){position:fixed;left:0;top:0;right:auto;bottom:auto;z-index:200;width:var(--rift-viewport-width,100vw);height:var(--rift-viewport-height,100dvh);max-width:none;max-height:none;padding:0;margin:0;overflow:hidden}
body.world3d-game-mode .world3d-shell{width:var(--rift-viewport-width,100%);height:var(--rift-viewport-height,100%);max-width:none;max-height:none;min-height:0}
body.world3d-game-mode #riftcity-3d-canvas{width:100%!important;height:100%!important}
`, 'fullscreen shell sizing');

  const anchor = `/* H1.85 — portrait fullscreen gameplay HUD cleanup
`;
  const addition = `/* H1.86 — visualViewport-authoritative iPhone fullscreen sizing.
   Safari/PWA chrome and failed orientation locks can leave 100dvh one layout
   cycle behind the actually visible portrait viewport. JS publishes the live
   visualViewport dimensions above; every gameplay overlay inherits this shell. */
body.world3d-game-mode .rift-first-person-reticle{
  left:calc(var(--rift-viewport-width,100vw) * .5);
  top:calc(var(--rift-viewport-height,100dvh) * .5);
}
@media (orientation:portrait) and (pointer:coarse){
  body.world3d-game-mode .game-root:has(.world3d-shell),
  body.world3d-game-mode .world3d-shell{
    width:var(--rift-viewport-width,100vw)!important;
    height:var(--rift-viewport-height,100dvh)!important;
  }
}

`;
  css = replaceOnce(css, anchor, addition + anchor, 'portrait fullscreen overrides');
  fs.writeFileSync(cssPath, css);
  console.log('[portrait-viewport] patched styles.css');
}

if (!fs.readFileSync(jsPath, 'utf8').includes("window.visualViewport?.addEventListener('scroll', settleViewport)")) {
  throw new Error('[portrait-viewport] visualViewport scroll synchronization missing after patch');
}
if (!fs.readFileSync(cssPath, 'utf8').includes('height:var(--rift-viewport-height,100dvh)')) {
  throw new Error('[portrait-viewport] viewport CSS height override missing after patch');
}
console.log('[portrait-viewport] patch staged successfully');
