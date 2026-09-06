const TEST_BUTTON_ID = 'diagnostic-auto-full-test';
const TOOLS_ID = 'terrain-tools';
const TOOLS_BUTTON_ID = 'terrain-tools-button';

let restoringRun = 0;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function restoreToolsWhenFinished(runToken, wasOpen) {
  if (!wasOpen) return;
  for (;;) {
    if (runToken !== restoringRun) return;
    const status = window.RiftSurvivalAutoValidation?.status?.();
    if (!status?.running) break;
    await sleep(120);
  }

  const tools = document.getElementById(TOOLS_ID);
  const toolsButton = document.getElementById(TOOLS_BUTTON_ID);
  if (tools?.hidden === true) toolsButton?.click();
}

function install() {
  const testButton = document.getElementById(TEST_BUTTON_ID);
  const tools = document.getElementById(TOOLS_ID);
  const toolsButton = document.getElementById(TOOLS_BUTTON_ID);
  if (!testButton || !tools || !toolsButton) {
    setTimeout(install, 100);
    return;
  }
  if (testButton.dataset.toolsAutoClose === '1') return;
  testButton.dataset.toolsAutoClose = '1';

  // The main auto-validation listener is registered before this module. By the
  // time this listener runs, it has already captured the user's UI baseline.
  // Close Tools for unobstructed test screenshots, then restore it afterward.
  testButton.addEventListener('click', () => {
    const wasOpen = tools.hidden === false;
    const token = ++restoringRun;
    setTimeout(() => {
      const status = window.RiftSurvivalAutoValidation?.status?.();
      if (status?.running && tools.hidden === false) toolsButton.click();
      void restoreToolsWhenFinished(token, wasOpen);
    }, 0);
  });
}

install();
