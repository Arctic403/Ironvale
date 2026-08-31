const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
  || window.navigator.standalone === true;

document.documentElement.classList.toggle('pwa-standalone', standalone);
document.body.classList.toggle('pwa-standalone', standalone);

export function initPwaSupport() {
  if (standalone) {
    document.documentElement.dataset.displayMode = 'standalone';
    return;
  }
  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isAppleMobile) return;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('ironvale_install_hint_dismissed') === '1'; } catch (_) {}
  if (dismissed) return;
  const banner = document.createElement('aside');
  banner.id = 'ironvale-install-hint';
  banner.className = 'ironvale-install-hint riftcity-install-hint';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `<div><strong>Install Ironvale</strong><span>Safari: Share → Add to Home Screen → Open as Web App</span></div><button type="button" aria-label="Dismiss install hint">×</button>`;
  const dismiss = () => {
    banner.remove();
    try { sessionStorage.setItem('ironvale_install_hint_dismissed', '1'); } catch (_) {}
  };
  banner.querySelector('button')?.addEventListener('click', dismiss);
  document.body.appendChild(banner);
}

export function isStandaloneWebApp() { return standalone; }
